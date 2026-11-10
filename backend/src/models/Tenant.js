const mongoose = require('mongoose');

// One document per leasing yard. Every other collection carries tenantId = Tenant._id.
const TenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. YDE
    city: { type: String, enum: ['Yaoundé', 'Douala', 'Kribi', 'Other'], default: 'Yaoundé' },
    phone: String,
    address: String,
    settings: {
      penaltyMultiplier: { type: Number, default: 1.5, min: 1, max: 5 },
      expiryReminderDays: { type: Number, default: 2, min: 0, max: 14 },
      smsEnabled: { type: Boolean, default: true },
      smsLanguage: { type: String, enum: ['fr', 'en'], default: 'fr' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', TenantSchema);
