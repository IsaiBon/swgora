import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SUPABASE_URL = 'https://ahfnuegsdmnjelcypitk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NURLGy4Cs_0IS0qajjHg-A_Xl7M7rXw';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${method} ${endpoint} (${res.status}): ${txt}`);
  }
  return await res.json();
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
  'ASIA': { nombre: 'Asia Multimarca', pais: 'Asia' },
  'CATAPILLAR': { nombre: 'Caterpillar', pais: 'Estados Unidos' },
  'KUBOTA': { nombre: 'Kubota', pais: 'Japón' },
  'KAWASAKI': { nombre: 'Kawasaki', pais: 'Japón' },
  'YAMAHA': { nombre: 'Yamaha', pais: 'Japón' },
  'SSANGYONG': { nombre: 'SsangYong', pais: 'Corea del Sur' }
};

// Normalizar y expandir referencias con sufijos abreviados (ej. 13711-87101, -87102 -> 13711-87102)
function normalizeReferences(rawRefs) {
  const result = [];
  let lastPrefix = '';
  for (const r of rawRefs || []) {
    let clean = String(r).trim().replace(/[-/]+$/, '');
    if (!clean) continue;
    if (clean.startsWith('-') && lastPrefix) {
      result.push(lastPrefix + clean);
    } else {
      if (clean.includes('-')) {
        const parts = clean.split('-');
        lastPrefix = parts[0];
      }
      result.push(clean);
    }
  }
  return [...new Set(result)];
}

async function main() {
  console.log('🚀 Iniciando importación del catálogo DOKURO 2006 a Supabase...');

  // 1. Cargar JSON local
  const jsonPath = path.resolve(process.cwd(), 'RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json');
  console.log(`📖 Leyendo archivo ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const catalogData = JSON.parse(rawData);
  console.log(`✅ ${catalogData.length} componentes encontrados en el catálogo DOKURO.`);

  // 2. Asegurar grupos de repuestos en Supabase (guias_valvula y asientos_valvula)
  console.log('📦 Asegurando grupos de repuestos en grupos_repuestos...');
  const existingGroups = await apiRequest('grupos_repuestos?select=*');
  
  const hasGuias = existingGroups.some(g => g.codigo === 'guias_valvula');
  if (!hasGuias) {
    const guiasGroup = {
      codigo: 'guias_valvula',
      nombre: 'Guías de válvula',
      categoria: 'Guías',
      subsistema: 'Culata',
      icono: 'Layers',
      descripcion: 'Guías de válvula para culata de motor (Admisión y Escape)',
      parametros: [
        { id: 'param_guia_1', clave: 'posicion', etiqueta: 'Posición', unidad: '', tipo_dato: 'seleccion', opciones: ['IN', 'EX', 'IN/EX'], requerido: true, descripcion: 'Admisión / Escape' },
        { id: 'param_guia_2', clave: 'set', etiqueta: 'Juego (Set)', unidad: 'pzs', tipo_dato: 'numero', requerido: false, descripcion: 'Cantidad de piezas por set' },
        { id: 'param_guia_3', clave: 'diametro_interior_mm', etiqueta: 'Ø Interior (mm)', unidad: 'mm', tipo_dato: 'numero', requerido: false, descripcion: 'Calibre interior' },
        { id: 'param_guia_4', clave: 'diametro_exterior_mm', etiqueta: 'Ø Exterior (mm)', unidad: 'mm', tipo_dato: 'numero', requerido: false, descripcion: 'Diámetro exterior' },
        { id: 'param_guia_5', clave: 'longitud_total_mm', etiqueta: 'Longitud (mm)', unidad: 'mm', tipo_dato: 'numero', requerido: false, descripcion: 'Largo total' }
      ]
    };
    await apiRequest('grupos_repuestos', 'POST', [guiasGroup]);
    console.log('✅ Grupo "guias_valvula" creado exitosamente.');
  } else {
    console.log('ℹ️ Grupo "guias_valvula" ya existe.');
  }

  const hasAsientos = existingGroups.some(g => g.codigo === 'asientos_valvula');
  if (!hasAsientos) {
    const asientosGroup = {
      codigo: 'asientos_valvula',
      nombre: 'Asientos de válvula',
      categoria: 'Asientos',
      subsistema: 'Culata',
      icono: 'CircleDot',
      descripcion: 'Asientos de válvula para culata de cilindros',
      parametros: [
        { id: 'param_asiento_1', clave: 'posicion', etiqueta: 'Posición', unidad: '', tipo_dato: 'seleccion', opciones: ['IN', 'EX'], requerido: true, descripcion: 'Admisión / Escape' },
        { id: 'param_asiento_2', clave: 'cilindros', etiqueta: 'Cilindros', unidad: '', tipo_dato: 'texto', requerido: false, descripcion: 'Número de cilindros' }
      ]
    };
    await apiRequest('grupos_repuestos', 'POST', [asientosGroup]);
    console.log('✅ Grupo "asientos_valvula" creado exitosamente.');
  } else {
    console.log('ℹ️ Grupo "asientos_valvula" ya existe.');
  }

  // 3. Sincronizar fabricantes en Supabase
  console.log('🏭 Verificando fabricantes...');
  let currentFabricantes = await apiRequest('fabricantes?select=*');
  const fabMap = new Map();
  currentFabricantes.forEach(f => {
    fabMap.set(f.nombre.toUpperCase(), f.id);
  });

  const missingFabricantes = [];
  for (const [key, val] of Object.entries(BRAND_MAPPING)) {
    if (!fabMap.has(val.nombre.toUpperCase())) {
      missingFabricantes.push({
        nombre: val.nombre,
        pais_origen: val.pais,
        activo: true
      });
    }
  }

  if (missingFabricantes.length > 0) {
    console.log(`➕ Insertando ${missingFabricantes.length} fabricantes nuevos...`);
    const inserted = await apiRequest('fabricantes', 'POST', missingFabricantes);
    currentFabricantes = await apiRequest('fabricantes?select=*');
    currentFabricantes.forEach(f => fabMap.set(f.nombre.toUpperCase(), f.id));
  }
  console.log(`✅ ${currentFabricantes.length} fabricantes listos.`);

  function resolveFabricanteId(rawBrand) {
    if (!rawBrand) return currentFabricantes[0].id;
    const clean = rawBrand.trim().toUpperCase();
    const mapped = BRAND_MAPPING[clean];
    if (mapped && fabMap.has(mapped.nombre.toUpperCase())) {
      return fabMap.get(mapped.nombre.toUpperCase());
    }
    if (fabMap.has(clean)) {
      return fabMap.get(clean);
    }
    return currentFabricantes[0].id;
  }

  // 4. Cargar motores existentes y registrar nuevos motores detectados en Dokuro
  console.log('🚗 Obteniendo motores existentes de Supabase...');
  let allEngines = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const batch = await apiRequest(`motores?select=id,fabricante_id,codigo&offset=${page * pageSize}&limit=${pageSize}`);
    allEngines = allEngines.concat(batch);
    if (batch.length < pageSize) break;
    page++;
  }
  console.log(`✅ ${allEngines.length} motores cargados en caché local.`);

  const motorMap = new Map();
  allEngines.forEach(m => {
    motorMap.set(`${m.fabricante_id}::${m.codigo.trim().toUpperCase()}`, m.id);
    motorMap.set(`*::${m.codigo.trim().toUpperCase()}`, m.id);
  });

  // Identificar motores nuevos en Dokuro
  const newEnginesMap = new Map();
  catalogData.forEach(item => {
    const rawBrand = (item.fabricantes && item.fabricantes[0]) || '';
    const fabId = resolveFabricanteId(rawBrand);

    (item.aplicaciones || []).forEach(app => {
      const appBrand = app.fabricante || rawBrand;
      const targetFabId = resolveFabricanteId(appBrand);

      const engineCodes = [];
      if (app.engine_type_lines) engineCodes.push(...app.engine_type_lines);
      if (app.engine_type) engineCodes.push(app.engine_type);
      if (app.engine_models) engineCodes.push(...app.engine_models);

      engineCodes.forEach(rawCode => {
        const clean = String(rawCode).trim().toUpperCase();
        if (clean && clean.length >= 2 && !clean.includes('SELECT') && !clean.includes('NULL')) {
          const key = `${targetFabId}::${clean}`;
          if (!motorMap.has(key) && !newEnginesMap.has(key)) {
            // Cilindros y cilindrada si están disponibles
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

            const brandEntry = currentFabricantes.find(f => f.id === targetFabId);
            const brandName = brandEntry ? brandEntry.nombre : 'Motor';

            newEnginesMap.set(key, {
              fabricante_id: targetFabId,
              codigo: clean,
              nombre_comercial: `${brandName} ${clean}`,
              cilindros: cyl,
              valvulas: cyl === 4 ? 16 : cyl * 2,
              cilindrada_cc: disp,
              combustible: 'Gasolina/Diésel',
              especificaciones_tecnicas: {
                fuente: 'DOKURO 2006',
                vehiculos: app.vehicle_model_lines || []
              }
            });
          }
        }
      });
    });
  });

  if (newEnginesMap.size > 0) {
    console.log(`➕ Insertando ${newEnginesMap.size} nuevos motores de Dokuro en Supabase...`);
    const newEnginesList = Array.from(newEnginesMap.values());
    const chunkSize = 100;
    for (let i = 0; i < newEnginesList.length; i += chunkSize) {
      const chunk = newEnginesList.slice(i, i + chunkSize);
      const inserted = await apiRequest('motores', 'POST', chunk);
      inserted.forEach(m => {
        motorMap.set(`${m.fabricante_id}::${m.codigo.trim().toUpperCase()}`, m.id);
        motorMap.set(`*::${m.codigo.trim().toUpperCase()}`, m.id);
      });
      process.stdout.write(`\r   Motores insertados: ${Math.min(i + chunkSize, newEnginesList.length)} / ${newEnginesList.length}`);
    }
    console.log('\n✅ Nuevos motores registrados exitosamente.');
  }

  // 5. Preparar repuestos y equivalencias para inserción en masa
  console.log('⚙️ Transformando 1,665 componentes de Dokuro a repuestos_tecnicos y equivalencias...');

  const repuestosPayload = [];
  const equivalenciasPayload = [];

  for (const item of catalogData) {
    const repuestoId = crypto.randomUUID();
    const rawBrand = (item.fabricantes && item.fabricantes[0]) || '';
    const fabId = resolveFabricanteId(rawBrand);
    const brandEntry = currentFabricantes.find(f => f.id === fabId);
    const brandName = brandEntry ? brandEntry.nombre : (rawBrand || 'Universal');

    // Extraer lista de motores y asociar motor primario
    const allEngineCodes = [];
    let primaryMotorId = null;

    (item.aplicaciones || []).forEach(app => {
      const codes = [];
      if (app.engine_type_lines) codes.push(...app.engine_type_lines);
      if (app.engine_type) codes.push(app.engine_type);
      if (app.engine_models) codes.push(...app.engine_models);

      codes.forEach(c => {
        const clean = String(c).trim().toUpperCase();
        if (clean && !allEngineCodes.includes(clean)) {
          allEngineCodes.push(clean);
        }
      });
    });

    for (const code of allEngineCodes) {
      const foundId = motorMap.get(`${fabId}::${code}`) || motorMap.get(`*::${code}`);
      if (foundId) {
        primaryMotorId = foundId;
        break;
      }
    }

    // Normalizar códigos OEM y de fabricante
    const normalizedRefs = normalizeReferences(item.referencias || []);
    const dokuroCode = item.codigo_dokuro ? String(item.codigo_dokuro).trim().toUpperCase() : null;
    const catalogCode = item.codigo_catalogo ? String(item.codigo_catalogo).trim().toUpperCase() : null;

    const oemCode = (normalizedRefs.length > 0)
      ? normalizedRefs[0]
      : (dokuroCode || catalogCode || `DOK-${item.id}`);

    const motoresStr = allEngineCodes.length > 0 ? allEngineCodes.slice(0, 4).join('/') : '';

    // Transformación según tipo de producto
    if (item.tipo_producto === 'engine_valve') {
      const app = (item.aplicaciones && item.aplicaciones[0]) || {};
      const pos = app.position ? app.position.trim().toUpperCase() : 'IN';
      const posNombre = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : (pos === 'AU' ? 'Auxiliar' : pos));

      const diamCabeza = app.head_dia_mm ? Number(app.head_dia_mm) : null;
      const diamVastago = app.stem_dia_mm ? Number(app.stem_dia_mm) : null;
      const longTotal = app.overall_length_mm ? Number(app.overall_length_mm) : null;
      const angulo = app.seat_angle_deg ? Number(app.seat_angle_deg) : null;

      const nombre = `Válvula de ${posNombre} ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName}) ${dokuroCode ? `[${dokuroCode}]` : ''}`.trim();

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: oemCode,
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
          diametro_cabeza_mm: diamCabeza,
          diametro_vastago_mm: diamVastago,
          longitud_total_mm: longTotal,
          angulo_asiento_grados: angulo,
          tipo_valvula: posNombre,
          posicion: pos,
          head_style: app.head_style || null,
          stem_end: app.stem_end || null
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'DOKURO',
          tipo_producto: 'engine_valve',
          codigo_dokuro: dokuroCode,
          codigo_catalogo: catalogCode,
          fabricantes: item.fabricantes || [brandName],
          motores_compatibles: allEngineCodes,
          referencias_oem: normalizedRefs,
          paginas_pdf: item.paginas_pdf || [],
          fuente: item.fuente || 'Catalogo-DOKURO.pdf'
        }
      };
      repuestosPayload.push(repuestoRow);

    } else if (item.tipo_producto === 'valve_guide') {
      const app = (item.aplicaciones && item.aplicaciones[0]) || {};
      const pos = app.position ? app.position.trim().toUpperCase() : 'IN/EX';
      const setQty = app.set ? Number(app.set) : null;

      const nombre = `Guía de Válvula ${pos} ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName})`.trim();

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: oemCode,
        nombre,
        subsistema: 'Culata',
        categoria: 'Guías',
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
          posicion: pos,
          set: setQty,
          remarks: app.remarks || null
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'DOKURO',
          tipo_producto: 'valve_guide',
          codigo_dokuro: dokuroCode,
          codigo_catalogo: catalogCode,
          fabricantes: item.fabricantes || [brandName],
          motores_compatibles: allEngineCodes,
          referencias_oem: normalizedRefs,
          paginas_pdf: item.paginas_pdf || [],
          fuente: item.fuente || 'Catalogo-DOKURO.pdf'
        }
      };
      repuestosPayload.push(repuestoRow);

    } else if (item.tipo_producto === 'valve_seat') {
      const app = (item.aplicaciones && item.aplicaciones[0]) || {};
      const pos = app.position ? app.position.trim().toUpperCase() : 'IN';
      const posNombre = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : pos);
      const cylStr = app.cylinders ? app.cylinders.join('/') : null;

      const nombre = `Asiento de Válvula ${posNombre} ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName})`.trim();

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: oemCode,
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
          posicion: posNombre,
          cilindros: cylStr,
          interchangeable: app.interchangeable || []
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'DOKURO',
          tipo_producto: 'valve_seat',
          codigo_dokuro: dokuroCode,
          codigo_catalogo: catalogCode,
          fabricantes: item.fabricantes || [brandName],
          motores_compatibles: allEngineCodes,
          referencias_oem: normalizedRefs,
          paginas_pdf: item.paginas_pdf || [],
          fuente: item.fuente || 'Catalogo-DOKURO.pdf'
        }
      };
      repuestosPayload.push(repuestoRow);
    }

    // Registrar equivalencias cruzadas
    const addedAlternates = new Set();

    // 1. Código Dokuro principal
    if (dokuroCode && !addedAlternates.has(dokuroCode)) {
      addedAlternates.add(dokuroCode);
      equivalenciasPayload.push({
        id: crypto.randomUUID(),
        repuesto_id: repuestoId,
        marca_alterna: 'Dokuro',
        codigo_alterno: dokuroCode,
        tipo_referencia: 'Código Directo Dokuro',
        notas: `Dokuro Japón - Pág. ${(item.paginas_pdf || []).join(', ')}`,
        especificaciones_tecnicas: {
          origen: 'DOKURO',
          codigo_dokuro: dokuroCode,
          fabricante: brandName
        }
      });
    }

    // 2. Código de catálogo Dokuro alterno
    if (catalogCode && catalogCode !== dokuroCode && !addedAlternates.has(catalogCode)) {
      addedAlternates.add(catalogCode);
      equivalenciasPayload.push({
        id: crypto.randomUUID(),
        repuesto_id: repuestoId,
        marca_alterna: 'Dokuro Catálogo',
        codigo_alterno: catalogCode,
        tipo_referencia: 'Referencia Dokuro Catálogo',
        notas: `Dokuro Japón`,
        especificaciones_tecnicas: {
          origen: 'DOKURO',
          codigo_catalogo: catalogCode
        }
      });
    }

    // 3. Referencias OEM cruzadas
    normalizedRefs.forEach(ref => {
      const cleanRef = ref.trim().toUpperCase();
      if (cleanRef && cleanRef !== dokuroCode && cleanRef !== catalogCode && !addedAlternates.has(cleanRef)) {
        addedAlternates.add(cleanRef);
        equivalenciasPayload.push({
          id: crypto.randomUUID(),
          repuesto_id: repuestoId,
          marca_alterna: `${brandName} OEM`,
          codigo_alterno: cleanRef,
          tipo_referencia: 'Número de Parte Original OEM',
          notas: `Cruce OEM Dokuro (${brandName})`,
          especificaciones_tecnicas: {
            oem_marca: brandName,
            motores: allEngineCodes
          }
        });
      }
    });

    // 4. Intercambiables de asientos
    (item.aplicaciones || []).forEach(app => {
      (app.interchangeable || []).forEach(ic => {
        const cleanIc = String(ic).trim().toUpperCase();
        if (cleanIc && !addedAlternates.has(cleanIc)) {
          addedAlternates.add(cleanIc);
          equivalenciasPayload.push({
            id: crypto.randomUUID(),
            repuesto_id: repuestoId,
            marca_alterna: 'Intercambiable OEM',
            codigo_alterno: cleanIc,
            tipo_referencia: 'Cruce Intercambiable',
            notas: `Referencia intercambiable de asiento de válvula`,
            especificaciones_tecnicas: {
              origen: 'DOKURO'
            }
          });
        }
      });
    });
  }

  console.log(`✅ ${repuestosPayload.length} repuestos técnicos y ${equivalenciasPayload.length} equivalencias preparadas.`);

  // 6. Inserción en masa de repuestos_tecnicos
  console.log('📥 Insertando repuestos técnicos de DOKURO en Supabase...');
  const repChunkSize = 100;
  for (let i = 0; i < repuestosPayload.length; i += repChunkSize) {
    const chunk = repuestosPayload.slice(i, i + repChunkSize);
    await apiRequest('repuestos_tecnicos', 'POST', chunk);
    process.stdout.write(`\r   Repuestos insertados: ${Math.min(i + repChunkSize, repuestosPayload.length)} / ${repuestosPayload.length}`);
  }
  console.log('\n✅ Repuestos técnicos de DOKURO insertados exitosamente.');

  // 7. Inserción en masa de equivalencias_repuestos
  console.log('📥 Insertando equivalencias cruzadas de DOKURO en Supabase...');
  const eqChunkSize = 150;
  for (let i = 0; i < equivalenciasPayload.length; i += eqChunkSize) {
    const chunk = equivalenciasPayload.slice(i, i + eqChunkSize);
    await apiRequest('equivalencias_repuestos', 'POST', chunk);
    process.stdout.write(`\r   Equivalencias insertadas: ${Math.min(i + eqChunkSize, equivalenciasPayload.length)} / ${equivalenciasPayload.length}`);
  }
  console.log('\n✅ Equivalencias cruzadas insertadas exitosamente.');

  // 8. Resumen final
  console.log('📊 Verificando totales finales en Supabase...');
  const finalRepuestos = await apiRequest('repuestos_tecnicos?select=id', 'GET');
  const finalEquivalencias = await apiRequest('equivalencias_repuestos?select=id', 'GET');
  const finalMotores = await apiRequest('motores?select=id', 'GET');

  console.log('=============================================');
  console.log(`🎉 PROCESO COMPLETADO EXITOSAMENTE`);
  console.log(`📦 Total Repuestos Técnicos en Supabase: ${finalRepuestos.length}`);
  console.log(`🔗 Total Equivalencias Cruzadas: ${finalEquivalencias.length}`);
  console.log(`🚗 Total Motores Registrados: ${finalMotores.length}`);
  console.log('=============================================');
}

main().catch(err => {
  console.error('❌ Error fatal en importación:', err);
  process.exit(1);
});
