import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

export default function PortalLanding({ session }) {
  const navigate = useNavigate();

  // Extract user details
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 2rem',
        height: '70px',
        backgroundColor: '#f8f9fa',
        borderBottom: '3px solid #e9ecef',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, color: '#003399', fontSize: '1.5rem', fontWeight: 'bold' }}>
            Training and Assessment - Online Portal
          </h1>
          <span style={{ fontSize: '1.8rem', color: '#003399' }}>🌐</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#333', fontWeight: '500' }}>{userName}</span>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#dee2e6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '2px solid #ccc'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🧑‍🚒</span>
          </div>
          <button 
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1 }}>
        
        {/* Left Sidebar */}
        <div style={{
          width: '280px',
          padding: '2rem 1.5rem',
          borderRight: '2px solid #e9ecef',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          backgroundColor: '#ffffff'
        }}>
          
          <button 
            onClick={() => navigate('/training-spec')}
            style={sidebarButtonStyle()}
          >
            CREATE / AMEND TRAINING<br/>SPECIFICATION
          </button>
          <button 
            onClick={() => navigate('/competency-framework')}
            style={sidebarButtonStyle()}
          >
            COMPETENCY FRAMEWORK
          </button>
          <button 
            onClick={() => navigate('/course-planner')}
            style={sidebarButtonStyle()}
          >
            COURSE PLANNER
          </button>
          <button 
            onClick={() => navigate('/tfa-assessment')}
            style={sidebarButtonStyle()}
          >
            TRAINING FREQUENCY<br/>ASSESSMENT
          </button>
          
          <button
            onClick={() => navigate('/join')}
            style={sidebarButtonStyle()}
          >
            INCIDENT COMMAND<br/>EXERCISE
          </button>
          
          <div style={{ marginTop: 'auto' }}>
            <button style={{
              ...sidebarButtonStyle(),
              backgroundColor: '#f5c6aa',
              color: '#333',
              border: '1px solid #e2a988'
            }}>
              TRAINING FREQUENCY<br/>ASSESSMENT - V2
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '3rem 4rem', position: 'relative' }}>
          <h2 style={{ fontSize: '1.4rem', color: '#000', marginBottom: '2rem', fontWeight: 'bold' }}>
            Welcome to the Training Specification - Online Portal
          </h2>
          
          <div style={{ fontSize: '1.1rem', color: '#333', lineHeight: '1.6', maxWidth: '800px' }}>
            <p style={{ marginBottom: '1.5rem' }}>
              This area is designed for Subject Matter Experts (SME's) to manage their Training Specifications.
            </p>
            
            <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>
              Through this portal, SME's can:
            </p>
            
            <ul style={{ listStyleType: 'none', paddingLeft: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <li style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', top: '0.2rem' }}>•</span>
                Create or amend their Training Specification's.
              </li>
              <li style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', top: '0.2rem' }}>•</span>
                Map their learning outcomes across the staff groups to create the Competency Framework.
              </li>
              <li style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', top: '0.2rem' }}>•</span>
                Run the Training Frequency Assessment to manage the maintenance of skill.
              </li>
              <li style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '-1.5rem', top: '0.2rem' }}>•</span>
                Run assessments to measure competence.
              </li>
            </ul>
          </div>
          
          {/* LFB Logo */}
          <div style={{
            position: 'absolute',
            bottom: '2rem',
            right: '3rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
              <div style={{ backgroundColor: '#e31837', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem' }}>L</div>
              <div style={{ backgroundColor: '#e31837', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem' }}>F</div>
              <div style={{ backgroundColor: '#e31837', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem' }}>B</div>
            </div>
            <span style={{ color: '#999', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>LONDON FIRE BRIGADE</span>
          </div>
          
        </div>
      </div>
    </div>
  );
}

function sidebarButtonStyle() {
  return {
    width: '100%',
    padding: '0.8rem 1rem',
    backgroundColor: '#f1f3f5',
    color: '#003399',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: '600',
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    transition: 'all 0.2s ease',
    lineHeight: '1.3'
  };
}
