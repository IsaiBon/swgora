<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  WORKSHOP_FAMILY_TEMPLATES,
  cloneExistingGrupoToTemplate,
  convertTemplateToGrupoInsert,
  type FamilyTemplate,
  type TemplateColumnDef
} from './FamilyTemplates'
import type { GrupoRepuesto, GrupoRepuestoInsert } from '@/services/catalogService'
import {
  Layers,
  CircleDot,
  SlidersHorizontal,
  Wrench,
  Columns,
  Table,
  Check,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  ChevronRight,
  Eye,
  RefreshCw,
  FolderPlus
} from 'lucide-vue-next'

const props = defineProps<{
  existingGroups: GrupoRepuesto[]
  editingGroup?: GrupoRepuesto | null
  isSaving?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', payload: { data: GrupoRepuestoInsert; originalId?: string }): void
  (e: 'cancel'): void
}>()

// Modo de selección: 'templates' | 'clone' | 'free'
const selectedSourceMode = ref<'templates' | 'clone' | 'free'>('templates')

// Plantilla seleccionada en edición
const currentTemplate = ref<FamilyTemplate>(JSON.parse(JSON.stringify(WORKSHOP_FAMILY_TEMPLATES[0])))

// Identidad editable
const editNombre = ref<string>('')
const editCategoria = ref<string>('')
const editSubsistema = ref<string>('Cigüeñal')
const editDescripcion = ref<string>('')

// Selector de grupo existente a clonar
const selectedCloneGroupId = ref<string>('')

// Inicializar desde props si se está editando
const initializeFromGroup = (grp: GrupoRepuesto) => {
  const tpl = cloneExistingGrupoToTemplate(grp)
  currentTemplate.value = JSON.parse(JSON.stringify(tpl))
  editNombre.value = grp.nombre
  editCategoria.value = grp.categoria
  editSubsistema.value = grp.subsistema || 'Block'
  editDescripcion.value = grp.descripcion || ''
  selectedSourceMode.value = 'clone'
}

// Cargar plantilla predeterminada
const loadTemplate = (tpl: FamilyTemplate) => {
  currentTemplate.value = JSON.parse(JSON.stringify(tpl))
  editNombre.value = tpl.nombre
  editCategoria.value = tpl.categoria
  editSubsistema.value = tpl.subsistema
  editDescripcion.value = tpl.descripcion
}

// Observar edición
watch(
  () => props.editingGroup,
  (grp) => {
    if (grp) {
      initializeFromGroup(grp)
    } else {
      loadTemplate(WORKSHOP_FAMILY_TEMPLATES[0])
      selectedSourceMode.value = 'templates'
    }
  },
  { immediate: true }
)

// Clonar grupo seleccionado
const handleCloneExisting = () => {
  if (!selectedCloneGroupId.value) return
  const grp = props.existingGroups.find(g => g.codigo === selectedCloneGroupId.value || g.id === selectedCloneGroupId.value)
  if (grp) {
    const tpl = cloneExistingGrupoToTemplate(grp)
    loadTemplate(tpl)
  }
}

// Cargar plantilla libre
const handleSelectFree = () => {
  const freeTpl = WORKSHOP_FAMILY_TEMPLATES.find(t => t.id === 'tabla_libre_excel') || WORKSHOP_FAMILY_TEMPLATES[WORKSHOP_FAMILY_TEMPLATES.length - 1]
  selectedSourceMode.value = 'free'
  loadTemplate(freeTpl)
  editNombre.value = 'Nueva Familia'
}

// Icono según string
const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'Layers': return Layers
    case 'CircleDot': return CircleDot
    case 'SlidersHorizontal': return SlidersHorizontal
    case 'Wrench': return Wrench
    case 'Columns': return Columns
    case 'Table': return Table
    default: return Layers
  }
}

// Gestión de columnas
const addColumn = () => {
  currentTemplate.value.columnas.push({
    etiqueta: `Medida ${currentTemplate.value.columnas.length + 1}`,
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true
  })
}

const removeColumn = (index: number) => {
  if (currentTemplate.value.columnas.length <= 1) return
  currentTemplate.value.columnas.splice(index, 1)
}

