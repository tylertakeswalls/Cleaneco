import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/auth.css';
import logocontainer from '../assets/styles/images/logo_container.png';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing password reset token. Please request a new link.');
      return;
    }

    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword: password
      });

      if (response.data.success) {
        setStatus('success');
        setMessage(response.data.message || 'Your password has been successfully reset! You can now log in.');
      } else {
        setStatus('error');
        setMessage(response.data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h3>Reset Password</h3>
      </div>

      {/* Cleaneco Logo (hidden on success view to avoid clutter) */}
      {status !== 'success' && (
        <div className="form-top-title">
          <img src={logocontainer} alt="Cleaneco Logo" />
        </div>
      )}

      {status === 'success' ? (
        <div className="text-center py-3">
          <div className="mb-3">
            <i className="fas fa-check-circle" style={{ color: '#0D8D1E', fontSize: '4.5rem' }}></i>
          </div>
          <h3 className="fw-bold text-dark mb-2">Password Reset!</h3>
          <p className="text-muted mb-4 small">
            {message || 'Your password has been successfully reset! You can now log in.'}
          </p>
          <Link 
            to="/login" 
            className="btn-register-custom d-block text-center text-decoration-none"
          >
            <i className="fas fa-sign-in-alt me-2"></i>Proceed to Login
          </Link>
        </div>
      ) : !token ? (
        <div className="text-center py-3">
          <div className="mb-3">
            <i className="fas fa-exclamation-triangle text-warning" style={{ fontSize: '4rem' }}></i>
          </div>
          <h4 className="fw-bold text-dark mb-2">Invalid Reset Link</h4>
          <p className="text-muted mb-4 small">
            This password reset link is missing a valid token. Please return to the login page to request a new link.
          </p>
          <Link 
            to="/login" 
            className="btn-register-custom d-block text-center text-decoration-none"
          >
            <i className="fas fa-arrow-left me-2"></i>Back to Login
          </Link>
        </div>
      ) : (
        <div>
          <div className="text-center mb-4">
            <h4 className="fw-bold text-dark mb-1">Create New Password</h4>
            <p className="text-muted small mb-0">
              Please enter a secure new password for your Cleaneco account.
            </p>
          </div>

          {status === 'error' && message && (
            <div className="alert alert-danger py-2 px-3 small text-center mb-3" role="alert">
              <i className="fas fa-exclamation-circle me-2"></i>{message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* New Password */}
            <div className="form-group mb-3 text-start">
              <label className="form-label small fw-bold text-dark mb-1">New Password</label>
              <div className="password-input-container">
                <i className="fas fa-lock input-left-icon"></i>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex="-1"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="form-group mb-4 text-start">
              <label className="form-label small fw-bold text-dark mb-1">Confirm New Password</label>
              <div className="password-input-container">
                <i className="fas fa-lock input-left-icon"></i>
                <input 
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex="-1"
                >
                  <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Password Requirements hint */}
            <div className="mb-4 p-2 bg-light rounded small text-muted d-flex align-items-center" style={{ fontSize: '0.825rem' }}>
              <i className="fas fa-info-circle me-2 text-success"></i>
              <span>Must be at least 6 characters. Passwords must match.</span>
            </div>

            <button 
              type="submit" 
              className="btn-register-custom"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Updating Password...
                </>
              ) : (
                <>
                  <i className="fas fa-key me-2"></i>Reset Password
                </>
              )}
            </button>

            <div className="text-center mt-3">
              <Link to="/login" className="small text-decoration-none" style={{ color: '#0D8D1E', fontWeight: '500' }}>
                <i className="fas fa-arrow-left me-1"></i>Back to Login
              </Link>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
