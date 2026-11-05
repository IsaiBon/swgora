const SUPABASE_URL = 'https://ahfnuegsdmnjelcypitk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NURLGy4Cs_0IS0qajjHg-A_Xl7M7rXw';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function main() {
  console.log('🔍 Buscando repuestos de catálogo NPR para eliminar...');

  // 1. Obtener IDs de repuestos NPR
  let offset = 0;
  const limit = 1000;
  let nprIds = [];

  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/repuestos_tecnicos?select=id,nombre,especificaciones_tecnicas&limit=${limit}&offset=${offset}`, { headers });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const item of data) {
      const mc = item.especificaciones_tecnicas?.marca_catalogo;
      const fuente = item.especificaciones_tecnicas?.fuente;
      const codNpr = item.especificaciones_tecnicas?.codigo_npr;
      if (mc === 'NPR' || fuente === 'Catálogo NPR.pdf' || codNpr || (item.nombre && item.nombre.includes('(NPR)'))) {
        nprIds.push(item.id);
      }
    }

    offset += limit;
    if (data.length < limit) break;
  }

  console.log(`🎯 Total de repuestos NPR encontrados en DB: ${nprIds.length}`);

  if (nprIds.length === 0) {
    console.log('✅ No hay repuestos NPR en la base de datos.');
  } else {
    // Eliminar en lotes de 100
    console.log('🗑️ Eliminando repuestos NPR de Supabase...');
    const batchSize = 100;
    for (let i = 0; i < nprIds.length; i += batchSize) {
      const chunk = nprIds.slice(i, i + batchSize);
      const inClause = `(${chunk.join(',')})`;
      
      // Eliminar equivalencias asociadas primero si las hay
      await fetch(`${SUPABASE_URL}/rest/v1/equivalencias_repuestos?repuesto_id=in.${inClause}`, {
        method: 'DELETE',
        headers
      });

      // Eliminar de repuestos_tecnicos
      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/repuestos_tecnicos?id=in.${inClause}`, {
        method: 'DELETE',
        headers
      });

      if (!delRes.ok) {
        console.error(`Error eliminando lote ${i}: ${await delRes.text()}`);
      }
      process.stdout.write(`\rEliminados: ${Math.min(i + batchSize, nprIds.length)} / ${nprIds.length}`);
    }
    console.log('\n✅ Repuestos NPR eliminados de repuestos_tecnicos.');
  }

  // Eliminar equivalencias residuales de marca NPR
  console.log('🔍 Buscando equivalencias residuales de marca NPR...');
  const eqDelRes = await fetch(`${SUPABASE_URL}/rest/v1/equivalencias_repuestos?marca_alterna=eq.NPR`, {
    method: 'DELETE',
    headers
  });
  console.log(`✅ Equivalencias con marca_alterna NPR limpiadas (status ${eqDelRes.status}).`);

  // Verificar recuento final
  console.log('📊 Verificando estado final...');
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/repuestos_tecnicos?select=id&limit=1`, {
    headers: { ...headers, 'Prefer': 'count=exact' }
  });
  const countHeader = checkRes.headers.get('content-range');
  console.log(`📦 Total repuestos restantes en DB: ${countHeader}`);
}

main().catch(console.error);