// Gestión de subfilas (Cojinetes)
const addSubfila = () => {
  if (!currentTemplate.value.tabla_config) {
    currentTemplate.value.tabla_config = {
      titulo_primera_columna: 'Componente',
      modo_filas: 'subfilas',
      subfilas: ['Biela', 'Bancada'],
      tiene_cabecera_marca: true
    }
  }
  if (!Array.isArray(currentTemplate.value.tabla_config.subfilas)) {
    currentTemplate.value.tabla_config.subfilas = ['Biela', 'Bancada']
  }
  currentTemplate.value.tabla_config.subfilas.push(`Fila ${currentTemplate.value.tabla_config.subfilas.length + 1}`)
}

const removeSubfila = (index: number) => {
  if (!currentTemplate.value.tabla_config?.subfilas || currentTemplate.value.tabla_config.subfilas.length <= 1) return
  currentTemplate.value.tabla_config.subfilas.splice(index, 1)
}

// Columnas únicas agrupadas para previsualizar cabeceras dobles (como STD -> Mín, Máx)
const previewHeaderGroups = computed(() => {
  const cols = currentTemplate.value.columnas
  const groups: Array<{ name: string; colspan: number; cols: TemplateColumnDef[] }> = []

  let currentGroupName: string | null = null
  let currentGroupCols: TemplateColumnDef[] = []

  cols.forEach(col => {
    const parent = col.columna_padre?.trim() || ''
    if (parent) {
      if (currentGroupName === parent) {
        currentGroupCols.push(col)
      } else {
        if (currentGroupCols.length > 0) {
          groups.push({
            name: currentGroupName || '',
            colspan: currentGroupCols.length,
            cols: [...currentGroupCols]
          })
        }
        currentGroupName = parent
        currentGroupCols = [col]
      }
    } else {
      if (currentGroupCols.length > 0) {
        groups.push({
          name: currentGroupName || '',
          colspan: currentGroupCols.length,
          cols: [...currentGroupCols]
        })
        currentGroupName = null
        currentGroupCols = []
      }
      groups.push({
        name: '',
        colspan: 1,
        cols: [col]
      })
    }
  })

  if (currentGroupCols.length > 0) {
    groups.push({
      name: currentGroupName || '',
      colspan: currentGroupCols.length,
      cols: [...currentGroupCols]
    })
  }

  return groups
})

const hasGroupedHeaders = computed(() => {
  return previewHeaderGroups.value.some(g => g.name !== '')
})

// Validación y Guardado
const validationError = ref<string>('')

