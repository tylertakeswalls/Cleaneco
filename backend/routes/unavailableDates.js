const express = require('express');
const router = express.Router();
const UnavailableDate = require('../models/UnavailableDate');

// Get all unavailable dates
router.get('/', async (req, res) => {
  try {
    const dates = await UnavailableDate.find().sort({ date: 1 });
    res.json(dates);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch unavailable dates' });
  }
});

// Add a new unavailable date
router.post('/', async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }
    
    // Check if it already exists
    const existing = await UnavailableDate.findOne({ date });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This date is already marked as unavailable' });
    }

    const newDate = new UnavailableDate({ date, reason });
    await newDate.save();
    res.status(201).json({ success: true, message: 'Date marked as unavailable', data: newDate });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add unavailable date', error: error.message });
  }
});

// Delete an unavailable date
router.delete('/:id', async (req, res) => {
  try {
    const deletedDate = await UnavailableDate.findByIdAndDelete(req.params.id);
    if (!deletedDate) {
      return res.status(404).json({ success: false, message: 'Unavailable date not found' });
    }
    res.json({ success: true, message: 'Date unblocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete unavailable date', error: error.message });
  }
});

module.exports = router;
