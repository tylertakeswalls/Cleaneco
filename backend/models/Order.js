const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  order_id: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  landmark: { type: String },
  service_type: { type: String, required: true },
  date: { type: Date, required: true },
  time_slot: { type: String, enum: ['Morning', 'Afternoon', 'Evening'], required: true },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' },
  price: { type: Number },
  tax_amount: { type: Number, default: 0 },
  discount_amount: { type: Number, default: 0 },
  request_type: { type: String, enum: ['Cancel Requested', 'Reschedule Requested', null], default: null },
  reschedule_target: { type: String, enum: ['inspection', 'execution', null], default: null },
  reschedule_date: { type: Date },
  reschedule_time_slot: { type: String, enum: ['Morning', 'Afternoon', 'Evening'] },
  reschedule_reason: { type: String },
  reject_reason: { type: String },
  approval_fee: { type: Number, default: 0 },
  quotation_pdf_url: { type: String },
  confirmed_date: { type: Date },
  confirmed_time_slot: { type: String },
  truck_team: { type: String },
  service_report_pdf_url: { type: String },
  final_price: { type: Number },
  notes: { type: String },
  internal_notes: { type: String },
  base_estimate: { type: Number, default: 0 },
  misc_fee: { type: Number, default: 0 },
  estimate_inputs: { type: mongoose.Schema.Types.Mixed },
  justifications: { type: mongoose.Schema.Types.Mixed },
  site_photo_url: { type: String },
  final_payment_status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  has_final_price: { type: Boolean, default: false },
  payment_method: { type: String, enum: ['online', 'cheque', 'paymongo'], default: 'online' },
  cheque_payer_name: { type: String },
  cheque_number: { type: String },
  cheque_date: { type: Date },
  cheque_amount: { type: Number },
  cheque_issuing_bank: { type: String },
  cheque_type: { type: String, enum: ['Local', "Manager's"] },
  cheque_status: { type: String, enum: ['pending_verification', 'approved', 'rejected'], default: 'pending_verification' },
  cheque_image_url: { type: String },
  
  // Phase 2: Hierarchical Quotation & Scheduling Fields
  scope_of_works: [{
    main_item: { type: String },
    sub_items: [{
      name: { type: String },
      value: { type: String },
      justification: { type: String },
      price: { type: Number, default: 0 }
    }],
    subtotal: { type: Number, default: 0 }
  }],
  quotation_status: { type: String, enum: ['Pending Inspection', 'Pending Client Approval', 'Clarification Requested', 'Approved', 'Client Declined'], default: 'Pending Inspection' },
  service_execution_date: { type: Date },
  service_execution_time_slot: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Order', orderSchema);
