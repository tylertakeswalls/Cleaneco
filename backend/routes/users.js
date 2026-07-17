const express = require('express');
const User = require('../models/User');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users.map(u => ({ ...u.toObject(), id: u._id })));
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false });
    res.json({ ...user.toObject(), id: user._id });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.put('/:id/role', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
