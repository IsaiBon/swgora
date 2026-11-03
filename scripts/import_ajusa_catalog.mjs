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
  'VOLKSWAGEN': { nombre: 'Volkswagen', pais: 'Alemania' },
  'AUDI': { nombre: 'Audi', pais: 'Alemania' },
  'BMW': { nombre: 'BMW', pais: 'Alemania' },
  'MERCEDES': { nombre: 'Mercedes-Benz', pais: 'Alemania' },
  'MERCEDES (INDUSTRIAL)': { nombre: 'Mercedes-Benz', pais: 'Alemania' },
  'RENAULT': { nombre: 'Renault', pais: 'Francia' },
  'PEUGEOT': { nombre: 'Peugeot', pais: 'Francia' },
  'CITROEN': { nombre: 'Citroën', pais: 'Francia' },
  'FIAT': { nombre: 'Fiat', pais: 'Italia' },
  'ALFA ROMEO': { nombre: 'Alfa Romeo', pais: 'Italia' },
  'OPEL': { nombre: 'Opel', pais: 'Alemania' },
  'SEAT': { nombre: 'Seat', pais: 'España' },
  'SKODA': { nombre: 'Škoda', pais: 'República Checa' },
  'VOLVO': { nombre: 'Volvo', pais: 'Suecia' },
  'IVECO': { nombre: 'Iveco', pais: 'Italia' },
  'DODGE': { nombre: 'Dodge', pais: 'Estados Unidos' },
  'JEEP': { nombre: 'Jeep', pais: 'Estados Unidos' },
  'CHRYSLER': { nombre: 'Chrysler', pais: 'Estados Unidos' },
  'CHEVROLET': { nombre: 'Chevrolet', pais: 'Estados Unidos' },
  'GM-CHEVROLET': { nombre: 'Chevrolet', pais: 'Estados Unidos' },
  'FORD': { nombre: 'Ford', pais: 'Estados Unidos' },
  'FORD (INDUSTRIAL)': { nombre: 'Ford', pais: 'Estados Unidos' },
  'TOYOTA': { nombre: 'Toyota', pais: 'Japón' },
  'LEXUS': { nombre: 'Toyota', pais: 'Japón' },
  'NISSAN': { nombre: 'Nissan', pais: 'Japón' },
  'INFINITI': { nombre: 'Nissan', pais: 'Japón' },
  'MITSUBISHI': { nombre: 'Mitsubishi', pais: 'Japón' },
  'HONDA': { nombre: 'Honda', pais: 'Japón' },
  'ACURA': { nombre: 'Honda', pais: 'Japón' },
  'HYUNDAI': { nombre: 'Hyundai', pais: 'Corea del Sur' },
  'KIA': { nombre: 'Kia', pais: 'Corea del Sur' },
  'MAZDA': { nombre: 'Mazda', pais: 'Japón' },
  'SUZUKI': { nombre: 'Suzuki', pais: 'Japón' },
  'SUBARU': { nombre: 'Subaru', pais: 'Japón' },
  'ISUZU': { nombre: 'Isuzu', pais: 'Japón' },
  'HINO': { nombre: 'Hino', pais: 'Japón' },
  'DAIHATSU': { nombre: 'Daihatsu', pais: 'Japón' },
  'DAEWOO': { nombre: 'Daewoo', pais: 'Corea del Sur' },
  'SSANGYONG': { nombre: 'SsangYong', pais: 'Corea del Sur' },
  'LAND ROVER': { nombre: 'Land Rover', pais: 'Reino Unido' },
  'ROVER GROUP': { nombre: 'Land Rover', pais: 'Reino Unido' },
  'LANCIA': { nombre: 'Lancia', pais: 'Italia' }
};

