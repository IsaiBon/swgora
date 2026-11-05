import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function parseGuideLength(remarks) {
  if (!remarks || typeof remarks !== 'string') return null;
  const match = remarks.match(/(\d+(?:\.\d+)?)\s*mm/i) || remarks.match(/length\s*(\d+(?:\.\d+)?)/i);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val >= 20 && val <= 250) return val;
  }
  return null;
}

// Extractor profundo de medidas de válvula desde OCR raw
function parseValveMeasurements(app) {
  let head = app.head_dia_mm ? Number(app.head_dia_mm) : null;
  let stem = app.stem_dia_mm ? Number(app.stem_dia_mm) : null;
  let len = app.overall_length_mm ? Number(app.overall_length_mm) : null;
  let angle = app.seat_angle_deg ? Number(app.seat_angle_deg) : null;
  let headStyle = app.head_style || null;
  let stemEnd = app.stem_end || null;

  const fullText = [
    app.registro_original_catalogo,
    app.contexto_original
  ].filter(Boolean).join('\n');

  if (fullText) {
    const clean = fullText
      .replace(/[\(\[\{\/]/g, ' ')
      .replace(/(\d+)\s*[%*]/g, '$1°')
      .replace(/(\d{1,3})\s*-\s*00\b/g, '$1.00')
      .replace(/(\d{1,3})\s*\.\s*00\b/g, '$1.00');

    if (!angle) {
      const aM = clean.match(/(\d{2})\s*°/);
      if (aM && [30, 45, 60, 75].includes(Number(aM[1]))) angle = Number(aM[1]);
    }

    if (!head || !stem || !len) {
      const decRegex = /(?:^|[^\w.])(\d{1,3}\.\d{1,2})(?=[^\w.]|$)/g;
      const decimals = [];
      let m;
      while ((m = decRegex.exec(clean)) !== null) {
        decimals.push(parseFloat(m[1]));
      }

      for (let i = 0; i <= decimals.length - 3; i++) {
        const d1 = decimals[i], d2 = decimals[i+1], d3 = decimals[i+2];
        if (d1 >= 18 && d1 <= 80 && d2 >= 4.5 && d2 <= 17 && d3 >= 55 && d3 <= 280) {
          if (!head) head = d1;
          if (!stem) stem = d2;
          if (!len) len = d3;
          break;
        }
      }

      if (head && stem && !len) {
        for (const d of decimals) {
          if (d >= 55 && d <= 280 && d !== head && d !== stem) {
            len = d;
            break;
          }
        }
      }
    }

    if (!headStyle) {
      const hsMatch = clean.match(/\b(ST|FR|FL|DF|CF|F)\b/);
      if (hsMatch) headStyle = hsMatch[1];
    }

    if (!stemEnd) {
      const seMatch = clean.match(/\b(CG|MG|1G|2G|3G|4G|1C|2C|ITG|PG|TG|SG|NG)\b/);
      if (seMatch) stemEnd = seMatch[1];
    }
  }

  return { head, stem, len, angle, headStyle, stemEnd };
}

async function runUpdate() {
  console.log('--- ACTUALIZANDO MEDIDAS Y ESTRUCTURA DOKURO EN SUPABASE ---');

  const rawDokuro = JSON.parse(fs.readFileSync('RecursosExtras/DOKURO_2006_SUPABASE_DEFINITIVO_AUDITADO.json', 'utf8'));

  // 1. Mapeo de Dokuro Master Measurements
  const masterValves = new Map();
  const stemByEngine = new Map();

  for (const item of rawDokuro) {
    if (item.tipo_producto === 'engine_valve') {
      const app = item.aplicaciones?.[0] || {};
      const code = (item.codigo_dokuro || item.codigo_catalogo || '').trim().toUpperCase();
      const dims = parseValveMeasurements(app);
      if (code && dims.head && dims.stem) {
        masterValves.set(code, dims);
      }

      // Guardar stem por motor
      const brand = (item.fabricantes?.[0] || '').trim().toUpperCase();
      const pos = (app.position || 'IN').toUpperCase();
      const engines = (app.engine_type_lines || []).concat(app.engine_models || []).concat([app.engine_type]).filter(Boolean);
      for (const e of engines) {
        const cleanE = e.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanE && dims.stem) {
          stemByEngine.set(`${brand}:${cleanE}:${pos}`, dims.stem);
          stemByEngine.set(`${brand}:${cleanE}:ALL`, dims.stem);
        }
      }
    }
  }
  console.log(`✓ Válvulas maestras con medidas completas: ${masterValves.size}`);

  // 2. Cargar todos los repuestos Dokuro existentes en Supabase
  console.log('Cargando repuestos Dokuro de Supabase...');
  let dokParts = [];
  let from = 0;
  while (true) {
    const { data: batch, error } = await supabase
      .from('repuestos_tecnicos')
      .select('id, codigo_oem, categoria, dimensiones, especificaciones_tecnicas')
      .contains('especificaciones_tecnicas', { marca_catalogo: 'DOKURO' })
      .range(from, from + 999);

    if (error) {
      console.error('Error cargando repuestos:', error.message);
      break;
    }
    if (!batch || batch.length === 0) break;
    dokParts.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  console.log(`✓ Total repuestos Dokuro en DB: ${dokParts.length}`);

  // 3. Preparar actualizaciones
  let updatedCount = 0;
  const updates = [];

  for (const dbPart of dokParts) {
    const spec = dbPart.especificaciones_tecnicas || {};
    const dokCode = (spec.codigo_dokuro || spec.codigo_catalogo || dbPart.codigo_oem || '').trim().toUpperCase();
    const rawItem = rawDokuro.find(r => 
      (r.codigo_dokuro && r.codigo_dokuro.trim().toUpperCase() === dokCode) ||
      (r.codigo_catalogo && r.codigo_catalogo.trim().toUpperCase() === dokCode) ||
      r.id === spec.item_id
    );

    const app = rawItem?.aplicaciones?.[0] || {};

    if (dbPart.categoria === 'Válvulas') {
      let dims = parseValveMeasurements(app);
      if (!dims.head && dokCode && masterValves.has(dokCode)) {
        dims = masterValves.get(dokCode);
      }
      if (!dims.head) {
        const txt = [app.registro_original_catalogo, app.contexto_original].filter(Boolean).join(' ');
        for (const [mCode, mDims] of masterValves.entries()) {
          if (txt.includes(mCode)) {
            dims = mDims;
            break;
          }
        }
      }

      const pos = (app.position || 'IN').toUpperCase();
      const posLabel = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : (pos === 'AU' ? 'Auxiliar' : pos));

      const newDimensiones = {
        tipo_valvula: posLabel,
        posicion: pos,
        hongo_mm: dims.head,
        diametro_cabeza_mm: dims.head,
        diametro_vastago_mm: dims.stem,
        longitud_total_mm: dims.len,
        angulo_asiento_grados: dims.angle,
        head_style: dims.headStyle,
        stem_end: dims.stemEnd,
        catalogo: 'Dokuro'
      };

      const newSpec = {
        ...spec,
        marca_catalogo: 'DOKURO',
        catalogo_origen: 'Dokuro'
      };

      updates.push({
        id: dbPart.id,
        diametro_cabeza_mm: dims.head,
        diametro_vastago_mm: dims.stem,
        longitud_total_mm: dims.len,
        angulo_asiento_grados: dims.angle,
        dimensiones: newDimensiones,
        especificaciones_tecnicas: newSpec
      });
    } else if (dbPart.categoria === 'Guías') {
      const pos = (app.position || 'IN/EX').toUpperCase();
      const setQty = app.set ? Number(app.set) : (dbPart.dimensiones?.set || 4);
      const guideLen = parseGuideLength(app.remarks) || dbPart.longitud_total_mm;

      const brand = (rawItem?.fabricantes?.[0] || '').trim().toUpperCase();
      const e = (app.engine_type || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      let stemVal = null;
      if (pos.includes('IN')) stemVal = stemByEngine.get(`${brand}:${e}:IN`);
      if (!stemVal && pos.includes('EX')) stemVal = stemByEngine.get(`${brand}:${e}:EX`);
      if (!stemVal) stemVal = stemByEngine.get(`${brand}:${e}:ALL`);

      const newDimensiones = {
        posicion: pos,
        set: setQty,
        diametro_interior_mm: stemVal,
        diametro_exterior_mm: null,
        longitud_total_mm: guideLen,
        remarks: app.remarks || null,
        catalogo: 'Dokuro'
      };

      const newSpec = {
        ...spec,
        marca_catalogo: 'DOKURO',
        catalogo_origen: 'Dokuro'
      };

      updates.push({
        id: dbPart.id,
        diametro_interior_mm: stemVal,
        longitud_total_mm: guideLen,
        dimensiones: newDimensiones,
        especificaciones_tecnicas: newSpec
      });
    } else if (dbPart.categoria === 'Asientos') {
      const pos = (app.position || 'IN').toUpperCase();
      const posLabel = pos === 'IN' ? 'Admisión' : (pos === 'EX' ? 'Escape' : pos);
      const cylStr = app.cylinders ? app.cylinders.join('/') : (dbPart.dimensiones?.cilindros || null);

      const newDimensiones = {
        posicion: posLabel,
        cilindros: cylStr,
        interchangeable: app.interchangeable || dbPart.dimensiones?.interchangeable || [],
        catalogo: 'Dokuro'
      };

      const newSpec = {
        ...spec,
        marca_catalogo: 'DOKURO',
        catalogo_origen: 'Dokuro'
      };

      updates.push({
        id: dbPart.id,
        dimensiones: newDimensiones,
        especificaciones_tecnicas: newSpec
      });
    }
  }

  console.log(`Aplicando ${updates.length} actualizaciones en Supabase...`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const promises = chunk.map(item => {
      const { id, ...payload } = item;
      return supabase.from('repuestos_tecnicos').update(payload).eq('id', id);
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.error) {
        console.error('Error:', r.error.message);
      } else {
        updatedCount++;
      }
    }
    console.log(`Progreso: ${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length}`);
  }

  console.log(`✓ Proceso terminado. Total actualizados con éxito: ${updatedCount}`);
}

runUpdate();
