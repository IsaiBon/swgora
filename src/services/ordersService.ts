import { supabase } from './supabase'

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

function getStoredOrders(): Order[] {
  if (typeof window === 'undefined') return [...initialMockOrders]
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialMockOrders))
      return [...initialMockOrders]
    }
    return JSON.parse(raw)
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

function mapSupabaseRowToOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.numero_orden || '#00000',
    customer: row.cliente || '',
    customerId: row.cliente_id || undefined,
    customerCode: row.cliente_codigo || undefined,
    customerPhone: row.cliente_telefono || undefined,
    customerAddress: row.cliente_direccion || undefined,
    workshop: row.taller || undefined,
    workshopCode: row.taller_codigo || undefined,
    date: row.fecha || new Date().toISOString().split('T')[0],
    deliveryDate: row.fecha_entrega || undefined,
    status: (row.estado as OrderStatus) || 'En Proceso',
    type: (row.tipo as DocumentType) || 'orden',
    vehicleBrand: row.marca_vehiculo || undefined,
    vehicleModel: row.modelo_vehiculo || undefined,
    vehicleYear: row.anio_vehiculo || undefined,
    engineNumber: row.numero_motor || undefined,
    engineType: row.tipo_motor || undefined,
    observations: row.observaciones || undefined,
    component: (row.componente as RectificationBlock) || 'Culata',
    engine: row.motor || undefined,
    operations: Array.isArray(row.operaciones) ? row.operaciones : [],
    parts: Array.isArray(row.repuestos) ? row.repuestos : [],
    materials: Array.isArray(row.materiales) ? row.materiales : [],
    laborTotal: parseFloat(row.total_mano_obra) || 0,
    partsTotal: parseFloat(row.total_repuestos) || 0,
    materialsTotal: parseFloat(row.total_materiales) || 0,
    hasIva: !!row.tiene_iva,
    subtotal: parseFloat(row.subtotal) || 0,
    iva: parseFloat(row.iva) || 0,
    total: parseFloat(row.total) || 0,
    itemsCount: row.cantidad_items || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOrderToSupabaseRow(order: Partial<Order>): any {
  const row: any = {}
  if (order.id !== undefined) row.id = order.id
  if (order.orderNumber !== undefined) row.numero_orden = order.orderNumber
  if (order.customer !== undefined) row.cliente = order.customer
  if (order.customerId !== undefined) row.cliente_id = order.customerId
  if (order.customerCode !== undefined) row.cliente_codigo = order.customerCode
  if (order.customerPhone !== undefined) row.cliente_telefono = order.customerPhone
  if (order.customerAddress !== undefined) row.cliente_direccion = order.customerAddress
  if (order.workshop !== undefined) row.taller = order.workshop
  if (order.workshopCode !== undefined) row.taller_codigo = order.workshopCode
  if (order.date !== undefined) row.fecha = order.date
  if (order.deliveryDate !== undefined) row.fecha_entrega = order.deliveryDate
  if (order.status !== undefined) row.estado = order.status
  if (order.type !== undefined) row.tipo = order.type
  if (order.vehicleBrand !== undefined) row.marca_vehiculo = order.vehicleBrand
  if (order.vehicleModel !== undefined) row.modelo_vehiculo = order.vehicleModel
  if (order.vehicleYear !== undefined) row.anio_vehiculo = order.vehicleYear
  if (order.engineNumber !== undefined) row.numero_motor = order.engineNumber
  if (order.engineType !== undefined) row.tipo_motor = order.engineType
  if (order.observations !== undefined) row.observaciones = order.observations
  if (order.component !== undefined) row.componente = order.component
  if (order.engine !== undefined) row.motor = order.engine
  if (order.operations !== undefined) row.operaciones = order.operations
  if (order.parts !== undefined) row.repuestos = order.parts
  if (order.materials !== undefined) row.materiales = order.materials
  if (order.laborTotal !== undefined) row.total_mano_obra = order.laborTotal
  if (order.partsTotal !== undefined) row.total_repuestos = order.partsTotal
  if (order.materialsTotal !== undefined) row.total_materiales = order.materialsTotal
  if (order.hasIva !== undefined) row.tiene_iva = order.hasIva
  if (order.subtotal !== undefined) row.subtotal = order.subtotal
  if (order.iva !== undefined) row.iva = order.iva
  if (order.total !== undefined) row.total = order.total
  if (order.itemsCount !== undefined) row.cantidad_items = order.itemsCount
  if (order.updatedAt !== undefined) row.updated_at = order.updatedAt
  return row
}

