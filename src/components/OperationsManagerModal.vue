<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  ordersService, 
  type FormOperationItem, 
  type RectificationBlock 
} from '@/services/ordersService'
import { 
  Wrench, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  SlidersHorizontal,
  Layers
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated'): void
}>()

// Lista reactiva de operaciones cargadas desde el almacenamiento
const catalog = ref<FormOperationItem[]>([])
const searchQuery = ref('')
const selectedCategory = ref<string>('Todos')

// Estado del mini formulario
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const formState = ref<{
  category: RectificationBlock
  operation: string
  measureType: 'none' | 'single' | 'dual'
}>({
  category: 'Culata',
  operation: '',
  measureType: 'none'
})

// Notificaciones
const notification = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// Confirmaciones
const confirmDeleteId = ref<string | null>(null)
const confirmReset = ref(false)

const CATEGORIES: RectificationBlock[] = [
  'Bielas',
  'Bancadas',
  'Cigüeñal',
  'Culata',
  'Block',
  'Repuestos'
]

const loadCatalog = () => {
  catalog.value = ordersService.getOperationsCatalog()
}

onMounted(() => {
  loadCatalog()
})

const getCategoryCount = (cat: string) => {
  if (cat === 'Todos') return catalog.value.length
  return catalog.value.filter(o => o.category === cat).length
}

const filteredCatalog = computed(() => {
  return catalog.value.filter(item => {
    const matchesCat = selectedCategory.value === 'Todos' || item.category === selectedCategory.value
    const matchesQuery = !searchQuery.value.trim() || 
      item.operation.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesCat && matchesQuery
  })
})

const showNotification = (type: 'success' | 'error', message: string) => {
  notification.value = { type, message }
  setTimeout(() => {
    if (notification.value?.message === message) {
      notification.value = null
    }
  }, 4000)
}

