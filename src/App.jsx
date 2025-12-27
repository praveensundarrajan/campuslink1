import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Components
import SplashScreen from './components/auth/SplashScreen';
import AuthScreen from './components/auth/AuthScreen';
import ProfileSetup from './components/profile/ProfileSetup';
import HomeScreen from './components/home/HomeScreen';
import IssueReport from './components/issues/IssueReport';
import MentorshipScreen from './components/mentorship/MentorshipScreen';
import ActivityScreen from './components/home/ActivityScreen';
import ChatScreen from './components/chat/ChatScreen';
import AdminDashboard from './components/admin/AdminDashboard';

// Styles
import './styles/global.css';

// Protected Route wrapper
function ProtectedRoute({ children, requireProfile = false, requireAdmin = false }) {
  const { user, profile, loading, isAnonymous, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!user || isAnonymous) {
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/home" replace />;
  }

  if (requireProfile && !profile) {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
}

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<SplashScreen />} />
      <Route path="/auth" element={<AuthScreen />} />

      {/* Protected Routes */}
      <Route
        path="/profile-setup"
        element={
          <ProtectedRoute>
            <ProfileSetup />
          </ProtectedRoute>
        }
      />

      <Route path="/home" element={<HomeScreen />} />
      <Route path="/issues/report" element={<IssueReport />} />
      <Route path="/activity" element={<ActivityScreen />} />

      {/* Admin Route */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mentorship"
        element={
          <ProtectedRoute requireProfile>
            <MentorshipScreen />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat/:chatId"
        element={
          <ProtectedRoute requireProfile>
            <ChatScreen />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
