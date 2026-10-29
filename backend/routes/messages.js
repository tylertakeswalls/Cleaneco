const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

const ALLOWED_IMAGE_MIMES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHAT_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES[file.mimetype]) {
      return cb(null, true);
    }
    return cb(new Error('Only JPG, PNG, WEBP, or GIF images are allowed.'));
  }
});

const handleChatImageUpload = (req, res, next) => {
  if (req.is('application/json')) {
    return next();
  }
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image size must be 5 MB or smaller.' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Image upload failed.' });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Invalid image attachment.' });
    }
    next();
  });
};

const uploadChatImageToGridFS = (file) => {
  return new Promise((resolve, reject) => {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'chat_files' });
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(rawExt)
      ? rawExt
      : (ALLOWED_IMAGE_MIMES[file.mimetype] || '.png');
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    const uploadStream = bucket.openUploadStream(filename, { contentType: file.mimetype });

    uploadStream.end(file.buffer);

    uploadStream.on('finish', () => {
      resolve(`/api/messages/files/${filename}`);
    });

    uploadStream.on('error', (err) => {
      reject(err);
    });
  });
};

// GET /api/messages/files/:filename
// Stream uploaded chat image from MongoDB GridFS
router.get('/files/:filename', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'chat_files' });
    const files = await db.collection('chat_files.files').find({ filename: req.params.filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const ext = req.params.filename.split('.').pop().toLowerCase();
    let contentType = files[0].contentType || 'image/jpeg';
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'gif') contentType = 'image/gif';

    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `inline; filename="${req.params.filename}"`);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    const downloadStream = bucket.openDownloadStreamByName(req.params.filename);
    downloadStream.pipe(res);

    downloadStream.on('error', () => {
      res.status(500).end();
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load chat image' });
  }
});

// GET /api/messages/conversations
// Fetch conversation list for Admin, or retrieve/initialize conversation for Client
router.get('/conversations', async (req, res) => {
  try {
    const { userId, role, search } = req.query;

    if (role === 'admin') {
      let query = {};
      
      const conversations = await Conversation.find(query)
        .populate('client_id', 'first_name last_name username email phone clientType companyName profile_picture')
        .sort({ updated_at: -1 });

      let filtered = conversations.filter(c => c.client_id !== null);

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        filtered = filtered.filter(c => {
          const client = c.client_id;
          const fullName = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
          const email = (client.email || '').toLowerCase();
          const username = (client.username || '').toLowerCase();
          const orderId = (c.order_id || '').toLowerCase();
          const company = (client.companyName || '').toLowerCase();
          return fullName.includes(term) || email.includes(term) || username.includes(term) || orderId.includes(term) || company.includes(term);
        });
      }

      return res.json({ success: true, conversations: filtered });
    }

    // Client flow: Find or auto-initialize conversation for this client
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required for client' });
    }

    let conversation = await Conversation.findOne({ client_id: userId })
      .populate('client_id', 'first_name last_name username email phone clientType companyName profile_picture');

    if (!conversation) {
      conversation = new Conversation({
        client_id: userId,
        status: 'active'
      });
      await conversation.save();
      conversation = await Conversation.findById(conversation._id)
        .populate('client_id', 'first_name last_name username email phone clientType companyName profile_picture');
    }

    res.json({ success: true, conversation });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
});

// POST /api/messages/conversations/init
// Initialize or link a conversation (e.g. from an order page with order_id)
router.post('/conversations/init', async (req, res) => {
  try {
    const { client_id, order_id } = req.body;
    if (!client_id) {
      return res.status(400).json({ success: false, message: 'client_id is required' });
    }

    let conversation = await Conversation.findOne({ client_id });
    if (!conversation) {
      conversation = new Conversation({
        client_id,
        order_id: order_id || null,
        status: 'active'
      });
      await conversation.save();
    } else if (order_id && !conversation.order_id) {
      conversation.order_id = order_id;
      await conversation.save();
    }

    const populated = await Conversation.findById(conversation._id)
      .populate('client_id', 'first_name last_name username email phone clientType companyName profile_picture');

    res.json({ success: true, conversation: populated });
  } catch (error) {
    console.error('Error initializing conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to initialize conversation' });
  }
});

