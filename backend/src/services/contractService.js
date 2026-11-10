const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { normalizePhone } = require('../utils/phone');
const { startOfDay } = require('../utils/dates');
const P = require('./penalty');
const { audit } = require('./audit');
const { AssetInventory, RentalContract, Counter, ReturnInspection, Tenant } = require('../models');

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const toInt = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : NaN);

async function nextContractNumber(tenant, year) {
  const c = await Counter.findOneAndUpdate(
    { _id: `${tenant._id}:${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `BR-${tenant.code}-${year}-${String(c.seq).padStart(4, '0')}`;
}

/**
 * Creates a contract and reserves stock.
 *
 * FIX (stock drift): every line is reserved with a single conditional atomic update
 * ({ currentAvailableQty >= qty } -> $inc -qty). Two managers renting the last 50 frames at the
 * same instant cannot both succeed. If any line fails, the lines already reserved are released.
 */
async function createContract(tenant, user, input) {
  const clientName = String(input.clientName || '').trim();
  const siteLocation = String(input.siteLocation || '').trim();
  const phone = normalizePhone(input.clientPhone);
  if (!clientName) throw new AppError(422, 'CLIENT_NAME_REQUIRED');
  if (!siteLocation) throw new AppError(422, 'SITE_REQUIRED');
  if (!phone) throw new AppError(422, 'PHONE_INVALID');

  const startDate = new Date(input.startDate);
  const expectedReturnDate = new Date(input.expectedReturnDate);
  if (isNaN(startDate) || isNaN(expectedReturnDate)) throw new AppError(422, 'DATES_INVALID');
  if (expectedReturnDate < startDate) throw new AppError(422, 'RETURN_BEFORE_START');

  const deposit = toInt(input.securityDepositXAF);
  if (!Number.isFinite(deposit) || deposit < 0) throw new AppError(422, 'DEPOSIT_INVALID');

  // Merge duplicate assets so one asset cannot be reserved twice with stale numbers.
  const merged = new Map();
  for (const raw of input.items || []) {
    if (!isId(raw.assetId)) throw new AppError(422, 'ITEM_INVALID');
    const qty = toInt(raw.quantity);
    if (!Number.isFinite(qty) || qty < 1) throw new AppError(422, 'QUANTITY_INVALID');
    const key = String(raw.assetId);
    const prev = merged.get(key);
    merged.set(key, {
      assetId: key,
      quantity: (prev ? prev.quantity : 0) + qty,
      dailyRate: raw.dailyRatePerUnitXAF !== undefined && raw.dailyRatePerUnitXAF !== '' ? toInt(raw.dailyRatePerUnitXAF) : (prev && prev.dailyRate),
    });
  }
  if (merged.size === 0) throw new AppError(422, 'ITEMS_REQUIRED');

  const reserved = []; // { assetId, qty } for rollback
  const lines = [];
  try {
    for (const item of merged.values()) {
      const asset = await AssetInventory.findOneAndUpdate(
        { _id: item.assetId, tenantId: tenant._id, active: true, currentAvailableQty: { $gte: item.quantity } },
        { $inc: { currentAvailableQty: -item.quantity } },
        { new: true }
      );
      if (!asset) {
        const current = await AssetInventory.findOne({ _id: item.assetId, tenantId: tenant._id });
        if (!current || !current.active) throw new AppError(404, 'ASSET_NOT_FOUND');
        throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${current.currentAvailableQty} available`, {
          itemName: current.itemName,
          requested: item.quantity,
          available: current.currentAvailableQty,
        });
      }
      reserved.push({ assetId: asset._id, qty: item.quantity });
      const rate = Number.isFinite(item.dailyRate) && item.dailyRate >= 0 ? item.dailyRate : asset.defaultDailyRateXAF;
      lines.push({
        assetId: asset._id,
        itemName: asset.itemName,
        itemNameEn: asset.itemNameEn,
        quantity: item.quantity,
        dailyRatePerUnitXAF: rate,
        replacementValuePerUnitXAF: asset.unitValueXAF,
      });
    }

    const { amount } = P.plannedRental(lines, startDate, expectedReturnDate);
    const year = new Date(startDate).getUTCFullYear();
    const contractNumber = await nextContractNumber(tenant, year);

    const contract = await RentalContract.create({
      tenantId: tenant._id,
      contractNumber,
      clientName,
      clientCompany: input.clientCompany,
      clientPhone: phone,
      clientIdNumber: input.clientIdNumber,
      foremanName: input.foremanName,
      siteLocation,
      siteCity: input.siteCity,
      itemsLeased: lines,
      startDate,
      expectedReturnDate,
      securityDepositXAF: deposit,
      plannedRentalXAF: amount,
      penaltyMultiplier: tenant.settings.penaltyMultiplier,
      penaltyCheckpointDate: expectedReturnDate,
      status: P.derivedStatus({ itemsLeased: lines, expectedReturnDate }, new Date()),
      createdBy: user && user._id,
    });
    await audit(user, tenant._id, 'contract.created', 'RentalContract', contract._id,
      `${contract.contractNumber} - ${clientName} - ${lines.length} item type(s)`);
    return contract;
  } catch (err) {
    // Release anything we already reserved.
    await Promise.all(
      reserved.map((r) =>
        AssetInventory.updateOne({ _id: r.assetId, tenantId: tenant._id }, { $inc: { currentAvailableQty: r.qty } })
      )
    );
    throw err;
  }
}

