<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { 
  ordersService, 
  type Order, 
  type OrderPartItem, 
  type OrderMaterialItem, 
  type RectificationBlock, 
  type OrderStatus,
  type DocumentType
} from '@/services/ordersService'
import { clientesService, type Cliente } from '@/services/clientesService'
import { catalogService, type CatalogProduct } from '@/services/catalogService'
import WorkOrderPrintModal from './WorkOrderPrintModal.vue'
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Save, 
  Printer, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Layers,
  UserCheck,
  Building,
  ChevronDown,
  Filter,
  RotateCcw
} from 'lucide-vue-next'

const props = defineProps<{
  initialOrderId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', order: Order): void
}>()

// Estado principal del formulario
const isEditing = computed(() => !!props.initialOrderId)
const isSubmitting = ref(false)
const notificationMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Errores de validación reactivos para feedback visual destacado
const formErrors = ref({
  clientName: false,
  vehicleBrand: false,
  vehicleEngine: false,
  noItems: false
})
const validationErrorMessage = ref<string | null>(null)

// Campos Cabecera
const orderNumber = ref('')
const orderDate = ref(new Date().toISOString().split('T')[0])
const orderStatus = ref<OrderStatus>('Pendiente')
const docType = ref<DocumentType>('orden')

// Campos Cliente
const clientSearchQuery = ref('')
const isSearchingClients = ref(false)
const clientSearchResults = ref<Cliente[]>([])
const showClientDropdown = ref(false)
const selectedCustomerId = ref<string | undefined>()
const clientName = ref('')
const clientPhone = ref('')
const clientAddress = ref('')
const clientWorkshop = ref('')

// Campos Vehículo / Motor
const vehicleBrand = ref('')
const vehicleEngine = ref('')
const vehicleModel = ref('')
const vehicleYear = ref('')
const engineNumber = ref('')
const engineType = ref('')
const observations = ref('')

// Interfaz para el listado unificado de operaciones
interface FormOperationItem {
  id: string
  category: RectificationBlock
  operation: string
  selected: boolean
  quantity: number | null
  unitPrice: number | null
  subtotal: number
  isCustom?: boolean
  measure?: string
  measureBanco?: string
  measureBiela?: string
}

// Opciones estándar de medidas de rectificación (STD, 0.25, 0.50, 0.75, 1.00)
const MEASURE_OPTIONS = ['STD', '0.25', '0.50', '0.75', '1.00'] as const

// Opciones de tipo de válvula para guías (EX: Escape, AD: Admisión, EX Y AD: Ambas)
const VALVE_TYPE_OPTIONS = ['EX', 'AD', 'EX Y AD'] as const

