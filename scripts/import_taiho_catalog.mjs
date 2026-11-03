import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ahfnuegsdmnjelcypitk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NURLGy4Cs_0IS0qajjHg-A_Xl7M7rXw';

const baseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function apiRequest(endpoint, method = 'GET', body = null, extraHeaders = {}) {
  const options = {
    method,
    headers: {
      ...baseHeaders,
      'Prefer': 'return=representation',
      ...extraHeaders
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${method} ${endpoint} (${res.status}): ${txt}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function fetchAll(table, select = 'id') {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}&offset=${page * pageSize}&limit=${pageSize}`, {
      headers: baseHeaders
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`fetchAll error on ${table}: ${txt}`);
    }
    const data = await res.json();
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

const BRAND_MAPPING = {
  'TOYOTA': { nombre: 'Toyota', pais: 'Japón' },
  'NISSAN': { nombre: 'Nissan', pais: 'Japón' },
  'NISSAN DIESEL': { nombre: 'UD Trucks', pais: 'Japón' },
  'MITSUBISHI': { nombre: 'Mitsubishi', pais: 'Japón' },
  'MITSUBISHI FUSO': { nombre: 'Mitsubishi', pais: 'Japón' },
  'ISUZU': { nombre: 'Isuzu', pais: 'Japón' },
  'HINO': { nombre: 'Hino', pais: 'Japón' },
  'DAIHATSU': { nombre: 'Daihatsu', pais: 'Japón' },
  'MAZDA': { nombre: 'Mazda', pais: 'Japón' },
  'KOMATSU': { nombre: 'Komatsu', pais: 'Japón' },
  'HONDA': { nombre: 'Honda', pais: 'Japón' },
  'SUBARU': { nombre: 'Subaru', pais: 'Japón' },
  'SUZUKI': { nombre: 'Suzuki', pais: 'Japón' },
  'HYUNDAI': { nombre: 'Hyundai', pais: 'Corea del Sur' },
  'ASIA': { nombre: 'Asia Multimarca', pais: 'Asia' },
  'DAEWOO': { nombre: 'Daewoo', pais: 'Corea del Sur' },
  'KIA': { nombre: 'Kia', pais: 'Corea del Sur' },
  'GM': { nombre: 'Chevrolet', pais: 'Estados Unidos' },
  'PROTON': { nombre: 'Proton', pais: 'Malasia' }
};

function getBearingType(codigo) {
  if (!codigo) return 'Cojinete';
  const prefix = codigo.trim().charAt(0).toUpperCase();
  switch (prefix) {
    case 'M': return 'Bancada';
    case 'R': return 'Biela';
    case 'T': return 'Axial';
    case 'P': return 'Buje de Biela';
    case 'C': return 'Árbol de Levas';
    case 'B': return 'Balanceador';
    case 'S': return 'Buje Especial';
    default: return 'Cojinete';
  }
}

function getBearingName(tipo, motoresStr, brandName) {
  const motorPart = motoresStr ? `Motor ${motoresStr}` : '';
  const brandPart = brandName ? `(${brandName})` : '';
  switch (tipo) {
    case 'Bancada':
      return `Juego de Cojinetes de Bancada STD ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
    case 'Biela':
      return `Juego de Cojinetes de Biela STD ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
    case 'Axial':
      return `Juego de Arandelas Axiales STD ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
    case 'Buje de Biela':
      return `Juego de Bujes de Biela STD ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
    case 'Árbol de Levas':
      return `Juego de Cojinetes de Levas STD ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
    case 'Balanceador':
      return `Bujes de Eje Balanceador ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
    case 'Buje Especial':
      return `Buje Especial de Motor ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
    default:
      return `Cojinete de Motor ${motorPart} ${brandPart}`.replace(/\s+/g, ' ').trim();
  }
}

function parseNum(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '.').trim();
  const num = parseFloat(str);
  return (!isNaN(num) && num > 0) ? num : null;
}

