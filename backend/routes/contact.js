const express = require('express');
const router = express.Router();
const { sendContactEmail } = require('../utils/emailHelper');

// @route   POST /api/contact/submit
// @desc    Submit contact/complaints form
// @access  Public
router.post('/submit', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 100);
    const email = String(req.body.email || '').trim().slice(0, 100);
    const subject = String(req.body.subject || 'Inquiry').trim().slice(0, 100);
    const message = String(req.body.message || '').trim().slice(0, 2000);

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Send email
    await sendContactEmail(name, email, subject, message);

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
