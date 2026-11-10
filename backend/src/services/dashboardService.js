const mongoose = require('mongoose');
const { AssetInventory, RentalContract, ReturnInspection } = require('../models');
const P = require('./penalty');
const { daysBetween } = require('../utils/dates');

const CATEGORIES = ['Scaffolding', 'Formwork_Props', 'Heavy_Machinery', 'Hand_Tools'];

/** Units currently out on open contracts, keyed by assetId. */
async function deployedByAsset(tenantId) {
  const contracts = await RentalContract.find({ tenantId, status: { $ne: 'Returned_Settled' } }).lean();
  const map = new Map();
  for (const c of contracts) {
    for (const l of c.itemsLeased) {
      const out = Math.max(0, P.outstandingQty(l));
      map.set(String(l.assetId), (map.get(String(l.assetId)) || 0) + out);
    }
  }
  return { map, contracts };
}

async function summary(tenantId, now = new Date()) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const [assets, { map: deployed, contracts: open }] = await Promise.all([
    AssetInventory.find({ tenantId: tid, active: true }).lean(),
    deployedByAsset(tid),
  ]);

  // ---- utilisation by category -------------------------------------------------
  const byCategory = {};
  for (const cat of CATEGORIES) {
    byCategory[cat] = { category: cat, total: 0, available: 0, deployed: 0, lostDamaged: 0, inRepair: 0, valueOwnedXAF: 0, valueDeployedXAF: 0 };
  }
  for (const a of assets) {
    const d = deployed.get(String(a._id)) || 0;
    const row = byCategory[a.category];
    row.total += a.totalOwnedQty;
    row.available += a.currentAvailableQty;
    row.deployed += d;
    row.lostDamaged += a.lostDamagedQty;
    row.inRepair += a.inRepairQty;
    row.valueOwnedXAF += a.totalOwnedQty * a.unitValueXAF;
    row.valueDeployedXAF += d * a.unitValueXAF;
  }
  const categories = Object.values(byCategory).map((r) => ({
    ...r,
    utilizationRate: r.total ? r.deployed / r.total : 0,
  }));
  const totals = categories.reduce(
    (s, r) => ({
      total: s.total + r.total, deployed: s.deployed + r.deployed, available: s.available + r.available,
      lostDamaged: s.lostDamaged + r.lostDamaged, valueOwnedXAF: s.valueOwnedXAF + r.valueOwnedXAF,
      valueDeployedXAF: s.valueDeployedXAF + r.valueDeployedXAF,
    }),
    { total: 0, deployed: 0, available: 0, lostDamaged: 0, valueOwnedXAF: 0, valueDeployedXAF: 0 }
  );

  // ---- contracts ---------------------------------------------------------------
  const enriched = open.map((c) => P.enrich(c, now));
  const overdue = enriched.filter((c) => c.daysOverdue > 0 && c.status !== 'Returned_Settled');
  const totalExposureXAF = enriched.reduce((s, c) => s + c.overdueExposureXAF, 0);
  const depositsHeldXAF = enriched.reduce((s, c) => s + c.securityDepositXAF, 0);

  const slim = (c) => ({
    _id: c._id, contractNumber: c.contractNumber, clientName: c.clientName, clientCompany: c.clientCompany,
    siteLocation: c.siteLocation, status: c.status, expectedReturnDate: c.expectedReturnDate,
    daysRemaining: c.daysRemaining, daysOverdue: c.daysOverdue, progress: c.progress,
    outstandingQty: c.outstandingQty, overdueExposureXAF: c.overdueExposureXAF,
    dailyOverdueRateXAF: c.dailyOverdueRateXAF,
  });

  const expiringSoon = enriched
    .filter((c) => c.status === 'Active' && c.daysRemaining >= 0 && c.daysRemaining <= 3)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .map(slim);
  const topOverdue = [...overdue].sort((a, b) => b.overdueExposureXAF - a.overdueExposureXAF).slice(0, 6).map(slim);

  // ---- history -------------------------------------------------------------------
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [recentContracts, inspections, allContractsLoss] = await Promise.all([
    RentalContract.find({ tenantId: tid, startDate: { $gte: sixMonthsAgo } }).select('startDate plannedRentalXAF').lean(),
    ReturnInspection.find({ tenantId: tid }).sort({ returnedAt: -1 }).limit(6).lean(),
    RentalContract.find({ tenantId: tid }).select('itemsLeased').lean(),
  ]);
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthly.push({ month: d.toISOString().slice(0, 7), contracts: 0, plannedRentalXAF: 0 });
  }
  for (const c of recentContracts) {
    const key = new Date(c.startDate).toISOString().slice(0, 7);
    const row = monthly.find((m) => m.month === key);
    if (row) { row.contracts += 1; row.plannedRentalXAF += c.plannedRentalXAF; }
  }
  const lostValueXAF = allContractsLoss.reduce((s, c) => s + P.lostValue(c), 0);

  return {
    generatedAt: now,
    kpis: {
      utilizationRate: totals.total ? totals.deployed / totals.total : 0,
      unitsDeployed: totals.deployed,
      unitsTotal: totals.total,
      unitsAvailable: totals.available,
      unitsLostDamaged: totals.lostDamaged,
      valueAtSitesXAF: totals.valueDeployedXAF,
      valueOwnedXAF: totals.valueOwnedXAF,
      openContracts: enriched.length,
      overdueContracts: overdue.length,
      disputedContracts: enriched.filter((c) => c.status === 'Disputed').length,
      expiringSoon: expiringSoon.length,
      totalOverdueExposureXAF: totalExposureXAF,
      depositsHeldXAF,
      lostValueXAF,
    },
    categories,
    expiringSoon,
    topOverdue,
    monthly,
    recentInspections: inspections.map((i) => ({
      _id: i._id, contractId: i.contractId, contractNumber: i.contractNumber, returnedAt: i.returnedAt,
      inspectorName: i.inspectorName, photos: (i.photos || []).length,
      units: i.lines.reduce((s, l) => s + l.goodQty + l.damagedQty + l.lostQty, 0),
      damaged: i.lines.reduce((s, l) => s + l.damagedQty, 0), lost: i.lines.reduce((s, l) => s + l.lostQty, 0),
    })),
  };
}

/** Reconciles stored stock against open contracts. Anything but zero discrepancies needs a look. */
async function integrity(tenantId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const [assets, { map: deployed }] = await Promise.all([
    AssetInventory.find({ tenantId: tid }).lean(),
    deployedByAsset(tid),
  ]);
  const rows = assets.map((a) => {
    const d = deployed.get(String(a._id)) || 0;
    const expectedAvailable = a.totalOwnedQty - d - a.lostDamagedQty;
    return {
      assetId: a._id, itemName: a.itemName, totalOwnedQty: a.totalOwnedQty, deployedQty: d,
      lostDamagedQty: a.lostDamagedQty, storedAvailable: a.currentAvailableQty, expectedAvailable,
      discrepancy: a.currentAvailableQty - expectedAvailable,
    };
  });
  return { ok: rows.every((r) => r.discrepancy === 0), checkedAssets: rows.length, discrepancies: rows.filter((r) => r.discrepancy !== 0), rows };
}

module.exports = { summary, integrity, deployedByAsset };
