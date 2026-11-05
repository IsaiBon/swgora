import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ahfnuegsdmnjelcypitk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NURLGy4Cs_0IS0qajjHg-A_Xl7M7rXw';

const baseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      ...baseHeaders,
      'Prefer': 'return=minimal'
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

async function fetchAll(table, select = 'id', filter = '') {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&offset=${page * pageSize}&limit=${pageSize}`;
    if (filter) {
      url += `&${filter}`;
    }
    const res = await fetch(url, { headers: baseHeaders });
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

// Extractor robusto de números OEM automotrices del catálogo RIK
function extractOemReferences(item) {
  const allTexts = [
    ...(item.remarks_raw || []),
    ...(item.anillos?.map(a => a.rest) || [])
  ];
  const combined = allTexts.join(' ');
  const tokens = combined.split(/[\s,]+/);
  const oems = new Set();

  tokens.forEach(tok => {
    let t = tok.replace(/[()]/g, '').replace(/\/cyl\.?$/i, '').trim();
    if (!t) return;
    if (t === item.codigo_rik || t === item.set_no) return;
    if (/^(KEYSTONE|HALF|CR1|CR2|CR3|CR4|RN|GN|SV|FX|FM|SM|FV|RN|STD|FE|CYL|SET|TOP|2ND|OIL|NEW|OLD|P|T|O|EXP|CH|BF|CO|L1|L2)$/i.test(t)) return;
    if (/^\d{1,2}(ST|ND|RD|TH)=/i.test(t)) return;
    if (t.includes('KEYSTONE')) return;
    if (/^\d+x\d+/i.test(t)) return;

    const cleanChars = t.replace(/[^A-Z0-9]/gi, '');
    if (cleanChars.length < 7) return; // Filtrar códigos cortos como ED-10, 4E-FE, 2L-T

    // Formato con guión (Toyota, Nissan, Isuzu, Subaru, Honda, Mazda, etc.)
    if (/^[A-Z0-9]{1,6}(?:-[A-Z0-9]{1,6}){1,4}$/i.test(t) && /\d/.test(t) && t.includes('-')) {
      if (/^[A-Z0-9]{3,5}-[A-Z]{1,2}$/i.test(t)) return;
      oems.add(t.toUpperCase());
    } 
    // Formato Mitsubishi / otros fabricantes sin guión (MD050370, ME011..., etc.)
    else if (/^(?:MD|ME|MB|MC|MN|MR|OK|K\d|A\d|B\d|C\d)\d{5,7}[A-Z]?$/i.test(t)) {
      oems.add(t.toUpperCase());
    }
  });

  return Array.from(oems);
}

// Pool de concurrencia simple
async function mapConcurrent(items, concurrency, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array(Math.min(concurrency, items.length)).fill(0).map(worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('🚀 Iniciando estandarización y actualización completa de OEM en catálogo RIK...');

  // 1. Cargar y enriquecer catalogo_rik.json local
  const jsonPath = path.resolve(process.cwd(), 'RecursosExtras/catalogo_rik.json');
  console.log(`📖 Leyendo archivo local ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const rikItems = JSON.parse(rawData);
  console.log(`✅ ${rikItems.length} juegos RIK leídos.`);

  const rikMapBySetNo = new Map();
  let totalExtractedOems = 0;
  let itemsWithOems = 0;

  rikItems.forEach(item => {
    const oems = extractOemReferences(item);
    item.referencias_oem = oems;
    if (oems.length > 0) {
      itemsWithOems++;
      totalExtractedOems += oems.length;
    }
    const key = String(item.codigo_rik || item.set_no).trim();
    rikMapBySetNo.set(key, item);
  });

  console.log(`✨ Enriquecidos ${itemsWithOems} repuestos con un total de ${totalExtractedOems} números OEM.`);
  fs.writeFileSync(jsonPath, JSON.stringify(rikItems, null, 2), 'utf8');
  console.log(`💾 catalogo_rik.json guardado localmente con las nuevas referencias OEM.`);

  // 2. Traer todos los repuestos RIK de Supabase
  console.log('🌐 Consultando repuestos RIK en Supabase...');
  const dbRepuestos = await fetchAll('repuestos_tecnicos', 'id,codigo_oem,especificaciones_tecnicas', 'categoria=eq.Anillos');
  const rikDbList = dbRepuestos.filter(r => r.especificaciones_tecnicas?.marca_catalogo === 'RIK');
  console.log(`📦 Encontrados ${rikDbList.length} repuestos RIK en la base de datos.`);

  // 3. Actualizar codigo_oem a RIK-<set_no> y especificaciones_tecnicas.referencias_oem
  console.log('🔄 Actualizando codigo_oem = RIK-<codigo_rik> y especificaciones en Supabase...');
  let updatedCount = 0;

  await mapConcurrent(rikDbList, 25, async (rep, idx) => {
    const spec = rep.especificaciones_tecnicas || {};
    const setNo = String(spec.codigo_rik || spec.set_no || '').trim();
    const localItem = rikMapBySetNo.get(setNo);
    const oems = localItem ? localItem.referencias_oem : (spec.referencias_oem || []);

    const newCode = `RIK-${setNo}`;
    const updatedSpec = {
      ...spec,
      codigo_rik: setNo,
      referencias_oem: oems
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/repuestos_tecnicos?id=eq.${rep.id}`, {
      method: 'PATCH',
      headers: {
        ...baseHeaders,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        codigo_oem: newCode,
        especificaciones_tecnicas: updatedSpec
      })
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.error(`Error actualizando repuesto ${rep.id}:`, errTxt);
    } else {
      updatedCount++;
    }

    if (updatedCount % 100 === 0 || updatedCount === rikDbList.length) {
      process.stdout.write(`\rActualizados: ${updatedCount} / ${rikDbList.length}`);
    }
  });

  console.log(`\n✅ ${updatedCount} repuestos técnicos RIK actualizados con código principal estándar RIK-...`);

  // 4. Eliminar equivalencias anteriores de estos 1,160 repuestos
  console.log('🗑️ Eliminando equivalencias previas de los repuestos RIK...');
  const repIds = rikDbList.map(r => r.id);
  const deleteBatchSize = 100;
  for (let i = 0; i < repIds.length; i += deleteBatchSize) {
    const chunk = repIds.slice(i, i + deleteBatchSize);
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/equivalencias_repuestos?repuesto_id=in.(${chunk.join(',')})`, {
      method: 'DELETE',
      headers: baseHeaders
    });
    if (!delRes.ok) {
      const errTxt = await delRes.text();
      console.error(`Error borrando equivalencias chunk ${i}:`, errTxt);
    }
    process.stdout.write(`\rEliminadas equivalencias previas: ${Math.min(i + deleteBatchSize, repIds.length)} / ${repIds.length}`);
  }
  console.log('\n✅ Equivalencias anteriores limpiadas.');

  // 5. Generar e insertar todas las nuevas equivalencias
  console.log('📝 Generando matriz completa de equivalencias (OEMs + Rik)...');
  const equivalenciasToInsert = [];

  for (const rep of rikDbList) {
    const spec = rep.especificaciones_tecnicas || {};
    const setNo = String(spec.codigo_rik || spec.set_no || '').trim();
    const localItem = rikMapBySetNo.get(setNo);
    const oems = localItem ? localItem.referencias_oem : (spec.referencias_oem || []);
    const isKeystone = localItem ? localItem.diseno_conico : spec.diseno_conico;
    const keystoneTipo = localItem ? localItem.keystone_tipo : spec.keystone_tipo;

    // Equivalencia Rik (para retrocompatibilidad y búsqueda por número directo)
    if (setNo) {
      equivalenciasToInsert.push({
        repuesto_id: rep.id,
        marca_alterna: 'Rik',
        codigo_alterno: setNo,
        tipo_referencia: 'Número de Parte RIK',
        notas: isKeystone ? `1° Anillo Cónico (${keystoneTipo || 'KEYSTONE'})` : 'Estándar'
      });
    }

    // Todas las equivalencias OEM cruzadas
    for (const oemCode of oems) {
      equivalenciasToInsert.push({
        repuesto_id: rep.id,
        marca_alterna: 'OEM',
        codigo_alterno: oemCode,
        tipo_referencia: 'Referencia Original de Fábrica',
        notas: null
      });
    }
  }

  console.log(`📤 Insertando ${equivalenciasToInsert.length} equivalencias en Supabase...`);
  const insertBatchSize = 100;
  for (let i = 0; i < equivalenciasToInsert.length; i += insertBatchSize) {
    const chunk = equivalenciasToInsert.slice(i, i + insertBatchSize);
    await apiRequest('equivalencias_repuestos', 'POST', chunk);
    process.stdout.write(`\rInsertadas equivalencias: ${Math.min(i + insertBatchSize, equivalenciasToInsert.length)} / ${equivalenciasToInsert.length}`);
  }

  console.log('\n🎉 ¡Proceso completado exitosamente!');
  console.log('🔍 Verificando caso de prueba RIK-12510...');
  const test12510 = await fetchAll('repuestos_tecnicos', 'id,codigo_oem', 'codigo_oem=eq.RIK-12510');
  if (test12510.length > 0) {
    const pId = test12510[0].id;
    const testEqs = await fetchAll('equivalencias_repuestos', 'marca_alterna,codigo_alterno', `repuesto_id=eq.${pId}`);
    console.log(`Repuesto RIK-12510 (ID: ${pId}) tiene ahora las siguientes equivalencias:`);
    console.table(testEqs);
  }
}

main().catch(err => {
  console.error('❌ Error fatal en main:', err);
  process.exit(1);
});
