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

async function inspectAllRik() {
  const { count: totalRikInName } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true })
    .ilike('nombre', '%rik%');
  console.log('Total with RIK in name:', totalRikInName);

  const { count: totalRikMarcaCat } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true })
    .filter('especificaciones_tecnicas->>marca_catalogo', 'eq', 'RIK');
  console.log('Total with especificaciones_tecnicas->marca_catalogo = RIK:', totalRikMarcaCat);

  const { count: totalRikCodigoOem } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true })
    .ilike('codigo_oem', 'RIK-%');
  console.log('Total with codigo_oem like RIK-%:', totalRikCodigoOem);

  const { count: totalRikCodigoRik } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true })
    .not('especificaciones_tecnicas->>codigo_rik', 'is', null);
  console.log('Total with especificaciones_tecnicas->codigo_rik not null:', totalRikCodigoRik);

  // Check if any RIK part has catalogo_origen column set
  const { data: catOrigenSample } = await supabase
    .from('repuestos_tecnicos')
    .select('id, nombre, catalogo_origen')
    .filter('especificaciones_tecnicas->>marca_catalogo', 'eq', 'RIK')
    .limit(5);
  console.log('catalogo_origen column sample:', catOrigenSample);
}

inspectAllRik();
