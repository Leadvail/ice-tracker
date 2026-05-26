import React, { useState, useRef, useEffect } from 'react';

export default function AssessorModeOverlay({ exerciseCode, timelineData, isBroadcasterOnline, onClose }) {
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const cinematicVideoRef = useRef(null);

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
    }
  }, []);

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
        <h2 style={{ color: 'white', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Assessor Cinematic Mode</h2>
        <button className="btn btn-danger" onClick={onClose} style={{ margin: 0 }}>Exit Mode</button>
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

      {/* Bottom Timeline Overlay */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
        padding: '2rem 1rem 1rem 1rem',
        display: 'flex',
        overflowX: 'auto',
        gap: '0.5rem',
        alignItems: 'flex-end',
        minHeight: '200px'
      }}>
        {(timelineData || []).filter(n => n.type === 'node').map((node, index) => {
          const isExpanded = expandedNodeId === node.id;
          return (
            <div 
              key={node.id} 
              onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
              style={{
                flex: '0 0 auto',
                width: isExpanded ? '300px' : '120px',
                backgroundColor: 'rgba(20, 20, 30, 0.8)',
                border: '1px solid var(--color-blue)',
                borderRadius: '8px',
                padding: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(4px)',
                boxShadow: isExpanded ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
                transform: isExpanded ? 'translateY(-10px)' : 'none'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--color-blue)', fontWeight: 'bold' }}>Inject {index + 1}</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-yellow)', marginTop: '0.25rem' }}>{node.time || '--:--'}</div>

              {isExpanded && (
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
  );
}
