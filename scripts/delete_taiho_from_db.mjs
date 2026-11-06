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

async function deleteCompleteTaiho() {
  console.log('=== PURGADO COMPLETO DE TODOS LOS DATOS DE TAIHO ===\n');

  // 1. Encontrar todos los repuestos Taiho en repuestos_tecnicos
  console.log('1. Buscando todos los repuestos asociados a Taiho...');
  let taihoRepuestoIds = new Set();

  // Búsqueda 1: Por marca_catalogo TAIHO
  let page = 0;
  while (true) {
    const { data: rows } = await supabase
      .from('repuestos_tecnicos')
      .select('id')
      .contains('especificaciones_tecnicas', { marca_catalogo: 'TAIHO' })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!rows || rows.length === 0) break;
    rows.forEach(r => taihoRepuestoIds.add(r.id));
    if (rows.length < 1000) break;
    page++;
  }

  // Búsqueda 2: Por categoría Casquetería
  page = 0;
  while (true) {
    const { data: casqRows } = await supabase
      .from('repuestos_tecnicos')
      .select('id')
      .eq('categoria', 'Casquetería')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!casqRows || casqRows.length === 0) break;
    casqRows.forEach(r => taihoRepuestoIds.add(r.id));
    if (casqRows.length < 1000) break;
    page++;
  }

  // Búsqueda 3: Por fuente Catalogo Taiho
  page = 0;
  while (true) {
    const { data: fuenteRows } = await supabase
      .from('repuestos_tecnicos')
      .select('id')
      .filter('especificaciones_tecnicas->>fuente', 'ilike', '%taiho%')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!fuenteRows || fuenteRows.length === 0) break;
    fuenteRows.forEach(r => taihoRepuestoIds.add(r.id));
    if (fuenteRows.length < 1000) break;
    page++;
  }

  // Búsqueda 4: Por nombre conteniendo Taiho
  const { data: nameRows } = await supabase
    .from('repuestos_tecnicos')
    .select('id')
    .ilike('nombre', '%taiho%');
  (nameRows || []).forEach(r => taihoRepuestoIds.add(r.id));

  const allIds = Array.from(taihoRepuestoIds);
  console.log(`✓ Total identificados para eliminación: ${allIds.length} repuestos de Taiho.\n`);

  // 2. Eliminar equivalencias de estos repuestos
  if (allIds.length > 0) {
    console.log('2. Eliminando equivalencias vinculadas a los repuestos de Taiho...');
    const chunks = chunkArray(allIds, 100);
    let deletedCount = 0;
    for (const ch of chunks) {
      const { error } = await supabase.from('equivalencias_repuestos').delete().in('repuesto_id', ch);
      if (error) console.error('Error borrando equivalencias:', error.message);
      deletedCount += ch.length;
      process.stdout.write(`\r   Equivalencias limpiadas por repuesto: ${deletedCount} / ${allIds.length}`);
    }
    console.log('\n✓ Equivalencias vinculadas eliminadas.\n');
  }

  // 3. Eliminar cualquier equivalencia residual con marca_alterna Taiho
  console.log('3. Eliminando equivalencias residuales de Taiho...');
  let residualCount = 0;
  while (true) {
    const { data: resRows } = await supabase
      .from('equivalencias_repuestos')
      .select('id')
      .ilike('marca_alterna', '%taiho%')
      .limit(1000);
    if (!resRows || resRows.length === 0) break;
    const rChunks = chunkArray(resRows.map(r => r.id), 100);
    for (const ch of rChunks) {
      await supabase.from('equivalencias_repuestos').delete().in('id', ch);
    }
    residualCount += resRows.length;
    process.stdout.write(`\r   Equivalencias residuales borradas: ${residualCount}`);
  }
  console.log(`\n✓ Total equivalencias residuales Taiho eliminadas: ${residualCount}\n`);

  // 4. Eliminar los repuestos_tecnicos de Taiho
  if (allIds.length > 0) {
    console.log('4. Eliminando repuestos_tecnicos de Taiho de la base de datos...');
    const chunks = chunkArray(allIds, 100);
    let deletedParts = 0;
    for (const ch of chunks) {
      const { error } = await supabase.from('repuestos_tecnicos').delete().in('id', ch);
      if (error) console.error('Error borrando repuestos:', error.message);
      deletedParts += ch.length;
      process.stdout.write(`\r   Repuestos eliminados: ${deletedParts} / ${allIds.length}`);
    }
    console.log('\n✓ Repuestos de Taiho eliminados exitosamente.\n');
  }

  // 5. Eliminar motores creados exclusivamente por Taiho
  console.log('5. Verificando motores creados exclusivamente por Taiho...');
  const { data: taihoEngines } = await supabase
    .from('motores')
    .select('id, codigo, nombre_comercial')
    .filter('especificaciones_tecnicas->>fuente', 'eq', 'Catálogo Taiho B-18');

  console.log(`   Se encontraron ${taihoEngines?.length || 0} motores con fuente Taiho.`);
  let deletedEngines = 0;

  if (taihoEngines && taihoEngines.length > 0) {
    // Verificar si algún motor tiene repuestos activos asociados
    const engineIds = taihoEngines.map(e => e.id);
    const engineChunks = chunkArray(engineIds, 50);
    const enginesToDelete = [];

    for (const ech of engineChunks) {
      for (const eid of ech) {
        const { count: partsLinked } = await supabase
          .from('repuestos_tecnicos')
          .select('id', { count: 'exact', head: true })
          .eq('motor_id', eid);
        if (!partsLinked || partsLinked === 0) {
          enginesToDelete.push(eid);
        }
      }
    }

    console.log(`   Motores sin repuestos vinculados a eliminar: ${enginesToDelete.length}`);
    const delChunks = chunkArray(enginesToDelete, 100);
    for (const ch of delChunks) {
      const { error } = await supabase.from('motores').delete().in('id', ch);
      if (error) console.error('Error borrando motores:', error.message);
      deletedEngines += ch.length;
      process.stdout.write(`\r   Motores eliminados: ${deletedEngines} / ${enginesToDelete.length}`);
    }
    console.log('\n✓ Motores huérfanos de Taiho eliminados.');
  }

  // 6. Verificación final
  console.log('\n=== VERIFICACIÓN FINAL POST-PURGADO ===');
  const { count: remainingTaihoParts } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true })
    .contains('especificaciones_tecnicas', { marca_catalogo: 'TAIHO' });

  const { count: remainingCasqParts } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria', 'Casquetería');

  const { count: remainingTaihoEq } = await supabase
    .from('equivalencias_repuestos')
    .select('id', { count: 'exact', head: true })
    .ilike('marca_alterna', '%taiho%');

  const { count: totalRepuestos } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact', head: true });

  const { count: totalMotores } = await supabase
    .from('motores')
    .select('id', { count: 'exact', head: true });

  console.log(`- Repuestos Taiho en BD: ${remainingTaihoParts}`);
  console.log(`- Repuestos Casquetería en BD: ${remainingCasqParts}`);
  console.log(`- Equivalencias Taiho en BD: ${remainingTaihoEq}`);
  console.log(`- Total general repuestos en BD: ${totalRepuestos}`);
  console.log(`- Total general motores en BD: ${totalMotores}`);
  console.log('\n🎉 ¡PURGADO DE TAIHO COMPLETADO AL 100%!');
}

deleteCompleteTaiho().catch(err => {
  console.error('Error fatal durante la purga de Taiho:', err);
  process.exit(1);
});
