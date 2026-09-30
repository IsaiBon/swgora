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
  customerPhone?: string
  customerAddress?: string
  workshop?: string
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
  total: number
  itemsCount: number
  // Atributos de compatibilidad
  component?: RectificationBlock
  engine?: string
  createdAt?: string
  updatedAt?: string
}

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
    customerPhone: '+52 81 8345 9912',
    customerAddress: 'Calzada Madero 2185 Poniente, Monterrey',
    workshop: 'Taller Ramos',
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

export const ordersService = {
  async getOrders(): Promise<Order[]> {
    return Promise.resolve(getStoredOrders())
  },

  async getOrderById(id: string): Promise<Order | undefined> {
    const orders = getStoredOrders()
    return Promise.resolve(orders.find(o => o.id === id))
  },

  async getNextOrderNumber(): Promise<string> {
    const orders = getStoredOrders()
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
    const orders = getStoredOrders()
    const newOrder: Order = {
      ...orderData,
      id: orderData.id || `ord-${Date.now()}`,
      orderNumber: orderData.orderNumber || await this.getNextOrderNumber(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    orders.unshift(newOrder)
    saveStoredOrders(orders)
    return Promise.resolve(newOrder)
  },

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
    const orders = getStoredOrders()
    const index = orders.findIndex(o => o.id === id)
    if (index === -1) return null

    orders[index] = {
      ...orders[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    saveStoredOrders(orders)
    return Promise.resolve(orders[index])
  },

  async getOrdersByClientId(clientId: string): Promise<Order[]> {
    const orders = await this.getOrders()
    return orders.filter(o => o.customerId === clientId)
  },

  async getOrdersByCustomer(customerNameOrId: string): Promise<Order[]> {
    const orders = await this.getOrders()
    const target = customerNameOrId.toLowerCase().trim()
    return orders.filter(o => 
      (o.customerId && o.customerId === customerNameOrId) ||
      (o.customer && o.customer.toLowerCase().includes(target))
    )
  },

  async deleteOrder(id: string): Promise<boolean> {
    let orders = getStoredOrders()
    const initialLen = orders.length
    orders = orders.filter(o => o.id !== id)
    if (orders.length !== initialLen) {
      saveStoredOrders(orders)
      return Promise.resolve(true)
    }
    return Promise.resolve(false)
  },
}
