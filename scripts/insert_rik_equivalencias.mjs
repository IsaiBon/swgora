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

async function main() {
  console.log('🔄 Preparando equivalencias para repuestos RIK...');

  // Traer repuestos RIK de la base de datos
  const res = await fetchAll('repuestos_tecnicos', 'id,codigo_oem,especificaciones_tecnicas');
  const rikReps = res.filter(r => r.especificaciones_tecnicas?.marca_catalogo === 'RIK');
  console.log(`📦 Encontrados ${rikReps.length} repuestos RIK en base de datos.`);

  const equivalenciasToInsert = [];

  for (const dbRep of rikReps) {
    const spec = dbRep.especificaciones_tecnicas || {};
    const codRik = spec.codigo_rik;
    const isKeystone = spec.diseno_conico;
    const keystoneTipo = spec.keystone_tipo;
    const refs = spec.referencias_oem || [];

    // Equivalencia Rik
    if (codRik) {
      equivalenciasToInsert.push({
        repuesto_id: dbRep.id,
        marca_alterna: 'Rik',
        codigo_alterno: codRik,
        tipo_referencia: 'Número de Parte RIK',
        notas: isKeystone ? `1° Anillo Cónico (${keystoneTipo || 'KEYSTONE'})` : 'Estándar'
      });
    }

    // Equivalencias OEM
    for (const ref of refs) {
      if (ref !== dbRep.codigo_oem) {
        equivalenciasToInsert.push({
          repuesto_id: dbRep.id,
          marca_alterna: 'OEM',
          codigo_alterno: ref,
          tipo_referencia: 'Referencia Original de Fábrica',
          notas: null
        });
      }
    }
  }

  console.log(`📤 Insertando ${equivalenciasToInsert.length} equivalencias con claves normalizadas...`);
  const batchSize = 100;
  for (let i = 0; i < equivalenciasToInsert.length; i += batchSize) {
    const chunk = equivalenciasToInsert.slice(i, i + batchSize);
    await apiRequest('equivalencias_repuestos', 'POST', chunk);
    process.stdout.write(`\rInsertadas: ${Math.min(i + batchSize, equivalenciasToInsert.length)} / ${equivalenciasToInsert.length}`);
  }
  console.log('\n✅ Todas las equivalencias RIK y OEM quedaron insertadas correctamente.');
}

main().catch(console.error);

