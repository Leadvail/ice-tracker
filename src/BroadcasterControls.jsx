import React, { useState, useEffect, useRef } from 'react';
import { Broadcaster } from './WebRTCManager';

export default function BroadcasterControls({ exerciseCode }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [broadcaster, setBroadcaster] = useState(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  
  const videoRef = useRef(null);

  useEffect(() => {
    return () => {
      if (broadcaster) broadcaster.stop();
    };
  }, [broadcaster]);

  useEffect(() => {
    if (isStreaming && videoRef.current && broadcaster?.localStream) {
      videoRef.current.srcObject = broadcaster.localStream;
    }
  }, [isStreaming, broadcaster]);

  const toggleStream = async () => {
    if (isStreaming) {
      broadcaster.stop();
      setBroadcaster(null);
      setIsStreaming(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const bc = new Broadcaster(exerciseCode, stream);
        await bc.start();
        setBroadcaster(bc);
        setIsStreaming(true);
        setHasVideo(true);
        setHasAudio(true);
      } catch (err) {
        alert("Failed to access camera/microphone: " + err.message);
      }
    }
  };

  const toggleVideo = () => {
    if (broadcaster && broadcaster.localStream) {
      const videoTrack = broadcaster.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setHasVideo(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (broadcaster && broadcaster.localStream) {
      const audioTrack = broadcaster.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setHasAudio(audioTrack.enabled);
      }
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Live Broadcast</h3>
        <button 
          className={`btn ${isStreaming ? 'btn-danger' : 'btn-primary'}`} 
          onClick={toggleStream}
          style={{ margin: 0 }}
        >
          {isStreaming ? 'Stop Broadcast' : 'Start Broadcast'}
        </button>
      </div>
      
      {isStreaming && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ width: '200px', height: '150px', backgroundColor: '#000', borderRadius: '8px', objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn" onClick={toggleVideo}>
              {hasVideo ? 'Turn Off Camera' : 'Turn On Camera'}
            </button>
            <button className="btn" onClick={toggleAudio}>
              {hasAudio ? 'Mute Mic' : 'Unmute Mic'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
