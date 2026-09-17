// NotFound.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import "./NotFound.css"

const NotFound = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }} className='error-404'>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <button 
        onClick={handleLoginClick}
        style={{
          padding: '12px 24px',
          backgroundColor: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer',
          marginTop: '20px',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#5a67d8';
          e.target.style.transform = 'translateY(-2px)';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = '#667eea';
          e.target.style.transform = 'translateY(0)';
        }}
      >
        Go to Login
      </button>
    </div>
  );
};

export default NotFound;
