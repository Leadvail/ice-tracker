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
let globalSessionData = null;

const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener({ state: globalState, timelineData: globalTimelineData, session: globalSessionData }));
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
  const [data, setData] = useState({ state: globalState, timelineData: globalTimelineData, session: globalSessionData, isLoading: true, error: null });

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
          state, candidate_name, assessor_1_name, assessor_2_name, scores,
          template_id,
          exercise_templates ( start_clock_node_id, start_clock_time )
        `)
        .eq('code', exerciseCode)
        .single();
        
      if (error || !sessionData) {
        console.error("Error fetching session:", error);
        // Expose the actual error message or default to session not found
        const errorMsg = error?.message ? `Database Error: ${error.message}` : 'Session not found. Please launch from dashboard.';
        setData({ state: globalState, timelineData: null, session: null, isLoading: false, error: errorMsg });
        return;
      }

      globalState = sessionData.state || defaultState;
      // Expose template info at the root of session data for ease of access
      globalSessionData = { 
        ...sessionData, 
        template: sessionData.exercise_templates 
      };

      // Fetch relational timeline nodes
      const { data: nodesData, error: nodesError } = await supabase
        .from('timeline_nodes')
        .select('*')
        .eq('template_id', sessionData.template_id)
        .order('order_index', { ascending: true });

      if (nodesError) {
        console.error("Error fetching timeline nodes:", nodesError);
        globalTimelineData = [];
      } else {
        globalTimelineData = (nodesData || []).map(n => {
          const mapped = {
            id: n.node_id,
            title: n.title,
            time: n.time,
            length: n.length_mins,
            type: n.node_type,
            detail: n.detail,
            criteria: n.criteria,
            rolePlayers: n.role_players,
            options: n.branch_options,
            dependsOn: n.depends_on,
            linkedId: n.linked_id,
            branchLabel: n.branch_label
          };
          // Clean up nulls
          Object.keys(mapped).forEach(key => {
            if (mapped[key] === null || mapped[key] === undefined) delete mapped[key];
          });
          return mapped;
        });
      }
      
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
