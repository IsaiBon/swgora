<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  type Motor, 
  type RepuestoTecnico, 
  type Fabricante,
  mockFabricantes,
  mockMotores,
  mockRepuestos
} from '@/services/catalogService'
import JrLogo from '@/components/JrLogo.vue'
import { 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  Car, 
  Truck, 
  Wrench, 
  Ruler, 
  Star, 
  Copy, 
  CheckCircle2, 
  Mic, 
  Clock, 
  FileText, 
  Settings, 
  Globe
} from 'lucide-vue-next'

// =============================================================================
// ESTADO DE VISTAS (IMAGEN 1, IMAGEN 2, IMAGEN 3)
// =============================================================================
type ViewMode = 'home' | 'motor_groups' | 'parts_list' | 'adaptaciones'
const currentView = ref<ViewMode>('home')

// Feedback / Toast flotante
const toastMessage = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (msg: string) => {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 2200)
}

// Copiar al portapapeles
const copiedCode = ref<string | null>(null)
const copyToClipboard = async (text: string, label?: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedCode.value = text
    showToast(`Copiado: ${label ? `${label} ` : ''}${text}`)
    setTimeout(() => {
      if (copiedCode.value === text) copiedCode.value = null
    }, 1800)
  } catch {
    showToast(`Código: ${text}`)
  }
}

// Agregar repuesto a Orden de Trabajo
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
      category: part.subsistema,
      motor: part.motor?.codigo || activeMotor.value?.codigo || 'Universal',
      timestamp: Date.now()
    })
    localStorage.setItem('swgora_cart_parts', JSON.stringify(cart))
  } catch {
    // Silencioso
  }
  showToast(`✓ ${part.codigo_oem} agregado a la orden de trabajo`)
  setTimeout(() => {
    if (addedPartId.value === part.id) addedPartId.value = null
  }, 1800)
}

// =============================================================================
// MOTOR Y VEHÍCULO SELECCIONADO
// =============================================================================
const activeMotor = ref<Motor | null>(mockMotores[0])
const selectedBrandName = ref<string>('TOYOTA')
const isDetailsCollapsed = ref<boolean>(false)

// Categoría de vehículo superior
const activeVehicleCategory = ref<'motores' | 'turismos' | 'comerciales' | 'industriales'>('motores')

// =============================================================================
// MENÚS DE BÚSQUEDA INTERACTIVA (FABRICANTE, CÓDIGO DE MOTOR, GRUPO)
// =============================================================================

// 1. Fabricante (Searchable combobox)
const fabricanteInput = ref<string>('TOYOTA')
const isFabricanteOpen = ref<boolean>(false)
const filteredFabricantes = computed(() => {
  const q = fabricanteInput.value.toLowerCase().trim()
  if (!q) return mockFabricantes
  return mockFabricantes.filter(f => f.nombre.toLowerCase().includes(q))
})

const selectFabricante = (fab: Fabricante) => {
  fabricanteInput.value = fab.nombre.toUpperCase()
  selectedBrandName.value = fab.nombre.toUpperCase()
  isFabricanteOpen.value = false
  motorInput.value = ''
}

// 2. Código de Motor (Searchable combobox)
const motorInput = ref<string>('3L')
const isMotorOpen = ref<boolean>(false)
const availableMotores = computed(() => {
  const currentFab = mockFabricantes.find(f => f.nombre.toUpperCase() === selectedBrandName.value.toUpperCase())
  if (!currentFab) return mockMotores
  return mockMotores.filter(m => m.fabricante_id === currentFab.id)
})
const filteredMotores = computed(() => {
  const q = motorInput.value.toLowerCase().trim()
  if (!q) return availableMotores.value
  return availableMotores.value.filter(m => 
    m.codigo.toLowerCase().includes(q) || 
    (m.nombre_comercial && m.nombre_comercial.toLowerCase().includes(q))
  )
})

const selectMotor = (mot: Motor) => {
  activeMotor.value = mot
  motorInput.value = mot.codigo
  isMotorOpen.value = false
  const fab = mockFabricantes.find(f => f.id === mot.fabricante_id)
  if (fab) {
    selectedBrandName.value = fab.nombre.toUpperCase()
    fabricanteInput.value = fab.nombre.toUpperCase()
  }
}

// 3. Grupo del Producto (Searchable combobox)
const groupProductInput = ref<string>('Culata / Piezas de montaje')
const isGroupProductOpen = ref<boolean>(false)
const productGroupsList = [
  'Culata / Piezas de montaje',
  'Junta de culata',
  'Junta/guía/ajuste de válvulas',
  'Válvula de motor',
  'Tornillos de culata',
  'Bloque motor',
  'Anillos de pistón STD',
  'Accionamiento de cigüeñal',
  'Cojinetes de bancada MS',
  'Distribución del motor',
  'Juntas',
  'Lubricación'
]
const filteredProductGroups = computed(() => {
  const q = groupProductInput.value.toLowerCase().trim()
  if (!q) return productGroupsList
  return productGroupsList.filter(g => g.toLowerCase().includes(q))
})

const selectGroup = (groupName: string) => {
  groupProductInput.value = groupName
  isGroupProductOpen.value = false
}

// Botón Buscar principal
const handleSearchManual = () => {
  let foundMotor = mockMotores.find(m => m.codigo.toLowerCase() === motorInput.value.toLowerCase().trim())
  if (!foundMotor && availableMotores.value.length > 0) {
    foundMotor = availableMotores.value[0]
  } else if (!foundMotor) {
    foundMotor = mockMotores[0]
  }

  activeMotor.value = foundMotor
  const fab = mockFabricantes.find(f => f.id === foundMotor?.fabricante_id)
  if (fab) {
    selectedBrandName.value = fab.nombre.toUpperCase()
    fabricanteInput.value = fab.nombre.toUpperCase()
  }

  if (groupProductInput.value.trim()) {
    selectedGroupTitle.value = groupProductInput.value
    selectedSubitemFilter.value = groupProductInput.value
    currentView.value = 'parts_list'
  } else {
    currentView.value = 'motor_groups'
  }
}

