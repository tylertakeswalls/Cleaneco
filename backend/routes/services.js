const express = require('express');
const Service = require('../models/Service');
const Order = require('../models/Order');
const { calculateStartingPrice } = require('../utils/pricing');
const router = express.Router();

function sanitizeFields(fields = []) {
  const seenKeys = new Set();
  return fields.map((f, idx) => {
    let baseKey = (f.key || f.label || `field_${idx + 1}`).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (!baseKey) baseKey = `field_${idx + 1}`;
    let key = baseKey;
    let counter = 2;
    while (seenKeys.has(key)) {
      key = `${baseKey}_${counter++}`;
    }
    seenKeys.add(key);

    const seenOptionValues = new Set();
    const options = Array.isArray(f.options) ? f.options.map((o, oIdx) => {
      let baseVal = String(o.value !== undefined && o.value !== '' ? o.value : (o.label || `option_${oIdx + 1}`)).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
      if (!baseVal) baseVal = `option_${oIdx + 1}`;
      let val = baseVal;
      let optCounter = 2;
      while (seenOptionValues.has(val)) {
        val = `${baseVal}_${optCounter++}`;
      }
      seenOptionValues.add(val);
      return {
        value: val,
        label: (o.label || '').trim() || val,
        factor: !isNaN(parseFloat(o.factor)) ? parseFloat(o.factor) : 1,
        amount: !isNaN(parseFloat(o.amount)) ? parseFloat(o.amount) : 0,
        requires_photo: Boolean(o.requires_photo)
      };
    }) : [];

    return {
      key,
      label: (f.label || '').trim() || key,
      type: ['number', 'multiplier', 'surcharge'].includes(f.type) ? f.type : 'number',
      min: f.min !== undefined && f.min !== null && !isNaN(Number(f.min)) ? Number(f.min) : 1,
      default: f.default !== undefined ? f.default : (f.type === 'number' ? (Number(f.min) || 1) : (options[0]?.value || '')),
      counts_toward_trips: Boolean(f.counts_toward_trips),
      options
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const services = await Service.find();
    // Map _id to id for frontend compatibility and calculate starting_price
    const formattedServices = services.map(s => {
      const obj = s.toObject();
      return {
        ...obj,
        id: s._id,
        starting_price: calculateStartingPrice(obj)
      };
    });
    res.json(formattedServices);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch services: ' + error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, rate, fixed_fee, fields, status, base_price } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Service name is required' });
    }

    const cleanFields = sanitizeFields(fields);

    const service = new Service({
      name: name.trim(),
      description: description ? description.trim() : '',
      pricing_mode: 'calculated',
      rate: Math.max(0, parseFloat(rate)) || 0,
      fixed_fee: Math.max(0, parseFloat(fixed_fee)) || 0,
      fields: cleanFields,
      base_price: parseFloat(base_price) || 0,
      status: status === 'unavailable' ? 'unavailable' : 'available'
    });

    await service.save();
    res.json({ success: true, message: 'Service added successfully', id: service._id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add service: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Service.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name.trim();
    if (req.body.description !== undefined) updateData.description = req.body.description.trim();
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.rate !== undefined) updateData.rate = Math.max(0, parseFloat(req.body.rate) || 0);
    if (req.body.fixed_fee !== undefined) updateData.fixed_fee = Math.max(0, parseFloat(req.body.fixed_fee) || 0);
    if (req.body.base_price !== undefined) updateData.base_price = parseFloat(req.body.base_price) || 0;
    if (req.body.fields !== undefined) {
      updateData.fields = sanitizeFields(req.body.fields);
    }

    await Service.findByIdAndUpdate(id, updateData);
    res.json({ success: true, message: 'Service updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update service: ' + error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if any order references this service
    const orderCount = await Order.countDocuments({
      $or: [
        { service_id: id },
        { service_ids: id }
      ]
    });

    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete this service because ${orderCount} existing order(s) are linked to it. Please mark it as "Unavailable" instead to preserve order history.`
      });
    }

    await Service.findByIdAndDelete(id);
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete service: ' + error.message });
  }
});

module.exports = router;

