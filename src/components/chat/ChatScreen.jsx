import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getMessages, sendMessage, subscribeToMessages, reportChat } from '../../services/database';
import { formatDistance } from 'date-fns';
import './ChatScreen.css';

export default function ChatScreen() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Block admin access
  useEffect(() => {
    if (isAdmin) {
      alert('Admins cannot access private chats');
      navigate('/admin');
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!user || !chatId) {
      console.error('Missing user or chatId');
      return;
    }

    console.log(`[Chat] Subscribing to messages for chat: ${chatId}`);
    
    // Subscribe to real-time messages
    const unsubscribe = subscribeToMessages(chatId, (msgs) => {
      console.log(`[Chat] Received ${msgs.length} messages`);
      setMessages(msgs);
      setLoading(false);
      scrollToBottom();
    }, (error) => {
      console.error('[Chat] Subscription error:', error);
      setError('Failed to load messages: ' + error.message);
      setLoading(false);
    });

    return () => {
      console.log(`[Chat] Unsubscribing from chat: ${chatId}`);
      unsubscribe();
    };
  }, [chatId, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      console.log('[Chat] Sending message...');
      await sendMessage(chatId, user.uid, newMessage.trim());
      console.log('[Chat] ✅ Message sent successfully');
      setNewMessage('');
    } catch (err) {
      console.error('[Chat] ❌ Send error:', err);
      setError(err.message);
      
      // Show user-friendly error messages
      if (err.code === 'permission-denied') {
        setError('You do not have permission to send messages in this chat.');
      } else if (err.message.includes('Index')) {
        setError('Database index required. Please wait a few minutes and try again.');
      } else {
        setError('Failed to send message: ' + err.message);
      }
    } finally {
      setSending(false);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportReason.trim() || reporting) return;

    setReporting(true);
    
    try {
      console.log('[Chat] Reporting chat...');
      await reportChat(chatId, user.uid, reportReason.trim());
      console.log('[Chat] ✅ Chat reported successfully');
      
      alert('Chat reported successfully. Admin will review it.');
      setShowReportModal(false);
      setReportReason('');
    } catch (err) {
      console.error('[Chat] ❌ Report error:', err);
      alert('Failed to report chat: ' + err.message);
    } finally {
      setReporting(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistance(date, new Date(), { addSuffix: true });
  };

  return (
    <div className="chat-screen">
      <div className="chat-header">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <button 
              className="btn btn-text"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
            <h3>Chat</h3>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowReportModal(true)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              🚩 Report
            </button>
          </div>
        </div>
      </div>

      <div className="chat-warning">
        <div className="container">
          <div className="alert alert-info">
            ⚠️ Chats are AI-moderated for safety. Please be respectful.
          </div>
        </div>
      </div>

      <div className="chat-main">
        <div className="container">
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <p className="text-muted">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.senderId === user.uid ? 'message-sent' : 'message-received'}`}
                  >
                    <div className="message-bubble">
                      <p className="message-text">{message.text}</p>
                      <span className="message-time">{formatTime(message.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="chat-input-container">
        <div className="container">
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--spacing-sm)' }}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSend} className="chat-input-form">
            <input
              type="text"
              className="form-input chat-input"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!newMessage.trim() || sending}
            >
              {sending ? '...' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Report Chat</h3>
            <p className="text-muted mb-lg">
              If this chat contains inappropriate content, harassment, or makes you feel unsafe, please report it.
              Admin will review the entire chat history.
            </p>

            <form onSubmit={handleReport}>
              <div className="form-group">
                <label className="form-label">Reason for reporting *</label>
                <textarea
                  className="form-input"
                  rows="4"
                  placeholder="Please describe why you're reporting this chat..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                  maxLength={500}
                />
                <p className="form-helper">
                  {reportReason.length}/500 characters
                </p>
              </div>

              <div className="alert alert-warning mb-md">
                <strong>⚠️ Important:</strong> Admin will be able to see all messages in this chat to investigate your report.
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportReason('');
                  }}
                  disabled={reporting}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!reportReason.trim() || reporting}
                  style={{ flex: 1 }}
                >
                  {reporting ? 'Reporting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
