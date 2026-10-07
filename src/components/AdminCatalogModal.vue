<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { 
  type GrupoRepuesto, 
  type ParametroTecnicoDefinicion,
  type RepuestoTecnico
} from '@/services/catalogService'
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  SlidersHorizontal, 
  Sparkles, 
  Info, 
  Tag, 
  Hash, 
  Ruler, 
  FolderPlus, 
  PackagePlus, 
  Loader2 
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  initialTab?: 'repuesto' | 'grupo'
  preselectedGroupId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'part-created', part: RepuestoTecnico): void
  (e: 'group-created', group: GrupoRepuesto): void
}>()

const catalogStore = useCatalogStore()

// Pestaña activa ('repuesto' | 'grupo')
const activeTab = ref<'repuesto' | 'grupo'>(props.initialTab || 'repuesto')

watch(() => props.initialTab, (newTab) => {
  if (newTab) activeTab.value = newTab
})

watch(() => props.isOpen, (open) => {
  if (open) {
    if (props.initialTab) activeTab.value = props.initialTab
    if (props.preselectedGroupId) {
      selectedGroupCode.value = props.preselectedGroupId
    } else if (!selectedGroupCode.value && catalogStore.grupos.length > 0) {
      selectedGroupCode.value = catalogStore.grupos[0].codigo
    }
  }
})

// =============================================================================
// TAB 1: FORMULARIO REACTIVO DE REPUESTO CON VALIDACIÓN PARAMÉTRICA DINÁMICA
// =============================================================================
const selectedGroupCode = ref<string>('')
const partMotorId = ref<string>('')
const partCodigoOem = ref<string>('')
const partNombre = ref<string>('')
const partSubsistema = ref<string>('Block')
const partPrecio = ref<number | null>(null)
const partStock = ref<number>(12)
const partEstado = ref<'Disponible' | 'Bajo Stock' | 'Agotado'>('Disponible')
const partCatalogoOrigen = ref<string>('OEM')

// Valores dinámicos de parámetros técnicos: clave -> valor
const paramValues = ref<Record<string, any>>({})

// Errores reactivos de validación
const formErrors = ref<Record<string, string>>({})
const isSubmittingPart = ref(false)

// Equivalencias alternas del repuesto
const equivalencias = ref<Array<{ marca_alterna: string; codigo_alterno: string; notas?: string }>>([
  { marca_alterna: 'Dokuro', codigo_alterno: '', notas: '' }
])

const activeGroup = computed<GrupoRepuesto | null>(() => {
  if (!selectedGroupCode.value) return null
  return catalogStore.grupos.find(g => g.codigo === selectedGroupCode.value || g.id === selectedGroupCode.value) || null
})

// Al cambiar de grupo, inicializar los campos de parámetros técnicos y subsistema
watch(activeGroup, (grp) => {
  if (grp) {
    partSubsistema.value = grp.subsistema || 'Block'
    // Mantener valores previos o inicializar vacíos
    const current = { ...paramValues.value }
    grp.parametros.forEach(p => {
      if (current[p.clave] === undefined) {
        current[p.clave] = p.tipo_dato === 'booleano' ? false : (p.tipo_dato === 'numero' ? null : '')
      }
    })
    paramValues.value = current
    formErrors.value = {}
  }
}, { immediate: true })

const addEquivalenceRow = () => {
  equivalencias.value.push({ marca_alterna: 'Rik', codigo_alterno: '', notas: '' })
}

const removeEquivalenceRow = (index: number) => {
  if (equivalencias.value.length > 1) {
    equivalencias.value.splice(index, 1)
  }
}

