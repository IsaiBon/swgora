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

async function countTaiho() {
  // 1. By marca_catalogo: TAIHO
  const { count: mcCount } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact' })
    .contains('especificaciones_tecnicas', { marca_catalogo: 'TAIHO' });
  console.log('Repuestos with marca_catalogo TAIHO:', mcCount);

  // 2. By fuente: 06-TAIHO B-18 JAP Y KOR.pdf
  const { count: fuenteCount } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact' })
    .filter('especificaciones_tecnicas->>fuente', 'ilike', '%taiho%');
  console.log('Repuestos with fuente ilike %taiho%:', fuenteCount);

  // 3. By codigo_taiho
  const { count: codCount } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact' })
    .not('especificaciones_tecnicas->>codigo_taiho', 'is', null);
  console.log('Repuestos with codigo_taiho not null:', codCount);

  // 4. By categoria: Casquetería or Cojinetes
  const { count: casqCount } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact' })
    .eq('categoria', 'Casquetería');
  console.log('Repuestos with categoria = Casquetería:', casqCount);

  // 5. Check other categories of these repuestos
  const { data: taihoRows } = await supabase
    .from('repuestos_tecnicos')
    .select('categoria')
    .contains('especificaciones_tecnicas', { marca_catalogo: 'TAIHO' });
  const catDist = {};
  taihoRows?.forEach(r => {
    catDist[r.categoria] = (catDist[r.categoria] || 0) + 1;
  });
  console.log('Category distribution of TAIHO parts:', catDist);

  // 6. Check if any motors were created specifically for TAIHO
  // In previous Dokuro cleanup, Dokuro had created engines. Did Taiho import create engines?
  // Let's check scripts to see how Taiho was imported.
}

countTaiho();
