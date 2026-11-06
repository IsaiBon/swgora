import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) {
    let val = v.join('=').trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[k.trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectSample() {
  const { data: rep } = await supabase
    .from('repuestos_tecnicos')
    .select('*')
    .eq('id', '3d3116a0-2ee2-4cb4-a5e5-cb5c11f56de3')
    .single();
  console.log('Sample repuesto:', rep);

  // Check how many equivalencias have marca_alterna = Taiho
  const { count: taihoEqCount } = await supabase
    .from('equivalencias_repuestos')
    .select('id', { count: 'exact' })
    .ilike('marca_alterna', '%taiho%');
  console.log('Total equivalencias with Taiho marca_alterna:', taihoEqCount);

  // Check how many repuestos have 'Taiho' anywhere in their fields
  const { count: repNameTaiho } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact' })
    .ilike('nombre', '%taiho%');
  console.log('Repuestos with Taiho in nombre:', repNameTaiho);

  const { count: repOemTaiho } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact' })
    .ilike('codigo_oem', '%taiho%');
  console.log('Repuestos with Taiho in codigo_oem:', repOemTaiho);

  // Check all distinct marca_alterna in equivalencias
  const { data: distinctEquivs } = await supabase
    .from('equivalencias_repuestos')
    .select('marca_alterna')
    .limit(100);
  console.log('Some equivalencias marcas:', [...new Set(distinctEquivs?.map(e => e.marca_alterna))]);

  // Check if there are any files or scripts related to Taiho
  console.log('Checking scripts for taiho...');
}

inspectSample();
