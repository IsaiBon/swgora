<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  type Motor, 
  type RepuestoTecnico, 
  mockFabricantes,
  mockModelos,
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
  Car, 
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
const activeBrandTab = ref<'preferidas' | 'todas'>('preferidas')
const sidebarCollapsed = ref(false)
const mobileFiltersOpen = ref(false)

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

// Lista de marcas preferidas y catálogo completo
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

// =========================================================================
// FILTRADO EN CASCADA: FABRICANTE -> MODELO -> MOTOR
// =========================================================================

// Fabricante normalizado activo
const currentFabricante = computed(() => {
  if (!selectedFabricanteNombre.value) return null
  const norm = selectedFabricanteNombre.value.toLowerCase()
  return mockFabricantes.find(f => f.nombre.toLowerCase() === norm || norm.includes(f.nombre.toLowerCase())) || null
})

// Modelos disponibles según Fabricante
const availableModelos = computed(() => {
  if (!currentFabricante.value) {
    return mockModelos
  }
  return mockModelos.filter(m => m.fabricante_id === currentFabricante.value?.id)
})

// Motores disponibles según Fabricante y Modelo
const availableMotores = computed(() => {
  let list = mockMotores
  if (currentFabricante.value) {
    list = list.filter(m => m.fabricante_id === currentFabricante.value?.id)
  }
  if (selectedModeloNombre.value) {
    const mod = mockModelos.find(m => m.nombre === selectedModeloNombre.value)
    if (mod) {
      list = list.filter(m => m.modelo_id === mod.id)
    }
  }
  return list
})

// Cambio de fabricante en cascada
const onFabricanteChange = () => {
  selectedModeloNombre.value = ''
  selectedMotorCodigo.value = ''
  if (availableMotores.value.length > 0) {
    activeMotor.value = availableMotores.value[0]
    selectedMotorCodigo.value = availableMotores.value[0].codigo
  } else {
    activeMotor.value = null
  }
}

// Cambio de modelo en cascada
const onModeloChange = () => {
  selectedMotorCodigo.value = ''
  if (availableMotores.value.length > 0) {
    activeMotor.value = availableMotores.value[0]
    selectedMotorCodigo.value = availableMotores.value[0].codigo
  }
}

// Cambio de motor en cascada
const onMotorChange = () => {
  if (!selectedMotorCodigo.value) {
    activeMotor.value = null
    return
  }
  const found = mockMotores.find(m => m.codigo.toLowerCase() === selectedMotorCodigo.value.toLowerCase())
  if (found) {
    activeMotor.value = found
    showToast(`Motor seleccionado: ${found.codigo}`)
  }
}

// Selección de marca desde la cuadrícula de tarjetas
const handleSelectBrandCard = (brand: BrandItem) => {
  selectedFabricanteNombre.value = brand.name
  selectedModeloNombre.value = ''
  onFabricanteChange()
  showToast(`Vehículo: ${brand.name} • ${activeMotor.value ? `Motor ${activeMotor.value.codigo}` : 'Catálogo listo'}`)
}