// Iniciar edición de una operación
const startEditing = (item: FormOperationItem) => {
  isEditing.value = true
  editingId.value = item.id
  
  let measureType: 'none' | 'single' | 'dual' = 'none'
  if (item.measureBanco !== undefined || item.measureBiela !== undefined) {
    measureType = 'dual'
  } else if (item.measure !== undefined) {
    measureType = 'single'
  }

  formState.value = {
    category: item.category,
    operation: item.operation,
    measureType
  }

  // Desplazar hacia arriba para ver el formulario si es necesario
  const formElement = document.getElementById('operations-mini-form')
  if (formElement) {
    formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

// Cancelar edición
const cancelEditing = () => {
  isEditing.value = false
  editingId.value = null
  formState.value = {
    category: 'Culata',
    operation: '',
    measureType: 'none'
  }
}

// Guardar nueva operación o actualizar existente
const handleSaveOperation = async () => {
  const name = formState.value.operation.trim()
  if (!name) {
    showNotification('error', 'El nombre de la operación o servicio es obligatorio.')
    return
  }

  let measureField: string | undefined = undefined
  let measureBancoField: string | undefined = undefined
  let measureBielaField: string | undefined = undefined

  if (formState.value.measureType === 'single') {
    measureField = ''
  } else if (formState.value.measureType === 'dual') {
    measureBancoField = ''
    measureBielaField = ''
  }

  if (isEditing.value && editingId.value) {
    // Actualizar operación existente
    const updated = await ordersService.updateOperationInCatalog(editingId.value, {
      category: formState.value.category,
      operation: name,
      measure: measureField,
      measureBanco: measureBancoField,
      measureBiela: measureBielaField
    })
    if (updated) {
      showNotification('success', `Operación "${name}" actualizada correctamente.`)
    }
    cancelEditing()
  } else {
    // Agregar nueva operación
    await ordersService.addOperationToCatalog({
      category: formState.value.category,
      operation: name,
      measure: measureField,
      measureBanco: measureBancoField,
      measureBiela: measureBielaField
    })
    showNotification('success', `Operación "${name}" agregada exitosamente al catálogo.`)
    formState.value.operation = ''
  }

  loadCatalog()
  emit('updated')
}

// Eliminar operación
const handleDelete = async (id: string, name: string) => {
  const ok = await ordersService.deleteOperationFromCatalog(id)
  if (ok) {
    showNotification('success', `Operación "${name}" eliminada del catálogo.`)
    if (editingId.value === id) {
      cancelEditing()
    }
    loadCatalog()
    emit('updated')
  }
  confirmDeleteId.value = null
}

// Restablecer catálogo inicial
const handleReset = async () => {
  await ordersService.resetOperationsCatalog()
  cancelEditing()
  loadCatalog()
  confirmReset.value = false
  showNotification('success', 'Catálogo restablecido exitosamente a los 55 servicios estándar de fábrica.')
  emit('updated')
}

const getCategoryBadgeClass = (cat: RectificationBlock) => {
  switch (cat) {
    case 'Bielas':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'Bancadas':
      return 'bg-amber-50 text-amber-800 border-amber-200'
    case 'Cigüeñal':
      return 'bg-cyan-50 text-[#038896] border-cyan-200'
    case 'Culata':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'Block':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'Repuestos':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-[#09132B]/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
    <div class="studio-card bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden popover-pop-in">
      
      <!-- Cabecera del Modal -->
      <div class="px-5 py-4 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white flex items-center justify-between gap-4 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-[#BFEBF2] shrink-0">
            <SlidersHorizontal class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-bold font-display text-white tracking-tight">
                Catálogo de Operaciones y Servicios
              </h2>
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-[#BFEBF2] border border-white/25">
                {{ catalog.length }} Total
              </span>
            </div>
            <p class="text-xs text-sky-100/80 mt-0.5">
              Configura los servicios y operaciones de rectificación disponibles para las órdenes de trabajo.
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="p-2 rounded-xl text-white/75 hover:text-white hover:bg-white/15 transition cursor-pointer"
          title="Cerrar ventana"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Notificación flotante de feedback -->
      <div 
        v-if="notification" 
        :class="[
          'px-5 py-2.5 text-xs font-semibold flex items-center justify-between transition border-b',
          notification.type === 'success' 
            ? 'bg-cyan-50 text-[#0D1B3E] border-cyan-300' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        ]"
      >
        <div class="flex items-center gap-2">
          <CheckCircle2 v-if="notification.type === 'success'" class="w-4 h-4 text-[#038391] shrink-0" />
          <AlertCircle v-else class="w-4 h-4 text-rose-600 shrink-0" />
          <span>{{ notification.message }}</span>
        </div>
        <button 
          type="button" 
          @click="notification = null" 
          class="text-xs opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>

      <!-- Contenido Principal Desplazable -->
      <div class="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
        
        <!-- 1. Mini Formulario (Agregar / Editar Operación) -->
        <div 
          id="operations-mini-form"
          :class="[
            'p-4 rounded-2xl border transition shadow-xs',
            isEditing 
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-100' 
              : 'bg-sky-50/45 border-[#04C4D9]/25'
          ]"
        >
          <div class="flex items-center justify-between mb-3 pb-2 border-b" :class="isEditing ? 'border-[#E6DAC2]' : 'border-[#CFE1F4]'">
            <div class="flex items-center gap-2">
              <span 
                :class="[
                  'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold',
                  isEditing ? 'bg-[#F6F0E4] text-[#6E5835]' : 'bg-[#1E446E] text-[#BFEBF2]'
                ]"
              >
                <Edit3 v-if="isEditing" class="w-3.5 h-3.5" />
                <Plus v-else class="w-3.5 h-3.5" />
              </span>
              <span class="text-xs sm:text-sm font-bold font-display text-[#0D1B3E]">
                {{ isEditing ? 'Editar Operación o Servicio' : 'Agregar Nueva Operación o Servicio al Catálogo' }}
              </span>
            </div>

            <button
              v-if="isEditing"
              type="button"
              @click="cancelEditing"
              class="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline transition cursor-pointer"
            >
              Cancelar Edición
            </button>
          </div>

          <form @submit.prevent="handleSaveOperation" class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
              
              <!-- Categoría / Componente -->
              <div class="sm:col-span-4 space-y-1">
                <label class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Layers class="w-3 h-3 text-[#004B97]" />
                  Categoría / Bloque
                </label>
                <select
                  v-model="formState.category"
                  class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#04C4D9] focus:border-[#04C4D9]"
                >
                  <option v-for="cat in CATEGORIES" :key="cat" :value="cat">
                    {{ cat }}
                  </option>
                </select>
              </div>

              <!-- Nombre de la Operación -->
              <div class="sm:col-span-5 space-y-1">
                <label class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Wrench class="w-3 h-3 text-[#004B97]" />
                  Nombre de la Operación / Servicio *
                </label>
                <input
                  v-model="formState.operation"
                  type="text"
                  placeholder="Ej. Rectificar Asientos de Culata"
                  class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#04C4D9] focus:border-[#04C4D9]"
                />
              </div>

              <!-- Tipo de Medida Dimensional (Opcional) -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[11px] font-bold text-slate-700">
                  Cota Dimensional
                </label>
                <select
                  v-model="formState.measureType"
                  class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#04C4D9] focus:border-[#04C4D9]"
                >
                  <option value="none">Sin medida</option>
                  <option value="single">Medida STD/0.25...</option>
                  <option value="dual">Doble Banco/Biela</option>
                </select>
              </div>
            </div>

            <!-- Botones del Formulario -->
            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                v-if="isEditing"
                type="button"
                @click="cancelEditing"
                class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                :class="[
                  'px-4 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer',
                  isEditing 
                    ? 'bg-[#1B4978] hover:bg-[#14375C] text-white' 
                    : 'studio-cta-primary text-white'
                ]"
              >
                <Edit3 v-if="isEditing" class="w-3.5 h-3.5" />
                <Plus v-else class="w-3.5 h-3.5" />
                {{ isEditing ? 'Guardar Cambios' : 'Agregar Operación al Catálogo' }}
              </button>
            </div>
          </form>
        </div>

        <!-- 2. Barra de Búsqueda y Selector de Categorías -->
        <div class="space-y-3">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <!-- Buscador -->
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search class="w-4 h-4" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar operación por nombre o categoría..."
                class="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04C4D9] focus:border-[#04C4D9]"
              />
              <button
                v-if="searchQuery"
                type="button"
                @click="searchQuery = ''"
                class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Cantidad de resultados -->
            <div class="text-[11px] font-semibold text-slate-500 whitespace-nowrap self-center">
              Mostrando <span class="font-bold text-[#0D1B3E]">{{ filteredCatalog.length }}</span> de {{ catalog.length }}
            </div>
          </div>

          <!-- Píldoras de Categoría -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              @click="selectedCategory = 'Todos'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 cursor-pointer',
                selectedCategory === 'Todos'
                  ? 'bg-[#0D1B3E] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              ]"
            >
              <span>Todos</span>
              <span class="text-[10px] opacity-75 font-mono">({{ getCategoryCount('Todos') }})</span>
            </button>

            <button
              v-for="cat in CATEGORIES"
              :key="cat"
              type="button"
              @click="selectedCategory = cat"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 border cursor-pointer',
                selectedCategory === cat
                  ? 'bg-[#004B97] border-[#004B97] text-white shadow-sm'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
              ]"
            >
              <span>{{ cat }}</span>
              <span class="text-[10px] opacity-75 font-mono">({{ getCategoryCount(cat) }})</span>
            </button>
          </div>
        </div>

        <!-- 3. Lista de Operaciones y Servicios -->
        <div class="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div class="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            
            <div
              v-if="filteredCatalog.length === 0"
              class="p-8 text-center text-xs text-slate-400 font-medium space-y-1"
            >
              <AlertCircle class="w-6 h-6 mx-auto text-slate-300" />
              <p>No se encontraron operaciones registradas que coincidan con la búsqueda.</p>
              <p class="text-[11px] text-slate-400">Puedes agregarla utilizando el formulario superior.</p>
            </div>

            <div
              v-for="item in filteredCatalog"
              :key="item.id"
              :class="[
                'p-3 sm:px-4 flex items-center justify-between gap-3 transition hover:bg-sky-50/50',
                editingId === item.id ? 'bg-amber-50/60' : ''
              ]"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span 
                  :class="[
                    'px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0',
                    getCategoryBadgeClass(item.category)
                  ]"
                >
                  {{ item.category }}
                </span>

                <div class="truncate">
                  <span class="text-xs font-bold text-[#0D1B3E] truncate">
                    {{ item.operation }}
                  </span>
                  
                  <!-- Etiquetas de cotas dimensionales -->
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span 
                      v-if="item.measureBanco !== undefined || item.measureBiela !== undefined"
                      class="text-[9px] px-1.5 py-0.2 rounded bg-[#04C4D9]/15 text-[#004B97] font-mono font-medium"
                    >
                      Banco / Biela
                    </span>
                    <span 
                      v-else-if="item.measure !== undefined"
                      class="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-medium"
                    >
                      Medida (STD / 0.25...)
                    </span>
                    <span 
                      v-if="item.isCustom"
                      class="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-medium"
                    >
                      Personalizada
                    </span>
                  </div>
                </div>
              </div>

              <!-- Acciones: Editar y Eliminar -->
              <div class="flex items-center gap-1 shrink-0">
                
                <!-- Modo confirmación de eliminación -->
                <div v-if="confirmDeleteId === item.id" class="flex items-center gap-1.5 popover-pop-in">
                  <span class="text-[11px] text-rose-600 font-bold hidden sm:inline">¿Eliminar?</span>
                  <button
                    type="button"
                    @click="handleDelete(item.id, item.operation)"
                    class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg shadow-xs transition cursor-pointer"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteId = null"
                    class="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                  >
                    No
                  </button>
                </div>

                <template v-else>
                  <button
                    type="button"
                    @click="startEditing(item)"
                    class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                    title="Editar operación"
                  >
                    <Edit3 class="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    @click="confirmDeleteId = item.id"
                    class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Eliminar operación del catálogo"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </template>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- Pie del Modal -->
      <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        
        <!-- Restablecer a valores iniciales -->
        <div class="flex items-center gap-2">
          <div v-if="confirmReset" class="flex items-center gap-2">
            <span class="text-xs text-rose-600 font-bold">¿Restablecer todo a fábrica?</span>
            <button
              type="button"
              @click="handleReset"
              class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
            >
              Confirmar
            </button>
            <button
              type="button"
              @click="confirmReset = false"
              class="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <button
            v-else
            type="button"
            @click="confirmReset = true"
            class="text-xs text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Restaura los 55 servicios originales de rectificadora del Excel"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            Restablecer Servicios de Fábrica (55)
          </button>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="px-5 py-2 bg-[#004B97] hover:bg-[#0D1B3E] text-white text-xs font-bold rounded-xl transition shadow-xs w-full sm:w-auto cursor-pointer"
        >
          Listo / Cerrar
        </button>
      </div>

    </div>
  </div>
</template>
