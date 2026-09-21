import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import Header from './Header';
import Sidebar from './Sidebar';

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

  // Create Specification Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [newSpecPolicyNumber, setNewSpecPolicyNumber] = useState('');
  const [newSpecTitle, setNewSpecTitle] = useState('');
  const [newSpecOutcomes, setNewSpecOutcomes] = useState([
    { element_title: '', learning_heading: 'Knowledge and Understanding', learning_objective: '', learning_outcome: '' }
  ]);
  const [modalError, setModalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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


  // --- Create Spec Handlers ---
  const handleOpenModal = () => {
    setIsModalOpen(true);
    setModalStep(1);
    setNewSpecPolicyNumber('');
    setNewSpecTitle('');
    setNewSpecOutcomes([{ element_title: '', learning_heading: 'Knowledge and Understanding', learning_objective: '', learning_outcome: '' }]);
    setModalError('');
  };

  const handleNextStep = () => {
    if (!newSpecPolicyNumber.trim() || !newSpecTitle.trim()) {
      setModalError('Policy Number and Title are required.');
      return;
    }
    setModalError('');
    setModalStep(2);
  };

  const handleAddOutcome = () => {
    setNewSpecOutcomes([...newSpecOutcomes, { element_title: '', learning_heading: 'Knowledge and Understanding', learning_objective: '', learning_outcome: '' }]);
  };

  const handleOutcomeChange = (index, field, value) => {
    const updated = [...newSpecOutcomes];
    updated[index][field] = value;
    setNewSpecOutcomes(updated);
  };

  const handleRemoveOutcome = (index) => {
    if (newSpecOutcomes.length === 1) return;
    const updated = [...newSpecOutcomes];
    updated.splice(index, 1);
    setNewSpecOutcomes(updated);
  };

  const handleSaveSpecification = async () => {
    for (let i = 0; i < newSpecOutcomes.length; i++) {
      const o = newSpecOutcomes[i];
      if (!o.element_title.trim() || !o.learning_objective.trim() || !o.learning_outcome.trim()) {
        setModalError('All outcome fields must be filled.');
        return;
      }
    }
    setModalError('');
    setIsSubmitting(true);

    try {
      const { error: policyError } = await supabase
        .from('policies')
        .insert([{
          policy_number: newSpecPolicyNumber.trim(),
          policy_name: newSpecTitle.trim(),
          is_active: true,
          sme: 'Incident Command Development Team',
          reference: 'CompetencyFramework'
        }]);
      
      if (policyError) {
        if (policyError.code === '23505') {
          throw new Error(`Policy number '${newSpecPolicyNumber}' already exists.`);
        }
        throw policyError;
      }

      const frameworkRecords = newSpecOutcomes.map((o, index) => ({
        policy_id: newSpecPolicyNumber.trim(),
        element_title: o.element_title.trim(),
        learning_heading: o.learning_heading,
        learning_objective: o.learning_objective.trim(),
        learning_outcome: o.learning_outcome.trim(),
        title: (index + 1).toString()
      }));

      const { error: frameworkError } = await supabase
        .from('competency_framework')
        .insert(frameworkRecords);

      if (frameworkError) throw frameworkError;

      setIsModalOpen(false);
      fetchPolicies();
      alert('Specification created successfully!');
    } catch (error) {
      console.error(error);
      setModalError(error.message || 'Failed to save specification.');
    } finally {
      setIsSubmitting(false);
    }
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

    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
        <style>
          {`
            .hover-row .edit-icon { opacity: 0; transition: opacity 0.2s; }
            .hover-row:hover .edit-icon { opacity: 1; }
          `}
        </style>
        {Object.keys(byElement).map(elTitle => {
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
            <div key={elTitle} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              
              {/* Element Title Row */}
              <div className="hover-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
                <button onClick={() => toggleElement(elKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px', color: '#1f2937' }}>
                  {isElExpanded ? '▼' : '▶'}
                </button>
                
                {isEditingEl ? (
                  <div style={{ flex: 1 }}>
                    <textarea 
                      value={editingElementText}
                      onChange={(e) => setEditingElementText(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '0.5rem', border: '2px solid #1f2937', borderRadius: '4px', fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button onClick={() => handleSaveElement(policyNumber, elTitle)} style={{ padding: '0.3rem 1rem', backgroundColor: '#1f2937', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Save</button>
                      <button onClick={() => setEditingElementObj(null)} style={{ padding: '0.3rem 1rem', backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, color: '#1f2937', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => toggleElement(elKey)}>
                      {elTitle}
                    </h4>
                    <button 
                      className="edit-icon"
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
                  <div key={heading} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <div className="hover-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem 0.5rem 2rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <button onClick={() => toggleHeading(headingKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1f2937' }}>
                        {isHeadingExpanded ? '▼' : '▶'}
                      </button>
                      <h5 style={{ margin: 0, color: '#1f2937', fontSize: '0.95rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }} onClick={() => toggleHeading(headingKey)}>
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
                        <div key={objTitle} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          
                          <div className="hover-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem 0.75rem 3rem', backgroundColor: '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
                            <button onClick={() => toggleObjective(objKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px', color: '#1f2937' }}>
                              {isObjExpanded ? '▼' : '▶'}
                            </button>

                            {isEditingObj ? (
                              <div style={{ flex: 1 }}>
                                <textarea 
                                  value={editingObjectiveText}
                                  onChange={(e) => setEditingObjectiveText(e.target.value)}
                                  rows={2}
                                  style={{ width: '100%', padding: '0.5rem', border: '2px solid #1f2937', borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical' }}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                  <button onClick={() => handleSaveObjective(policyNumber, elTitle, heading, objTitle)} style={{ padding: '0.3rem 1rem', backgroundColor: '#1f2937', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Save</button>
                                  <button onClick={() => setEditingObjectiveObj(null)} style={{ padding: '0.3rem 1rem', backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.95rem', cursor: 'pointer' }} onClick={() => toggleObjective(objKey)}>
                                  {objTitle}
                                </div>
                                <button 
                                  className="edit-icon"
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
                            <div style={{ padding: 0, margin: 0, backgroundColor: '#ffffff', width: '100%' }}>
                              {outcomes.map(row => (
                                <div key={row.id} className="hover-row" style={{ display: 'flex', alignItems: 'flex-start', padding: '0.75rem 1rem 0.75rem 4.5rem', borderBottom: '1px solid #f3f4f6' }}>
                                   {editingOutcomeId === row.id ? (
                                     <div style={{ flex: 1 }}>
                                       <textarea 
                                         value={editingOutcomeText}
                                         onChange={(e) => setEditingOutcomeText(e.target.value)}
                                         rows={3}
                                         style={{ width: '100%', padding: '0.5rem', border: '2px solid #1f2937', borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical' }}
                                       />
                                       <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                         <button onClick={() => handleSaveOutcome(row.id, policyNumber)} style={{ padding: '0.3rem 1rem', backgroundColor: '#1f2937', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Save</button>
                                         <button onClick={() => { setEditingOutcomeId(null); setEditingOutcomeText(''); }} style={{ padding: '0.3rem 1rem', backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                                       </div>
                                     </div>
                                   ) : (
                                     <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                       <span style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: '1.5', flex: 1 }}>{row.learning_outcome}</span>
                                       <button 
                                         className="edit-icon"
                                         onClick={() => { setEditingOutcomeId(row.id); setEditingOutcomeText(row.learning_outcome); }}
                                         style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#f5c6aa', marginLeft: '1rem' }}
                                         title="Edit Outcome"
                                       >
                                         <span style={{ fontSize: '1.1rem' }}>✏️</span>
                                       </button>
                                     </div>
                                   )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      <Header />

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        <Sidebar session={session} />

        {/* Main Content Workspace */}
        <div style={{ flex: 1, padding: '3rem 4rem', overflowY: 'auto' }}>
          
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#111827', fontWeight: 700 }}>Training Specifications</h1>
              <button onClick={handleOpenModal} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#111827', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                + Create New Specification
              </button>
            </div>

            {/* List of Specifications */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {policies.length === 0 ? (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No specifications found.</p>
              ) : (
                policies.map((policy) => {
                  const isExpanded = expandedPolicies[policy.policy_number];
                  const rows = frameworkData[policy.policy_number] || [];

                  return (
                    <div 
                      key={policy.id} 
                      style={{ 
                        backgroundColor: '#ffffff', 
                        padding: '1.5rem', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Card Header */}
                      <div 
                        onClick={() => handleTogglePolicy(policy.policy_number)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{policy.policy_number}</div>
                          <div style={{ color: '#4b5563', fontSize: '0.95rem' }}>{policy.policy_name}</div>
                        </div>
                        
                        <div style={{ color: '#9ca3af' }}>
                          {isExpanded ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Nested Framework Content */}
                      {isExpanded && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                          {renderFrameworkHierarchy(policy.policy_number, rows)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>
      </div>

      {/* --- CREATE NEW SPECIFICATION MODAL --- */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#111827', fontSize: '1.25rem' }}>Create New Specification</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
              {modalError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
                  {modalError}
                </div>
              )}

              {modalStep === 1 && (
                <div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem' }}>Policy Number / Code</label>
                    <input 
                      type="text" 
                      value={newSpecPolicyNumber} 
                      onChange={(e) => setNewSpecPolicyNumber(e.target.value)}
                      placeholder="e.g. PN989"
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '1rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem' }}>Specification Title</label>
                    <input 
                      type="text" 
                      value={newSpecTitle} 
                      onChange={(e) => setNewSpecTitle(e.target.value)}
                      placeholder="e.g. Tactical Ventilation"
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '1rem' }}
                    />
                  </div>
                </div>
              )}

              {modalStep === 2 && (
                <div>
                  <div style={{ backgroundColor: '#f3f4f6', padding: '1rem', borderRadius: '4px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#111827', marginRight: '0.5rem' }}>{newSpecPolicyNumber}</span>
                      <span style={{ color: '#4b5563' }}>{newSpecTitle}</span>
                    </div>
                    <button onClick={() => setModalStep(1)} style={{ background: 'none', border: 'none', color: '#003399', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}>Edit Metadata</button>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', color: '#111827', marginBottom: '1rem' }}>Competency Outcomes</h3>

                  {newSpecOutcomes.map((outcome, index) => (
                    <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 'bold', color: '#374151' }}>Outcome {index + 1}</span>
                        {newSpecOutcomes.length > 1 && (
                          <button onClick={() => handleRemoveOutcome(index)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.25rem' }} title="Remove Outcome">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>Element Title</label>
                          <input type="text" value={outcome.element_title} onChange={(e) => handleOutcomeChange(index, 'element_title', e.target.value)} placeholder="e.g. Incident Risk Management" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>Heading Type</label>
                          <select value={outcome.learning_heading} onChange={(e) => handleOutcomeChange(index, 'learning_heading', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                            <option value="Knowledge and Understanding">Knowledge and Understanding</option>
                            <option value="Practical Application">Practical Application</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>Learning Objective</label>
                        <input type="text" value={outcome.learning_objective} onChange={(e) => handleOutcomeChange(index, 'learning_objective', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.25rem' }}>Learning Outcome</label>
                        <textarea value={outcome.learning_outcome} onChange={(e) => handleOutcomeChange(index, 'learning_outcome', e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical' }} />
                      </div>
                    </div>
                  ))}

                  <button onClick={handleAddOutcome} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#111827', fontWeight: 'bold', cursor: 'pointer', padding: '0.5rem 0' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Another Outcome
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#f9fafb', borderRadius: '0 0 8px 8px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ffffff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                Cancel
              </button>
              {modalStep === 1 ? (
                <button onClick={handleNextStep} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#111827', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Next: Add Competencies
                </button>
              ) : (
                <button onClick={handleSaveSpecification} disabled={isSubmitting} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#111827', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                  {isSubmitting ? 'Saving...' : 'Save Specification'}
                </button>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