// Botón de búsqueda manual
const handleManualSearch = () => {
  if (selectedMotorCodigo.value) {
    const found = mockMotores.find(m => m.codigo.toLowerCase().includes(selectedMotorCodigo.value.toLowerCase()))
    if (found) {
      activeMotor.value = found
      showToast(`Motor: ${found.codigo}`)
      return
    }
  }
  if (selectedFabricanteNombre.value) {
    onFabricanteChange()
  } else {
    showToast('Seleccione un fabricante o motor')
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
  <div class="bg-[#f8fafc] min-h-screen text-slate-800 flex flex-col font-sans select-none">
    
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
    <!-- 1. BARRA SUPERIOR INTEGRADA CON COLORES SWGORA Y BÚSQUEDA EXCLUSIVA       -->
    <!-- ========================================================================= -->
    <header class="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-2xs sticky top-0 z-30">
      
      <!-- Centro/Principal: Buscador de Código de Pieza -->
      <div class="flex-1 max-w-3xl">
        <div class="relative flex items-center bg-slate-50 hover:bg-white focus-within:bg-white rounded-lg shadow-2xs overflow-hidden border border-slate-200 focus-within:border-[#04c4d9] focus-within:ring-2 focus-within:ring-[#04c4d9]/20 transition">
          <!-- Icono Objetivo / Diana Izquierda -->
          <div class="pl-3 pr-2 flex items-center pointer-events-none">
            <Target class="w-4 h-4 text-[#04c4d9]" />
          </div>

          <!-- Input Central -->
          <input
            v-model="searchCode"
            type="text"
            placeholder="Búsqueda por número de pieza o código de artículo (OEM, Dokuro, Rik, NPR, NDC, Ajusa, Pioneer...)"
            class="w-full py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-medium focus:outline-none bg-transparent"
          />

          <!-- Botón Limpiar si hay texto -->
          <button
            v-if="searchCode"
            @click="searchCode = ''"
            type="button"
            class="px-2 text-slate-400 hover:text-slate-600"
            title="Limpiar búsqueda"
          >
            <X class="w-3.5 h-3.5" />
          </button>

          <!-- Micrófono -->
          <button 
            type="button" 
            class="px-2.5 text-slate-400 hover:text-slate-600 border-r border-slate-200 hidden sm:block"
            title="Búsqueda por voz"
          >
            <Mic class="w-4 h-4" />
          </button>

          <!-- Botón Lupa con Color de Marca SWGORA -->
          <button
            type="button"
            class="bg-[#04c4d9] hover:bg-[#03a9bc] text-white px-4 py-2 text-sm flex items-center justify-center transition shrink-0"
            title="Buscar"
          >
            <Search class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Derecha: Iconos de Utilidad en Paleta Neutral / Marca -->
      <div class="flex items-center gap-1 sm:gap-1.5 text-slate-500 shrink-0">
        <button type="button" class="p-2 hover:text-[#038896] hover:bg-cyan-50 rounded-lg transition" title="Historial">
          <History class="w-4 h-4" />
        </button>
        <button type="button" class="p-2 hover:text-[#038896] hover:bg-cyan-50 rounded-lg transition" title="Documentación de taller">
          <FileText class="w-4 h-4" />
        </button>
        <button type="button" class="p-2 hover:text-[#038896] hover:bg-cyan-50 rounded-lg transition hidden sm:inline" title="Idioma">
          <Languages class="w-4 h-4" />
        </button>
        <button type="button" class="p-2 hover:text-[#038896] hover:bg-cyan-50 rounded-lg transition" title="Configuración">
          <Settings class="w-4 h-4" />
        </button>
      </div>

    </header>

    <!-- ========================================================================= -->
    <!-- 2. BARRA DE BREADCRUMBS Y RETORNO                                         -->
    <!-- ========================================================================= -->
    <div class="bg-slate-50/80 border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-slate-600">
      <div class="flex items-center gap-2">
        <button 
          v-if="activeMotor || searchCode" 
          type="button" 
          @click="activeMotor = null; searchCode = ''" 
          class="flex items-center gap-1 text-[#04c4d9] hover:text-[#038896] hover:underline font-bold"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Volver a Marcas</span>
        </button>
        <span v-else class="text-slate-700 font-bold flex items-center gap-1.5">
          <Car class="w-3.5 h-3.5 text-[#04c4d9]" /> Catálogo Técnico de Marcas
        </span>

        <span v-if="activeMotor" class="text-slate-300">/</span>
        <span v-if="activeMotor" class="font-bold text-slate-900">
          {{ selectedFabricanteNombre || 'Toyota' }} > Motor {{ activeMotor.codigo }}
        </span>
      </div>

      <div class="text-[11px] text-slate-400 font-medium">
        SWGORA • JR Blanco Rectificadora
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 2.5. BARRA DE FILTROS MÓVIL (< 768px)                                      -->
    <!-- ========================================================================= -->
    <div class="md:hidden bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between shadow-2xs">
      <button 
        type="button" 
        @click="mobileFiltersOpen = !mobileFiltersOpen"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition border border-slate-200"
      >
        <SlidersHorizontal class="w-3.5 h-3.5 text-[#04c4d9]" />
        <span>Filtros de Búsqueda</span>
        <span v-if="selectedFabricanteNombre || activeMotor" class="w-2 h-2 rounded-full bg-[#04c4d9]"></span>
      </button>

      <div v-if="activeMotor" class="text-xs font-mono font-bold text-slate-700 bg-cyan-50 px-2 py-1 rounded border border-cyan-200">
        Motor {{ activeMotor.codigo }}
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. CONTENIDO PRINCIPAL: DOS COLUMNAS (BÚSQUEDA MANUAL + MARCAS/MATRIZ)   -->
    <!-- ========================================================================= -->
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      
      <!-- --------------------------------------------------------------------- -->
      <!-- COLUMNA IZQUIERDA: FORMULARIO "BÚSQUEDA MANUAL"                       -->
      <!-- --------------------------------------------------------------------- -->
      <aside 
        :class="[
          'w-full md:w-64 lg:w-72 bg-white border-r border-slate-200 p-3 sm:p-4 flex flex-col justify-between shrink-0 shadow-2xs overflow-y-auto',
          mobileFiltersOpen ? 'flex' : 'hidden md:flex',
          sidebarCollapsed ? 'md:hidden!' : ''
        ]"
      >
        <div class="space-y-3">
          
          <!-- Encabezado de la barra lateral con estilo de la página -->
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <div class="flex items-center gap-1.5 text-slate-900 font-black text-xs uppercase tracking-tight">
              <SlidersHorizontal class="w-3.5 h-3.5 text-[#04c4d9]" />
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
          <div class="space-y-2 text-xs">
            
            <!-- Fabricante -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Fabricante</label>
              <select
                v-model="selectedFabricanteNombre"
                @change="onFabricanteChange"
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
              >
                <option value="">Seleccione Fabricante...</option>
                <option v-for="b in brandsList" :key="b.id" :value="b.name">{{ b.name }}</option>
              </select>
            </div>

            <!-- Modelos (En cascada según Fabricante) -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Modelos</label>
              <select
                v-model="selectedModeloNombre"
                @change="onModeloChange"
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
              >
                <option value="">Todos los modelos</option>
                <option v-for="m in availableModelos" :key="m.id" :value="m.nombre">{{ m.nombre }}</option>
              </select>
            </div>

            <!-- Código / Selector de Motor (En cascada según Modelo y Fabricante) -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Motor / Cilindrada</label>
              <select
                v-model="selectedMotorCodigo"
                @change="onMotorChange"
                class="w-full px-2.5 py-1.5 text-xs bg-cyan-50/50 border border-cyan-300 rounded-lg text-slate-900 font-bold font-mono focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
              >
                <option value="">Seleccione Motor...</option>
                <option v-for="mot in availableMotores" :key="mot.id" :value="mot.codigo">
                  {{ mot.codigo }} ({{ mot.combustible }})
                </option>
              </select>
            </div>

            <!-- Tipo -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Tipo / Carrocería</label>
              <select
                v-model="selectedTipo"
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
              >
                <option value="">Todos los tipos</option>
                <option value="pick-up">Pick-up Doble Cabina</option>
                <option value="van">Furgón / Panel</option>
                <option value="suv">Todo Terreno / SUV</option>
              </select>
            </div>

            <!-- Año de construcción -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Año de construcción</label>
              <select
                v-model="selectedAnio"
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
              >
                <option value="">Todos los años</option>
                <option v-for="y in [2022, 2020, 2018, 2015, 2010, 2005, 2000, 1995, 1990]" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>

            <!-- Combustibles -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Combustible</label>
              <select
                v-model="selectedCombustible"
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
              >
                <option value="Todos los combustibles">Todos los combustibles</option>
                <option value="Diésel">Diésel</option>
                <option value="Gasolina">Gasolina</option>
              </select>
            </div>

            <!-- Cilindrada cc -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Cilindrada (cc)</label>
              <input
                v-model="filterCc"
                type="text"
                placeholder="ej. 2800 o 2400"
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
              />
            </div>

            <!-- Potencia (CV / kW) -->
            <div>
              <label class="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Potencia</label>
              <div class="flex items-center gap-1">
                <input
                  v-model="filterPotencia"
                  type="text"
                  placeholder="ej. 90 o 130"
                  class="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-[#04c4d9] transition"
                />
                <button
                  type="button"
                  @click="potenciaUnit = potenciaUnit === 'CV' ? 'kW' : 'CV'"
                  class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 transition"
                >
                  {{ potenciaUnit }}
                </button>
              </div>
            </div>

          </div>

        </div>

        <!-- Botones de Acción (Limpiar / Buscar) con Colores de SWGORA -->
        <div class="pt-3 border-t border-slate-200 flex items-center gap-2 mt-4">
          <button
            type="button"
            @click="handleResetFilters"
            class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition border border-slate-200"
            title="Limpiar filtros"
          >
            <RotateCcw class="w-4 h-4" />
          </button>

          <button
            type="button"
            @click="handleManualSearch"
            class="flex-1 py-2 px-3 bg-[#04c4d9] hover:bg-[#03a9bc] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition shadow-xs"
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
              class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
              title="Colapsar / Expandir panel de búsqueda"
            >
              <ChevronRight v-if="sidebarCollapsed" class="w-4 h-4" />
              <ChevronLeft v-else class="w-4 h-4" />
            </button>

            <!-- Pestañas Marcas preferidas / Todas las marcas -->
            <div class="flex items-center gap-1 text-xs">
              <button
                type="button"
                @click="activeBrandTab = 'preferidas'; activeMotor = null; searchCode = ''"
                :class="[
                  'px-3 py-1.5 font-bold rounded-lg transition text-xs',
                  activeBrandTab === 'preferidas' && !activeMotor && !searchCode
                    ? 'bg-cyan-50 text-[#038896] border border-cyan-300 font-black shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                ]"
              >
                Marcas preferidas
              </button>

              <button
                type="button"
                @click="activeBrandTab = 'todas'; activeMotor = null; searchCode = ''"
                :class="[
                  'px-3 py-1.5 font-bold rounded-lg transition text-xs',
                  activeBrandTab === 'todas' && !activeMotor && !searchCode
                    ? 'bg-cyan-50 text-[#038896] border border-cyan-300 font-black shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
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
        <!-- CASO 1: CUADRÍCULA DE TARJETAS DE MARCAS                            -->
        <!-- =================================================================== -->
        <div v-if="!activeMotor && !searchCode" class="space-y-4">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div
              v-for="brand in visibleBrands"
              :key="brand.id"
              @click="handleSelectBrandCard(brand)"
              class="bg-white border border-slate-200/80 rounded-xl p-3 sm:p-3.5 flex items-center gap-3 hover:border-[#04c4d9] hover:shadow-xs transition cursor-pointer group"
            >
              <!-- Emblema / Icono de la Marca -->
              <div class="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                <!-- SVG estilizado para marcas -->
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
                <span class="text-xs font-black text-slate-900 group-hover:text-[#038896] transition truncate block tracking-tight">
                  {{ brand.name }}
                </span>
                <span v-if="brand.hasEnginesInDb" class="text-[9px] text-[#04c4d9] font-bold">
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
          <div class="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {{ selectedFabricanteNombre || 'TOYOTA' }} > {{ activeMotor?.codigo || 'MOTOR DE TALLER' }}
                </span>
                <span class="text-[10px] bg-cyan-50 text-[#038896] px-2 py-0.5 rounded-full font-bold border border-cyan-200">
                  {{ activeMotor?.combustible || 'Diésel' }}
                </span>
                <span v-if="activeMotor?.anios" class="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                  {{ activeMotor?.anios }}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="font-medium text-slate-700">{{ activeMotor?.nombre_comercial }}</span>
                <span v-if="activeMotor?.cilindrada_cc" class="text-slate-400">• {{ activeMotor.cilindrada_cc }} cc</span>
                <span v-if="activeMotor?.diametro_cilindro_std_mm" class="font-bold text-slate-800">
                  • Calibre STD: Ø{{ activeMotor?.diametro_cilindro_std_mm.toFixed(2) }} mm
                </span>
                <span v-if="activeMotor?.carrera_piston_mm" class="text-slate-600">
                  • Carrera: {{ activeMotor?.carrera_piston_mm.toFixed(2) }} mm
                </span>
                <span v-if="activeMotor?.valvulas" class="text-slate-500">
                  • {{ activeMotor.valvulas }}V
                </span>
              </p>
            </div>

            <button
              type="button"
              @click="activeMotor = null; searchCode = ''"
              class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition shrink-0"
            >
              ← Cambiar Vehículo
            </button>
          </div>

          <!-- Filtros de Subsistemas -->
          <div class="flex items-center gap-1 overflow-x-auto bg-white p-2 rounded-xl border border-slate-200">
            <button
              v-for="sub in subsystems"
              :key="sub"
              type="button"
              @click="selectedSubsystem = sub"
              :class="[
                'px-2.5 py-1 text-xs font-bold rounded-lg transition whitespace-nowrap',
                selectedSubsystem === sub
                  ? 'bg-[#04c4d9] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              ]"
            >
              {{ sub }}
            </button>
          </div>

          <!-- Tabla Técnica Multimarca de Alta Densidad -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <!-- Indicador móvil de desplazamiento horizontal -->
            <div class="md:hidden text-[10px] text-slate-400 bg-slate-50 px-3 py-1 text-center font-medium border-b border-slate-200">
              ↔ Desliza la tabla para ver cruces alternos, medidas y precios
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs min-w-[950px]">
                <thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 sticky top-0">
                  <tr>
                    <th class="px-3.5 py-2.5 min-w-[190px]">Pieza / Subsistema</th>
                    <th class="px-3 py-2.5 min-w-[120px] bg-cyan-50/60 text-[#038896]">Código OEM</th>
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
                    class="hover:bg-cyan-50/20 transition group"
                  >
                    
                    <!-- Pieza -->
                    <td class="px-3.5 py-2">
                      <div class="font-bold text-slate-900 group-hover:text-[#038896] transition leading-tight">
                        {{ rep.nombre }}
                      </div>
                      <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span class="font-semibold text-slate-600">{{ rep.subsistema }}</span>
                        <span>•</span>
                        <span class="text-[#038896] font-mono font-bold">{{ getMotorBadge(rep.motor_id) }}</span>
                      </div>
                    </td>

                    <!-- OEM -->
                    <td class="px-3 py-2 bg-cyan-50/20 font-mono font-black text-cyan-950">
                      <button
                        type="button"
                        @click="copyToClipboard(rep.codigo_oem, 'OEM')"
                        class="inline-flex items-center gap-1 hover:text-[#038896] hover:underline"
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
                          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 transition"
                          title="Copiar Ajusa"
                        >
                          <span class="text-[9px] text-cyan-600 font-sans">Aju:</span> <strong>{{ getBrandCode(rep, 'Ajusa') }}</strong>
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
                        class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-lg transition shadow-2xs"
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
