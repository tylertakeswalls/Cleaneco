const express = require('express');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const { sendConfirmationEmail } = require('../utils/emailHelper');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().populate('user_id').populate('service_id').sort({ created_at: -1 });
    const formattedOrders = orders.map(o => ({
      ...o.toObject(),
      id: o._id,
      user_id: o.user_id ? o.user_id._id : null,
      service_id: o.service_id ? o.service_id._id : null,
      service_name: o.service_id ? o.service_id.name : o.service_type
    }));
    res.json(formattedOrders);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
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
    const orders = await Order.find({ user_id: req.params.userId }).populate('user_id').populate('service_id').sort({ created_at: -1 });
    const formattedOrders = orders.map(o => ({
      ...o.toObject(),
      id: o._id,
      user_id: o.user_id ? o.user_id._id : null,
      service_id: o.service_id ? o.service_id._id : null,
      service_name: o.service_id ? o.service_id.name : o.service_type
    }));
    // Filter out orders missing critical fields or map appropriately
    res.json(formattedOrders); // Return as array to match frontend expectation from PHP
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user orders' });
  }
});

router.post('/submit', async (req, res) => {
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

    const orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
    const orderItems = [];

    for (const service of services) {
      const order = new Order({
        order_id: orderId,
        user_id: data.user_id || null,
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
        tax_amount: parseFloat((service.base_price * 0.10).toFixed(2)),
        discount_amount: 0 // Senior discount removed entirely
      });
      await order.save();
      orderItems.push({
        ...order.toObject(),
        service_name: service.name,
        base_price: service.base_price
      });
    }

    const servicesStr = services.map(s => s.name).join(', ');
    const notifMsg = `New booking from ${data.firstName} ${data.lastName} (#${orderId})`;
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

    res.json({ success: true, message: 'Order submitted successfully', order_id: orderId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Order submission failed: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const oldOrder = await Order.findById(id);
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
