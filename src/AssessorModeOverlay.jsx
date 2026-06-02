import React, { useState, useRef, useEffect } from 'react';

export default function AssessorModeOverlay({ exerciseCode, timelineData, isBroadcasterOnline, state, exerciseTimeSecs, upcomingRPs, formatCountdown, onClose }) {
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const cinematicVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    // Find the existing active video element on the page (from the UnifiedStreamer mounted in the main layout)
    const existingVideos = document.querySelectorAll('video');
    let activeStream = null;
    
    // Find the one that actually has a srcObject
    for (let i = 0; i < existingVideos.length; i++) {
      if (existingVideos[i].srcObject && existingVideos[i] !== cinematicVideoRef.current) {
        activeStream = existingVideos[i].srcObject;
        break;
      }
    }

    if (activeStream && cinematicVideoRef.current) {
      cinematicVideoRef.current.srcObject = activeStream;
      cinematicVideoRef.current.muted = isMuted;
    }
  }, []);

  useEffect(() => {
    if (cinematicVideoRef.current) {
      cinematicVideoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      zIndex: 99999, // Super high z-index
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      overflow: 'hidden'
    }}>
      
      {/* Top Bar (Close button & Status) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h2 style={{ color: 'white', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Assessor Cinematic Mode</h2>
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            style={{ 
              background: 'rgba(255,255,255,0.2)', 
              border: '1px solid rgba(255,255,255,0.5)', 
              color: 'white', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'white', fontWeight: 'bold' }}>
             {formatCountdown && exerciseTimeSecs ? formatCountdown(exerciseTimeSecs) : ''}
          </span>
          <button className="btn btn-danger" onClick={onClose} style={{ margin: 0 }}>Exit Mode</button>
        </div>
      </div>

      {/* Video Container */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        backgroundColor: '#000'
      }}>
        <video 
          ref={cinematicVideoRef} 
          autoPlay 
          playsInline 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
        />
      </div>

      {/* HUD Container for Timeline and Sidebar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'row',
        zIndex: 10
      }}>
        
        {/* Left/Center Area (Timeline at bottom) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%',
            pointerEvents: 'auto',
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
            padding: '2rem 1rem 1rem 1rem',
            position: 'relative'
          }}>
            <style>
              {`
                .cinematic-scroll::-webkit-scrollbar {
                  height: 10px;
                }
                .cinematic-scroll::-webkit-scrollbar-track {
                  background: rgba(0, 0, 0, 0.3);
                  border-radius: 5px;
                }
                .cinematic-scroll::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.3);
                  border-radius: 5px;
                }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgba(255, 255, 255, 0.5);
                }
              `}
            </style>

            <div className="cinematic-scroll" style={{ display: 'flex', overflowX: 'auto', gap: '0.75rem', alignItems: 'flex-end', minHeight: '200px', paddingBottom: '0.5rem' }}>
              {(timelineData || []).filter(n => n.type === 'node').map((node, index) => {
                const isExpanded = expandedNodeId === node.id;
                const isLive = state?.activeNodeId === node.id;
                return (
                  <div 
                    key={node.id} 
                    onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                    style={{
                      flex: '0 0 auto',
                      width: isExpanded ? '300px' : '150px',
                      backgroundColor: isLive ? 'rgba(30, 40, 60, 0.9)' : 'rgba(20, 20, 30, 0.8)',
                      border: isLive ? '2px solid var(--color-blue)' : (isExpanded ? '1px solid var(--color-blue)' : '1px solid rgba(255,255,255,0.2)'),
                      borderRadius: '8px',
                      padding: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      backdropFilter: 'blur(4px)',
                      boxShadow: isLive ? '0 0 15px rgba(59, 130, 246, 0.6)' : (isExpanded ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'),
                      transform: (isExpanded || isLive) ? 'translateY(-10px)' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: isLive ? 'white' : 'var(--color-blue)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Inject {index + 1}</span>
                      {isLive && <span style={{ color: 'var(--color-yellow)' }}>● LIVE</span>}
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {node.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-yellow)', marginTop: '0.25rem' }}>{node.time || '--:--'}</div>

                    {(isExpanded || isLive) && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', flex: 1, overflowY: 'auto' }}>
                        {node.rolePlayers && node.rolePlayers.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Roles:</strong>
                            <div style={{ fontSize: '0.8rem', color: 'white' }}>{node.rolePlayers.join(', ')}</div>
                          </div>
                        )}
                        {node.detail && (
                          <div>
                            <strong style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Details:</strong>
                            <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0', fontSize: '0.8rem', color: 'white' }}>
                              {node.detail.map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar for Upcoming Role Players */}
        {showSidebar && (
          <div style={{
            width: '350px',
            height: '100%',
            backgroundColor: 'rgba(15, 15, 20, 0.85)',
            backdropFilter: 'blur(10px)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            padding: '5rem 1rem 1rem 1rem', // pad top to clear the top bar
            overflowY: 'auto',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            position: 'relative'
          }}>
            <button 
              onClick={() => setShowSidebar(false)}
              style={{
                position: 'absolute',
                top: '5rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              ✕
            </button>
            <h3 style={{ color: 'white', margin: '0 0 1rem 0', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', paddingRight: '2rem' }}>Upcoming Role Players</h3>
          
          {(!upcomingRPs || upcomingRPs.length === 0) ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginTop: '2rem' }}>No upcoming role players.</div>
          ) : (
            upcomingRPs.map((rp, index) => {
              const isNext = index === 0;
              const isOverdue = rp.secondsUntil < 0;
              return (
                <div key={rp.node.id} style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  border: isNext ? (isOverdue ? '2px solid var(--color-red)' : '2px solid var(--color-blue)') : '1px solid rgba(255,255,255,0.1)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      {rp.node.title}
                    </h4>
                    <div style={{
                      fontSize: isNext ? '1.2rem' : '1rem',
                      fontWeight: 'bold',
                      color: isOverdue ? 'var(--color-red)' : (isNext ? 'var(--color-blue)' : 'white')
                    }}>
                      {formatCountdown ? formatCountdown(rp.secondsUntil) : rp.secondsUntil}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {rp.node.rolePlayers.map(name => (
                      <div key={name} style={{
                        backgroundColor: isNext ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.1)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: 'white'
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
        )}
        
        {/* Toggle Button for Sidebar when hidden */}
        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            style={{
              position: 'absolute',
              top: '50%',
              right: '0',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(15, 15, 20, 0.85)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRight: 'none',
              color: 'white',
              padding: '1rem 0.5rem',
              borderTopLeftRadius: '8px',
              borderBottomLeftRadius: '8px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              backdropFilter: 'blur(4px)',
              zIndex: 20
            }}
          >
            ◀ Role Players
          </button>
        )}
      </div>

    </div>
  );
}
