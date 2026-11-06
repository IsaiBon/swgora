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

async function checkCasqueteria() {
  const { data, count } = await supabase
    .from('repuestos_tecnicos')
    .select('id, nombre, especificaciones_tecnicas', { count: 'exact' })
    .eq('categoria', 'Casquetería')
    .limit(10);
  
  console.log('Total in Casquetería:', count);
  // Check if any Casquetería part is NOT Taiho
  const { data: nonTaiho, count: nonTaihoCount } = await supabase
    .from('repuestos_tecnicos')
    .select('id, nombre, especificaciones_tecnicas', { count: 'exact' })
    .eq('categoria', 'Casquetería')
    .not('especificaciones_tecnicas->>marca_catalogo', 'eq', 'TAIHO');
  console.log('Non-Taiho in Casquetería:', nonTaihoCount);

  // Check engines with fuente 'Catálogo Taiho B-18'
  const { data: taihoEngines, count: taihoEngCount } = await supabase
    .from('motores')
    .select('id, codigo, nombre_comercial', { count: 'exact' })
    .filter('especificaciones_tecnicas->>fuente', 'eq', 'Catálogo Taiho B-18');
  console.log('Taiho engines count:', taihoEngCount);
}

checkCasqueteria();
