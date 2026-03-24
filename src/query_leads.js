import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const WEBHOOK_URL = process.env.VITE_WEBHOOK_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  console.log(`Checking leads created after: ${sevenDaysAgo.toISOString()}`);

  try {
    // 1. Fetch from n8n
    console.log(`Fetching from n8n: ${WEBHOOK_URL}`);
    const n8nRes = await fetch(WEBHOOK_URL);
    let n8nLeads = [];
    if (n8nRes.ok) {
      n8nLeads = await n8nRes.json();
    } else {
      console.error(`n8n HTTP error: ${n8nRes.status}`);
    }

    // Determine the date field dynamically (usually fecha_de_creacion, created_at, or Fecha)
    // Extract leads array
    let leadsArray = [];
    if (Array.isArray(n8nLeads)) {
      leadsArray = n8nLeads;
    } else if (n8nLeads && Array.isArray(n8nLeads.leads)) {
      leadsArray = n8nLeads.leads;
    } else if (n8nLeads && n8nLeads.data && Array.isArray(n8nLeads.data)) {
      leadsArray = n8nLeads.data;
    }

    let n8nCount = 0;
    if (leadsArray.length > 0) {
       n8nCount = leadsArray.filter(lead => {
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
          if (leadsArray.indexOf(lead) < 2) console.log(`n8n sample date: ${rawDate} -> ${date}`);
          return !isNaN(date.getTime()) && date >= sevenDaysAgo && date <= new Date();
       }).length;
       console.log(`Total leads received from n8n: ${leadsArray.length}`);
    } else {
       console.log('Could not find leads array in n8n payload.');
    }

    console.log(`n8n leads from last 7 days: ${n8nCount}`);

    // 2. Fetch from Supabase
    console.log(`Fetching from Supabase...`);
    const { data: supabaseLeads, error } = await supabase
      .from('leads')
      .select('*');

    if (error) {
       console.error(`Supabase error:`, error);
    } else {
       let spCount = supabaseLeads.filter(lead => {
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
          return !isNaN(date.getTime()) && date >= sevenDaysAgo && date <= new Date();
       }).length;

       console.log(`Total leads in Supabase: ${supabaseLeads.length}`);
       console.log(`Supabase leads from last 7 days: ${spCount}`);
       fs.writeFileSync(path.resolve(__dirname, 'results.json'), JSON.stringify({
         n8nTotal: leadsArray.length,
         n8nLast7Days: n8nCount,
         supabaseTotal: supabaseLeads.length,
         supabaseLast7Days: spCount
       }, null, 2));
    }

  } catch (err) {
    console.error(`Error:`, err);
  }
}

run();
