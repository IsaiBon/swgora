<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { 
  type Motor, 
  type RepuestoTecnico, 
  type Fabricante,
  mockFabricantes,
  mockMotores,
  mockRepuestos
} from '@/services/catalogService'
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
  SlidersHorizontal 
} from 'lucide-vue-next'

// =============================================================================
// ESTADO DE SELECCIÓN PRINCIPAL (3 OPCIONES JUNTAS)
// NINGUNA ETIQUETA DE "OBLIGATORIO" NI "OPCIONAL"
// =============================================================================
const brandInput = ref<string>('')
const motorInput = ref<string>('')
const componentInput = ref<string>('')

const isBrandOpen = ref<boolean>(false)
const isMotorOpen = ref<boolean>(false)
const isComponentOpen = ref<boolean>(false)

const selectedBrand = ref<Fabricante | null>(null)
const selectedMotor = ref<Motor | null>(null)
const selectedComponent = ref<ComponentGroup | null>(null)

// Vista activa cuando hay marca seleccionada (para alternar entre motores y repuestos)
const activeViewTab = ref<'motores' | 'repuestos'>('motores')

// =============================================================================
// DEFINICIÓN DE LOS 4 TIPOS DE COMPONENTE ÚNICOS (SIN RELLENO)
// =============================================================================
interface ComponentGroup {
  id: 'ajuste_valvula' | 'valvula' | 'anillos_motor' | 'tornillos_culata'
  title: string
  shortTitle: string
  category: string
  icon: string
  description: string
  sampleMeasurements: string
}

const componentGroups: ComponentGroup[] = [
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
    title: 'Válvula',
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
    description: 'Tornillos de apriete para culata de cilindros',
    sampleMeasurements: 'Medida rosca, paso rosca, longitudes, cant.'
  }
]

// =============================================================================
// FILTROS DE MEDIDAS EXACTAS POR TIPO DE COMPONENTE
// =============================================================================

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
  if (!selectedComponent.value) return 0
  if (selectedComponent.value.id === 'ajuste_valvula') {
    return [filterSelloDiamInt.value, filterSelloDiamExt.value, filterSelloAltura.value].filter(v => v !== undefined && v !== null).length
  }
  if (selectedComponent.value.id === 'valvula') {
    return [filterValvulaHongo.value, filterValvulaVastago.value, filterValvulaAltura.value].filter(v => v !== undefined && v !== null).length
  }
  if (selectedComponent.value.id === 'anillos_motor') {
    return [filterAnilloDiametro.value, filterAnilloGrosor1.value, filterAnilloAlturaGrosor.value].filter(v => v !== undefined && v !== null).length
  }
  if (selectedComponent.value.id === 'tornillos_culata') {
    return [
      filterPernoMedidaRosca.value || undefined,
      filterPernoPasoRosca.value,
      filterPernoLongitud.value,
      filterPernoCantidad.value,
      filterPernoPasoRosca1.value,
      filterPernoLongitud1.value,
      filterPernoLongitud2.value
    ].filter(v => v !== undefined && v !== null).length
  }
  return 0
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
  if (part.diametro_interior_mm) {
    lines.push(`Ajuste Válvula: ØInt ${part.diametro_interior_mm}mm | ØExt ${part.diametro_exterior_mm}mm | Alt ${part.altura_mm}mm`)
  }
  if (part.diametro_cabeza_mm) {
    lines.push(`Válvula: Hongo Ø${part.diametro_cabeza_mm}mm | Vástago Ø${part.diametro_vastago_mm}mm | Altura ${part.longitud_total_mm}mm`)
  }
  if (part.diametro_cilindro_mm) {
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
// COMPORTAMIENTO DE BÚSQUEDA INTERACTIVA (SEARCH-AS-YOU-TYPE)
// =============================================================================

// 1. Filtrado de MARCA
const filteredBrands = computed(() => {
  const q = brandInput.value.toLowerCase().trim()
  if (!q) return mockFabricantes
  return mockFabricantes.filter(f => 
    f.nombre.toLowerCase().includes(q) || 
    (f.pais_origen && f.pais_origen.toLowerCase().includes(q))
  )
})

const handleSelectBrand = (fab: Fabricante) => {
  selectedBrand.value = fab
  brandInput.value = fab.nombre.toUpperCase()
  isBrandOpen.value = false
  activeViewTab.value = 'motores'
  motorCurrentPage.value = 1

  // Si el motor actual no pertenece a la nueva marca, se resetea
  if (selectedMotor.value && selectedMotor.value.fabricante_id !== fab.id) {
    selectedMotor.value = null
    motorInput.value = ''
  }
}

// 2. Filtrado de MOTORES DISPONIBLES
const availableMotors = computed(() => {
  if (selectedBrand.value) {
    return mockMotores.filter(m => m.fabricante_id === selectedBrand.value?.id)
  }
  const qBrand = brandInput.value.toLowerCase().trim()
  if (qBrand) {
    const matchingFab = mockFabricantes.find(f => f.nombre.toLowerCase().includes(qBrand))
    if (matchingFab) {
      return mockMotores.filter(m => m.fabricante_id === matchingFab.id)
    }
  }
  return mockMotores
})

const filteredMotors = computed(() => {
  const q = motorInput.value.toLowerCase().trim()
  if (!q) return availableMotors.value
  return availableMotors.value.filter(m => 
    m.codigo.toLowerCase().includes(q) || 
    (m.nombre_comercial && m.nombre_comercial.toLowerCase().includes(q)) ||
    (m.denominacion_venta && m.denominacion_venta.toLowerCase().includes(q)) ||
    m.combustible.toLowerCase().includes(q)
  )
})

const handleSelectMotor = (mot: Motor) => {
  selectedMotor.value = mot
  motorInput.value = mot.codigo
  isMotorOpen.value = false

  // Autoseleccionar marca si estaba vacía
  if (!selectedBrand.value) {
    const fab = mockFabricantes.find(f => f.id === mot.fabricante_id)
    if (fab) {
      selectedBrand.value = fab
      brandInput.value = fab.nombre.toUpperCase()
    }
  }

  // Si ya tiene un componente seleccionado, mostrar vista de repuestos
  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
  }
}

const handleClearSelectedMotor = () => {
  selectedMotor.value = null
  motorInput.value = ''
  activeViewTab.value = 'motores'
}

// 3. Filtrado de TIPOS DE COMPONENTE (LOS 4 EXACTOS)
const filteredComponentGroups = computed(() => {
  const q = componentInput.value.toLowerCase().trim()
  if (!q) return componentGroups
  return componentGroups.filter(g => 
    g.title.toLowerCase().includes(q) || 
    g.shortTitle.toLowerCase().includes(q) ||
    g.category.toLowerCase().includes(q) ||
    g.description.toLowerCase().includes(q)
  )
})

