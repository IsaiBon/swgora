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

async function deleteCurrentDokuro() {
  console.log('--- INICIO DE ELIMINACIÓN DE DATOS PREVIOS DE DOKURO ---');

  // 1. Obtener los IDs de todos los repuestos_tecnicos de Dokuro
  console.log('1. Buscando repuestos técnicos de DOKURO...');
  let dokuroRepuestoIds = [];
  let page = 0;
  while (true) {
    const { data: rows, error } = await supabase
      .from('repuestos_tecnicos')
      .select('id')
      .filter('especificaciones_tecnicas->>marca_catalogo', 'eq', 'DOKURO')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error || !rows || rows.length === 0) break;
    dokuroRepuestoIds.push(...rows.map(r => r.id));
    if (rows.length < 1000) break;
    page++;
  }
  console.log(`✓ Encontrados ${dokuroRepuestoIds.length} repuestos técnicos de DOKURO.`);

  // 2. Eliminar equivalencias vinculadas a estos repuestos
  if (dokuroRepuestoIds.length > 0) {
    console.log('2. Eliminando equivalencias vinculadas a repuestos de Dokuro...');
    const chunks = chunkArray(dokuroRepuestoIds, 100);
    let deletedCount = 0;
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('equivalencias_repuestos')
        .delete()
        .in('repuesto_id', chunk);
      if (error) console.error('Error al borrar equivalencias por repuesto_id:', error.message);
      deletedCount += chunk.length;
      process.stdout.write(`\r   Equivalencias limpiadas por repuesto: ${deletedCount} / ${dokuroRepuestoIds.length}`);
    }
    console.log('\n✓ Equivalencias vinculadas eliminadas.');
  }

  // 3. Eliminar cualquier equivalencia residual con marca_alterna Dokuro
  console.log('3. Eliminando equivalencias residuales de marca Dokuro...');
  let totalEquivResidual = 0;
  while (true) {
    const { data: rows, error: sErr } = await supabase
      .from('equivalencias_repuestos')
      .select('id')
      .ilike('marca_alterna', '%dokuro%')
      .limit(1000);

    if (sErr || !rows || rows.length === 0) break;

    const chunks = chunkArray(rows.map(r => r.id), 100);
    await Promise.all(
      chunks.map(chunk => supabase.from('equivalencias_repuestos').delete().in('id', chunk))
    );

    totalEquivResidual += rows.length;
    process.stdout.write(`\r   Equivalencias residuales borradas: ${totalEquivResidual}`);
  }
  console.log(`\n✓ Total equivalencias residuales borradas: ${totalEquivResidual}`);

  // 4. Eliminar los repuestos_tecnicos de Dokuro
  if (dokuroRepuestoIds.length > 0) {
    console.log('4. Eliminando repuestos_tecnicos de catálogo DOKURO...');
    const chunks = chunkArray(dokuroRepuestoIds, 100);
    let deletedParts = 0;
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('repuestos_tecnicos')
        .delete()
        .in('id', chunk);
      if (error) console.error('Error al borrar repuestos:', error.message);
      deletedParts += chunk.length;
      process.stdout.write(`\r   Repuestos borrados: ${deletedParts} / ${dokuroRepuestoIds.length}`);
    }
    console.log('\n✓ Repuestos de Dokuro eliminados exitosamente.');
  }

  // 5. Eliminar motores contaminados creados por Dokuro 2006
  console.log('5. Eliminando motores creados por Dokuro 2006...');
  let deletedEngines = 0;
  while (true) {
    const { data: rows, error: sErr } = await supabase
      .from('motores')
      .select('id')
      .filter('especificaciones_tecnicas->>fuente', 'eq', 'DOKURO 2006')
      .limit(1000);

    if (sErr || !rows || rows.length === 0) break;

    const chunks = chunkArray(rows.map(r => r.id), 100);
    for (const chunk of chunks) {
      await supabase.from('motores').delete().in('id', chunk);
    }
    deletedEngines += rows.length;
    process.stdout.write(`\r   Motores borrados: ${deletedEngines}`);
  }
  console.log(`\n✓ Motores de Dokuro eliminados: ${deletedEngines}`);

  // 6. Verificación final
  const { count: finalParts } = await supabase
    .from('repuestos_tecnicos')
    .select('*', { count: 'exact', head: true });

  const { count: finalEngines } = await supabase
    .from('motores')
    .select('*', { count: 'exact', head: true });

  console.log(`\n========================================`);
  console.log(`ESTADO FINAL LIMPIO EN SUPABASE:`);
  console.log(`- Repuestos técnicos en BD: ${finalParts}`);
  console.log(`- Motores en BD: ${finalEngines}`);
  console.log(`========================================\n`);
}

deleteCurrentDokuro();