/**
 * Records a (partial or full) return - the "Condition Photo Verification" flow.
 *
 * input.lines  : [{ assetId, goodQty, damagedQty, lostQty, note }]
 * input.photos : [{ url, sha256, bytes, assetId, caption, takenAt }]   (already stored)
 */
async function processReturn(tenantId, user, contractId, input, opts = {}) {
  const { canAssessDamage } = opts;
  if (!isId(contractId)) throw new AppError(404, 'CONTRACT_NOT_FOUND');
  const contract = await RentalContract.findOne({ _id: contractId, tenantId });
  if (!contract) throw new AppError(404, 'CONTRACT_NOT_FOUND');
  if (contract.status === 'Returned_Settled') throw new AppError(409, 'CONTRACT_CLOSED');

  const now = opts.now || new Date(); // opts.now is only used by the seed script to back-date history
  const incoming = new Map();
  for (const l of input.lines || []) {
    if (!isId(l.assetId)) throw new AppError(422, 'ITEM_INVALID');
    const good = toInt(l.goodQty || 0), dmg = toInt(l.damagedQty || 0), lost = toInt(l.lostQty || 0);
    if ([good, dmg, lost].some((n) => !Number.isFinite(n) || n < 0)) throw new AppError(422, 'QUANTITY_INVALID');
    if (good + dmg + lost === 0) continue;
    const key = String(l.assetId);
    const prev = incoming.get(key) || { goodQty: 0, damagedQty: 0, lostQty: 0, note: '' };
    incoming.set(key, {
      goodQty: prev.goodQty + good,
      damagedQty: prev.damagedQty + dmg,
      lostQty: prev.lostQty + lost,
      note: l.note || prev.note,
    });
  }
  if (incoming.size === 0) throw new AppError(422, 'NOTHING_TO_RETURN');

  // Validate against what is really outstanding.
  const inspectionLines = [];
  const inventoryDeltas = [];
  for (const [assetId, q] of incoming) {
    const line = contract.itemsLeased.find((x) => String(x.assetId) === assetId);
    if (!line) throw new AppError(422, 'ITEM_NOT_ON_CONTRACT');
    const outstanding = contract.outstandingQty(line);
    if (q.goodQty + q.damagedQty + q.lostQty > outstanding) {
      throw new AppError(409, 'RETURN_EXCEEDS_OUTSTANDING', null, { itemName: line.itemName, outstanding });
    }
    inspectionLines.push({ assetId: line.assetId, itemName: line.itemName, itemNameEn: line.itemNameEn, ...q });
    inventoryDeltas.push({ assetId: line.assetId, ...q });
  }

  const photos = input.photos || [];
  const hasDamage = inspectionLines.some((l) => l.damagedQty > 0);
  if (hasDamage && photos.length === 0) throw new AppError(422, 'PHOTO_REQUIRED_FOR_DAMAGE');

  // 1) freeze penalty accrued so far on the quantities that were still out
  const base = contract.toObject();
  const cp = P.checkpointAt(base, now);

  // 2) apply the return to the lines
  const newLines = base.itemsLeased.map((l) => {
    const q = incoming.get(String(l.assetId));
    if (!q) return l;
    return {
      ...l,
      returnedGoodQty: l.returnedGoodQty + q.goodQty,
      returnedDamagedQty: l.returnedDamagedQty + q.damagedQty,
      lostQty: l.lostQty + q.lostQty,
    };
  });
  const updated = { ...base, ...cp, itemsLeased: newLines };
  const allBack = P.totalOutstanding(updated) === 0;
  if (allBack) updated.actualReturnDate = now;

  let status = contract.status;
  if (status !== 'Disputed') status = P.derivedStatus(updated, now);
  else if (allBack) status = 'Disputed'; // stays disputed until a manager resolves it

  const damageCharge = canAssessDamage ? Math.max(0, toInt(input.damageChargeXAF || 0) || 0) : 0;
  const exposure = P.exposureAt(updated, now);

  // 3) optimistic-concurrency write: fails if someone else changed the contract meanwhile
  const guarded = await RentalContract.findOneAndUpdate(
    { _id: contract._id, tenantId, rev: contract.rev },
    {
      $set: {
        itemsLeased: newLines,
        penaltyBaseXAF: cp.penaltyBaseXAF,
        penaltyCheckpointDate: cp.penaltyCheckpointDate,
        currentOverdueExposureXAF: exposure,
        status,
        ...(allBack ? { actualReturnDate: now } : {}),
        damageChargesXAF: (contract.damageChargesXAF || 0) + damageCharge,
      },
      $inc: { rev: 1 },
    },
    { new: true }
  );
  if (!guarded) throw new AppError(409, 'CONCURRENT_MODIFICATION');

  // 4) put the stock back where it belongs
  await Promise.all(
    inventoryDeltas.map((d) =>
      AssetInventory.updateOne(
        { _id: d.assetId, tenantId },
        {
          $inc: {
            currentAvailableQty: d.goodQty,
            lostDamagedQty: d.damagedQty + d.lostQty,
            inRepairQty: d.damagedQty,
          },
        }
      )
    )
  );

  // 5) immutable audit record with the photographic proof
  const inspection = await ReturnInspection.create({
    tenantId,
    contractId: contract._id,
    contractNumber: contract.contractNumber,
    inspectorId: user._id,
    inspectorName: user.name,
    returnedAt: now,
    lines: inspectionLines,
    photos: photos.map((p) => ({
      url: p.url, assetId: isId(p.assetId) ? p.assetId : undefined, caption: p.caption,
      sha256: p.sha256, bytes: p.bytes, takenAt: p.takenAt ? new Date(p.takenAt) : undefined,
    })),
    notes: input.notes,
    damageChargeXAF: damageCharge,
    penaltyAtReturnXAF: exposure,
    clientSignatureName: input.clientSignatureName,
  });

  const units = inspectionLines.reduce((s, l) => s + l.goodQty + l.damagedQty + l.lostQty, 0);
  await audit(user, tenantId, 'contract.return', 'RentalContract', contract._id,
    `${contract.contractNumber}: ${units} unit(s) returned${hasDamage ? ' with damage' : ''}${allBack ? ' - contract closed' : ''}`);

  return { contract: guarded, inspection };
}

