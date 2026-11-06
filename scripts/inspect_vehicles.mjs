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

async function inspectVehicles() {
  const { data: valves } = await supabase
    .from('repuestos_tecnicos')
    .select('codigo_oem, nombre, dimensiones, especificaciones_tecnicas')
    .eq('categoria', 'Válvulas')
    .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' })
    .in('codigo_oem', ['IDH-0002', 'EDH-5002', 'IDH-0003', 'EDH-5003', 'IDH-0005', 'EDH-5005']);

  for (const v of valves || []) {
    console.log('=== ' + v.codigo_oem + ' ===');
    console.log('Nombre:', v.nombre);
    console.log('Dimensiones:', v.dimensiones);
    console.log('Especificaciones:', v.especificaciones_tecnicas);
  }
}
inspectVehicles();
