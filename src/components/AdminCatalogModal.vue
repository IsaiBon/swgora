<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import PartImageUploader from '@/components/catalog/PartImageUploader.vue'
import { 
  type GrupoRepuesto, 
  type ParametroTecnicoDefinicion,
  type RepuestoTecnico,
  type Motor
} from '@/services/catalogService'
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  SlidersHorizontal, 
  Sparkles, 
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
  CheckCircle2,
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
  tipo_aro: 'fuego' | 'compresion' | 'aceite'
  h1: number | null
  a1: number | null
  perfil: string
}

const createDefaultRingRows = (): RingFormRow[] => [
  { id: 'ring-1', tipo_aro: 'fuego', h1: null, a1: null, perfil: 'Plano' },
  { id: 'ring-2', tipo_aro: 'compresion', h1: null, a1: null, perfil: 'Plano' },
  { id: 'ring-oil', tipo_aro: 'aceite', h1: null, a1: null, perfil: 'Estándar' }
]

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
    if (props.initialTab) activeTab.value = props.initialTab
    if (props.editPart) {
      loadPartForEditing(props.editPart)
    } else {
      resetPartForm()
      const resolvedPre = resolveGroupByTarget(props.editGroupId || props.preselectedGroupId)
      if (resolvedPre) {
        selectedGroupCode.value = resolvedPre.codigo
      } else if (props.preselectedGroupId) {
        selectedGroupCode.value = props.preselectedGroupId
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

    const targetGroup = props.editGroupId || props.preselectedGroupId || selectedGroupCode.value
    if (targetGroup) {
      const grp = resolveGroupByTarget(targetGroup)
      if (grp) {
        selectedGroupCode.value = grp.codigo
        selectedEditGroupId.value = grp.codigo || grp.id
        if (props.editGroupId || props.initialTab === 'grupo') {
          activeTab.value = 'grupo'
          loadGroupForEditing(grp)
        }
      }
    }
  } else {
    saveErrorMessage.value = ''
    showDeleteConfirm.value = false
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

const addRingRow = () => {
  const oilIdx = ringRows.value.findIndex(r => r.tipo_aro === 'aceite')
  const newRing: RingFormRow = {
    id: `ring-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    tipo_aro: 'compresion',
    h1: null,
    a1: null,
    perfil: 'Plano'
  }
  if (oilIdx >= 0) {
    ringRows.value.splice(oilIdx, 0, newRing)
  } else {
    ringRows.value.push(newRing)
  }
  hasThirdRing.value = ringRows.value.length >= 4
}

const removeRingRow = (idx: number) => {
  if (ringRows.value.length <= 2) return
  const target = ringRows.value[idx]
  if (!target || target.tipo_aro === 'fuego' || target.tipo_aro === 'aceite') return
  if (idx === 1 && ringRows.value.filter(r => r.tipo_aro === 'compresion').length <= 1) {
    // Permitir eliminar aros intermedios desde el 2do aro si hay más aros o si desea configuración de 2 aros
  }
  ringRows.value.splice(idx, 1)
  hasThirdRing.value = ringRows.value.length >= 4
}

const getRingProfileOptions = (row: RingFormRow, idx: number): string[] => {
  if (row.tipo_aro === 'fuego' || idx === 0) {
    return ['Plano', 'Cónico / Keystone', 'Semi-cónico']
  }
  if (row.tipo_aro === 'aceite' || idx === ringRows.value.length - 1) {
    return ['Estándar', '1 Espiral', 'Doble Espiral']
  }
  if (idx === 1) {
    return ['Plano', 'Cónico / Keystone', 'Raspador con escalón']
  }
  return ['Plano', 'Cónico / Keystone', 'Escalonado']
}

const getRingRowTitle = (row: RingFormRow, idx: number): string => {
  if (row.tipo_aro === 'fuego' || idx === 0) return '1° Anillo (Fuego)'
  if (row.tipo_aro === 'aceite' || idx === ringRows.value.length - 1) return 'Anillo de Aceite'
  return `${idx + 1}° Anillo (Compresión)`
}

const getRingRowSubtitle = (row: RingFormRow, idx: number): string => {
  if (row.tipo_aro === 'fuego' || idx === 0) return 'Fuego / Top'
  if (row.tipo_aro === 'aceite' || idx === ringRows.value.length - 1) return 'Rascador / Expansor'
  if (idx === 1) return 'Compresión / Raspador'
  return 'Compresión Extra / Diésel'
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

const activeGroup = computed<GrupoRepuesto | null>(() => {
  if (!selectedGroupCode.value) return null
  return catalogStore.grupos.find(g => g.codigo === selectedGroupCode.value || g.id === selectedGroupCode.value) || null
})

const isRingsGroup = computed<boolean>(() => {
  if (!activeGroup.value) return false
  const code = (activeGroup.value.codigo || '').toLowerCase()
  const cat = (activeGroup.value.categoria || '').toLowerCase()
  return code === 'anillos_motor' || code.includes('anillo') || cat === 'anillos' || cat.includes('anillo')
})

// Al cambiar de grupo, inicializar los campos de parámetros técnicos y subsistema
watch(activeGroup, (grp) => {
  if (grp) {
    partSubsistema.value = grp.subsistema || 'Block'
    selectedEditGroupId.value = grp.codigo || grp.id
    if (!isEditPartMode.value) {
      paramValues.value = {}
      hasThirdRing.value = false
      ringRows.value = createDefaultRingRows()
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

  partCodigoOem.value = part.codigo_oem || ''
  const rawAddOem =
    part.codigos_oem_adicionales ||
    (part.especificaciones_tecnicas as any)?.codigos_oem_adicionales ||
    (part.dimensiones as any)?.codigos_oem_adicionales ||
    (part.especificaciones_tecnicas as any)?.referencias_oem ||
    []
  partCodigosOemAdicionales.value = Array.isArray(rawAddOem)
    ? rawAddOem
        .map(c => String(c || '').trim().toUpperCase())
        .filter(c => c.length > 0 && c !== (part.codigo_oem || '').trim().toUpperCase())
    : []

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
      let perfil = ri.perfil || ri.forma || ''
      if (!perfil) {
        if (idx === 0) perfil = isPartConico ? 'Cónico / Keystone' : 'Plano'
        else if (isLast) perfil = 'Estándar'
        else perfil = 'Plano'
      }
      return {
        id: `ring-${idx}-${Date.now()}`,
        tipo_aro: tipoAro,
        h1: ri.h1 != null ? Number(ri.h1) : null,
        a1: ri.a1 != null ? Number(ri.a1) : null,
        perfil
      }
    })
    hasThirdRing.value = ringRows.value.length >= 4
  } else {
    const builtRows: RingFormRow[] = [
      {
        id: 'ring-1',
        tipo_aro: 'fuego',
        h1: loadedParams.espesor_anillo1_mm ?? null,
        a1: (part.dimensiones as any)?.espesor_radial1_mm ?? (part.dimensiones as any)?.altura_radial1_mm ?? null,
        perfil: isPartConico ? 'Cónico / Keystone' : 'Plano'
      },
      {
        id: 'ring-2',
        tipo_aro: 'compresion',
        h1: loadedParams.espesor_anillo2_mm ?? null,
        a1: (part.dimensiones as any)?.espesor_radial2_mm ?? (part.dimensiones as any)?.altura_radial2_mm ?? null,
        perfil: 'Plano'
      }
    ]
    if ((part.dimensiones as any)?.espesor_anillo3_mm != null || part.espesor_anillo3_mm != null) {
      builtRows.push({
        id: 'ring-3',
        tipo_aro: 'compresion',
        h1: loadedParams.espesor_anillo3_mm ?? (part.dimensiones as any)?.espesor_anillo3_mm ?? null,
        a1: (part.dimensiones as any)?.espesor_radial3_mm ?? (part.dimensiones as any)?.altura_radial3_mm ?? null,
        perfil: 'Plano'
      })
    }
    builtRows.push({
      id: 'ring-oil',
      tipo_aro: 'aceite',
      h1: loadedParams.espesor_aceite_mm ?? null,
      a1: (part.dimensiones as any)?.espesor_radial_aceite_mm ?? (part.dimensiones as any)?.altura_radial_aceite_mm ?? null,
      perfil: 'Estándar'
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

const switchToCreatePartMode = () => {
  resetPartForm()
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

    // Sincronizar cotas radiales y array `anillos` para familias de anillos
    if (isRingsGroup.value) {
      const d = dimensionesPayload.diametro_cilindro_mm != null 
        ? Number(dimensionesPayload.diametro_cilindro_mm) 
        : (paramValues.value.diametro_cilindro_mm != null ? Number(paramValues.value.diametro_cilindro_mm) : (props.editPart?.diametro_cilindro_mm != null ? Number(props.editPart.diametro_cilindro_mm) : null))

      const serializedRings = ringRows.value.map((r, idx) => {
        const isOil = r.tipo_aro === 'aceite' || idx === ringRows.value.length - 1
        return {
          posicion: isOil ? 'Anillo de aceite' : `Anillo ${idx + 1}`,
          tipo_aro: isOil ? 'aceite' : (idx === 0 ? 'fuego' : 'compresion'),
          d1: d,
          h1: r.h1 != null && !isNaN(Number(r.h1)) ? Number(r.h1) : null,
          a1: r.a1 != null && !isNaN(Number(r.a1)) ? Number(r.a1) : null,
          perfil: r.perfil,
          forma: r.perfil
        }
      })

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

    const primaryOemClean = partCodigoOem.value.trim().toUpperCase()
    const codigosOemAdicionalesClean = Array.from(
      new Set(
        partCodigosOemAdicionales.value
          .map(c => c.trim().toUpperCase())
          .filter(c => c.length > 0 && c !== primaryOemClean)
      )
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
const soloFiltrosEnTabla = ref<boolean>(false)

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
  soloFiltrosEnTabla.value = false
  dynamicParams.value = [
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

// Cargar plantilla predefinida: Camisas de Cilindro
const loadTemplateCamisas = () => {
  groupNombre.value = 'Camisas de Cilindro'
  groupCategoria.value = 'Camisas'
  groupSubsistema.value = 'Block'
  subsistemaSearch.value = 'Block'
  groupDescripcion.value = 'Camisas de cilindro secas, cromadas y con pestaña para encamisado y rectificación de block'
  groupIcono.value = 'Layers'
  dynamicParams.value = [
    {
      id: `param-${Date.now()}-1`,
      etiqueta: 'Diámetro Interior (Alesado)',
      etiqueta_corta: 'A (Int)',
      clave: 'diametro_interior_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro interno semiterminado o terminado',
      decimales: 2,
      mostrar_unidad: true,
      valor_muestra: 85.00
    },
    {
      id: `param-${Date.now()}-2`,
      etiqueta: 'Diámetro Exterior',
      etiqueta_corta: 'B (Ext)',
      clave: 'diametro_exterior_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro externo para ajuste en el túnel del cilindro',
      decimales: 2,
      mostrar_unidad: true,
      valor_muestra: 89.00
    },
    {
      id: `param-${Date.now()}-3`,
      etiqueta: 'Longitud Total',
      etiqueta_corta: 'C (Largo)',
      clave: 'longitud_total_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Largo total de la camisa',
      decimales: 1,
      mostrar_unidad: true,
      valor_muestra: 165.0
    },
    {
      id: `param-${Date.now()}-4`,
      etiqueta: 'Pestaña (D × E)',
      etiqueta_corta: 'Pestaña',
      clave: 'pestana_diametro_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: false,
      descripcion: 'Diámetro y espesor de la pestaña superior',
      decimales: 2,
      mostrar_unidad: true,
      valor_muestra: 94.00
    }
  ]
}

// Cargar plantilla predefinida: Pistones y Bulones
const loadTemplatePistones = () => {
  groupNombre.value = 'Pistones de Motor'
  groupCategoria.value = 'Pistones'
  groupSubsistema.value = 'Bielas'
  subsistemaSearch.value = 'Bielas'
  groupDescripcion.value = 'Pistones con perno y pistas de anillos para maquinado de motor'
  groupIcono.value = 'CircleDot'
  dynamicParams.value = [
    {
      id: `param-${Date.now()}-1`,
      etiqueta: 'Diámetro de Pistón',
      etiqueta_corta: 'Ø Pistón',
      clave: 'diametro_piston_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro de la falda del pistón',
      decimales: 2,
      mostrar_unidad: true,
      valor_muestra: 84.95
    },
    {
      id: `param-${Date.now()}-2`,
      etiqueta: 'Diámetro de Pasador (Bulón)',
      etiqueta_corta: 'Ø Bulón',
      clave: 'diametro_bulon_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Diámetro exterior del perno de biela',
      decimales: 2,
      mostrar_unidad: true,
      valor_muestra: 22.00
    },
    {
      id: `param-${Date.now()}-3`,
      etiqueta: 'Altura de Compresión',
      etiqueta_corta: 'Alt. Comp.',
      clave: 'altura_compresion_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: true,
      descripcion: 'Distancia de centro de bulón a cabeza de pistón',
      decimales: 2,
      mostrar_unidad: true,
      valor_muestra: 34.50
    },
    {
      id: `param-${Date.now()}-4`,
      etiqueta: 'Largo Total',
      etiqueta_corta: 'Largo',
      clave: 'largo_piston_mm',
      unidad: 'mm',
      tipo_dato: 'numero',
      requerido: false,
      descripcion: 'Longitud total de falda a cabeza',
      decimales: 1,
      mostrar_unidad: true,
      valor_muestra: 65.0
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
          <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <SlidersHorizontal class="w-5 h-5 text-[#04C4D9]" />
            {{ isEditPartMode && activeTab === 'repuesto' ? 'Editar Repuesto' : (isEditMode && activeTab === 'grupo' ? 'Editar Familia' : (activeTab === 'repuesto' ? 'Nuevo Repuesto' : 'Nueva Familia')) }}
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
                <p class="text-[10px] text-slate-500 font-medium">
                  Actualice cotas dimensionales, motor asociado o equivalencias multimarca.
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="switchToCreatePartMode"
              class="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition shrink-0 shadow-2xs hover:border-[#04C4D9]"
              title="Limpiar formulario para dar de alta un repuesto nuevo"
            >
              + Nuevo Repuesto
            </button>
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
                    type="button"
                    @click="openFamilyTabForCurrentContext"
                    class="text-[10px] font-bold text-[#038391] hover:text-[#004B97] transition"
                  >
                    + Gestionar Familias
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-1.5">
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
                  <div>
                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Tag class="w-3.5 h-3.5 text-[#004B97]" />
                      <span>Códigos Originales del Fabricante (OEM)</span>
                    </h3>
                    <p class="text-[10px] text-slate-500 font-medium">
                      Códigos originales de fábrica (separados de cruces multimarca alternos)
                    </p>
                  </div>
                  <button
                    type="button"
                    @click="addCodigoOemAdicional"
                    class="text-[10px] font-extrabold text-[#004B97] hover:text-[#038391] flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-cyan-200 shadow-2xs transition shrink-0"
                  >
                    <Plus class="w-3 h-3 text-[#04C4D9]" />
                    <span>+ Agregar Código Original</span>
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
                      type="text"
                      placeholder="Ej. 11701-54030, 13011-28010"
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
                        type="text"
                        placeholder="Ej. 11701-54040 (Otro código original de fábrica)"
                        class="flex-1 px-2.5 py-1.5 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                      />
                      <button
                        type="button"
                        @click="removeCodigoOemAdicional(oemIdx)"
                        class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                        title="Quitar código OEM adicional"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">
                      Nombre o Descripción Técnica <span class="text-rose-600 font-black">*</span>
                    </label>
                    <input
                      v-model="partNombre"
                      type="text"
                      placeholder="Ej. Juego de Aros STD Toyota 3L / 5L"
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
                      placeholder="Buscar motor (ej. 3L, Z24, 4JB1, Hilux)..."
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
                  hint="Opcional. Optimizado para visualización rápida en taller."
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
                      <p class="text-[10px] text-slate-500 font-medium">
                        {{ isRingsGroup ? 'Matriz tabular por posición de ranura de pistón' : (activeGroup?.nombre || 'Medidas requeridas') }}
                      </p>
                    </div>
                  </div>

                  <span v-if="activeGroup" class="text-[10px] font-extrabold text-[#004B97] bg-white border border-cyan-200 px-2 py-0.5 rounded-full">
                    {{ isRingsGroup ? `${ringRows.length} Aros Configurados` : `${activeGroup.parametros.filter(p => p.requerido).length} Obligatorios` }}
                  </span>
                </div>

                <!-- A. MATRIZ TABULAR DINÁMICA PARA ANILLOS DE MOTOR (3, 4, 5 O 6+ AROS) -->
                <div v-if="isRingsGroup" class="space-y-3">
                  
                  <!-- Tabla de medidas compacta -->
                  <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs font-mono select-text">
                    <table class="border-collapse text-center text-xs w-full">
                      <thead>
                        <tr class="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                          <th class="px-3 py-2 text-left border-r border-slate-200">Ranura / Posición</th>
                          <th class="px-2 py-2 border-r border-slate-200">
                            <span>Diámetro (d1)</span>
                            <span class="block text-[9px] text-slate-400 font-normal">Calibre mm *</span>
                          </th>
                          <th class="px-2 py-2 border-r border-slate-200">
                            <span>Grosor (h1)</span>
                            <span class="block text-[9px] text-slate-400 font-normal">Axial mm *</span>
                          </th>
                          <th class="px-2 py-2 border-r border-slate-200">
                            <span>Radial (a1)</span>
                            <span class="block text-[9px] text-slate-400 font-normal">Espesor mm</span>
                          </th>
                          <th class="px-2.5 py-2">
                            <span>Perfil / Expansor</span>
                            <span class="block text-[9px] text-slate-400 font-normal">Geometría</span>
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
                            rIdx >= 2 && ring.tipo_aro !== 'aceite' ? 'bg-amber-50/20' : ''
                          ]"
                        >
                          <!-- Ranura / Posición -->
                          <td class="px-3 py-1.5 bg-slate-50/80 font-bold text-slate-800 border-r border-slate-200 text-left whitespace-nowrap">
                            <div class="flex items-center justify-between gap-1.5">
                              <div class="flex items-center gap-1.5">
                                <span
                                  class="w-2 h-2 rounded-full shrink-0"
                                  :class="ring.tipo_aro === 'aceite' ? 'bg-[#04C4D9]' : (rIdx >= 2 ? 'bg-amber-500' : 'bg-[#004B97]')"
                                ></span>
                                <strong class="font-extrabold text-slate-900">{{ getRingRowTitle(ring, rIdx) }}</strong>
                              </div>
                              <button
                                v-if="ring.tipo_aro !== 'fuego' && ring.tipo_aro !== 'aceite' && ringRows.length > 2"
                                type="button"
                                @click="removeRingRow(rIdx)"
                                class="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                :title="`Quitar ${getRingRowTitle(ring, rIdx)}`"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span class="text-[9px] text-slate-500 font-normal">{{ getRingRowSubtitle(ring, rIdx) }}</span>
                          </td>

                          <!-- Diámetro común STD (Editable en 1er aro, heredado en los demás) -->
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
                              :placeholder="ring.tipo_aro === 'aceite' ? '3.000' : '1.500'"
                              class="w-18 px-1.5 py-1 text-center font-mono font-bold text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              :class="formErrors[`ring_h1_${rIdx}`] ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-300' : 'border-slate-300'"
                            />
                          </td>

                          <!-- Radial a1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="ring.a1"
                              type="number"
                              step="0.01"
                              :placeholder="ring.tipo_aro === 'aceite' ? '2.80' : '3.40'"
                              class="w-16 px-1.5 py-1 text-center font-mono font-medium text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                          </td>

                          <!-- Selector de Perfil Geométrico / Tipo de Expansor -->
                          <td class="px-2 py-1.5 whitespace-nowrap">
                            <select
                              v-model="ring.perfil"
                              class="w-full min-w-[130px] px-2 py-1 rounded-lg text-[10px] font-sans font-extrabold transition border focus:outline-none focus:border-[#04C4D9]"
                              :class="(ring.perfil || '').toLowerCase().includes('cónico') || (ring.perfil || '').toLowerCase().includes('keystone')
                                ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                                : ((ring.perfil || '').toLowerCase().includes('espiral') || (ring.perfil || '').toLowerCase().includes('escalon') || (ring.perfil || '').toLowerCase().includes('raspador')
                                  ? 'bg-cyan-50 text-[#004B97] border-cyan-300'
                                  : 'bg-slate-50 text-slate-700 border-slate-200')"
                            >
                              <option
                                v-for="opt in getRingProfileOptions(ring, rIdx)"
                                :key="opt"
                                :value="opt"
                              >
                                {{ opt }}
                              </option>
                            </select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- Controles auxiliares bajo la tabla: + Agregar Anillo (5 o 6+ aros) -->
                  <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        @click="addRingRow"
                        class="px-3 py-1 rounded-lg text-[11px] font-extrabold text-[#004B97] bg-white border border-cyan-300 hover:bg-cyan-50 transition flex items-center gap-1 shadow-2xs"
                      >
                        <Plus class="w-3.5 h-3.5 text-[#04C4D9]" />
                        <span>+ Agregar Anillo</span>
                      </button>
                      <span class="text-[10px] font-bold text-slate-500">
                        Soporta 3, 4, 5 o 6+ aros (Diésel pesado / Compresores)
                      </span>
                    </div>

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

                <!-- B. GRINTA DINÁMICA DE PARÁMETROS PARA OTRAS FAMILIAS (VÁLVULAS, SELLOS, PERNOS, ETC.) -->
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
                        :placeholder="`Valor en ${param.unidad || 'mm'}`"
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
                        placeholder="Texto descriptivo"
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

              <!-- 2. Bloque B: Equivalencias Multimarca Alternas (Compacto en la Columna Derecha) -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#004B97]"></span>
                      <h3 class="text-xs font-black uppercase tracking-wider text-slate-800">
                        Equivalencias Multimarca Alternas
                      </h3>
                    </div>
                    <p class="text-[10px] text-slate-500 font-medium">
                      NDC, Taiho, Dokuro, RIK, NPR, Ajusa, Pioneer (No mezclar con códigos OEM originales)
                    </p>
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
                      placeholder="Código alterno (ej. 20002)"
                      class="flex-1 px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] uppercase"
                    />

                    <input
                      v-model="eq.notas"
                      type="text"
                      placeholder="Notas (ej. STD Japón)"
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
                      <span>+ Otra marca no listada (ej. Mahle, Teikin, TP)</span>
                    </button>
                    <div v-else class="flex items-center gap-1.5 pt-1">
                      <input
                        v-model="newBrandInputName"
                        type="text"
                        placeholder="Nombre de la nueva marca..."
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

          <!-- Selector de Modo: Crear Nuevo vs Modificar Existente -->
          <div class="bg-slate-100 p-2 sm:p-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-slate-200">
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
          <div v-if="isEditMode && editingGroupId" class="bg-cyan-50 border border-cyan-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Edit3 class="w-4 h-4 text-[#038391]" />
              <span class="text-xs text-[#038391] font-bold">
                Editando familia: <strong>{{ groupNombre }}</strong> (Código: {{ editingGroupId }}). Las modificaciones se sincronizan en tiempo real con la portada.
              </span>
            </div>
            <button
              type="button"
              @click="switchToCreateMode"
              class="text-[11px] font-bold text-cyan-800 underline hover:text-cyan-900 shrink-0"
            >
              Cambiar a crear nueva
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
                  <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Paso 1</span>
                </div>

                <div class="space-y-3">
                  <!-- Nombre de Grupo (Obligatorio) -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-xs font-bold text-slate-800">
                        Nombre de Grupo / Familia <span class="text-rose-500">*</span>
                      </label>
                      <span class="text-[10px] text-rose-500 font-bold">Obligatorio</span>
                    </div>
                    <input
                      v-model="groupNombre"
                      type="text"
                      placeholder="Ej. Camisas de Cilindro"
                      class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] transition"
                      :class="groupErrors.groupNombre ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                    />
                    <span v-if="groupErrors.groupNombre" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                      {{ groupErrors.groupNombre }}
                    </span>
                  </div>

                  <!-- Categoría Técnica (Obligatorio) -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-xs font-bold text-slate-800">
                        Categoría Técnica <span class="text-rose-500">*</span>
                      </label>
                      <span class="text-[10px] text-rose-500 font-bold">Obligatorio</span>
                    </div>
                    <input
                      v-model="groupCategoria"
                      type="text"
                      placeholder="Ej. Camisas, Pistones, Válvulas"
                      class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] transition"
                    />
                  </div>

                  <!-- Subsistema Mecánico (Creatable Combobox / Opcional) -->
                  <div class="relative">
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-xs font-bold text-slate-800">
                        Subsistema Mecánico
                      </label>
                      <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        Opcional
                      </span>
                    </div>

                    <div class="relative flex items-center">
                      <input
                        v-model="subsistemaSearch"
                        @focus="isSubsistemaOpen = true"
                        @input="isSubsistemaOpen = true"
                        @keydown.enter.prevent="isCustomSubsistemaCandidate ? handleCreateAndSelectSubsistema() : (filteredSubsistemas[0] ? handleSelectSubsistema(filteredSubsistemas[0]) : null)"
                        type="text"
                        placeholder="Escribe o selecciona subsistema (Block, Culata...)"
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
                      placeholder="Notas y especificaciones técnicas de la familia..."
                      class="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] transition resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- 2. GESTOR DE PARÁMETROS -->
              <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3.5">
                <div class="flex items-center justify-between border-b pb-2.5 border-slate-100">
                  <div>
                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <SlidersHorizontal class="w-4 h-4 text-[#04C4D9]" />
                      <span>Gestor de Parámetros</span>
                    </h3>
                    <p class="text-[10px] text-slate-500 mt-0.5">
                      Las cotas obligatorias se proyectan como columnas fijas en la portada.
                    </p>
                  </div>
                  <button
                    type="button"
                    @click="addParamRow"
                    class="px-3 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-2xs shrink-0 active:scale-95"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>+ Medida</span>
                  </button>
                </div>

                <!-- Plantillas Rápidas -->
                <div v-if="!isEditMode" class="bg-amber-50/60 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
                  <span class="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Sparkles class="w-3.5 h-3.5 text-amber-600" />
                    Plantillas:
                  </span>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      @click="loadTemplateCamisas"
                      class="px-2.5 py-0.5 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-amber-100 transition shadow-2xs"
                    >
                      Camisas
                    </button>
                    <button
                      type="button"
                      @click="loadTemplatePistones"
                      class="px-2.5 py-0.5 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-900 hover:bg-amber-100 transition shadow-2xs"
                    >
                      Pistones
                    </button>
                  </div>
                </div>

                <!-- Opción Global: Ocultar en filtros los que no se muestren en la tabla -->
                <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl transition-all">
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[#038391] shrink-0">
                      <Filter class="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div class="text-xs font-black text-slate-800">
                        Ocultar en filtros los que no se muestren en la tabla
                      </div>
                      <div class="text-[10px] text-slate-500">
                        Las cotas fuera de tabla se excluyen automáticamente de los filtros en portada.
                      </div>
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

                    <!-- Fila de Campos del Parámetro -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <!-- Nombre / Etiqueta y Abreviatura en Tabla -->
                      <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Nombre / Etiqueta *</label>
                        <input
                          v-model="param.etiqueta"
                          @input="handleParamLabelChange(param)"
                          type="text"
                          placeholder="Ej. Diámetro Interior (A)"
                          class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>

                      <div>
                        <div class="flex items-center justify-between mb-1">
                          <label class="block text-[11px] font-bold text-slate-700">Abreviatura (Tabla)</label>
                          <span class="text-[9px] text-slate-400">Ej. Ø Int, A (Int)</span>
                        </div>
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

                      <!-- Unidad de Medida -->
                      <div>
                        <label class="block text-[11px] font-bold text-slate-700 mb-1">Unidad</label>
                        <select
                          v-model="param.unidad"
                          @change="handleParamUnitChange(param)"
                          class="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                        >
                          <option value="mm">mm (Milímetros)</option>
                          <option value="°">° (Grados)</option>
                          <option value="pulgadas">pulgadas</option>
                          <option value="piezas">piezas</option>
                          <option value="Nm">Nm</option>
                          <option value="">Sin unidad</option>
                        </select>
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
                          placeholder="Admisión, Escape ó STD, Cónico"
                          class="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-cyan-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#04C4D9]"
                        />
                      </div>

                      <!-- Descripción -->
                      <div class="sm:col-span-2">
                        <label class="block text-[10px] font-bold text-slate-600 mb-1">Ayuda / Descripción Técnica</label>
                        <input
                          v-model="param.descripcion"
                          type="text"
                          placeholder="Ej. Cota nominal tomada con micrómetro de exteriores"
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
                      <p class="text-[10px] text-slate-400">
                        Así se presentará la familia <strong>{{ groupNombre || 'Nueva Familia' }}</strong> en el catálogo.
                      </p>
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
                    <span class="text-[10px] font-mono text-slate-500">
                      Barra superior sticky
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

                    <span class="text-[10px] text-slate-400">
                      💡 Haz clic en <strong>encabezado</strong> para abreviar o en <strong>celda</strong> para cambiar formato
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
                          <td class="py-2.5 px-2.5 border-r border-slate-800/70 text-slate-200 font-mono font-bold align-middle whitespace-nowrap">
                            <div class="flex items-center gap-1.5">
                              <span>13011-54020</span>
                              <Copy class="w-3 h-3 text-slate-500 cursor-pointer hover:text-slate-300" title="Copiar código" />
                            </div>
                          </td>

                          <!-- 3. CATÁLOGOS ALTERNOS -->
                          <td class="py-2.5 px-2.5 border-r border-slate-800/70 align-middle whitespace-nowrap font-sans">
                            <span class="text-[10px] text-slate-500 italic">Sin cruces</span>
                          </td>

                          <!-- 4. COTAS / MEDIDAS AGRUPADAS (Badges horizontales idénticos a Imagen 3) -->
                          <td class="py-2.5 px-3 border-r border-slate-800/70 align-middle">
                            <div class="flex flex-wrap items-center gap-1.5">
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
                            <div class="flex flex-wrap items-center gap-1.5">
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

                  <!-- Banner Informativo del Formato y Reglas -->
                  <div class="p-3 bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 class="w-4 h-4 text-[#04C4D9] shrink-0" />
                      <span class="text-[11px]">
                        Alineación con <strong>tabular-nums</strong> y visualización en tiempo real de columnas fijas.
                      </span>
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono shrink-0">
                      Auto-sync Portada v2.0
                    </span>
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
