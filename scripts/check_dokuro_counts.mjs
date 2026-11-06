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
  const { data, count, error } = await supabase
    .from('repuestos_tecnicos')
    .select('id, nombre, codigo_oem, categoria, especificaciones_tecnicas', { count: 'exact' })
    .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total Dokuro parts in DB:', count);
  const byCat = {};
  for (const p of data || []) {
    byCat[p.categoria] = (byCat[p.categoria] || 0) + 1;
  }
  console.log('By category:', byCat);

  // Check how many have vehicle / year info in especificaciones_tecnicas
  let withVeh = 0;
  let withSubtipoMoto = 0;
  for (const p of data || []) {
    const spec = p.especificaciones_tecnicas || {};
    if (spec.vehiculo || spec.vehiculos || spec.vehicle_model) withVeh++;
    if (spec.subtipo === 'motorcycle' || p.nombre?.toLowerCase().includes('yamaha') || p.nombre?.toLowerCase().includes('kawasaki')) {
      withSubtipoMoto++;
    }
  }
  console.log('With vehicle info:', withVeh);
  console.log('Motorcycle parts:', withSubtipoMoto);
}
check();

