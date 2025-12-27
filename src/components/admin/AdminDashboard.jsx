import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getAllIssuesForAdmin, 
  getIssueStats, 
  updateIssueStatus, 
  subscribeToAllIssues,
  getAllMentorRequestsForAdmin,
  getMentorRequestStats,
  getAllChatRoomsForAdmin,
  getChatStats,
  getAllChatReports,
  getChatReportStats,
  updateChatReportStatus
} from '../../services/database';
import { signOut } from '../../services/auth';
import { formatDistance } from 'date-fns';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated } = useAuth();
  
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [updatingIssue, setUpdatingIssue] = useState(false);
  const [activeTab, setActiveTab] = useState('issues'); // NEW: Tab state
  const [mentorRequests, setMentorRequests] = useState([]); // NEW
  const [mentorStats, setMentorStats] = useState(null); // NEW
  const [chatRooms, setChatRooms] = useState([]); // NEW
  const [chatStats, setChatStats] = useState(null); // NEW
  const [chatReports, setChatReports] = useState([]); // NEW: Chat reports
  const [chatReportStats, setChatReportStats] = useState(null); // NEW
  const [selectedReport, setSelectedReport] = useState(null); // NEW: Selected report for viewing

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!isAuthenticated || !isAdmin)) {
      navigate('/home');
    }
  }, [isAuthenticated, isAdmin, loading, navigate]);

  // Load issues and stats
  useEffect(() => {
    if (!isAdmin) return;

    if (activeTab === 'issues') {
      // Subscribe to issues for real-time updates
      const unsubscribe = subscribeToAllIssues((updatedIssues) => {
        setIssues(updatedIssues);
        calculateStats(updatedIssues);
        setLoading(false);
      });
      return () => unsubscribe();
    } else if (activeTab === 'requests') {
      // Load mentor requests
      loadMentorRequests();
    } else if (activeTab === 'chats') {
      // Load chat metadata
      loadChatMetadata();
    } else if (activeTab === 'reports') {
      // Load chat reports
      loadChatReports();
    }
  }, [isAdmin, activeTab]);

  const loadMentorRequests = async () => {
    setLoading(true);
    try {
      const requests = await getAllMentorRequestsForAdmin();
      const stats = await getMentorRequestStats();
      setMentorRequests(requests);
      setMentorStats(stats);
    } catch (error) {
      console.error('Error loading mentor requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatMetadata = async () => {
    setLoading(true);
    try {
      const rooms = await getAllChatRoomsForAdmin();
      const stats = await getChatStats();
      setChatRooms(rooms);
      setChatStats(stats);
    } catch (error) {
      console.error('Error loading chat metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatReports = async () => {
    setLoading(true);
    try {
      const reports = await getAllChatReports();
      const stats = await getChatReportStats();
      setChatReports(reports);
      setChatReportStats(stats);
    } catch (error) {
      console.error('Error loading chat reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (allIssues) => {
    const calculated = {
      total: allIssues.length,
      open: allIssues.filter(i => i.status === 'Open').length,
      inReview: allIssues.filter(i => i.status === 'In Review').length,
      resolved: allIssues.filter(i => i.status === 'Resolved').length,
      byCategory: {
        Safety: allIssues.filter(i => i.category === 'Safety').length,
        Hygiene: allIssues.filter(i => i.category === 'Hygiene').length,
        Infrastructure: allIssues.filter(i => i.category === 'Infrastructure').length,
        Canteen: allIssues.filter(i => i.category === 'Canteen').length
      },
      byPriority: {
        High: allIssues.filter(i => i.priority === 'High').length,
        Medium: allIssues.filter(i => i.priority === 'Medium').length,
        Low: allIssues.filter(i => i.priority === 'Low').length
      }
    };
    setStats(calculated);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleUpdateStatus = async (issueId, newStatus, note) => {
    setUpdatingIssue(true);
    try {
      await updateIssueStatus(issueId, newStatus, note, user.email);
      setSelectedIssue(null);
    } catch (error) {
      console.error('Error updating issue:', error);
      alert('Failed to update issue status');
    } finally {
      setUpdatingIssue(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistance(date, new Date(), { addSuffix: true });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'var(--color-priority-high)';
      case 'Medium': return 'var(--color-priority-medium)';
      default: return 'var(--color-priority-low)';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Open': return 'status-open';
      case 'In Review': return 'status-review';
      case 'Resolved': return 'status-resolved';
      default: return '';
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false;
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <p className="text-muted">Loading admin dashboard...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="container">
          <div className="admin-header-content">
            <h1 className="admin-title">🛡️ Admin Dashboard</h1>
            <div className="admin-user-info">
              <span className="admin-email">{user.email}</span>
              <button className="btn btn-text btn-sm" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <div className="container">
          {/* Navigation Tabs */}
          <div className="admin-tabs">
            <button
              className={`admin-tab ${activeTab === 'issues' ? 'active' : ''}`}
              onClick={() => setActiveTab('issues')}
            >
              📋 Issues
            </button>
            <button
              className={`admin-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              🤝 Mentor Requests
            </button>
            <button
              className={`admin-tab ${activeTab === 'chats' ? 'active' : ''}`}
              onClick={() => setActiveTab('chats')}
            >
              💬 Chat Metadata
            </button>
          </div>

          {/* ISSUES TAB */}
          {activeTab === 'issues' && (
            <>
              {/* Statistics Cards */}
              {stats && (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Issues</div>
                    <div className="stat-value">{stats.total}</div>
                  </div>
                  <div className="stat-card stat-open">
                    <div className="stat-label">Open</div>
                    <div className="stat-value">{stats.open}</div>
                  </div>
                  <div className="stat-card stat-review">
                    <div className="stat-label">In Review</div>
                    <div className="stat-value">{stats.inReview}</div>
                  </div>
                  <div className="stat-card stat-resolved">
                    <div className="stat-label">Resolved</div>
                    <div className="stat-value">{stats.resolved}</div>
                  </div>
                </div>
              )}

          {/* Filters */}
          <div className="filters-section">
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select 
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Review">In Review</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Category</label>
              <select 
                className="filter-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="Safety">Safety</option>
                <option value="Hygiene">Hygiene</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Canteen">Canteen</option>
              </select>
            </div>

            <div className="filter-info">
              Showing {filteredIssues.length} of {issues.length} issues
            </div>
          </div>

          {/* Issues List */}
          <div className="admin-issues-list">
            {filteredIssues.length === 0 ? (
              <div className="empty-state">
                <p className="text-muted">No issues match the selected filters</p>
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <div key={issue.id} className="card admin-issue-card">
                  <div className="issue-header">
                    <div className="issue-meta">
                      <span className="tag">{issue.category}</span>
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(issue.priority) }}
                      >
                        {issue.priority}
                      </span>
                      <span className={`status ${getStatusClass(issue.status)}`}>
                        {issue.status}
                      </span>
                    </div>
                    <span className="text-small text-muted">
                      {formatDate(issue.createdAt)}
                    </span>
                  </div>

                  <p className="issue-description">{issue.description}</p>

                  {issue.summary && (
                    <div className="issue-summary">
                      <strong>AI Summary:</strong> {issue.summary}
                    </div>
                  )}

                  {issue.tags && issue.tags.length > 0 && (
                    <div className="issue-tags">
                      {issue.tags.map((tag, idx) => (
                        <span key={idx} className="tag tag-sm">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="issue-actions">
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => setSelectedIssue(issue)}
                    >
                      Update Status
                    </button>
                  </div>

                  {issue.statusHistory && issue.statusHistory.length > 1 && (
                    <details className="issue-history">
                      <summary>Status History ({issue.statusHistory.length})</summary>
                      <div className="history-list">
                        {issue.statusHistory.map((h, idx) => (
                          <div key={idx} className="history-item">
                            <strong>{h.status}</strong>
                            {h.note && <span> - {h.note}</span>}
                            <br />
                            <span className="text-small text-muted">
                              {h.updatedBy} • {new Date(h.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
            </>
          )}

          {/* MENTOR REQUESTS TAB */}
          {activeTab === 'requests' && (
            <>
              {mentorStats && (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Requests</div>
                    <div className="stat-value">{mentorStats.total}</div>
                  </div>
                  <div className="stat-card stat-open">
                    <div className="stat-label">Pending</div>
                    <div className="stat-value">{mentorStats.pending}</div>
                  </div>
                  <div className="stat-card stat-resolved">
                    <div className="stat-label">Accepted</div>
                    <div className="stat-value">{mentorStats.accepted}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Rejected</div>
                    <div className="stat-value">{mentorStats.rejected}</div>
                  </div>
                </div>
              )}

              <div className="mentor-requests-list">
                <h3 className="mb-md">Mentor Request Metadata</h3>
                <p className="text-muted mb-lg">
                  ℹ️ Message content is not visible to admins (privacy protected)
                </p>
                
                {mentorRequests.length === 0 ? (
                  <div className="empty-state">
                    <p className="text-muted">No mentor requests yet</p>
                  </div>
                ) : (
                  <div className="requests-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Sender ID</th>
                          <th>Receiver ID</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Responded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mentorRequests.map(req => (
                          <tr key={req.id}>
                            <td><code>{req.senderId.substring(0, 8)}...</code></td>
                            <td><code>{req.receiverId.substring(0, 8)}...</code></td>
                            <td>
                              <span className={`tag ${
                                req.status === 'pending' ? 'tag-warning' :
                                req.status === 'accepted' ? 'tag-primary' :
                                'tag'
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="text-small">{formatDate(req.createdAt)}</td>
                            <td className="text-small">
                              {req.respondedAt ? formatDate(req.respondedAt) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* CHAT METADATA TAB */}
          {activeTab === 'chats' && (
            <>
              {chatStats && (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Chats</div>
                    <div className="stat-value">{chatStats.totalChats}</div>
                  </div>
                  <div className="stat-card stat-resolved">
                    <div className="stat-label">Active Today</div>
                    <div className="stat-value">{chatStats.activeToday}</div>
                  </div>
                </div>
              )}

              <div className="chat-rooms-list">
                <h3 className="mb-md">Chat Room Metadata</h3>
                <p className="text-muted mb-lg">
                  🔒 Message content is NEVER visible to admins (privacy protected)
                </p>
                
                {chatRooms.length === 0 ? (
                  <div className="empty-state">
                    <p className="text-muted">No active chats yet</p>
                  </div>
                ) : (
                  <div className="requests-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Chat ID</th>
                          <th>Participants</th>
                          <th>Created</th>
                          <th>Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chatRooms.map(chat => (
                          <tr key={chat.id}>
                            <td><code>{chat.id.substring(0, 12)}...</code></td>
                            <td>
                              {chat.userIds.map((uid, idx) => (
                                <div key={uid}>
                                  <code className="text-small">{uid.substring(0, 8)}...</code>
                                </div>
                              ))}
                            </td>
                            <td className="text-small">{formatDate(chat.createdAt)}</td>
                            <td className="text-small">{formatDate(chat.lastMessageAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Update Status Modal */}
      {selectedIssue && (
        <div className="modal-overlay" onClick={() => setSelectedIssue(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Update Issue Status</h3>
            <p className="text-muted mb-lg">
              Current Status: <strong>{selectedIssue.status}</strong>
            </p>

            <div className="status-buttons">
              {['Open', 'In Review', 'Resolved'].map(status => (
                <button
                  key={status}
                  className={`btn ${selectedIssue.status === status ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    const note = prompt(`Note for changing status to "${status}" (optional):`);
                    if (note !== null) {
                      handleUpdateStatus(selectedIssue.id, status, note);
                    }
                  }}
                  disabled={updatingIssue}
                >
                  {status}
                </button>
              ))}
            </div>

            <button 
              className="btn btn-text btn-block mt-md"
              onClick={() => setSelectedIssue(null)}
              disabled={updatingIssue}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
