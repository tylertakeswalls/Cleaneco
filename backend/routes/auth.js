const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendVerificationEmail } = require('../utils/emailHelper');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { password, email, firstName, middleName, lastName, phone, address, gender, dateOfBirth } = req.body;
    let username = req.body.username || email; // Fallback to email if no username

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = new User({
      username,
      password: hashedPassword,
      email,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      phone,
      address,
      gender,
      date_of_birth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      verificationToken
    });

    await user.save();
    
    // Send email asynchronously so it doesn't block response
    sendVerificationEmail(user.email, verificationToken, user.first_name);

    res.json({ success: true, message: 'Registration successful. Please verify your email.', userId: user._id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Registration failed: ' + error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = username || email;
    
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email address to log in.', notVerified: true, email: user.email });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'cleaneco_secure_jwt_secret_key_2026',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        middle_name: user.middle_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed: ' + error.message });
  }
});

// Verify email endpoint
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'No token provided' });

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined; // Clear the token
    await user.save();

    res.json({ success: true, message: 'Email verified successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed: ' + error.message });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ success: true, message: 'If that email exists, a verification link has been sent.' });
    }
    
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await user.save();

    sendVerificationEmail(user.email, verificationToken, user.first_name);

    res.json({ success: true, message: 'Verification email resent successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resend email: ' + error.message });
  }
});

module.exports = router;
