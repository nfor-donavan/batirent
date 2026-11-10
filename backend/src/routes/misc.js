const router = require('express').Router();
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { User, Tenant, AuditLog, ReturnInspection } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const dashboard = require('../services/dashboardService');
const { runOverdueSweep } = require('../jobs/overdueJob');
const { audit } = require('../services/audit');

router.use(authenticate);
const managers = requireRole('owner', 'manager');
const owner = requireRole('owner');

// ---- dashboard ----
router.get('/dashboard/summary', managers, asyncHandler(async (req, res) => res.json(await dashboard.summary(req.tenant._id))));
router.get('/dashboard/integrity', managers, asyncHandler(async (req, res) => res.json(await dashboard.integrity(req.tenant._id))));

// Manual trigger of the daily sweep (same code the cron runs). Handy for demos.
router.post('/dashboard/run-sweep', owner, asyncHandler(async (req, res) => res.json(await runOverdueSweep())));

// ---- inspections ----
router.get('/inspections', asyncHandler(async (req, res) => {
  const filter = { tenantId: req.tenant._id };
  if (req.query.contractId) filter.contractId = req.query.contractId;
  res.json({ items: await ReturnInspection.find(filter).sort({ returnedAt: -1 }).limit(100).lean() });
}));

// ---- audit trail ----
router.get('/audit', managers, asyncHandler(async (req, res) => {
  res.json({ items: await AuditLog.find({ tenantId: req.tenant._id }).sort({ createdAt: -1 }).limit(100).lean() });
}));

// ---- yard settings ----
router.get('/tenant', (req, res) => res.json(req.tenant));
router.patch('/tenant', owner, asyncHandler(async (req, res) => {
  const t = req.tenant;
  const b = req.body;
  if (b.name) t.name = b.name;
  if (b.phone !== undefined) t.phone = b.phone;
  if (b.address !== undefined) t.address = b.address;
  if (b.settings) {
    const s = b.settings;
    if (s.penaltyMultiplier !== undefined) t.settings.penaltyMultiplier = Number(s.penaltyMultiplier);
    if (s.expiryReminderDays !== undefined) t.settings.expiryReminderDays = Number(s.expiryReminderDays);
    if (s.smsEnabled !== undefined) t.settings.smsEnabled = Boolean(s.smsEnabled);
    if (s.smsLanguage) t.settings.smsLanguage = s.smsLanguage;
  }
  await t.save(); // note: the multiplier applies to NEW contracts; signed contracts keep their snapshot
  await audit(req.user, t._id, 'tenant.updated', 'Tenant', t._id, 'Yard settings updated');
  res.json(t);
}));

// ---- users ----
router.get('/users', owner, asyncHandler(async (req, res) => {
  res.json({ items: await User.find({ tenantId: req.tenant._id }).sort({ role: 1, name: 1 }).lean() });
}));
router.post('/users', owner, asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!['manager', 'operator', 'owner'].includes(role)) throw new AppError(422, 'ROLE_INVALID');
  if (!password || String(password).length < 8) throw new AppError(422, 'PASSWORD_WEAK');
  const user = await User.create({ tenantId: req.tenant._id, name, email, role, passwordHash: await bcrypt.hash(String(password), 10) });
  await audit(req.user, req.tenant._id, 'user.created', 'User', user._id, `${user.email} (${role})`);
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
}));
router.patch('/users/:id', owner, asyncHandler(async (req, res) => {
  const set = {};
  if (req.body.active !== undefined) set.active = Boolean(req.body.active);
  if (req.body.role) set.role = req.body.role;
  if (req.body.password) {
    if (String(req.body.password).length < 8) throw new AppError(422, 'PASSWORD_WEAK');
    set.passwordHash = await bcrypt.hash(String(req.body.password), 10);
  }
  if (String(req.params.id) === String(req.user._id) && (set.active === false || (set.role && set.role !== 'owner'))) {
    throw new AppError(409, 'CANNOT_DEMOTE_SELF');
  }
  const user = await User.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenant._id }, { $set: set }, { new: true });
  if (!user) throw new AppError(404, 'NOT_FOUND');
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role, active: user.active });
}));

module.exports = router;