// Validación reactiva estricta de repuesto y parámetros
const validatePartForm = (): boolean => {
  const errors: Record<string, string> = {}

  if (!partCodigoOem.value.trim()) {
    errors.partCodigoOem = 'El código OEM de la pieza es obligatorio'
  }
  if (!partNombre.value.trim()) {
    errors.partNombre = 'El nombre o descripción del repuesto es obligatorio'
  }

  // Validar parámetros requeridos del grupo seleccionado
  if (activeGroup.value && activeGroup.value.parametros) {
    for (const param of activeGroup.value.parametros) {
      if (param.requerido) {
        const val = paramValues.value[param.clave]
        if (param.tipo_dato === 'numero') {
          if (val === null || val === undefined || val === '' || isNaN(Number(val)) || Number(val) <= 0) {
            errors[param.clave] = `La medida ${param.etiqueta} (${param.unidad || 'mm'}) es obligatoria para este grupo`
          }
        } else if (param.tipo_dato === 'texto' || param.tipo_dato === 'seleccion') {
          if (!val || String(val).trim() === '') {
            errors[param.clave] = `El parámetro ${param.etiqueta} es obligatorio`
          }
        }
      }
    }
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSavePart = async () => {
  if (!validatePartForm()) {
    return
  }

  isSubmittingPart.value = true
  try {
    const validEquivs = equivalencias.value.filter(
      eq => eq.marca_alterna && eq.codigo_alterno.trim().length > 0
    )

    // Dimensiones dinámicas limpias
    const dimensionesPayload: Record<string, any> = {}
    if (activeGroup.value) {
      for (const p of activeGroup.value.parametros) {
        const val = paramValues.value[p.clave]
        if (val !== undefined && val !== null && val !== '') {
          dimensionesPayload[p.clave] = p.tipo_dato === 'numero' ? Number(val) : val
        }
      }
    }

    const created = await catalogStore.createRepuesto(
      {
        motor_id: partMotorId.value || undefined,
        codigo_oem: partCodigoOem.value.trim().toUpperCase(),
        nombre: partNombre.value.trim(),
        subsistema: partSubsistema.value,
        categoria: activeGroup.value?.categoria || 'General',
        precio: Number(partPrecio.value || 0),
        stock: Number(partStock.value || 0),
        estado: partEstado.value,
        catalogo_origen: partCatalogoOrigen.value,
        dimensiones: dimensionesPayload,
        // Mapear cotas estándar si coinciden con nombres típicos
        diametro_cabeza_mm: dimensionesPayload.diametro_cabeza_mm || dimensionesPayload.diametro_cabeza,
        diametro_vastago_mm: dimensionesPayload.diametro_vastago_mm || dimensionesPayload.diametro_vastago,
        longitud_total_mm: dimensionesPayload.longitud_total_mm || dimensionesPayload.longitud_total || dimensionesPayload.altura_mm,
        diametro_interior_mm: dimensionesPayload.diametro_interior_mm || dimensionesPayload.diametro_interior,
        diametro_exterior_mm: dimensionesPayload.diametro_exterior_mm || dimensionesPayload.diametro_exterior,
        altura_mm: dimensionesPayload.altura_mm || dimensionesPayload.altura,
        diametro_cilindro_mm: dimensionesPayload.diametro_cilindro_mm || dimensionesPayload.diametro_cilindro,
        espesor_anillo1_mm: dimensionesPayload.espesor_anillo1_mm || dimensionesPayload.espesor_anillo1,
        espesor_anillo2_mm: dimensionesPayload.espesor_anillo2_mm || dimensionesPayload.espesor_anillo2,
        espesor_aceite_mm: dimensionesPayload.espesor_aceite_mm || dimensionesPayload.espesor_aceite,
        medida_rosca: dimensionesPayload.medida_rosca,
        paso_rosca_mm: dimensionesPayload.paso_rosca_mm,
        longitud_perno_mm: dimensionesPayload.longitud_perno_mm,
        cantidad_piezas: dimensionesPayload.cantidad_piezas
      },
      validEquivs
    )

    emit('part-created', created)
    resetPartForm()
    emit('close')
  } catch (err: unknown) {
    console.error('Error al guardar repuesto:', err)
  } finally {
    isSubmittingPart.value = false
  }
}

const resetPartForm = () => {
  partCodigoOem.value = ''
  partNombre.value = ''
  partPrecio.value = null
  partStock.value = 12
  paramValues.value = {}
  formErrors.value = {}
  equivalencias.value = [{ marca_alterna: 'Dokuro', codigo_alterno: '', notas: '' }]
}

// =============================================================================
// TAB 2: CONSTRUCTOR DINÁMICO DE FAMILIAS / GRUPOS DE PIEZAS Y PARÁMETROS
// =============================================================================
const groupNombre = ref<string>('')
const groupCategoria = ref<string>('')
const groupSubsistema = ref<string>('Block')
const groupDescripcion = ref<string>('')
const groupIcono = ref<string>('Layers')

// Lista dinámica de parámetros del nuevo grupo
const dynamicParams = ref<Array<{
  id: string
  etiqueta: string
  clave: string
  unidad: string
  tipo_dato: 'numero' | 'texto' | 'booleano' | 'seleccion'
  requerido: boolean
  descripcion: string
}>>([
  {
    id: `param-${Date.now()}-1`,
    etiqueta: 'Diámetro Interior',
    clave: 'diametro_interior_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    descripcion: 'Medida del diámetro interno de la pieza'
  },
  {
    id: `param-${Date.now()}-2`,
    etiqueta: 'Diámetro Exterior',
    clave: 'diametro_exterior_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    descripcion: 'Medida del diámetro externo o de alojamiento'
  },
  {
    id: `param-${Date.now()}-3`,
    etiqueta: 'Longitud / Altura Total',
    clave: 'longitud_total_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    descripcion: 'Largo total o altura en milímetros'
  }
])

const groupErrors = ref<Record<string, string>>({})
const isSubmittingGroup = ref(false)

// Auto-generar clave técnica al cambiar la etiqueta
const handleParamLabelChange = (param: typeof dynamicParams.value[0]) => {
  if (!param.clave || param.clave.startsWith('param_') || param.clave.includes('_mm')) {
    const slug = param.etiqueta
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    param.clave = param.unidad === 'mm' ? `${slug}_mm` : slug
  }
}

const addParamRow = () => {
  const count = dynamicParams.value.length + 1
  dynamicParams.value.push({
    id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    etiqueta: `Medida ${count}`,
    clave: `medida_${count}_mm`,
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    descripcion: ''
  })
}

const removeParamRow = (index: number) => {
  dynamicParams.value.splice(index, 1)
}

// Cargar plantilla predefinida: Camisas de Cilindro (3 medidas requeridas)
const loadTemplateCamisas = () => {
  groupNombre.value = 'Camisas de Cilindro'
  groupCategoria.value = 'Camisas'
  groupSubsistema.value = 'Block'
  groupDescripcion.value = 'Camisas de cilindro secas, cromadas y con pestaña para encamisado y rectificación de block'
  groupIcono.value = 'Layers'
  dynamicParams.value = [
    {
      id: `param-${Date.now()}-1`,
      etiqueta: 'Diámetro Interior (Alesado)',
      clave: 'diametro_interior_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro interno semiterminado o terminado'
    },
    {
      id: `param-${Date.now()}-2`,
      etiqueta: 'Diámetro Exterior',
      clave: 'diametro_exterior_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro externo para ajuste en el túnel del cilindro'
    },
    {
      id: `param-${Date.now()}-3`,
      etiqueta: 'Longitud Total',
      clave: 'longitud_total_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Largo total de la camisa'
    }
  ]
}

// Cargar plantilla predefinida: Pistones y Bulones
const loadTemplatePistones = () => {
  groupNombre.value = 'Pistones de Motor'
  groupCategoria.value = 'Pistones'
  groupSubsistema.value = 'Block'
  groupDescripcion.value = 'Pistones con perno y pistas de anillos para maquinado de motor'
  groupIcono.value = 'CircleDot'
  dynamicParams.value = [
    {
      id: `param-${Date.now()}-1`,
      etiqueta: 'Diámetro de Pistón',
      clave: 'diametro_piston_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro de la falda del pistón'
    },
    {
      id: `param-${Date.now()}-2`,
      etiqueta: 'Diámetro de Pasador (Bulón)',
      clave: 'diametro_bulon_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro exterior del perno de biela'
    },
    {
      id: `param-${Date.now()}-3`,
      etiqueta: 'Altura de Compresión',
      clave: 'altura_compresion_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Distancia de centro de bulón a cabeza de pistón'
    }
  ]
}

const validateGroupForm = (): boolean => {
  const errors: Record<string, string> = {}
  if (!groupNombre.value.trim()) {
    errors.groupNombre = 'El nombre de la familia o grupo es obligatorio'
  }
  if (!groupCategoria.value.trim()) {
    groupCategoria.value = groupNombre.value.trim()
  }
  if (dynamicParams.value.length === 0) {
    errors.dynamicParams = 'Define al menos un parámetro técnico para la familia'
  } else {
    dynamicParams.value.forEach((p, idx) => {
      if (!p.etiqueta.trim()) {
        errors[`param_${idx}_etiqueta`] = `El parámetro #${idx + 1} requiere una etiqueta`
      }
      if (!p.clave.trim()) {
        errors[`param_${idx}_clave`] = `El parámetro #${idx + 1} requiere una clave técnica`
      }
    })
  }
  groupErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSaveGroup = async () => {
  if (!validateGroupForm()) {
    return
  }

  isSubmittingGroup.value = true
  try {
    const paramsPayload: ParametroTecnicoDefinicion[] = dynamicParams.value.map(p => ({
      id: p.id,
      clave: p.clave.trim(),
      etiqueta: p.etiqueta.trim(),
      unidad: p.unidad.trim(),
      tipo_dato: p.tipo_dato,
      requerido: p.requerido,
      descripcion: p.descripcion.trim() || undefined
    }))

    const created = await catalogStore.createGrupo({
      nombre: groupNombre.value.trim(),
      categoria: groupCategoria.value.trim() || groupNombre.value.trim(),
      subsistema: groupSubsistema.value,
      descripcion: groupDescripcion.value.trim() || undefined,
      icono: groupIcono.value,
      parametros: paramsPayload
    })

    emit('group-created', created)
    // Pasar automáticamente a crear un repuesto de este nuevo grupo
    selectedGroupCode.value = created.codigo
    activeTab.value = 'repuesto'
  } catch (err: unknown) {
    console.error('Error al guardar grupo:', err)
  } finally {
    isSubmittingGroup.value = false
  }
}

// Cerrar con Escape
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div 
    v-if="isOpen" 
    class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
      
      <!-- ===================================================================== -->
      <!-- MODAL HEADER CON PESTAÑAS SEGMENTADAS                                 -->
      <!-- ===================================================================== -->
      <div class="px-5 sm:px-7 py-4.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#04C4D9]/15 text-[#038896] border border-[#04C4D9]/30 flex items-center gap-1">
              <Sparkles class="w-3 h-3 text-[#04C4D9]" />
              Gestión Administrativa del Catálogo
            </span>
          </div>
          <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <SlidersHorizontal class="w-5 h-5 text-[#04C4D9]" />
            Nuevo Repuesto / Grupo Dinámico
          </h2>
        </div>

        <!-- Selector de pestañas segmentado -->
        <div class="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            @click="activeTab = 'repuesto'"
            :class="[
              'px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5',
              activeTab === 'repuesto' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <PackagePlus class="w-4 h-4 text-[#04C4D9]" />
            <span>Dar de Alta Repuesto</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'grupo'"
            :class="[
              'px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5',
              activeTab === 'grupo' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <FolderPlus class="w-4 h-4 text-[#04C4D9]" />
            <span>Nueva Familia / Grupo</span>
          </button>
        </div>

        <!-- Botón cerrar -->
        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition absolute sm:relative top-4 right-4 sm:top-0 sm:right-0"
          title="Cerrar modal (Esc)"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- MODAL BODY CON SCROLL INTERNO                                         -->
      <!-- ===================================================================== -->
      <div class="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 text-slate-800">

        <!-- ----------------------------------------------------------------- -->
        <!-- PESTAÑA 1: FORMULARIO REACTIVO DE ALTA DE REPUESTO               -->
        <!-- ----------------------------------------------------------------- -->
        <div v-if="activeTab === 'repuesto'" class="space-y-6">

          <!-- 1. Selección de Familia / Grupo de Pieza -->
          <div class="bg-cyan-50/40 border border-cyan-200/80 rounded-2xl p-4.5 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  1. Seleccionar Familia / Grupo de Pieza
                </label>
                <p class="text-[11px] text-slate-500">
                  El grupo seleccionado define las reglas paramétricas y medidas obligatorias que se deben validar.
                </p>
              </div>

              <button
                type="button"
                @click="activeTab = 'grupo'"
                class="text-xs font-bold text-[#038896] hover:text-[#04C4D9] flex items-center gap-1 transition"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>¿No encuentras el grupo? Crear nuevo</span>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                v-for="grp in catalogStore.grupos"
                :key="grp.id"
                type="button"
                @click="selectedGroupCode = grp.codigo"
                :class="[
                  'p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2',
                  selectedGroupCode === grp.codigo 
                    ? 'border-[#04C4D9] bg-white ring-2 ring-[#04C4D9]/20 shadow-xs' 
                    : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                ]"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full" :class="selectedGroupCode === grp.codigo ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                    <strong class="text-xs font-extrabold text-slate-900">{{ grp.nombre }}</strong>
                  </div>
                </div>
                <div class="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                  <Ruler class="w-3 h-3 text-[#04C4D9]" />
                  <span>{{ grp.parametros.length }} medidas configuradas</span>
                </div>
              </button>
            </div>

            <!-- Resumen del grupo seleccionado -->
            <div v-if="activeGroup" class="pt-1 flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Info class="w-4 h-4 text-[#04C4D9] shrink-0" />
              <span>
                Familia: <strong class="text-slate-900">{{ activeGroup.nombre }}</strong> • 
                Subsistema: <strong class="text-slate-900">{{ activeGroup.subsistema }}</strong> • 
                <strong class="text-emerald-700">{{ activeGroup.parametros.filter(p => p.requerido).length }} medidas obligatorias</strong>
              </span>
            </div>
          </div>

          <!-- 2. Datos Generales del Repuesto -->
          <div class="space-y-4">
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Tag class="w-4 h-4 text-[#04C4D9]" />
              2. Identificación Técnica del Repuesto
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <!-- Código OEM -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Código OEM / Principal *
                </label>
                <input
                  v-model="partCodigoOem"
                  type="text"
                  placeholder="Ej. 13711-54020, 8-97176-683-0"
                  class="w-full px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20 uppercase"
                  :class="formErrors.partCodigoOem ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                />
                <span v-if="formErrors.partCodigoOem" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                  {{ formErrors.partCodigoOem }}
                </span>
              </div>

              <!-- Nombre del Repuesto -->
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Nombre / Descripción Técnica *
                </label>
                <input
                  v-model="partNombre"
                  type="text"
                  placeholder="Ej. Camisa de Cilindro Semiterminada 4JB1 STD"
                  class="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20"
                  :class="formErrors.partNombre ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                />
                <span v-if="formErrors.partNombre" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                  {{ formErrors.partNombre }}
                </span>
              </div>

              <!-- Motor Asociado -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Motor Asociado (Opcional)
                </label>
                <select
                  v-model="partMotorId"
                  class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="">Universal / Todos los Motores</option>
                  <option v-for="mot in catalogStore.motores" :key="mot.id" :value="mot.id">
                    {{ mot.codigo }} - {{ mot.nombre_comercial || 'Motor' }}
                  </option>
                </select>
              </div>

              <!-- Catálogo de Origen -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Marca de Catálogo / Origen
                </label>
                <select
                  v-model="partCatalogoOrigen"
                  class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="OEM">OEM Original</option>
                  <option value="Dokuro">Dokuro (Japón)</option>
                  <option value="Rik">Rik / Riken (Japón)</option>
                  <option value="NPR">NPR (Japón)</option>
                  <option value="NDC">NDC Cojinetes (Japón)</option>
                  <option value="Ajusa">Ajusa (España)</option>
                  <option value="Pioneer">Pioneer (USA)</option>
                </select>
              </div>

              <!-- Precio y Stock -->
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Precio ($)</label>
                  <input
                    v-model.number="partPrecio"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Stock</label>
                  <input
                    v-model.number="partStock"
                    type="number"
                    placeholder="12"
                    class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Constructor Reactivo de Parámetros y Medidas del Grupo -->
          <div class="space-y-4">
            <div class="flex items-center justify-between border-b pb-2 border-slate-200">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Ruler class="w-4 h-4 text-[#04C4D9]" />
                3. Parámetros Técnicos y Medidas Requeridas por el Grupo
              </h3>
              <span v-if="activeGroup" class="text-[11px] font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full">
                {{ activeGroup.parametros.filter(p => p.requerido).length }} Obligatorios
              </span>
            </div>

            <!-- Si el grupo no tiene parámetros especiales -->
            <div v-if="!activeGroup || activeGroup.parametros.length === 0" class="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
              Este grupo no tiene medidas dimensionales adicionales configuradas.
            </div>

            <!-- Grilla reactiva de campos de parámetros -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div 
                v-for="param in activeGroup.parametros" 
                :key="param.id"
                class="bg-slate-50/70 p-3.5 rounded-2xl border transition"
                :class="formErrors[param.clave] ? 'border-rose-400 bg-rose-50/40 ring-1 ring-rose-300' : 'border-slate-200'"
              >
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-extrabold text-slate-900 flex items-center gap-1">
                    <span>{{ param.etiqueta }}</span>
                    <span v-if="param.requerido" class="text-rose-600 font-black text-sm">*</span>
                  </label>
                  <span 
                    :class="[
                      'text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider',
                      param.requerido ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-200 text-slate-600'
                    ]"
                  >
                    {{ param.requerido ? 'Requerido' : 'Opcional' }}
                  </span>
                </div>

                <!-- Input numérico con unidad -->
                <div v-if="param.tipo_dato === 'numero'" class="relative flex items-center">
                  <input
                    v-model.number="paramValues[param.clave]"
                    type="number"
                    step="0.001"
                    :placeholder="`Valor en ${param.unidad || 'mm'} (ej. 93.000)`"
                    class="w-full pl-3 pr-11 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                  />
                  <span class="absolute right-3 text-[10px] font-black text-slate-400 pointer-events-none uppercase">
                    {{ param.unidad || 'mm' }}
                  </span>
                </div>

                <!-- Input de selección -->
                <div v-else-if="param.tipo_dato === 'seleccion'" class="relative">
                  <select
                    v-model="paramValues[param.clave]"
                    class="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9]"
                  >
                    <option value="">Selecciona opción</option>
                    <option v-for="opt in param.opciones || []" :key="opt" :value="opt">
                      {{ opt }}
                    </option>
                  </select>
                </div>

                <!-- Input booleano -->
                <div v-else-if="param.tipo_dato === 'booleano'" class="flex items-center gap-3 pt-1">
                  <label class="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input type="radio" :value="true" v-model="paramValues[param.clave]" class="text-[#04C4D9]" />
                    <span>Sí</span>
                  </label>
                  <label class="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                    <input type="radio" :value="false" v-model="paramValues[param.clave]" class="text-[#04C4D9]" />
                    <span>No</span>
                  </label>
                </div>

                <!-- Input de texto -->
                <div v-else>
                  <input
                    v-model="paramValues[param.clave]"
                    type="text"
                    :placeholder="`Valor para ${param.etiqueta}`"
                    class="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>

                <!-- Ayuda contextual / Error específico -->
                <p v-if="formErrors[param.clave]" class="text-[10px] text-rose-600 font-bold mt-1">
                  {{ formErrors[param.clave] }}
                </p>
                <p v-else-if="param.descripcion" class="text-[10px] text-slate-400 mt-1">
                  {{ param.descripcion }}
                </p>
              </div>
            </div>
          </div>

          <!-- 4. Cruces y Equivalencias Técnicas -->
          <div class="space-y-3">
            <div class="flex items-center justify-between border-b pb-2 border-slate-200">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Hash class="w-4 h-4 text-[#04C4D9]" />
                4. Equivalencias Técnicas Multimarca (Dokuro, Rik, NPR, NDC, etc.)
              </h3>
              <button
                type="button"
                @click="addEquivalenceRow"
                class="text-xs font-bold text-[#038896] hover:text-[#04C4D9] flex items-center gap-1"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Añadir Cruce Alterno</span>
              </button>
            </div>

            <div class="space-y-2">
              <div 
                v-for="(eq, idx) in equivalencias" 
                :key="idx" 
                class="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
              >
                <select
                  v-model="eq.marca_alterna"
                  class="w-32 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none"
                >
                  <option value="Dokuro">Dokuro</option>
                  <option value="Rik">Rik</option>
                  <option value="NPR">NPR</option>
                  <option value="NDC">NDC</option>
                  <option value="Ajusa">Ajusa</option>
                  <option value="Pioneer">Pioneer</option>
                  <option value="Taiho">Taiho</option>
                  <option value="Toto">Toto</option>
                  <option value="TIK">TIK</option>
                </select>

                <input
                  v-model="eq.codigo_alterno"
                  type="text"
                  placeholder="Código de parte alterna"
                  class="flex-1 px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none uppercase"
                />

                <input
                  v-model="eq.notas"
                  type="text"
                  placeholder="Notas (ej. Japón STD)"
                  class="flex-1 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none"
                />

                <button
                  type="button"
                  @click="removeEquivalenceRow(idx)"
                  class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                  title="Eliminar fila"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ----------------------------------------------------------------- -->
        <!-- PESTAÑA 2: CONSTRUCTOR DINÁMICO DE NUEVA FAMILIA / GRUPO         -->
        <!-- ----------------------------------------------------------------- -->
        <div v-else class="space-y-6">

          <!-- Plantillas rápidas de taller -->
          <div class="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <strong class="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                <Sparkles class="w-4 h-4 text-amber-600" />
                Plantillas Rápidas para Rectificadora
              </strong>
              <p class="text-[11px] text-amber-800">
                Puedes rellenar al instante grupos típicos con sus 3 cotas obligatorias para encamisado o maquinado:
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                @click="loadTemplateCamisas"
                class="px-3 py-1.5 rounded-xl bg-white text-amber-900 border border-amber-300 text-xs font-extrabold hover:bg-amber-100/70 transition shadow-2xs"
              >
                ⚡ Camisas de Cilindro (3 medidas)
              </button>
              <button
                type="button"
                @click="loadTemplatePistones"
                class="px-3 py-1.5 rounded-xl bg-white text-amber-900 border border-amber-300 text-xs font-extrabold hover:bg-amber-100/70 transition shadow-2xs"
              >
                ⚡ Pistones de Motor (3 medidas)
              </button>
            </div>
          </div>

          <!-- 1. Definición General del Grupo -->
          <div class="space-y-4">
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FolderPlus class="w-4 h-4 text-[#04C4D9]" />
              1. Datos de la Nueva Familia / Grupo de Repuestos
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Grupo / Familia *
                </label>
                <input
                  v-model="groupNombre"
                  type="text"
                  placeholder="Ej. Camisas de Cilindro"
                  class="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                  :class="groupErrors.groupNombre ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                />
                <span v-if="groupErrors.groupNombre" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                  {{ groupErrors.groupNombre }}
                </span>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Categoría Técnica *
                </label>
                <input
                  v-model="groupCategoria"
                  type="text"
                  placeholder="Ej. Camisas, Pistones, Válvulas"
                  class="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Subsistema Mecánico del Motor *
                </label>
                <select
                  v-model="groupSubsistema"
                  class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="Block">Block de Cilindros</option>
                  <option value="Culata">Culata / Cabezote</option>
                  <option value="Cigüeñal">Cigüeñal / Bancadas</option>
                  <option value="Bielas">Bielas y Pistones</option>
                  <option value="Sellos y Juntas">Sellos, Retenes y Juntas</option>
                  <option value="Distribución">Distribución / Válvulas</option>
                </select>
              </div>

              <div class="sm:col-span-3">
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Técnica de la Familia
                </label>
                <input
                  v-model="groupDescripcion"
                  type="text"
                  placeholder="Ej. Piezas para encamisado y rectificación de bloques automotrices"
                  class="w-full px-3.5 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </div>
            </div>
          </div>

          <!-- 2. Constructor Dinámico de Parámetros -->
          <div class="space-y-4">
            <div class="flex items-center justify-between border-b pb-2 border-slate-200">
              <div>
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <SlidersHorizontal class="w-4 h-4 text-[#04C4D9]" />
                  2. Constructor Dinámico de Medidas y Reglas Paramétricas
                </h3>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  Agrega las medidas que los repuestos de este grupo deberán cumplir. Marca cuáles son obligatorias.
                </p>
              </div>

              <button
                type="button"
                @click="addParamRow"
                class="px-3 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-2xs shrink-0"
              >
                <Plus class="w-4 h-4" />
                <span>+ Agregar Medida</span>
              </button>
            </div>

            <!-- Lista interactiva de parámetros dinámicos -->
            <div class="space-y-3">
              <div
                v-for="(param, idx) in dynamicParams"
                :key="param.id"
                class="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 space-y-3 relative transition hover:border-slate-300"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">
                      {{ idx + 1 }}
                    </span>
                    Parámetro Técnico #{{ idx + 1 }}
                  </span>

                  <div class="flex items-center gap-3">
                    <!-- Switch Obligatorio -->
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        v-model="param.requerido" 
                        class="w-4 h-4 rounded text-[#04C4D9] focus:ring-[#04C4D9]" 
                      />
                      <span class="text-xs font-bold" :class="param.requerido ? 'text-rose-700' : 'text-slate-500'">
                        {{ param.requerido ? 'Obligatorio' : 'Opcional' }}
                      </span>
                    </label>

                    <button
                      type="button"
                      @click="removeParamRow(idx)"
                      class="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Eliminar este parámetro"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <!-- Etiqueta -->
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Nombre / Etiqueta *</label>
                    <input
                      v-model="param.etiqueta"
                      @input="handleParamLabelChange(param)"
                      type="text"
                      placeholder="Ej. Diámetro Interior"
                      class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>

                  <!-- Clave interna -->
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Clave Técnica *</label>
                    <input
                      v-model="param.clave"
                      type="text"
                      placeholder="diametro_interior_mm"
                      class="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>

                  <!-- Unidad de Medida -->
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Unidad</label>
                    <select
                      v-model="param.unidad"
                      class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    >
                      <option value="mm">mm (Milímetros)</option>
                      <option value="°">° (Grados)</option>
                      <option value="pulgadas">pulgadas</option>
                      <option value="piezas">piezas</option>
                      <option value="Nm">Nm</option>
                      <option value="">Sin unidad</option>
                    </select>
                  </div>

                  <!-- Tipo de Dato -->
                  <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Dato</label>
                    <select
                      v-model="param.tipo_dato"
                      class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    >
                      <option value="numero">Número Decimal</option>
                      <option value="texto">Texto</option>
                      <option value="booleano">Booleano (Sí/No)</option>
                      <option value="seleccion">Selección</option>
                    </select>
                  </div>

                  <!-- Descripción -->
                  <div class="sm:col-span-2 lg:col-span-4">
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Ayuda / Descripción Técnica</label>
                    <input
                      v-model="param.descripcion"
                      type="text"
                      placeholder="Ej. Cota de alesado interno para tolerancia de pistón"
                      class="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- MODAL FOOTER CON BOTÓN GUARDAR                                        -->
      <!-- ===================================================================== -->
      <div class="px-5 sm:px-7 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
        >
          Cancelar
        </button>

        <div class="flex items-center gap-2">
          <!-- Botón Guardar según pestaña -->
          <button
            v-if="activeTab === 'repuesto'"
            type="button"
            @click="handleSavePart"
            :disabled="isSubmittingPart"
            class="px-5 py-2.5 rounded-xl bg-[#04C4D9] hover:bg-[#03a9bc] disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-2 transition shadow-sm active:scale-95"
          >
            <Loader2 v-if="isSubmittingPart" class="w-4 h-4 animate-spin" />
            <Save v-else class="w-4 h-4" />
            <span>{{ isSubmittingPart ? 'Guardando en Supabase...' : 'Guardar Repuesto en Catálogo' }}</span>
          </button>

          <button
            v-else
            type="button"
            @click="handleSaveGroup"
            :disabled="isSubmittingGroup"
            class="px-5 py-2.5 rounded-xl bg-[#04C4D9] hover:bg-[#03a9bc] disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-2 transition shadow-sm active:scale-95"
          >
            <Loader2 v-if="isSubmittingGroup" class="w-4 h-4 animate-spin" />
            <Save v-else class="w-4 h-4" />
            <span>{{ isSubmittingGroup ? 'Guardando Familia...' : 'Guardar Familia y Esquema' }}</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
