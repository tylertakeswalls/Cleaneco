const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key_name: { type: String, required: true, unique: true },
  value: { type: String, required: true }
}, { timestamps: { createdAt: false, updatedAt: 'updated_at' } });

module.exports = mongoose.model('Setting', settingSchema);
