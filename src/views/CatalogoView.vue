<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { 
  catalogService,
  type Motor, 
  type RepuestoTecnico, 
  type Fabricante,
  mockFabricantes
} from '@/services/catalogService'
import { 
  Search, 
  Car, 
  Ruler, 
  Hash, 
  Copy, 
  Check, 
  Plus, 
  Wrench, 
  CheckCircle2, 
  RotateCcw, 
  ChevronRight, 
  Sparkles, 
  X,
  Package
} from 'lucide-vue-next'

// =============================================================================
// ESTADO GLOBAL DE NAVEGACIÓN Y PESTAÑAS (RCT - 3 MODALIDADES)
// =============================================================================
type TabMode = 'vehiculo' | 'medidas' | 'codigo'
const activeTab = ref<TabMode>('vehiculo')

// Toast Feedback
const toastMessage = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (msg: string) => {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 2400)
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
      motor: part.motor?.codigo || 'Adaptable',
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

// Badges de Catálogos de Procedencia
const getBrandBadgeClass = (brand?: string) => {
  const b = (brand || '').toLowerCase()
  if (b.includes('dokuro')) return 'bg-rose-50 text-rose-700 border-rose-200'
  if (b.includes('rik')) return 'bg-blue-50 text-blue-700 border-blue-200'
  if (b.includes('npr')) return 'bg-cyan-50 text-cyan-800 border-cyan-200'
  if (b.includes('ndc')) return 'bg-amber-50 text-amber-800 border-amber-200'
  if (b.includes('ajusa')) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (b.includes('pioneer')) return 'bg-purple-50 text-purple-700 border-purple-200'
  if (b.includes('taiho')) return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-slate-100 text-slate-800 border-slate-300'
}

// =============================================================================
// MODALIDAD 1: BÚSQUEDA PRINCIPAL (JERARQUÍA VEHICULAR Y PROGRESIVA)
// Fabricante -> Código de Motor -> Grupo de Repuestos
// =============================================================================
const fabricantes = ref<Fabricante[]>(mockFabricantes)
const selectedBrand = ref<string>('Toyota')
const brandMotors = ref<Motor[]>([])
const selectedMotor = ref<Motor | null>(null)
const selectedSubsystem = ref<string>('Todos')
const vehicleParts = ref<RepuestoTecnico[]>([])
const vehicleFilterText = ref<string>('')

const subsystemsList = [
  'Todos',
  'Culata',
  'Block',
  'Cigüeñal',
  'Bielas',
  'Sellos y Juntas'
]

// Cargar motores según la marca seleccionada
const loadMotorsForBrand = async (brandName: string) => {
  const motors = await catalogService.getMotorsByBrand(brandName)
  brandMotors.value = motors
  if (motors.length > 0) {
    selectedMotor.value = motors[0]
  } else {
    selectedMotor.value = null
  }
}

// Cargar repuestos según motor y subsistema
const loadPartsForVehicle = async () => {
  if (!selectedMotor.value) {
    vehicleParts.value = []
    return
  }
  const parts = await catalogService.searchByVehicle(
    selectedBrand.value,
    selectedMotor.value.id,
    selectedSubsystem.value
  )
  vehicleParts.value = parts
}

// Al cambiar marca
const selectBrand = (brandName: string) => {
  selectedBrand.value = brandName
  selectedSubsystem.value = 'Todos'
  loadMotorsForBrand(brandName)
}

// Al cambiar motor
const selectMotor = (motor: Motor) => {
  selectedMotor.value = motor
  selectedSubsystem.value = 'Todos'
  loadPartsForVehicle()
}

// Al cambiar subsistema
const selectSubsystem = (sub: string) => {
  selectedSubsystem.value = sub
  loadPartsForVehicle()
}

watch(selectedBrand, () => {
  loadMotorsForBrand(selectedBrand.value)
})

watch(selectedMotor, () => {
  loadPartsForVehicle()
})

const filteredVehicleParts = computed(() => {
  if (!vehicleFilterText.value.trim()) return vehicleParts.value
  const q = vehicleFilterText.value.toLowerCase().trim().replace(/[-\s]/g, '')
  return vehicleParts.value.filter(p => {
    const matchOem = p.codigo_oem.toLowerCase().replace(/[-\s]/g, '').includes(q)
    const matchName = p.nombre.toLowerCase().includes(vehicleFilterText.value.toLowerCase())
    const matchCat = p.categoria.toLowerCase().includes(vehicleFilterText.value.toLowerCase())
    const matchEquiv = p.equivalencias?.some(eq =>
      eq.codigo_alterno.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
      eq.marca_alterna.toLowerCase().includes(q)
    )
    return matchOem || matchName || matchCat || matchEquiv
  })
})

// =============================================================================
// MODALIDAD 2: BÚSQUEDA DIMENSIONAL / POR MEDIDAS (ADAPTACIONES)
// =============================================================================
type ComponentCategory = 'Sellos' | 'Válvulas' | 'Anillos' | 'Pernos' | 'Casquetería'
const selectedComponent = ref<ComponentCategory>('Sellos')
const toleranciaMm = ref<number>(0.25)

// Formularios reactivos por tipo de componente
const dimSellos = ref({
  diametro_interior: '',
  diametro_exterior: '',
  altura: ''
})

const dimValvulas = ref({
  diametro_cabeza: '',
  diametro_vastago: '',
  longitud_total: ''
})

const dimAnillos = ref({
  diametro_cilindro: '',
  espesor_anillo1: '',
  espesor_anillo2: '',
  espesor_aceite: ''
})

const dimPernos = ref({
  medida_rosca: '',
  paso_rosca: '',
  longitud_perno: '',
  cantidad_piezas: '',
  paso_rosca1: '',
  longitud1: '',
  longitud2: ''
})

const dimCasqueteria = ref({
  tipo_cojinete: 'MS',
  diametro_munon: '',
  ancho_casquete: ''
})

const dimensionalResults = ref<RepuestoTecnico[]>([])
const hasSearchedDimensions = ref<boolean>(false)