async function main() {
  console.log('🚀 Iniciando proceso de importación del catálogo TAIHO B-18 a Supabase...');

  // 1. Cargar JSON local
  const jsonPath = path.resolve(process.cwd(), 'RecursosExtras/catalogo_taiho_b18.json');
  console.log(`📖 Leyendo archivo ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const catalogData = JSON.parse(rawData);
  const registros = catalogData.registros || [];
  console.log(`✅ ${registros.length} registros encontrados en el catálogo Taiho.`);

  // 2. Asegurar fabricantes
  console.log('🏭 Verificando fabricantes automotrices en Supabase...');
  let currentFabricantes = await fetchAll('fabricantes', '*');
  const fabricanteMap = new Map();

  for (const fab of currentFabricantes) {
    fabricanteMap.set(fab.nombre.toUpperCase(), fab.id);
  }

  const missingFabricantes = [];
  let ordenVisual = currentFabricantes.length + 1;

  for (const [key, info] of Object.entries(BRAND_MAPPING)) {
    const upperName = info.nombre.toUpperCase();
    if (!fabricanteMap.has(upperName) && !fabricanteMap.has(key)) {
      missingFabricantes.push({
        nombre: info.nombre,
        pais_origen: info.pais,
        activo: true,
        orden_visual: ordenVisual++
      });
    }
  }

  if (missingFabricantes.length > 0) {
    console.log(`➕ Insertando ${missingFabricantes.length} fabricantes nuevos...`);
    const insertedFabs = await apiRequest('fabricantes', 'POST', missingFabricantes);
    if (insertedFabs) {
      for (const fab of insertedFabs) {
        fabricanteMap.set(fab.nombre.toUpperCase(), fab.id);
      }
    }
    currentFabricantes = await fetchAll('fabricantes', '*');
    for (const fab of currentFabricantes) {
      fabricanteMap.set(fab.nombre.toUpperCase(), fab.id);
    }
  }

  const resolveFabricanteId = (sectionName) => {
    if (!sectionName) return currentFabricantes[0].id;
    const secUpper = sectionName.trim().toUpperCase();
    if (BRAND_MAPPING[secUpper]) {
      const mappedUpper = BRAND_MAPPING[secUpper].nombre.toUpperCase();
      if (fabricanteMap.has(mappedUpper)) return fabricanteMap.get(mappedUpper);
    }
    if (fabricanteMap.has(secUpper)) return fabricanteMap.get(secUpper);
    for (const [name, id] of fabricanteMap.entries()) {
      if (name.includes(secUpper) || secUpper.includes(name)) return id;
    }
    return currentFabricantes[0].id;
  };

  // 3. Mapear motores existentes con paginación completa
  console.log('🏎️ Cargando TODOS los motores existentes en Supabase...');
  const currentMotores = await fetchAll('motores', 'id,fabricante_id,codigo');
  const motorMap = new Map();

  for (const mot of currentMotores) {
    if (mot.codigo && mot.fabricante_id) {
      motorMap.set(`${mot.fabricante_id}::${mot.codigo.trim().toUpperCase()}`, mot.id);
    }
  }
  console.log(`ℹ️ ${motorMap.size} motores ya existentes en la BD.`);

  // 4. Recopilar nuevos motores de Taiho
  console.log('🔍 Extrayendo motores referenciados en el catálogo Taiho...');
  const enginesToInsertMap = new Map();

  for (const reg of registros) {
    const fabId = resolveFabricanteId(reg.marca_vehiculo || reg.seccion_catalogo);
    const aplicaciones = reg.aplicaciones || [];

    for (const app of aplicaciones) {
      if (!app.motor_catalogo) continue;
      const code = app.motor_catalogo.trim();
      if (!code) continue;
      const key = `${fabId}::${code.toUpperCase()}`;

      if (!motorMap.has(key) && !enginesToInsertMap.has(key)) {
        let cc = parseNum(app.cilindrada_cc);
        let cyl = parseNum(app.cilindros) || 4;
        let diamCil = parseNum(app.diametro_cilindro_mm);
        let carrera = parseNum(app.carrera_mm);

        const brandEntry = currentFabricantes.find(f => f.id === fabId);
        const brandName = brandEntry ? brandEntry.nombre : (reg.marca_vehiculo || 'Motor');
        const veh = app.vehiculos_texto && app.vehiculos_texto[0] ? ` (${app.vehiculos_texto[0]})` : '';

        enginesToInsertMap.set(key, {
          fabricante_id: fabId,
          codigo: code,
          nombre_comercial: `${brandName} ${code}${veh}`,
          cilindrada_cc: cc ? Math.round(cc) : null,
          cilindros: cyl,
          valvulas: cyl === 4 ? 16 : cyl * 2,
          combustible: (app.combustible && app.combustible.toLowerCase().includes('di')) ? 'Diésel' : 'Gasolina',
          diametro_cilindro_std_mm: diamCil,
          carrera_piston_mm: carrera,
          especificaciones_tecnicas: {
            fuente: 'Catálogo Taiho B-18',
            vehiculos: app.vehiculos_texto || []
          }
        });
      }
    }
  }

  if (enginesToInsertMap.size > 0) {
    console.log(`➕ Insertando ${enginesToInsertMap.size} motores nuevos identificados...`);
    const engineBatches = Array.from(enginesToInsertMap.values());
    const BATCH_SIZE_MOT = 100;

    for (let i = 0; i < engineBatches.length; i += BATCH_SIZE_MOT) {
      const chunk = engineBatches.slice(i, i + BATCH_SIZE_MOT);
      const inserted = await apiRequest('motores', 'POST', chunk);
      if (inserted) {
        for (const mot of inserted) {
          motorMap.set(`${mot.fabricante_id}::${mot.codigo.trim().toUpperCase()}`, mot.id);
        }
      }
      process.stdout.write(`\r   Motores insertados: ${Math.min(i + BATCH_SIZE_MOT, engineBatches.length)} / ${engineBatches.length}`);
    }
    console.log('\n✅ Todos los motores sincronizados y asociados.');
  }

  // 5. Limpieza previa de Taiho (idempotente)
  console.log('🧹 Limpiando registros previos de TAIHO si existieran...');
  await apiRequest('equivalencias_repuestos?marca_alterna=eq.Taiho', 'DELETE');
  await apiRequest('repuestos_tecnicos?especificaciones_tecnicas->>marca_catalogo=eq.TAIHO', 'DELETE');
  console.log('✅ Base de datos lista para inserción limpia de Taiho.');

  // 6. Preparar repuestos y equivalencias técnicas
  console.log('⚙️ Transformando 2,041 componentes con medidas dimensionales de casquetería...');
  const repuestosPayload = [];
  const equivalenciasPayload = [];

  for (const reg of registros) {
    const repuestoId = crypto.randomUUID();
    const fabId = resolveFabricanteId(reg.marca_vehiculo || reg.seccion_catalogo);
    const brandEntry = currentFabricantes.find(f => f.id === fabId);
    const brandName = brandEntry ? brandEntry.nombre : (reg.marca_vehiculo || 'Japón');

    const aplicaciones = reg.aplicaciones || [];
    const motoresCompatibles = aplicaciones.map(a => a.motor_catalogo).filter(Boolean);
    const vehiculosList = [...new Set(aplicaciones.flatMap(a => a.vehiculos_texto || []))];

    // Asociar a motor primario
    let primaryMotorId = null;
    if (motoresCompatibles.length > 0) {
      const firstCode = motoresCompatibles[0].trim().toUpperCase();
      primaryMotorId = motorMap.get(`${fabId}::${firstCode}`) || null;
    }

    const tipoCojinete = getBearingType(reg.codigo_conjunto);
    const motoresStr = motoresCompatibles.slice(0, 4).join('/');
    const nombre = getBearingName(tipoCojinete, motoresStr, brandName);

    const refs = reg.referencias_originales || [];
    const primaryOem = refs.length > 0 ? refs[0].trim().toUpperCase() : reg.codigo_conjunto.trim().toUpperCase();

    // Extraer cotas físicas de las piezas
    let diamMunon = null;
    let diamAloj = null;
    let anchoCasquete = null;
    let espesorPared = null;

    if (reg.piezas && reg.piezas.length > 0) {
      for (const p of reg.piezas) {
        if (!diamMunon) diamMunon = parseNum(p.diametro_eje_min_mm);
        if (!diamAloj) diamAloj = parseNum(p.diametro_alojamiento_max_mm);
        if (!anchoCasquete) anchoCasquete = parseNum(p.ancho_max_mm);
        if (!espesorPared) espesorPared = parseNum(p.espesor_pared_max_mm);
      }
    }

    const repuestoRow = {
      id: repuestoId,
      motor_id: primaryMotorId,
      codigo_oem: primaryOem,
      nombre,
      subsistema: 'Cigüeñal',
      categoria: 'Casquetería',
      precio: 0.00,
      stock: 10,
      estado: 'Disponible',
      tipo_cojinete: tipoCojinete,
      diametro_munon_mm: diamMunon,
      diametro_alojamiento_mm: diamAloj,
      ancho_casquete_mm: anchoCasquete,
      dimensiones: {
        tipo_cojinete: tipoCojinete,
        diametro_munon_mm: diamMunon,
        diametro_alojamiento_mm: diamAloj,
        ancho_casquete_mm: anchoCasquete,
        espesor_pared_mm: espesorPared,
        piezas: reg.piezas || []
      },
      especificaciones_tecnicas: {
        marca_catalogo: 'TAIHO',
        codigo_taiho: reg.codigo_conjunto,
        seccion_catalogo: reg.seccion_catalogo || reg.marca_vehiculo,
        tipo_cojinete: tipoCojinete,
        motores_compatibles: motoresCompatibles,
        vehiculos: vehiculosList,
        referencias_oem: refs,
        pagina_catalogo: reg.fuente?.pagina_catalogo || null,
        fuente: reg.fuente?.archivo || '06-TAIHO B-18 JAP Y KOR.pdf'
      }
    };
    repuestosPayload.push(repuestoRow);

    // Equivalencia Taiho
    equivalenciasPayload.push({
      repuesto_id: repuestoId,
      marca_alterna: 'Taiho',
      codigo_alterno: reg.codigo_conjunto.trim().toUpperCase(),
      tipo_referencia: 'Cruce directo de catálogo Taiho',
      notas: `Taiho Japón Catálogo B-18 (${tipoCojinete})`,
      especificaciones_tecnicas: {
        seccion: reg.seccion_catalogo || reg.marca_vehiculo,
        tipo_cojinete: tipoCojinete,
        codigo_taiho: reg.codigo_conjunto
      }
    });

    // Equivalencias OEM
    for (const ref of refs) {
      const cleanRef = ref.trim().toUpperCase();
      if (cleanRef && cleanRef !== primaryOem) {
        equivalenciasPayload.push({
          repuesto_id: repuestoId,
          marca_alterna: 'OEM',
          codigo_alterno: cleanRef,
          tipo_referencia: 'Número Original Alterno',
          notas: `Referencia OEM ${brandName}`,
          especificaciones_tecnicas: {
            fabricante: brandName
          }
        });
      }
    }
  }

  // 7. Inserción de repuestos en lotes de 100
  console.log(`📦 Insertando ${repuestosPayload.length} repuestos de Casquetería Taiho...`);
  const BATCH_SIZE_REP = 100;
  for (let i = 0; i < repuestosPayload.length; i += BATCH_SIZE_REP) {
    const chunk = repuestosPayload.slice(i, i + BATCH_SIZE_REP);
    await apiRequest('repuestos_tecnicos', 'POST', chunk);
    process.stdout.write(`\r   Repuestos insertados: ${Math.min(i + BATCH_SIZE_REP, repuestosPayload.length)} / ${repuestosPayload.length}`);
  }
  console.log('\n✅ Repuestos de Casquetería Taiho insertados exitosamente.');

  // Deduplicación estricta de equivalencias
  const seenEq = new Set();
  const dedupedEquivalencias = [];
  for (const eq of equivalenciasPayload) {
    const k = `${eq.repuesto_id}::${eq.marca_alterna.toUpperCase()}::${eq.codigo_alterno.toUpperCase()}`;
    if (!seenEq.has(k)) {
      seenEq.add(k);
      dedupedEquivalencias.push(eq);
    }
  }

  // 8. Inserción de equivalencias en lotes de 200 con resolution=ignore-duplicates
  console.log(`🔗 Insertando ${dedupedEquivalencias.length} equivalencias de Taiho y OEM...`);
  const BATCH_SIZE_EQ = 200;
  for (let i = 0; i < dedupedEquivalencias.length; i += BATCH_SIZE_EQ) {
    const chunk = dedupedEquivalencias.slice(i, i + BATCH_SIZE_EQ);
    await apiRequest('equivalencias_repuestos', 'POST', chunk, {
      'Prefer': 'resolution=ignore-duplicates,return=minimal'
    });
    process.stdout.write(`\r   Equivalencias insertadas: ${Math.min(i + BATCH_SIZE_EQ, dedupedEquivalencias.length)} / ${dedupedEquivalencias.length}`);
  }
  console.log('\n✅ Equivalencias de Taiho insertadas con éxito.');

  console.log('\n🎉 ¡IMPORTACIÓN DE TAIHO COMPLETADA EXITOSAMENTE!');
  console.log(`- Total repuestos Taiho: ${repuestosPayload.length}`);
  console.log(`- Total equivalencias Taiho/OEM: ${dedupedEquivalencias.length}`);
}

main().catch(err => {
  console.error('\n❌ ERROR FATAL EN IMPORTACIÓN TAIHO:', err);
  process.exit(1);
});
