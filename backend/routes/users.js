const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Notification = require('../models/Notification');
const router = express.Router();

router.get('/', async (req, res) => {
  const users = await User.find();
  res.json(users.map(u => ({ ...u.toObject(), id: u._id })));
});

router.post('/sub-admin', async (req, res) => {
  try {
    const { username, password, email, first_name, middle_name, last_name, phone } = req.body;
    const trimmedUsername = (username || '').trim();
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedFirstName = (first_name || '').trim();
    const trimmedLastName = (last_name || '').trim();

    if (!trimmedUsername || !password || !trimmedEmail || !trimmedFirstName || !trimmedLastName) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, first name, last name, and email are required.'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ username: trimmedUsername }, { email: trimmedEmail }]
    });
    if (existingUser) {
      if (existingUser.username === trimmedUsername) {
        return res.status(400).json({ success: false, message: 'Username already exists.' });
      }
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newSubAdmin = new User({
      username: trimmedUsername,
      password: hashedPassword,
      email: trimmedEmail,
      first_name: trimmedFirstName,
      middle_name: (middle_name || '').trim() || undefined,
      last_name: trimmedLastName,
      phone: (phone || '').trim() || undefined,
      role: 'admin',
      admin_scope: 'sub_admin',
      isVerified: true,
      inactive: false,
      last_login: Date.now()
    });

    await newSubAdmin.save();

    res.json({
      success: true,
      message: 'Sub-Admin account created successfully.',
      user: { ...newSubAdmin.toObject(), id: newSubAdmin._id }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create Sub-Admin: ' + error.message });
  }
});

router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false });
  res.json({ ...user.toObject(), id: user._id });
});

router.put('/:id', async (req, res) => {
  try {
    const oldUser = await User.findById(req.params.id);
    if (!oldUser) return res.status(404).json({ success: false });

    const updateData = { ...req.body };

    if (!updateData.address && (updateData.addressLine1 || updateData.province || updateData.city)) {
      const parts = [];
      if (updateData.addressLine1) parts.push(updateData.addressLine1);
      if (updateData.addressLine2) parts.push(updateData.addressLine2);
      if (updateData.barangay) parts.push(`Barangay ${updateData.barangay.replace(/^barangay\s+/i, '')}`);
      if (updateData.city) parts.push(updateData.city);
      if (updateData.province) parts.push(updateData.province);
      if (parts.length > 0) updateData.address = parts.join(', ');
    }

    const hasProfileChanged =
      (updateData.phone && updateData.phone !== oldUser.phone) ||
      (updateData.address && updateData.address !== oldUser.address) ||
      (updateData.province && updateData.province !== oldUser.province) ||
      (updateData.email && updateData.email !== oldUser.email);

    if (hasProfileChanged) {
      await new Notification({
        message: "Client Profile Updated",
        details: `User ${oldUser.first_name} ${oldUser.last_name} (${oldUser.email}) updated their contact information.`
      }).save();
    }

    await User.findByIdAndUpdate(req.params.id, updateData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/role', async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
