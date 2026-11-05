import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

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

// Mapeo normalizado de marcas de catálogo Dokuro a nombres estándar
const BRAND_MAPPING = {
  'TOYOTA': { nombre: 'Toyota', pais: 'Japón' },
  'NISSAN': { nombre: 'Nissan', pais: 'Japón' },
  'MITSUBISHI': { nombre: 'Mitsubishi', pais: 'Japón' },
  'ISUZU': { nombre: 'Isuzu', pais: 'Japón' },
  'HONDA': { nombre: 'Honda', pais: 'Japón' },
  'HYUNDAI': { nombre: 'Hyundai', pais: 'Corea del Sur' },
  'FORD': { nombre: 'Ford', pais: 'Estados Unidos' },
  'HINO': { nombre: 'Hino', pais: 'Japón' },
  'MAZDA': { nombre: 'Mazda', pais: 'Japón' },
  'MAZDA/FORD': { nombre: 'Mazda', pais: 'Japón' },
  'DAIHATSU': { nombre: 'Daihatsu', pais: 'Japón' },
  'SUBARU': { nombre: 'Subaru', pais: 'Japón' },
  'SUZUKI': { nombre: 'Suzuki', pais: 'Japón' },
  'KOMATSU': { nombre: 'Komatsu', pais: 'Japón' },
  'KIA': { nombre: 'Kia', pais: 'Corea del Sur' },
  'DAEWOO': { nombre: 'Daewoo', pais: 'Corea del Sur' },
  'ASIA': { nombre: 'Asia Multimarca', pais: 'Corea del Sur' },
  'CATAPILLAR': { nombre: 'Caterpillar', pais: 'Estados Unidos' },
  'CATERPILLAR': { nombre: 'Caterpillar', pais: 'Estados Unidos' },
  'KUBOTA': { nombre: 'Kubota', pais: 'Japón' },
  'KAWASAKI': { nombre: 'Kawasaki', pais: 'Japón' },
  'YAMAHA': { nombre: 'Yamaha', pais: 'Japón' },
  'SSANGYONG': { nombre: 'SsangYong', pais: 'Corea del Sur' }
};

// Expansor y normalizador de rangos OEM
function expandReferenceRange(raw) {
  raw = String(raw).trim().replace(/[-/]+$/, '');
  if (!raw) return [];
  // Caso como 13715-87101/4 o 13711-87701/2
  const slashMatch = raw.match(/^([A-Z0-9]+-[A-Z0-9]*?)(\d+)\/(\d+)$/i);
  if (slashMatch) {
    const prefix = slashMatch[1];
    const startStr = slashMatch[2];
    const endStr = slashMatch[3];
    const startNum = parseInt(startStr, 10);
    let endNum = parseInt(endStr, 10);
    if (endStr.length < startStr.length) {
      const base = startStr.slice(0, startStr.length - endStr.length);
      endNum = parseInt(base + endStr, 10);
    }
    const results = [];
    if (!isNaN(startNum) && !isNaN(endNum) && endNum >= startNum && endNum - startNum <= 20) {
      for (let n = startNum; n <= endNum; n++) {
        results.push(prefix + String(n).padStart(startStr.length, '0'));
      }
      return results;
    }
  }
  return [raw];
}

function normalizeAllReferences(rawRefs) {
  const result = [];
  let lastPrefix = '';
  for (const r of rawRefs || []) {
    let clean = String(r).trim().replace(/[-/]+$/, '');
    if (!clean) continue;

    // Detectar sufijo como -87102 o 87304
    if (clean.startsWith('-') && lastPrefix) {
      clean = lastPrefix + clean;
    } else if (/^\d{4,6}$/.test(clean) && lastPrefix) {
      clean = lastPrefix + '-' + clean;
    } else if (clean.includes('-')) {
      const parts = clean.split('-');
      lastPrefix = parts[0];
    }

    const expanded = expandReferenceRange(clean);
    result.push(...expanded);
  }
  return [...new Set(result.map(x => x.trim().toUpperCase()).filter(x => x.length >= 3))];
}

