const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

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
// Send a new message in a conversation
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { text, sender_id, sender_role, order_id } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text cannot be empty' });
    }
    if (!sender_id || !sender_role) {
      return res.status(400).json({ success: false, message: 'sender_id and sender_role are required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const message = new Message({
      conversation_id: conversationId,
      sender_id,
      sender_role,
      text: text.trim()
    });
    await message.save();

    // Update conversation state
    conversation.last_message = {
      text: text.trim(),
      sender_id,
      sender_role,
      created_at: new Date()
    };

    if (order_id && !conversation.order_id) {
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

      const snippet = text.length > 50 ? `${text.slice(0, 50)}...` : text;

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
