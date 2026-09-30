<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  type Motor, 
  type RepuestoTecnico, 
  mockMotores, 
  mockRepuestos 
} from '@/services/catalogService'
import { 
  Search, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal, 
  Settings, 
  RotateCcw, 
  Copy, 
  Check, 
  Plus, 
  Home, 
  Car, 
  Truck, 
  Wrench, 
  Globe, 
  Target, 
  Mic, 
  History, 
  FileText, 
  Languages, 
  CheckCircle2, 
  ArrowLeft,
  Info
} from 'lucide-vue-next'

// Estado principal
const searchCode = ref('')
const activeCategoryTab = ref('Turismos')
const activeBrandTab = ref<'preferidas' | 'todas'>('preferidas')
const sidebarCollapsed = ref(false)

// Selección en Búsqueda Manual
const selectedFabricanteNombre = ref<string>('')
const selectedModeloNombre = ref<string>('')
const selectedTipo = ref<string>('')
const selectedAnio = ref<string>('')
const selectedCombustible = ref<string>('Todos los combustibles')
const selectedMotorCodigo = ref<string>('')
const filterCc = ref<string>('')
const filterPotencia = ref<string>('')
const potenciaUnit = ref<'CV' | 'kW'>('CV')

// Motor activo para la matriz técnica
const activeMotor = ref<Motor | null>(null)
const selectedSubsystem = ref<string>('Todos')
const subsystems = ['Todos', 'Culata', 'Cigüeñal', 'Block', 'Bielas', 'Sellos y Juntas']

// Toast feedback
const toastMessage = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const showToast = (msg: string) => {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 2200)
}

// Portapapeles
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

// Lista de marcas inspirada 1:1 en el portal TecDoc / Ajusa
interface BrandItem {
  id: string
  name: string
  isPreferred: boolean
  hasEnginesInDb: boolean
  logoKey: string
}

const brandsList: BrandItem[] = [
  { id: 'alfa', name: 'ALFA ROMEO', isPreferred: true, hasEnginesInDb: false, logoKey: 'alfaromeo' },
  { id: 'audi', name: 'AUDI', isPreferred: true, hasEnginesInDb: false, logoKey: 'audi' },
  { id: 'bmw', name: 'BMW', isPreferred: true, hasEnginesInDb: false, logoKey: 'bmw' },
  { id: 'chrysler', name: 'CHRYSLER', isPreferred: true, hasEnginesInDb: false, logoKey: 'chrysler' },
  { id: 'citroen', name: 'CITROËN', isPreferred: true, hasEnginesInDb: false, logoKey: 'citroen' },
  { id: 'daewoo', name: 'DAEWOO', isPreferred: true, hasEnginesInDb: false, logoKey: 'daewoo' },
  { id: 'daf', name: 'DAF', isPreferred: true, hasEnginesInDb: false, logoKey: 'daf' },
  { id: 'daihatsu', name: 'DAIHATSU', isPreferred: true, hasEnginesInDb: false, logoKey: 'daihatsu' },
  { id: 'fiat', name: 'FIAT', isPreferred: true, hasEnginesInDb: false, logoKey: 'fiat' },
  { id: 'ford', name: 'FORD', isPreferred: true, hasEnginesInDb: true, logoKey: 'ford' },
  { id: 'honda', name: 'HONDA', isPreferred: true, hasEnginesInDb: true, logoKey: 'honda' },
  { id: 'hyundai', name: 'HYUNDAI', isPreferred: true, hasEnginesInDb: true, logoKey: 'hyundai' },
  { id: 'isuzu', name: 'ISUZU', isPreferred: true, hasEnginesInDb: true, logoKey: 'isuzu' },
  { id: 'jaguar', name: 'JAGUAR', isPreferred: true, hasEnginesInDb: false, logoKey: 'jaguar' },
  { id: 'jeep', name: 'JEEP', isPreferred: true, hasEnginesInDb: false, logoKey: 'jeep' },
  { id: 'kia', name: 'KIA', isPreferred: true, hasEnginesInDb: true, logoKey: 'kia' },
  { id: 'lada', name: 'LADA', isPreferred: true, hasEnginesInDb: false, logoKey: 'lada' },
  { id: 'mazda', name: 'MAZDA', isPreferred: true, hasEnginesInDb: false, logoKey: 'mazda' },
  { id: 'mercedes', name: 'MERCEDES-BENZ', isPreferred: true, hasEnginesInDb: false, logoKey: 'mercedes' },
  { id: 'mini', name: 'MINI', isPreferred: true, hasEnginesInDb: false, logoKey: 'mini' },
  { id: 'mitsubishi', name: 'MITSUBISHI', isPreferred: true, hasEnginesInDb: true, logoKey: 'mitsubishi' },
  { id: 'nissan', name: 'NISSAN', isPreferred: true, hasEnginesInDb: true, logoKey: 'nissan' },
  { id: 'toyota', name: 'TOYOTA', isPreferred: true, hasEnginesInDb: true, logoKey: 'toyota' },
  { id: 'volkswagen', name: 'VOLKSWAGEN', isPreferred: true, hasEnginesInDb: false, logoKey: 'volkswagen' }
]

