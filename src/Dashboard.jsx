import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Dashboard({ onLogin, initialTab = 'join' }) {
  const [tab, setTab] = useState(initialTab);
  
  // Join State
  const [code, setCode] = useState('');
  const [role, setRole] = useState('viewer');

  // Library State
  const [templates, setTemplates] = useState([]);
  const [launchTemplate, setLaunchTemplate] = useState(null);
  const [launchForm, setLaunchForm] = useState({ code: '', candidate: '', assessor1: '', assessor2: '' });

  useEffect(() => {
    if (tab === 'library') {
      supabase.from('exercise_templates').select('id, name, officer_rank, created_at').order('created_at', { ascending: false })
        .then(({ data }) => setTemplates(data || []));
    }
  }, [tab]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!code) return;
    onLogin({ code: code.toUpperCase(), role });
  };

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (!launchForm.code || !launchForm.candidate) return;

    const newCode = launchForm.code.toUpperCase();

    // Create session in DB
    const { error } = await supabase.from('exercise_sessions').insert({
      code: newCode,
      template_id: launchTemplate.id,
      candidate_name: launchForm.candidate,
      assessor_1_name: launchForm.assessor1,
      assessor_2_name: launchForm.assessor2,
      state: {
        activeNodeId: null,
        decisions: {},
        completedNodes: [],
        isClockRunning: false,
        clockStartTime: null,
      }
    });

    if (error) {
      alert("Error creating session: " + error.message);
      return;
    }

    // Immediately log the user in as Facilitator
    onLogin({ code: newCode, role: 'facilitator' });
  };

  return (
    <div className="login-container">
      <div className="card login-form" style={{ maxWidth: '600px', width: '100%' }}>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
          <button 
            className={`tab-btn ${tab === 'join' ? 'active' : ''}`} 
            onClick={() => setTab('join')}
            style={{ flex: 1, padding: '1rem', background: 'none', border: 'none', color: tab === 'join' ? 'white' : 'var(--text-muted)', borderBottom: tab === 'join' ? '2px solid var(--color-blue)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Join Exercise
          </button>
          <button 
            className={`tab-btn ${tab === 'library' ? 'active' : ''}`} 
            onClick={() => { setTab('library'); setLaunchTemplate(null); }}
            style={{ flex: 1, padding: '1rem', background: 'none', border: 'none', color: tab === 'library' ? 'white' : 'var(--text-muted)', borderBottom: tab === 'library' ? '2px solid var(--color-blue)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Master Library
          </button>
          <button 
            className="tab-btn" 
            onClick={() => window.location.href = '/admin'}
            style={{ flex: 1, padding: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Timeline Builder
          </button>
        </div>

        {tab === 'join' && (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h2>Join Active Session</h2>
              <p style={{ color: 'var(--text-muted)' }}>Enter a shared code to join a live exercise.</p>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Shared Exercise Code</label>
              <input type="text" className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. HENFIELD-2026" required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Role</label>
              <div className="role-selector" style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className={`role-btn ${role === 'facilitator' ? 'active' : ''}`} onClick={() => setRole('facilitator')} style={{ flex: 1 }}>Facilitator</button>
                <button type="button" className={`role-btn ${role === 'viewer' ? 'active' : ''}`} onClick={() => setRole('viewer')} style={{ flex: 1 }}>Viewer</button>
                <button type="button" className={`role-btn ${role === 'assessor' ? 'active' : ''}`} onClick={() => setRole('assessor')} style={{ flex: 1 }}>Assessor</button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Join Exercise</button>
          </form>
        )}

        {tab === 'library' && !launchTemplate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h2>Master Library</h2>
              <p style={{ color: 'var(--text-muted)' }}>Select an exercise template to run a new session.</p>
            </div>
            
            {templates.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading templates...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {templates.map(t => (
                  <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0' }}>{t.name}</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rank: {t.officer_rank}</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setLaunchTemplate(t)}>Run</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'library' && launchTemplate && (
          <form onSubmit={handleLaunch} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
             <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <button type="button" onClick={() => setLaunchTemplate(null)} style={{ background: 'none', border: 'none', color: 'var(--color-blue)', cursor: 'pointer', marginBottom: '0.5rem' }}>← Back to Library</button>
              <h2>Launch Session</h2>
              <p style={{ color: 'var(--text-muted)' }}>Running: {launchTemplate.name}</p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Create Session Code</label>
              <input type="text" className="input" value={launchForm.code} onChange={e => setLaunchForm({...launchForm, code: e.target.value})} placeholder="e.g. ALPHA-1" required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Candidate Name</label>
              <input type="text" className="input" value={launchForm.candidate} onChange={e => setLaunchForm({...launchForm, candidate: e.target.value})} placeholder="Full Name" required />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Assessor 1 (Optional)</label>
                <input type="text" className="input" value={launchForm.assessor1} onChange={e => setLaunchForm({...launchForm, assessor1: e.target.value})} placeholder="Name" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Assessor 2 (Optional)</label>
                <input type="text" className="input" value={launchForm.assessor2} onChange={e => setLaunchForm({...launchForm, assessor2: e.target.value})} placeholder="Name" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Launch Exercise</button>
          </form>
        )}

      </div>
    </div>
  );
}
