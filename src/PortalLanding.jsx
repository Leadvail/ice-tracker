import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import Header from './Header';
import Sidebar from './Sidebar';
import './PortalLanding.css';

export default function PortalLanding({ session }) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState(null);

  // Extract user details
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';
  const email = session?.user?.email;

  useEffect(() => {
    async function loadAccess() {
      if (!email) return;

      console.log("Diagnostic: Checking access for", email, "Session ID:", session?.user?.id);

      // 1. Fetch Role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session?.user?.id)
        .maybeSingle();
      
      console.log("Diagnostic: Role Data Payload:", roleData, "Role Error:", roleError);
      
      const userIsAdmin = roleData?.role === 'admin';
      setIsAdmin(userIsAdmin);

      // 2. Fetch Permissions (only needed if not admin)
      if (!userIsAdmin) {
        const { data: permData, error: permError } = await supabase
          .from('user_module_permissions')
          .select('*')
          .eq('email', email)
          .maybeSingle();
          
        console.log("Diagnostic: Permissions Data:", permData, "Perm Error:", permError);
        if (permData) setPermissions(permData);
      }
    }
    loadAccess();
  }, [email, session]);

  const handleRoute = (route, permissionField) => {
    if (isAdmin || (permissions && permissions[permissionField])) {
      navigate(route);
    } else {
      alert("Access Restricted: You do not currently have permission to access this module. Please request access via Portal Support.");
    }
  };

  const getCardStyle = (permissionField) => {
    if (isAdmin || (permissions && permissions[permissionField])) {
      return {};
    }
    return { opacity: 0.6, filter: 'grayscale(1)', cursor: 'not-allowed', position: 'relative' };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* Top Bar */}
      <Header />
      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Navigation Rail */}
        <Sidebar session={session} />

        {/* Main Content Workspace */}
        <div className="portal-workspace">
          
          <h2 className="portal-workspace-header">Welcome, {userName}</h2>
          
          <div className="portal-action-grid">
            
            <div className="portal-action-card" style={getCardStyle('can_access_training_spec')} onClick={() => handleRoute('/training-spec', 'can_access_training_spec')}>
              {(!isAdmin && (!permissions || !permissions.can_access_training_spec)) && (
                <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.5rem' }}>🔒</div>
              )}
              <div className="portal-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="portal-card-title">Training Specification</div>
              <div className="portal-card-desc">Create or amend training profiles.</div>
            </div>

            <div className="portal-action-card" style={getCardStyle('can_access_competency_framework')} onClick={() => handleRoute('/competency-framework', 'can_access_competency_framework')}>
              {(!isAdmin && (!permissions || !permissions.can_access_competency_framework)) && (
                <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.5rem' }}>🔒</div>
              )}
              <div className="portal-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
              </div>
              <div className="portal-card-title">Competency Framework</div>
              <div className="portal-card-desc">Map learning outcomes across staff groups.</div>
            </div>

            <div className="portal-action-card" style={getCardStyle('can_access_course_planner')} onClick={() => handleRoute('/course-planner', 'can_access_course_planner')}>
              {(!isAdmin && (!permissions || !permissions.can_access_course_planner)) && (
                <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.5rem' }}>🔒</div>
              )}
              <div className="portal-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div className="portal-card-title">Course Planner</div>
              <div className="portal-card-desc">Sequence learning objectives.</div>
            </div>

            <div className="portal-action-card" style={getCardStyle('can_access_tfa')} onClick={() => handleRoute('/tfa-assessment', 'can_access_tfa')}>
              {(!isAdmin && (!permissions || !permissions.can_access_tfa)) && (
                <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.5rem' }}>🔒</div>
              )}
              <div className="portal-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <div className="portal-card-title">Training Frequency Assessment</div>
              <div className="portal-card-desc">Calculate evidence-based refresher intervals.</div>
            </div>

            <div className="portal-action-card" style={getCardStyle('can_access_incident_command')} onClick={() => handleRoute('/join', 'can_access_incident_command')}>
              {(!isAdmin && (!permissions || !permissions.can_access_incident_command)) && (
                <div style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '1.5rem' }}>🔒</div>
              )}
              <div className="portal-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
              </div>
              <div className="portal-card-title">Incident Command Exercise</div>
              <div className="portal-card-desc">Run assessments to measure operational competence.</div>
            </div>

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
