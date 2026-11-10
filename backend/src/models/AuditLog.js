const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    action: { type: String, required: true }, // contract.created, contract.return, asset.repaired ...
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    summary: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
