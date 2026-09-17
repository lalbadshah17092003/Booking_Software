import React from 'react'
import { useNavigate } from 'react-router-dom';
import "./Forbidden.css"

export default function Forbidden() {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className='error-401'>
      <h1>403 - Forbidden</h1>
      <p>You don't have permission to access this page.</p>
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
  )
}
