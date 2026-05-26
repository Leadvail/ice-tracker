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

async function update() {
  console.log("Updating existing Henfield templates in Supabase...");
  const { data, error } = await supabase.from('exercise_templates').update({ timeline_data: timelineData }).eq('name', 'Henfield Scenario');
  if (error) {
    console.error('Error updating template:', error);
  } else {
    console.log('Successfully updated all templates!');
  }
}

update();
