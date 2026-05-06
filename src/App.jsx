import React, { useState, useEffect } from 'react';
import { updateState, resetExercise, useStore } from './store';
import Dashboard from './Dashboard';
import AssessorView from './AssessorView';
import { categoryMap } from './criteriaMap';

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

export default function App() {
  const [auth, setAuth] = useState(null);
  const { state, timelineData, session, isLoading, error } = useStore(auth?.code);
  const [exerciseTimeSecs, setExerciseTimeSecs] = useState(15 * 3600 + 22 * 60); // 15:22:00

  useEffect(() => {
    let interval;
    if (state && state.isClockRunning && state.clockStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.clockStartTime) / 1000);
        setExerciseTimeSecs((15 * 3600 + 22 * 60) + elapsed);
      }, 1000);
    } else {
      setExerciseTimeSecs(15 * 3600 + 22 * 60);
    }
    return () => clearInterval(interval);
  }, [state?.isClockRunning, state?.clockStartTime]);

  if (!auth) {
    return <Dashboard onLogin={setAuth} />;
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
        <button className="btn btn-primary" onClick={() => setAuth(null)}>Back to Dashboard</button>
      </div>
    );
  }

  if (auth.role === 'assessor') {
    return <AssessorView session={{ ...session, code: auth.code }} timelineData={timelineData} onBack={() => setAuth(null)} />;
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

  // Calculate Role Players
  const rolePlayerMap = {};
  (timelineData || []).forEach(item => {
    const processNode = (n) => {
      if (n.rolePlayers) {
        n.rolePlayers.forEach(rp => {
          if (!rolePlayerMap[rp]) rolePlayerMap[rp] = [];
          rolePlayerMap[rp].push(n.title);
        });
      }
    };
    if (item.type === 'node') processNode(item);
    if (item.options) {
      Object.values(item.options).forEach(processNode);
    }
  });

  return (
    <div className="flex-col" style={{ minHeight: '100vh', display: 'flex' }}>
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="role-badge" style={{ backgroundColor: isFacilitator ? 'var(--color-blue)' : 'var(--color-green)' }}>
            {isFacilitator ? 'Facilitator' : 'Viewer'}
          </div>
          <span className="code-text" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Code: {auth.code}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isFacilitator && (
            <button className="btn btn-danger" onClick={resetExercise}>
              Reset Exercise
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Timeline isFacilitator={isFacilitator} state={state} visibleNodes={visibleNodes} exerciseTimeSecs={exerciseTimeSecs} />
        
        <div className="container main-layout" style={{ flex: 1, paddingBottom: '3rem' }}>
          {/* Left Panel: Clock */}
          <div className="panel-clock">
            <div className="clock-display">
              {formatTime(exerciseTimeSecs)}
            </div>
            {activeNodeData?.id === 'handover' && isFacilitator && !state.isClockRunning && (
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
          </div>

          {/* Middle Panel: Snippet View */}
          <div className="panel-snippet">
            <SnippetView activeNode={activeNodeData} visibleNodes={visibleNodes} isFacilitator={isFacilitator} state={state} exerciseTimeSecs={exerciseTimeSecs} />
          </div>

          {/* Right Panel: Role Players */}
          <div className="panel-roles">
            <div className="role-panel">
              <h3>Role Players</h3>
              <div className="role-list">
                {Object.entries(rolePlayerMap).map(([rp, injects]) => (
                  <div key={rp} className="role-item">
                    <span className="role-name">{rp}</span>
                    <span className="role-injects">{Array.from(new Set(injects)).join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
