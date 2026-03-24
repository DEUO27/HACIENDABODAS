import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // 1. n8n data
  const n8nData = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'n8n_response.json'), 'utf8'));
  const leadsArray = n8nData.leads || n8nData.data || n8nData;
  const n8nLast7 = leadsArray.filter(lead => {
    const rawDate = lead.fecha_primer_mensaje || lead.fecha_de_creacion || lead.created_at || lead.Fecha || lead.date;
    if (!rawDate) return false;
    let date;
    if (typeof rawDate === 'string' && rawDate.includes('/')) {
        const parts = rawDate.split(' ')[0].split('/');
        if (parts.length === 3) date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
        else date = new Date(rawDate);
    } else {
       date = new Date(rawDate);
    }
    return !isNaN(date.getTime()) && date >= sevenDaysAgo;
  });

  console.log(`n8n Last 7: ${n8nLast7.length}`);

  // 2. supabase data
  const { data: supabaseLeads, error } = await supabase.from('leads').select('*');
  if (error) throw error;
  
  const spLast7 = supabaseLeads.filter(lead => {
    const rawDate = lead.fecha_primer_mensaje || lead.fecha_de_creacion || lead.created_at || lead.Fecha || lead.date;
    if (!rawDate) return false;
    let date;
    if (typeof rawDate === 'string' && rawDate.includes('/')) {
        const parts = rawDate.split(' ')[0].split('/');
        if (parts.length === 3) date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
        else date = new Date(rawDate);
    } else {
        date = new Date(rawDate);
    }
    return !isNaN(date.getTime()) && date >= sevenDaysAgo && date <= new Date(); // Only past dates
  });

  console.log(`Supabase Last 7: ${spLast7.length}`);

  // Let's dump the 7 days leads for analysis
  fs.writeFileSync('debug_n8n.json', JSON.stringify(n8nLast7.slice(0, 2), null, 2));
  fs.writeFileSync('debug_sp.json', JSON.stringify(spLast7.slice(0, 2), null, 2));

  // Compare sets
  const n8nIds = new Set(n8nLast7.map(l => l.lead_id));
  const spIds = new Set(spLast7.map(l => l.lead_id));
  
  console.log(`n8n IDs: ${[...n8nIds].slice(0,5)}...`);
  console.log(`SP IDs: ${[...spIds].slice(0,5)}...`);
  
  let inSpNotN8n = [...spIds].filter(id => !n8nIds.has(id));
  let inN8nNotSp = [...n8nIds].filter(id => !spIds.has(id));
  
  console.log(`In SP not n8n: ${inSpNotN8n.length}`);
  console.log(`In n8n not SP: ${inN8nNotSp.length}`);
  
  if (inSpNotN8n.length > 0) {
     const sample = spLast7.find(l => l.lead_id === inSpNotN8n[0]);
     console.log(`Sample in SP not n8n: fecha_primer_mensaje=${sample.fecha_primer_mensaje}, created_at=${sample.created_at}`);
  }
}

run();