// GET /api/messages/conversations/:id/messages
// Retrieve message history for a conversation
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const messages = await Message.find({ conversation_id: conversationId })
      .populate('sender_id', 'first_name last_name username role profile_picture')
      .sort({ created_at: 1 });

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// POST /api/messages/conversations/:id/messages
// Send a new message (text, image, or both) in a conversation
router.post('/conversations/:id/messages', handleChatImageUpload, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { sender_id, sender_role, order_id } = req.body;
    const rawText = typeof req.body.text === 'string' ? req.body.text.trim() : '';

    if (!rawText && !req.file) {
      return res.status(400).json({ success: false, message: 'Message must contain text or an image attachment' });
    }
    if (!sender_id || !sender_role) {
      return res.status(400).json({ success: false, message: 'sender_id and sender_role are required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    let imageUrl = null;
    let imageName = null;
    if (req.file) {
      imageUrl = await uploadChatImageToGridFS(req.file);
      imageName = req.file.originalname || 'photo.png';
    }

    const message = new Message({
      conversation_id: conversationId,
      sender_id,
      sender_role,
      text: rawText,
      image_url: imageUrl,
      image_name: imageName
    });
    await message.save();

    const previewText = imageUrl
      ? (rawText ? `📷 ${rawText}` : '📷 Sent a photo')
      : rawText;

    // Update conversation state
    conversation.last_message = {
      text: previewText,
      sender_id,
      sender_role,
      created_at: new Date()
    };

    if (order_id && order_id !== 'null' && !conversation.order_id) {
      conversation.order_id = order_id;
    }

    if (sender_role === 'client') {
      conversation.unread_admin_count = (conversation.unread_admin_count || 0) + 1;
    } else {
      conversation.unread_client_count = (conversation.unread_client_count || 0) + 1;
    }

    await conversation.save();

    // In-app Notification Trigger
    try {
      const senderUser = await User.findById(sender_id);
      const senderName = senderUser 
        ? `${senderUser.first_name} ${senderUser.last_name}`.trim() 
        : (sender_role === 'admin' ? 'Cleaneco Support' : 'Client');

      const snippet = previewText.length > 50 ? `${previewText.slice(0, 50)}...` : previewText;

      if (sender_role === 'client') {
        // Notify admin
        await new Notification({
          user_id: null,
          order_id: conversation.order_id || null,
          message: `New message from ${senderName}: "${snippet}"`,
          details: `Conversation ID: ${conversation._id}`
        }).save();
      } else {
        // Notify client
        await new Notification({
          user_id: conversation.client_id,
          order_id: conversation.order_id || null,
          message: `Cleaneco Support: "${snippet}"`,
          details: `Reply from administration regarding your inquiry.`
        }).save();
      }
    } catch (notifErr) {
      console.error('Non-critical error sending notification for message:', notifErr);
    }

    const populatedMessage = await Message.findById(message._id)
      .populate('sender_id', 'first_name last_name username role profile_picture');

    res.json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// PUT /api/messages/conversations/:id/read
// Mark all messages as read by role
router.put('/conversations/:id/read', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { role } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (role === 'admin') {
      conversation.unread_admin_count = 0;
      await conversation.save();
      await Message.updateMany(
        { conversation_id: conversationId, sender_role: 'client', is_read: false },
        { is_read: true, read_at: new Date() }
      );
    } else {
      conversation.unread_client_count = 0;
      await conversation.save();
      await Message.updateMany(
        { conversation_id: conversationId, sender_role: 'admin', is_read: false },
        { is_read: true, read_at: new Date() }
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark conversation read' });
  }
});

// GET /api/messages/unread-count
// Fast polling endpoint for notification badges
router.get('/unread-count', async (req, res) => {
  try {
    const { userId, role } = req.query;

    if (role === 'admin') {
      const result = await Conversation.aggregate([
        { $group: { _id: null, totalUnread: { $sum: '$unread_admin_count' } } }
      ]);
      const unreadCount = result.length > 0 ? result[0].totalUnread : 0;
      return res.json({ success: true, unreadCount });
    }

    if (role === 'client' && userId) {
      const conv = await Conversation.findOne({ client_id: userId }, 'unread_client_count');
      const unreadCount = conv ? (conv.unread_client_count || 0) : 0;
      return res.json({ success: true, unreadCount });
    }

    res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, unreadCount: 0 });
  }
});

module.exports = router;
