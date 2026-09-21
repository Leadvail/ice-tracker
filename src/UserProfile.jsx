import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useNavigate } from 'react-router-dom';

export default function UserProfile({ session }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    full_name: '',
    rank_role: '',
    department: '',
    qualifications: '',
    initials: ''
  });
  const [permissions, setPermissions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles_portal')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (profileData) {
        setProfile({
          full_name: profileData.full_name || '',
          rank_role: profileData.rank_role || '',
          department: profileData.department || '',
          qualifications: profileData.qualifications || '',
          initials: profileData.initials || ''
        });
      }

      // 2. Fetch Permissions
      const { data: permData } = await supabase
        .from('user_module_permissions')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setPermissions(permData || {});

    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = {
      id: session.user.id,
      email: session.user.email,
      full_name: profile.full_name,
      rank_role: profile.rank_role,
      department: profile.department,
      qualifications: profile.qualifications,
      initials: profile.initials
    };

    const { error } = await supabase
      .from('profiles_portal')
      .upsert(payload);

    if (error) {
      alert("Error saving profile: " + error.message);
    } else {
      alert("Profile saved successfully!");
    }
    
    setIsSaving(false);
  };

  const handlePasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    
    if (error) {
      alert("Error sending password reset: " + error.message);
    } else {
      alert("Password reset link has been sent to your email!");
    }
  };

  const cardStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '2rem',
    marginBottom: '2rem'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 'bold',
    color: '#111827'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#111827',
    backgroundColor: '#ffffff',
    marginBottom: '1.5rem',
    boxSizing: 'border-box'
  };

  const moduleItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    color: '#111827',
    fontWeight: '500'
  };

  if (isLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#111827' }}>Loading Profile...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: '#111827', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, color: '#f3f4f6' }}>My Profile & Settings</h1>
        <button 
          onClick={() => navigate('/')} 
          style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f3f4f6', cursor: 'pointer', color: '#111827', fontWeight: 'bold' }}
        >
          Back to Dashboard
        </button>
      </div>

      <form onSubmit={handleSave}>
        {/* Section 1: Professional Identity */}
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem', color: '#111827' }}>Professional Identity</h2>
          
          <label style={labelStyle}>Contact Email</label>
          <input 
            type="email" 
            value={session?.user?.email || ''} 
            readOnly 
            style={{ ...inputStyle, backgroundColor: '#f9fafb', cursor: 'not-allowed' }} 
          />

          <label style={labelStyle}>Full Name</label>
          <input 
            type="text" 
            value={profile.full_name} 
            onChange={(e) => setProfile({...profile, full_name: e.target.value})} 
            style={inputStyle} 
          />

          <label style={labelStyle}>Current Rank / Role</label>
          <input 
            type="text" 
            placeholder="e.g. Sub Officer"
            value={profile.rank_role} 
            onChange={(e) => setProfile({...profile, rank_role: e.target.value})} 
            style={inputStyle} 
          />

          <label style={labelStyle}>Department / Brigade</label>
          <input 
            type="text" 
            placeholder="e.g. Incident Command Development Team"
            value={profile.department} 
            onChange={(e) => setProfile({...profile, department: e.target.value})} 
            style={{ ...inputStyle, marginBottom: 0 }} 
          />
        </div>

        {/* Section 2: Assessor Credentials */}
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem', color: '#111827' }}>Assessor Credentials</h2>
          
          <label style={labelStyle}>Qualifications Profile</label>
          <textarea 
            placeholder="e.g. Level 5 Coaching Professional, Level 2 Incident Command Assessor"
            value={profile.qualifications} 
            onChange={(e) => setProfile({...profile, qualifications: e.target.value})} 
            rows={4}
            style={inputStyle} 
          />

          <label style={labelStyle}>Digital Initials</label>
          <input 
            type="text" 
            maxLength={4}
            placeholder="e.g. JDS"
            value={profile.initials} 
            onChange={(e) => setProfile({...profile, initials: e.target.value.toUpperCase()})} 
            style={{ ...inputStyle, marginBottom: 0, width: '150px' }} 
          />
        </div>

        <button 
          type="submit" 
          disabled={isSaving}
          style={{ padding: '1rem 2rem', backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', width: '100%', marginBottom: '2rem' }}
        >
          {isSaving ? 'Saving Profile...' : 'Save Profile Changes'}
        </button>
      </form>

      {/* Section 3: Portal Access Overview */}
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem', color: '#111827' }}>Portal Access Overview</h2>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}>
          {[
            { key: 'can_access_training_spec', label: 'Training Specification' },
            { key: 'can_access_competency_framework', label: 'Competency Framework' },
            { key: 'can_access_course_planner', label: 'Course Planner' },
            { key: 'can_access_tfa', label: 'Training Frequency Assessment' },
            { key: 'can_access_incident_command', label: 'Incident Command Exercise' }
          ].map((mod, idx, arr) => {
            const hasAccess = permissions && permissions[mod.key];
            return (
              <div key={mod.key} style={{ ...moduleItemStyle, borderBottom: idx === arr.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
                <span style={{ marginRight: '1rem', display: 'flex' }}>
                  {hasAccess ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="green" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="gray" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  )}
                </span>
                {mod.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Security */}
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem', color: '#111827' }}>Security</h2>
        <p style={{ marginBottom: '1.5rem', color: '#111827' }}>Need to update your password? We will send a secure reset link to your contact email.</p>
        <button 
          onClick={handlePasswordReset}
          style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ffffff', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Send Password Reset Link
        </button>
      </div>

    </div>
  );
}
