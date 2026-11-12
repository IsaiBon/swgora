import { supabase } from './supabase'
import {
  encodeTallerCodigoWithRoute,
  decodeTallerCodigoWithRoute,
  rutasService,
} from './rutasService'

export type RectificationBlock = 'Bielas' | 'Bancadas' | 'Cigüeñal' | 'Culata' | 'Block' | 'Repuestos'

export type OrderStatus = 'Recibido' | 'Diagnóstico' | 'En Proceso' | 'Terminado' | 'Entregado' | 'Completada' | 'Pendiente' | 'Cancelada'

export type DocumentType = 'orden' | 'cotizacion'

export const MEASURE_OPTIONS = ['STD', '0.25', '0.50', '0.75', '1.00'] as const
export type StandardMeasure = typeof MEASURE_OPTIONS[number]

export const VALVE_TYPE_OPTIONS = ['EX', 'AD', 'EX Y AD'] as const
export type ValveType = typeof VALVE_TYPE_OPTIONS[number]

export interface OrderOperation {
  id: string
  category: RectificationBlock
  operation: string
  quantity: number
  unitPrice: number
  subtotal: number
  measure?: string
  measureBanco?: string
  measureBiela?: string
}

export interface OrderPartItem {
  id: string
  productId?: string
  category: string
  name: string
  code?: string
  quantity: number
  unitPrice: number
  subtotal: number
  measure?: string
}

