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
  'Toyota': { nombre: 'Toyota', pais: 'Japón' },
  'Nissan': { nombre: 'Nissan', pais: 'Japón' },
  'Nissan Diesel': { nombre: 'UD Trucks', pais: 'Japón' },
  'Mitsubishi': { nombre: 'Mitsubishi', pais: 'Japón' },
  'Isuzu': { nombre: 'Isuzu', pais: 'Japón' },
  'Hino': { nombre: 'Hino', pais: 'Japón' },
  'Mazda': { nombre: 'Mazda', pais: 'Japón' },
  'Honda': { nombre: 'Honda', pais: 'Japón' },
  'Suzuki': { nombre: 'Suzuki', pais: 'Japón' },
  'Subaru': { nombre: 'Subaru', pais: 'Japón' },
  'Daihatsu': { nombre: 'Daihatsu', pais: 'Japón' },
  'Hyundai': { nombre: 'Hyundai', pais: 'Corea del Sur' },
  'Kia': { nombre: 'Kia', pais: 'Corea del Sur' },
  'Daewoo': { nombre: 'Daewoo', pais: 'Corea del Sur' },
  'Korean Car': { nombre: 'Asia Multimarca', pais: 'Asia' },
  'Universal': { nombre: 'Universal', pais: 'Multinacional' }
};

