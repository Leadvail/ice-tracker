import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const defaultState = {
  activeNodeId: null,
  decisions: {},
  completedNodes: [],
  isClockRunning: false,
  clockStartTime: null,
};

let globalState = { ...defaultState };
let currentExerciseCode = null;

const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(globalState));
};

export const updateState = async (newState) => {
  globalState = { ...globalState, ...newState };
  notifyListeners();
  
  if (currentExerciseCode) {
    try {
      await supabase
        .from('exercises')
        .upsert({ id: currentExerciseCode, state: globalState });
    } catch (err) {
      console.error("Failed to sync state to Supabase", err);
    }
  }
};

export const resetExercise = async () => {
  globalState = { ...defaultState };
  notifyListeners();
  
  if (currentExerciseCode) {
    try {
      await supabase
        .from('exercises')
        .upsert({ id: currentExerciseCode, state: globalState });
    } catch (err) {
      console.error("Failed to reset state in Supabase", err);
    }
  }
};

export const useStore = (exerciseCode) => {
  const [state, setState] = useState(globalState);

  useEffect(() => {
    if (!exerciseCode) return;
    
    currentExerciseCode = exerciseCode;
    
    // Add component listener
    const handleStateChange = (newState) => setState(newState);
    listeners.add(handleStateChange);

    let channel;

    const setupSupabase = async () => {
      // 1. Fetch initial state
      const { data, error } = await supabase
        .from('exercises')
        .select('state')
        .eq('id', exerciseCode)
        .single();
        
      if (data && data.state) {
        globalState = data.state;
        notifyListeners();
      } else if (error && error.code === 'PGRST116') {
        // Create initial row if it doesn't exist
        await supabase
          .from('exercises')
          .insert({ id: exerciseCode, state: defaultState });
      }

      // 2. Subscribe to realtime changes
      channel = supabase.channel(`public:exercises:id=eq.${exerciseCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'exercises', filter: `id=eq.${exerciseCode}` },
          (payload) => {
            if (payload.new && payload.new.state) {
              globalState = payload.new.state;
              notifyListeners();
            }
          }
        )
        .subscribe();
    };

    setupSupabase();

    return () => {
      listeners.delete(handleStateChange);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [exerciseCode]);

  return state;
};
