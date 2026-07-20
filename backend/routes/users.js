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
  const oldUser = await User.findByIdAndUpdate(req.params.id, req.body);
  
  if (req.body.delete_requested === true && !oldUser.delete_requested) {
    await new Notification({
      message: "Account Deletion Requested",
      details: `User ${oldUser.email} has requested account deletion.`
    }).save();
  } else {
    const hasProfileChanged = 
      (req.body.phone && req.body.phone !== oldUser.phone) ||
      (req.body.address && req.body.address !== oldUser.address) ||
      (req.body.email && req.body.email !== oldUser.email);
    
    if (hasProfileChanged) {
      await new Notification({
        message: "Client Profile Updated",
        details: `User ${oldUser.first_name} ${oldUser.last_name} (${oldUser.email}) updated their contact information.`
      }).save();
    }
  }

  res.json({ success: true });
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
