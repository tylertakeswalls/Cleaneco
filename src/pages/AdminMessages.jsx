import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/admin.css';
import carousel1 from '../assets/styles/images/carousel1.png';
import ChatImageLightbox, {
  CHAT_IMAGE_ACCEPT,
  resolveChatImageUrl,
  validateChatImageFile,
  formatImageFileSize,
  extractPastedImageFile,
  mergePolledMessages
} from '../components/ChatImageLightbox';

export default function AdminMessages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [attachError, setAttachError] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'orders'
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeConvRef = useRef(null);
  activeConvRef.current = selectedConv;

  const location = useLocation();
  const adminUserId = sessionStorage.getItem('userId');

  const quickTemplates = [
    {
      icon: "fas fa-headset",
      iconColor: "#0D8D1E",
      label: "How can we assist?",
      text: "Hello! How can we assist you with your booking today?"
    },
    {
      icon: "fas fa-clock",
      iconColor: "#d97706",
      label: "Reviewing inquiry",
      text: "We have received your inquiry and our dispatcher is reviewing it."
    },
    {
      icon: "fas fa-file-invoice-dollar",
      iconColor: "#0D8D1E",
      label: "Quotation updated",
      text: "Your quotation has been updated on your Ongoing Orders page."
    },
    {
      icon: "fas fa-calendar-check",
      iconColor: "#0D8D1E",
      label: "Schedule confirmed",
      text: "Our team has confirmed your scheduled service time slot."
    }
  ];

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageImageFile = (file) => {
    if (!file) return;
    const validation = validateChatImageFile(file);
    if (!validation.valid) {
      setAttachError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    setAttachError('');
    setSelectedImage({
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name || 'attached-image.png',
      size: file.size
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.focus();
  };

  const clearSelectedImage = () => {
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    setSelectedImage(null);
    setAttachError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) stageImageFile(file);
  };

  const handlePaste = (e) => {
    const pastedFile = extractPastedImageFile(e);
    if (pastedFile) {
      e.preventDefault();
      stageImageFile(pastedFile);
    }
  };

  // Load or refresh conversation list
  const loadConversations = async (keepSelection = true) => {
    try {
      const res = await api.get('/messages/conversations', {
        params: { role: 'admin', search: searchTerm }
      });
      if (res.data && res.data.success) {
        const list = res.data.conversations || [];
        setConversations(list);

        // Keep active selection updated
        if (keepSelection && activeConvRef.current) {
          const updatedActive = list.find(c => c._id === activeConvRef.current._id);
          if (updatedActive) {
            setSelectedConv(updatedActive);
          }
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Initial load and search changes
  useEffect(() => {
    loadConversations(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Periodic polling for new messages & unread badges every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations(true);
      if (activeConvRef.current) {
        pollMessages(activeConvRef.current._id);
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll messages without resetting loading spinner
  const pollMessages = async (convId) => {
    try {
      const res = await api.get(`/messages/conversations/${convId}/messages`);
      if (res.data && res.data.success) {
        setMessages(prev => mergePolledMessages(prev, res.data.messages || []));
      }
    } catch (err) {
      console.error('Error polling messages:', err);
    }
  };

  // Select a conversation
  const handleSelectConversation = async (conv) => {
    clearSelectedImage();
    setSelectedConv(conv);
    setLoadingMessages(true);
    try {
      const res = await api.get(`/messages/conversations/${conv._id}/messages`);
      if (res.data && res.data.success) {
        setMessages(res.data.messages || []);
      }
      // Mark read for admin
      if (conv.unread_admin_count > 0) {
        await api.put(`/messages/conversations/${conv._id}/read`, { role: 'admin' });
        // Update local counter
        setConversations(prev => prev.map(c => c._id === conv._id ? { ...c, unread_admin_count: 0 } : c));
        setSelectedConv(prev => prev ? { ...prev, unread_admin_count: 0 } : prev);
      }
    } catch (err) {
      console.error('Error loading messages for conversation:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Auto-select conversation when redirected from a notification with orderId or conversationId
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetOrderId = params.get('orderId');
    const targetConvId = params.get('conversationId');
    if ((targetOrderId || targetConvId) && conversations.length > 0) {
      const match = conversations.find(c => 
        (targetConvId && c._id === targetConvId) ||
        (targetOrderId && String(c.order_id).toLowerCase() === targetOrderId.toLowerCase())
      );
      if (match && (!selectedConv || selectedConv._id !== match._id)) {
        handleSelectConversation(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, conversations]);

  // Auto-scroll inside messages container without scrolling window
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Send a message (text, image, or both)
  const handleSendMessage = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const textToSend = (textOverride !== null ? textOverride : messageText).trim();
    const imageToSend = textOverride !== null ? null : selectedImage;

    if ((!textToSend && !imageToSend) || !selectedConv || sending) return;

    if (textOverride === null) {
      setMessageText('');
      setSelectedImage(null);
    }
    setAttachError('');
    setSending(true);

    // Optimistic UI update
    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      _id: tempId,
      conversation_id: selectedConv._id,
      sender_id: { _id: adminUserId, role: 'admin' },
      sender_role: 'admin',
      text: textToSend,
      image_url: imageToSend ? imageToSend.previewUrl : null,
      image_name: imageToSend ? imageToSend.name : null,
      _uploading: Boolean(imageToSend),
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      let res;
      if (imageToSend) {
        const formData = new FormData();
        formData.append('image', imageToSend.file);
        formData.append('text', textToSend);
        formData.append('sender_id', adminUserId);
        formData.append('sender_role', 'admin');
        if (selectedConv.order_id) {
          formData.append('order_id', selectedConv.order_id);
        }
        res = await api.post(`/messages/conversations/${selectedConv._id}/messages`, formData);
      } else {
        res = await api.post(`/messages/conversations/${selectedConv._id}/messages`, {
          text: textToSend,
          sender_id: adminUserId,
          sender_role: 'admin',
          order_id: selectedConv.order_id || null
        });
      }

      if (res.data && res.data.success) {
        const savedMsg = res.data.message;
        setMessages(prev => {
          if (prev.some(m => m._id === tempId)) {
            return prev.map(m => m._id === tempId ? savedMsg : m);
          }
          if (prev.some(m => m._id === savedMsg._id)) return prev;
          return [...prev, savedMsg];
        });
        loadConversations(true);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setAttachError(err.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      if (imageToSend?.previewUrl) {
        URL.revokeObjectURL(imageToSend.previewUrl);
      }
      setSending(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTemplateClick = (text) => {
    setMessageText(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totalUnreadAdmin = conversations.reduce((sum, c) => sum + (c.unread_admin_count || 0), 0);

  const filteredConversations = conversations.filter(conv => {
    if (activeFilter === 'unread') {
      return (conv.unread_admin_count || 0) > 0;
    }
    if (activeFilter === 'orders') {
      return !!conv.order_id;
    }
    return true;
  });

  const selectedClient = selectedConv?.client_id || {};
  const selectedClientName = `${selectedClient.first_name || ''} ${selectedClient.last_name || ''}`.trim() || selectedClient.username || 'Client';

  return (
    <div>
      <ChatImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      <img className="img-fluid banner-img" src={carousel1} alt="Banner" />

      <div className="container-fluid py-4 px-md-4" style={{ maxWidth: '1600px' }}>
        
        {/* High-End Styling Embedded for Admin Messages */}
        <style>{`
          .banner-img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            object-position: center;
            display: block;
            border-radius: 0 !important;
          }
          @media (max-width: 768px) {
            .banner-img {
              height: 180px;
            }
          }
          .admin-chat-hub {
            height: calc(100vh - 160px);
            min-height: 640px;
            border-radius: 1.25rem;
            overflow: hidden;
            background: #ffffff;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
            border: 1px solid #eef2f6;
            display: flex;
          }
        .admin-threads-sidebar {
          width: 380px;
          min-width: 320px;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          border-right: 1px solid #eef2f6;
          background: #ffffff;
          flex-shrink: 0;
        }
        .admin-threads-scroll {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          overflow-y: auto !important;
        }
        .admin-stage-container {
          flex: 1 1 0;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
        }
        .admin-messages-scroll {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          background-color: #F8FAFC;
        }
        .chat-composer-box {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 1.25rem;
          padding: 0.75rem 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .chat-composer-box:focus-within {
          border-color: #0D8D1E;
          box-shadow: 0 0 0 4px rgba(13, 141, 30, 0.12);
        }
        .chat-composer-textarea {
          width: 100%;
          border: none !important;
          outline: none !important;
          resize: none !important;
          font-size: 0.94rem;
          color: #1e293b;
          background: transparent !important;
          padding: 0 !important;
          line-height: 1.5;
          box-shadow: none !important;
          height: 48px;
        }
        .chat-composer-textarea::placeholder {
          color: #94a3b8;
        }
        .chat-attach-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.18s ease;
          cursor: pointer;
        }
        .chat-attach-btn:hover:not(:disabled) {
          background: #F0FDF4;
          color: #0D8D1E;
          border-color: #86efac;
          transform: translateY(-1px);
        }
        .chat-attach-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .chat-bubble-admin-staff {
          background: linear-gradient(135deg, #0D8D1E 0%, #0A6F17 100%);
          color: #ffffff;
          border-radius: 18px 18px 4px 18px;
          box-shadow: 0 3px 10px rgba(13, 141, 30, 0.15);
          font-size: 0.93rem;
          line-height: 1.5;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .chat-bubble-client-msg {
          background: #ffffff;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          font-size: 0.93rem;
          line-height: 1.5;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .chat-msg-image {
          display: block;
          max-width: 260px;
          max-height: 240px;
          width: 100%;
          object-fit: cover;
          border-radius: 12px;
          cursor: zoom-in;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .chat-msg-image:hover {
          opacity: 0.95;
        }
        .admin-thread-card {
          padding: 13px 16px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.18s ease;
          border-left: 3.5px solid transparent;
        }
        .admin-thread-card:hover {
          background-color: #f8fafc;
        }
        .admin-thread-card.active {
          background-color: #F0FDF4;
          border-left-color: #0D8D1E;
        }
        .quick-reply-pill {
          background: #ffffff;
          color: #475569;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          font-size: 0.74rem;
          font-weight: 500;
          padding: 4px 12px;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .quick-reply-pill:hover {
          background: #F0FDF4;
          color: #0D8D1E;
          border-color: #A5D6A7;
          transform: translateY(-1px);
        }
        .support-pulse-dot {
          width: 8px;
          height: 8px;
          background-color: #10b981;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulse-green 2s infinite;
        }
        @keyframes pulse-green {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .filter-tab-btn {
          border: none;
          background: transparent;
          font-size: 0.78rem;
          font-weight: 600;
          color: #64748B;
          padding: 6px 12px;
          border-radius: 20px;
          transition: all 0.15s ease;
        }
        .admin-search-input {
          padding-left: 42px !important;
          padding-right: 36px !important;
          height: 40px !important;
          border-radius: 20px !important;
          background-color: #F8FAFC !important;
          border: 1.5px solid #E2E8F0 !important;
          font-size: 0.85rem !important;
          line-height: normal !important;
        }
        .admin-search-input:focus {
          border-color: #0D8D1E !important;
          background-color: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(13, 141, 30, 0.15) !important;
        }
        .btn-admin-view-order {
          border: 1.5px solid #0D8D1E !important;
          color: #0D8D1E !important;
          background-color: #ffffff !important;
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          border-radius: 20px !important;
          padding: 5px 14px !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          text-decoration: none !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
        }
        .btn-admin-view-order:hover {
          background-color: #0D8D1E !important;
          color: #ffffff !important;
          border-color: #0D8D1E !important;
          box-shadow: 0 4px 12px rgba(13, 141, 30, 0.25) !important;
          transform: translateY(-1px);
        }
        .btn-admin-view-order:hover i {
          color: #ffffff !important;
        }
        .btn-admin-view-order:active {
          transform: scale(0.97);
          background-color: #0A6F17 !important;
        }
      `}</style>

      {/* Top Header Bar & Indicators */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-1 small">
              <li className="breadcrumb-item text-muted">Admin</li>
              <li className="breadcrumb-item active text-secondary" aria-current="page">Support Desk</li>
            </ol>
          </nav>
          <h3 className="fw-bold mb-0 text-dark">
            Client Messages & Inquiries
          </h3>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <span 
            className="badge rounded-pill fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
            style={{
              fontSize: '0.74rem',
              padding: '6px 12px',
              backgroundColor: '#E8F5E9',
              color: '#0D8D1E',
              border: '1px solid #C8E6C9'
            }}
          >
            <span className="support-pulse-dot"></span> Live Support Channel
          </span>
          <span 
            className="badge rounded-pill fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
            style={{
              fontSize: '0.74rem',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #E2E8F0'
            }}
          >
            <i className="fas fa-inbox text-success me-1"></i> {conversations.length} Active Conversations
          </span>
          {totalUnreadAdmin > 0 && (
            <span 
              className="badge rounded-pill fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
              style={{
                fontSize: '0.74rem',
                padding: '6px 12px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FECACA'
              }}
            >
              <i className="fas fa-bell me-1"></i> {totalUnreadAdmin} Unread
            </span>
          )}
        </div>
      </div>

      {/* Main Support Hub Workspace (Fixed Viewport Height, Internal Scroll) */}
      <div className="admin-chat-hub">
        
        {/* LEFT COLUMN: Conversation List & Search */}
        <div className={`admin-threads-sidebar ${selectedConv ? 'd-none d-md-flex' : 'd-flex'}`}>
          
          {/* Search Header */}
          <div className="p-3 border-bottom bg-white">
            <div className="position-relative mb-2">
              <i 
                className="fas fa-search position-absolute text-muted" 
                style={{ left: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', zIndex: 2 }}
              ></i>
              <input
                type="text"
                className="form-control admin-search-input"
                placeholder="Search client, email, or order #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  type="button"
                  className="btn btn-link position-absolute text-muted p-0"
                  style={{ right: '12px', top: '50%', transform: 'translateY(-50%)', textDecoration: 'none' }}
                  onClick={() => setSearchTerm('')}
                >
                  <i className="fas fa-times-circle" style={{ fontSize: '0.9rem' }}></i>
                </button>
              )}
            </div>

            {/* Quick Filter Tabs */}
            <div className="d-flex align-items-center gap-1 bg-light p-1 rounded-pill">
              <button
                type="button"
                className={`filter-tab-btn flex-grow-1 ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All ({conversations.length})
              </button>
              <button
                type="button"
                className={`filter-tab-btn flex-grow-1 ${activeFilter === 'unread' ? 'active' : ''}`}
                onClick={() => setActiveFilter('unread')}
              >
                Unread ({totalUnreadAdmin})
              </button>
              <button
                type="button"
                className={`filter-tab-btn flex-grow-1 ${activeFilter === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveFilter('orders')}
              >
                Orders
              </button>
            </div>
          </div>

          {/* Conversation List Scroll Area */}
          <div className="admin-threads-scroll">
            {loadingList ? (
              <div className="text-center py-5 text-muted">
                <div className="spinner-border text-success spinner-border-sm me-2" role="status"></div>
                <div className="small mt-2">Loading client channels...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-5 px-3 text-muted">
                <div 
                  className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-2"
                  style={{ backgroundColor: '#F1F5F9', color: '#94A3B8', width: '56px', height: '56px' }}
                >
                  <i className="fas fa-inbox fs-4"></i>
                </div>
                <h6 className="fw-semibold text-dark mb-1">No conversations found</h6>
                <small style={{ fontSize: '0.78rem' }}>No client inquiries match the current search or filter.</small>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const client = conv.client_id || {};
                const isSelected = selectedConv && selectedConv._id === conv._id;
                const unreadCount = conv.unread_admin_count || 0;
                const clientFullName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.username || 'Client';

                return (
                  <div
                    key={conv._id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`admin-thread-card ${isSelected ? 'active' : ''}`}
                  >
                    <div className="d-flex align-items-start gap-3">
                      {/* Avatar */}
                      <div className="position-relative flex-shrink-0">
                        {client.profile_picture ? (
                          <img
                            src={client.profile_picture}
                            alt={clientFullName}
                            className="rounded-circle object-fit-cover shadow-sm"
                            style={{ width: '44px', height: '44px' }}
                          />
                        ) : (
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
                            style={{
                              width: '44px',
                              height: '44px',
                              backgroundColor: isSelected ? '#0D8D1E' : '#475569',
                              fontSize: '1.05rem'
                            }}
                          >
                            {clientFullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {unreadCount > 0 && (
                          <span 
                            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white"
                            style={{ fontSize: '0.62rem' }}
                          >
                            {unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-grow-1 overflow-hidden">
                        <div className="d-flex justify-content-between align-items-baseline mb-1">
                          <h6 
                            className={`mb-0 text-truncate ${unreadCount > 0 ? 'fw-bold text-dark' : 'fw-semibold text-dark'}`} 
                            style={{ maxWidth: '170px', fontSize: '0.92rem' }}
                          >
                            {clientFullName}
                          </h6>
                          <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                            {conv.last_message?.created_at ? formatTime(conv.last_message.created_at) : formatTime(conv.updated_at)}
                          </small>
                        </div>

                        {/* Badges: Client Type + Order ID */}
                        <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                          {client.clientType && (
                            <span 
                              className="badge rounded-pill text-uppercase fw-semibold" 
                              style={{ 
                                fontSize: '0.62rem',
                                padding: '2px 7px',
                                backgroundColor: client.clientType === 'commercial' ? '#EFF6FF' : '#F1F5F9',
                                color: client.clientType === 'commercial' ? '#2563EB' : '#475569',
                                border: client.clientType === 'commercial' ? '1px solid #BFDBFE' : '1px solid #E2E8F0'
                              }}
                            >
                              {client.clientType}
                            </span>
                          )}
                          {conv.order_id && (
                            <span 
                              className="badge rounded-pill fw-semibold" 
                              style={{ 
                                fontSize: '0.62rem', 
                                padding: '2px 7px',
                                backgroundColor: '#E8F5E9', 
                                color: '#0D8D1E', 
                                border: '1px solid #C8E6C9' 
                              }}
                            >
                              <i className="fas fa-tag me-1" style={{ fontSize: '0.58rem' }}></i>#{conv.order_id}
                            </span>
                          )}
                          {client.companyName && (
                            <span className="text-muted text-truncate" style={{ fontSize: '0.7rem', maxWidth: '110px' }}>
                              <i className="fas fa-building me-1"></i>{client.companyName}
                            </span>
                          )}
                        </div>

                        {/* Last message text */}
                        <p className={`mb-0 text-truncate ${unreadCount > 0 ? 'fw-bold text-dark' : 'text-muted'}`} style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                          {conv.last_message?.sender_role === 'admin' && <span className="fw-semibold" style={{ color: '#0D8D1E' }}>You: </span>}
                          {conv.last_message?.text || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Stage */}
        <div className={`admin-stage-container ${!selectedConv ? 'd-none d-md-flex' : 'd-flex'}`}>
          {selectedConv ? (
            <>
              {/* Active Conversation Stage Header */}
              <div className="p-3 px-4 border-bottom d-flex align-items-center justify-content-between bg-white flex-shrink-0">
                <div className="d-flex align-items-center gap-3">
                  
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-md-none rounded-circle"
                    style={{ width: '36px', height: '36px', padding: 0 }}
                    onClick={() => setSelectedConv(null)}
                    title="Back to inbox"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>

                  {/* Avatar */}
                  {selectedClient.profile_picture ? (
                    <img 
                      src={selectedClient.profile_picture} 
                      alt={selectedClientName}
                      className="rounded-circle object-fit-cover shadow-sm flex-shrink-0"
                      style={{ width: '44px', height: '44px' }}
                    />
                  ) : (
                    <div 
                      className="rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm fw-bold flex-shrink-0"
                      style={{ width: '44px', height: '44px', backgroundColor: '#0D8D1E', fontSize: '1.1rem' }}
                    >
                      {selectedClientName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Header Details */}
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h5 className="mb-0 fw-bold text-dark">{selectedClientName}</h5>
                      {selectedClient.clientType && (
                        <span 
                          className="badge rounded-pill text-uppercase fw-semibold"
                          style={{
                            fontSize: '0.65rem',
                            padding: '3px 8px',
                            backgroundColor: selectedClient.clientType === 'commercial' ? '#EFF6FF' : '#F1F5F9',
                            color: selectedClient.clientType === 'commercial' ? '#2563EB' : '#475569',
                            border: selectedClient.clientType === 'commercial' ? '1px solid #BFDBFE' : '1px solid #E2E8F0'
                          }}
                        >
                          {selectedClient.clientType} Client
                        </span>
                      )}
                      {selectedConv.order_id && (
                        <span 
                          className="badge rounded-pill fw-semibold d-inline-flex align-items-center gap-1"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 10px',
                            backgroundColor: '#F1F5F9',
                            color: '#334155',
                            border: '1px solid #CBD5E1'
                          }}
                        >
                          <i className="fas fa-tag" style={{ color: '#0D8D1E', fontSize: '0.68rem' }}></i> Order #{selectedConv.order_id}
                        </span>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2 text-muted mt-1 small" style={{ fontSize: '0.78rem' }}>
                      <span><i className="fas fa-envelope me-1 text-secondary"></i>{selectedClient.email || 'No email provided'}</span>
                      {selectedClient.phone && <span>• <i className="fas fa-phone me-1 text-secondary"></i>{selectedClient.phone}</span>}
                      {selectedClient.companyName && <span>• <i className="fas fa-building me-1 text-secondary"></i>{selectedClient.companyName}</span>}
                    </div>
                  </div>
                </div>

                {/* Right Header Action: Link to Order in database */}
                {selectedConv.order_id && (
                  <div>
                    <Link 
                      to={`/admin/orders?orderId=${encodeURIComponent(selectedConv.order_id)}`} 
                      className="btn-admin-view-order"
                    >
                      <i className="fas fa-external-link-alt"></i> View Order
                    </Link>
                  </div>
                )}
              </div>

              {/* Messages Body (Internal Scrolling Only) */}
              <div ref={messagesContainerRef} className="admin-messages-scroll p-3 p-md-4">
                {loadingMessages ? (
                  <div className="text-center py-5 my-auto text-muted">
                    <div className="spinner-border text-success spinner-border-sm me-2" role="status"></div>
                    Loading conversation history...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="my-auto text-center py-5 px-3">
                    <div 
                      className="rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm p-4 mb-3"
                      style={{ width: '70px', height: '70px', backgroundColor: '#F0FDF4', color: '#0D8D1E' }}
                    >
                      <i className="fas fa-comments fs-3"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-1">Start a Conversation</h5>
                    <p className="text-muted small mx-auto mb-0" style={{ maxWidth: '400px' }}>
                      Send a message below to assist this client with their inquiry, order schedule, or quotation.
                    </p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    <div className="text-center my-2">
                      <span className="badge bg-white text-muted border px-3 py-1 shadow-sm rounded-pill" style={{ fontSize: '0.72rem' }}>
                        Conversation Channel
                      </span>
                    </div>

                    {messages.map((msg, index) => {
                      const isAdmin = msg.sender_role === 'admin';
                      const hasImg = Boolean(msg.image_url);
                      const hasTxt = Boolean(msg.text);
                      const bubblePadding = hasImg ? (hasTxt ? 'p-2 pb-3' : 'p-2') : 'p-3 px-4';

                      return (
                        <div
                          key={msg._id || index}
                          className={`d-flex flex-column ${isAdmin ? 'align-items-end' : 'align-items-start'}`}
                        >
                          <div className="d-flex align-items-end gap-2" style={{ maxWidth: '78%' }}>
                            {!isAdmin && (
                              selectedClient.profile_picture ? (
                                <img 
                                  src={selectedClient.profile_picture} 
                                  alt={selectedClientName}
                                  className="rounded-circle object-fit-cover shadow-sm flex-shrink-0"
                                  style={{ width: '32px', height: '32px', border: '1px solid #E2E8F0' }}
                                />
                              ) : (
                                <div 
                                  className="rounded-circle text-white d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm fw-bold"
                                  style={{ width: '32px', height: '32px', backgroundColor: '#64748B', fontSize: '0.78rem' }}
                                >
                                  {selectedClientName.charAt(0).toUpperCase()}
                                </div>
                              )
                            )}
                            <div className={`${bubblePadding} shadow-sm ${isAdmin ? 'chat-bubble-admin-staff' : 'chat-bubble-client-msg'}`}>
                              {hasImg && (
                                <div className="position-relative">
                                  <img
                                    src={resolveChatImageUrl(msg.image_url)}
                                    alt={msg.image_name || 'Chat attachment'}
                                    className="chat-msg-image"
                                    onClick={() => setLightboxImage({ url: msg.image_url, name: msg.image_name })}
                                  />
                                  {msg._uploading && (
                                    <span
                                      className="badge bg-dark bg-opacity-75 position-absolute bottom-0 end-0 m-2"
                                      style={{ fontSize: '0.68rem' }}
                                    >
                                      Uploading...
                                    </span>
                                  )}
                                </div>
                              )}
                              {hasTxt && (
                                <div className={hasImg ? 'mt-2 px-2' : ''}>
                                  {msg.text}
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <div 
                                className="rounded-circle text-white d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                                style={{ width: '32px', height: '32px', backgroundColor: '#0D8D1E', fontSize: '0.75rem' }}
                              >
                                <i className="fas fa-headset"></i>
                              </div>
                            )}
                          </div>
                          <small className="text-muted mt-1 px-1" style={{ fontSize: '0.7rem' }}>
                            {isAdmin ? 'Cleaneco Staff (You) • ' : `${selectedClientName} • `}
                            {formatTime(msg.created_at)}
                          </small>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Bottom Integrated Composer (Slack/Linear Style, Matching Client Side) */}
              <div className="p-3 px-4 border-top bg-white flex-shrink-0">
                
                {/* Quick Staff Response Chips */}
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {quickTemplates.map((template, tIdx) => (
                    <button
                      key={tIdx}
                      type="button"
                      className="quick-reply-pill d-inline-flex align-items-center"
                      title={template.text}
                      onClick={() => handleTemplateClick(template.text)}
                    >
                      <i className={template.icon} style={{ color: template.iconColor, fontSize: '0.74rem', marginRight: '6px' }}></i>
                      <span>{template.label}</span>
                    </button>
                  ))}
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={CHAT_IMAGE_ACCEPT}
                  className="d-none"
                  onChange={handleImageInputChange}
                />

                {/* Composer Box */}
                <form onSubmit={handleSendMessage}>
                  <div className="chat-composer-box">
                    {attachError && (
                      <div className="d-flex align-items-center justify-content-between px-3 py-2 mb-2 rounded-3 small" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                        <span><i className="fas fa-exclamation-circle me-2"></i>{attachError}</span>
                        <button type="button" className="btn btn-link btn-sm p-0 text-danger text-decoration-none" onClick={() => setAttachError('')}>
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    )}

                    {selectedImage && (
                      <div className="d-flex align-items-center justify-content-between p-2 mb-2 rounded-3 border bg-light">
                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                          <img
                            src={selectedImage.previewUrl}
                            alt={selectedImage.name}
                            className="rounded-2 object-fit-cover border bg-white flex-shrink-0"
                            style={{ width: '48px', height: '48px', cursor: 'zoom-in' }}
                            onClick={() => setLightboxImage({ url: selectedImage.previewUrl, name: selectedImage.name })}
                          />
                          <div className="overflow-hidden">
                            <div className="fw-semibold text-dark small text-truncate" style={{ maxWidth: '280px' }}>
                              {selectedImage.name}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                              {formatImageFileSize(selectedImage.size)} • Ready to send
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearSelectedImage}
                          className="btn btn-sm btn-outline-secondary rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0 ms-2"
                          style={{ width: '28px', height: '28px', padding: 0 }}
                          title="Remove attached image"
                        >
                          <i className="fas fa-times" style={{ fontSize: '0.75rem' }}></i>
                        </button>
                      </div>
                    )}

                    <textarea
                      ref={textareaRef}
                      className="chat-composer-textarea"
                      placeholder={selectedImage ? "Add an optional caption to your image..." : "Type your response to the client..."}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      disabled={sending}
                      rows={2}
                    />

                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light mt-1">
                      <span className="text-muted small d-none d-sm-inline" style={{ fontSize: '0.75rem' }}>
                        <kbd className="bg-light text-secondary border px-1 rounded">Enter ↵</kbd> to send • <kbd className="bg-light text-secondary border px-1 rounded">Shift + Enter</kbd> for new line
                      </span>

                      <div className="d-flex align-items-center gap-2 ms-auto">
                        <button
                          type="button"
                          className="chat-attach-btn"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending}
                          title="Attach image (JPG, PNG, WEBP, GIF up to 5 MB)"
                        >
                          <i className="fas fa-paperclip" style={{ fontSize: '0.95rem' }}></i>
                        </button>

                        <button
                          type="submit"
                          className="btn btn-success d-flex align-items-center gap-2 rounded-pill px-4 py-2 shadow-sm fw-semibold"
                          style={{ backgroundColor: '#0D8D1E', border: 'none', transition: 'all 0.18s ease' }}
                          disabled={(!messageText.trim() && !selectedImage) || sending}
                        >
                          {sending ? (
                            <div className="spinner-border spinner-border-sm text-white" role="status"></div>
                          ) : (
                            <>
                              <span>Send Reply</span>
                              <i className="fas fa-paper-plane" style={{ fontSize: '0.85rem' }}></i>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Modern Enterprise Empty State */
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center p-5 bg-white">
              <div 
                className="rounded-circle d-flex align-items-center justify-content-center shadow-sm p-4 mb-3"
                style={{ width: '84px', height: '84px', backgroundColor: '#F0FDF4', color: '#0D8D1E' }}
              >
                <i className="fas fa-comments fs-1"></i>
              </div>
              <h4 className="fw-bold text-dark mb-2">Customer Communications Desk</h4>
              <p className="text-muted mx-auto mb-4" style={{ maxWidth: '420px', fontSize: '0.92rem' }}>
                Select a client conversation from the inbox on the left to review inquiry history, provide service updates, and send quotations.
              </p>
              <div className="d-flex gap-3 text-start bg-light p-3 px-4 rounded-4 border" style={{ maxWidth: '460px' }}>
                <div className="d-flex align-items-center gap-3">
                  <div 
                    className="rounded-circle text-white d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '38px', height: '38px', backgroundColor: '#0D8D1E' }}
                  >
                    <i className="fas fa-shield-alt"></i>
                  </div>
                  <div>
                    <div className="fw-bold text-dark small">Verified Direct Channel</div>
                    <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                      Staff responses are synchronized in real time to the client portal and customer widget.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
}
