import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createIssue } from '../../services/database';
import './IssueReport.css';

const CATEGORIES = ['Safety', 'Hygiene', 'Infrastructure', 'Canteen'];

export default function IssueReport() {
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    isAnonymous: isAnonymous || false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (!formData.category) {
        throw new Error('Please select a category');
      }
      
      if (!formData.description || formData.description.trim().length === 0) {
        throw new Error('Please enter a description');
      }
      
      if (formData.description.length > 300) {
        throw new Error('Description must be 300 characters or less');
      }

      console.log('[IssueReport] Submitting issue...');
      console.log('[IssueReport] User:', user?.uid || 'anonymous');
      console.log('[IssueReport] Category:', formData.category);
      console.log('[IssueReport] Description:', formData.description);
      
      const result = await createIssue(
        {
          category: formData.category,
          description: formData.description,
          isAnonymous: formData.isAnonymous,
          userId: user?.uid || null
        },
        null  // No image
      );

      console.log('[IssueReport] ✅ Issue created successfully! ID:', result.id);

      setSuccess(true);
      setTimeout(() => {
        navigate('/activity');
      }, 2000);
    } catch (err) {
      console.error('[IssueReport] ❌ Error:', err);
      console.error('[IssueReport] Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      setError(err.message || 'Failed to submit issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="issue-report-screen">
        <div className="issue-report-container fade-in-up">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Issue Reported</h2>
            <p>Thank you for helping make our campus better. Your report has been submitted and will be reviewed by campus administrators.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="issue-report-screen">
      <div className="issue-report-container fade-in-up">
        <div className="issue-report-header">
          <button 
            className="btn btn-text"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <h2>Report a Campus Issue</h2>
          <p className="text-muted">
            Help us improve campus by reporting issues. All reports are reviewed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="issue-report-form">
          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Category</label>
            <div className="category-grid">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  type="button"
                  className={`category-btn ${formData.category === category ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, category }))}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description (max 300 characters)</label>
            <textarea
              className="form-textarea"
              placeholder="Describe the issue clearly and concisely..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              maxLength={300}
              required
            />
            <p className="form-helper">
              {formData.description.length}/300 characters
            </p>
          </div>

          {!isAnonymous && user && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                />
                <span>Report anonymously</span>
              </label>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading || !formData.category}
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
