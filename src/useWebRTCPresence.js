import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function useWebRTCPresence(exerciseCode) {
  const [isBroadcasterOnline, setIsBroadcasterOnline] = useState(false);

  useEffect(() => {
    if (!exerciseCode) return;

    const channel = supabase.channel(`webrtc-presence-${exerciseCode}`, {
      config: { presence: { key: 'watcher' } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      // Check if any presence object has isBroadcaster: true
      let foundBroadcaster = false;
      for (const id in state) {
        if (state[id].some(p => p.isBroadcaster)) {
          foundBroadcaster = true;
          break;
        }
      }
      setIsBroadcasterOnline(foundBroadcaster);
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [exerciseCode]);

  return isBroadcasterOnline;
}
