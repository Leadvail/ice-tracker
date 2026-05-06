import React, { useState, useMemo } from 'react';
import { supabase } from './supabase';
import { categoryMap, scoreDescriptions } from './criteriaMap';

export default function AssessorView({ session, timelineData, onBack }) {
  const initialScores = session?.scores || {};
  const [scores, setScores] = useState(initialScores);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [activeCriteriaInfo, setActiveCriteriaInfo] = useState(null);

  // Map criteria to injects
  const criteriaToInjectsMap = useMemo(() => {
    const map = {};
    if (!timelineData) return map;
    
    const processNode = (node) => {
      if (node.criteria) {
        node.criteria.forEach(c => {
          if (!map[c]) map[c] = [];
          map[c].push(node);
        });
      }
    };

    timelineData.forEach(item => {
      if (item.type === 'node') processNode(item);
      if (item.options) {
        Object.values(item.options).forEach(processNode);
      }
    });
    return map;
  }, [timelineData]);

  const handleScoreChange = (item, score) => {
    setScores(prev => {
      // If clearing score
      if (score === null) {
        const newScores = { ...prev };
        delete newScores[item];
        return newScores;
      }
      return { 
        ...prev, 
        [item]: { ...(prev[item] || {}), score } 
      };
    });
  };

  const handleCommentChange = (item, comment) => {
    setScores(prev => ({ 
      ...prev, 
      [item]: { ...(prev[item] || {}), comment } 
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const { error } = await supabase
        .from('exercise_sessions')
        .update({ scores })
        .eq('code', session.code);

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

  // Calculate live tally
  const { totalGraded, totalPossible, percentage } = useMemo(() => {
    const gradedItems = Object.values(scores).filter(s => s && s.score);
    const totalGraded = gradedItems.length;
    // Score values are 1-4. Max points per item is 4.
    const totalPoints = gradedItems.reduce((acc, val) => acc + val.score, 0);
    const totalPossible = totalGraded * 4;
    // Formula: sum / max * 100
    const percentage = totalGraded === 0 ? 0 : Math.round((totalPoints / totalPossible) * 100);
    return { totalGraded, totalPossible: 26, percentage };
  }, [scores]);

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      
      {/* Left Column: Form */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.entries(categoryMap).map(([catName, catData]) => (
            <div key={catName} className="card" style={{ borderTop: `4px solid ${catData.color}` }}>
              <h3 style={{ color: catData.color, marginTop: 0 }}>{catName}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                {catData.items.map(item => {
                  const currentScoreObj = scores[item] || {};
                  const currentScore = currentScoreObj.score;
                  const currentComment = currentScoreObj.comment || '';
                  
                  return (
                    <div key={item} style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <p style={{ fontWeight: 'bold', margin: 0 }}>{item}</p>
                          {criteriaToInjectsMap[item] && (
                            <button 
                              onClick={() => setActiveCriteriaInfo(item)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: 0.8, fontSize: '1.2rem' }}
                              title="View where this can be evidenced"
                            >
                              ℹ️
                            </button>
                          )}
                        </div>
                        {currentScore && (
                          <button 
                            onClick={() => handleScoreChange(item, null)} 
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            Clear Selection
                          </button>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[1, 2, 3, 4].map(score => {
                          const isSelected = currentScore === score;
                          const isMinimized = currentScore && !isSelected;
                          
                          if (isMinimized) return null; // Hide non-selected options completely when one is chosen

                          return (
                            <label 
                              key={score} 
                              style={{ 
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '1rem',
                                padding: '1rem', 
                                borderRadius: '8px', 
                                border: isSelected ? `2px solid ${catData.color}` : '1px solid var(--border-color)',
                                background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              <input 
                                type="radio" 
                                name={item} 
                                value={score} 
                                checked={isSelected}
                                onChange={() => handleScoreChange(item, score)}
                                style={{ display: 'none' }}
                              />
                              <div style={{ 
                                flexShrink: 0,
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '50%', 
                                background: isSelected ? catData.color : 'rgba(255,255,255,0.1)', 
                                color: isSelected ? '#000' : '#fff',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontWeight: 'bold'
                              }}>
                                {score}
                              </div>
                              <div style={{ flex: 1, paddingTop: '4px' }}>
                                <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                  {scoreDescriptions[item]?.[score] || `Score ${score} for ${item}`}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {currentScore && (
                        <div style={{ marginTop: '1rem' }}>
                          <textarea
                            placeholder="Add your comments or evidence justification here..."
                            value={currentComment}
                            onChange={(e) => handleCommentChange(item, e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '0.75rem',
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              color: 'var(--text-main)',
                              fontSize: '0.9rem',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Tally & Actions */}
      <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '2rem' }}>
        <div className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <h3 style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Tally</h3>
          
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.2rem', margin: '1.5rem 0' }}>
            <span style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--color-blue)', lineHeight: 1 }}>{percentage}</span>
            <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>%</span>
          </div>
          
          <div style={{ background: 'var(--bg-dark)', borderRadius: '4px', height: '10px', width: '100%', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-blue)', height: '100%', width: `${percentage}%`, transition: 'width 0.3s ease' }}></div>
          </div>
          
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            <strong>{totalGraded}</strong> / <strong>{totalPossible}</strong> criteria assessed
          </p>
        </div>

        <div className="card">
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={isSaving}
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginBottom: '0.5rem' }}
          >
            {isSaving ? 'Saving...' : 'Submit Scores'}
          </button>
          <div style={{ textAlign: 'center', minHeight: '24px' }}>
            {saveStatus === 'success' && <span style={{ color: 'var(--color-green)', fontSize: '0.9rem' }}>✓ Saved successfully</span>}
            {saveStatus === 'error' && <span style={{ color: 'var(--color-red)', fontSize: '0.9rem' }}>Error saving scores.</span>}
          </div>
        </div>

        {activeCriteriaInfo && criteriaToInjectsMap[activeCriteriaInfo] && (
          <div className="card" style={{ marginTop: '1rem', maxHeight: '50vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem', color: 'var(--color-blue)' }}>Evidence Log</h3>
              <button onClick={() => setActiveCriteriaInfo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', padding: 0 }}>✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>{activeCriteriaInfo}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {criteriaToInjectsMap[activeCriteriaInfo].map(node => (
                <div key={node.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{node.title} {node.time ? `(${node.time})` : ''}</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {node.detail.slice(0, 2).map((d, i) => <li key={i}>{d}</li>)}
                    {node.detail.length > 2 && <li>...</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