async function main() {
  console.log('🚀 Iniciando importación del catálogo oficial RIK a Supabase...');

  // 1. Cargar JSON local
  const jsonPath = path.resolve(process.cwd(), 'RecursosExtras/catalogo_rik.json');
  console.log(`📖 Leyendo archivo ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const rikItems = JSON.parse(rawData);
  console.log(`✅ ${rikItems.length} juegos de anillos encontrados en catálogo RIK.`);

  const keystones = rikItems.filter(x => x.diseno_conico);
  console.log(`🔥 ${keystones.length} juegos identificados con diseño Cónico / Keystone.`);

  // 2. Obtener Fabricantes y Motores existentes
  console.log('🌐 Obteniendo fabricantes de Supabase...');
  let fabricantes = await fetchAll('fabricantes', 'id,nombre');
  const fabMap = new Map();
  fabricantes.forEach(f => fabMap.set(f.nombre.toLowerCase().trim(), f.id));

  // Asegurar fabricantes faltantes
  for (const [key, bInfo] of Object.entries(BRAND_MAPPING)) {
    const norm = bInfo.nombre.toLowerCase().trim();
    if (!fabMap.has(norm)) {
      console.log(`➕ Creando fabricante: ${bInfo.nombre}`);
      const created = await apiRequest('fabricantes', 'POST', [{
        nombre: bInfo.nombre,
        pais_origen: bInfo.pais
      }]);
      if (created && created[0]) {
        fabMap.set(norm, created[0].id);
      }
    }
  }

  // Refrescar mapa de fabricantes
  fabricantes = await fetchAll('fabricantes', 'id,nombre');
  fabricantes.forEach(f => fabMap.set(f.nombre.toLowerCase().trim(), f.id));

  console.log('🌐 Obteniendo motores existentes de Supabase...');
  const motores = await fetchAll('motores', 'id,fabricante_id,codigo');
  const motorMap = new Map();
  motores.forEach(m => {
    const key = `${m.fabricante_id}_${String(m.codigo).toLowerCase().trim()}`;
    motorMap.set(key, m.id);
  });

  // 3. Crear motores que no existan para que los aros queden correctamente vinculados
  console.log('🔧 Verificando y registrando motores RIK en la base de datos...');
  const newMotors = [];
  const processedMotorKeys = new Set();

  for (const item of rikItems) {
    const bInfo = BRAND_MAPPING[item.marca_fabricante] || { nombre: item.marca_fabricante };
    const fabId = fabMap.get(bInfo.nombre.toLowerCase().trim()) || fabMap.get('universal');
    if (!fabId) continue;

    const motCode = (item.motor_principal || 'Universal').trim();
    if (motCode === 'Universal' || motCode.length < 2) continue;

    const mKey = `${fabId}_${motCode.toLowerCase()}`;
    if (!motorMap.has(mKey) && !processedMotorKeys.has(mKey)) {
      processedMotorKeys.add(mKey);
      newMotors.push({
        fabricante_id: fabId,
        codigo: motCode,
        nombre_comercial: item.vehiculos && item.vehiculos[0] ? item.vehiculos[0] : motCode,
        cilindrada_cc: item.cilindrada_cc || null,
        cilindros: item.cilindros || 4,
        valvulas: (item.cilindros || 4) * 2,
        combustible: 'Diésel'
      });
    }
  }

  if (newMotors.length > 0) {
    console.log(`➕ Insertando ${newMotors.length} motores nuevos en Supabase...`);
    const batchSize = 100;
    for (let i = 0; i < newMotors.length; i += batchSize) {
      const chunk = newMotors.slice(i, i + batchSize);
      const inserted = await apiRequest('motores', 'POST', chunk);
      if (inserted) {
        inserted.forEach(m => {
          const key = `${m.fabricante_id}_${String(m.codigo).toLowerCase().trim()}`;
          motorMap.set(key, m.id);
        });
      }
    }
    console.log('✅ Motores nuevos vinculados.');
  }

  // 4. Preparar Repuestos Técnicos RIK
  console.log('📦 Preparando repuestos técnicos RIK para inserción...');
  const repuestosToInsert = [];

  for (const item of rikItems) {
    const bInfo = BRAND_MAPPING[item.marca_fabricante] || { nombre: item.marca_fabricante };
    const fabId = fabMap.get(bInfo.nombre.toLowerCase().trim()) || fabMap.get('universal');
    
    let motorId = null;
    if (item.motor_principal && item.motor_principal !== 'Universal') {
      const mKey = `${fabId}_${item.motor_principal.toLowerCase().trim()}`;
      motorId = motorMap.get(mKey) || null;
    }

    const firstOem = item.referencias_oem && item.referencias_oem[0] ? item.referencias_oem[0] : `RIK-${item.codigo_rik}`;
    const keystoneTxt = item.diseno_conico ? ' Cónicos (Keystone)' : '';
    const partName = `Juego de Anillos STD${keystoneTxt} Motor ${item.motor_principal} (${bInfo.nombre}) - RIK ${item.codigo_rik}`;

    const rawAnillos = item.anillos || [];
    const anillosDetalle = rawAnillos.map((r, idx) => {
      const isLast = idx === rawAnillos.length - 1;
      const isOil = String(r.posicion || '').toLowerCase().includes('oil') || String(r.posicion_raw) === '0' || isLast;
      const posLabel = isOil ? 'Anillo de aceite' : `Anillo ${idx + 1}`;
      return {
        posicion: posLabel,
        d1: r.d1 || item.diametro_cilindro_mm || null,
        h1: r.h1 || null,
        a1: r.a1 || null,
        forma: r.forma || (idx === 0 && item.diseno_conico ? 'KEYSTONE (Cónico)' : 'RECTANGULAR'),
        diseno_conico: !!(idx === 0 && item.diseno_conico)
      };
    });

    const rep = {
      motor_id: motorId,
      codigo_oem: firstOem,
      nombre: partName,
      subsistema: 'Block',
      categoria: 'Anillos',
      precio: 0.00,
      stock: 10,
      estado: 'Disponible',
      diametro_cilindro_mm: item.diametro_cilindro_mm || null,
      espesor_anillo1_mm: item.espesor_anillo1_mm || null,
      espesor_anillo2_mm: item.espesor_anillo2_mm || null,
      espesor_aceite_mm: item.espesor_aceite_mm || null,
      dimensiones: {
        diametro_cilindro_mm: item.diametro_cilindro_mm,
        espesor_anillo1_mm: item.espesor_anillo1_mm,
        espesor_anillo2_mm: item.espesor_anillo2_mm,
        espesor_aceite_mm: item.espesor_aceite_mm,
        espesor_radial1_mm: rawAnillos[0]?.a1 || null,
        espesor_radial2_mm: rawAnillos[1]?.a1 || null,
        espesor_radial_aceite_mm: rawAnillos[rawAnillos.length - 1]?.a1 || null,
        forma1: anillosDetalle[0]?.forma || (item.diseno_conico ? 'KEYSTONE (Cónico)' : null),
        diseno_conico: !!item.diseno_conico,
        keystone: item.keystone_tipo || null,
        keystone_tipo: item.keystone_tipo || null,
        cilindros: item.cilindros ? String(item.cilindros) : null,
        anillos: anillosDetalle,
        motores_texto: item.motores_compatibles?.join(', ') || item.motor_principal
      },
      especificaciones_tecnicas: {
        marca_catalogo: 'RIK',
        codigo_rik: item.codigo_rik,
        set_no: item.set_no,
        set_type: item.set_type,
        fuente: 'Anillos Rik.pdf',
        pagina_catalogo: item.pagina_pdf,
        diseno_conico: !!item.diseno_conico,
        keystone: item.keystone_tipo || null,
        keystone_tipo: item.keystone_tipo || null,
        referencias_oem: item.referencias_oem || [],
        motores_compatibles: item.motores_compatibles || [],
        vehiculos: item.vehiculos || [],
        cilindros: item.cilindros ? String(item.cilindros) : null,
        cilindrada_cc: item.cilindrada_cc || null
      }
    };

    repuestosToInsert.push({ repuesto: rep, rikItem: item });
  }

  // 5. Inserción de Repuestos en bloques
  console.log(`📤 Subiendo ${repuestosToInsert.length} repuestos RIK a Supabase...`);
  const batchSize = 100;
  const equivalenciasToInsert = [];

  for (let i = 0; i < repuestosToInsert.length; i += batchSize) {
    const chunk = repuestosToInsert.slice(i, i + batchSize);
    const body = chunk.map(c => c.repuesto);

    const inserted = await apiRequest('repuestos_tecnicos', 'POST', body);
    if (inserted && Array.isArray(inserted)) {
      inserted.forEach((dbRep, idx) => {
        const origRik = chunk[idx].rikItem;

        // Equivalencia de marca Rik
        equivalenciasToInsert.push({
          repuesto_id: dbRep.id,
          marca_alterna: 'Rik',
          codigo_alterno: origRik.codigo_rik,
          tipo_referencia: 'Número de Parte RIK',
          notas: origRik.diseno_conico ? `1° Anillo Cónico (${origRik.keystone_tipo})` : 'Estándar'
        });

        // Equivalencias de números OEM cruzados
        if (origRik.referencias_oem && origRik.referencias_oem.length > 0) {
          origRik.referencias_oem.forEach(oemCode => {
            if (oemCode !== dbRep.codigo_oem) {
              equivalenciasToInsert.push({
                repuesto_id: dbRep.id,
                marca_alterna: 'OEM',
                codigo_alterno: oemCode,
                tipo_referencia: 'Referencia Original de Fábrica'
              });
            }
          });
        }
      });
    }

    process.stdout.write(`\rInsertados: ${Math.min(i + batchSize, repuestosToInsert.length)} / ${repuestosToInsert.length}`);
  }
  console.log('\n✅ Repuestos técnicos RIK insertados exitosamente.');

  // 6. Inserción de Equivalencias
  console.log(`🔄 Insertando ${equivalenciasToInsert.length} equivalencias de cruce RIK...`);
  for (let i = 0; i < equivalenciasToInsert.length; i += batchSize) {
    const chunk = equivalenciasToInsert.slice(i, i + batchSize);
    await apiRequest('equivalencias_repuestos', 'POST', chunk);
    process.stdout.write(`\rEquivalencias: ${Math.min(i + batchSize, equivalenciasToInsert.length)} / ${equivalenciasToInsert.length}`);
  }
  console.log('\n✅ Equivalencias RIK y OEM cruzadas registradas.');

  console.log('🎉 ¡Catálogo RIK subido completamente a Supabase de forma ordenada y verificada!');
}

main().catch(console.error);
