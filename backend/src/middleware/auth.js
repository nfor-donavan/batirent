const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');
const { User, Tenant } = require('../models');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), tid: String(user.tenantId), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Authenticates the request and pins it to ONE tenant. Every route reads req.tenant._id, never a
// tenant id supplied by the client, so a user can only ever see their own yard.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError(401, 'AUTH_REQUIRED');
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (e) {
      throw new AppError(401, 'AUTH_INVALID');
    }
    const user = await User.findById(payload.sub);
    if (!user || !user.active) throw new AppError(401, 'AUTH_INVALID');
    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) throw new AppError(401, 'AUTH_INVALID');
    req.user = user;
    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'FORBIDDEN'));

module.exports = { signToken, authenticate, requireRole };
