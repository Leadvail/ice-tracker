import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err.message);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigate('/login');
    }
  };

  // Only show Burger Menu if NOT on the primary Join landing page
  const isWorkspace = location.pathname !== '/join' && location.pathname !== '/';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '1rem 2rem', 
        backgroundColor: 'var(--bg-dark)', 
        borderBottom: '1px solid var(--border-color)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isWorkspace && (
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0.5rem 0 0' }}
            >
              ☰
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>ICE Master</h1>
        </div>
        
        {/* Dropdown Menu */}
        {menuOpen && isWorkspace && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '2rem',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 1000,
            overflow: 'hidden',
            minWidth: '200px',
            marginTop: '0.5rem'
          }}>
            <button onClick={() => { setMenuOpen(false); navigate('/join'); }} style={{ width: '100%', padding: '1rem', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'white', cursor: 'pointer' }}>
              Dashboard Home
            </button>
            <button onClick={handleLogout} style={{ width: '100%', padding: '1rem', textAlign: 'left', background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer' }}>
              Log Out
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, position: 'relative' }}>
        <Outlet />
      </main>
    </div>
  );
}
