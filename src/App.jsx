import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from './supabase';
import { updateState, resetExercise, useStore } from './store';
import TimelineBuilder from './TimelineBuilder';
import Dashboard from './Dashboard';
import AssessorView from './AssessorView';
import UnifiedStreamer from './UnifiedStreamer';
import AssessorModeOverlay from './AssessorModeOverlay';
import { categoryMap } from './criteriaMap';
import Login from './Login';
import Layout from './Layout';

function TimelineNode({ node, isFacilitator, state, exerciseTimeSecs }) {
  // Determine status
  const isActive = state.activeNodeId === node.id;
  const isCompleted = state.completedNodes.includes(node.id);
  
  // Determine color category
  let nodeClass = 'node-standard';
  if (node.id === 'front-of-house' || node.id === 'mobilisation' || node.id === 'end-of-exercise') {
    nodeClass = 'node-start'; // Green
  }

  const handleClick = () => {
    if (!isFacilitator) return;
    
    // Calculate new completed nodes (everything before this node in the current path)
    // For simplicity in this demo, if they click a node, we just set it active.
    // A robust version would compute the path. We'll just add to history.
    const newCompleted = new Set(state.completedNodes);
    if (!newCompleted.has(node.id)) {
        newCompleted.add(node.id);
    }
    
    updateState({ activeNodeId: node.id, completedNodes: Array.from(newCompleted) });
  };

  let stateClass = '';
  if (isActive) stateClass = 'node-active';
  else if (isCompleted) stateClass = 'node-completed';

  let isDue = false;
  if (node.time && !isCompleted && !isActive) {
    const parts = node.time.split(':');
    if (parts.length === 2) {
      const nodeSecs = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60;
      if (exerciseTimeSecs >= nodeSecs) {
        isDue = true;
      }
    }
  }

  return (
    <div className={`timeline-node ${nodeClass} ${stateClass}`} onClick={handleClick} style={{ position: 'relative' }}>
      {isDue && <div className="node-due-arrow">DUE</div>}
      <div className="node-box">
        <div className="node-title">{node.title}</div>
        {node.time && <div className="node-time">{node.time}</div>}
        {node.length > 0 && <div className="node-length" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Length: {node.length} min</div>}
      </div>
      {node.rolePlayers && node.rolePlayers.length > 0 && (
        <div className="node-role-badge">
          {node.rolePlayers.join(', ')}
        </div>
      )}
    </div>
  );
}

