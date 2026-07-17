const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  base_price: { type: Number },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Service', serviceSchema);
