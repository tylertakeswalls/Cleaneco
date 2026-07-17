const express = require('express');
const Service = require('../models/Service');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const services = await Service.find();
    // Map _id to id for frontend compatibility
    const formattedServices = services.map(s => ({
      ...s.toObject(),
      id: s._id
    }));
    res.json(formattedServices);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch services: ' + error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, base_price, status } = req.body;
    const service = new Service({ name, description, base_price, status });
    await service.save();
    res.json({ success: true, message: 'Service added successfully', id: service._id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add service: ' + error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, base_price, status } = req.body;
    await Service.findByIdAndUpdate(id, { name, description, base_price, status });
    res.json({ success: true, message: 'Service updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update service: ' + error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete service: ' + error.message });
  }
});

module.exports = router;
