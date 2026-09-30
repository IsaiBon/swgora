<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  catalogService, 
  type Fabricante, 
  type Modelo, 
  type Motor, 
  type RepuestoTecnico 
} from '@/services/catalogService'
import BrandSelector from '@/components/catalog/BrandSelector.vue'
import EngineSpecsCard from '@/components/catalog/EngineSpecsCard.vue'
import EquivalenceMatrix from '@/components/catalog/EquivalenceMatrix.vue'
import DimensionalSearch from '@/components/catalog/DimensionalSearch.vue'
import ReverseLookup from '@/components/catalog/ReverseLookup.vue'
import { 
  BookOpen, 
  Car, 
  Ruler, 
  Hash, 
  Search, 
  CheckCircle2, 
  FileText,
  Layers
} from 'lucide-vue-next'

const router = useRouter()

// Modo activo: 'vehicular' | 'dimensional' | 'inversa'
type CatalogMode = 'vehicular' | 'dimensional' | 'inversa'
const activeMode = ref<CatalogMode>('vehicular')

// Datos maestros
const fabricantes = ref<Fabricante[]>([])
const modelos = ref<Modelo[]>([])
const motores = ref<Motor[]>([])
const repuestos = ref<RepuestoTecnico[]>([])

// Selección activa en Búsqueda Vehicular
const selectedFabricanteId = ref<string>('')
const selectedModeloId = ref<string>('')
const selectedMotorId = ref<string>('')

// Motor activo
const activeMotor = ref<Motor | null>(null)
const activeFabricante = computed(() => fabricantes.value.find(f => f.id === selectedFabricanteId.value) || null)
const activeModelo = computed(() => modelos.value.find(m => m.id === selectedModeloId.value) || null)

// Búsqueda rápida superior
const globalSearch = ref('')

// Mensaje de notificación Toast
const toastMessage = ref<string | null>(null)
let toastTimer: any = null

const showToast = (msg: string) => {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 2500)
}

// Carga inicial
const loadData = async () => {
  fabricantes.value = await catalogService.getFabricantes()
  modelos.value = await catalogService.getModelos()
  motores.value = await catalogService.getMotores()

  // Seleccionar Toyota 3L por defecto para ofrecer una experiencia inmediata rica
  const defaultFab = fabricantes.value.find(f => f.nombre === 'Toyota') || fabricantes.value[0]
  if (defaultFab) {
    selectedFabricanteId.value = defaultFab.id
    const defaultModel = modelos.value.find(m => m.fabricante_id === defaultFab.id)
    if (defaultModel) {
      selectedModeloId.value = defaultModel.id
      const defaultMotor = motores.value.find(m => m.codigo === '3L') || motores.value.find(m => m.fabricante_id === defaultFab.id)
      if (defaultMotor) {
        selectedMotorId.value = defaultMotor.id
        activeMotor.value = defaultMotor
        await loadRepuestos(defaultMotor.id)
      }
    }
  }
}

const loadRepuestos = async (motorId: string) => {
  repuestos.value = await catalogService.getRepuestosByMotor(motorId)
}

const handleSelectMotor = async (motor: Motor) => {
  activeMotor.value = motor
  selectedMotorId.value = motor.id
  await loadRepuestos(motor.id)
}

// Selección rápida de motores populares desde el header
const quickSelectEngine = async (codigo: string) => {
  const target = motores.value.find(m => m.codigo.toLowerCase().includes(codigo.toLowerCase()))
  if (target) {
    activeMode.value = 'vehicular'
    selectedFabricanteId.value = target.fabricante_id
    if (target.modelo_id) selectedModeloId.value = target.modelo_id
    selectedMotorId.value = target.id
    activeMotor.value = target
    await loadRepuestos(target.id)
    showToast(`Cargado catálogo de motor ${target.codigo}`)
  }
}

// Agregar pieza a una orden de trabajo
const handleAddToOrder = (repuesto: RepuestoTecnico) => {
  showToast(`Pieza agregada a cotización/orden: ${repuesto.codigo_oem} (${repuesto.nombre})`)
}