// Botón Limpiar filtros
const handleResetManualFilters = () => {
  fabricanteInput.value = ''
  selectedBrandName.value = 'TOYOTA'
  motorInput.value = ''
  groupProductInput.value = ''
  showToast('Filtros restablecidos')
}

// =============================================================================
// BARRA SUPERIOR DE BÚSQUEDA GLOBAL
// =============================================================================
const topSearchType = ref<'grupos' | 'articulo'>('grupos')
const topSearchQuery = ref<string>('')
const isTopSearchOpen = ref<boolean>(false)

const topSuggestions = computed(() => {
  const q = topSearchQuery.value.trim().toLowerCase().replace(/[-\s]/g, '')
  if (!q || q.length < 2) return { motors: [], parts: [] }

  const motors = mockMotores.filter(m => 
    m.codigo.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
    m.nombre_comercial?.toLowerCase().includes(q)
  )

  const parts = mockRepuestos.filter(r => 
    r.codigo_oem.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
    r.nombre.toLowerCase().includes(q) ||
    r.equivalencias?.some(eq => eq.codigo_alterno.toLowerCase().replace(/[-\s]/g, '').includes(q))
  )

  return { motors: motors.slice(0, 4), parts: parts.slice(0, 6) }
})

const selectTopSuggestionMotor = (mot: Motor) => {
  selectMotor(mot)
  currentView.value = 'motor_groups'
  topSearchQuery.value = ''
  isTopSearchOpen.value = false
}

const selectTopSuggestionPart = (part: RepuestoTecnico) => {
  const mot = mockMotores.find(m => m.id === part.motor_id)
  if (mot) {
    activeMotor.value = mot
    const fab = mockFabricantes.find(f => f.id === mot.fabricante_id)
    if (fab) selectedBrandName.value = fab.nombre.toUpperCase()
  }
  selectedGroupTitle.value = part.subsistema
  selectedSubitemFilter.value = part.subsistema
  currentView.value = 'parts_list'
  topSearchQuery.value = ''
  isTopSearchOpen.value = false
}

// =============================================================================
// GRUPOS DE MONTAJE (IMAGEN 1: 6 TARJETAS TÉCNICAS)
// =============================================================================
interface AssemblyGroup {
  id: string
  title: string
  subitems: { name: string; filterKey: string }[]
}

const assemblyGroups: AssemblyGroup[] = [
  {
    id: 'ciguenal',
    title: 'Accionamiento de cigüeñal',
    subitems: [
      { name: 'Cigüeñal / piezas', filterKey: 'Cigüeñal' },
      { name: 'Retenes radiales/kit', filterKey: 'Sellos' },
      { name: 'Cojinetes de bancada MS', filterKey: 'Casquetería' },
      { name: 'Arandelas axiales TW', filterKey: 'Casquetería' }
    ]
  },
  {
    id: 'bloque',
    title: 'Bloque motor',
    subitems: [
      { name: 'Bloque motor', filterKey: 'Block' },
      { name: 'Camisas de cilindro', filterKey: 'Camisas' },
      { name: 'Anillos de pistón STD', filterKey: 'Anillos' }
    ]
  },
  {
    id: 'culata',
    title: 'Culata / Piezas de montaje',
    subitems: [
      { name: 'Junta de culata', filterKey: 'Empaques' },
      { name: 'Junta/guía/ajuste de válvulas', filterKey: 'Sellos' },
      { name: 'Junta/junta tórica del colector de admisión/esc...', filterKey: 'Empaques' },
      { name: 'Tapa de válvulas/junta', filterKey: 'Empaques' },
      { name: 'Tornillos de culata', filterKey: 'Pernos' },
      { name: 'Válvula de motor', filterKey: 'Válvulas' }
    ]
  },
  {
    id: 'distribucion',
    title: 'Distribución del motor',
    subitems: [
      { name: 'Árbol de levas/juego', filterKey: 'Culata' },
      { name: 'Cojinetes de leva SH', filterKey: 'Casquetería' }
    ]
  },
  {
    id: 'juntas',
    title: 'Juntas',
    subitems: [
      { name: 'Juego completo de juntas', filterKey: 'Empaques' },
      { name: 'Junta de bloque motor', filterKey: 'Empaques' },
      { name: 'Junta de colector de admisión', filterKey: 'Empaques' },
      { name: 'Junta de culata', filterKey: 'Empaques' },
      { name: 'Junta de cárter de aceite', filterKey: 'Empaques' },
      { name: 'Junta del sistema de aceite', filterKey: 'Empaques' }
    ]
  },
  {
    id: 'lubricacion',
    title: 'Lubricación',
    subitems: [
      { name: 'Cárter de aceite / piezas adicionales', filterKey: 'Culata' },
      { name: 'Cojinetes de biela CB', filterKey: 'Casquetería' },
      { name: 'Bocinas de biela PB', filterKey: 'Casquetería' }
    ]
  }
]

const selectedGroupTitle = ref<string>('Junta de culata')
const selectedSubitemFilter = ref<string>('')

const openGroupParts = (groupTitle: string, subitemName?: string, filterKey?: string) => {
  selectedGroupTitle.value = subitemName || groupTitle
  selectedSubitemFilter.value = filterKey || ''
  currentView.value = 'parts_list'
}

// =============================================================================
// LISTA DE PIEZAS DETALLADA (IMAGEN 2)
// =============================================================================
const selectedBrandFilterInTable = ref<string>('Todas las marcas')
const partsTableList = computed(() => {
  if (!activeMotor.value) return mockRepuestos

  let list = mockRepuestos.filter(r => r.motor_id === activeMotor.value?.id)

  if (selectedSubitemFilter.value) {
    const k = selectedSubitemFilter.value.toLowerCase()
    list = list.filter(r => 
      r.categoria.toLowerCase() === k || 
      r.subsistema.toLowerCase().includes(k) ||
      r.nombre.toLowerCase().includes(k)
    )
  }

  if (selectedBrandFilterInTable.value !== 'Todas las marcas') {
    const b = selectedBrandFilterInTable.value.toLowerCase()
    list = list.filter(r => 
      (r.catalogo_origen && r.catalogo_origen.toLowerCase() === b) ||
      r.equivalencias?.some(eq => eq.marca_alterna.toLowerCase() === b)
    )
  }

  if (list.length === 0) {
    list = mockRepuestos.filter(r => r.motor_id === activeMotor.value?.id)
  }

  return list
})