const CATEGORY_MAP = {
  'Junta de culata': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Junta de Culata' },
  'Juego completo': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Juego Completo de Empaques' },
  'Juego de descarbonización': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Juego de Descarbonización (Superior)' },
  'Juego complemento': { categoria: 'Empaques', subsistema: 'Block', nombreBase: 'Juego Complemento de Empaques (Bloque)' },
  'Juego junta tapa de culata': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Juego de Junta Tapa de Culata' },
  'Junta tapa de culata': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Junta Tapa de Culata' },
  'Tapa de culata con junta': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Tapa de Culata con Junta' },
  'Junta de colectores': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Junta de Colector Admisión/Escape' },
  'Junta cárter de aceite': { categoria: 'Empaques', subsistema: 'Block', nombreBase: 'Junta de Cárter de Aceite' },
  'Juego cárter de aceite': { categoria: 'Empaques', subsistema: 'Block', nombreBase: 'Juego de Empaques de Cárter' },
  'Juego retén de válvula': { categoria: 'Sellos', subsistema: 'Sellos y Juntas', nombreBase: 'Juego de Retenes de Válvula' },
  'Retén de válvula': { categoria: 'Sellos', subsistema: 'Sellos y Juntas', nombreBase: 'Retén de Guía de Válvula' },
  'Retén de aceite': { categoria: 'Sellos', subsistema: 'Sellos y Juntas', nombreBase: 'Retén de Aceite' },
  'Retén de aceite con tapa': { categoria: 'Sellos', subsistema: 'Sellos y Juntas', nombreBase: 'Retén de Aceite con Brida' },
  'Juego retén de aceite': { categoria: 'Sellos', subsistema: 'Sellos y Juntas', nombreBase: 'Juego de Retenes de Aceite' },
  'Juego tornillos de culata': { categoria: 'Pernos', subsistema: 'Culata', nombreBase: 'Juego de Tornillos de Culata' },
  'Árbol de levas': { categoria: 'Culata', subsistema: 'Culata', nombreBase: 'Árbol de Levas' },
  'Taqués hidráulicos': { categoria: 'Válvulas', subsistema: 'Culata', nombreBase: 'Taqués Hidráulicos de Válvula' },
  'Tubo de engrase': { categoria: 'Lubricación', subsistema: 'Block', nombreBase: 'Tubo de Engrase de Turbo' },
  'Juego camisas': { categoria: 'Camisas', subsistema: 'Block', nombreBase: 'Juego de Camisas de Cilindro' },
  'Juego junta de culata': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Juego de Junta de Culata' },
  'Arandelas espirometálicas': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Arandelas Espirometálicas' },
  'Arandelas de cobre': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Arandelas de Cobre' },
  'Arandelas de aluminio': { categoria: 'Empaques', subsistema: 'Culata', nombreBase: 'Arandelas de Aluminio' }
};

function parseNum(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '.').replace(/[^0-9.]/g, '').trim();
  const num = parseFloat(str);
  return (!isNaN(num) && num > 0) ? num : null;
}