async function setDispute(tenantId, user, contractId, reason) {
  const c = await RentalContract.findOne({ _id: contractId, tenantId });
  if (!c) throw new AppError(404, 'CONTRACT_NOT_FOUND');
  if (c.status === 'Disputed') throw new AppError(409, 'ALREADY_DISPUTED');
  if (!reason || !String(reason).trim()) throw new AppError(422, 'REASON_REQUIRED');
  c.status = 'Disputed';
  c.disputeReason = String(reason).trim();
  c.rev += 1;
  await c.save();
  await audit(user, tenantId, 'contract.disputed', 'RentalContract', c._id, `${c.contractNumber}: ${c.disputeReason}`);
  return c;
}

async function resolveDispute(tenantId, user, contractId) {
  const c = await RentalContract.findOne({ _id: contractId, tenantId });
  if (!c) throw new AppError(404, 'CONTRACT_NOT_FOUND');
  if (c.status !== 'Disputed') throw new AppError(409, 'NOT_DISPUTED');
  c.status = P.derivedStatus(c.toObject(), new Date());
  c.disputeReason = undefined;
  c.rev += 1;
  await c.save();
  await audit(user, tenantId, 'contract.dispute_resolved', 'RentalContract', c._id, c.contractNumber);
  return c;
}

async function setDamageCharge(tenantId, user, contractId, amount) {
  const n = toInt(amount);
  if (!Number.isFinite(n) || n < 0) throw new AppError(422, 'AMOUNT_INVALID');
  const c = await RentalContract.findOneAndUpdate(
    { _id: contractId, tenantId }, { $set: { damageChargesXAF: n }, $inc: { rev: 1 } }, { new: true }
  );
  if (!c) throw new AppError(404, 'CONTRACT_NOT_FOUND');
  await audit(user, tenantId, 'contract.damage_assessed', 'RentalContract', c._id, `${c.contractNumber}: ${n} XAF`);
  return c;
}

module.exports = { createContract, processReturn, setDispute, resolveDispute, setDamageCharge };
