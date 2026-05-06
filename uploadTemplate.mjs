import { createClient } from '@supabase/supabase-js';
import { timelineData } from './src/data.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upload() {
  console.log("Uploading Henfield template to Supabase...");
  
  const { data, error } = await supabase.from('exercise_templates').insert({
    name: 'Henfield Scenario',
    officer_rank: 'Station Commander',
    timeline_data: timelineData
  }).select();

  if (error) {
    console.error('Error uploading template:', error);
  } else {
    console.log('Successfully uploaded template! ID:', data[0].id);
  }
}

upload();
