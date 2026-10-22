import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ahfnuegsdmnjelcypitk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NURLGy4Cs_0IS0qajjHg-A_Xl7M7rXw';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${method} ${endpoint} (${res.status}): ${txt}`);
  }
  return await res.json();
}

// Mapeo normalizado de marcas de catálogo NPR a nombres limpios
const BRAND_MAPPING = {
  'TOYOTA': { nombre: 'Toyota', pais: 'Japón' },
  'NISSAN': { nombre: 'Nissan', pais: 'Japón' },
  'MITSUBISHI': { nombre: 'Mitsubishi', pais: 'Japón' },
  'ISUZU': { nombre: 'Isuzu', pais: 'Japón' },
  'HONDA': { nombre: 'Honda', pais: 'Japón' },
  'HYUNDAI': { nombre: 'Hyundai', pais: 'Corea del Sur' },
  'FORD': { nombre: 'Ford', pais: 'Estados Unidos' },
  'GM': { nombre: 'Chevrolet', pais: 'Estados Unidos' },
  'HINO': { nombre: 'Hino', pais: 'Japón' },
  'MAZDA': { nombre: 'Mazda', pais: 'Japón' },
  'DAIHATSU': { nombre: 'Daihatsu', pais: 'Japón' },
  'SUBARU': { nombre: 'Subaru', pais: 'Japón' },
  'SUZUKI': { nombre: 'Suzuki', pais: 'Japón' },
  'KOMATSU': { nombre: 'Komatsu', pais: 'Japón' },
  'UD TRUCKS': { nombre: 'UD Trucks', pais: 'Japón' },
  'KIA': { nombre: 'Kia', pais: 'Corea del Sur' },
  'DAEWOO': { nombre: 'Daewoo', pais: 'Corea del Sur' },
  'CHRYSLER': { nombre: 'Chrysler', pais: 'Estados Unidos' },
  'EUROPE': { nombre: 'Europeos (BMW, Mercedes, VAG)', pais: 'Europa' },
  'ASIA': { nombre: 'Asia Multimarca', pais: 'Asia' },
  'CHINA': { nombre: 'Motores China', pais: 'China' }
};

