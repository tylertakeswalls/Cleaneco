const express = require('express');

const Order = require('../models/Order');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const { calculateOrderTotals, calculateStartingPrice, groupOrdersByOrderId, calculateOrderCollectedRevenue } = require('../utils/pricing');
const { sendConfirmationEmail, sendRescheduleEmail } = require('../utils/emailHelper');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

const upload = multer({ storage: multer.memoryStorage() });

const uploadToGridFS = (file, mongooseInstance) => {
  return new Promise((resolve, reject) => {
    const db = mongooseInstance.connection.db;
    const bucket = new mongooseInstance.mongo.GridFSBucket(db, { bucketName: 'order_files' });
    const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    const uploadStream = bucket.openUploadStream(filename, { contentType: file.mimetype });

    uploadStream.end(file.buffer);

    uploadStream.on('finish', () => {
      resolve(`/api/orders/files/${filename}`);
    });

    uploadStream.on('error', (err) => {
      reject(err);
    });
  });
};

const router = express.Router();

const formatOrder = (o) => ({
  ...o,
  id: o._id,
  user_id: o.user_id ? o.user_id._id || o.user_id : null,
  user_clientType: o.user_id && o.user_id.clientType ? o.user_id.clientType : null,
  user_companyName: o.user_id && o.user_id.companyName ? o.user_id.companyName : null,
  service_id: o.service_id ? o.service_id._id || o.service_id : null,
  service_name: o.service_id && o.service_id.name ? o.service_id.name : o.service_type
});

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().populate('user_id').populate('service_id').sort({ created_at: -1, _id: -1 }).lean();
    res.json(orders.map(formatOrder));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const rawOrders = await Order.find().sort({ created_at: -1, _id: -1 }).lean();
    const groupedOrders = groupOrdersByOrderId(rawOrders);

    const statusMap = {};
    const revenueByDate = {};
    let totalRevenue = 0;

    groupedOrders.forEach(order => {
      const status = order.status || 'Pending';
      statusMap[status] = (statusMap[status] || 0) + 1;

      const rev = calculateOrderCollectedRevenue(order);
      totalRevenue += rev;

      if (rev > 0 && order.date) {
        const d = new Date(order.date);
        if (!Number.isNaN(d.getTime())) {
          const dateKey = d.toISOString().split('T')[0];
          revenueByDate[dateKey] = (revenueByDate[dateKey] || 0) + rev;
        }
      }
    });

    const statusCounts = Object.entries(statusMap).map(([statusKey, count]) => ({
      _id: statusKey,
      count
    }));

    const revenueData = Object.keys(revenueByDate)
      .sort()
      .map(dateKey => ({
        _id: dateKey,
        total: revenueByDate[dateKey]
      }));

    const totalOrders = groupedOrders.length;

    res.json({ statusCounts, revenueData, totalRevenue, totalOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

router.get('/availability', async (req, res) => {
  try {
    const { getTruckTeams, countAvailableTrucks } = require('../utils/truckTeams');
    const truckTeams = await getTruckTeams();
    const availableTruckCount = countAvailableTrucks(truckTeams);

    // 1. Gather active inspection bookings (inspections not yet completed, deduplicated by order_id)
    const inspectionData = await Order.aggregate([
      {
        $match: {
          status: { $nin: ['Cancelled', 'Completed'] },
          service_execution_date: null,
          has_final_price: { $ne: true },
          quotation_status: { $in: [null, 'Pending Inspection', ''] }
        }
      },
      {
        $group: {
          _id: "$order_id",
          date: { $first: { $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$confirmed_date", "$date"] } } } },
          time_slot: { $first: { $ifNull: ["$confirmed_time_slot", "$time_slot"] } }
        }
      },
      { $match: { "date": { $ne: null }, "time_slot": { $ne: null } } },
      {
        $group: {
          _id: { date: "$date", time_slot: "$time_slot" },
          count: { $sum: 1 }
        }
      }
    ]);

    // 2. Gather active service execution bookings (deduplicated by order_id)
    const executionOrders = await Order.aggregate([
      {
        $match: {
          status: { $nin: ['Cancelled'] },
          service_execution_date: { $ne: null }
        }
      },
      {
        $group: {
          _id: "$order_id",
          date: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$service_execution_date" } } },
          time_slot: { $first: "$service_execution_time_slot" },
          total_trips: { $first: { $ifNull: ["$total_trips", 1] } }
        }
      },
      { $match: { "date": { $ne: null } } }
    ]);

    // Map by date
    const dateMap = {};

    const ensureDate = (d) => {
      if (!dateMap[d]) {
        dateMap[d] = {
          fullDayLock: false,
          slots: {
            Morning: { inspections: 0, executions: 0 },
            Afternoon: { inspections: 0, executions: 0 },
            Evening: { inspections: 0, executions: 0 }
          }
        };
      }
      return dateMap[d];
    };

    // Populate inspections
    inspectionData.forEach(item => {
      const d = item._id.date;
      const slot = item._id.time_slot;
      if (['Morning', 'Afternoon', 'Evening'].includes(slot)) {
        const entry = ensureDate(d);
        entry.slots[slot].inspections += item.count;
      }
    });

    // Populate executions
    executionOrders.forEach(o => {
      const d = o.date;
      const entry = ensureDate(d);
      const trips = Number(o.total_trips) || 1;

      if (trips >= 5) {
        // 5+ trips locks the whole day (2 trucks utilized all day)
        entry.fullDayLock = true;
      } else {
        const slot = o.time_slot;
        if (['Morning', 'Afternoon', 'Evening'].includes(slot)) {
          entry.slots[slot].executions += 1;
        }
      }
    });

    // Flatten into response array
    const availability = [];
    const allDates = Object.keys(dateMap);

    allDates.forEach(dateStr => {
      const entry = dateMap[dateStr];
      ['Morning', 'Afternoon', 'Evening'].forEach(slot => {
        const slotData = entry.slots[slot];
        const executions = slotData.executions;
        const inspections = slotData.inspections;
        const isFullDay = entry.fullDayLock;
        const trucksLeft = isFullDay ? 0 : Math.max(0, availableTruckCount - executions);

        availability.push({
          date: dateStr,
          time_slot: slot,
          booking_count: executions + inspections + (isFullDay ? 1 : 0),
          executions_count: executions + (isFullDay ? 1 : 0),
          inspections_count: inspections,
          available_trucks: availableTruckCount,
          trucks_left: trucksLeft,
          is_full_day_execution: isFullDay,
          is_execution: isFullDay
        });
      });
    });

    res.json(availability);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch availability: ' + error.message });
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

router.post('/submit', upload.fields([{ name: 'site_photo' }, { name: 'cheque_image' }]), async (req, res) => {
  try {
    const data = req.body;

    // Check if the requested date is unavailable
    const UnavailableDate = require('../models/UnavailableDate');
    const isUnavailable = await UnavailableDate.findOne({ date: data.date });
    if (isUnavailable) {
      return res.status(400).json({ success: false, message: 'The selected date is unavailable for booking' });
    }

    // Validate residential households requirement
    let households = [];
    if (data.households) {
      try {
        households = typeof data.households === 'string' ? JSON.parse(data.households) : data.households;
      } catch (e) {
        households = [];
      }
    }
    const numHouseholds = parseInt(data.num_households || (households && households.length) || 1, 10);
    const clientType = data.clientType || 'residential';

    if (clientType === 'residential') {
      if (numHouseholds < 1 || !Array.isArray(households) || households.length < 1) {
        return res.status(400).json({
          success: false,
          message: 'Residential bookings require at least 1 participating household.'
        });
      }
      // Validate primary household (lead applicant)
      if (!households[0] || !households[0].name || !households[0].address || !households[0].name.trim() || !households[0].address.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please provide both the name and address for the primary household.'
        });
      }
      // If additional neighbor households are provided, validate each one
      if (households.length > 1) {
        const invalidAdditional = households.slice(1).some(h => !h.name || !h.address || !h.name.trim() || !h.address.trim());
        if (invalidAdditional) {
          return res.status(400).json({
            success: false,
            message: 'Please provide both the name and address for each added neighbor household, or remove empty entries.'
          });
        }
      }
    }

    // Check if date is locked by a confirmed 5+ trip service execution (Full-Day Lock)
    const inspDate = new Date(data.date);
    const startOfInsp = new Date(inspDate);
    startOfInsp.setUTCHours(0, 0, 0, 0);
    const endOfInsp = new Date(inspDate);
    endOfInsp.setUTCHours(23, 59, 59, 999);

    const localStartInsp = new Date(inspDate);
    localStartInsp.setHours(0, 0, 0, 0);
    const localEndInsp = new Date(inspDate);
    localEndInsp.setHours(23, 59, 59, 999);

    const minInsp = new Date(Math.min(startOfInsp.getTime(), localStartInsp.getTime()));
    const maxInsp = new Date(Math.max(endOfInsp.getTime(), localEndInsp.getTime()));

    const existingFullDayExec = await Order.findOne({
      status: { $nin: ['Cancelled'] },
      service_execution_date: { $gte: minInsp, $lte: maxInsp },
      total_trips: { $gte: 5 }
    });
    if (existingFullDayExec) {
      return res.status(400).json({ success: false, message: 'The selected date is fully booked for a full-day service execution.' });
    }

    // Check if the specific inspection time slot is already booked by an active pending inspection
    const existingSlotBooking = await Order.findOne({
      status: { $nin: ['Cancelled', 'Completed'] },
      service_execution_date: null,
      has_final_price: { $ne: true },
      quotation_status: { $in: [null, 'Pending Inspection', ''] },
      $or: [
        { confirmed_date: { $gte: minInsp, $lte: maxInsp } },
        { confirmed_date: null, date: { $gte: minInsp, $lte: maxInsp } }
      ],
      $and: [{
        $or: [
          { confirmed_time_slot: data.timeSlot },
          { confirmed_time_slot: { $in: [null, ''] }, time_slot: data.timeSlot }
        ]
      }]
    });
    if (existingSlotBooking) {
      return res.status(400).json({ success: false, message: `The ${data.timeSlot} inspection slot on this date is already booked.` });
    }

    let serviceIds = [];

    let sitePhotoUrl = null;
    if (req.files && req.files['site_photo']) {
      sitePhotoUrl = await uploadToGridFS(req.files['site_photo'][0], mongoose);
    }

    let chequeImageUrl = null;
    if (data.payment_method === 'cheque' && req.files && req.files['cheque_image']) {
      chequeImageUrl = await uploadToGridFS(req.files['cheque_image'][0], mongoose);
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

    // Parse estimate_inputs safely
    let parsedInputs = {};
    if (data.estimate_inputs) {
      try {
        parsedInputs = typeof data.estimate_inputs === 'string' ? JSON.parse(data.estimate_inputs) : data.estimate_inputs;
      } catch (err) {
        console.error('Error parsing estimate_inputs:', err);
      }
    }

    // Ensure all field defaults are populated for each selected service
    services.forEach(srv => {
      const sId = String(srv._id);
      const srvDefaults = {};
      (srv.fields || []).forEach(f => {
        if (f.default !== undefined) srvDefaults[f.key] = f.default;
        else if (f.options?.[0]) srvDefaults[f.key] = f.options[0].value;
        else if (f.type === 'number') srvDefaults[f.key] = f.min || 1;
      });
      parsedInputs[sId] = { ...srvDefaults, ...(parsedInputs[sId] || {}) };
    });

    // Build pricing snapshot for each selected service
    const pricingSnapshot = {};
    services.forEach(srv => {
      const sId = String(srv._id);
      pricingSnapshot[sId] = {
        id: sId,
        name: srv.name,
        description: srv.description,
        pricing_mode: srv.pricing_mode || 'calculated',
        rate: srv.rate || 0,
        fixed_fee: srv.fixed_fee || 0,
        base_price: srv.base_price || 0,
        fields: (srv.fields || []).map(f => ({
          key: f.key,
          label: f.label,
          type: f.type,
          min: f.min,
          default: f.default,
          counts_toward_trips: f.counts_toward_trips,
          options: (f.options || []).map(o => ({
            value: o.value,
            label: o.label,
            factor: o.factor,
            amount: o.amount,
            requires_photo: o.requires_photo
          }))
        }))
      };
    });

    // Server-side calculation of verified base estimate and total trips
    const { totalEstimate, totalTrips } = calculateOrderTotals(services, parsedInputs);

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
        confirmed_date: new Date(data.date),
        confirmed_time_slot: data.timeSlot,
        notes: data.notes,
        price: 1000,
        tax_amount: 100,
        discount_amount: 0,
        base_estimate: totalEstimate,
        estimate_inputs: parsedInputs,
        pricing_snapshot: pricingSnapshot,
        site_photo_url: sitePhotoUrl,
        total_trips: totalTrips,
        num_households: numHouseholds,
        households: households,
        payment_method: data.payment_method || 'online',
        cheque_payer_name: data.cheque_payer_name || data.cheque_account_name,
        cheque_number: data.cheque_number,
        cheque_date: data.cheque_date || (data.payment_method === 'cheque' ? new Date() : undefined),
        cheque_amount: data.payment_method === 'cheque' ? totalAmount : undefined, // Locked to totalAmount
        cheque_issuing_bank: data.cheque_issuing_bank || data.cheque_bank_name,
        cheque_type: data.cheque_type,
        cheque_image_url: chequeImageUrl,
        cheque_status: data.payment_method === 'cheque' ? 'pending_verification' : undefined
      });
      await order.save();
      return {
        ...order.toObject(),
        service_name: service.name,
        starting_price: calculateStartingPrice(service.toObject ? service.toObject() : service)
      };
    }));

    const servicesStr = services.map(s => s.name).join(', ');
    const description = `Cleaneco Service Booking - ${servicesStr}`;

    const notifMsg = `New booking from ${data.firstName} ${data.lastName} (#${orderId})`;
    const notifDetails = `Services: ${servicesStr} on ${data.date} (${data.timeSlot})`;

    await new Notification({
      order_id: orderId,
      message: notifMsg,
      details: notifDetails
    }).save();

    if (data.payment_method === 'cheque') {
      return res.json({ success: true, message: 'Order submitted. Pending cheque verification.' });
    }

    // Create PayMongo Checkout Session
    if (!process.env.PAYMONGO_SECRET_KEY) {
      console.error('CRITICAL: PAYMONGO_SECRET_KEY environment variable is missing.');
      return res.status(500).json({ success: false, message: 'Payment gateway configuration error.' });
    }

    const options = {
      method: 'POST',
      url: 'https://api.paymongo.com/v1/checkout_sessions',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
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

    let statusChangedToCompleted = false;

    const siblingUpdates = {};
    if (req.files['quotation']) {
      order.quotation_pdf_url = await uploadToGridFS(req.files['quotation'][0], mongoose);
      order.has_final_price = true;
      siblingUpdates.quotation_pdf_url = order.quotation_pdf_url;
      siblingUpdates.has_final_price = true;
    }
    if (req.files['service_report']) {
      order.service_report_pdf_url = await uploadToGridFS(req.files['service_report'][0], mongoose);
      siblingUpdates.service_report_pdf_url = order.service_report_pdf_url;
      if (order.status !== 'Completed') {
        order.status = 'Completed';
        siblingUpdates.status = 'Completed';
        statusChangedToCompleted = true;
      }
    }

    await order.save();
    if (order.order_id && Object.keys(siblingUpdates).length > 0) {
      await Order.updateMany({ order_id: order.order_id }, { $set: siblingUpdates });
    }

    if (statusChangedToCompleted) {
      const siblings = order.order_id ? await Order.find({ order_id: order.order_id }) : [order];
      const combinedServiceName = [...new Set(siblings.map(s => s.service_type).filter(Boolean))].join(', ') || order.service_type;
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
        service_name: combinedServiceName,
        price: order.has_final_price ? (order.final_price * 1.1) : ((order.price || 0) + (order.tax_amount || 0)),
        base_price: order.price || 0
      }];
      try {
        await sendConfirmationEmail(order.order_id, clientInfo, orderItems, true);
      } catch (emailErr) {
        console.error('Confirmation email error:', emailErr.message || emailErr);
      }

      if (order.user_id) {
        await new Notification({
          user_id: order.user_id,
          order_id: order.order_id,
          message: `Order Status Updated`,
          details: `Your order #${order.order_id} is now Completed.`
        }).save();
      }
    }

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
    if (updateData.confirmed_date === '') updateData.confirmed_date = null;
    if (updateData.confirmed_time_slot === '') updateData.confirmed_time_slot = null;
    if (updateData.status === 'Cancelled') {
      updateData.quotation_status = 'Client Declined';
    }

    const oldOrder = await Order.findById(id);
    if (!oldOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (oldOrder.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot edit a cancelled order.' });
    }

    if (updateData.request_type === 'Reschedule Requested' && oldOrder.request_type !== 'Reschedule Requested') {
      const isExecution = (updateData.reschedule_target === 'execution') || (oldOrder.service_execution_date && !oldOrder.reschedule_target);
      const targetDateToCheck = (isExecution && oldOrder.service_execution_date)
        ? new Date(oldOrder.service_execution_date)
        : new Date(oldOrder.confirmed_date || oldOrder.date);
      const now = new Date();
      const diffHours = (targetDateToCheck - now) / (1000 * 60 * 60);
      if (diffHours < 24) {
        return res.status(400).json({ success: false, message: 'Cannot reschedule less than 24 hours before the appointment.' });
      }
    }

    if (updateData.request_type === 'Reschedule Requested' && updateData.reschedule_date) {
      const reschedDateStr = String(updateData.reschedule_date).split('T')[0];
      const UnavailableDate = require('../models/UnavailableDate');
      const blockedReschedDate = await UnavailableDate.findOne({ date: reschedDateStr });
      if (blockedReschedDate) {
        return res.status(400).json({
          success: false,
          message: `The selected date (${reschedDateStr}) is unavailable: ${blockedReschedDate.reason || 'Company unavailable'}`
        });
      }
      const reschedDate = new Date(updateData.reschedule_date);
      const rStart = new Date(reschedDate);
      rStart.setHours(0, 0, 0, 0);
      const rEnd = new Date(reschedDate);
      rEnd.setHours(23, 59, 59, 999);

      const isExecution = (updateData.reschedule_target === 'execution') || (oldOrder.service_execution_date && !oldOrder.reschedule_target);
      const reschedSlot = updateData.reschedule_time_slot || (isExecution ? oldOrder.service_execution_time_slot : (oldOrder.confirmed_time_slot || oldOrder.time_slot));

      const { getTruckTeams, countAvailableTrucks } = require('../utils/truckTeams');
      const truckTeams = await getTruckTeams();
      const availableTruckCount = countAvailableTrucks(truckTeams);

      if (isExecution) {
        const totalTrips = Number(oldOrder.total_trips) || 1;
        if (totalTrips >= 5) {
          if (availableTruckCount < 2) {
            return res.status(400).json({ success: false, message: 'Rescheduling a 5+ trip booking requires at least 2 available trucks.' });
          }
          const anyExec = await Order.findOne({
            order_id: { $ne: oldOrder.order_id },
            status: { $nin: ['Cancelled'] },
            service_execution_date: { $gte: rStart, $lte: rEnd }
          });
          if (anyExec) {
            return res.status(400).json({ success: false, message: 'This date already has another service scheduled. 5+ trip orders require the entire day.' });
          }
        } else {
          if (availableTruckCount < 1) {
            return res.status(400).json({ success: false, message: 'No trucks are currently operational to schedule this service.' });
          }
          const fullDayExec = await Order.findOne({
            order_id: { $ne: oldOrder.order_id },
            status: { $nin: ['Cancelled'] },
            service_execution_date: { $gte: rStart, $lte: rEnd },
            total_trips: { $gte: 5 }
          });
          if (fullDayExec) {
            return res.status(400).json({ success: false, message: 'The selected date is reserved for a full-day (5+ trips) service.' });
          }
          if (reschedSlot) {
            const execsInSlot = await Order.aggregate([
              {
                $match: {
                  order_id: { $ne: oldOrder.order_id },
                  status: { $nin: ['Cancelled'] },
                  service_execution_date: { $gte: rStart, $lte: rEnd },
                  service_execution_time_slot: reschedSlot
                }
              },
              { $group: { _id: "$order_id" } }
            ]);
            if (execsInSlot.length >= availableTruckCount) {
              return res.status(400).json({ success: false, message: `The ${reschedSlot} slot on this date is fully booked (${availableTruckCount} of ${availableTruckCount} trucks in use).` });
            }
          }
        }
      } else {
        // Rescheduling an inspection
        const fullDayExec = await Order.findOne({
          order_id: { $ne: oldOrder.order_id },
          status: { $nin: ['Cancelled'] },
          service_execution_date: { $gte: rStart, $lte: rEnd },
          total_trips: { $gte: 5 }
        });
        if (fullDayExec) {
          return res.status(400).json({ success: false, message: 'The selected date is fully booked for a full-day service execution.' });
        }
        if (reschedSlot) {
          const inspInSlot = await Order.findOne({
            order_id: { $ne: oldOrder.order_id },
            status: { $nin: ['Cancelled', 'Completed'] },
            service_execution_date: null,
            has_final_price: { $ne: true },
            quotation_status: { $in: [null, 'Pending Inspection', ''] },
            $or: [
              { confirmed_date: { $gte: rStart, $lte: rEnd } },
              { confirmed_date: null, date: { $gte: rStart, $lte: rEnd } }
            ],
            $and: [{
              $or: [
                { confirmed_time_slot: reschedSlot },
                { confirmed_time_slot: { $in: [null, ''] }, time_slot: reschedSlot }
              ]
            }]
          });
          if (inspInSlot) {
            return res.status(400).json({ success: false, message: `The ${reschedSlot} slot on this date is already booked for another site inspection.` });
          }
        }
      }
    }

    if (updateData.action === 'approve_reschedule') {
      const isExecution = oldOrder.reschedule_target ? (oldOrder.reschedule_target === 'execution') : !!oldOrder.service_execution_date;
      if (isExecution) {
        updateData.service_execution_date = oldOrder.reschedule_date;
        updateData.service_execution_time_slot = oldOrder.reschedule_time_slot;
      } else {
        updateData.date = oldOrder.reschedule_date;
        updateData.time_slot = oldOrder.reschedule_time_slot;
        updateData.confirmed_date = oldOrder.reschedule_date;
        updateData.confirmed_time_slot = oldOrder.reschedule_time_slot;
      }
      updateData.request_type = null;
      updateData.reschedule_target = null;
      updateData.reschedule_date = null;
      updateData.reschedule_time_slot = null;
      updateData.reschedule_reason = null;
      updateData.reject_reason = null;
      delete updateData.action;
    } else if (updateData.action === 'reject_reschedule') {
      updateData.request_type = null;
      updateData.reschedule_target = null;
      updateData.reschedule_date = null;
      updateData.reschedule_time_slot = null;
      updateData.reschedule_reason = null;
      delete updateData.action;
    }

    const {
      getTruckTeams,
      parseAssignedTrucks,
      toDateKey,
      findTruckScheduleConflicts
    } = require('../utils/truckTeams');

    const effectiveStatus = updateData.status || oldOrder.status;

    // If an execution reschedule was just approved above, auto-clear truck_team if it now conflicts or is in maintenance
    if (
      req.body.action === 'approve_reschedule' &&
      updateData.service_execution_date &&
      oldOrder.truck_team
    ) {
      const prevTrucks = parseAssignedTrucks(oldOrder.truck_team);
      const fleet = await getTruckTeams();
      const availSet = new Set(fleet.filter(t => t.status === 'available').map(t => t.name.toLowerCase()));
      const hasMaint = prevTrucks.some(t => !availSet.has(t.toLowerCase()));
      const reschedConflicts = await findTruckScheduleConflicts({
        Order,
        excludeOrderId: oldOrder.order_id,
        execDate: updateData.service_execution_date,
        execSlot: updateData.service_execution_time_slot,
        totalTrips: oldOrder.total_trips,
        truckNames: prevTrucks
      });
      if (hasMaint || reschedConflicts.length > 0) {
        updateData.truck_team = '';
      }
    }

    if (effectiveStatus === 'Cancelled') {
      updateData.truck_team = '';
    } else if (updateData.truck_team !== undefined) {
      const nextTruckTeam = String(updateData.truck_team || '').trim();
      updateData.truck_team = nextTruckTeam;

      const hasExecDate = Boolean(
        updateData.service_execution_date !== undefined
          ? updateData.service_execution_date
          : oldOrder.service_execution_date
      );
      if (nextTruckTeam && !hasExecDate && String(oldOrder.truck_team || '').trim() === nextTruckTeam) {
        updateData.truck_team = '';
      } else if (nextTruckTeam) {
        const effectiveExecDate = updateData.service_execution_date !== undefined
          ? updateData.service_execution_date
          : oldOrder.service_execution_date;
        const effectiveExecSlot = updateData.service_execution_time_slot !== undefined
          ? updateData.service_execution_time_slot
          : oldOrder.service_execution_time_slot;
        const effectiveTrips = Number(updateData.total_trips ?? oldOrder.total_trips) || 1;

        if (!effectiveExecDate) {
          return res.status(400).json({
            success: false,
            message: 'Cannot assign a truck team before the client has scheduled a service execution date.'
          });
        }

        const requestedTrucks = parseAssignedTrucks(nextTruckTeam);
        if (effectiveTrips >= 5 && requestedTrucks.length !== 2) {
          return res.status(400).json({
            success: false,
            message: `High-capacity orders (5+ trips) require exactly 2 operational trucks (${requestedTrucks.length} selected).`
          });
        }
        if (effectiveTrips < 5 && requestedTrucks.length > 1) {
          return res.status(400).json({
            success: false,
            message: 'Standard orders (< 5 trips) can only be assigned 1 truck team.'
          });
        }

        const fleet = await getTruckTeams();
        const prevTrucksLower = new Set(parseAssignedTrucks(oldOrder.truck_team).map(t => t.toLowerCase()));
        for (const tName of requestedTrucks) {
          if (!prevTrucksLower.has(tName.toLowerCase())) {
            const match = fleet.find(f => f.name.toLowerCase() === tName.toLowerCase());
            if (!match) {
              return res.status(400).json({ success: false, message: `Truck team "${tName}" does not exist in Site Settings.` });
            }
            if (match.status === 'unavailable') {
              return res.status(400).json({
                success: false,
                message: `${tName} is currently marked Unavailable (Maintenance) in Site Settings.`
              });
            }
          }
        }

        const conflicts = await findTruckScheduleConflicts({
          Order,
          excludeOrderId: oldOrder.order_id,
          execDate: effectiveExecDate,
          execSlot: effectiveExecSlot,
          totalTrips: effectiveTrips,
          truckNames: requestedTrucks
        });
        if (conflicts.length > 0) {
          const c = conflicts[0];
          return res.status(400).json({
            success: false,
            message: `${c.truckName} is already assigned to Order #${c.conflictingOrderId} on ${toDateKey(effectiveExecDate)} (${c.conflictingSlot}). Please assign an available truck team.`
          });
        }
      }
    }

    await Order.updateMany({ order_id: oldOrder.order_id }, updateData);
    const order = await Order.findById(id);

    if (updateData.status && updateData.status !== oldOrder.status && order) {
      const siblings = order.order_id ? await Order.find({ order_id: order.order_id }) : [order];
      const combinedServiceName = [...new Set(siblings.map(s => s.service_type).filter(Boolean))].join(', ') || order.service_type;
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
        service_name: combinedServiceName,
        price: order.has_final_price ? (order.final_price * 1.1) : ((order.price || 0) + (order.tax_amount || 0)),
        base_price: order.price || 0
      }];
      try {
        await sendConfirmationEmail(order.order_id, clientInfo, orderItems, true);
      } catch (emailErr) {
        console.error('Confirmation email error:', emailErr.message || emailErr);
      }

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
        const schedType = updateData.reschedule_target === 'execution' ? 'service execution' : 'inspection';
        await new Notification({
          order_id: order.order_id,
          message: `${updateData.request_type === 'Cancel Requested' ? 'Cancellation' : 'Reschedule'} Requested`,
          details: `Client ${order.first_name} ${order.last_name} requested to ${updateData.request_type === 'Cancel Requested' ? 'cancel' : `reschedule ${schedType} for`} order #${order.order_id}.`
        }).save();
      }
    }

    // Check for rescheduling (Date or Time change)
    const dateChanged = oldOrder && updateData.date && new Date(oldOrder.date).getTime() !== new Date(updateData.date).getTime();
    const timeChanged = oldOrder && updateData.time_slot && oldOrder.time_slot !== updateData.time_slot;
    const execDateChanged = oldOrder && updateData.service_execution_date && new Date(oldOrder.service_execution_date).getTime() !== new Date(updateData.service_execution_date).getTime();
    const execTimeChanged = oldOrder && updateData.service_execution_time_slot && oldOrder.service_execution_time_slot !== updateData.service_execution_time_slot;

    if ((dateChanged || timeChanged) && order.user_id) {
      await new Notification({
        user_id: order.user_id,
        order_id: order.order_id,
        message: `Inspection Rescheduled`,
        details: `Your inspection for #${order.order_id} has been rescheduled to ${new Date(order.date).toLocaleDateString()} at ${order.time_slot}.`
      }).save();
    }

    if ((execDateChanged || execTimeChanged) && order.user_id) {
      await new Notification({
        user_id: order.user_id,
        order_id: order.order_id,
        message: `Service Execution Rescheduled`,
        details: `Your service execution for #${order.order_id} has been rescheduled to ${new Date(order.service_execution_date).toLocaleDateString()} at ${order.service_execution_time_slot}.`
      }).save();
    }

    if (req.body.action === 'approve_reschedule') {
      const finalDate = order.service_execution_date || order.date;
      const finalSlot = order.service_execution_time_slot || order.time_slot;
      try {
        await sendRescheduleEmail(order.email, order.first_name, order.order_id, true, finalDate, finalSlot, null);
      } catch (emailErr) {
        console.error('Reschedule email error:', emailErr.message || emailErr);
      }
    } else if (req.body.action === 'reject_reschedule') {
      try {
        await sendRescheduleEmail(order.email, order.first_name, order.order_id, false, null, null, order.reject_reason);
      } catch (emailErr) {
        console.error('Reschedule email error:', emailErr.message || emailErr);
      }
      if (order.user_id) {
        await new Notification({
          user_id: order.user_id,
          order_id: order.order_id,
          message: `Reschedule Rejected`,
          details: `Your request to reschedule order #${order.order_id} was rejected.`
        }).save();
      }
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

    // Delete any sibling service documents sharing the same multi-service order_id
    if (deletedOrder.order_id) {
      await Order.deleteMany({ order_id: deletedOrder.order_id });
    }

    // Also delete any associated notifications
    if (deletedOrder.order_id) {
      await Notification.deleteMany({ order_id: deletedOrder.order_id });
    }

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

router.get('/files/:filename', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'order_files' });
    const files = await db.collection('order_files.files').find({ filename: req.params.filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const ext = req.params.filename.split('.').pop().toLowerCase();
    let contentType = files[0].contentType || 'application/pdf';
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'pdf') contentType = 'application/pdf';

    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `inline; filename="${req.params.filename}"`);

    const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
    downloadStream.pipe(res);

    downloadStream.on('error', (err) => {
      res.status(500).end();
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch file', error: error.message });
  }
});

