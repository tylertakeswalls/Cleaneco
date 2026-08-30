import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/api';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await api.post('/auth/verify', { token });
        if (response.data.success) {
          setStatus('success');
          setMessage('Your email has been successfully verified! You can now log in.');
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Verification failed.');
        }
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'An error occurred during verification.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow-lg border-0 text-center p-5" style={{ borderRadius: '1rem', maxWidth: '500px', width: '100%' }}>
        {status === 'loading' && (
          <div>
            <div className="spinner-border text-success mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <h4 className="fw-bold text-dark">{message}</h4>
          </div>
        )}
        
        {status === 'success' && (
          <div>
            <i className="fas fa-check-circle text-success mb-3" style={{ fontSize: '4rem' }}></i>
            <h3 className="fw-bold text-dark mb-3">Email Verified!</h3>
            <p className="text-muted mb-4">{message}</p>
            <Link to="/login" className="btn btn-success px-5 py-2 fw-bold" style={{ borderRadius: '0.5rem', backgroundColor: '#0D8D1E' }}>
              Proceed to Login
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <i className="fas fa-exclamation-circle text-danger mb-3" style={{ fontSize: '4rem' }}></i>
            <h3 className="fw-bold text-dark mb-3">Verification Failed</h3>
            <p className="text-muted mb-4">{message}</p>
            <Link to="/login" className="btn btn-outline-success px-5 py-2 fw-bold" style={{ borderRadius: '0.5rem' }}>
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
