import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import Header from './Header';
import Sidebar from './Sidebar';

export default function CompetencyFrameworkMatrix({ session }) {
  const navigate = useNavigate();
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';

  const [sortMode, setSortMode] = useState('Training Specification'); // 'Course Code', 'Not Mapped', 'Training Specification'
  const [courseCodes, setCourseCodes] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  
  const [policies, setPolicies] = useState([]);
  const [viewData, setViewData] = useState([]); // from view_competency_counts
  const [localFrameworkData, setLocalFrameworkData] = useState([]); // from competency_framework (for filters)
  const [activeOutcomes, setActiveOutcomes] = useState([]); // from targeted Col 3 fetch
  const [notMappedCount, setNotMappedCount] = useState(0);
  
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  // Initial Fetch (Policies & Dropdowns)
  useEffect(() => {
    const initFetch = async () => {
      const { data: polData } = await supabase.from('policies').select('*').order('policy_number', { ascending: true });
      if (polData) setPolicies(polData);

      const { data: courseData } = await supabase.from('course_details').select('course_code');
      if (courseData) {
        const uniqueCodes = [...new Set(courseData.map(c => c.course_code).filter(Boolean))].sort();
        setCourseCodes(uniqueCodes);
        if (uniqueCodes.length > 0) setSelectedCourseCode(uniqueCodes[0]);
      }

      const { data: notMappedData } = await supabase
        .from('competency_framework')
        .select('id')
        .or('is_acquired.is.null,is_acquired.eq."",is_acquired.eq.empty');
      if (notMappedData) {
        setNotMappedCount(notMappedData.length);
      }
    };
    
    initFetch();
  }, []);

  // Fetch Framework Data based on Sort Mode
  useEffect(() => {
    const fetchFrameworkData = async () => {
      setIsLoading(true);
      setSelectedPolicyId(null);
      setSelectedElement(null);
      setActiveOutcomes([]);

      try {
        if (sortMode === 'Training Specification') {
          const { data } = await supabase.from('view_competency_counts').select('*');
          setViewData(data || []);
          setLocalFrameworkData([]);
        } 
        else if (sortMode === 'Not Mapped') {
          const { data } = await supabase
            .from('competency_framework')
            .select('*')
            .or('is_acquired.is.null,is_acquired.eq."",is_acquired.eq.empty')
            .range(0, 2500);
          setLocalFrameworkData(data || []);
          setViewData([]);
        }
        else if (sortMode === 'Course Code' && selectedCourseCode) {
          const { data: cData } = await supabase
            .from('course_details')
            .select('title')
            .eq('course_code', selectedCourseCode);
          
          if (cData && cData.length > 0) {
            let ids = [];
            cData.forEach(row => {
              if (!row.title) return;
              try {
                const parsed = JSON.parse(row.title);
                if (Array.isArray(parsed)) ids.push(...parsed);
                else ids.push(row.title);
              } catch (e) {
                ids.push(...row.title.split(',').map(s => s.trim()));
              }
            });
            ids = [...new Set(ids)];
            
            if (ids.length > 0) {
              const { data } = await supabase
                .from('competency_framework')
                .select('*')
                .in('id', ids)
                .range(0, 2500);
              setLocalFrameworkData(data || []);
            } else {
              setLocalFrameworkData([]);
            }
          } else {
            setLocalFrameworkData([]);
          }
          setViewData([]);
        }
      } catch (err) {
        console.error("Error fetching framework data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFrameworkData();
  }, [sortMode, selectedCourseCode]);

  // Targeted Precision Fetch for Column 3 (Training Specification Mode)
  useEffect(() => {
    const fetchActiveOutcomes = async () => {
      if (sortMode === 'Training Specification' && selectedPolicyId && selectedElement) {
        const { data } = await supabase
          .from('competency_framework')
          .select('id, learning_heading, learning_objective, learning_outcome')
          .eq('policy_id', selectedPolicyId)
          .eq('element_title', selectedElement === '[Unassigned]' ? null : selectedElement);
        setActiveOutcomes(data || []);
      }
    };
    fetchActiveOutcomes();
  }, [sortMode, selectedPolicyId, selectedElement]);

  // Derived Data for Columns
  
  // Column 1: Active Policies
  const activePolicies = useMemo(() => {
    const policyMap = {};
    policies.forEach(p => policyMap[p.policy_number.trim().toUpperCase()] = { ...p, count: 0 });
    
    if (sortMode === 'Training Specification') {
      viewData.forEach(row => {
        const pId = row.policy_id?.toString().trim().toUpperCase();
        if (pId && policyMap[pId]) {
          policyMap[pId].count += parseInt(row.total_outcomes || 0, 10);
        }
      });
    } else {
      localFrameworkData.forEach(row => {
        const pId = row.policy_id?.toString().trim().toUpperCase();
        if (pId && policyMap[pId]) {
          policyMap[pId].count += 1;
        }
      });
    }

    return Object.values(policyMap).filter(p => p.count > 0 || sortMode === 'Training Specification').sort((a, b) => a.id - b.id);
  }, [policies, viewData, localFrameworkData, sortMode]);

  // Column 2: Elements for selected policy
  const activeElements = useMemo(() => {
    if (!selectedPolicyId) return [];
    
    const elementMap = {};
    if (sortMode === 'Training Specification') {
      if (!viewData) return [];
      const filtered = viewData.filter(r => r.policy_id?.toString().trim().toUpperCase() === selectedPolicyId.trim().toUpperCase());
      filtered.forEach(row => {
        const title = row.element_title?.trim() || '[Unassigned]';
        const currentId = row.min_id || row.id || Infinity; 

        if (!elementMap[title]) {
          elementMap[title] = {
            title: title,
            sortingId: currentId,
            count: 0
          };
        }
        elementMap[title].count += parseInt(row.total_outcomes || 0, 10);
        if (currentId < elementMap[title].sortingId) {
          elementMap[title].sortingId = currentId;
        }
      });
    } else {
      if (!localFrameworkData) return [];
      const filtered = localFrameworkData.filter(r => r.policy_id?.toString().trim().toUpperCase() === selectedPolicyId.trim().toUpperCase());
      filtered.forEach(row => {
        const title = row.element_title?.trim() || '[Unassigned]';
        const currentId = row.id || Infinity;
        
        if (!elementMap[title]) {
          elementMap[title] = { title: title, sortingId: currentId, count: 0 };
        }
        elementMap[title].count += 1;
        if (currentId < elementMap[title].sortingId) {
          elementMap[title].sortingId = currentId;
        }
      });
    }

    // 3. Convert back to an array and force sort by the numerical sortingId in ascending order
    return Object.values(elementMap).sort((a, b) => a.sortingId - b.sortingId);
  }, [viewData, localFrameworkData, selectedPolicyId, sortMode]);

  // Column 3: Objectives for selected element
  const activeObjectives = useMemo(() => {
    if (!selectedPolicyId || !selectedElement) return [];
    
    const normalizeHeading = (str) => {
      if (!str) return 'Unassigned';
      const lower = str.trim().toLowerCase();
      if (lower === 'knowledge and understanding') return 'Knowledge and Understanding';
      if (lower === 'practical application') return 'Practical Application';
      return str.trim(); // Leaves custom headers perfectly intact
    };

    const byHeading = {};

    let relevantRows = [];
    if (sortMode === 'Training Specification') {
      // activeOutcomes is precision-fetched
      relevantRows = activeOutcomes;
    } else {
      // Memory filter
      relevantRows = localFrameworkData.filter(r => 
        r.policy_id?.toString().trim().toUpperCase() === selectedPolicyId.trim().toUpperCase() && 
        (r.element_title?.trim().toUpperCase() || '[UNASSIGNED]') === selectedElement.trim().toUpperCase()
      );
    }

    relevantRows.forEach(row => {
      const h = normalizeHeading(row.learning_heading);
      if (!byHeading[h]) byHeading[h] = {};
      
      const obj = row.learning_objective?.trim() || '[Unassigned]';
      if (!byHeading[h][obj]) byHeading[h][obj] = { count: 0, minId: Infinity };
      byHeading[h][obj].count += 1;
      
      const idToUse = row.min_id || row.id || Infinity;
      if (idToUse < byHeading[h][obj].minId) {
        byHeading[h][obj].minId = idToUse;
      }
    });

    return byHeading;
  }, [localFrameworkData, activeOutcomes, selectedPolicyId, selectedElement, sortMode]);

  const chevronIcon = (
    <div style={{ color: '#9ca3af', fontSize: '2.5rem', fontWeight: '300', display: 'flex', alignItems: 'center' }}>
      &gt;
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      <Header />

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        <Sidebar session={session} />

        {/* Main Content Workspace */}
        <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', backgroundColor: '#F9FAFB', overflow: 'hidden' }}>
          
          {/* Header Area */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#111827', fontWeight: 700 }}>Competency Framework</h1>
            {notMappedCount > 0 && (
              <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '1rem', fontStyle: 'italic' }}>
                {notMappedCount} Learning outcomes not mapped
              </div>
            )}
          </div>
          {/* Columns Area */}
          <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
            
            {/* Column 1: Policy Selector */}
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxSizing: 'border-box', padding: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: '#111827', marginBottom: '0.2rem', fontWeight: 'bold' }}>Sort by:</div>
                <select 
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #111827', color: '#111827', fontSize: '1rem', marginBottom: '0.5rem', borderRadius: '4px' }}
                >
              <option value="Training Specification">Training Specification</option>
              <option value="Course Code">Course Code</option>
              <option value="Not Mapped">Not Mapped</option>
            </select>

            {sortMode === 'Course Code' && (
              <select
                value={selectedCourseCode}
                onChange={(e) => setSelectedCourseCode(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '2px solid #003399', color: '#111827', fontSize: '1rem' }}
              >
                {courseCodes.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="cinematic-scroll">
            {isLoading ? (
              <div style={{ color: '#374151', fontStyle: 'italic', padding: '1rem' }}>Loading data...</div>
            ) : activePolicies.length === 0 ? (
              <div style={{ color: '#374151', fontStyle: 'italic', padding: '1rem' }}>No matching policies found.</div>
            ) : (
              activePolicies.map(policy => {
                const isActive = selectedPolicyId === policy.policy_number;
                return (
                  <div 
                    key={policy.policy_number}
                    onClick={() => {
                      setSelectedPolicyId(policy.policy_number);
                      setSelectedElement(null);
                    }}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      borderLeft: isActive ? '4px solid #111827' : '4px solid transparent',
                      borderBottom: '1px solid #f1f3f5',
                      backgroundColor: isActive ? '#F9FAFB' : 'transparent',
                    }}
                  >
                    <div style={{ color: '#374151', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{policy.policy_number}</div>
                    <div style={{ color: '#111827', fontSize: '0.95rem', marginBottom: '0.5rem' }}>{policy.policy_name}</div>
                    <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.9rem' }}>
                      Total Outcomes: {policy.count}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {chevronIcon}

        {/* Column 2: Learning Element (Hazard) */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxSizing: 'border-box', padding: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#111827' }}>Learning Element (Hazard):</h2>
          
          <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="cinematic-scroll">
            {!selectedPolicyId ? (
              <div style={{ color: '#374151', fontStyle: 'italic', padding: '1rem' }}>Select a policy to view elements.</div>
            ) : activeElements.length === 0 ? (
              <div style={{ color: '#374151', fontStyle: 'italic', padding: '1rem' }}>No elements mapped for this policy.</div>
            ) : (
              activeElements.map(el => {
                const isActive = selectedElement === el.title;
                return (
                  <div 
                    key={el.title}
                    onClick={() => setSelectedElement(el.title)}
                    style={{
                      padding: '1rem 0.75rem',
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      borderLeft: isActive ? '4px solid #111827' : '4px solid transparent',
                      borderBottom: '1px solid #e9ecef',
                      backgroundColor: isActive ? '#F9FAFB' : 'transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ color: '#111827', fontSize: '1.05rem', marginBottom: '0.5rem' }}>{el.title}</div>
                      <div style={{ color: '#374151', fontSize: '0.95rem' }}>
                        Total Outcomes: {el.count}
                      </div>
                    </div>
                    <span style={{ color: '#374151', fontSize: '1.2rem' }}>&gt;</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {chevronIcon}

        {/* Column 3: Learning Objectives (Control Measures) */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxSizing: 'border-box', padding: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#111827' }}>Learning Objectives (Control Measures):</h2>
          
          <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="cinematic-scroll">
            {!selectedElement ? (
              <div style={{ color: '#374151', fontStyle: 'italic', padding: '1rem' }}>Select an element to view objectives.</div>
            ) : (
              <div style={{ padding: '0.5rem 1rem' }}>
                {Object.keys(activeObjectives)
                  .sort((a, b) => {
                    if (a === 'Knowledge and Understanding') return -1;
                    if (b === 'Knowledge and Understanding') return 1;
                    if (a === 'Practical Application') return -1;
                    if (b === 'Practical Application') return 1;
                    return a.localeCompare(b);
                  })
                  .map(heading => {
                  const objectives = activeObjectives[heading];
                  const objKeys = Object.keys(objectives).sort((a, b) => (objectives[a].minId || 0) - (objectives[b].minId || 0));
                  if (objKeys.length === 0) return null;

                  const displayHeading = heading === 'Knowledge and Understanding' 
                    ? 'Knowledge and understanding' 
                    : heading === 'Practical Application'
                    ? 'Practical application'
                    : heading;

                  return (
                    <React.Fragment key={heading}>
                      {objKeys.map(objTitle => {
                        const qs = `?policy=${encodeURIComponent(selectedPolicyId)}&element=${encodeURIComponent(selectedElement)}&objective=${encodeURIComponent(objTitle)}`;
                        return (
                          <div 
                            key={objTitle} 
                            onClick={() => navigate(`/competency-framework/objective${qs}`)}
                            style={{ marginBottom: '1.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '4px' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ color: '#374151', fontSize: '1rem', marginBottom: '0.5rem' }}>
                              {displayHeading}
                            </div>
                            <div style={{ color: '#111827', fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                              {objTitle}
                            </div>
                            <div style={{ color: '#374151', fontSize: '0.95rem', marginBottom: '1rem' }}>
                              Total Outcomes: {objectives[objTitle].count}
                            </div>
                            <div style={{ height: '3px', backgroundColor: '#F3F4F6', width: '100%', borderRadius: '2px' }}></div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

          </div>
        </div>
      </div>

      <style>
        {`
          .cinematic-scroll::-webkit-scrollbar { width: 8px; }
          .cinematic-scroll::-webkit-scrollbar-track { background: #f1f3f5; border-radius: 4px; }
          .cinematic-scroll::-webkit-scrollbar-thumb { background: #ced4da; border-radius: 4px; }
          .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #adb5bd; }
        `}
      </style>
    </div>
  );
}
