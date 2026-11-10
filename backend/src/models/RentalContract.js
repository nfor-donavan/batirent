const mongoose = require('mongoose');

// A line is "outstanding" until it is returned good, returned damaged, or declared lost.
const LineSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetInventory', required: true },
    itemName: { type: String, required: true }, // snapshot, so history survives renames
    itemNameEn: String,
    quantity: { type: Number, required: true, min: 1 },
    dailyRatePerUnitXAF: { type: Number, required: true, min: 0 },
    replacementValuePerUnitXAF: { type: Number, required: true, min: 0 }, // snapshot of unitValueXAF
    returnedGoodQty: { type: Number, default: 0, min: 0 },
    returnedDamagedQty: { type: Number, default: 0, min: 0 },
    lostQty: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

// 2. RENTAL CONTRACT & LIFECYCLE
const RentalContractSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractNumber: { type: String, required: true }, // BR-YDE-2026-0042 (unique per tenant)
    clientName: { type: String, required: true, trim: true },
    clientCompany: { type: String, trim: true },
    clientPhone: { type: String, required: true }, // E.164, used for SMS
    clientIdNumber: { type: String, trim: true }, // CNI / RCCM of the signatory
    foremanName: { type: String, trim: true },
    siteLocation: { type: String, required: true, trim: true },
    siteCity: { type: String, trim: true },

    itemsLeased: { type: [LineSchema], validate: (v) => v.length > 0 },

    startDate: { type: Date, required: true },
    expectedReturnDate: { type: Date, required: true },
    actualReturnDate: { type: Date },
    securityDepositXAF: { type: Number, required: true, min: 0 }, // "La Caution"
    status: {
      type: String,
      enum: ['Active', 'Overdue', 'Returned_Settled', 'Disputed'],
      default: 'Active',
      index: true,
    },
    disputeReason: String,

    // --- Money ---
    plannedRentalXAF: { type: Number, required: true, min: 0 }, // rate x qty x planned days
    penaltyMultiplier: { type: Number, default: 1.5 }, // snapshot of the tenant setting at signature
    // Penalty accrual is checkpointed at each partial return so past days are billed on the
    // quantity that was actually still out on those days.
    penaltyBaseXAF: { type: Number, default: 0 },
    penaltyCheckpointDate: { type: Date }, // starts at expectedReturnDate
    currentOverdueExposureXAF: { type: Number, default: 0 }, // refreshed daily by the cron + on every return
    damageChargesXAF: { type: Number, default: 0 }, // manager-assessed repair charges

    // --- Notification bookkeeping (makes the cron idempotent) ---
    expiryReminderSentAt: Date,
    lastOverdueNoticeDay: Number, // Cameroon day index of the last overdue SMS

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Optimistic-concurrency token: two operators returning stock at the same moment cannot
    // both succeed against a stale view of the contract.
    rev: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// FIX: contract numbers are unique per yard, not globally.
RentalContractSchema.index({ tenantId: 1, contractNumber: 1 }, { unique: true });
RentalContractSchema.index({ tenantId: 1, status: 1, expectedReturnDate: 1 });

RentalContractSchema.methods.outstandingQty = function (line) {
  return line.quantity - line.returnedGoodQty - line.returnedDamagedQty - line.lostQty;
};

RentalContractSchema.virtual('isOpen').get(function () {
  return this.status !== 'Returned_Settled';
});

module.exports = mongoose.model('RentalContract', RentalContractSchema);
