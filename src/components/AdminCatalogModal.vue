<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import PartImageUploader from '@/components/catalog/PartImageUploader.vue'
import { 
  type GrupoRepuesto, 
  type ParametroTecnicoDefinicion,
  type TablaConfiguracion,
  type RepuestoTecnico,
  type Motor
} from '@/services/catalogService'
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  SlidersHorizontal, 
  Tag, 
  Hash, 
  Ruler, 
  FolderPlus, 
  PackagePlus, 
  Loader2,
  Edit3,
  Search,
  ChevronDown,
  Check,
  AlertCircle,
  Eye,
  Lock,
  Filter,
  Table,
  Copy,
  Columns
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  initialTab?: 'repuesto' | 'grupo'
  preselectedGroupId?: string | null
  preselectedMotorId?: string | null
  editGroupId?: string | null
  editPart?: RepuestoTecnico | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'part-created', part: RepuestoTecnico): void
  (e: 'part-updated', part: RepuestoTecnico): void
  (e: 'part-deleted', partId: string): void
  (e: 'group-created', group: GrupoRepuesto): void
  (e: 'group-updated', group: GrupoRepuesto): void
}>()

const catalogStore = useCatalogStore()

// Pestaña activa ('repuesto' | 'grupo')
const activeTab = ref<'repuesto' | 'grupo'>(props.initialTab || 'repuesto')

export interface RingFormRow {
  id: string
  posicion: string
  tipo_aro: 'fuego' | 'compresion' | 'aceite'
  h1: number | null
  a1: number | null
  perfil: string
  tiene_identificador: boolean
  identificador_texto: string
  extra: Record<string, any>
}

const createDefaultRingRows = (cfg?: TablaConfiguracion): RingFormRow[] => {
  const titulo = cfg?.titulo_primera_columna || 'Anillo'
  const usarPref = cfg?.usar_prefijo_titulo !== false
  const modo = cfg?.modo_filas || 'incremental'
  const ult = cfg?.etiqueta_ultima_fila !== undefined ? cfg.etiqueta_ultima_fila : 'Anillo de aceite'
  const row1Pos = modo === 'incremental' ? (usarPref ? `${titulo} 1` : '1') : `${titulo} 1`
  const row2Pos = modo === 'incremental' ? (usarPref ? `${titulo} 2` : '2') : `${titulo} 2`
  const row3Pos = modo === 'incremental' ? (ult ? ult : (usarPref ? `${titulo} 3` : '3')) : (ult || `${titulo} 3`)
  return [
    { id: 'ring-1', posicion: row1Pos, tipo_aro: 'fuego', h1: null, a1: null, perfil: 'Plano', tiene_identificador: false, identificador_texto: '', extra: {} },
    { id: 'ring-2', posicion: row2Pos, tipo_aro: 'compresion', h1: null, a1: null, perfil: 'Plano', tiene_identificador: false, identificador_texto: '', extra: {} },
    { id: 'ring-oil', posicion: row3Pos, tipo_aro: 'aceite', h1: null, a1: null, perfil: 'Estándar', tiene_identificador: false, identificador_texto: '', extra: {} }
  ]
}

const isEditPartMode = ref<boolean>(false)
const editingPartId = ref<string | null>(null)
const isDeletingPart = ref<boolean>(false)
const showDeleteConfirm = ref<boolean>(false)
const hasThirdRing = ref<boolean>(false)
const ringRows = ref<RingFormRow[]>(createDefaultRingRows())
const saveErrorMessage = ref<string>('')

const resolveGroupByTarget = (target?: string | null): GrupoRepuesto | null => {
  if (!target) return null
  const clean = target.trim().toLowerCase()
  return (
    catalogStore.grupos.find(g => g.codigo.toLowerCase() === clean || g.id.toLowerCase() === clean) ||
    catalogStore.grupos.find(g => g.categoria.toLowerCase() === clean || g.nombre.toLowerCase() === clean) ||
    catalogStore.grupos.find(g => g.codigo.toLowerCase().includes(clean) || clean.includes(g.codigo.toLowerCase()) || g.categoria.toLowerCase().includes(clean)) ||
    null
  )
}

const handleDeletePart = async () => {
  if (!editingPartId.value) return
  isDeletingPart.value = true
  try {
    const pId = editingPartId.value
    await catalogStore.deleteRepuesto(pId)
    emit('part-deleted', pId)
    emit('close')
  } catch (err: unknown) {
    console.error('Error al eliminar repuesto:', err)
    saveErrorMessage.value = 'Error al eliminar el repuesto: ' + (err instanceof Error ? err.message : String(err))
  } finally {
    isDeletingPart.value = false
    showDeleteConfirm.value = false
  }
}

watch(() => props.initialTab, (newTab) => {
  if (newTab) activeTab.value = newTab
})

watch(() => props.editPart, (newPart) => {
  if (newPart) {
    loadPartForEditing(newPart)
  }
}, { immediate: true })

watch(() => props.isOpen, (open) => {
  if (open) {
    saveErrorMessage.value = ''
    formErrors.value = {}
    showDeleteConfirm.value = false
    isDeletingPart.value = false

    if (props.editPart) {
      // 1. MODO EDICIÓN EXCLUSIVA DE REPUESTO (Directo y enfocado únicamente en la pieza)
      activeTab.value = 'repuesto'
      isEditPartMode.value = true
      editingPartId.value = props.editPart.id
      isEditMode.value = false
      editingGroupId.value = null
      loadPartForEditing(props.editPart)
    } else if (props.editGroupId || props.initialTab === 'grupo') {
      // 2. MODO EDICIÓN O CREACIÓN EXCLUSIVA DE FAMILIA TÉCNICA
      activeTab.value = 'grupo'
      isEditPartMode.value = false
      editingPartId.value = null

      const targetGroup = props.editGroupId || props.preselectedGroupId || selectedGroupCode.value
      if (props.editGroupId || targetGroup) {
        const grp = resolveGroupByTarget(props.editGroupId || targetGroup)
        if (grp) {
          selectedGroupCode.value = grp.codigo
          selectedEditGroupId.value = grp.codigo || grp.id
          loadGroupForEditing(grp)
        } else {
          switchToCreateMode()
        }
      } else {
        switchToCreateMode()
      }
    } else {
      // 3. MODO CREACIÓN GENERAL DE NUEVO REPUESTO
      activeTab.value = 'repuesto'
      isEditPartMode.value = false
      editingPartId.value = null
      isEditMode.value = false
      editingGroupId.value = null
      resetPartForm()
      const resolvedPre = resolveGroupByTarget(props.preselectedGroupId)
      if (resolvedPre) {
        selectedGroupCode.value = resolvedPre.codigo
      } else if (!selectedGroupCode.value && catalogStore.grupos.length > 0) {
        selectedGroupCode.value = catalogStore.grupos[0].codigo
      }
    }

    if (!props.editPart && props.preselectedMotorId) {
      partMotorId.value = props.preselectedMotorId
      const found = catalogStore.motores.find(m => m.id === props.preselectedMotorId)
      if (found) {
        const brand = getBrandName(found.fabricante_id)
        motorSearchQuery.value = `${found.codigo}${found.nombre_comercial ? ` - ${found.nombre_comercial}` : (brand ? ` (${brand})` : '')}`
      }
    }

    // Asegurar motores y marcas cargados para el buscador
    if (catalogStore.motores.length === 0) {
      catalogStore.fetchMotores()
    }
    if (catalogStore.fabricantes.length === 0) {
      catalogStore.fetchFabricantes()
    }
  } else {
    saveErrorMessage.value = ''
    showDeleteConfirm.value = false
    isDeletingPart.value = false
    isEditPartMode.value = false
    editingPartId.value = null
    isEditMode.value = false
    editingGroupId.value = null
    selectedEditGroupId.value = ''
  }
})

// =============================================================================
// TAB 1: FORMULARIO REACTIVO DE REPUESTO CON VALIDACIÓN PARAMÉTRICA DINÁMICA
// =============================================================================
const selectedGroupCode = ref<string>('')
const partMotorId = ref<string>('')
const motorSearchQuery = ref<string>('')
const isMotorDropdownOpen = ref<boolean>(false)

const getBrandName = (fabId?: string): string => {
  if (!fabId) return ''
  const fab = catalogStore.fabricantes.find(f => f.id === fabId)
  return fab ? fab.nombre : ''
}

const selectedMotor = computed<Motor | null>(() => {
  if (!partMotorId.value) return null
  return catalogStore.motores.find(m => m.id === partMotorId.value) || null
})

const filteredMotoresList = computed<Motor[]>(() => {
  const query = motorSearchQuery.value.trim().toLowerCase()
  const all = catalogStore.motores || []
  
  if (!query) {
    return all.slice(0, 30)
  }

  return all
    .filter(m => {
      const code = (m.codigo || '').toLowerCase()
      const name = (m.nombre_comercial || '').toLowerCase()
      const denom = (m.denominacion_venta || '').toLowerCase()
      const brand = getBrandName(m.fabricante_id).toLowerCase()
      const fuel = (m.combustible || '').toLowerCase()

      return code.includes(query) || 
             name.includes(query) || 
             denom.includes(query) || 
             brand.includes(query) ||
             fuel.includes(query)
    })
    .slice(0, 40)
})

const onMotorFocus = () => {
  isMotorDropdownOpen.value = true
}

const onMotorInput = () => {
  isMotorDropdownOpen.value = true
  if (!motorSearchQuery.value.trim()) {
    partMotorId.value = ''
  }
}

const selectMotor = (mot: Motor | null) => {
  if (!mot) {
    partMotorId.value = ''
    motorSearchQuery.value = ''
  } else {
    partMotorId.value = mot.id
    const brand = getBrandName(mot.fabricante_id)
    motorSearchQuery.value = `${mot.codigo}${mot.nombre_comercial ? ` - ${mot.nombre_comercial}` : (brand ? ` (${brand})` : '')}`
  }
  isMotorDropdownOpen.value = false
}

const clearMotor = () => {
  partMotorId.value = ''
  motorSearchQuery.value = ''
  isMotorDropdownOpen.value = false
}

const handleDocumentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.combobox-motor-asociado')) {
    isMotorDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
const partCodigoOem = ref<string>('')
const partCodigosOemAdicionales = ref<string[]>([])
const partNombre = ref<string>('')
const partSubsistema = ref<string>('Block')
const partPrecio = ref<number | null>(null)
const partStock = ref<number>(12)
const partEstado = ref<'Disponible' | 'Bajo Stock' | 'Agotado'>('Disponible')
const partCatalogoOrigen = ref<string>('OEM')
const partImagenUrl = ref<string>('')

const addCodigoOemAdicional = () => {
  partCodigosOemAdicionales.value.push('')
}

const removeCodigoOemAdicional = (idx: number) => {
  partCodigosOemAdicionales.value.splice(idx, 1)
}

/**
 * Normaliza las entradas de código OEM dividiendo por comas, barras o espacios
 * para asegurar que cada código se mantenga en su propia caja individual
 */
const normalizeOemInputs = () => {
  if (!partCodigoOem.value) return
  const rawTokens = partCodigoOem.value
    .split(/[,\/;|\n]+/)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean)
  if (rawTokens.length > 1) {
    partCodigoOem.value = rawTokens[0]
    const extraTokens = rawTokens.slice(1)
    const existingClean = partCodigosOemAdicionales.value
      .map(c => c.trim().toUpperCase())
      .filter(Boolean)
    const merged = Array.from(new Set([...existingClean, ...extraTokens].filter(c => c !== partCodigoOem.value)))
    partCodigosOemAdicionales.value = merged
  }
}

const onPrimaryOemInput = () => {
  if (/[,\/;|\n]/.test(partCodigoOem.value)) {
    normalizeOemInputs()
  }
}

const handleAdditionalOemInput = (idx: number) => {
  const currentVal = partCodigosOemAdicionales.value[idx] || ''
  if (/[,\/;|\n]/.test(currentVal)) {
    const tokens = currentVal.split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean)
    if (tokens.length > 0) {
      partCodigosOemAdicionales.value.splice(idx, 1, ...tokens)
      const main = partCodigoOem.value.trim().toUpperCase()
      partCodigosOemAdicionales.value = Array.from(new Set(partCodigosOemAdicionales.value.filter(c => c && c !== main)))
    }
  }
}

