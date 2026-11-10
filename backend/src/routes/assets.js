const router = require('express').Router();
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { AssetInventory } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../services/audit');
const { deployedByAsset } = require('../services/dashboardService');

router.use(authenticate);
const managers = requireRole('owner', 'manager');
const int = (v) => Math.trunc(Number(v));

router.get('/', asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenant._id };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.active !== 'all') filter.active = true;
  if (req.query.q) filter.$or = [
    { itemName: new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    { itemNameEn: new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
  ];
  const [assets, { map }] = await Promise.all([
    AssetInventory.find(filter).sort({ category: 1, itemName: 1 }).lean(),
    deployedByAsset(req.tenant._id),
  ]);
  res.json({
    items: assets.map((a) => {
      const deployed = map.get(String(a._id)) || 0;
      return { ...a, deployedQty: deployed, utilizationRate: a.totalOwnedQty ? deployed / a.totalOwnedQty : 0 };
    }),
  });
}));

router.post('/', managers, asyncHandler(async (req, res) => {
  const b = req.body;
  const total = int(b.totalOwnedQty);
  if (!Number.isFinite(total) || total < 0) throw new AppError(422, 'QUANTITY_INVALID');
  const asset = await AssetInventory.create({
    tenantId: req.tenant._id, itemName: b.itemName, itemNameEn: b.itemNameEn, category: b.category,
    totalOwnedQty: total, currentAvailableQty: total, unitValueXAF: int(b.unitValueXAF),
    defaultDailyRateXAF: int(b.defaultDailyRateXAF || 0),
  });
  await audit(req.user, req.tenant._id, 'asset.created', 'AssetInventory', asset._id, `${asset.itemName} x${total}`);
  res.status(201).json(asset);
}));

// Descriptive fields and prices only. Quantities change through /adjust and /repair so every
// stock movement is explicit and audited.
router.patch('/:id', managers, asyncHandler(async (req, res) => {
  const allowed = ['itemName', 'itemNameEn', 'category', 'unitValueXAF', 'defaultDailyRateXAF', 'active'];
  const set = {};
  for (const k of allowed) if (req.body[k] !== undefined) set[k] = req.body[k];
  const asset = await AssetInventory.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenant._id }, { $set: set }, { new: true, runValidators: true });
  if (!asset) throw new AppError(404, 'ASSET_NOT_FOUND');
  await audit(req.user, req.tenant._id, 'asset.updated', 'AssetInventory', asset._id, asset.itemName);
  res.json(asset);
}));

// Purchase (positive delta) or disposal (negative delta) of units sitting in the yard.
router.post('/:id/adjust', managers, asyncHandler(async (req, res) => {
  const delta = int(req.body.delta);
  if (!Number.isFinite(delta) || delta === 0) throw new AppError(422, 'QUANTITY_INVALID');
  const filter = { _id: req.params.id, tenantId: req.tenant._id };
  if (delta < 0) filter.currentAvailableQty = { $gte: -delta };
  const asset = await AssetInventory.findOneAndUpdate(filter, { $inc: { totalOwnedQty: delta, currentAvailableQty: delta } }, { new: true });
  if (!asset) throw new AppError(409, 'INSUFFICIENT_STOCK');
  await audit(req.user, req.tenant._id, 'asset.adjusted', 'AssetInventory', asset._id, `${asset.itemName} ${delta > 0 ? '+' : ''}${delta}`, { reason: req.body.reason });
  res.json(asset);
}));

// Repaired units go back to the available pool.
router.post('/:id/repair', managers, asyncHandler(async (req, res) => {
  const qty = int(req.body.qty);
  if (!Number.isFinite(qty) || qty < 1) throw new AppError(422, 'QUANTITY_INVALID');
  const asset = await AssetInventory.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenant._id, inRepairQty: { $gte: qty } },
    { $inc: { inRepairQty: -qty, lostDamagedQty: -qty, currentAvailableQty: qty } },
    { new: true }
  );
  if (!asset) throw new AppError(409, 'NOT_ENOUGH_IN_REPAIR');
  await audit(req.user, req.tenant._id, 'asset.repaired', 'AssetInventory', asset._id, `${asset.itemName} x${qty} back in service`);
  res.json(asset);
}));

module.exports = router;
