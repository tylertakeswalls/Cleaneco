const express = require('express');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const { sendConfirmationEmail } = require('../utils/emailHelper');
const Payment = require('../models/Payment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

const formatOrder = (o) => ({
  ...o,
  id: o._id,
  user_id: o.user_id ? o.user_id._id || o.user_id : null,
  service_id: o.service_id ? o.service_id._id || o.service_id : null,
  service_name: o.service_id && o.service_id.name ? o.service_id.name : o.service_type
});

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().populate('user_id').populate('service_id').sort({ created_at: -1 }).lean();
    res.json(orders.map(formatOrder));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const revenueData = await Order.aggregate([
      { $match: { status: "Completed" } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { $sum: "$price" }
      }},
      { $sort: { "_id": 1 } }
    ]);
    const totalRevenue = revenueData.reduce((acc, val) => acc + val.total, 0);
    const totalOrders = await Order.countDocuments();
    
    res.json({ statusCounts, revenueData, totalRevenue, totalOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

router.get('/availability', async (req, res) => {
  try {
    const orders = await Order.find({ status: { $nin: ['Cancelled', 'Completed'] } });
    const availability = orders.reduce((acc, order) => {
      const dateStr = order.date ? order.date.toISOString().split('T')[0] : null;
      if (!dateStr || !order.time_slot) return acc;
      
      const existing = acc.find(a => a.date === dateStr && a.time_slot === order.time_slot);
      if (existing) {
        existing.booking_count += 1;
      } else {
        acc.push({ date: dateStr, time_slot: order.time_slot, booking_count: 1 });
      }
      return acc;
    }, []);
    res.json(availability);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch availability' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ user_id: req.params.userId }).populate('user_id').populate('service_id').sort({ created_at: -1 }).lean();
    res.json(orders.map(formatOrder));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user orders' });
  }
});

router.post('/submit', upload.single('receipt'), async (req, res) => {
  try {
    const data = req.body;
    let serviceIds = [];
    
    if (data.service_ids) {
      if (Array.isArray(data.service_ids)) {
        serviceIds = data.service_ids;
      } else {
        serviceIds = JSON.parse(data.service_ids);
      }
    } else if (data.service_id) {
      serviceIds = [data.service_id];
    }

    if (!serviceIds.length) {
      return res.status(400).json({ success: false, message: 'At least one service must be selected' });
    }

    const services = await Service.find({ _id: { $in: serviceIds } });
    if (services.length !== serviceIds.length) {
      return res.status(400).json({ success: false, message: 'Invalid service selected' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Payment receipt is required.' });
    }

    const receiptUrl = `/uploads/${req.file.filename}`;
    const orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
    const orderItems = [];
    const reservationFee = 2000;
    const taxAmount = 200;

    const parsedUserId = (data.user_id && data.user_id !== 'null' && data.user_id !== 'undefined') ? data.user_id : null;

    for (const service of services) {
      const order = new Order({
        order_id: orderId,
        user_id: parsedUserId,
        service_id: service._id,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        service_type: service.name,
        date: new Date(data.date),
        time_slot: data.timeSlot,
        notes: data.notes,
        price: reservationFee,
        tax_amount: taxAmount,
        discount_amount: 0,
        reservation_receipt_url: receiptUrl
      });
      await order.save();
      orderItems.push({
        ...order.toObject(),
        service_name: service.name,
        base_price: service.base_price
      });
    }

    // Create Payment Record
    await new Payment({
      order_id: orderId,
      user_id: parsedUserId,
      client_name: `${data.firstName} ${data.lastName}`,
      amount_paid: reservationFee + taxAmount,
      payment_type: 'Reservation Fee',
      receipt_url: receiptUrl,
      reference_number: data.reference_number || ''
    }).save();

    const servicesStr = services.map(s => s.name).join(', ');
    const notifMsg = `New booking with payment from ${data.firstName} ${data.lastName} (#${orderId})`;
    const notifDetails = `Services: ${servicesStr} on ${data.date} (${data.timeSlot})`;
    
    await new Notification({
      order_id: orderId,
      message: notifMsg,
      details: notifDetails
    }).save();

    const clientInfo = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      date: data.date,
      timeSlot: data.timeSlot,
      status: 'Pending',
      notes: data.notes
    };

    await sendConfirmationEmail(orderId, clientInfo, orderItems, false);

    res.json({ success: true, message: 'Order submitted and payment pending verification', order_id: orderId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Order submission failed: ' + error.message });
  }
});

router.post('/:id/upload-documents', upload.fields([{ name: 'quotation' }, { name: 'service_report' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    if (req.files['quotation']) {
      order.quotation_pdf_url = `/uploads/${req.files['quotation'][0].filename}`;
    }
    if (req.files['service_report']) {
      order.service_report_pdf_url = `/uploads/${req.files['service_report'][0].filename}`;
    }
    
    await order.save();
    res.json({ success: true, message: 'Documents uploaded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Upload failed: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    if (updateData.request_type === '') updateData.request_type = null;
    if (updateData.price === '') updateData.price = null;
    
    const oldOrder = await Order.findById(id);
    if (!oldOrder) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (oldOrder.status === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Cannot edit a cancelled order.' });
    }
    
    const order = await Order.findByIdAndUpdate(id, updateData, { new: true });
    
    if (updateData.status && order) {
        const clientInfo = {
            firstName: order.first_name,
            lastName: order.last_name,
            email: order.email,
            phone: order.phone,
            address: order.address,
            date: order.date,
            timeSlot: order.time_slot,
            status: order.status,
            notes: order.notes
        };
        const orderItems = [{
            service_name: order.service_type,
            price: order.price,
            base_price: order.price || 0
        }];
        await sendConfirmationEmail(order.order_id, clientInfo, orderItems, true);
        
        if (order.user_id) {
            await new Notification({
                user_id: order.user_id,
                order_id: order.order_id,
                message: `Order Status Updated`,
                details: `Your order #${order.order_id} is now ${updateData.status}.`
            }).save();
        }
    }

    // Notify admins if user requested cancel/reschedule
    if (oldOrder && updateData.request_type && oldOrder.request_type !== updateData.request_type) {
        if (updateData.request_type === 'Cancel Requested' || updateData.request_type === 'Reschedule Requested') {
            await new Notification({
                order_id: order.order_id,
                message: `${updateData.request_type === 'Cancel Requested' ? 'Cancellation' : 'Reschedule'} Requested`,
                details: `Client ${order.first_name} ${order.last_name} requested to ${updateData.request_type === 'Cancel Requested' ? 'cancel' : 'reschedule'} order #${order.order_id}.`
            }).save();
        }
    }

    // Check for rescheduling (Date or Time change)
    const dateChanged = oldOrder && updateData.date && new Date(oldOrder.date).getTime() !== new Date(updateData.date).getTime();
    const timeChanged = oldOrder && updateData.time_slot && oldOrder.time_slot !== updateData.time_slot;

    if ((dateChanged || timeChanged) && order.user_id) {
        await new Notification({
            user_id: order.user_id,
            order_id: order.order_id,
            message: `Booking Rescheduled`,
            details: `Your booking #${order.order_id} has been rescheduled to ${new Date(order.date).toLocaleDateString()} at ${order.time_slot}.`
        }).save();
    }

    res.json({ success: true, message: 'Order updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update order: ' + error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await Order.findByIdAndDelete(id);
    
    if (!deletedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Also delete any associated notifications
    await Notification.deleteMany({ order_id: deletedOrder.order_id });
    
    // Notify the client that their order was deleted
    if (deletedOrder.user_id) {
      await new Notification({
          user_id: deletedOrder.user_id,
          order_id: deletedOrder.order_id,
          message: `Order Deleted`,
          details: `Your order #${deletedOrder.order_id} has been removed from the system by an administrator.`
      }).save();
    }
    
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete order: ' + error.message });
  }
});

module.exports = router;
