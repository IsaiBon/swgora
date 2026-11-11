import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim()

const sb = createClient(url, key)

const demoClientes = [
  {
    id: 'cli-01',
    codigo: 'CLI-001',
    nombre: 'Ing. Carlos Mendoza',
    telefono: '+52 55 4920 1840',
    direccion: 'Av. de las Industrias 1420, Bodega 4, Monterrey',
    tipo: 'Cliente',
    estado: 'Activo',
    especificaciones_tecnicas: {
      empresa: 'Transportes Logísticos del Norte',
      taller: 'Transportes Logísticos del Norte',
      flotilla: '12 Tractocamiones Kenworth T680',
      notas: 'Mantenimiento Preventivo de Válvulas y Turbos'
    }
  },
  {
    id: 'cli-02',
    codigo: 'TAL-001',
    nombre: 'Maestro Jorge Ramos',
    telefono: '+52 81 8345 9912',
    direccion: 'Calzada Madero 2185 Poniente, Monterrey',
    tipo: 'Tallerista',
    estado: 'Activo',
    especificaciones_tecnicas: {
      taller: 'Taller Mecánico Especializado Ramos',
      servicios: 'Rectificación de Cabezas y Monoblocks para Motores Diesel'
    }
  },
  {
    id: 'cli-03',
    codigo: 'CLI-002',
    nombre: 'Lic. Mariana Garza',
    telefono: '+52 81 1234 5678',
    direccion: 'Parque Industrial Milenium, Nave 8, Apodaca',
    tipo: 'Cliente',
    estado: 'Activo',
    especificaciones_tecnicas: {
      empresa: 'Operadora Industrial Regio',
      taller: 'Operadora Industrial Regio',
      servicios: 'Sistemas de Bombeo y Compresores de Alta Presión'
    }
  },
  {
    id: 'cli-04',
    codigo: 'TAL-002',
    nombre: 'Ing. Roberto Silva',
    telefono: '+52 55 7712 3490',
    direccion: 'Km 14.5 Carretera Nacional, Santiago',
    tipo: 'Tallerista',
    estado: 'Activo',
    especificaciones_tecnicas: {
      taller: 'Copa Centro Maquinaria',
      servicios: '6 Maquinarias Pesadas Caterpillar (Retroexcavadoras)'
    }
  },
  {
    id: 'cli-05',
    codigo: 'CLI-003',
    nombre: 'Sr. Alejandro Treviño',
    telefono: '+52 81 9988 7766',
    direccion: 'Av. Eugenio Garza Sada 3450, Monterrey',
    tipo: 'Cliente',
    estado: 'Inactivo',
    especificaciones_tecnicas: {
      empresa: 'Autotransportes Treviño',
      notas: 'Pick-Up Ford F-250 (Inactivo por venta de unidad)'
    }
  }
]

// Fechas representativas: Hoy (Nov 11, 2026), esta semana, este mes, y meses anteriores
const todayStr = '2026-11-11'
const yesterdayStr = '2026-11-10'
const thisWeekStr1 = '2026-11-08'
const thisMonthStr1 = '2026-11-03'
const octStr1 = '2026-10-24'
const octStr2 = '2026-10-15'
const sepStr1 = '2026-09-22'
const sepStr2 = '2026-09-18'
const augStr1 = '2026-08-14'
const julStr1 = '2026-07-20'

