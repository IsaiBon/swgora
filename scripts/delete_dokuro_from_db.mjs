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

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function deleteCompleteDokuro() {
  console.log('=== PURGADO COMPLETO DE TODOS LOS DATOS DE DOKURO ===');

  // 1. Encontrar todos los repuestos Dokuro en repuestos_tecnicos
  console.log('1. Buscando todos los repuestos asociados a Dokuro...');
  let dokuroRepuestoIds = new Set();

  // Búsqueda 1: Por marca_catalogo en especificaciones_tecnicas
  let page = 0;
  while (true) {
    const { data: rows } = await supabase
      .from('repuestos_tecnicos')
      .select('id')
      .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!rows || rows.length === 0) break;
    rows.forEach(r => dokuroRepuestoIds.add(r.id));
    if (rows.length < 1000) break;
    page++;
  }

  // Búsqueda 2: Por nombre conteniendo Dokuro
  const { data: nameRows } = await supabase
    .from('repuestos_tecnicos')
    .select('id')
    .ilike('nombre', '%dokuro%');
  (nameRows || []).forEach(r => dokuroRepuestoIds.add(r.id));

  // Búsqueda 3: Por catalogo_origen Dokuro
  const { data: catRows } = await supabase
    .from('repuestos_tecnicos')
    .select('id')
    .filter('especificaciones_tecnicas->>catalogo_origen', 'eq', 'Dokuro');
  (catRows || []).forEach(r => dokuroRepuestoIds.add(r.id));

  // Búsqueda 4: Por fuente Catalogo-DOKURO.pdf
  const { data: fuenteRows } = await supabase
    .from('repuestos_tecnicos')
    .select('id')
    .filter('especificaciones_tecnicas->>fuente', 'eq', 'Catalogo-DOKURO.pdf');
  (fuenteRows || []).forEach(r => dokuroRepuestoIds.add(r.id));

  const allIds = Array.from(dokuroRepuestoIds);
  console.log(`✓ Total identificados para eliminación: ${allIds.length} repuestos de Dokuro.`);

  // 2. Eliminar equivalencias de estos repuestos
  if (allIds.length > 0) {
    console.log('2. Eliminando equivalencias vinculadas a estos repuestos...');
    const chunks = chunkArray(allIds, 100);
    let deletedCount = 0;
    for (const ch of chunks) {
      await supabase.from('equivalencias_repuestos').delete().in('repuesto_id', ch);
      deletedCount += ch.length;
      process.stdout.write(`\r   Equivalencias limpiadas por repuesto: ${deletedCount} / ${allIds.length}`);
    }
    console.log('\n✓ Equivalencias vinculadas eliminadas.');
  }

  // 3. Eliminar cualquier equivalencia residual con marca_alterna Dokuro
  console.log('3. Eliminando equivalencias residuales de Dokuro...');
  let residualCount = 0;
  while (true) {
    const { data: resRows } = await supabase
      .from('equivalencias_repuestos')
      .select('id')
      .ilike('marca_alterna', '%dokuro%')
      .limit(1000);
    if (!resRows || resRows.length === 0) break;
    const rChunks = chunkArray(resRows.map(r => r.id), 100);
    for (const ch of rChunks) {
      await supabase.from('equivalencias_repuestos').delete().in('id', ch);
    }
    residualCount += resRows.length;
    process.stdout.write(`\r   Equivalencias residuales borradas: ${residualCount}`);
  }
  console.log(`\n✓ Total equivalencias residuales Dokuro eliminadas: ${residualCount}`);

  // 4. Eliminar los repuestos_tecnicos de Dokuro
  if (allIds.length > 0) {
    console.log('4. Eliminando repuestos_tecnicos de Dokuro de la base de datos...');
    const chunks = chunkArray(allIds, 100);
    let deletedParts = 0;
    for (const ch of chunks) {
      const { error } = await supabase.from('repuestos_tecnicos').delete().in('id', ch);
      if (error) console.error('Error borrando repuestos:', error.message);
      deletedParts += ch.length;
      process.stdout.write(`\r   Repuestos eliminados: ${deletedParts} / ${allIds.length}`);
    }
    console.log('\n✓ Repuestos de Dokuro eliminados exitosamente.');
  }

  // 5. Eliminar motores contaminados creados por ingestas de Dokuro
  console.log('5. Eliminando motores creados exclusivamente por Dokuro...');
  let deletedEngines = 0;
  while (true) {
    const { data: rows } = await supabase
      .from('motores')
      .select('id')
      .filter('especificaciones_tecnicas->>fuente', 'ilike', '%DOKURO%')
      .limit(1000);
    if (!rows || rows.length === 0) break;
    const chunks = chunkArray(rows.map(r => r.id), 100);
    for (const ch of chunks) {
      await supabase.from('motores').delete().in('id', ch);
    }
    deletedEngines += rows.length;
    process.stdout.write(`\r   Motores Dokuro eliminados: ${deletedEngines}`);
  }
  console.log(`\n✓ Motores creados por Dokuro eliminados: ${deletedEngines}`);

  // 6. Verificación final de integridad
  const { count: finalDokuro } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true })
    .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' });

  const { count: finalTotalParts } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true });

  const { count: finalEngines } = await supabase
    .from('motores')
    .select('id', { count: 'exact', head: true });

  console.log('\n========================================');
  console.log('ESTADO FINAL TRAS BORRADO DE DOKURO:');
  console.log(`- Repuestos Dokuro restantes: ${finalDokuro || 0}`);
  console.log(`- Total repuestos en base de datos: ${finalTotalParts}`);
  console.log(`- Total motores en base de datos: ${finalEngines}`);
  console.log('========================================\n');
}

deleteCompleteDokuro();