const visibleBrands = computed(() => {
  if (activeBrandTab.value === 'preferidas') {
    return brandsList.filter(b => b.isPreferred)
  }
  return brandsList
})

// Selección de marca desde la cuadrícula
const handleSelectBrandCard = (brand: BrandItem) => {
  selectedFabricanteNombre.value = brand.name
  // Buscar si tenemos motores registrados para esta marca
  const norm = brand.name.toLowerCase()
  const matchedMotor = mockMotores.find(m => {
    if (norm.includes('toyota') && m.codigo === '3L') return true
    if (norm.includes('nissan') && m.codigo === 'Z24') return true
    if (norm.includes('mitsubishi') && m.codigo.includes('4D56')) return true
    if (norm.includes('isuzu') && m.codigo.includes('4JB1')) return true
    return false
  })

  if (matchedMotor) {
    activeMotor.value = matchedMotor
    selectedMotorCodigo.value = matchedMotor.codigo
  } else {
    // Si no tiene motor directo, seleccionar Toyota 3L como demo de taller
    activeMotor.value = mockMotores[0]
    selectedMotorCodigo.value = mockMotores[0].codigo
  }
  showToast(`Vehículo cargado: ${brand.name} - Motor ${activeMotor.value?.codigo}`)
}

// Búsqueda Manual: al cambiar fabricante en el select
const onFabricanteChange = () => {
  if (!selectedFabricanteNombre.value) return
  const norm = selectedFabricanteNombre.value.toLowerCase()
  const matched = mockMotores.find(m => {
    if (norm.includes('toyota') && m.codigo === '3L') return true
    if (norm.includes('nissan') && m.codigo === 'Z24') return true
    if (norm.includes('mitsubishi') && m.codigo.includes('4D56')) return true
    if (norm.includes('isuzu') && m.codigo.includes('4JB1')) return true
    return false
  })
  if (matched) {
    activeMotor.value = matched
    selectedMotorCodigo.value = matched.codigo
  }
}

// Botón de búsqueda manual
const handleManualSearch = () => {
  if (selectedMotorCodigo.value) {
    const found = mockMotores.find(m => m.codigo.toLowerCase().includes(selectedMotorCodigo.value.toLowerCase()))
    if (found) {
      activeMotor.value = found
      showToast(`Motor seleccionado: ${found.codigo}`)
      return
    }
  }
  if (selectedFabricanteNombre.value) {
    onFabricanteChange()
  } else {
    showToast('Seleccione un fabricante o código de motor')
  }
}

// Resetear filtros
const handleResetFilters = () => {
  selectedFabricanteNombre.value = ''
  selectedModeloNombre.value = ''
  selectedTipo.value = ''
  selectedAnio.value = ''
  selectedCombustible.value = 'Todos los combustibles'
  selectedMotorCodigo.value = ''
  filterCc.value = ''
  filterPotencia.value = ''
  searchCode.value = ''
  activeMotor.value = null
  showToast('Filtros restablecidos')
}

// Repuestos filtrados para la matriz
const displayedRepuestos = computed(() => {
  let list = mockRepuestos

  // 1. Si hay búsqueda por código en la barra superior
  const q = searchCode.value.trim().toLowerCase().replace(/[-\s]/g, '')
  if (q) {
    return list.filter(r => {
      const matchOem = r.codigo_oem.toLowerCase().replace(/[-\s]/g, '').includes(q)
      const matchName = r.nombre.toLowerCase().includes(searchCode.value.toLowerCase())
      const matchEquiv = r.equivalencias?.some(eq =>
        eq.codigo_alterno.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
        eq.marca_alterna.toLowerCase().includes(q)
      )
      return matchOem || matchName || matchEquiv
    })
  }

  // 2. Si hay un motor activo seleccionado
  if (activeMotor.value) {
    list = list.filter(r => r.motor_id === activeMotor.value?.id)
  }

  // 3. Filtro por subsistema
  if (selectedSubsystem.value !== 'Todos') {
    list = list.filter(r => r.subsistema === selectedSubsystem.value)
  }

  return list
})

// Helper para extraer códigos de marcas alternas
const getBrandCode = (repuesto: RepuestoTecnico, brand: string): string | null => {
  const eq = repuesto.equivalencias?.find(e => e.marca_alterna.toLowerCase() === brand.toLowerCase())
  return eq ? eq.codigo_alterno : null
}