export const ordersService = {
  async getOrders(): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .order('fecha', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapSupabaseRowToOrder)
        saveStoredOrders(mapped)
        return mapped
      }
    } catch (err) {
      console.warn('[OrdersService] Error leyendo órdenes de Supabase, usando caché local:', err)
    }
    return getStoredOrders()
  },

  async getOrderById(id: string): Promise<Order | undefined> {
    try {
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (!error && data) {
        return mapSupabaseRowToOrder(data)
      }
    } catch (e) {
      console.warn('[OrdersService] Error buscando orden en Supabase:', e)
    }
    const orders = getStoredOrders()
    return orders.find(o => o.id === id)
  },

  async getNextOrderNumber(): Promise<string> {
    const orders = await this.getOrders()
    const numbers = orders
      .map(o => {
        const match = o.orderNumber.replace(/[^0-9]/g, '')
        return match ? parseInt(match, 10) : 0
      })
      .filter(n => !isNaN(n))
    
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    const next = max + 1
    return `#${next.toString().padStart(5, '0')}`
  },

  async createOrder(orderData: Omit<Order, 'id'> & { id?: string }): Promise<Order> {
    const nextNumber = orderData.orderNumber || await this.getNextOrderNumber()
    const newOrder: Order = {
      ...orderData,
      id: orderData.id || `ord-${Date.now()}`,
      orderNumber: nextNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      const row = mapOrderToSupabaseRow(newOrder)
      row.created_at = newOrder.createdAt
      row.updated_at = newOrder.updatedAt
      await supabase.from('ordenes_trabajo').insert([row])
    } catch (e) {
      console.warn('[OrdersService] Error guardando orden en Supabase, guardando local:', e)
    }

    const orders = getStoredOrders()
    orders.unshift(newOrder)
    saveStoredOrders(orders)
    return newOrder
  },

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
    const orders = getStoredOrders()
    const index = orders.findIndex(o => o.id === id)
    if (index === -1) return null

    const updated: Order = {
      ...orders[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    orders[index] = updated
    saveStoredOrders(orders)

    try {
      const rowUpdates = mapOrderToSupabaseRow(updates)
      rowUpdates.updated_at = updated.updatedAt
      await supabase.from('ordenes_trabajo').update(rowUpdates).eq('id', id)
    } catch (e) {
      console.warn('[OrdersService] Error actualizando orden en Supabase:', e)
    }

    return updated
  },

  async updateOrderStatus(id: string, newStatus: OrderStatus): Promise<Order | null> {
    return this.updateOrder(id, { status: newStatus })
  },

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

  async getOrdersByClientId(clientIdOrCode: string): Promise<Order[]> {
    const orders = await this.getOrders()
    const target = clientIdOrCode.toLowerCase().trim()
    return orders.filter(o => 
      (o.customerId && o.customerId.toLowerCase() === target) ||
      (o.customerCode && o.customerCode.toLowerCase() === target) ||
      (o.workshopCode && o.workshopCode.toLowerCase() === target)
    )
  },

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

  async deleteOrder(id: string): Promise<boolean> {
    let orders = getStoredOrders()
    const initialLen = orders.length
    orders = orders.filter(o => o.id !== id)
    if (orders.length !== initialLen) {
      saveStoredOrders(orders)
      try {
        await supabase.from('ordenes_trabajo').delete().eq('id', id)
      } catch (e) {
        console.warn('[OrdersService] Error eliminando orden de Supabase:', e)
      }
      return true
    }
    return false
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