async function main() {
  console.log('🚀 Iniciando proceso de importación del catálogo NPR a Supabase...');

  // 1. Cargar JSON local
  const jsonPath = path.resolve(process.cwd(), 'RecursosExtras/catalogo_npr.json');
  console.log(`📖 Leyendo archivo ${jsonPath}...`);
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const catalogData = JSON.parse(rawData);
  console.log(`✅ ${catalogData.length} componentes encontrados en el catálogo NPR.`);

  // 2. Limpieza total de repuestos anteriores en base de datos
  console.log('🗑️ Verificando y limpiando componentes previos de la base de datos...');
  await apiRequest('equivalencias_repuestos?id=not.is.null', 'DELETE');
  await apiRequest('repuestos_tecnicos?id=not.is.null', 'DELETE');
  console.log('✅ Base de datos de repuestos limpiada.');

  // 3. Asegurar grupo "Camisas de cilindro" en grupos_repuestos
  console.log('📦 Asegurando grupo camisas_cilindro en grupos_repuestos...');
  const existingGroups = await apiRequest('grupos_repuestos?select=*');
  const hasCamisas = existingGroups.some(g => g.codigo === 'camisas_cilindro' || g.categoria === 'Camisas');
  
  if (!hasCamisas) {
    const camisasGroup = {
      codigo: 'camisas_cilindro',
      nombre: 'Camisas de cilindro',
      categoria: 'Camisas',
      subsistema: 'Block',
      icono: 'Layers',
      descripcion: 'Camisas de cilindro terminadas y semiterminadas para encamisado de bloque',
      parametros: [
        { id: 'param_cam_1', clave: 'diametro_interior_mm', etiqueta: 'Diámetro Interior (A)', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Calibre interior nominal' },
        { id: 'param_cam_2', clave: 'diametro_exterior_mm', etiqueta: 'Diámetro Exterior (B)', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Diámetro de encastre exterior' },
        { id: 'param_cam_3', clave: 'longitud_total_mm', etiqueta: 'Longitud Total (C)', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Largo total de la camisa' },
        { id: 'param_cam_4', clave: 'diametro_pestana_mm', etiqueta: 'Diámetro Pestaña (D)', unidad: 'mm', tipo_dato: 'numero', requerido: false, descripcion: 'Diámetro de la pestaña o brida' },
        { id: 'param_cam_5', clave: 'espesor_pestana_mm', etiqueta: 'Espesor Pestaña (E)', unidad: 'mm', tipo_dato: 'numero', requerido: false, descripcion: 'Espesor de pestaña' },
        { id: 'param_cam_6', clave: 'acabado', etiqueta: 'Acabado', unidad: '', tipo_dato: 'texto', requerido: false, descripcion: 'F: Terminada / S: Semiterminada' },
        { id: 'param_cam_7', clave: 'tipo', etiqueta: 'Tipo de Camisa', unidad: '', tipo_dato: 'texto', requerido: false, descripcion: 'Código de forma o tipo de camisa' }
      ]
    };
    await apiRequest('grupos_repuestos', 'POST', [camisasGroup]);
    console.log('✅ Grupo "camisas_cilindro" creado exitosamente.');
  } else {
    console.log('ℹ️ Grupo de camisas ya existente en grupos_repuestos.');
  }

  // 4. Asegurar fabricantes en base de datos
  console.log('🏭 Verificando fabricantes automotrices...');
  let currentFabricantes = await apiRequest('fabricantes?select=*');
  const fabricanteMap = new Map(); // normalized name -> id

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
    for (const fab of insertedFabs) {
      fabricanteMap.set(fab.nombre.toUpperCase(), fab.id);
    }
  }

  // Refrescar mapa de fabricantes para búsqueda exacta
  currentFabricantes = await apiRequest('fabricantes?select=*');
  for (const fab of currentFabricantes) {
    fabricanteMap.set(fab.nombre.toUpperCase(), fab.id);
  }

  // Función auxiliar para obtener ID de fabricante
  const resolveFabricanteId = (sectionName) => {
    if (!sectionName) return currentFabricantes[0].id;
    const secUpper = sectionName.trim().toUpperCase();
    if (BRAND_MAPPING[secUpper]) {
      const mappedUpper = BRAND_MAPPING[secUpper].nombre.toUpperCase();
      if (fabricanteMap.has(mappedUpper)) return fabricanteMap.get(mappedUpper);
    }
    if (fabricanteMap.has(secUpper)) return fabricanteMap.get(secUpper);
    // Búsqueda parcial
    for (const [name, id] of fabricanteMap.entries()) {
      if (name.includes(secUpper) || secUpper.includes(name)) return id;
    }
    return currentFabricantes[0].id;
  };

  // 5. Cargar motores existentes y mapear
  console.log('🏎️ Cargando motores existentes de la base de datos...');
  const currentMotores = await apiRequest('motores?select=id,fabricante_id,codigo');
  const motorMap = new Map(); // `${fabId}::${codigo.toUpperCase()}` -> id

  for (const mot of currentMotores) {
    if (mot.codigo && mot.fabricante_id) {
      motorMap.set(`${mot.fabricante_id}::${mot.codigo.trim().toUpperCase()}`, mot.id);
    }
  }
  console.log(`ℹ️ ${motorMap.size} motores ya existentes en la BD.`);

  // 6. Recopilar motores del catálogo NPR a insertar
  console.log('🔍 Extrayendo motores referenciados en el catálogo NPR...');
  const enginesToInsertMap = new Map();

  for (const item of catalogData) {
    const fabId = resolveFabricanteId(item.seccion_catalogo);
    const motoresList = item.motores && item.motores.length > 0 ? item.motores : [];

    for (const rawCode of motoresList) {
      const code = rawCode.trim();
      if (!code) continue;
      const key = `${fabId}::${code.toUpperCase()}`;

      if (!motorMap.has(key) && !enginesToInsertMap.has(key)) {
        // Parsear cilindrada de forma segura (evitar desbordamiento de integer)
        let cc = null;
        if (item.cilindrada_cc_texto) {
          const match = item.cilindrada_cc_texto.match(/([0-9]{1,2}[,\.]?[0-9]{3}|[0-9]{2,5})/);
          if (match) {
            const num = parseInt(match[0].replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > 0 && num <= 40000) cc = num;
          }
        }

        // Parsear cilindros
        let cyl = 4;
        if (item.cilindros_texto) {
          const match = String(item.cilindros_texto).match(/\d+/);
          if (match) {
            const c = parseInt(match[0], 10);
            if (!isNaN(c) && c > 0 && c <= 24) cyl = c;
          }
        }

        // Diámetro estándar del cilindro si viene en anillos o camisa
        let diametroStd = null;
        if (item.anillos && item.anillos[0] && item.anillos[0].diametro_mm) {
          diametroStd = Number(item.anillos[0].diametro_mm);
        } else if (item.camisa && item.camisa.diametro_a_mm) {
          diametroStd = Number(item.camisa.diametro_a_mm);
        }

        const brandEntry = currentFabricantes.find(f => f.id === fabId);
        const brandName = brandEntry ? brandEntry.nombre : (item.seccion_catalogo || 'Motor');
        const veh = item.vehiculos_chasis && item.vehiculos_chasis[0] ? ` (${item.vehiculos_chasis[0]})` : '';

        enginesToInsertMap.set(key, {
          fabricante_id: fabId,
          codigo: code,
          nombre_comercial: `${brandName} ${code}${veh}`,
          cilindrada_cc: cc,
          cilindros: cyl,
          valvulas: cyl === 4 ? 16 : cyl * 2,
          combustible: (code.includes('D') || (item.seccion_catalogo || '').includes('HINO') || (item.seccion_catalogo || '').includes('UD')) ? 'Diésel' : 'Gasolina',
          diametro_cilindro_std_mm: diametroStd,
          especificaciones_tecnicas: {
            fuente: 'Catálogo NPR',
            vehiculos: item.vehiculos_chasis || []
          }
        });
      }
    }
  }

  console.log(`➕ Insertando ${enginesToInsertMap.size} motores nuevos identificados...`);
  const engineBatches = Array.from(enginesToInsertMap.values());
  const BATCH_SIZE_MOTORES = 100;

  for (let i = 0; i < engineBatches.length; i += BATCH_SIZE_MOTORES) {
    const chunk = engineBatches.slice(i, i + BATCH_SIZE_MOTORES);
    const inserted = await apiRequest('motores', 'POST', chunk);
    for (const mot of inserted) {
      motorMap.set(`${mot.fabricante_id}::${mot.codigo.trim().toUpperCase()}`, mot.id);
    }
    process.stdout.write(`\r   Motores insertados: ${Math.min(i + BATCH_SIZE_MOTORES, engineBatches.length)} / ${engineBatches.length}`);
  }
  console.log('\n✅ Todos los motores sincronizados y asociados.');

  // 7. Preparar repuestos y equivalencias técnicas
  console.log('⚙️ Transformando y estructurando 1,660 componentes con reglas paramétricas de grupos...');
  const repuestosPayload = [];
  const equivalenciasPayload = [];

  for (const item of catalogData) {
    const repuestoId = crypto.randomUUID();
    const fabId = resolveFabricanteId(item.seccion_catalogo);
    const brandEntry = currentFabricantes.find(f => f.id === fabId);
    const brandName = brandEntry ? brandEntry.nombre : (item.seccion_catalogo || 'Universal');

    // Asociar a motor primario
    let primaryMotorId = null;
    if (item.motores && item.motores.length > 0) {
      const code = item.motores[0].trim().toUpperCase();
      primaryMotorId = motorMap.get(`${fabId}::${code}`) || null;
    }

    const oemCode = (item.referencias && item.referencias.length > 0)
      ? item.referencias[0].trim().toUpperCase()
      : item.codigo_npr.trim().toUpperCase();

    const motoresStr = item.motores && item.motores.length > 0 ? item.motores.join('/') : '';

    if (item.categoria === 'juego_anillos_piston') {
      const ring1 = item.anillos ? item.anillos.find(a => a.posicion === '1st') || item.anillos[0] : null;
      const ring2 = item.anillos ? item.anillos.find(a => a.posicion === '2nd') || item.anillos[1] : null;
      const ringOil = item.anillos ? item.anillos.find(a => a.posicion && a.posicion.toLowerCase().includes('oil')) || item.anillos[2] : null;

      const diamCil = ring1?.diametro_mm || ring2?.diametro_mm || null;
      const esp1 = ring1?.altura_mm || null;
      const esp2 = ring2?.altura_mm || null;
      const espOil = ringOil?.altura_mm || null;

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: oemCode,
        nombre: `Juego de Anillos STD ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName})`,
        subsistema: 'Block',
        categoria: 'Anillos',
        precio: 0.00,
        stock: 12,
        estado: 'Disponible',
        diametro_cilindro_mm: diamCil,
        espesor_anillo1_mm: esp1,
        espesor_anillo2_mm: esp2,
        espesor_aceite_mm: espOil,
        longitud_total_mm: null,
        dimensiones: {
          diametro_cilindro_mm: diamCil,
          espesor_anillo1_mm: esp1,
          espesor_anillo2_mm: esp2,
          espesor_aceite_mm: espOil,
          espesor_radial1_mm: ring1?.espesor_radial_mm || null,
          espesor_radial2_mm: ring2?.espesor_radial_mm || null,
          espesor_radial_aceite_mm: ringOil?.espesor_radial_mm || null,
          cilindros: item.cilindros_texto || null,
          forma1: ring1?.forma || null,
          material1: ring1?.material || null
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'NPR',
          codigo_npr: item.codigo_npr,
          seccion_catalogo: item.seccion_catalogo,
          motores_compatibles: item.motores || [],
          vehiculos: item.vehiculos_chasis || [],
          cilindrada: item.cilindrada_cc_texto || null,
          cilindros: item.cilindros_texto || null,
          referencias_oem: item.referencias || [],
          pagina_catalogo: item.pagina_catalogo,
          fuente: item.fuente_archivo
        }
      };
      repuestosPayload.push(repuestoRow);
    } else if (item.categoria === 'camisa_cilindro') {
      const c = item.camisa || {};
      const diamInt = c.diametro_a_mm ? Number(c.diametro_a_mm) : null;
      const diamExt = c.b_mm ? Number(c.b_mm) : null;
      const largo = c.c_mm ? Number(c.c_mm) : null;
      const diamPest = c.d_mm ? Number(c.d_mm) : null;
      const espPest = c.e_mm ? Number(c.e_mm) : null;
      const acabadoDesc = c.acabado === 'F' ? 'Terminada' : (c.acabado === 'S' ? 'Semiterminada' : 'STD');

      const repuestoRow = {
        id: repuestoId,
        motor_id: primaryMotorId,
        codigo_oem: oemCode,
        nombre: `Camisa de Cilindro ${acabadoDesc} ${motoresStr ? `Motor ${motoresStr}` : ''} (${brandName})`,
        subsistema: 'Block',
        categoria: 'Camisas',
        precio: 0.00,
        stock: 8,
        estado: 'Disponible',
        diametro_cilindro_mm: diamInt,
        espesor_anillo1_mm: null,
        espesor_anillo2_mm: null,
        espesor_aceite_mm: null,
        longitud_total_mm: largo,
        dimensiones: {
          diametro_interior_mm: diamInt,
          diametro_exterior_mm: diamExt,
          longitud_total_mm: largo,
          diametro_pestana_mm: diamPest,
          espesor_pestana_mm: espPest,
          tipo: c.tipo || null,
          acabado: c.acabado || null,
          superficie: c.superficie || null,
          grado: c.grado || null
        },
        especificaciones_tecnicas: {
          marca_catalogo: 'NPR',
          codigo_npr: item.codigo_npr,
          seccion_catalogo: item.seccion_catalogo,
          motores_compatibles: item.motores || [],
          vehiculos: item.vehiculos_chasis || [],
          cilindrada: item.cilindrada_cc_texto || null,
          cilindros: item.cilindros_texto || null,
          referencias_oem: item.referencias || [],
          pagina_catalogo: item.pagina_catalogo,
          fuente: item.fuente_archivo
        }
      };
      repuestosPayload.push(repuestoRow);
    }

    // Equivalencia primaria NPR
    equivalenciasPayload.push({
      repuesto_id: repuestoId,
      marca_alterna: 'NPR',
      codigo_alterno: item.codigo_npr.trim().toUpperCase(),
      tipo_referencia: 'Cruce directo de catálogo NPR',
      notas: `NPR Japón - Pág. ${item.pagina_catalogo || item.pagina_pdf || ''}`,
      especificaciones_tecnicas: {
        codigo_npr: item.codigo_npr,
        seccion: item.seccion_catalogo
      }
    });

    // Equivalencias OEM cruzadas
    if (item.referencias && item.referencias.length > 0) {
      for (const ref of item.referencias) {
        const cleanRef = ref.trim().toUpperCase();
        if (cleanRef && cleanRef !== oemCode) {
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
  }

  // 8. Inserción masiva de repuestos en lotes de 100
  console.log('🧹 Limpiando repuestos previos para asegurar inserción atómica...');
  await apiRequest('equivalencias_repuestos?id=not.is.null', 'DELETE');
  await apiRequest('repuestos_tecnicos?id=not.is.null', 'DELETE');

  console.log(`📦 Insertando ${repuestosPayload.length} repuestos técnicos en Supabase...`);
  const BATCH_SIZE_REP = 100;
  for (let i = 0; i < repuestosPayload.length; i += BATCH_SIZE_REP) {
    const chunk = repuestosPayload.slice(i, i + BATCH_SIZE_REP);
    await apiRequest('repuestos_tecnicos', 'POST', chunk);
    process.stdout.write(`\r   Repuestos insertados: ${Math.min(i + BATCH_SIZE_REP, repuestosPayload.length)} / ${repuestosPayload.length}`);
  }
  console.log('\n✅ Repuestos técnicos insertados con éxito.');

  // 9. Inserción masiva de equivalencias en lotes de 200
  console.log(`🔗 Insertando ${equivalenciasPayload.length} equivalencias de marcas cruzadas (NPR y OEM)...`);
  const BATCH_SIZE_EQ = 200;
  for (let i = 0; i < equivalenciasPayload.length; i += BATCH_SIZE_EQ) {
    const chunk = equivalenciasPayload.slice(i, i + BATCH_SIZE_EQ);
    await apiRequest('equivalencias_repuestos', 'POST', chunk);
    process.stdout.write(`\r   Equivalencias insertadas: ${Math.min(i + BATCH_SIZE_EQ, equivalenciasPayload.length)} / ${equivalenciasPayload.length}`);
  }
  console.log('\n✅ Equivalencias técnicas insertadas con éxito.');

  console.log('\n🎉 ¡IMPORTACIÓN COMPLETA EXITOSA!');
  console.log(`- Total de repuestos: ${repuestosPayload.length} (Anillos y Camisas de Bloque)`);
  console.log(`- Total de equivalencias: ${equivalenciasPayload.length}`);
  console.log(`- Fabricantes activos: ${currentFabricantes.length}`);
  console.log(`- Motores indexados en BD: ${motorMap.size}`);
}

main().catch(err => {
  console.error('\n❌ ERROR FATAL EN IMPORTACIÓN:', err);
  process.exit(1);
});
