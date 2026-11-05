import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function deleteCurrentAjusa() {
  console.log('--- INICIO DE ELIMINACIÓN DE DATOS PREVIOS DE AJUSA ---');

  // 1. Eliminar equivalencias de Ajusa
  console.log('1. Eliminando equivalencias con marca_alterna Ajusa...');
  let totalEquivDeleted = 0;

  while (true) {
    const { data: rows, error: sErr } = await supabase
      .from('equivalencias_repuestos')
      .select('id')
      .ilike('marca_alterna', '%ajusa%')
      .limit(1000);

    if (sErr || !rows || rows.length === 0) break;

    const chunks = chunkArray(rows.map(r => r.id), 100);
    await Promise.all(
      chunks.map(chunk => supabase.from('equivalencias_repuestos').delete().in('id', chunk))
    );

    totalEquivDeleted += rows.length;
    process.stdout.write(`\rEquivalencias de Ajusa borradas: ${totalEquivDeleted}`);
  }
  console.log(`\n✓ Total equivalencias de Ajusa borradas: ${totalEquivDeleted}`);

  // 2. Eliminar repuestos_tecnicos de Ajusa
  console.log('2. Eliminando repuestos_tecnicos de catálogo AJUSA...');
  let totalPartsDeleted = 0;

  while (true) {
    const { data: rows, error: sErr } = await supabase
      .from('repuestos_tecnicos')
      .select('id')
      .filter('especificaciones_tecnicas->>marca_catalogo', 'eq', 'AJUSA')
      .limit(1000);

    if (sErr || !rows || rows.length === 0) break;

    const ids = rows.map(r => r.id);
    const chunks = chunkArray(ids, 100);

    // Borrar dependencias en equivalencias_repuestos primero
    await Promise.all(
      chunks.map(chunk => supabase.from('equivalencias_repuestos').delete().in('repuesto_id', chunk))
    );

    // Borrar repuestos
    await Promise.all(
      chunks.map(chunk => supabase.from('repuestos_tecnicos').delete().in('id', chunk))
    );

    totalPartsDeleted += ids.length;
    process.stdout.write(`\rRepuestos técnicos de Ajusa borrados: ${totalPartsDeleted}`);
  }
  console.log(`\n✓ Total repuestos de Ajusa borrados: ${totalPartsDeleted}`);

  // 3. Verificación final de conteo
  const { count: finalTotal } = await supabase
    .from('repuestos_tecnicos')
    .select('*', { count: 'exact', head: true });

  console.log(`\nEstado final en base de datos: ${finalTotal} repuestos técnicos remanentes (Dokuro, Rik, etc.).`);
}

deleteCurrentAjusa();
