import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';

export default function ClientChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const loggedInUser = sessionStorage.getItem('loggedInUser');
  const userRole = sessionStorage.getItem('userRole');
  const userId = sessionStorage.getItem('userId');

  const isClient = !!loggedInUser && userRole !== 'admin' && !!userId;
  const isDedicatedMessagesPage = location.pathname === '/client/messages' || location.pathname === '/messages';

  // Fetch or initialize client's conversation
  const loadConversation = async () => {
    if (!isClient) return;
    try {
      const res = await api.get('/messages/conversations', {
        params: { userId, role: 'client' }
      });
      if (res.data && res.data.success) {
        const conv = res.data.conversation;
        setConversation(conv);
        setUnreadCount(conv.unread_client_count || 0);
        return conv;
      }
    } catch (err) {
      console.error('Error fetching client conversation:', err);
    }
  };

  // Fetch messages for conversation
  const loadMessages = async (convId, isInitial = false) => {
    if (!convId) return;
    if (isInitial) setLoading(true);
    try {
      const res = await api.get(`/messages/conversations/${convId}/messages`);
      if (res.data && res.data.success) {
        setMessages(prev => {
          const newMsgs = res.data.messages || [];
          if (newMsgs.length !== prev.length || (newMsgs.length > 0 && prev.length > 0 && newMsgs[newMsgs.length - 1]._id !== prev[prev.length - 1]._id)) {
            return newMsgs;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Mark conversation read
  const markAsRead = async (convId) => {
    if (!convId) return;
    try {
      await api.put(`/messages/conversations/${convId}/read`, { role: 'client' });
      setUnreadCount(0);
      setConversation(prev => prev ? { ...prev, unread_client_count: 0 } : prev);
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  // On mount / login change
  useEffect(() => {
    if (isClient) {
      loadConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, userId]);

  // Smart Polling
  useEffect(() => {
    if (!isClient) return;

    // Fast polling when widget is open (every 3.5s)
    // Slower polling when closed (every 15s) for unread badges
    const pollInterval = isOpen ? 3500 : 15000;

    const interval = setInterval(() => {
      if (isOpen && conversation?._id) {
        loadMessages(conversation._id, false);
      } else {
        // Poll unread count
        api.get('/messages/unread-count', { params: { userId, role: 'client' } })
          .then(res => {
            if (res.data && res.data.success) {
              setUnreadCount(res.data.unreadCount || 0);
            }
          })
          .catch(() => {});
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [isClient, isOpen, conversation?._id, userId]);

  // When widget opens
  const handleToggle = async () => {
    if (!isOpen) {
      setIsOpen(true);
      const conv = conversation || await loadConversation();
      if (conv?._id) {
        await loadMessages(conv._id, true);
        if (conv.unread_client_count > 0 || unreadCount > 0) {
          await markAsRead(conv._id);
        }
      }
    } else {
      setIsOpen(false);
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    let conv = conversation;
    if (!conv?._id) {
      conv = await loadConversation();
    }
    if (!conv?._id) return;

    const trimmed = inputText.trim();
    setInputText('');
    setSending(true);

    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      _id: tempId,
      conversation_id: conv._id,
      sender_id: { _id: userId, role: 'client' },
      sender_role: 'client',
      text: trimmed,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await api.post(`/messages/conversations/${conv._id}/messages`, {
        text: trimmed,
        sender_id: userId,
        sender_role: 'client',
        order_id: conv.order_id || null
      });

      if (res.data && res.data.success) {
        const savedMsg = res.data.message;
        setMessages(prev => prev.map(m => m._id === tempId ? savedMsg : m));
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      alert('Unable to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMsgTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Do not show widget on admin routes or if not client, or if client is already on dedicated messages page
  if (!isClient || isDedicatedMessagesPage) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', bottom: '25px', right: '25px', zIndex: 1050 }}>
      
      {/* Widget Animation & Element Styles */}
      <style>{`
        @keyframes cleanecoChatFadeIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .cleaneco-chat-popup {
          width: 385px !important;
          height: 520px !important;
          max-height: calc(100vh - 50px) !important;
          max-width: calc(100vw - 35px) !important;
          display: flex !important;
          flex-direction: column !important;
          animation: cleanecoChatFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          border-radius: 1.25rem !important;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2) !important;
        }
        .cleaneco-chat-body {
          flex: 1 1 0 !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        .cleaneco-chat-input {
          height: 42px !important;
          min-height: 42px !important;
          max-height: 42px !important;
          padding: 0 16px !important;
          border-radius: 21px !important;
          border: 1.5px solid #d1d5db !important;
          font-size: 0.88rem !important;
          background-color: #f8fafc !important;
          color: #1f2937 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .cleaneco-chat-input:focus {
          border-color: #0D8D1E !important;
          background-color: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(13, 141, 30, 0.15) !important;
        }
        .cleaneco-chat-send-btn {
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          min-height: 42px !important;
          border-radius: 50% !important;
          background-color: #0D8D1E !important;
          color: #ffffff !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: transform 0.15s ease, background-color 0.15s ease !important;
        }
        .cleaneco-chat-send-btn:hover:not(:disabled) {
          background-color: #0A6F17 !important;
          transform: scale(1.05) !important;
        }
        .cleaneco-chat-send-btn:disabled {
          opacity: 0.55 !important;
          cursor: not-allowed !important;
        }
        .cleaneco-launcher-btn {
          transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
        }
        .cleaneco-launcher-btn:hover {
          transform: scale(1.06);
          box-shadow: 0 10px 28px rgba(13, 141, 30, 0.45) !important;
        }
        .cleaneco-launcher-btn:active {
          transform: scale(0.94);
        }
      `}</style>

      {/* FLOATING CHAT DIALOG */}
      {isOpen && (
        <div className="card border-0 overflow-hidden cleaneco-chat-popup bg-white">
          {/* Header */}
          <div
            className="p-3 text-white d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#0D8D1E' }}
          >
            <div className="d-flex align-items-center gap-2 overflow-hidden">
              <div
                className="rounded-circle bg-white text-success d-flex align-items-center justify-content-center shadow-sm flex-shrink-0"
                style={{ width: '38px', height: '38px' }}
              >
                <i className="fas fa-headset fs-5" style={{ color: '#0D8D1E' }}></i>
              </div>
              <div className="overflow-hidden">
                <h6 className="mb-0 fw-bold" style={{ color: '#FFFFFF', fontSize: '0.98rem', letterSpacing: '0.2px' }}>
                  Cleaneco Support
                </h6>
                <small style={{ color: '#FFFFFF', opacity: 0.94, fontSize: '0.72rem', whiteSpace: 'nowrap', display: 'block' }}>
                  <span className="rounded-circle d-inline-block me-1" style={{ width: '7px', height: '7px', backgroundColor: '#5DFF79', boxShadow: '0 0 6px rgba(93, 255, 121, 0.8)' }}></span>
                  We typically reply in a few minutes
                </small>
              </div>
            </div>

            <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
              {/* Expand to Full Page (Option C) */}
              <button
                type="button"
                className="btn btn-sm btn-link text-white p-1 opacity-75 hover-opacity-100"
                title="Expand to Full Page"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/client/messages');
                }}
              >
                <i className="fas fa-expand-alt" style={{ fontSize: '0.85rem' }}></i>
              </button>
              
              {/* Close Button */}
              <button
                type="button"
                className="btn btn-sm btn-link text-white p-1 opacity-75 hover-opacity-100"
                onClick={() => setIsOpen(false)}
                title="Close Chat"
              >
                <i className="fas fa-times" style={{ fontSize: '1rem' }}></i>
              </button>
            </div>
          </div>

          {/* Context Banner if order linked */}
          {conversation?.order_id && (
            <div className="bg-light px-3 py-1 border-bottom text-muted d-flex align-items-center justify-content-between" style={{ fontSize: '0.75rem' }}>
              <span><i className="fas fa-tag text-success me-1"></i> Order #{conversation.order_id}</span>
              <span className="badge bg-white text-secondary border">Active Inquiry</span>
            </div>
          )}

          {/* Messages Body (Locked scrollable container that never expands card) */}
          <div className="p-3 cleaneco-chat-body" style={{ backgroundColor: '#F8F9FA' }}>
            {loading ? (
              <div className="text-center py-5 text-muted small">
                <div className="spinner-border text-success spinner-border-sm me-2" role="status"></div>
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-5 text-muted px-3">
                <div className="rounded-circle bg-white shadow-sm p-3 d-inline-block mb-3">
                  <i className="fas fa-comments fs-3 text-success"></i>
                </div>
                <h6 className="fw-bold text-dark">How can we help you today?</h6>
                <p className="small text-muted mb-0">
                  Send us a message below regarding your quotation, scheduling, or service inquiries.
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {messages.map((msg, idx) => {
                  const isMe = msg.sender_role === 'client';
                  return (
                    <div
                      key={msg._id || idx}
                      className={`d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}`}
                    >
                      <div
                        className={`p-2 px-3 rounded-4 shadow-sm ${
                          isMe ? 'bg-success text-white' : 'bg-white text-dark border'
                        }`}
                        style={{
                          backgroundColor: isMe ? '#0D8D1E' : '#FFFFFF',
                          maxWidth: '82%',
                          fontSize: '0.88rem',
                          borderBottomRightRadius: isMe ? '4px' : '1rem',
                          borderBottomLeftRadius: !isMe ? '4px' : '1rem',
                          lineHeight: '1.4',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {msg.text}
                      </div>
                      <small className="text-muted mt-1 px-1" style={{ fontSize: '0.65rem' }}>
                        {isMe ? 'You • ' : 'Cleaneco Support • '}
                        {formatMsgTime(msg.created_at)}
                      </small>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom Compose Input with Pixel-Perfect Alignment */}
          <div className="p-3 border-top bg-white">
            <form onSubmit={handleSendMessage} className="d-flex align-items-center gap-2 m-0 p-0" style={{ height: '42px' }}>
              <input
                type="text"
                className="cleaneco-chat-input flex-grow-1"
                placeholder="Type your message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                autoFocus
              />
              <button
                type="submit"
                className="cleaneco-chat-send-btn flex-shrink-0"
                disabled={!inputText.trim() || sending}
                title="Send Message"
              >
                {sending ? (
                  <div className="spinner-border spinner-border-sm text-white" style={{ width: '15px', height: '15px' }}></div>
                ) : (
                  <i className="fas fa-paper-plane text-white" style={{ fontSize: '0.85rem' }}></i>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING LAUNCHER BUTTON (Only displayed when chat dialog is closed) */}
      {!isOpen && (
        <div className="text-end">
          <button
            type="button"
            onClick={handleToggle}
            className="btn shadow-lg rounded-circle text-white d-flex align-items-center justify-content-center position-relative cleaneco-launcher-btn"
            style={{
              width: '60px',
              height: '60px',
              backgroundColor: '#0D8D1E',
              border: '3px solid #FFFFFF',
              boxShadow: '0 8px 24px rgba(13, 141, 30, 0.35)',
              cursor: 'pointer'
            }}
            title="Chat with Cleaneco Support"
          >
            <i className="fas fa-comment-dots fs-3"></i>
            {unreadCount > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white"
                style={{ fontSize: '0.75rem', transform: 'translate(-30%, 10%)' }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
