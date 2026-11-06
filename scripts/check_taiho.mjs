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

async function inspectTaiho() {
  console.log('--- Buscando Taiho en BD ---');

  // 1. repuestos_tecnicos por catalogo_origen o nombre o codigo_oem
  let taihoRepuestoIds = new Set();
  let sampleParts = [];

  // Búsqueda por nombre
  const { data: nameRows, error: err1 } = await supabase
    .from('repuestos_tecnicos')
    .select('id, codigo_oem, nombre, categoria, subsistema, catalogo_origen, especificaciones_tecnicas, dimensiones')
    .ilike('nombre', '%taiho%');
  if (err1) console.error('Err1:', err1);
  (nameRows || []).forEach(r => {
    taihoRepuestoIds.add(r.id);
    if (sampleParts.length < 5) sampleParts.push(r);
  });

  // Búsqueda por catalogo_origen
  const { data: catRows, error: err2 } = await supabase
    .from('repuestos_tecnicos')
    .select('id, codigo_oem, nombre, categoria, subsistema, catalogo_origen, especificaciones_tecnicas, dimensiones')
    .ilike('catalogo_origen', '%taiho%');
  if (err2) console.error('Err2:', err2);
  (catRows || []).forEach(r => {
    taihoRepuestoIds.add(r.id);
    if (sampleParts.length < 5) sampleParts.push(r);
  });

  // Búsqueda por codigo_oem
  const { data: oemRows, error: err3 } = await supabase
    .from('repuestos_tecnicos')
    .select('id, codigo_oem, nombre, categoria, subsistema, catalogo_origen, especificaciones_tecnicas, dimensiones')
    .ilike('codigo_oem', '%taiho%');
  if (err3) console.error('Err3:', err3);
  (oemRows || []).forEach(r => {
    taihoRepuestoIds.add(r.id);
    if (sampleParts.length < 5) sampleParts.push(r);
  });

  // Búsqueda por especificaciones_tecnicas->marca_catalogo o catalogo_origen o fuente
  const { data: specRows } = await supabase
    .from('repuestos_tecnicos')
    .select('id, codigo_oem, nombre, categoria, subsistema, catalogo_origen, especificaciones_tecnicas, dimensiones')
    .contains('especificaciones_tecnicas', { marca_catalogo: 'TAIHO' });
  (specRows || []).forEach(r => {
    taihoRepuestoIds.add(r.id);
    if (sampleParts.length < 5) sampleParts.push(r);
  });

  // Búsqueda por dimensiones->catalogo
  const { data: dimRows } = await supabase
    .from('repuestos_tecnicos')
    .select('id, codigo_oem, nombre, categoria, subsistema, catalogo_origen, especificaciones_tecnicas, dimensiones')
    .contains('dimensiones', { catalogo: 'TAIHO' });
  (dimRows || []).forEach(r => {
    taihoRepuestoIds.add(r.id);
    if (sampleParts.length < 5) sampleParts.push(r);
  });

  console.log(`Total repuestos_tecnicos identificados como Taiho: ${taihoRepuestoIds.size}`);
  if (sampleParts.length > 0) {
    console.log('Muestra de repuestos Taiho:');
    sampleParts.forEach(r => {
      console.log(`ID: ${r.id} | Código: ${r.codigo_oem} | Catálogo: ${r.catalogo_origen} | Nombre: ${r.nombre}`);
      console.log(`  Categoría: ${r.categoria} | Dimensiones:`, r.dimensiones);
      console.log(`  Especificaciones:`, r.especificaciones_tecnicas);
    });
  }

  // 2. equivalencias_repuestos
  let eqTaihoIds = new Set();
  const { data: eqRows, error: eqErr } = await supabase
    .from('equivalencias_repuestos')
    .select('id, repuesto_id, marca_alterna, codigo_alterno')
    .ilike('marca_alterna', '%taiho%');
  if (eqErr) console.error('EqErr:', eqErr);
  (eqRows || []).forEach(e => eqTaihoIds.add(e.id));
  console.log(`Total equivalencias con marca_alterna Taiho: ${eqTaihoIds.size}`);
  if (eqRows && eqRows.length > 0) {
    console.log('Muestra de equivalencias:', eqRows.slice(0, 5));
  }

  // También verificar si hay equivalencias vinculadas a los repuestos de Taiho identificados
  if (taihoRepuestoIds.size > 0) {
    const { count: eqLinkedCount } = await supabase
      .from('equivalencias_repuestos')
      .select('id', { count: 'exact' })
      .in('repuesto_id', Array.from(taihoRepuestoIds).slice(0, 100));
    console.log(`Equivalencias vinculadas a primeros 100 repuestos Taiho: ${eqLinkedCount}`);
  }

  // 3. Motores creados con fuente o notas de Taiho
  const { count: motorCount } = await supabase
    .from('motores')
    .select('id', { count: 'exact' })
    .ilike('nombre_comercial', '%taiho%');
  console.log(`Motores con nombre_comercial Taiho: ${motorCount}`);

  // 4. Ver si hay repuestos en general de cojinetes / metales / casquetería
  const { count: cojineteCount } = await supabase
    .from('repuestos_tecnicos')
    .select('id', { count: 'exact' })
    .or('categoria.ilike.%cojinete%,categoria.ilike.%metal%,categoria.ilike.%casquete%,categoria.ilike.%biela%,categoria.ilike.%bancada%');
  console.log(`Repuestos con categoría de cojinetes/metales/casquetería: ${cojineteCount}`);

  // Categorías de los repuestos Taiho encontrados
  const { data: allTaihoParts } = await supabase
    .from('repuestos_tecnicos')
    .select('categoria, catalogo_origen')
    .in('id', Array.from(taihoRepuestoIds));
  const countsByCat = {};
  allTaihoParts?.forEach(p => {
    countsByCat[p.categoria] = (countsByCat[p.categoria] || 0) + 1;
  });
  console.log('Distribución de categorías en Taiho:', countsByCat);
}

inspectTaiho();
