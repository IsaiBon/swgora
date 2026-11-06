import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function runImport() {
  console.log('=== INGESTA DEL CATÁLOGO DE GUÍAS DE VÁLVULA MRK ===');

  // 1. Cargar JSON estructurado
  console.log('1. Cargando RecursosExtras/catalogo_mrk_guias.json...');
  const mrkGuides = JSON.parse(fs.readFileSync('RecursosExtras/catalogo_mrk_guias.json', 'utf8'));
  console.log(`✓ ${mrkGuides.length} guías de válvula cargadas del catálogo MRK.`);

  // 2. Cargar Fabricantes de Supabase
  console.log('2. Mapeando fabricantes de Supabase...');
  const { data: dbFabs } = await supabase.from('fabricantes').select('id, nombre');
  const fabMap = new Map();
  for (const f of dbFabs || []) {
    fabMap.set(f.nombre.toUpperCase(), f.id);
  }

  // 3. Cargar Motores existentes en memoria para vinculación
  console.log('3. Cargando motores de Supabase para vinculación cruzada...');
  let allMotors = [];
  let from = 0;
  while (true) {
    const { data: mBatch } = await supabase
      .from('motores')
      .select('id, codigo, fabricante_id')
      .range(from, from + 999);
    if (!mBatch || mBatch.length === 0) break;
    allMotors.push(...mBatch);
    if (mBatch.length < 1000) break;
    from += 1000;
  }
  console.log(`✓ ${allMotors.length} motores cargados.`);

  const motorByFabAndCode = new Map();
  for (const m of allMotors) {
    const clean = m.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    motorByFabAndCode.set(`${m.fabricante_id}:${clean}`, m.id);
  }

  // 4. Cargar repuestos MRK existentes en DB para no duplicar
  console.log('4. Verificando registros existentes de MRK en Supabase...');
  const { data: existingMrk } = await supabase
    .from('repuestos_tecnicos')
    .select('id, codigo_oem')
    .contains('especificaciones_tecnicas', { marca_catalogo: 'MRK' });

  const existingMap = new Map();
  for (const p of existingMrk || []) {
    existingMap.set(p.codigo_oem.toUpperCase(), p.id);
  }

  // 5. Preparar filas para inserción / actualización
  console.log('5. Transformando guías MRK...');
  const repuestosToInsert = [];
  const repuestosToUpdate = [];
  const equivalenciasToInsert = [];

  for (const item of mrkGuides) {
    const code = item.codigo_mrk.toUpperCase();
    const fabId = fabMap.get(item.fabricante.toUpperCase()) || null;

    // Buscar motor compatible si existe
    let matchedMotorId = null;
    if (fabId && item.motores && item.motores.length > 0) {
      for (const mCode of item.motores) {
        const clean = mCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const found = motorByFabAndCode.get(`${fabId}:${clean}`);
        if (found) {
          matchedMotorId = found;
          break;
        }
      }
    }

    const targetId = existingMap.get(code) || crypto.randomUUID();
    const nombre = `Guía de Válvula ${item.motores_texto ? `Motor ${item.motores_texto}` : ''} (${item.fabricante}) - MRK ${item.codigo_mrk}`.trim();

    const dimensionesObj = {
      catalogo: 'MRK',
      diametro_interior_mm: item.diametro_interior_mm,
      diametro_exterior_mm: item.diametro_exterior_mm,
      longitud_total_mm: item.longitud_total_mm,
      motores_texto: item.motores_texto || null
    };

    const especificacionesObj = {
      marca_catalogo: 'MRK',
      catalogo_origen: 'MRK',
      tipo_producto: 'valve_guide',
      codigo_mrk: item.codigo_mrk,
      codigo_catalogo: item.codigo_mrk,
      referencias_oem: item.referencias_oem || [],
      fabricantes: [item.fabricante.toUpperCase()],
      motores_compatibles: item.motores || [],
      motores_texto: item.motores_texto || null,
      pagina_pdf: item.pagina_pdf,
      fuente: 'MRK.pdf'
    };

    const record = {
      id: targetId,
      motor_id: matchedMotorId,
      codigo_oem: item.codigo_mrk,
      nombre,
      subsistema: 'Culata',
      categoria: 'Guías',
      precio: 0.00,
      stock: 8,
      estado: 'Disponible',
      longitud_total_mm: item.longitud_total_mm,
      dimensiones: dimensionesObj,
      especificaciones_tecnicas: especificacionesObj
    };

    if (existingMap.has(code)) {
      repuestosToUpdate.push(record);
    } else {
      repuestosToInsert.push(record);
    }

    // Preparar equivalencias
    // 1. Código MRK
    equivalenciasToInsert.push({
      repuesto_id: targetId,
      marca_alterna: 'MRK',
      codigo_alterno: item.codigo_mrk,
      tipo_referencia: 'Código Directo MRK',
      notas: `Catálogo MRK Japón - Guía Ø Int ${item.diametro_interior_mm}mm × Ø Ext ${item.diametro_exterior_mm}mm × L ${item.longitud_total_mm}mm`,
      especificaciones_tecnicas: { origen: 'MRK', fabricante: item.fabricante }
    });

    // 2. Cruces OEM
    const seenRefs = new Set([item.codigo_mrk.toUpperCase()]);
    for (const ref of item.referencias_oem || []) {
      const cleanRef = ref.toUpperCase().trim();
      if (!seenRefs.has(cleanRef)) {
        seenRefs.add(cleanRef);
        equivalenciasToInsert.push({
          repuesto_id: targetId,
          marca_alterna: 'OEM',
          codigo_alterno: cleanRef,
          tipo_referencia: 'Referencia Original OEM',
          notas: `Cruce OEM oficial para MRK ${item.codigo_mrk}`,
          especificaciones_tecnicas: { origen: 'MRK', codigo_mrk: item.codigo_mrk }
        });
      }
    }
  }

  // 6. Inserción de repuestos
  if (repuestosToInsert.length > 0) {
    console.log(`6. Insertando ${repuestosToInsert.length} nuevas guías de válvula MRK...`);
    const insertChunks = chunkArray(repuestosToInsert, 50);
    for (const chunk of insertChunks) {
      const { error: insErr } = await supabase.from('repuestos_tecnicos').insert(chunk);
      if (insErr) {
        console.error('Error insertando lote de guías:', insErr.message);
      }
    }
    console.log(`✓ Nuevas guías insertadas.`);
  }

  // 7. Actualización de repuestos existentes si los hubiera
  if (repuestosToUpdate.length > 0) {
    console.log(`7. Actualizando ${repuestosToUpdate.length} guías MRK existentes...`);
    for (const r of repuestosToUpdate) {
      await supabase
        .from('repuestos_tecnicos')
        .update({
          motor_id: r.motor_id,
          nombre: r.nombre,
          longitud_total_mm: r.longitud_total_mm,
          dimensiones: r.dimensiones,
          especificaciones_tecnicas: r.especificaciones_tecnicas
        })
        .eq('id', r.id);
    }
    console.log(`✓ Guías existentes actualizadas.`);
  }

  // 8. Insertar equivalencias cruzadas
  if (equivalenciasToInsert.length > 0) {
    console.log(`8. Insertando ${equivalenciasToInsert.length} equivalencias de guías MRK...`);
    const allRepIds = [...new Set(equivalenciasToInsert.map(e => e.repuesto_id))];
    const delChunks = chunkArray(allRepIds, 100);
    for (const ch of delChunks) {
      await supabase.from('equivalencias_repuestos').delete().in('repuesto_id', ch);
    }

    const eqChunks = chunkArray(equivalenciasToInsert, 100);
    for (const ch of eqChunks) {
      const rows = ch.map(e => ({
        id: crypto.randomUUID(),
        ...e
      }));
      const { error: eqErr } = await supabase.from('equivalencias_repuestos').insert(rows);
      if (eqErr) {
        console.error('Error insertando lote de equivalencias:', eqErr.message);
      }
    }
    console.log(`✓ Equivalencias MRK insertadas con éxito.`);
  }

  console.log('=== INGESTA DE GUÍAS DE VÁLVULA MRK COMPLETADA EXITOSAMENTE ===');
}

runImport();
