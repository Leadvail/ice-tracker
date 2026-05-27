import { supabase } from './supabase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

export class Broadcaster {
  constructor(exerciseCode, localStream) {
    this.exerciseCode = exerciseCode;
    this.localStream = localStream;
    this.peers = {}; // Map of receiverId -> RTCPeerConnection
    this.channel = null;
    this.broadcasterId = 'broadcaster-' + Math.random().toString(36).substr(2, 9);
  }

  async start() {
    try {
      await supabase
        .from('exercise_sessions')
        .update({ active_broadcaster_id: this.broadcasterId })
        .eq('code', this.exerciseCode);
    } catch (err) {
      console.error("Failed to update active broadcaster id", err);
    }

    this.channel = supabase.channel(`webrtc-${this.exerciseCode}`, {
      config: { broadcast: { self: false } }
    });

    this.presenceChannel = supabase.channel(`webrtc-presence-${this.exerciseCode}`, {
      config: { presence: { key: 'broadcaster' } }
    });

    this.channel.on('broadcast', { event: 'webrtc' }, async (payload) => {
      const msg = payload.payload;
      if (msg.type === 'join') {
        await this.handleJoin(msg.sender);
      } else if (msg.type === 'answer' && msg.target === this.broadcasterId) {
        await this.handleAnswer(msg.sender, msg.answer);
      } else if (msg.type === 'candidate' && msg.target === this.broadcasterId) {
        await this.handleCandidate(msg.sender, msg.candidate);
      }
    });

    await this.channel.subscribe();
    await this.presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.presenceChannel.track({ isBroadcaster: true });
      }
    });

    // Broadcast an announcement so any existing receivers know we are live
    this.channel.send({
      type: 'broadcast',
      event: 'webrtc',
      payload: { type: 'broadcaster_live', sender: this.broadcasterId }
    });
  }

  async handleJoin(receiverId) {
    if (this.peers[receiverId]) {
      this.peers[receiverId].close();
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    this.peers[receiverId] = peer;

    // Add local tracks
    this.localStream.getTracks().forEach(track => {
      peer.addTrack(track, this.localStream);
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.channel.send({
          type: 'broadcast',
          event: 'webrtc',
          payload: { type: 'candidate', target: receiverId, sender: this.broadcasterId, candidate: event.candidate }
        });
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    this.channel.send({
      type: 'broadcast',
      event: 'webrtc',
      payload: { type: 'offer', target: receiverId, sender: this.broadcasterId, offer }
    });
  }

  async handleAnswer(receiverId, answer) {
    const peer = this.peers[receiverId];
    if (peer) {
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleCandidate(receiverId, candidate) {
    const peer = this.peers[receiverId];
    if (peer) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  async replaceStream(newStream) {
    this.localStream = newStream;
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0];

    Object.values(this.peers).forEach(peer => {
      const senders = peer.getSenders();
      
      if (newVideoTrack) {
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack);
        } else {
          peer.addTrack(newVideoTrack, this.localStream);
        }
      }
      
      if (newAudioTrack) {
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(newAudioTrack);
        } else {
          peer.addTrack(newAudioTrack, this.localStream);
        }
      }
    });
  }

  stop() {
    Object.values(this.peers).forEach(peer => peer.close());
    this.peers = {};
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.presenceChannel) {
      this.presenceChannel.untrack();
      this.presenceChannel.unsubscribe();
      this.presenceChannel = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
    }
  }
}

export class ReceiverManager {
  constructor(exerciseCode, onTrack) {
    this.exerciseCode = exerciseCode;
    this.receiverId = 'receiver-' + Math.random().toString(36).substr(2, 9);
    this.onTrack = onTrack;
    this.peer = null;
    this.channel = null;
    this.broadcasterId = null;
    this.sessionChannel = null;
  }

  async start() {
    try {
      const { data } = await supabase
        .from('exercise_sessions')
        .select('active_broadcaster_id')
        .eq('code', this.exerciseCode)
        .single();
      
      if (data && data.active_broadcaster_id) {
        this.broadcasterId = data.active_broadcaster_id;
      }
    } catch (err) {
      console.error("Failed to fetch initial active broadcaster", err);
    }

    this.sessionChannel = supabase.channel(`session-${this.exerciseCode}`)
      .on('postgres', {
        event: 'UPDATE',
        schema: 'public',
        table: 'exercise_sessions',
        filter: `code=eq.${this.exerciseCode}`
      }, (payload) => {
        const newId = payload.new.active_broadcaster_id;
        if (newId && newId !== this.broadcasterId) {
          this.broadcasterId = newId;
          this.join();
        }
      })
      .subscribe();

    this.channel = supabase.channel(`webrtc-${this.exerciseCode}`, {
      config: { broadcast: { self: false } }
    });

    this.channel.on('broadcast', { event: 'webrtc' }, async (payload) => {
      const msg = payload.payload;
      
      // If the broadcaster announces they are live (e.g. they restarted the stream), we rejoin
      if (msg.type === 'broadcaster_live') {
        this.join();
      } else if (msg.type === 'offer' && msg.target === this.receiverId) {
        this.broadcasterId = msg.sender;
        await this.handleOffer(msg.offer);
      } else if (msg.type === 'candidate' && msg.target === this.receiverId) {
        await this.handleCandidate(msg.candidate);
      }
    });

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.join();
      }
    });
  }

  join() {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    // Announce presence to trigger an offer from the broadcaster
    this.channel.send({
      type: 'broadcast',
      event: 'webrtc',
      payload: { type: 'join', sender: this.receiverId }
    });
  }

  async handleOffer(offer) {
    this.peer = new RTCPeerConnection(ICE_SERVERS);
    
    this.peer.ontrack = (event) => {
      if (this.onTrack) {
        this.onTrack(event.streams[0]);
      }
    };

    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.channel.send({
          type: 'broadcast',
          event: 'webrtc',
          payload: { type: 'candidate', target: this.broadcasterId, sender: this.receiverId, candidate: event.candidate }
        });
      }
    };

    await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);

    this.channel.send({
      type: 'broadcast',
      event: 'webrtc',
      payload: { type: 'answer', target: this.broadcasterId, sender: this.receiverId, answer }
    });
  }

  async handleCandidate(candidate) {
    if (this.peer) {
      await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  stop() {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.sessionChannel) {
      this.sessionChannel.unsubscribe();
      this.sessionChannel = null;
    }
  }
}
