const express = require('express');

const Order = require('../models/Order');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const { sendConfirmationEmail } = require('../utils/emailHelper');
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
      { $match: { status: { $nin: ['Pending', 'Cancelled'] } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { 
            $sum: { 
              $add: [
                1100, // Reservation Fee + Tax
                { $cond: [ { $eq: ["$final_payment_status", "Paid"] }, { $subtract: [ { $add: ["$final_price", { $multiply: ["$final_price", 0.1] }] }, 1100 ] }, 0 ] }
              ]
            } 
          }
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
    const availabilityData = await Order.aggregate([
      { $match: { status: { $nin: ['Cancelled', 'Completed'] } } },
      { $group: {
          _id: { 
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, 
            time_slot: "$time_slot" 
          },
          booking_count: { $sum: 1 }
      }},
      { $match: { "_id.date": { $ne: null }, "_id.time_slot": { $ne: null } } }
    ]);
    
    const availability = availabilityData.map(item => ({
      date: item._id.date,
      time_slot: item._id.time_slot,
      booking_count: item.booking_count
    }));
    
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

router.post('/submit', upload.single('site_photo'), async (req, res) => {
  try {
    const data = req.body;
    let serviceIds = [];
    
    let sitePhotoUrl = null;
    if (req.file) {
      sitePhotoUrl = `/uploads/${req.file.filename}`;
    }
    
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

    const orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
    const totalAmount = 1100; // 1000 fee + 100 tax

    const parsedUserId = (data.user_id && data.user_id !== 'null' && data.user_id !== 'undefined') ? data.user_id : null;

    const orderItems = await Promise.all(services.map(async (service) => {
      const order = new Order({
        order_id: orderId,
        user_id: parsedUserId,
        service_id: service._id,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.region ? `${data.address}, ${data.region}` : data.address,
        landmark: data.landmark || '',
        service_type: service.name,
        date: new Date(data.date),
        time_slot: data.timeSlot,
        notes: data.notes,
        price: 1000,
        tax_amount: 100,
        discount_amount: 0,
        base_estimate: data.base_estimate ? parseFloat(data.base_estimate) : 0,
        estimate_inputs: data.estimate_inputs ? JSON.parse(data.estimate_inputs) : {},
        site_photo_url: sitePhotoUrl
      });
      await order.save();
      return {
        ...order.toObject(),
        service_name: service.name,
        base_price: service.base_price
      };
    }));

    const servicesStr = services.map(s => s.name).join(', ');
    const description = `Cleaneco Service Booking - ${servicesStr}`;

    // Create PayMongo Checkout Session
    const options = {
        method: 'POST',
        url: 'https://api.paymongo.com/v1/checkout_sessions',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            authorization: `Basic ${Buffer.from((process.env.PAYMONGO_SECRET_KEY || 'sk_test_w3hVvJThf4Jv5M1h4qL67jG1') + ':').toString('base64')}`
        },
        data: {
            data: {
                attributes: {
                    send_email_receipt: true,
                    show_description: true,
                    show_line_items: true,
                    cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-cancel`,
                    success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment-success`,
                    description: description,
                    line_items: [
                        {
                            currency: 'PHP',
                            amount: totalAmount * 100, // in centavos
                            description: description,
                            name: 'Reservation Fee',
                            quantity: 1
                        }
                    ],
                    payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay'],
                    reference_number: orderId
                }
            }
        }
    };

    const paymongoResponse = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: JSON.stringify(options.data)
    });
    const paymongoData = await paymongoResponse.json();
    if (!paymongoResponse.ok) throw new Error(JSON.stringify(paymongoData));
    const checkout_url = paymongoData.data.attributes.checkout_url;

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
      address: data.region ? `${data.address}, ${data.region}` : data.address,
      date: data.date,
      timeSlot: data.timeSlot,
      status: 'Pending',
      notes: data.notes
    };

    await sendConfirmationEmail(orderId, clientInfo, orderItems, false);

    res.json({ success: true, message: 'Order submitted, redirecting to payment...', checkout_url });
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
      order.status = 'Completed';
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
    
    // If admin is saving and misc_fee is provided, we assume final price has been inputted
    if (updateData.misc_fee !== undefined && updateData.misc_fee !== '') {
        updateData.has_final_price = true;
    }
    
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
