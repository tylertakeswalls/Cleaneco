const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Setting = require('../models/Setting');
const User = require('../models/User');
const Notification = require('../models/Notification');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get('/tos', async (req, res) => {
  try {
    let tos = await Setting.findOne({ key_name: 'terms_and_conditions' });
    if (!tos) {
      tos = new Setting({ key_name: 'terms_and_conditions', value: '1. These are the default terms and conditions.' });
      await tos.save();
    }
    res.json({ success: true, tos: tos.value });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch TOS' });
  }
});

router.post('/tos', async (req, res) => {
  try {
    const { tos } = req.body;
    await Setting.findOneAndUpdate(
      { key_name: 'terms_and_conditions' },
      { value: tos },
      { upsert: true }
    );
    res.json({ success: true, message: 'TOS updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update TOS' });
  }
});


router.post('/tos/upload', upload.single('tosPdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'tos_files'
    });

    const existingFiles = await db.collection('tos_files.files').find({ filename: 'tos.pdf' }).toArray();
    for (const file of existingFiles) {
      await bucket.delete(file._id);
    }

    const uploadStream = bucket.openUploadStream('tos.pdf', {
      contentType: 'application/pdf'
    });
    
    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', async () => {
      try {
        const users = await User.find({ role: 'client' });
        const notifications = users.map(user => ({
          user_id: user._id,
          message: 'The Terms and Conditions have been updated.',
          details: 'Please check the Resources section to view the updated terms.'
        }));
        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
        }
        res.json({ success: true, message: 'TOS PDF uploaded successfully and users notified.' });
      } catch (err) {
        console.error('Error notifying users:', err);
        res.json({ success: true, message: 'TOS PDF uploaded successfully but failed to notify users.' });
      }
    });
    
    uploadStream.on('error', (err) => {
      res.status(500).json({ success: false, message: 'Error uploading file', error: err.message });
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to upload TOS PDF', error: error.message });
  }
});

router.get('/tos/pdf', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'tos_files'
    });
    
    const files = await db.collection('tos_files.files').find({ filename: 'tos.pdf' }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'No PDF found' });
    }
    
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="tos.pdf"');
    
    const downloadStream = bucket.openDownloadStreamByName('tos.pdf');
    downloadStream.pipe(res);
    
    downloadStream.on('error', (err) => {
        res.status(500).end();
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch TOS PDF', error: error.message });
  }
});

router.get('/truck-teams', async (req, res) => {
  try {
    let teams = await Setting.findOne({ key_name: 'truck_teams' });
    if (!teams) {
      teams = new Setting({ key_name: 'truck_teams', value: JSON.stringify(['Truck Team 1', 'Truck Team 2']) });
      await teams.save();
    }
    res.json({ success: true, truck_teams: JSON.parse(teams.value) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch truck teams' });
  }
});

router.put('/truck-teams', async (req, res) => {
  try {
    const { truck_teams } = req.body; // array of strings
    await Setting.findOneAndUpdate(
      { key_name: 'truck_teams' },
      { value: JSON.stringify(truck_teams) },
      { upsert: true }
    );
    res.json({ success: true, message: 'Truck teams updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update truck teams' });
  }
});

module.exports = router;
