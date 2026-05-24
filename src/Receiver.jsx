import React, { useState, useEffect, useRef } from 'react';
import { ReceiverManager } from './WebRTCManager';

export default function Receiver({ exerciseCode }) {
  const [stream, setStream] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const receiver = new ReceiverManager(exerciseCode, (newStream) => {
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    });

    receiver.start();

    return () => {
      receiver.stop();
    };
  }, [exerciseCode]);

  useEffect(() => {
    // Re-attach stream if state changes (e.g. un-hiding)
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isHidden, isFullscreen, stream]);

  // If there's no stream yet, we don't render anything
  if (!stream) return null;

  if (isHidden) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 9999,
        backgroundColor: 'var(--bg-panel)',
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Live Stream Hidden</span>
        <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', margin: 0 }} onClick={() => setIsHidden(false)}>
          Show
        </button>
      </div>
    );
  }

  const containerStyle = isFullscreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
    backgroundColor: '#000',
    display: 'flex',
    flexDirection: 'column'
  } : {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    width: '320px',
    zIndex: 9999,
    backgroundColor: 'var(--bg-panel)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    border: '2px solid var(--color-blue)'
  };

  return (
    <div style={containerStyle}>
      {/* Controls Bar */}
      <div style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '0.5rem', 
        backgroundColor: 'rgba(0,0,0,0.7)',
        position: isFullscreen ? 'absolute' : 'relative',
        top: 0,
        width: '100%',
        zIndex: 10
      }}>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
          🔴 LIVE
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', margin: 0, backgroundColor: 'transparent', color: 'white', border: '1px solid white' }}
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          {!isFullscreen && (
            <button 
              className="btn btn-danger" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', margin: 0 }}
              onClick={() => setIsHidden(true)}
            >
              Hide
            </button>
          )}
        </div>
      </div>
      
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: isFullscreen ? '100%' : '180px',
          objectFit: isFullscreen ? 'contain' : 'cover',
          backgroundColor: '#000'
        }}
      />
    </div>
  );
}
