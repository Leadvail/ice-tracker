import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import Header from './Header';
import Sidebar from './Sidebar';

// Helper to parse query params
function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function ObjectiveMatrix({ session }) {
  const navigate = useNavigate();
  const query = useQuery();
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';

  const policy = query.get('policy') || '';
  const element = query.get('element') || '';
  const objective = query.get('objective') || '';

  const [outcomes, setOutcomes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [siblingObjectives, setSiblingObjectives] = useState([]);

  useEffect(() => {
    const fetchSiblingObjectives = async () => {
      let queryBuilder = supabase
        .from('competency_framework')
        .select('id, learning_objective')
        .eq('policy_id', policy.trim());
        
      if (element === '[Unassigned]') {
        queryBuilder = queryBuilder.is('element_title', null);
      } else {
        queryBuilder = queryBuilder.ilike('element_title', `%${element.trim()}%`);
      }
      
      const { data } = await queryBuilder;
      if (data) {
        const objMap = {};
        data.forEach(row => {
          const objTitle = row.learning_objective?.trim() || '[Unassigned]';
          if (!objMap[objTitle] || row.id < objMap[objTitle]) {
            objMap[objTitle] = row.id;
          }
        });
        const sorted = Object.entries(objMap).sort((a,b) => a[1] - b[1]).map(x => x[0]);
        setSiblingObjectives(sorted);
      }
    };
    if (policy && element) fetchSiblingObjectives();
  }, [policy, element]);

  // Modal State
  const [editingRow, setEditingRow] = useState(null);
  const [editState, setEditState] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchOutcomes = async () => {
    setIsLoading(true);
    try {
      let queryBuilder = supabase
        .from('competency_framework')
        .select('*')
        .eq('policy_id', policy.trim())
        .order('id', { ascending: true });

      if (element === '[Unassigned]') {
        queryBuilder = queryBuilder.is('element_title', null);
      } else {
        queryBuilder = queryBuilder.ilike('element_title', `%${element.trim()}%`);
      }

      if (objective === '[Unassigned]') {
        queryBuilder = queryBuilder.is('learning_objective', null);
      } else {
        queryBuilder = queryBuilder.ilike('learning_objective', `%${objective.trim()}%`);
      }

      const { data } = await queryBuilder;
        
      setOutcomes(data || []);
    } catch (err) {
      console.error("Error fetching outcomes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutcomes();
  }, [policy, element, objective]);

  const openModal = (row) => {
    setEditingRow(row);
    setEditState({
      ff: row.ff || 'N/A',
      lff: row.lff || 'N/A',
      sub: row.sub || 'N/A',
      stno: row.stno || 'N/A',
      sc: row.sc || 'N/A',
      gc: row.gc || 'N/A',
      dac: row.dac || 'N/A',
      bpa: row.bpa || null,
      damop: row.damop || null,
      mos: row.mos || null,
      cpd: row.cpd || null,
      bau: row.bau || null
    });
  };

  const closeModal = () => {
    setEditingRow(null);
    setEditState({});
  };

  const currentObjIndex = siblingObjectives.findIndex(o => o.toLowerCase() === objective.toLowerCase());
  const hasPrev = currentObjIndex > 0;
  const hasNext = currentObjIndex !== -1 && currentObjIndex < siblingObjectives.length - 1;

  const navigateToObjective = (direction) => {
    if (direction === -1 && hasPrev) {
      navigate(`?policy=${encodeURIComponent(policy)}&element=${encodeURIComponent(element)}&objective=${encodeURIComponent(siblingObjectives[currentObjIndex - 1])}`);
    } else if (direction === 1 && hasNext) {
      navigate(`?policy=${encodeURIComponent(policy)}&element=${encodeURIComponent(element)}&objective=${encodeURIComponent(siblingObjectives[currentObjIndex + 1])}`);
    }
  };

  const toggleRefresh = (field) => {
    setEditState(prev => ({
      ...prev,
      [field]: prev[field] ? null : 'Active'
    }));
  };

  const handleSave = async () => {
    if (!editingRow) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('competency_framework')
        .update({
          ff: editState.ff,
          lff: editState.lff,
          sub: editState.sub,
          stno: editState.stno,
          sc: editState.sc,
          gc: editState.gc,
          dac: editState.dac,
          bpa: editState.bpa,
          damop: editState.damop,
          mos: editState.mos,
          cpd: editState.cpd,
          bau: editState.bau
        })
        .eq('id', editingRow.id);
        
      if (error) throw error;
      
      // Update local state instantly
      setOutcomes(prev => prev.map(o => o.id === editingRow.id ? { ...o, ...editState } : o));
      closeModal();
    } catch (err) {
      console.error("Failed to save outcome:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getRankColor = (val) => {
    const s = (val || '').toLowerCase().trim();
    if (s === 'acquired') return '#e7f5ff'; // Soft Blue
    if (s === 'enhanced') return '#fff3bf'; // Soft Amber
    if (s === 'maintained') return '#ebfbee'; // Soft Green
    return '#F9FAFB'; // Light Gray (N/A)
  };

  const getRankTextColor = (val) => {
    const s = (val || '').toLowerCase().trim();
    if (s === 'acquired') return '#005fcc';
    if (s === 'enhanced') return '#e67700';
    if (s === 'maintained') return '#2b8a3e';
    return '#374151';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      <Header />

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        <Sidebar session={session} />

        {/* Main Content Workspace */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#F9FAFB', overflowY: 'auto' }}>
          
          <div style={{ padding: '2rem' }}>
            {/* Header Area */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate('/competency-framework')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#111827' }} title="Back to Competency Framework">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </button>
                <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#111827', fontWeight: 700 }}>Competency Framework</h1>
              </div>
            </div>

            {/* Breadcrumbs / Header Info */}
            <div style={{ padding: '2rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>Training Specification:</span> <span style={{ color: '#374151' }}>{policy.trim()}</span>
            </div>
            <div style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>Learning Element:</span> <span style={{ color: '#374151' }}>{element.trim()}</span>
            </div>
            {outcomes.length > 0 && outcomes[0].learning_heading && (
              <div style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                <span style={{ fontWeight: 'bold', color: '#111827' }}>Learning Heading:</span> 
                <span style={{ 
                  color: outcomes[0].learning_heading.trim().toLowerCase() === 'knowledge and understanding' ? '#111827' : 
                         outcomes[0].learning_heading.trim().toLowerCase() === 'practical application' ? '#111827' : '#374151',
                  fontWeight: (outcomes[0].learning_heading.trim().toLowerCase() === 'knowledge and understanding' || 
                               outcomes[0].learning_heading.trim().toLowerCase() === 'practical application') ? 'bold' : 'normal',
                  marginLeft: '0.3rem'
                }}>
                  {outcomes[0].learning_heading.trim()}
                </span>
              </div>
            )}
            <div style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>Learning Objective:</span> 
              <button 
                onClick={() => navigateToObjective(-1)}
                disabled={!hasPrev}
                style={{ 
                  background: 'none', border: 'none', cursor: hasPrev ? 'pointer' : 'default',
                  color: hasPrev ? '#111827' : '#ccc', padding: '0', display: 'flex', alignItems: 'center'
                }}
                title="Previous Objective"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <span style={{ color: '#111827', fontWeight: 'bold' }}>{objective.trim()}</span>
              <button 
                onClick={() => navigateToObjective(1)}
                disabled={!hasNext}
                style={{ 
                  background: 'none', border: 'none', cursor: hasNext ? 'pointer' : 'default',
                  color: hasNext ? '#111827' : '#ccc', padding: '0', display: 'flex', alignItems: 'center'
                }}
                title="Next Objective"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {/* Kept empty to maintain flex layout structure if needed in the future */}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.5rem' }}>
          Learning Outcomes:
        </div>
        {isLoading ? (
          <div style={{ fontSize: '1.2rem', color: '#374151' }}>Loading outcomes...</div>
        ) : outcomes.length === 0 ? (
          <div style={{ fontSize: '1.2rem', color: '#374151' }}>No outcomes found for this objective.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {outcomes.map(row => (
              <div key={row.id} style={{ display: 'flex', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e9ecef' }}>
                
                {/* Left Side: Outcome Text & Edit Button */}
                <div style={{ flex: '0 0 40%', padding: '1.5rem', borderRight: '4px solid #003399', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '1.1rem', color: '#111827', fontWeight: '500', paddingRight: '1rem' }}>
                    {row.learning_outcome || '[No Outcome Text]'}
                  </div>
                  <button 
                    onClick={() => openModal(row)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#003399', padding: '0.5rem' }}
                    title="Edit Assign Learning Linkages"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </button>
                </div>

                {/* Right Side: Ranks Grid */}
                <div style={{ flex: 1, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                  {['ff', 'lff', 'sub', 'stno', 'sc', 'gc', 'dac'].map(rank => (
                    <div key={rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold', color: '#374151', fontSize: '0.9rem' }}>{rank.toUpperCase()}</div>
                      <div style={{ 
                        padding: '0.5rem 1rem', 
                        borderRadius: '4px', 
                        backgroundColor: getRankColor(row[rank]),
                        color: getRankTextColor(row[rank]),
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        minWidth: '80px',
                        textAlign: 'center',
                        border: '1px solid rgba(0,0,0,0.05)'
                      }}>
                        {row[rank] || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>



      {/* Assignment Edit Modal */}
      {editingRow && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem'
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '1000px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column'
          }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827' }}>
                  Learning Outcome: 
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </h2>
                <div style={{ fontSize: '1.1rem', color: '#111827', maxWidth: '600px', fontWeight: '500' }}>
                  {editingRow.learning_outcome}
                </div>
              </div>
              <button 
                onClick={closeModal}
                style={{ backgroundColor: '#00205b', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
              >
                Exit
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Top Section: Ranks */}
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '2px solid #e9ecef', paddingBottom: '0.5rem', color: '#111827' }}>Acquisition:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  {['ff', 'lff', 'sub', 'stno', 'sc', 'gc', 'dac'].map(rank => (
                    <div key={rank} style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#111827' }}>{rank.toUpperCase()}</label>
                      <select 
                        value={editState[rank] || 'N/A'}
                        onChange={(e) => setEditState({...editState, [rank]: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '2px solid #003399', fontSize: '1rem', color: '#111827', backgroundColor: '#fff' }}
                      >
                        <option value="N/A">N/A</option>
                        <option value="Acquired">Acquired</option>
                        <option value="Enhanced">Enhanced</option>
                        <option value="Maintained">Maintained</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle Section: TFA Box */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#F9FAFB', padding: '1.5rem', borderRadius: '4px', border: '1px solid #dee2e6' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#111827' }}>Training Frequency Assessment:</div>
                  {/* Empty placeholder fields as requested */}
                  <div style={{ flex: 1, height: '40px', backgroundColor: '#fff', border: '1px dashed #ced4da', borderRadius: '4px' }}></div>
                  <div style={{ flex: 1, height: '40px', backgroundColor: '#fff', border: '1px dashed #ced4da', borderRadius: '4px' }}></div>
                </div>
              </div>

              {/* Bottom Section: Refresh Toggles */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', borderTop: '2px solid #e9ecef', paddingTop: '2rem' }}>
                  {[
                    { key: 'bpa', label: 'BPA' },
                    { key: 'damop', label: 'DaMOP' },
                    { key: 'mos', label: 'MoS' },
                    { key: 'cpd', label: 'CPD' },
                    { key: 'bau', label: 'BAU' }
                  ].map(toggle => {
                    const isActive = !!editState[toggle.key];
                    return (
                      <button
                        key={toggle.key}
                        onClick={() => toggleRefresh(toggle.key)}
                        style={{
                          padding: '1rem 2rem',
                          borderRadius: '8px',
                          border: 'none',
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          cursor: 'pointer',
                          minWidth: '120px',
                          transition: 'all 0.2s',
                          backgroundColor: isActive ? '#e67700' : '#F3F4F6',
                          color: isActive ? '#fff' : '#374151',
                          boxShadow: isActive ? '0 4px 6px rgba(230,119,0,0.2)' : 'none'
                        }}
                      >
                        {toggle.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.5rem 2rem', backgroundColor: '#F9FAFB', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={closeModal}
                style={{ padding: '0.75rem 2rem', borderRadius: '4px', border: '1px solid #ced4da', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                style={{ padding: '0.75rem 2.5rem', borderRadius: '4px', border: 'none', backgroundColor: '#008a00', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Updates'}
              </button>
            </div>

          </div>
        </div>
      )}

          </div>
        </div>
      </div>
    </div>
  );
}
