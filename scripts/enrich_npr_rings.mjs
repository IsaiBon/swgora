import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ahfnuegsdmnjelcypitk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NURLGy4Cs_0IS0qajjHg-A_Xl7M7rXw';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function main() {
  console.log('📖 Leyendo catalogo_npr.json...');
  const jsonPath = path.resolve(process.cwd(), 'RecursosExtras/catalogo_npr.json');
  const catalogData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const ringItems = catalogData.filter(x => x.categoria === 'juego_anillos_piston' && x.codigo_npr);
  console.log(`🔍 Total de juegos de anillos en JSON: ${ringItems.length}`);

  // Mapa por codigo_npr
  const nprMap = new Map();
  for (const item of ringItems) {
    nprMap.set(item.codigo_npr.trim().toUpperCase(), item);
  }

  // Traer todos los repuestos existentes de Supabase con paginación
  console.log('🌐 Obteniendo repuestos de categoría Anillos desde Supabase...');
  let dbRings = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/repuestos_tecnicos?categoria=eq.Anillos&select=id,codigo_oem,diametro_cilindro_mm,espesor_anillo1_mm,espesor_anillo2_mm,espesor_aceite_mm,dimensiones,especificaciones_tecnicas&limit=${pageSize}&offset=${page * pageSize}`, { headers });
    if (!res.ok) {
      throw new Error(`Error Supabase: ${res.statusText}`);
    }
    const chunk = await res.json();
    dbRings.push(...chunk);
    if (chunk.length < pageSize) break;
    page++;
  }
  console.log(`📦 Repuestos en base de datos: ${dbRings.length}`);

  let updatedCount = 0;
  const updates = [];

  for (const dbRing of dbRings) {
    const nprCode = (dbRing.especificaciones_tecnicas?.codigo_npr || '').trim().toUpperCase();
    const nprItem = nprMap.get(nprCode);
    if (!nprItem) continue;

    const rawAnillos = Array.isArray(nprItem.anillos) && nprItem.anillos.length > 0
      ? nprItem.anillos
      : [
          { posicion: '1', diametro_mm: dbRing.diametro_cilindro_mm, altura_mm: dbRing.espesor_anillo1_mm, espesor_radial_mm: dbRing.dimensiones?.espesor_radial1_mm },
          { posicion: '2', diametro_mm: dbRing.diametro_cilindro_mm, altura_mm: dbRing.espesor_anillo2_mm, espesor_radial_mm: dbRing.dimensiones?.espesor_radial2_mm },
          { posicion: 'Anillo de aceite', diametro_mm: dbRing.diametro_cilindro_mm, altura_mm: dbRing.espesor_aceite_mm, espesor_radial_mm: dbRing.dimensiones?.espesor_radial_aceite_mm }
        ];

    const totalRings = rawAnillos.length;
    const anillosDetalle = rawAnillos.map((r, idx) => {
      const isLast = idx === totalRings - 1;
      const isOil = String(r.posicion || '').toLowerCase().includes('oil') || isLast;
      const posLabel = isOil ? 'Anillo de aceite' : `${idx + 1}`;
      const d = Number(r.diametro_mm || dbRing.diametro_cilindro_mm || 0);
      const h = Number(r.altura_mm || 0);
      const a = Number(r.espesor_radial_mm || 0);
      return {
        posicion: posLabel,
        d1: d > 0 ? d : null,
        h1: h > 0 ? h : null,
        a1: a > 0 ? a : null,
        forma: r.forma || null,
        material: r.material || null,
        tratamiento_ext: r.tratamiento_exterior || null,
        tratamiento_int: r.tratamiento_superior_inferior || null
      };
    });

    const dMain = anillosDetalle[0]?.d1 || dbRing.diametro_cilindro_mm;
    const h1 = anillosDetalle[0]?.h1 || dbRing.espesor_anillo1_mm;
    const h2 = anillosDetalle[1]?.h1 || dbRing.espesor_anillo2_mm;
    const hOil = anillosDetalle[totalRings - 1]?.h1 || dbRing.espesor_aceite_mm;

    const newDimensiones = {
      ...(dbRing.dimensiones || {}),
      diametro_cilindro_mm: dMain,
      espesor_anillo1_mm: h1,
      espesor_anillo2_mm: h2,
      espesor_aceite_mm: hOil,
      espesor_radial1_mm: anillosDetalle[0]?.a1 || dbRing.dimensiones?.espesor_radial1_mm,
      espesor_radial2_mm: anillosDetalle[1]?.a1 || dbRing.dimensiones?.espesor_radial2_mm,
      espesor_radial_aceite_mm: anillosDetalle[totalRings - 1]?.a1 || dbRing.dimensiones?.espesor_radial_aceite_mm,
      forma1: anillosDetalle[0]?.forma || dbRing.dimensiones?.forma1 || null,
      forma2: anillosDetalle[1]?.forma || null,
      forma_oil: anillosDetalle[totalRings - 1]?.forma || null,
      material1: anillosDetalle[0]?.material || dbRing.dimensiones?.material1 || null,
      material2: anillosDetalle[1]?.material || null,
      material_oil: anillosDetalle[totalRings - 1]?.material || null,
      anillos: anillosDetalle
    };

    updates.push({
      id: dbRing.id,
      diametro_cilindro_mm: dMain,
      espesor_anillo1_mm: h1,
      espesor_anillo2_mm: h2,
      espesor_aceite_mm: hOil,
      dimensiones: newDimensiones
    });
  }

  console.log(`🚀 Actualizando ${updates.length} repuestos en lotes...`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(item => 
      fetch(`${SUPABASE_URL}/rest/v1/repuestos_tecnicos?id=eq.${item.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          diametro_cilindro_mm: item.diametro_cilindro_mm,
          espesor_anillo1_mm: item.espesor_anillo1_mm,
          espesor_anillo2_mm: item.espesor_anillo2_mm,
          espesor_aceite_mm: item.espesor_aceite_mm,
          dimensiones: item.dimensiones
        })
      })
    ));
    updatedCount += chunk.length;
    process.stdout.write(`\r   Progreso: ${updatedCount} / ${updates.length}`);
  }

  console.log('\n✅ Todos los juegos de anillos han sido enriquecidos con su cuadro completo de NPR.');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