const getMotorBadge = (motorId?: string) => {
  const m = mockMotores.find(mot => mot.id === motorId)
  return m ? m.codigo : 'Universal'
}
</script>

<template>
  <div class="bg-[#f0f2f5] min-h-screen text-slate-800 flex flex-col font-sans select-none">
    
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
        class="fixed bottom-5 right-5 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold"
      >
        <CheckCircle2 class="w-4 h-4 text-[#04c4d9]" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- 1. BARRA SUPERIOR AZUL TEC-DOC / AJUSA CON BÚSQUEDA EXCLUSIVA POR CÓDIGO -->
    <!-- ========================================================================= -->
    <header class="bg-[#00388d] text-white px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-sm sticky top-0 z-30">
      
      <!-- Izquierda: Logo Estilo Ajusa (JR BLANCO) e Icono Grid -->
      <div class="flex items-center gap-3 shrink-0">
        <!-- Logo Badge -->
        <div class="border-2 border-white rounded px-2.5 py-0.5 bg-gradient-to-r from-blue-700 to-blue-900 shadow-inner flex items-center">
          <span class="text-base sm:text-lg font-black tracking-tight italic text-white drop-shadow-sm">
            ajusa
          </span>
          <span class="text-[9px] font-black text-cyan-300 ml-1.5 uppercase tracking-wider hidden sm:inline">
            JR BLANCO
          </span>
        </div>

        <!-- Botón Menú Grid -->
        <button 
          type="button" 
          class="p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/60 rounded transition"
          title="Menú del catálogo"
        >
          <div class="grid grid-cols-3 gap-0.5 w-4 h-4">
            <span v-for="i in 9" :key="i" class="w-1 h-1 bg-current rounded-xs"></span>
          </div>
        </button>
      </div>

      <!-- Centro: Buscador de Código de Pieza con Diana / Micrófono / Lupa -->
      <div class="flex-1 max-w-2xl mx-1 sm:mx-4">
        <div class="relative flex items-center bg-white rounded shadow-sm overflow-hidden border border-slate-300 focus-within:ring-2 focus-within:ring-cyan-400">
          <!-- Icono Objetivo / Diana Izquierda -->
          <div class="pl-3 pr-2 text-slate-400 flex items-center pointer-events-none">
            <Target class="w-4 h-4 text-slate-500" />
          </div>

          <!-- Input Central -->
          <input
            v-model="searchCode"
            type="text"
            placeholder="Búsqueda por número de pieza o código de artículo (OEM, Dokuro, Rik, NPR, NDC, Ajusa...)"
            class="w-full py-1.5 sm:py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-500 font-medium focus:outline-none bg-transparent"
          />

          <!-- Botón Limpiar si hay texto -->
          <button
            v-if="searchCode"
            @click="searchCode = ''"
            type="button"
            class="px-2 text-slate-400 hover:text-slate-600"
          >
            <X class="w-3.5 h-3.5" />
          </button>

          <!-- Micrófono -->
          <button 
            type="button" 
            class="px-2.5 text-slate-400 hover:text-slate-600 border-r border-slate-200"
            title="Búsqueda por voz"
          >
            <Mic class="w-4 h-4" />
          </button>

          <!-- Botón Lupa Azul -->
          <button
            type="button"
            class="bg-[#00479b] hover:bg-[#00388d] text-white px-3.5 py-2 text-sm flex items-center justify-center transition"
            title="Buscar"
          >
            <Search class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Derecha: Iconos de Utilidad (Historial, Documentos, Idioma, Ajustes) -->
      <div class="flex items-center gap-1 sm:gap-2 text-blue-200 shrink-0">
        <button type="button" class="p-1.5 hover:text-white hover:bg-blue-800/50 rounded transition" title="Historial">
          <History class="w-4 h-4" />
        </button>
        <button type="button" class="p-1.5 hover:text-white hover:bg-blue-800/50 rounded transition" title="Documentación">
          <FileText class="w-4 h-4" />
        </button>
        <button type="button" class="p-1.5 hover:text-white hover:bg-blue-800/50 rounded transition hidden sm:inline" title="Idioma">
          <Languages class="w-4 h-4" />
        </button>
        <button type="button" class="p-1.5 hover:text-white hover:bg-blue-800/50 rounded transition" title="Configuración">
          <Settings class="w-4 h-4" />
        </button>
      </div>

    </header>

    <!-- ========================================================================= -->
    <!-- 2. SUB-NAVBAR CON TIPOS DE VEHÍCULO / CATEGORÍAS (AZUL PROFUNDO)          -->
    <!-- ========================================================================= -->
    <nav class="bg-[#002868] text-white text-xs px-2 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-blue-900/60 shadow-xs">
      <!-- Home Icon -->
      <button 
        type="button"
        @click="handleResetFilters"
        class="px-2.5 py-2 hover:bg-blue-900/60 transition text-blue-200 hover:text-white"
        title="Inicio"
      >
        <Home class="w-4 h-4" />
      </button>

      <!-- Pestañas de Categoría -->
      <button
        v-for="cat in [
          { id: 'Turismos', label: 'Turismos', icon: Car },
          { id: 'Industriales', label: 'Vehículos industriales', icon: Truck },
          { id: 'Comerciales', label: 'Vehículos comerciales ligeros', icon: Car },
          { id: 'Motocicletas', label: 'Motocicletas', icon: Wrench },
          { id: 'Ejes', label: 'Ejes', icon: Wrench },
          { id: 'Motores', label: 'Motores', icon: Settings },
          { id: 'Universal', label: 'Universal', icon: Globe }
        ]"
        :key="cat.id"
        type="button"
        @click="activeCategoryTab = cat.id"
        :class="[
          'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2',
          activeCategoryTab === cat.id
            ? 'bg-[#001f52] text-white border-cyan-400 font-bold'
            : 'text-blue-100 hover:bg-blue-900/40 border-transparent'
        ]"
      >
        <component :is="cat.icon" class="w-3.5 h-3.5 opacity-80" />
        <span>{{ cat.label }}</span>
      </button>
    </nav>

    <!-- ========================================================================= -->
    <!-- 3. BARRA DE BREADCRUMBS Y RETORNO                                         -->
    <!-- ========================================================================= -->
    <div class="bg-white border-b border-slate-200 px-4 sm:px-6 py-1.5 flex items-center justify-between text-xs text-slate-600">
      <div class="flex items-center gap-2">
        <button 
          v-if="activeMotor || searchCode" 
          type="button" 
          @click="activeMotor = null; searchCode = ''" 
          class="flex items-center gap-1 text-[#00388d] hover:underline font-bold"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Volver a Marcas</span>
        </button>
        <span v-else class="text-slate-500 font-medium">← Turismo</span>

        <span v-if="activeMotor" class="text-slate-300">/</span>
        <span v-if="activeMotor" class="font-bold text-slate-800">
          {{ selectedFabricanteNombre || 'Toyota' }} > Motor {{ activeMotor.codigo }}
        </span>
      </div>

      <div class="text-[11px] text-slate-400">
        JR Blanco • Base de Datos de Rectificación
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 4. CONTENIDO PRINCIPAL: DOS COLUMNAS (BÚSQUEDA MANUAL + MARCAS/MATRIZ)   -->
    <!-- ========================================================================= -->
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      
      <!-- --------------------------------------------------------------------- -->
      <!-- COLUMNA IZQUIERDA: FORMULARIO "BÚSQUEDA MANUAL"                       -->
      <!-- --------------------------------------------------------------------- -->
      <aside 
        v-show="!sidebarCollapsed"
        class="w-full md:w-64 lg:w-72 bg-white border-r border-slate-200 p-3 sm:p-4 flex flex-col justify-between shrink-0 shadow-xs overflow-y-auto"
      >
        <div class="space-y-3">
          
          <!-- Encabezado de la barra lateral con pestañas de filtro -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <div class="flex items-center gap-1 text-[#00388d] font-black text-xs uppercase tracking-tight">
              <SlidersHorizontal class="w-3.5 h-3.5" />
              <span>Búsqueda manual</span>
            </div>
            
            <div class="flex items-center gap-1">
              <button type="button" class="p-1 text-slate-400 hover:text-slate-700 rounded" title="Filtro rápido">
                <SlidersHorizontal class="w-3.5 h-3.5" />
              </button>
              <button type="button" class="p-1 text-slate-400 hover:text-slate-700 rounded" title="Opciones avanzadas">
                <Settings class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Campos del formulario en lista vertical compacta -->
          <div class="space-y-1.5 text-xs">
            
            <!-- Fabricante -->
            <div>
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Fabricante</label>
              <select
                v-model="selectedFabricanteNombre"
                @change="onFabricanteChange"
                class="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#00388d]"
              >
                <option value="">Seleccione Fabricante...</option>
                <option v-for="b in brandsList" :key="b.id" :value="b.name">{{ b.name }}</option>
              </select>
            </div>

            <!-- Modelos -->
            <div>
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Modelos</label>
              <select
                v-model="selectedModeloNombre"
                class="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#00388d]"
              >
                <option value="">Todos los modelos</option>
                <option value="Hilux">Hilux</option>
                <option value="Hiace">Hiace</option>
                <option value="Land Cruiser">Land Cruiser Prado</option>
                <option value="D21">D21 Pick-up / Hardbody</option>
                <option value="Frontier">Frontier D22 / D40</option>
                <option value="L200">L200 Sportero</option>
                <option value="D-Max">D-Max / Rodeo</option>
              </select>
            </div>

            <!-- Tipo -->
            <div>
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Tipo / Carrocería</label>
              <select
                v-model="selectedTipo"
                class="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#00388d]"
              >
                <option value="">Todos los tipos</option>
                <option value="pick-up">Pick-up Doble Cabina</option>
                <option value="van">Furgón / Panel</option>
                <option value="suv">Todo Terreno / SUV</option>
              </select>
            </div>

            <!-- Año de construcción -->
            <div>
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Año de construcción</label>
              <select
                v-model="selectedAnio"
                class="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#00388d]"
              >
                <option value="">Todos los años</option>
                <option v-for="y in [2022, 2020, 2018, 2015, 2010, 2005, 2000, 1995, 1990]" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>

            <!-- Combustibles -->
            <div>
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Combustible</label>
              <select
                v-model="selectedCombustible"
                class="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#00388d]"
              >
                <option value="Todos los combustibles">Todos los combustibles</option>
                <option value="Diésel">Diésel</option>
                <option value="Gasolina">Gasolina</option>
              </select>
            </div>

            <!-- Cilindrada cc -->
            <div class="relative">
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Cilindrada (cc)</label>
              <input
                v-model="filterCc"
                type="text"
                placeholder="ej. 2800 o 2400"
                class="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#00388d]"
              />
            </div>

            <!-- Potencia (CV / kW) -->
            <div>
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Potencia</label>
              <div class="flex items-center gap-1">
                <input
                  v-model="filterPotencia"
                  type="text"
                  placeholder="ej. 90 o 130"
                  class="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#00388d]"
                />
                <button
                  type="button"
                  @click="potenciaUnit = potenciaUnit === 'CV' ? 'kW' : 'CV'"
                  class="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[10px] font-bold text-slate-700"
                >
                  {{ potenciaUnit }}
                </button>
              </div>
            </div>

            <!-- Código de motor -->
            <div>
              <label class="block text-[10px] text-slate-500 font-semibold uppercase mb-0.5">Código de motor</label>
              <input
                v-model="selectedMotorCodigo"
                type="text"
                placeholder="ej. 3L, 1KD, Z24, 4D56, 4JB1"
                class="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-800 font-bold font-mono focus:outline-none focus:border-[#00388d]"
              />
            </div>

          </div>

        </div>

        <!-- Botones de Acción (Limpiar / Buscar) -->
        <div class="pt-3 border-t border-slate-200 flex items-center gap-2 mt-4">
          <button
            type="button"
            @click="handleResetFilters"
            class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition border border-slate-300"
            title="Limpiar filtros"
          >
            <RotateCcw class="w-4 h-4" />
          </button>

          <button
            type="button"
            @click="handleManualSearch"
            class="flex-1 py-1.5 px-3 bg-[#00479b] hover:bg-[#00388d] text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 transition shadow-xs"
          >
            <Search class="w-3.5 h-3.5" />
            <span>Buscar</span>
          </button>
        </div>

      </aside>

      <!-- --------------------------------------------------------------------- -->
      <!-- COLUMNA DERECHA: MARCAS PREFERIDAS O MATRIZ DE EQUIVALENCIAS TÉCNICA -->
      <!-- --------------------------------------------------------------------- -->
      <main class="flex-1 p-3 sm:p-5 overflow-y-auto space-y-4">
        
        <!-- BARRA DE PESTAÑAS (Marcas Preferidas / Todas las Marcas / Colapsar) -->
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <div class="flex items-center gap-3">
            <!-- Botón Colapsar Sidebar Izquierdo << / >> -->
            <button
              type="button"
              @click="sidebarCollapsed = !sidebarCollapsed"
              class="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition"
              title="Colapsar / Expandir panel de búsqueda"
            >
              <ChevronRight v-if="sidebarCollapsed" class="w-4 h-4" />
              <ChevronLeft v-else class="w-4 h-4" />
            </button>

            <!-- Pestañas Marcas preferidas / Todas las marcas -->
            <div class="flex items-center gap-2 text-xs">
              <button
                type="button"
                @click="activeBrandTab = 'preferidas'; activeMotor = null; searchCode = ''"
                :class="[
                  'px-3 py-1 font-bold rounded transition border',
                  activeBrandTab === 'preferidas' && !activeMotor && !searchCode
                    ? 'bg-white text-[#00388d] border-[#00388d] shadow-2xs'
                    : 'text-slate-600 border-slate-200 hover:bg-white'
                ]"
              >
                Marcas preferidas
              </button>

              <button
                type="button"
                @click="activeBrandTab = 'todas'; activeMotor = null; searchCode = ''"
                :class="[
                  'px-3 py-1 font-bold rounded transition border',
                  activeBrandTab === 'todas' && !activeMotor && !searchCode
                    ? 'bg-white text-[#00388d] border-[#00388d] shadow-2xs'
                    : 'text-slate-600 border-slate-200 hover:bg-white'
                ]"
              >
                Todas las marcas
              </button>
            </div>
          </div>

          <div v-if="activeMotor" class="text-xs text-slate-500">
            Ficha activa: <strong class="text-slate-900 font-mono">{{ activeMotor.codigo }}</strong>
          </div>
        </div>

        <!-- =================================================================== -->
        <!-- CASO 1: CUADRÍCULA DE TARJETAS DE MARCAS (IGUAL AL SCREENSHOT)      -->
        <!-- =================================================================== -->
        <div v-if="!activeMotor && !searchCode" class="space-y-4">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div
              v-for="brand in visibleBrands"
              :key="brand.id"
              @click="handleSelectBrandCard(brand)"
              class="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#00388d] hover:shadow-xs transition cursor-pointer group"
            >
              <!-- Emblema / Icono de la Marca -->
              <div class="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                <!-- SVG estilizado representativo para cada marca -->
                <svg v-if="brand.logoKey === 'toyota'" viewBox="0 0 100 100" class="w-7 h-7 text-red-600 fill-current">
                  <ellipse cx="50" cy="50" rx="46" ry="28" fill="none" stroke="currentColor" stroke-width="6"/>
                  <ellipse cx="50" cy="40" rx="18" ry="22" fill="none" stroke="currentColor" stroke-width="6"/>
                  <ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="currentColor" stroke-width="6"/>
                </svg>

                <svg v-else-if="brand.logoKey === 'nissan'" viewBox="0 0 100 100" class="w-7 h-7 text-slate-700 fill-current">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="8"/>
                  <rect x="10" y="42" width="80" height="16" fill="currentColor"/>
                </svg>

                <svg v-else-if="brand.logoKey === 'mitsubishi'" viewBox="0 0 100 100" class="w-7 h-7 text-red-600 fill-current">
                  <polygon points="50,15 62,38 38,38"/>
                  <polygon points="38,38 50,60 26,60"/>
                  <polygon points="62,38 74,60 50,60"/>
                </svg>

                <svg v-else-if="brand.logoKey === 'isuzu'" viewBox="0 0 100 100" class="w-8 h-8 text-red-600 fill-current">
                  <text x="50" y="62" font-size="28" font-weight="900" text-anchor="middle" font-family="sans-serif">ISUZU</text>
                </svg>

                <svg v-else-if="brand.logoKey === 'honda'" viewBox="0 0 100 100" class="w-7 h-7 text-slate-800 fill-current">
                  <rect x="15" y="15" width="70" height="70" rx="12" fill="none" stroke="currentColor" stroke-width="7"/>
                  <text x="50" y="70" font-size="55" font-weight="900" text-anchor="middle" font-family="sans-serif">H</text>
                </svg>

                <svg v-else-if="brand.logoKey === 'audi'" viewBox="0 0 120 40" class="w-8 h-8 text-slate-700 fill-none stroke-current stroke-[4]">
                  <circle cx="20" cy="20" r="16"/>
                  <circle cx="45" cy="20" r="16"/>
                  <circle cx="70" cy="20" r="16"/>
                  <circle cx="95" cy="20" r="16"/>
                </svg>

                <svg v-else-if="brand.logoKey === 'bmw'" viewBox="0 0 100 100" class="w-7 h-7">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#000" stroke-width="8"/>
                  <path d="M50 50 L50 6 A44 44 0 0 1 94 50 Z" fill="#0066b1"/>
                  <path d="M50 50 L50 94 A44 44 0 0 1 6 50 Z" fill="#0066b1"/>
                </svg>

                <svg v-else-if="brand.logoKey === 'ford'" viewBox="0 0 100 60" class="w-8 h-8">
                  <ellipse cx="50" cy="30" rx="46" ry="26" fill="#003478"/>
                  <text x="50" y="38" font-size="22" font-style="italic" font-weight="bold" fill="#fff" text-anchor="middle" font-family="serif">Ford</text>
                </svg>

                <div v-else class="text-xs font-black text-slate-400 uppercase">
                  {{ brand.name.slice(0, 3) }}
                </div>
              </div>

              <!-- Nombre de la Marca -->
              <div class="flex-1 min-w-0">
                <span class="text-xs font-black text-slate-900 group-hover:text-[#00388d] transition truncate block tracking-tight">
                  {{ brand.name }}
                </span>
                <span v-if="brand.hasEnginesInDb" class="text-[9px] text-[#00388d] font-bold">
                  Catálogo disponible
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- =================================================================== -->
        <!-- CASO 2: MATRIZ DE EQUIVALENCIAS Y REPUESTOS DEL MOTOR               -->
        <!-- =================================================================== -->
        <div v-else class="space-y-3">
          
          <!-- Banner Superior del Motor Seleccionado -->
          <div class="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-black text-[#00388d] uppercase tracking-wider">
                  {{ selectedFabricanteNombre || 'TOYOTA' }} > {{ activeMotor?.codigo || 'MOTOR DE TALLER' }}
                </span>
                <span class="text-[10px] bg-blue-50 text-[#00388d] px-2 py-0.5 rounded font-bold border border-blue-200">
                  {{ activeMotor?.combustible || 'Diésel' }}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ activeMotor?.nombre_comercial }} • 
                <span v-if="activeMotor?.diametro_cilindro_std_mm" class="font-bold text-slate-800">
                  Calibre Cilindro STD: Ø{{ activeMotor?.diametro_cilindro_std_mm.toFixed(2) }} mm
                </span>
              </p>
            </div>

            <button
              type="button"
              @click="activeMotor = null; searchCode = ''"
              class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition shrink-0"
            >
              ← Cambiar Vehículo
            </button>
          </div>

          <!-- Filtros de Subsistemas -->
          <div class="flex items-center gap-1 overflow-x-auto bg-white p-2 rounded-lg border border-slate-200">
            <button
              v-for="sub in subsystems"
              :key="sub"
              type="button"
              @click="selectedSubsystem = sub"
              :class="[
                'px-2.5 py-1 text-xs font-bold rounded transition whitespace-nowrap',
                selectedSubsystem === sub
                  ? 'bg-[#00388d] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              ]"
            >
              {{ sub }}
            </button>
          </div>

          <!-- Tabla Técnica Multimarca de Alta Densidad -->
          <div class="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs min-w-[950px]">
                <thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 sticky top-0">
                  <tr>
                    <th class="px-3.5 py-2.5 min-w-[190px]">Pieza / Subsistema</th>
                    <th class="px-3 py-2.5 min-w-[120px] bg-blue-50/60 text-[#00388d]">Código OEM</th>
                    <th class="px-3 py-2.5 min-w-[320px]">Cruces Alternos (Dokuro / Rik / NPR / NDC / Ajusa)</th>
                    <th class="px-3 py-2.5 min-w-[190px]">Medidas (mm)</th>
                    <th class="px-3 py-2.5 text-right min-w-[80px]">Precio ($)</th>
                    <th class="px-3 py-2.5 text-center min-w-[80px]">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="rep in displayedRepuestos"
                    :key="rep.id"
                    class="hover:bg-blue-50/20 transition group"
                  >
                    
                    <!-- Pieza -->
                    <td class="px-3.5 py-2">
                      <div class="font-bold text-slate-900 group-hover:text-[#00388d] transition leading-tight">
                        {{ rep.nombre }}
                      </div>
                      <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span class="font-semibold text-slate-600">{{ rep.subsistema }}</span>
                        <span>•</span>
                        <span class="text-[#00388d] font-mono font-bold">{{ getMotorBadge(rep.motor_id) }}</span>
                      </div>
                    </td>

                    <!-- OEM -->
                    <td class="px-3 py-2 bg-blue-50/20 font-mono font-black text-[#00388d]">
                      <button
                        type="button"
                        @click="copyToClipboard(rep.codigo_oem, 'OEM')"
                        class="inline-flex items-center gap-1 hover:underline"
                        title="Copiar código OEM"
                      >
                        <span>{{ rep.codigo_oem }}</span>
                        <Check v-if="copiedCode === rep.codigo_oem" class="w-3 h-3 text-emerald-600" />
                        <Copy v-else class="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                      </button>
                    </td>

                    <!-- Cruces Multimarca -->
                    <td class="px-3 py-2">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <!-- Dokuro -->
                        <button
                          v-if="getBrandCode(rep, 'Dokuro')"
                          type="button"
                          @click="copyToClipboard(getBrandCode(rep, 'Dokuro')!, 'Dokuro')"
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                          title="Copiar Dokuro"
                        >
                          <span class="text-[9px] text-slate-400 font-sans">Dok:</span> <strong>{{ getBrandCode(rep, 'Dokuro') }}</strong>
                        </button>

                        <!-- Rik -->
                        <button
                          v-if="getBrandCode(rep, 'Rik')"
                          type="button"
                          @click="copyToClipboard(getBrandCode(rep, 'Rik')!, 'Rik')"
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition"
                          title="Copiar Rik"
                        >
                          <span class="text-[9px] text-indigo-500 font-sans">Rik:</span> <strong>{{ getBrandCode(rep, 'Rik') }}</strong>
                        </button>

                        <!-- NPR -->
                        <button
                          v-if="getBrandCode(rep, 'NPR')"
                          type="button"
                          @click="copyToClipboard(getBrandCode(rep, 'NPR')!, 'NPR')"
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                          title="Copiar NPR"
                        >
                          <span class="text-[9px] text-slate-400 font-sans">NPR:</span> <strong>{{ getBrandCode(rep, 'NPR') }}</strong>
                        </button>

                        <!-- NDC -->
                        <button
                          v-if="getBrandCode(rep, 'NDC')"
                          type="button"
                          @click="copyToClipboard(getBrandCode(rep, 'NDC')!, 'NDC')"
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 transition"
                          title="Copiar NDC"
                        >
                          <span class="text-[9px] text-rose-500 font-sans">NDC:</span> <strong>{{ getBrandCode(rep, 'NDC') }}</strong>
                          <span v-if="rep.tipo_cojinete" class="ml-1 text-[9px] text-rose-600 font-bold">({{ rep.tipo_cojinete }})</span>
                        </button>

                        <!-- Ajusa -->
                        <button
                          v-if="getBrandCode(rep, 'Ajusa')"
                          type="button"
                          @click="copyToClipboard(getBrandCode(rep, 'Ajusa')!, 'Ajusa')"
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition"
                          title="Copiar Ajusa"
                        >
                          <span class="text-[9px] text-blue-500 font-sans">Aju:</span> <strong>{{ getBrandCode(rep, 'Ajusa') }}</strong>
                        </button>

                        <!-- Taiho / Pioneer -->
                        <button
                          v-if="getBrandCode(rep, 'Taiho')"
                          type="button"
                          @click="copyToClipboard(getBrandCode(rep, 'Taiho')!, 'Taiho')"
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                        >
                          <span class="text-[9px] text-slate-400 font-sans">Taiho:</span> <strong>{{ getBrandCode(rep, 'Taiho') }}</strong>
                        </button>

                        <button
                          v-if="getBrandCode(rep, 'Pioneer')"
                          type="button"
                          @click="copyToClipboard(getBrandCode(rep, 'Pioneer')!, 'Pioneer')"
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                        >
                          <span class="text-[9px] text-slate-400 font-sans">Pioneer:</span> <strong>{{ getBrandCode(rep, 'Pioneer') }}</strong>
                        </button>
                      </div>
                    </td>

                    <!-- Medidas (mm) -->
                    <td class="px-3 py-2 font-mono text-[11px] text-slate-700">
                      <span v-if="rep.diametro_cabeza_mm">
                        Cab Ø<strong>{{ rep.diametro_cabeza_mm }}</strong> • Vást Ø<strong>{{ rep.diametro_vastago_mm }}</strong> • L<strong>{{ rep.longitud_total_mm }}</strong>
                      </span>
                      <span v-else-if="rep.diametro_cilindro_mm">
                        Ø<strong>{{ rep.diametro_cilindro_mm }}</strong> • <strong>{{ rep.espesor_anillo1_mm }}/{{ rep.espesor_anillo2_mm }}/{{ rep.espesor_aceite_mm }}</strong>
                      </span>
                      <span v-else-if="rep.tipo_cojinete">
                        {{ rep.tipo_cojinete }} • Muñón Ø<strong>{{ rep.diametro_munon_mm || '-' }}</strong> • Ancho <strong>{{ rep.ancho_casquete_mm || '-' }}</strong>
                      </span>
                      <span v-else-if="rep.dimensiones?.espesor_mm">
                        Espesor <strong>{{ rep.dimensiones.espesor_mm }} mm</strong>
                      </span>
                      <span v-else class="text-slate-300">—</span>
                    </td>

                    <!-- Precio -->
                    <td class="px-3 py-2 text-right font-black text-slate-900">
                      ${{ rep.precio.toFixed(2) }}
                    </td>

                    <!-- Acción -->
                    <td class="px-3 py-2 text-center">
                      <button
                        type="button"
                        @click="showToast(`Agregado a la orden: ${rep.codigo_oem} (${rep.nombre})`)"
                        class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#00479b] hover:bg-[#00388d] rounded transition shadow-2xs"
                        title="Agregar a cotización u orden"
                      >
                        <Plus class="w-3 h-3" />
                        <span>Agregar</span>
                      </button>
                    </td>

                  </tr>

                  <!-- Sin resultados -->
                  <tr v-if="displayedRepuestos.length === 0">
                    <td colspan="6" class="px-4 py-8 text-center text-slate-400">
                      <Info class="w-5 h-5 mx-auto mb-1 text-slate-300" />
                      <span class="text-xs">No se encontraron piezas registradas para este filtro o código.</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </main>

    </div>

  </div>
</template>
