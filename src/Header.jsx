import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 2rem',
      height: '70px',
      backgroundColor: '#111827',
      color: '#f3f4f6',
      // Removed bottom border and shadows to merge seamlessly with left rail
    }}>
      {/* Left: Branding & Typography (Home Button) */}
      <div 
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
        title="Return to Portal Home"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f3f4f6', marginRight: '0.25rem' }}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700 }}>Training and Assessment</span>
          <span style={{ fontWeight: 400, opacity: 0.8 }}>Online Portal</span>
        </h1>
        {/* Updated Globe Icon to match text color */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f3f4f6', marginLeft: '0.5rem' }}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </div>

      {/* Right: Environment Tag */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          borderRadius: '9999px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#ffffff'
        }}>
          Beta
        </span>
      </div>
    </header>
  );
}
