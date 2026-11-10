const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { User, Tenant } = require('../models');
const { signToken, authenticate } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'TOO_MANY_ATTEMPTS')),
});

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });
const publicTenant = (t) => ({ id: t._id, name: t.name, code: t.code, city: t.city, phone: t.phone, address: t.address, settings: t.settings });

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'BAD_CREDENTIALS');
  }
  const tenant = await Tenant.findById(user.tenantId);
  res.json({ token: signToken(user), user: publicUser(user), tenant: publicTenant(tenant) });
}));

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user), tenant: publicTenant(req.tenant) });
});

module.exports = router;
