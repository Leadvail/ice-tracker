import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import './TFA_Mobile.css';

export default function TFALanding({ session }) {
  const navigate = useNavigate();
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';

  // Data State
  const [policies, setPolicies] = useState([]);
  const [frameworkData, setFrameworkData] = useState([]);
  const [tfaData, setTfaData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selection State (Persisted in sessionStorage)
  const [selectedPolicyId, setSelectedPolicyId] = useState(() => sessionStorage.getItem('tfa_selected_policy_id') || null);
  const [selectedElement, setSelectedElement] = useState(() => sessionStorage.getItem('tfa_selected_element') || null);

  useEffect(() => {
    if (selectedPolicyId) sessionStorage.setItem('tfa_selected_policy_id', selectedPolicyId);
    else sessionStorage.removeItem('tfa_selected_policy_id');
  }, [selectedPolicyId]);

  useEffect(() => {
    if (selectedElement) sessionStorage.setItem('tfa_selected_element', selectedElement);
    else sessionStorage.removeItem('tfa_selected_element');
  }, [selectedElement]);

  // Fetch all required data on mount
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // Fetch policies
        const { data: polData } = await supabase.from('policies').select('*').order('id', { ascending: true });
        
        // Comprehensive paginated fetch pipeline for competency_framework
        let allFramework = [];
        let fwPage = 0;
        const fwPageSize = 1000;
        let fwKeepFetching = true;

        while (fwKeepFetching) {
          const fromRange = fwPage * fwPageSize;
          const toRange = fromRange + fwPageSize - 1;

          const { data, error } = await supabase
            .from('competency_framework')
            .select('id, policy_id, element_title, learning_heading, learning_objective, learning_outcome')
            .range(fromRange, toRange);

          if (error) throw error;

          if (data && data.length > 0) {
            allFramework = [...allFramework, ...data];
            if (data.length < fwPageSize) {
              fwKeepFetching = false;
            } else {
              fwPage++;
            }
          } else {
            fwKeepFetching = false;
          }
        }
        
        console.log(`Successfully aggregated ${allFramework.length} framework records over pagination boundaries.`);

        // Comprehensive paginated fetch pipeline for tfa_assessments
        let allAssessments = [];
        let page = 0;
        const pageSize = 1000;
        let keepFetching = true;

        while (keepFetching) {
          const fromRange = page * pageSize;
          const toRange = fromRange + pageSize - 1;

          const { data, error } = await supabase
            .from('view_tfa_v2_panel_analytics')
            .select('*')
            .range(fromRange, toRange);

          if (error) throw error;

          if (data && data.length > 0) {
            allAssessments = [...allAssessments, ...data];
            // If we received fewer rows than the page size, we have hit the end of the table
            if (data.length < pageSize) {
              keepFetching = false;
            } else {
              page++;
            }
          } else {
            keepFetching = false;
          }
        }
        
        console.log(`Successfully aggregated ${allAssessments.length} assessment records over pagination boundaries.`);

        if (polData) setPolicies(polData);
        if (allFramework) setFrameworkData(allFramework);
        if (allAssessments) setTfaData(allAssessments);
        
      } catch (err) {
        console.error("Error fetching TFA dashboard data:", err);
        // Fallback: at least show policies even if TFA errors out
        const { data: fallbackPol } = await supabase.from('policies').select('*').order('id', { ascending: true });
        if (fallbackPol) setPolicies(fallbackPol);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Compute completed set for fast lookup
  const { completedIds } = useMemo(() => {
    const idSet = new Set();
    tfaData.forEach(row => {
      const count = Number(row.panel_count) || 0;
      const isComplete = count >= 1;
      
      if (isComplete) {
        // Safe string matching constraint
        const tfaCompId = row.comp_id != null ? row.comp_id.toString().trim() : null;
        if (tfaCompId) {
          idSet.add(tfaCompId);
        }
      }
    });
    return { completedIds: idSet };
  }, [tfaData]);

  // Derived Column 1: Active Policies with Completion Metrics
  const activePolicies = useMemo(() => {
    const policyMap = {};
    policies.forEach(p => {
      policyMap[(p.policy_number || '').toString().trim().toUpperCase()] = { 
        ...p, 
        totalOutcomes: 0, 
        completedOutcomes: 0 
      };
    });

    frameworkData.forEach(frameworkItem => {
      // Only count actual learning outcomes
      if (!frameworkItem.learning_outcome || frameworkItem.learning_outcome.trim() === '') return;

      const frameworkPolicy = (frameworkItem.policy_id || '').toString().trim().toUpperCase();
      
      // Safe string matching constraint
      const frameworkId = frameworkItem.id != null ? frameworkItem.id.toString().trim() : null;
      let isMatch = frameworkId ? completedIds.has(frameworkId) : false;

      if (frameworkPolicy && policyMap[frameworkPolicy]) {
        policyMap[frameworkPolicy].totalOutcomes += 1;
        if (isMatch) {
          policyMap[frameworkPolicy].completedOutcomes += 1;
        }
      }
    });

    return Object.values(policyMap).sort((a, b) => a.id - b.id);
  }, [policies, frameworkData, completedIds, tfaData]);

  // Derived Column 2: Elements for selected policy
  const activeElements = useMemo(() => {
    if (!selectedPolicyId) return [];
    
    const elementMap = {};
    const filtered = frameworkData.filter(r => r.policy_id?.toString().trim().toUpperCase() === selectedPolicyId.trim().toUpperCase());
    
    filtered.forEach(row => {
      // Only count actual learning outcomes
      if (!row.learning_outcome || row.learning_outcome.trim() === '') return;

      const title = row.element_title?.trim() || '[Unassigned]';
      const currentId = row.id || Infinity;

      if (!elementMap[title]) {
        elementMap[title] = {
          title: title,
          sortingId: currentId,
          totalOutcomes: 0,
          completedOutcomes: 0
        };
      }
      
      elementMap[title].totalOutcomes += 1;
      // Safe string matching constraint
      const frameworkId = row.id != null ? row.id.toString().trim() : null;
      let isMatch = frameworkId ? completedIds.has(frameworkId) : false;

      if (isMatch) {
        elementMap[title].completedOutcomes += 1;
      }
      
      if (currentId < elementMap[title].sortingId) {
        elementMap[title].sortingId = currentId;
      }
    });

    return Object.values(elementMap).sort((a, b) => a.sortingId - b.sortingId);
  }, [frameworkData, selectedPolicyId, completedIds]);

  // Derived Column 3: Objectives for selected element
  const activeObjectives = useMemo(() => {
    if (!selectedPolicyId || !selectedElement) return [];
    
    const normalizeHeading = (str) => {
      if (!str) return 'Unassigned';
      const lower = str.trim().toLowerCase();
      if (lower === 'knowledge and understanding') return 'Knowledge and Understanding';
      if (lower === 'practical application') return 'Practical Application';
      return str.trim();
    };

    const byHeading = {};
    const filtered = frameworkData.filter(r => 
      r.policy_id?.toString().trim().toUpperCase() === selectedPolicyId.trim().toUpperCase() && 
      (r.element_title?.trim().toUpperCase() || '[UNASSIGNED]') === selectedElement.trim().toUpperCase()
    );

    filtered.forEach(row => {
      // Only count actual learning outcomes
      if (!row.learning_outcome || row.learning_outcome.trim() === '') return;

      const h = normalizeHeading(row.learning_heading);
      if (!byHeading[h]) byHeading[h] = {};
      
      const obj = row.learning_objective?.trim() || '[Unassigned]';
      if (!byHeading[h][obj]) {
        byHeading[h][obj] = { 
          title: obj,
          totalOutcomes: 0, 
          completedOutcomes: 0,
          minId: Infinity 
        };
      }
      
      byHeading[h][obj].totalOutcomes += 1;
      // Safe string matching constraint
      const frameworkId = row.id != null ? row.id.toString().trim() : null;
      let isMatch = frameworkId ? completedIds.has(frameworkId) : false;

      if (isMatch) {
        byHeading[h][obj].completedOutcomes += 1;
      }
      
      if (row.id && row.id < byHeading[h][obj].minId) {
        byHeading[h][obj].minId = row.id;
      }
    });

    return byHeading;
  }, [frameworkData, selectedPolicyId, selectedElement, completedIds]);

  const chevronIcon = (
    <div style={{ color: '#003399', fontSize: '2.5rem', fontWeight: '300', display: 'flex', alignItems: 'center' }}>
      &gt;
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#F9FAFB', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* Top Header Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 2rem', height: '60px', backgroundColor: '#F9FAFB',
        borderBottom: '2px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#003399' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <h1 style={{ margin: 0, color: '#003399', fontSize: '1.4rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>
            Training Frequency Assessment
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#111827', fontSize: '0.95rem' }}>{userName}</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ccc' }}>
            <span style={{ fontSize: '1.3rem' }}>🧑‍🚒</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#374151' }}>
          Loading assessment data...
        </div>
      ) : (
        <div className="tfa-landing-container">
          
          {/* Column 1: Training Specification */}
          <div className="tfa-landing-col-left" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#111827' }}>
                Select Training Specification:
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activePolicies.map(pol => {
                const isActive = selectedPolicyId === pol.policy_number;
                const percentage = pol.totalOutcomes === 0 ? 0 : Math.round((pol.completedOutcomes / pol.totalOutcomes) * 100);
                const isComplete = percentage === 100;
                
                return (
                  <div key={pol.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <div 
                      onClick={() => {
                        setSelectedPolicyId(pol.policy_number);
                        setSelectedElement(null);
                      }}
                      style={{
                        flex: 1, padding: '1rem', cursor: 'pointer',
                        backgroundColor: isActive ? '#f8f9fa' : '#fff',
                        border: '1px solid #dee2e6',
                        borderLeft: isActive ? '4px solid #003399' : '1px solid #dee2e6',
                        boxShadow: isActive ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s', borderRadius: '4px'
                      }}
                    >
                      <div style={{ color: '#374151', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{pol.policy_number}</div>
                      <div style={{ color: '#111827', fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '0.5rem' }}>{pol.policy_title}</div>
                      <div style={{ 
                        color: isComplete ? '#16a34a' : '#b45309', 
                        fontWeight: 'bold', fontSize: '0.9rem' 
                      }}>
                        {percentage}% of framework complete
                      </div>
                    </div>
                    {isActive && chevronIcon}
                  </div>
                );
              })}
              
              {/* Back to Portal Button */}
              <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <button 
                  onClick={() => navigate('/')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#003399', fontWeight: 'bold', fontSize: '1rem'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  Back to Portal
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Learning Elements */}
          <div className="tfa-landing-col-mid" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#111827' }}>
                Select Training Element:
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {!selectedPolicyId ? (
                <div style={{ color: '#374151', fontStyle: 'italic' }}>Select a specification to view elements.</div>
              ) : activeElements.length === 0 ? (
                <div style={{ color: '#374151' }}>No elements found for this specification.</div>
              ) : (
                activeElements.map((el, idx) => {
                  const isActive = selectedElement === el.title;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                      <div 
                        onClick={() => setSelectedElement(el.title)}
                        style={{
                          flex: 1, padding: '1rem', cursor: 'pointer',
                          backgroundColor: isActive ? '#f8f9fa' : '#fff',
                          borderBottom: '1px solid #dee2e6',
                          borderLeft: isActive ? '4px solid #003399' : '4px solid transparent'
                        }}
                      >
                        <div style={{ color: '#111827', fontSize: '1.05rem' }}>{el.title}</div>
                      </div>
                      {isActive && chevronIcon}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Learning Objectives */}
          <div className="tfa-landing-col-right" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#111827' }}>
                Learning Objective:
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {!selectedElement ? (
                <div style={{ color: '#374151', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                  Select an element to view objectives.
                </div>
              ) : Object.keys(activeObjectives).length === 0 ? (
                <div style={{ color: '#374151' }}>No objectives found for this element.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {['Knowledge and Understanding', 'Practical Application', 'Unassigned'].map(heading => {
                    const objectives = activeObjectives[heading];
                    if (!objectives) return null;
                    
                    const objKeys = Object.keys(objectives).sort((a, b) => objectives[a].minId - objectives[b].minId);
                    if (objKeys.length === 0) return null;

                    const displayHeading = heading === 'Knowledge and Understanding' 
                      ? 'Knowledge and understanding' 
                      : heading === 'Practical Application' 
                        ? 'Practical application' 
                        : heading;

                    return (
                      <div key={heading} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {heading !== 'Unassigned' && (
                          <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '1rem', borderBottom: '2px solid #e9ecef', paddingBottom: '0.5rem' }}>
                            {displayHeading}
                          </div>
                        )}
                        
                        {objKeys.map((objTitle, idx) => {
                          const obj = objectives[objTitle];
                          const percentage = obj.totalOutcomes === 0 ? 0 : Math.round((obj.completedOutcomes / obj.totalOutcomes) * 100);
                          const isComplete = percentage === 100;
                          
                          return (
                            <div key={idx} style={{ 
                              padding: '1rem', backgroundColor: '#fff', border: '1px solid #dee2e6', 
                              borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ color: '#111827', fontWeight: 'bold', fontSize: '1.05rem', flex: 1, paddingRight: '1rem' }}>
                                  {obj.title}
                                </div>
                                <button 
                                  onClick={() => {
                                    navigate(`/tfa-workspace/${obj.minId}`);
                                  }}
                                  style={{
                                    backgroundColor: '#003399', color: '#fff', border: 'none', padding: '0.5rem 1rem', 
                                    borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem'
                                  }}
                                >
                                  Manage Assessments
                                </button>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ color: '#374151', fontSize: '0.95rem' }}>
                                  Total Learning Outcomes: {obj.totalOutcomes}
                                </div>
                                <div style={{ 
                                  color: isComplete ? '#16a34a' : '#b45309', 
                                  fontWeight: 'bold', fontSize: '0.95rem' 
                                }}>
                                  Progress: {percentage}% Complete
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