const handleSave = () => {
  if (!editNombre.value.trim()) {
    validationError.value = 'El nombre de la familia es obligatorio.'
    return
  }
  if (!currentTemplate.value.columnas.length) {
    validationError.value = 'Debes incluir al menos una medida o columna.'
    return
  }

  validationError.value = ''
  const payload = convertTemplateToGrupoInsert(
    currentTemplate.value,
    editNombre.value,
    editCategoria.value,
    editSubsistema.value
  )

  emit('save', {
    data: payload,
    originalId: props.editingGroup?.id
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- BARRA SUPERIOR: ELECCIÓN DE MODO DE INICIO -->
    <div class="bg-slate-100 p-2.5 rounded-2xl border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          @click="selectedSourceMode = 'templates'"
          :class="[
            'px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer',
            selectedSourceMode === 'templates'
              ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          ]"
        >
          <Sparkles class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>Plantillas de Taller</span>
        </button>

        <button
          type="button"
          @click="selectedSourceMode = 'clone'"
          :class="[
            'px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer',
            selectedSourceMode === 'clone'
              ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          ]"
        >
          <Copy class="w-3.5 h-3.5 text-[#004B97]" />
          <span>Copiar de una Existente</span>
        </button>

        <button
          type="button"
          @click="handleSelectFree"
          :class="[
            'px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer',
            selectedSourceMode === 'free'
              ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          ]"
        >
          <Table class="w-3.5 h-3.5 text-emerald-600" />
          <span>Modo Libre / Excel</span>
        </button>
      </div>

      <!-- Si está en modo copiar de existente, selector desplegable -->
      <div v-if="selectedSourceMode === 'clone'" class="flex items-center gap-2">
        <select
          v-model="selectedCloneGroupId"
          @change="handleCloneExisting"
          class="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] shadow-2xs"
        >
          <option value="" disabled>Selecciona una familia para clonar...</option>
          <option v-for="grp in existingGroups" :key="grp.id" :value="grp.codigo">
            {{ grp.nombre }} ({{ grp.parametros.length }} medidas)
          </option>
        </select>
      </div>
    </div>

    <!-- TARJETAS DE PLANTILLAS RÁPIDAS (SOLO EN MODO PLANTILLAS) -->
    <div v-if="selectedSourceMode === 'templates'" class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <FolderPlus class="w-4 h-4 text-[#04C4D9]" />
          <span>1. Elige una plantilla base para comenzar</span>
        </label>
        <span class="text-[11px] text-slate-500">Haz clic en la pieza que vas a registrar</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="tpl in WORKSHOP_FAMILY_TEMPLATES"
          :key="tpl.id"
          @click="loadTemplate(tpl)"
          :class="[
            'p-3.5 rounded-2xl border transition-all text-left cursor-pointer relative group flex flex-col justify-between shadow-2xs',
            currentTemplate.id === tpl.id || currentTemplate.categoria === tpl.categoria
              ? 'bg-cyan-50/90 border-[#04C4D9] ring-2 ring-[#04C4D9]/40'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
          ]"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div
                class="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
                :class="currentTemplate.id === tpl.id ? 'bg-[#04C4D9] text-white shadow-2xs' : 'bg-slate-100 text-slate-700'"
              >
                <component :is="getIconComponent(tpl.icono)" class="w-4 h-4" />
              </div>
              <span
                v-if="tpl.badge"
                class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono"
              >
                {{ tpl.badge }}
              </span>
            </div>

            <div>
              <h4 class="text-xs font-black text-slate-900 group-hover:text-[#004B97] transition">
                {{ tpl.nombre }}
              </h4>
              <p class="text-[11px] text-slate-500 leading-snug mt-1">
                {{ tpl.descripcion }}
              </p>
            </div>
          </div>

          <div class="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
            <span class="text-slate-600 font-mono text-[10px]">
              {{ tpl.columnas.length }} columnas
            </span>
            <span
              class="flex items-center gap-1 transition"
              :class="currentTemplate.id === tpl.id ? 'text-[#038391] font-black' : 'text-slate-400 group-hover:text-slate-700'"
            >
              <span>{{ currentTemplate.id === tpl.id ? 'Seleccionada' : 'Elegir' }}</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- SECCIÓN DE PERSONALIZACIÓN Y VISTA PREVIA RÁPIDA -->
    <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-5">
      
      <!-- IDENTIDAD BÁSICA (SÓLO 3 CAMPOS DIRECTOS) -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
        <div class="md:col-span-5">
          <label class="block text-xs font-black text-slate-800 mb-1">
            Nombre de la Familia <span class="text-rose-500">*</span>
          </label>
          <input
            v-model="editNombre"
            type="text"
            placeholder="Ej. Cojinetes, Anillos de motor, Camisas..."
            class="w-full px-3.5 py-2 text-xs font-black bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#04C4D9] transition"
          />
        </div>

        <div class="md:col-span-4">
          <label class="block text-xs font-black text-slate-800 mb-1">
            Parte del Motor (Subsistema)
          </label>
          <select
            v-model="editSubsistema"
            class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#04C4D9] transition"
          >
            <option value="Block">Block de Cilindros</option>
            <option value="Culata">Culata / Tapa</option>
            <option value="Cigüeñal">Cigüeñal / Bancada</option>
            <option value="General">General / Accesorios</option>
          </select>
        </div>

        <div class="md:col-span-3">
          <label class="block text-xs font-black text-slate-800 mb-1">
            Formato de Visualización
          </label>
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              @click="currentTemplate.tipo_vista = 'tabla'"
              :class="[
                'flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition cursor-pointer',
                currentTemplate.tipo_vista === 'tabla' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              Matriz / Tabla
            </button>
            <button
              type="button"
              @click="currentTemplate.tipo_vista = 'normal'"
              :class="[
                'flex-1 py-1 px-2 rounded-lg text-[11px] font-black transition cursor-pointer',
                currentTemplate.tipo_vista === 'normal' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              Lista Simple
            </button>
          </div>
        </div>
      </div>

      <!-- OPCIÓN DE SUBFILAS / COMPONENTES MÚLTIPLES (EJ. BIELA / BANCADA) -->
      <div
        v-if="currentTemplate.tipo_vista === 'tabla' && currentTemplate.tabla_config"
        class="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3"
      >
        <div class="flex items-center justify-between">
          <div>
            <h5 class="text-xs font-black text-slate-900 flex items-center gap-2">
              <Layers class="w-4 h-4 text-[#004B97]" />
              <span>Filas que tendrá cada registro (ej. Biela y Bancada, o Anillos)</span>
            </h5>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Define los componentes que componen cada juego o conjunto de este repuesto.
            </p>
          </div>

          <button
            v-if="currentTemplate.tabla_config.modo_filas === 'subfilas'"
            type="button"
            @click="addSubfila"
            class="px-2.5 py-1 text-xs font-bold text-[#038391] hover:text-[#004B97] bg-white border border-cyan-200 rounded-xl transition flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>+ Agregar Fila</span>
          </button>
        </div>

        <!-- Si tiene subfilas definidas (como Biela / Bancada) -->
        <div
          v-if="currentTemplate.tabla_config.modo_filas === 'subfilas' && currentTemplate.tabla_config.subfilas"
          class="flex items-center gap-2 flex-wrap pt-1"
        >
          <div
            v-for="(_sf, sfIdx) in currentTemplate.tabla_config.subfilas"
            :key="sfIdx"
            class="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1 rounded-xl shadow-2xs"
          >
            <span class="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-mono font-bold flex items-center justify-center">
              {{ sfIdx + 1 }}
            </span>
            <input
              v-model="currentTemplate.tabla_config.subfilas[sfIdx]"
              type="text"
              class="w-24 text-xs font-black text-slate-800 bg-transparent focus:outline-none"
              placeholder="Nombre"
            />
            <button
              v-if="currentTemplate.tabla_config.subfilas.length > 1"
              type="button"
              @click="removeSubfila(sfIdx)"
              class="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div v-else-if="currentTemplate.tabla_config.modo_filas === 'incremental'" class="text-xs font-bold text-emerald-800 bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2">
          <CircleDot class="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Matriz de ranuras dinámicas: Inicializa con 3 anillos (1°, 2°, Aceite) y permite agregar hasta 10+ ranuras en cualquier motor.</span>
        </div>
      </div>

      <!-- VISTA PREVIA INTERACTIVA DE LA TABLA (ESTILO EXACTO AL CATÁLOGO) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
            <Eye class="w-4 h-4 text-[#04C4D9]" />
            <span>Vista Previa: Así se verá la tabla en el catálogo</span>
          </div>

          <button
            type="button"
            @click="addColumn"
            class="px-3 py-1.5 bg-[#004B97] hover:bg-[#003875] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
          >
            <Plus class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span>+ Agregar Columna</span>
          </button>
        </div>

        <!-- TABLA RENDERIZADA EN VIVO -->
        <div class="border border-slate-300 rounded-2xl overflow-hidden shadow-2xs bg-white">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <!-- Nivel 1: Títulos de Grupo Superior (ej. STD, 1ERT, 2DA...) -->
                <tr v-if="hasGroupedHeaders" class="bg-slate-100/90 text-slate-700 border-b border-slate-200">
                  <th class="py-1 px-3 font-bold text-[10px] uppercase tracking-wider border-r border-slate-200">
                    {{ currentTemplate.tabla_config?.titulo_primera_columna || 'Componente' }}
                  </th>
                  <th class="py-1 px-2 font-bold text-[10px] uppercase tracking-wider border-r border-slate-200 text-center">
                    CÓDIGO
                  </th>
                  <th
                    v-for="(grp, gIdx) in previewHeaderGroups"
                    :key="gIdx"
                    :colspan="grp.colspan"
                    class="py-1 px-2 font-black text-[10px] text-center uppercase tracking-wider border-r border-slate-200 bg-slate-200/50"
                  >
                    {{ grp.name || '-' }}
                  </th>
                </tr>

                <!-- Nivel 2: Nombres individuales de columnas -->
                <tr class="bg-slate-50 text-slate-700 border-b border-slate-300">
                  <th class="py-2 px-3 font-black text-slate-900 border-r border-slate-200">
                    {{ currentTemplate.tabla_config?.titulo_primera_columna || 'Componente' }}
                  </th>
                  <th class="py-2 px-2 font-black text-slate-900 border-r border-slate-200 text-center">
                    CÓDIGO
                  </th>
                  <th
                    v-for="(col, cIdx) in currentTemplate.columnas"
                    :key="cIdx"
                    class="py-2 px-2.5 font-bold text-slate-800 border-r border-slate-200 text-center group min-w-[90px]"
                  >
                    <div class="flex items-center justify-center gap-1">
                      <input
                        v-model="col.etiqueta"
                        class="text-center font-black text-xs text-slate-900 bg-transparent hover:bg-white focus:bg-white rounded px-1 border border-transparent hover:border-slate-300 focus:border-[#04C4D9] w-20"
                        title="Haz clic para renombrar esta columna"
                      />
                      <button
                        v-if="currentTemplate.columnas.length > 1"
                        type="button"
                        @click="removeColumn(cIdx)"
                        class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition cursor-pointer"
                        title="Eliminar columna"
                      >
                        <Trash2 class="w-3 h-3" />
                      </button>
                    </div>
                    <span v-if="col.unidad" class="text-[9px] text-slate-400 font-mono">({{ col.unidad }})</span>
                  </th>
                </tr>
              </thead>

              <!-- CUERPO DE EJEMPLO DE LA TABLA -->
              <tbody class="divide-y divide-slate-100 text-slate-600">
                <!-- Fila cabecera de motor ejemplo si aplica -->
                <tr v-if="currentTemplate.tabla_config?.tiene_cabecera_marca" class="bg-rose-50/40">
                  <td :colspan="currentTemplate.columnas.length + 2" class="py-1.5 px-3 text-[11px] font-bold text-slate-800">
                    <span class="text-rose-700 font-black mr-2">MOTOR EJEMPLO</span>
                    <span class="text-slate-500">1.8 D / 2.0 TDI</span>
                  </td>
                </tr>

                <!-- Filas representativas -->
                <tr
                  v-for="(rowLabel, rIdx) in (currentTemplate.tabla_config?.subfilas || ['Fila 1', 'Fila 2'])"
                  :key="rIdx"
                  class="hover:bg-slate-50/70"
                >
                  <td class="py-2 px-3 font-black text-slate-800 flex items-center gap-2 border-r border-slate-100">
                    <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
                    <span>{{ rowLabel }}</span>
                  </td>
                  <td class="py-2 px-2 text-center font-mono text-[11px] text-slate-400 border-r border-slate-100">
                    77{{ rIdx + 1 }}
                  </td>
                  <td
                    v-for="(_col, colIdx) in currentTemplate.columnas"
                    :key="colIdx"
                    class="py-2 px-2 text-center font-mono text-slate-400 border-r border-slate-100 text-[11px]"
                  >
                    0.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p class="text-[11px] text-slate-400 italic">
          💡 Consejo: Puedes hacer clic directamente sobre el nombre de cualquier columna para cambiarlo.
        </p>
      </div>

      <!-- MENSAJE DE ERROR DE VALIDACIÓN -->
      <div v-if="validationError" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
        {{ validationError }}
      </div>

      <!-- BOTONES DE ACCIÓN -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          @click="emit('cancel')"
          class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
        >
          Cancelar
        </button>

        <button
          type="button"
          @click="handleSave"
          :disabled="props.isSaving"
          class="px-6 py-2.5 rounded-xl text-xs font-black bg-[#04C4D9] hover:bg-[#03a9bc] text-slate-950 transition flex items-center gap-2 shadow-2xs disabled:opacity-50 cursor-pointer active:scale-95"
        >
          <RefreshCw v-if="props.isSaving" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-4 h-4" />
          <span>{{ props.editingGroup ? 'Guardar Cambios de Familia' : 'Guardar y Crear Familia' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
