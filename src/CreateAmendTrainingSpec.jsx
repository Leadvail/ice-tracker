import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

export default function CreateAmendTrainingSpec({ session }) {
  const navigate = useNavigate();
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';

  const [policies, setPolicies] = useState([]);
  const [expandedPolicies, setExpandedPolicies] = useState({});
  const [frameworkData, setFrameworkData] = useState({});
  
  // Accordion toggle states
  const [expandedElements, setExpandedElements] = useState({});
  const [expandedHeadings, setExpandedHeadings] = useState({});
  const [expandedObjectives, setExpandedObjectives] = useState({});

  // Inline editing states for lowest level (Outcome)
  const [editingOutcomeId, setEditingOutcomeId] = useState(null);
  const [editingOutcomeText, setEditingOutcomeText] = useState('');

  // Cascading editing states for Parents
  const [editingElementObj, setEditingElementObj] = useState(null); // { policyNumber, oldTitle }
  const [editingElementText, setEditingElementText] = useState('');

  const [editingObjectiveObj, setEditingObjectiveObj] = useState(null); // { policyNumber, elementTitle, heading, oldObjective }
  const [editingObjectiveText, setEditingObjectiveText] = useState('');

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .order('policy_number', { ascending: true });

    if (error) {
      console.error('Error fetching policies:', error);
    } else {
      setPolicies(data || []);
    }
  };

  const handleTogglePolicy = async (policyNumber) => {
    const isExpanding = !expandedPolicies[policyNumber];
    
    setExpandedPolicies(prev => ({
      ...prev,
      [policyNumber]: isExpanding
    }));

    if (isExpanding && !frameworkData[policyNumber]) {
      const { data, error } = await supabase
        .from('competency_framework')
        .select('*')
        .eq('policy_id', policyNumber);

      if (error) {
        console.error('Error fetching framework:', error);
      } else {
        setFrameworkData(prev => ({
          ...prev,
          [policyNumber]: data || []
        }));
      }
    }
  };

  // --- Toggle Handlers ---
  const toggleElement = (key) => setExpandedElements(p => ({ ...p, [key]: !p[key] }));
  const toggleHeading = (key) => setExpandedHeadings(p => ({ ...p, [key]: !p[key] }));
  const toggleObjective = (key) => setExpandedObjectives(p => ({ ...p, [key]: !p[key] }));


  // --- Save Handlers ---
  const handleSaveOutcome = async (id, policyNumber) => {
    if (!editingOutcomeText.trim()) return;
    const { error } = await supabase.from('competency_framework').update({ learning_outcome: editingOutcomeText }).eq('id', id);
    if (error) { alert("Failed to update: " + error.message); return; }

    setFrameworkData(prev => {
      const updated = prev[policyNumber].map(row => row.id === id ? { ...row, learning_outcome: editingOutcomeText } : row);
      return { ...prev, [policyNumber]: updated };
    });
    setEditingOutcomeId(null);
  };

  const handleSaveElement = async (policyNumber, oldTitle) => {
    if (!editingElementText.trim()) return;
    const { error } = await supabase
      .from('competency_framework')
      .update({ element_title: editingElementText })
      .eq('policy_id', policyNumber)
      .eq('element_title', oldTitle);

    if (error) { alert("Failed to update: " + error.message); return; }

    // Instant UI refresh + keep accordion open
    setFrameworkData(prev => {
      const updated = prev[policyNumber].map(row => 
        row.element_title === oldTitle ? { ...row, element_title: editingElementText } : row
      );
      return { ...prev, [policyNumber]: updated };
    });

    const oldKey = `${policyNumber}-${oldTitle}`;
    const newKey = `${policyNumber}-${editingElementText}`;
    setExpandedElements(prev => {
      const state = { ...prev };
      if (state[oldKey]) {
        state[newKey] = true;
        delete state[oldKey];
      }
      return state;
    });

    setEditingElementObj(null);
  };

  const handleSaveObjective = async (policyNumber, elementTitle, heading, oldObjective) => {
    if (!editingObjectiveText.trim()) return;
    const { error } = await supabase
      .from('competency_framework')
      .update({ learning_objective: editingObjectiveText })
      .eq('policy_id', policyNumber)
      .eq('element_title', elementTitle)
      .eq('learning_objective', oldObjective);

    if (error) { alert("Failed to update: " + error.message); return; }

    setFrameworkData(prev => {
      const updated = prev[policyNumber].map(row => 
        (row.element_title === elementTitle && row.learning_objective === oldObjective)
          ? { ...row, learning_objective: editingObjectiveText } 
          : row
      );
      return { ...prev, [policyNumber]: updated };
    });

    const oldKey = `${policyNumber}-${elementTitle}-${heading}-${oldObjective}`;
    const newKey = `${policyNumber}-${elementTitle}-${heading}-${editingObjectiveText}`;
    setExpandedObjectives(prev => {
      const state = { ...prev };
      if (state[oldKey]) {
        state[newKey] = true;
        delete state[oldKey];
      }
      return state;
    });

    setEditingObjectiveObj(null);
  };


  // --- Render Hierarchy ---
  const renderFrameworkHierarchy = (policyNumber, rows) => {
    if (!rows || rows.length === 0) return <div style={{ color: '#374151', fontStyle: 'italic', paddingBottom: '0.5rem' }}>Loading or no data available...</div>;

    // 1. Group by Element Title
    const byElement = {};
    rows.forEach(row => {
      const el = row.element_title || 'Uncategorized Element';
      if (!byElement[el]) byElement[el] = [];
      byElement[el].push(row);
    });

    return Object.keys(byElement).map(elTitle => {
      const elKey = `${policyNumber}-${elTitle}`;
      const isElExpanded = expandedElements[elKey];
      const elRows = byElement[elTitle];
      const isEditingEl = editingElementObj?.policyNumber === policyNumber && editingElementObj?.oldTitle === elTitle;

      // 2. Group by Learning Heading
      const byHeading = { "Knowledge and Understanding": [], "Practical Application": [] };
      elRows.forEach(r => {
        const h = r.learning_heading || 'Other Heading';
        if (h === "Knowledge and Understanding") byHeading["Knowledge and Understanding"].push(r);
        else if (h === "Practical Application") byHeading["Practical Application"].push(r);
        else {
          if (!byHeading[h]) byHeading[h] = [];
          byHeading[h].push(r);
        }
      });

      return (
        <div key={elTitle} style={{ marginLeft: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
          
          {/* Element Title Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', borderBottom: '2px solid #dee2e6', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
            <button onClick={() => toggleElement(elKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '4px', color: '#003399' }}>
              {isElExpanded ? '▼' : '▶'}
            </button>
            
            {isEditingEl ? (
              <div style={{ flex: 1 }}>
                <textarea 
                  value={editingElementText}
                  onChange={(e) => setEditingElementText(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', border: '2px solid #003399', borderRadius: '4px', fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => handleSaveElement(policyNumber, elTitle)} style={{ padding: '0.3rem 1rem', backgroundColor: '#003399', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Save</button>
                  <button onClick={() => setEditingElementObj(null)} style={{ padding: '0.3rem 1rem', backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, color: '#003399', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => toggleElement(elKey)}>
                  {elTitle}
                </h4>
                <button 
                  onClick={() => { setEditingElementObj({ policyNumber, oldTitle: elTitle }); setEditingElementText(elTitle); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#f5c6aa', display: 'flex', alignItems: 'center' }}
                  title="Edit Element"
                >
                  <span style={{ fontSize: '1.1rem' }}>✏️</span>
                </button>
              </div>
            )}
          </div>

          {/* Heading Tier */}
          {isElExpanded && Object.keys(byHeading).map(heading => {
            const headingRows = byHeading[heading];
            if (headingRows.length === 0) return null;
            const headingKey = `${policyNumber}-${elTitle}-${heading}`;
            const isHeadingExpanded = expandedHeadings[headingKey];

            // 3. Group by Learning Objective
            const byObj = {};
            headingRows.forEach(r => {
              const o = r.learning_objective || 'General Objective';
              if (!byObj[o]) byObj[o] = [];
              byObj[o].push(r);
            });

            return (
              <div key={heading} style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button onClick={() => toggleHeading(headingKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#374151' }}>
                    {isHeadingExpanded ? '▼' : '▶'}
                  </button>
                  <h5 style={{ margin: 0, color: '#374151', fontSize: '1.05rem', fontWeight: '600', fontStyle: 'italic', cursor: 'pointer' }} onClick={() => toggleHeading(headingKey)}>
                    {heading}
                  </h5>
                </div>
                
                {/* Objective Tier */}
                {isHeadingExpanded && Object.keys(byObj).map(objTitle => {
                  const outcomes = byObj[objTitle];
                  const objKey = `${policyNumber}-${elTitle}-${heading}-${objTitle}`;
                  const isObjExpanded = expandedObjectives[objKey];
                  const isEditingObj = editingObjectiveObj?.policyNumber === policyNumber && editingObjectiveObj?.oldObjective === objTitle && editingObjectiveObj?.elementTitle === elTitle;

                  return (
                    <div key={objTitle} style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button onClick={() => toggleObjective(objKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px', color: '#212529' }}>
                          {isObjExpanded ? '▼' : '▶'}
                        </button>

                        {isEditingObj ? (
                          <div style={{ flex: 1 }}>
                            <textarea 
                              value={editingObjectiveText}
                              onChange={(e) => setEditingObjectiveText(e.target.value)}
                              rows={2}
                              style={{ width: '100%', padding: '0.5rem', border: '2px solid #003399', borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button onClick={() => handleSaveObjective(policyNumber, elTitle, heading, objTitle)} style={{ padding: '0.3rem 1rem', backgroundColor: '#003399', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Save</button>
                              <button onClick={() => setEditingObjectiveObj(null)} style={{ padding: '0.3rem 1rem', backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontWeight: '600', color: '#212529', fontSize: '0.95rem', cursor: 'pointer' }} onClick={() => toggleObjective(objKey)}>
                              {objTitle}
                            </div>
                            <button 
                              onClick={() => { setEditingObjectiveObj({ policyNumber, elementTitle: elTitle, heading, oldObjective: objTitle }); setEditingObjectiveText(objTitle); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem 0.25rem', color: '#f5c6aa', display: 'flex', alignItems: 'center' }}
                              title="Edit Objective"
                            >
                              <span style={{ fontSize: '1rem' }}>✏️</span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* 4. Render Learning Outcomes */}
                      {isObjExpanded && (
                        <ul style={{ listStyleType: 'none', paddingLeft: '1.5rem', margin: '0' }}>
                          {outcomes.map(row => (
                            <li key={row.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.75rem', backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e9ecef' }}>
                               <span style={{ color: '#003399', marginTop: '2px', fontSize: '1.2rem' }}>•</span>
                               
                               {editingOutcomeId === row.id ? (
                                 <div style={{ flex: 1 }}>
                                   <textarea 
                                     value={editingOutcomeText}
                                     onChange={(e) => setEditingOutcomeText(e.target.value)}
                                     rows={3}
                                     style={{ width: '100%', padding: '0.5rem', border: '2px solid #003399', borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical' }}
                                   />
                                   <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                     <button onClick={() => handleSaveOutcome(row.id, policyNumber)} style={{ padding: '0.3rem 1rem', backgroundColor: '#003399', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Save</button>
                                     <button onClick={() => { setEditingOutcomeId(null); setEditingOutcomeText(''); }} style={{ padding: '0.3rem 1rem', backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                                   </div>
                                 </div>
                               ) : (
                                 <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                   <span style={{ fontSize: '0.95rem', color: '#343a40', lineHeight: '1.5', flex: 1 }}>{row.learning_outcome}</span>
                                   <button 
                                     onClick={() => { setEditingOutcomeId(row.id); setEditingOutcomeText(row.learning_outcome); }}
                                     style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#f5c6aa', marginLeft: '1rem' }}
                                     title="Edit Outcome"
                                   >
                                     <span style={{ fontSize: '1.1rem' }}>✏️</span>
                                   </button>
                                 </div>
                               )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 2rem',
        height: '60px',
        backgroundColor: '#F9FAFB',
        borderBottom: '2px solid #e9ecef',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#003399' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <h1 style={{ margin: 0, color: '#003399', fontSize: '1.4rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>Create / Amend Training Specification</h1>
          <span style={{ fontSize: '1.6rem', color: '#003399', marginLeft: '2rem' }}>🌐</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#111827', fontSize: '0.95rem' }}>{userName}</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ccc' }}>
            <span style={{ fontSize: '1.3rem' }}>🧑‍🚒</span>
          </div>
        </div>
      </div>

      {/* Main Layout Wrapper */}
      <div style={{ padding: '2rem', flex: 1, display: 'flex' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e9ecef', display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Column */}
          <div style={{ flex: 1, padding: '2rem', borderRight: '4px solid #f1f3f5' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#111827', marginBottom: '2rem' }}>Add New Training Specification</h2>
          </div>

          {/* Right Column */}
          <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.5rem' }}>Current Training Specifications</h2>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }} className="cinematic-scroll">
              <style>
                {`
                  .cinematic-scroll::-webkit-scrollbar { width: 8px; }
                  .cinematic-scroll::-webkit-scrollbar-track { background: #f1f3f5; border-radius: 4px; }
                  .cinematic-scroll::-webkit-scrollbar-thumb { background: #ced4da; border-radius: 4px; }
                  .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #adb5bd; }
                  
                  .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
                  .toggle-switch input { opacity: 0; width: 0; height: 0; }
                  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #adb5bd; transition: .4s; border-radius: 24px; }
                  .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
                  input:checked + .slider { background-color: #003399; }
                  input:checked + .slider:before { transform: translateX(20px); }
                `}
              </style>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {policies.length === 0 ? (
                  <p style={{ color: '#374151', fontStyle: 'italic' }}>No policies found.</p>
                ) : (
                  policies.map((policy) => {
                    const isExpanded = expandedPolicies[policy.policy_number];
                    const rows = frameworkData[policy.policy_number] || [];

                    return (
                      <div key={policy.id} style={{ marginBottom: '0.5rem' }}>
                        
                        {/* Policy Header Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0 0.5rem 0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.95rem', marginBottom: '0.5rem' }}>{policy.policy_number}</div>
                            <div style={{ color: '#111827', fontSize: '0.9rem', paddingLeft: '1rem' }}>{policy.policy_name}</div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={isExpanded || false} onChange={() => handleTogglePolicy(policy.policy_number)} />
                              <span className="slider"></span>
                            </label>
                            <span style={{ fontSize: '0.85rem', color: '#374151', minWidth: '55px' }}>{isExpanded ? 'Collapse' : 'Expand'}</span>
                          </div>
                        </div>

                        {/* Nested Framework Headings */}
                        {isExpanded && (
                          <div style={{ paddingLeft: '0.5rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
                            {renderFrameworkHierarchy(policy.policy_number, rows)}
                          </div>
                        )}

                        <div style={{ height: '3px', backgroundColor: '#003399', width: '100%', marginTop: '1rem', borderRadius: '2px' }}></div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
