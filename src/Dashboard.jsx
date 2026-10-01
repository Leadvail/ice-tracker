import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Dashboard({ onLogin }) {
  const [role, setRole] = useState('viewer');
  const [templates, setTemplates] = useState([]);
  const [launchTemplate, setLaunchTemplate] = useState(null);

  useEffect(() => {
    supabase.from('exercise_templates').select('id, name, officer_rank, created_at').order('created_at', { ascending: false })
      .then(({ data }) => setTemplates(data || []));
  }, []);

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (!launchTemplate) return;

    const newCode = launchTemplate.id; // Use the template's UUID as the generic session code

    // Check if a global generic session for this template already exists
    const { data: existing, error: selectError } = await supabase.from('exercise_sessions').select('code').eq('code', newCode).maybeSingle();

    if (selectError) {
      console.error("Error checking session:", selectError);
    }

    if (!existing) {
      // Create the generic session in DB
      const { error } = await supabase.from('exercise_sessions').insert({
        code: newCode,
        template_id: launchTemplate.id,
        candidate_name: 'Generic Exercise',
        state: {
          activeNodeId: null,
          decisions: {},
          completedNodes: [],
          isClockRunning: false,
          clockStartTime: null,
          tacticalMode: 'Oscar',
          incidentSize: '6 Pumps',
        }
      });

      if (error) {
        alert("Error creating generic session: " + error.message);
        return;
      }
    }

    // Join the generic session
    onLogin({ code: newCode, role: role });
  };

  return (
    <div className="login-container">
      <div className="card login-form" style={{ maxWidth: '600px', width: '100%' }}>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
          <button 
            className="tab-btn active" 
            style={{ flex: 1, padding: '1rem', background: 'none', border: 'none', color: 'white', borderBottom: '2px solid var(--color-blue)', cursor: 'default', fontWeight: 'bold' }}
          >
            Available Exercises
          </button>
          <button 
            className="tab-btn" 
            onClick={() => window.location.href = '/builder'}
            style={{ flex: 1, padding: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Timeline Builder
          </button>
        </div>

        {!launchTemplate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <h2>Exercise Library</h2>
              <p style={{ color: 'var(--text-muted)' }}>Select an exercise to join or launch.</p>
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
                    <button className="btn btn-primary" onClick={() => setLaunchTemplate(t)}>Select</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLaunch} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <button type="button" onClick={() => setLaunchTemplate(null)} style={{ background: 'none', border: 'none', color: 'var(--color-blue)', cursor: 'pointer', marginBottom: '0.5rem' }}>← Back to Exercises</button>
              <h2>Join Exercise</h2>
              <p style={{ color: 'var(--text-muted)' }}>Selected: <strong style={{ color: 'white' }}>{launchTemplate.name}</strong></p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Your Role</label>
              <div className="role-selector" style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className={`role-btn ${role === 'facilitator' ? 'active' : ''}`} onClick={() => setRole('facilitator')} style={{ flex: 1 }}>Facilitator</button>
                <button type="button" className={`role-btn ${role === 'viewer' ? 'active' : ''}`} onClick={() => setRole('viewer')} style={{ flex: 1 }}>Viewer</button>
                <button type="button" className={`role-btn ${role === 'assessor' ? 'active' : ''}`} onClick={() => setRole('assessor')} style={{ flex: 1 }}>Assessor</button>
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Join Exercise Session</button>
          </form>
        )}

      </div>
    </div>
  );
}
