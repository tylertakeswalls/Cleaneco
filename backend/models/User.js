const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  first_name: { type: String, required: true },
  middle_name: { type: String },
  last_name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  gender: { type: String },
  date_of_birth: { type: Date },
  profile_picture: { type: String },
  clientType: { type: String, enum: ['residential', 'commercial', 'industrial'], default: 'residential' },
  companyName: { type: String },
  inactive: { type: Boolean, default: false },
  last_login: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  loginAttempts: { type: Number, required: true, default: 0 },
  lockUntil: { type: Date }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });


module.exports = mongoose.model('User', userSchema);
