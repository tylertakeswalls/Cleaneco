const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  client_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  order_id: { 
    type: String, 
    default: null,
    index: true 
  },
  last_message: {
    text: { type: String, default: '' },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sender_role: { type: String, enum: ['admin', 'client'] },
    created_at: { type: Date, default: Date.now }
  },
  unread_client_count: { type: Number, default: 0 },
  unread_admin_count: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['active', 'archived', 'resolved'], 
    default: 'active' 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

module.exports = mongoose.model('Conversation', conversationSchema);
