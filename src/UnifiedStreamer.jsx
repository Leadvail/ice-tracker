import React, { useState, useEffect, useRef } from 'react';
import { Broadcaster, ReceiverManager } from './WebRTCManager';

export default function UnifiedStreamer({ exerciseCode, isBroadcasterOnline, onBroadcastStateChange }) {
  const [mode, setMode] = useState('idle'); // 'idle', 'broadcasting', 'receiving'
  const [scale, setScale] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [remoteStream, setRemoteStream] = useState(null); // the video stream state
  
  useEffect(() => {
    if (onBroadcastStateChange) {
      onBroadcastStateChange(mode === 'broadcasting');
    }
  }, [mode, onBroadcastStateChange]);
  
  // Device Selection State
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedAudioId, setSelectedAudioId] = useState('');

  const [manager, setManager] = useState(null);
  const videoRef = useRef(null);

  // Stop everything on unmount
  useEffect(() => {
    return () => {
      if (manager) manager.stop();
    };
  }, [manager]);

  // Handle stream attachment and volume
  useEffect(() => {
    if (videoRef.current) {
      if (mode === 'broadcasting' && manager?.localStream) {
        videoRef.current.srcObject = manager.localStream;
        videoRef.current.volume = 0; // Don't hear ourselves
      } else if (mode === 'receiving' && remoteStream) {
        videoRef.current.srcObject = remoteStream;
      }
      videoRef.current.muted = isMuted;
    }
  }, [mode, manager, isMuted, remoteStream]);

  // If the remote broadcaster stops, kick us out of 'receiving' mode
  useEffect(() => {
    if (!isBroadcasterOnline && mode === 'receiving') {
      if (manager) manager.stop();
      setManager(null);
      setMode('idle');
      alert('The broadcast has ended.');
    }
  }, [isBroadcasterOnline, mode, manager]);

  const fetchDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  const startBroadcast = async () => {
    if (window.confirm("Are you sure you want to broadcast your camera and microphone to the entire exercise?")) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        const currentVideo = stream.getVideoTracks()[0];
        const currentAudio = stream.getAudioTracks()[0];
        if (currentVideo) setSelectedVideoId(currentVideo.getSettings().deviceId);
        if (currentAudio) setSelectedAudioId(currentAudio.getSettings().deviceId);

        const bc = new Broadcaster(exerciseCode, stream);
        await bc.start();
        setManager(bc);
        setMode('broadcasting');
        setHasVideo(true);
        setHasAudio(true);
        fetchDevices();
      } catch (err) {
        alert("Failed to access camera/microphone: " + err.message);
      }
    }
  };

  const handleDeviceChange = async (type, deviceId) => {
    if (type === 'video') setSelectedVideoId(deviceId);
    if (type === 'audio') setSelectedAudioId(deviceId);
    
    const vId = type === 'video' ? deviceId : selectedVideoId;
    const aId = type === 'audio' ? deviceId : selectedAudioId;

    try {
      if (manager?.localStream) {
        manager.localStream.getTracks().forEach(t => t.stop());
      }
      const constraints = {
        video: vId ? { deviceId: { exact: vId } } : true,
        audio: aId ? { deviceId: { exact: aId } } : true,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      if (manager) {
        manager.replaceStream(newStream);
      }
    } catch (err) {
      console.error("Error switching device", err);
    }
  };

  const stopBroadcast = () => {
    if (manager) manager.stop();
    setManager(null);
    setMode('idle');
  };

  const watchStream = () => {
    const rc = new ReceiverManager(exerciseCode, (newStream) => {
      setRemoteStream(newStream); // Assigning it to the video stream state
    });
    rc.start();
    setManager(rc);
    setMode('receiving');
  };

  const toggleVideo = () => {
    if (mode === 'broadcasting' && manager?.localStream) {
      const videoTrack = manager.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setHasVideo(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (mode === 'broadcasting' && manager?.localStream) {
      const audioTrack = manager.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setHasAudio(audioTrack.enabled);
      }
    }
  };

  return (
    <div className="card" style={{ marginTop: '1rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>
          {mode === 'broadcasting' ? '🔴 Live (Broadcasting)' : mode === 'receiving' ? '🔴 Live Stream' : 'Live Stream'}
        </h3>
        
        {/* Scaling Controls */}
        {(mode === 'broadcasting' || mode === 'receiving') && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className="btn" style={{ padding: '0.2rem 0.5rem', margin: 0 }} onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>-</button>
            <button className="btn" style={{ padding: '0.2rem 0.5rem', margin: 0 }} onClick={() => setScale(s => s + 0.2)}>+</button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {mode === 'idle' && (
        <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-dark)', borderRadius: '8px' }}>
          {isBroadcasterOnline ? (
            <div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>An exercise broadcast is currently live.</p>
              <button className="btn btn-primary" onClick={watchStream}>Watch Stream</button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No active broadcast.</p>
              <button className="btn" onClick={startBroadcast}>Start Broadcast</button>
            </div>
          )}
        </div>
      )}

      {(mode === 'broadcasting' || mode === 'receiving') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted={isMuted || mode === 'broadcasting'}
            style={{ 
              width: `${100 * scale}%`, 
              marginLeft: `${100 - (100 * scale)}%`,
              backgroundColor: '#000', 
              borderRadius: '8px', 
              objectFit: 'cover',
              transition: 'all 0.3s ease'
            }}
          />
          
          {mode === 'broadcasting' && (
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', fontSize: '0.8rem' }}>
              <select 
                className="input" 
                style={{ flex: 1, padding: '0.25rem' }} 
                value={selectedVideoId} 
                onChange={(e) => handleDeviceChange('video', e.target.value)}
              >
                {videoDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                ))}
              </select>
              <select 
                className="input" 
                style={{ flex: 1, padding: '0.25rem' }} 
                value={selectedAudioId} 
                onChange={(e) => handleDeviceChange('audio', e.target.value)}
              >
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
            {mode === 'broadcasting' && (
              <>
                <button className="btn btn-danger" onClick={stopBroadcast} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', margin: 0 }}>Stop</button>
                <button className="btn" onClick={toggleVideo} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', margin: 0 }}>
                  {hasVideo ? 'Stop Camera' : 'Start Camera'}
                </button>
                <button className="btn" onClick={toggleAudio} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', margin: 0 }}>
                  {hasAudio ? 'Mute Mic' : 'Unmute Mic'}
                </button>
              </>
            )}
            
            {mode === 'receiving' && (
              <button className={`btn ${isMuted ? 'btn-danger' : 'btn-primary'}`} onClick={() => setIsMuted(!isMuted)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', margin: 0 }}>
                {isMuted ? 'Unmute Audio' : 'Mute Audio'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