const allOemCodesPreview = computed<string[]>(() => {
  const list: string[] = []
  if (partCodigoOem.value) {
    list.push(...partCodigoOem.value.split(/[,\/;|\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean))
  }
  for (const extra of partCodigosOemAdicionales.value) {
    if (extra) {
      list.push(...extra.split(/[,\/;|\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean))
    }
  }
  return Array.from(new Set(list))
})

const activeGroup = computed<GrupoRepuesto | null>(() => {
  if (!selectedGroupCode.value) return null
  return catalogStore.grupos.find(g => g.codigo === selectedGroupCode.value || g.id === selectedGroupCode.value) || null
})

const activeTablaConfig = computed<TablaConfiguracion>(() => {
  return activeGroup.value?.tabla_config || {
    titulo_primera_columna: 'Anillo',
    modo_filas: 'incremental',
    usar_prefijo_titulo: true,
    etiqueta_ultima_fila: 'Anillo de aceite',
    habilitar_identificador: true,
    etiqueta_identificador: 'Cónico'
  }
})

const getDefaultRowPosition = (idx: number, totalRows: number, cfg?: TablaConfiguracion): string => {
  const conf = cfg || activeTablaConfig.value
  const titulo = conf.titulo_primera_columna || 'Anillo'
  const usarPref = conf.usar_prefijo_titulo !== false
  const isLast = idx === totalRows - 1 && totalRows >= 2
  if (isLast && conf.etiqueta_ultima_fila && conf.etiqueta_ultima_fila.trim()) {
    return conf.etiqueta_ultima_fila.trim()
  }
  if (conf.modo_filas === 'incremental') {
    return usarPref ? `${titulo} ${idx + 1}` : `${idx + 1}`
  }
  return `${titulo} ${idx + 1}`
}

const syncIncrementalRowPositions = () => {
  if (activeTablaConfig.value.modo_filas !== 'incremental') return
  const total = ringRows.value.length
  ringRows.value.forEach((row, idx) => {
    row.posicion = getDefaultRowPosition(idx, total)
  })
}

const addRingRow = () => {
  const oilIdx = ringRows.value.findIndex(r => r.tipo_aro === 'aceite')
  const insertIdx = oilIdx >= 0 ? oilIdx : ringRows.value.length
  const newRing: RingFormRow = {
    id: `ring-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    posicion: getDefaultRowPosition(insertIdx, ringRows.value.length + 1),
    tipo_aro: 'compresion',
    h1: null,
    a1: null,
    perfil: 'Plano',
    tiene_identificador: false,
    identificador_texto: '',
    extra: {}
  }
  if (oilIdx >= 0) {
    ringRows.value.splice(oilIdx, 0, newRing)
  } else {
    ringRows.value.push(newRing)
  }
  syncIncrementalRowPositions()
  hasThirdRing.value = ringRows.value.length >= 4
}

const removeRingRow = (idx: number) => {
  if (ringRows.value.length <= 1) return
  ringRows.value.splice(idx, 1)
  syncIncrementalRowPositions()
  hasThirdRing.value = ringRows.value.length >= 4
}

const toggleRowIdentificador = (row: RingFormRow) => {
  row.tiene_identificador = !row.tiene_identificador
  const defaultIdent = activeTablaConfig.value.etiqueta_identificador || 'Cónico'
  if (row.tiene_identificador) {
    if (!row.identificador_texto || row.identificador_texto === 'Plano' || row.identificador_texto === 'Estándar') {
      row.identificador_texto = defaultIdent
    }
    row.perfil = row.identificador_texto
  } else {
    row.identificador_texto = ''
    row.perfil = row.tipo_aro === 'aceite' ? 'Estándar' : 'Plano'
  }
}

const onRowIdentificadorTextInput = (row: RingFormRow) => {
  if (row.identificador_texto && row.identificador_texto.trim()) {
    row.tiene_identificador = true
    row.perfil = row.identificador_texto.trim()
  } else {
    row.tiene_identificador = false
    row.perfil = row.tipo_aro === 'aceite' ? 'Estándar' : 'Plano'
  }
}

const getRingRowTitle = (row: RingFormRow, idx: number): string => {
  if (row.posicion && row.posicion.trim()) return row.posicion
  return getDefaultRowPosition(idx, ringRows.value.length)
}

// Valores dinámicos de parámetros técnicos: clave -> valor
const paramValues = ref<Record<string, any>>({})

// Errores reactivos de validación
const formErrors = ref<Record<string, string>>({})
const isSubmittingPart = ref(false)

// Catálogo reactivo y persistente de marcas alternas
const DEFAULT_ALT_BRANDS = ['Dokuro', 'Rik', 'NPR', 'MRK', 'NDC', 'Ajusa', 'Pioneer', 'Toto', 'TIK', 'Hastings', 'Mahle', 'Cofap', 'Taiho', 'Federal Mogul']
const availableAltBrands = ref<string[]>([...DEFAULT_ALT_BRANDS])
const showNewBrandInput = ref(false)
const newBrandInputName = ref('')

const loadStoredAltBrands = () => {
  try {
    const raw = localStorage.getItem('swgora_marcas_alternas_v1')
    if (raw) {
      const custom: string[] = JSON.parse(raw)
      const merged = Array.from(new Set([...DEFAULT_ALT_BRANDS, ...custom]))
      availableAltBrands.value = merged
    }
  } catch {}
}

const handleAddNewAltBrand = () => {
  const brand = newBrandInputName.value.trim()
  if (!brand) return
  if (!availableAltBrands.value.some(b => b.toLowerCase() === brand.toLowerCase())) {
    availableAltBrands.value.push(brand)
    try {
      const customOnly = availableAltBrands.value.filter(b => !DEFAULT_ALT_BRANDS.includes(b))
      localStorage.setItem('swgora_marcas_alternas_v1', JSON.stringify(customOnly))
    } catch {}
  }
  // Asignar a la última fila abierta si existe
  if (equivalencias.value.length > 0) {
    equivalencias.value[equivalencias.value.length - 1].marca_alterna = brand
  }
  newBrandInputName.value = ''
  showNewBrandInput.value = false
}

loadStoredAltBrands()

// Equivalencias alternas del repuesto
const equivalencias = ref<Array<{ marca_alterna: string; codigo_alterno: string; notas?: string }>>([
  { marca_alterna: 'Dokuro', codigo_alterno: '', notas: '' }
])

const isRingsGroup = computed<boolean>(() => {
  if (!activeGroup.value) return false
  if (activeGroup.value.tipo_vista === 'tabla') return true
  const code = (activeGroup.value.codigo || '').toLowerCase()
  const cat = (activeGroup.value.categoria || '').toLowerCase()
  return code === 'anillos_motor' || code.includes('anillo') || cat === 'anillos' || cat.includes('anillo')
})

const CORE_RING_PARAM_KEYS = new Set([
  'diametro_cilindro_mm',
  'grosor_mm',
  'altura_mm',
  'anillo1_h1',
  'anillo1_a1',
  'anillo2_h1',
  'anillo2_a1',
  'anillo3_h1',
  'anillo3_a1',
  'aceite_h1',
  'aceite_a1',
  'espesor_anillo1_mm',
  'espesor_anillo2_mm',
  'espesor_anillo3_mm',
  'espesor_aceite_mm',
  'altura_anillo1_mm',
  'altura_anillo2_mm',
  'altura_anillo3_mm',
  'altura_aceite_mm',
  'altura_radial1_mm',
  'altura_radial2_mm',
  'altura_radial3_mm',
  'altura_radial_aceite_mm',
  'espesor_radial1_mm',
  'espesor_radial2_mm',
  'espesor_radial3_mm',
  'espesor_radial_aceite_mm',
  'diseno_conico',
  'keystone',
  'cilindros'
])

const extraRingGroupParams = computed(() => {
  if (!activeGroup.value || !isRingsGroup.value) return []
  return activeGroup.value.parametros.filter(p => !CORE_RING_PARAM_KEYS.has(p.clave))
})

const getActiveGroupParamLabel = (clave: string, fallback: string): string => {
  const found = activeGroup.value?.parametros.find(p => p.clave === clave)
  if (!found) return fallback
  const base = found.etiqueta_corta || found.etiqueta || fallback
  return found.unidad ? `${base} (${found.unidad})` : base
}

// Al cambiar de grupo, inicializar los campos de parámetros técnicos y subsistema
watch(activeGroup, (grp) => {
  if (grp) {
    partSubsistema.value = grp.subsistema || 'Block'
    selectedEditGroupId.value = grp.codigo || grp.id
    if (!isEditPartMode.value) {
      paramValues.value = {}
      hasThirdRing.value = false
      ringRows.value = createDefaultRingRows(grp.tabla_config)
    }
    // Mantener valores previos o inicializar vacíos
    const current = { ...paramValues.value }
    grp.parametros.forEach(p => {
      if (current[p.clave] === undefined) {
        current[p.clave] = p.tipo_dato === 'booleano' ? false : (p.tipo_dato === 'numero' ? null : '')
      }
    })
    paramValues.value = current
    formErrors.value = {}
    saveErrorMessage.value = ''
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

  // Validación específica para Anillos de Motor
  if (isRingsGroup.value) {
    const dVal = paramValues.value.diametro_cilindro_mm
    if (dVal === null || dVal === undefined || dVal === '' || isNaN(Number(dVal)) || Number(dVal) <= 0) {
      errors.diametro_cilindro_mm = 'El Diámetro de Cilindro (d1 en mm) es obligatorio'
    }

    ringRows.value.forEach((row, idx) => {
      if (row.h1 === null || row.h1 === undefined || String(row.h1) === '' || isNaN(Number(row.h1)) || Number(row.h1) <= 0) {
        errors[`ring_h1_${idx}`] = `El grosor h1 de ${getRingRowTitle(row, idx)} es obligatorio`
      }
    })

    for (const param of extraRingGroupParams.value) {
      if (param.requerido) {
        const val = paramValues.value[param.clave]
        if (param.tipo_dato === 'numero') {
          if (val === null || val === undefined || val === '' || isNaN(Number(val)) || Number(val) <= 0) {
            errors[param.clave] = `La medida ${param.etiqueta} (${param.unidad || 'mm'}) es obligatoria`
          }
        } else if (param.tipo_dato === 'texto' || param.tipo_dato === 'seleccion') {
          if (!val || String(val).trim() === '') {
            errors[param.clave] = `El parámetro ${param.etiqueta} es obligatorio`
          }
        }
      }
    }
  } else if (activeGroup.value && activeGroup.value.parametros) {
    // Validar parámetros requeridos del grupo seleccionado
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
  if (Object.keys(errors).length > 0) {
    saveErrorMessage.value = 'Por favor complete todos los campos obligatorios marcados en rojo.'
  } else {
    saveErrorMessage.value = ''
  }
  return Object.keys(errors).length === 0
}

const loadPartForEditing = (part: RepuestoTecnico) => {
  isEditPartMode.value = true
  editingPartId.value = part.id
  activeTab.value = 'repuesto'

  const rawMainTokens = String(part.codigo_oem || '')
    .split(/[,\/;|\n]+/)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean)

  partCodigoOem.value = rawMainTokens[0] || (part.codigo_oem || '')
  const oemFromMain = rawMainTokens.slice(1)

  const rawAddOem =
    part.codigos_oem_adicionales ||
    (part.especificaciones_tecnicas as any)?.codigos_oem_adicionales ||
    (part.dimensiones as any)?.codigos_oem_adicionales ||
    (part.especificaciones_tecnicas as any)?.referencias_oem ||
    []

  const rawAddTokens: string[] = []
  if (Array.isArray(rawAddOem)) {
    for (const item of rawAddOem) {
      rawAddTokens.push(...String(item || '').split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean))
    }
  } else if (typeof rawAddOem === 'string') {
    rawAddTokens.push(...String(rawAddOem).split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean))
  }

  partCodigosOemAdicionales.value = Array.from(
    new Set([...oemFromMain, ...rawAddTokens].filter(c => c.length > 0 && c !== partCodigoOem.value))
  )

  partNombre.value = part.nombre || ''
  partSubsistema.value = part.subsistema || 'Block'
  partPrecio.value = part.precio != null ? part.precio : null
  partStock.value = part.stock != null ? part.stock : 12
  partEstado.value = (part.estado as any) || 'Disponible'
  partCatalogoOrigen.value = part.catalogo_origen || 'OEM'
  partImagenUrl.value = part.imagen_url || ''

  // Motor asociado
  if (part.motor_id) {
    partMotorId.value = part.motor_id
    const mot = part.motor || catalogStore.motores.find(m => m.id === part.motor_id)
    if (mot) {
      const brand = getBrandName(mot.fabricante_id)
      motorSearchQuery.value = `${mot.codigo}${mot.nombre_comercial ? ` - ${mot.nombre_comercial}` : (brand ? ` (${brand})` : '')}`
    } else {
      motorSearchQuery.value = part.motor_id
    }
  } else {
    partMotorId.value = ''
    motorSearchQuery.value = ''
  }

  // Identificar el grupo correspondiente con coincidencia estricta y semántica (sin recurrir laxamente a subsistema)
  const catClean = (part.categoria || '').toLowerCase().trim()
  const nameClean = (part.nombre || '').toLowerCase().trim()
  const oemClean = (part.codigo_oem || '').toLowerCase().trim()

  // 1. Coincidencia exacta por código o categoría del grupo
  let matchedGroup = catalogStore.grupos.find(g => 
    g.codigo.toLowerCase() === catClean ||
    g.categoria.toLowerCase() === catClean
  )

  // 2. Coincidencia por subcadena de categoría o código
  if (!matchedGroup) {
    matchedGroup = catalogStore.grupos.find(g => {
      const gCode = g.codigo.toLowerCase()
      const gCat = g.categoria.toLowerCase()
      return catClean.includes(gCat) || gCat.includes(catClean) || catClean.includes(gCode) || gCode.includes(catClean)
    })
  }

  // 3. Coincidencia semántica por palabras clave en nombre o código OEM
  if (!matchedGroup) {
    if (nameClean.includes('anillo') || catClean.includes('anillo') || oemClean.startsWith('rk-') || oemClean.includes('rik')) {
      matchedGroup = catalogStore.grupos.find(g => g.codigo === 'anillos_motor' || g.categoria.toLowerCase() === 'anillos')
    } else if (nameClean.includes('valvula') || catClean.includes('valvula')) {
      matchedGroup = catalogStore.grupos.find(g => g.codigo === 'valvula' || g.categoria.toLowerCase() === 'válvulas')
    } else if (nameClean.includes('sello') || nameClean.includes('retén') || nameClean.includes('reten') || catClean.includes('sello')) {
      matchedGroup = catalogStore.grupos.find(g => g.codigo === 'ajuste_valvula' || g.categoria.toLowerCase() === 'sellos')
    } else if (nameClean.includes('tornillo') || nameClean.includes('perno') || catClean.includes('perno')) {
      matchedGroup = catalogStore.grupos.find(g => g.codigo === 'tornillos_culata' || g.categoria.toLowerCase() === 'pernos')
    } else if (nameClean.includes('camisa') || catClean.includes('camisa')) {
      matchedGroup = catalogStore.grupos.find(g => g.codigo === 'camisas' || g.categoria.toLowerCase() === 'camisas')
    } else if (nameClean.includes('cojinete') || nameClean.includes('casquete') || catClean.includes('casquetería') || catClean.includes('casqueteria')) {
      matchedGroup = catalogStore.grupos.find(g => g.codigo === 'casqueteria' || g.categoria.toLowerCase() === 'casquetería')
    }
  }

  // 4. Coincidencia por nombre descriptivo
  if (!matchedGroup) {
    matchedGroup = catalogStore.grupos.find(g => g.nombre.toLowerCase().includes(catClean) || nameClean.includes(g.nombre.toLowerCase()))
  }

  matchedGroup = matchedGroup || catalogStore.grupos[0]

  if (matchedGroup) {
    selectedGroupCode.value = matchedGroup.codigo
  }

  // Cargar parámetros dinámicos y dimensiones
  const loadedParams: Record<string, any> = {
    ...(part.dimensiones || {}),
    ...(part.especificaciones_tecnicas || {})
  }

  if (part.diametro_cabeza_mm != null) loadedParams.diametro_cabeza_mm = part.diametro_cabeza_mm
  if (part.diametro_vastago_mm != null) loadedParams.diametro_vastago_mm = part.diametro_vastago_mm
  if (part.longitud_total_mm != null) loadedParams.longitud_total_mm = part.longitud_total_mm
  if (part.angulo_asiento_grados != null) loadedParams.angulo_asiento_grados = part.angulo_asiento_grados
  if (part.tipo_valvula != null) loadedParams.tipo_valvula = part.tipo_valvula

  if (part.diametro_interior_mm != null) loadedParams.diametro_interior_mm = part.diametro_interior_mm
  if (part.diametro_exterior_mm != null) loadedParams.diametro_exterior_mm = part.diametro_exterior_mm
  if (part.altura_mm != null) loadedParams.altura_mm = part.altura_mm

  if (part.diametro_cilindro_mm != null) loadedParams.diametro_cilindro_mm = part.diametro_cilindro_mm
  if (part.espesor_anillo1_mm != null) loadedParams.espesor_anillo1_mm = part.espesor_anillo1_mm
  if (part.espesor_anillo2_mm != null) loadedParams.espesor_anillo2_mm = part.espesor_anillo2_mm
  if (part.espesor_anillo3_mm != null) loadedParams.espesor_anillo3_mm = part.espesor_anillo3_mm
  if (part.espesor_aceite_mm != null) loadedParams.espesor_aceite_mm = part.espesor_aceite_mm

  // Desempaquetar array `anillos` de dimensiones si existe
  const ringItems = Array.isArray((part.dimensiones as any)?.anillos) ? (part.dimensiones as any).anillos : []
  const isPartConico = Boolean(
    part.diseno_conico ||
    (part.dimensiones as any)?.diseno_conico ||
    (part.especificaciones_tecnicas as any)?.diseno_conico ||
    (part.dimensiones as any)?.keystone
  )

  if (ringItems.length > 0) {
    if (loadedParams.diametro_cilindro_mm == null && ringItems[0]?.d1 != null) {
      loadedParams.diametro_cilindro_mm = ringItems[0].d1
    }
    ringRows.value = ringItems.map((ri: any, idx: number) => {
      const isLast = idx === ringItems.length - 1
      const tipoAro: 'fuego' | 'compresion' | 'aceite' = idx === 0 ? 'fuego' : (isLast ? 'aceite' : 'compresion')
      let perfil = ri.identificador || ri.perfil || ri.forma || ''
      if (!perfil) {
        if (idx === 0) perfil = isPartConico ? 'Cónico / Keystone' : 'Plano'
        else if (isLast) perfil = 'Estándar'
        else perfil = 'Plano'
      }
      const isCustomIdent = Boolean(
        ri.identificador ||
        (perfil && perfil !== 'Plano' && perfil !== 'Estándar')
      )
      const extraCols: Record<string, any> = {}
      if (ri && typeof ri === 'object') {
        for (const [k, v] of Object.entries(ri)) {
          if (!['id', 'posicion', 'tipo_aro', 'd1', 'h1', 'a1', 'perfil', 'forma', 'identificador'].includes(k)) {
            extraCols[k] = v
          }
        }
      }
      return {
        id: `ring-${idx}-${Date.now()}`,
        posicion: ri.posicion || getDefaultRowPosition(idx, ringItems.length, matchedGroup?.tabla_config),
        tipo_aro: tipoAro,
        h1: ri.h1 != null ? Number(ri.h1) : null,
        a1: ri.a1 != null ? Number(ri.a1) : null,
        perfil,
        tiene_identificador: isCustomIdent,
        identificador_texto: isCustomIdent ? (ri.identificador || (perfil.includes('Keystone') ? 'Cónico' : perfil)) : '',
        extra: extraCols
      }
    })
    hasThirdRing.value = ringRows.value.length >= 4
  } else {
    const has3 = (part.dimensiones as any)?.espesor_anillo3_mm != null || part.espesor_anillo3_mm != null
    const totalCount = has3 ? 4 : 3
    const builtRows: RingFormRow[] = [
      {
        id: 'ring-1',
        posicion: getDefaultRowPosition(0, totalCount, matchedGroup?.tabla_config),
        tipo_aro: 'fuego',
        h1: loadedParams.espesor_anillo1_mm ?? null,
        a1: (part.dimensiones as any)?.espesor_radial1_mm ?? (part.dimensiones as any)?.altura_radial1_mm ?? null,
        perfil: isPartConico ? 'Cónico / Keystone' : 'Plano',
        tiene_identificador: isPartConico,
        identificador_texto: isPartConico ? (matchedGroup?.tabla_config?.etiqueta_identificador || 'Cónico') : '',
        extra: {}
      },
      {
        id: 'ring-2',
        posicion: getDefaultRowPosition(1, totalCount, matchedGroup?.tabla_config),
        tipo_aro: 'compresion',
        h1: loadedParams.espesor_anillo2_mm ?? null,
        a1: (part.dimensiones as any)?.espesor_radial2_mm ?? (part.dimensiones as any)?.altura_radial2_mm ?? null,
        perfil: 'Plano',
        tiene_identificador: false,
        identificador_texto: '',
        extra: {}
      }
    ]
    if (has3) {
      builtRows.push({
        id: 'ring-3',
        posicion: getDefaultRowPosition(2, totalCount, matchedGroup?.tabla_config),
        tipo_aro: 'compresion',
        h1: loadedParams.espesor_anillo3_mm ?? (part.dimensiones as any)?.espesor_anillo3_mm ?? null,
        a1: (part.dimensiones as any)?.espesor_radial3_mm ?? (part.dimensiones as any)?.altura_radial3_mm ?? null,
        perfil: 'Plano',
        tiene_identificador: false,
        identificador_texto: '',
        extra: {}
      })
    }
    builtRows.push({
      id: 'ring-oil',
      posicion: getDefaultRowPosition(totalCount - 1, totalCount, matchedGroup?.tabla_config),
      tipo_aro: 'aceite',
      h1: loadedParams.espesor_aceite_mm ?? null,
      a1: (part.dimensiones as any)?.espesor_radial_aceite_mm ?? (part.dimensiones as any)?.altura_radial_aceite_mm ?? null,
      perfil: 'Estándar',
      tiene_identificador: false,
      identificador_texto: '',
      extra: {}
    })
    ringRows.value = builtRows
    hasThirdRing.value = ringRows.value.length >= 4
  }

  if (part.tipo_cojinete != null) loadedParams.tipo_cojinete = part.tipo_cojinete
  if (part.diametro_munon_mm != null) loadedParams.diametro_munon_mm = part.diametro_munon_mm
  if (part.diametro_alojamiento_mm != null) loadedParams.diametro_alojamiento_mm = part.diametro_alojamiento_mm
  if (part.ancho_casquete_mm != null) loadedParams.ancho_casquete_mm = part.ancho_casquete_mm

  if (part.medida_rosca != null) loadedParams.medida_rosca = part.medida_rosca
  if (part.paso_rosca_mm != null) loadedParams.paso_rosca_mm = part.paso_rosca_mm
  if (part.longitud_perno_mm != null) loadedParams.longitud_perno_mm = part.longitud_perno_mm
  if (part.cantidad_piezas != null) loadedParams.cantidad_piezas = part.cantidad_piezas

  // Cargar metadatos especiales para anillos (Keystone, Cilindros)
  loadedParams.diseno_conico = Boolean(
    part.diseno_conico ||
    (part.dimensiones as any)?.diseno_conico ||
    (part.especificaciones_tecnicas as any)?.diseno_conico ||
    (part.dimensiones as any)?.keystone
  )
  loadedParams.keystone = (part.dimensiones as any)?.keystone || (part.especificaciones_tecnicas as any)?.keystone || ''
  loadedParams.cilindros = (part.dimensiones as any)?.cilindros || null

  paramValues.value = loadedParams

  // Equivalencias
  if (part.equivalencias && part.equivalencias.length > 0) {
    equivalencias.value = part.equivalencias.map(eq => ({
      marca_alterna: eq.marca_alterna,
      codigo_alterno: eq.codigo_alterno,
      notas: eq.notas || ''
    }))
  } else {
    equivalencias.value = [{ marca_alterna: 'Dokuro', codigo_alterno: '', notas: '' }]
  }

  formErrors.value = {}
}

const formatRingVal = (val: number | null | undefined): string => {
  if (val == null || isNaN(val) || val === 0) return '—'
  return Number(val).toFixed(3).replace(/\.?0+$/, '')
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

    // Dimensiones dinámicas limpias preservando cotas preexistentes
    const prevDimensions = (editingPartId.value && props.editPart?.dimensiones) ? { ...(props.editPart.dimensiones as any) } : {}
    const dimensionesPayload: Record<string, any> = {
      ...prevDimensions
    }
    if (activeGroup.value) {
      for (const p of activeGroup.value.parametros) {
        const val = paramValues.value[p.clave]
        if (val !== undefined && val !== null && val !== '') {
          dimensionesPayload[p.clave] = p.tipo_dato === 'numero' ? Number(val) : val
        }
      }
    }

    // Sincronizar cotas radiales y array `anillos` para familias en tabla / anillos
    if (isRingsGroup.value) {
      const d = dimensionesPayload.diametro_cilindro_mm != null 
        ? Number(dimensionesPayload.diametro_cilindro_mm) 
        : (paramValues.value.diametro_cilindro_mm != null ? Number(paramValues.value.diametro_cilindro_mm) : (props.editPart?.diametro_cilindro_mm != null ? Number(props.editPart.diametro_cilindro_mm) : null))

      const serializedRings = ringRows.value.map((r, idx) => {
        const isOil = r.tipo_aro === 'aceite' || idx === ringRows.value.length - 1
        const finalPos = (r.posicion && r.posicion.trim())
          ? r.posicion.trim()
          : getDefaultRowPosition(idx, ringRows.value.length)
        const finalIdent = r.tiene_identificador
          ? (r.identificador_texto?.trim() || activeTablaConfig.value.etiqueta_identificador || 'Cónico')
          : ''
        const finalPerfil = finalIdent || r.perfil || (isOil ? 'Estándar' : 'Plano')
        return {
          ...(r.extra || {}),
          posicion: finalPos,
          tipo_aro: isOil ? 'aceite' : (idx === 0 ? 'fuego' : 'compresion'),
          d1: d,
          h1: r.h1 != null && !isNaN(Number(r.h1)) ? Number(r.h1) : null,
          a1: r.a1 != null && !isNaN(Number(r.a1)) ? Number(r.a1) : null,
          perfil: finalPerfil,
          forma: finalPerfil,
          identificador: finalIdent || undefined
        }
      })

      // También sincronizar las columnas extra de la 1ra fila en dimensionesPayload para filtros dimensionales
      for (const extParam of extraRingGroupParams.value) {
        const rowVal = ringRows.value[0]?.extra?.[extParam.clave]
        if (rowVal !== undefined && rowVal !== null && rowVal !== '' && dimensionesPayload[extParam.clave] === undefined) {
          dimensionesPayload[extParam.clave] = extParam.tipo_dato === 'numero' ? Number(rowVal) : rowVal
        }
      }

      const r1 = serializedRings[0]
      const rOil = serializedRings[serializedRings.length - 1]
      const r2 = serializedRings.length >= 3 ? serializedRings[1] : null
      const r3 = serializedRings.length >= 4 ? serializedRings[2] : null

      dimensionesPayload.diametro_cilindro_mm = d
      dimensionesPayload.espesor_anillo1_mm = r1?.h1 ?? null
      dimensionesPayload.espesor_anillo2_mm = r2?.h1 ?? null
      dimensionesPayload.espesor_aceite_mm = rOil?.h1 ?? null
      dimensionesPayload.anillos = serializedRings

      if (r3?.h1 != null) {
        dimensionesPayload.espesor_anillo3_mm = r3.h1
        if (r3.a1 != null) {
          dimensionesPayload.espesor_radial3_mm = r3.a1
          dimensionesPayload.altura_radial3_mm = r3.a1
        }
      } else {
        delete dimensionesPayload.espesor_anillo3_mm
        delete dimensionesPayload.espesor_radial3_mm
        delete dimensionesPayload.altura_radial3_mm
      }

      if (r1?.a1 != null) {
        dimensionesPayload.espesor_radial1_mm = r1.a1
        dimensionesPayload.altura_radial1_mm = r1.a1
      }
      if (r2?.a1 != null) {
        dimensionesPayload.espesor_radial2_mm = r2.a1
        dimensionesPayload.altura_radial2_mm = r2.a1
      }
      if (rOil?.a1 != null) {
        dimensionesPayload.espesor_radial_aceite_mm = rOil.a1
        dimensionesPayload.altura_radial_aceite_mm = rOil.a1
      }

      const anyConico = serializedRings.some(r =>
        (r.perfil || '').toLowerCase().includes('cónico') ||
        (r.perfil || '').toLowerCase().includes('conico') ||
        (r.perfil || '').toLowerCase().includes('keystone')
      )

      if (anyConico || paramValues.value.diseno_conico) {
        dimensionesPayload.diseno_conico = true
        const conicoLabels = serializedRings
          .map((r, i) => ((r.perfil || '').toLowerCase().includes('cónico') || (r.perfil || '').toLowerCase().includes('keystone')) ? `${i + 1}°=${r.perfil}` : null)
          .filter(Boolean)
        dimensionesPayload.keystone = conicoLabels.length > 0 ? conicoLabels.join(', ') : (paramValues.value.keystone || 'KEYSTONE')
      } else {
        delete dimensionesPayload.diseno_conico
        delete dimensionesPayload.keystone
      }

      if (paramValues.value.cilindros && Number(paramValues.value.cilindros) > 0) {
        dimensionesPayload.cilindros = Number(paramValues.value.cilindros)
      } else {
        delete dimensionesPayload.cilindros
      }
    }

    normalizeOemInputs()
    const allMainTokens = partCodigoOem.value
      .split(/[,\/;|\n]+/)
      .map(c => c.trim().toUpperCase())
      .filter(Boolean)
    const primaryOemClean = allMainTokens[0] || partCodigoOem.value.trim().toUpperCase()
    const extraFromMain = allMainTokens.slice(1)

    const extraFlat: string[] = []
    for (const item of partCodigosOemAdicionales.value) {
      extraFlat.push(...String(item || '').split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean))
    }
    const codigosOemAdicionalesClean = Array.from(
      new Set([...extraFromMain, ...extraFlat].filter(c => c && c !== primaryOemClean))
    )
    dimensionesPayload.codigos_oem_adicionales = codigosOemAdicionalesClean

    const prevSpec = (editingPartId.value && props.editPart?.especificaciones_tecnicas)
      ? { ...(props.editPart.especificaciones_tecnicas as Record<string, unknown>) }
      : {}
    const especificacionesPayload: Record<string, unknown> = {
      ...prevSpec,
      codigos_oem_adicionales: codigosOemAdicionalesClean
    }

    const partPayload = {
      motor_id: partMotorId.value || undefined,
      codigo_oem: primaryOemClean,
      codigos_oem_adicionales: codigosOemAdicionalesClean,
      nombre: partNombre.value.trim(),
      subsistema: partSubsistema.value,
      categoria: activeGroup.value?.categoria || 'General',
      precio: Number(partPrecio.value || 0),
      stock: Number(partStock.value || 0),
      estado: partEstado.value,
      catalogo_origen: partCatalogoOrigen.value,
      imagen_url: partImagenUrl.value ? partImagenUrl.value.trim() : undefined,
      dimensiones: dimensionesPayload,
      especificaciones_tecnicas: especificacionesPayload,
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
      espesor_anillo3_mm: dimensionesPayload.espesor_anillo3_mm ?? null,
      espesor_aceite_mm: dimensionesPayload.espesor_aceite_mm || dimensionesPayload.espesor_aceite,
      medida_rosca: dimensionesPayload.medida_rosca,
      paso_rosca_mm: dimensionesPayload.paso_rosca_mm,
      longitud_perno_mm: dimensionesPayload.longitud_perno_mm,
      cantidad_piezas: dimensionesPayload.cantidad_piezas
    }

    if (isEditPartMode.value && editingPartId.value) {
      const updated = await catalogStore.updateRepuesto(
        editingPartId.value,
        partPayload,
        validEquivs
      )
      emit('part-updated', updated)
    } else {
      const created = await catalogStore.createRepuesto(
        partPayload,
        validEquivs
      )
      emit('part-created', created)
    }

    resetPartForm()
    emit('close')
  } catch (err: unknown) {
    console.error('Error al guardar repuesto:', err)
    saveErrorMessage.value = 'Ocurrió un error al guardar el repuesto: ' + (err instanceof Error ? err.message : String(err))
  } finally {
    isSubmittingPart.value = false
  }
}

const resetPartForm = () => {
  isEditPartMode.value = false
  editingPartId.value = null
  partCodigoOem.value = ''
  partCodigosOemAdicionales.value = []
  partNombre.value = ''
  partSubsistema.value = activeGroup.value?.subsistema || 'Block'
  partMotorId.value = ''
  motorSearchQuery.value = ''
  isMotorDropdownOpen.value = false
  partPrecio.value = null
  partStock.value = 12
  partEstado.value = 'Disponible'
  partCatalogoOrigen.value = 'OEM'
  partImagenUrl.value = ''
  paramValues.value = {}
  formErrors.value = {}
  hasThirdRing.value = false
  ringRows.value = createDefaultRingRows()
  saveErrorMessage.value = ''
  equivalencias.value = [{ marca_alterna: 'Dokuro', codigo_alterno: '', notas: '' }]
}

// =============================================================================
// TAB 2: CONSTRUCTOR DINÁMICO DE FAMILIAS / GRUPOS DE PIEZAS Y PARÁMETROS (WORKBENCH)
// =============================================================================
export interface DynamicParamRow {
  id: string
  etiqueta: string
  etiqueta_corta?: string
  clave: string
  unidad: string
  tipo_dato: 'numero' | 'texto' | 'booleano' | 'seleccion'
  requerido: boolean
  filtrable?: boolean
  descripcion: string
  opciones?: string[]
  opcionesStr?: string
  decimales?: number
  mostrar_unidad?: boolean
  valor_muestra?: string | number
}

const isEditMode = ref<boolean>(false)
const editingGroupId = ref<string | null>(null)
const selectedEditGroupId = ref<string>('')

const groupNombre = ref<string>('')
const groupCategoria = ref<string>('')
const groupSubsistema = ref<string>('') // Opcional
const groupDescripcion = ref<string>('')
const groupIcono = ref<string>('Layers')
const groupTipoVista = ref<'normal' | 'tabla'>('normal')
const soloFiltrosEnTabla = ref<boolean>(false)

const getDefaultTablaConfig = (): TablaConfiguracion => ({
  titulo_primera_columna: 'Anillo',
  modo_filas: 'incremental',
  usar_prefijo_titulo: true,
  etiqueta_ultima_fila: 'Anillo de aceite',
  habilitar_identificador: true,
  etiqueta_identificador: 'Cónico'
})

const groupTablaConfig = ref<TablaConfiguracion>(getDefaultTablaConfig())

const getDefaultTableParams = (): DynamicParamRow[] => [
  {
    id: `param-${Date.now()}-t1`,
    etiqueta: 'Diámetro',
    etiqueta_corta: 'Diámetro',
    clave: 'diametro_cilindro_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true,
    descripcion: 'Diámetro nominal en mm',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 96.00
  },
  {
    id: `param-${Date.now()}-t2`,
    etiqueta: 'Grosor',
    etiqueta_corta: 'Grosor',
    clave: 'grosor_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true,
    descripcion: 'Espesor axial de cada fila en mm',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 2.00
  },
  {
    id: `param-${Date.now()}-t3`,
    etiqueta: 'Altura',
    etiqueta_corta: 'Altura',
    clave: 'altura_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true,
    descripcion: 'Altura o ancho radial de cada fila en mm',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 3.80
  }
]

const getDefaultNormalParams = (): DynamicParamRow[] => [
  {
    id: `param-${Date.now()}-1`,
    etiqueta: 'Diámetro Interior',
    etiqueta_corta: 'Ø Int.',
    clave: 'diametro_interior_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true,
    descripcion: 'Medida del diámetro interno de la pieza',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 45.00
  },
  {
    id: `param-${Date.now()}-2`,
    etiqueta: 'Diámetro Exterior',
    etiqueta_corta: 'Ø Ext.',
    clave: 'diametro_exterior_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true,
    descripcion: 'Medida del diámetro externo o de alojamiento',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 52.00
  },
  {
    id: `param-${Date.now()}-3`,
    etiqueta: 'Longitud Total',
    etiqueta_corta: 'Long.',
    clave: 'longitud_total_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: false,
    filtrable: false,
    descripcion: 'Largo total o altura en milímetros',
    decimales: 1,
    mostrar_unidad: true,
    valor_muestra: 110.5
  }
]

const setGroupTipoVista = (tipo: 'normal' | 'tabla') => {
  if (groupTipoVista.value === tipo) return
  groupTipoVista.value = tipo
  if (!isEditMode.value) {
    const keys = dynamicParams.value.map(p => p.clave)
    const isDefaultNormal = keys.length === 3 && keys.includes('diametro_interior_mm') && keys.includes('diametro_exterior_mm')
    const isDefaultTable = keys.includes('grosor_mm') || keys.includes('anillo1_h1')
    if (tipo === 'tabla' && isDefaultNormal) {
      dynamicParams.value = getDefaultTableParams()
      groupTablaConfig.value = getDefaultTablaConfig()
    } else if (tipo === 'normal' && isDefaultTable) {
      dynamicParams.value = getDefaultNormalParams()
    }
  }
}

// --- Creatable Combobox para Subsistema (Opcional, Inline, Cero Modales) ---
const availableSubsistemas = ref<string[]>([
  'Block',
  'Culata',
  'Cigüeñal',
  'Bielas',
  'Sellos y Juntas',
  'Distribución',
  'Admisión y Escape',
  'Lubricación',
  'Refrigeración',
  'Inyección y Combustible',
  'Sobrealimentación'
])
const isSubsistemaOpen = ref(false)
const subsistemaSearch = ref('')

const filteredSubsistemas = computed(() => {
  const q = subsistemaSearch.value.trim().toLowerCase()
  if (!q) return availableSubsistemas.value
  return availableSubsistemas.value.filter(s => s.toLowerCase().includes(q))
})

const isCustomSubsistemaCandidate = computed(() => {
  const q = subsistemaSearch.value.trim()
  if (!q) return false
  return !availableSubsistemas.value.some(s => s.toLowerCase() === q.toLowerCase())
})

const handleSelectSubsistema = (sub: string) => {
  groupSubsistema.value = sub
  subsistemaSearch.value = sub
  isSubsistemaOpen.value = false
}

const handleClearSubsistema = () => {
  groupSubsistema.value = ''
  subsistemaSearch.value = ''
  isSubsistemaOpen.value = false
}

const handleCreateAndSelectSubsistema = () => {
  const clean = subsistemaSearch.value.trim()
  if (!clean) return
  if (!availableSubsistemas.value.some(s => s.toLowerCase() === clean.toLowerCase())) {
    availableSubsistemas.value.push(clean)
  }
  groupSubsistema.value = clean
  isSubsistemaOpen.value = false
}

// --- Generador de Clave Técnica Inmutable (ReadOnly) ---
const generateTechnicalKey = (label: string, unit: string): string => {
  const slug = label
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!slug) return 'cota_param'
  if (unit === 'mm') {
    return slug.endsWith('_mm') ? slug : `${slug}_mm`
  }
  return slug
}

const handleParamLabelChange = (param: DynamicParamRow) => {
  if (!isEditMode.value || !param.clave || param.clave.startsWith('medida_') || param.clave.startsWith('param_')) {
    param.clave = generateTechnicalKey(param.etiqueta, param.unidad)
  }
  if (!param.etiqueta_corta || param.etiqueta_corta === param.etiqueta) {
    param.etiqueta_corta = param.etiqueta
  }
}

const handleParamUnitChange = (param: DynamicParamRow) => {
  if (!isEditMode.value || !param.clave || param.clave.startsWith('medida_') || param.clave.startsWith('param_')) {
    param.clave = generateTechnicalKey(param.etiqueta, param.unidad)
  }
}

// Lista dinámica de parámetros
const dynamicParams = ref<DynamicParamRow[]>([
  {
    id: `param-${Date.now()}-1`,
    etiqueta: 'Diámetro Interior',
    etiqueta_corta: 'Ø Int.',
    clave: 'diametro_interior_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    descripcion: 'Medida del diámetro interno de la pieza',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 45.00
  },
  {
    id: `param-${Date.now()}-2`,
    etiqueta: 'Diámetro Exterior',
    etiqueta_corta: 'Ø Ext.',
    clave: 'diametro_exterior_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    descripcion: 'Medida del diámetro externo o de alojamiento',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 52.00
  },
  {
    id: `param-${Date.now()}-3`,
    etiqueta: 'Longitud Total',
    etiqueta_corta: 'Long.',
    clave: 'longitud_total_mm',
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: false,
    descripcion: 'Largo total o altura en milímetros',
    decimales: 1,
    mostrar_unidad: true,
    valor_muestra: 110.5
  }
])

const groupErrors = ref<Record<string, string>>({})
const isSubmittingGroup = ref(false)

const loadGroupForEditing = (grp: GrupoRepuesto) => {
  isEditMode.value = true
  editingGroupId.value = grp.codigo || grp.id
  selectedEditGroupId.value = grp.codigo || grp.id
  groupNombre.value = grp.nombre
  groupCategoria.value = grp.categoria
  groupSubsistema.value = grp.subsistema || ''
  subsistemaSearch.value = grp.subsistema || ''
  if (grp.subsistema && !availableSubsistemas.value.includes(grp.subsistema)) {
    availableSubsistemas.value.push(grp.subsistema)
  }
  groupDescripcion.value = grp.descripcion || ''
  groupIcono.value = grp.icono || 'Layers'
  groupTipoVista.value = grp.tipo_vista || (grp.codigo === 'anillos_motor' ? 'tabla' : 'normal')
  groupTablaConfig.value = grp.tabla_config
    ? { ...getDefaultTablaConfig(), ...grp.tabla_config }
    : getDefaultTablaConfig()

  const nonReqParams = grp.parametros.filter(p => !p.requerido)
  if (nonReqParams.length > 0) {
    soloFiltrosEnTabla.value = nonReqParams.some(p => p.filtrable === false)
  } else {
    soloFiltrosEnTabla.value = false
  }

  dynamicParams.value = grp.parametros.map((p, idx) => ({
    id: p.id || `param-${Date.now()}-${idx}`,
    etiqueta: p.etiqueta,
    etiqueta_corta: p.etiqueta_corta || p.etiqueta,
    clave: p.clave,
    unidad: p.unidad,
    tipo_dato: p.tipo_dato,
    requerido: p.requerido,
    filtrable: p.filtrable !== undefined ? p.filtrable : (p.requerido ? true : (soloFiltrosEnTabla.value ? false : true)),
    descripcion: p.descripcion || '',
    opciones: p.opciones || [],
    opcionesStr: (p.opciones || []).join(', '),
    decimales: p.unidad === '°' ? 0 : 2,
    mostrar_unidad: true,
    valor_muestra: p.valor_minimo || (50 + idx * 5)
  }))
  groupErrors.value = {}
}

const switchToCreateMode = () => {
  isEditMode.value = false
  editingGroupId.value = null
  selectedEditGroupId.value = ''
  groupNombre.value = ''
  groupCategoria.value = ''
  groupSubsistema.value = ''
  subsistemaSearch.value = ''
  groupDescripcion.value = ''
  groupIcono.value = 'Layers'
  groupTipoVista.value = 'normal'
  groupTablaConfig.value = getDefaultTablaConfig()
  soloFiltrosEnTabla.value = false
  dynamicParams.value = getDefaultNormalParams()
  groupErrors.value = {}
}

const switchToEditMode = (groupId?: string) => {
  isEditMode.value = true
  const targetId = groupId || selectedGroupCode.value || props.editGroupId || props.preselectedGroupId || selectedEditGroupId.value
  if (targetId) {
    const grp = resolveGroupByTarget(targetId)
    if (grp) {
      loadGroupForEditing(grp)
      return
    }
  }
  if (catalogStore.grupos.length > 0) {
    loadGroupForEditing(catalogStore.grupos[0])
  }
}

const openFamilyTabForCurrentContext = () => {
  const targetGroupCode = selectedGroupCode.value || props.editGroupId || props.preselectedGroupId || selectedEditGroupId.value
  if (targetGroupCode) {
    switchToEditMode(targetGroupCode)
  }
  activeTab.value = 'grupo'
}

const onSelectEditGroup = () => {
  if (!selectedEditGroupId.value) {
    switchToCreateMode()
    return
  }
  const grp = catalogStore.grupos.find(g => g.codigo === selectedEditGroupId.value || g.id === selectedEditGroupId.value)
  if (grp) {
    loadGroupForEditing(grp)
  }
}

const addParamRow = () => {
  const count = dynamicParams.value.length + 1
  const defaultLabel = `Medida ${count}`
  const defaultUnit = 'mm'
  dynamicParams.value.push({
    id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    etiqueta: defaultLabel,
    etiqueta_corta: defaultLabel,
    clave: generateTechnicalKey(defaultLabel, defaultUnit),
    unidad: defaultUnit,
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true,
    descripcion: '',
    decimales: 2,
    mostrar_unidad: true,
    valor_muestra: 50.00
  })
}

const removeParamRow = (index: number) => {
  dynamicParams.value.splice(index, 1)
}

const handleSoloFiltrosChange = () => {
  if (soloFiltrosEnTabla.value) {
    dynamicParams.value.forEach(p => {
      if (!p.requerido) {
        p.filtrable = false
      }
    })
  } else {
    dynamicParams.value.forEach(p => {
      p.filtrable = true
    })
  }
}

const toggleParamRequerido = (param: DynamicParamRow) => {
  param.requerido = !param.requerido
  if (soloFiltrosEnTabla.value) {
    param.filtrable = param.requerido
  }
}

const toggleParamFiltrable = (param: DynamicParamRow) => {
  if (soloFiltrosEnTabla.value && !param.requerido) {
    return
  }
  param.filtrable = !(param.filtrable !== false)
}

const isParamFilterVisible = (param: DynamicParamRow): boolean => {
  if (soloFiltrosEnTabla.value) {
    return Boolean(param.requerido && param.filtrable !== false)
  }
  return param.filtrable !== false
}

// --- Live Preview: Visibilidad y Formato de Celdas ---
const visibleTableColumns = computed(() => {
  return dynamicParams.value.filter(p => p.requerido)
})

const getPreviewRowLabel = (rowIdx: number): string => {
  const cfg = groupTablaConfig.value
  const titulo = (cfg.titulo_primera_columna || 'Anillo').trim()
  if (rowIdx === 2 && cfg.etiqueta_ultima_fila && cfg.etiqueta_ultima_fila.trim()) {
    return cfg.etiqueta_ultima_fila.trim()
  }
  if (cfg.modo_filas === 'incremental') {
    return cfg.usar_prefijo_titulo !== false ? `${titulo} ${rowIdx + 1}` : `${rowIdx + 1}`
  }
  const letters = ['A', 'B', 'C']
  return `${titulo} ${letters[rowIdx] || rowIdx + 1}`
}

const getPreviewTableCellValue = (param: DynamicParamRow, partIdx: number, ringIdx: number): string => {
  const key = (param.clave || '').toLowerCase()
  const label = (param.etiqueta_corta || param.etiqueta || '').toLowerCase()
  if (key.includes('diametro') || label.includes('diámetro') || label.includes('diametro')) {
    return partIdx === 0 ? '96' : '96.5'
  }
  if (key.includes('grosor') || key.includes('espesor') || key.endsWith('_h1') || label.includes('grosor')) {
    return ringIdx === 2 ? '3' : '2'
  }
  if (key.includes('altura') || key.includes('radial') || key.endsWith('_a1') || label.includes('altura')) {
    return ringIdx === 0 ? '3.8' : (ringIdx === 1 ? '4.1' : '3.4')
  }
  if (param.tipo_dato === 'booleano') {
    return ringIdx === 0 ? 'Sí' : 'No'
  }
  if (param.tipo_dato === 'seleccion') {
    const opts = param.opcionesStr ? param.opcionesStr.split(',').map(s => s.trim()).filter(Boolean) : (param.opciones || [])
    return opts.length > 0 ? opts[ringIdx % opts.length] : 'STD'
  }
  if (param.tipo_dato === 'texto') {
    return ringIdx === 0 ? 'Cromo' : 'Hierro'
  }
  const baseVal = param.valor_muestra != null && param.valor_muestra !== '' ? Number(param.valor_muestra) : 10
  return String(Number((baseVal + ringIdx * 0.5).toFixed(2)))
}

const cycleDecimals = (param: DynamicParamRow) => {
  if (param.decimales === undefined || param.decimales === 2) {
    param.decimales = 1
  } else if (param.decimales === 1) {
    param.decimales = 0
  } else {
    param.decimales = 2
  }
}

const formatSampleValue = (param: DynamicParamRow, rowIdx: number = 0): string => {
  if (param.tipo_dato === 'booleano') {
    return rowIdx === 0 ? 'Sí (STD)' : 'No (Cónico)'
  }
  if (param.tipo_dato === 'seleccion') {
    const opts = param.opcionesStr ? param.opcionesStr.split(',').map(s => s.trim()).filter(Boolean) : (param.opciones || [])
    if (opts.length > 0) {
      return opts[rowIdx % opts.length]
    }
    return rowIdx === 0 ? 'Admisión' : 'Escape'
  }
  if (param.tipo_dato === 'texto') {
    return rowIdx === 0 ? 'M10×1.25' : 'M12×1.50'
  }
  let raw = param.valor_muestra != null && param.valor_muestra !== '' ? Number(param.valor_muestra) : (rowIdx === 0 ? 85.50 : 92.25)
  if (isNaN(raw)) raw = 0
  if (rowIdx === 1) {
    raw = raw + 2.5
  }
  const dec = param.decimales !== undefined ? param.decimales : 2
  const numStr = raw.toFixed(dec)
  const showUnit = param.mostrar_unidad !== false
  return showUnit && param.unidad ? `${numStr} ${param.unidad}` : numStr
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
    const paramsPayload: ParametroTecnicoDefinicion[] = dynamicParams.value.map(p => {
      let parsedOpciones: string[] | undefined = undefined
      if (p.tipo_dato === 'seleccion') {
        if (p.opcionesStr && p.opcionesStr.trim()) {
          parsedOpciones = p.opcionesStr.split(',').map(s => s.trim()).filter(Boolean)
        } else if (p.opciones && p.opciones.length > 0) {
          parsedOpciones = p.opciones
        }
      }
      return {
        id: p.id,
        clave: p.clave.trim(),
        etiqueta: p.etiqueta.trim(),
        etiqueta_corta: p.etiqueta_corta ? p.etiqueta_corta.trim() : undefined,
        unidad: p.unidad.trim(),
        tipo_dato: p.tipo_dato,
        requerido: p.requerido,
        filtrable: soloFiltrosEnTabla.value ? (p.requerido && p.filtrable !== false) : (p.filtrable !== false),
        descripcion: p.descripcion.trim() || undefined,
        opciones: parsedOpciones
      }
    })

    if (isEditMode.value && editingGroupId.value) {
      const updated = await catalogStore.updateGrupo(editingGroupId.value, {
        nombre: groupNombre.value.trim(),
        categoria: groupCategoria.value.trim() || groupNombre.value.trim(),
        subsistema: groupSubsistema.value,
        descripcion: groupDescripcion.value.trim() || undefined,
        icono: groupIcono.value,
        tipo_vista: groupTipoVista.value,
        tabla_config: groupTipoVista.value === 'tabla' ? { ...groupTablaConfig.value } : undefined,
        parametros: paramsPayload
      })

      emit('group-updated', updated)
      emit('close')
    } else {
      const created = await catalogStore.createGrupo({
        nombre: groupNombre.value.trim(),
        categoria: groupCategoria.value.trim() || groupNombre.value.trim(),
        subsistema: groupSubsistema.value,
        descripcion: groupDescripcion.value.trim() || undefined,
        icono: groupIcono.value,
        tipo_vista: groupTipoVista.value,
        tabla_config: groupTipoVista.value === 'tabla' ? { ...groupTablaConfig.value } : undefined,
        parametros: paramsPayload
      })

      emit('group-created', created)
      emit('close')
    }
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
    <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden">
      
      <!-- ===================================================================== -->
      <!-- MODAL HEADER CON PESTAÑAS SEGMENTADAS                                 -->
      <!-- ===================================================================== -->
      <div class="px-5 sm:px-7 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
            <SlidersHorizontal class="w-5 h-5 text-[#04C4D9] shrink-0" />
            <template v-if="isEditPartMode">
              <span>Editar Repuesto:</span>
              <span class="font-mono text-xs sm:text-sm bg-cyan-50 text-[#004B97] border border-cyan-200 px-2.5 py-0.5 rounded-lg">
                {{ partCodigoOem || props.editPart?.codigo_oem || 'Repuesto' }}
              </span>
            </template>
            <template v-else-if="props.editGroupId || (isEditMode && activeTab === 'grupo')">
              <span>Editar Familia:</span>
              <span class="text-xs sm:text-sm bg-cyan-50 text-[#004B97] border border-cyan-200 px-2.5 py-0.5 rounded-lg">
                {{ groupNombre || 'Familia' }}
              </span>
            </template>
            <template v-else>
              <span>{{ activeTab === 'repuesto' ? 'Nuevo Repuesto' : 'Nueva Familia' }}</span>
            </template>
          </h2>
        </div>

        <!-- Indicador contextual exclusivo si se está editando una pieza o una familia (sin pestañas distractoras) -->
        <div v-if="isEditPartMode" class="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-xl text-xs font-bold text-[#038391] shrink-0">
          <Edit3 class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>Edición de Repuesto</span>
        </div>
        <div v-else-if="props.editGroupId || (isEditMode && activeTab === 'grupo')" class="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-xl text-xs font-bold text-[#038391] shrink-0">
          <Edit3 class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>Edición de Familia Técnica</span>
        </div>
        <!-- Selector de pestañas segmentado (solo en creación general) -->
        <div v-else class="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl shrink-0 self-start sm:self-auto">
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
            <span>Repuesto</span>
          </button>

          <button
            type="button"
            @click="openFamilyTabForCurrentContext"
            :class="[
              'px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5',
              activeTab === 'grupo' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <FolderPlus class="w-4 h-4 text-[#04C4D9]" />
            <span>Familia</span>
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
      <div class="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-slate-800">

        <!-- ----------------------------------------------------------------- -->
        <!-- PESTAÑA 1: FORMULARIO REACTIVO DE ALTA / EDICIÓN DE REPUESTO     -->
        <!-- ----------------------------------------------------------------- -->
        <div v-if="activeTab === 'repuesto'" class="space-y-4">

          <!-- Banner Informativo si está editando un repuesto existente -->
          <div v-if="isEditPartMode" class="bg-cyan-50/80 border border-cyan-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-cyan-100 text-[#038391] flex items-center justify-center shrink-0">
                <Edit3 class="w-3.5 h-3.5" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-black text-[#004B97] truncate">
                  Editando Repuesto: <span class="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-cyan-200">{{ partCodigoOem || editingPartId }}</span>
                </p>
              </div>
            </div>
          </div>

          <!-- ARQUITECTURA SPLIT-VIEW (2 COLUMNAS EN ESCRITORIO) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            <!-- ============================================================= -->
            <!-- COLUMNA IZQUIERDA: FAMILIA, IDENTIFICACIÓN, MOTOR Y COMERCIAL -->
            <!-- ============================================================= -->
            <div class="lg:col-span-5 space-y-3.5">

              <!-- 1. Familia Técnica (Selector Compacto de Alta Densidad) -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#04C4D9]"></span>
                    <span>Familia Técnica</span>
                  </label>
                  <button
                    v-if="!isEditPartMode"
                    type="button"
                    @click="openFamilyTabForCurrentContext"
                    class="text-[10px] font-bold text-[#038391] hover:text-[#004B97] transition"
                  >
                    + Gestionar Familias
                  </button>
                </div>

                <!-- Si está editando una pieza, mostrar la familia asignada fija -->
                <div v-if="isEditPartMode" class="flex items-center justify-between p-2.5 bg-white border border-cyan-200 rounded-xl shadow-2xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#04C4D9] shrink-0"></span>
                    <span class="text-xs font-bold text-slate-900 truncate">{{ activeGroup?.nombre || 'Familia asignada' }}</span>
                    <span class="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold shrink-0">
                      {{ activeGroup?.parametros?.length || 0 }} parámetros
                    </span>
                  </div>
                  <span class="text-[10px] font-bold text-[#004B97] bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 shrink-0">
                    {{ activeGroup?.subsistema || 'Block' }}
                  </span>
                </div>

                <div v-else class="grid grid-cols-2 gap-1.5">
                  <button
                    v-for="grp in catalogStore.grupos"
                    :key="grp.id"
                    type="button"
                    @click="selectedGroupCode = grp.codigo"
                    :class="[
                      'px-2.5 py-2 rounded-xl border text-left transition flex items-center justify-between gap-1.5',
                      selectedGroupCode === grp.codigo
                        ? 'border-[#004B97] bg-white ring-2 ring-[#004B97]/15 shadow-2xs'
                        : 'border-slate-200 bg-white/60 hover:bg-white text-slate-700'
                    ]"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span 
                        class="w-2 h-2 rounded-full shrink-0" 
                        :class="selectedGroupCode === grp.codigo ? 'bg-[#04C4D9]' : 'bg-slate-300'"
                      ></span>
                      <span class="text-xs font-bold text-slate-900 truncate">{{ grp.nombre }}</span>
                    </div>
                    <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono shrink-0">
                      {{ grp.parametros.length }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- 2. Bloque A: Códigos Originales del Fabricante (OEM) e Identificación -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Tag class="w-3.5 h-3.5 text-[#004B97]" />
                    <span>Códigos Originales del Fabricante (OEM)</span>
                  </h3>
                  <button
                    type="button"
                    @click="addCodigoOemAdicional"
                    class="text-[10px] font-extrabold text-[#004B97] hover:text-[#038391] flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-cyan-200 shadow-2xs transition shrink-0"
                  >
                    <Plus class="w-3 h-3 text-[#04C4D9]" />
                    <span>+ Agregar Código</span>
                  </button>
                </div>

                <!-- Código OEM Principal + Adicionales y Nombre -->
                <div class="space-y-2.5">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-bold text-slate-700">
                        Código OEM Principal <span class="text-rose-600 font-black">*</span>
                      </label>
                      <span class="text-[9px] text-[#004B97] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-mono font-bold">OEM #1</span>
                    </div>
                    <input
                      v-model="partCodigoOem"
                      @input="onPrimaryOemInput"
                      @blur="normalizeOemInputs"
                      type="text"
                      placeholder="Código OEM"
                      class="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white border rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                      :class="formErrors.partCodigoOem ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                    />
                    <span v-if="formErrors.partCodigoOem" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                      {{ formErrors.partCodigoOem }}
                    </span>
                  </div>

                  <!-- Listado dinámico de Códigos OEM Adicionales -->
                  <div v-if="partCodigosOemAdicionales.length > 0" class="space-y-1.5 pt-0.5">
                    <div
                      v-for="(_, oemIdx) in partCodigosOemAdicionales"
                      :key="oemIdx"
                      class="flex items-center gap-1.5"
                    >
                      <span class="text-[9px] font-mono font-extrabold text-[#004B97] bg-blue-50 border border-blue-200 px-2 py-1.5 rounded-lg shrink-0">
                        OEM #{{ oemIdx + 2 }}
                      </span>
                      <input
                        v-model="partCodigosOemAdicionales[oemIdx]"
                        @input="handleAdditionalOemInput(oemIdx)"
                        @blur="normalizeOemInputs"
                        type="text"
                        placeholder="Código adicional"
                        class="flex-1 px-2.5 py-1.5 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                      />
                      <button
                        type="button"
                        @click="removeCodigoOemAdicional(oemIdx)"
                        class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                        title="Quitar código adicional"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <!-- Cuadritos detectados en vivo (mismo color para todos) -->
                  <div v-if="allOemCodesPreview.length > 0" class="flex flex-wrap items-center gap-1.5 pt-1">
                    <span
                      v-for="(codeToken, cIdx) in allOemCodesPreview"
                      :key="`preview-oem-${cIdx}`"
                      class="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-900 shadow-2xs"
                    >
                      {{ codeToken }}
                    </span>
                  </div>

                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">
                      Nombre o Descripción Técnica <span class="text-rose-600 font-black">*</span>
                    </label>
                    <input
                      v-model="partNombre"
                      type="text"
                      placeholder="Nombre o descripción"
                      class="w-full px-3 py-1.5 text-xs font-bold bg-white border rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                      :class="formErrors.partNombre ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                    />
                    <span v-if="formErrors.partNombre" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                      {{ formErrors.partNombre }}
                    </span>
                  </div>
                </div>

                <!-- Motor Asociado (Buscador reactivo con autocompletado) -->
                <div class="relative combobox-motor-asociado pt-1">
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-[11px] font-bold text-slate-700">
                      Motor Asociado (Opcional)
                    </label>
                    <span v-if="selectedMotor" class="text-[10px] font-bold text-[#038896] bg-cyan-50 px-2 py-0.2 rounded-full border border-cyan-200">
                      {{ selectedMotor.codigo }} ({{ getBrandName(selectedMotor.fabricante_id) }})
                    </span>
                    <span v-else class="text-[10px] font-medium text-slate-400">
                      Universal
                    </span>
                  </div>

                  <div class="relative flex items-center">
                    <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                    <input
                      v-model="motorSearchQuery"
                      type="text"
                      placeholder="Buscar motor..."
                      @focus="onMotorFocus"
                      @input="onMotorInput"
                      class="w-full pl-8 pr-12 py-1.5 text-xs font-bold bg-white border rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                      :class="selectedMotor ? 'border-cyan-300 bg-cyan-50/10' : 'border-slate-300'"
                    />

                    <div class="absolute right-1.5 flex items-center gap-0.5">
                      <button
                        v-if="partMotorId || motorSearchQuery"
                        type="button"
                        @click="clearMotor"
                        class="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
                        title="Quitar motor y dejar como Universal"
                      >
                        <X class="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        @click="isMotorDropdownOpen = !isMotorDropdownOpen"
                        class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title="Ver lista de motores"
                      >
                        <ChevronDown class="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <!-- Dropdown flotante de motores -->
                  <div
                    v-if="isMotorDropdownOpen"
                    class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100"
                  >
                    <div
                      @click="selectMotor(null)"
                      class="px-3 py-1.5 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition"
                      :class="!partMotorId ? 'bg-cyan-50 font-bold text-[#038391]' : 'text-slate-700'"
                    >
                      <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full" :class="!partMotorId ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                        <span>Universal / Todos los Motores</span>
                      </div>
                      <Check v-if="!partMotorId" class="w-3.5 h-3.5 text-[#038391]" />
                    </div>

                    <div
                      v-for="mot in filteredMotoresList"
                      :key="mot.id"
                      @click="selectMotor(mot)"
                      class="px-3 py-1.5 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition"
                      :class="partMotorId === mot.id ? 'bg-cyan-50 text-cyan-900 font-bold' : 'text-slate-800'"
                    >
                      <div class="min-w-0 pr-2">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <strong class="font-extrabold text-[#004B97]">{{ mot.codigo }}</strong>
                          <span class="text-slate-500 font-medium text-[11px]">{{ getBrandName(mot.fabricante_id) }}</span>
                          <span v-if="mot.nombre_comercial" class="text-slate-600 text-[10px]">({{ mot.nombre_comercial }})</span>
                        </div>
                      </div>
                      <Check v-if="partMotorId === mot.id" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                    </div>

                    <div v-if="filteredMotoresList.length === 0" class="p-3 text-center text-xs text-slate-500 italic">
                      No se encontraron motores para "{{ motorSearchQuery }}"
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. Parámetros Comerciales & Stock -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Hash class="w-3.5 h-3.5 text-[#004B97]" />
                    <span>Comercial & Stock</span>
                  </h3>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Origen</label>
                    <select
                      v-model="partCatalogoOrigen"
                      class="w-full px-2 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    >
                      <option value="OEM">OEM Original</option>
                      <option value="Rik">Rik / Riken</option>
                      <option value="NPR">NPR</option>
                      <option value="Dokuro">Dokuro</option>
                      <option value="MRK">MRK</option>
                      <option value="Ajusa">Ajusa</option>
                      <option value="NDC">NDC</option>
                      <option value="Pioneer">Pioneer</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Precio ($)</label>
                    <input
                      v-model.number="partPrecio"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Stock (Pzs)</label>
                    <input
                      v-model.number="partStock"
                      type="number"
                      placeholder="12"
                      class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>
                </div>
              </div>

              <!-- 4. Imagen Técnica / Diagrama de explosión (Compacto) -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3">
                <PartImageUploader
                  v-model="partImagenUrl"
                  :part-code="partCodigoOem"
                  label="Diagrama / Foto de Pieza"
                />
              </div>

            </div>

            <!-- ============================================================= -->
            <!-- COLUMNA DERECHA: COTAS TÉCNICAS (MATRIZ ANILLOS) Y EQUIVS    -->
            <!-- ============================================================= -->
            <div class="lg:col-span-7 space-y-3.5">

              <!-- 1. Cotas Dimensionales Técnicas -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-lg bg-[#004B97] text-white flex items-center justify-center">
                      <Ruler class="w-3.5 h-3.5 text-[#04C4D9]" />
                    </div>
                    <div>
                      <h3 class="text-xs font-black uppercase tracking-wider text-slate-900">
                        Cotas Técnicas de Maquinado
                      </h3>
                    </div>
                  </div>

                  <span v-if="activeGroup" class="text-[10px] font-extrabold text-[#004B97] bg-white border border-cyan-200 px-2 py-0.5 rounded-full">
                    {{ isRingsGroup ? `${ringRows.length} Aros Configurados` : `${activeGroup.parametros.filter(p => p.requerido).length} Obligatorios` }}
                  </span>
                </div>

                <!-- A. MATRIZ TABULAR DINÁMICA GENERAL PARA FAMILIAS EN TABLA (ANILLOS, ETC.) -->
                <div v-if="isRingsGroup" class="space-y-3">
                  
                  <!-- Tabla de medidas compacta y 100% configurable -->
                  <div class="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs font-mono select-text">
                    <table class="border-collapse text-center text-xs w-full">
                      <thead>
                        <tr class="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                          <th class="px-3 py-2 text-left border-r border-slate-200">{{ activeTablaConfig.titulo_primera_columna || 'Anillo' }}</th>
                          <th class="px-2 py-2 border-r border-slate-200">{{ getActiveGroupParamLabel('diametro_cilindro_mm', 'Diámetro') }}</th>
                          <th class="px-2 py-2 border-r border-slate-200">{{ getActiveGroupParamLabel('grosor_mm', getActiveGroupParamLabel('anillo1_h1', 'Grosor')) }}</th>
                          <th class="px-2 py-2 border-r border-slate-200">{{ getActiveGroupParamLabel('altura_mm', getActiveGroupParamLabel('anillo1_a1', 'Altura')) }}</th>
                          <th
                            v-for="extParam in extraRingGroupParams"
                            :key="`th-ext-${extParam.id}`"
                            class="px-2 py-2 border-r border-slate-200"
                          >
                            {{ extParam.etiqueta_corta || extParam.etiqueta }}{{ extParam.unidad ? ` (${extParam.unidad})` : '' }}
                          </th>
                          <th v-if="activeTablaConfig.habilitar_identificador !== false" class="px-2.5 py-2">
                            {{ activeTablaConfig.etiqueta_identificador || 'Cónico' }}
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 text-[11px]">
                        <tr
                          v-for="(ring, rIdx) in ringRows"
                          :key="ring.id"
                          class="hover:bg-slate-50/70 transition"
                          :class="[
                            formErrors[`ring_h1_${rIdx}`] || (rIdx === 0 && formErrors.diametro_cilindro_mm) ? 'bg-rose-50/20' : '',
                            ring.tiene_identificador ? 'bg-amber-50/25' : ''
                          ]"
                        >
                          <!-- 1ra Columna: Incremental (1, 2, 3...) o Libre -->
                          <td class="px-2.5 py-1.5 bg-slate-50/80 font-bold text-slate-800 border-r border-slate-200 text-left whitespace-nowrap">
                            <div class="flex items-center justify-between gap-1.5">
                              <div class="flex items-center gap-1.5 flex-1 min-w-[110px]">
                                <span
                                  class="w-2 h-2 rounded-full shrink-0"
                                  :class="ring.tiene_identificador ? 'bg-amber-500' : (rIdx === ringRows.length - 1 ? 'bg-[#04C4D9]' : 'bg-[#004B97]')"
                                ></span>
                                <input
                                  v-model="ring.posicion"
                                  type="text"
                                  :placeholder="getDefaultRowPosition(rIdx, ringRows.length)"
                                  class="w-full px-1.5 py-0.5 text-xs font-extrabold text-slate-900 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-[#04C4D9] rounded focus:outline-none transition"
                                />
                              </div>
                              <button
                                v-if="ringRows.length > 1"
                                type="button"
                                @click="removeRingRow(rIdx)"
                                class="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                                :title="`Quitar ${getRingRowTitle(ring, rIdx)}`"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          <!-- Diámetro común STD (Editable en 1ra fila, heredado en las demás) -->
                          <td v-if="rIdx === 0" class="px-2 py-1.5 border-r border-slate-200">
                            <div class="relative flex items-center justify-center">
                              <input
                                v-model.number="paramValues.diametro_cilindro_mm"
                                type="number"
                                step="0.001"
                                placeholder="86.000"
                                class="w-20 px-1.5 py-1 text-center font-mono font-black text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                                :class="formErrors.diametro_cilindro_mm ? 'border-rose-400 bg-rose-50' : 'border-slate-300'"
                              />
                            </div>
                          </td>
                          <td v-else class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-50/30">
                            <span>{{ formatRingVal(paramValues.diametro_cilindro_mm) }}</span>
                          </td>

                          <!-- Grosor h1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="ring.h1"
                              type="number"
                              step="0.001"
                              :placeholder="rIdx === ringRows.length - 1 ? '3.000' : '1.500'"
                              class="w-18 px-1.5 py-1 text-center font-mono font-bold text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              :class="formErrors[`ring_h1_${rIdx}`] ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-300' : 'border-slate-300'"
                            />
                          </td>

                          <!-- Altura a1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="ring.a1"
                              type="number"
                              step="0.01"
                              :placeholder="rIdx === ringRows.length - 1 ? '2.80' : '3.40'"
                              class="w-16 px-1.5 py-1 text-center font-mono font-medium text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                          </td>

                          <!-- Columnas personalizadas adicionales por fila -->
                          <td
                            v-for="extParam in extraRingGroupParams"
                            :key="`td-ext-${ring.id}-${extParam.id}`"
                            class="px-2 py-1.5 border-r border-slate-200"
                          >
                            <input
                              v-if="extParam.tipo_dato === 'numero'"
                              v-model.number="ring.extra[extParam.clave]"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              class="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                            <input
                              v-else
                              v-model="ring.extra[extParam.clave]"
                              type="text"
                              placeholder="—"
                              class="w-20 px-1.5 py-1 text-center font-sans font-semibold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                          </td>

                          <!-- Identificador aparte por fila (ej. poner X anillo en Cónico o libre) -->
                          <td v-if="activeTablaConfig.habilitar_identificador !== false" class="px-2 py-1.5 whitespace-nowrap">
                            <div class="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                @click="toggleRowIdentificador(ring)"
                                class="px-2 py-1 rounded-lg text-[10px] font-sans font-extrabold border transition flex items-center gap-1"
                                :class="ring.tiene_identificador
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'"
                                :title="`Marcar o desmarcar ${activeTablaConfig.etiqueta_identificador || 'Cónico'} en esta fila`"
                              >
                                <Check v-if="ring.tiene_identificador" class="w-3 h-3 text-amber-700" />
                                <span>{{ activeTablaConfig.etiqueta_identificador || 'Cónico' }}</span>
                              </button>
                              <input
                                v-if="ring.tiene_identificador"
                                v-model="ring.identificador_texto"
                                @input="onRowIdentificadorTextInput(ring)"
                                type="text"
                                :placeholder="activeTablaConfig.etiqueta_identificador || 'Cónico'"
                                class="w-20 px-1.5 py-1 text-[10px] font-sans font-bold bg-amber-50/60 border border-amber-300 text-amber-950 rounded-lg focus:bg-white focus:outline-none focus:border-amber-500"
                                title="Puedes personalizar el texto del identificador para esta fila"
                              />
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- Controles auxiliares bajo la tabla: + Agregar Fila -->
                  <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      @click="addRingRow"
                      class="px-3 py-1 rounded-lg text-[11px] font-extrabold text-[#004B97] bg-white border border-cyan-300 hover:bg-cyan-50 transition flex items-center gap-1 shadow-2xs"
                    >
                      <Plus class="w-3.5 h-3.5 text-[#04C4D9]" />
                      <span>+ Agregar {{ activeTablaConfig.titulo_primera_columna || 'Anillo' }}</span>
                    </button>

                    <div class="flex items-center gap-3">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-bold text-slate-600">Cilindros:</span>
                        <input
                          v-model.number="paramValues.cilindros"
                          type="number"
                          placeholder="4"
                          class="w-12 px-1.5 py-0.5 text-center text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                <!-- B. GRINTA DINÁMICA DE PARÁMETROS PARA OTRAS FAMILIAS -->
                <div v-else-if="activeGroup && activeGroup.parametros.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div 
                    v-for="param in activeGroup.parametros" 
                    :key="param.id"
                    class="bg-white p-3 rounded-xl border transition shadow-2xs"
                    :class="formErrors[param.clave] ? 'border-rose-400 bg-rose-50/30 ring-1 ring-rose-300' : 'border-slate-200'"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-extrabold text-slate-900 flex items-center gap-1">
                        <span>{{ param.etiqueta }}</span>
                        <span v-if="param.requerido" class="text-rose-600 font-black">*</span>
                      </label>
                      <span 
                        :class="[
                          'text-[8px] font-extrabold px-1.5 py-0.2 rounded-full uppercase',
                          param.requerido ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-500'
                        ]"
                      >
                        {{ param.requerido ? 'Req' : 'Opc' }}
                      </span>
                    </div>

                    <div v-if="param.tipo_dato === 'numero'" class="relative flex items-center">
                      <input
                        v-model.number="paramValues[param.clave]"
                        type="number"
                        step="0.001"
                        placeholder="0.00"
                        class="w-full pl-2.5 pr-10 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                      />
                      <span class="absolute right-2.5 text-[9px] font-black text-slate-400 uppercase pointer-events-none">
                        {{ param.unidad || 'mm' }}
                      </span>
                    </div>

                    <div v-else-if="param.tipo_dato === 'seleccion'" class="relative">
                      <select
                        v-model="paramValues[param.clave]"
                        class="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                      >
                        <option value="">Selecciona opción</option>
                        <option v-for="opt in param.opciones || []" :key="opt" :value="opt">
                          {{ opt }}
                        </option>
                      </select>
                    </div>

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

                    <div v-else class="relative">
                      <input
                        v-model="paramValues[param.clave]"
                        type="text"
                        placeholder="Valor"
                        class="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                      />
                    </div>

                    <p v-if="formErrors[param.clave]" class="text-[9px] text-rose-600 font-bold mt-1">
                      {{ formErrors[param.clave] }}
                    </p>
                  </div>
                </div>

                <div v-else class="p-4 text-center bg-white border border-slate-200 rounded-xl text-xs text-slate-500">
                  Este grupo no tiene medidas dimensionales adicionales.
                </div>
              </div>

              <!-- 2. Bloque B: Equivalencias Multimarca Alternas -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#004B97]"></span>
                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-800">
                      Equivalencias Multimarca Alternas
                    </h3>
                  </div>
                  <button
                    type="button"
                    @click="addEquivalenceRow"
                    class="text-[10px] font-extrabold text-[#038391] hover:text-[#004B97] flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-cyan-200 shadow-2xs transition shrink-0"
                  >
                    <Plus class="w-3 h-3 text-[#04C4D9]" />
                    <span>+ Agregar Marca</span>
                  </button>
                </div>

                <div class="space-y-1.5">
                  <div 
                    v-for="(eq, idx) in equivalencias" 
                    :key="idx" 
                    class="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs"
                  >
                    <select
                      v-model="eq.marca_alterna"
                      class="w-28 px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                    >
                      <option v-for="brand in availableAltBrands" :key="brand" :value="brand">
                        {{ brand }}
                      </option>
                    </select>

                    <input
                      v-model="eq.codigo_alterno"
                      type="text"
                      placeholder="Código alterno"
                      class="flex-1 px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] uppercase"
                    />

                    <input
                      v-model="eq.notas"
                      type="text"
                      placeholder="Notas"
                      class="w-32 sm:w-36 px-2.5 py-1 text-[11px] font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                    />

                    <button
                      type="button"
                      @click="removeEquivalenceRow(idx)"
                      class="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Eliminar fila"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <!-- Añadir marca personalizada si no está en la lista -->
                  <div class="pt-1">
                    <button
                      v-if="!showNewBrandInput"
                      type="button"
                      @click="showNewBrandInput = true"
                      class="text-[10px] text-slate-500 hover:text-[#038391] font-bold flex items-center gap-1 transition"
                    >
                      <Plus class="w-3 h-3 text-[#04C4D9]" />
                      <span>+ Otra marca</span>
                    </button>
                    <div v-else class="flex items-center gap-1.5 pt-1">
                      <input
                        v-model="newBrandInputName"
                        type="text"
                        placeholder="Nombre de la marca..."
                        class="flex-1 px-2.5 py-1 text-xs font-bold bg-white border border-cyan-300 rounded-lg focus:outline-none"
                        @keydown.enter.prevent="handleAddNewAltBrand"
                      />
                      <button
                        type="button"
                        @click="handleAddNewAltBrand"
                        class="px-2.5 py-1 rounded-lg bg-[#04C4D9] text-white text-xs font-bold hover:bg-[#038896] transition"
                      >
                        Agregar
                      </button>
                      <button
                        type="button"
                        @click="showNewBrandInput = false"
                        class="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 font-bold transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>


        <!-- ----------------------------------------------------------------- -->
        <!-- PESTAÑA 2: CONSTRUCTOR DINÁMICO DE NUEVA FAMILIA / GRUPO         -->
        <!-- ----------------------------------------------------------------- -->
        <div v-else class="space-y-5">

          <!-- Selector de Modo: Crear Nuevo vs Modificar Existente (Solo cuando NO se especificó un editGroupId directo) -->
          <div v-if="!props.editGroupId" class="bg-slate-100 p-2 sm:p-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-slate-200">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="switchToCreateMode"
                :class="[
                  'px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5',
                  !isEditMode ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                ]"
              >
                <Plus class="w-3.5 h-3.5 text-[#04C4D9]" />
                <span>+ Nueva Familia</span>
              </button>
              <button
                type="button"
                @click="switchToEditMode()"
                :class="[
                  'px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5',
                  isEditMode ? 'bg-white text-[#04C4D9] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                ]"
              >
                <Edit3 class="w-3.5 h-3.5" />
                <span>Modificar Existente</span>
              </button>
            </div>

            <!-- Si está en modo editar: selector de grupo a modificar -->
            <div v-if="isEditMode" class="flex items-center gap-2">
              <label class="text-[11px] font-bold text-slate-600 shrink-0">Familia a editar:</label>
              <select
                v-model="selectedEditGroupId"
                @change="onSelectEditGroup"
                class="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9]"
              >
                <option value="" disabled>Seleccione una familia...</option>
                <option v-for="grp in catalogStore.grupos" :key="grp.id" :value="grp.codigo">
                  {{ grp.nombre }} ({{ grp.parametros.length }} parámetros)
                </option>
              </select>
            </div>
          </div>

          <!-- Banner Informativo si está editando -->
          <div v-if="isEditMode && editingGroupId" class="bg-cyan-50 border border-cyan-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
            <div class="flex items-center gap-2">
              <Edit3 class="w-4 h-4 text-[#038391]" />
              <span class="text-xs text-[#038391] font-bold">
                Editando familia: <strong>{{ groupNombre }}</strong>
              </span>
            </div>
            <button
              v-if="!props.editGroupId"
              type="button"
              @click="switchToCreateMode"
              class="text-[11px] font-bold text-cyan-800 underline hover:text-cyan-900 shrink-0"
            >
              Crear nueva
            </button>
          </div>

          <!-- =================================================================== -->
          <!-- SPLIT-PANE WORKBENCH (12 COLUMNAS EN DESKTOP)                       -->
          <!-- =================================================================== -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            <!-- ================================================================= -->
            <!-- PANEL IZQUIERDO (5 COLUMNAS): IDENTIDAD Y PARÁMETROS              -->
            <!-- ================================================================= -->
            <div class="lg:col-span-5 space-y-4">
              
              <!-- 1. IDENTIDAD DE LA FAMILIA -->
              <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3.5">
                <div class="flex items-center justify-between border-b pb-2 border-slate-100">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FolderPlus class="w-4 h-4 text-[#04C4D9]" />
                    <span>Identidad de la Familia</span>
                  </h3>
                </div>

                <div class="space-y-3">
                  <!-- Selector de Tipo de Familia: Normal vs En Tabla (como Anillos) -->
                  <div>
                    <label class="block text-xs font-bold text-slate-800 mb-1.5">
                      Tipo de Familia / Formato en Catálogo <span class="text-rose-500">*</span>
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        @click="setGroupTipoVista('normal')"
                        class="p-2.5 rounded-xl border text-left transition flex items-start gap-2"
                        :class="groupTipoVista === 'normal'
                          ? 'bg-cyan-50/90 border-[#04C4D9] ring-1 ring-[#04C4D9] text-slate-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'"
                      >
                        <Columns class="w-4 h-4 shrink-0 mt-0.5" :class="groupTipoVista === 'normal' ? 'text-[#038391]' : 'text-slate-400'" />
                        <div>
                          <div class="text-xs font-black">Normal</div>
                          <div class="text-[10px] text-slate-500 leading-tight mt-0.5">Etiquetas horizontales (Válvulas, Camisas, Sellos...)</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        @click="setGroupTipoVista('tabla')"
                        class="p-2.5 rounded-xl border text-left transition flex items-start gap-2"
                        :class="groupTipoVista === 'tabla'
                          ? 'bg-cyan-50/90 border-[#04C4D9] ring-1 ring-[#04C4D9] text-slate-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'"
                      >
                        <Table class="w-4 h-4 shrink-0 mt-0.5" :class="groupTipoVista === 'tabla' ? 'text-[#038391]' : 'text-slate-400'" />
                        <div>
                          <div class="text-xs font-black">En Tabla (Anillos)</div>
                          <div class="text-[10px] text-slate-500 leading-tight mt-0.5">Matriz multinivel por ranura / fila (1°, 2°, Aceite...)</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Nombre de Grupo (Obligatorio) -->
                  <div>
                    <label class="block text-xs font-bold text-slate-800 mb-1">
                      Nombre de Grupo / Familia <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="groupNombre"
                      type="text"
                      placeholder="Nombre de la familia"
                      class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] transition"
                      :class="groupErrors.groupNombre ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                    />
                    <span v-if="groupErrors.groupNombre" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                      {{ groupErrors.groupNombre }}
                    </span>
                  </div>

                  <!-- Categoría Técnica (Obligatorio) -->
                  <div>
                    <label class="block text-xs font-bold text-slate-800 mb-1">
                      Categoría Técnica <span class="text-rose-500">*</span>
                    </label>
                    <input
                      v-model="groupCategoria"
                      type="text"
                      placeholder="Categoría técnica"
                      class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] transition"
                    />
                  </div>

                  <!-- Subsistema Mecánico (Creatable Combobox / Opcional) -->
                  <div class="relative">
                    <label class="block text-xs font-bold text-slate-800 mb-1">
                      Subsistema Mecánico
                    </label>

                    <div class="relative flex items-center">
                      <input
                        v-model="subsistemaSearch"
                        @focus="isSubsistemaOpen = true"
                        @input="isSubsistemaOpen = true"
                        @keydown.enter.prevent="isCustomSubsistemaCandidate ? handleCreateAndSelectSubsistema() : (filteredSubsistemas[0] ? handleSelectSubsistema(filteredSubsistemas[0]) : null)"
                        type="text"
                        placeholder="Subsistema (Block, Culata...)"
                        class="w-full pl-3 pr-16 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] transition"
                      />
                      <div class="absolute right-2 flex items-center gap-1">
                        <button
                          v-if="groupSubsistema || subsistemaSearch"
                          type="button"
                          @click="handleClearSubsistema"
                          class="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Limpiar subsistema"
                        >
                          <X class="w-3.5 h-3.5" />
                        </button>
                        <ChevronDown
                          @click="isSubsistemaOpen = !isSubsistemaOpen"
                          class="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600"
                        />
                      </div>
                    </div>

                    <!-- Backdrop para cerrar al hacer clic afuera -->
                    <div
                      v-if="isSubsistemaOpen"
                      class="fixed inset-0 z-40 cursor-default"
                      @click="isSubsistemaOpen = false"
                    ></div>

                    <!-- Menú Desplegable Creatable (Inline) -->
                    <div
                      v-if="isSubsistemaOpen"
                      class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100"
                    >
                      <!-- Opción Crear Nuevo Inline si no coincide -->
                      <div
                        v-if="isCustomSubsistemaCandidate"
                        @click="handleCreateAndSelectSubsistema"
                        class="p-2.5 bg-cyan-50/80 hover:bg-cyan-100 cursor-pointer text-xs font-bold text-[#038391] flex items-center gap-1.5 transition"
                      >
                        <Plus class="w-3.5 h-3.5" />
                        <span>+ Crear nuevo subsistema: <strong>"{{ subsistemaSearch.trim() }}"</strong></span>
                      </div>

                      <!-- Lista de existentes -->
                      <div
                        v-for="sub in filteredSubsistemas"
                        :key="sub"
                        @click="handleSelectSubsistema(sub)"
                        :class="[
                          'px-3 py-2 cursor-pointer text-xs font-semibold flex items-center justify-between transition',
                          groupSubsistema === sub ? 'bg-cyan-50 text-[#038391] font-bold' : 'text-slate-700 hover:bg-slate-50'
                        ]"
                      >
                        <span>{{ sub }}</span>
                        <Check v-if="groupSubsistema === sub" class="w-3.5 h-3.5 text-[#04C4D9]" />
                      </div>

                      <div v-if="filteredSubsistemas.length === 0 && !isCustomSubsistemaCandidate" class="p-3 text-center text-xs text-slate-400">
                        Presiona Enter para crear
                      </div>
                    </div>
                  </div>

                  <!-- Descripción (Textarea compacto) -->
                  <div>
                    <label class="block text-xs font-bold text-slate-800 mb-1">
                      Descripción Técnica
                    </label>
                    <textarea
                      v-model="groupDescripcion"
                      rows="2"
                      placeholder="Descripción técnica..."
                      class="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] transition resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- 1.B CONFIGURACIÓN DE PRIMERA COLUMNA (SOLO PARA FAMILIAS EN TABLA) -->
              <div
                v-if="groupTipoVista === 'tabla'"
                class="bg-cyan-50/50 border border-cyan-200 rounded-2xl p-4 shadow-2xs space-y-3.5"
              >
                <div class="flex items-center justify-between border-b pb-2 border-cyan-200/80">
                  <h3 class="text-xs font-black uppercase tracking-wider text-[#004B97] flex items-center gap-1.5">
                    <Table class="w-4 h-4 text-[#04C4D9]" />
                    <span>Primera Columna de la Tabla (Filas)</span>
                  </h3>
                  <span class="text-[10px] font-bold text-[#038391] bg-white px-2 py-0.5 rounded-full border border-cyan-200">
                    Columna #1
                  </span>
                </div>

                <!-- Título de la Primera Columna -->
                <div>
                  <label class="block text-xs font-bold text-slate-800 mb-1">
                    Título de la Primera Columna <span class="text-rose-500">*</span>
                  </label>
                  <input
                    v-model="groupTablaConfig.titulo_primera_columna"
                    type="text"
                    placeholder="Ej. Anillo, Posición, Ranura, Etapa..."
                    class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>

                <!-- Modo de las Filas: Incremental (1, 2, 3, 4) vs Libre -->
                <div>
                  <label class="block text-xs font-bold text-slate-800 mb-1.5">
                    Comportamiento de las Filas
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      @click="groupTablaConfig.modo_filas = 'incremental'"
                      class="p-2 rounded-xl border text-left transition"
                      :class="groupTablaConfig.modo_filas === 'incremental'
                        ? 'bg-white border-[#04C4D9] ring-1 ring-[#04C4D9] text-slate-900 shadow-2xs'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'"
                    >
                      <div class="text-xs font-black">Incremental (1, 2, 3, 4...)</div>
                      <div class="text-[10px] text-slate-500 leading-tight mt-0.5">Numera automáticamente cada fila al agregar</div>
                    </button>

                    <button
                      type="button"
                      @click="groupTablaConfig.modo_filas = 'libre'"
                      class="p-2 rounded-xl border text-left transition"
                      :class="groupTablaConfig.modo_filas === 'libre'
                        ? 'bg-white border-[#04C4D9] ring-1 ring-[#04C4D9] text-slate-900 shadow-2xs'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'"
                    >
                      <div class="text-xs font-black">Libre (Texto abierto)</div>
                      <div class="text-[10px] text-slate-500 leading-tight mt-0.5">Permite escribir cualquier nombre por fila</div>
                    </button>
                  </div>

                  <!-- Opciones extra para modo incremental -->
                  <div v-if="groupTablaConfig.modo_filas === 'incremental'" class="mt-2.5 space-y-2 bg-white/80 p-2.5 rounded-xl border border-cyan-200/70">
                    <label class="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        v-model="groupTablaConfig.usar_prefijo_titulo"
                        class="rounded text-[#04C4D9] focus:ring-[#04C4D9]"
                      />
                      <span>Mostrar título junto al número (ej. "{{ groupTablaConfig.titulo_primera_columna || 'Anillo' }} 1, 2..." en vez de solo "1, 2, 3")</span>
                    </label>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-600 mb-1">
                        Nombre especial para última fila (opcional, dejar vacío para seguir numerando 1, 2, 3, 4):
                      </label>
                      <input
                        v-model="groupTablaConfig.etiqueta_ultima_fila"
                        type="text"
                        placeholder="Ej. Anillo de aceite (o vacío para continuar 1, 2, 3, 4)"
                        class="w-full px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                      />
                    </div>
                  </div>
                </div>

                <!-- Identificador aparte por fila (ej. poner X anillo en Cónico) -->
                <div class="bg-white/90 p-3 rounded-xl border border-cyan-200/80 space-y-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <div class="text-xs font-black text-slate-800">
                        Identificador aparte por fila (ej. Cónico)
                      </div>
                      <div class="text-[10px] text-slate-500">
                        Permite marcar cualquier fila X con una etiqueta especial (ej. poner X anillo en Cónico)
                      </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        v-model="groupTablaConfig.habilitar_identificador"
                        class="sr-only peer"
                      />
                      <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#04C4D9]"></div>
                    </label>
                  </div>

                  <div v-if="groupTablaConfig.habilitar_identificador" class="pt-1">
                    <label class="block text-[10px] font-bold text-slate-700 mb-1">
                      Nombre del Identificador por defecto
                    </label>
                    <input
                      v-model="groupTablaConfig.etiqueta_identificador"
                      type="text"
                      placeholder="Ej. Cónico, Keystone, Espiral..."
                      class="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>
                </div>
              </div>

              <!-- 2. GESTOR DE PARÁMETROS -->
              <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3.5">
                <div class="flex items-center justify-between border-b pb-2.5 border-slate-100">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <SlidersHorizontal class="w-4 h-4 text-[#04C4D9]" />
                    <span>{{ groupTipoVista === 'tabla' ? 'Columnas / Parámetros de la Tabla' : 'Gestor de Parámetros' }}</span>
                  </h3>
                  <button
                    type="button"
                    @click="addParamRow"
                    class="px-3 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-2xs shrink-0 active:scale-95"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>+ Medida</span>
                  </button>
                </div>

                <!-- Opción Global: Ocultar en filtros los que no se muestren en la tabla -->
                <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl transition-all">
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[#038391] shrink-0">
                      <Filter class="w-3.5 h-3.5" />
                    </div>
                    <div class="text-xs font-black text-slate-800">
                      Ocultar en filtros los que no se muestren en la tabla
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer select-none shrink-0 ml-3">
                    <input 
                      type="checkbox" 
                      v-model="soloFiltrosEnTabla" 
                      @change="handleSoloFiltrosChange"
                      class="sr-only peer" 
                    />
                    <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#04C4D9]"></div>
                  </label>
                </div>

                <!-- Lista de Parámetros Dinámicos -->
                <div class="space-y-3">
                  <div
                    v-for="(param, idx) in dynamicParams"
                    :key="param.id"
                    class="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 relative transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <!-- Barra superior del parámetro -->
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-md bg-slate-900 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                          {{ idx + 1 }}
                        </span>
                        <span class="text-xs font-black text-slate-900 truncate">
                          {{ param.etiqueta || `Medida #${idx + 1}` }}
                        </span>
                      </div>

                      <div class="flex items-center gap-1.5">
                        <!-- Switch En Tabla -->
                        <button
                          type="button"
                          @click="toggleParamRequerido(param)"
                          class="flex items-center gap-1 select-none px-2 py-1 rounded-lg border transition-all text-[11px] font-bold"
                          :class="param.requerido 
                            ? 'bg-cyan-50 border-cyan-300 text-[#038391] shadow-2xs' 
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'"
                          :title="param.requerido ? 'Visible como columna fija en la tabla' : 'No se proyecta como columna fija en la tabla'"
                        >
                          <Columns class="w-3 h-3" />
                          <span>En Tabla</span>
                        </button>

                        <!-- Switch En Filtro -->
                        <button
                          type="button"
                          @click="toggleParamFiltrable(param)"
                          :disabled="soloFiltrosEnTabla && !param.requerido"
                          class="flex items-center gap-1 select-none px-2 py-1 rounded-lg border transition-all text-[11px] font-bold"
                          :class="[
                            isParamFilterVisible(param)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300',
                            (soloFiltrosEnTabla && !param.requerido) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          ]"
                          :title="(soloFiltrosEnTabla && !param.requerido) ? 'Excluido de filtros porque no se muestra en la tabla' : (isParamFilterVisible(param) ? 'Visible en la barra de filtros de portada' : 'Oculto de los filtros de portada')"
                        >
                          <Filter class="w-3 h-3" />
                          <span>En Filtro</span>
                        </button>

                        <button
                          type="button"
                          @click="removeParamRow(idx)"
                          class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar parámetro"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <!-- Fila de Campos del Parámetro (General: Nombre/Etiqueta, Abreviatura(Tabla), Tipo de Entrada, Unidad sin opciones, Clave Técnica, Descripción) -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <!-- Nombre / Etiqueta y Abreviatura en Tabla -->
                      <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Nombre / Etiqueta *</label>
                        <input
                          v-model="param.etiqueta"
                          @input="handleParamLabelChange(param)"
                          type="text"
                          placeholder="Nombre de la medida"
                          class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>

                      <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Abreviatura (Tabla)</label>
                        <input
                          v-model="param.etiqueta_corta"
                          type="text"
                          :placeholder="param.etiqueta || 'Abrev.'"
                          class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>

                      <!-- Tipo de Entrada -->
                      <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Tipo de Entrada</label>
                        <select
                          v-model="param.tipo_dato"
                          class="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        >
                          <option value="numero">Número Decimal (mm)</option>
                          <option value="seleccion">Menú Desplegable</option>
                          <option value="booleano">Booleano (Sí/No)</option>
                          <option value="texto">Texto Libre</option>
                        </select>
                      </div>

                      <!-- Unidad de Medida (Texto libre directo, sin opciones desplegables) -->
                      <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Unidad</label>
                        <input
                          v-model="param.unidad"
                          @input="handleParamUnitChange(param)"
                          type="text"
                          placeholder="Escribir unidad (ej. mm, °, bar, psi...)"
                          class="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>

                      <!-- Clave Técnica Inmutable (ReadOnly + Candado) -->
                      <div class="sm:col-span-2">
                        <div class="flex items-center justify-between mb-1">
                          <label class="block text-[11px] font-bold text-slate-700">Clave Técnica (BD)</label>
                          <span class="inline-flex items-center gap-1 text-[9px] font-mono text-slate-600 bg-slate-200/70 px-1.5 py-0.2 rounded border border-slate-200">
                            <Lock class="w-2.5 h-2.5 text-slate-600" />
                            Inmutable
                          </span>
                        </div>
                        <div class="relative flex items-center">
                          <input
                            :value="param.clave"
                            readonly
                            tabindex="-1"
                            class="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded-lg cursor-not-allowed select-all focus:outline-none shadow-inner"
                            title="Clave técnica autogenerada e inmutable para garantizar integridad en BD"
                          />
                          <Lock class="w-3.5 h-3.5 text-slate-600 absolute left-2 pointer-events-none" />
                        </div>
                      </div>

                      <!-- Opciones para Desplegable si aplica -->
                      <div v-if="param.tipo_dato === 'seleccion'" class="sm:col-span-2 bg-cyan-50/80 p-2.5 rounded-xl border border-cyan-200">
                        <label class="block text-[10px] font-bold text-[#038391] mb-1">Opciones (separadas por coma):</label>
                        <input
                          v-model="param.opcionesStr"
                          type="text"
                          placeholder="Opciones (separadas por coma)"
                          class="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-cyan-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#04C4D9]"
                        />
                      </div>

                      <!-- Descripción -->
                      <div class="sm:col-span-2">
                        <label class="block text-[10px] font-bold text-slate-600 mb-1">Descripción</label>
                        <input
                          v-model="param.descripcion"
                          type="text"
                          placeholder="Descripción técnica..."
                          class="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ================================================================= -->
            <!-- PANEL DERECHO (7 COLUMNAS): LIVE PREVIEW ("ESPEJO DE PORTADA")    -->
            <!-- ================================================================= -->
            <div class="lg:col-span-7 lg:sticky lg:top-0 space-y-4">
              <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl text-white space-y-4">
                
                <!-- Header del Marco de Inspección -->
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-cyan-500/20 border border-[#04C4D9]/40 flex items-center justify-center text-[#04C4D9]">
                      <Eye class="w-4 h-4" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="text-xs font-black uppercase tracking-wider text-white">
                          Espejo de Portada
                        </h4>
                        <span class="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9px] font-bold">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          En Vivo
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="text-right">
                    <span class="font-mono text-xs font-black text-[#04C4D9]">
                      {{ visibleTableColumns.length }}
                    </span>
                    <span class="text-[10px] text-slate-400 block font-sans">
                      cols obligatorias
                    </span>
                  </div>
                </div>

                <!-- 1. PREVIEW DE FILTROS DE PORTADA -->
                <div class="space-y-2 bg-slate-850/90 rounded-xl p-3 border border-slate-800">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Filter class="w-3.5 h-3.5 text-[#04C4D9]" />
                      <span>Filtros Reactivos de Portada</span>
                    </span>
                  </div>

                  <!-- Buscador universal simulado -->
                  <div class="relative">
                    <Search class="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      readonly
                      type="text"
                      :placeholder="`Buscar repuesto o cota en ${groupNombre || 'esta familia'}...`"
                      class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-lg text-slate-300 placeholder:text-slate-500 cursor-default"
                    />
                  </div>

                  <!-- Chips / Inputs de filtros por parámetro dinámico -->
                  <div class="pt-1.5 flex flex-wrap gap-2 items-center">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cotas:</span>
                    
                    <div
                      v-for="param in dynamicParams.filter(p => isParamFilterVisible(p))"
                      :key="`preview-filter-${param.id}`"
                      class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs"
                    >
                      <span class="text-[10px] font-bold text-slate-300">{{ param.etiqueta_corta || param.etiqueta }}:</span>
                      
                      <template v-if="param.tipo_dato === 'numero'">
                        <span class="font-mono font-bold text-[#04C4D9] text-[11px]">
                          {{ param.valor_muestra || '50.00' }}
                        </span>
                        <span v-if="param.unidad" class="text-[9px] text-slate-400">{{ param.unidad }}</span>
                        <span class="text-[9px] font-mono font-bold px-1 rounded bg-slate-700 text-slate-300" title="Tolerancia universal">
                          ±1.0
                        </span>
                      </template>

                      <template v-else-if="param.tipo_dato === 'seleccion'">
                        <span class="text-[10px] font-bold text-cyan-300">Todas</span>
                      </template>

                      <template v-else-if="param.tipo_dato === 'booleano'">
                        <span class="text-[10px] font-bold text-amber-300">STD</span>
                      </template>

                      <template v-else>
                        <span class="text-[10px] text-slate-400 italic">libre</span>
                      </template>
                    </div>

                    <span v-if="dynamicParams.filter(p => isParamFilterVisible(p)).length === 0" class="text-[11px] text-slate-500 italic">
                      Sin filtros dimensionales activos (todos ocultos o fuera de tabla).
                    </span>
                  </div>
                </div>

                <!-- 2. PREVIEW DE TABLA DE REPUESTOS -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Table class="w-3.5 h-3.5 text-[#04C4D9]" />
                      <span>Tabla de Catálogo (Solo Obligatorios)</span>
                    </span>
                  </div>

                  <!-- Contenedor con scroll horizontal de tabla -->
                  <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto shadow-inner">
                    <table class="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr class="bg-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                          <!-- 1. COMPONENTE -->
                          <th class="py-2 px-3 border-r border-slate-800 w-44 whitespace-nowrap">Componente</th>
                          <!-- 2. CÓDIGO OEM -->
                          <th class="py-2 px-2.5 border-r border-slate-800 w-28 whitespace-nowrap">Código OEM</th>
                          <!-- 3. CATÁLOGOS ALTERNOS -->
                          <th class="py-2 px-2.5 border-r border-slate-800 w-32 whitespace-nowrap">Catálogos Alternos</th>
                          <!-- 4. COTAS / MEDIDAS AGRUPADAS (HEADER DINÁMICO) -->
                          <th class="py-2 px-3 border-r border-slate-800 text-cyan-300 font-bold uppercase tracking-wider text-[10px]">
                            <div class="flex items-center justify-between gap-2">
                              <span class="truncate">
                                {{ (groupNombre ? groupNombre.toUpperCase() : 'COTAS') }}: 
                                {{ visibleTableColumns.map(p => p.etiqueta_corta || p.etiqueta).join(' × ') || 'ESPECIFICACIONES TÉCNICAS' }}
                              </span>
                            </div>
                          </th>
                          <!-- 5. ACCIONES -->
                          <th class="py-2 px-3 text-right w-24 whitespace-nowrap">Acciones</th>
                        </tr>
                      </thead>

                      <!-- Filas de muestra interactivas (5 Columnas Estandarizadas) -->
                      <tbody class="divide-y divide-slate-800/70 font-mono text-[11px]">
                        <!-- Fila de Prueba 1 -->
                        <tr class="hover:bg-slate-900/60 transition group">
                          <!-- 1. COMPONENTE -->
                          <td class="py-2.5 px-3 border-r border-slate-800/70 align-middle">
                            <div class="flex items-center gap-2">
                              <div class="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#04C4D9] shrink-0">
                                <Layers class="w-3.5 h-3.5" />
                              </div>
                              <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                  <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">OEM</span>
                                  <span class="text-xs font-black text-white truncate font-sans">{{ groupNombre || 'Pieza Rectificada' }} STD</span>
                                </div>
                                <p class="text-[10px] text-slate-400 font-sans truncate">
                                  TOYOTA • {{ (groupSubsistema || 'BLOCK').toUpperCase() }} • MOTOR 2L • CATÁLOGO OEM
                                </p>
                              </div>
                            </div>
                          </td>

                          <!-- 2. CÓDIGO OEM -->
                          <td class="py-2.5 px-2.5 border-r border-slate-800/70 text-slate-200 font-mono font-bold align-middle">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <div
                                v-for="(codePreview, cIdx) in (allOemCodesPreview.length > 0 ? allOemCodesPreview : ['13011-54020', '13011-54030'])"
                                :key="cIdx"
                                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-200 text-[10px]"
                              >
                                <span>{{ codePreview }}</span>
                                <Copy class="w-2.5 h-2.5 text-slate-500 cursor-pointer hover:text-slate-300" title="Copiar código" />
                              </div>
                            </div>
                          </td>

                          <!-- 3. CATÁLOGOS ALTERNOS -->
                          <td class="py-2.5 px-2.5 border-r border-slate-800/70 align-middle whitespace-nowrap font-sans">
                            <span class="text-[10px] text-slate-500 italic">Sin cruces</span>
                          </td>

                          <!-- 4. COTAS / MEDIDAS AGRUPADAS (Tabla si groupTipoVista === 'tabla', o Badges si 'normal') -->
                          <td class="py-2.5 px-3 border-r border-slate-800/70 align-middle">
                            <template v-if="groupTipoVista === 'tabla'">
                              <div class="inline-block border border-slate-700 rounded-lg overflow-hidden bg-slate-900 font-mono text-[11px]">
                                <table class="border-collapse text-center">
                                  <thead>
                                    <tr class="bg-slate-800 text-slate-300 text-[9px] font-bold uppercase tracking-wider border-b border-slate-700">
                                      <th class="px-2 py-1 border-r border-slate-700 text-left">{{ groupTablaConfig.titulo_primera_columna || 'Anillo' }}</th>
                                      <th
                                        v-for="(colParam, colIdx) in visibleTableColumns"
                                        :key="`prev1-th-${colParam.id}`"
                                        class="px-2 py-1 text-cyan-300"
                                        :class="colIdx < visibleTableColumns.length - 1 ? 'border-r border-slate-700' : ''"
                                      >
                                        {{ colParam.etiqueta_corta || colParam.etiqueta }}{{ colParam.unidad && colParam.unidad !== 'mm' ? ` (${colParam.unidad})` : '' }}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody class="divide-y divide-slate-800 text-[10px] text-slate-200">
                                    <tr v-for="rIdx in [0, 1, 2]" :key="`prev1-tr-${rIdx}`">
                                      <td class="px-2 py-0.5 bg-slate-850 font-bold text-left border-r border-slate-700 whitespace-nowrap">
                                        <span>{{ getPreviewRowLabel(rIdx) }}</span>
                                        <span
                                          v-if="rIdx === 0 && groupTablaConfig.habilitar_identificador !== false"
                                          class="ml-1 text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold uppercase"
                                        >
                                          {{ groupTablaConfig.etiqueta_identificador || 'CÓNICO' }}
                                        </span>
                                      </td>
                                      <td
                                        v-for="(colParam, colIdx) in visibleTableColumns"
                                        :key="`prev1-td-${rIdx}-${colParam.id}`"
                                        class="px-2 py-0.5 font-bold"
                                        :class="[
                                          colIdx < visibleTableColumns.length - 1 ? 'border-r border-slate-700' : '',
                                          colIdx <= 1 ? 'text-emerald-400' : 'text-slate-200'
                                        ]"
                                      >
                                        {{ getPreviewTableCellValue(colParam, 0, rIdx) }}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </template>
                            <div v-else class="flex flex-wrap items-center gap-1.5">
                              <div
                                v-for="param in visibleTableColumns"
                                :key="`row1-${param.id}`"
                                @click="cycleDecimals(param)"
                                :title="'Clic para alternar decimales (.2 -> .1 -> .0) de ' + (param.etiqueta_corta || param.etiqueta)"
                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-850 border border-slate-700/80 text-xs font-mono font-bold text-emerald-400 hover:border-slate-500 cursor-pointer transition select-none group/badge"
                              >
                                <span class="text-[9px] uppercase font-sans text-slate-400">{{ param.etiqueta_corta || param.etiqueta }}:</span>
                                <span class="tabular-nums">{{ formatSampleValue(param, 0) }}</span>
                              </div>
                              <span v-if="visibleTableColumns.length === 0" class="text-amber-400 text-[10px] italic font-sans">
                                ⚠️ Sin medidas marcadas "En Tabla" (Obligatorio)
                              </span>
                            </div>
                          </td>

                          <!-- 5. ACCIONES -->
                          <td class="py-2.5 px-3 text-right align-middle whitespace-nowrap font-sans">
                            <div class="flex items-center justify-end gap-1.5">
                              <button type="button" class="px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-semibold">
                                Ficha
                              </button>
                              <button type="button" class="px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-semibold">
                                Editar
                              </button>
                              <span class="px-2 py-0.5 rounded bg-[#04C4D9] hover:bg-[#03a9bc] text-slate-900 font-extrabold text-[10px] shadow-2xs cursor-pointer">
                                + A Orden
                              </span>
                            </div>
                          </td>
                        </tr>

                        <!-- Fila de Prueba 2 -->
                        <tr class="hover:bg-slate-900/60 transition group bg-slate-950/40">
                          <!-- 1. COMPONENTE -->
                          <td class="py-2.5 px-3 border-r border-slate-800/70 align-middle">
                            <div class="flex items-center gap-2">
                              <div class="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#04C4D9] shrink-0">
                                <Layers class="w-3.5 h-3.5" />
                              </div>
                              <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                  <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">OEM</span>
                                  <span class="text-xs font-black text-white truncate font-sans">{{ groupNombre || 'Pieza Rectificada' }} 0.50</span>
                                </div>
                                <p class="text-[10px] text-slate-400 font-sans truncate">
                                  HONDA • {{ (groupSubsistema || 'BLOCK').toUpperCase() }} • MOTOR D17A • CATÁLOGO OEM
                                </p>
                              </div>
                            </div>
                          </td>

                          <!-- 2. CÓDIGO OEM -->
                          <td class="py-2.5 px-2.5 border-r border-slate-800/70 text-slate-200 font-mono font-bold align-middle whitespace-nowrap">
                            <div class="flex items-center gap-1.5">
                              <span>13011-58010</span>
                              <Copy class="w-3 h-3 text-slate-500 cursor-pointer hover:text-slate-300" title="Copiar código" />
                            </div>
                          </td>

                          <!-- 3. CATÁLOGOS ALTERNOS -->
                          <td class="py-2.5 px-2.5 border-r border-slate-800/70 align-middle whitespace-nowrap font-sans">
                            <span class="text-[10px] text-slate-500 italic">Sin cruces</span>
                          </td>

                          <!-- 4. COTAS / MEDIDAS AGRUPADAS -->
                          <td class="py-2.5 px-3 border-r border-slate-800/70 align-middle">
                            <template v-if="groupTipoVista === 'tabla'">
                              <div class="inline-block border border-slate-700 rounded-lg overflow-hidden bg-slate-900 font-mono text-[11px]">
                                <table class="border-collapse text-center">
                                  <thead>
                                    <tr class="bg-slate-800 text-slate-300 text-[9px] font-bold uppercase tracking-wider border-b border-slate-700">
                                      <th class="px-2 py-1 border-r border-slate-700 text-left">{{ groupTablaConfig.titulo_primera_columna || 'Anillo' }}</th>
                                      <th
                                        v-for="(colParam, colIdx) in visibleTableColumns"
                                        :key="`prev2-th-${colParam.id}`"
                                        class="px-2 py-1 text-cyan-300"
                                        :class="colIdx < visibleTableColumns.length - 1 ? 'border-r border-slate-700' : ''"
                                      >
                                        {{ colParam.etiqueta_corta || colParam.etiqueta }}{{ colParam.unidad && colParam.unidad !== 'mm' ? ` (${colParam.unidad})` : '' }}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody class="divide-y divide-slate-800 text-[10px] text-slate-200">
                                    <tr v-for="rIdx in [0, 1, 2]" :key="`prev2-tr-${rIdx}`">
                                      <td class="px-2 py-0.5 bg-slate-850 font-bold text-left border-r border-slate-700 whitespace-nowrap">
                                        <span>{{ getPreviewRowLabel(rIdx) }}</span>
                                      </td>
                                      <td
                                        v-for="(colParam, colIdx) in visibleTableColumns"
                                        :key="`prev2-td-${rIdx}-${colParam.id}`"
                                        class="px-2 py-0.5 font-bold"
                                        :class="[
                                          colIdx < visibleTableColumns.length - 1 ? 'border-r border-slate-700' : '',
                                          colIdx === 0 ? 'text-amber-300' : (colIdx === 1 ? 'text-emerald-400' : 'text-slate-200')
                                        ]"
                                      >
                                        {{ getPreviewTableCellValue(colParam, 1, rIdx) }}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </template>
                            <div v-else class="flex flex-wrap items-center gap-1.5">
                              <div
                                v-for="param in visibleTableColumns"
                                :key="`row2-${param.id}`"
                                @click="cycleDecimals(param)"
                                :title="'Clic para alternar decimales (.2 -> .1 -> .0) de ' + (param.etiqueta_corta || param.etiqueta)"
                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-850 border border-slate-700/80 text-xs font-mono font-bold text-emerald-400 hover:border-slate-500 cursor-pointer transition select-none group/badge"
                              >
                                <span class="text-[9px] uppercase font-sans text-slate-400">{{ param.etiqueta_corta || param.etiqueta }}:</span>
                                <span class="tabular-nums">{{ formatSampleValue(param, 1) }}</span>
                              </div>
                              <span v-if="visibleTableColumns.length === 0" class="text-amber-400 text-[10px] italic font-sans">
                                ⚠️ Sin medidas marcadas "En Tabla" (Obligatorio)
                              </span>
                            </div>
                          </td>

                          <!-- 5. ACCIONES -->
                          <td class="py-2.5 px-3 text-right align-middle whitespace-nowrap font-sans">
                            <div class="flex items-center justify-end gap-1.5">
                              <button type="button" class="px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-semibold">
                                Ficha
                              </button>
                              <button type="button" class="px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-semibold">
                                Editar
                              </button>
                              <span class="px-2 py-0.5 rounded bg-[#04C4D9] hover:bg-[#03a9bc] text-slate-900 font-extrabold text-[10px] shadow-2xs cursor-pointer">
                                + A Orden
                              </span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- ALERTA DE ERROR DE VALIDACIÓN O GUARDADO                              -->
      <!-- ===================================================================== -->
      <div 
        v-if="saveErrorMessage" 
        class="px-5 sm:px-7 py-3 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3 shrink-0"
      >
        <div class="flex items-center gap-2">
          <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
          <span>{{ saveErrorMessage }}</span>
        </div>
        <button 
          type="button" 
          @click="saveErrorMessage = ''" 
          class="text-rose-400 hover:text-rose-700 p-1 rounded-md transition"
          title="Descartar mensaje"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- ===================================================================== -->
      <!-- MODAL FOOTER CON BOTÓN GUARDAR                                        -->
      <!-- ===================================================================== -->
      <div class="px-5 sm:px-7 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
          >
            Cancelar
          </button>

          <!-- Botón Eliminar Repuesto (solo en modo edición de repuesto) -->
          <div v-if="activeTab === 'repuesto' && isEditPartMode" class="relative">
            <button
              v-if="!showDeleteConfirm"
              type="button"
              @click="showDeleteConfirm = true"
              class="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              title="Eliminar permanentemente este repuesto"
            >
              <Trash2 class="w-3.5 h-3.5 text-rose-600" />
              <span>Eliminar</span>
            </button>

            <!-- Confirmación Inline -->
            <div v-else class="flex items-center gap-1.5 bg-rose-100 border border-rose-300 p-1 rounded-xl">
              <span class="text-[11px] font-bold text-rose-900 px-2">¿Eliminar?</span>
              <button
                type="button"
                @click="handleDeletePart"
                :disabled="isDeletingPart"
                class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1"
              >
                <Loader2 v-if="isDeletingPart" class="w-3 h-3 animate-spin" />
                <span v-else>Sí</span>
              </button>
              <button
                type="button"
                @click="showDeleteConfirm = false"
                class="px-2 py-1 text-slate-600 hover:text-slate-900 text-xs font-bold"
              >
                No
              </button>
            </div>
          </div>
        </div>

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
            <span>{{ isSubmittingPart ? 'Guardando...' : (isEditPartMode ? 'Guardar Cambios' : 'Guardar Repuesto') }}</span>
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
            <span>{{ isSubmittingGroup ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Guardar Familia') }}</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