// Catálogo base unificado de operaciones extraído de Diego/ORDEN DE TRABAJO.xlsx
// Todas las opciones inician con cantidad y precio vacíos (null)
const defaultOperationsCatalog: FormOperationItem[] = [
  // BIELAS (4 operaciones)
  { id: 'op-bie-1', category: 'Bielas', operation: 'Rectificar Housing', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-bie-2', category: 'Bielas', operation: 'Cambio de Pistones a Biela', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-bie-3', category: 'Bielas', operation: 'Cambio de Bujes a Biela', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-bie-4', category: 'Bielas', operation: 'Adapte de Bujes', selected: false, quantity: null, unitPrice: null, subtotal: 0 },

  // BANCADAS (3 operaciones)
  { id: 'op-ban-1', category: 'Bancadas', operation: 'Revisión', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-ban-2', category: 'Bancadas', operation: 'Alineado y Rectificado', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-ban-3', category: 'Bancadas', operation: 'Metalizado', selected: false, quantity: null, unitPrice: null, subtotal: 0 },

  // CIGÜEÑAL (8 operaciones)
  { id: 'op-cig-1', category: 'Cigüeñal', operation: 'Enderezar', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cig-2', category: 'Cigüeñal', operation: 'Rectificar Banco / Biela', selected: false, quantity: null, unitPrice: null, subtotal: 0, measureBanco: '', measureBiela: '' },
  { id: 'op-cig-3', category: 'Cigüeñal', operation: 'Pulir Banco / Biela', selected: false, quantity: null, unitPrice: null, subtotal: 0, measureBanco: '', measureBiela: '' },
  { id: 'op-cig-4', category: 'Cigüeñal', operation: 'Pista Sello Delantero', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cig-5', category: 'Cigüeñal', operation: 'Pista Sello Trasero', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cig-6', category: 'Cigüeñal', operation: 'Cambio de Balero', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cig-7', category: 'Cigüeñal', operation: 'Metalizar', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cig-8', category: 'Cigüeñal', operation: 'Polea', selected: false, quantity: null, unitPrice: null, subtotal: 0 },

  // CULATA (13 operaciones)
  { id: 'op-cul-1', category: 'Culata', operation: 'Prueba a Presión', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-2', category: 'Culata', operation: 'Rectificar Asientos', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-3', category: 'Culata', operation: 'Rectificar Válvulas', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-4', category: 'Culata', operation: 'Cambio de Guías y Adapte', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-5', category: 'Culata', operation: 'Rectificar Superficie', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-6', category: 'Culata', operation: 'Reconstruir Pasos de Agua', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-7', category: 'Culata', operation: 'Hacer Asientos', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-8', category: 'Culata', operation: 'Sacar y Colocar Precámaras', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-9', category: 'Culata', operation: 'Ajustar Eje de Leva', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-10', category: 'Culata', operation: 'Extraer Perno Roto', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-11', category: 'Culata', operation: 'Cambio de Sellos', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-12', category: 'Culata', operation: 'Armar', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-cul-13', category: 'Culata', operation: 'Calibrar', selected: false, quantity: null, unitPrice: null, subtotal: 0 },

  // BLOCKS (10 operaciones)
  { id: 'op-blo-1', category: 'Block', operation: 'Rectificar Cilindros', selected: false, quantity: null, unitPrice: null, subtotal: 0, measure: '' },
  { id: 'op-blo-2', category: 'Block', operation: 'Bruñir Cilindros', selected: false, quantity: null, unitPrice: null, subtotal: 0, measure: '' },
  { id: 'op-blo-3', category: 'Block', operation: 'Sacar y Colocar Camisas', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-blo-4', category: 'Block', operation: 'Cambio de Bujes de Levas', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-blo-5', category: 'Block', operation: 'Prueba a Presión', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-blo-6', category: 'Block', operation: 'Rectificar Superficie', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-blo-7', category: 'Block', operation: 'Reparar 1 Cilindro', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-blo-8', category: 'Block', operation: 'Adapte de Camisas', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-blo-9', category: 'Block', operation: 'Extraer Pernos Rotos', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-blo-10', category: 'Block', operation: 'Tapón de Agua', selected: false, quantity: null, unitPrice: null, subtotal: 0 },

  // REPUESTOS (17 ítems extraídos de Diego/ORDEN DE TRABAJO.xlsx)
  { id: 'op-rep-1', category: 'Repuestos', operation: 'Válvulas de Escape', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-2', category: 'Repuestos', operation: 'Válvulas de Admisión', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-3', category: 'Repuestos', operation: 'Guías de Válvula', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-4', category: 'Repuestos', operation: 'Sellos de Válvula', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-5', category: 'Repuestos', operation: 'Precámaras', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-6', category: 'Repuestos', operation: 'Casquetes de Banco', selected: false, quantity: null, unitPrice: null, subtotal: 0, measure: '' },
  { id: 'op-rep-7', category: 'Repuestos', operation: 'Casquetes de Biela', selected: false, quantity: null, unitPrice: null, subtotal: 0, measure: '' },
  { id: 'op-rep-8', category: 'Repuestos', operation: 'Lainas', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-9', category: 'Repuestos', operation: 'Bujes de Biela', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-10', category: 'Repuestos', operation: 'Bujes de Levas', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-11', category: 'Repuestos', operation: 'Jgo de Empaque', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-12', category: 'Repuestos', operation: 'Descarbonado', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-13', category: 'Repuestos', operation: 'Empaque de Culata Ajusa', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-14', category: 'Repuestos', operation: 'Pistones', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-15', category: 'Repuestos', operation: 'Anillos', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-16', category: 'Repuestos', operation: 'Camisas', selected: false, quantity: null, unitPrice: null, subtotal: 0 },
  { id: 'op-rep-17', category: 'Repuestos', operation: 'Culata', selected: false, quantity: null, unitPrice: null, subtotal: 0 }
]

// Lista estándar de repuestos comunes de rectificadora del Excel
const excelStandardParts = [
  'Válvulas de Escape',
  'Válvulas de Admisión',
  'Guías de Válvula',
  'Sellos de Válvula',
  'Precámaras',
  'Casquetes de Banco',
  'Casquetes de Biela',
  'Lainas',
  'Bujes de Biela',
  'Bujes de Levas',
  'Jgo de Empaque',
  'Descarbonado',
  'Empaque de Culata Ajusa',
  'Pistones',
  'Anillos',
  'Camisas',
  'Culata'
]

// Lista unificada de todas las operaciones disponibles en el formulario
const allOperations = ref<FormOperationItem[]>(JSON.parse(JSON.stringify(defaultOperationsCatalog)))

// Filtro rápido de vista para las operaciones
const operationFilterCategory = ref<string>('Todos')
const operationSearchQuery = ref<string>('')

// Entrada para agregar una operación especial o personalizada
const customCategory = ref<RectificationBlock>('Culata')
const customOpName = ref('')
const customOpQty = ref(1)
const customOpPrice = ref<number | null>(null)

// Repuestos y Materiales
const parts = ref<OrderPartItem[]>([])
const materials = ref<OrderMaterialItem[]>([])

// Catálogo para selector de repuestos
const catalogProducts = ref<CatalogProduct[]>([])
const showCatalogModal = ref(false)
const customPartName = ref('')
const customPartPrice = ref<number | null>(null)
const customPartQuantity = ref(1)

// Insumos rápidos (solo nombre, sin precio)
const customMaterialName = ref('')

// Modal de impresión
const showPrintModal = ref(false)
const orderForPrint = ref<Order | null>(null)
const lastSavedOrder = ref<Order | null>(null)

const handleClosePrintModal = () => {
  showPrintModal.value = false
  if (lastSavedOrder.value) {
    emit('saved', lastSavedOrder.value)
  }
}

// Modal rápido nuevo cliente
const showNewClientModal = ref(false)
const newClientForm = ref({
  nombre: '',
  taller: '',
  telefono: '',
  direccion: '',
  cedula: ''
})


// Operaciones filtradas para la visualización en la tabla
const displayedOperations = computed(() => {
  return allOperations.value.filter(op => {
    const hasData = op.quantity !== null && Number(op.quantity) > 0 && op.unitPrice !== null && Number(op.unitPrice) > 0
    const matchesCategory = 
      operationFilterCategory.value === 'Todos' ||
      (operationFilterCategory.value === 'ConDatos' ? hasData : op.category === operationFilterCategory.value)

    const matchesSearch = 
      !operationSearchQuery.value.trim() ||
      op.operation.toLowerCase().includes(operationSearchQuery.value.toLowerCase()) ||
      op.category.toLowerCase().includes(operationSearchQuery.value.toLowerCase())

    return matchesCategory && matchesSearch
  })
})

// Helpers de detección de operaciones y repuestos con medidas dimensionales
const isDualMeasureOperation = (opName: string) => {
  const lower = opName.toLowerCase()
  const isCrankAction = lower.includes('rectificar') || lower.includes('pulir')
  return isCrankAction && lower.includes('banco') && lower.includes('biela')
}

const isSingleMeasureOperation = (opName: string) => {
  const lower = opName.toLowerCase()
  if (isDualMeasureOperation(opName) || isValveTypeOperation(opName)) return false
  const isCilindro = (lower.includes('rectificar') || lower.includes('bruñir') || lower.includes('brunir')) && lower.includes('cilindro')
  const isCasquetes = lower.includes('casquete') && (lower.includes('banco') || lower.includes('biela'))
  return isCilindro || isCasquetes
}

const isValveTypeOperation = (opName: string) => {
  const lower = opName.toLowerCase()
  return (lower.includes('guías') || lower.includes('guias')) && (lower.includes('adapte') || lower.includes('válvula') || lower.includes('valvula'))
}

const isPartWithMeasure = (partName: string) => {
  const lower = partName.toLowerCase()
  return lower.includes('casquete') || lower.includes('cojinete')
}

// Operaciones activas (con datos ingresados) que se enviarán a la orden y al documento impreso
const activeBilledOperations = computed(() => {
  return allOperations.value
    .filter(op => op.quantity !== null && Number(op.quantity) > 0 && op.unitPrice !== null && Number(op.unitPrice) >= 0 && (op.selected || Number(op.unitPrice) > 0))
    .map(op => ({
      id: op.id,
      category: op.category,
      operation: op.operation,
      quantity: Number(op.quantity),
      unitPrice: Number(op.unitPrice),
      subtotal: Number((Number(op.quantity) * Number(op.unitPrice)).toFixed(2)),
      measure: op.measure || undefined,
      measureBanco: op.measureBanco || undefined,
      measureBiela: op.measureBiela || undefined
    }))
})

// Totales calculados en tiempo real (Mano de obra)
const laborTotal = computed(() => {
  return activeBilledOperations.value
    .filter(op => op.category !== 'Repuestos')
    .reduce((acc, curr) => acc + curr.subtotal, 0)
})

const partsTotal = computed(() => 0)

const materialsTotal = computed(() => 0)

const totalOrder = computed(() => {
  return laborTotal.value
})

// Métodos de interacción en la lista unificada de operaciones
const handleRowToggle = (op: FormOperationItem) => {
  if (!op.selected) {
    op.quantity = null
    op.unitPrice = null
    op.subtotal = 0
  } else {
    // Si se activa con el checkbox pero no hay valores, no poner precios predeterminados
    if (op.quantity && Number(op.quantity) > 0 && op.unitPrice && Number(op.unitPrice) > 0) {
      op.subtotal = Number((Number(op.quantity) * Number(op.unitPrice)).toFixed(2))
    } else {
      op.subtotal = 0
    }
  }
}

const handleRowDataChange = (op: FormOperationItem) => {
  const qty = op.quantity !== null ? Number(op.quantity) : 0
  const price = op.unitPrice !== null ? Number(op.unitPrice) : 0
  if (qty > 0 && price > 0) {
    op.selected = true
    op.subtotal = Number((qty * price).toFixed(2))
  } else {
    op.subtotal = 0
    if ((op.quantity === null || qty <= 0) && (op.unitPrice === null || price <= 0)) {
      op.selected = false
    }
  }
}

const handleMeasureChange = (op: FormOperationItem) => {
  const hasMeasure = !!(op.measure || op.measureBanco || op.measureBiela)
  if (hasMeasure) {
    op.selected = true
    if (op.quantity === null || op.quantity <= 0) {
      op.quantity = 1
    }
    if (op.unitPrice !== null && Number(op.unitPrice) > 0) {
      op.subtotal = Number((Number(op.quantity) * Number(op.unitPrice)).toFixed(2))
    }
  }
}

const resetRow = (op: FormOperationItem) => {
  op.selected = false
  op.quantity = null
  op.unitPrice = null
  op.subtotal = 0
  op.measure = ''
  op.measureBanco = ''
  op.measureBiela = ''
}

const removeCustomOperation = (id: string) => {
  allOperations.value = allOperations.value.filter(o => o.id !== id)
}

// Agregar operación especial personalizada a la lista
const addCustomOperation = () => {
  if (!customOpName.value.trim()) return

  const price = customOpPrice.value !== null && customOpPrice.value >= 0 ? customOpPrice.value : null
  const qty = customOpQty.value !== null && customOpQty.value > 0 ? customOpQty.value : null
  const hasData = qty !== null && price !== null && qty > 0 && price > 0

  const newItem: FormOperationItem = {
    id: `custom-op-${Date.now()}`,
    category: customCategory.value,
    operation: customOpName.value.trim(),
    selected: hasData,
    quantity: qty,
    unitPrice: price,
    subtotal: hasData ? Number((qty * price).toFixed(2)) : 0,
    isCustom: true
  }

  allOperations.value.push(newItem)
  customOpName.value = ''
  customOpPrice.value = null
  customOpQty.value = 1
}

// Agregar repuesto rápido de la lista estándar de rectificadora del Excel
const addExcelPart = (partName: string) => {
  parts.value.push({
    id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    category: 'Repuestos',
    name: partName,
    quantity: 1,
    unitPrice: 0,
    subtotal: 0,
    measure: isPartWithMeasure(partName) ? 'STD' : undefined
  })
  showCatalogModal.value = false
}

// Inicialización de la orden
onMounted(async () => {
  catalogProducts.value = await catalogService.getProducts()

  if (props.initialOrderId) {
    const existing = await ordersService.getOrderById(props.initialOrderId)
    if (existing) {
      loadExistingOrder(existing)
      return
    }
  }

  orderNumber.value = await ordersService.getNextOrderNumber()
})

const loadExistingOrder = (order: Order) => {
  orderNumber.value = order.orderNumber
  orderDate.value = order.date
  orderStatus.value = order.status === 'En Proceso' ? 'En Proceso' : 'Pendiente'
  docType.value = order.type || 'orden'
  selectedCustomerId.value = order.customerId
  clientName.value = order.customer
  clientPhone.value = order.customerPhone || ''
  clientAddress.value = order.customerAddress || ''
  clientWorkshop.value = order.workshop || ''
  vehicleBrand.value = order.vehicleBrand || ''
  vehicleEngine.value = order.engine || order.vehicleModel || order.engineType || ''
  vehicleModel.value = order.vehicleModel || ''
  vehicleYear.value = order.vehicleYear || ''
  engineNumber.value = order.engineNumber || ''
  engineType.value = order.engineType || ''
  observations.value = order.observations || ''
  parts.value = order.parts ? JSON.parse(JSON.stringify(order.parts)) : []
  materials.value = order.materials ? JSON.parse(JSON.stringify(order.materials)) : []

  // Sincronizar las operaciones existentes en la lista unificada
  if (order.operations && order.operations.length > 0) {
    order.operations.forEach(savedOp => {
      const match = allOperations.value.find(
        o => o.category === savedOp.category && o.operation.toLowerCase() === savedOp.operation.toLowerCase()
      )
      if (match) {
        match.selected = true
        match.quantity = savedOp.quantity
        match.unitPrice = savedOp.unitPrice
        match.subtotal = savedOp.subtotal
        match.measure = savedOp.measure || ''
        match.measureBanco = savedOp.measureBanco || ''
        match.measureBiela = savedOp.measureBiela || ''
      } else {
        // Operación personalizada previa
        allOperations.value.push({
          id: savedOp.id || `custom-${Date.now()}-${Math.random()}`,
          category: savedOp.category,
          operation: savedOp.operation,
          selected: true,
          quantity: savedOp.quantity,
          unitPrice: savedOp.unitPrice,
          subtotal: savedOp.subtotal,
          measure: savedOp.measure || '',
          measureBanco: savedOp.measureBanco || '',
          measureBiela: savedOp.measureBiela || '',
          isCustom: true
        })
      }
    })
  }
}

// Búsqueda rápida de clientes
watch(clientSearchQuery, async (query) => {
  if (!query || query.trim().length < 2) {
    clientSearchResults.value = []
    showClientDropdown.value = false
    return
  }

  isSearchingClients.value = true
  try {
    const results = await clientesService.getClientes({ search: query.trim() })
    clientSearchResults.value = results
    showClientDropdown.value = results.length > 0
  } catch (err) {
    console.error('Error buscando clientes:', err)
  } finally {
    isSearchingClients.value = false
  }
})

const selectCustomer = (client: Cliente) => {
  selectedCustomerId.value = client.id
  clientName.value = client.nombre
  clientPhone.value = client.telefono || ''
  clientAddress.value = client.direccion || ''
  clientWorkshop.value = client.especificaciones_tecnicas?.taller || client.especificaciones_tecnicas?.empresa || ''
  clientSearchQuery.value = ''
  showClientDropdown.value = false
}

// Repuestos
const addCatalogPart = (product: CatalogProduct) => {
  const existing = parts.value.find(p => p.productId === product.id)
  if (existing) {
    existing.quantity += 1
    existing.subtotal = Number((existing.quantity * existing.unitPrice).toFixed(2))
    showCatalogModal.value = false
    return
  }

  parts.value.push({
    id: `part-${Date.now()}`,
    productId: product.id,
    category: product.category,
    name: product.name,
    code: product.code,
    quantity: 1,
    unitPrice: product.price,
    subtotal: product.price
  })
  showCatalogModal.value = false
}

const addCustomPart = () => {
  if (!customPartName.value.trim()) return
  const price = customPartPrice.value && customPartPrice.value >= 0 ? customPartPrice.value : 0
  const qty = customPartQuantity.value > 0 ? customPartQuantity.value : 1

  parts.value.push({
    id: `part-${Date.now()}`,
    category: 'Repuestos',
    name: customPartName.value.trim(),
    quantity: qty,
    unitPrice: price,
    subtotal: Number((qty * price).toFixed(2))
  })

  customPartName.value = ''
  customPartPrice.value = null
  customPartQuantity.value = 1
  showCatalogModal.value = false
}

// Materiales (solo nombre, sin precio)
const addMaterial = () => {
  if (!customMaterialName.value.trim()) return

  materials.value.push({
    id: `mat-${Date.now()}`,
    category: 'Materiales',
    name: customMaterialName.value.trim(),
    quantity: 1,
    unitPrice: 0,
    subtotal: 0
  })

  customMaterialName.value = ''
}

const removeMaterial = (id: string) => {
  materials.value = materials.value.filter(m => m.id !== id)
}

// Crear cliente rápido
const handleQuickCreateClient = async () => {
  if (!newClientForm.value.nombre.trim()) return

  try {
    const created = await clientesService.createCliente({
      nombre: newClientForm.value.nombre.trim(),
      cedula: newClientForm.value.cedula.trim() || `CLI-${Date.now().toString().slice(-4)}`,
      telefono: newClientForm.value.telefono.trim(),
      direccion: newClientForm.value.direccion.trim(),
      tipo: newClientForm.value.taller.trim() ? 'Tallerista' : 'Cliente',
      estado: 'Activo',
      especificaciones_tecnicas: {
        taller: newClientForm.value.taller.trim()
      }
    })

    selectCustomer(created)
    showNewClientModal.value = false
    newClientForm.value = { nombre: '', taller: '', telefono: '', direccion: '', cedula: '' }
  } catch (err) {
    console.error('Error creando cliente rápido:', err)
  }
}

// Validación del formulario con alertas vistosas
const validateForm = (): boolean => {
  formErrors.value = {
    clientName: !clientName.value.trim(),
    vehicleBrand: !vehicleBrand.value.trim(),
    vehicleEngine: !vehicleEngine.value.trim(),
    noItems: (activeBilledOperations.value.length === 0 && parts.value.length === 0 && materials.value.length === 0)
  }

  const hasErrors = formErrors.value.clientName || 
                    formErrors.value.vehicleBrand || 
                    formErrors.value.vehicleEngine || 
                    formErrors.value.noItems

  if (hasErrors) {
    if (formErrors.value.noItems) {
      validationErrorMessage.value = 'Completa los campos obligatorios resaltados en rojo y registra al menos una operación de mano de obra o repuesto con cantidad y precio.'
    } else {
      validationErrorMessage.value = 'Por favor completa todos los campos requeridos marcados en rojo (Cliente, Marca y Motor).'
    }

    // Scroll suave hacia el primer campo con error
    nextTick(() => {
      const firstErrorEl = document.querySelector('.error-required-field')
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    return false
  }

  validationErrorMessage.value = null
  return true
}

// Acción unificada: Guardar Orden e inmediatamente mostrar el documento a Imprimir
const handleSaveOrder = async () => {
  if (!validateForm()) {
    return
  }

  isSubmitting.value = true
  try {
    const savedOperations = activeBilledOperations.value

    const orderPayload: Omit<Order, 'id'> = {
      orderNumber: orderNumber.value,
      date: orderDate.value,
      status: orderStatus.value,
      type: docType.value,
      customer: clientName.value.trim(),
      customerId: selectedCustomerId.value,
      customerPhone: clientPhone.value.trim(),
      customerAddress: clientAddress.value.trim(),
      workshop: clientWorkshop.value.trim(),
      vehicleBrand: vehicleBrand.value.trim(),
      vehicleModel: vehicleEngine.value.trim(),
      vehicleYear: vehicleYear.value.trim(),
      engineNumber: engineNumber.value.trim(),
      engineType: vehicleEngine.value.trim(),
      observations: observations.value.trim(),
      operations: savedOperations,
      parts: parts.value.filter(p => p.quantity > 0 && p.unitPrice >= 0),
      materials: materials.value.filter(m => m.quantity > 0 && m.unitPrice >= 0),
      laborTotal: laborTotal.value,
      partsTotal: partsTotal.value,
      materialsTotal: materialsTotal.value,
      total: totalOrder.value,
      itemsCount: savedOperations.length + parts.value.length + materials.value.length,
      component: savedOperations[0]?.category || 'Culata',
      engine: vehicleEngine.value.trim() 
        ? `${vehicleBrand.value.trim() ? vehicleBrand.value.trim() + ' ' : ''}${vehicleEngine.value.trim()}`.trim() 
        : (vehicleBrand.value.trim() || 'General')
    }

    let saved: Order
    if (props.initialOrderId) {
      const updated = await ordersService.updateOrder(props.initialOrderId, orderPayload)
      saved = updated!
    } else {
      saved = await ordersService.createOrder(orderPayload)
    }

    lastSavedOrder.value = saved
    orderForPrint.value = saved

    notificationMessage.value = { 
      type: 'success', 
      text: `¡${docType.value === 'cotizacion' ? 'Cotización' : 'Orden'} ${saved.orderNumber} guardada con éxito! Mostrando documento para impresión...` 
    }

    // Unificación de acción: abrir automáticamente el modal de impresión limpia
    showPrintModal.value = true

    setTimeout(() => {
      notificationMessage.value = null
    }, 3000)
  } catch (err) {
    console.error('Error al guardar orden:', err)
    notificationMessage.value = { type: 'error', text: 'Ocurrió un error al guardar la orden.' }
  } finally {
    isSubmitting.value = false
  }
}



// Helper para colores de categoría
const getCategoryBadgeClass = (cat: RectificationBlock) => {
  switch (cat) {
    case 'Bielas':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'Bancadas':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Cigüeñal':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'Culata':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'Block':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'Repuestos':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Alerta vistosa de errores de validación (Bordes rojos) -->
    <div
      v-if="validationErrorMessage"
      class="p-4 rounded-xl flex items-start sm:items-center justify-between gap-3 text-sm font-semibold transition shadow-md bg-rose-50 text-rose-900 border-2 border-rose-500 animate-pulse"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0">
          <AlertCircle class="w-5 h-5" />
        </div>
        <div>
          <div class="font-bold text-rose-900 text-sm">Faltan campos obligatorios para guardar la orden</div>
          <div class="text-xs text-rose-700 mt-0.5">{{ validationErrorMessage }}</div>
        </div>
      </div>
      <button 
        type="button" 
        @click="validationErrorMessage = null" 
        class="text-rose-400 hover:text-rose-700 p-1 text-sm font-bold"
      >
        ✕
      </button>
    </div>

    <!-- Notificaciones en vivo -->
    <div
      v-if="notificationMessage"
      :class="[
        'p-4 rounded-xl flex items-center justify-between text-sm font-semibold transition shadow-md',
        notificationMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
      ]"
    >
      <div class="flex items-center gap-2">
        <CheckCircle2 v-if="notificationMessage.type === 'success'" class="w-5 h-5 text-emerald-600" />
        <AlertCircle v-else class="w-5 h-5 text-rose-600" />
        <span>{{ notificationMessage.text }}</span>
      </div>
      <button @click="notificationMessage = null" class="text-xs opacity-75 hover:opacity-100">✕</button>
    </div>

    <!-- Barra de cabecera y título -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="emit('close')"
          class="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 text-slate-700 transition shadow-sm"
          title="Regresar al listado"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-[#131523] tracking-tight">
              {{ isEditing ? 'Editar Orden' : 'Nueva Orden de Trabajo' }}
            </h1>
            <span class="text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-300">
              Rectificadora
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">
            Registro unificado de operaciones por componentes: Bielas, Bancadas, Cigüeñal, Culata y Block.
          </p>
        </div>
      </div>
    </div>

    <!-- Grid Principal (2 Columnas idéntico a Diego/html/index.html) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Columna Izquierda (7 o 8 de 12) -->
      <div class="lg:col-span-7 xl:col-span-8 space-y-6">
        
        <!-- 1. Card Cabecera / Info de la Orden -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">N° de Orden</span>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-2xl font-black font-mono tracking-tight text-[#131523] bg-slate-100/90 border border-slate-200 px-3 py-1 rounded-xl select-all shadow-2xs">
                {{ orderNumber || 'Asignando...' }}
              </span>
              <span class="text-[10px] font-bold text-cyan-800 bg-cyan-100 border border-cyan-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Fijo (Auto)
              </span>
            </div>
          </div>

          <div class="hidden sm:block w-px h-12 bg-slate-200"></div>

          <div class="flex-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Fecha de Ingreso</span>
            <div class="mt-1">
              <input
                v-model="orderDate"
                type="date"
                class="text-base font-bold text-[#131523] bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#04c4d9]"
              />
            </div>
          </div>

          <div class="hidden sm:block w-px h-12 bg-slate-200"></div>

          <div class="flex-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Estado</span>
            <div class="mt-1">
              <div class="relative inline-block w-full">
                <select
                  v-model="orderStatus"
                  :class="[
                    'w-full font-bold text-xs rounded-full px-3 py-1.5 appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-2 transition',
                    orderStatus === 'Pendiente'
                      ? 'bg-amber-100/70 border border-amber-300 text-amber-900 focus:ring-amber-400'
                      : 'bg-cyan-100/70 border border-[#04c4d9] text-[#038896] focus:ring-[#04c4d9]'
                  ]"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Proceso">En Proceso</option>
                </select>
                <ChevronDown
                  :class="[
                    'w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none transition',
                    orderStatus === 'Pendiente' ? 'text-amber-800' : 'text-[#038896]'
                  ]"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Card Información del Cliente (Búsqueda Rápida + Autocompletado) -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-4">
          <div class="flex items-center justify-between border-b pb-3 border-slate-100">
            <h2 class="text-base font-bold text-[#131523] flex items-center gap-2">
              <UserCheck class="w-4 h-4 text-[#04c4d9]" />
              Información del Cliente / Taller
            </h2>
            <span v-if="selectedCustomerId" class="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
              Cliente Registrado
            </span>
          </div>

          <!-- Barra de Búsqueda Rápida de Clientes -->
          <div class="flex flex-col sm:flex-row gap-3 relative">
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search class="w-4 h-4" />
              </div>
              <input
                v-model="clientSearchQuery"
                type="text"
                placeholder="Buscar cliente por nombre o taller..."
                class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9]"
              />
              <!-- Dropdown de resultados de búsqueda -->
              <div
                v-if="showClientDropdown"
                class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100"
              >
                <div
                  v-for="c in clientSearchResults"
                  :key="c.id"
                  @click="selectCustomer(c)"
                  class="p-3 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div class="text-xs font-bold text-slate-900">{{ c.nombre }}</div>
                    <div class="text-[11px] text-slate-500">
                      {{ c.tipo }} • {{ c.especificaciones_tecnicas?.taller || c.telefono || 'Sin taller registrado' }}
                    </div>
                  </div>
                  <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                    {{ c.cedula || 'ID' }}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              @click="showNewClientModal = true"
              class="px-4 py-2 bg-[#04c4d9] hover:bg-[#03a9bc] text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition whitespace-nowrap"
            >
              <Plus class="w-4 h-4" />
              Nuevo Cliente
            </button>
          </div>

          <!-- Campos del cliente -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold flex items-center justify-between" :class="formErrors.clientName ? 'text-rose-600 font-bold' : 'text-slate-500'">
                <span>Nombre Completo *</span>
                <span v-if="formErrors.clientName" class="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                  <AlertCircle class="w-3 h-3" /> Requerido
                </span>
              </label>
              <input
                v-model="clientName"
                @input="formErrors.clientName = false"
                type="text"
                placeholder="Ej. Juan Pérez"
                :class="[
                  'w-full px-3 py-1.5 rounded-md text-xs font-medium transition',
                  formErrors.clientName 
                    ? 'error-required-field bg-rose-50/90 border-2 border-rose-500 text-rose-900 placeholder-rose-300 ring-2 ring-rose-200 focus:outline-none focus:border-rose-600' 
                    : 'bg-[#f4f4f4] border border-slate-300 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#04c4d9]'
                ]"
              />
              <p v-if="formErrors.clientName" class="text-[10px] text-rose-600 font-semibold mt-0.5">
                El nombre del cliente o taller es obligatorio.
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-slate-500">Taller / Empresa</label>
              <input
                v-model="clientWorkshop"
                type="text"
                placeholder="Ej. Taller Mecánico Gómez"
                class="w-full px-3 py-1.5 bg-[#f4f4f4] border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#04c4d9]"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-slate-500">Teléfono</label>
              <input
                v-model="clientPhone"
                type="text"
                placeholder="Ej. +52 81 1234 5678"
                class="w-full px-3 py-1.5 bg-[#f4f4f4] border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#04c4d9]"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-semibold text-slate-500">Dirección</label>
              <input
                v-model="clientAddress"
                type="text"
                placeholder="Ej. Av. Madero 123"
                class="w-full px-3 py-1.5 bg-[#f4f4f4] border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#04c4d9]"
              />
            </div>
          </div>
        </div>

        <!-- 3. Card Información del Vehículo / Motor -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6 space-y-4">
          <h2 class="text-base font-bold text-[#131523] border-b pb-3 border-slate-100 flex items-center gap-2">
            <Building class="w-4 h-4 text-[#04c4d9]" />
            Información del Vehículo / Motor
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[11px] font-semibold flex items-center justify-between" :class="formErrors.vehicleBrand ? 'text-rose-600 font-bold' : 'text-slate-500'">
                <span>Marca *</span>
                <span v-if="formErrors.vehicleBrand" class="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                  <AlertCircle class="w-3 h-3" /> Requerido
                </span>
              </label>
              <input
                v-model="vehicleBrand"
                @input="formErrors.vehicleBrand = false"
                type="text"
                placeholder="Ej. Toyota, Nissan, Cummins"
                :class="[
                  'w-full px-3 py-1.5 rounded-md text-xs font-medium transition',
                  formErrors.vehicleBrand
                    ? 'error-required-field bg-rose-50/90 border-2 border-rose-500 text-rose-900 placeholder-rose-300 ring-2 ring-rose-200 focus:outline-none focus:border-rose-600'
                    : 'bg-[#f4f4f4] border border-slate-300 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#04c4d9]'
                ]"
              />
              <p v-if="formErrors.vehicleBrand" class="text-[10px] text-rose-600 font-semibold mt-0.5">
                Ingresa la marca del vehículo o motor.
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-semibold flex items-center justify-between" :class="formErrors.vehicleEngine ? 'text-rose-600 font-bold' : 'text-slate-500'">
                <span>Motor *</span>
                <span v-if="formErrors.vehicleEngine" class="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                  <AlertCircle class="w-3 h-3" /> Requerido
                </span>
              </label>
              <input
                v-model="vehicleEngine"
                @input="formErrors.vehicleEngine = false"
                type="text"
                placeholder="Ej. 3L, 22R, Z24, 1KD, ISX15"
                :class="[
                  'w-full px-3 py-1.5 rounded-md text-xs font-medium transition',
                  formErrors.vehicleEngine
                    ? 'error-required-field bg-rose-50/90 border-2 border-rose-500 text-rose-900 placeholder-rose-300 ring-2 ring-rose-200 focus:outline-none focus:border-rose-600'
                    : 'bg-[#f4f4f4] border border-slate-300 text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#04c4d9]'
                ]"
              />
              <p v-if="formErrors.vehicleEngine" class="text-[10px] text-rose-600 font-semibold mt-0.5">
                Ingresa el código o tipo de motor.
              </p>
            </div>
          </div>
        </div>

        <!-- 4. Card Formulario Unificado de Servicios de Rectificación (Todas las opciones en lista) -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <!-- Encabezado de la Sección -->
          <div class="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-[#131523] flex items-center gap-2">
                  <Wrench class="w-4 h-4 text-[#04c4d9]" />
                  Servicios y Operaciones de Rectificación
                </h2>
                <span class="text-xs bg-cyan-50 text-cyan-800 font-bold px-2 py-0.5 rounded-full border border-cyan-200">
                  {{ activeBilledOperations.length }} con datos
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-1">
                Todas las operaciones listadas tienen <strong>ingreso de precios 100% manual</strong> (sin costos automáticos). Ingresa cantidad y precio únicamente en las que se van a facturar.
              </p>
            </div>
            <div class="text-right">
              <span class="text-xs text-slate-500">Subtotal Mano de Obra:</span>
              <span class="text-lg font-black text-[#04c4d9] ml-2">${{ laborTotal.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Alerta si falta registrar operaciones facturadas -->
          <div
            v-if="formErrors.noItems"
            class="error-required-field m-4 p-3.5 bg-rose-50 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2.5 animate-pulse"
          >
            <AlertCircle class="w-5 h-5 text-rose-600 shrink-0" />
            <span>Debes ingresar al menos una operación de rectificación o repuesto con su cantidad y precio manual para poder generar la orden.</span>
          </div>

          <!-- Barra de Filtros y Búsqueda Rápida en la lista -->
          <div class="p-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <span class="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Filter class="w-3 h-3" /> Ver:
              </span>
              <button
                v-for="cat in ['Todos', 'Bielas', 'Bancadas', 'Cigüeñal', 'Culata', 'Block', 'Repuestos', 'ConDatos']"
                :key="cat"
                type="button"
                @click="operationFilterCategory = cat"
                :class="[
                  'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition',
                  operationFilterCategory === cat
                    ? 'bg-[#04c4d9] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                ]"
              >
                {{ cat === 'ConDatos' ? `Solo con Datos (${activeBilledOperations.length})` : cat }}
              </button>
            </div>

            <!-- Input de búsqueda en la lista de operaciones -->
            <div class="relative w-full md:w-56">
              <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search class="w-3.5 h-3.5" />
              </div>
              <input
                v-model="operationSearchQuery"
                type="text"
                placeholder="Filtrar operación..."
                class="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#04c4d9]"
              />
            </div>
          </div>

          <!-- Tabla Unificada de Todas las Operaciones de Rectificación -->
          <div class="overflow-x-auto max-h-[520px]">
            <table class="w-full text-xs">
              <thead class="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th class="px-3 py-2.5 text-center w-10">Act.</th>
                  <th class="px-4 py-2.5 text-left w-24">Componente</th>
                  <th class="px-4 py-2.5 text-left">Operación de Rectificación</th>
                  <th class="px-3 py-2.5 text-center w-24">Cantidad</th>
                  <th class="px-4 py-2.5 text-right w-28">
                    Precio U. ($)
                    <span class="block text-[9px] font-normal text-slate-500 lowercase">100% manual</span>
                  </th>
                  <th class="px-4 py-2.5 text-right w-28">Sub Total</th>
                  <th class="px-2 py-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="op in displayedOperations"
                  :key="op.id"
                  :class="[
                    'transition',
                    op.selected && op.quantity !== null && Number(op.quantity) > 0 && op.unitPrice !== null && Number(op.unitPrice) > 0
                      ? 'bg-cyan-50/60 hover:bg-cyan-50'
                      : 'hover:bg-slate-50/70'
                  ]"
                >
                  <!-- Checkbox de activación -->
                  <td class="px-3 py-2.5 text-center">
                    <input
                      v-model="op.selected"
                      @change="handleRowToggle(op)"
                      type="checkbox"
                      class="w-4 h-4 text-[#04c4d9] rounded border-slate-300 focus:ring-[#04c4d9] cursor-pointer"
                    />
                  </td>

                  <!-- Categoría / Componente -->
                  <td class="px-4 py-2.5 font-bold">
                    <span :class="['inline-block px-2 py-0.5 rounded text-[10px] font-bold border', getCategoryBadgeClass(op.category)]">
                      {{ op.category }}
                    </span>
                  </td>

                  <!-- Nombre de la operación y selectores de medida -->
                  <td class="px-4 py-2.5">
                    <!-- Operaciones con Medida Dual (Rectificar / Pulir Banco-Biela) -->
                    <div v-if="isDualMeasureOperation(op.operation)" class="space-y-1.5 py-0.5">
                      <div :class="['font-medium text-slate-900', op.selected ? 'font-bold text-cyan-950' : 'text-slate-700']">
                        {{ op.operation }}
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        <!-- Selector Banco -->
                        <div class="inline-flex items-center gap-1.5 bg-slate-100/90 border border-slate-300 rounded px-2 py-0.5 shadow-2xs">
                          <span class="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Banco:</span>
                          <select
                            v-model="op.measureBanco"
                            @change="handleMeasureChange(op)"
                            class="bg-white border border-slate-300 text-xs font-semibold text-slate-800 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#04c4d9] cursor-pointer"
                          >
                            <option value="">Medida</option>
                            <option v-for="m in MEASURE_OPTIONS" :key="m" :value="m">{{ m }}</option>
                          </select>
                        </div>
                        <!-- Selector Biela -->
                        <div class="inline-flex items-center gap-1.5 bg-slate-100/90 border border-slate-300 rounded px-2 py-0.5 shadow-2xs">
                          <span class="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Biela:</span>
                          <select
                            v-model="op.measureBiela"
                            @change="handleMeasureChange(op)"
                            class="bg-white border border-slate-300 text-xs font-semibold text-slate-800 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#04c4d9] cursor-pointer"
                          >
                            <option value="">Medida</option>
                            <option v-for="m in MEASURE_OPTIONS" :key="m" :value="m">{{ m }}</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <!-- Operaciones con Tipo de Válvula (Cambio de Guías y Adapte, Guías de Válvula) -->
                    <div v-else-if="isValveTypeOperation(op.operation)" class="flex flex-wrap items-center justify-between gap-2 py-0.5">
                      <div :class="['font-medium text-slate-900', op.selected ? 'font-bold text-cyan-950' : 'text-slate-700']">
                        {{ op.operation }}
                      </div>
                      <div class="inline-flex items-center gap-1.5 bg-slate-100/90 border border-slate-300 rounded px-2 py-0.5 shadow-2xs">
                        <span class="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Tipo:</span>
                        <select
                          v-model="op.measure"
                          @change="handleMeasureChange(op)"
                          class="bg-white border border-slate-300 text-xs font-semibold text-slate-800 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#04c4d9] cursor-pointer"
                        >
                          <option value="">Tipo</option>
                          <option v-for="t in VALVE_TYPE_OPTIONS" :key="t" :value="t">{{ t }}</option>
                        </select>
                      </div>
                    </div>

                    <!-- Operaciones con Medida Simple (Rectificar Cilindros, Bruñir Cilindros, Casquetes de Bancos, Casquetes de Biela) -->
                    <div v-else-if="isSingleMeasureOperation(op.operation)" class="flex flex-wrap items-center justify-between gap-2 py-0.5">
                      <div :class="['font-medium text-slate-900', op.selected ? 'font-bold text-cyan-950' : 'text-slate-700']">
                        {{ op.operation }}
                      </div>
                      <div class="inline-flex items-center gap-1.5 bg-slate-100/90 border border-slate-300 rounded px-2 py-0.5 shadow-2xs">
                        <span class="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Medida:</span>
                        <select
                          v-model="op.measure"
                          @change="handleMeasureChange(op)"
                          class="bg-white border border-slate-300 text-xs font-semibold text-slate-800 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#04c4d9] cursor-pointer"
                        >
                          <option value="">Medida</option>
                          <option v-for="m in MEASURE_OPTIONS" :key="m" :value="m">{{ m }}</option>
                        </select>
                      </div>
                    </div>

                    <!-- Operaciones estándar -->
                    <div v-else :class="['font-medium text-slate-900', op.selected ? 'font-bold text-cyan-950' : 'text-slate-700']">
                      {{ op.operation }}
                    </div>
                  </td>

                  <!-- Cantidad editable -->
                  <td class="px-3 py-2.5 text-center">
                    <input
                      v-model.number="op.quantity"
                      @input="handleRowDataChange(op)"
                      type="number"
                      min="0"
                      placeholder="-"
                      class="w-16 text-center border border-slate-300 rounded-md py-1 font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#04c4d9]"
                    />
                  </td>

                  <!-- Precio unitario editable flexible (100% manual) -->
                  <td class="px-4 py-2.5 text-right">
                    <input
                      v-model.number="op.unitPrice"
                      @input="handleRowDataChange(op); formErrors.noItems = false"
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="$ 0.00"
                      :class="[
                        'w-24 text-right rounded-md py-1 px-2 font-bold text-xs transition focus:outline-none focus:ring-1 focus:ring-[#04c4d9]',
                        op.selected && (!op.unitPrice || op.unitPrice <= 0)
                          ? 'border-2 border-amber-400 bg-amber-50/60 text-amber-900 placeholder-amber-400 ring-1 ring-amber-200'
                          : 'border border-slate-300 bg-white text-slate-900'
                      ]"
                      title="Ingreso 100% manual de precio (sin costos automáticos)"
                    />
                  </td>

                  <!-- Subtotal calculado en vivo -->
                  <td class="px-4 py-2.5 text-right font-black">
                    <span :class="op.selected && op.subtotal > 0 ? 'text-slate-900' : 'text-slate-300'">
                      {{ op.selected && op.subtotal > 0 ? `$${op.subtotal.toFixed(2)}` : '-' }}
                    </span>
                  </td>

                  <!-- Acción de limpiar o eliminar -->
                  <td class="px-2 py-2.5 text-center">
                    <button
                      v-if="op.isCustom"
                      type="button"
                      @click="removeCustomOperation(op.id)"
                      class="p-1 text-slate-400 hover:text-rose-600 transition"
                      title="Eliminar operación personalizada"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      v-else-if="op.selected"
                      type="button"
                      @click="resetRow(op)"
                      class="p-1 text-slate-400 hover:text-amber-600 transition"
                      title="Restablecer fila"
                    >
                      <RotateCcw class="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>

                <tr v-if="displayedOperations.length === 0">
                  <td colspan="7" class="px-5 py-8 text-center text-slate-400">
                    No se encontraron operaciones con el filtro aplicado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pie: Agregar operación especial personalizada si el trabajo lo requiere -->
          <div class="p-4 bg-slate-50 border-t border-slate-200">
            <span class="text-[11px] font-bold text-slate-600 block mb-2">
              + ¿Requieres agregar una operación especial no listada?
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div class="sm:col-span-3">
                <select
                  v-model="customCategory"
                  class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold"
                >
                  <option value="Bielas">Bielas</option>
                  <option value="Bancadas">Bancadas</option>
                  <option value="Cigüeñal">Cigüeñal</option>
                  <option value="Culata">Culata</option>
                  <option value="Block">Block</option>
                  <option value="Repuestos">Repuestos</option>
                </select>
              </div>
              <div class="sm:col-span-5">
                <input
                  v-model="customOpName"
                  type="text"
                  placeholder="Descripción de la operación especial..."
                  class="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs"
                  @keyup.enter="addCustomOperation"
                />
              </div>
              <div class="sm:col-span-2">
                <input
                  v-model.number="customOpPrice"
                  type="number"
                  step="0.5"
                  placeholder="Precio $"
                  class="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-right"
                  @keyup.enter="addCustomOperation"
                />
              </div>
              <div class="sm:col-span-2">
                <button
                  type="button"
                  @click="addCustomOperation"
                  class="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  <Plus class="w-3.5 h-3.5" /> Agregar
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Columna Derecha (5 o 4 de 12 - idéntica a Diego/html/index.html) -->
      <div class="lg:col-span-5 xl:col-span-4 space-y-6">

        <!-- Card Materiales / Insumos de Taller (Solo nombre del material, sin precio $) -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-sm font-bold text-[#131523] flex items-center gap-1.5">
              <Layers class="w-4 h-4 text-[#04c4d9]" />
              Materiales e Insumos
            </h2>
            <span class="text-xs text-slate-400 font-semibold">{{ materials.length }} registrado(s)</span>
          </div>

          <!-- Input rápido para agregar material (solo nombre) -->
          <div class="p-3 bg-slate-50 border-b border-slate-200 flex gap-2 items-center">
            <input
              v-model="customMaterialName"
              type="text"
              placeholder="Nombre del material (ej. Desengrasante, sellador, lija...)"
              class="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#04c4d9]"
              @keyup.enter="addMaterial"
            />
            <button
              type="button"
              @click="addMaterial"
              class="px-3 py-1.5 bg-[#04c4d9] hover:bg-[#03a9bc] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" /> Agregar
            </button>
          </div>

          <div class="overflow-x-auto max-h-48 p-3">
            <div v-if="materials.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="m in materials"
                :key="m.id"
                class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 text-xs px-2.5 py-1 rounded-lg font-medium transition"
              >
                <span>{{ m.name }}</span>
                <button
                  type="button"
                  @click="removeMaterial(m.id)"
                  class="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title="Eliminar material"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div v-else class="py-4 text-center text-slate-400 text-xs italic">
              Sin materiales registrados
            </div>
          </div>
        </div>

        <!-- Card Resumen de la Orden -->
        <div class="bg-white rounded-xl shadow-md border border-slate-200/80 p-6 space-y-4">
          <div class="flex items-center justify-between border-b pb-3 border-slate-100">
            <h2 class="text-base font-bold text-[#131523]">
              Resumen de la Orden
            </h2>
            <span class="text-xs text-slate-500 font-semibold">
              {{ activeBilledOperations.length }} operaciones activas
            </span>
          </div>

          <div class="space-y-2 text-xs text-slate-700">
            <div class="flex justify-between items-center">
              <span>Mano de Obra (Rectificación):</span>
              <span class="font-bold text-slate-900">${{ laborTotal.toFixed(2) }}</span>
            </div>
            <div v-if="materials.length > 0" class="flex justify-between items-center text-slate-500">
              <span>Materiales Registrados:</span>
              <span class="font-semibold text-slate-700">{{ materials.length }} ítem(s) (sin cobro)</span>
            </div>
          </div>

          <div class="pt-4 border-t-2 border-slate-900 flex justify-between items-baseline">
            <span class="text-base font-bold text-slate-900">Total General:</span>
            <span class="text-3xl font-black text-[#04c4d9]">
              ${{ totalOrder.toFixed(2) }}
            </span>
          </div>

          <!-- Selector Tipo: Orden de Taller vs Cotización B/N (Ubicado debajo de Total General) -->
          <div class="pt-3 border-t border-slate-200">
            <label class="text-[11px] font-bold text-slate-600 block mb-1.5">
              Tipo de Documento:
            </label>
            <div class="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                @click="docType = 'orden'"
                :class="[
                  'flex-1 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5',
                  docType === 'orden' ? 'bg-[#04c4d9] text-white shadow' : 'text-slate-700 hover:text-slate-900'
                ]"
              >
                <Wrench class="w-3.5 h-3.5" />
                Orden de Taller
              </button>
              <button
                type="button"
                @click="docType = 'cotizacion'"
                :class="[
                  'flex-1 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5',
                  docType === 'cotizacion' ? 'bg-slate-800 text-white shadow' : 'text-slate-700 hover:text-slate-900'
                ]"
              >
                <Clock class="w-3.5 h-3.5" />
                Cotización (B/N)
              </button>
            </div>
          </div>

          <!-- Botones de Acción (Acción Unificada: Guardar Orden e Imprimir) -->
          <div class="pt-2 space-y-2.5">
            <button
              type="button"
              @click="handleSaveOrder"
              :disabled="isSubmitting"
              class="w-full py-3.5 bg-[#04c4d9] hover:bg-[#03a9bc] active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save class="w-4 h-4" />
              <Printer class="w-4 h-4" />
              <span>{{ isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Guardar Orden') }}</span>
            </button>

            <button
              type="button"
              @click="emit('close')"
              class="w-full py-2.5 bg-transparent border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition"
            >
              Cancelar
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Modal para Agregar Repuesto del Catálogo -->
    <div v-if="showCatalogModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 border border-slate-200">
        <div class="flex justify-between items-center border-b pb-3">
          <h3 class="font-bold text-base text-slate-900">Seleccionar Repuesto del Catálogo</h3>
          <button @click="showCatalogModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div class="space-y-4">
          <!-- Repuestos frecuentes de rectificadora del Excel -->
          <div>
            <label class="text-xs font-bold text-slate-700 block mb-2">
              Repuestos Frecuentes de Rectificadora (Excel):
            </label>
            <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
              <button
                v-for="ep in excelStandardParts"
                :key="ep"
                type="button"
                @click="addExcelPart(ep)"
                class="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-cyan-500 hover:text-white text-slate-700 rounded-lg border border-slate-200 shadow-sm transition"
              >
                + {{ ep }}
              </button>
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 block mb-1.5">Repuestos Registrados en Catálogo:</label>
            <div class="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            <div
              v-for="p in catalogProducts"
              :key="p.id"
              @click="addCatalogPart(p)"
              class="p-3 hover:bg-cyan-50/60 cursor-pointer flex items-center justify-between text-xs transition"
            >
              <div>
                <span class="font-bold text-slate-900">{{ p.name }}</span>
                <span class="text-slate-400 ml-2">({{ p.code }})</span>
                <div class="text-[10px] text-slate-500">{{ p.category }}</div>
              </div>
              <span class="font-black text-slate-900">${{ p.price.toFixed(2) }}</span>
            </div>
          </div>
          </div>

          <div class="pt-2 border-t border-slate-200">
            <span class="text-xs font-semibold text-slate-600 block mb-2">O ingresa un repuesto manual:</span>
            <div class="grid grid-cols-3 gap-2">
              <input
                v-model="customPartName"
                type="text"
                placeholder="Nombre del repuesto"
                class="col-span-2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <input
                v-model.number="customPartPrice"
                type="number"
                step="0.5"
                placeholder="Precio $"
                class="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-right"
              />
            </div>
            <button
              type="button"
              @click="addCustomPart"
              class="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition"
            >
              Agregar Repuesto Manual
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para Nuevo Cliente Rápido -->
    <div v-if="showNewClientModal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
        <div class="flex justify-between items-center border-b pb-3">
          <h3 class="font-bold text-base text-slate-900">Registrar Cliente / Taller</h3>
          <button @click="showNewClientModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-xs font-semibold text-slate-600">Nombre Completo *</label>
            <input
              v-model="newClientForm.nombre"
              type="text"
              class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
              placeholder="Ej. Ing. Carlos Mendoza"
            />
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600">Taller o Empresa</label>
            <input
              v-model="newClientForm.taller"
              type="text"
              class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
              placeholder="Ej. Rectificadora del Norte"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs font-semibold text-slate-600">Teléfono</label>
              <input
                v-model="newClientForm.telefono"
                type="text"
                class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
                placeholder="+52 81 8345 9912"
              />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-600">Cédula / RFC</label>
              <input
                v-model="newClientForm.cedula"
                type="text"
                class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
                placeholder="CLI-1029"
              />
            </div>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-600">Dirección</label>
            <input
              v-model="newClientForm.direccion"
              type="text"
              class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
              placeholder="Calle, número, colonia..."
            />
          </div>
        </div>

        <div class="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            @click="showNewClientModal = false"
            class="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="handleQuickCreateClient"
            class="px-4 py-1.5 bg-[#04c4d9] hover:bg-[#03a9bc] text-white rounded-lg text-xs font-bold"
          >
            Guardar y Seleccionar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Impresión Limpia (Clean Print) -->
    <WorkOrderPrintModal
      :is-open="showPrintModal"
      :order="orderForPrint"
      @close="handleClosePrintModal"
    />
  </div>
</template>
