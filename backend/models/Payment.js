const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order_id: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  client_name: { type: String },
  amount_paid: { type: Number, required: true },
  payment_type: { type: String, enum: ['Reservation Fee', 'Final Balance', 'Other'], default: 'Reservation Fee' },
  receipt_url: { type: String, required: true },
  status: { type: String, enum: ['Pending Verification', 'Verified', 'Rejected'], default: 'Pending Verification' },
  reference_number: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Payment', paymentSchema);
