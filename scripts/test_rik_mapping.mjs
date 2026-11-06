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

async function testRikMapping() {
  const { data: rows } = await supabase
    .from('repuestos_tecnicos')
    .select('*, motor:motores(*, fabricante:fabricantes(*), modelo:modelos(*)), equivalencias:equivalencias_repuestos(*)')
    .filter('especificaciones_tecnicas->>marca_catalogo', 'eq', 'RIK')
    .limit(3);

  for (const item of rows) {
    const spec = (item.especificaciones_tecnicas) || {};
    const catalogo_origen = item.catalogo_origen 
      ? String(item.catalogo_origen) 
      : ((spec).marca_catalogo 
          ? (String((spec).marca_catalogo).toUpperCase() === 'DOKURO' ? 'Dokuro' : (String((spec).marca_catalogo).toUpperCase() === 'MRK' ? 'MRK' : String((spec).marca_catalogo)))
          : ((spec).codigo_rik 
              ? 'Rik'
              : 'OEM'));

    console.log('ID:', item.id);
    console.log('codigo_oem:', item.codigo_oem);
    console.log('catalogo_origen:', catalogo_origen);
    console.log('marca_catalogo:', spec.marca_catalogo);
    console.log('codigo_rik:', spec.codigo_rik);
    console.log('---');
  }
}

testRikMapping();
