<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { 
  type Motor, 
  type Modelo,
  type RepuestoTecnico, 
  type Fabricante,
  type GrupoRepuesto
} from '@/services/catalogService'
import AdminCatalogModal from '@/components/AdminCatalogModal.vue'
import { 
  Search, 
  X, 
  Wrench, 
  Copy, 
  Check, 
  CheckCircle2, 
  Plus, 
  RotateCcw, 
  Eye, 
  Layers, 
  CircleDot, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Info, 
  FileText, 
  AlertCircle, 
  ArrowLeft, 
  SlidersHorizontal,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  FolderPlus,
  Edit3,
  Ruler,
  Lock,
  ArrowRightLeft,
  Car
} from 'lucide-vue-next'

const catalogStore = useCatalogStore()

// =============================================================================
// ESTADO DE SELECCIÓN EN CASCADA (FABRICANTE -> MODELO -> MOTOR + COMPONENTE)
// =============================================================================
const brandInput = ref<string>('')
const modelInput = ref<string>('')
const motorInput = ref<string>('')
const componentInput = ref<string>('')

const isBrandOpen = ref<boolean>(false)
const isModelOpen = ref<boolean>(false)
const isMotorOpen = ref<boolean>(false)
const isComponentOpen = ref<boolean>(false)

const selectedBrand = ref<Fabricante | null>(null)
const selectedModel = ref<Modelo | null>(null)
const selectedMotor = ref<Motor | null>(null)
const selectedComponent = ref<ComponentGroup | null>(null)

// Orden en cascada intercambiable: 'modelo_motor' (Fabricante -> Modelo -> Motor) o 'motor_modelo' (Fabricante -> Motor -> Modelo)
const cascadeOrder = ref<'modelo_motor' | 'motor_modelo'>('modelo_motor')
const toggleCascadeOrder = () => {
  cascadeOrder.value = cascadeOrder.value === 'modelo_motor' ? 'motor_modelo' : 'modelo_motor'
  showToast(cascadeOrder.value === 'modelo_motor' ? 'Orden: Fabricante → Modelo → Motor' : 'Orden: Fabricante → Motor → Modelo')
}

// Barra de búsqueda global con debounce
const searchInput = ref<string>('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Vista activa ('motores' | 'grupos' | 'repuestos')
const activeViewTab = ref<'motores' | 'grupos' | 'repuestos'>('motores')

// =============================================================================
// DEFINICIÓN DE GRUPOS / FAMILIAS DE PIEZAS (BASE + DINÁMICOS)
// =============================================================================
interface ComponentGroup {
  id: string
  title: string
  shortTitle: string
  category: string
  icon: string
  description: string
  sampleMeasurements: string
}

const baseComponentGroups: ComponentGroup[] = [
  {
    id: 'ajuste_valvula',
    title: 'Ajuste de válvula',
    shortTitle: 'Sellos de Válvula',
    category: 'Sellos',
    icon: 'CircleDot',
    description: 'Sellos y retenes de guía de válvula (Vitón / Alta temperatura)',
    sampleMeasurements: 'Diám. int. 4,8 mm, Diámetro exterior 10,8 mm y Altura 10 mm'
  },
  {
    id: 'valvula',
    title: 'Válvula de motor',
    shortTitle: 'Válvulas de Motor',
    category: 'Válvulas',
    icon: 'Wrench',
    description: 'Válvulas de admisión y escape estándar y sobremedida',
    sampleMeasurements: 'Hongo, vástago y altura'
  },
  {
    id: 'anillos_motor',
    title: 'Anillos de motor',
    shortTitle: 'Anillos de Pistón',
    category: 'Anillos',
    icon: 'Layers',
    description: 'Juegos de aros de pistón (Desglose explícito 1°, 2° y aceite)',
    sampleMeasurements: 'Diámetro, grosor primer anillo, altura grosor'
  },
  {
    id: 'tornillos_culata',
    title: 'Juego de tornillos de culata',
    shortTitle: 'Pernos de Culata',
    category: 'Pernos',
    icon: 'FileText',
    description: 'Tornillos y pernos de apriete para culata de cilindros',
    sampleMeasurements: 'Medida rosca, paso rosca, longitudes, cant.'
  },
  {
    id: 'casqueteria',
    title: 'Casquetería y Cojinetes',
    shortTitle: 'Casquetería',
    category: 'Casquetería',
    icon: 'CircleDot',
    description: 'Cojinetes de biela, bancada y arandelas axiales',
    sampleMeasurements: 'Muñón, alojamiento, ancho y tipo de cojinete'
  },
  {
    id: 'empaques_juntas',
    title: 'Empaques y Juntas',
    shortTitle: 'Empaques',
    category: 'Empaques',
    icon: 'Layers',
    description: 'Juntas de culata de grafito y multilámina MLS',
    sampleMeasurements: 'Diámetro de cilindro, espesor nominal'
  },
  {
    id: 'camisas_cilindro',
    title: 'Camisas de cilindro',
    shortTitle: 'Camisas de Cilindro',
    category: 'Camisas',
    icon: 'Layers',
    description: 'Camisas de cilindro terminadas y semiterminadas para bloque',
    sampleMeasurements: 'ØA Int × ØB Ext × C Largo'
  },
  {
    id: 'guias_valvula',
    title: 'Guías de válvula',
    shortTitle: 'Guías de Válvula',
    category: 'Guías',
    icon: 'Layers',
    description: 'Guías de válvula para culata de motor (Admisión y Escape)',
    sampleMeasurements: 'Posición (IN/EX), piezas por juego'
  },
  {
    id: 'asientos_valvula',
    title: 'Asientos de válvula',
    shortTitle: 'Asientos de Válvula',
    category: 'Asientos',
    icon: 'CircleDot',
    description: 'Asientos de válvula para culata de cilindros',
    sampleMeasurements: 'Posición (IN/EX), cilindros'
  }
]

// Mapeo 100% dinámico de los grupos de Supabase con fallback a definiciones base
const componentGroups = computed<ComponentGroup[]>(() => {
  if (catalogStore.grupos && catalogStore.grupos.length > 0) {
    return catalogStore.grupos.map(g => {
      const base = baseComponentGroups.find(b => b.id === g.codigo || b.category.toLowerCase() === g.categoria.toLowerCase())
      return {
        id: g.codigo,
        title: g.nombre,
        shortTitle: g.categoria || g.nombre,
        category: g.categoria,
        icon: g.icono || (base ? base.icon : 'Layers'),
        description: g.descripcion || (base ? base.description : `Familia de ${g.nombre}`),
        sampleMeasurements: (g.parametros && g.parametros.length > 0)
          ? g.parametros.map(p => `${p.etiqueta}${p.unidad ? ` (${p.unidad})` : ''}`).slice(0, 3).join(', ')
          : (base ? base.sampleMeasurements : 'Medidas requeridas configuradas')
      }
    })
  }
  return baseComponentGroups
})

// =============================================================================
// FILTROS DE MEDIDAS TÉCNICAS Y TOLERANCIA UNIVERSAL (± mm)
// =============================================================================

// Filtro de Tolerancia Universal (± mm) aplicable a todas las cotas
const filterToleranciaMm = ref<number>(1.0)

// Filtros para parámetros dinámicos de nuevos grupos
const dynamicParamFilters = ref<Record<string, any>>({})

const currentGroupDefinition = computed<GrupoRepuesto | null>(() => {
  if (!selectedComponent.value) return null
  return catalogStore.grupos.find(g => g.codigo === selectedComponent.value?.id || g.id === selectedComponent.value?.id) || null
})

// 1. Ajuste de válvula (Sellos)
const filterSelloDiamInt = ref<number | undefined>(undefined)
const filterSelloDiamExt = ref<number | undefined>(undefined)
const filterSelloAltura = ref<number | undefined>(undefined)

// 2. Válvula
const filterValvulaHongo = ref<number | undefined>(undefined)
const filterValvulaVastago = ref<number | undefined>(undefined)
const filterValvulaAltura = ref<number | undefined>(undefined)

// 3. Anillos de motor
const filterAnilloDiametro = ref<number | undefined>(undefined)
const filterAnilloGrosor1 = ref<number | undefined>(undefined)
const filterAnilloAlturaGrosor = ref<number | undefined>(undefined)

// 4. Juego de tornillos de culata
const filterPernoMedidaRosca = ref<string>('')
const filterPernoPasoRosca = ref<number | undefined>(undefined)
const filterPernoLongitud = ref<number | undefined>(undefined)
const filterPernoCantidad = ref<number | undefined>(undefined)
const filterPernoPasoRosca1 = ref<number | undefined>(undefined)
const filterPernoLongitud1 = ref<number | undefined>(undefined)
const filterPernoLongitud2 = ref<number | undefined>(undefined)

// Contador de filtros de medida activos
const activeMeasurementsCount = computed(() => {
  let count = 0
  if (selectedComponent.value) {
    if (selectedComponent.value.id === 'ajuste_valvula') {
      count += [filterSelloDiamInt.value, filterSelloDiamExt.value, filterSelloAltura.value].filter(v => v !== undefined && v !== null).length
    } else if (selectedComponent.value.id === 'valvula') {
      count += [filterValvulaHongo.value, filterValvulaVastago.value, filterValvulaAltura.value].filter(v => v !== undefined && v !== null).length
    } else if (selectedComponent.value.id === 'anillos_motor') {
      count += [filterAnilloDiametro.value, filterAnilloGrosor1.value, filterAnilloAlturaGrosor.value].filter(v => v !== undefined && v !== null).length
    } else if (selectedComponent.value.id === 'tornillos_culata') {
      count += [
        filterPernoMedidaRosca.value || undefined,
        filterPernoPasoRosca.value,
        filterPernoLongitud.value,
        filterPernoCantidad.value,
        filterPernoPasoRosca1.value,
        filterPernoLongitud1.value,
        filterPernoLongitud2.value
      ].filter(v => v !== undefined && v !== null).length
    }
  }
  // Sumar filtros dinámicos activos
  count += Object.values(dynamicParamFilters.value).filter(v => v !== undefined && v !== null && v !== '').length
  return count
})

const resetMeasurementsFilters = () => {
  filterSelloDiamInt.value = undefined
  filterSelloDiamExt.value = undefined
  filterSelloAltura.value = undefined

  filterValvulaHongo.value = undefined
  filterValvulaVastago.value = undefined
  filterValvulaAltura.value = undefined

  filterAnilloDiametro.value = undefined
  filterAnilloGrosor1.value = undefined
  filterAnilloAlturaGrosor.value = undefined

  filterPernoMedidaRosca.value = ''
  filterPernoPasoRosca.value = undefined
  filterPernoLongitud.value = undefined
  filterPernoCantidad.value = undefined
  filterPernoPasoRosca1.value = undefined
  filterPernoLongitud1.value = undefined
  filterPernoLongitud2.value = undefined

  dynamicParamFilters.value = {}

  showToast('Filtros de medidas restablecidos')
}

// =============================================================================
// TOAST Y COPIADO DE CÓDIGOS
// =============================================================================
const toastMessage = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (msg: string) => {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 2400)
}

const copiedCode = ref<string | null>(null)
const copyToClipboard = async (text: string, label?: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedCode.value = text
    showToast(`✓ Copiado: ${label ? `${label} ` : ''}${text}`)
    setTimeout(() => {
      if (copiedCode.value === text) copiedCode.value = null
    }, 1800)
  } catch {
    showToast(`Código: ${text}`)
  }
}

// Copiar Ficha Técnica Cruzada
const copyFullCross = async (part: RepuestoTecnico) => {
  const lines: string[] = [
    `REPARACIÓN: ${part.nombre} [${part.subsistema}]`,
    `OEM: ${part.codigo_oem}`
  ]
  if (part.equivalencias && part.equivalencias.length > 0) {
    part.equivalencias.forEach(eq => {
      lines.push(`${eq.marca_alterna}: ${eq.codigo_alterno}`)
    })
  }
  if (part.categoria === 'Camisas' || part.dimensiones?.diametro_interior_mm || part.dimensiones?.diametro_exterior_mm) {
    const a = part.dimensiones?.diametro_interior_mm || part.diametro_cilindro_mm || '-'
    const b = part.dimensiones?.diametro_exterior_mm || '-'
    const c = part.dimensiones?.longitud_total_mm || part.longitud_total_mm || '-'
    lines.push(`Camisa: ØA Int ${a}mm | ØB Ext ${b}mm | Largo C ${c}mm`)
  } else if (part.diametro_interior_mm) {
    lines.push(`Ajuste Válvula: ØInt ${part.diametro_interior_mm}mm | ØExt ${part.diametro_exterior_mm}mm | Alt ${part.altura_mm}mm`)
  }
  if (part.diametro_cabeza_mm) {
    lines.push(`Válvula: Hongo Ø${part.diametro_cabeza_mm}mm | Vástago Ø${part.diametro_vastago_mm}mm | Altura ${part.longitud_total_mm}mm`)
  }
  if (part.diametro_cilindro_mm && part.categoria !== 'Camisas') {
    lines.push(`Anillos: ØCil ${part.diametro_cilindro_mm}mm | 1° Anillo: ${part.espesor_anillo1_mm || '-'}mm | 2° Anillo: ${part.espesor_anillo2_mm || '-'}mm | Aceite: ${part.espesor_aceite_mm || '-'}mm`)
  }
  if (part.medida_rosca) {
    lines.push(`Tornillos Culata: ${part.medida_rosca}x${part.paso_rosca_mm || 1.25} | Long ${part.longitud_perno_mm || 120}mm | Cant: ${part.cantidad_piezas || 10}`)
  }
  await copyToClipboard(lines.join(' | '), 'Ficha técnica')
}

