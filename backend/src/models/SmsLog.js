const mongoose = require('mongoose');

const SmsLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalContract', index: true },
    to: { type: String, required: true },
    kind: { type: String, enum: ['expiry_reminder', 'overdue_notice', 'return_receipt', 'other'], default: 'other' },
    message: { type: String, required: true },
    provider: String,
    status: { type: String, enum: ['sent', 'failed', 'logged'], default: 'logged' },
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('SmsLog', SmsLogSchema);
