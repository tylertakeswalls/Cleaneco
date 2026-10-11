const express = require('express');
const User = require('../models/User');
const Notification = require('../models/Notification');
const router = express.Router();

router.get('/', async (req, res) => {
  const users = await User.find();
  res.json(users.map(u => ({ ...u.toObject(), id: u._id })));
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

    const hasProfileChanged =
      (updateData.phone && updateData.phone !== oldUser.phone) ||
      (updateData.address && updateData.address !== oldUser.address) ||
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