// Carrito / Agregar repuesto a Orden de Trabajo
const addedPartId = ref<string | null>(null)
const addToWorkOrder = (part: RepuestoTecnico) => {
  addedPartId.value = part.id
  try {
    const raw = localStorage.getItem('swgora_cart_parts') || '[]'
    const cart = JSON.parse(raw)
    cart.push({
      id: part.id,
      code: part.codigo_oem,
      name: part.nombre,
      price: part.precio,
      category: part.categoria,
      motor: part.motor?.codigo || selectedMotor.value?.codigo || 'Universal',
      timestamp: Date.now()
    })
    localStorage.setItem('swgora_cart_parts', JSON.stringify(cart))
  } catch {
    // Silencioso
  }
  showToast(`✓ ${part.codigo_oem} agregado a la Orden de Trabajo`)
  setTimeout(() => {
    if (addedPartId.value === part.id) addedPartId.value = null
  }, 1800)
}

// =============================================================================
// CASCADA REACTIVA: FABRICANTE -> MODELO -> CÓDIGO DE MOTOR
// =============================================================================

// 1. Filtrado de MARCAS / FABRICANTES
const filteredBrands = computed(() => {
  const q = brandInput.value.toLowerCase().trim()
  const list = catalogStore.fabricantes
  if (!q || (selectedBrand.value && q === selectedBrand.value.nombre.toLowerCase().trim())) {
    return list
  }
  return list.filter(f => 
    f.nombre.toLowerCase().includes(q) || 
    (f.pais_origen && f.pais_origen.toLowerCase().includes(q))
  )
})

const handleFocusBrand = (e?: Event) => {
  isBrandOpen.value = true
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
}

const handleSelectBrand = async (fab: Fabricante) => {
  selectedBrand.value = fab
  brandInput.value = fab.nombre.toUpperCase()
  isBrandOpen.value = false
  motorCurrentPage.value = 1

  // Reiniciar modelo y motor subordinados
  selectedModel.value = null
  modelInput.value = ''
  selectedMotor.value = null
  motorInput.value = ''

  await catalogStore.selectFabricante(fab.id)

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, fab.id)
  } else {
    activeViewTab.value = 'motores'
  }
}

const handleClearSelectedBrand = async () => {
  brandInput.value = ''
  selectedBrand.value = null
  selectedModel.value = null
  modelInput.value = ''
  selectedMotor.value = null
  motorInput.value = ''
  await catalogStore.selectFabricante(null)

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category)
  } else {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  }
}

// 2. Filtrado de MODELOS (CASCADA NIVEL 2)
const filteredModels = computed(() => {
  const q = modelInput.value.toLowerCase().trim()
  const list = catalogStore.availableModelos
  if (!q || (selectedModel.value && q === selectedModel.value.nombre.toLowerCase().trim())) {
    return list
  }
  return list.filter(m => m.nombre.toLowerCase().includes(q))
})

const handleSelectModel = async (mod: Modelo) => {
  selectedModel.value = mod
  modelInput.value = mod.nombre
  isModelOpen.value = false
  motorCurrentPage.value = 1

  // Reiniciar motor subordinado
  selectedMotor.value = null
  motorInput.value = ''

  await catalogStore.selectModelo(mod.id)

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id)
  } else {
    activeViewTab.value = 'motores'
  }
}

const handleClearSelectedModel = async () => {
  selectedModel.value = null
  modelInput.value = ''
  await catalogStore.selectModelo(null)
  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id)
  }
}

const onFocusModel = (e?: Event) => {
  if (selectedBrand.value) {
    isModelOpen.value = true
    if (e?.target) {
      (e.target as HTMLInputElement).select?.()
    }
  }
}
const onInputModel = () => { if (selectedBrand.value) isModelOpen.value = true }
const onFocusMotor = (e?: Event) => {
  if (selectedBrand.value) {
    isMotorOpen.value = true
    if (e?.target) {
      (e.target as HTMLInputElement).select?.()
    }
  }
}
const onInputMotor = () => { if (selectedBrand.value) isMotorOpen.value = true }

// 3. Filtrado de MOTORES DISPONIBLES (CASCADA NIVEL 3)
const availableMotors = computed(() => {
  return catalogStore.availableMotores
})

// Modelos compatibles con el motor seleccionado (para visualización directa)
const compatibleModelsForMotor = computed<Modelo[]>(() => {
  if (!selectedMotor.value) return []
  return catalogStore.availableModelos
})

const filteredMotors = computed(() => {
  const q = motorInput.value.toLowerCase().trim()
  const list = availableMotors.value
  if (!q || (selectedMotor.value && (
    q === selectedMotor.value.codigo.toLowerCase().trim() ||
    (selectedMotor.value.nombre_comercial && q === selectedMotor.value.nombre_comercial.toLowerCase().trim()) ||
    (selectedMotor.value.denominacion_venta && q === selectedMotor.value.denominacion_venta.toLowerCase().trim())
  ))) {
    return list
  }
  return list.filter(m => 
    m.codigo.toLowerCase().includes(q) || 
    (m.nombre_comercial && m.nombre_comercial.toLowerCase().includes(q)) ||
    (m.denominacion_venta && m.denominacion_venta.toLowerCase().includes(q)) ||
    m.combustible.toLowerCase().includes(q)
  )
})

const handleSelectMotor = async (mot: Motor) => {
  selectedMotor.value = mot
  motorInput.value = mot.codigo
  isMotorOpen.value = false

  await catalogStore.selectMotor(mot.id)

  // Autoseleccionar marca si estaba vacía
  if (!selectedBrand.value && mot.fabricante_id) {
    const fab = catalogStore.fabricantes.find(f => f.id === mot.fabricante_id)
    if (fab) {
      selectedBrand.value = fab
      brandInput.value = fab.nombre.toUpperCase()
    }
  }

  // Autoseleccionar modelo si estaba vacío
  if (!selectedModel.value && mot.modelo_id) {
    const mod = catalogStore.modelos.find(m => m.id === mot.modelo_id)
    if (mod) {
      selectedModel.value = mod
      modelInput.value = mod.nombre
    }
  }

  // Al seleccionar un motor: mostrar directamente los grupos y NO los demás motores
  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
  } else {
    activeViewTab.value = 'grupos'
  }
}

const handleClearSelectedMotor = async () => {
  selectedMotor.value = null
  motorInput.value = ''
  catalogStore.selectedMotorId = null
  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id)
  } else {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  }
}

// 4. Filtrado de TIPOS DE COMPONENTE (BASE + DINÁMICOS)
const filteredComponentGroups = computed(() => {
  const q = componentInput.value.toLowerCase().trim()
  const list = componentGroups.value
  if (!q || (selectedComponent.value && (
    q === selectedComponent.value.title.toLowerCase().trim() ||
    q === selectedComponent.value.shortTitle.toLowerCase().trim() ||
    q === selectedComponent.value.category.toLowerCase().trim()
  ))) {
    return list
  }
  return list.filter(g => 
    g.title.toLowerCase().includes(q) || 
    g.shortTitle.toLowerCase().includes(q) ||
    g.category.toLowerCase().includes(q) ||
    g.description.toLowerCase().includes(q)
  )
})

const handleFocusComponent = (e?: Event) => {
  isComponentOpen.value = true
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
  if (!catalogStore.grupos || catalogStore.grupos.length === 0) {
    catalogStore.fetchGrupos()
  }
}

const handleSelectComponent = async (comp: ComponentGroup) => {
  selectedComponent.value = comp
  componentInput.value = comp.title
  isComponentOpen.value = false
  activeViewTab.value = 'repuestos'

  // Si hay motor seleccionado, cargar repuestos del motor
  if (selectedMotor.value) {
    await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
  } else {
    // Al solo tener seleccionado el componente (con o sin marca seleccionada):
    // Cargar todos los repuestos de este grupo directamente desde Supabase!
    await catalogStore.fetchRepuestosByGrupo(comp.category, undefined, selectedBrand.value?.id)
  }
}

const handleClearSelectedComponent = async () => {
  componentInput.value = ''
  selectedComponent.value = null
  resetMeasurementsFilters()
  if (selectedMotor.value) {
    await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
    activeViewTab.value = 'repuestos'
  } else if (selectedBrand.value || brandInput.value) {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  } else {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  }
}

// Limpiar todo y restaurar estado
const handleResetAll = async () => {
  brandInput.value = ''
  modelInput.value = ''
  motorInput.value = ''
  componentInput.value = ''
  searchInput.value = ''
  selectedBrand.value = null
  selectedModel.value = null
  selectedMotor.value = null
  selectedComponent.value = null
  isBrandOpen.value = false
  isModelOpen.value = false
  isMotorOpen.value = false
  isComponentOpen.value = false
  activeViewTab.value = 'motores'
  tableSearchFilter.value = ''
  tableBrandFilter.value = 'Todas las marcas'
  motorCurrentPage.value = 1
  resetMeasurementsFilters()
  await catalogStore.resetFilters()
  showToast('Filtros y búsqueda restablecidos')
}

// =============================================================================
// BÚSQUEDA GLOBAL CON DEBOUNCE (CÓDIGO PIEZA, DESCRIPCIÓN Y EQUIVALENCIA)
// =============================================================================
const handleSearchInput = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    catalogStore.searchParts(searchInput.value)
    if (searchInput.value.trim().length > 0) {
      activeViewTab.value = 'repuestos'
    }
  }, 300)
}

const handleClearSearch = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchInput.value = ''
  if (selectedMotor.value) {
    catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
  } else {
    catalogStore.repuestos = []
  }
}

// =============================================================================
// TABLA DE MOTORES DE LA MARCA (ESTILO TECDOC / AJUSA)
// =============================================================================
const brandMotorsList = computed<Motor[]>(() => {
  return availableMotors.value
})

const motorCurrentPage = ref<number>(1)
const motorPageSize = 10
const motorTotalPages = computed(() => Math.ceil(brandMotorsList.value.length / motorPageSize) || 1)
const paginatedMotors = computed(() => {
  const start = (motorCurrentPage.value - 1) * motorPageSize
  return brandMotorsList.value.slice(start, start + motorPageSize)
})
const motorStartIndex = computed(() => (motorCurrentPage.value - 1) * motorPageSize)
const motorEndIndex = computed(() => Math.min(motorCurrentPage.value * motorPageSize, brandMotorsList.value.length))

const goToFirstMotorPage = () => { motorCurrentPage.value = 1 }
const goToPrevMotorPage = () => { if (motorCurrentPage.value > 1) motorCurrentPage.value-- }
const goToNextMotorPage = () => { if (motorCurrentPage.value < motorTotalPages.value) motorCurrentPage.value++ }
const goToLastMotorPage = () => { motorCurrentPage.value = motorTotalPages.value }

watch([selectedBrand, selectedModel], () => {
  motorCurrentPage.value = 1
})

const getBrandName = (fabId: string): string => {
  const fab = catalogStore.fabricantes.find(f => f.id === fabId)
  return fab?.nombre.toUpperCase() || 'TOYOTA'
}

// Modal informativo de motor
const selectedMotorInfoModal = ref<Motor | null>(null)
const openMotorInfo = (mot: Motor, e: MouseEvent) => {
  e.stopPropagation()
  selectedMotorInfoModal.value = mot
}
const closeMotorInfo = () => {
  selectedMotorInfoModal.value = null
}

// =============================================================================
// TABLA DE REPUESTOS Y FILTRADO POR MEDIDAS TÉCNICAS
// =============================================================================
const tableSearchFilter = ref<string>('')
const tableBrandFilter = ref<string>('Todas las marcas')