const clearActiveMotor = () => {
  activeMotor.value = null
  currentView.value = 'home'
}

// Banner Slider
const currentSlide = ref<number>(0)
const bannerSlides = [
  {
    title: 'Sellos de Válvula Vitón & Retenes Radiales',
    subtitle: 'Dokuro • Ajusa • Máxima resistencia térmica y sellado estanco',
    badge: 'Gama Estanqueidad 2026'
  },
  {
    title: 'Juntas de Culata Multilámina (MLS) y Grafito',
    subtitle: 'Espesores calibrados con tolerancias micrométricas para rectificación',
    badge: 'Calidad Equipo Original'
  },
  {
    title: 'Casquetería Japonesa NDC & Anillos RIK / NPR',
    subtitle: 'Bancadas MS, Bielas CB, Axiales TW y juegos de aros STD y sobremedida',
    badge: 'Rectificación de Precisión'
  }
]
let slideInterval: ReturnType<typeof setInterval> | null = null

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.combobox-container')) {
    isFabricanteOpen.value = false
    isMotorOpen.value = false
    isGroupProductOpen.value = false
    isTopSearchOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  slideInterval = setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % bannerSlides.length
  }, 5000)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (slideInterval) clearInterval(slideInterval)
})
</script>

<template>
  <div class="bg-slate-50 min-h-screen text-slate-800 flex flex-col font-sans select-none">
    
    <!-- Toast Flotante -->
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
        class="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 text-xs font-bold"
      >
        <CheckCircle2 class="w-4 h-4 text-[#04c4d9]" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- 1. BARRA SUPERIOR CON COLORES DE SWGORA (BLANCO / SLATE / CYAN #04c4d9)   -->
    <!-- ========================================================================= -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      
      <!-- Fila Superior: Logo SWGORA + Buscador Central + Iconos -->
      <div class="max-w-[1440px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        
        <!-- Logo e Identidad SWGORA / JR BLANCO -->
        <div class="flex items-center gap-2.5 cursor-pointer" @click="currentView = 'home'">
          <JrLogo :size="32" />
          <div class="flex flex-col leading-none">
            <span class="text-xs font-black tracking-tight text-slate-900">JR BLANCO</span>
            <span class="text-[9px] text-[#04c4d9] font-mono font-bold tracking-widest mt-0.5">SWGORA</span>
          </div>
        </div>

        <!-- Buscador Central -->
        <div class="flex-1 max-w-2xl relative combobox-container">
          <div class="flex items-center bg-slate-50 hover:bg-white focus-within:bg-white rounded-xl overflow-hidden shadow-2xs text-slate-800 border border-slate-200 focus-within:border-[#04c4d9] focus-within:ring-2 focus-within:ring-[#04c4d9]/20 transition">
            
            <button
              type="button"
              @click="topSearchType = topSearchType === 'grupos' ? 'articulo' : 'grupos'"
              class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-r border-slate-200 shrink-0"
            >
              <span>{{ topSearchType === 'grupos' ? 'Búsqueda por grupos' : 'Búsqueda por artículo' }}</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
            </button>

            <input
              v-model="topSearchQuery"
              @focus="isTopSearchOpen = true"
              @input="isTopSearchOpen = true"
              type="text"
              placeholder="Búsqueda por grupos o código de artículo..."
              class="w-full px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent"
            />

            <button
              v-if="topSearchQuery"
              @click="topSearchQuery = ''"
              type="button"
              class="px-2 text-slate-400 hover:text-slate-600"
            >
              <X class="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              class="px-2.5 text-slate-400 hover:text-slate-600 hidden sm:block"
              title="Búsqueda por voz"
            >
              <Mic class="w-4 h-4" />
            </button>

            <!-- Botón Buscar en Cyan SWGORA -->
            <button
              type="button"
              @click="isTopSearchOpen = true"
              class="bg-[#04c4d9] hover:bg-[#03a9bc] text-white px-4 py-2.5 flex items-center justify-center shrink-0 transition"
              title="Buscar"
            >
              <Search class="w-4 h-4" />
            </button>
          </div>

          <!-- Sugerencias al escribir -->
          <div
            v-if="isTopSearchOpen && (topSuggestions.motors.length > 0 || topSuggestions.parts.length > 0)"
            class="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-80 overflow-y-auto text-slate-800"
          >
            <div v-if="topSuggestions.motors.length > 0" class="p-2 border-b border-slate-100">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 mb-1">
                Motores coincidentes
              </span>
              <div
                v-for="mot in topSuggestions.motors"
                :key="mot.id"
                @click="selectTopSuggestionMotor(mot)"
                class="px-3 py-1.5 hover:bg-cyan-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <strong class="text-slate-900 font-mono">{{ mot.codigo }}</strong>
                  <span class="text-slate-500 ml-1.5">{{ mot.nombre_comercial }}</span>
                </div>
                <span class="text-[10px] font-bold text-[#04c4d9]">{{ mot.combustible }}</span>
              </div>
            </div>

            <div v-if="topSuggestions.parts.length > 0" class="p-2">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 mb-1">
                Artículos coincidentes
              </span>
              <div
                v-for="part in topSuggestions.parts"
                :key="part.id"
                @click="selectTopSuggestionPart(part)"
                class="px-3 py-1.5 hover:bg-cyan-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <strong class="font-mono text-slate-900">{{ part.codigo_oem }}</strong>
                  <span class="text-slate-600 ml-2">{{ part.nombre }}</span>
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {{ part.catalogo_origen || 'Catálogo' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Iconos de Utilidad en Gris Suave -->
        <div class="flex items-center gap-3 text-slate-400 shrink-0">
          <button type="button" @click="currentView = 'home'" class="hover:text-slate-900 p-1" title="Inicio">
            <Clock class="w-4 h-4" />
          </button>
          <button type="button" @click="currentView = 'parts_list'" class="hover:text-slate-900 p-1" title="Catálogo">
            <FileText class="w-4 h-4" />
          </button>
          <button type="button" class="hover:text-slate-900 p-1" title="Idioma">
            <Globe class="w-4 h-4" />
          </button>
          <button type="button" class="hover:text-slate-900 p-1" title="Configuración">
            <Settings class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Fila de Categorías Vehiculares (Grafito #0D0D0D a juego con Sidebar SWGORA) -->
      <div class="bg-[#0D0D0D] border-t border-neutral-800">
        <div class="max-w-[1440px] mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto text-xs font-semibold py-1">
          
          <button
            type="button"
            @click="currentView = 'home'"
            class="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <span>⌂</span>
          </button>

          <button
            type="button"
            @click="activeVehicleCategory = 'turismos'; currentView = 'home'"
            :class="[
              'px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition',
              activeVehicleCategory === 'turismos' ? 'bg-neutral-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            ]"
          >
            <Car class="w-3.5 h-3.5" />
            <span>Turismos</span>
          </button>

          <button
            type="button"
            @click="activeVehicleCategory = 'industriales'; currentView = 'home'"
            :class="[
              'px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition',
              activeVehicleCategory === 'industriales' ? 'bg-neutral-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            ]"
          >
            <Truck class="w-3.5 h-3.5" />
            <span>Vehículos industriales</span>
          </button>

          <button
            type="button"
            @click="activeVehicleCategory = 'comerciales'; currentView = 'home'"
            :class="[
              'px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition',
              activeVehicleCategory === 'comerciales' ? 'bg-neutral-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            ]"
          >
            <span>Vehículos comerciales ligeros</span>
          </button>

          <!-- Pestaña Motores Activa con Acento Cyan -->
          <button
            type="button"
            @click="activeVehicleCategory = 'motores'; if (activeMotor) currentView = 'motor_groups'; else currentView = 'home'"
            :class="[
              'px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition font-bold',
              activeVehicleCategory === 'motores' ? 'bg-neutral-800 text-white border border-[#04c4d9]/50 shadow-xs' : 'text-slate-400 hover:text-white'
            ]"
          >
            <Wrench class="w-3.5 h-3.5 text-[#04c4d9]" />
            <span>Motores</span>
          </button>

          <button
            type="button"
            @click="currentView = 'adaptaciones'"
            :class="[
              'px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition ml-auto font-bold',
              currentView === 'adaptaciones' ? 'bg-neutral-800 text-[#04c4d9] border border-[#04c4d9]/50' : 'text-[#04c4d9] hover:text-cyan-300'
            ]"
          >
            <Ruler class="w-3.5 h-3.5" />
            <span>Por Medidas (Adaptaciones)</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ========================================================================= -->
    <!-- 2. BARRAS DE SUB-NAVEGACIÓN / BREADCRUMBS                                  -->
    <!-- ========================================================================= -->
    <div v-if="currentView === 'motor_groups' || currentView === 'parts_list'" class="bg-white border-b border-slate-200 shadow-2xs">
      <div class="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
        
        <!-- Breadcrumbs -->
        <div class="flex items-center gap-2 text-slate-600 font-medium overflow-x-auto">
          <button
            type="button"
            @click="currentView === 'parts_list' ? (currentView = 'motor_groups') : (currentView = 'home')"
            class="p-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            title="Volver"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <span class="cursor-pointer hover:text-slate-900" @click="currentView = 'home'">Motores</span>
          <span class="text-slate-300">/</span>
          <span class="cursor-pointer hover:text-slate-900 font-bold text-slate-800" @click="currentView = 'motor_groups'">
            {{ selectedBrandName }}
          </span>
          <span class="text-slate-300">/</span>
          <span class="font-bold text-[#04c4d9] font-mono cursor-pointer" @click="currentView = 'motor_groups'">
            {{ activeMotor?.codigo }}
          </span>
          <template v-if="currentView === 'parts_list'">
            <span class="text-slate-300">/</span>
            <span class="font-bold text-slate-900">{{ selectedGroupTitle }}</span>
          </template>
        </div>

        <!-- Filtros Superiores -->
        <div class="flex items-center gap-2 text-xs shrink-0">
          <select
            v-if="currentView === 'parts_list'"
            v-model="selectedGroupTitle"
            class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-[#04c4d9]"
          >
            <option value="Junta de culata">Junta de culata [Culata / Piezas de montaje]</option>
            <option value="Válvula de motor">Válvula de motor</option>
            <option value="Tornillos de culata">Tornillos de culata</option>
            <option value="Anillos de pistón STD">Anillos de pistón STD</option>
            <option value="Cojinetes de bancada MS">Cojinetes de bancada MS</option>
            <option value="Cojinetes de biela CB">Cojinetes de biela CB</option>
          </select>

          <select
            v-else
            class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none"
          >
            <option>Todos los grupos de montaje</option>
          </select>

          <select
            v-model="selectedBrandFilterInTable"
            class="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none"
          >
            <option value="Todas las marcas">Todas las marcas</option>
            <option value="Ajusa">Ajusa</option>
            <option value="Dokuro">Dokuro</option>
            <option value="Rik">Rik</option>
            <option value="NPR">NPR</option>
            <option value="NDC">NDC</option>
            <option value="Pioneer">Pioneer</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. CUERPO PRINCIPAL                                                       -->
    <!-- ========================================================================= -->
    <main class="flex-1 max-w-[1440px] mx-auto w-full px-3 sm:px-6 py-4">

      <!-- ======================================================================= -->
      <!-- CASO A: IMAGEN 3 - MENÚ DE INICIO / BÚSQUEDA MANUAL                       -->
      <!-- SOLO: Fabricante, Código de motor, Grupo del producto                     -->
      <!-- ======================================================================= -->
      <div v-if="currentView === 'home'" class="space-y-4">
        
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          <!-- Bloque Izquierdo: Formulario Simplificado -->
          <div class="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            
            <!-- Pestañas Superiores -->
            <div class="flex items-center border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
              <button
                type="button"
                class="px-4 py-2.5 border-b-2 border-[#04c4d9] bg-white text-slate-900 flex items-center gap-1.5"
              >
                <span>Búsqueda manual</span>
              </button>
              <button
                type="button"
                @click="showToast('Identificación por Bastidor / Matrícula')"
                class="px-4 py-2.5 text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
              >
                <span>Identificación del vehículo</span>
              </button>
            </div>

            <!-- Fila de Iconos de Tipo de Vehículo -->
            <div class="grid grid-cols-4 border-b border-slate-200 text-center bg-white">
              <button type="button" class="py-2.5 border-r border-slate-200 bg-slate-900 text-[#04c4d9] flex justify-center">
                <Car class="w-5 h-5" />
              </button>
              <button type="button" class="py-2.5 border-r border-slate-200 text-slate-600 hover:bg-slate-50 flex justify-center">
                <Truck class="w-5 h-5" />
              </button>
              <button type="button" class="py-2.5 border-r border-slate-200 text-slate-600 hover:bg-slate-50 flex justify-center">
                <Wrench class="w-5 h-5" />
              </button>
              <button type="button" class="py-2.5 text-slate-600 hover:bg-slate-50 flex justify-center">
                <Globe class="w-5 h-5" />
              </button>
            </div>

            <!-- FORMULARIO LIMPIO: SOLO FABRICANTE, CÓDIGO DE MOTOR Y GRUPO -->
            <div class="p-4 sm:p-6 space-y-4">
              
              <!-- 1. Fabricante -->
              <div class="relative combobox-container">
                <label class="block text-xs font-bold text-slate-700 mb-1">Fabricante</label>
                <div class="flex items-center">
                  <div class="relative flex-1">
                    <input
                      v-model="fabricanteInput"
                      @focus="isFabricanteOpen = true"
                      @input="isFabricanteOpen = true"
                      type="text"
                      placeholder="Fabricante"
                      class="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 rounded-l-lg focus:outline-none focus:border-[#04c4d9] focus:ring-1 focus:ring-[#04c4d9]"
                    />
                    <ChevronDown
                      @click="isFabricanteOpen = !isFabricanteOpen"
                      class="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    @click="isFabricanteOpen = !isFabricanteOpen"
                    class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-l-0 border-slate-300 px-3.5 py-2.5 rounded-r-lg flex items-center justify-center shrink-0 transition"
                  >
                    <Search class="w-4 h-4" />
                  </button>
                </div>

                <!-- Dropdown Fabricantes -->
                <div
                  v-if="isFabricanteOpen"
                  class="absolute left-0 right-10 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto"
                >
                  <div
                    v-for="fab in filteredFabricantes"
                    :key="fab.id"
                    @click="selectFabricante(fab)"
                    class="px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-50 last:border-0"
                  >
                    <span>{{ fab.nombre.toUpperCase() }}</span>
                    <span class="text-[10px] text-slate-400 font-normal">{{ fab.engines_count }} motores</span>
                  </div>
                  <div v-if="filteredFabricantes.length === 0" class="p-2 text-center text-xs text-slate-400">
                    No se encontró fabricante
                  </div>
                </div>
              </div>

              <!-- 2. Código de Motor -->
              <div class="relative combobox-container">
                <label class="block text-xs font-bold text-slate-700 mb-1">Código de motor</label>
                <div class="flex items-center">
                  <div class="relative flex-1">
                    <input
                      v-model="motorInput"
                      @focus="isMotorOpen = true"
                      @input="isMotorOpen = true"
                      type="text"
                      placeholder="Código de motor"
                      class="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold bg-white border border-slate-300 rounded-l-lg focus:outline-none focus:border-[#04c4d9] focus:ring-1 focus:ring-[#04c4d9]"
                    />
                    <ChevronDown
                      @click="isMotorOpen = !isMotorOpen"
                      class="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    @click="motorInput = ''"
                    class="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-l-0 border-slate-300 px-3.5 py-2.5 rounded-r-lg flex items-center justify-center shrink-0 transition"
                    title="Limpiar"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>

                <!-- Dropdown Motores -->
                <div
                  v-if="isMotorOpen"
                  class="absolute left-0 right-10 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto"
                >
                  <div
                    v-for="mot in filteredMotores"
                    :key="mot.id"
                    @click="selectMotor(mot)"
                    class="px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs flex items-center justify-between border-b border-slate-50 last:border-0"
                  >
                    <div>
                      <strong class="text-slate-900 font-mono text-sm">{{ mot.codigo }}</strong>
                      <span class="text-slate-600 ml-2 font-medium">{{ mot.nombre_comercial }}</span>
                    </div>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {{ mot.combustible }}
                    </span>
                  </div>
                  <div v-if="filteredMotores.length === 0" class="p-2 text-center text-xs text-slate-400">
                    No coincide ningún código de motor
                  </div>
                </div>
              </div>

              <!-- 3. Grupo del Producto -->
              <div class="relative combobox-container">
                <label class="block text-xs font-bold text-slate-700 mb-1">Grupo de productos</label>
                <div class="flex items-center">
                  <div class="relative flex-1">
                    <input
                      v-model="groupProductInput"
                      @focus="isGroupProductOpen = true"
                      @input="isGroupProductOpen = true"
                      type="text"
                      placeholder="Grupo de productos"
                      class="w-full px-3 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-l-lg focus:outline-none focus:border-[#04c4d9] focus:ring-1 focus:ring-[#04c4d9]"
                    />
                    <ChevronDown
                      @click="isGroupProductOpen = !isGroupProductOpen"
                      class="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    @click="isGroupProductOpen = !isGroupProductOpen"
                    class="bg-[#04c4d9] hover:bg-[#03a9bc] text-white px-3.5 py-2.5 rounded-r-lg flex items-center justify-center shrink-0 transition"
                  >
                    <Search class="w-4 h-4" />
                  </button>
                </div>

                <!-- Dropdown Grupos -->
                <div
                  v-if="isGroupProductOpen"
                  class="absolute left-0 right-10 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto"
                >
                  <div
                    v-for="grp in filteredProductGroups"
                    :key="grp"
                    @click="selectGroup(grp)"
                    class="px-3 py-2 hover:bg-cyan-50 cursor-pointer text-xs font-semibold text-slate-800 border-b border-slate-50 last:border-0"
                  >
                    {{ grp }}
                  </div>
                </div>
              </div>

              <!-- Botones de Acción (Cyan SWGORA) -->
              <div class="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  @click="handleResetManualFilters"
                  class="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold transition"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  @click="handleSearchManual"
                  class="px-6 py-2 rounded-xl bg-[#04c4d9] hover:bg-[#03a9bc] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <Search class="w-3.5 h-3.5" />
                  <span>Buscar</span>
                </button>
              </div>

              <!-- Pestañas Inferiores -->
              <div class="pt-3 flex items-center gap-2 border-t border-slate-100 text-xs">
                <button type="button" class="px-3 py-1 bg-slate-900 text-white font-bold rounded-lg flex items-center gap-1">
                  <span>Todos</span>
                </button>
                <button type="button" class="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg">
                  Artículo universal
                </button>
                <button type="button" class="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg">
                  Listas de verificación
                </button>
              </div>
            </div>
          </div>

          <!-- Bloque Derecho: Slider Técnico con Paleta SWGORA (Graphite / Cyan) -->
          <div class="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between p-6 relative">
            
            <div class="space-y-3 z-10">
              <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-50 text-[#04c4d9] border border-cyan-200">
                {{ bannerSlides[currentSlide].badge }}
              </span>

              <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {{ bannerSlides[currentSlide].title }}
              </h2>

              <p class="text-xs text-slate-600 leading-relaxed">
                {{ bannerSlides[currentSlide].subtitle }}
              </p>
            </div>

            <!-- Gráfico Concétrico Técnico en Grafito y Cyan -->
            <div class="my-6 flex items-center justify-center relative py-4">
              <div class="w-48 h-48 rounded-full border-8 border-slate-200 bg-slate-50 flex items-center justify-center shadow-md relative">
                <div class="w-36 h-36 rounded-full border-4 border-slate-700 bg-[#0D0D0D] flex items-center justify-center">
                  <div class="w-24 h-24 rounded-full border-2 border-dashed border-[#04c4d9] flex items-center justify-center text-center p-2">
                    <span class="text-[10px] font-mono text-[#04c4d9] font-bold leading-tight">
                      SWGORA JR BLANCO
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between z-10 pt-2 border-t border-slate-100">
              <div class="flex items-center gap-1.5">
                <span
                  v-for="(_, idx) in bannerSlides"
                  :key="idx"
                  @click="currentSlide = idx"
                  :class="[
                    'h-1.5 rounded-full transition-all cursor-pointer',
                    currentSlide === idx ? 'w-6 bg-[#04c4d9]' : 'w-2 bg-slate-300'
                  ]"
                ></span>
              </div>

              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="currentSlide = (currentSlide - 1 + bannerSlides.length) % bannerSlides.length"
                  class="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                >
                  <ChevronLeft class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  @click="currentSlide = (currentSlide + 1) % bannerSlides.length"
                  class="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                >
                  <ChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================================================= -->
      <!-- CASO B: IMAGEN 1 & 2 - PANELES CON SIDEBAR IZQUIERDO Y MATRIZ           -->
      <!-- ======================================================================= -->
      <div v-else-if="currentView === 'motor_groups' || currentView === 'parts_list'" class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        <!-- SIDEBAR IZQUIERDO: SELECCIÓN ACTUAL & DETALLES DEL MOTOR -->
        <aside class="lg:col-span-3 space-y-4">
          
          <!-- Tarjeta 1: Selección actual -->
          <div class="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div class="bg-slate-50 px-3.5 py-2 border-b border-slate-200 text-xs font-bold text-slate-900">
              Selección actual
            </div>

            <div class="p-4 text-center space-y-3">
              <div class="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center p-2 shadow-2xs">
                <JrLogo :size="40" />
              </div>

              <!-- Badge [ TOYOTA - 3L | X ] -->
              <div class="flex items-center rounded-lg overflow-hidden shadow-2xs border border-slate-800">
                <div class="bg-slate-900 text-[#04c4d9] flex-1 py-1.5 px-3 text-xs font-mono font-black tracking-wide text-left">
                  {{ selectedBrandName }} - {{ activeMotor?.codigo }}
                </div>
                <button
                  type="button"
                  @click="clearActiveMotor"
                  class="bg-slate-800 hover:bg-rose-600 text-white px-2.5 py-1.5 flex items-center justify-center transition"
                  title="Eliminar selección y volver"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Tarjeta 2: Detalles del motor -->
          <div class="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div
              @click="isDetailsCollapsed = !isDetailsCollapsed"
              class="bg-slate-50 px-3.5 py-2 border-b border-slate-200 text-xs font-bold text-slate-900 flex items-center justify-between cursor-pointer"
            >
              <span>Detalles del motor</span>
              <ChevronUp v-if="!isDetailsCollapsed" class="w-4 h-4 text-slate-500" />
              <ChevronDown v-else class="w-4 h-4 text-slate-500" />
            </div>

            <div v-if="!isDetailsCollapsed" class="p-3 text-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Datos técnicos
              </span>

              <table class="w-full text-[11px] divide-y divide-slate-100">
                <tbody>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Fabricante</td>
                    <td class="py-1 text-slate-900 font-bold text-right">{{ selectedBrandName }}</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Código de motor</td>
                    <td class="py-1 text-[#04c4d9] font-mono font-bold text-right">{{ activeMotor?.codigo }}</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Potencia</td>
                    <td class="py-1 text-slate-900 text-right">57 kW / 77 CV</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Cilindrada</td>
                    <td class="py-1 text-slate-900 text-right">{{ activeMotor?.cilindrada_cc || '2779' }} cc / 2.8 l</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Cilindros</td>
                    <td class="py-1 text-slate-900 text-right">{{ activeMotor?.cilindros || 4 }}</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Válvulas</td>
                    <td class="py-1 text-slate-900 text-right">{{ activeMotor?.valvulas || 8 }}</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Control de válvulas</td>
                    <td class="py-1 text-slate-900 text-right">{{ activeMotor?.configuracion || 'SOHC' }}</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Tipo de motor</td>
                    <td class="py-1 text-slate-900 text-right">{{ activeMotor?.combustible === 'Diésel' ? 'Gasóleo' : 'Gasolina' }}</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Tipo de combustible</td>
                    <td class="py-1 text-slate-900 text-right">{{ activeMotor?.combustible === 'Diésel' ? 'Gasóleo' : 'Gasolina' }}</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Procesamiento</td>
                    <td class="py-1 text-slate-900 text-right">Motor con cámara auxiliar</td>
                  </tr>
                  <tr>
                    <td class="py-1 text-slate-500 font-medium">Carga</td>
                    <td class="py-1 text-slate-900 text-right">{{ activeMotor?.aspiracion || 'Aspirado' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </aside>

        <!-- PANEL PRINCIPAL -->
        <section class="lg:col-span-9 space-y-4">
          
          <!-- CASO B.1: IMAGEN 1 - VISTA DE GRUPOS DE MONTAJE -->
          <div v-if="currentView === 'motor_groups'" class="space-y-3">
            
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-4 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-900 shadow-2xs flex items-center gap-2"
                >
                  <span>Panel de información</span>
                  <div class="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded">
                    <span class="w-3.5 h-3.5 bg-slate-900 text-white rounded-xs flex items-center justify-center text-[9px]">■</span>
                    <span class="w-3.5 h-3.5 text-slate-400 flex items-center justify-center text-[9px]">≡</span>
                  </div>
                </button>

                <button
                  type="button"
                  class="px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-xs text-slate-600 hover:bg-slate-50"
                >
                  Aplicaciones del vehículo
                </button>
              </div>
            </div>

            <!-- Cuadrícula de 6 Grupos de Montaje (Imagen 1) -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="grp in assemblyGroups"
                :key="grp.id"
                class="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-[#04c4d9] hover:shadow-md transition flex flex-col justify-between min-h-[170px] relative overflow-hidden"
              >
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div
                      @click="openGroupParts(grp.title)"
                      class="flex items-center gap-1.5 font-bold text-sm text-slate-900 cursor-pointer hover:text-[#04c4d9]"
                    >
                      <Wrench class="w-4 h-4 text-[#04c4d9]" />
                      <span>{{ grp.title }}</span>
                    </div>
                    <button type="button" class="text-slate-300 hover:text-amber-500">
                      <Star class="w-4 h-4" />
                    </button>
                  </div>

                  <ul class="mt-3 space-y-1.5 text-xs">
                    <li
                      v-for="sub in grp.subitems"
                      :key="sub.name"
                      @click="openGroupParts(grp.title, sub.name, sub.filterKey)"
                      class="text-slate-700 hover:text-[#04c4d9] cursor-pointer flex items-center gap-1.5 transition group"
                    >
                      <span class="text-[#04c4d9] font-black text-[10px] group-hover:translate-x-0.5 transition">▸</span>
                      <span class="group-hover:underline">{{ sub.name }}</span>
                    </li>
                  </ul>
                </div>

                <div class="absolute right-2 bottom-1 text-slate-100 pointer-events-none -z-0">
                  <div class="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center font-black text-xs">
                    JR
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CASO B.2: IMAGEN 2 - TABLA DETALLADA DE PIEZAS -->
          <div v-else-if="currentView === 'parts_list'" class="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            
            <div class="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-[#04c4d9]"></span>
                {{ selectedGroupTitle }}
              </span>
              <div class="flex items-center gap-3">
                <span class="font-normal text-slate-300">
                  Resultado 1 - {{ partsTableList.length }} desde {{ partsTableList.length }}
                </span>
                <div class="flex items-center gap-1">
                  <span class="px-1 bg-slate-800 rounded text-[10px]">≡</span>
                  <span class="px-1 text-slate-400 text-[10px]">v</span>
                </div>
              </div>
            </div>

            <!-- Tabla de Artículos Exacta a Imagen 2 -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-[#f8fafc] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th class="py-2.5 px-3 w-8">
                      <input type="checkbox" class="rounded" />
                    </th>
                    <th class="py-2.5 px-4 w-44">Número de artículo</th>
                    <th class="py-2.5 px-4 w-36 text-center">Foto</th>
                    <th class="py-2.5 px-4">Denominación</th>
                    <th class="py-2.5 px-4 w-32 text-right">Estado del artículo</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="part in partsTableList"
                    :key="part.id"
                    class="hover:bg-cyan-50/30 transition"
                  >
                    <td class="py-3 px-3 align-top">
                      <input type="checkbox" class="rounded" />
                    </td>

                    <td class="py-3 px-4 align-top">
                      <div class="font-mono font-bold text-sm text-slate-900 hover:text-[#04c4d9]">
                        {{ part.equivalencias?.[0]?.codigo_alterno || part.codigo_oem }}
                      </div>
                      <div class="text-[10px] text-slate-400 mt-0.5">
                        OEM: <span class="font-mono">{{ part.codigo_oem }}</span>
                      </div>
                      <button
                        type="button"
                        @click="copyToClipboard(part.equivalencias?.[0]?.codigo_alterno || part.codigo_oem, 'Código')"
                        class="text-[10px] text-slate-400 hover:text-slate-800 flex items-center gap-1 mt-1 font-medium"
                      >
                        <Copy class="w-2.5 h-2.5" />
                        <span>Copiar</span>
                      </button>
                    </td>

                    <td class="py-3 px-4 align-top text-center">
                      <div class="w-28 h-14 bg-slate-50 border border-slate-200 rounded-lg p-1 mx-auto flex items-center justify-center">
                        <svg viewBox="0 0 160 40" class="w-full h-full text-slate-800">
                          <rect x="2" y="4" width="156" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2" />
                          <circle cx="28" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2" />
                          <circle cx="62" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2" />
                          <circle cx="96" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2" />
                          <circle cx="130" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2" />
                          <circle cx="10" cy="10" r="2" fill="currentColor" />
                          <circle cx="150" cy="10" r="2" fill="currentColor" />
                          <circle cx="10" cy="30" r="2" fill="currentColor" />
                          <circle cx="150" cy="30" r="2" fill="currentColor" />
                        </svg>
                      </div>
                    </td>

                    <td class="py-3 px-4 align-top space-y-1">
                      <div class="flex items-center gap-1.5">
                        <strong class="text-sm font-black text-slate-900 uppercase">
                          {{ part.catalogo_origen || part.equivalencias?.[0]?.marca_alterna || 'AJUSA' }}
                        </strong>
                        <span class="text-[10px] text-amber-500 font-bold">✔</span>
                        <span class="text-[10px] font-bold text-slate-500 uppercase">
                          {{ part.dimensiones?.tipo || 'MULTILAYER STEEL' }}
                        </span>
                      </div>

                      <div class="font-bold text-slate-800 text-xs">
                        {{ part.nombre }}
                      </div>

                      <div class="text-[11px] font-mono text-slate-600">
                        <template v-if="part.categoria === 'Empaques'">
                          Ø: <strong>{{ part.diametro_cilindro_mm || 97 }} mm</strong>; 
                          Espesor: <strong>{{ part.dimensiones?.espesor_mm || 1.45 }} mm</strong>; 
                          sólo con: 81014300
                        </template>
                        <template v-else-if="part.categoria === 'Sellos'">
                          Ø Interior: <strong>{{ part.diametro_interior_mm }} mm</strong>; 
                          Ø Exterior: <strong>{{ part.diametro_exterior_mm }} mm</strong>; 
                          Altura: <strong>{{ part.altura_mm }} mm</strong>
                        </template>
                        <template v-else-if="part.categoria === 'Anillos'">
                          Ø Cilindro: <strong>{{ part.diametro_cilindro_mm }} mm</strong>; 
                          Ranuras: 1°: {{ part.espesor_anillo1_mm }}mm | 2°: {{ part.espesor_anillo2_mm }}mm | Aceite: {{ part.espesor_aceite_mm }}mm
                        </template>
                        <template v-else-if="part.categoria === 'Pernos'">
                          Rosca: <strong>{{ part.medida_rosca }} x {{ part.paso_rosca_mm }}</strong>; 
                          Longitud: <strong>{{ part.longitud_perno_mm }} mm</strong> ({{ part.cantidad_piezas }} piezas)
                        </template>
                        <template v-else-if="part.categoria === 'Válvulas'">
                          Hongo: <strong>{{ part.diametro_cabeza_mm }} mm</strong>; 
                          Vástago: <strong>{{ part.diametro_vastago_mm }} mm</strong>; 
                          Largo: <strong>{{ part.longitud_total_mm }} mm</strong>
                        </template>
                      </div>

                      <div class="text-[10px] text-slate-400">
                        Unidad de embalaje: 1 • Precio taller: ${{ part.precio.toFixed(2) }}
                      </div>
                    </td>

                    <td class="py-3 px-4 align-top text-right space-y-2">
                      <span class="inline-block text-xs font-bold text-slate-700">
                        Normal
                      </span>
                      <div>
                        <button
                          type="button"
                          @click="addToWorkOrder(part)"
                          :class="[
                            'px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-2xs',
                            addedPartId === part.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#04c4d9] hover:bg-[#03a9bc] text-white'
                          ]"
                        >
                          <span v-if="addedPartId === part.id">✓ Agregado</span>
                          <span v-else>+ A Orden</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <tr v-if="partsTableList.length === 0">
                    <td colspan="5" class="py-10 text-center text-slate-400">
                      No se encontraron artículos en este grupo.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="bg-[#f8fafc] px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                @click="currentView = 'motor_groups'"
                class="font-bold text-[#04c4d9] hover:underline flex items-center gap-1"
              >
                <span>« Volver a grupos de montaje</span>
              </button>

              <div class="flex items-center gap-1 font-mono">
                <span>1 desde 1</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ======================================================================= -->
      <!-- CASO C: BÚSQUEDA POR MEDIDAS (ADAPTACIONES TALLER SIN CÓDIGO)             -->
      <!-- ======================================================================= -->
      <div v-else-if="currentView === 'adaptaciones'" class="space-y-4">
        
        <div class="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 class="text-base font-black text-slate-900">
                Motor de Adaptaciones Dimensionales de Taller (Sin código de motor)
              </h2>
              <p class="text-xs text-slate-500">
                Localiza repuestos por cotas en milímetros (mm) cuando la pieza está desgastada o sin código.
              </p>
            </div>
            <button
              type="button"
              @click="currentView = 'home'"
              class="text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg"
            >
              Volver al inicio
            </button>
          </div>

          <div class="p-4 bg-cyan-50 border border-cyan-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <strong class="text-xs text-cyan-900 block font-bold">Muestra de taller comprobada:</strong>
              <span class="text-xs text-cyan-800">Sello de válvula 4.8 mm x 10.8 mm x 10.0 mm (Dokuro SV-108 / Ajusa 12014500)</span>
            </div>
            <button
              type="button"
              @click="openGroupParts('Culata / Piezas de montaje', 'Junta/guía/ajuste de válvulas', 'Sellos')"
              class="px-3.5 py-1.5 rounded-xl bg-[#04c4d9] hover:bg-[#03a9bc] text-white text-xs font-bold transition shadow-xs"
            >
              Ver piezas compatibles
            </button>
          </div>
        </div>
      </div>

    </main>

    <!-- ========================================================================= -->
    <!-- 4. FOOTER SWGORA LIMPIO                                                   -->
    <!-- ========================================================================= -->
    <footer class="bg-white border-t border-slate-200 text-xs py-3 mt-auto">
      <div class="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-400 text-[11px]">
        <div class="flex items-center gap-4">
          <span class="hover:text-slate-700 cursor-pointer">▶ Google Play</span>
          <span class="hover:text-slate-700 cursor-pointer"> App Store</span>
          <span class="hover:text-slate-700 cursor-pointer">Política de privacidad</span>
          <span class="hover:text-slate-700 cursor-pointer">Aviso legal</span>
        </div>
        <div>
          JR Blanco • Sistema SWGORA © 2026
        </div>
      </div>
    </footer>
  </div>
</template>