// Ejecutar búsqueda dimensional
const executeDimensionalSearch = async () => {
  hasSearchedDimensions.value = true
  let dims: Record<string, number | string> = {
    tolerancia_mm: toleranciaMm.value
  }

  if (selectedComponent.value === 'Sellos') {
    dims = {
      ...dims,
      diametro_interior: Number(dimSellos.value.diametro_interior) || 0,
      diametro_exterior: Number(dimSellos.value.diametro_exterior) || 0,
      altura: Number(dimSellos.value.altura) || 0
    }
  } else if (selectedComponent.value === 'Válvulas') {
    dims = {
      ...dims,
      diametro_cabeza: Number(dimValvulas.value.diametro_cabeza) || 0,
      diametro_vastago: Number(dimValvulas.value.diametro_vastago) || 0,
      longitud_total: Number(dimValvulas.value.longitud_total) || 0
    }
  } else if (selectedComponent.value === 'Anillos') {
    dims = {
      ...dims,
      diametro_cilindro: Number(dimAnillos.value.diametro_cilindro) || 0,
      espesor_anillo1: Number(dimAnillos.value.espesor_anillo1) || 0,
      espesor_anillo2: Number(dimAnillos.value.espesor_anillo2) || 0,
      espesor_aceite: Number(dimAnillos.value.espesor_aceite) || 0
    }
  } else if (selectedComponent.value === 'Pernos') {
    dims = {
      ...dims,
      medida_rosca: dimPernos.value.medida_rosca,
      paso_rosca: Number(dimPernos.value.paso_rosca) || 0,
      longitud_perno: Number(dimPernos.value.longitud_perno) || 0,
      cantidad_piezas: Number(dimPernos.value.cantidad_piezas) || 0,
      paso_rosca1: Number(dimPernos.value.paso_rosca1) || 0,
      longitud1: Number(dimPernos.value.longitud1) || 0,
      longitud2: Number(dimPernos.value.longitud2) || 0
    }
  } else if (selectedComponent.value === 'Casquetería') {
    dims = {
      ...dims,
      tipo_cojinete: dimCasqueteria.value.tipo_cojinete,
      diametro_munon: Number(dimCasqueteria.value.diametro_munon) || 0,
      ancho_casquete: Number(dimCasqueteria.value.ancho_casquete) || 0
    }
  }

  const results = await catalogService.searchByDimensions(selectedComponent.value, dims)
  dimensionalResults.value = results
}

// Botones de Muestras Rápidas de Taller
const loadSampleSello = () => {
  selectedComponent.value = 'Sellos'
  dimSellos.value.diametro_interior = '4.8'
  dimSellos.value.diametro_exterior = '10.8'
  dimSellos.value.altura = '10'
  executeDimensionalSearch()
  showToast('Muestra cargada: Sello Vitón 4.8 x 10.8 x 10 mm')
}

const loadSampleValvula = () => {
  selectedComponent.value = 'Válvulas'
  dimValvulas.value.diametro_cabeza = '42.5'
  dimValvulas.value.diametro_vastago = '8.0'
  dimValvulas.value.longitud_total = '103.5'
  executeDimensionalSearch()
  showToast('Muestra cargada: Válvula Admisión 42.5 x 8.0 x 103.5 mm')
}

const loadSampleAnillos = () => {
  selectedComponent.value = 'Anillos'
  dimAnillos.value.diametro_cilindro = '96'
  dimAnillos.value.espesor_anillo1 = '2.0'
  dimAnillos.value.espesor_anillo2 = '2.0'
  dimAnillos.value.espesor_aceite = '4.0'
  executeDimensionalSearch()
  showToast('Muestra cargada: Anillos Ø96mm (2.0 / 2.0 / 4.0 mm)')
}

const loadSamplePernos = () => {
  selectedComponent.value = 'Pernos'
  dimPernos.value.medida_rosca = 'M12'
  dimPernos.value.paso_rosca = '1.25'
  dimPernos.value.longitud_perno = '120'
  dimPernos.value.cantidad_piezas = '18'
  dimPernos.value.paso_rosca1 = '1.25'
  dimPernos.value.longitud1 = '120'
  dimPernos.value.longitud2 = '120'
  executeDimensionalSearch()
  showToast('Muestra cargada: Pernos Culata M12 x 1.25 x 120 mm (18 pcs)')
}

const resetDimensionalForm = () => {
  dimSellos.value = { diametro_interior: '', diametro_exterior: '', altura: '' }
  dimValvulas.value = { diametro_cabeza: '', diametro_vastago: '', longitud_total: '' }
  dimAnillos.value = { diametro_cilindro: '', espesor_anillo1: '', espesor_anillo2: '', espesor_aceite: '' }
  dimPernos.value = { medida_rosca: '', paso_rosca: '', longitud_perno: '', cantidad_piezas: '', paso_rosca1: '', longitud1: '', longitud2: '' }
  dimCasqueteria.value = { tipo_cojinete: 'MS', diametro_munon: '', ancho_casquete: '' }
  dimensionalResults.value = []
  hasSearchedDimensions.value = false
}

// =============================================================================
// MODALIDAD 3: BÚSQUEDA INVERSA POR CÓDIGO ORIGINAL O REFERENCIA
// =============================================================================
const codeSearchQuery = ref<string>('')
const codeSearchResults = ref<RepuestoTecnico[]>([])
const hasSearchedCode = ref<boolean>(false)

const executeCodeSearch = async (term?: string) => {
  const q = term !== undefined ? term : codeSearchQuery.value
  if (!q || !q.trim()) {
    codeSearchResults.value = []
    hasSearchedCode.value = false
    return
  }
  codeSearchQuery.value = q
  hasSearchedCode.value = true
  const results = await catalogService.searchByCode(q)
  codeSearchResults.value = results
}

const quickCodeChips = [
  { label: 'Sello 4.8mm', code: '90913-02090' },
  { label: 'Dokuro SV-108', code: 'SV-108' },
  { label: 'Anillos RIK 3L', code: '28006' },
  { label: 'Cojinetes NDC Bancada', code: 'MS-1140A' },
  { label: 'Pernos Ajusa M12', code: '81014300' },
  { label: 'Válvula Adm 3L', code: '13711-54020' },
  { label: 'Pernos M10 Z24', code: '11056-21W00' },
  { label: 'Ajusa 1KD MLS', code: '10156900' }
]

