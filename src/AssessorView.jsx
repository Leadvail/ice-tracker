import React, { useState } from 'react';
import { supabase } from './supabase';
import { categoryMap } from './criteriaMap';

export default function AssessorView({ session, onBack }) {
  // Initialize scores from database if they exist, or empty object
  const initialScores = session?.scores || {};
  const [scores, setScores] = useState(initialScores);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' or 'error'

  const handleScoreChange = (item, score) => {
    setScores(prev => ({
      ...prev,
      [item]: score
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const { error } = await supabase
        .from('exercise_sessions')
        .update({ scores })
        .eq('code', session.code); // Assuming we pass code down or session has it. Wait, session doesn't have 'code' unless we requested it. Let's make sure code is available.

      if (error) throw error;
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '800px', margin: '0 auto' }}>
      <button className="btn" onClick={onBack} style={{ marginBottom: '1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'white' }}>
        ← Back to Dashboard
      </button>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Post-Exercise Assessment</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Candidate</p>
            <p style={{ fontWeight: 'bold', margin: 0, fontSize: '1.2rem' }}>{session?.candidate_name || 'Unknown'}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Session Code</p>
            <p style={{ fontWeight: 'bold', margin: 0, fontSize: '1.2rem' }}>{session?.code || 'N/A'}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Assessor 1</p>
            <p style={{ margin: 0 }}>{session?.assessor_1_name || '-'}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Assessor 2</p>
            <p style={{ margin: 0 }}>{session?.assessor_2_name || '-'}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {Object.entries(categoryMap).map(([catName, catData]) => (
          <div key={catName} className="card" style={{ borderTop: `4px solid ${catData.color}` }}>
            <h3 style={{ color: catData.color, marginTop: 0 }}>{catName}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
              {catData.items.map(item => (
                <div key={item} style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>{item}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    {[1, 2, 3, 4].map(score => (
                      <label 
                        key={score} 
                        style={{ 
                          flex: 1, 
                          textAlign: 'center', 
                          padding: '1rem', 
                          borderRadius: '8px', 
                          border: scores[item] === score ? `2px solid ${catData.color}` : '1px solid var(--border-color)',
                          background: scores[item] === score ? 'rgba(255,255,255,0.05)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input 
                          type="radio" 
                          name={item} 
                          value={score} 
                          checked={scores[item] === score}
                          onChange={() => handleScoreChange(item, score)}
                          style={{ display: 'none' }}
                        />
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{score}</div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '1rem', background: 'var(--bg-main)', borderTop: '1px solid var(--border-color)', marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {saveStatus === 'success' && <span style={{ color: 'var(--color-green)' }}>✓ Scores saved successfully!</span>}
          {saveStatus === 'error' && <span style={{ color: 'var(--color-red)' }}>Error saving scores.</span>}
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          disabled={isSaving}
          style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
        >
          {isSaving ? 'Saving...' : 'Submit Scores'}
        </button>
      </div>

    </div>
  );
}
