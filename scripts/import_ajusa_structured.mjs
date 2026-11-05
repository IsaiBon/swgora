import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function runImport() {
  console.log('--- INICIO DE INGESTA ESTRUCTURADA DE REPUESTOS AJUSA POR GRUPOS ---');

  // 1. Cargar fabricantes
  console.log('1. Cargando fabricantes...');
  const { data: dbFabs } = await supabase.from('fabricantes').select('id, nombre');
  const fabMap = new Map();
  for (const f of dbFabs || []) {
    fabMap.set(f.nombre.toUpperCase().trim(), f.id);
  }
  // Default manufacturer fallback
  const defaultFabId = fabMap.get('TOYOTA') || dbFabs?.[0]?.id;

  // 2. Cargar todos los motores de la base de datos
  console.log('2. Cargando motores existentes en base de datos...');
  let allMotors = [];
  let from = 0;
  while (true) {
    const { data: mBatch } = await supabase
      .from('motores')
      .select('id, codigo, fabricante_id, fabricante:fabricantes(nombre)')
      .range(from, from + 999);
    if (!mBatch || mBatch.length === 0) break;
    allMotors.push(...mBatch);
    if (mBatch.length < 1000) break;
    from += 1000;
  }
  console.log(`✓ Motores cargados: ${allMotors.length}`);

  const motorByFabAndCode = new Map();
  const motorByCode = new Map();
  for (const m of allMotors) {
    const clean = m.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fab = (m.fabricante?.nombre || '').toUpperCase().trim();
    if (fab) motorByFabAndCode.set(`${fab}:${clean}`, m.id);
    if (!motorByCode.has(clean)) motorByCode.set(clean, m.id);
  }

  // 3. Procesar catálogo Ajusa
  console.log('3. Analizando RecursosExtras/catalogo_ajusa.json...');
  const data = JSON.parse(fs.readFileSync('RecursosExtras/catalogo_ajusa.json', 'utf8'));

  const bloqueMap = new Map();
  for (const b of data.bloques_aplicacion) {
    bloqueMap.set(b.id, b);
  }

  const sealMeasure = new Map();
  for (const b of data.bloques_aplicacion) {
    for (const prod of b.productos || []) {
      if (prod.medidas_texto && prod.medidas_texto.length > 0) {
        sealMeasure.set(prod.codigo, prod.medidas_texto[0]);
      }
    }
  }

  const sealRegex = /^([0-9]+(?:\.[0-9]+)?)\s*[xX*×]\s*([0-9]+(?:\.[0-9]+)?)\s*[xX*×]\s*([0-9]+(?:\.[0-9]+)?)/;

  const newEngineRows = [];
  const repuestosRows = [];
  const equivRows = [];

  for (const p of data.productos) {
    const cat = (p.categoria || '').toLowerCase().trim();

    const isSello = cat.includes('retén de válvula') || cat.includes('reten de valvula');
    const isPerno = cat.includes('tornillo');
    const isJunta = cat === 'junta de culata';

    if (!isSello && !isPerno && !isJunta) continue;

    const marcas = new Set();
    const motores = new Set();
    const vehiculos = new Set();

    let medidaTexto = null;
    let diametroCulata = null;
    let cantidadPzas = null;

    for (const bId of p.bloques_aplicacion || []) {
      const b = bloqueMap.get(bId);
      if (!b) continue;
      if (b.marca_vehiculo) marcas.add(b.marca_vehiculo.trim());
      for (const app of b.aplicaciones || []) {
        if (app.motor) motores.add(app.motor.trim());
        if (app.vehiculo_detalles) vehiculos.add(app.vehiculo_detalles.trim());
      }
      for (const prodInBlock of b.productos || []) {
        if (prodInBlock.codigo === p.codigo_producto) {
          if (!medidaTexto && prodInBlock.medidas_texto && prodInBlock.medidas_texto.length > 0) {
            medidaTexto = prodInBlock.medidas_texto[0];
          }
          if (!diametroCulata && prodInBlock.diametros_en_celda && prodInBlock.diametros_en_celda.length > 0) {
            diametroCulata = prodInBlock.diametros_en_celda[0];
          }
          if (!cantidadPzas && prodInBlock.cantidades_texto && prodInBlock.cantidades_texto.length > 0) {
            cantidadPzas = prodInBlock.cantidades_texto[0];
          }
        }
        if (isSello && !medidaTexto && sealMeasure.has(prodInBlock.codigo)) {
          medidaTexto = sealMeasure.get(prodInBlock.codigo);
        }
      }
    }

    let finalCategoria = '';
    let finalSubsistema = '';
    let finalNombre = '';
    let di = null;
    let de = null;
    let h = null;
    let d_cil = null;

    if (isSello) {
      finalCategoria = 'Sellos';
      finalSubsistema = 'Sellos y Juntas';
      if (medidaTexto) {
        const match = medidaTexto.trim().match(sealRegex);
        if (match) {
          di = parseFloat(match[1]);
          de = parseFloat(match[2]);
          h = parseFloat(match[3]);
        }
      }
      const isKit = cat.includes('juego');
      const labelMedida = medidaTexto ? ` (${medidaTexto} mm)` : '';
      finalNombre = isKit ? `Juego de Retenes de Válvula AJUSA${labelMedida}` : `Retén de Guía de Válvula AJUSA${labelMedida}`;
    } else if (isPerno) {
      finalCategoria = 'Pernos';
      finalSubsistema = 'Culata';
      const cantLabel = cantidadPzas ? ` [${cantidadPzas}]` : '';
      finalNombre = `Juego de Tornillos de Culata AJUSA${cantLabel}`;
    } else if (isJunta) {
      finalCategoria = 'Empaques';
      finalSubsistema = 'Culata';
      if (diametroCulata) {
        const match = diametroCulata.replace(/,/g, '.').match(/([0-9]+(?:\.[0-9]+)?)/);
        if (match) {
          d_cil = parseFloat(match[1]);
        }
      }
      const diaLabel = diametroCulata ? ` (${diametroCulata})` : '';
      finalNombre = `Junta de Culata AJUSA${diaLabel}`;
    }

    // Resolver motor_id
    const marcasArr = [...marcas];
    const motoresArr = [...motores];
    let matchedMotorId = null;

    for (const mCode of motoresArr) {
      const clean = mCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      for (const mMarca of marcasArr) {
        const key = `${mMarca.toUpperCase().trim()}:${clean}`;
        if (motorByFabAndCode.has(key)) {
          matchedMotorId = motorByFabAndCode.get(key);
          break;
        }
      }
      if (!matchedMotorId && motorByCode.has(clean)) {
        matchedMotorId = motorByCode.get(clean);
        break;
      }
      if (matchedMotorId) break;
    }

    // Si aún no tiene motor, tomar el primer código de motor y marca para registrarlo si es válido
    if (!matchedMotorId && motoresArr.length > 0) {
      const firstMotorCode = motoresArr[0].trim();
      const firstMarca = marcasArr[0]?.toUpperCase()?.trim();
      const targetFabId = fabMap.get(firstMarca) || defaultFabId;
      const cleanCode = firstMotorCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (!motorByCode.has(cleanCode) && firstMotorCode.length > 1 && firstMotorCode.length < 30) {
        const newEngineId = crypto.randomUUID();
        newEngineRows.push({
          id: newEngineId,
          codigo: firstMotorCode,
          fabricante_id: targetFabId,
          cilindros: 4,
          valvulas: 8,
          combustible: 'Gasolina',
          especificaciones_tecnicas: {
            origen: 'AJUSA Catalog Seed',
            marca_vehiculo: marcasArr[0] || 'Universal'
          }
        });
        matchedMotorId = newEngineId;
        motorByCode.set(cleanCode, newEngineId);
        if (firstMarca) motorByFabAndCode.set(`${firstMarca}:${cleanCode}`, newEngineId);
      }
    }

    const partId = crypto.randomUUID();

    repuestosRows.push({
      id: partId,
      motor_id: matchedMotorId,
      codigo_oem: p.codigo_producto,
      nombre: finalNombre,
      subsistema: finalSubsistema,
      categoria: finalCategoria,
      precio: 0,
      stock: 10,
      estado: 'Disponible',
      imagen_url: null,
      diametro_cabeza_mm: null,
      diametro_vastago_mm: null,
      longitud_total_mm: null,
      angulo_asiento_grados: null,
      diametro_cilindro_mm: d_cil,
      espesor_anillo1_mm: null,
      espesor_anillo2_mm: null,
      espesor_aceite_mm: null,
      tipo_cojinete: null,
      diametro_munon_mm: null,
      diametro_alojamiento_mm: null,
      ancho_casquete_mm: null,
      dimensiones: {
        diametro_interior_mm: di,
        diametro_exterior_mm: de,
        altura_mm: h,
        diametro_cilindro_mm: d_cil,
        medida_texto: medidaTexto,
        cantidad_piezas: cantidadPzas,
        marcas_compatibles: marcasArr,
        motores_compatibles: motoresArr
      },
      especificaciones_tecnicas: {
        marca_catalogo: 'AJUSA',
        codigo_ajusa: p.codigo_producto,
        categoria_ajusa: p.categoria,
        marcas_vehiculo: marcasArr,
        motores_compatibles: motoresArr,
        vehiculos: [...vehiculos].slice(0, 5),
        fuente: '01 - AJUSA.pdf'
      }
    });

    equivRows.push({
      repuesto_id: partId,
      marca_alterna: 'Ajusa',
      codigo_alterno: p.codigo_producto,
      tipo_referencia: 'Cruce Directo',
      notas: `AJUSA - ${p.categoria}`
    });
  }

  console.log(`✓ Preparados ${repuestosRows.length} repuestos técnicos estructurados de AJUSA`);
  console.log(`✓ Nuevos motores a registrar: ${newEngineRows.length}`);
  console.log(`✓ Equivalencias preparadas: ${equivRows.length}`);

  // 4. Inserción de motores faltantes
  if (newEngineRows.length > 0) {
    console.log('4. Insertando nuevos motores en Supabase...');
    const engineChunks = chunkArray(newEngineRows, 100);
    for (let i = 0; i < engineChunks.length; i++) {
      const { error: engErr } = await supabase.from('motores').insert(engineChunks[i]);
      if (engErr) {
        console.error(`Error en lote de motores ${i}:`, engErr.message);
      }
      process.stdout.write(`\rMotores registrados: ${(i + 1) * 100}/${newEngineRows.length}`);
    }
    console.log('\n✓ Motores registrados correctamente.');
  }

  // 5. Inserción de repuestos_tecnicos
  console.log('5. Insertando repuestos técnicos en Supabase...');
  const partChunks = chunkArray(repuestosRows, 150);
  for (let i = 0; i < partChunks.length; i++) {
    const { error: partErr } = await supabase.from('repuestos_tecnicos').insert(partChunks[i]);
    if (partErr) {
      console.error(`Error en lote de repuestos ${i}:`, partErr.message);
    }
    process.stdout.write(`\rRepuestos insertados: ${Math.min((i + 1) * 150, repuestosRows.length)}/${repuestosRows.length}`);
  }
  console.log('\n✓ Repuestos técnicos de Ajusa insertados exitosamente.');

  // 6. Inserción de equivalencias_repuestos
  console.log('6. Insertando equivalencias de Ajusa en Supabase...');
  const equivChunks = chunkArray(equivRows, 500);
  for (let i = 0; i < equivChunks.length; i++) {
    const { error: eqErr } = await supabase.from('equivalencias_repuestos').insert(equivChunks[i]);
    if (eqErr) {
      console.error(`Error en lote de equivalencias ${i}:`, eqErr.message);
    }
    process.stdout.write(`\rEquivalencias insertadas: ${Math.min((i + 1) * 500, equivRows.length)}/${equivRows.length}`);
  }
  console.log('\n✓ Equivalencias insertadas exitosamente.');

  // 7. Verificación final de conteo y desglose por grupo
  console.log('\n--- VERIFICACIÓN FINAL EN BASE DE DATOS ---');
  const { count: totalParts } = await supabase.from('repuestos_tecnicos').select('*', { count: 'exact', head: true });
  const { count: sellosTotal } = await supabase.from('repuestos_tecnicos').select('*', { count: 'exact', head: true }).eq('categoria', 'Sellos');
  const { count: pernosTotal } = await supabase.from('repuestos_tecnicos').select('*', { count: 'exact', head: true }).eq('categoria', 'Pernos');
  const { count: empaquesTotal } = await supabase.from('repuestos_tecnicos').select('*', { count: 'exact', head: true }).eq('categoria', 'Empaques');
  const { count: anillosTotal } = await supabase.from('repuestos_tecnicos').select('*', { count: 'exact', head: true }).eq('categoria', 'Anillos');
  const { count: valvulasTotal } = await supabase.from('repuestos_tecnicos').select('*', { count: 'exact', head: true }).eq('categoria', 'Válvulas');

  console.log({
    totalRepuestosEnDB: totalParts,
    desglosePorGrupo: {
      'Ajuste de válvula (Sellos)': sellosTotal,
      'Juego de tornillos de culata (Pernos)': pernosTotal,
      'Empaques y Juntas (Empaques)': empaquesTotal,
      'Anillos de motor (Anillos RIK)': anillosTotal,
      'Válvulas (Dokuro)': valvulasTotal
    }
  });
}

runImport();
