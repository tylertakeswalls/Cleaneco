const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailHelper');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const resetTime = req.rateLimit.resetTime;
    const remainingSeconds = resetTime ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : 60;
    res.status(429).json({
      success: false,
      message: `Too many login attempts. Please try again in ${remainingSeconds} seconds.`,
      locked: true,
      remainingSeconds
    });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { password, email, firstName, middleName, lastName, phone, address, gender, dateOfBirth, clientType, companyName } = req.body;
    let username = req.body.username || email; // Fallback to email if no username

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
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
      clientType: clientType || 'residential',
      companyName,
      verificationToken
    });

    await user.save();
    
    // Welcome Notification for Client
    await new Notification({
      user_id: user._id,
      message: 'Welcome to Cleaneco!',
      details: 'Thank you for registering. You can now start booking services.'
    }).save();

    // New Registration Notification for Admins
    await new Notification({
      message: 'New User Registration',
      details: `User ${user.first_name} ${user.last_name} (${user.email}) has just registered.`
    }).save();
    
    // Send email asynchronously so it doesn't block response
    sendVerificationEmail(user.email, verificationToken, user.first_name);

    res.json({ success: true, message: 'Registration successful. Please verify your email.', userId: user._id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Registration failed: ' + error.message });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
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

    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    if (user.last_login && (Date.now() - new Date(user.last_login).getTime()) > ONE_YEAR) {
      user.inactive = true;
    }

    if (user.inactive) {
      if (user.isModified('inactive')) await user.save();
      return res.status(403).json({ success: false, message: 'Account is inactive.', inactive: true });
    }

    user.last_login = Date.now();
    await user.save();

    if (!process.env.JWT_SECRET) {
      console.error('CRITICAL: JWT_SECRET environment variable is missing.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
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
        clientType: user.clientType,
        companyName: user.companyName,
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

// Helper: Mask email address (e.g. mongo@gmail.com -> mo*****@g***.com)
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [localPart, domain] = email.split('@');
  const dotIndex = domain.lastIndexOf('.');
  const domainName = dotIndex !== -1 ? domain.substring(0, dotIndex) : domain;
  const domainExt = dotIndex !== -1 ? domain.substring(dotIndex) : '';

  let maskedLocal;
  if (localPart.length <= 2) {
    maskedLocal = localPart[0] + '*****';
  } else {
    maskedLocal = localPart.substring(0, 2) + '*****';
  }

  const maskedDomain = domainName.length <= 2 ? domainName[0] + '***' : domainName[0] + '***';
  return `${maskedLocal}@${maskedDomain}${domainExt}`;
};

// Request password reset link by username
router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide your username.' });
    }

    const cleanUsername = username.trim();
    const escapedUsername = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No account found with username "${cleanUsername}". Please check your spelling or register.`
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: 'This account does not have a registered email address. Please contact IT support.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken, user.first_name);

    return res.json({
      success: true,
      message: 'Password reset link sent successfully.',
      maskedEmail: maskEmail(user.email),
      username: user.username
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process password reset: ' + error.message });
  }
});

// Reset password using token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing password reset token.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const hashedIncoming = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedIncoming,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link is invalid or has expired. Please request a new one.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    try {
      await Notification.create({
        user_id: user._id,
        title: 'Password Changed',
        message: 'Your account password was successfully reset.',
        type: 'account'
      });
    } catch (notifErr) {
      console.warn('Could not create reset password notification:', notifErr.message);
    }

    return res.json({
      success: true,
      message: 'Your password has been successfully reset! You can now log in.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Password reset failed: ' + error.message });
  }
});

module.exports = router;