function TimelineBranch({ branch, isFacilitator, state, exerciseTimeSecs }) {
  const options = branch.options || Object.values(branch.options || {});
  const choiceKey = branch.linkedId || branch.dependsOn || branch.id;
  // Determine if a choice was made for this branch
  const choiceId = state.decisions[choiceKey];

  return (
    <div className="timeline-branch-col">
      {options.map(opt => {
        // If conditional and not chosen, or branch and not chosen (but a choice exists)
        // we might dim it.
        const isNotChosen = choiceId && choiceId !== opt.id;
        return (
          <div key={opt.id} className="branch-option" style={{ opacity: isNotChosen ? 0.3 : 1 }}>
             <TimelineNode 
               node={opt} 
               isFacilitator={isFacilitator} 
               state={state} 
               exerciseTimeSecs={exerciseTimeSecs}
             />
             {isFacilitator && !choiceId && branch.type === 'branch' && (
                <button 
                  style={{
                    position: 'absolute', top: '-10px', right: '-10px',
                    background: 'var(--color-blue)', border: 'none', color: 'white',
                    borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', zIndex: 10
                  }}
                  onClick={() => {
                    const newDecisions = { ...state.decisions, [choiceKey]: opt.id };
                    // Set active
                    const newCompleted = new Set(state.completedNodes).add(opt.id);
                    updateState({ activeNodeId: opt.id, decisions: newDecisions, completedNodes: Array.from(newCompleted) });
                  }}
                >
                  ✓
                </button>
             )}
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ isFacilitator, state, visibleNodes, exerciseTimeSecs }) {
  const containerRef = React.useRef(null);



  // Auto-scroll logic based on activeNodeId
  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.querySelector('.node-active');
      if (activeEl) {
        // Scroll the active node into the center of the container
        const container = containerRef.current;
        const activeRect = activeEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft + (activeRect.left - containerRect.left) - (container.clientWidth / 2) + (activeRect.width / 2);
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [state.activeNodeId]);

  return (
    <div className="timeline-container" ref={containerRef}>
      <div className="timeline-track">
        {visibleNodes.map(item => {
          if (item.type === 'node') {
            return <TimelineNode key={item.id} node={item} isFacilitator={isFacilitator} state={state} exerciseTimeSecs={exerciseTimeSecs} />;
          } else if (item.type === 'branch') {
            return <TimelineBranch key={item.id} branch={item} isFacilitator={isFacilitator} state={state} exerciseTimeSecs={exerciseTimeSecs} />;
          } else if (item.type === 'conditional') {
            const decision = state.decisions[item.dependsOn];
            const chosenNode = item.options[decision];
            return <TimelineNode key={chosenNode.id} node={chosenNode} isFacilitator={isFacilitator} state={state} exerciseTimeSecs={exerciseTimeSecs} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

function SnippetView({ activeNode, visibleNodes, isFacilitator, state, exerciseTimeSecs }) {
  const [showCriteria, setShowCriteria] = useState(false);

  // Reset showCriteria when active node changes
  useEffect(() => {
    setShowCriteria(false);
  }, [activeNode?.id]);

  // Calculate Upcoming Injects
  let upcomingNodes = [];
  if (activeNode && visibleNodes) {
    const activeIndex = visibleNodes.findIndex(n => {
      if (n.type === 'node' || n.type === 'conditional') {
        const checkId = n.type === 'conditional' ? Object.values(n.options)[0].id : n.id;
        // In this simple check, we rely on the timeline structure.
        return n.id === activeNode.id || (n.options && Object.values(n.options).find(o => o.id === activeNode.id));
      } else if (n.type === 'branch') {
        return n.options.find(o => o.id === activeNode.id);
      }
      return false;
    });

    if (activeIndex !== -1 && activeIndex + 1 < visibleNodes.length) {
      upcomingNodes = visibleNodes.slice(activeIndex + 1, activeIndex + 3); // next 2 nodes
    }
  }

  return (
    <div className="snippet-view">
      <div className="snippet-main">
        {!activeNode ? (
          <div className="text-center" style={{ marginTop: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>Waiting for exercise to begin...</p>
          </div>
        ) : (
          <>
            <h2 className="snippet-title">{activeNode.title} {activeNode.time ? `(${activeNode.time})` : ''}</h2>
            {activeNode.length > 0 && <div style={{ marginBottom: '1rem', color: 'var(--color-blue)', fontWeight: 'bold' }}>Inject Length: {activeNode.length} minutes</div>}
            <div className="snippet-content">
              <ul>
                {activeNode.detail.map((line, idx) => (
                  <li key={idx}><strong>{line.split(':')[0]}</strong>{line.split(':')[1] ? `:${line.split(':')[1]}` : ''}</li>
                ))}
              </ul>
            </div>
            
            {activeNode.criteria && activeNode.criteria.length > 0 && (
              <div className="criteria-section">
                <button 
                  className="criteria-toggle"
                  onClick={() => setShowCriteria(!showCriteria)}
                >
                  {showCriteria ? '▼ Hide Assessment Criteria' : '▶ Show Assessment Criteria'}
                </button>
                {showCriteria && (
                  <div className="criteria-content">
                    {(() => {
                      // Group the node's criteria by category
                      const grouped = {};
                      activeNode.criteria.forEach(c => {
                        let foundCat = 'Other';
                        for (const [catName, catData] of Object.entries(categoryMap)) {
                          if (catData.items.includes(c)) {
                            foundCat = catName;
                            break;
                          }
                        }
                        if (!grouped[foundCat]) grouped[foundCat] = [];
                        grouped[foundCat].push(c);
                      });

                      return Object.entries(grouped).map(([catName, items]) => {
                        const catColor = categoryMap[catName]?.color || '#94a3b8';
                        return (
                          <div key={catName} style={{ marginBottom: '1.25rem' }}>
                            <h4 style={{ color: catColor, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                              {catName}
                            </h4>
                            <ul>
                              {items.map((c, idx) => (
                                <li key={idx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
            
            {upcomingNodes.length > 0 && (
              <div style={{ marginTop: '3rem' }}>
                <h3 className="upcoming-title">Coming Up Next</h3>
                {upcomingNodes.map((un, i) => {
                  if (un.type === 'node' || un.type === 'conditional') {
                    const node = un.type === 'conditional' ? Object.values(un.options)[0] : un;
                    let isDue = false;
                    if (node.time) {
                      const parts = node.time.split(':');
                      if (parts.length === 2) {
                        const nodeSecs = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60;
                        if (exerciseTimeSecs >= nodeSecs) isDue = true;
                      }
                    }
                    return (
                      <div key={node.id} className="upcoming-card" style={isDue ? { borderColor: 'var(--color-red)', backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, color: 'var(--text-main)' }}>{node.title} {node.time ? `(${node.time})` : ''}</h4>
                          {isDue && <span style={{ backgroundColor: 'var(--color-red)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', animation: 'pulseActive 1.5s infinite' }}>DUE NOW</span>}
                        </div>
                        <ul>{node.detail.slice(0, 2).map((d, idx) => <li key={idx}>{d}</li>)}</ul>
                      </div>
                    );
                  } else if (un.type === 'branch') {
                    return (
                      <div key={un.id} className="upcoming-card" style={{ borderColor: 'var(--color-red)' }}>
                        <h4 style={{ color: 'var(--color-red)' }}>DECISION POINT</h4>
                        <ul>
                          {un.options.map(opt => (
                            <li key={opt.id}><strong>{opt.title}:</strong> {opt.detail[1]}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function LiveSession() {
  const { code, role } = useParams();
  const navigate = useNavigate();
  const auth = { code, role };
  const { state, timelineData, session, isLoading, error } = useStore(auth?.code);
  const [exerciseTimeSecs, setExerciseTimeSecs] = useState(15 * 3600 + 22 * 60); // 15:22:00
  const [isAssessorMode, setIsAssessorMode] = useState(false);
  const [isLocalBroadcasting, setIsLocalBroadcasting] = useState(false);
  const [globalBroadcastState, setGlobalBroadcastState] = useState(false);

  // Initialize state once session loads
  useEffect(() => {
    if (session) {
      setGlobalBroadcastState(!!session.active_broadcaster_id);
    }
  }, [session?.active_broadcaster_id]);

  // Strict database listener that NEVER drops when session updates
  useEffect(() => {
    if (!auth?.code) return;

    const channel = supabase
      .channel('schema-db-changes-header-' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'exercise_sessions', filter: `code=eq.${auth.code}` }, 
        (payload) => {
          // Immediately update the UI text and flip 'No Broadcast' to 'Live'
          setGlobalBroadcastState(!!payload.new.active_broadcaster_id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [auth?.code]);

  const isBroadcasterOnline = globalBroadcastState || isLocalBroadcasting;

  const getBaseTimeSecs = () => {
    if (session?.template?.start_clock_time) {
      const parts = session.template.start_clock_time.split(':');
      if (parts.length === 2) {
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60;
      }
    }
    return 15 * 3600 + 22 * 60; // fallback to 15:22:00
  };

  useEffect(() => {
    let interval;
    if (state && state.isClockRunning && state.clockStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.clockStartTime) / 1000);
        setExerciseTimeSecs(getBaseTimeSecs() + elapsed);
      }, 1000);
    } else {
      setExerciseTimeSecs(getBaseTimeSecs());
    }
    return () => clearInterval(interval);
  }, [state?.isClockRunning, state?.clockStartTime, session?.template?.start_clock_time]);

  if (!auth.code || !auth.role) {
    return <Navigate to="/join" />;
  }

  if (isLoading) {
    return (
      <div className="flex-col" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Loading Session...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-col" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-red)' }}>Error</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/join')}>Back to Dashboard</button>
      </div>
    );
  }

  if (auth.role === 'assessor') {
    return <AssessorView session={{ ...session, code: auth.code }} timelineData={timelineData} onBack={() => navigate('/join')} />;
  }

  const isFacilitator = auth.role === 'facilitator';

  // Find active node data
  let activeNodeData = null;
  if (state.activeNodeId) {
    const findNode = (id, items) => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.options) {
            const opts = Array.isArray(item.options) ? item.options : Object.values(item.options);
            for(const o of opts) {
                if (o.id === id) return o;
            }
        }
      }
      return null;
    };
    activeNodeData = findNode(state.activeNodeId, timelineData || []);
  }

  // Filter timeline based on decisions for conditional nodes
  const visibleNodes = (timelineData || []).filter(item => {
    if (item.type === 'conditional') {
      const decision = state.decisions[item.dependsOn];
      if (!decision) return false; // Hide until decision is made
      return !!item.options[decision]; // Only show if this option was chosen
    }
    return true;
  });

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getNodeSecs = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60;
    }
    return 0;
  };

  const getUpcomingRolePlayers = () => {
    const upcoming = [];
    for (const node of (timelineData || [])) {
      if (node.type === 'node' && node.rolePlayers && node.rolePlayers.length > 0 && node.time) {
        if (!state.completedNodes.includes(node.id)) {
          const nodeSecs = getNodeSecs(node.time);
          upcoming.push({ node, secondsUntil: nodeSecs - exerciseTimeSecs });
        }
      }
    }
    return upcoming.sort((a, b) => a.secondsUntil - b.secondsUntil);
  };
  const upcomingRPs = getUpcomingRolePlayers();

  const formatCountdown = (secs) => {
    const isNegative = secs < 0;
    const absSecs = Math.abs(secs);
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    const s = absSecs % 60;
    const timeStr = `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return isNegative ? `+${timeStr} (Overdue)` : timeStr;
  };

  return (
    <div className="flex-col" style={{ minHeight: '100vh', display: 'flex' }}>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="role-badge" style={{ backgroundColor: isFacilitator ? 'var(--color-blue)' : 'var(--color-green)' }}>
            {isFacilitator ? 'Facilitator' : 'Viewer'}
          </div>
          <span className="code-text" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Code: {auth.code}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', opacity: isBroadcasterOnline ? 1 : 0.3, transition: 'opacity 0.3s' }}>
              {isBroadcasterOnline ? '🔴' : '⚪'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {isBroadcasterOnline ? 'Live' : 'No Broadcast'}
            </span>
          </div>

          {isBroadcasterOnline && (
            <button 
              className={`btn ${isAssessorMode ? 'btn-primary' : ''}`} 
              onClick={() => setIsAssessorMode(true)}
              style={{ margin: 0, border: '1px solid var(--color-blue)', backgroundColor: isAssessorMode ? 'var(--color-blue)' : 'transparent', color: '#FFFFFF' }}
            >
              🎬 Cinematic Mode
            </button>
          )}

          {isFacilitator && (
            <button className="btn btn-danger" onClick={resetExercise} style={{ margin: 0 }}>
              Reset Exercise
            </button>
          )}
        </div>
      </header>

      {isAssessorMode && (
        <AssessorModeOverlay 
          exerciseCode={auth.code} 
          timelineData={timelineData} 
          isBroadcasterOnline={isBroadcasterOnline}
          state={state}
          exerciseTimeSecs={exerciseTimeSecs}
          upcomingRPs={upcomingRPs}
          formatCountdown={formatCountdown}
          onClose={() => setIsAssessorMode(false)}
        />
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Timeline isFacilitator={isFacilitator} state={state} visibleNodes={visibleNodes} exerciseTimeSecs={exerciseTimeSecs} />
        
        <div className="container main-layout" style={{ flex: 1, paddingBottom: '3rem' }}>
          {/* Left Panel: Clock */}
          <div className="panel-clock">
            <div className="clock-display">
              {formatTime(exerciseTimeSecs)}
            </div>
            {session?.template?.start_clock_node_id && activeNodeData?.id === session.template.start_clock_node_id && isFacilitator && !state.isClockRunning && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <button 
                  className="btn-start-clock" 
                  style={{ width: '100%', marginTop: 0 }}
                  onClick={() => updateState({ isClockRunning: true, clockStartTime: Date.now() })}
                >
                  START CLOCKS
                </button>
              </div>
            )}
            <UnifiedStreamer 
              exerciseCode={auth.code} 
              isBroadcasterOnline={isBroadcasterOnline}
              onBroadcastStateChange={setIsLocalBroadcasting} 
            />
          </div>

          {/* Middle Panel: Snippet View */}
          <div className="panel-snippet">
            <SnippetView activeNode={activeNodeData} visibleNodes={visibleNodes} isFacilitator={isFacilitator} state={state} exerciseTimeSecs={exerciseTimeSecs} />
          </div>

          {/* Right Panel: Role Players */}
          <div className="panel-roles">
            <div className="role-panel" style={{ padding: 0, backgroundColor: 'transparent', boxShadow: 'none' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.2rem', textAlign: 'center' }}>Upcoming Role Players</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {upcomingRPs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    No upcoming role players.
                  </div>
                ) : (
                  upcomingRPs.map((rp, index) => {
                    const isNext = index === 0;
                    const isOverdue = rp.secondsUntil < 0;
                    return (
                      <div key={rp.node.id} style={{
                        padding: isNext ? '1.5rem' : '1rem',
                        backgroundColor: 'var(--bg-panel)',
                        borderRadius: '8px',
                        border: isNext ? (isOverdue ? '2px solid var(--color-red)' : '2px solid var(--color-blue)') : '1px solid var(--border-color)',
                        boxShadow: isNext ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, color: 'var(--text-muted)', fontSize: isNext ? '0.9rem' : '0.8rem', textTransform: 'uppercase' }}>
                            {rp.node.title} {rp.node.time ? `(${rp.node.time})` : ''}
                          </h4>
                          <div style={{
                            fontSize: isNext ? '1.5rem' : '1.1rem',
                            fontWeight: 'bold',
                            color: isOverdue ? 'var(--color-red)' : (isNext ? 'var(--color-blue)' : 'var(--text-main)')
                          }}>
                            {formatCountdown(rp.secondsUntil)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {rp.node.rolePlayers.map(name => (
                            <div key={name} style={{
                              backgroundColor: isNext ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-page)',
                              border: isNext ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border-color)',
                              padding: isNext ? '0.5rem 0.75rem' : '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: isNext ? '0.95rem' : '0.85rem',
                              fontWeight: isNext ? 600 : 500,
                              color: isNext ? 'var(--color-blue)' : 'var(--text-main)'
                            }}>
                              {name}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardWrapper({ initialTab }) {
  const navigate = useNavigate();
  return <Dashboard initialTab={initialTab} onLogin={(data) => navigate(`/session/${data.code}/${data.role}`)} />;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Unauthenticated Routes */}
        {!session ? (
          <Route path="*" element={<Login />} />
        ) : (
          /* Authenticated Routes */
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/join" replace />} />
            <Route path="/login" element={<Navigate to="/join" replace />} />
            <Route path="/join" element={<DashboardWrapper initialTab="join" />} />
            <Route path="/library" element={<DashboardWrapper initialTab="library" />} />
            <Route path="/admin" element={<TimelineBuilder />} />
            <Route path="/session/:code/:role" element={<LiveSession />} />
            <Route path="*" element={<Navigate to="/join" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
