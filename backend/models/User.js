const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, maxlength: 30 },
  password: { type: String, required: true, maxlength: 255 },
  email: { type: String, required: true, unique: true, maxlength: 100 },
  first_name: { type: String, required: true, maxlength: 50 },
  middle_name: { type: String, maxlength: 50 },
  last_name: { type: String, required: true, maxlength: 50 },
  phone: { type: String, maxlength: 25 },
  address: { type: String, maxlength: 255 },
  addressLine1: { type: String, maxlength: 100 },
  addressLine2: { type: String, maxlength: 100 },
  province: { type: String, maxlength: 60 },
  city: { type: String, maxlength: 60 },
  barangay: { type: String, maxlength: 60 },
  gender: { type: String, maxlength: 20 },
  date_of_birth: { type: Date },
  profile_picture: { type: String },
  clientType: { type: String, enum: ['residential', 'commercial', 'industrial'], default: 'residential' },
  companyName: { type: String, maxlength: 100 },
  inactive: { type: Boolean, default: false },
  last_login: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  resetPasswordToken: { type: String, index: true, sparse: true },
  resetPasswordExpires: { type: Date },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  loginAttempts: { type: Number, required: true, default: 0 },
  lockUntil: { type: Date }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);