export interface OrderMaterialItem {
  id: string
  category: string
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface Order {
  id: string
  orderNumber: string
  customer: string
  customerId?: string
  customerCode?: string
  customerPhone?: string
  customerAddress?: string
  workshop?: string
  workshopCode?: string
  date: string
  deliveryDate?: string
  status: OrderStatus
  type: DocumentType
  // Vehicular / Motor
  vehicleBrand?: string
  vehicleModel?: string
  vehicleYear?: string
  engineNumber?: string
  engineType?: string
  observations?: string
  // Rectificación y detalles
  operations: OrderOperation[]
  parts: OrderPartItem[]
  materials: OrderMaterialItem[]
  // Totales
  laborTotal: number
  partsTotal: number
  materialsTotal: number
  hasIva?: boolean
  subtotal?: number
  iva?: number
  total: number
  itemsCount: number
  // Atributos de Ruta / Sucursal
  rutaId?: string
  rutaCodigo?: string
  rutaNombre?: string
  // Atributos de compatibilidad
  component?: RectificationBlock
  engine?: string
  createdAt?: string
  updatedAt?: string
}

export interface FormOperationItem {
  id: string
  category: RectificationBlock
  operation: string
  selected: boolean
  quantity: number | null
  unitPrice: number | null
  subtotal: number | null
  lastEdited?: 'price' | 'subtotal'
  isCustom?: boolean
  measure?: string
  measureBanco?: string
  measureBiela?: string
}

export const DEFAULT_OPERATIONS_CATALOG: FormOperationItem[] = [
  // BIELAS (4 operaciones)
  { id: 'op-bie-1', category: 'Bielas', operation: 'Rectificar Housing', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-bie-2', category: 'Bielas', operation: 'Cambio de Pistones a Biela', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-bie-3', category: 'Bielas', operation: 'Cambio de Bujes a Biela', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-bie-4', category: 'Bielas', operation: 'Adapte de Bujes', selected: false, quantity: null, unitPrice: null, subtotal: null },

  // BANCADAS (3 operaciones)
  { id: 'op-ban-1', category: 'Bancadas', operation: 'Revisión', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-ban-2', category: 'Bancadas', operation: 'Alineado y Rectificado', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-ban-3', category: 'Bancadas', operation: 'Metalizado', selected: false, quantity: null, unitPrice: null, subtotal: null },

  // CIGÜEÑAL (8 operaciones)
  { id: 'op-cig-1', category: 'Cigüeñal', operation: 'Enderezar', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cig-2', category: 'Cigüeñal', operation: 'Rectificar Banco / Biela', selected: false, quantity: null, unitPrice: null, subtotal: null, measureBanco: '', measureBiela: '' },
  { id: 'op-cig-3', category: 'Cigüeñal', operation: 'Pulir Banco / Biela', selected: false, quantity: null, unitPrice: null, subtotal: null, measureBanco: '', measureBiela: '' },
  { id: 'op-cig-4', category: 'Cigüeñal', operation: 'Pista Sello Delantero', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cig-5', category: 'Cigüeñal', operation: 'Pista Sello Trasero', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cig-6', category: 'Cigüeñal', operation: 'Cambio de Balero', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cig-7', category: 'Cigüeñal', operation: 'Metalizar', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cig-8', category: 'Cigüeñal', operation: 'Polea', selected: false, quantity: null, unitPrice: null, subtotal: null },

  // CULATA (13 operaciones)
  { id: 'op-cul-1', category: 'Culata', operation: 'Prueba a Presión', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-2', category: 'Culata', operation: 'Rectificar Asientos', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-3', category: 'Culata', operation: 'Rectificar Válvulas', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-4', category: 'Culata', operation: 'Cambio de Guías y Adapte', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-5', category: 'Culata', operation: 'Rectificar Superficie', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-6', category: 'Culata', operation: 'Reconstruir Pasos de Agua', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-7', category: 'Culata', operation: 'Hacer Asientos', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-8', category: 'Culata', operation: 'Sacar y Colocar Precámaras', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-9', category: 'Culata', operation: 'Ajustar Eje de Leva', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-10', category: 'Culata', operation: 'Extraer Perno Roto', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-11', category: 'Culata', operation: 'Cambio de Sellos', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-12', category: 'Culata', operation: 'Armar', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-cul-13', category: 'Culata', operation: 'Calibrar', selected: false, quantity: null, unitPrice: null, subtotal: null },

  // BLOCKS (10 operaciones)
  { id: 'op-blo-1', category: 'Block', operation: 'Rectificar Cilindros', selected: false, quantity: null, unitPrice: null, subtotal: null, measure: '' },
  { id: 'op-blo-2', category: 'Block', operation: 'Bruñir Cilindros', selected: false, quantity: null, unitPrice: null, subtotal: null, measure: '' },
  { id: 'op-blo-3', category: 'Block', operation: 'Sacar y Colocar Camisas', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-blo-4', category: 'Block', operation: 'Cambio de Bujes de Levas', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-blo-5', category: 'Block', operation: 'Prueba a Presión', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-blo-6', category: 'Block', operation: 'Rectificar Superficie', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-blo-7', category: 'Block', operation: 'Reparar 1 Cilindro', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-blo-8', category: 'Block', operation: 'Adapte de Camisas', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-blo-9', category: 'Block', operation: 'Extraer Pernos Rotos', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-blo-10', category: 'Block', operation: 'Tapón de Agua', selected: false, quantity: null, unitPrice: null, subtotal: null },

  // REPUESTOS (17 ítems extraídos de Diego/ORDEN DE TRABAJO.xlsx)
  { id: 'op-rep-1', category: 'Repuestos', operation: 'Válvulas de Escape', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-2', category: 'Repuestos', operation: 'Válvulas de Admisión', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-3', category: 'Repuestos', operation: 'Guías de Válvula', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-4', category: 'Repuestos', operation: 'Sellos de Válvula', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-5', category: 'Repuestos', operation: 'Precámaras', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-6', category: 'Repuestos', operation: 'Casquetes de Banco', selected: false, quantity: null, unitPrice: null, subtotal: null, measure: '' },
  { id: 'op-rep-7', category: 'Repuestos', operation: 'Casquetes de Biela', selected: false, quantity: null, unitPrice: null, subtotal: null, measure: '' },
  { id: 'op-rep-8', category: 'Repuestos', operation: 'Lainas', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-9', category: 'Repuestos', operation: 'Bujes de Biela', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-10', category: 'Repuestos', operation: 'Bujes de Levas', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-11', category: 'Repuestos', operation: 'Jgo de Empaque', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-12', category: 'Repuestos', operation: 'Descarbonado', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-13', category: 'Repuestos', operation: 'Empaque de Culata Ajusa', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-14', category: 'Repuestos', operation: 'Pistones', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-15', category: 'Repuestos', operation: 'Anillos', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-16', category: 'Repuestos', operation: 'Camisas', selected: false, quantity: null, unitPrice: null, subtotal: null },
  { id: 'op-rep-17', category: 'Repuestos', operation: 'Culata', selected: false, quantity: null, unitPrice: null, subtotal: null }
]

export const PRESET_OPERATIONS: Record<RectificationBlock, Array<{ name: string; defaultPrice: number }>> = {
  Bielas: [
    { name: 'Rectificar Housing', defaultPrice: 0 },
    { name: 'Cambio de Pistones a Biela', defaultPrice: 0 },
    { name: 'Cambio de Bujes a Biela', defaultPrice: 0 },
    { name: 'Adapte de Bujes', defaultPrice: 0 },
    { name: 'Casquetes de Biela', defaultPrice: 0 },
  ],
  Bancadas: [
    { name: 'Revisión', defaultPrice: 0 },
    { name: 'Alineado y Rectificado', defaultPrice: 0 },
    { name: 'Metalizado', defaultPrice: 0 },
    { name: 'Casquetes de Bancos', defaultPrice: 0 },
  ],
  Cigüeñal: [
    { name: 'Enderezar', defaultPrice: 0 },
    { name: 'Rectificar Banco / Biela', defaultPrice: 0 },
    { name: 'Pulir Banco / Biela', defaultPrice: 0 },
    { name: 'Pista Sello Delantero', defaultPrice: 0 },
    { name: 'Pista Sello Trasero', defaultPrice: 0 },
    { name: 'Cambio de Balero', defaultPrice: 0 },
    { name: 'Metalizar', defaultPrice: 0 },
    { name: 'Polea', defaultPrice: 0 },
  ],
  Culata: [
    { name: 'Prueba a Presión', defaultPrice: 0 },
    { name: 'Rectificar Asientos', defaultPrice: 0 },
    { name: 'Rectificar Válvulas', defaultPrice: 0 },
    { name: 'Cambio de Guías y Adapte', defaultPrice: 0 },
    { name: 'Rectificar Superficie', defaultPrice: 0 },
    { name: 'Reconstruir Pasos de Agua', defaultPrice: 0 },
    { name: 'Hacer Asientos', defaultPrice: 0 },
    { name: 'Sacar y Colocar Precámaras', defaultPrice: 0 },
    { name: 'Ajustar Eje de Leva', defaultPrice: 0 },
    { name: 'Extraer Perno Roto', defaultPrice: 0 },
    { name: 'Cambio de Sellos', defaultPrice: 0 },
    { name: 'Armar', defaultPrice: 0 },
    { name: 'Calibrar', defaultPrice: 0 },
  ],
  Block: [
    { name: 'Rectificar Cilindros', defaultPrice: 0 },
    { name: 'Bruñir Cilindros', defaultPrice: 0 },
    { name: 'Sacar y Colocar Camisas', defaultPrice: 0 },
    { name: 'Cambio de Bujes de Levas', defaultPrice: 0 },
    { name: 'Prueba a Presión', defaultPrice: 0 },
    { name: 'Rectificar Superficie', defaultPrice: 0 },
    { name: 'Reparar 1 Cilindro', defaultPrice: 0 },
    { name: 'Adapte de Camisas', defaultPrice: 0 },
    { name: 'Extraer Pernos Rotos', defaultPrice: 0 },
    { name: 'Tapón de Agua', defaultPrice: 0 },
  ],
  Repuestos: [
    { name: 'Válvulas de Escape', defaultPrice: 0 },
    { name: 'Válvulas de Admisión', defaultPrice: 0 },
    { name: 'Guías de Válvula', defaultPrice: 0 },
    { name: 'Sellos de Válvula', defaultPrice: 0 },
    { name: 'Precámaras', defaultPrice: 0 },
    { name: 'Casquetes de Banco', defaultPrice: 0 },
    { name: 'Casquetes de Biela', defaultPrice: 0 },
    { name: 'Lainas', defaultPrice: 0 },
    { name: 'Bujes de Biela', defaultPrice: 0 },
    { name: 'Bujes de Levas', defaultPrice: 0 },
    { name: 'Jgo de Empaque', defaultPrice: 0 },
    { name: 'Descarbonado', defaultPrice: 0 },
    { name: 'Empaque de Culata Ajusa', defaultPrice: 0 },
    { name: 'Pistones', defaultPrice: 0 },
    { name: 'Anillos', defaultPrice: 0 },
    { name: 'Camisas', defaultPrice: 0 },
    { name: 'Culata', defaultPrice: 0 },
  ],
}

const LOCAL_STORAGE_KEY = 'swgora_work_orders_v2'

const initialMockOrders: Order[] = [
  {
    id: 'ord-001',
    orderNumber: '#00001',
    customer: 'Transportes Logísticos del Norte',
    customerId: 'cli-01',
    customerCode: 'CLI-001',
    customerPhone: '+52 55 4920 1840',
    customerAddress: 'Av. de las Industrias 1420, Bodega 4, Monterrey',
    workshop: 'Transportes Logísticos',
    date: '2026-09-22',
    status: 'En Proceso',
    type: 'orden',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Hilux 3.0',
    vehicleYear: '2021',
    engineNumber: '1KD-948201',
    engineType: '4 Cilindros Turbo Diesel',
    observations: 'Cliente reporta sobrecalentamiento y fuga leve de compresión hacia el radiador.',
    operations: [
      { id: 'op-1', category: 'Bielas', operation: 'Rectificar Housing', quantity: 4, unitPrice: 20.00, subtotal: 80.00 },
      { id: 'op-2', category: 'Cigüeñal', operation: 'Rectificar Banco / Biela', quantity: 1, unitPrice: 45.00, subtotal: 45.00, measureBanco: 'STD', measureBiela: '0.25' },
      { id: 'op-3', category: 'Culata', operation: 'Rectificar Superficie', quantity: 1, unitPrice: 35.00, subtotal: 35.00 },
      { id: 'op-4', category: 'Block', operation: 'Rectificar Cilindros', quantity: 4, unitPrice: 25.00, subtotal: 100.00, measure: '0.50' },
    ],
    parts: [
      { id: 'part-1', category: 'Cojinetes', name: 'Casquetes de Banco NDC MS-1402', code: 'NDC-MS1402', quantity: 1, unitPrice: 45.00, subtotal: 45.00, measure: 'STD' },
      { id: 'part-2', category: 'Sellos', name: 'Juego de Sellos de Válvula Dokuro', code: 'DK-SV901', quantity: 1, unitPrice: 38.00, subtotal: 38.00 },
      { id: 'part-3', category: 'Anillos', name: 'Juego de Anillos de Pistón Rik 96mm', code: 'RIK-28006', quantity: 4, unitPrice: 20.00, subtotal: 80.00 },
    ],
    materials: [
      { id: 'mat-1', category: 'Insumos', name: 'Desengrasante industrial y sellador Permatex', quantity: 1, unitPrice: 18.00, subtotal: 18.00 },
    ],
    laborTotal: 260.00,
    partsTotal: 163.00,
    materialsTotal: 18.00,
    total: 441.00,
    itemsCount: 8,
    component: 'Culata',
    engine: 'Toyota 1KD Turbo Diesel',
  },
  {
    id: 'ord-002',
    orderNumber: '#00002',
    customer: 'Taller Mecánico Especializado Ramos',
    customerId: 'cli-02',
    customerCode: 'TAL-001',
    workshop: 'Taller Mecánico Especializado Ramos',
    workshopCode: 'TAL-001',
    customerPhone: '+52 81 8345 9912',
    customerAddress: 'Calzada Madero 2185 Poniente, Monterrey',
    date: '2026-09-22',
    status: 'Diagnóstico',
    type: 'orden',
    vehicleBrand: 'Nissan',
    vehicleModel: 'D21 Pick Up',
    vehicleYear: '2018',
    engineNumber: 'Z24-102948',
    engineType: '4 Cilindros Gasolina 2.4L',
    observations: 'Desarmado completo para rectificación de cigüeñal y cambio de camisas.',
    operations: [
      { id: 'op-10', category: 'Cigüeñal', operation: 'Pulir Banco / Biela', quantity: 1, unitPrice: 45.00, subtotal: 45.00, measureBanco: '0.25', measureBiela: '0.25' },
      { id: 'op-11', category: 'Block', operation: 'Bruñir Cilindros', quantity: 4, unitPrice: 40.00, subtotal: 160.00, measure: 'STD' },
    ],
    parts: [],
    materials: [],
    laborTotal: 205.00,
    partsTotal: 0.00,
    materialsTotal: 0.00,
    total: 205.00,
    itemsCount: 2,
    component: 'Block',
    engine: 'Nissan Z24',
  },
  {
    id: 'ord-003',
    orderNumber: '#00003',
    customer: 'Operadora Industrial Regio',
    customerId: 'cli-03',
    customerPhone: '+52 81 1234 5678',
    customerAddress: 'Parque Industrial Milenium, Apodaca',
    date: '2026-09-21',
    status: 'Terminado',
    type: 'cotizacion',
    vehicleBrand: 'Cummins',
    vehicleModel: 'Freightliner Cascadia',
    vehicleYear: '2020',
    engineNumber: 'ISX15-89421',
    engineType: '6 Cilindros Diesel 15L',
    observations: 'Cotización para rectificación completa de cabeza y prueba hidráulica.',
    operations: [
      { id: 'op-20', category: 'Culata', operation: 'Prueba Hidráulica de Culata', quantity: 1, unitPrice: 50.00, subtotal: 50.00 },
      { id: 'op-21', category: 'Culata', operation: 'Rectificación de Superficie / Cepillado', quantity: 1, unitPrice: 65.00, subtotal: 65.00 },
    ],
    parts: [],
    materials: [],
    laborTotal: 115.00,
    partsTotal: 0.00,
    materialsTotal: 0.00,
    total: 115.00,
    itemsCount: 2,
    component: 'Culata',
    engine: 'Cummins ISX15',
  }
]

function mapDbToOrder(row: any): Order {
  const decodedTaller = decodeTallerCodigoWithRoute(row.taller_codigo)
  const fallbackRoute = rutasService.getOrderRoute(
    row.id ? String(row.id) : undefined,
    row.numero_orden
  )
  const resolvedRoute = decodedTaller.route ||
    (row.ruta_id && row.ruta_nombre
      ? {
          rutaId: String(row.ruta_id),
          rutaCodigo: row.ruta_codigo ? String(row.ruta_codigo) : undefined,
          rutaNombre: String(row.ruta_nombre),
        }
      : fallbackRoute)

  if (resolvedRoute && row.id) {
    rutasService.setOrderRoute(
      String(row.id),
      row.numero_orden,
      resolvedRoute
    )
  }

  return {
    id: String(row.id),
    orderNumber: row.numero_orden || '#00000',
    customer: row.cliente || 'Cliente General',
    customerId: row.cliente_id || undefined,
    customerCode: row.cliente_codigo || undefined,
    customerPhone: row.cliente_telefono || undefined,
    customerAddress: row.cliente_direccion || undefined,
    workshop: row.taller || undefined,
    workshopCode: decodedTaller.cleanCode || undefined,
    date: row.fecha ? String(row.fecha).split('T')[0] : new Date().toISOString().split('T')[0],
    deliveryDate: row.fecha_entrega ? String(row.fecha_entrega).split('T')[0] : undefined,
    status: (row.estado || 'Pendiente') as OrderStatus,
    type: (row.tipo || 'orden') as DocumentType,
    vehicleBrand: row.marca_vehiculo || undefined,
    vehicleModel: row.modelo_vehiculo || undefined,
    vehicleYear: row.anio_vehiculo ? String(row.anio_vehiculo) : undefined,
    engineNumber: row.numero_motor || undefined,
    engineType: row.tipo_motor || undefined,
    observations: row.observaciones || undefined,
    rutaId: resolvedRoute?.rutaId,
    rutaCodigo: resolvedRoute?.rutaCodigo,
    rutaNombre: resolvedRoute?.rutaNombre,
    component: (row.componente as RectificationBlock) || undefined,
    engine: row.motor || undefined,
    operations: Array.isArray(row.operaciones) ? row.operaciones : [],
    parts: Array.isArray(row.repuestos) ? row.repuestos : [],
    materials: Array.isArray(row.materiales) ? row.materiales : [],
    laborTotal: Number(row.total_mano_obra || 0),
    partsTotal: Number(row.total_repuestos || 0),
    materialsTotal: Number(row.total_materiales || 0),
    hasIva: Boolean(row.tiene_iva),
    subtotal: Number(row.subtotal || 0),
    iva: Number(row.iva || 0),
    total: Number(row.total || 0),
    itemsCount: Number(row.cantidad_items || 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  }
}

function mapOrderToDb(order: Order | (Omit<Order, 'id'> & { id?: string })) {
  const cleanDate = order.date ? String(order.date).split('T')[0] : new Date().toISOString().split('T')[0]
  const cleanDeliveryDate = order.deliveryDate ? String(order.deliveryDate).split('T')[0] : null

  const routeMeta =
    order.rutaId && order.rutaNombre
      ? {
          rutaId: order.rutaId,
          rutaCodigo: order.rutaCodigo,
          rutaNombre: order.rutaNombre,
        }
      : null

  if (order.id) {
    rutasService.setOrderRoute(order.id, order.orderNumber, routeMeta)
  }

  const encodedTallerCodigo = encodeTallerCodigoWithRoute(
    order.workshopCode,
    routeMeta
  )

  return {
    id: order.id,
    numero_orden: order.orderNumber,
    cliente: order.customer || 'Cliente General',
    cliente_id: order.customerId || null,
    cliente_codigo: order.customerCode || null,
    cliente_telefono: order.customerPhone || null,
    cliente_direccion: order.customerAddress || null,
    taller: order.workshop || null,
    taller_codigo: encodedTallerCodigo,
    fecha: cleanDate,
    fecha_entrega: cleanDeliveryDate,
    estado: order.status || 'Pendiente',
    tipo: order.type || 'orden',
    marca_vehiculo: order.vehicleBrand || null,
    modelo_vehiculo: order.vehicleModel || null,
    anio_vehiculo: order.vehicleYear || null,
    numero_motor: order.engineNumber || null,
    tipo_motor: order.engineType || null,
    observaciones: order.observations || null,
    componente: order.component || null,
    motor: order.engine || null,
    operaciones: Array.isArray(order.operations) ? order.operations : [],
    repuestos: Array.isArray(order.parts) ? order.parts : [],
    materiales: Array.isArray(order.materials) ? order.materials : [],
    total_mano_obra: Number(order.laborTotal || 0),
    total_repuestos: Number(order.partsTotal || 0),
    total_materiales: Number(order.materialsTotal || 0),
    tiene_iva: Boolean(order.hasIva),
    subtotal: Number(order.subtotal || 0),
    iva: Number(order.iva || 0),
    total: Number(order.total || 0),
    cantidad_items: Number(order.itemsCount || 0),
    updated_at: new Date().toISOString()
  }
}

function getStoredOrders(): Order[] {
  if (typeof window === 'undefined') return [...initialMockOrders]
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      return [...initialMockOrders]
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...initialMockOrders]
  } catch (e) {
    console.warn('[OrdersService] Error leyendo localStorage, usando memoria:', e)
    return [...initialMockOrders]
  }
}

function saveStoredOrders(orders: Order[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders))
  } catch (e) {
    console.error('[OrdersService] Error guardando en localStorage:', e)
  }
}

const OPERATIONS_CATALOG_STORAGE_KEY = 'swgora_operations_catalog_v2'

function getStoredOperationsCatalog(): FormOperationItem[] {
  if (typeof window === 'undefined') return JSON.parse(JSON.stringify(DEFAULT_OPERATIONS_CATALOG))
  try {
    const raw = localStorage.getItem(OPERATIONS_CATALOG_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(OPERATIONS_CATALOG_STORAGE_KEY, JSON.stringify(DEFAULT_OPERATIONS_CATALOG))
      return JSON.parse(JSON.stringify(DEFAULT_OPERATIONS_CATALOG))
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
    return JSON.parse(JSON.stringify(DEFAULT_OPERATIONS_CATALOG))
  } catch (e) {
    console.warn('[OrdersService] Error leyendo catálogo de operaciones de localStorage:', e)
    return JSON.parse(JSON.stringify(DEFAULT_OPERATIONS_CATALOG))
  }
}

function saveStoredOperationsCatalog(catalog: FormOperationItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OPERATIONS_CATALOG_STORAGE_KEY, JSON.stringify(catalog))
  } catch (e) {
    console.error('[OrdersService] Error guardando catálogo de operaciones:', e)
  }
}

export const ordersService = {
  /**
   * Obtiene todas las órdenes directamente desde Supabase en la nube con sincronización y fallback a caché local
   */
  async getOrders(): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('[OrdersService] Advertencia de consulta en Supabase, recurriendo a caché local:', error)
        return getStoredOrders()
      }