// Ciclo de vida inicial
onMounted(async () => {
  await loadMotorsForBrand(selectedBrand.value)
})
</script>

<template>
  <div class="bg-[#f8fafc] min-h-screen text-slate-800 flex flex-col font-sans select-none">
    
    <!-- Toast Flotante de Confirmación -->
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
        class="fixed bottom-5 right-5 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold"
      >
        <CheckCircle2 class="w-4 h-4 text-[#04c4d9]" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- ENCABEZADO TÉCNICO Y TABS MAESTROS DE NAVEGACIÓN (RCT)                     -->
    <!-- ========================================================================= -->
    <header class="bg-white border-b border-slate-200 shadow-2xs sticky top-0 z-30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          <!-- Título del Panel de Catálogo Técnico -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-slate-900 text-[#04c4d9] flex items-center justify-center shadow-xs">
              <Wrench class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Catálogo Técnico & Motor de Adaptaciones</h1>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-[#04c4d9] border border-cyan-200">
                  JR Blanco • Rectificadora
                </span>
              </div>
              <p class="text-xs text-slate-500">
                Consulta multimarca (Dokuro, Rik, NPR, NDC, Ajusa) y cálculo dimensional en milímetros
              </p>
            </div>
          </div>

          <!-- Badges de Marcas Integradas -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[11px] font-semibold text-slate-400 mr-1 hidden lg:inline">Catálogos:</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">Dokuro</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">Rik</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-cyan-50 text-cyan-800 border-cyan-200">NPR</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">NDC</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">Ajusa</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">Pioneer</span>
          </div>
        </div>

        <!-- Barra de Pestañas Principales (3 Modalidades) -->
        <div class="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 overflow-x-auto">
          <!-- Tab 1 -->
          <button
            type="button"
            @click="activeTab = 'vehiculo'"
            :class="[
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px]',
              activeTab === 'vehiculo'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            ]"
          >
            <Car class="w-4 h-4 text-[#04c4d9]" />
            <span>Por Vehículo / Motor</span>
            <span v-if="selectedMotor" class="ml-1 text-[11px] px-1.5 py-0.2 bg-white/20 rounded font-mono">
              {{ selectedMotor.codigo }}
            </span>
          </button>

          <!-- Tab 2 -->
          <button
            type="button"
            @click="activeTab = 'medidas'"
            :class="[
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px]',
              activeTab === 'medidas'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            ]"
          >
            <Ruler class="w-4 h-4 text-[#04c4d9]" />
            <span>Búsqueda por Medidas (Adaptaciones)</span>
            <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-[#04c4d9]/20 text-[#04c4d9] font-black uppercase">
              Taller
            </span>
          </button>

          <!-- Tab 3 -->
          <button
            type="button"
            @click="activeTab = 'codigo'"
            :class="[
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap min-h-[44px]',
              activeTab === 'codigo'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            ]"
          >
            <Hash class="w-4 h-4 text-[#04c4d9]" />
            <span>Por Código OEM / Referencia</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ========================================================================= -->
    <!-- CONTENIDO PRINCIPAL POR MODALIDAD                                         -->
    <!-- ========================================================================= -->
    <main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">

      <!-- ======================================================================= -->
      <!-- TAB 1: POR VEHÍCULO / MOTOR (JERARQUÍA PROGRESIVA)                      -->
      <!-- ======================================================================= -->
      <section v-if="activeTab === 'vehiculo'" class="space-y-6">
        
        <!-- 1. Cuadrícula Táctil de Fabricantes / Marcas -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#04c4d9]"></span>
              <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Paso 1: Selecciona la Marca / Fabricante
              </h2>
            </div>
            <span class="text-xs text-slate-500 font-medium">
              Marca activa: <strong class="text-slate-900">{{ selectedBrand }}</strong>
            </span>
          </div>

          <!-- Selector de Marcas Táctiles (Mínimo 44px de altura) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <button
              v-for="fab in fabricantes"
              :key="fab.id"
              type="button"
              @click="selectBrand(fab.nombre)"
              :class="[
                'flex flex-col items-center justify-center p-3 rounded-xl border text-center transition min-h-[58px]',
                selectedBrand.toLowerCase() === fab.nombre.toLowerCase()
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-[#04c4d9]/40'
                  : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              ]"
            >
              <span class="font-extrabold text-sm tracking-tight">{{ fab.nombre }}</span>
              <span 
                :class="[
                  'text-[10px] mt-0.5',
                  selectedBrand.toLowerCase() === fab.nombre.toLowerCase() ? 'text-[#04c4d9]' : 'text-slate-400'
                ]"
              >
                {{ fab.engines_count ? `${fab.engines_count} motores` : 'Ver motores' }}
              </span>
            </button>
          </div>
        </div>

        <!-- 2. Lista de Motores Vinculados a la Marca (Comportamiento progresivo) -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-500"></span>
              <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Paso 2: Motores Vinculados a {{ selectedBrand }} (Selección directa)
              </h2>
            </div>
            <span class="text-xs text-slate-400">
              {{ brandMotors.length }} modelos registrados
            </span>
          </div>

          <!-- Cuadrícula de motores de la marca -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="motor in brandMotors"
              :key="motor.id"
              @click="selectMotor(motor)"
              :class="[
                'p-4 rounded-xl border cursor-pointer transition flex items-center justify-between',
                selectedMotor?.id === motor.id
                  ? 'bg-cyan-50/60 border-[#04c4d9] ring-2 ring-[#04c4d9]/20 shadow-xs'
                  : 'bg-slate-50/60 hover:bg-white border-slate-200 hover:border-slate-300'
              ]"
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-black text-base text-slate-900 font-mono tracking-tight">
                    {{ motor.codigo }}
                  </span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700">
                    {{ motor.combustible }}
                  </span>
                </div>
                <div class="text-xs text-slate-600 font-medium mt-1">
                  {{ motor.nombre_comercial }}
                </div>
                <div class="text-[11px] text-slate-400 mt-0.5">
                  {{ motor.configuracion }} • Ø {{ motor.diametro_cilindro_std_mm || '--' }}mm
                </div>
              </div>

              <div class="text-right">
                <span 
                  :class="[
                    'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                    selectedMotor?.id === motor.id
                      ? 'bg-[#04c4d9] text-white shadow-xs'
                      : 'bg-slate-200 text-slate-500'
                  ]"
                >
                  <ChevronRight class="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Componentes del Motor Seleccionado con Selector de Grupos -->
        <div v-if="selectedMotor" class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          
          <!-- Encabezado del motor y selector de subsistemas -->
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Paso 3: Componentes del Motor</span>
                <span class="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {{ selectedBrand }} • {{ selectedMotor.codigo }}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-1">
                Filtra por subsistema o busca componentes compatibles y equivalencias cruzadas
              </p>
            </div>

            <!-- Buscador en tiempo real dentro del motor -->
            <div class="relative w-full lg:w-72">
              <Search class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                v-model="vehicleFilterText"
                type="text"
                placeholder="Filtrar por código o nombre..."
                class="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9]"
              />
            </div>
          </div>

          <!-- Chips de Subsistemas (Mínimo 44px de altura táctil) -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              v-for="sub in subsystemsList"
              :key="sub"
              type="button"
              @click="selectSubsystem(sub)"
              :class="[
                'px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap min-h-[40px] flex items-center gap-1.5',
                selectedSubsystem === sub
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              ]"
            >
              <span>{{ sub }}</span>
              <span v-if="selectedSubsystem === sub" class="w-1.5 h-1.5 rounded-full bg-[#04c4d9]"></span>
            </button>
          </div>

          <!-- Matriz de Repuestos Técnicos -->
          <div v-if="filteredVehicleParts.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <div
              v-for="part in filteredVehicleParts"
              :key="part.id"
              class="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-[#04c4d9]/60 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <!-- Cabecera de la Tarjeta: OEM y Catálogo Origen -->
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Código OEM</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="font-mono font-black text-sm text-slate-900">{{ part.codigo_oem }}</span>
                      <button
                        type="button"
                        @click="copyToClipboard(part.codigo_oem, 'OEM')"
                        class="p-1 text-slate-400 hover:text-slate-800 transition"
                        title="Copiar OEM"
                      >
                        <Copy v-if="copiedCode !== part.codigo_oem" class="w-3.5 h-3.5" />
                        <Check v-else class="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    </div>
                  </div>

                  <!-- Badge de catálogo fuente principal -->
                  <span 
                    :class="[
                      'text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase',
                      getBrandBadgeClass(part.catalogo_origen || part.equivalencias?.[0]?.marca_alterna)
                    ]"
                  >
                    {{ part.catalogo_origen || part.equivalencias?.[0]?.marca_alterna || 'Catálogo' }}
                  </span>
                </div>

                <!-- Nombre y Subsistema -->
                <div class="mt-2.5">
                  <h3 class="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                    {{ part.nombre }}
                  </h3>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {{ part.subsistema }}
                    </span>
                    <span class="text-[10px] text-slate-400 font-medium">
                      {{ part.categoria }}
                    </span>
                  </div>
                </div>

                <!-- Ficha Técnica de Medidas -->
                <div class="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] space-y-1">
                  <!-- Válvulas -->
                  <div v-if="part.diametro_cabeza_mm || part.diametro_vastago_mm" class="font-mono text-slate-700">
                    <span class="text-slate-400">Medidas:</span> 
                    Hongo: <strong>{{ part.diametro_cabeza_mm }}mm</strong> • Vástago: <strong>{{ part.diametro_vastago_mm }}mm</strong> • L: <strong>{{ part.longitud_total_mm }}mm</strong>
                  </div>

                  <!-- Sellos de Válvula -->
                  <div v-if="part.diametro_interior_mm || part.diametro_exterior_mm" class="font-mono text-slate-700">
                    <span class="text-slate-400">Sellos:</span>
                    D.Int: <strong>{{ part.diametro_interior_mm }}mm</strong> • D.Ext: <strong>{{ part.diametro_exterior_mm }}mm</strong> • Alt: <strong>{{ part.altura_mm }}mm</strong>
                  </div>

                  <!-- Anillos de Pistón -->
                  <div v-if="part.diametro_cilindro_mm" class="font-mono text-slate-700">
                    <span class="text-slate-400">Anillos:</span>
                    Ø <strong>{{ part.diametro_cilindro_mm }}mm</strong> (1°: {{ part.espesor_anillo1_mm }}mm | 2°: {{ part.espesor_anillo2_mm }}mm | Aceite: {{ part.espesor_aceite_mm }}mm)
                  </div>

                  <!-- Pernos de Culata -->
                  <div v-if="part.medida_rosca || part.longitud_perno_mm" class="font-mono text-slate-700">
                    <span class="text-slate-400">Pernos:</span>
                    Rosca: <strong>{{ part.medida_rosca }} x {{ part.paso_rosca_mm }}</strong> • L: <strong>{{ part.longitud_perno_mm }}mm</strong> ({{ part.cantidad_piezas }} pcs)
                  </div>

                  <!-- Cojinetes NDC -->
                  <div v-if="part.tipo_cojinete" class="font-mono text-slate-700">
                    <span class="text-slate-400">Cojinete NDC ({{ part.tipo_cojinete }}):</span>
                    Muñón: <strong>{{ part.diametro_munon_mm }}mm</strong> • Ancho: <strong>{{ part.ancho_casquete_mm }}mm</strong>
                  </div>
                </div>

                <!-- Equivalencias Alternas (Dokuro, Rik, NPR, NDC, Ajusa) -->
                <div v-if="part.equivalencias && part.equivalencias.length > 0" class="mt-2.5 space-y-1">
                  <span class="text-[10px] font-semibold text-slate-400 block">Equivalencias multimarca:</span>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="eq in part.equivalencias"
                      :key="eq.id"
                      @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                      :class="[
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer hover:shadow-2xs transition',
                        getBrandBadgeClass(eq.marca_alterna)
                      ]"
                      :title="`Click para copiar código de ${eq.marca_alterna}`"
                    >
                      <span>{{ eq.marca_alterna }}:</span>
                      <span>{{ eq.codigo_alterno }}</span>
                      <Copy class="w-2.5 h-2.5 opacity-60" />
                    </span>
                  </div>
                </div>
              </div>

              <!-- Botones de Acción Rápida -->
              <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div class="text-xs font-bold text-slate-900">
                  ${{ part.precio.toFixed(2) }}
                  <span class="text-[10px] font-normal text-slate-400">({{ part.stock }} disponibles)</span>
                </div>

                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    @click="copyToClipboard(part.codigo_oem, 'OEM')"
                    class="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <Copy class="w-3 h-3" />
                    <span>Copiar</span>
                  </button>

                  <button
                    type="button"
                    @click="addToWorkOrder(part)"
                    :class="[
                      'px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-2xs',
                      addedPartId === part.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#04c4d9] hover:bg-[#03a9bc] text-white'
                    ]"
                  >
                    <Check v-if="addedPartId === part.id" class="w-3 h-3" />
                    <Plus v-else class="w-3 h-3" />
                    <span>{{ addedPartId === part.id ? 'Agregado' : 'A Orden' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Estado vacío -->
          <div v-else class="text-center py-10 px-4 text-slate-400">
            <Package class="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p class="text-xs font-semibold">No se encontraron componentes en este grupo para el motor seleccionado.</p>
            <p class="text-[11px] mt-1">Prueba seleccionando el grupo "Todos" o ajustando el término de filtro.</p>
          </div>
        </div>
      </section>

      <!-- ======================================================================= -->
      <!-- TAB 2: BÚSQUEDA POR MEDIDAS (ADAPTACIONES DE TALLER SIN CÓDIGO)           -->
      <!-- ======================================================================= -->
      <section v-if="activeTab === 'medidas'" class="space-y-6">
        
        <!-- Tarjeta de Control y Selección de Componente Dimensional -->
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <Ruler class="w-4 h-4 text-[#04c4d9]" />
                <h2 class="text-sm font-bold text-slate-900">
                  Motor de Adaptaciones Dimensionales (Piezas desgastadas / Sin código)
                </h2>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Ingresa las cotas físicas exactas en milímetros (mm). El motor localizará coincidencias directas y adaptables.
              </p>
            </div>

            <!-- Tolerancia escalonada -->
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-slate-400">Tolerancia:</span>
              <select
                v-model="toleranciaMm"
                @change="executeDimensionalSearch"
                class="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
              >
                <option :value="0.10">Estricta (±0.10 mm)</option>
                <option :value="0.25">Estándar (±0.25 mm)</option>
                <option :value="0.50">Amplia (±0.50 mm)</option>
              </select>
            </div>
          </div>

          <!-- Selector de Categoría de Componente Dimensional (Mínimo 44px) -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              v-for="cat in (['Sellos', 'Válvulas', 'Anillos', 'Pernos', 'Casquetería'] as ComponentCategory[])"
              :key="cat"
              type="button"
              @click="selectedComponent = cat; executeDimensionalSearch()"
              :class="[
                'p-3 rounded-xl border text-center font-bold text-xs sm:text-sm transition min-h-[46px] flex items-center justify-center gap-2',
                selectedComponent === cat
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              ]"
            >
              <span>{{ cat === 'Sellos' ? 'Sellos de Válvula' : cat === 'Pernos' ? 'Pernos de Culata' : cat }}</span>
              <span v-if="selectedComponent === cat" class="w-1.5 h-1.5 rounded-full bg-[#04c4d9]"></span>
            </button>
          </div>

          <!-- Botones de Muestras Rápidas de Taller -->
          <div class="flex items-center gap-2 flex-wrap pt-1 text-xs">
            <span class="text-[11px] font-semibold text-slate-400">Muestras de prueba rápida:</span>
            
            <button
              type="button"
              @click="loadSampleSello"
              class="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-[#04c4d9] border border-cyan-200 font-bold transition text-[11px] flex items-center gap-1"
            >
              <Sparkles class="w-3 h-3" />
              <span>Probar muestra: Sello 4.8 x 10.8 x 10 mm</span>
            </button>

            <button
              type="button"
              @click="loadSampleValvula"
              class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition text-[11px]"
            >
              Válvula 42.5 x 8 x 103.5 mm
            </button>

            <button
              type="button"
              @click="loadSampleAnillos"
              class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition text-[11px]"
            >
              Anillos 96mm (2/2/4 mm)
            </button>

            <button
              type="button"
              @click="loadSamplePernos"
              class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition text-[11px]"
            >
              Pernos M12x1.25 L=120 (18 pcs)
            </button>

            <button
              type="button"
              @click="resetDimensionalForm"
              class="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-600 transition text-[11px] ml-auto flex items-center gap-1"
              title="Limpiar formulario"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Limpiar</span>
            </button>
          </div>

          <!-- FORMULARIO REACTIVO SEGÚN COMPONENTE -->
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            
            <!-- 1. Formulario: Sellos de Válvula / Ajuste -->
            <div v-if="selectedComponent === 'Sellos'" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Diámetro Interior (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimSellos.diametro_interior"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 4.8"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Ajuste de vástago (4.8, 5.5, 8.0...)</span>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Diámetro Exterior (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimSellos.diametro_exterior"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 10.8"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Alojamiento de guía (10.8, 11.2, 12.0...)</span>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Altura / Longitud (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimSellos.altura"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 10.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Altura total del sello (10.0, 10.2...)</span>
              </div>
            </div>

            <!-- 2. Formulario: Válvulas de Motor -->
            <div v-if="selectedComponent === 'Válvulas'" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Diámetro de Hongo / Cabeza (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimValvulas.diametro_cabeza"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 42.5"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Cabeza admisión o escape</span>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Diámetro de Vástago (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimValvulas.diametro_vastago"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 8.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Grosor de caña (6.0, 7.0, 8.0...)</span>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Altura Total / Longitud (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimValvulas.longitud_total"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 103.5"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Largo total punta a hongo</span>
              </div>
            </div>

            <!-- 3. Formulario: Anillos de Pistón -->
            <div v-if="selectedComponent === 'Anillos'" class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Diámetro Cilindro / Anillo (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimAnillos.diametro_cilindro"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 96.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">STD (89, 91.1, 96, 99.5...)</span>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Grosor 1er Anillo (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimAnillos.espesor_anillo1"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 2.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Ranura superior de compresión</span>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Grosor 2do Anillo (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimAnillos.espesor_anillo2"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 2.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Ranura rascador compresión</span>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Grosor Anillo Aceite (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimAnillos.espesor_aceite"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 4.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-1 block">Ranura de lubricación / aceite</span>
              </div>
            </div>

            <!-- 4. Formulario: Juego de Tornillos / Pernos de Culata -->
            <div v-if="selectedComponent === 'Pernos'" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Medida de Rosca
                  </label>
                  <select
                    v-model="dimPernos.medida_rosca"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  >
                    <option value="">Todas las roscas</option>
                    <option value="M10">M10 (Nissan Z24, etc.)</option>
                    <option value="M11">M11 (Nissan YD25, etc.)</option>
                    <option value="M12">M12 (Toyota 3L, 1KD, etc.)</option>
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Paso de Rosca (mm)
                  </label>
                  <div class="relative">
                    <input
                      v-model="dimPernos.paso_rosca"
                      type="number"
                      step="0.05"
                      placeholder="Ej. 1.25"
                      @keyup.enter="executeDimensionalSearch"
                      class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                    />
                    <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Longitud (mm)
                  </label>
                  <div class="relative">
                    <input
                      v-model="dimPernos.longitud_perno"
                      type="number"
                      step="1"
                      placeholder="Ej. 120"
                      @keyup.enter="executeDimensionalSearch"
                      class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                    />
                    <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Cantidad de Piezas
                  </label>
                  <input
                    v-model="dimPernos.cantidad_piezas"
                    type="number"
                    placeholder="Ej. 18"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                </div>
              </div>

              <!-- Tolerancias escalonadas para pernos -->
              <div class="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span class="font-bold text-slate-600 block">Paso de rosca 1:</span>
                  <input
                    v-model="dimPernos.paso_rosca1"
                    type="number"
                    step="0.05"
                    placeholder="Ej. 1.25"
                    class="w-full mt-1 px-2 py-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <span class="font-bold text-slate-600 block">Longitud 1 (mm):</span>
                  <input
                    v-model="dimPernos.longitud1"
                    type="number"
                    placeholder="Ej. 115"
                    class="w-full mt-1 px-2 py-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <span class="font-bold text-slate-600 block">Longitud 2 (mm):</span>
                  <input
                    v-model="dimPernos.longitud2"
                    type="number"
                    placeholder="Ej. 120"
                    class="w-full mt-1 px-2 py-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded"
                  />
                </div>
              </div>
            </div>

            <!-- 5. Formulario: Casquetes / Cojinetes NDC -->
            <div v-if="selectedComponent === 'Casquetería'" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Tipo de Cojinete NDC
                </label>
                <select
                  v-model="dimCasqueteria.tipo_cojinete"
                  class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                >
                  <option value="MS">MS - Casquete Bancada (Main Bearing)</option>
                  <option value="CB">CB - Casquete Biela (Con-rod Bearing)</option>
                  <option value="TW">TW - Arandela Axial (Thrust Washer)</option>
                  <option value="SH">SH - Casquete Leva (Camshaft Bearing)</option>
                  <option value="PB">PB - Bocina / Buje (Pin Bushing)</option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Diámetro de Muñón (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimCasqueteria.diametro_munon"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 62.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Ancho de Casquete (mm)
                </label>
                <div class="relative">
                  <input
                    v-model="dimCasqueteria.ancho_casquete"
                    type="number"
                    step="0.01"
                    placeholder="Ej. 23.0"
                    @keyup.enter="executeDimensionalSearch"
                    class="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#04c4d9]"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">mm</span>
                </div>
              </div>
            </div>

            <!-- Botón Buscar Medidas -->
            <div class="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-end">
              <button
                type="button"
                @click="executeDimensionalSearch"
                class="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-sm min-h-[44px]"
              >
                <Search class="w-4 h-4 text-[#04c4d9]" />
                <span>Buscar Piezas Compatibles y Adaptaciones</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Resultados de la Búsqueda Dimensional -->
        <div v-if="hasSearchedDimensions" class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Resultados de Adaptación encontrados ({{ dimensionalResults.length }})
            </h3>
            <span class="text-xs text-slate-500">
              Tolerancia activa: ±{{ toleranciaMm }} mm
            </span>
          </div>

          <div v-if="dimensionalResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="part in dimensionalResults"
              :key="part.id"
              class="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#04c4d9] hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <!-- Encabezado Tarjeta -->
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase block">Código OEM</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="font-mono font-black text-sm text-slate-900">{{ part.codigo_oem }}</span>
                      <button
                        type="button"
                        @click="copyToClipboard(part.codigo_oem, 'OEM')"
                        class="p-1 text-slate-400 hover:text-slate-800 transition"
                      >
                        <Copy v-if="copiedCode !== part.codigo_oem" class="w-3.5 h-3.5" />
                        <Check v-else class="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    </div>
                  </div>

                  <span 
                    :class="[
                      'text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase',
                      getBrandBadgeClass(part.catalogo_origen || part.equivalencias?.[0]?.marca_alterna)
                    ]"
                  >
                    {{ part.catalogo_origen || part.equivalencias?.[0]?.marca_alterna || 'Catálogo' }}
                  </span>
                </div>

                <!-- Nombre y Motor compatible -->
                <div class="mt-2.5">
                  <h4 class="font-bold text-slate-900 text-xs sm:text-sm">
                    {{ part.nombre }}
                  </h4>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-50 text-[#04c4d9] border border-cyan-200">
                      Motor: {{ part.motor?.codigo || 'Adaptable Universal' }}
                    </span>
                    <span v-if="part.motor?.fabricante?.nombre" class="text-[10px] text-slate-400">
                      {{ part.motor.fabricante.nombre }}
                    </span>
                  </div>
                </div>

                <!-- Desglose Dimensional Exhaustivo -->
                <div class="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                  <!-- Sellos -->
                  <div v-if="part.categoria === 'Sellos'" class="space-y-0.5">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">Cotas del Sello:</div>
                    <div class="font-mono text-slate-800 grid grid-cols-3 gap-1 text-center bg-white p-1.5 rounded border border-slate-200/60">
                      <div><span class="text-[10px] text-slate-400 block">D. Int</span><strong>{{ part.diametro_interior_mm }}mm</strong></div>
                      <div><span class="text-[10px] text-slate-400 block">D. Ext</span><strong>{{ part.diametro_exterior_mm }}mm</strong></div>
                      <div><span class="text-[10px] text-slate-400 block">Altura</span><strong>{{ part.altura_mm }}mm</strong></div>
                    </div>
                  </div>

                  <!-- Anillos con Desglose de cada Ranura -->
                  <div v-if="part.categoria === 'Anillos'" class="space-y-0.5">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">Desglose de Ranuras (Pistón):</div>
                    <div class="font-mono text-slate-800 grid grid-cols-3 gap-1 text-center bg-white p-1.5 rounded border border-slate-200/60">
                      <div><span class="text-[10px] text-slate-400 block">1er Anillo</span><strong>{{ part.espesor_anillo1_mm }}mm</strong></div>
                      <div><span class="text-[10px] text-slate-400 block">2do Anillo</span><strong>{{ part.espesor_anillo2_mm }}mm</strong></div>
                      <div><span class="text-[10px] text-slate-400 block">Aceite</span><strong>{{ part.espesor_aceite_mm }}mm</strong></div>
                    </div>
                    <div class="text-[11px] font-mono text-slate-600 mt-1">
                      Diámetro de cilindro STD: <strong>{{ part.diametro_cilindro_mm }} mm</strong>
                    </div>
                  </div>

                  <!-- Válvulas -->
                  <div v-if="part.categoria === 'Válvulas'" class="space-y-0.5">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">Especificaciones Válvula:</div>
                    <div class="font-mono text-slate-800 grid grid-cols-3 gap-1 text-center bg-white p-1.5 rounded border border-slate-200/60">
                      <div><span class="text-[10px] text-slate-400 block">Hongo</span><strong>{{ part.diametro_cabeza_mm }}mm</strong></div>
                      <div><span class="text-[10px] text-slate-400 block">Vástago</span><strong>{{ part.diametro_vastago_mm }}mm</strong></div>
                      <div><span class="text-[10px] text-slate-400 block">Largo</span><strong>{{ part.longitud_total_mm }}mm</strong></div>
                    </div>
                  </div>

                  <!-- Pernos -->
                  <div v-if="part.categoria === 'Pernos'" class="space-y-0.5">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">Cotas de Rosca & Pernos:</div>
                    <div class="font-mono text-slate-800 bg-white p-1.5 rounded border border-slate-200/60">
                      Rosca: <strong>{{ part.medida_rosca }} x {{ part.paso_rosca_mm }}</strong> • L: <strong>{{ part.longitud_perno_mm }}mm</strong> • Piezas: <strong>{{ part.cantidad_piezas }}</strong>
                    </div>
                  </div>

                  <!-- Casquetería -->
                  <div v-if="part.categoria === 'Casquetería'" class="space-y-0.5">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">Cojinete NDC ({{ part.tipo_cojinete }}):</div>
                    <div class="font-mono text-slate-800 bg-white p-1.5 rounded border border-slate-200/60">
                      Muñón: <strong>{{ part.diametro_munon_mm }}mm</strong> • Alojamiento: <strong>{{ part.diametro_alojamiento_mm }}mm</strong> • Ancho: <strong>{{ part.ancho_casquete_mm }}mm</strong>
                    </div>
                  </div>
                </div>

                <!-- Equivalencias alternas -->
                <div v-if="part.equivalencias && part.equivalencias.length > 0" class="mt-2.5 flex flex-wrap gap-1">
                  <span
                    v-for="eq in part.equivalencias"
                    :key="eq.id"
                    @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                    :class="[
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer hover:shadow-2xs',
                      getBrandBadgeClass(eq.marca_alterna)
                    ]"
                  >
                    <span>{{ eq.marca_alterna }}: {{ eq.codigo_alterno }}</span>
                    <Copy class="w-2.5 h-2.5 opacity-60" />
                  </span>
                </div>
              </div>

              <!-- Footer Tarjeta -->
              <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span class="text-xs font-black text-slate-900">${{ part.precio.toFixed(2) }}</span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    @click="copyToClipboard(part.codigo_oem, 'OEM')"
                    class="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-bold"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    @click="addToWorkOrder(part)"
                    class="px-2.5 py-1.5 rounded-lg bg-[#04c4d9] hover:bg-[#03a9bc] text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <Plus class="w-3 h-3" />
                    <span>A Orden</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-10 px-4 bg-white rounded-2xl border border-slate-200 text-slate-400">
            <Ruler class="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p class="text-xs font-bold text-slate-600">No se encontraron piezas que coincidan con estas dimensiones exactas.</p>
            <p class="text-[11px] mt-1 text-slate-400">Prueba aumentando la tolerancia a ±0.50 mm o verificando las cotas medidas con el vernier/calibrador.</p>
          </div>
        </div>
      </section>

      <!-- ======================================================================= -->
      <!-- TAB 3: BÚSQUEDA INVERSA POR CÓDIGO OEM / REFERENCIA (CRUCE MULTIMARCA)     -->
      <!-- ======================================================================= -->
      <section v-if="activeTab === 'codigo'" class="space-y-6">
        
        <!-- Barra de Búsqueda Principal por Código -->
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div>
            <div class="flex items-center gap-2">
              <Hash class="w-4 h-4 text-[#04c4d9]" />
              <h2 class="text-sm font-bold text-slate-900">
                Búsqueda Inversa y Cruce Multimarca de Repuestos
              </h2>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              Ingresa cualquier número de parte: Código OEM, Dokuro, Rik, NPR, NDC, Ajusa o Pioneer.
            </p>
          </div>

          <!-- Input con Botón de Búsqueda -->
          <div class="flex flex-col sm:flex-row items-center gap-2">
            <div class="relative flex-1 w-full">
              <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                v-model="codeSearchQuery"
                type="text"
                placeholder="Ejemplo: 90913-02090, SV-108, 28006, MS-1140A, 81014300..."
                @keyup.enter="executeCodeSearch()"
                class="w-full pl-10 pr-10 py-3 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9]"
              />
              <button
                v-if="codeSearchQuery"
                type="button"
                @click="codeSearchQuery = ''; codeSearchResults = []; hasSearchedCode = false"
                class="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              @click="executeCodeSearch()"
              class="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-sm min-h-[46px]"
            >
              <Search class="w-4 h-4 text-[#04c4d9]" />
              <span>Consultar Cruce</span>
            </button>
          </div>

          <!-- Chips de Búsqueda Rápida para Taller -->
          <div class="flex items-center gap-1.5 flex-wrap pt-1">
            <span class="text-[11px] font-semibold text-slate-400 mr-1">Sugerencias rápidas:</span>
            <button
              v-for="chip in quickCodeChips"
              :key="chip.code"
              type="button"
              @click="executeCodeSearch(chip.code)"
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1"
            >
              <span>{{ chip.label }}:</span>
              <strong class="text-slate-900">{{ chip.code }}</strong>
            </button>
          </div>
        </div>

        <!-- Resultados del Cruce de Códigos -->
        <div v-if="hasSearchedCode" class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Coincidencias Cruzadas para "{{ codeSearchQuery }}" ({{ codeSearchResults.length }})
            </h3>
          </div>

          <div v-if="codeSearchResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="part in codeSearchResults"
              :key="part.id"
              class="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#04c4d9] hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <!-- Header con OEM -->
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Código OEM Principal</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="font-mono font-black text-sm text-slate-900">{{ part.codigo_oem }}</span>
                      <button
                        type="button"
                        @click="copyToClipboard(part.codigo_oem, 'OEM')"
                        class="p-1 text-slate-400 hover:text-slate-800"
                      >
                        <Copy v-if="copiedCode !== part.codigo_oem" class="w-3.5 h-3.5" />
                        <Check v-else class="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    </div>
                  </div>

                  <span 
                    :class="[
                      'text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase',
                      getBrandBadgeClass(part.catalogo_origen || part.equivalencias?.[0]?.marca_alterna)
                    ]"
                  >
                    {{ part.catalogo_origen || part.equivalencias?.[0]?.marca_alterna || 'Catálogo' }}
                  </span>
                </div>

                <!-- Título y Motor -->
                <div class="mt-2.5">
                  <h4 class="font-bold text-slate-900 text-xs sm:text-sm">
                    {{ part.nombre }}
                  </h4>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-50 text-[#04c4d9] border border-cyan-200">
                      Motor: {{ part.motor?.codigo || 'Multi-aplicación' }}
                    </span>
                    <span v-if="part.motor?.fabricante?.nombre" class="text-[10px] text-slate-500 font-medium">
                      {{ part.motor.fabricante.nombre }}
                    </span>
                  </div>
                </div>

                <!-- Matriz de Equivalencias con Badges Destacados -->
                <div class="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                  <span class="text-[10px] font-bold text-slate-400 uppercase block">Cruce en Catálogos Alternos:</span>
                  <div class="space-y-1.5">
                    <div
                      v-for="eq in part.equivalencias"
                      :key="eq.id"
                      class="flex items-center justify-between text-xs font-mono p-1.5 bg-white rounded border border-slate-200/80"
                    >
                      <span 
                        :class="[
                          'px-2 py-0.5 rounded text-[10px] font-bold border uppercase',
                          getBrandBadgeClass(eq.marca_alterna)
                        ]"
                      >
                        {{ eq.marca_alterna }}
                      </span>
                      <div class="flex items-center gap-1.5">
                        <strong class="text-slate-900">{{ eq.codigo_alterno }}</strong>
                        <button
                          type="button"
                          @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                          class="text-slate-400 hover:text-slate-700"
                        >
                          <Copy class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Medidas Técnicas Rápidas -->
                <div class="mt-2.5 text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  <div v-if="part.diametro_interior_mm">
                    D.Int: <strong>{{ part.diametro_interior_mm }}mm</strong> • D.Ext: <strong>{{ part.diametro_exterior_mm }}mm</strong> • Alt: <strong>{{ part.altura_mm }}mm</strong>
                  </div>
                  <div v-else-if="part.diametro_cilindro_mm">
                    Ø <strong>{{ part.diametro_cilindro_mm }}mm</strong> (1°: {{ part.espesor_anillo1_mm }}mm / 2°: {{ part.espesor_anillo2_mm }}mm / Aceite: {{ part.espesor_aceite_mm }}mm)
                  </div>
                  <div v-else-if="part.diametro_cabeza_mm">
                    Hongo: <strong>{{ part.diametro_cabeza_mm }}mm</strong> • Vástago: <strong>{{ part.diametro_vastago_mm }}mm</strong> • L: <strong>{{ part.longitud_total_mm }}mm</strong>
                  </div>
                  <div v-else-if="part.medida_rosca">
                    {{ part.medida_rosca }} x {{ part.paso_rosca_mm }} L={{ part.longitud_perno_mm }}mm ({{ part.cantidad_piezas }} pcs)
                  </div>
                  <div v-else-if="part.tipo_cojinete">
                    NDC {{ part.tipo_cojinete }}: Muñón {{ part.diametro_munon_mm }}mm • Ancho {{ part.ancho_casquete_mm }}mm
                  </div>
                  <div v-else class="text-slate-400">
                    Repuesto estándar de rectificación
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span class="text-xs font-black text-slate-900">${{ part.precio.toFixed(2) }}</span>
                <button
                  type="button"
                  @click="addToWorkOrder(part)"
                  class="px-3 py-1.5 rounded-lg bg-[#04c4d9] hover:bg-[#03a9bc] text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs"
                >
                  <Plus class="w-3 h-3" />
                  <span>Agregar a Orden</span>
                </button>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-10 px-4 bg-white rounded-2xl border border-slate-200 text-slate-400">
            <Search class="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p class="text-xs font-bold text-slate-600">No se encontraron piezas registradas con el código "{{ codeSearchQuery }}".</p>
            <p class="text-[11px] mt-1 text-slate-400">Verifica la numeración o intenta buscando en la pestaña "Búsqueda por Medidas".</p>
          </div>
        </div>
      </section>

    </main>
  </div>
</template>
