<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import PartImageUploader from '@/components/catalog/PartImageUploader.vue'
import FamilyTemplatePicker from '@/components/catalog/FamilyTemplatePicker.vue'
import { 
  type GrupoRepuesto, 
  type GrupoRepuestoInsert,
  type ParametroTecnicoDefinicion,
  type TablaConfiguracion,
  type RepuestoTecnico,
  type Motor,
  buildNestedTableHeaders
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
  AlertCircle 
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

const createDefaultRingRows = (cfg?: TablaConfiguracion, isRings: boolean = false): RingFormRow[] => {
  if (Array.isArray(cfg?.subfilas) && cfg.subfilas.length > 0 && cfg.modo_filas !== 'subfilas' && cfg.modo_filas !== 'cojinetes') {
    return cfg.subfilas.map((label, idx) => ({
      id: `ring-${idx + 1}`,
      posicion: label?.trim() || `Fila ${idx + 1}`,
      tipo_aro: idx === 0 ? 'fuego' : (idx === cfg.subfilas!.length - 1 ? 'aceite' : 'compresion'),
      h1: null,
      a1: null,
      perfil: 'Plano',
      tiene_identificador: false,
      identificador_texto: '',
      extra: {}
    }))
  }

  const titulo = cfg?.titulo_primera_columna || (isRings ? 'Anillo' : 'Fila')
  const usarPref = cfg?.usar_prefijo_titulo !== false
  const modo = cfg?.modo_filas || 'incremental'
  const ult = cfg?.etiqueta_ultima_fila !== undefined ? cfg.etiqueta_ultima_fila : (isRings ? 'Anillo de aceite' : '')
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

export interface SubfilaFormRow {
  id: string
  tipo: string
  nombre: string
  codigo: string
  medidas: Record<string, any>
}

// Sub-filas por registro (ej. Cojinetes: Fila 1 Marca centrada, Fila 2 Biela, Fila 3 Bancada)
const subfilasRows = ref<SubfilaFormRow[]>([
  { id: 'sf-biela', tipo: 'biela', nombre: 'Biela', codigo: '', medidas: {} },
  { id: 'sf-bancada', tipo: 'bancada', nombre: 'Bancada', codigo: '', medidas: {} }
])
const subfilasMarcaBanner = ref<string>('')
const subfilasAplicacionBanner = ref<string>('')

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

      if (props.editGroupId) {
        const grp = resolveGroupByTarget(props.editGroupId)
        if (grp) {
          selectedGroupCode.value = grp.codigo
          selectedEditGroupId.value = grp.codigo || grp.id
          loadGroupForEditing(grp)
        } else {
          switchToCreateMode()
        }
      } else {
        // Creación explícita de nueva familia (100% limpia y vacía)
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

    // Asegurar motores, marcas y modelos cargados para el buscador
    if (catalogStore.motores.length === 0) {
      catalogStore.fetchMotores()
    }
    if (catalogStore.fabricantes.length === 0) {
      catalogStore.fetchFabricantes()
    }
    if (catalogStore.modelos.length === 0) {
      catalogStore.fetchModelos()
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
const partMarca = ref<string>('')
const partModelo = ref<string>('')
const partAno = ref<string>('')
const partNombre = ref<string>('')
const partSubsistema = ref<string>('Block')
const partPrecio = ref<number | null>(null)
const partStock = ref<number>(12)
const partEstado = ref<'Disponible' | 'Bajo Stock' | 'Agotado'>('Disponible')
const partCatalogoOrigen = ref<string>('OEM')
const partImagenUrl = ref<string>('')

const availableModalModelos = computed(() => {
  const brandClean = partMarca.value.trim().toLowerCase()
  if (!brandClean) return catalogStore.modelos
  const fab = catalogStore.fabricantes.find(f => f.nombre.toLowerCase() === brandClean)
  if (fab) {
    return catalogStore.modelos.filter(m => m.fabricante_id === fab.id)
  }
  return catalogStore.modelos
})

const commonYearsList = computed(() => {
  const currentYear = new Date().getFullYear()
  const years: string[] = []
  for (let y = currentYear + 1; y >= 1980; y--) {
    years.push(String(y))
  }
  return years
})

watch(partMarca, async (newBrand) => {
  if (newBrand) {
    const brandClean = newBrand.trim().toLowerCase()
    const fab = catalogStore.fabricantes.find(f => f.nombre.toLowerCase() === brandClean)
    if (fab) {
      await catalogStore.fetchModelos(fab.id)
    }
  }
})

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

const sanitizeGroupParams = (params: ParametroTecnicoDefinicion[]): ParametroTecnicoDefinicion[] => {
  if (!Array.isArray(params)) return []
  const seen = new Map<string, number>()
  return params.map(p => {
    let key = p.clave
    if (p.columna_padre && p.columna_padre.trim()) {
      const parentSlug = p.columna_padre
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      if (parentSlug && !key.startsWith(parentSlug)) {
        key = `${parentSlug}_${key}`
      }
    }
    const count = seen.get(key) || 0
    if (count > 0) {
      let suffix = count + 1
      let uniqueKey = `${key}_${suffix}`
      while (seen.has(uniqueKey)) {
        suffix++
        uniqueKey = `${key}_${suffix}`
      }
      key = uniqueKey
    }
    seen.set(key, (seen.get(key) || 0) + 1)
    return { ...p, clave: key }
  })
}

const activeGroup = computed<GrupoRepuesto | null>(() => {
  if (!selectedGroupCode.value) return null
  const grp = catalogStore.grupos.find(g => g.codigo === selectedGroupCode.value || g.id === selectedGroupCode.value) || null
  if (!grp) return null
  if (grp.parametros && grp.parametros.length > 0) {
    return {
      ...grp,
      parametros: sanitizeGroupParams(grp.parametros)
    }
  }
  return grp
})

const activeTablaConfig = computed<TablaConfiguracion>(() => {
  return activeGroup.value?.tabla_config || {
    titulo_primera_columna: isRingsGroup.value ? 'Anillo' : 'Posición / Fila',
    modo_filas: 'incremental',
    usar_prefijo_titulo: true,
    etiqueta_ultima_fila: isRingsGroup.value ? 'Anillo de aceite' : '',
    habilitar_identificador: isRingsGroup.value,
    etiqueta_identificador: isRingsGroup.value ? 'Cónico' : 'Especial'
  }
})

const getDefaultRowPosition = (idx: number, totalRows: number, cfg?: TablaConfiguracion): string => {
  const conf = cfg || activeTablaConfig.value
  const titulo = conf.titulo_primera_columna || (isRingsGroup.value ? 'Anillo' : 'Fila')
  const usarPref = conf.usar_prefijo_titulo !== false
  const isLast = idx === totalRows - 1 && totalRows >= 2
  if (isLast && conf.etiqueta_ultima_fila && conf.etiqueta_ultima_fila.trim()) {
    return conf.etiqueta_ultima_fila.trim()
  }
  if (Array.isArray(conf.subfilas) && conf.subfilas[idx]?.trim()) {
    return conf.subfilas[idx]!.trim()
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
    if (!row.posicion || !row.posicion.trim() || isRingsGroup.value) {
      row.posicion = getDefaultRowPosition(idx, total)
    }
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

const isSubfilasGroup = computed<boolean>(() => {
  if (!activeGroup.value || activeGroup.value.tipo_vista !== 'tabla') return false
  const cfg = activeGroup.value.tabla_config
  return Boolean(cfg?.subfilas_activas || cfg?.modo_filas === 'cojinetes' || cfg?.modo_filas === 'subfilas')
})

const isRingsGroup = computed<boolean>(() => {
  if (!activeGroup.value) return false
  if (isSubfilasGroup.value) return false
  const code = (activeGroup.value.codigo || '').toLowerCase()
  const cat = (activeGroup.value.categoria || '').toLowerCase()
  return code === 'anillos_motor' || code.includes('anillo') || cat === 'anillos' || cat.includes('anillo')
})

const isGeneralTableGroup = computed<boolean>(() => {
  if (!activeGroup.value) return false
  if (isSubfilasGroup.value) return false
  if (isRingsGroup.value) return true
  return activeGroup.value.tipo_vista === 'tabla'
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
  if (!activeGroup.value) return []
  if (isRingsGroup.value) {
    return activeGroup.value.parametros.filter(p => !CORE_RING_PARAM_KEYS.has(p.clave))
  }
  if (isGeneralTableGroup.value) {
    return activeGroup.value.parametros
  }
  return []
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
      ringRows.value = createDefaultRingRows(grp.tabla_config, isRingsGroup.value)
      if (isSubfilasGroup.value) {
        if (grp.tabla_config?.subfilas && grp.tabla_config.subfilas.length > 0) {
          subfilasRows.value = grp.tabla_config.subfilas.map((name, idx) => ({
            id: `sf-${idx}-${Date.now()}`,
            tipo: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            nombre: name,
            codigo: '',
            medidas: {}
          }))
        } else {
          subfilasRows.value = [
            { id: 'sf-biela', tipo: 'biela', nombre: 'Biela', codigo: '', medidas: {} },
            { id: 'sf-bancada', tipo: 'bancada', nombre: 'Bancada', codigo: '', medidas: {} }
          ]
        }
        if (selectedMotor.value) {
          subfilasMarcaBanner.value = getBrandName(selectedMotor.value.fabricante_id)
          subfilasAplicacionBanner.value = `${selectedMotor.value.codigo}${selectedMotor.value.nombre_comercial ? ` - ${selectedMotor.value.nombre_comercial}` : ''}`
        }
      }
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

watch(selectedMotor, (mot) => {
  if (mot) {
    if (!partMarca.value && mot.fabricante_id) {
      partMarca.value = getBrandName(mot.fabricante_id)
    }
    if (!partModelo.value && (mot as any).modelo?.nombre) {
      partModelo.value = (mot as any).modelo.nombre
    }
    if (!partAno.value && mot.anios) {
      partAno.value = mot.anios
    }
    if (isSubfilasGroup.value) {
      if (!subfilasMarcaBanner.value) {
        subfilasMarcaBanner.value = getBrandName(mot.fabricante_id)
      }
      if (!subfilasAplicacionBanner.value) {
        subfilasAplicacionBanner.value = `${mot.codigo}${mot.nombre_comercial ? ` - ${mot.nombre_comercial}` : ''}`
      }
    }
  }
})

const addEquivalenceRow = () => {
  equivalencias.value.push({ marca_alterna: 'Rik', codigo_alterno: '', notas: '' })
}

const removeEquivalenceRow = (index: number) => {
  if (equivalencias.value.length > 1) {
    equivalencias.value.splice(index, 1)
  }
}

// Validación de repuesto: Los únicos campos obligatorios son Código OEM, Marca, Modelo y Año
const validatePartForm = (): boolean => {
  const errors: Record<string, string> = {}

  if (!partCodigoOem.value.trim()) {
    errors.partCodigoOem = 'El Código OEM de la pieza es obligatorio'
  }
  if (!partMarca.value.trim()) {
    errors.partMarca = 'La Marca del vehículo es obligatoria'
  }
  if (!partModelo.value.trim()) {
    errors.partModelo = 'El Modelo del vehículo es obligatorio'
  }
  if (!partAno.value.trim()) {
    errors.partAno = 'El Año del vehículo es obligatorio'
  }

  formErrors.value = errors
  if (Object.keys(errors).length > 0) {
    saveErrorMessage.value = 'Por favor complete los campos obligatorios: Código OEM, Marca, Modelo y Año.'
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
  const spec = (part.especificaciones_tecnicas as any) || {}
  const dims = (part.dimensiones as any) || {}
  partMarca.value = spec.marca || spec.fabricantes?.[0] || dims.marca || (part.motor?.fabricante?.nombre) || (part.motor?.fabricante_id ? getBrandName(part.motor.fabricante_id) : '') || ''
  partModelo.value = spec.modelo || spec.vehiculo || dims.modelo || (part.motor?.modelo?.nombre) || ''
  partAno.value = spec.ano || spec.anios || dims.ano || (part.motor?.anios) || ''
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

  // Cargar sub-filas multilínea si existen (ej. Cojinetes: Biela y Bancada)
  const partSubfilas = (part.dimensiones as any)?.subfilas
  if (Array.isArray(partSubfilas) && partSubfilas.length > 0) {
    subfilasRows.value = partSubfilas.map((sf: any, idx: number) => ({
      id: sf.id || `sf-${idx}-${Date.now()}`,
      tipo: sf.tipo || (idx === 0 ? 'biela' : 'bancada'),
      nombre: sf.nombre || (idx === 0 ? 'Biela' : 'Bancada'),
      codigo: sf.codigo || '',
      medidas: sf.medidas ? { ...sf.medidas } : {}
    }))
    subfilasMarcaBanner.value = (part.dimensiones as any)?.marca_banner || ''
    subfilasAplicacionBanner.value = (part.dimensiones as any)?.aplicacion_banner || ''
  }

  // Si algún parámetro del grupo activo tiene clave con prefijo pero existía un valor bajo clave simple previa:
  if (activeGroup.value?.parametros) {
    for (const p of activeGroup.value.parametros) {
      if (loadedParams[p.clave] === undefined) {
        const rawSlug = p.etiqueta.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        const rawWithUnit = p.unidad === 'mm' ? (rawSlug.endsWith('_mm') ? rawSlug : `${rawSlug}_mm`) : rawSlug
        if (loadedParams[rawWithUnit] !== undefined) {
          loadedParams[p.clave] = loadedParams[rawWithUnit]
        }
      }
    }
  }

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

    // Sincronizar sub-filas para familias multilínea (Cojinetes: Marca, Biela, Bancada)
    if (isSubfilasGroup.value) {
      dimensionesPayload.subfilas = subfilasRows.value.map(sf => ({
        id: sf.id,
        tipo: sf.tipo,
        nombre: sf.nombre,
        codigo: sf.codigo?.trim() || '',
        medidas: { ...sf.medidas }
      }))
      dimensionesPayload.marca_banner = subfilasMarcaBanner.value.trim() || (selectedMotor.value ? getBrandName(selectedMotor.value.fabricante_id) : '')
      dimensionesPayload.aplicacion_banner = subfilasAplicacionBanner.value.trim() || (selectedMotor.value?.denominacion_venta || selectedMotor.value?.nombre_comercial || '')
    }

    // Sincronizar cotas radiales y array `anillos` para familias en tabla / anillos
    if (isGeneralTableGroup.value) {
      const d = dimensionesPayload.diametro_cilindro_mm != null 
        ? Number(dimensionesPayload.diametro_cilindro_mm) 
        : (paramValues.value.diametro_cilindro_mm != null ? Number(paramValues.value.diametro_cilindro_mm) : (props.editPart?.diametro_cilindro_mm != null ? Number(props.editPart.diametro_cilindro_mm) : null))

      const serializedRings = ringRows.value.map((r, idx) => {
        const isOil = r.tipo_aro === 'aceite' || idx === ringRows.value.length - 1
        const finalPos = (r.posicion && r.posicion.trim())
          ? r.posicion.trim()
          : getDefaultRowPosition(idx, ringRows.value.length)
        const finalIdent = r.tiene_identificador
          ? (r.identificador_texto?.trim() || activeTablaConfig.value.etiqueta_identificador || 'Especial')
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

      // Sincronizar las columnas extra de la 1ra fila en dimensionesPayload para filtros dimensionales
      for (const extParam of extraRingGroupParams.value) {
        const rowVal = ringRows.value[0]?.extra?.[extParam.clave]
        if (rowVal !== undefined && rowVal !== null && rowVal !== '' && dimensionesPayload[extParam.clave] === undefined) {
          dimensionesPayload[extParam.clave] = extParam.tipo_dato === 'numero' ? Number(rowVal) : rowVal
        }
      }

      dimensionesPayload.anillos = serializedRings

      if (isRingsGroup.value) {
        const r1 = serializedRings[0]
        const rOil = serializedRings[serializedRings.length - 1]
        const r2 = serializedRings.length >= 3 ? serializedRings[1] : null
        const r3 = serializedRings.length >= 4 ? serializedRings[2] : null

        dimensionesPayload.diametro_cilindro_mm = d
        dimensionesPayload.espesor_anillo1_mm = r1?.h1 ?? null
        dimensionesPayload.espesor_anillo2_mm = r2?.h1 ?? null
        dimensionesPayload.espesor_aceite_mm = rOil?.h1 ?? null

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
    dimensionesPayload.marca = partMarca.value.trim().toUpperCase()
    dimensionesPayload.modelo = partModelo.value.trim().toUpperCase()
    dimensionesPayload.vehiculo = `${partMarca.value.trim().toUpperCase()} ${partModelo.value.trim().toUpperCase()}`
    dimensionesPayload.ano = partAno.value.trim()

    const prevSpec = (editingPartId.value && props.editPart?.especificaciones_tecnicas)
      ? { ...(props.editPart.especificaciones_tecnicas as Record<string, unknown>) }
      : {}
    const especificacionesPayload: Record<string, unknown> = {
      ...prevSpec,
      codigos_oem_adicionales: codigosOemAdicionalesClean,
      marca: partMarca.value.trim().toUpperCase(),
      fabricantes: [partMarca.value.trim().toUpperCase()],
      modelo: partModelo.value.trim().toUpperCase(),
      vehiculo: `${partMarca.value.trim().toUpperCase()} ${partModelo.value.trim().toUpperCase()}`,
      ano: partAno.value.trim(),
      anios: partAno.value.trim()
    }

    const finalNombre = partNombre.value.trim() || 
      `${partMarca.value.trim().toUpperCase()} ${partModelo.value.trim().toUpperCase()} - ${activeGroup.value?.nombre || 'Repuesto'} (${primaryOemClean})`

    const partPayload = {
      motor_id: partMotorId.value || undefined,
      codigo_oem: primaryOemClean,
      codigos_oem_adicionales: codigosOemAdicionalesClean,
      nombre: finalNombre,
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
  partMarca.value = ''
  partModelo.value = ''
  partAno.value = ''
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
  ringRows.value = createDefaultRingRows(activeGroup.value?.tabla_config, isRingsGroup.value)
  saveErrorMessage.value = ''
  equivalencias.value = [{ marca_alterna: 'Dokuro', codigo_alterno: '', notas: '' }]
}

// =============================================================================
// TAB 2: GESTIÓN DE FAMILIAS VÍA PLANTILLAS AMIGABLES (WORKSHOP PRESETS)
// =============================================================================
const isEditMode = ref<boolean>(false)
const editingGroupId = ref<string | null>(null)
const selectedEditGroupId = ref<string>('')
const isSubmittingGroup = ref<boolean>(false)

const currentEditingGroup = computed<GrupoRepuesto | null>(() => {
  const targetId = editingGroupId.value || props.editGroupId || selectedEditGroupId.value
  if (!targetId) return null
  return catalogStore.grupos.find(g => g.id === targetId || g.codigo === targetId) || null
})

const groupNombre = computed(() => currentEditingGroup.value?.nombre || '')

const switchToCreateMode = () => {
  isEditMode.value = false
  editingGroupId.value = null
  selectedEditGroupId.value = ''
}

const loadGroupForEditing = (grp: GrupoRepuesto) => {
  isEditMode.value = true
  editingGroupId.value = grp.id
  selectedEditGroupId.value = grp.codigo || grp.id
}

const addFormSubfila = () => {
  const count = subfilasRows.value.length + 1
  subfilasRows.value.push({
    id: `sf-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    tipo: `fila_${count}`,
    nombre: `Fila ${count}`,
    codigo: '',
    medidas: {}
  })
}

const removeFormSubfila = (idx: number) => {
  if (subfilasRows.value.length <= 1) return
  subfilasRows.value.splice(idx, 1)
}

// Agrupación de parámetros para el formulario de captura de repuesto
const groupedActiveParams = computed(() => {
  if (!activeGroup.value?.parametros) return []
  const blocks: { parent: string | null; params: ParametroTecnicoDefinicion[] }[] = []
  for (const p of activeGroup.value.parametros) {
    const parent = p.columna_padre?.trim() || null
    const existing = blocks.find(b => b.parent === parent)
    if (existing) {
      existing.params.push(p)
    } else {
      blocks.push({ parent, params: [p] })
    }
  }
  return blocks
})

const subfilasActiveHeaders = computed(() => {
  if (!activeGroup.value?.parametros) {
    return { tier1: [], tier2: [], hasSubcolumns: false }
  }
  return buildNestedTableHeaders(activeGroup.value.parametros)
})

// Guardado de familia a través de FamilyTemplatePicker
const handleFamilyTemplateSave = async (payload: { data: GrupoRepuestoInsert; originalId?: string }) => {
  isSubmittingGroup.value = true
  saveErrorMessage.value = ''
  try {
    if (payload.originalId) {
      const updated = await catalogStore.updateGrupo(payload.originalId, payload.data)
      emit('group-updated', updated)
    } else {
      const created = await catalogStore.createGrupo(payload.data)
      emit('group-created', created)
    }
    emit('close')
  } catch (err: unknown) {
    console.error('Error al guardar grupo desde plantilla:', err)
    saveErrorMessage.value = 'Ocurrió un error al guardar la familia en la base de datos.'
  } finally {
    isSubmittingGroup.value = false
  }
}

// Pegado inteligente desde Excel para Matriz de Anillos (Ctrl+V)
const handleExcelPasteToRings = (e: ClipboardEvent, targetRowIdx: number = 0) => {
  const text = e.clipboardData?.getData('text')
  if (!text || (!text.includes('\t') && !text.includes('\n'))) return
  e.preventDefault()

  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return

  lines.forEach((line, offset) => {
    const rowIdx = targetRowIdx + offset
    while (rowIdx >= ringRows.value.length) {
      addRingRow()
    }
    const row = ringRows.value[rowIdx]
    if (!row) return

    const cells = line.split('\t').map(c => c.trim())
    if (cells.length === 0) return

    if (cells.length === 1) {
      const num = parseFloat(cells[0].replace(',', '.'))
      if (!isNaN(num)) row.h1 = num
    } else if (cells.length === 2) {
      const h1 = parseFloat(cells[0].replace(',', '.'))
      const a1 = parseFloat(cells[1].replace(',', '.'))
      if (!isNaN(h1)) row.h1 = h1
      if (!isNaN(a1)) row.a1 = a1
    } else if (cells.length >= 3) {
      const maybeNum0 = parseFloat(cells[0].replace(',', '.'))
      if (rowIdx === 0 && !isNaN(maybeNum0) && maybeNum0 > 30) {
        paramValues.value.diametro_cilindro_mm = maybeNum0
        const h1 = parseFloat(cells[1].replace(',', '.'))
        const a1 = parseFloat(cells[2].replace(',', '.'))
        if (!isNaN(h1)) row.h1 = h1
        if (!isNaN(a1)) row.a1 = a1
      } else {
        if (isNaN(maybeNum0) || maybeNum0 < 20) {
          row.posicion = cells[0]
        }
        const h1 = parseFloat(cells[1].replace(',', '.'))
        const a1 = parseFloat(cells[2].replace(',', '.'))
        if (!isNaN(h1)) row.h1 = h1
        if (!isNaN(a1)) row.a1 = a1
      }
    }
  })
}

// Pegado inteligente desde Excel para Matriz de Cojinetes / Subfilas (Ctrl+V)
const handleExcelPasteToSubfilas = (e: ClipboardEvent, targetSubfilaIdx: number = 0) => {
  const text = e.clipboardData?.getData('text')
  if (!text || (!text.includes('\t') && !text.includes('\n'))) return
  e.preventDefault()

  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return

  const params = activeGroup.value?.parametros || []

  lines.forEach((line, offset) => {
    const sfIdx = targetSubfilaIdx + offset
    while (sfIdx >= subfilasRows.value.length) {
      addFormSubfila()
    }
    const sf = subfilasRows.value[sfIdx]
    if (!sf) return

    const cells = line.split('\t').map(c => c.trim())
    if (cells.length === 0) return

    let colStart = 0
    if (cells.length > params.length) {
      sf.codigo = cells[0]
      colStart = 1
    }

    params.forEach((p, pIdx) => {
      const cellVal = cells[colStart + pIdx]
      if (cellVal !== undefined && cellVal !== '') {
        const num = parseFloat(cellVal.replace(',', '.'))
        sf.medidas[p.clave] = !isNaN(num) ? num : cellVal
      }
    })
  })
}

const openFamilyTabForCurrentContext = () => {
  const targetGroupCode = selectedGroupCode.value || props.editGroupId || props.preselectedGroupId || selectedEditGroupId.value
  if (targetGroupCode) {
    const grp = resolveGroupByTarget(targetGroupCode)
    if (grp) {
      loadGroupForEditing(grp)
    }
  }
  activeTab.value = 'grupo'
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

                <!-- Código OEM Principal + Adicionales y Vehículo (Marca, Modelo, Año) -->
                <div class="space-y-2.5">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-bold text-slate-700">
                        Código OEM <span class="text-rose-600 font-black">*</span>
                      </label>
                      <span class="text-[9px] text-[#004B97] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-mono font-bold">Principal</span>
                    </div>
                    <input
                      v-model="partCodigoOem"
                      @input="onPrimaryOemInput"
                      @blur="normalizeOemInputs"
                      type="text"
                      placeholder="Ej. 13011-13040, 11044-AA000..."
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

                  <!-- Vehículo: Marca, Modelo y Año (Obligatorios) -->
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <!-- Marca (Obligatoria) -->
                    <div>
                      <label class="block text-[11px] font-bold text-slate-700 mb-1">
                        Marca <span class="text-rose-600 font-black">*</span>
                      </label>
                      <input
                        v-model="partMarca"
                        list="modal-fabricantes-list"
                        type="text"
                        placeholder="Ej. TOYOTA, NISSAN..."
                        class="w-full px-2.5 py-1.5 text-xs font-bold uppercase bg-white border rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                        :class="formErrors.partMarca ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                      />
                      <datalist id="modal-fabricantes-list">
                        <option v-for="fab in catalogStore.fabricantes" :key="fab.id" :value="fab.nombre" />
                      </datalist>
                      <span v-if="formErrors.partMarca" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                        {{ formErrors.partMarca }}
                      </span>
                    </div>

                    <!-- Modelo (Obligatorio) -->
                    <div>
                      <label class="block text-[11px] font-bold text-slate-700 mb-1">
                        Modelo <span class="text-rose-600 font-black">*</span>
                      </label>
                      <input
                        v-model="partModelo"
                        list="modal-modelos-list"
                        type="text"
                        placeholder="Ej. HILUX, COROLLA..."
                        class="w-full px-2.5 py-1.5 text-xs font-bold uppercase bg-white border rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                        :class="formErrors.partModelo ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                      />
                      <datalist id="modal-modelos-list">
                        <option v-for="mod in availableModalModelos" :key="mod.id" :value="mod.nombre" />
                      </datalist>
                      <span v-if="formErrors.partModelo" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                        {{ formErrors.partModelo }}
                      </span>
                    </div>

                    <!-- Año (Obligatorio) -->
                    <div>
                      <label class="block text-[11px] font-bold text-slate-700 mb-1">
                        Año <span class="text-rose-600 font-black">*</span>
                      </label>
                      <input
                        v-model="partAno"
                        list="modal-anos-list"
                        type="text"
                        placeholder="Ej. 2015, 2005-2012..."
                        class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                        :class="formErrors.partAno ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                      />
                      <datalist id="modal-anos-list">
                        <option v-for="yr in commonYearsList" :key="yr" :value="yr" />
                      </datalist>
                      <span v-if="formErrors.partAno" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                        {{ formErrors.partAno }}
                      </span>
                    </div>
                  </div>

                  <!-- Nombre o Descripción Técnica (Opcional) -->
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">
                      Nombre o Descripción Técnica <span class="text-[10px] font-normal text-slate-400">(Opcional)</span>
                    </label>
                    <input
                      v-model="partNombre"
                      type="text"
                      :placeholder="partMarca && partModelo ? `${partMarca} ${partModelo} - ${activeGroup?.nombre || 'Repuesto'}` : 'Nombre o descripción técnica (opcional)'"
                      class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                    />
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
                    {{ isGeneralTableGroup ? `${ringRows.length} Filas` : (isSubfilasGroup ? `${subfilasRows.length} Filas` : `${activeGroup.parametros.filter(p => p.requerido).length} Medidas`) }}
                  </span>
                </div>

                <!-- A. MATRIZ TABULAR DINÁMICA GENERAL PARA FAMILIAS EN TABLA (ANILLOS Y CUALQUIER FAMILIA TABULAR) -->
                <div v-if="isGeneralTableGroup" class="space-y-3">
                  
                  <!-- Tabla de medidas compacta y 100% configurable -->
                  <div class="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs font-mono select-text">
                    <table class="border-collapse text-center text-xs w-full">
                      <thead>
                        <tr class="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                          <th class="px-3 py-2 text-left border-r border-slate-200">{{ activeTablaConfig.titulo_primera_columna || (isRingsGroup ? 'Anillo' : 'Posición') }}</th>
                          <template v-if="isRingsGroup">
                            <th class="px-2 py-2 border-r border-slate-200">{{ getActiveGroupParamLabel('diametro_cilindro_mm', 'Diámetro') }}</th>
                            <th class="px-2 py-2 border-r border-slate-200">{{ getActiveGroupParamLabel('grosor_mm', getActiveGroupParamLabel('anillo1_h1', 'Grosor')) }}</th>
                            <th class="px-2 py-2 border-r border-slate-200">{{ getActiveGroupParamLabel('altura_mm', getActiveGroupParamLabel('anillo1_a1', 'Altura')) }}</th>
                          </template>
                          <th
                            v-for="extParam in extraRingGroupParams"
                            :key="`th-ext-${extParam.id}`"
                            class="px-2 py-2 border-r border-slate-200"
                          >
                            {{ extParam.etiqueta_corta || extParam.etiqueta }}{{ extParam.unidad ? ` (${extParam.unidad})` : '' }}
                          </th>
                          <th v-if="activeTablaConfig.habilitar_identificador !== false" class="px-2.5 py-2">
                            {{ activeTablaConfig.etiqueta_identificador || (isRingsGroup ? 'Cónico' : 'Especial') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 text-[11px]">
                        <tr
                          v-for="(ring, rIdx) in ringRows"
                          @paste.stop="handleExcelPasteToRings($event, rIdx)"
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

                          <template v-if="isRingsGroup">
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
                          </template>

                          <!-- Columnas personalizadas por fila -->
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
                            <!-- Booleano (Sí / No) -->
                            <button
                              v-else-if="extParam.tipo_dato === 'booleano'"
                              type="button"
                              @click="ring.extra[extParam.clave] = !ring.extra[extParam.clave]"
                              :class="[
                                'px-2 py-0.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 mx-auto cursor-pointer select-none',
                                ring.extra[extParam.clave]
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                              ]"
                            >
                              <Check v-if="ring.extra[extParam.clave]" class="w-3 h-3 text-emerald-600" />
                              <X v-else class="w-3 h-3 text-slate-400" />
                              <span>{{ ring.extra[extParam.clave] ? 'Sí' : 'No' }}</span>
                            </button>
                            <!-- Selección (Opciones) -->
                            <select
                              v-else-if="extParam.tipo_dato === 'seleccion'"
                              v-model="ring.extra[extParam.clave]"
                              class="w-20 px-1 py-1 text-center font-sans font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            >
                              <option value="">—</option>
                              <option v-for="opt in (extParam.opciones || [])" :key="opt" :value="opt">{{ opt }}</option>
                            </select>
                            <input
                              v-else
                              v-model="ring.extra[extParam.clave]"
                              type="text"
                              placeholder="—"
                              class="w-20 px-1.5 py-1 text-center font-sans font-semibold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                          </td>

                          <!-- Identificador aparte por fila -->
                          <td v-if="activeTablaConfig.habilitar_identificador !== false" class="px-2 py-1.5 whitespace-nowrap">
                            <div class="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                @click="toggleRowIdentificador(ring)"
                                class="px-2 py-1 rounded-lg text-[10px] font-sans font-extrabold border transition flex items-center gap-1"
                                :class="ring.tiene_identificador
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'"
                                :title="`Marcar o desmarcar ${activeTablaConfig.etiqueta_identificador || 'Especial'} en esta fila`"
                              >
                                <Check v-if="ring.tiene_identificador" class="w-3 h-3 text-amber-700" />
                                <span>{{ activeTablaConfig.etiqueta_identificador || (isRingsGroup ? 'Cónico' : 'Especial') }}</span>
                              </button>
                              <input
                                v-if="ring.tiene_identificador"
                                v-model="ring.identificador_texto"
                                @input="onRowIdentificadorTextInput(ring)"
                                type="text"
                                :placeholder="activeTablaConfig.etiqueta_identificador || 'Especial'"
                                class="w-20 px-1.5 py-1 text-[10px] font-sans font-bold bg-amber-50/60 border border-amber-300 text-amber-950 rounded-lg focus:bg-white focus:outline-none focus:border-amber-500"
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
                      <span>+ Agregar {{ activeTablaConfig.titulo_primera_columna || 'Fila' }}</span>
                    </button>

                    <div v-if="isRingsGroup" class="flex items-center gap-3">
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

                <!-- A2. TABLA DE FILAS FIJAS (PLANTILLA GENERAL PARA CUALQUIER GRUPO) -->
                <div v-else-if="isSubfilasGroup" class="space-y-3.5">
                  <!-- Encabezado opcional del juego -->
                  <div v-if="activeTablaConfig.tiene_cabecera_marca" class="p-3 bg-cyan-50/60 border border-cyan-200 rounded-2xl space-y-2">
                    <div class="flex items-center justify-between border-b border-cyan-200/70 pb-1.5">
                      <span class="text-xs font-black uppercase text-[#004B97] tracking-wider">
                        Barra de Título / Aplicación del Juego
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                      <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wide text-slate-700 mb-1">
                          Marca / Título Corto
                        </label>
                        <input
                          v-model="subfilasMarcaBanner"
                          type="text"
                          placeholder="Ej. TOYOTA, NISSAN, UNIVERSAL..."
                          class="w-full px-3 py-1.5 text-center text-xs font-black tracking-wider uppercase bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] text-slate-900 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label class="block text-[10px] font-extrabold uppercase tracking-wide text-slate-700 mb-1">
                          Aplicación / Modelos
                        </label>
                        <input
                          v-model="subfilasAplicacionBanner"
                          type="text"
                          placeholder="Ej. Hilux 2.4 / 2.8, Motor 2L / 3L..."
                          class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] text-slate-800 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Tabla de Filas Fijas -->
                  <div class="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <div class="p-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-[#004B97]"></span>
                        <span class="text-xs font-black uppercase tracking-wider text-slate-800">
                          Filas de Medidas de la Tabla
                        </span>
                      </div>
                      <button
                        type="button"
                        @click="addFormSubfila"
                        class="text-[10px] font-extrabold text-[#038391] hover:text-[#004B97] bg-white px-2 py-0.5 rounded-lg border border-cyan-200 shadow-2xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus class="w-3 h-3 text-[#04C4D9]" />
                        <span>+ Agregar Fila</span>
                      </button>
                    </div>

                    <div class="overflow-x-auto">
                      <table class="w-full text-center border-collapse text-xs font-mono">
                        <!-- Cabecera de 2 niveles si hay sub-columnas -->
                        <thead v-if="subfilasActiveHeaders.hasSubcolumns">
                          <tr class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <th rowspan="2" class="px-3 py-2 text-left border-r border-slate-200 w-28 whitespace-nowrap">
                              {{ activeTablaConfig.titulo_primera_columna || 'Posición' }}
                            </th>
                            <th rowspan="2" class="px-2.5 py-2 border-r border-slate-200 w-32 whitespace-nowrap">
                              Código
                            </th>
                            <template v-for="item in subfilasActiveHeaders.tier1" :key="item.id">
                              <th
                                v-if="item.isGroup"
                                :colspan="item.colspan"
                                class="py-1 px-2 border-r border-b border-slate-200 bg-cyan-100/60 text-[#004B97] text-center font-black uppercase text-[10px]"
                              >
                                {{ item.label }}
                              </th>
                              <th
                                v-else
                                rowspan="2"
                                class="py-2 px-2 border-r border-slate-200 text-[#004B97] font-bold uppercase text-[10px] text-center whitespace-nowrap"
                              >
                                {{ item.label }}
                              </th>
                            </template>
                            <th rowspan="2" class="px-2 py-2 w-12 text-center">Acción</th>
                          </tr>
                          <tr class="bg-slate-50 text-[9px] text-slate-600 font-bold uppercase border-b border-slate-200">
                            <th
                              v-for="sub in subfilasActiveHeaders.tier2"
                              :key="sub.id"
                              class="py-1 px-1.5 text-center border-r border-slate-200 whitespace-nowrap font-mono"
                            >
                              <span>{{ sub.label }}</span>
                              <span v-if="sub.unidad" class="text-[8px] text-slate-400 font-normal ml-0.5">({{ sub.unidad }})</span>
                            </th>
                          </tr>
                        </thead>

                        <!-- Cabecera plana estándar si no hay sub-columnas -->
                        <thead v-else>
                          <tr class="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                            <th class="px-3 py-2 text-left border-r border-slate-200 w-28 whitespace-nowrap">
                              {{ activeTablaConfig.titulo_primera_columna || 'Posición' }}
                            </th>
                            <th class="px-2.5 py-2 border-r border-slate-200 w-32 whitespace-nowrap">
                              Código
                            </th>
                            <th
                              v-for="param in (activeGroup?.parametros || [])"
                              :key="`th-flat-${param.id}`"
                              class="px-2 py-2 border-r border-slate-200 whitespace-nowrap"
                            >
                              {{ param.etiqueta_corta || param.etiqueta }}{{ param.unidad ? ` (${param.unidad})` : '' }}
                            </th>
                            <th class="px-2 py-2 w-12 text-center">Acción</th>
                          </tr>
                        </thead>

                        <tbody class="divide-y divide-slate-100 text-[11px]">
                          <tr
                            v-for="(sf, sfIdx) in subfilasRows"
                            @paste.stop="handleExcelPasteToSubfilas($event, sfIdx)"
                            :key="sf.id"
                            class="hover:bg-slate-50/70 transition"
                          >
                            <td class="px-2.5 py-1.5 border-r border-slate-200 text-left bg-slate-50/50">
                              <div class="flex items-center gap-1.5">
                                <span
                                  class="w-2 h-2 rounded-full shrink-0"
                                  :class="sfIdx === 0 ? 'bg-[#004B97]' : (sfIdx === 1 ? 'bg-[#04C4D9]' : 'bg-slate-400')"
                                ></span>
                                <input
                                  v-model="sf.nombre"
                                  type="text"
                                  :placeholder="`Fila ${sfIdx + 1}`"
                                  class="w-full px-1.5 py-0.5 text-xs font-black text-slate-900 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#04C4D9] rounded focus:outline-none transition"
                                />
                              </div>
                            </td>

                            <td class="px-2 py-1.5 border-r border-slate-200">
                              <input
                                v-model="sf.codigo"
                                type="text"
                                placeholder="Código..."
                                class="w-28 px-1.5 py-1 text-center font-mono font-black text-xs uppercase bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              />
                            </td>

                            <td
                              v-for="param in (activeGroup?.parametros || [])"
                              :key="`td-sf-${sf.id}-${param.id}`"
                              class="px-1.5 py-1.5 border-r border-slate-200"
                            >
                              <input
                                v-if="param.tipo_dato === 'numero'"
                                v-model.number="sf.medidas[param.clave]"
                                type="number"
                                step="0.001"
                                placeholder="0.00"
                                class="w-20 px-1 py-1 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              />
                              <!-- Booleano (Sí / No) -->
                              <button
                                v-else-if="param.tipo_dato === 'booleano'"
                                type="button"
                                @click="sf.medidas[param.clave] = !sf.medidas[param.clave]"
                                :class="[
                                  'px-2 py-1 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 mx-auto cursor-pointer select-none',
                                  sf.medidas[param.clave]
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                                ]"
                              >
                                <Check v-if="sf.medidas[param.clave]" class="w-3 h-3 text-emerald-600" />
                                <X v-else class="w-3 h-3 text-slate-400" />
                                <span>{{ sf.medidas[param.clave] ? 'Sí' : 'No' }}</span>
                              </button>
                              <!-- Selección (Opciones) -->
                              <select
                                v-else-if="param.tipo_dato === 'seleccion'"
                                v-model="sf.medidas[param.clave]"
                                class="w-24 px-1 py-1 text-center font-sans font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              >
                                <option value="">—</option>
                                <option v-for="opt in (param.opciones || [])" :key="opt" :value="opt">{{ opt }}</option>
                              </select>
                              <input
                                v-else
                                v-model="sf.medidas[param.clave]"
                                type="text"
                                placeholder="—"
                                class="w-20 px-1 py-1 text-center font-sans font-semibold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              />
                            </td>

                            <td class="px-2 py-1.5 text-center">
                              <button
                                v-if="subfilasRows.length > 1"
                                type="button"
                                @click="removeFormSubfila(sfIdx)"
                                class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                :title="`Eliminar ${sf.nombre || 'esta fila'}`"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- B. GRINTA DINÁMICA DE PARÁMETROS PARA OTRAS FAMILIAS (CON SOPORTE DE SUB-COLUMNAS) -->
                <div v-else-if="activeGroup && activeGroup.parametros.length > 0" class="space-y-3">
                  <div 
                    v-for="block in groupedActiveParams" 
                    :key="block.parent || 'standalone'"
                    :class="block.parent ? 'p-3 bg-blue-50/40 rounded-2xl border border-blue-200/80 space-y-2.5' : ''"
                  >
                    <!-- Encabezado de Agrupación de Sub-columnas si aplica -->
                    <div v-if="block.parent" class="flex items-center justify-between pb-1.5 border-b border-blue-200/70">
                      <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#004B97]"></span>
                        <span class="text-xs font-black uppercase text-[#004B97] font-mono tracking-wider">
                          {{ block.parent }}
                        </span>
                        <span class="text-[9px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-1.5 py-0.2 rounded-full">
                          {{ block.params.length }} Sub-columnas
                        </span>
                      </div>
                      <span class="text-[10px] text-slate-500 font-sans font-medium">Medidas agrupadas para rectificación</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" :class="block.parent ? 'pt-0.5' : ''">
                      <div 
                        v-for="param in block.params" 
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
        <!-- PESTAÑA 2: SELECTOR Y DISEÑADOR AMIGABLE DE FAMILIAS (PLANTILLAS) -->
        <!-- ----------------------------------------------------------------- -->
        <div v-else class="p-1 sm:p-2">
          <FamilyTemplatePicker
            :existing-groups="catalogStore.grupos"
            :editing-group="currentEditingGroup"
            :is-saving="isSubmittingGroup"
            @save="handleFamilyTemplateSave"
            @cancel="emit('close')"
          />
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
      <div v-if="activeTab === 'repuesto'" class="px-5 sm:px-7 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
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

          
        </div>
      </div>

    </div>
  </div>
</template>
