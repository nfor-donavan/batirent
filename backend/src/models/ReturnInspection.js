const mongoose = require('mongoose');

// Immutable audit record created every time stock comes back from a site.
// There is deliberately no update/delete route for this collection.
const PhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetInventory' },
    caption: String,
    sha256: String, // fingerprint of the uploaded bytes: proves the file was not swapped later
    takenAt: Date, // device clock when captured
    uploadedAt: { type: Date, default: Date.now },
    bytes: Number,
  },
  { _id: true }
);

const InspectionLineSchema = new mongoose.Schema(
  {
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetInventory', required: true },
    itemName: String,
    itemNameEn: String,
    goodQty: { type: Number, default: 0 },
    damagedQty: { type: Number, default: 0 },
    lostQty: { type: Number, default: 0 },
    note: String,
  },
  { _id: false }
);

const ReturnInspectionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalContract', required: true, index: true },
    contractNumber: String,
    inspectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inspectorName: String,
    returnedAt: { type: Date, default: Date.now },
    lines: { type: [InspectionLineSchema], validate: (v) => v.length > 0 },
    photos: [PhotoSchema],
    notes: String,
    damageChargeXAF: { type: Number, default: 0 }, // charge assessed at this inspection
    penaltyAtReturnXAF: { type: Number, default: 0 }, // snapshot of overdue exposure at the time
    clientSignatureName: String, // person who handed the stock back
  },
  { timestamps: true }
);

module.exports = mongoose.model('ReturnInspection', ReturnInspectionSchema);