// Búsqueda global (cambia a búsqueda inversa automáticamente si se ingresa texto)
const handleGlobalSearch = () => {
  if (globalSearch.value.trim()) {
    activeMode.value = 'inversa'
  }
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <div class="space-y-6 pb-12">
    
    <!-- Toast de Notificaciones Flotante -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-4 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-4 opacity-0"
    >
      <div 
        v-if="toastMessage" 
        class="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold"
      >
        <CheckCircle2 class="w-4 h-4 text-[#04c4d9]" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Header Principal del Catálogo Técnico -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen class="w-6 h-6 text-[#04c4d9]" />
            Catálogo Técnico y Matriz de Equivalencias
          </h1>
          <span class="text-xs font-black px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
            JR Blanco
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          Búsqueda vehicular jerárquica, cruces multimarca (Dokuro, Rik, NPR, NDC, Ajusa, Pioneer) y adaptaciones dimensionales.
        </p>
      </div>

      <!-- Acciones de Navegación Rápida -->
      <div class="flex items-center gap-2.5">
        <button
          type="button"
          @click="router.push('/ordenes')"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition"
        >
          <FileText class="w-3.5 h-3.5 text-cyan-600" />
          <span>Ir a Órdenes de Trabajo</span>
        </button>
      </div>
    </div>

    <!-- Barra de Selección de Modos y Búsqueda Superior -->
    <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
      
      <!-- Pestañas de Modo (Táctiles, Min 44px) -->
      <div class="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
        <button
          type="button"
          @click="activeMode = 'vehicular'"
          :class="[
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition min-h-[44px]',
            activeMode === 'vehicular'
              ? 'bg-[#04c4d9] text-white shadow-xs'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
          ]"
        >
          <Car class="w-4 h-4" />
          <span>Búsqueda Vehicular</span>
        </button>

        <button
          type="button"
          @click="activeMode = 'dimensional'"
          :class="[
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition min-h-[44px]',
            activeMode === 'dimensional'
              ? 'bg-[#04c4d9] text-white shadow-xs'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
          ]"
        >
          <Ruler class="w-4 h-4" />
          <span>Búsqueda Dimensional (mm)</span>
        </button>

        <button
          type="button"
          @click="activeMode = 'inversa'"
          :class="[
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition min-h-[44px]',
            activeMode === 'inversa'
              ? 'bg-[#04c4d9] text-white shadow-xs'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
          ]"
        >
          <Hash class="w-4 h-4" />
          <span>Búsqueda Inversa por Código</span>
        </button>
      </div>

      <!-- Buscador Rápido Global -->
      <div class="relative w-full lg:w-80">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search class="w-4 h-4" />
        </div>
        <input
          v-model="globalSearch"
          type="text"
          @keyup.enter="handleGlobalSearch"
          placeholder="Código de parte, Dokuro, Rik, NDC..."
          class="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] font-medium"
        />
      </div>

    </div>

    <!-- Acceso Directo a Motores Más Frecuentes en el Taller -->
    <div class="flex items-center gap-2 overflow-x-auto text-xs pb-1">
      <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px] shrink-0">Motores habituales:</span>
      <button 
        type="button"
        @click="quickSelectEngine('3L')"
        class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-bold text-slate-700 transition shrink-0"
      >
        Toyota 3L (2.8D)
      </button>
      <button 
        type="button"
        @click="quickSelectEngine('1KD')"
        class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-bold text-slate-700 transition shrink-0"
      >
        Toyota 1KD-FTV (3.0 D-4D)
      </button>
      <button 
        type="button"
        @click="quickSelectEngine('Z24')"
        class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-bold text-slate-700 transition shrink-0"
      >
        Nissan Z24 (2.4L)
      </button>
      <button 
        type="button"
        @click="quickSelectEngine('4D56')"
        class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-bold text-slate-700 transition shrink-0"
      >
        Mitsubishi 4D56 (2.5D)
      </button>
      <button 
        type="button"
        @click="quickSelectEngine('4JB1')"
        class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-cyan-400 hover:text-cyan-700 font-bold text-slate-700 transition shrink-0"
      >
        Isuzu 4JB1 (2.8D)
      </button>
    </div>

    <!-- MODO 1: BÚSQUEDA VEHICULAR JERÁRQUICA -->
    <div v-if="activeMode === 'vehicular'" class="space-y-5">
      <!-- Selector de Fabricante, Modelo y Motor -->
      <BrandSelector
        :fabricantes="fabricantes"
        :modelos="modelos"
        :motores="motores"
        v-model:selectedFabricanteId="selectedFabricanteId"
        v-model:selectedModeloId="selectedModeloId"
        v-model:selectedMotorId="selectedMotorId"
        @select-motor="handleSelectMotor"
      />

      <!-- Ficha Técnica del Motor Seleccionado -->
      <EngineSpecsCard
        :motor="activeMotor"
        :fabricante="activeFabricante"
        :modelo="activeModelo"
      />

      <!-- Matriz de Equivalencias Multimarca -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Layers class="w-3.5 h-3.5 text-[#04c4d9]" />
            Matriz de Equivalencias Técnicas del Motor
          </h3>
          <span class="text-xs text-slate-400">
            {{ repuestos.length }} componentes registrados para este motor
          </span>
        </div>

        <EquivalenceMatrix
          :repuestos="repuestos"
          @add-to-order="handleAddToOrder"
          @toast="showToast"
        />
      </div>
    </div>

    <!-- MODO 2: BÚSQUEDA DIMENSIONAL / ADAPTADORES -->
    <div v-else-if="activeMode === 'dimensional'">
      <DimensionalSearch
        @add-to-order="handleAddToOrder"
        @toast="showToast"
      />
    </div>

    <!-- MODO 3: BÚSQUEDA INVERSA POR CÓDIGO -->
    <div v-else-if="activeMode === 'inversa'">
      <ReverseLookup
        :initial-query="globalSearch"
        @add-to-order="handleAddToOrder"
        @toast="showToast"
      />
    </div>

  </div>
</template>