const handleSelectComponent = (comp: ComponentGroup) => {
  selectedComponent.value = comp
  componentInput.value = comp.title
  isComponentOpen.value = false
  activeViewTab.value = 'repuestos'
}

// Limpiar todo y restaurar estado
const handleResetAll = () => {
  brandInput.value = ''
  motorInput.value = ''
  componentInput.value = ''
  selectedBrand.value = null
  selectedMotor.value = null
  selectedComponent.value = null
  isBrandOpen.value = false
  isMotorOpen.value = false
  isComponentOpen.value = false
  activeViewTab.value = 'motores'
  tableSearchFilter.value = ''
  tableBrandFilter.value = 'Todas las marcas'
  motorCurrentPage.value = 1
  resetMeasurementsFilters()
  showToast('Filtros y búsqueda restablecidos')
}

// =============================================================================
// TABLA DE MOTORES DE LA MARCA (EXACTA A IMAGEN 1)
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

watch([selectedBrand, brandInput], () => {
  motorCurrentPage.value = 1
})

const getBrandName = (fabId: string): string => {
  const fab = mockFabricantes.find(f => f.id === fabId)
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
  if (!selectedComponent.value) return []

  let list: RepuestoTecnico[] = []

  // 1. Filtrar por motor o marca
  if (selectedMotor.value) {
    list = mockRepuestos.filter(r => r.motor_id === selectedMotor.value?.id)
  } else if (selectedBrand.value) {
    const brandMotorIds = new Set(mockMotores.filter(m => m.fabricante_id === selectedBrand.value?.id).map(m => m.id))
    list = mockRepuestos.filter(r => r.motor_id && brandMotorIds.has(r.motor_id))
  } else {
    list = mockRepuestos
  }

  // 2. Filtrar por tipo de componente
  const compId = selectedComponent.value.id
  if (compId === 'ajuste_valvula') {
    list = list.filter(r => r.categoria === 'Sellos' || r.subsistema === 'Sellos y Juntas' || r.nombre.toLowerCase().includes('sello'))
  } else if (compId === 'valvula') {
    list = list.filter(r => r.categoria === 'Válvulas' || r.nombre.toLowerCase().includes('válvula'))
  } else if (compId === 'anillos_motor') {
    list = list.filter(r => r.categoria === 'Anillos' || r.nombre.toLowerCase().includes('anillos'))
  } else if (compId === 'tornillos_culata') {
    list = list.filter(r => r.categoria === 'Pernos' || r.nombre.toLowerCase().includes('tornillos') || r.nombre.toLowerCase().includes('perno'))
  }

  // 3. Filtros de medidas dimensionales específicas
  if (compId === 'ajuste_valvula') {
    if (filterSelloDiamInt.value !== undefined) {
      list = list.filter(r => r.diametro_interior_mm && Math.abs(r.diametro_interior_mm - (filterSelloDiamInt.value || 0)) <= 0.25)
    }
    if (filterSelloDiamExt.value !== undefined) {
      list = list.filter(r => r.diametro_exterior_mm && Math.abs(r.diametro_exterior_mm - (filterSelloDiamExt.value || 0)) <= 0.35)
    }
    if (filterSelloAltura.value !== undefined) {
      list = list.filter(r => r.altura_mm && Math.abs(r.altura_mm - (filterSelloAltura.value || 0)) <= 0.5)
    }
  } else if (compId === 'valvula') {
    if (filterValvulaHongo.value !== undefined) {
      list = list.filter(r => r.diametro_cabeza_mm && Math.abs(r.diametro_cabeza_mm - (filterValvulaHongo.value || 0)) <= 0.5)
    }
    if (filterValvulaVastago.value !== undefined) {
      list = list.filter(r => r.diametro_vastago_mm && Math.abs(r.diametro_vastago_mm - (filterValvulaVastago.value || 0)) <= 0.15)
    }
    if (filterValvulaAltura.value !== undefined) {
      list = list.filter(r => r.longitud_total_mm && Math.abs(r.longitud_total_mm - (filterValvulaAltura.value || 0)) <= 1.0)
    }
  } else if (compId === 'anillos_motor') {
    if (filterAnilloDiametro.value !== undefined) {
      list = list.filter(r => r.diametro_cilindro_mm && Math.abs(r.diametro_cilindro_mm - (filterAnilloDiametro.value || 0)) <= 0.5)
    }
    if (filterAnilloGrosor1.value !== undefined) {
      list = list.filter(r => r.espesor_anillo1_mm && Math.abs(r.espesor_anillo1_mm - (filterAnilloGrosor1.value || 0)) <= 0.15)
    }
    if (filterAnilloAlturaGrosor.value !== undefined) {
      const val = filterAnilloAlturaGrosor.value || 0
      list = list.filter(r => 
        (r.espesor_anillo2_mm && Math.abs(r.espesor_anillo2_mm - val) <= 0.15) ||
        (r.espesor_aceite_mm && Math.abs(r.espesor_aceite_mm - val) <= 0.25) ||
        (r.espesor_anillo1_mm && Math.abs(r.espesor_anillo1_mm - val) <= 0.15)
      )
    }
  } else if (compId === 'tornillos_culata') {
    if (filterPernoMedidaRosca.value) {
      list = list.filter(r => r.medida_rosca?.toLowerCase() === filterPernoMedidaRosca.value.toLowerCase())
    }
    if (filterPernoPasoRosca.value !== undefined) {
      list = list.filter(r => r.paso_rosca_mm && Math.abs(r.paso_rosca_mm - (filterPernoPasoRosca.value || 0)) <= 0.1)
    }
    if (filterPernoLongitud.value !== undefined) {
      list = list.filter(r => (r.longitud_perno_mm || r.longitud_total_mm) && Math.abs(((r.longitud_perno_mm || r.longitud_total_mm) || 0) - (filterPernoLongitud.value || 0)) <= 2.0)
    }
    if (filterPernoCantidad.value !== undefined) {
      list = list.filter(r => r.cantidad_piezas === filterPernoCantidad.value)
    }
    if (filterPernoPasoRosca1.value !== undefined) {
      list = list.filter(r => r.paso_rosca1_mm && Math.abs(r.paso_rosca1_mm - (filterPernoPasoRosca1.value || 0)) <= 0.1)
    }
    if (filterPernoLongitud1.value !== undefined) {
      list = list.filter(r => r.longitud1_mm && Math.abs(r.longitud1_mm - (filterPernoLongitud1.value || 0)) <= 2.0)
    }
    if (filterPernoLongitud2.value !== undefined) {
      list = list.filter(r => r.longitud2_mm && Math.abs(r.longitud2_mm - (filterPernoLongitud2.value || 0)) <= 2.0)
    }
  }

  // 4. Búsqueda por texto local
  if (tableSearchFilter.value.trim()) {
    const q = tableSearchFilter.value.toLowerCase().trim()
    list = list.filter(r => 
      r.nombre.toLowerCase().includes(q) ||
      r.codigo_oem.toLowerCase().includes(q) ||
      r.equivalencias?.some(eq => eq.codigo_alterno.toLowerCase().includes(q) || eq.marca_alterna.toLowerCase().includes(q))
    )
  }

  // 5. Filtro de marca de catálogo
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

// Cerrar dropdowns al hacer clic fuera
const handleDocumentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.combobox-brand')) isBrandOpen.value = false
  if (!target.closest('.combobox-motor')) isMotorOpen.value = false
  if (!target.closest('.combobox-component')) isComponentOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="space-y-5 pb-12 select-none">

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
        class="fixed bottom-6 right-6 z-50 bg-[#0d0d0d] text-white px-5 py-3 rounded-2xl shadow-2xl border border-[#05C7F2]/40 flex items-center gap-3"
      >
        <CheckCircle2 class="w-5 h-5 text-[#05F2F2] shrink-0" />
        <span class="text-xs font-semibold">{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- HEADER SECTION (IDÉNTICO A CLIENTESVIEW)                                  -->
    <!-- ========================================================================= -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#05C7F2]/15 text-[#04C4D9] border border-[#05C7F2]/30 uppercase tracking-wider">
            Sprint 4 • Historial de Órdenes y Catálogo
          </span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Catálogo Técnico y Buscador de Taller
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Consulta técnica multimarca por vehículo, código de motor y medidas físicas para rectificación y adaptaciones.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          @click="handleResetAll"
          class="min-h-[44px] px-4 py-2 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
          title="Restaurar registros estándar y limpiar filtros"
        >
          <RotateCcw class="w-4 h-4 text-[#04C4D9]" />
          <span>Restaurar Filtros</span>
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- BARRA SUPERIOR FIJA / STICKY: 3 OPCIONES PRINCIPALES JUNTAS               -->
    <!-- (MARCA, CÓDIGO MOTOR, TIPO DE COMPONENTE) - SIN TEXTO OBLIGATORIO/OPCIONAL-->
    <!-- ========================================================================= -->
    <div class="sticky top-0 z-30 bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
        
        <!-- 1. CAMPO: MARCA / FABRICANTE -->
        <div class="relative combobox-brand">
          <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
            Marca / Fabricante
          </label>

          <div class="relative flex items-center">
            <input
              v-model="brandInput"
              @focus="isBrandOpen = true"
              @input="isBrandOpen = true"
              type="text"
              placeholder="Escriba marca (ej. Toyota, Nissan, Isuzu...)"
              class="w-full pl-3.5 pr-8 py-2.5 text-xs sm:text-sm font-bold bg-slate-50/70 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20 shadow-2xs min-h-[44px]"
            />
            <button
              v-if="brandInput"
              type="button"
              @click="brandInput = ''; selectedBrand = null; motorCurrentPage = 1"
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
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto"
          >
            <div
              v-for="fab in filteredBrands"
              :key="fab.id"
              @click="handleSelectBrand(fab)"
              class="px-3.5 py-2.5 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between border-b border-slate-50 last:border-0 transition"
            >
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#04C4D9]"></span>
                <strong class="text-slate-900 font-black">{{ fab.nombre.toUpperCase() }}</strong>
                <span class="text-slate-400 text-[10px]">({{ fab.pais_origen || 'Japón' }})</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono">{{ fab.engines_count || 'Varios' }} motores</span>
            </div>
            <div v-if="filteredBrands.length === 0" class="p-3 text-center text-xs text-slate-400">
              No hay marcas coincidentes
            </div>
          </div>
        </div>

        <!-- 2. CAMPO: CÓDIGO DE MOTOR -->
        <div class="relative combobox-motor">
          <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
            Código de Motor
          </label>

          <div class="relative flex items-center">
            <input
              v-model="motorInput"
              @focus="isMotorOpen = true"
              @input="isMotorOpen = true"
              type="text"
              placeholder="Escriba código (ej. 11B, 12HT, 3L, Z24...)"
              class="w-full pl-3.5 pr-8 py-2.5 text-xs sm:text-sm font-mono font-bold bg-slate-50/70 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20 shadow-2xs min-h-[44px]"
            />
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
          </div>

          <!-- Dropdown Motores -->
          <div
            v-if="isMotorOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto"
          >
            <div
              v-for="mot in filteredMotors"
              :key="mot.id"
              @click="handleSelectMotor(mot)"
              class="px-3.5 py-2.5 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between border-b border-slate-50 last:border-0 transition"
            >
              <div>
                <strong class="text-slate-900 font-mono text-sm font-black">{{ mot.codigo }}</strong>
                <span class="text-slate-600 ml-2 font-medium">{{ mot.nombre_comercial }}</span>
                <span v-if="mot.denominacion_venta" class="text-slate-400 ml-1">({{ mot.denominacion_venta }})</span>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {{ mot.cilindros }} Cil / {{ mot.cilindrada_texto || `${mot.cilindrada_cc} cc` }}
              </span>
            </div>
            <div v-if="filteredMotors.length === 0" class="p-3 text-center text-xs text-slate-400">
              No hay motores coincidentes
            </div>
          </div>
        </div>

        <!-- 3. CAMPO: TIPO DE COMPONENTE (4 COMPONENTES ÚNICOS) -->
        <div class="relative combobox-component">
          <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
            Tipo de Componente
          </label>

          <div class="relative flex items-center">
            <input
              v-model="componentInput"
              @focus="isComponentOpen = true"
              @input="isComponentOpen = true"
              type="text"
              placeholder="Seleccione (Ajuste válvula, Válvula, Anillos...)"
              class="w-full pl-3.5 pr-8 py-2.5 text-xs sm:text-sm font-bold bg-slate-50/70 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20 shadow-2xs min-h-[44px]"
            />
            <button
              v-if="componentInput"
              type="button"
              @click="componentInput = ''; selectedComponent = null; resetMeasurementsFilters()"
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
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto"
          >
            <div
              v-for="grp in filteredComponentGroups"
              :key="grp.id"
              @click="handleSelectComponent(grp)"
              class="px-3.5 py-2.5 hover:bg-cyan-50/70 cursor-pointer text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-50 last:border-0 transition"
            >
              <div class="flex items-center gap-2.5">
                <CircleDot v-if="grp.id === 'ajuste_valvula'" class="w-4 h-4 text-[#04C4D9]" />
                <Wrench v-else-if="grp.id === 'valvula'" class="w-4 h-4 text-[#04C4D9]" />
                <Layers v-else-if="grp.id === 'anillos_motor'" class="w-4 h-4 text-[#04C4D9]" />
                <FileText v-else class="w-4 h-4 text-[#04C4D9]" />
                <div>
                  <div class="text-slate-900 font-extrabold">{{ grp.title }}</div>
                  <div class="text-[10px] text-slate-400 font-normal">{{ grp.sampleMeasurements }}</div>
                </div>
              </div>
            </div>
            <div v-if="filteredComponentGroups.length === 0" class="p-3 text-center text-xs text-slate-400">
              No hay componentes coincidentes
            </div>
          </div>
        </div>

      </div>

      <!-- Barra informativa activa de selección -->
      <div v-if="selectedBrand || selectedMotor || selectedComponent" class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] font-bold text-slate-500 uppercase">Filtro activo:</span>
          
          <span v-if="selectedBrand || brandInput" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-[#038391] border border-cyan-200 font-bold">
            <span>{{ selectedBrand?.nombre || brandInput }}</span>
          </span>

          <span v-if="selectedMotor" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-white font-mono font-bold">
            <span>Motor: {{ selectedMotor.codigo }}</span>
            <button type="button" @click="handleClearSelectedMotor" class="hover:text-rose-400">
              <X class="w-3 h-3" />
            </button>
          </span>

          <span v-if="selectedComponent" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200 font-bold">
            <span>{{ selectedComponent.title }}</span>
          </span>
        </div>

        <!-- Pestañas para alternar entre lista de motores y repuestos -->
        <div v-if="selectedBrand && selectedComponent" class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            @click="activeViewTab = 'motores'"
            :class="[
              'px-3 py-1 rounded-lg text-xs font-bold transition',
              activeViewTab === 'motores' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Motores ({{ brandMotorsList.length }})
          </button>
          <button
            type="button"
            @click="activeViewTab = 'repuestos'"
            :class="[
              'px-3 py-1 rounded-lg text-xs font-bold transition',
              activeViewTab === 'repuestos' ? 'bg-white text-[#04C4D9] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Repuestos y Medidas ({{ displayedParts.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 1: PANTALLA INICIAL CUANDO AÚN NO SE HA PUESTO MARCA               -->
    <!-- ========================================================================= -->
    <div v-if="!selectedBrand && !brandInput && !selectedMotor && !selectedComponent" class="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-8 text-center max-w-xl mx-auto space-y-4 my-6">
      <div class="w-16 h-16 rounded-2xl bg-cyan-50 border border-cyan-200 text-[#04C4D9] flex items-center justify-center mx-auto shadow-2xs">
        <Search class="w-8 h-8" />
      </div>
      <h2 class="text-base font-black text-slate-900">
        Buscador Técnico de Taller y Medidas de Rectificación
      </h2>
      <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
        Ingrese o seleccione la <strong>Marca / Fabricante</strong> en la barra superior para desplegar la lista de motores técnicos correspondiente (ej. Toyota, Nissan).
      </p>

      <!-- Botones de acceso rápido a marcas principales -->
      <div class="pt-4 border-t border-slate-100">
        <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
          Marcas automotrices frecuentes:
        </span>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button
            v-for="fab in mockFabricantes.slice(0, 8)"
            :key="fab.id"
            type="button"
            @click="handleSelectBrand(fab)"
            class="px-3.5 py-1.5 rounded-full border border-slate-200 hover:border-[#04C4D9] hover:bg-cyan-50/50 text-xs font-bold text-slate-700 transition active:scale-95"
          >
            {{ fab.nombre }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 2: AL PONER LA MARCA -> TABLA DE MOTORES (ESTILO IMAGEN 1)        -->
    <!-- ========================================================================= -->
    <div 
      v-else-if="(selectedBrand || brandInput) && (!selectedMotor || activeViewTab === 'motores')" 
      class="space-y-4"
    >
      <!-- Encabezado de la tabla de motores -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-[#04C4D9]"></span>
          <h3 class="text-sm font-black text-slate-900">
            Motores disponibles para <span class="text-[#038391] uppercase">{{ selectedBrand?.nombre || brandInput }}</span>
          </h3>
          <span class="text-xs font-mono text-slate-400">({{ brandMotorsList.length }} registrados)</span>
        </div>

        <div class="text-xs text-slate-500 font-medium">
          Haga clic en cualquier fila para seleccionar el motor y consultar sus piezas
        </div>
      </div>

      <!-- TABLA TÉCNICA DE MOTORES (CALCO FIEL DE IMAGEN 1) -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        <!-- Barra Azul Superior de Resultados (idéntica a imagen 1) -->
        <div class="bg-[#004b97] text-white py-2 px-4 flex items-center justify-between font-bold text-xs sm:text-sm tracking-wide">
          <span></span>
          <div class="flex items-center gap-1.5">
            <span>Resultado {{ motorStartIndex + 1 }} - {{ motorEndIndex }} desde {{ brandMotorsList.length }}</span>
            <ChevronRight class="w-4 h-4" />
          </div>
          <span></span>
        </div>

        <!-- Contenedor con scroll interno para que no haya que subir y bajar la página -->
        <div class="overflow-x-auto overflow-y-auto max-h-[540px]">
          <table class="w-full text-left text-xs border-collapse">
            <!-- Encabezados de columna idénticos a imagen 1 -->
            <thead class="sticky top-0 z-10 bg-[#f8f9fa] text-slate-600 font-bold border-b border-slate-200 text-xs shadow-2xs">
              <tr>
                <th class="py-2.5 px-3 w-10 text-center border-r border-slate-200/80"></th>
                <th class="py-2.5 px-3.5 w-32 border-r border-slate-200/80">Número/ID ...</th>
                <th class="py-2.5 px-4 w-52 border-r border-slate-200/80">Código de motor</th>
                <th class="py-2.5 px-4 w-44 border-r border-slate-200/80">Denominación de venta</th>
                <th class="py-2.5 px-3.5 w-24 text-center border-r border-slate-200/80">Cilindros</th>
                <th class="py-2.5 px-4 w-44 border-r border-slate-200/80">Cilindrada</th>
                <th class="py-2.5 px-3.5 w-20 text-center border-r border-slate-200/80">kW</th>
                <th class="py-2.5 px-3.5 w-20 text-center">CV</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="mot in paginatedMotors"
                :key="mot.id"
                @click="handleSelectMotor(mot)"
                :class="[
                  'transition cursor-pointer group',
                  selectedMotor?.id === mot.id 
                    ? 'bg-cyan-50/90 font-bold' 
                    : 'hover:bg-blue-50/70 text-slate-700'
                ]"
              >
                <!-- 1. Icono de Información (i) -->
                <td class="py-2.5 px-3 text-center align-middle border-r border-slate-100">
                  <button
                    type="button"
                    @click="openMotorInfo(mot, $event)"
                    class="p-1 rounded-full hover:bg-blue-100 text-[#004b97] inline-flex items-center justify-center transition"
                    title="Ver ficha técnica del motor"
                  >
                    <Info class="w-4 h-4 fill-current text-[#004b97]" />
                  </button>
                </td>

                <!-- 2. Número / ID -->
                <td class="py-2.5 px-3.5 font-mono text-slate-600 align-middle border-r border-slate-100">
                  {{ mot.numero_id || '—' }}
                </td>

                <!-- 3. Código de Motor (ej. TOYOTA - 11B) -->
                <td class="py-2.5 px-4 font-semibold text-slate-800 align-middle border-r border-slate-100">
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-900 group-hover:text-[#004b97] transition">
                      {{ getBrandName(mot.fabricante_id) }} - {{ mot.codigo }}
                    </span>
                    <span 
                      v-if="selectedMotor?.id === mot.id"
                      class="text-[10px] px-1.5 py-0.5 rounded bg-[#04C4D9] text-white font-bold"
                    >
                      Activo
                    </span>
                  </div>
                </td>

                <!-- 4. Denominación de Venta -->
                <td class="py-2.5 px-4 text-slate-600 align-middle border-r border-slate-100">
                  {{ mot.denominacion_venta || '—' }}
                </td>

                <!-- 5. Cilindros -->
                <td class="py-2.5 px-3.5 text-center font-mono text-slate-800 align-middle border-r border-slate-100">
                  {{ mot.cilindros }}
                </td>

                <!-- 6. Cilindrada -->
                <td class="py-2.5 px-4 font-mono text-slate-800 align-middle border-r border-slate-100">
                  {{ mot.cilindrada_texto || `${mot.cilindrada_cc} cc` }}
                </td>

                <!-- 7. kW -->
                <td class="py-2.5 px-3.5 text-center font-mono text-slate-800 align-middle border-r border-slate-100">
                  {{ mot.kw || '—' }}
                </td>

                <!-- 8. CV -->
                <td class="py-2.5 px-3.5 text-center font-mono text-slate-800 align-middle">
                  {{ mot.cv || '—' }}
                </td>
              </tr>

              <tr v-if="paginatedMotors.length === 0">
                <td colspan="8" class="py-12 text-center text-slate-400 bg-white">
                  No hay motores que coincidan con la búsqueda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pie de Tabla con Paginación (idéntico a imagen 1: |< < 1 desde 48 > >|) -->
        <div class="bg-white py-2.5 px-4 border-t border-slate-200 flex items-center justify-end text-xs text-slate-600 gap-2">
          <!-- Ir a primera página -->
          <button
            type="button"
            @click="goToFirstMotorPage"
            :disabled="motorCurrentPage === 1"
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
            title="Primera página"
          >
            <ChevronsLeft class="w-4 h-4" />
          </button>

          <!-- Página anterior -->
          <button
            type="button"
            @click="goToPrevMotorPage"
            :disabled="motorCurrentPage === 1"
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
            title="Página anterior"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <!-- Indicador actual de página -->
          <span class="px-2 font-mono font-medium text-slate-700">
            {{ motorCurrentPage }} desde {{ motorTotalPages }}
          </span>

          <!-- Página siguiente -->
          <button
            type="button"
            @click="goToNextMotorPage"
            :disabled="motorCurrentPage === motorTotalPages"
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
            title="Página siguiente"
          >
            <ChevronRight class="w-4 h-4" />
          </button>

          <!-- Ir a última página -->
          <button
            type="button"
            @click="goToLastMotorPage"
            :disabled="motorCurrentPage === motorTotalPages"
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
            title="Última página"
          >
            <ChevronsRight class="w-4 h-4" />
          </button>
        </div>

      </div>

      <!-- Tarjetas de acceso a los 4 tipos de componente -->
      <div class="pt-2">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-black uppercase tracking-wider text-slate-700">
            O seleccione directamente el componente a rectificar o adaptar:
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            v-for="grp in componentGroups"
            :key="grp.id"
            @click="handleSelectComponent(grp)"
            class="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#04C4D9] hover:shadow-md cursor-pointer transition flex flex-col justify-between group"
          >
            <div>
              <div class="flex items-center gap-2 text-slate-900 group-hover:text-[#04C4D9] font-black text-xs sm:text-sm">
                <CircleDot v-if="grp.id === 'ajuste_valvula'" class="w-4 h-4 text-[#04C4D9]" />
                <Wrench v-else-if="grp.id === 'valvula'" class="w-4 h-4 text-[#04C4D9]" />
                <Layers v-else-if="grp.id === 'anillos_motor'" class="w-4 h-4 text-[#04C4D9]" />
                <FileText v-else class="w-4 h-4 text-[#04C4D9]" />
                <span>{{ grp.title }}</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                {{ grp.sampleMeasurements }}
              </p>
            </div>
            <div class="mt-3 pt-2 border-t border-slate-50 text-[10px] font-bold text-[#04C4D9] flex items-center justify-between">
              <span>Filtrar medidas</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 3: MOTOR Y/O COMPONENTE SELECCIONADOS -> TABLA TÉCNICA DE REPUESTOS -->
    <!-- ========================================================================= -->
    <div v-else class="space-y-4">
      
      <!-- Selector Rápido de Componentes (4 Botones Superiores) -->
      <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase tracking-wider text-slate-600">Componente:</span>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="grp in componentGroups"
              :key="grp.id"
              type="button"
              @click="handleSelectComponent(grp)"
              :class="[
                'px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5',
                selectedComponent?.id === grp.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              ]"
            >
              <CircleDot v-if="grp.id === 'ajuste_valvula'" class="w-3.5 h-3.5 text-[#04C4D9]" />
              <Wrench v-else-if="grp.id === 'valvula'" class="w-3.5 h-3.5 text-[#04C4D9]" />
              <Layers v-else-if="grp.id === 'anillos_motor'" class="w-3.5 h-3.5 text-[#04C4D9]" />
              <FileText v-else class="w-3.5 h-3.5 text-[#04C4D9]" />
              <span>{{ grp.title }}</span>
            </button>
          </div>
        </div>

        <!-- Botón para volver a la lista de motores -->
        <button
          v-if="selectedBrand"
          type="button"
          @click="activeViewTab = 'motores'"
          class="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
        >
          <ArrowLeft class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>Ver lista de motores de {{ selectedBrand.nombre }}</span>
        </button>
      </div>

      <!-- ======================================================================= -->
      <!-- BARRA DE FILTROS DE MEDIDAS TÉCNICAS (DIRECTAMENTE ADOSADA A LA TABLA)  -->
      <!-- NO SE TIENE QUE SUBIR LA PÁGINA PARA CAMBIAR MEDIDAS                    -->
      <!-- ======================================================================= -->
      <div v-if="selectedComponent" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <SlidersHorizontal class="w-4 h-4 text-[#04C4D9]" />
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-800">
              Medidas y Cotas para {{ selectedComponent.title }}
            </h4>
            <span v-if="activeMeasurementsCount > 0" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-[#038391]">
              {{ activeMeasurementsCount }} filtro(s) aplicado(s)
            </span>
          </div>

          <button
            v-if="activeMeasurementsCount > 0"
            type="button"
            @click="resetMeasurementsFilters"
            class="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <RotateCcw class="w-3 h-3" />
            <span>Limpiar filtros de medida</span>
          </button>
        </div>

        <!-- 1. FILTROS PARA: AJUSTE DE VÁLVULA -->
        <div v-if="selectedComponent.id === 'ajuste_valvula'" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Diám. int. (mm) <span class="text-slate-400 font-normal">ej. 4,8 mm</span>
            </label>
            <input
              v-model.number="filterSelloDiamInt"
              type="number"
              step="0.1"
              placeholder="ej. 4.8"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Diámetro exterior (mm) <span class="text-slate-400 font-normal">ej. 10,8 mm</span>
            </label>
            <input
              v-model.number="filterSelloDiamExt"
              type="number"
              step="0.1"
              placeholder="ej. 10.8"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Altura (mm) <span class="text-slate-400 font-normal">ej. 10 mm</span>
            </label>
            <input
              v-model.number="filterSelloAltura"
              type="number"
              step="0.1"
              placeholder="ej. 10.0"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>
        </div>

        <!-- 2. FILTROS PARA: VÁLVULA -->
        <div v-else-if="selectedComponent.id === 'valvula'" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Hongo (Ø cabeza mm) <span class="text-slate-400 font-normal">ej. 42.5</span>
            </label>
            <input
              v-model.number="filterValvulaHongo"
              type="number"
              step="0.1"
              placeholder="ej. 42.5"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Vástago (Ø vástago mm) <span class="text-slate-400 font-normal">ej. 8.0</span>
            </label>
            <input
              v-model.number="filterValvulaVastago"
              type="number"
              step="0.05"
              placeholder="ej. 8.0"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Altura (Longitud mm) <span class="text-slate-400 font-normal">ej. 103.5</span>
            </label>
            <input
              v-model.number="filterValvulaAltura"
              type="number"
              step="0.5"
              placeholder="ej. 103.5"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>
        </div>

        <!-- 3. FILTROS PARA: ANILLOS DE MOTOR -->
        <div v-else-if="selectedComponent.id === 'anillos_motor'" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Diámetro (Ø Cilindro mm) <span class="text-slate-400 font-normal">ej. 96.0</span>
            </label>
            <input
              v-model.number="filterAnilloDiametro"
              type="number"
              step="0.5"
              placeholder="ej. 96.0"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Grosor primer anillo (mm) <span class="text-slate-400 font-normal">ej. 2.0</span>
            </label>
            <input
              v-model.number="filterAnilloGrosor1"
              type="number"
              step="0.1"
              placeholder="ej. 2.0"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">
              Altura grosor (mm) <span class="text-slate-400 font-normal">ej. 2.0 ó 4.0</span>
            </label>
            <input
              v-model.number="filterAnilloAlturaGrosor"
              type="number"
              step="0.1"
              placeholder="ej. 2.0 ó 4.0"
              class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
            />
          </div>
        </div>

        <!-- 4. FILTROS PARA: JUEGO DE TORNILLOS DE CULATA -->
        <div v-else-if="selectedComponent.id === 'tornillos_culata'" class="space-y-2.5">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Medida de rosca</label>
              <select
                v-model="filterPernoMedidaRosca"
                class="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">Todas</option>
                <option value="M10">M10</option>
                <option value="M11">M11</option>
                <option value="M12">M12</option>
                <option value="M14">M14</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Paso de rosca mm</label>
              <input
                v-model.number="filterPernoPasoRosca"
                type="number"
                step="0.25"
                placeholder="ej. 1.25"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Long. mm</label>
              <input
                v-model.number="filterPernoLongitud"
                type="number"
                step="1"
                placeholder="ej. 120"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Cant.</label>
              <input
                v-model.number="filterPernoCantidad"
                type="number"
                step="1"
                placeholder="ej. 18"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2.5 pt-1 border-t border-slate-100">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Paso rosca 1 mm</label>
              <input
                v-model.number="filterPernoPasoRosca1"
                type="number"
                step="0.25"
                placeholder="ej. 1.25"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Long. 1 mm</label>
              <input
                v-model.number="filterPernoLongitud1"
                type="number"
                step="1"
                placeholder="ej. 120"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 mb-0.5">Long. 2 mm</label>
              <input
                v-model.number="filterPernoLongitud2"
                type="number"
                step="1"
                placeholder="ej. 120"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        <!-- Buscador de texto y filtro por catálogo -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div class="relative w-full sm:w-80">
            <input
              v-model="tableSearchFilter"
              type="text"
              placeholder="Buscar por código OEM o nombre..."
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#04C4D9]"
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
              <option value="Ajusa">Ajusa</option>
              <option value="Pioneer">Pioneer</option>
            </select>
          </div>
        </div>

      </div>

      <!-- TABLA TÉCNICA DE REPUESTOS EN FORMATO MATRIZ -->
      <!-- Con contenedor scrollable y thead sticky para no perder filtros al scrollear -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        <div class="bg-[#0f172a] text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold">
          <span class="flex items-center gap-2">
            <span>Matriz Técnica: {{ selectedComponent?.title }}</span>
            <span class="font-normal text-slate-400 font-mono">({{ displayedParts.length }} registros encontrados)</span>
          </span>
          <span v-if="selectedMotor" class="font-mono text-[#05F2F2]">
            MOTOR {{ selectedMotor.codigo }}
          </span>
        </div>

        <div class="overflow-x-auto overflow-y-auto max-h-[520px]">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px] shadow-2xs">
              <tr>
                <th class="py-3 px-3.5 w-56">Componente</th>
                <th class="py-3 px-3 w-36">Código OEM</th>
                <th class="py-3 px-3 w-56">Catálogos Alternos</th>
                
                <!-- Columna de Cotas específica por tipo de componente -->
                <th v-if="selectedComponent?.id === 'ajuste_valvula'" class="py-3 px-3">
                  Medidas de Ajuste: Diám. Int / Diám. Ext / Altura (mm)
                </th>
                <th v-else-if="selectedComponent?.id === 'valvula'" class="py-3 px-3">
                  Medidas de Válvula: Hongo / Vástago / Altura (mm)
                </th>
                <th v-else-if="selectedComponent?.id === 'anillos_motor'" class="py-3 px-3">
                  Medidas de Anillos: Diámetro / 1er Anillo / 2do Anillo / Aceite
                </th>
                <th v-else-if="selectedComponent?.id === 'tornillos_culata'" class="py-3 px-3">
                  Tornillos de Culata: Rosca / Paso / Longitud / Cantidad
                </th>
                <th v-else class="py-3 px-3">
                  Especificaciones Técnicas (mm)
                </th>

                <th class="py-3 px-3.5 w-32 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="part in displayedParts"
                :key="part.id"
                class="hover:bg-cyan-50/20 transition group"
              >
                <!-- 1. Componente -->
                <td class="py-3.5 px-3.5 align-middle">
                  <div class="flex items-center gap-2">
                    <span class="p-1.5 bg-slate-100 text-slate-700 rounded-lg group-hover:bg-[#04C4D9] group-hover:text-white transition">
                      <CircleDot v-if="selectedComponent?.id === 'ajuste_valvula'" class="w-4 h-4" />
                      <Wrench v-else-if="selectedComponent?.id === 'valvula'" class="w-4 h-4" />
                      <Layers v-else-if="selectedComponent?.id === 'anillos_motor'" class="w-4 h-4" />
                      <FileText v-else class="w-4 h-4" />
                    </span>
                    <div>
                      <div class="font-black text-slate-900 text-xs sm:text-sm leading-tight">
                        {{ part.nombre }}
                      </div>
                      <span class="text-[10px] font-bold text-[#038391] uppercase">
                        {{ part.subsistema }} • {{ part.catalogo_origen || 'Japón' }}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- 2. Código OEM -->
                <td class="py-3.5 px-3 align-middle">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-xs sm:text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {{ part.codigo_oem }}
                    </span>
                    <button
                      type="button"
                      @click="copyToClipboard(part.codigo_oem, 'OEM')"
                      class="p-1 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100 transition"
                      title="Copiar código OEM"
                    >
                      <Check v-if="copiedCode === part.codigo_oem" class="w-3.5 h-3.5 text-emerald-600" />
                      <Copy v-else class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

                <!-- 3. Códigos Alternos por Catálogo -->
                <td class="py-3.5 px-3 align-middle">
                  <div class="flex flex-wrap gap-1.5">
                    <template v-if="part.equivalencias && part.equivalencias.length > 0">
                      <span
                        v-for="eq in part.equivalencias"
                        :key="eq.id"
                        @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                        :class="[
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-mono cursor-pointer transition shadow-2xs hover:scale-105',
                          getBrandBadgeClass(eq.marca_alterna)
                        ]"
                        :title="`Clic para copiar código ${eq.marca_alterna}`"
                      >
                        <span class="font-sans text-[10px] uppercase opacity-90">{{ eq.marca_alterna }}:</span>
                        <strong>{{ eq.codigo_alterno }}</strong>
                      </span>
                    </template>
                    <span v-else class="text-[11px] text-slate-400 italic">
                      Sin equivalencias
                    </span>
                  </div>
                </td>

                <!-- 4. MEDIDAS Y COTAS (SEGMENTADAS SEGÚN REQUERIMIENTO DEL USUARIO) -->
                <td class="py-3.5 px-3 align-middle">
                  
                  <!-- Caso A: Ajuste de válvula (Diám. int, Diámetro exterior, Altura) -->
                  <div v-if="selectedComponent?.id === 'ajuste_valvula'" class="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs font-mono text-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Diám. int: <strong class="text-slate-900">{{ part.diametro_interior_mm || 4.8 }} mm</strong>
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Diámetro exterior: <strong class="text-slate-900">{{ part.diametro_exterior_mm || 10.8 }} mm</strong>
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Altura: <strong class="text-slate-900">{{ part.altura_mm || 10 }} mm</strong>
                    </span>
                  </div>

                  <!-- Caso B: Válvula (Hongo, Vástago, Altura) -->
                  <div v-else-if="selectedComponent?.id === 'valvula'" class="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs font-mono text-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Hongo: <strong class="text-slate-900">{{ part.diametro_cabeza_mm }} mm</strong>
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Vástago: <strong class="text-slate-900">{{ part.diametro_vastago_mm }} mm</strong>
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Altura: <strong class="text-slate-900">{{ part.longitud_total_mm }} mm</strong>
                    </span>
                  </div>

                  <!-- Caso C: Anillos de motor (DESGLOSE EXPLÍCITO: 1er anillo, 2do, aceite) -->
                  <div v-else-if="selectedComponent?.id === 'anillos_motor'" class="bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-xs font-mono text-slate-800 space-y-1.5">
                    <div class="flex items-center gap-2">
                      <span class="text-slate-500 font-sans font-bold text-[11px]">Diámetro cilindro:</span>
                      <strong class="text-slate-900 text-sm font-black">{{ part.diametro_cilindro_mm || 96.0 }} mm</strong>
                    </div>

                    <!-- Desglose explícito de los 3 anillos pedido por el usuario -->
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold text-[11px]">
                        1° Anillo (Fuego): {{ part.espesor_anillo1_mm || 2.0 }} mm
                      </span>
                      <span class="px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-900 border border-cyan-200 font-bold text-[11px]">
                        2° Anillo (Compresión): {{ part.espesor_anillo2_mm || 2.0 }} mm
                      </span>
                      <span class="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[11px]">
                        Anillo de Aceite: {{ part.espesor_aceite_mm || 4.0 }} mm
                      </span>
                    </div>
                  </div>

                  <!-- Caso D: Juego de tornillos de culata (Medida rosca, Paso, Longitud, Cantidad, Cotas 1 y 2) -->
                  <div v-else-if="selectedComponent?.id === 'tornillos_culata'" class="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs font-mono text-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Medida de rosca: <strong class="text-slate-900">{{ part.medida_rosca || 'M12' }}</strong>
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Paso: <strong class="text-slate-900">{{ part.paso_rosca_mm || 1.25 }} mm</strong>
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Longitud: <strong class="text-slate-900">{{ part.longitud_perno_mm || 120 }} mm</strong>
                    </span>
                    <span class="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-[#038391]">
                      Cant: {{ part.cantidad_piezas || 18 }} pcs
                    </span>
                    <span v-if="part.longitud1_mm" class="text-[10px] text-slate-500">
                      (Paso 1: {{ part.paso_rosca1_mm || 1.25 }}mm | Long 1: {{ part.longitud1_mm }}mm | Long 2: {{ part.longitud2_mm }}mm)
                    </span>
                  </div>

                </td>

                <!-- 5. Acciones Rápidas -->
                <td class="py-3.5 px-3.5 align-middle text-right space-y-1.5">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      @click="openTechnicalSheet(part)"
                      class="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                    >
                      <Eye class="w-3.5 h-3.5 text-slate-500" />
                      <span>Ficha</span>
                    </button>

                    <button
                      type="button"
                      @click="addToWorkOrder(part)"
                      :class="[
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1',
                        addedPartId === part.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#04C4D9] hover:bg-[#03a9bc] text-white'
                      ]"
                    >
                      <Check v-if="addedPartId === part.id" class="w-3.5 h-3.5" />
                      <Plus v-else class="w-3.5 h-3.5" />
                      <span>{{ addedPartId === part.id ? 'Listo' : 'A Orden' }}</span>
                    </button>
                  </div>

                  <div>
                    <button
                      type="button"
                      @click="copyFullCross(part)"
                      class="text-[10px] text-slate-400 hover:text-slate-800 transition font-medium flex items-center justify-end gap-1 ml-auto"
                    >
                      <Copy class="w-2.5 h-2.5" />
                      <span>Copiar Cruce</span>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="displayedParts.length === 0">
                <td colspan="5" class="py-12 text-center text-slate-400 bg-white">
                  <div class="max-w-md mx-auto space-y-2">
                    <AlertCircle class="w-8 h-8 text-slate-300 mx-auto" />
                    <h4 class="text-sm font-bold text-slate-700">No hay repuestos coincidentes con las medidas especificadas</h4>
                    <p class="text-xs text-slate-400">
                      Intente limpiar los filtros de medidas o ajustar las cotas micrométricas en la barra superior.
                    </p>
                    <button
                      type="button"
                      @click="resetMeasurementsFilters"
                      class="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                    >
                      Limpiar Filtros de Medida
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- MODAL DE INFORMACIÓN TÉCNICA DEL MOTOR (AL CLIC EN (i) DE LA TABLA)       -->
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
          <div class="bg-[#004b97] text-white px-5 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Info class="w-5 h-5 text-[#05F2F2]" />
              <h3 class="text-sm font-black text-white">
                Ficha Técnica: {{ getBrandName(selectedMotorInfoModal.fabricante_id) }} - {{ selectedMotorInfoModal.codigo }}
              </h3>
            </div>
            <button
              type="button"
              @click="closeMotorInfo"
              class="p-1 text-white/80 hover:text-white rounded-lg hover:bg-blue-900 transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-5 text-xs space-y-3 font-mono">
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

          <div class="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              @click="closeMotorInfo"
              class="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100"
            >
              Cerrar
            </button>
            <button
              type="button"
              @click="handleSelectMotor(selectedMotorInfoModal); closeMotorInfo()"
              class="px-4 py-1.5 rounded-xl bg-[#004b97] hover:bg-[#034ea2] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Check class="w-3.5 h-3.5" />
              <span>Seleccionar este Motor</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL DE FICHA TÉCNICA COMPLETA DE ARTÍCULO                               -->
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
          
          <div class="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-mono font-bold uppercase tracking-widest text-[#04C4D9] block">
                Ficha Técnica de Homologación & Taller
              </span>
              <h3 class="text-base sm:text-lg font-black text-white mt-0.5">
                {{ modalPart.nombre }}
              </h3>
            </div>
            <button
              type="button"
              @click="closeTechnicalSheet"
              class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono">
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Código OEM Original</span>
                <strong class="text-sm font-black text-slate-900">{{ modalPart.codigo_oem }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Subsistema</span>
                <strong class="text-sm font-black text-[#038391]">{{ modalPart.subsistema }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Categoría</span>
                <strong class="text-sm font-black text-slate-900">{{ modalPart.categoria }}</strong>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Equivalencias Cruzadas Multimarca
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  v-for="eq in modalPart.equivalencias"
                  :key="eq.id"
                  class="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <div class="flex items-center gap-2">
                    <span :class="['px-2 py-0.5 rounded text-[10px] uppercase font-bold', getBrandBadgeClass(eq.marca_alterna)]">
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
                    <Copy class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Especificaciones Métricas de Taller (mm)
              </h4>
              <table class="w-full border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 font-mono text-xs">
                <tbody>
                  <tr v-if="modalPart.diametro_interior_mm" class="bg-slate-50/50">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Diámetro Interior (Diám. int):</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_interior_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_exterior_mm">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Diámetro Exterior:</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_exterior_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.altura_mm" class="bg-slate-50/50">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Altura:</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.altura_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_cabeza_mm">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Hongo (Diámetro Cabeza):</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_cabeza_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_vastago_mm" class="bg-slate-50/50">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Vástago:</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_vastago_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.longitud_total_mm">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Altura / Longitud Total:</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.longitud_total_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_cilindro_mm" class="bg-slate-50/50">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Diámetro Cilindro:</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_cilindro_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_anillo1_mm">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">1° Anillo (Grosor / Fuego):</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_anillo1_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_anillo2_mm" class="bg-slate-50/50">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">2° Anillo (Compresión):</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_anillo2_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_aceite_mm">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Anillo de Aceite (Rascador):</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_aceite_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.medida_rosca" class="bg-slate-50/50">
                    <td class="py-2 px-3 text-slate-500 font-sans font-medium">Rosca y Paso:</td>
                    <td class="py-2 px-3 text-slate-900 font-bold text-right">{{ modalPart.medida_rosca }} x {{ modalPart.paso_rosca_mm || 1.25 }} mm</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          <div class="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              @click="copyFullCross(modalPart)"
              class="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5"
            >
              <Copy class="w-3.5 h-3.5" />
              <span>Copiar Ficha Completa</span>
            </button>

            <button
              type="button"
              @click="addToWorkOrder(modalPart); closeTechnicalSheet()"
              class="px-5 py-2 bg-[#04C4D9] hover:bg-[#03a9bc] text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition"
            >
              <Plus class="w-4 h-4" />
              <span>Agregar a Orden</span>
            </button>
          </div>

        </div>
      </div>
    </Transition>

  </div>
</template>
