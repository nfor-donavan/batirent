const mongoose = require('mongoose');

// Atomic per-tenant, per-year contract sequence.
const CounterSchema = new mongoose.Schema({
  _id: String, // `${tenantId}:${year}`
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', CounterSchema);
