const express = require('express');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Setup Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Get all payments
router.get('/', async (req, res) => {
  try {
    const payments = await Payment.find().sort({ created_at: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

// Verify a payment
router.put('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Verified' or 'Rejected'

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    payment.status = status;
    await payment.save();

    if (status === 'Verified' && payment.payment_type === 'Reservation Fee') {
      const order = await Order.findOne({ order_id: payment.order_id });
      if (order && order.status === 'Pending') {
        order.status = 'In Progress';
        await order.save();
        
        // Notify user
        if (order.user_id) {
          await new Notification({
            user_id: order.user_id,
            order_id: order.order_id,
            message: `Reservation Payment Verified`,
            details: `Your payment for order #${order.order_id} has been verified. Your order is now In Progress.`
          }).save();
        }
      }
    }

    res.json({ success: true, message: `Payment ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

module.exports = router;
