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
let globalTimelineData = null;

const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener({ state: globalState, timelineData: globalTimelineData }));
};

export const updateState = async (newState) => {
  globalState = { ...globalState, ...newState };
  notifyListeners();
  
  if (currentExerciseCode) {
    try {
      await supabase
        .from('exercise_sessions')
        .update({ state: globalState })
        .eq('code', currentExerciseCode);
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
        .from('exercise_sessions')
        .update({ state: globalState })
        .eq('code', currentExerciseCode);
    } catch (err) {
      console.error("Failed to reset state in Supabase", err);
    }
  }
};

export const useStore = (exerciseCode) => {
  const [data, setData] = useState({ state: globalState, timelineData: globalTimelineData, isLoading: true, error: null });

  useEffect(() => {
    if (!exerciseCode) return;
    
    currentExerciseCode = exerciseCode;
    
    const handleStateChange = (newData) => setData(prev => ({ ...prev, ...newData, isLoading: false }));
    listeners.add(handleStateChange);

    let channel;

    const setupSupabase = async () => {
      // 1. Fetch session and its joined template
      const { data: sessionData, error } = await supabase
        .from('exercise_sessions')
        .select(`
          state,
          template_id,
          exercise_templates (
            timeline_data
          )
        `)
        .eq('code', exerciseCode)
        .single();
        
      if (error || !sessionData) {
        console.error("Error fetching session:", error);
        // Expose the actual error message or default to session not found
        const errorMsg = error?.message ? `Database Error: ${error.message}` : 'Session not found. Please launch from dashboard.';
        setData({ state: globalState, timelineData: null, isLoading: false, error: errorMsg });
        return;
      }

      globalState = sessionData.state || defaultState;
      // Handle the joined relation (Supabase returns object or array depending on relation, here it's an object)
      globalTimelineData = sessionData.exercise_templates?.timeline_data || [];
      notifyListeners();

      // 2. Subscribe to realtime changes
      channel = supabase.channel(`public:exercise_sessions:code=eq.${exerciseCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'exercise_sessions', filter: `code=eq.${exerciseCode}` },
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

  return data;
};