const displayedParts = computed<RepuestoTecnico[]>(() => {
  let list = catalogStore.repuestos

  // 1. Filtrar por tipo de componente si está seleccionado
  if (selectedComponent.value) {
    const compId = selectedComponent.value.id
    const cat = selectedComponent.value.category?.toLowerCase() || ''
    const title = selectedComponent.value.title?.toLowerCase() || ''

    if (compId === 'ajuste_valvula' || cat === 'sellos') {
      list = list.filter(r => r.categoria === 'Sellos' || r.subsistema === 'Sellos y Juntas' || r.nombre.toLowerCase().includes('sello'))
    } else if (compId === 'valvula' || cat.includes('válvul') || cat.includes('valvul')) {
      list = list.filter(r => r.categoria === 'Válvulas' || r.categoria === 'Valvulas' || r.nombre.toLowerCase().includes('válvula') || r.nombre.toLowerCase().includes('valvula'))
    } else if (compId === 'anillos_motor' || cat === 'anillos') {
      list = list.filter(r => r.categoria === 'Anillos' || r.nombre.toLowerCase().includes('anillos') || r.nombre.toLowerCase().includes('aros'))
    } else if (compId === 'tornillos_culata' || cat === 'pernos') {
      list = list.filter(r => r.categoria === 'Pernos' || r.nombre.toLowerCase().includes('tornillos') || r.nombre.toLowerCase().includes('perno'))
    } else if (compId === 'casqueteria' || cat.includes('casquet') || cat.includes('cojinet')) {
      list = list.filter(r => r.categoria === 'Casquetería' || r.categoria === 'Casqueteria' || r.nombre.toLowerCase().includes('casquete') || r.nombre.toLowerCase().includes('cojinete'))
    } else if (compId === 'empaques_juntas' || cat === 'empaques') {
      list = list.filter(r => r.categoria === 'Empaques' || r.nombre.toLowerCase().includes('empaque') || r.nombre.toLowerCase().includes('junta'))
    } else {
      // Grupos personalizados dinámicos (ej. Camisas, etc.)
      list = list.filter(r =>
        (r.categoria && r.categoria.toLowerCase() === cat) ||
        (r.categoria && r.categoria.toLowerCase().includes(cat)) ||
        (r.subsistema && r.subsistema.toLowerCase().includes(title)) ||
        (r.nombre && r.nombre.toLowerCase().includes(cat)) ||
        (r.nombre && r.nombre.toLowerCase().includes(title))
      )
    }

    // 1b. Si hay marca seleccionada (y ningún motor específico), filtrar repuestos por esa marca
    if (selectedBrand.value && !selectedMotor.value) {
      const brandName = selectedBrand.value.nombre.toLowerCase().trim()
      list = list.filter(r => {
        const fabName = r.motor?.fabricante?.nombre?.toLowerCase() || ''
        const fabId = r.motor?.fabricante_id || ''
        return !fabName || fabName.includes(brandName) || fabId === selectedBrand.value?.id
      })
    }

    // 2. Filtros de medidas dimensionales específicas (con Tolerancia Universal Configurable)
    const tol = filterToleranciaMm.value !== undefined && filterToleranciaMm.value !== null ? Number(filterToleranciaMm.value) : 1.0
    if (compId === 'ajuste_valvula') {
      if (filterSelloDiamInt.value !== undefined && filterSelloDiamInt.value !== null) {
        list = list.filter(r => r.diametro_interior_mm && Math.abs(r.diametro_interior_mm - (filterSelloDiamInt.value || 0)) <= tol)
      }
      if (filterSelloDiamExt.value !== undefined && filterSelloDiamExt.value !== null) {
        list = list.filter(r => r.diametro_exterior_mm && Math.abs(r.diametro_exterior_mm - (filterSelloDiamExt.value || 0)) <= tol)
      }
      if (filterSelloAltura.value !== undefined && filterSelloAltura.value !== null) {
        list = list.filter(r => r.altura_mm && Math.abs(r.altura_mm - (filterSelloAltura.value || 0)) <= tol)
      }
    } else if (compId === 'valvula') {
      if (filterValvulaHongo.value !== undefined && filterValvulaHongo.value !== null) {
        list = list.filter(r => r.diametro_cabeza_mm && Math.abs(r.diametro_cabeza_mm - (filterValvulaHongo.value || 0)) <= tol)
      }
      if (filterValvulaVastago.value !== undefined && filterValvulaVastago.value !== null) {
        list = list.filter(r => r.diametro_vastago_mm && Math.abs(r.diametro_vastago_mm - (filterValvulaVastago.value || 0)) <= tol)
      }
      if (filterValvulaAltura.value !== undefined && filterValvulaAltura.value !== null) {
        list = list.filter(r => r.longitud_total_mm && Math.abs(r.longitud_total_mm - (filterValvulaAltura.value || 0)) <= tol)
      }
    } else if (compId === 'anillos_motor') {
      if (filterAnilloDiametro.value !== undefined && filterAnilloDiametro.value !== null) {
        list = list.filter(r => r.diametro_cilindro_mm && Math.abs(r.diametro_cilindro_mm - (filterAnilloDiametro.value || 0)) <= tol)
      }
      if (filterAnilloGrosor1.value !== undefined && filterAnilloGrosor1.value !== null) {
        list = list.filter(r => r.espesor_anillo1_mm && Math.abs(r.espesor_anillo1_mm - (filterAnilloGrosor1.value || 0)) <= tol)
      }
      if (filterAnilloAlturaGrosor.value !== undefined && filterAnilloAlturaGrosor.value !== null) {
        const val = filterAnilloAlturaGrosor.value || 0
        list = list.filter(r => 
          (r.espesor_anillo2_mm && Math.abs(r.espesor_anillo2_mm - val) <= tol) ||
          (r.espesor_aceite_mm && Math.abs(r.espesor_aceite_mm - val) <= tol) ||
          (r.espesor_anillo1_mm && Math.abs(r.espesor_anillo1_mm - val) <= tol)
        )
      }
    } else if (compId === 'tornillos_culata') {
      if (filterPernoMedidaRosca.value) {
        list = list.filter(r => r.medida_rosca?.toLowerCase() === filterPernoMedidaRosca.value.toLowerCase())
      }
      if (filterPernoPasoRosca.value !== undefined && filterPernoPasoRosca.value !== null) {
        list = list.filter(r => r.paso_rosca_mm && Math.abs(r.paso_rosca_mm - (filterPernoPasoRosca.value || 0)) <= tol)
      }
      if (filterPernoLongitud.value !== undefined && filterPernoLongitud.value !== null) {
        list = list.filter(r => (r.longitud_perno_mm || r.longitud_total_mm) && Math.abs(((r.longitud_perno_mm || r.longitud_total_mm) || 0) - (filterPernoLongitud.value || 0)) <= tol)
      }
      if (filterPernoCantidad.value !== undefined && filterPernoCantidad.value !== null) {
        list = list.filter(r => r.cantidad_piezas === filterPernoCantidad.value)
      }
      if (filterPernoPasoRosca1.value !== undefined && filterPernoPasoRosca1.value !== null) {
        list = list.filter(r => r.paso_rosca1_mm && Math.abs(r.paso_rosca1_mm - (filterPernoPasoRosca1.value || 0)) <= tol)
      }
      if (filterPernoLongitud1.value !== undefined && filterPernoLongitud1.value !== null) {
        list = list.filter(r => r.longitud1_mm && Math.abs(r.longitud1_mm - (filterPernoLongitud1.value || 0)) <= tol)
      }
      if (filterPernoLongitud2.value !== undefined && filterPernoLongitud2.value !== null) {
        list = list.filter(r => r.longitud2_mm && Math.abs(r.longitud2_mm - (filterPernoLongitud2.value || 0)) <= tol)
      }
    }

    // 2.b. Filtros de parámetros dinámicos para grupos nuevos / personalizados
    if (Object.keys(dynamicParamFilters.value).length > 0) {
      for (const [key, filterVal] of Object.entries(dynamicParamFilters.value)) {
        if (filterVal !== undefined && filterVal !== null && filterVal !== '') {
          list = list.filter(r => {
            const partVal = r.dimensiones?.[key] ?? (r as any)[key]
            if (partVal === undefined || partVal === null) return false

            // Comparación numérica con tolerancia
            if (typeof filterVal === 'number' || (!isNaN(Number(filterVal)) && !isNaN(Number(partVal)))) {
              const numPart = Number(partVal)
              const numFilter = Number(filterVal)
              return Math.abs(numPart - numFilter) <= tol
            }

            // Comparación de texto / selección
            const strPart = String(partVal).toLowerCase().trim()
            const strFilter = String(filterVal).toLowerCase().trim()
            return strPart.includes(strFilter)
          })
        }
      }
    }
  }

  // 3. Búsqueda por texto local dentro de la tabla
  if (tableSearchFilter.value.trim()) {
    const q = tableSearchFilter.value.toLowerCase().trim()
    list = list.filter(r => 
      r.nombre.toLowerCase().includes(q) ||
      r.codigo_oem.toLowerCase().includes(q) ||
      r.equivalencias?.some(eq => eq.codigo_alterno.toLowerCase().includes(q) || eq.marca_alterna.toLowerCase().includes(q))
    )
  }

  // 4. Filtro de marca de catálogo alterno
  if (tableBrandFilter.value !== 'Todas las marcas') {
    const b = tableBrandFilter.value.toLowerCase()
    list = list.filter(r => 
      (r.catalogo_origen && r.catalogo_origen.toLowerCase() === b) ||
      r.equivalencias?.some(eq => eq.marca_alterna.toLowerCase() === b)
    )
  }

  return list
})

// Badges de marcas
const getBrandBadgeClass = (brand: string): string => {
  const b = brand.toLowerCase()
  if (b.includes('dokuro')) return 'bg-rose-50 text-rose-800 border-rose-200/90 font-bold'
  if (b.includes('rik')) return 'bg-indigo-50 text-indigo-800 border-indigo-200/90 font-bold'
  if (b.includes('npr')) return 'bg-blue-50 text-blue-800 border-blue-200/90 font-bold'
  if (b.includes('ndc')) return 'bg-emerald-50 text-emerald-800 border-emerald-200/90 font-bold'
  if (b.includes('taiho')) return 'bg-purple-50 text-purple-800 border-purple-200/90 font-bold'
  if (b.includes('ajusa')) return 'bg-[#0f2d59] text-white border-blue-950 font-bold'
  return 'bg-slate-100 text-slate-700 border-slate-200 font-bold'
}

// Modal de Ficha Técnica
const isTechnicalModalOpen = ref<boolean>(false)
const modalPart = ref<RepuestoTecnico | null>(null)

const openTechnicalSheet = (part: RepuestoTecnico) => {
  modalPart.value = part
  isTechnicalModalOpen.value = true
}

const closeTechnicalSheet = () => {
  isTechnicalModalOpen.value = false
  modalPart.value = null
}

// =============================================================================
// =============================================================================
// MODAL ADMINISTRATIVO DE CATÁLOGO (NUEVO REPUESTO / NUEVA FAMILIA DINÁMICA / EDITAR GRUPO)
// =============================================================================
const isAdminModalOpen = ref<boolean>(false)
const adminModalTab = ref<'repuesto' | 'grupo'>('repuesto')
const adminModalEditGroupId = ref<string | null>(null)

const openAdminCatalogModal = (tab: 'repuesto' | 'grupo' = 'repuesto', editGroupId?: string | null) => {
  adminModalTab.value = tab
  adminModalEditGroupId.value = editGroupId || null
  isAdminModalOpen.value = true
}

const handleEditGroup = (grpId: string) => {
  openAdminCatalogModal('grupo', grpId)
}

// Retrocompatibilidad con openAddPartModal
const openAddPartModal = () => {
  openAdminCatalogModal('repuesto')
}

const onPartCreated = (newPart: RepuestoTecnico) => {
  showToast(`✓ Repuesto ${newPart.codigo_oem} (${newPart.nombre}) registrado exitosamente`)
  activeViewTab.value = 'repuestos'
  openTechnicalSheet(newPart)
}

const onGroupCreated = (newGroup: GrupoRepuesto) => {
  showToast(`✓ Familia "${newGroup.nombre}" creada con ${newGroup.parametros.length} parámetros técnicos`)
  catalogStore.fetchGrupos()
}

const onGroupUpdated = (updatedGroup: GrupoRepuesto) => {
  showToast(`✓ Familia "${updatedGroup.nombre}" actualizada con ${updatedGroup.parametros.length} parámetros técnicos`)
  catalogStore.fetchGrupos()
}

// Cerrar dropdowns al hacer clic fuera
const handleDocumentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.combobox-brand')) isBrandOpen.value = false
  if (!target.closest('.combobox-model')) isModelOpen.value = false
  if (!target.closest('.combobox-motor')) isMotorOpen.value = false
  if (!target.closest('.combobox-component')) isComponentOpen.value = false
}

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)
  // Inicialización de datos reales desde Supabase
  await catalogStore.initCatalog()
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  if (toastTimer) clearTimeout(toastTimer)
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})
</script>

