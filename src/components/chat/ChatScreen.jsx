import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getMessages, sendMessage, subscribeToMessages } from '../../services/database';
import { formatDistance } from 'date-fns';
import EmptyState from '../common/EmptyState';
import LoadingState from '../common/LoadingState';
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

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistance(date, new Date(), { addSuffix: true });
  };

  return (
    <div className="chat-screen">
      <div className="chat-header">
        <div className="container">
          <button
            className="btn btn-text"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <h3>Chat</h3>
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
            <LoadingState text="Loading conversation..." />
          ) : (
            <div className="messages-container">
              {messages.length === 0 ? (
                <EmptyState
                  icon="👋"
                  title="Say Hello!"
                  description="Start the conversation with your new mentor."
                />
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
    </div>
  );
}
