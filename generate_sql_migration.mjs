import { timelineData } from './src/data.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('exercise_templates').select('id').eq('name', 'Henfield Scenario').limit(1);
  if (error || !data || data.length === 0) {
    console.error('Failed to get template ID:', error);
    return;
  }
  
  const templateId = data[0].id;
  let sql = 'INSERT INTO public.timeline_nodes (template_id, node_id, title, time, length_mins, node_type, detail, criteria, role_players, branch_options, depends_on, linked_id, branch_label, order_index) VALUES \n';
  
  const values = [];
  
  timelineData.forEach((node, index) => {
    const type = node.type === 'node' ? 'node' : (node.type === 'branch' ? 'branch' : 'conditional');
    const branchOptions = node.options ? JSON.stringify(node.options).replace(/'/g, "''") : null;
    const detail = node.detail ? JSON.stringify(node.detail).replace(/'/g, "''") : null;
    const criteria = node.criteria ? JSON.stringify(node.criteria).replace(/'/g, "''") : null;
    const rolePlayers = node.rolePlayers ? JSON.stringify(node.rolePlayers).replace(/'/g, "''") : null;
    
    values.push(`('${templateId}', '${node.id}', '${node.title || ''}', ${node.time ? "'"+node.time+"'" : 'NULL'}, ${node.length || 0}, '${type}', ${detail ? "'"+detail+"'::jsonb" : 'NULL'}, ${criteria ? "'"+criteria+"'::jsonb" : 'NULL'}, ${rolePlayers ? "'"+rolePlayers+"'::jsonb" : 'NULL'}, ${branchOptions ? "'"+branchOptions+"'::jsonb" : 'NULL'}, ${node.dependsOn ? "'"+node.dependsOn+"'" : 'NULL'}, ${node.linkedId ? "'"+node.linkedId+"'" : 'NULL'}, ${node.branchLabel ? "'"+node.branchLabel+"'" : 'NULL'}, ${index})`);
  });
  
  sql += values.join(',\n') + ';';
  fs.writeFileSync('insert_data.sql', sql);
  console.log('SQL generated to insert_data.sql');
}

run();