<template>
  <div class="space-y-4 pb-12 select-none">

    <!-- Toast Notification Flotante -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-3 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-3 opacity-0"
    >
      <div 
        v-if="toastMessage" 
        class="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700/60 flex items-center gap-2.5"
      >
        <CheckCircle2 class="w-4 h-4 text-[#04C4D9] shrink-0" />
        <span class="text-xs font-semibold">{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- HEADER SECTION (MINIMALISTA)                                              -->
    <!-- ========================================================================= -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>Catálogo de Taller</span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            En línea
          </span>
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          Consulta reactiva de motores, componentes y tolerancias dimensionales.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          @click="openAdminCatalogModal('repuesto')"
          class="px-3.5 py-2 rounded-xl bg-[#04C4D9] hover:bg-[#03a9bc] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
          title="Dar de alta repuesto en catálogo"
        >
          <Plus class="w-4 h-4" />
          <span>+ Repuesto / Grupo</span>
        </button>

        <button
          type="button"
          @click="openAdminCatalogModal('grupo')"
          class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
          title="Crear nueva familia paramétrica"
        >
          <FolderPlus class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>+ Familia</span>
        </button>

        <button
          type="button"
          @click="handleResetAll"
          class="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition flex items-center gap-1.5"
          title="Restaurar registros y filtros"
        >
          <RotateCcw class="w-3.5 h-3.5 text-slate-400" />
          <span>Restaurar</span>
        </button>
      </div>
    </div>

    <!-- Banner de Error si falla la conexión -->
    <div 
      v-if="catalogStore.error || catalogStore.repuestosError" 
      class="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3 text-rose-800 text-xs font-semibold"
    >
      <div class="flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 text-rose-600 shrink-0" />
        <span>{{ catalogStore.error || catalogStore.repuestosError }}</span>
      </div>
      <button 
        type="button"
        @click="catalogStore.initCatalog()"
        class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
      >
        <RefreshCw class="w-3 h-3" />
        <span>Reintentar</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- BARRA DE BÚSQUEDA UNIVERSAL CON DEBOUNCE                                   -->
    <!-- ========================================================================= -->
    <div class="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs">
      <div class="relative flex items-center">
        <Search class="w-4 h-4 text-slate-400 absolute left-3" />
        <input
          v-model="searchInput"
          @input="handleSearchInput"
          type="text"
          placeholder="Buscar por código OEM, cruce alterno o descripción..."
          class="w-full pl-9 pr-20 py-2 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] transition"
        />
        <div class="absolute right-2.5 flex items-center gap-1.5">
          <Loader2 v-if="catalogStore.isSearching" class="w-4 h-4 text-[#04C4D9] animate-spin" />
          <button
            v-if="searchInput"
            type="button"
            @click="handleClearSearch"
            class="p-1 text-slate-400 hover:text-slate-600 rounded"
            title="Limpiar búsqueda"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- BARRA SUPERIOR FIJA: FILTROS REACTIVOS EN CASCADA                         -->
    <!-- ========================================================================= -->
    <div class="sticky top-0 z-30 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs">
      <!-- Barra superior de control de cascada e inversión de orden -->
      <div class="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100">
        <div class="flex items-center gap-1.5 text-xs text-slate-600">
          <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
          <span class="font-bold text-slate-800">Cascada:</span>
          <span class="text-slate-500 font-medium text-[11px]">
            Fabricante → 
            <span class="text-[#038391] font-bold">{{ cascadeOrder === 'modelo_motor' ? 'Modelo → Motor' : 'Motor → Modelo' }}</span>
            → Componente
          </span>
        </div>

        <button
          type="button"
          @click="toggleCascadeOrder"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition active:scale-95"
          :title="cascadeOrder === 'modelo_motor' ? 'Invertir orden: Seleccionar Motor primero' : 'Invertir orden: Seleccionar Modelo primero'"
        >
          <ArrowRightLeft class="w-3 h-3 text-[#04C4D9]" />
          <span>{{ cascadeOrder === 'modelo_motor' ? 'Invertir (Motor 1°)' : 'Invertir (Modelo 1°)' }}</span>
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
        
        <!-- 1. CASCADA NIVEL 1: MARCA / FABRICANTE -->
        <div class="relative combobox-brand">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            1. Fabricante
          </label>

          <div class="relative flex items-center">
            <input
              v-model="brandInput"
              @focus="handleFocusBrand"
              @click="handleFocusBrand"
              @input="isBrandOpen = true"
              type="text"
              placeholder="Buscar fabricante..."
              class="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] min-h-[40px] transition"
            />
            <button
              v-if="brandInput"
              type="button"
              @click="handleClearSelectedBrand"
              class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
              title="Limpiar marca"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <ChevronDown
              @click="isBrandOpen = !isBrandOpen"
              class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
            />
          </div>

          <!-- Dropdown Marcas -->
          <div
            v-if="isBrandOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-50"
          >
            <div
              v-for="fab in filteredBrands"
              :key="fab.id"
              @click="handleSelectBrand(fab)"
              :class="[
                'px-3 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition',
                selectedBrand?.id === fab.id ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-800'
              ]"
            >
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="selectedBrand?.id === fab.id ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                <strong class="font-bold">{{ fab.nombre.toUpperCase() }}</strong>
                <span class="text-slate-400 text-[10px]">({{ fab.pais_origen || 'Japón' }})</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] text-slate-400 font-mono">{{ fab.engines_count || 'Varios' }} motores</span>
                <Check v-if="selectedBrand?.id === fab.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
              </div>
            </div>
            <div v-if="filteredBrands.length === 0" class="p-3 text-center text-xs text-slate-400">
              No hay marcas coincidentes
            </div>
          </div>
        </div>

        <!-- ORDEN A: MODELO PRIMERO, MOTOR SEGUNDO -->
        <template v-if="cascadeOrder === 'modelo_motor'">
          <!-- 2. MODELO DE VEHÍCULO (BLOQUEADO HASTA ELEGIR FABRICANTE) -->
          <div class="relative combobox-model">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                2. Modelo
              </label>
              <span v-if="!selectedBrand" class="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                <Lock class="w-2.5 h-2.5" /> Requiere Fabricante
              </span>
            </div>

            <div class="relative flex items-center">
              <input
                v-model="modelInput"
                :disabled="!selectedBrand"
                @focus="onFocusModel"
                @click="onFocusModel"
                @input="onInputModel"
                type="text"
                :placeholder="!selectedBrand ? 'Elija fabricante...' : 'Buscar modelo...'"
                :class="[
                  'w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-bold rounded-lg focus:outline-none min-h-[40px] transition',
                  !selectedBrand 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none' 
                    : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]'
                ]"
              />
              <div v-if="!selectedBrand" class="absolute right-3 text-slate-400">
                <Lock class="w-3.5 h-3.5" />
              </div>
              <template v-else>
                <button
                  v-if="modelInput"
                  type="button"
                  @click="handleClearSelectedModel"
                  class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
                  title="Limpiar modelo"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
                <ChevronDown
                  @click="isModelOpen = !isModelOpen"
                  class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
                />
              </template>
            </div>

            <!-- Dropdown Modelos -->
            <div
              v-if="isModelOpen && selectedBrand"
              class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-50"
            >
              <div
                v-for="mod in filteredModels"
                :key="mod.id"
                @click="handleSelectModel(mod)"
                :class="[
                  'px-3 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition',
                  selectedModel?.id === mod.id ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-800'
                ]"
              >
                <div class="flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full" :class="selectedModel?.id === mod.id ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                  <strong class="font-bold">{{ mod.nombre }}</strong>
                </div>
                <div class="flex items-center gap-1.5">
                  <span v-if="mod.anio_inicio" class="text-[10px] text-slate-400 font-mono">
                    {{ mod.anio_inicio }} - {{ mod.anio_fin || 'Act' }}
                  </span>
                  <Check v-if="selectedModel?.id === mod.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
                </div>
              </div>
              <div v-if="filteredModels.length === 0" class="p-3 text-center text-xs text-slate-400">
                No hay modelos para esta selección
              </div>
            </div>
          </div>

          <!-- 3. CÓDIGO DE MOTOR -->
          <div class="relative combobox-motor">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              3. Motor
            </label>

            <div class="relative flex items-center">
              <input
                v-model="motorInput"
                :disabled="!selectedBrand"
                @focus="onFocusMotor"
                @click="onFocusMotor"
                @input="onInputMotor"
                type="text"
                :placeholder="!selectedBrand ? 'Elija fabricante...' : (selectedModel ? `Motor para ${selectedModel.nombre}...` : 'Código de motor...')"
                :class="[
                  'w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-mono font-bold rounded-lg focus:outline-none min-h-[40px] transition',
                  !selectedBrand 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none' 
                    : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]'
                ]"
              />
              <div v-if="!selectedBrand" class="absolute right-3 text-slate-400">
                <Lock class="w-3.5 h-3.5" />
              </div>
              <template v-else>
                <button
                  v-if="motorInput"
                  type="button"
                  @click="handleClearSelectedMotor"
                  class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
                  title="Limpiar motor"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
                <ChevronDown
                  @click="isMotorOpen = !isMotorOpen"
                  class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
                />
              </template>
            </div>

            <!-- Dropdown Motores -->
            <div
              v-if="isMotorOpen && selectedBrand"
              class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-50"
            >
              <div
                v-for="mot in filteredMotors"
                :key="mot.id"
                @click="handleSelectMotor(mot)"
                :class="[
                  'px-3 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition',
                  selectedMotor?.id === mot.id ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-800'
                ]"
              >
                <div class="flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full" :class="selectedMotor?.id === mot.id ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                  <div>
                    <strong class="font-mono text-xs font-black">{{ mot.codigo }}</strong>
                    <span class="text-slate-600 ml-1.5 font-medium">{{ mot.nombre_comercial }}</span>
                    <span v-if="mot.denominacion_venta" class="text-slate-400 ml-1 text-[11px]">({{ mot.denominacion_venta }})</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {{ mot.cilindros }} Cil / {{ mot.cilindrada_texto || `${mot.cilindrada_cc} cc` }}
                  </span>
                  <Check v-if="selectedMotor?.id === mot.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
                </div>
              </div>
              <div v-if="filteredMotors.length === 0" class="p-3 text-center text-xs text-slate-400">
                No hay motores coincidentes
              </div>
            </div>
          </div>
        </template>

        <!-- ORDEN B: MOTOR PRIMERO, MODELO SEGUNDO -->
        <template v-else>
          <!-- 2. CÓDIGO DE MOTOR -->
          <div class="relative combobox-motor">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                2. Motor
              </label>
              <span v-if="!selectedBrand" class="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                <Lock class="w-2.5 h-2.5" /> Requiere Fabricante
              </span>
            </div>

            <div class="relative flex items-center">
              <input
                v-model="motorInput"
                :disabled="!selectedBrand"
                @focus="onFocusMotor"
                @click="onFocusMotor"
                @input="onInputMotor"
                type="text"
                :placeholder="!selectedBrand ? 'Elija fabricante...' : 'Código de motor...'"
                :class="[
                  'w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-mono font-bold rounded-lg focus:outline-none min-h-[40px] transition',
                  !selectedBrand 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none' 
                    : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]'
                ]"
              />
              <div v-if="!selectedBrand" class="absolute right-3 text-slate-400">
                <Lock class="w-3.5 h-3.5" />
              </div>
              <template v-else>
                <button
                  v-if="motorInput"
                  type="button"
                  @click="handleClearSelectedMotor"
                  class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
                  title="Limpiar motor"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
                <ChevronDown
                  @click="isMotorOpen = !isMotorOpen"
                  class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
                />
              </template>
            </div>

            <!-- Dropdown Motores -->
            <div
              v-if="isMotorOpen && selectedBrand"
              class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-50"
            >
              <div
                v-for="mot in filteredMotors"
                :key="mot.id"
                @click="handleSelectMotor(mot)"
                :class="[
                  'px-3 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition',
                  selectedMotor?.id === mot.id ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-800'
                ]"
              >
                <div class="flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full" :class="selectedMotor?.id === mot.id ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                  <div>
                    <strong class="font-mono text-xs font-black">{{ mot.codigo }}</strong>
                    <span class="text-slate-600 ml-1.5 font-medium">{{ mot.nombre_comercial }}</span>
                    <span v-if="mot.denominacion_venta" class="text-slate-400 ml-1 text-[11px]">({{ mot.denominacion_venta }})</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {{ mot.cilindros }} Cil / {{ mot.cilindrada_texto || `${mot.cilindrada_cc} cc` }}
                  </span>
                  <Check v-if="selectedMotor?.id === mot.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
                </div>
              </div>
              <div v-if="filteredMotors.length === 0" class="p-3 text-center text-xs text-slate-400">
                No hay motores coincidentes
              </div>
            </div>
          </div>

          <!-- 3. MODELO DE VEHÍCULO (FILTRADO POR MOTOR O FABRICANTE) -->
          <div class="relative combobox-model">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                3. Modelo
              </label>
              <span v-if="!selectedBrand" class="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                <Lock class="w-2.5 h-2.5" /> Requiere Fabricante
              </span>
            </div>

            <div class="relative flex items-center">
              <input
                v-model="modelInput"
                :disabled="!selectedBrand"
                @focus="onFocusModel"
                @click="onFocusModel"
                @input="onInputModel"
                type="text"
                :placeholder="!selectedBrand ? 'Elija fabricante...' : (selectedMotor ? `Modelos con ${selectedMotor.codigo}...` : 'Modelo compatible...')"
                :class="[
                  'w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-bold rounded-lg focus:outline-none min-h-[40px] transition',
                  !selectedBrand 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none' 
                    : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]'
                ]"
              />
              <div v-if="!selectedBrand" class="absolute right-3 text-slate-400">
                <Lock class="w-3.5 h-3.5" />
              </div>
              <template v-else>
                <button
                  v-if="modelInput"
                  type="button"
                  @click="handleClearSelectedModel"
                  class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
                  title="Limpiar modelo"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
                <ChevronDown
                  @click="isModelOpen = !isModelOpen"
                  class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
                />
              </template>
            </div>

            <!-- Dropdown Modelos -->
            <div
              v-if="isModelOpen && selectedBrand"
              class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-50"
            >
              <div
                v-for="mod in filteredModels"
                :key="mod.id"
                @click="handleSelectModel(mod)"
                :class="[
                  'px-3 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition',
                  selectedModel?.id === mod.id ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-800'
                ]"
              >
                <div class="flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full" :class="selectedModel?.id === mod.id ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                  <strong class="font-bold">{{ mod.nombre }}</strong>
                </div>
                <div class="flex items-center gap-1.5">
                  <span v-if="mod.anio_inicio" class="text-[10px] text-slate-400 font-mono">
                    {{ mod.anio_inicio }} - {{ mod.anio_fin || 'Act' }}
                  </span>
                  <Check v-if="selectedModel?.id === mod.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
                </div>
              </div>
              <div v-if="filteredModels.length === 0" class="p-3 text-center text-xs text-slate-400">
                No hay modelos para esta selección
              </div>
            </div>
          </div>
        </template>

        <!-- 4. CAMPO: TIPO DE COMPONENTE -->
        <div class="relative combobox-component">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            4. Componente
          </label>

          <div class="relative flex items-center">
            <input
              v-model="componentInput"
              @focus="handleFocusComponent"
              @click="handleFocusComponent"
              @input="isComponentOpen = true"
              type="text"
              placeholder="Buscar componente..."
              class="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] min-h-[40px] transition"
            />
            <button
              v-if="componentInput"
              type="button"
              @click="handleClearSelectedComponent"
              class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
              title="Limpiar componente"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <ChevronDown
              @click="isComponentOpen = !isComponentOpen"
              class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
            />
          </div>

          <!-- Dropdown Tipos de Componente -->
          <div
            v-if="isComponentOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-50"
          >
            <div
              v-for="grp in filteredComponentGroups"
              :key="grp.id"
              @click="handleSelectComponent(grp)"
              :class="[
                'px-3 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition',
                selectedComponent?.id === grp.id ? 'bg-cyan-50/60 text-[#038391] font-bold' : 'text-slate-800'
              ]"
            >
              <div class="flex items-center gap-2.5">
                <CircleDot v-if="grp.id === 'ajuste_valvula' || grp.category === 'Sellos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Wrench v-else-if="grp.id === 'valvula' || grp.category === 'Válvulas'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'anillos_motor' || grp.category === 'Anillos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <FileText v-else-if="grp.id === 'tornillos_culata' || grp.category === 'Pernos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <CircleDot v-else-if="grp.id === 'casqueteria' || grp.category === 'Casquetería'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'empaques_juntas' || grp.category === 'Empaques'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <div>
                  <div class="font-bold text-slate-900">{{ grp.title }}</div>
                  <div class="text-[10px] text-slate-400 font-normal truncate max-w-xs">{{ grp.sampleMeasurements }}</div>
                </div>
              </div>
              <Check v-if="selectedComponent?.id === grp.id" class="w-4 h-4 text-[#04C4D9] shrink-0 ml-2" />
            </div>
            <div v-if="filteredComponentGroups.length === 0" class="p-3 text-center text-xs text-slate-400">
              No hay componentes coincidentes
            </div>
          </div>
        </div>

      </div>

      <!-- Barra informativa activa de selección en cascada (Minimalista) -->
      <div v-if="selectedBrand || selectedModel || selectedMotor || selectedComponent" class="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Activos:</span>
          
          <span v-if="selectedBrand || brandInput" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-[#038391] border border-cyan-200/80 font-bold text-xs">
            <span>{{ selectedBrand?.nombre || brandInput }}</span>
          </span>

          <span v-if="selectedModel" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs">
            <span>{{ selectedModel.nombre }}</span>
            <button type="button" @click="handleClearSelectedModel" class="text-slate-400 hover:text-rose-500 ml-0.5">
              <X class="w-3 h-3" />
            </button>
          </span>

          <span v-if="selectedMotor" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-xs">
            <span>{{ selectedMotor.codigo }}</span>
            <button type="button" @click="handleClearSelectedMotor" class="text-slate-400 hover:text-rose-400 ml-0.5">
              <X class="w-3 h-3" />
            </button>
          </span>

          <span v-if="selectedComponent" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 font-bold text-xs">
            <span>{{ selectedComponent.title }}</span>
            <button type="button" @click="handleClearSelectedComponent" class="text-blue-400 hover:text-rose-500 ml-0.5">
              <X class="w-3 h-3" />
            </button>
          </span>
        </div>

        <!-- Pestañas para alternar entre lista de motores y repuestos -->
        <div v-if="selectedBrand && selectedComponent" class="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            type="button"
            @click="activeViewTab = 'motores'"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-bold transition',
              activeViewTab === 'motores' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Motores ({{ brandMotorsList.length }})
          </button>
          <button
            type="button"
            @click="activeViewTab = 'repuestos'"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-bold transition',
              activeViewTab === 'repuestos' ? 'bg-white text-[#04C4D9] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Repuestos ({{ displayedParts.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 1: PANTALLA INICIAL (MINIMALISTA)                                   -->
    <!-- ========================================================================= -->
    <div 
      v-if="!selectedBrand && !brandInput && !selectedMotor && !selectedComponent && !searchInput" 
      class="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 text-center max-w-lg mx-auto space-y-3.5 my-6"
    >
      <div class="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-200/80 text-[#04C4D9] flex items-center justify-center mx-auto shadow-2xs">
        <Sparkles class="w-6 h-6" />
      </div>
      <div>
        <h2 class="text-base font-extrabold text-slate-900">
          Búsqueda de Motores y Repuestos
        </h2>
        <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          Seleccione un fabricante o utilice la barra superior para buscar por código OEM y cotas métricas.
        </p>
      </div>

      <!-- Botones de acceso rápido a marcas principales -->
      <div class="pt-3 border-t border-slate-100">
        <div class="flex flex-wrap items-center justify-center gap-1.5">
          <button
            v-for="fab in catalogStore.fabricantes.slice(0, 8)"
            :key="fab.id"
            type="button"
            @click="handleSelectBrand(fab)"
            class="px-3 py-1 rounded-full border border-slate-200 hover:border-[#04C4D9] hover:bg-cyan-50/60 text-xs font-semibold text-slate-700 transition active:scale-95"
          >
            {{ fab.nombre }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 2: TABLA DE MOTORES (MINIMALISTA, LIMPIA Y RÁPIDA)                 -->
    <!-- ========================================================================= -->
    <div 
      v-else-if="(selectedBrand || brandInput) && (!selectedMotor || activeViewTab === 'motores') && !searchInput && (!selectedComponent || activeViewTab === 'motores')"
      class="space-y-3.5"
    >
      <!-- Encabezado de la tabla de motores -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
          <h3 class="text-xs sm:text-sm font-bold text-slate-900">
            Motores disponibles: <span class="text-[#038391] uppercase font-extrabold">{{ selectedBrand?.nombre || brandInput }}</span>
            <span v-if="selectedModel" class="text-slate-600 font-medium ml-1">({{ selectedModel.nombre }})</span>
          </h3>
          <span class="text-xs font-mono text-slate-400">({{ brandMotorsList.length }})</span>
        </div>

        <div class="text-[11px] text-slate-400 font-medium">
          Haga clic en una fila para consultar repuestos y cotas
        </div>
      </div>

      <!-- TABLA TÉCNICA DE MOTORES -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
        <!-- Barra de Estado / Paginación Resumen -->
        <div class="bg-slate-900 text-white py-1.5 px-3.5 flex items-center justify-between text-xs font-medium">
          <span class="text-slate-300 font-mono text-[11px]">
            Mostrando {{ motorStartIndex + 1 }}-{{ motorEndIndex }} de {{ brandMotorsList.length }} motores
          </span>
          <span class="text-[11px] text-slate-400 font-sans">Página {{ motorCurrentPage }} / {{ motorTotalPages }}</span>
        </div>

        <!-- Contenedor con scroll interno -->
        <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="sticky top-0 z-10 bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th class="py-2 px-2.5 w-9 text-center border-r border-slate-200/80"></th>
                <th class="py-2 px-3 w-28 border-r border-slate-200/80">ID / Ref</th>
                <th class="py-2 px-3.5 w-48 border-r border-slate-200/80">Código Motor</th>
                <th class="py-2 px-3.5 w-40 border-r border-slate-200/80">Denominación</th>
                <th class="py-2 px-2.5 w-20 text-center border-r border-slate-200/80">Cil</th>
                <th class="py-2 px-3.5 w-36 border-r border-slate-200/80">Cilindrada</th>
                <th class="py-2 px-2.5 w-16 text-center border-r border-slate-200/80">kW</th>
                <th class="py-2 px-2.5 w-16 text-center">CV</th>
              </tr>
            </thead>

            <!-- Skeleton loading de motores -->
            <tbody v-if="catalogStore.loadingMotores" class="divide-y divide-slate-100">
              <tr v-for="n in 5" :key="`skel-mot-${n}`" class="animate-pulse bg-slate-50/50">
                <td class="py-2.5 px-2.5 text-center"><div class="w-3.5 h-3.5 bg-slate-200 rounded-full mx-auto"></div></td>
                <td class="py-2.5 px-3"><div class="h-3 w-16 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-3.5"><div class="h-3 w-28 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-3.5"><div class="h-3 w-20 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-2.5 text-center"><div class="h-3 w-6 bg-slate-200 rounded mx-auto"></div></td>
                <td class="py-2.5 px-3.5"><div class="h-3 w-20 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-2.5 text-center"><div class="h-3 w-6 bg-slate-200 rounded mx-auto"></div></td>
                <td class="py-2.5 px-2.5 text-center"><div class="h-3 w-6 bg-slate-200 rounded mx-auto"></div></td>
              </tr>
            </tbody>

            <tbody v-else class="divide-y divide-slate-100">
              <tr
                v-for="mot in paginatedMotors"
                :key="mot.id"
                @click="handleSelectMotor(mot)"
                :class="[
                  'transition cursor-pointer group',
                  selectedMotor?.id === mot.id 
                    ? 'bg-cyan-50/80 font-bold' 
                    : 'hover:bg-slate-50 text-slate-700'
                ]"
              >
                <!-- 1. Icono de Información (i) -->
                <td class="py-2 px-2.5 text-center align-middle border-r border-slate-100">
                  <button
                    type="button"
                    @click="openMotorInfo(mot, $event)"
                    class="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 inline-flex items-center justify-center transition"
                    title="Ver ficha técnica del motor"
                  >
                    <Info class="w-3.5 h-3.5" />
                  </button>
                </td>

                <!-- 2. Número / ID -->
                <td class="py-2 px-3 font-mono text-slate-500 text-[11px] align-middle border-r border-slate-100">
                  {{ mot.numero_id || '—' }}
                </td>

                <!-- 3. Código de Motor -->
                <td class="py-2 px-3.5 font-semibold text-slate-800 align-middle border-r border-slate-100">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-slate-900 group-hover:text-[#038391] transition">
                      {{ getBrandName(mot.fabricante_id) }} - {{ mot.codigo }}
                    </span>
                    <span 
                      v-if="selectedMotor?.id === mot.id"
                      class="text-[9px] px-1.5 py-0.2 rounded bg-[#04C4D9] text-white font-bold"
                    >
                      Activo
                    </span>
                  </div>
                </td>

                <!-- 4. Denominación de Venta -->
                <td class="py-2 px-3.5 text-slate-600 align-middle border-r border-slate-100">
                  {{ mot.denominacion_venta || '—' }}
                </td>

                <!-- 5. Cilindros -->
                <td class="py-2 px-2.5 text-center font-mono text-slate-800 align-middle border-r border-slate-100">
                  {{ mot.cilindros }}
                </td>

                <!-- 6. Cilindrada -->
                <td class="py-2 px-3.5 font-mono text-slate-800 align-middle border-r border-slate-100">
                  {{ mot.cilindrada_texto || `${mot.cilindrada_cc} cc` }}
                </td>

                <!-- 7. kW -->
                <td class="py-2 px-2.5 text-center font-mono text-slate-700 align-middle border-r border-slate-100">
                  {{ mot.kw || '—' }}
                </td>

                <!-- 8. CV -->
                <td class="py-2 px-2.5 text-center font-mono text-slate-700 align-middle">
                  {{ mot.cv || '—' }}
                </td>
              </tr>

              <tr v-if="paginatedMotors.length === 0">
                <td colspan="8" class="py-8 text-center text-slate-400 bg-white">
                  No hay motores que coincidan con la búsqueda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pie de Tabla con Paginación -->
        <div class="bg-slate-50 py-2 px-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span class="text-[11px] text-slate-500">Página {{ motorCurrentPage }} de {{ motorTotalPages }}</span>
          
          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="goToFirstMotorPage"
              :disabled="motorCurrentPage === 1"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Primera página"
            >
              <ChevronsLeft class="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              @click="goToPrevMotorPage"
              :disabled="motorCurrentPage === 1"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Página anterior"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
            </button>

            <span class="px-2 font-mono font-bold text-slate-700 text-xs">
              {{ motorCurrentPage }}
            </span>

            <button
              type="button"
              @click="goToNextMotorPage"
              :disabled="motorCurrentPage === motorTotalPages"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Página siguiente"
            >
              <ChevronRight class="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              @click="goToLastMotorPage"
              :disabled="motorCurrentPage === motorTotalPages"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Última página"
            >
              <ChevronsRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      <!-- Tarjetas de acceso directo a tipos de componente -->
      <div class="pt-1">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            O elija un componente directamente:
          </span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <div
            v-for="grp in componentGroups"
            :key="grp.id"
            @click="handleSelectComponent(grp)"
            class="bg-white p-3 rounded-xl border border-slate-200 hover:border-[#04C4D9] hover:shadow-2xs cursor-pointer transition flex flex-col justify-between group"
          >
            <div>
              <div class="flex items-center gap-1.5 text-slate-900 group-hover:text-[#038391] font-bold text-xs">
                <CircleDot v-if="grp.id === 'ajuste_valvula' || grp.category === 'Sellos'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <Wrench v-else-if="grp.id === 'valvula' || grp.category === 'Válvulas'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'anillos_motor' || grp.category === 'Anillos'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <FileText v-else-if="grp.id === 'tornillos_culata' || grp.category === 'Pernos'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <CircleDot v-else-if="grp.id === 'casqueteria' || grp.category === 'Casquetería'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'empaques_juntas' || grp.category === 'Empaques'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <Layers v-else class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <span class="truncate">{{ grp.title }}</span>
              </div>
              <p class="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                {{ grp.sampleMeasurements }}
              </p>
            </div>
            <div class="mt-2 pt-1 border-t border-slate-50 text-[10px] font-bold text-[#04C4D9] flex items-center justify-between">
              <span>Ver piezas</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 2.B: MOTOR SELECCIONADO -> VISTA DE GRUPOS DIRECTA                 -->
    <!-- ========================================================================= -->
    <div 
      v-else-if="selectedMotor && (activeViewTab === 'grupos' || !selectedComponent) && !searchInput" 
      class="space-y-3.5"
    >
      <!-- Banner del Motor Seleccionado (Minimalista) -->
      <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-mono font-black text-sm shrink-0">
            {{ selectedMotor.codigo.slice(0, 3) }}
          </div>
          <div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <h3 class="text-sm font-black text-slate-900 font-mono">
                MOTOR {{ selectedMotor.codigo }}
              </h3>
              <span class="px-2 py-0.2 rounded-md bg-cyan-50 text-[#038391] border border-cyan-200/80 text-[10px] font-bold uppercase">
                {{ selectedMotor.combustible }}
              </span>
              <span class="px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold font-mono">
                {{ selectedMotor.cilindros }} Cil / {{ selectedMotor.cilindrada_texto || `${selectedMotor.cilindrada_cc} cc` }}
              </span>
              <span v-if="selectedMotor.cv" class="px-2 py-0.2 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold">
                {{ selectedMotor.cv }} CV
              </span>
            </div>
            <p class="text-[11px] text-slate-500 font-medium mt-0.5">
              {{ selectedMotor.nombre_comercial }} 
              <span v-if="selectedMotor.denominacion_venta"> • {{ selectedMotor.denominacion_venta }}</span>
              <span v-if="selectedBrand"> • <strong class="text-slate-700">{{ selectedBrand.nombre }}</strong></span>
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="activeViewTab = 'motores'"
          class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto"
          title="Ver otros motores del fabricante"
        >
          <ArrowLeft class="w-3.5 h-3.5 text-slate-400" />
          <span>Ver otros motores</span>
        </button>
      </div>

      <!-- Cuadro de modelos compatibles -->
      <div v-if="compatibleModelsForMotor.length > 0" class="bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-1.5 text-slate-600">
          <Car class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span class="font-bold text-[11px]">Modelos con este motor:</span>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <button
            v-for="mod in compatibleModelsForMotor"
            :key="mod.id"
            type="button"
            @click="handleSelectModel(mod)"
            :class="[
              'px-2 py-0.5 rounded text-[11px] font-semibold transition',
              selectedModel?.id === mod.id
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            ]"
          >
            {{ mod.nombre }} <span v-if="mod.anio_inicio" class="text-[9px] opacity-75">({{ mod.anio_inicio }}-{{ mod.anio_fin || 'Act' }})</span>
          </button>
        </div>
      </div>

      <!-- Tarjetas de Grupos / Familias del Motor -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-[#04C4D9]"></span>
            <span>Familias de Piezas para Motor {{ selectedMotor.codigo }}</span>
          </h4>

          <button
            type="button"
            @click="openAdminCatalogModal('grupo')"
            class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
          >
            <Plus class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span>Crear / Modificar Grupo</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          <div
            v-for="grp in componentGroups"
            :key="grp.id"
            @click="handleSelectComponent(grp)"
            class="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-[#04C4D9] hover:shadow-2xs cursor-pointer transition flex flex-col justify-between group relative"
          >
            <div>
              <div class="flex items-start justify-between gap-1.5 mb-1.5">
                <div class="flex items-center gap-2 text-slate-900 group-hover:text-[#038391] font-bold text-xs sm:text-sm">
                  <CircleDot v-if="grp.id === 'ajuste_valvula'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                  <Wrench v-else-if="grp.id === 'valvula'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                  <Layers v-else-if="grp.id === 'anillos_motor'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                  <FileText v-else class="w-4 h-4 text-[#04C4D9] shrink-0" />
                  <span>{{ grp.title }}</span>
                </div>

                <button
                  type="button"
                  @click.stop="handleEditGroup(grp.id)"
                  class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="Modificar parámetros del grupo"
                >
                  <Edit3 class="w-3.5 h-3.5" />
                </button>
              </div>

              <p class="text-[11px] text-slate-400 leading-relaxed mb-2">
                {{ grp.sampleMeasurements || grp.description }}
              </p>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-[#04C4D9]">
              <span>Ver cotas y piezas</span>
              <span class="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 3: MOTOR Y/O COMPONENTE / BÚSQUEDA ACTIVA -> TABLA DE REPUESTOS     -->
    <!-- ========================================================================= -->
    <div v-else class="space-y-3.5">
      
      <!-- Selector Rápido de Componentes (Pills Superiores) -->
      <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Grupo:</span>
          <div class="flex flex-wrap items-center gap-1">
            <button
              v-for="grp in componentGroups"
              :key="grp.id"
              type="button"
              @click="handleSelectComponent(grp)"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5',
                selectedComponent?.id === grp.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              ]"
            >
              <CircleDot v-if="grp.id === 'ajuste_valvula' || grp.category === 'Sellos'" class="w-3 h-3 text-[#04C4D9]" />
              <Wrench v-else-if="grp.id === 'valvula' || grp.category === 'Válvulas'" class="w-3 h-3 text-[#04C4D9]" />
              <Layers v-else-if="grp.id === 'anillos_motor' || grp.category === 'Anillos'" class="w-3 h-3 text-[#04C4D9]" />
              <FileText v-else-if="grp.id === 'tornillos_culata' || grp.category === 'Pernos'" class="w-3 h-3 text-[#04C4D9]" />
              <CircleDot v-else-if="grp.id === 'casqueteria' || grp.category === 'Casquetería'" class="w-3 h-3 text-[#04C4D9]" />
              <Layers v-else-if="grp.id === 'empaques_juntas' || grp.category === 'Empaques'" class="w-3 h-3 text-[#04C4D9]" />
              <Layers v-else class="w-3 h-3 text-[#04C4D9]" />
              <span>{{ grp.title }}</span>
            </button>
          </div>
        </div>

        <!-- Botones para volver -->
        <div class="flex items-center gap-1.5">
          <button
            v-if="selectedMotor"
            type="button"
            @click="activeViewTab = 'grupos'; selectedComponent = null"
            class="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1"
          >
            <ArrowLeft class="w-3 h-3 text-slate-400" />
            <span>Grupos {{ selectedMotor.codigo }}</span>
          </button>

          <button
            v-if="selectedBrand"
            type="button"
            @click="activeViewTab = 'motores'"
            class="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1"
          >
            <ArrowLeft class="w-3 h-3 text-slate-400" />
            <span>Motores {{ selectedBrand.nombre }}</span>
          </button>
        </div>
      </div>

      <!-- ======================================================================= -->
      <!-- BARRA DE FILTROS DE MEDIDAS TÉCNICAS (MINIMALISTA)                      -->
      <!-- ======================================================================= -->
      <div v-if="selectedComponent" class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <SlidersHorizontal class="w-3.5 h-3.5 text-[#04C4D9]" />
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-800">
              Filtros: {{ selectedComponent.title }}
            </h4>
            <span v-if="activeMeasurementsCount > 0" class="text-[10px] font-bold px-2 py-0.2 rounded-full bg-cyan-100 text-[#038391]">
              {{ activeMeasurementsCount }} aplicado(s)
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handleEditGroup(selectedComponent.id)"
              class="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
              title="Modificar parámetros del grupo"
            >
              <Edit3 class="w-3 h-3 text-slate-500" />
              <span>Modificar Grupo</span>
            </button>

            <button
              v-if="activeMeasurementsCount > 0"
              type="button"
              @click="resetMeasurementsFilters"
              class="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 ml-1"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        <!-- CONTROL DE TOLERANCIA UNIVERSAL (± mm) -->
        <div class="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <Ruler class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span class="text-xs font-bold text-slate-700">Tolerancia:</span>
          </div>

          <div class="flex items-center gap-1 flex-wrap">
            <button
              v-for="tolOption in [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]"
              :key="tolOption"
              type="button"
              @click="filterToleranciaMm = tolOption"
              :class="[
                'px-2 py-0.5 rounded text-[11px] font-mono font-bold transition',
                filterToleranciaMm === tolOption
                  ? 'bg-[#04C4D9] text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              ]"
            >
              ±{{ tolOption }} mm
            </button>

            <div class="flex items-center gap-1 ml-1 pl-2 border-l border-slate-300">
              <span class="text-xs text-slate-400 font-bold">±</span>
              <input
                v-model.number="filterToleranciaMm"
                type="number"
                step="0.1"
                min="0"
                max="100"
                class="w-14 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-center focus:outline-none focus:border-[#04C4D9]"
                title="Tolerancia en mm"
              />
              <span class="text-xs text-slate-500 font-bold">mm</span>
            </div>
          </div>
        </div>

        <!-- 1. FILTROS PARA: AJUSTE DE VÁLVULA -->
        <div v-if="selectedComponent.id === 'ajuste_valvula'" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Diám. interior (mm)
            </label>
            <input
              v-model.number="filterSelloDiamInt"
              type="number"
              step="0.1"
              placeholder="ej. 4.8"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Diám. exterior (mm)
            </label>
            <input
              v-model.number="filterSelloDiamExt"
              type="number"
              step="0.1"
              placeholder="ej. 10.8"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Altura (mm)
            </label>
            <input
              v-model.number="filterSelloAltura"
              type="number"
              step="0.1"
              placeholder="ej. 10.0"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>
        </div>

        <!-- 2. FILTROS PARA: VÁLVULA -->
        <div v-else-if="selectedComponent.id === 'valvula'" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Hongo (Ø cabeza mm)
            </label>
            <input
              v-model.number="filterValvulaHongo"
              type="number"
              step="0.1"
              placeholder="ej. 42.5"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Vástago (Ø vástago mm)
            </label>
            <input
              v-model.number="filterValvulaVastago"
              type="number"
              step="0.05"
              placeholder="ej. 8.0"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Altura (Longitud mm)
            </label>
            <input
              v-model.number="filterValvulaAltura"
              type="number"
              step="0.5"
              placeholder="ej. 103.5"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>
        </div>

        <!-- 3. FILTROS PARA: ANILLOS DE MOTOR -->
        <div v-else-if="selectedComponent.id === 'anillos_motor'" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Diámetro (Ø Cilindro mm)
            </label>
            <input
              v-model.number="filterAnilloDiametro"
              type="number"
              step="0.5"
              placeholder="ej. 96.0"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Grosor 1° Anillo (mm)
            </label>
            <input
              v-model.number="filterAnilloGrosor1"
              type="number"
              step="0.1"
              placeholder="ej. 2.0"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
              Altura grosor (mm)
            </label>
            <input
              v-model.number="filterAnilloAlturaGrosor"
              type="number"
              step="0.1"
              placeholder="ej. 2.0 ó 4.0"
              class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>
        </div>

        <!-- 4. FILTROS PARA: JUEGO DE TORNILLOS DE CULATA -->
        <div v-else-if="selectedComponent.id === 'tornillos_culata'" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Rosca</label>
            <select
              v-model="filterPernoMedidaRosca"
              class="w-full px-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="">Todas</option>
              <option value="M10">M10</option>
              <option value="M11">M11</option>
              <option value="M12">M12</option>
              <option value="M14">M14</option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Paso (mm)</label>
            <input
              v-model.number="filterPernoPasoRosca"
              type="number"
              step="0.25"
              placeholder="ej. 1.25"
              class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Long. (mm)</label>
            <input
              v-model.number="filterPernoLongitud"
              type="number"
              step="1"
              placeholder="ej. 120"
              class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Cantidad</label>
            <input
              v-model.number="filterPernoCantidad"
              type="number"
              step="1"
              placeholder="ej. 18"
              class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <!-- 5. FILTROS PARA: CAMISAS DE CILINDRO -->
        <div 
          v-else-if="selectedComponent.id === 'camisas_cilindro' || selectedComponent.category === 'Camisas'"
          class="space-y-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/80"
        >
          <!-- Fila principal: Cotas maestras de maquinado (ØA Int, ØB Ext, C Largo) -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                  Ø Int (A) Bore
                </label>
                <span class="text-[9px] text-[#038391] font-mono font-bold">±{{ filterToleranciaMm }}mm</span>
              </div>
              <input
                v-model.number="dynamicParamFilters['diametro_interior_mm']"
                type="number"
                step="0.5"
                placeholder="ej. 88.0 mm"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                  Ø Ext (B) Encastre
                </label>
                <span class="text-[9px] text-[#038391] font-mono font-bold">±{{ filterToleranciaMm }}mm</span>
              </div>
              <input
                v-model.number="dynamicParamFilters['diametro_exterior_mm']"
                type="number"
                step="0.5"
                placeholder="ej. 93.0 mm"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold text-slate-700 uppercase tracking-tight">
                  Largo (C) Altura
                </label>
                <span class="text-[9px] text-[#038391] font-mono font-bold">±{{ filterToleranciaMm }}mm</span>
              </div>
              <input
                v-model.number="dynamicParamFilters['longitud_total_mm']"
                type="number"
                step="1"
                placeholder="ej. 182.0 mm"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
          </div>

          <!-- Fila secundaria: Pestaña, Acabado y Tipo -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/60">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Ø Pestaña (D)</label>
              <input
                v-model.number="dynamicParamFilters['diametro_pestana_mm']"
                type="number"
                step="0.5"
                placeholder="ej. 97.0"
                class="w-full px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#04C4D9]"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Esp. Pestaña (E)</label>
              <input
                v-model.number="dynamicParamFilters['espesor_pestana_mm']"
                type="number"
                step="0.1"
                placeholder="ej. 7.0"
                class="w-full px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#04C4D9]"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Acabado</label>
              <select
                v-model="dynamicParamFilters['acabado']"
                class="w-full px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#04C4D9]"
              >
                <option value="">Todos</option>
                <option value="F">Terminada (F)</option>
                <option value="S">Semiterminada (S)</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Tipo</label>
              <input
                v-model="dynamicParamFilters['tipo']"
                type="text"
                placeholder="ej. D03"
                class="w-full px-2 py-1 text-xs font-bold bg-white border border-slate-200 rounded-md focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
          </div>
        </div>

        <!-- 6. FILTROS PARA OTROS GRUPOS PERSONALIZADOS / DINÁMICOS -->
        <div 
          v-else-if="currentGroupDefinition?.parametros && currentGroupDefinition.parametros.length > 0"
          class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"
        >
          <div 
            v-for="param in currentGroupDefinition.parametros" 
            :key="param.clave"
          >
            <label class="block text-[10px] font-bold text-slate-600 mb-0.5 truncate">
              {{ param.etiqueta }} 
              <span v-if="param.unidad" class="text-slate-400 font-normal">({{ param.unidad }})</span>
              <span v-if="param.tipo_dato === 'numero'" class="text-[9px] text-[#038391] font-mono ml-0.5">±{{ filterToleranciaMm }}</span>
            </label>
            <input
              v-if="param.tipo_dato === 'numero'"
              v-model.number="dynamicParamFilters[param.clave]"
              type="number"
              step="0.1"
              :placeholder="`ej. 50 ${param.unidad || ''}`"
              class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
            <input
              v-else
              v-model="dynamicParamFilters[param.clave]"
              type="text"
              placeholder="Filtrar..."
              class="w-full px-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
            />
          </div>
        </div>

        <!-- Buscador de texto y filtro por catálogo -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div class="relative w-full sm:w-72">
            <input
              v-model="tableSearchFilter"
              type="text"
              placeholder="Filtrar en esta tabla..."
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
            />
            <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span class="text-xs text-slate-500 font-medium">Catálogo:</span>
            <select
              v-model="tableBrandFilter"
              class="px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
            >
              <option value="Todas las marcas">Todas las marcas</option>
              <option value="Dokuro">Dokuro</option>
              <option value="Rik">Rik</option>
              <option value="NPR">NPR</option>
              <option value="NDC">NDC</option>
              <option value="Taiho">Taiho</option>
              <option value="Ajusa">Ajusa</option>
            </select>
          </div>
        </div>

      </div>

      <!-- TABLA TÉCNICA DE REPUESTOS EN FORMATO MATRIZ (MINIMALISTA) -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
        <div class="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between text-xs font-bold">
          <span class="flex items-center gap-1.5">
            <span>{{ selectedComponent?.title || 'Piezas Técnicas' }}</span>
            <span class="font-normal text-slate-400 font-mono text-[11px]">({{ displayedParts.length }} registros)</span>
          </span>
          <span v-if="selectedMotor" class="font-mono text-[#04C4D9] text-[11px]">
            MOTOR {{ selectedMotor.codigo }}
          </span>
          <span v-else-if="selectedBrand" class="font-mono text-[#04C4D9] uppercase text-[11px]">
            {{ selectedBrand.nombre }}
          </span>
          <span v-else class="font-mono text-slate-400 text-[11px]">
            TODOS LOS MOTORES
          </span>
        </div>

        <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="sticky top-0 z-10 bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th class="py-2.5 px-3 w-52">Componente</th>
                <th class="py-2.5 px-3 w-32">Código OEM</th>
                <th class="py-2.5 px-3 w-48">Catálogos Alternos</th>
                
                <th v-if="selectedComponent?.id === 'ajuste_valvula' || selectedComponent?.category === 'Sellos'" class="py-2.5 px-3">
                  Medidas: Diám. Int / Diám. Ext / Altura (mm)
                </th>
                <th v-else-if="selectedComponent?.id === 'valvula' || selectedComponent?.category === 'Válvulas'" class="py-2.5 px-3">
                  Medidas: Hongo / Vástago / Altura (mm)
                </th>
                <th v-else-if="selectedComponent?.id === 'anillos_motor' || selectedComponent?.category === 'Anillos'" class="py-2.5 px-3">
                  Medidas: Diámetro / 1er Anillo / 2do Anillo / Aceite
                </th>
                <th v-else-if="selectedComponent?.id === 'camisas_cilindro' || selectedComponent?.category === 'Camisas'" class="py-2.5 px-3">
                  Cotas: ØA (Int) × ØB (Ext) × C (Largo) • Pestaña (D × E)
                </th>
                <th v-else-if="selectedComponent?.id === 'tornillos_culata' || selectedComponent?.category === 'Pernos'" class="py-2.5 px-3">
                  Tornillos: Rosca / Paso / Longitud / Cantidad
                </th>
                <th v-else-if="selectedComponent?.id === 'casqueteria' || selectedComponent?.category === 'Casquetería'" class="py-2.5 px-3">
                  Cojinetes: Muñón / Alojamiento / Ancho / Tipo
                </th>
                <th v-else-if="selectedComponent?.id === 'empaques_juntas' || selectedComponent?.category === 'Empaques'" class="py-2.5 px-3">
                  Empaques: Diámetro / Espesor / Material
                </th>
                <th v-else-if="currentGroupDefinition?.parametros && currentGroupDefinition.parametros.length > 0" class="py-2.5 px-3">
                  Parámetros: {{ currentGroupDefinition.parametros.map(p => p.etiqueta).slice(0, 3).join(' / ') }}<span v-if="currentGroupDefinition.parametros.length > 3">...</span>
                </th>
                <th v-else class="py-2.5 px-3">
                  Especificaciones Técnicas (mm)
                </th>

                <th class="py-2.5 px-3 w-28 text-right">Acciones</th>
              </tr>
            </thead>

            <!-- Skeleton loading de repuestos -->
            <tbody v-if="catalogStore.loadingRepuestos || catalogStore.isSearching" class="divide-y divide-slate-100">
              <tr v-for="n in 5" :key="`skel-rep-${n}`" class="animate-pulse bg-slate-50/50">
                <td class="py-3 px-3"><div class="h-3.5 w-28 bg-slate-200 rounded"></div></td>
                <td class="py-3 px-3"><div class="h-3.5 w-20 bg-slate-200 rounded"></div></td>
                <td class="py-3 px-3"><div class="h-3.5 w-24 bg-slate-200 rounded"></div></td>
                <td class="py-3 px-3"><div class="h-3.5 w-36 bg-slate-200 rounded"></div></td>
                <td class="py-3 px-3 text-right"><div class="h-3.5 w-14 bg-slate-200 rounded ml-auto"></div></td>
              </tr>
            </tbody>

            <tbody v-else class="divide-y divide-slate-100">
              <tr
                v-for="part in displayedParts"
                :key="part.id"
                class="hover:bg-slate-50 transition group"
              >
                <!-- 1. Componente -->
                <td class="py-2.5 px-3 align-middle">
                  <div class="flex items-center gap-2">
                    <span class="p-1 bg-slate-100 text-slate-700 rounded group-hover:bg-[#04C4D9] group-hover:text-white transition">
                      <CircleDot v-if="selectedComponent?.id === 'ajuste_valvula' || part.categoria === 'Sellos'" class="w-3.5 h-3.5" />
                      <Wrench v-else-if="selectedComponent?.id === 'valvula' || part.categoria === 'Válvulas'" class="w-3.5 h-3.5" />
                      <Layers v-else-if="selectedComponent?.id === 'anillos_motor' || part.categoria === 'Anillos'" class="w-3.5 h-3.5" />
                      <FileText v-else-if="selectedComponent?.id === 'tornillos_culata' || part.categoria === 'Pernos'" class="w-3.5 h-3.5" />
                      <CircleDot v-else-if="selectedComponent?.id === 'casqueteria' || part.categoria === 'Casquetería'" class="w-3.5 h-3.5" />
                      <Layers v-else-if="selectedComponent?.id === 'empaques_juntas' || part.categoria === 'Empaques'" class="w-3.5 h-3.5" />
                      <Layers v-else class="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <div class="font-bold text-slate-900 text-xs leading-tight">
                        {{ part.nombre }}
                      </div>
                      <span class="text-[10px] font-semibold text-slate-400 uppercase">
                        {{ part.subsistema }} • {{ part.motor?.codigo ? `Motor ${part.motor.codigo}` : (part.catalogo_origen || 'OEM') }}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- 2. Código OEM -->
                <td class="py-2.5 px-3 align-middle">
                  <div class="flex items-center gap-1">
                    <span class="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {{ part.codigo_oem }}
                    </span>
                    <button
                      type="button"
                      @click="copyToClipboard(part.codigo_oem, 'OEM')"
                      class="p-0.5 text-slate-400 hover:text-slate-800 rounded transition"
                      title="Copiar código OEM"
                    >
                      <Check v-if="copiedCode === part.codigo_oem" class="w-3.5 h-3.5 text-emerald-600" />
                      <Copy v-else class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

                <!-- 3. Códigos Alternos por Catálogo -->
                <td class="py-2.5 px-3 align-middle">
                  <div class="flex flex-wrap gap-1">
                    <template v-if="part.equivalencias && part.equivalencias.length > 0">
                      <span
                        v-for="eq in part.equivalencias"
                        :key="eq.id"
                        @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                        :class="[
                          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono cursor-pointer transition hover:opacity-80',
                          getBrandBadgeClass(eq.marca_alterna)
                        ]"
                        :title="`Clic para copiar código ${eq.marca_alterna}`"
                      >
                        <span class="font-sans text-[9px] uppercase opacity-90">{{ eq.marca_alterna }}:</span>
                        <strong>{{ eq.codigo_alterno }}</strong>
                      </span>
                    </template>
                    <span v-else class="text-[10px] text-slate-400 italic">
                      Sin cruces
                    </span>
                  </div>
                </td>

                <!-- 4. MEDIDAS Y COTAS -->
                <td class="py-2.5 px-3 align-middle">
                  
                  <!-- Caso A: Ajuste de válvula -->
                  <div v-if="selectedComponent?.id === 'ajuste_valvula' || part.categoria === 'Sellos'" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-800">
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Int: <strong class="text-slate-900">{{ part.diametro_interior_mm || 4.8 }} mm</strong>
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Ext: <strong class="text-slate-900">{{ part.diametro_exterior_mm || 10.8 }} mm</strong>
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Alt: <strong class="text-slate-900">{{ part.altura_mm || 10 }} mm</strong>
                    </span>
                  </div>

                  <!-- Caso B: Válvula -->
                  <div v-else-if="selectedComponent?.id === 'valvula' || part.categoria === 'Válvulas'" class="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-800">
                    <span 
                      v-if="part.dimensiones?.tipo_valvula || part.dimensiones?.posicion" 
                      class="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                      :class="(part.dimensiones?.tipo_valvula === 'Admisión' || part.dimensiones?.posicion === 'IN') ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' : 'bg-amber-100 text-amber-800 border border-amber-200'"
                    >
                      {{ part.dimensiones?.tipo_valvula || (part.dimensiones?.posicion === 'IN' ? 'Admisión' : (part.dimensiones?.posicion === 'EX' ? 'Escape' : part.dimensiones?.posicion)) }}
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Hongo: <strong class="text-slate-900">{{ part.diametro_cabeza_mm ? `${part.diametro_cabeza_mm} mm` : '—' }}</strong>
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Vástago: <strong class="text-slate-900">{{ part.diametro_vastago_mm ? `${part.diametro_vastago_mm} mm` : '—' }}</strong>
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Largo: <strong class="text-slate-900">{{ part.longitud_total_mm ? `${part.longitud_total_mm} mm` : '—' }}</strong>
                    </span>
                    <span v-if="part.angulo_asiento_grados" class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] border border-slate-200">
                      Ángulo: <strong>{{ part.angulo_asiento_grados }}°</strong>
                    </span>
                  </div>

                  <!-- Caso C: Anillos de motor -->
                  <div v-else-if="selectedComponent?.id === 'anillos_motor' || part.categoria === 'Anillos'" class="space-y-1 text-xs font-mono text-slate-800">
                    <div class="flex items-center gap-1.5 text-[11px]">
                      <span class="text-slate-500 font-sans">Ø Cilindro:</span>
                      <strong class="text-slate-900 font-bold">{{ part.diametro_cilindro_mm || 96.0 }} mm</strong>
                    </div>

                    <div class="flex flex-wrap items-center gap-1 text-[10px]">
                      <span class="px-1.5 py-0.2 rounded bg-blue-50 text-blue-900 border border-blue-200 font-bold">
                        1°: {{ part.espesor_anillo1_mm || 2.0 }}mm
                      </span>
                      <span class="px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-900 border border-cyan-200 font-bold">
                        2°: {{ part.espesor_anillo2_mm || 2.0 }}mm
                      </span>
                      <span class="px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                        Aceite: {{ part.espesor_aceite_mm || 4.0 }}mm
                      </span>
                    </div>
                  </div>

                  <!-- Caso D: Juego de tornillos de culata -->
                  <div v-else-if="selectedComponent?.id === 'tornillos_culata' || part.categoria === 'Pernos'" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-800">
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      {{ part.medida_rosca || 'M12' }} × {{ part.paso_rosca_mm || 1.25 }}
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      L: {{ part.longitud_perno_mm || 120 }} mm
                    </span>
                    <span class="px-1.5 py-0.5 rounded bg-cyan-50 text-[#038391] border border-cyan-200 font-bold text-[11px]">
                      {{ part.cantidad_piezas || 18 }} pcs
                    </span>
                  </div>

                  <!-- Caso E: Casquetería -->
                  <div v-else-if="selectedComponent?.id === 'casqueteria' || part.categoria === 'Casquetería'" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-800">
                    <span v-if="part.diametro_munon_mm" class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Muñón: <strong>{{ part.diametro_munon_mm }} mm</strong>
                    </span>
                    <span v-if="part.ancho_casquete_mm" class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Ancho: <strong>{{ part.ancho_casquete_mm }} mm</strong>
                    </span>
                    <span v-if="part.tipo_cojinete" class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10px]">
                      {{ part.tipo_cojinete }}
                    </span>
                  </div>

                  <!-- Caso F: Empaques -->
                  <div v-else-if="selectedComponent?.id === 'empaques_juntas' || part.categoria === 'Empaques'" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-800">
                    <span v-if="part.diametro_cilindro_mm" class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Ø Cil: <strong>{{ part.diametro_cilindro_mm }} mm</strong>
                    </span>
                    <span v-if="part.dimensiones?.espesor_mm" class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      Espesor: <strong>{{ part.dimensiones.espesor_mm }} mm</strong>
                    </span>
                  </div>

                  <!-- Caso G: Camisas de cilindro (Ultra-compacto) -->
                  <div v-else-if="selectedComponent?.id === 'camisas_cilindro' || part.categoria === 'Camisas'" class="space-y-0.5">
                    <div class="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs font-mono font-bold text-slate-800">
                      <span class="text-slate-500 text-[10px] uppercase font-sans">ØA:</span>
                      <strong class="text-slate-900 text-xs">{{ part.dimensiones?.diametro_interior_mm || part.diametro_cilindro_mm || '—' }}</strong>
                      <span class="text-slate-300">×</span>
                      <span class="text-slate-500 text-[10px] uppercase font-sans">ØB:</span>
                      <strong class="text-slate-900 text-xs">{{ part.dimensiones?.diametro_exterior_mm || '—' }}</strong>
                      <span class="text-slate-300">×</span>
                      <span class="text-slate-500 text-[10px] uppercase font-sans">C:</span>
                      <strong class="text-slate-900 text-xs">{{ part.dimensiones?.longitud_total_mm || part.longitud_total_mm || '—' }}</strong>
                      <span class="text-slate-400 text-[10px]">mm</span>
                    </div>

                    <div class="flex items-center gap-1 flex-wrap text-[10px] font-mono text-slate-600">
                      <span v-if="part.dimensiones?.diametro_pestana_mm || part.dimensiones?.espesor_pestana_mm" class="px-1 rounded bg-slate-50 border border-slate-200 text-[9px]">
                        Pest: Ø{{ part.dimensiones?.diametro_pestana_mm || '—' }}×{{ part.dimensiones?.espesor_pestana_mm || '—' }}mm
                      </span>
                      <span v-if="part.dimensiones?.acabado" class="px-1 rounded text-[9px] font-bold uppercase" :class="part.dimensiones.acabado === 'F' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'">
                        {{ part.dimensiones.acabado === 'F' ? 'Terminada' : 'Semi' }}
                      </span>
                    </div>
                  </div>

                  <!-- Caso H: Grupo Dinámico / Personalizado -->
                  <div 
                    v-else-if="currentGroupDefinition?.parametros && currentGroupDefinition.parametros.length > 0" 
                    class="flex flex-wrap items-center gap-1 text-xs font-mono text-slate-800"
                  >
                    <span 
                      v-for="p in currentGroupDefinition.parametros" 
                      :key="p.clave"
                      class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]"
                    >
                      <span class="text-slate-500 font-sans">{{ p.etiqueta }}:</span> 
                      <strong class="text-slate-900 ml-0.5">
                        {{ part.dimensiones?.[p.clave] ?? (part as any)[p.clave] ?? '—' }}<span v-if="p.unidad" class="text-slate-400 ml-0.5">{{ p.unidad }}</span>
                      </strong>
                    </span>
                  </div>

                  <!-- Caso I: Genérico / Otros -->
                  <div v-else class="text-[11px] text-slate-500 font-mono">
                    {{ part.categoria }} • Ref: {{ part.subsistema }}
                  </div>

                </td>

                <!-- 5. Acciones Rápidas -->
                <td class="py-2.5 px-3 align-middle text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      @click="openTechnicalSheet(part)"
                      class="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition flex items-center gap-1"
                      title="Ver ficha técnica"
                    >
                      <Eye class="w-3 h-3 text-slate-400" />
                      <span>Ficha</span>
                    </button>

                    <button
                      type="button"
                      @click="addToWorkOrder(part)"
                      :class="[
                        'px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1',
                        addedPartId === part.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#04C4D9] hover:bg-[#03a9bc] text-white shadow-2xs'
                      ]"
                    >
                      <Check v-if="addedPartId === part.id" class="w-3 h-3" />
                      <Plus v-else class="w-3 h-3" />
                      <span>{{ addedPartId === part.id ? 'Listo' : 'A Orden' }}</span>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="displayedParts.length === 0">
                <td colspan="5" class="py-10 text-center text-slate-400 bg-white">
                  <div class="max-w-sm mx-auto space-y-2">
                    <AlertCircle class="w-6 h-6 text-slate-300 mx-auto" />
                    <h4 class="text-xs font-bold text-slate-700">No hay repuestos coincidentes</h4>
                    <p class="text-[11px] text-slate-400">
                      No se encontraron piezas con las cotas o términos ingresados.
                    </p>
                    <div class="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        @click="resetMeasurementsFilters"
                        class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                      >
                        Limpiar Filtros
                      </button>
                      <button
                        type="button"
                        @click="openAddPartModal"
                        class="px-2.5 py-1 rounded-lg bg-[#04C4D9] text-white text-xs font-bold"
                      >
                        + Añadir Repuesto
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- MODAL 1: INFORMACIÓN TÉCNICA DEL MOTOR                                    -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="selectedMotorInfoModal" 
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="closeMotorInfo"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Info class="w-4 h-4 text-[#04C4D9]" />
              <h3 class="text-sm font-bold text-white">
                Ficha Motor: {{ getBrandName(selectedMotorInfoModal.fabricante_id) }} - {{ selectedMotorInfoModal.codigo }}
              </h3>
            </div>
            <button
              type="button"
              @click="closeMotorInfo"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 text-xs space-y-3 font-mono">
            <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">ID de Motor</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.numero_id || '—' }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Denominación</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.denominacion_venta || 'Estándar' }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Cilindrada</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.cilindrada_texto || `${selectedMotorInfoModal.cilindrada_cc} cc` }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Arquitectura</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.cilindros }} Cil / {{ selectedMotorInfoModal.valvulas }}V</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Potencia</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.kw || '—' }} kW ({{ selectedMotorInfoModal.cv || '—' }} CV)</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Combustible</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.combustible }}</strong>
              </div>
            </div>

            <div class="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200/70 text-slate-700 text-xs">
              <div class="font-bold text-slate-900 mb-1 font-sans">Datos de Rectificación:</div>
              <ul class="space-y-1 text-[11px]">
                <li>• Diámetro de Cilindro STD: <strong>{{ selectedMotorInfoModal.diametro_cilindro_std_mm || 96.0 }} mm</strong></li>
                <li>• Aspiración: <strong>{{ selectedMotorInfoModal.aspiracion || 'Natural' }}</strong></li>
              </ul>
            </div>
          </div>

          <div class="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              @click="closeMotorInfo"
              class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100"
            >
              Cerrar
            </button>
            <button
              type="button"
              @click="handleSelectMotor(selectedMotorInfoModal); closeMotorInfo()"
              class="px-3.5 py-1.5 rounded-lg bg-[#04C4D9] hover:bg-[#03a9bc] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <Check class="w-3.5 h-3.5" />
              <span>Seleccionar Motor</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL 2: FICHA TÉCNICA COMPLETA DE ARTÍCULO                               -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="isTechnicalModalOpen && modalPart" 
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        @click.self="closeTechnicalSheet"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
          
          <div class="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-mono font-bold uppercase tracking-widest text-[#04C4D9] block">
                Ficha Técnica de Homologación
              </span>
              <h3 class="text-base font-black text-white mt-0.5">
                {{ modalPart.nombre }}
              </h3>
            </div>
            <button
              type="button"
              @click="closeTechnicalSheet"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-5 overflow-y-auto space-y-3.5 text-xs">
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Código OEM</span>
                <strong class="text-xs font-black text-slate-900">{{ modalPart.codigo_oem }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Subsistema</span>
                <strong class="text-xs font-black text-[#038391]">{{ modalPart.subsistema }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Categoría</span>
                <strong class="text-xs font-black text-slate-900">{{ modalPart.categoria }}</strong>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Equivalencias Cruzadas Multimarca
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div
                  v-for="eq in modalPart.equivalencias"
                  :key="eq.id"
                  class="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white"
                >
                  <div class="flex items-center gap-1.5">
                    <span :class="['px-1.5 py-0.2 rounded text-[9px] uppercase font-bold', getBrandBadgeClass(eq.marca_alterna)]">
                      {{ eq.marca_alterna }}
                    </span>
                    <strong class="font-mono text-xs text-slate-900">{{ eq.codigo_alterno }}</strong>
                  </div>
                  <button
                    type="button"
                    @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                    class="text-slate-400 hover:text-slate-800 p-1"
                    title="Copiar código"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Especificaciones Métricas (mm)
              </h4>
              <table class="w-full border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 font-mono text-xs">
                <tbody>
                  <tr v-if="modalPart.diametro_interior_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Diámetro Interior:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_interior_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_exterior_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Diámetro Exterior:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_exterior_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.altura_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Altura:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.altura_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_cabeza_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Hongo (Cabeza):</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_cabeza_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_vastago_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Vástago:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_vastago_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.longitud_total_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Longitud Total:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.longitud_total_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_cilindro_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Diámetro Cilindro:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_cilindro_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_anillo1_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">1° Anillo (Fuego):</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_anillo1_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_anillo2_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">2° Anillo (Compresión):</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_anillo2_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_aceite_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Anillo de Aceite:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_aceite_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.medida_rosca" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Rosca y Paso:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.medida_rosca }} × {{ modalPart.paso_rosca_mm || 1.25 }} mm</td>
                  </tr>
                  <template v-if="modalPart.dimensiones && typeof modalPart.dimensiones === 'object'">
                    <tr 
                      v-for="(val, key) in modalPart.dimensiones" 
                      :key="`dyn-dim-${key}`"
                      class="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td class="py-1.5 px-3 text-slate-500 font-sans capitalize">
                        {{ String(key).replace(/_/g, ' ') }}:
                      </td>
                      <td class="py-1.5 px-3 text-slate-900 font-bold text-right font-mono">
                        {{ val }}
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

          </div>

          <div class="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              @click="copyFullCross(modalPart)"
              class="px-3.5 py-1.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5"
            >
              <Copy class="w-3.5 h-3.5" />
              <span>Copiar Ficha</span>
            </button>

            <button
              type="button"
              @click="addToWorkOrder(modalPart); closeTechnicalSheet()"
              class="px-4 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition"
            >
              <Plus class="w-4 h-4" />
              <span>Agregar a Orden</span>
            </button>
          </div>

        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL ADMINISTRATIVO: NUEVO REPUESTO / GRUPO DINÁMICO                     -->
    <!-- ========================================================================= -->
    <AdminCatalogModal
      :is-open="isAdminModalOpen"
      :initial-tab="adminModalTab"
      :preselected-group-id="selectedComponent?.id"
      :preselected-motor-id="selectedMotor?.id || null"
      :edit-group-id="adminModalEditGroupId"
      @close="isAdminModalOpen = false; adminModalEditGroupId = null"
      @part-created="onPartCreated"
      @group-created="onGroupCreated"
      @group-updated="onGroupUpdated"
    />

  </div>
</template>
