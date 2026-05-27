import React from 'react';
import { useAuth } from '../AuthContext';

export default function AuthLoading({ children }) {
  const { loading, error } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        {error}
      </div>
    );
  }

  return children;
}