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

// Ground truth for Page 11 (Daihatsu Engine Valves) directly from Image 2
const PAGE_11_TRUTH = {
  'IDH-0002': {
    dokuro: 'IDH-0002',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87101', '13711-87102', '4023-1641'],
    vehicle: 'CONSORTE/TAFT 1000CC (EP30, F10/40)',
    year: '64~77',
    engine: 'FE',
    cyl: '4 Cil.',
    head_dia: 32.00,
    stem_dia: 7.00,
    length: 95.00,
    angle: 45,
    style: 'ST',
    stem_end: null
  },
  'EDH-5002': {
    dokuro: 'EDH-5002',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87101', '13715-87102', '13715-87103', '13715-87104', '4023-1642'],
    vehicle: 'CONSORTE/TAFT 1000CC (EP30, F10/40)',
    year: '64~77',
    engine: 'FE',
    cyl: '4 Cil.',
    head_dia: 29.00,
    stem_dia: 7.00,
    length: 95.00,
    angle: 45,
    style: 'FR',
    stem_end: null
  },
  'IDH-0003': {
    dokuro: 'IDH-0003',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87305', '13711-87304'],
    vehicle: 'DELTA 2530CC (DV2# / 3#)',
    year: '69~77',
    engine: 'DG',
    cyl: '4 Cil.',
    head_dia: 40.00,
    stem_dia: 9.00,
    length: 136.20,
    angle: 45,
    style: 'ST',
    stem_end: 'CG'
  },
  'EDH-5003': {
    dokuro: 'EDH-5003',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87305', '13715-87304'],
    vehicle: 'DELTA 2530CC (DV2# / 3#)',
    year: '69~77',
    engine: 'DG',
    cyl: '4 Cil.',
    head_dia: 33.00,
    stem_dia: 9.00,
    length: 136.20,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'IDH-0004': {
    dokuro: 'IDH-0004',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87701', '13711-87702', '13711-87705', 'AA100-12-111'],
    vehicle: 'HI JET/CHARADE 547/1000CC (S4#/5#/6#7# G10/11/100)',
    year: '77~',
    engine: 'AB/CB',
    cyl: '3/4 Cil.',
    head_dia: 36.00,
    stem_dia: 7.00,
    length: 101.60,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'EDH-5004': {
    dokuro: 'EDH-5004',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87701', '13715-87702', 'AA100-12-121'],
    vehicle: 'HI JET/CHARADE 547/1000CC (S4#/5#/6#7# G10/11/100)',
    year: '77~',
    engine: 'AB/CB',
    cyl: '3/4 Cil.',
    head_dia: 33.00,
    stem_dia: 7.00,
    length: 101.60,
    angle: 45,
    style: 'ST',
    stem_end: 'CG'
  },
  'IDH-0005': {
    dokuro: 'IDH-0005',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87306'],
    vehicle: 'DELTA 2530CC (DV26/36)',
    year: '77~',
    engine: 'DG',
    cyl: '4 Cil.',
    head_dia: 40.00,
    stem_dia: 9.00,
    length: 127.60,
    angle: 45,
    style: 'F',
    stem_end: 'MG'
  },
  'EDH-5005': {
    dokuro: 'EDH-5005',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87307', '13715-87309', '13715-87311'],
    vehicle: 'DELTA 2530CC (DV26/36)',
    year: '77~',
    engine: 'DG',
    cyl: '4 Cil.',
    head_dia: 33.00,
    stem_dia: 9.00,
    length: 127.70,
    angle: 45,
    style: 'F',
    stem_end: 'MG'
  },
  'IDH-0006': {
    dokuro: 'IDH-0006',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87308'],
    vehicle: 'DELTA 2500/2800CC BUS TAFT (DV2#/3#, SV18/26/32, F50/60)',
    year: '67',
    engine: 'DG/DL',
    cyl: '4 Cil.',
    head_dia: 40.00,
    stem_dia: 9.00,
    length: 127.60,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'EDH-5006': {
    dokuro: 'EDH-5006',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87308'],
    vehicle: 'DELTA 2500/2800CC BUS TAFT (DV2#/3#, SV18/26/32, F50/60)',
    year: '67',
    engine: 'DG/DL',
    cyl: '4 Cil.',
    head_dia: 33.00,
    stem_dia: 9.00,
    length: 127.60,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'IDH-0007': {
    dokuro: 'IDH-0007',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87704'],
    vehicle: 'CHARADE 993CC (G30/G101)',
    year: '82~',
    engine: 'CL',
    cyl: '3 Cil.',
    head_dia: 36.00,
    stem_dia: 7.00,
    length: 104.90,
    angle: 45,
    style: 'ST',
    stem_end: 'CG'
  },
  'EDH-5007': {
    dokuro: 'EDH-5007',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87703'],
    vehicle: 'CHARADE 993CC (G30/G101)',
    year: '82~',
    engine: 'CL',
    cyl: '3 Cil.',
    head_dia: 32.00,
    stem_dia: 7.00,
    length: 105.10,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'IDH-0008': {
    dokuro: 'IDH-0008',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87312', '13711-87314'],
    vehicle: 'DELTA 2800CC',
    year: '85~',
    engine: 'DL',
    cyl: '4 Cil.',
    head_dia: 42.00,
    stem_dia: 9.00,
    length: 127.60,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'EDH-5008': {
    dokuro: 'EDH-5008',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87319', '13715-87317', '13715-87322'],
    vehicle: 'DELTA 2800CC',
    year: '85~',
    engine: 'DL',
    cyl: '4 Cil.',
    head_dia: 35.00,
    stem_dia: 9.00,
    length: 127.60,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'IDH-0010': {
    dokuro: 'IDH-0010',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87104', '13711-87103'],
    vehicle: 'CHARADE 1300CC / APPLAUSE 1600CC / FEROZA (G101/A101)',
    year: '89~',
    engine: 'HC / HD',
    cyl: '4 Cil.',
    head_dia: 30.00,
    stem_dia: 6.60,
    length: 112.60,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'EDH-5010': {
    dokuro: 'EDH-5010',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87106', '13715-87105'],
    vehicle: 'CHARADE 1300CC / APPLAUSE 1600CC / FEROZA (G101/A101)',
    year: '89~',
    engine: 'HC / HD',
    cyl: '4 Cil.',
    head_dia: 26.00,
    stem_dia: 6.60,
    length: 114.80,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'IDH-0013': {
    dokuro: 'IDH-0013',
    pos: 'IN',
    tipo: 'Admisión',
    refs: ['13711-87201'],
    vehicle: 'KANCIL 660CC (L200)',
    year: '—',
    engine: 'EF / CL',
    cyl: '3 Cil.',
    head_dia: 30.00,
    stem_dia: 7.00,
    length: 112.50,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  },
  'EDH-5013': {
    dokuro: 'EDH-5013',
    pos: 'EX',
    tipo: 'Escape',
    refs: ['13715-87201'],
    vehicle: 'KANCIL 660CC (L200)',
    year: '—',
    engine: 'EF / CL',
    cyl: '3 Cil.',
    head_dia: 26.00,
    stem_dia: 7.00,
    length: 112.60,
    angle: 45,
    style: 'F',
    stem_end: 'CG'
  }
};

function formatVehicleString(lines) {
  if (!lines || !lines.length) return '';
  const filtered = lines
    .map(l => String(l).trim())
    .filter(l => l && l !== '/' && l !== 'Ne' && l !== '-' && l !== '—' && !l.startsWith('http'));
  if (!filtered.length) return '';
  
  // Combine nicely
  if (filtered.length === 1) return filtered[0];
  const main = filtered[0];
  const rest = filtered.slice(1).join(', ');
  return `${main} (${rest})`;
}

function formatYearString(lines) {
  if (!lines || !lines.length) return '';
  return lines.map(l => String(l).trim()).filter(Boolean).join(', ');
}

function formatCylString(lines) {
  if (!lines || !lines.length) return '';
  const c = lines[0].trim();
  if (c.toLowerCase().includes('cil')) return c;
  return `${c} Cil.`;
}

async function runEnrichment() {
  console.log('=== ENRIQUECIMIENTO Y LIMPIEZA DE CATÁLOGO DOKURO ===');

  // 1. Cargar datos auditados
  console.log('1. Cargando RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json...');
  const auditData = JSON.parse(fs.readFileSync('RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json', 'utf8'));

  // 2. Cargar todos los repuestos Dokuro existentes en Supabase
  console.log('2. Obteniendo repuestos Dokuro desde Supabase...');
  let allDbParts = [];
  let from = 0;
  while (true) {
    const { data: batch, error } = await supabase
      .from('repuestos_tecnicos')
      .select('id, codigo_oem, nombre, categoria, dimensiones, especificaciones_tecnicas, motor_id')
      .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' })
      .range(from, from + 999);
    if (error) {
      console.error('Error cargando repuestos:', error);
      return;
    }
    if (!batch || batch.length === 0) break;
    allDbParts.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  console.log(`✓ Total repuestos Dokuro en DB: ${allDbParts.length}`);

  // 3. Eliminar partes de motocicletas (páginas 63-74) que no tienen medidas ni aplican a taller rectificador
  console.log('3. Identificando y purgando partes de motocicletas / sin dimensiones...');
  const motoIds = new Set();
  for (const item of auditData) {
    if ((item.subtipos || []).includes('motorcycle')) {
      if (item.codigo_catalogo) motoIds.add(item.codigo_catalogo.toUpperCase());
      if (item.codigo_dokuro) motoIds.add(item.codigo_dokuro.toUpperCase());
      for (const r of item.referencias || []) motoIds.add(r.toUpperCase());
    }
  }

  const idsToDelete = [];
  const validDbParts = [];
  for (const p of allDbParts) {
    const code = p.codigo_oem?.toUpperCase();
    const dok = p.especificaciones_tecnicas?.codigo_dokuro?.toUpperCase();
    const nameLower = (p.nombre || '').toLowerCase();

    const isMoto = motoIds.has(code) ||
      motoIds.has(dok) ||
      p.especificaciones_tecnicas?.subtipo === 'motorcycle' ||
      nameLower.includes('(yamaha)') ||
      nameLower.includes('(kawasaki)') ||
      (p.categoria === 'Válvulas' && !p.dimensiones?.diametro_cabeza_mm && !p.dimensiones?.hongo_mm && (/^\d{3}-\d{5}/.test(code || '') || /^\d{5}-\d{3}/.test(code || '')));

    if (isMoto) {
      idsToDelete.push(p.id);
    } else {
      validDbParts.push(p);
    }
  }

  if (idsToDelete.length > 0) {
    console.log(`🗑 Eliminando ${idsToDelete.length} partes de motocicletas...`);
    const delChunks = chunkArray(idsToDelete, 100);
    for (const chunk of delChunks) {
      // Eliminar equivalencias primero
      await supabase.from('equivalencias_repuestos').delete().in('repuesto_id', chunk);
      // Eliminar repuestos
      await supabase.from('repuestos_tecnicos').delete().in('id', chunk);
    }
    console.log(`✓ Purgadas ${idsToDelete.length} partes de motos exitosamente.`);
  }

  // 4. Mapear repuestos existentes por código
  const dbPartMap = new Map();
  for (const p of validDbParts) {
    if (p.codigo_oem) dbPartMap.set(p.codigo_oem.toUpperCase(), p);
    const dok = p.especificaciones_tecnicas?.codigo_dokuro;
    if (dok) dbPartMap.set(dok.toUpperCase(), p);
  }

  // 5. Cargar Fabricantes y Motores para vinculación precisa
  const { data: dbFabs } = await supabase.from('fabricantes').select('id, nombre');
  const fabMap = new Map();
  for (const f of dbFabs || []) {
    fabMap.set(f.nombre.toUpperCase(), f.id);
  }

  // 6. Procesar Válvulas Automotrices (Passenger & Truck)
  console.log('4. Procesando y enriqueciendo válvulas automotrices Dokuro...');
  const passValves = auditData.filter(x => x.tipo_producto === 'engine_valve' && (x.subtipos || []).includes('passenger_truck'));
  console.log(`✓ Válvulas automotrices en JSON auditado: ${passValves.length}`);

  let updatedCount = 0;
  let insertedCount = 0;
  const equivalenciasToUpsert = [];

  for (const item of passValves) {
    let dokuroCode = item.codigo_dokuro ? String(item.codigo_dokuro).trim().toUpperCase() : null;
    if (dokuroCode && dokuroCode.startsWith('TDH-')) dokuroCode = 'I' + dokuroCode.slice(1);
    if (dokuroCode && dokuroCode.startsWith('1DH-')) dokuroCode = 'I' + dokuroCode.slice(1);

    const catalogCode = item.codigo_catalogo ? String(item.codigo_catalogo).trim().toUpperCase() : dokuroCode;
    const rawBrand = (item.fabricantes && item.fabricantes[0]) || 'Universal';
    const cleanBrand = rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1).toLowerCase();

    const app = (item.aplicaciones && item.aplicaciones[0]) || {};
    const pos = (app.position || 'IN').toUpperCase().trim();
    const posNombre = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : (pos === 'AU' ? 'Auxiliar' : pos));

    let vehicleStr = formatVehicleString(app.vehicle_model_lines || app.application_lines);
    let yearStr = formatYearString(app.year_lines);
    let cylStr = formatCylString(app.cyl_lines);
    let engineCodes = app.engine_type_lines || app.engine_models || [];
    let engineStr = engineCodes.filter(Boolean).join('/');

    let headDia = app.head_dia_mm ? Number(app.head_dia_mm) : null;
    let stemDia = app.stem_dia_mm ? Number(app.stem_dia_mm) : null;
    let overallLen = app.overall_length_mm ? Number(app.overall_length_mm) : null;
    let seatAngle = app.seat_angle_deg ? Number(app.seat_angle_deg) : 45;
    let headStyle = app.head_style || null;
    let stemEnd = app.stem_end || null;

    let oemRefs = (item.referencias || []).map(r => String(r).trim().toUpperCase()).filter(Boolean);

    // Overwrite with Page 11 Ground Truth if this is one of the Daihatsu valves from Image 2
    if (dokuroCode && PAGE_11_TRUTH[dokuroCode]) {
      const truth = PAGE_11_TRUTH[dokuroCode];
      vehicleStr = truth.vehicle;
      yearStr = truth.year;
      cylStr = truth.cyl;
      engineStr = truth.engine;
      headDia = truth.head_dia;
      stemDia = truth.stem_dia;
      overallLen = truth.length;
      seatAngle = truth.angle;
      headStyle = truth.style;
      stemEnd = truth.stem_end;
      oemRefs = truth.refs;
    }

    const primaryCode = dokuroCode || catalogCode || (oemRefs[0] || `DOK-${item.id}`);
    const valveName = `Válvula de ${posNombre} ${engineStr ? `Motor ${engineStr}` : ''} (${cleanBrand}) - Dokuro ${primaryCode}`.trim();

    // Buscar si ya existe en Supabase
    let existing = dbPartMap.get(primaryCode) || (dokuroCode ? dbPartMap.get(dokuroCode) : null);
    if (!existing && catalogCode) existing = dbPartMap.get(catalogCode);
    if (!existing) {
      for (const r of oemRefs) {
        if (dbPartMap.has(r)) {
          existing = dbPartMap.get(r);
          break;
        }
      }
    }

    const targetId = existing ? existing.id : crypto.randomUUID();

    const dimensionesObj = {
      catalogo: 'Dokuro',
      hongo_mm: headDia,
      diametro_cabeza_mm: headDia,
      diametro_vastago_mm: stemDia,
      longitud_total_mm: overallLen,
      angulo_asiento_grados: seatAngle,
      head_style: headStyle,
      stem_end: stemEnd,
      posicion: pos,
      tipo_valvula: posNombre
    };

    const especificacionesObj = {
      marca_catalogo: 'DOKURO',
      catalogo_origen: 'Dokuro',
      tipo_producto: 'engine_valve',
      codigo_dokuro: dokuroCode || primaryCode,
      codigo_catalogo: catalogCode || primaryCode,
      vehiculo: vehicleStr || null,
      ano: yearStr || null,
      cilindros: cylStr || null,
      motores_compatibles: engineCodes.length ? engineCodes : (engineStr ? [engineStr] : []),
      referencias_oem: oemRefs,
      fabricantes: item.fabricantes || [cleanBrand.toUpperCase()],
      paginas_pdf: item.paginas_pdf || [],
      fuente: 'Catalogo-DOKURO.pdf'
    };

    const recordToSave = {
      id: targetId,
      codigo_oem: primaryCode,
      nombre: valveName,
      subsistema: 'Culata',
      categoria: 'Válvulas',
      precio: 0.00,
      stock: 8,
      estado: 'Disponible',
      diametro_cabeza_mm: headDia,
      diametro_vastago_mm: stemDia,
      longitud_total_mm: overallLen,
      angulo_asiento_grados: seatAngle,
      dimensiones: dimensionesObj,
      especificaciones_tecnicas: especificacionesObj
    };

    if (existing) {
      // Actualizar registro existente
      const { error: updErr } = await supabase
        .from('repuestos_tecnicos')
        .update({
          codigo_oem: primaryCode,
          nombre: valveName,
          diametro_cabeza_mm: headDia,
          diametro_vastago_mm: stemDia,
          longitud_total_mm: overallLen,
          angulo_asiento_grados: seatAngle,
          dimensiones: dimensionesObj,
          especificaciones_tecnicas: especificacionesObj
        })
        .eq('id', targetId);

      if (updErr) {
        console.error(`Error actualizando ${primaryCode}:`, updErr.message);
      } else {
        updatedCount++;
      }
    } else {
      // Insertar nuevo registro
      const { error: insErr } = await supabase
        .from('repuestos_tecnicos')
        .insert([recordToSave]);

      if (insErr) {
        console.error(`Error insertando ${primaryCode}:`, insErr.message);
      } else {
        insertedCount++;
        dbPartMap.set(primaryCode, recordToSave);
      }
    }

    // Preparar equivalencias cruzadas (Dokuro + referencias OEM)
    if (dokuroCode) {
      equivalenciasToUpsert.push({
        repuesto_id: targetId,
        marca_alterna: 'Dokuro',
        codigo_alterno: dokuroCode,
        tipo_referencia: 'Código Directo Dokuro',
        notas: `Dokuro Japón - Válvula de ${posNombre}`,
        especificaciones_tecnicas: { origen: 'DOKURO', fabricante: cleanBrand }
      });
    }

    for (const ref of oemRefs) {
      if (ref !== dokuroCode) {
        equivalenciasToUpsert.push({
          repuesto_id: targetId,
          marca_alterna: 'OEM',
          codigo_alterno: ref,
          tipo_referencia: 'Referencia Original OEM',
          notas: `Referencia OEM cruzada para Dokuro ${primaryCode}`,
          especificaciones_tecnicas: { origen: 'DOKURO', codigo_dokuro: dokuroCode }
        });
      }
    }
  }

  console.log(`✓ Válvulas actualizadas: ${updatedCount}, insertadas: ${insertedCount}`);

  // 7. Insertar/Actualizar equivalencias en lotes
  if (equivalenciasToUpsert.length > 0) {
    console.log(`5. Actualizando ${equivalenciasToUpsert.length} equivalencias de válvulas...`);
    // Borrar equivalencias anteriores de Dokuro para evitar duplicados
    const repuestoIds = [...new Set(equivalenciasToUpsert.map(e => e.repuesto_id))];
    const repChunks = chunkArray(repuestoIds, 100);
    for (const ch of repChunks) {
      await supabase.from('equivalencias_repuestos').delete().in('repuesto_id', ch);
    }

    const eqChunks = chunkArray(equivalenciasToUpsert, 200);
    for (const ch of eqChunks) {
      const rows = ch.map(e => ({
        id: crypto.randomUUID(),
        ...e
      }));
      const { error: eqErr } = await supabase.from('equivalencias_repuestos').insert(rows);
      if (eqErr) console.error('Error insertando equivalencias:', eqErr.message);
    }
    console.log(`✓ Equivalencias de Dokuro listas.`);
  }

  // 8. Actualizar Guías de Válvula con metadatos consistentes
  console.log('6. Verificando metadatos de Guías de Válvula Dokuro...');
  const { data: dbGuides } = await supabase
    .from('repuestos_tecnicos')
    .select('id, codigo_oem, dimensiones, especificaciones_tecnicas')
    .eq('categoria', 'Guías')
    .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' });

  for (const g of dbGuides || []) {
    const dims = g.dimensiones || {};
    const specs = g.especificaciones_tecnicas || {};
    let needsUpdate = false;

    if (!dims.catalogo) {
      dims.catalogo = 'Dokuro';
      needsUpdate = true;
    }
    if (!specs.catalogo_origen) {
      specs.catalogo_origen = 'Dokuro';
      needsUpdate = true;
    }

    if (needsUpdate) {
      await supabase
        .from('repuestos_tecnicos')
        .update({ dimensiones: dims, especificaciones_tecnicas: specs })
        .eq('id', g.id);
    }
  }
  console.log(`✓ Guías de válvula verificadas (${dbGuides?.length || 0} registros).`);

  console.log('=== ENRIQUECIMIENTO FINALIZADO CON ÉXITO ===');
}

runEnrichment();

