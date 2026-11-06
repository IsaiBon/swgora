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

async function testMatch() {
  const data = JSON.parse(fs.readFileSync('RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json', 'utf8'));
  const passValves = data.filter(x => x.tipo_producto === 'engine_valve' && (x.subtipos || []).includes('passenger_truck'));
  console.log(`Audited passenger valves in JSON: ${passValves.length}`);

  // Fetch all Dokuro valves in DB
  let allDbValves = [];
  let from = 0;
  while (true) {
    const { data: batch } = await supabase
      .from('repuestos_tecnicos')
      .select('id, codigo_oem, nombre, dimensiones, especificaciones_tecnicas')
      .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' })
      .range(from, from + 999);
    if (!batch || batch.length === 0) break;
    allDbValves.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  console.log(`Dokuro items in DB: ${allDbValves.length}`);

  let matchByCode = 0;
  let matchByDokuroInSpec = 0;
  const dbCodeSet = new Map();
  for (const v of allDbValves) {
    dbCodeSet.set(v.codigo_oem.toUpperCase(), v.id);
    const dok = v.especificaciones_tecnicas?.codigo_dokuro;
    if (dok) dbCodeSet.set(dok.toUpperCase(), v.id);
  }

  for (const pv of passValves) {
    const dok = (pv.codigo_dokuro || '').toUpperCase();
    const cat = (pv.codigo_catalogo || '').toUpperCase();
    if (dbCodeSet.has(dok) || dbCodeSet.has(cat)) {
      matchByCode++;
    }
  }

  console.log(`Matched passenger valves in DB: ${matchByCode} / ${passValves.length}`);
}

testMatch();

