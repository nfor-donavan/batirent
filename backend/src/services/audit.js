const { AuditLog } = require('../models');

async function audit(user, tenantId, action, entityType, entityId, summary, meta) {
  try {
    await AuditLog.create({
      tenantId,
      userId: user && user._id,
      userName: user && user.name,
      action,
      entityType,
      entityId,
      summary,
      meta,
    });
  } catch (err) {
    console.error('audit log failed', err.message); // never block business flow on logging
  }
}
module.exports = { audit };