// Extractor limpio de motores
function extractCleanEngines(rawList) {
  const result = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'string') continue;
    let s = raw.toUpperCase().trim();
    s = s.replace(/\([^)]*\)/g, ' ');
    const parts = s.split(/[\/,\s]+/).map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      if (['SEAL', 'TYPE', 'WITH', 'WITHOUT', 'OLD', 'NEW', 'SELECT', 'NULL', 'LINE', 'IN', 'EX', 'LOW', 'CAM', 'HIGH'].includes(p)) continue;
      const clean = p.replace(/[-_]+$/, '').replace(/^[-_]+/, '');
      if (clean.length >= 2 && !result.includes(clean)) {
        result.push(clean);
      }
    }
  }
  return result;
}

// Extractor de longitud en remarks de guías
function parseGuideLength(remarks) {
  if (!remarks || typeof remarks !== 'string') return null;
  const match = remarks.match(/(\d+(?:\.\d+)?)\s*mm/i) || remarks.match(/length\s*(\d+(?:\.\d+)?)/i);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val >= 20 && val <= 250) return val;
  }
  return null;
}

async function runImport() {
  console.log('--- INICIO DE INGESTA ESTRUCTURADA DE DOKURO 2006 ---');

  // 1. Cargar fabricantes
  console.log('1. Cargando fabricantes de Supabase...');
  const { data: dbFabs } = await supabase.from('fabricantes').select('id, nombre');
  const fabMap = new Map();
  for (const f of dbFabs || []) {
    fabMap.set(f.nombre.toUpperCase().trim(), f.id);
  }
  const defaultFabId = fabMap.get('TOYOTA') || dbFabs?.[0]?.id;

  function resolveFabricanteId(rawBrand) {
    if (!rawBrand) return defaultFabId;
    const clean = rawBrand.trim().toUpperCase();
    const mapped = BRAND_MAPPING[clean];
    if (mapped && fabMap.has(mapped.nombre.toUpperCase())) {
      return fabMap.get(mapped.nombre.toUpperCase());
    }
    if (fabMap.has(clean)) {
      return fabMap.get(clean);
    }
    return defaultFabId;
  }

  // 2. Cargar todos los motores existentes en memoria
  console.log('2. Cargando motores existentes en base de datos...');
  let allMotors = [];
  let from = 0;
  while (true) {
    const { data: mBatch } = await supabase
      .from('motores')
      .select('id, codigo, fabricante_id, fabricante:fabricantes(nombre)')
      .range(from, from + 999);
    if (!mBatch || mBatch.length === 0) break;
    allMotors.push(...mBatch);
    if (mBatch.length < 1000) break;
    from += 1000;
  }
  console.log(`✓ Motores cargados: ${allMotors.length}`);

  const motorByFabAndCode = new Map();
  const motorByCode = new Map();
  for (const m of allMotors) {
    const clean = m.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fabId = m.fabricante_id;
    if (fabId) motorByFabAndCode.set(`${fabId}:${clean}`, m.id);
    if (!motorByCode.has(clean)) motorByCode.set(clean, m.id);
  }

  // 3. Cargar JSON auditado de Dokuro
  console.log('3. Leyendo RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json...');
  const catalogData = JSON.parse(fs.readFileSync('RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json', 'utf8'));
  console.log(`✓ ${catalogData.length} registros cargados de Dokuro.`);

  // 4. Identificar y crear motores faltantes con códigos limpios
  console.log('4. Identificando motores faltantes en Dokuro...');
  const newEnginesToInsert = new Map();

  for (const item of catalogData) {
    const rawBrand = (item.fabricantes && item.fabricantes[0]) || '';
    const fabId = resolveFabricanteId(rawBrand);
    const brandEntry = dbFabs.find(f => f.id === fabId);
    const brandName = brandEntry ? brandEntry.nombre : 'Motor';

    for (const app of (item.aplicaciones || [])) {
      const appBrand = app.fabricante || rawBrand;
      const targetFabId = resolveFabricanteId(appBrand);
      const appBrandName = dbFabs.find(f => f.id === targetFabId)?.nombre || brandName;

      const rawEngines = [
        ...(app.engine_type_lines || []),
        app.engine_type,
        ...(app.engine_models || [])
      ].filter(Boolean);

      const cleanEngines = extractCleanEngines(rawEngines);
      for (const code of cleanEngines) {
        const norm = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const key = `${targetFabId}:${norm}`;

        if (!motorByFabAndCode.has(key) && !newEnginesToInsert.has(key)) {
          let cyl = 4;
          if (app.cyl_lines && app.cyl_lines[0]) {
            const num = parseInt(app.cyl_lines[0], 10);
            if (!isNaN(num) && num > 0 && num <= 16) cyl = num;
          } else if (app.cylinders && app.cylinders[0]) {
            const num = parseInt(app.cylinders[0], 10);
            if (!isNaN(num) && num > 0 && num <= 16) cyl = num;
          }

          let disp = null;
          if (app.displacement_cc && app.displacement_cc[0]) {
            const num = parseInt(app.displacement_cc[0], 10);
            if (!isNaN(num) && num > 0 && num <= 30000) disp = num;
          }

          newEnginesToInsert.set(key, {
            id: crypto.randomUUID(),
            fabricante_id: targetFabId,
            codigo: code,
            nombre_comercial: `${appBrandName} ${code}`,
            cilindros: cyl,
            valvulas: cyl === 4 ? 16 : cyl * 2,
            cilindrada_cc: disp,
            combustible: 'Gasolina/Diésel',
            especificaciones_tecnicas: {
              fuente: 'DOKURO 2006 Estructurado',
              vehiculos: app.vehicle_model_lines || []
            }
          });
        }
      }
    }
  }

  if (newEnginesToInsert.size > 0) {
    console.log(`➕ Insertando ${newEnginesToInsert.size} motores limpios en Supabase...`);
    const enginesList = Array.from(newEnginesToInsert.values());
    const engineChunks = chunkArray(enginesList, 100);
    for (const chunk of engineChunks) {
      const { data: inserted, error } = await supabase.from('motores').insert(chunk).select('id, codigo, fabricante_id');
      if (error) {
        console.error('Error insertando motores:', error.message);
      } else if (inserted) {
        for (const m of inserted) {
          const norm = m.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
          motorByFabAndCode.set(`${m.fabricante_id}:${norm}`, m.id);
          if (!motorByCode.has(norm)) motorByCode.set(norm, m.id);
        }
      }
    }
    console.log(`✓ Motores listos.`);
  }

  // 5. Preparar Repuestos Técnicos y Equivalencias
  console.log('5. Clasificando y transformando repuestos en las 3 familias de Dokuro...');
  const repuestosRows = [];
  const equivalenciasRows = [];

  for (const item of catalogData) {
    const repuestoId = crypto.randomUUID();
    const rawBrand = (item.fabricantes && item.fabricantes[0]) || '';
    const fabId = resolveFabricanteId(rawBrand);
    const brandEntry = dbFabs.find(f => f.id === fabId);
    const brandName = brandEntry ? brandEntry.nombre : (rawBrand || 'Universal');

    // Extraer motores compatibles limpios
    const allCleanEngines = [];
    let primaryMotorId = null;

    for (const app of (item.aplicaciones || [])) {
      const rawEngines = [
        ...(app.engine_type_lines || []),
        app.engine_type,
        ...(app.engine_models || [])
      ].filter(Boolean);

      const clean = extractCleanEngines(rawEngines);
      for (const c of clean) {
        if (!allCleanEngines.includes(c)) allCleanEngines.push(c);
        if (!primaryMotorId) {
          const norm = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
          primaryMotorId = motorByFabAndCode.get(`${fabId}:${norm}`) || motorByCode.get(norm);
        }
      }
    }

    const normalizedRefs = normalizeAllReferences(item.referencias || []);
    const dokuroCode = item.codigo_dokuro ? String(item.codigo_dokuro).trim().toUpperCase() : null;
    const catalogCode = item.codigo_catalogo ? String(item.codigo_catalogo).trim().toUpperCase() : null;
    const motoresStr = allCleanEngines.length > 0 ? allCleanEngines.slice(0, 3).join('/') : '';

    // =========================================================================
    // FAMILIA 1: VÁLVULAS DE MOTOR (engine_valve -> Grupo: valvula)
    // =========================================================================
    if (item.tipo_producto === 'engine_valve') {
      const app = (item.aplicaciones && item.aplicaciones[0]) || {};
      const pos = app.position ? app.position.trim().toUpperCase() : 'IN';
      const posNombre = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : (pos === 'AU' ? 'Auxiliar' : pos));

      const diamCabeza = app.head_dia_mm ? Number(app.head_dia_mm) : null;
      const diamVastago = app.stem_dia_mm ? Number(app.stem_dia_mm) : null;
      const longTotal = app.overall_length_mm ? Number(app.overall_length_mm) : null;
      const angulo = app.seat_angle_deg ? Number(app.seat_angle_deg) : null;

      // Código principal visible en tabla
      const primaryCode = dokuroCode || catalogCode || (normalizedRefs.length > 0 ? normalizedRefs[0] : `DOK-${item.id}`);

      // Nombre limpio estandarizado
      const nombre = `Válvula de ${posNombre} ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName}) - Dokuro ${primaryCode}`.trim();

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: primaryCode,
        nombre,
        subsistema: 'Culata',
        categoria: 'Válvulas',
        precio: 0.00,
        stock: 8,
        estado: 'Disponible',
        imagen_url: null,
        diametro_cabeza_mm: diamCabeza,
        diametro_vastago_mm: diamVastago,
        longitud_total_mm: longTotal,
        angulo_asiento_grados: angulo,
        diametro_cilindro_mm: null,
        espesor_anillo1_mm: null,
        espesor_anillo2_mm: null,
        espesor_aceite_mm: null,
        tipo_cojinete: null,
        diametro_munon_mm: null,
        diametro_alojamiento_mm: null,
        ancho_casquete_mm: null,
        dimensiones: {
          posicion: pos,
          tipo_valvula: posNombre,
          diametro_cabeza_mm: diamCabeza,
          diametro_vastago_mm: diamVastago,
          longitud_total_mm: longTotal,
          angulo_asiento_grados: angulo,
          head_style: app.head_style || null,
          stem_end: app.stem_end || null
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'DOKURO',
          tipo_producto: 'engine_valve',
          codigo_dokuro: dokuroCode,
          codigo_catalogo: catalogCode,
          fabricantes: item.fabricantes || [brandName],
          motores_compatibles: allCleanEngines,
          referencias_oem: normalizedRefs,
          paginas_pdf: item.paginas_pdf || [],
          fuente: 'Catalogo-DOKURO.pdf'
        }
      };
      repuestosRows.push(repuestoRow);

      // Equivalencias: Dokuro + todos los cruces OEM
      const addedCodes = new Set();
      if (dokuroCode) {
        addedCodes.add(dokuroCode);
        equivalenciasRows.push({
          id: crypto.randomUUID(),
          repuesto_id: repuestoId,
          marca_alterna: 'Dokuro',
          codigo_alterno: dokuroCode,
          tipo_referencia: 'Código Directo Dokuro',
          notas: `Dokuro Japón - Válvula de ${posNombre}`,
          especificaciones_tecnicas: { origen: 'DOKURO', fabricante: brandName }
        });
      }

      for (const ref of normalizedRefs) {
        if (!addedCodes.has(ref)) {
          addedCodes.add(ref);
          equivalenciasRows.push({
            id: crypto.randomUUID(),
            repuesto_id: repuestoId,
            marca_alterna: 'OEM',
            codigo_alterno: ref,
            tipo_referencia: 'Referencia Original OEM',
            notas: `Referencia OEM cruzada para Dokuro ${primaryCode}`,
            especificaciones_tecnicas: { origen: 'DOKURO', codigo_dokuro: dokuroCode }
          });
        }
      }

    // =========================================================================
    // FAMILIA 2: GUÍAS DE VÁLVULA (valve_guide -> Grupo: guias_valvula)
    // =========================================================================
    } else if (item.tipo_producto === 'valve_guide') {
      const app = (item.aplicaciones && item.aplicaciones[0]) || {};
      const pos = app.position ? app.position.trim().toUpperCase() : 'IN/EX';
      const posLabel = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : 'Admisión/Escape');
      const setQty = app.set ? Number(app.set) : 4;
      const guideLen = parseGuideLength(app.remarks);

      const primaryCode = catalogCode || dokuroCode || (normalizedRefs.length > 0 ? normalizedRefs[0] : `DOK-G-${item.id}`);
      const nombre = `Guía de Válvula ${posLabel} ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName}) - Dokuro ${primaryCode}`.trim();

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: primaryCode,
        nombre,
        subsistema: 'Culata',
        categoria: 'Guías',
        precio: 0.00,
        stock: 8,
        estado: 'Disponible',
        imagen_url: null,
        diametro_cabeza_mm: null,
        diametro_vastago_mm: null,
        longitud_total_mm: guideLen,
        angulo_asiento_grados: null,
        diametro_cilindro_mm: null,
        espesor_anillo1_mm: null,
        espesor_anillo2_mm: null,
        espesor_aceite_mm: null,
        tipo_cojinete: null,
        diametro_munon_mm: null,
        diametro_alojamiento_mm: null,
        ancho_casquete_mm: null,
        dimensiones: {
          posicion: pos,
          set: setQty,
          longitud_total_mm: guideLen,
          remarks: app.remarks || null
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'DOKURO',
          tipo_producto: 'valve_guide',
          codigo_dokuro: dokuroCode,
          codigo_catalogo: catalogCode,
          fabricantes: item.fabricantes || [brandName],
          motores_compatibles: allCleanEngines,
          referencias_oem: normalizedRefs,
          paginas_pdf: item.paginas_pdf || [],
          fuente: 'Catalogo-DOKURO.pdf'
        }
      };
      repuestosRows.push(repuestoRow);

      const addedCodes = new Set();
      if (primaryCode) {
        addedCodes.add(primaryCode);
        equivalenciasRows.push({
          id: crypto.randomUUID(),
          repuesto_id: repuestoId,
          marca_alterna: 'Dokuro',
          codigo_alterno: primaryCode,
          tipo_referencia: 'Guía de Válvula Dokuro',
          notas: `Dokuro Japón - Juego de ${setQty} pzs`,
          especificaciones_tecnicas: { origen: 'DOKURO' }
        });
      }

      for (const ref of normalizedRefs) {
        if (!addedCodes.has(ref)) {
          addedCodes.add(ref);
          equivalenciasRows.push({
            id: crypto.randomUUID(),
            repuesto_id: repuestoId,
            marca_alterna: 'OEM',
            codigo_alterno: ref,
            tipo_referencia: 'Referencia Original Guía',
            notas: `Referencia OEM para Dokuro ${primaryCode}`,
            especificaciones_tecnicas: { origen: 'DOKURO' }
          });
        }
      }

      // Si en remarks hay un número de parte cruzado, añadirlo como equivalencia
      if (app.remarks && /^[A-Z0-9]{3,}-[A-Z0-9]+$/i.test(app.remarks.trim())) {
        const remCode = app.remarks.trim().toUpperCase();
        if (!addedCodes.has(remCode)) {
          addedCodes.add(remCode);
          equivalenciasRows.push({
            id: crypto.randomUUID(),
            repuesto_id: repuestoId,
            marca_alterna: 'OEM',
            codigo_alterno: remCode,
            tipo_referencia: 'Cruce Técnico Remark',
            notas: `Referencia alterna de catálogo Dokuro`,
            especificaciones_tecnicas: { origen: 'DOKURO' }
          });
        }
      }

    // =========================================================================
    // FAMILIA 3: ASIENTOS DE VÁLVULA (valve_seat -> Grupo: asientos_valvula)
    // =========================================================================
    } else if (item.tipo_producto === 'valve_seat') {
      const app = (item.aplicaciones && item.aplicaciones[0]) || {};
      const pos = app.position ? app.position.trim().toUpperCase() : 'IN';
      const posLabel = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : pos);
      const cylStr = app.cylinders ? app.cylinders.join('/') : null;

      const primaryCode = catalogCode || dokuroCode || (normalizedRefs.length > 0 ? normalizedRefs[0] : `DOK-S-${item.id}`);
      const nombre = `Asiento de Válvula ${posLabel} ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName}) - Dokuro ${primaryCode}`.trim();

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: primaryCode,
        nombre,
        subsistema: 'Culata',
        categoria: 'Asientos',
        precio: 0.00,
        stock: 8,
        estado: 'Disponible',
        imagen_url: null,
        diametro_cabeza_mm: null,
        diametro_vastago_mm: null,
        longitud_total_mm: null,
        angulo_asiento_grados: null,
        diametro_cilindro_mm: null,
        espesor_anillo1_mm: null,
        espesor_anillo2_mm: null,
        espesor_aceite_mm: null,
        tipo_cojinete: null,
        diametro_munon_mm: null,
        diametro_alojamiento_mm: null,
        ancho_casquete_mm: null,
        dimensiones: {
          posicion: posLabel,
          cilindros: cylStr,
          interchangeable: app.interchangeable || []
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'DOKURO',
          tipo_producto: 'valve_seat',
          codigo_dokuro: dokuroCode,
          codigo_catalogo: catalogCode,
          fabricantes: item.fabricantes || [brandName],
          motores_compatibles: allCleanEngines,
          referencias_oem: normalizedRefs,
          paginas_pdf: item.paginas_pdf || [],
          fuente: 'Catalogo-DOKURO.pdf'
        }
      };
      repuestosRows.push(repuestoRow);

      const addedCodes = new Set();
      if (primaryCode) {
        addedCodes.add(primaryCode);
        equivalenciasRows.push({
          id: crypto.randomUUID(),
          repuesto_id: repuestoId,
          marca_alterna: 'Dokuro',
          codigo_alterno: primaryCode,
          tipo_referencia: 'Asiento de Válvula Dokuro',
          notas: `Dokuro Japón - Asiento de ${posLabel}`,
          especificaciones_tecnicas: { origen: 'DOKURO' }
        });
      }

      for (const ref of normalizedRefs) {
        if (!addedCodes.has(ref)) {
          addedCodes.add(ref);
          equivalenciasRows.push({
            id: crypto.randomUUID(),
            repuesto_id: repuestoId,
            marca_alterna: 'OEM',
            codigo_alterno: ref,
            tipo_referencia: 'Referencia Original Asiento',
            notas: `Referencia OEM para Dokuro ${primaryCode}`,
            especificaciones_tecnicas: { origen: 'DOKURO' }
          });
        }
      }

      for (const inter of (app.interchangeable || [])) {
        const cleanInter = String(inter).trim().toUpperCase();
        if (cleanInter && !addedCodes.has(cleanInter)) {
          addedCodes.add(cleanInter);
          equivalenciasRows.push({
            id: crypto.randomUUID(),
            repuesto_id: repuestoId,
            marca_alterna: 'OEM',
            codigo_alterno: cleanInter,
            tipo_referencia: 'Interchangeable OEM',
            notas: `Código intercambiable de fábrica`,
            especificaciones_tecnicas: { origen: 'DOKURO' }
          });
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`RESUMEN DE PREPARACIÓN DOKURO:`);
  console.log(`- Total repuestos estructurados: ${repuestosRows.length}`);
  console.log(`  * Válvulas: ${repuestosRows.filter(r => r.categoria === 'Válvulas').length}`);
  console.log(`  * Guías:    ${repuestosRows.filter(r => r.categoria === 'Guías').length}`);
  console.log(`  * Asientos: ${repuestosRows.filter(r => r.categoria === 'Asientos').length}`);
  console.log(`- Total equivalencias y cruces OEM: ${equivalenciasRows.length}`);
  console.log(`========================================\n`);

  // 6. Inserción en batches a Supabase
  console.log('6. Insertando repuestos_tecnicos en Supabase...');
  const repuestoChunks = chunkArray(repuestosRows, 100);
  let repInserted = 0;
  for (const chunk of repuestoChunks) {
    const { error } = await supabase.from('repuestos_tecnicos').insert(chunk);
    if (error) {
      console.error('\nError insertando repuestos:', error.message);
      throw error;
    }
    repInserted += chunk.length;
    process.stdout.write(`\r   Repuestos insertados: ${repInserted} / ${repuestosRows.length}`);
  }
  console.log('\n✓ Todos los repuestos insertados correctamente.');

  console.log('7. Insertando equivalencias_repuestos en Supabase...');
  const equivChunks = chunkArray(equivalenciasRows, 100);
  let eqInserted = 0;
  for (const chunk of equivChunks) {
    const { error } = await supabase.from('equivalencias_repuestos').insert(chunk);
    if (error) {
      console.error('\nError insertando equivalencias:', error.message);
      throw error;
    }
    eqInserted += chunk.length;
    process.stdout.write(`\r   Equivalencias insertadas: ${eqInserted} / ${equivalenciasRows.length}`);
  }
  console.log('\n✓ Todas las equivalencias insertadas correctamente.');

  // 8. Verificación de conteo final en base de datos
  const { count: finalTotal } = await supabase
    .from('repuestos_tecnicos')
    .select('*', { count: 'exact', head: true });

  const { count: finalEquiv } = await supabase
    .from('equivalencias_repuestos')
    .select('*', { count: 'exact', head: true });

  console.log(`\n========================================`);
  console.log(`ESTADO FINAL EN SUPABASE:`);
  console.log(`- Repuestos técnicos totales: ${finalTotal}`);
  console.log(`- Equivalencias totales:      ${finalEquiv}`);
  console.log(`========================================\n`);
}

runImport();
