const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  service_type: { type: String, required: true },
  date: { type: Date, required: true },
  time_slot: { type: String, enum: ['Morning', 'Afternoon', 'Evening'], required: true },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' },
  price: { type: Number },
  tax_amount: { type: Number, default: 0 },
  discount_amount: { type: Number, default: 0 },
  request_type: { type: String, enum: ['Cancel Requested', 'Reschedule Requested', null], default: null },
  approval_fee: { type: Number, default: 0 },
  reservation_receipt_url: { type: String },
  quotation_pdf_url: { type: String },
  confirmed_date: { type: Date },
  confirmed_time_slot: { type: String },
  truck_team: { type: String },
  service_report_pdf_url: { type: String },
  final_price: { type: Number },
  notes: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Order', orderSchema);
