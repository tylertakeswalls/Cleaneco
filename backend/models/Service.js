const mongoose = require('mongoose');

const fieldOptionSchema = new mongoose.Schema({
  value: { type: String, required: true },
  label: { type: String, required: true },
  factor: { type: Number, default: 1 },
  amount: { type: Number, default: 0 },
  requires_photo: { type: Boolean, default: false }
}, { _id: false });

const pricingFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['number', 'multiplier', 'surcharge'], required: true },
  min: { type: Number, default: 1 },
  default: { type: mongoose.Schema.Types.Mixed },
  counts_toward_trips: { type: Boolean, default: false },
  options: [fieldOptionSchema]
}, { _id: false });

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  base_price: { type: Number },
  pricing_mode: { type: String, enum: ['calculated', 'inspection_only'], default: 'calculated' },
  rate: { type: Number, default: 0 },
  fixed_fee: { type: Number, default: 0 },
  fields: [pricingFieldSchema],
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Service', serviceSchema);