function parseDimensions(text) {
  if (!text) return null;
  // Examples: '5x10.9x10', '29x45x8 S', 'ø76'
  const clean = text.replace(/ø/g, '').trim();
  const parts = clean.split(/[xX]/).map(s => parseNum(s)).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

async function main() {
  console.log('🚀 Iniciando proceso de importación del catálogo AJUSA a Supabase...');

  // 1. Cargar JSON local
  const jsonPath = path.resolve(process.cwd(), 'RecursosExtras/catalogo_ajusa.json');
  console.log(`📖 Leyendo archivo ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const catalogData = JSON.parse(rawData);
  const productos = catalogData.productos || [];
  const bloques = catalogData.bloques_aplicacion || [];
  console.log(`✅ ${productos.length} productos y ${bloques.length} bloques de aplicación encontrados en el catálogo Ajusa.`);

  // Construir mapa de bloques para consulta rápida
  const blockMap = new Map();
  for (const b of bloques) {
    blockMap.set(b.id, b);
  }

  // 2. Asegurar fabricantes automotrices
  console.log('🏭 Verificando y registrando fabricantes automotrices en Supabase...');
  let currentFabricantes = await fetchAll('fabricantes', '*');
  const fabricanteMap = new Map();

  for (const fab of currentFabricantes) {
    fabricanteMap.set(fab.nombre.toUpperCase(), fab.id);
  }

  const missingFabricantes = [];
  let ordenVisual = currentFabricantes.length + 1;

  for (const [key, info] of Object.entries(BRAND_MAPPING)) {
    const upperName = info.nombre.toUpperCase();
    if (!fabricanteMap.has(upperName)) {
      missingFabricantes.push({
        nombre: info.nombre,
        pais_origen: info.pais,
        activo: true,
        orden_visual: ordenVisual++
      });
      fabricanteMap.set(upperName, true); // Evitar duplicados en el loop
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

  const getCleanBrandName = (raw) => {
    if (!raw) return 'Universal';
    const upper = raw.trim().toUpperCase();
    if (BRAND_MAPPING[upper]) return BRAND_MAPPING[upper].nombre;
    const fabId = resolveFabricanteId(raw);
    const found = currentFabricantes.find(f => f.id === fabId);
    return found ? found.nombre : raw;
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

  // 4. Extraer e insertar motores referenciados en los bloques de Ajusa
  console.log('🔍 Extrayendo motores referenciados en bloques de aplicación de Ajusa...');
  const enginesToInsertMap = new Map();

  for (const b of bloques) {
    if (!b.marca_vehiculo || !b.aplicaciones) continue;
    const fabId = resolveFabricanteId(b.marca_vehiculo);
    const brandName = getCleanBrandName(b.marca_vehiculo);

    for (const app of b.aplicaciones) {
      if (!app.motor) continue;
      const code = app.motor.trim();
      if (!code) continue;
      const key = `${fabId}::${code.toUpperCase()}`;

      if (!motorMap.has(key) && !enginesToInsertMap.has(key)) {
        const cc = parseNum(app.cilindrada_cc);
        const hp = parseNum(app.potencia_cv_hp);
        const diam = parseNum(app.diametro_piston_mm);
        const veh = app.vehiculo_detalles ? ` (${app.vehiculo_detalles})` : '';

        const isDiesel = code.includes('TDI') || code.includes('CDI') || code.includes('DCI') ||
                         code.includes('HDI') || code.includes('CRDI') || code.includes('TD') ||
                         code.startsWith('1C') || code.startsWith('2C') || code.startsWith('3C') ||
                         code.startsWith('1HZ') || code.startsWith('1HD') || code.startsWith('1KD');

        enginesToInsertMap.set(key, {
          fabricante_id: fabId,
          codigo: code,
          nombre_comercial: `${brandName} ${code}${veh}`,
          cilindrada_cc: cc ? Math.round(cc) : null,
          cilindros: 4,
          valvulas: 16,
          combustible: isDiesel ? 'Diésel' : 'Gasolina',
          diametro_cilindro_std_mm: diam,
          especificaciones_tecnicas: {
            fuente: 'Catálogo Ajusa',
            potencia_cv: hp,
            vehiculo_detalles: app.vehiculo_detalles || null,
            anio_desde: app.anio_desde || null,
            anio_hasta: app.anio_hasta || null
          }
        });
      }
    }
  }

  if (enginesToInsertMap.size > 0) {
    console.log(`➕ Insertando ${enginesToInsertMap.size} motores nuevos identificados de Ajusa...`);
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
    console.log('\n✅ Todos los motores de Ajusa sincronizados y asociados.');
  }

  // 5. Limpieza previa selectiva de Ajusa (idempotencia)
  console.log('🧹 Limpiando registros previos de AJUSA si existieran...');
  await apiRequest('equivalencias_repuestos?marca_alterna=eq.Ajusa', 'DELETE');
  await apiRequest('repuestos_tecnicos?especificaciones_tecnicas->>marca_catalogo=eq.AJUSA', 'DELETE');
  console.log('✅ Base de datos lista para inserción limpia de Ajusa.');

  // 6. Preparar repuestos y equivalencias de Ajusa
  console.log('⚙️ Transformando y estructurando 26,529 componentes técnicos de Ajusa...');
  const repuestosPayload = [];
  const equivalenciasPayload = [];

  for (const prod of productos) {
    const repuestoId = crypto.randomUUID();
    const catInfo = CATEGORY_MAP[prod.categoria] || {
      categoria: 'Empaques',
      subsistema: 'Culata',
      nombreBase: prod.categoria || 'Repuesto Ajusa'
    };

    // Extraer datos de los bloques en los que se aplica el producto
    const brandsSet = new Set();
    const motorsSet = new Set();
    const vehiculosSet = new Set();
    let diamCil = null;
    let diamInt = null;
    let diamExt = null;
    let altura = null;

    for (const bId of (prod.bloques_aplicacion || [])) {
      const b = blockMap.get(bId);
      if (!b) continue;

      if (b.marca_vehiculo) {
        brandsSet.add(getCleanBrandName(b.marca_vehiculo));
      }

      if (b.aplicaciones) {
        for (const app of b.aplicaciones) {
          if (app.motor) motorsSet.add(app.motor.trim());
          if (app.vehiculo_detalles) vehiculosSet.add(app.vehiculo_detalles.trim());
        }
      }

      // Buscar detalles de producto en el bloque (cotas, diámetros)
      if (b.productos) {
        const bp = b.productos.find(x => x.codigo === prod.codigo_producto);
        if (bp) {
          // Si es junta de culata y tiene diametro en celda
          if (!diamCil && bp.diametros_en_celda && bp.diametros_en_celda.length > 0) {
            const dims = parseDimensions(bp.diametros_en_celda[0]);
            if (dims && dims[0]) diamCil = dims[0];
          }
          // Si tiene medidas_texto (sellos de valvula o retenes)
          if ((!diamInt || !diamExt || !altura) && bp.medidas_texto && bp.medidas_texto.length > 0) {
            const dims = parseDimensions(bp.medidas_texto[0]);
            if (dims) {
              if (dims.length >= 3) {
                diamInt = dims[0];
                diamExt = dims[1];
                altura = dims[2];
              } else if (dims.length === 2) {
                diamInt = dims[0];
                diamExt = dims[1];
              } else if (dims.length === 1 && !diamCil) {
                diamCil = dims[0];
              }
            }
          }
        }
      }
    }

    const marcasList = Array.from(brandsSet);
    const primaryBrand = marcasList.length > 0 ? marcasList[0] : 'Universal';
    const primaryFabId = resolveFabricanteId(primaryBrand);
    const motoresList = Array.from(motorsSet);
    const vehiculosList = Array.from(vehiculosSet).slice(0, 10);

    // Motor primario
    let primaryMotorId = null;
    if (motoresList.length > 0) {
      const firstEngine = motoresList[0].trim().toUpperCase();
      primaryMotorId = motorMap.get(`${primaryFabId}::${firstEngine}`) || null;
    }

    const motoresStr = motoresList.slice(0, 4).join('/');
    const nombre = `${catInfo.nombreBase} ${motoresStr ? `Motor ${motoresStr}` : ''} (${primaryBrand})`.replace(/\s+/g, ' ').trim();

    const repuestoRow = {
      id: repuestoId,
      motor_id: primaryMotorId,
      codigo_oem: prod.codigo_producto,
      nombre,
      subsistema: catInfo.subsistema,
      categoria: catInfo.categoria,
      precio: 0.00,
      stock: 8,
      estado: 'Disponible',
      diametro_cilindro_mm: diamCil,
      dimensiones: {
        diametro_cilindro_mm: diamCil,
        diametro_interior_mm: diamInt,
        diametro_exterior_mm: diamExt,
        altura_mm: altura,
        categoria_original: prod.categoria
      },
      especificaciones_tecnicas: {
        marca_catalogo: 'AJUSA',
        codigo_ajusa: prod.codigo_producto,
        categoria_original: prod.categoria,
        marcas_vehiculo: marcasList,
        motores_compatibles: motoresList,
        vehiculos: vehiculosList,
        bloques_aplicacion: prod.bloques_aplicacion ? prod.bloques_aplicacion.slice(0, 20) : [],
        total_bloques: prod.bloques_aplicacion ? prod.bloques_aplicacion.length : 0,
        fuente: 'Catálogo AJUSA Gaskets.pdf'
      }
    };
    repuestosPayload.push(repuestoRow);

    // Equivalencia Ajusa
    equivalenciasPayload.push({
      repuesto_id: repuestoId,
      marca_alterna: 'Ajusa',
      codigo_alterno: prod.codigo_producto.trim().toUpperCase(),
      tipo_referencia: 'Cruce directo de catálogo Ajusa',
      notas: `Ajusa España (${prod.categoria || 'Juntas y Empaques'})`,
      especificaciones_tecnicas: {
        fabricante: primaryBrand,
        categoria: prod.categoria
      }
    });
  }

  // 7. Inserción de repuestos en lotes de 100
  console.log(`📦 Insertando ${repuestosPayload.length} repuestos técnicos de Ajusa en Supabase...`);
  const BATCH_SIZE_REP = 100;
  for (let i = 0; i < repuestosPayload.length; i += BATCH_SIZE_REP) {
    const chunk = repuestosPayload.slice(i, i + BATCH_SIZE_REP);
    await apiRequest('repuestos_tecnicos', 'POST', chunk);
    if ((i + BATCH_SIZE_REP) % 500 === 0 || i + BATCH_SIZE_REP >= repuestosPayload.length) {
      process.stdout.write(`\r   Repuestos insertados: ${Math.min(i + BATCH_SIZE_REP, repuestosPayload.length)} / ${repuestosPayload.length}`);
    }
  }
  console.log('\n✅ Repuestos de Ajusa insertados exitosamente.');

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
  console.log(`🔗 Insertando ${dedupedEquivalencias.length} equivalencias de Ajusa...`);
  const BATCH_SIZE_EQ = 200;
  for (let i = 0; i < dedupedEquivalencias.length; i += BATCH_SIZE_EQ) {
    const chunk = dedupedEquivalencias.slice(i, i + BATCH_SIZE_EQ);
    await apiRequest('equivalencias_repuestos', 'POST', chunk, {
      'Prefer': 'resolution=ignore-duplicates,return=minimal'
    });
    if ((i + BATCH_SIZE_EQ) % 1000 === 0 || i + BATCH_SIZE_EQ >= dedupedEquivalencias.length) {
      process.stdout.write(`\r   Equivalencias insertadas: ${Math.min(i + BATCH_SIZE_EQ, dedupedEquivalencias.length)} / ${dedupedEquivalencias.length}`);
    }
  }
  console.log('\n✅ Equivalencias de Ajusa insertadas con éxito.');

  console.log('\n🎉 ¡IMPORTACIÓN DE AJUSA COMPLETADA EXITOSAMENTE!');
  console.log(`- Total repuestos Ajusa: ${repuestosPayload.length}`);
  console.log(`- Total equivalencias Ajusa: ${dedupedEquivalencias.length}`);
}

main().catch(err => {
  console.error('\n❌ ERROR FATAL EN IMPORTACIÓN AJUSA:', err);
  process.exit(1);
});

