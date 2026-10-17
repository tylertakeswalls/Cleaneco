const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Conversation', 
    required: true,
    index: true 
  },
  sender_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  sender_role: { 
    type: String, 
    enum: ['admin', 'client'], 
    required: true 
  },
  text: { 
    type: String, 
    required: true,
    trim: true 
  },
  is_read: { 
    type: Boolean, 
    default: false 
  },
  read_at: { 
    type: Date, 
    default: null 
  }
}, { 
  timestamps: { createdAt: 'created_at', updatedAt: false } 
});

module.exports = mongoose.model('Message', messageSchema);
