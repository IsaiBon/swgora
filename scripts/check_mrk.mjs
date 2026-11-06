import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, count } = await supabase
    .from('repuestos_tecnicos')
    .select('id, nombre, codigo_oem, dimensiones, especificaciones_tecnicas, equivalencias:equivalencias_repuestos(*)', { count: 'exact' })
    .contains('especificaciones_tecnicas', { marca_catalogo: 'MRK' })
    .limit(3);

  console.log('Total MRK parts in DB:', count);
  for (const item of data || []) {
    console.log('--------------------------------------------');
    console.log('MRK:', item.codigo_oem);
    console.log('Nombre:', item.nombre);
    console.log('Dimensiones:', item.dimensiones);
    console.log('Equivalencias:', item.equivalencias?.map(e => `${e.marca_alterna}: ${e.codigo_alterno}`));
  }
}

check();