      if (data) {
        let remoteOrders = data.map(mapDbToOrder)

        // Sincronizar cualquier orden o cotización local pendiente hacia Supabase antes de reemplazar caché
        const localOrders = getStoredOrders()
        const remoteIds = new Set(remoteOrders.map(o => o.id))
        const MOCK_IDS = new Set(['ord-001', 'ord-002', 'ord-003'])
        const pendingSync = localOrders.filter(
          lo => !remoteIds.has(lo.id) && lo.id.startsWith('ord-') && !MOCK_IDS.has(lo.id)
        )

        if (pendingSync.length > 0) {
          const syncedOrders: Order[] = []
          for (const pending of pendingSync) {
            try {
              const { data: upData, error: upErr } = await supabase
                .from('ordenes_trabajo')
                .upsert(mapOrderToDb(pending))
                .select()
                .single()

              if (!upErr && upData) {
                syncedOrders.push(mapDbToOrder(upData))
              } else {
                console.warn('[OrdersService] No se pudo sincronizar orden/cotización pendiente:', upErr)
                syncedOrders.push(pending)
              }
            } catch (syncErr) {
              console.warn('[OrdersService] Error sincronizando orden/cotización pendiente hacia Supabase:', syncErr)
              syncedOrders.push(pending)
            }
          }
          remoteOrders = [...syncedOrders, ...remoteOrders]
        }

        if (remoteOrders.length > 0) {
          saveStoredOrders(remoteOrders)
        }
        return remoteOrders
      }
    } catch (err) {
      console.warn('[OrdersService] Error de red con Supabase, usando caché local:', err)
    }

    return getStoredOrders()
  },

  /**
   * Obtiene una orden por su identificador único consultando Supabase o caché
   */
  async getOrderById(id: string): Promise<Order | undefined> {
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (!error && data) {
        const order = mapDbToOrder(data)
        const currentOrders = getStoredOrders()
        const idx = currentOrders.findIndex(o => o.id === order.id)
        if (idx >= 0) currentOrders[idx] = order
        else currentOrders.unshift(order)
        saveStoredOrders(currentOrders)
        return order
      }
    } catch (err) {
      console.warn('[OrdersService] Error consultando orden por ID en Supabase:', err)
    }

    const orders = getStoredOrders()
    return orders.find(o => o.id === id)
  },

  /**
   * Calcula el siguiente número correlativo de orden considerando la numeración existente en Supabase y local
   */
  async getNextOrderNumber(): Promise<string> {
    let highest = 0

    try {
      const { data } = await supabase
        .from('ordenes_trabajo')
        .select('numero_orden')

      if (data && data.length > 0) {
        for (const row of data) {
          const match = String(row.numero_orden || '').replace(/[^0-9]/g, '')
          const num = match ? parseInt(match, 10) : 0
          if (num > highest) highest = num
        }
      }
    } catch (e) {
      console.warn('[OrdersService] No se pudo consultar correlativo en Supabase:', e)
    }

    const localOrders = getStoredOrders()
    for (const o of localOrders) {
      const match = String(o.orderNumber || '').replace(/[^0-9]/g, '')
      const num = match ? parseInt(match, 10) : 0
      if (num > highest) highest = num
    }

    const next = highest + 1
    return `#${next.toString().padStart(5, '0')}`
  },

  /**
   * Registra una nueva orden en Supabase y actualiza la caché local
   */
  async createOrder(orderData: Omit<Order, 'id'> & { id?: string }): Promise<Order> {
    const nextNum = orderData.orderNumber || await this.getNextOrderNumber()
    const newOrder: Order = {
      ...orderData,
      id: orderData.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orderNumber: nextNum,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 1. Guardar de inmediato en caché local para respuesta reactiva instantánea
    const currentOrders = getStoredOrders()
    const existsIdx = currentOrders.findIndex(o => o.id === newOrder.id)
    if (existsIdx >= 0) {
      currentOrders[existsIdx] = newOrder
    } else {
      currentOrders.unshift(newOrder)
    }
    saveStoredOrders(currentOrders)

    // 2. Persistir en la base de datos de Supabase (upsert garantiza sincronización de órdenes y cotizaciones)
    try {
      const dbPayload = mapOrderToDb(newOrder)
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .upsert(dbPayload)
        .select()
        .single()

      if (error) {
        console.error('[OrdersService] Error guardando orden/cotización en Supabase:', error)
      } else if (data) {
        const serverOrder = mapDbToOrder(data)
        const updatedList = getStoredOrders().map(o => o.id === serverOrder.id ? serverOrder : o)
        saveStoredOrders(updatedList)
        return serverOrder
      }
    } catch (err) {
      console.error('[OrdersService] Excepción de conexión al guardar orden/cotización en Supabase:', err)
    }

    return newOrder
  },

  /**
   * Actualiza una orden en Supabase y en la caché local
   */
  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
    const currentOrders = getStoredOrders()
    const index = currentOrders.findIndex(o => o.id === id)
    let updatedOrder: Order

    if (index !== -1) {
      updatedOrder = {
        ...currentOrders[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      currentOrders[index] = updatedOrder
      saveStoredOrders(currentOrders)
    } else {
      const fetched = await this.getOrderById(id)
      if (!fetched) return null
      updatedOrder = {
        ...fetched,
        ...updates,
        updatedAt: new Date().toISOString()
      }
      currentOrders.unshift(updatedOrder)
      saveStoredOrders(currentOrders)
    }

    // Persistir cambios en Supabase (upsert evita pérdida si la orden/cotización existía solo localmente)
    try {
      const dbPayload = mapOrderToDb(updatedOrder)
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .upsert(dbPayload)
        .select()
        .single()

      if (error) {
        console.error('[OrdersService] Error actualizando orden/cotización en Supabase:', error)
      } else if (data) {
        const serverOrder = mapDbToOrder(data)
        const list = getStoredOrders().map(o => o.id === serverOrder.id ? serverOrder : o)
        saveStoredOrders(list)
        return serverOrder
      }
    } catch (err) {
      console.error('[OrdersService] Excepción de red al actualizar orden en Supabase:', err)
    }

    return updatedOrder
  },

  async updateOrderStatus(id: string, newStatus: OrderStatus): Promise<Order | null> {
    return this.updateOrder(id, { status: newStatus })
  },

  /**
   * Duplica una orden existente con un nuevo correlativo y cliente en blanco
   */
  async duplicateOrder(orderId: string): Promise<Order | null> {
    const existing = await this.getOrderById(orderId)
    if (!existing) return null

    const todayStr = new Date().toISOString().split('T')[0]
    const nextNumber = await this.getNextOrderNumber()

    const duplicatedPayload: Omit<Order, 'id'> = {
      orderNumber: nextNumber,
      customer: '',
      customerId: undefined,
      customerCode: undefined,
      customerPhone: '',
      customerAddress: '',
      workshop: '',
      workshopCode: undefined,
      date: todayStr,
      deliveryDate: undefined,
      status: 'Pendiente',
      type: existing.type || 'orden',
      vehicleBrand: existing.vehicleBrand || '',
      vehicleModel: existing.vehicleModel || '',
      vehicleYear: existing.vehicleYear || '',
      engineNumber: existing.engineNumber || '',
      engineType: existing.engineType || '',
      rutaId: existing.rutaId,
      rutaCodigo: existing.rutaCodigo,
      rutaNombre: existing.rutaNombre,
      component: existing.component,
      engine: existing.engine,
      observations: existing.observations || '',
      operations: JSON.parse(JSON.stringify(existing.operations || [])),
      parts: JSON.parse(JSON.stringify(existing.parts || [])),
      materials: JSON.parse(JSON.stringify(existing.materials || [])),
      laborTotal: existing.laborTotal || 0,
      partsTotal: existing.partsTotal || 0,
      materialsTotal: existing.materialsTotal || 0,
      hasIva: existing.hasIva || false,
      subtotal: existing.subtotal || 0,
      iva: existing.iva || 0,
      total: existing.total || 0,
      itemsCount: existing.itemsCount || 0,
    }

    return await this.createOrder(duplicatedPayload)
  },

  /**
   * Obtiene órdenes asociadas a un cliente o taller
   */
  async getOrdersByClientId(clientIdOrCode: string): Promise<Order[]> {
    const orders = await this.getOrders()
    const target = clientIdOrCode.toLowerCase().trim()
    return orders.filter(o => 
      (o.customerId && o.customerId.toLowerCase() === target) ||
      (o.customerCode && o.customerCode.toLowerCase() === target) ||
      (o.workshopCode && o.workshopCode.toLowerCase() === target)
    )
  },

  /**
   * Obtiene órdenes por criterio de búsqueda de cliente o taller
   */
  async getOrdersByCustomer(targetCriteria: string): Promise<Order[]> {
    const orders = await this.getOrders()
    const target = targetCriteria.toLowerCase().trim()
    return orders.filter(o => 
      (o.customerId && o.customerId.toLowerCase() === target) ||
      (o.customerCode && o.customerCode.toLowerCase() === target) ||
      (o.workshopCode && o.workshopCode.toLowerCase() === target) ||
      (o.customer && o.customer.toLowerCase().includes(target)) ||
      (o.workshop && o.workshop.toLowerCase().includes(target))
    )
  },

  /**
   * Elimina una orden en Supabase y en la caché local
   */
  async deleteOrder(id: string): Promise<boolean> {
    let currentOrders = getStoredOrders()
    currentOrders = currentOrders.filter(o => o.id !== id)
    saveStoredOrders(currentOrders)

    try {
      const { error } = await supabase
        .from('ordenes_trabajo')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[OrdersService] Error eliminando orden de Supabase:', error)
        return false
      }
      return true
    } catch (err) {
      console.error('[OrdersService] Excepción eliminando orden de Supabase:', err)
      return true
    }
  },

  getOperationsCatalog(): FormOperationItem[] {
    return getStoredOperationsCatalog()
  },

  async getOperationsCatalogAsync(): Promise<FormOperationItem[]> {
    return Promise.resolve(getStoredOperationsCatalog())
  },

  async saveOperationsCatalog(catalog: FormOperationItem[]): Promise<FormOperationItem[]> {
    saveStoredOperationsCatalog(catalog)
    return Promise.resolve(catalog)
  },

  async addOperationToCatalog(item: {
    category: RectificationBlock
    operation: string
    measure?: string
    measureBanco?: string
    measureBiela?: string
  }): Promise<FormOperationItem> {
    const catalog = getStoredOperationsCatalog()
    const newItem: FormOperationItem = {
      id: `op-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: item.category,
      operation: item.operation.trim(),
      selected: false,
      quantity: null,
      unitPrice: null,
      subtotal: null,
      measure: item.measure ?? '',
      measureBanco: item.measureBanco ?? '',
      measureBiela: item.measureBiela ?? '',
      isCustom: true
    }
    catalog.push(newItem)
    saveStoredOperationsCatalog(catalog)
    return Promise.resolve(newItem)
  },

  async updateOperationInCatalog(id: string, updates: Partial<FormOperationItem>): Promise<FormOperationItem | null> {
    const catalog = getStoredOperationsCatalog()
    const index = catalog.findIndex(o => o.id === id)
    if (index === -1) return null

    catalog[index] = {
      ...catalog[index],
      ...updates,
      operation: updates.operation ? updates.operation.trim() : catalog[index].operation
    }
    saveStoredOperationsCatalog(catalog)
    return Promise.resolve(catalog[index])
  },

  async deleteOperationFromCatalog(id: string): Promise<boolean> {
    let catalog = getStoredOperationsCatalog()
    const initialLen = catalog.length
    catalog = catalog.filter(o => o.id !== id)
    if (catalog.length !== initialLen) {
      saveStoredOperationsCatalog(catalog)
      return Promise.resolve(true)
    }
    return Promise.resolve(false)
  },

  async resetOperationsCatalog(): Promise<FormOperationItem[]> {
    const resetList = JSON.parse(JSON.stringify(DEFAULT_OPERATIONS_CATALOG))
    saveStoredOperationsCatalog(resetList)
    return Promise.resolve(resetList)
  },
}