router.post('/:id/pay-cheque', upload.fields([{ name: 'cheque_image' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const order = await Order.findOne({ order_id: id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let chequeImageUrl = null;
    if (req.files && req.files['cheque_image']) {
      chequeImageUrl = await uploadToGridFS(req.files['cheque_image'][0], mongoose);
    }

    if (!chequeImageUrl) {
      return res.status(400).json({ success: false, message: 'Cheque image is required' });
    }

    await Order.updateMany(
      { order_id: id },
      {
        $set: {
          payment_method: 'cheque',
          cheque_payer_name: data.cheque_payer_name || data.cheque_account_name,
          cheque_number: data.cheque_number,
          cheque_date: data.cheque_date || (data.payment_method === 'cheque' ? new Date() : undefined),
          cheque_amount: 1100,
          cheque_issuing_bank: data.cheque_issuing_bank || data.cheque_bank_name,
          cheque_image_url: chequeImageUrl,
          cheque_status: 'pending_verification'
        }
      }
    );
    res.json({ success: true, message: 'Cheque submitted successfully for verification.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to submit cheque: ' + error.message });
  }
});

router.post('/:id/pay-cheque-final', upload.fields([{ name: 'cheque_image' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const order = await Order.findOne({ order_id: id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let chequeImageUrl = null;
    if (req.files && req.files['cheque_image']) {
      chequeImageUrl = await uploadToGridFS(req.files['cheque_image'][0], mongoose);
    }

    if (!chequeImageUrl) {
      return res.status(400).json({ success: false, message: 'Cheque image is required' });
    }

    const totalFinalPrice = order.final_price || 0;
    const amountToPay = (totalFinalPrice * 1.1) - 1100;

    await Order.updateMany(
      { order_id: id },
      {
        $set: {
          payment_method: 'cheque',
          cheque_payer_name: data.cheque_payer_name || data.cheque_account_name,
          cheque_number: data.cheque_number,
          cheque_date: data.cheque_date || (data.payment_method === 'cheque' ? new Date() : undefined),
          cheque_amount: amountToPay,
          cheque_issuing_bank: data.cheque_issuing_bank || data.cheque_bank_name,
          cheque_image_url: chequeImageUrl,
          cheque_status: 'pending_verification'
        }
      }
    );
    res.json({ success: true, message: 'Final cheque submitted successfully for verification.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to submit final cheque: ' + error.message });
  }
});

router.post('/:id/verify-cheque', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.payment_method !== 'cheque') return res.status(400).json({ success: false, message: 'Order was not paid via cheque' });

    if (action === 'approve') {
      if (order.status === 'Completed') {
        await Order.updateMany(
          { order_id: order.order_id },
          { $set: { cheque_status: 'approved', final_payment_status: 'Paid' } }
        );
        if (order.user_id) {
          await new Notification({
            user_id: order.user_id,
            order_id: order.order_id,
            message: `Final Cheque Payment Approved`,
            details: `Your final cheque payment for order #${order.order_id} has been approved.`
          }).save();
        }
      } else {
        await Order.updateMany(
          { order_id: order.order_id },
          { $set: { cheque_status: 'approved', status: 'In Progress' } }
        );
        if (order.user_id) {
          await new Notification({
            user_id: order.user_id,
            order_id: order.order_id,
            message: `Cheque Payment Approved`,
            details: `Your cheque payment for order #${order.order_id} has been approved. Your order is now In Progress.`
          }).save();
        }
      }
    } else if (action === 'reject') {
      await Order.updateMany({ order_id: order.order_id }, { $set: { cheque_status: 'rejected' } });

      if (order.user_id) {
        await new Notification({
          user_id: order.user_id,
          order_id: order.order_id,
          message: `Cheque Payment Rejected`,
          details: `Your cheque payment for order #${order.order_id} was rejected. Please review your details and submit a new payment.`
        }).save();
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    res.json({ success: true, message: `Cheque ${action}d successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed: ' + error.message });
  }
});

// Phase 2 Routes

router.post('/:id/quotation', async (req, res) => {
  try {
    const { id } = req.params;
    const { estimate_inputs, justifications, discount_amount, final_price, price, total_trips } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.status === 'Completed' || order.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: `Cannot submit quotation for a ${order.status.toLowerCase()} order.` });
    }
    const tripsToSave = total_trips ? parseInt(total_trips, 10) : (order.total_trips || 1);
    const tierChangedWhileScheduled = Boolean(
      order.service_execution_date && (((Number(order.total_trips) || 1) >= 5) !== (tripsToSave >= 5))
    );

    await Order.updateMany(
      { order_id: order.order_id },
      {
        $set: {
          estimate_inputs: estimate_inputs,
          justifications: justifications,
          discount_amount: discount_amount || 0,
          price: price || 0,
          final_price: final_price || 0,
          total_trips: tripsToSave,
          has_final_price: true,
          quotation_status: 'Pending Client Approval',
          ...(tierChangedWhileScheduled ? {
            service_execution_date: null,
            service_execution_time_slot: null,
            truck_team: ''
          } : {})
        }
      }
    );

    if (order.user_id) {
      await new Notification({
        user_id: order.user_id,
        order_id: order.order_id,
        message: `Quotation Ready for Review`,
        details: `The detailed inspection report and quotation for order #${order.order_id} is ready for your review.`
      }).save();
    }

    res.json({ success: true, message: 'Quotation submitted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit quotation: ' + error.message });
  }
});

router.post('/:id/quotation/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let updateData = {};
    if (response === 'approve') {
      updateData = { quotation_status: 'Approved' };
    } else if (response === 'clarify') {
      updateData = { quotation_status: 'Clarification Requested' };
    } else if (response === 'decline') {
      updateData = { quotation_status: 'Client Declined', status: 'Cancelled' };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    await Order.updateMany({ order_id: order.order_id }, { $set: updateData });

    // Trigger Admin Notification for Quotation Response
    try {
      const clientName = `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Client';
      let notifTitle = '';
      let notifDetails = '';

      if (response === 'clarify') {
        notifTitle = `Clarification Requested: Order #${order.order_id}`;
        notifDetails = `Client ${clientName} requested clarification on the quotation for #${order.order_id}.`;
      } else if (response === 'approve') {
        notifTitle = `Quotation Approved: Order #${order.order_id}`;
        notifDetails = `Client ${clientName} approved the quotation for #${order.order_id}.`;
      } else if (response === 'decline') {
        notifTitle = `Quotation Declined: Order #${order.order_id}`;
        notifDetails = `Client ${clientName} declined the quotation for #${order.order_id}. Order has been cancelled.`;
      }

      if (notifTitle) {
        await new Notification({
          user_id: null,
          order_id: order.order_id,
          message: notifTitle,
          details: notifDetails
        }).save();
      }
    } catch (notifErr) {
      console.error('Non-critical error creating quotation response notification:', notifErr);
    }

    res.json({ success: true, message: 'Quotation response submitted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit response: ' + error.message });
  }
});

router.post('/:id/service-date', async (req, res) => {
  try {
    const { id } = req.params;
    const { service_execution_date, service_execution_time_slot } = req.body;

    if (!service_execution_date || !service_execution_time_slot) {
      return res.status(400).json({ success: false, message: 'Please select both a date and a time slot.' });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot schedule execution for a cancelled order.' });
    }
    if (order.quotation_status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Quotation must be approved before scheduling service execution.' });
    }

    const targetDate = new Date(service_execution_date);
    const dateStr = service_execution_date.split('T')[0];

    // Check if the date is marked as unavailable by Admin
    const UnavailableDate = require('../models/UnavailableDate');
    const isUnavailable = await UnavailableDate.findOne({ date: dateStr });
    if (isUnavailable) {
      return res.status(400).json({
        success: false,
        message: `The selected date (${dateStr}) is unavailable: ${isUnavailable.reason || 'Company unavailable'}`
      });
    }

    // Check if another order already locked this date for service execution (Full-Day Lock)
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const localStart = new Date(targetDate);
    localStart.setHours(0, 0, 0, 0);
    const localEnd = new Date(targetDate);
    localEnd.setHours(23, 59, 59, 999);

    const minDateCheck = new Date(Math.min(startOfDay.getTime(), localStart.getTime()));
    const maxDateCheck = new Date(Math.max(endOfDay.getTime(), localEnd.getTime()));

    const { getTruckTeams, countAvailableTrucks } = require('../utils/truckTeams');
    const truckTeams = await getTruckTeams();
    const availableTruckCount = countAvailableTrucks(truckTeams);

    const totalTrips = Number(order.total_trips) || 1;
    const {
      parseAssignedTrucks: parseExecTrucks,
      findTruckScheduleConflicts: findExecConflicts
    } = require('../utils/truckTeams');
    let shouldClearPreAssignedTruck = false;
    if (order.truck_team) {
      const preTrucks = parseExecTrucks(order.truck_team);
      const availLower = new Set(truckTeams.filter(t => t.status === 'available').map(t => t.name.toLowerCase()));
      const preMaint = preTrucks.some(t => !availLower.has(t.toLowerCase()));
      const preConflicts = await findExecConflicts({
        Order,
        excludeOrderId: order.order_id,
        execDate: service_execution_date,
        execSlot: service_execution_time_slot,
        totalTrips,
        truckNames: preTrucks
      });
      shouldClearPreAssignedTruck = preMaint || preConflicts.length > 0;
    }

    if (totalTrips >= 5) {
      if (availableTruckCount < 2) {
        return res.status(400).json({
          success: false,
          message: 'This service execution requires 2 operational vacuum trucks (5+ trips), but fewer are currently available. Please contact support.'
        });
      }

      const existingExecution = await Order.findOne({
        order_id: { $ne: order.order_id },
        status: { $nin: ['Cancelled'] },
        service_execution_date: { $gte: minDateCheck, $lte: maxDateCheck }
      });

      if (existingExecution) {
        return res.status(400).json({
          success: false,
          message: 'A 5+ trip service execution requires the entire day. Other services are already booked on this date.'
        });
      }
    } else {
      if (availableTruckCount < 1) {
        return res.status(400).json({
          success: false,
          message: 'No vacuum trucks are currently available. Please contact support or select another date.'
        });
      }

      const fullDayExecution = await Order.findOne({
        order_id: { $ne: order.order_id },
        status: { $nin: ['Cancelled'] },
        service_execution_date: { $gte: minDateCheck, $lte: maxDateCheck },
        total_trips: { $gte: 5 }
      });

      if (fullDayExecution) {
        return res.status(400).json({
          success: false,
          message: 'This date is reserved for a high-capacity (5+ trips) service execution.'
        });
      }

      const executionsInSlot = await Order.aggregate([
        {
          $match: {
            order_id: { $ne: order.order_id },
            status: { $nin: ['Cancelled'] },
            service_execution_date: { $gte: minDateCheck, $lte: maxDateCheck },
            service_execution_time_slot: service_execution_time_slot
          }
        },
        {
          $group: { _id: "$order_id" }
        }
      ]);

      if (executionsInSlot.length >= availableTruckCount) {
        return res.status(400).json({
          success: false,
          message: `The ${service_execution_time_slot} slot on this date is fully booked (${availableTruckCount} of ${availableTruckCount} trucks booked).`
        });
      }
    }

    // Update all order items in the grouped booking
    await Order.updateMany(
      { order_id: order.order_id },
      {
        service_execution_date: targetDate,
        service_execution_time_slot: service_execution_time_slot,
        ...(shouldClearPreAssignedTruck ? { truck_team: '' } : {}),
        status: 'In Progress'
      }
    );

    if (order.user_id) {
      await new Notification({
        user_id: order.user_id,
        order_id: order.order_id,
        message: `Service Date Confirmed`,
        details: `Your service execution for order #${order.order_id} has been auto-confirmed for ${new Date(service_execution_date).toLocaleDateString()} (${service_execution_time_slot}).`
      }).save();
    }

    res.json({ success: true, message: 'Service date set successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to set service date: ' + error.message });
  }
});

module.exports = router;
