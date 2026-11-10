const mongoose = require('mongoose');

// 1. LEASING YARD INVENTORY
// Invariant (checked by the dashboard and by tests):
//   totalOwnedQty = currentAvailableQty + deployedQty + lostDamagedQty
// where deployedQty is the sum of outstanding quantities on Active/Overdue/Disputed contracts.
const AssetInventorySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    itemName: { type: String, required: true, trim: true },
    itemNameEn: { type: String, trim: true }, // optional English label for the bilingual UI
    category: {
      type: String,
      enum: ['Scaffolding', 'Formwork_Props', 'Heavy_Machinery', 'Hand_Tools'],
      required: true,
    },
    totalOwnedQty: { type: Number, required: true, min: 0 },
    currentAvailableQty: { type: Number, required: true, min: 0 }, // remaining in the yard pool
    lostDamagedQty: { type: Number, default: 0, min: 0 }, // written off + awaiting repair
    inRepairQty: { type: Number, default: 0, min: 0 }, // subset of lostDamagedQty that can come back
    unitValueXAF: { type: Number, required: true, min: 0 }, // replacement cost per unit
    defaultDailyRateXAF: { type: Number, default: 0, min: 0 }, // suggested rate when drafting a contract
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AssetInventorySchema.index({ tenantId: 1, itemName: 1 });

// Never let stock go negative or exceed ownership, whatever code path touches it.
AssetInventorySchema.pre('validate', function (next) {
  if (this.currentAvailableQty + this.lostDamagedQty > this.totalOwnedQty) {
    return next(new Error('Available + lost/damaged cannot exceed total owned quantity'));
  }
  next();
});

module.exports = mongoose.model('AssetInventory', AssetInventorySchema);