const demoOrders = [
  {
    id: 'ord-001',
    numero_orden: '#00001',
    cliente: 'Transportes Logísticos del Norte',
    cliente_id: 'cli-01',
    cliente_codigo: 'CLI-001',
    cliente_telefono: '+52 55 4920 1840',
    cliente_direccion: 'Av. de las Industrias 1420, Bodega 4, Monterrey',
    taller: 'Transportes Logísticos del Norte',
    taller_codigo: 'CLI-001',
    fecha: todayStr,
    fecha_entrega: '2026-11-14',
    estado: 'En Proceso',
    tipo: 'orden',
    marca_vehiculo: 'Toyota',
    modelo_vehiculo: 'Hilux 3.0',
    anio_vehiculo: '2021',
    numero_motor: '1KD-948201',
    tipo_motor: '4 Cilindros Turbo Diesel',
    observaciones: 'Sobrecalentamiento y fuga leve de compresión.',
    componente: 'Culata',
    motor: 'Toyota 1KD-FTV',
    operaciones: [
      { id: 'op-1', category: 'Culata', operation: 'Rectificar Superficie / Cepillado', quantity: 1, unitPrice: 45.00, subtotal: 45.00 },
      { id: 'op-2', category: 'Culata', operation: 'Prueba Hidráulica de Culata', quantity: 1, unitPrice: 35.00, subtotal: 35.00 },
      { id: 'op-3', category: 'Culata', operation: 'Cambio de Guías de Válvula', quantity: 16, unitPrice: 4.00, subtotal: 64.00 }
    ],
    repuestos: [
      { id: 'part-1', category: 'Guías', name: 'Guías de Válvula MRK 6.0mm', code: 'MRK-G102', quantity: 16, unitPrice: 3.50, subtotal: 56.00 },
      { id: 'part-2', category: 'Sellos', name: 'Juego de Sellos de Válvula Dokuro', code: 'DK-SV901', quantity: 1, unitPrice: 28.00, subtotal: 28.00 }
    ],
    materiales: [
      { id: 'mat-1', category: 'Insumos', name: 'Desengrasante y sellador de culata', quantity: 1, unitPrice: 15.00, subtotal: 15.00 }
    ],
    total_mano_obra: 144.00,
    total_repuestos: 84.00,
    total_materiales: 15.00,
    tiene_iva: true,
    subtotal: 243.00,
    iva: 31.59,
    total: 274.59,
    cantidad_items: 6
  },
  {
    id: 'ord-002',
    numero_orden: '#00002',
    cliente: 'Taller Mecánico Especializado Ramos',
    cliente_id: 'cli-02',
    cliente_codigo: 'TAL-001',
    cliente_telefono: '+52 81 8345 9912',
    cliente_direccion: 'Calzada Madero 2185 Poniente, Monterrey',
    taller: 'Taller Mecánico Especializado Ramos',
    taller_codigo: 'TAL-001',
    fecha: todayStr,
    fecha_entrega: '2026-11-13',
    estado: 'Pendiente',
    tipo: 'orden',
    marca_vehiculo: 'Nissan',
    modelo_vehiculo: 'D21 Pick Up',
    anio_vehiculo: '2018',
    numero_motor: 'Z24-102948',
    tipo_motor: '4 Cilindros 2.4L',
    observaciones: 'Rectificación de cilindros a 0.50 y plano de block.',
    componente: 'Block',
    motor: 'Nissan Z24',
    operaciones: [
      { id: 'op-10', category: 'Block', operation: 'Rectificar Cilindros', quantity: 4, unitPrice: 30.00, subtotal: 120.00, measure: '0.50' },
      { id: 'op-11', category: 'Block', operation: 'Rectificar Superficie / Plano Block', quantity: 1, unitPrice: 40.00, subtotal: 40.00 }
    ],
    repuestos: [
      { id: 'part-10', category: 'Anillos', name: 'Juego de Anillos Rik 89mm 0.50', code: 'RIK-24010', quantity: 1, unitPrice: 42.00, subtotal: 42.00, measure: '0.50' }
    ],
    materiales: [],
    total_mano_obra: 160.00,
    total_repuestos: 42.00,
    total_materiales: 0.00,
    tiene_iva: false,
    subtotal: 202.00,
    iva: 0.00,
    total: 202.00,
    cantidad_items: 3
  },
  {
    id: 'ord-003',
    numero_orden: '#00003',
    cliente: 'Operadora Industrial Regio',
    cliente_id: 'cli-03',
    cliente_codigo: 'CLI-002',
    cliente_telefono: '+52 81 1234 5678',
    cliente_direccion: 'Parque Industrial Milenium, Apodaca',
    taller: 'Operadora Industrial Regio',
    fecha: yesterdayStr,
    fecha_entrega: '2026-11-12',
    estado: 'En Proceso',
    tipo: 'orden',
    marca_vehiculo: 'Cummins',
    modelo_vehiculo: 'Freightliner Cascadia',
    anio_vehiculo: '2020',
    numero_motor: 'ISX15-89421',
    tipo_motor: '6 Cilindros Diesel 15L',
    observaciones: 'Rectificación de muñones de biela y bancada.',
    componente: 'Cigüeñal',
    motor: 'Cummins ISX15',
    operaciones: [
      { id: 'op-20', category: 'Cigüeñal', operation: 'Rectificar Banco / Biela', quantity: 1, unitPrice: 85.00, subtotal: 85.00, measureBanco: '0.25', measureBiela: '0.25' },
      { id: 'op-21', category: 'Cigüeñal', operation: 'Pulir Banco / Biela', quantity: 1, unitPrice: 40.00, subtotal: 40.00 }
    ],
    repuestos: [
      { id: 'part-20', category: 'Cojinetes', name: 'Casquetes de Bancada NDC MS-2041', code: 'NDC-MS2041', quantity: 1, unitPrice: 65.00, subtotal: 65.00 },
      { id: 'part-21', category: 'Cojinetes', name: 'Casquetes de Biela NDC CB-2041', code: 'NDC-CB2041', quantity: 1, unitPrice: 55.00, subtotal: 55.00 }
    ],
    materiales: [],
    total_mano_obra: 125.00,
    total_repuestos: 120.00,
    total_materiales: 0.00,
    tiene_iva: true,
    subtotal: 245.00,
    iva: 31.85,
    total: 276.85,
    cantidad_items: 4
  },
  {
    id: 'ord-004',
    numero_orden: '#00004',
    cliente: 'Copa Centro Maquinaria',
    cliente_id: 'cli-04',
    cliente_codigo: 'TAL-002',
    cliente_telefono: '+52 55 7712 3490',
    cliente_direccion: 'Km 14.5 Carretera Nacional, Santiago',
    taller: 'Copa Centro Maquinaria',
    taller_codigo: 'TAL-002',
    fecha: thisWeekStr1,
    fecha_entrega: '2026-11-10',
    estado: 'Terminado',
    tipo: 'orden',
    marca_vehiculo: 'Caterpillar',
    modelo_vehiculo: 'Retroexcavadora 416E',
    anio_vehiculo: '2019',
    numero_motor: 'CAT-3054C',
    tipo_motor: '4 Cilindros Diesel Turbo',
    observaciones: 'Alineación y rectificado de bielas con cambio de bujes.',
    componente: 'Bielas',
    motor: 'Caterpillar 3054C',
    operaciones: [
      { id: 'op-30', category: 'Bielas', operation: 'Rectificar Housing', quantity: 4, unitPrice: 25.00, subtotal: 100.00 },
      { id: 'op-31', category: 'Bielas', operation: 'Cambio de Bujes a Biela', quantity: 4, unitPrice: 15.00, subtotal: 60.00 }
    ],
    repuestos: [
      { id: 'part-30', category: 'Bujes', name: 'Juego de Bujes de Biela CAT OEM', code: 'CAT-BJ416', quantity: 4, unitPrice: 18.00, subtotal: 72.00 }
    ],
    materiales: [],
    total_mano_obra: 160.00,
    total_repuestos: 72.00,
    total_materiales: 0.00,
    tiene_iva: false,
    subtotal: 232.00,
    iva: 0.00,
    total: 232.00,
    cantidad_items: 3
  },
  {
    id: 'ord-005',
    numero_orden: '#00005',
    cliente: 'Taller Mecánico Especializado Ramos',
    cliente_id: 'cli-02',
    cliente_codigo: 'TAL-001',
    taller: 'Taller Mecánico Especializado Ramos',
    taller_codigo: 'TAL-001',
    fecha: thisMonthStr1,
    fecha_entrega: '2026-11-06',
    estado: 'Entregado',
    tipo: 'orden',
    marca_vehiculo: 'Chevrolet',
    modelo_vehiculo: 'Silverado 1500',
    anio_vehiculo: '2017',
    numero_motor: 'V8-5.3L-ECOTEC',
    tipo_motor: 'V8 5.3L Gasolina',
    observaciones: 'Alineación de túnel de bancadas y alesado.',
    componente: 'Bancadas',
    motor: 'Chevrolet 5.3L EcoTec3',
    operaciones: [
      { id: 'op-40', category: 'Bancadas', operation: 'Alineado y Rectificado', quantity: 1, unitPrice: 110.00, subtotal: 110.00 },
      { id: 'op-41', category: 'Bancadas', operation: 'Revisión y Ajuste', quantity: 1, unitPrice: 35.00, subtotal: 35.00 }
    ],
    repuestos: [
      { id: 'part-40', category: 'Casquetes', name: 'Casquetes de Bancada GM STD', code: 'GM-1262', quantity: 1, unitPrice: 68.00, subtotal: 68.00 }
    ],
    materiales: [],
    total_mano_obra: 145.00,
    total_repuestos: 68.00,
    total_materiales: 0.00,
    tiene_iva: true,
    subtotal: 213.00,
    iva: 27.69,
    total: 240.69,
    cantidad_items: 3
  },
  {
    id: 'ord-006',
    numero_orden: '#00006',
    cliente: 'Transportes Logísticos del Norte',
    cliente_id: 'cli-01',
    cliente_codigo: 'CLI-001',
    taller: 'Transportes Logísticos del Norte',
    taller_codigo: 'CLI-001',
    fecha: octStr1,
    fecha_entrega: '2026-10-28',
    estado: 'Entregado',
    tipo: 'orden',
    marca_vehiculo: 'Isuzu',
    modelo_vehiculo: 'ELF 400',
    anio_vehiculo: '2020',
    numero_motor: '4HK1-TC',
    tipo_motor: '4 Cilindros Diesel 5.2L',
    observaciones: 'Rectificación de cilindros, cambio de camisas y plano superior.',
    componente: 'Block',
    motor: 'Isuzu 4HK1',
    operaciones: [
      { id: 'op-50', category: 'Block', operation: 'Sacar y Colocar Camisas', quantity: 4, unitPrice: 35.00, subtotal: 140.00 },
      { id: 'op-51', category: 'Block', operation: 'Bruñir Cilindros', quantity: 4, unitPrice: 20.00, subtotal: 80.00 },
      { id: 'op-52', category: 'Block', operation: 'Rectificar Superficie', quantity: 1, unitPrice: 50.00, subtotal: 50.00 }
    ],
    repuestos: [
      { id: 'part-50', category: 'Camisas', name: 'Juego de Camisas Isuzu 4HK1', code: 'ISZ-SL4', quantity: 4, unitPrice: 38.00, subtotal: 152.00 },
      { id: 'part-51', category: 'Anillos', name: 'Juego de Anillos Rik 4HK1 STD', code: 'RIK-ISZ4HK1', quantity: 4, unitPrice: 25.00, subtotal: 100.00 }
    ],
    materiales: [],
    total_mano_obra: 270.00,
    total_repuestos: 252.00,
    total_materiales: 0.00,
    tiene_iva: true,
    subtotal: 522.00,
    iva: 67.86,
    total: 589.86,
    cantidad_items: 5
  },
  {
    id: 'ord-007',
    numero_orden: '#00007',
    cliente: 'Operadora Industrial Regio',
    cliente_id: 'cli-03',
    cliente_codigo: 'CLI-002',
    taller: 'Operadora Industrial Regio',
    fecha: octStr2,
    fecha_entrega: '2026-10-18',
    estado: 'Entregado',
    tipo: 'cotizacion',
    marca_vehiculo: 'Detroit Diesel',
    modelo_vehiculo: 'Serie 60 14.0L',
    anio_vehiculo: '2016',
    numero_motor: 'DDC-60-84920',
    tipo_motor: '6 Cilindros Diesel',
    observaciones: 'Cotización prueba de culata y rectificado de cigüeñal.',
    componente: 'Culata',
    motor: 'Detroit Serie 60',
    operaciones: [
      { id: 'op-60', category: 'Culata', operation: 'Prueba Hidráulica de Culata', quantity: 1, unitPrice: 60.00, subtotal: 60.00 },
      { id: 'op-61', category: 'Cigüeñal', operation: 'Pulir Banco / Biela', quantity: 1, unitPrice: 70.00, subtotal: 70.00 }
    ],
    repuestos: [],
    materiales: [],
    total_mano_obra: 130.00,
    total_repuestos: 0.00,
    total_materiales: 0.00,
    tiene_iva: false,
    subtotal: 130.00,
    iva: 0.00,
    total: 130.00,
    cantidad_items: 2
  },
  {
    id: 'ord-008',
    numero_orden: '#00008',
    cliente: 'Copa Centro Maquinaria',
    cliente_id: 'cli-04',
    cliente_codigo: 'TAL-002',
    taller: 'Copa Centro Maquinaria',
    taller_codigo: 'TAL-002',
    fecha: sepStr1,
    fecha_entrega: '2026-09-25',
    estado: 'Entregado',
    tipo: 'orden',
    marca_vehiculo: 'Komatsu',
    modelo_vehiculo: 'Excavadora PC200',
    anio_vehiculo: '2018',
    numero_motor: 'SAA6D107E',
    tipo_motor: '6 Cilindros Turbo',
    observaciones: 'Trabajo completo de cigüeñal y bancada.',
    componente: 'Cigüeñal',
    motor: 'Komatsu 6D107',
    operaciones: [
      { id: 'op-70', category: 'Cigüeñal', operation: 'Rectificar Banco / Biela', quantity: 1, unitPrice: 90.00, subtotal: 90.00 },
      { id: 'op-71', category: 'Bancadas', operation: 'Alineado y Rectificado', quantity: 1, unitPrice: 95.00, subtotal: 95.00 }
    ],
    repuestos: [
      { id: 'part-70', category: 'Cojinetes', name: 'Juego Casquetes Komatsu 6D107', code: 'KOM-CS6', quantity: 1, unitPrice: 98.00, subtotal: 98.00 }
    ],
    materiales: [],
    total_mano_obra: 185.00,
    total_repuestos: 98.00,
    total_materiales: 0.00,
    tiene_iva: true,
    subtotal: 283.00,
    iva: 36.79,
    total: 319.79,
    cantidad_items: 3
  },
  {
    id: 'ord-009',
    numero_orden: '#00009',
    cliente: 'Taller Mecánico Especializado Ramos',
    cliente_id: 'cli-02',
    cliente_codigo: 'TAL-001',
    taller: 'Taller Mecánico Especializado Ramos',
    taller_codigo: 'TAL-001',
    fecha: sepStr2,
    fecha_entrega: '2026-09-20',
    estado: 'Entregado',
    tipo: 'orden',
    marca_vehiculo: 'Ford',
    modelo_vehiculo: 'F-350 Super Duty',
    anio_vehiculo: '2019',
    numero_motor: 'PowerStroke-6.7',
    tipo_motor: 'V8 6.7L Turbo Diesel',
    observaciones: 'Rectificación de culatas gemelas y cepillado.',
    componente: 'Culata',
    motor: 'Ford 6.7L PowerStroke',
    operaciones: [
      { id: 'op-80', category: 'Culata', operation: 'Rectificar Superficie / Cepillado', quantity: 2, unitPrice: 50.00, subtotal: 100.00 },
      { id: 'op-81', category: 'Culata', operation: 'Prueba Hidráulica de Culata', quantity: 2, unitPrice: 40.00, subtotal: 80.00 }
    ],
    repuestos: [
      { id: 'part-80', category: 'Empaques', name: 'Juego de Juntas de Culata Ajusa', code: 'AJU-101928', quantity: 2, unitPrice: 55.00, subtotal: 110.00 }
    ],
    materiales: [],
    total_mano_obra: 180.00,
    total_repuestos: 110.00,
    total_materiales: 0.00,
    tiene_iva: true,
    subtotal: 290.00,
    iva: 37.70,
    total: 327.70,
    cantidad_items: 3
  },
  {
    id: 'ord-010',
    numero_orden: '#00010',
    cliente: 'Transportes Logísticos del Norte',
    cliente_id: 'cli-01',
    cliente_codigo: 'CLI-001',
    taller: 'Transportes Logísticos del Norte',
    taller_codigo: 'CLI-001',
    fecha: augStr1,
    fecha_entrega: '2026-08-18',
    estado: 'Entregado',
    tipo: 'orden',
    marca_vehiculo: 'Volvo',
    modelo_vehiculo: 'VNL 760',
    anio_vehiculo: '2021',
    numero_motor: 'D13-92041',
    tipo_motor: '6 Cilindros Diesel 12.8L',
    observaciones: 'Rectificado de cigüeñal y cambio de bujes de levas.',
    componente: 'Cigüeñal',
    motor: 'Volvo D13',
    operaciones: [
      { id: 'op-90', category: 'Cigüeñal', operation: 'Rectificar Banco / Biela', quantity: 1, unitPrice: 110.00, subtotal: 110.00 },
      { id: 'op-91', category: 'Block', operation: 'Cambio de Bujes de Levas', quantity: 7, unitPrice: 12.00, subtotal: 84.00 }
    ],
    repuestos: [
      { id: 'part-90', category: 'Cojinetes', name: 'Casquetes de Banco Volvo D13', code: 'VLV-BK13', quantity: 1, unitPrice: 120.00, subtotal: 120.00 }
    ],
    materiales: [],
    total_mano_obra: 194.00,
    total_repuestos: 120.00,
    total_materiales: 0.00,
    tiene_iva: true,
    subtotal: 314.00,
    iva: 40.82,
    total: 354.82,
    cantidad_items: 3
  },
  {
    id: 'ord-011',
    numero_orden: '#00011',
    cliente: 'Ing. Carlos Mendoza',
    cliente_id: 'cli-01',
    cliente_codigo: 'CLI-001',
    fecha: julStr1,
    fecha_entrega: '2026-07-24',
    estado: 'Entregado',
    tipo: 'orden',
    marca_vehiculo: 'Toyota',
    modelo_vehiculo: 'Tacoma TRD',
    anio_vehiculo: '2019',
    numero_motor: '1GR-FE',
    tipo_motor: 'V6 4.0L Gasolina',
    observaciones: 'Prueba hidráulica y cambio de sellos de culata.',
    componente: 'Culata',
    motor: 'Toyota 1GR-FE',
    operaciones: [
      { id: 'op-100', category: 'Culata', operation: 'Prueba Hidráulica de Culata', quantity: 2, unitPrice: 35.00, subtotal: 70.00 },
      { id: 'op-101', category: 'Culata', operation: 'Cambio de Sellos', quantity: 24, unitPrice: 2.00, subtotal: 48.00 }
    ],
    repuestos: [
      { id: 'part-100', category: 'Sellos', name: 'Juego Sellos Válvula Dokuro 1GR', code: 'DK-SV1GR', quantity: 1, unitPrice: 32.00, subtotal: 32.00 }
    ],
    materiales: [],
    total_mano_obra: 118.00,
    total_repuestos: 32.00,
    total_materiales: 0.00,
    tiene_iva: false,
    subtotal: 150.00,
    iva: 0.00,
    total: 150.00,
    cantidad_items: 3
  }
]

async function seed() {
  console.log('Sembrando clientes en Supabase...')
  const { error: errCli } = await sb.from('clientes').upsert(demoClientes, { onConflict: 'id' })
  if (errCli) {
    console.error('Error sembrando clientes:', errCli)
  } else {
    console.log(`Clientes sembrados: ${demoClientes.length}`)
  }

  console.log('Sembrando órdenes de trabajo en Supabase...')
  const { error: errOrd } = await sb.from('ordenes_trabajo').upsert(demoOrders, { onConflict: 'id' })
  if (errOrd) {
    console.error('Error sembrando órdenes:', errOrd)
  } else {
    console.log(`Órdenes sembradas: ${demoOrders.length}`)
  }
}

seed()
