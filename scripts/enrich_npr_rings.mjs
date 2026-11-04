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

    const r1 = nprItem.anillos?.[0] || {};
    const r2 = nprItem.anillos?.[1] || {};
    const rOil = nprItem.anillos?.[2] || {};

    const d1 = Number(r1.diametro_mm || dbRing.diametro_cilindro_mm || 0);
    const h1 = Number(r1.altura_mm || dbRing.espesor_anillo1_mm || 0);
    const a1 = Number(r1.espesor_radial_mm || dbRing.dimensiones?.espesor_radial1_mm || 0);

    const d2 = Number(r2.diametro_mm || d1 || 0);
    const h2 = Number(r2.altura_mm || dbRing.espesor_anillo2_mm || 0);
    const a2 = Number(r2.espesor_radial_mm || dbRing.dimensiones?.espesor_radial2_mm || 0);

    const dOil = Number(rOil.diametro_mm || d1 || 0);
    const hOil = Number(rOil.altura_mm || dbRing.espesor_aceite_mm || 0);
    const aOil = Number(rOil.espesor_radial_mm || dbRing.dimensiones?.espesor_radial_aceite_mm || 0);

    const anillosDetalle = [
      {
        posicion: '1st',
        d1: d1 > 0 ? d1 : null,
        h1: h1 > 0 ? h1 : null,
        a1: a1 > 0 ? a1 : null,
        forma: r1.forma || dbRing.dimensiones?.forma1 || null,
        material: r1.material || dbRing.dimensiones?.material1 || null,
        tratamiento_ext: r1.tratamiento_exterior || null,
        tratamiento_int: r1.tratamiento_superior_inferior || null
      },
      {
        posicion: '2nd',
        d1: d2 > 0 ? d2 : null,
        h1: h2 > 0 ? h2 : null,
        a1: a2 > 0 ? a2 : null,
        forma: r2.forma || null,
        material: r2.material || null,
        tratamiento_ext: r2.tratamiento_exterior || null,
        tratamiento_int: r2.tratamiento_superior_inferior || null
      },
      {
        posicion: 'Oil',
        d1: dOil > 0 ? dOil : null,
        h1: hOil > 0 ? hOil : null,
        a1: aOil > 0 ? aOil : null,
        forma: rOil.forma || null,
        material: rOil.material || null,
        tratamiento_ext: rOil.tratamiento_exterior || null,
        tratamiento_int: rOil.tratamiento_superior_inferior || null
      }
    ];

    const newDimensiones = {
      ...(dbRing.dimensiones || {}),
      diametro_cilindro_mm: d1 > 0 ? d1 : dbRing.diametro_cilindro_mm,
      espesor_anillo1_mm: h1 > 0 ? h1 : dbRing.espesor_anillo1_mm,
      espesor_anillo2_mm: h2 > 0 ? h2 : dbRing.espesor_anillo2_mm,
      espesor_aceite_mm: hOil > 0 ? hOil : dbRing.espesor_aceite_mm,
      espesor_radial1_mm: a1 > 0 ? a1 : dbRing.dimensiones?.espesor_radial1_mm,
      espesor_radial2_mm: a2 > 0 ? a2 : dbRing.dimensiones?.espesor_radial2_mm,
      espesor_radial_aceite_mm: aOil > 0 ? aOil : dbRing.dimensiones?.espesor_radial_aceite_mm,
      forma1: r1.forma || dbRing.dimensiones?.forma1,
      forma2: r2.forma || null,
      forma_oil: rOil.forma || null,
      material1: r1.material || dbRing.dimensiones?.material1,
      material2: r2.material || null,
      material_oil: rOil.material || null,
      anillos: anillosDetalle
    };

    updates.push({
      id: dbRing.id,
      diametro_cilindro_mm: d1 > 0 ? d1 : dbRing.diametro_cilindro_mm,
      espesor_anillo1_mm: h1 > 0 ? h1 : dbRing.espesor_anillo1_mm,
      espesor_anillo2_mm: h2 > 0 ? h2 : dbRing.espesor_anillo2_mm,
      espesor_aceite_mm: hOil > 0 ? hOil : dbRing.espesor_aceite_mm,
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

