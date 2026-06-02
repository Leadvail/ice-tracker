-- Migration: Add active_broadcaster_id to exercise_sessions

ALTER TABLE public.exercise_sessions 
ADD COLUMN active_broadcaster_id text;
