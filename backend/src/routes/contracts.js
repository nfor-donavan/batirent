const router = require('express').Router();
const multer = require('multer');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { RentalContract, ReturnInspection, SmsLog, AuditLog } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const svc = require('../services/contractService');
const P = require('../services/penalty');
const { storePhoto } = require('../services/storage');

router.use(authenticate);
const managers = requireRole('owner', 'manager');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    const err = new Error('Only JPEG, PNG or WebP images are accepted');
    err.code = 'PHOTO_TYPE';
    err.status = 415;
    cb(err);
  },
});

const parseJson = (v, fallback) => {
  if (v === undefined || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { throw new AppError(422, 'BAD_JSON'); }
};

router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  const filter = { tenantId: req.tenant._id };
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.open === 'true') filter.status = { $ne: 'Returned_Settled' };
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ contractNumber: rx }, { clientName: rx }, { clientCompany: rx }, { siteLocation: rx }, { clientPhone: rx }];
  }
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const items = await RentalContract.find(filter).sort({ expectedReturnDate: 1 }).limit(limit).lean();
  const enriched = items.map((c) => P.enrich(c, now));
  // Overdue contracts with the biggest exposure first, then by due date.
  enriched.sort((a, b) => {
    const open = (c) => (c.status === 'Returned_Settled' ? 1 : 0);
    if (open(a) !== open(b)) return open(a) - open(b);
    if (b.overdueExposureXAF !== a.overdueExposureXAF) return b.overdueExposureXAF - a.overdueExposureXAF;
    return new Date(a.expectedReturnDate) - new Date(b.expectedReturnDate);
  });
  res.json({ items: enriched });
}));

router.post('/', managers, asyncHandler(async (req, res) => {
  const contract = await svc.createContract(req.tenant, req.user, req.body);
  res.status(201).json(P.enrich(contract));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(404, 'CONTRACT_NOT_FOUND');
  const c = await RentalContract.findOne({ _id: req.params.id, tenantId: req.tenant._id }).lean();
  if (!c) throw new AppError(404, 'CONTRACT_NOT_FOUND');
  const [inspections, sms, audit] = await Promise.all([
    ReturnInspection.find({ contractId: c._id, tenantId: req.tenant._id }).sort({ returnedAt: -1 }).lean(),
    SmsLog.find({ contractId: c._id, tenantId: req.tenant._id }).sort({ createdAt: -1 }).limit(20).lean(),
    AuditLog.find({ entityId: c._id, tenantId: req.tenant._id }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  res.json({ contract: P.enrich(c), settlement: P.settlement(c), inspections, notifications: sms, audit });
}));

// Condition Photo Verification endpoint (used by the Expo field app).
// multipart/form-data: lines (JSON), photoMeta (JSON, aligned with photos), notes, clientSignatureName,
// damageChargeXAF (managers only), photos[] (JPEG/PNG/WebP).
router.post('/:id/returns', upload.array('photos', 12), asyncHandler(async (req, res) => {
  const lines = parseJson(req.body.lines, []);
  const meta = parseJson(req.body.photoMeta, []);
  const files = req.files || [];

  const stored = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const saved = await storePhoto(f.buffer, f.mimetype, req.tenant._id);
    stored.push({ ...saved, ...(meta[i] || {}) });
  }

  const canAssessDamage = ['owner', 'manager'].includes(req.user.role);
  const { contract, inspection } = await svc.processReturn(
    req.tenant._id, req.user, req.params.id,
    { lines, photos: stored, notes: req.body.notes, clientSignatureName: req.body.clientSignatureName, damageChargeXAF: req.body.damageChargeXAF },
    { canAssessDamage }
  );
  res.status(201).json({ contract: P.enrich(contract), inspection, settlement: P.settlement(contract.toObject()) });
}));

router.patch('/:id/dispute', managers, asyncHandler(async (req, res) => {
  const c = await svc.setDispute(req.tenant._id, req.user, req.params.id, req.body.reason);
  res.json(P.enrich(c));
}));

router.patch('/:id/resolve-dispute', managers, asyncHandler(async (req, res) => {
  const c = await svc.resolveDispute(req.tenant._id, req.user, req.params.id);
  res.json(P.enrich(c));
}));

router.patch('/:id/damage-charge', managers, asyncHandler(async (req, res) => {
  const c = await svc.setDamageCharge(req.tenant._id, req.user, req.params.id, req.body.amountXAF);
  res.json({ contract: P.enrich(c), settlement: P.settlement(c.toObject()) });
}));

module.exports = router;
