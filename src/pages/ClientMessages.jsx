import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api/api';
import ChatImageLightbox, {
  CHAT_IMAGE_ACCEPT,
  resolveChatImageUrl,
  validateChatImageFile,
  formatImageFileSize,
  extractPastedImageFile,
  mergePolledMessages
} from '../components/ChatImageLightbox';

export default function ClientMessages() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [attachError, setAttachError] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const loggedInUser = sessionStorage.getItem('loggedInUser');
  const userRole = sessionStorage.getItem('userRole');
  const userId = sessionStorage.getItem('userId');

  // Check authentication
  useEffect(() => {
    if (!loggedInUser || userRole === 'admin') {
      navigate('/login');
      return;
    }
  }, [loggedInUser, userRole, navigate]);

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

  // Load conversation
  const loadConversation = async () => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const queryOrderId = searchParams.get('orderId') || location.state?.orderId;

      let res;
      if (queryOrderId) {
        res = await api.post('/messages/conversations/init', {
          client_id: userId,
          order_id: queryOrderId
        });
      } else {
        res = await api.get('/messages/conversations', {
          params: { userId, role: 'client' }
        });
      }

      if (res.data && res.data.success) {
        const conv = res.data.conversation;
        setConversation(conv);
        if (conv?._id) {
          await loadMessages(conv._id, true);
          if (conv.unread_client_count > 0) {
            await api.put(`/messages/conversations/${conv._id}/read`, { role: 'client' });
          }
        }
      }
    } catch (err) {
      console.error('Error loading client conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load messages
  const loadMessages = async (convId) => {
    if (!convId) return;
    try {
      const res = await api.get(`/messages/conversations/${convId}/messages`);
      if (res.data && res.data.success) {
        setMessages(prev => mergePolledMessages(prev, res.data.messages || []));
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    if (userId) {
      loadConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, location.search]);

  // Smart polling every 3.5s on active page
  useEffect(() => {
    if (!conversation?._id) return;
    const interval = setInterval(() => {
      loadMessages(conversation._id);
    }, 3500);
    return () => clearInterval(interval);
  }, [conversation?._id]);

  // Ensure the page always starts scrolled to the very top upon navigation
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 60);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  // Auto-scroll messages area internally without shifting the outer browser window
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message (text, image, or both)
  const handleSendMessage = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const textToSend = (textOverride !== null ? textOverride : messageText).trim();
    const imageToSend = textOverride !== null ? null : selectedImage;

    if ((!textToSend && !imageToSend) || sending || !conversation?._id) return;

    if (textOverride === null) {
      setMessageText('');
      setSelectedImage(null);
    }
    setAttachError('');
    setSending(true);

    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      _id: tempId,
      conversation_id: conversation._id,
      sender_id: { _id: userId, role: 'client' },
      sender_role: 'client',
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
        formData.append('sender_id', userId);
        formData.append('sender_role', 'client');
        if (conversation.order_id) {
          formData.append('order_id', conversation.order_id);
        }
        res = await api.post(`/messages/conversations/${conversation._id}/messages`, formData);
      } else {
        res = await api.post(`/messages/conversations/${conversation._id}/messages`, {
          text: textToSend,
          sender_id: userId,
          sender_role: 'client',
          order_id: conversation.order_id || null
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

  const handlePromptClick = (promptText) => {
    setMessageText(promptText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const formatMsgTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const quickPrompts = [
    "What is the current status of my order?",
    "When will the siphoning team arrive?",
    "I have a question regarding my price quotation.",
    "Can I request a reschedule for my site inspection?"
  ];

  return (
    <div className="container-fluid py-4 px-md-5" style={{ maxWidth: '1400px' }}>
      <ChatImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      
      {/* Embedded Modern Styling for Client Messages */}
      <style>{`
        .client-messages-hub {
          height: calc(100vh - 170px);
          min-height: 600px;
          border-radius: 1.25rem;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
          border: 1px solid #eef2f6;
        }
        .chat-sidebar {
          background-color: #f8fafc;
          border-right: 1px solid #e2e8f0;
          overflow-y: auto;
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
        .quick-prompt-chip {
          background: #ffffff;
          color: #334155;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 500;
          padding: 6px 14px;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .quick-prompt-chip:hover {
          background: #f1f5f9;
          color: #0D8D1E;
          border-color: #cbd5e1;
          transform: translateY(-1px);
        }
        .chat-bubble-client {
          background: linear-gradient(135deg, #0D8D1E 0%, #0A6F17 100%);
          color: #ffffff;
          border-radius: 18px 18px 4px 18px;
          box-shadow: 0 3px 10px rgba(13, 141, 30, 0.15);
          font-size: 0.93rem;
          line-height: 1.5;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .chat-bubble-admin {
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
        .btn-brand-outline {
          border: 1.5px solid #0D8D1E !important;
          color: #0D8D1E !important;
          background-color: #ffffff !important;
          transition: all 0.2s ease !important;
        }
        .btn-brand-outline:hover, .btn-brand-outline:focus, .btn-brand-outline:active {
          background-color: #0D8D1E !important;
          border-color: #0D8D1E !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(13, 141, 30, 0.22) !important;
        }
        .btn-brand-primary {
          background-color: #0D8D1E !important;
          border: 1.5px solid #0D8D1E !important;
          color: #ffffff !important;
          transition: all 0.2s ease !important;
        }
        .btn-brand-primary:hover, .btn-brand-primary:focus, .btn-brand-primary:active {
          background-color: #0A6F17 !important;
          border-color: #0A6F17 !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(13, 141, 30, 0.25) !important;
        }
      `}</style>

      {/* Top Breadcrumb & Actions Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-1 small">
              <li className="breadcrumb-item"><Link to="/client" className="text-decoration-none fw-semibold" style={{ color: '#0D8D1E' }}>Home</Link></li>
              <li className="breadcrumb-item active text-secondary" aria-current="page">Support Hub</li>
            </ol>
          </nav>
          <h3 className="fw-bold mb-0 text-dark">
            Support & Inquiry Workspace
          </h3>
        </div>

        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <Link to="/orders" className="btn btn-brand-outline btn-sm rounded-pill px-3 shadow-sm fw-medium">
            <i className="fas fa-list-alt me-1"></i> Ongoing Orders
          </Link>
          <Link to="/order" className="btn btn-brand-primary btn-sm rounded-pill px-3 shadow-sm fw-medium">
            <i className="fas fa-plus me-1"></i> Book New Service
          </Link>
        </div>
      </div>

      {/* Main Two-Column Support Hub Workspace */}
      <div className="client-messages-hub row g-0">
        
        {/* LEFT COLUMN: Support Info & Context Sidebar (Desktop Only) */}
        <div className="col-lg-4 col-xl-3 d-none d-lg-flex flex-column chat-sidebar p-4 justify-content-between">
          <div>
            {/* Cleaneco Verified Support Card */}
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 bg-white">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div 
                  className="rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm"
                  style={{ width: '46px', height: '46px', backgroundColor: '#0D8D1E' }}
                >
                  <i className="fas fa-headset fs-5"></i>
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-dark">Cleaneco Helpdesk</h6>
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span className="support-pulse-dot"></span>
                    <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: '#0D8D1E' }}>Live • Online</span>
                  </div>
                </div>
              </div>
              <p className="text-muted small mb-0" style={{ fontSize: '0.82rem', lineHeight: '1.45' }}>
                Direct channel with our administrative coordinators and field dispatchers. We typically respond within minutes.
              </p>
            </div>

            {/* Attached Order Context Card */}
            {conversation?.order_id ? (
              <div className="card border-success border-opacity-25 shadow-sm rounded-4 p-3 mb-3" style={{ backgroundColor: '#F0F9F1' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="badge px-2 py-1 text-white fw-semibold" style={{ fontSize: '0.7rem', backgroundColor: '#0D8D1E' }}>
                    <i className="fas fa-link me-1"></i> Linked Order
                  </span>
                  <Link to="/orders" className="fw-bold text-decoration-none small" style={{ fontSize: '0.75rem', color: '#0D8D1E' }}>
                    View in Orders →
                  </Link>
                </div>
                <h6 className="fw-bold text-dark mb-1">
                  Order #{conversation.order_id}
                </h6>
                <p className="text-muted small mb-0" style={{ fontSize: '0.8rem' }}>
                  Messages in this channel are tagged with this order for quick staff reference.
                </p>
              </div>
            ) : (
              <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 bg-white">
                <div className="d-flex align-items-center gap-2 text-muted mb-1" style={{ fontSize: '0.8rem' }}>
                  <i className="fas fa-info-circle" style={{ color: '#0D8D1E' }}></i>
                  <span className="fw-bold">General Inquiry Mode</span>
                </div>
                <p className="text-muted small mb-0" style={{ fontSize: '0.78rem' }}>
                  To inquire about a specific active service, click <strong>Message Support</strong> directly on your <Link to="/orders" className="text-decoration-none fw-semibold" style={{ color: '#0D8D1E' }}>Ongoing Orders card</Link>.
                </p>
              </div>
            )}

            {/* Quick Action Topics */}
            <div className="mb-3">
              <label className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                Suggested Inquiries
              </label>
              <div className="d-flex flex-column gap-2">
                {quickPrompts.map((prompt, idx) => (
                  <div
                    key={idx}
                    className="p-2 px-3 bg-white rounded-3 border small text-secondary cursor-pointer transition-all hover-shadow"
                    style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                    onClick={() => handlePromptClick(prompt)}
                  >
                    <i className="fas fa-question-circle me-2" style={{ color: '#0D8D1E' }}></i>
                    {prompt}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Emergency Hotline Card at bottom */}
          <div className="p-3 bg-white rounded-4 border shadow-sm">
            <small className="text-muted d-block mb-1 fw-medium" style={{ fontSize: '0.74rem' }}>Need immediate dispatch assistance?</small>
            <a 
              href="tel:0464470354" 
              className="d-inline-flex align-items-center text-decoration-none text-dark fw-bold"
              style={{ fontSize: '0.94rem' }}
            >
              <i className="fas fa-phone-alt me-2" style={{ color: '#0D8D1E' }}></i> (046) 447-03-54
            </a>
          </div>
        </div>

        {/* RIGHT COLUMN: Chat Conversation Stage */}
        <div className="col-12 col-lg-8 col-xl-9 d-flex flex-column h-100 bg-white">
          
          {/* Header */}
          <div className="p-3 px-4 border-bottom d-flex align-items-center justify-content-between bg-white">
            <div className="d-flex align-items-center gap-3">
              <div 
                className="rounded-circle text-white d-flex align-items-center justify-content-center shadow-sm flex-shrink-0"
                style={{ width: '42px', height: '42px', backgroundColor: '#0D8D1E' }}
              >
                <i className="fas fa-headset fs-5"></i>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h5 className="mb-0 fw-bold text-dark">Cleaneco Support</h5>
                  <span 
                    className="badge rounded-pill fw-semibold d-inline-flex align-items-center"
                    style={{
                      fontSize: '0.72rem',
                      padding: '4px 10px',
                      backgroundColor: '#E8F5E9',
                      color: '#0D8D1E',
                      border: '1px solid #C8E6C9',
                      gap: '4px',
                      lineHeight: 1.2
                    }}
                  >
                    <i className="fas fa-check-circle" style={{ fontSize: '0.68rem' }}></i> Official Team
                  </span>
                  {conversation?.order_id && (
                    <span 
                      className="badge rounded-pill fw-semibold d-inline-flex align-items-center"
                      style={{
                        fontSize: '0.72rem',
                        padding: '4px 10px',
                        backgroundColor: '#F1F5F9',
                        color: '#334155',
                        border: '1px solid #CBD5E1',
                        gap: '4px',
                        lineHeight: 1.2
                      }}
                    >
                      <i className="fas fa-tag" style={{ color: '#0D8D1E', fontSize: '0.68rem' }}></i> Order #{conversation.order_id}
                    </span>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2 text-muted mt-1" style={{ fontSize: '0.78rem' }}>
                  <span className="support-pulse-dot"></span>
                  <span>Active Customer Assistance</span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small d-none d-md-block" style={{ fontSize: '0.8rem' }}>
                Logged in as <strong>{loggedInUser}</strong>
              </span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div 
            ref={messagesContainerRef}
            className="flex-grow-1 p-3 p-md-4 overflow-auto d-flex flex-column" 
            style={{ backgroundColor: '#F8FAFC' }}
          >
            {loading ? (
              <div className="text-center py-5 my-auto text-muted">
                <div className="spinner-border text-success spinner-border-sm me-2" role="status"></div>
                Connecting to Cleaneco Support Channel...
              </div>
            ) : messages.length === 0 ? (
              /* High-End Modern Onboarding State */
              <div className="my-auto text-center py-5 px-3">
                <div 
                  className="rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm p-4 mb-3"
                  style={{ width: '80px', height: '80px', backgroundColor: '#F0F9F1', color: '#0D8D1E' }}
                >
                  <i className="fas fa-comments fs-2"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">Welcome to Cleaneco Support</h4>
                <p className="text-muted mx-auto mb-4" style={{ maxWidth: '460px', fontSize: '0.92rem' }}>
                  Have questions about your scheduled date, quotation, site assessment, or invoice? Type below, attach a site photo, or pick a topic to get started immediately.
                </p>

                {/* Quick action buttons */}
                <div className="d-flex flex-wrap justify-content-center gap-2" style={{ maxWidth: '620px', margin: '0 auto' }}>
                  {quickPrompts.map((prompt, pIdx) => (
                    <button
                      key={pIdx}
                      className="quick-prompt-chip"
                      onClick={() => handleSendMessage(null, prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                
                {/* Date separator */}
                <div className="text-center my-2">
                  <span className="badge bg-white text-muted border px-3 py-1 shadow-sm rounded-pill" style={{ fontSize: '0.72rem' }}>
                    Conversation Channel
                  </span>
                </div>

                {messages.map((msg, index) => {
                  const isMe = msg.sender_role === 'client';
                  const hasImg = Boolean(msg.image_url);
                  const hasTxt = Boolean(msg.text);
                  const bubblePadding = hasImg ? (hasTxt ? 'p-2 pb-3' : 'p-2') : 'p-3 px-4';

                  return (
                    <div
                      key={msg._id || index}
                      className={`d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}`}
                    >
                      <div className="d-flex align-items-end gap-2" style={{ maxWidth: '80%' }}>
                        {!isMe && (
                          <div 
                            className="rounded-circle text-white d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm" 
                            style={{ width: '32px', height: '32px', backgroundColor: '#0D8D1E', fontSize: '0.8rem' }}
                          >
                            <i className="fas fa-headset"></i>
                          </div>
                        )}
                        <div className={`${bubblePadding} shadow-sm ${isMe ? 'chat-bubble-client' : 'chat-bubble-admin'}`}>
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
                      </div>
                      <small className="text-muted mt-1 px-1" style={{ fontSize: '0.7rem' }}>
                        {isMe ? 'You • ' : 'Cleaneco Support Staff • '}
                        {formatMsgTime(msg.created_at)}
                      </small>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Modern Integrated Composer Footer (Slack / Linear style) */}
          <div className="p-3 px-4 border-top bg-white">
            
            {/* Quick Prompts Bar (when conversation has few messages) */}
            {messages.length > 0 && messages.length <= 4 && (
              <div className="d-flex gap-2 overflow-auto pb-2 mb-2 no-scrollbar">
                {quickPrompts.slice(0, 3).map((prompt, qIdx) => (
                  <button
                    key={qIdx}
                    type="button"
                    className="quick-prompt-chip"
                    onClick={() => handlePromptClick(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

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
                  placeholder={selectedImage ? "Add an optional caption to your image..." : "Type your message or inquiry here..."}
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
                          <span>Send</span>
                          <i className="fas fa-paper-plane" style={{ fontSize: '0.85rem' }}></i>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
