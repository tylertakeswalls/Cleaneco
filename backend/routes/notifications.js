const express = require('express');
const Notification = require('../models/Notification');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    // If userId is provided, fetch notifications for that specific client.
    // If not, fetch general admin notifications (where user_id is null/missing)
    const query = userId ? { user_id: userId } : { user_id: null };
    
    const notifications = await Notification.find(query).sort({ created_at: -1 }).limit(50);
    const formatted = notifications.map(n => ({ ...n.toObject(), id: n._id }));
    res.json({ success: true, notifications: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { is_read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.put('/read_all/all', async (req, res) => {
  try {
    const userId = req.query.userId;
    const query = userId ? { is_read: false, user_id: userId } : { is_read: false, user_id: null };
    await Notification.updateMany(query, { is_read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
