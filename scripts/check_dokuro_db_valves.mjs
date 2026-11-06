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

async function checkDaihatsu() {
  const { data: valves } = await supabase
    .from('repuestos_tecnicos')
    .select('*, motor:motores(codigo, nombre_comercial, fabricante:fabricantes(nombre))')
    .eq('categoria', 'Válvulas')
    .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' })
    .ilike('nombre', '%Daihatsu%')
    .limit(10);

  for (const v of valves || []) {
    console.log('----------------------------------------------------');
    console.log('NOMBRE:', v.nombre);
    console.log('CODIGO OEM:', v.codigo_oem);
    console.log('MOTOR:', v.motor?.codigo, 'FAB:', v.motor?.fabricante?.nombre);
    console.log('HONGO:', v.diametro_cabeza_mm, 'VASTAGO:', v.diametro_vastago_mm, 'LARGO:', v.longitud_total_mm, 'ANGULO:', v.angulo_asiento_grados);
    console.log('DIMENSIONES:', v.dimensiones);
    console.log('ESPECIFICACIONES:', JSON.stringify(v.especificaciones_tecnicas, null, 2));
  }
}
checkDaihatsu();
