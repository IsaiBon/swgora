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
  Eye
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
  (e: 'group-created', group: GrupoRepuesto): void
  (e: 'group-updated', group: GrupoRepuesto): void
}>()

const catalogStore = useCatalogStore()

// Pestaña activa ('repuesto' | 'grupo')
const activeTab = ref<'repuesto' | 'grupo'>(props.initialTab || 'repuesto')

const isEditPartMode = ref<boolean>(false)
const editingPartId = ref<string | null>(null)
const hasThirdRing = ref<boolean>(false)
const saveErrorMessage = ref<string>('')

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
    if (props.initialTab) activeTab.value = props.initialTab
    if (props.editPart) {
      loadPartForEditing(props.editPart)
    } else {
      resetPartForm()
      if (props.preselectedGroupId) {
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

    if (props.editGroupId) {
      const grp = catalogStore.grupos.find(g => g.codigo === props.editGroupId || g.id === props.editGroupId)
      if (grp) {
        activeTab.value = 'grupo'
        loadGroupForEditing(grp)
      }
    }
  } else {
    saveErrorMessage.value = ''
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
const partNombre = ref<string>('')
const partSubsistema = ref<string>('Block')
const partPrecio = ref<number | null>(null)
const partStock = ref<number>(12)
const partEstado = ref<'Disponible' | 'Bajo Stock' | 'Agotado'>('Disponible')
const partCatalogoOrigen = ref<string>('OEM')
const partImagenUrl = ref<string>('')

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
    if (!isEditPartMode.value) {
      paramValues.value = {}
      hasThirdRing.value = false
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

    const h1Val = paramValues.value.espesor_anillo1_mm
    if (h1Val === null || h1Val === undefined || h1Val === '' || isNaN(Number(h1Val)) || Number(h1Val) <= 0) {
      errors.espesor_anillo1_mm = 'El grosor h1 del 1° Anillo es obligatorio'
    }

    const h2Val = paramValues.value.espesor_anillo2_mm
    if (h2Val === null || h2Val === undefined || h2Val === '' || isNaN(Number(h2Val)) || Number(h2Val) <= 0) {
      errors.espesor_anillo2_mm = 'El grosor h1 del 2° Anillo es obligatorio'
    }

    if (hasThirdRing.value) {
      const h3Val = paramValues.value.espesor_anillo3_mm
      if (h3Val === null || h3Val === undefined || h3Val === '' || isNaN(Number(h3Val)) || Number(h3Val) <= 0) {
        errors.espesor_anillo3_mm = 'El grosor h1 del 3° Anillo es obligatorio'
      }
    }

    const hoilVal = paramValues.value.espesor_aceite_mm
    if (hoilVal === null || hoilVal === undefined || hoilVal === '' || isNaN(Number(hoilVal)) || Number(hoilVal) <= 0) {
      errors.espesor_aceite_mm = 'El grosor h1 del Anillo de Aceite es obligatorio'
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

  partCodigoOem.value = part.codigo_oem || ''
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
  if (ringItems.length >= 4 || (part.dimensiones as any)?.espesor_anillo3_mm != null || part.espesor_anillo3_mm != null) {
    hasThirdRing.value = true
  } else {
    hasThirdRing.value = false
  }

  if (ringItems.length > 0) {
    if (loadedParams.diametro_cilindro_mm == null && ringItems[0]?.d1 != null) loadedParams.diametro_cilindro_mm = ringItems[0].d1
    if (loadedParams.espesor_anillo1_mm == null && ringItems[0]?.h1 != null) loadedParams.espesor_anillo1_mm = ringItems[0].h1
    if (loadedParams.espesor_anillo2_mm == null && ringItems[1]?.h1 != null) loadedParams.espesor_anillo2_mm = ringItems[1].h1

    if (ringItems.length >= 4) {
      if (loadedParams.espesor_anillo3_mm == null && ringItems[2]?.h1 != null) loadedParams.espesor_anillo3_mm = ringItems[2].h1
      if (loadedParams.espesor_aceite_mm == null && ringItems[3]?.h1 != null) loadedParams.espesor_aceite_mm = ringItems[3].h1

      loadedParams.altura_radial1_mm = ringItems[0]?.a1 ?? (part.dimensiones as any)?.espesor_radial1_mm ?? null
      loadedParams.altura_radial2_mm = ringItems[1]?.a1 ?? (part.dimensiones as any)?.espesor_radial2_mm ?? null
      loadedParams.altura_radial3_mm = ringItems[2]?.a1 ?? (part.dimensiones as any)?.espesor_radial3_mm ?? null
      loadedParams.altura_radial_aceite_mm = ringItems[3]?.a1 ?? (part.dimensiones as any)?.espesor_radial_aceite_mm ?? null
    } else {
      if (loadedParams.espesor_aceite_mm == null && ringItems[ringItems.length - 1]?.h1 != null) loadedParams.espesor_aceite_mm = ringItems[ringItems.length - 1].h1

      loadedParams.altura_radial1_mm = ringItems[0]?.a1 ?? (part.dimensiones as any)?.espesor_radial1_mm ?? null
      loadedParams.altura_radial2_mm = ringItems[1]?.a1 ?? (part.dimensiones as any)?.espesor_radial2_mm ?? null
      loadedParams.altura_radial3_mm = (part.dimensiones as any)?.espesor_radial3_mm ?? (part.dimensiones as any)?.altura_radial3_mm ?? null
      loadedParams.altura_radial_aceite_mm = ringItems[ringItems.length - 1]?.a1 ?? (part.dimensiones as any)?.espesor_radial_aceite_mm ?? null
    }
  } else {
    loadedParams.altura_radial1_mm = (part.dimensiones as any)?.espesor_radial1_mm ?? (part.dimensiones as any)?.altura_radial1_mm ?? null
    loadedParams.altura_radial2_mm = (part.dimensiones as any)?.espesor_radial2_mm ?? (part.dimensiones as any)?.altura_radial2_mm ?? null
    loadedParams.altura_radial3_mm = (part.dimensiones as any)?.espesor_radial3_mm ?? (part.dimensiones as any)?.altura_radial3_mm ?? null
    loadedParams.altura_radial_aceite_mm = (part.dimensiones as any)?.espesor_radial_aceite_mm ?? (part.dimensiones as any)?.altura_radial_aceite_mm ?? null
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

      const prevRings = Array.isArray(prevDimensions.anillos) ? prevDimensions.anillos : []
      const r1_a1 = paramValues.value.altura_radial1_mm != null && paramValues.value.altura_radial1_mm !== '' 
        ? Number(paramValues.value.altura_radial1_mm) 
        : (prevRings[0]?.a1 ?? prevDimensions.espesor_radial1_mm ?? null)
      const r2_a1 = paramValues.value.altura_radial2_mm != null && paramValues.value.altura_radial2_mm !== '' 
        ? Number(paramValues.value.altura_radial2_mm) 
        : (prevRings[1]?.a1 ?? prevDimensions.espesor_radial2_mm ?? null)
      const r3_a1 = hasThirdRing.value && paramValues.value.altura_radial3_mm != null && paramValues.value.altura_radial3_mm !== '' 
        ? Number(paramValues.value.altura_radial3_mm) 
        : (hasThirdRing.value ? (prevRings[2]?.a1 ?? prevDimensions.espesor_radial3_mm ?? null) : null)
      const roil_a1 = paramValues.value.altura_radial_aceite_mm != null && paramValues.value.altura_radial_aceite_mm !== '' 
        ? Number(paramValues.value.altura_radial_aceite_mm) 
        : (prevRings[prevRings.length - 1]?.a1 ?? prevDimensions.espesor_radial_aceite_mm ?? null)

      const h1_val = paramValues.value.espesor_anillo1_mm != null && paramValues.value.espesor_anillo1_mm !== ''
        ? Number(paramValues.value.espesor_anillo1_mm)
        : (dimensionesPayload.espesor_anillo1_mm != null ? Number(dimensionesPayload.espesor_anillo1_mm) : (prevRings[0]?.h1 ?? null))
      const h2_val = paramValues.value.espesor_anillo2_mm != null && paramValues.value.espesor_anillo2_mm !== ''
        ? Number(paramValues.value.espesor_anillo2_mm)
        : (dimensionesPayload.espesor_anillo2_mm != null ? Number(dimensionesPayload.espesor_anillo2_mm) : (prevRings[1]?.h1 ?? null))
      const h3_val = hasThirdRing.value && paramValues.value.espesor_anillo3_mm != null && paramValues.value.espesor_anillo3_mm !== ''
        ? Number(paramValues.value.espesor_anillo3_mm)
        : (hasThirdRing.value ? (dimensionesPayload.espesor_anillo3_mm != null ? Number(dimensionesPayload.espesor_anillo3_mm) : (prevRings[2]?.h1 ?? null)) : null)
      const hoil_val = paramValues.value.espesor_aceite_mm != null && paramValues.value.espesor_aceite_mm !== ''
        ? Number(paramValues.value.espesor_aceite_mm)
        : (dimensionesPayload.espesor_aceite_mm != null ? Number(dimensionesPayload.espesor_aceite_mm) : (prevRings[prevRings.length - 1]?.h1 ?? null))

      dimensionesPayload.diametro_cilindro_mm = d
      dimensionesPayload.espesor_anillo1_mm = h1_val
      dimensionesPayload.espesor_anillo2_mm = h2_val
      dimensionesPayload.espesor_aceite_mm = hoil_val

      if (hasThirdRing.value) {
        dimensionesPayload.espesor_anillo3_mm = h3_val
        dimensionesPayload.anillos = [
          { posicion: 'Anillo 1', d1: d, h1: h1_val, a1: r1_a1 },
          { posicion: 'Anillo 2', d1: d, h1: h2_val, a1: r2_a1 },
          { posicion: 'Anillo 3', d1: d, h1: h3_val, a1: r3_a1 },
          { posicion: 'Anillo de aceite', d1: d, h1: hoil_val, a1: roil_a1 }
        ]
        if (r3_a1 != null) {
          dimensionesPayload.espesor_radial3_mm = r3_a1
          dimensionesPayload.altura_radial3_mm = r3_a1
        }
      } else {
        delete dimensionesPayload.espesor_anillo3_mm
        delete dimensionesPayload.espesor_radial3_mm
        delete dimensionesPayload.altura_radial3_mm
        dimensionesPayload.anillos = [
          { posicion: 'Anillo 1', d1: d, h1: h1_val, a1: r1_a1 },
          { posicion: 'Anillo 2', d1: d, h1: h2_val, a1: r2_a1 },
          { posicion: 'Anillo de aceite', d1: d, h1: hoil_val, a1: roil_a1 }
        ]
      }

      if (r1_a1 != null) {
        dimensionesPayload.espesor_radial1_mm = r1_a1
        dimensionesPayload.altura_radial1_mm = r1_a1
      }
      if (r2_a1 != null) {
        dimensionesPayload.espesor_radial2_mm = r2_a1
        dimensionesPayload.altura_radial2_mm = r2_a1
      }
      if (roil_a1 != null) {
        dimensionesPayload.espesor_radial_aceite_mm = roil_a1
        dimensionesPayload.altura_radial_aceite_mm = roil_a1
      }

      // Metadatos de taller de anillos
      if (paramValues.value.diseno_conico) {
        dimensionesPayload.diseno_conico = true
        dimensionesPayload.keystone = paramValues.value.keystone || '1ST=KEYSTONE'
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

    const partPayload = {
      motor_id: partMotorId.value || undefined,
      codigo_oem: partCodigoOem.value.trim().toUpperCase(),
      nombre: partNombre.value.trim(),
      subsistema: partSubsistema.value,
      categoria: activeGroup.value?.categoria || 'General',
      precio: Number(partPrecio.value || 0),
      stock: Number(partStock.value || 0),
      estado: partEstado.value,
      catalogo_origen: partCatalogoOrigen.value,
      imagen_url: partImagenUrl.value ? partImagenUrl.value.trim() : undefined,
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
      espesor_anillo3_mm: hasThirdRing.value ? (dimensionesPayload.espesor_anillo3_mm || dimensionesPayload.espesor_anillo3) : null,
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
  saveErrorMessage.value = ''
  equivalencias.value = [{ marca_alterna: 'Dokuro', codigo_alterno: '', notas: '' }]
}

// =============================================================================
// TAB 2: CONSTRUCTOR DINÁMICO DE FAMILIAS / GRUPOS DE PIEZAS Y PARÁMETROS
// =============================================================================
const isEditMode = ref<boolean>(false)
const editingGroupId = ref<string | null>(null)
const selectedEditGroupId = ref<string>('')

const groupNombre = ref<string>('')
const groupCategoria = ref<string>('')
const groupSubsistema = ref<string>('Block')
const groupDescripcion = ref<string>('')
const groupIcono = ref<string>('Layers')

const loadGroupForEditing = (grp: GrupoRepuesto) => {
  isEditMode.value = true
  editingGroupId.value = grp.codigo || grp.id
  selectedEditGroupId.value = grp.codigo || grp.id
  groupNombre.value = grp.nombre
  groupCategoria.value = grp.categoria
  groupSubsistema.value = grp.subsistema || 'Block'
  groupDescripcion.value = grp.descripcion || ''
  groupIcono.value = grp.icono || 'Layers'
  dynamicParams.value = grp.parametros.map((p, idx) => ({
    id: p.id || `param-${Date.now()}-${idx}`,
    etiqueta: p.etiqueta,
    clave: p.clave,
    unidad: p.unidad,
    tipo_dato: p.tipo_dato,
    requerido: p.requerido,
    descripcion: p.descripcion || '',
    opciones: p.opciones || [],
    opcionesStr: (p.opciones || []).join(', ')
  }))
  groupErrors.value = {}
}

const switchToCreateMode = () => {
  isEditMode.value = false
  editingGroupId.value = null
  selectedEditGroupId.value = ''
  groupNombre.value = ''
  groupCategoria.value = ''
  groupSubsistema.value = 'Block'
  groupDescripcion.value = ''
  groupIcono.value = 'Layers'
  dynamicParams.value = [
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
  ]
  groupErrors.value = {}
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

// Lista dinámica de parámetros del nuevo grupo
const dynamicParams = ref<Array<{
  id: string
  etiqueta: string
  clave: string
  unidad: string
  tipo_dato: 'numero' | 'texto' | 'booleano' | 'seleccion'
  requerido: boolean
  descripcion: string
  opciones?: string[]
  opcionesStr?: string
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
        unidad: p.unidad.trim(),
        tipo_dato: p.tipo_dato,
        requerido: p.requerido,
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
      emit('group-created', updated)
      selectedGroupCode.value = updated.codigo
      activeTab.value = 'repuesto'
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
      // Pasar automáticamente a crear un repuesto de este nuevo grupo
      selectedGroupCode.value = created.codigo
      activeTab.value = 'repuesto'
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
    <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
      
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
            @click="activeTab = 'grupo'"
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
                    @click="activeTab = 'grupo'"
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

              <!-- 2. Datos de Identificación del Repuesto -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Tag class="w-3.5 h-3.5 text-[#004B97]" />
                    <span>Identificación</span>
                  </h3>
                  <span class="text-[10px] text-slate-500 font-medium">Campos obligatorios (*)</span>
                </div>

                <!-- Código OEM y Nombre -->
                <div class="space-y-2.5">
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-bold text-slate-700">
                        Código OEM / Parte Principal <span class="text-rose-600 font-black">*</span>
                      </label>
                      <span class="text-[9px] text-slate-400 font-mono">Original</span>
                    </div>
                    <input
                      v-model="partCodigoOem"
                      type="text"
                      placeholder="Ej. 13011-28010, 8-97176-683-0"
                      class="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white border rounded-xl focus:outline-none focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9]"
                      :class="formErrors.partCodigoOem ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'"
                    />
                    <span v-if="formErrors.partCodigoOem" class="text-[10px] text-rose-600 font-bold mt-0.5 block">
                      {{ formErrors.partCodigoOem }}
                    </span>
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
                    {{ isRingsGroup ? (hasThirdRing ? '4 Aros' : '3 Aros') : `${activeGroup.parametros.filter(p => p.requerido).length} Obligatorios` }}
                  </span>
                </div>

                <!-- A. MATRIZ TABULAR PARA ANILLOS DE MOTOR (ESPEJO DE LA TABLA DEL CATÁLOGO) -->
                <div v-if="isRingsGroup" class="space-y-3">
                  
                  <!-- Tabla de medidas compacta -->
                  <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs font-mono select-text">
                    <table class="border-collapse text-center text-xs w-full">
                      <thead>
                        <tr class="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                          <th class="px-3 py-2 text-left border-r border-slate-200">Ranura / Posición</th>
                          <th class="px-2.5 py-2 border-r border-slate-200">
                            <span>Diámetro (d1)</span>
                            <span class="block text-[9px] text-slate-400 font-normal">Calibre mm *</span>
                          </th>
                          <th class="px-2.5 py-2 border-r border-slate-200">
                            <span>Grosor (h1)</span>
                            <span class="block text-[9px] text-slate-400 font-normal">Axial mm *</span>
                          </th>
                          <th class="px-2.5 py-2 border-r border-slate-200">
                            <span>Radial (a1)</span>
                            <span class="block text-[9px] text-slate-400 font-normal">Espesor mm</span>
                          </th>
                          <th class="px-2 py-2">
                            <span>Atributo</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 text-[11px]">
                        
                        <!-- 1° Compresión (Fuego) -->
                        <tr class="hover:bg-slate-50/70 transition" :class="formErrors.espesor_anillo1_mm || formErrors.diametro_cilindro_mm ? 'bg-rose-50/20' : ''">
                          <td class="px-3 py-1.5 bg-slate-50/80 font-bold text-slate-800 border-r border-slate-200 text-left whitespace-nowrap">
                            <div class="flex items-center gap-1.5">
                              <span class="w-2 h-2 rounded-full bg-[#004B97]"></span>
                              <strong class="font-extrabold text-slate-900">1° Compresión</strong>
                            </div>
                            <span class="text-[9px] text-slate-500 font-normal">Fuego / Top</span>
                          </td>
                          <!-- Diámetro común STD -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
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
                          <!-- Grosor h1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.espesor_anillo1_mm"
                              type="number"
                              step="0.001"
                              placeholder="1.500"
                              class="w-18 px-1.5 py-1 text-center font-mono font-bold text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              :class="formErrors.espesor_anillo1_mm ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-300' : 'border-slate-300'"
                            />
                          </td>
                          <!-- Radial a1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.altura_radial1_mm"
                              type="number"
                              step="0.01"
                              placeholder="3.40"
                              class="w-16 px-1.5 py-1 text-center font-mono font-medium text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                          </td>
                          <!-- Toggle Keystone / Cónico -->
                          <td class="px-2 py-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              @click="paramValues.diseno_conico = !paramValues.diseno_conico"
                              class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase transition border"
                              :class="paramValues.diseno_conico 
                                ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs' 
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:text-slate-800'"
                              :title="paramValues.diseno_conico ? 'Diseño Keystone activado (1ST=KEYSTONE)' : 'Hacer clic para marcar como cónico (Keystone)'"
                            >
                              {{ paramValues.diseno_conico ? '★ Cónico' : 'Plano' }}
                            </button>
                          </td>
                        </tr>

                        <!-- 2° Compresión (Raspador) -->
                        <tr class="hover:bg-slate-50/70 transition" :class="formErrors.espesor_anillo2_mm ? 'bg-rose-50/20' : ''">
                          <td class="px-3 py-1.5 bg-slate-50/80 font-bold text-slate-800 border-r border-slate-200 text-left whitespace-nowrap">
                            <div class="flex items-center gap-1.5">
                              <span class="w-2 h-2 rounded-full bg-[#004B97]"></span>
                              <strong class="font-extrabold text-slate-900">2° Compresión</strong>
                            </div>
                            <span class="text-[9px] text-slate-500 font-normal">Raspador</span>
                          </td>
                          <!-- Diámetro heredado -->
                          <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-50/30">
                            <span>{{ formatRingVal(paramValues.diametro_cilindro_mm) }}</span>
                          </td>
                          <!-- Grosor h1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.espesor_anillo2_mm"
                              type="number"
                              step="0.001"
                              placeholder="1.500"
                              class="w-18 px-1.5 py-1 text-center font-mono font-bold text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              :class="formErrors.espesor_anillo2_mm ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-300' : 'border-slate-300'"
                            />
                          </td>
                          <!-- Radial a1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.altura_radial2_mm"
                              type="number"
                              step="0.01"
                              placeholder="3.40"
                              class="w-16 px-1.5 py-1 text-center font-mono font-medium text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                          </td>
                          <td class="px-2 py-1.5 text-center text-[10px] text-slate-400 font-sans">
                            STD
                          </td>
                        </tr>

                        <!-- 3° Compresión (Opcional - Juegos de 4 Aros) -->
                        <tr v-if="hasThirdRing" class="hover:bg-slate-50/70 transition bg-amber-50/20" :class="formErrors.espesor_anillo3_mm ? 'bg-rose-50/20' : ''">
                          <td class="px-3 py-1.5 bg-amber-50/60 font-bold text-amber-950 border-r border-slate-200 text-left whitespace-nowrap">
                            <div class="flex items-center gap-1.5">
                              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                              <strong class="font-extrabold text-amber-900">3° Compresión</strong>
                            </div>
                            <span class="text-[9px] text-amber-700 font-normal">Extra / Diésel</span>
                          </td>
                          <!-- Diámetro heredado -->
                          <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-50/30">
                            <span>{{ formatRingVal(paramValues.diametro_cilindro_mm) }}</span>
                          </td>
                          <!-- Grosor h1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.espesor_anillo3_mm"
                              type="number"
                              step="0.001"
                              placeholder="2.000"
                              class="w-18 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-500"
                              :class="formErrors.espesor_anillo3_mm ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-300' : ''"
                            />
                          </td>
                          <!-- Radial a1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.altura_radial3_mm"
                              type="number"
                              step="0.01"
                              placeholder="3.40"
                              class="w-16 px-1.5 py-1 text-center font-mono font-medium text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td class="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              @click="hasThirdRing = false"
                              class="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                              title="Quitar 3° anillo de compresión"
                            >
                              <Trash2 class="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>

                        <!-- Anillo de Aceite (Rascador) -->
                        <tr class="hover:bg-slate-50/70 transition" :class="formErrors.espesor_aceite_mm ? 'bg-rose-50/20' : ''">
                          <td class="px-3 py-1.5 bg-slate-50/80 font-bold text-slate-800 border-r border-slate-200 text-left whitespace-nowrap">
                            <div class="flex items-center gap-1.5">
                              <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
                              <strong class="font-extrabold text-slate-900">Anillo Aceite</strong>
                            </div>
                            <span class="text-[9px] text-slate-500 font-normal">Rascador / Oil</span>
                          </td>
                          <!-- Diámetro heredado -->
                          <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-50/30">
                            <span>{{ formatRingVal(paramValues.diametro_cilindro_mm) }}</span>
                          </td>
                          <!-- Grosor h1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.espesor_aceite_mm"
                              type="number"
                              step="0.001"
                              placeholder="3.000"
                              class="w-18 px-1.5 py-1 text-center font-mono font-bold text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                              :class="formErrors.espesor_aceite_mm ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-300' : 'border-slate-300'"
                            />
                          </td>
                          <!-- Radial a1 -->
                          <td class="px-2 py-1.5 border-r border-slate-200">
                            <input
                              v-model.number="paramValues.altura_radial_aceite_mm"
                              type="number"
                              step="0.01"
                              placeholder="2.80"
                              class="w-16 px-1.5 py-1 text-center font-mono font-medium text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
                            />
                          </td>
                          <td class="px-2 py-1.5 text-center text-[10px] text-slate-400 font-sans">
                            Oil
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- Controles auxiliares bajo la tabla -->
                  <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      v-if="!hasThirdRing"
                      type="button"
                      @click="hasThirdRing = true"
                      class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-[#004B97] bg-white border border-cyan-300 hover:bg-cyan-50 transition flex items-center gap-1 shadow-2xs"
                    >
                      <Plus class="w-3 h-3 text-[#04C4D9]" />
                      <span>+ Agregar 3° Anillo (Juego de 4 Aros)</span>
                    </button>
                    <span v-else class="text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Juego de 4 Aros activo
                    </span>

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

              <!-- 2. Equivalencias Multimarca (Compacto en la Columna Derecha) -->
              <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#004B97]"></span>
                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-800">
                      Equivalencias Multimarca
                    </h3>
                  </div>
                  <button
                    type="button"
                    @click="addEquivalenceRow"
                    class="text-[10px] font-extrabold text-[#038391] hover:text-[#004B97] flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-cyan-200 shadow-2xs transition"
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
        <div v-else class="space-y-6">

          <!-- Selector de Modo: Crear Nuevo vs Modificar Existente -->
          <div class="bg-slate-100 p-2.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200">
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
                @click="isEditMode = true"
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
                Editando familia: <strong>{{ groupNombre }}</strong> (Código: {{ editingGroupId }}). Puedes modificar nombres, agregar o eliminar parámetros requeridos.
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

          <!-- Plantillas rápidas de taller (solo en modo creación) -->
          <div v-if="!isEditMode" class="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <span class="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <Sparkles class="w-4 h-4 text-amber-600" />
              Plantillas Rápidas:
            </span>
            <div class="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                @click="loadTemplateCamisas"
                class="px-3 py-1 rounded-xl bg-white text-amber-900 border border-amber-300 text-xs font-bold hover:bg-amber-100/70 transition shadow-2xs"
              >
                Camisas de Cilindro
              </button>
              <button
                type="button"
                @click="loadTemplatePistones"
                class="px-3 py-1 rounded-xl bg-white text-amber-900 border border-amber-300 text-xs font-bold hover:bg-amber-100/70 transition shadow-2xs"
              >
                Pistones de Motor
              </button>
            </div>
          </div>

          <!-- 1. Definición General del Grupo -->
          <div class="space-y-4">
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FolderPlus class="w-4 h-4 text-[#04C4D9]" />
              {{ isEditMode ? `Datos de la Familia: ${groupNombre || ''}` : 'Datos de la Familia' }}
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
      <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
        <SlidersHorizontal class="w-4 h-4 text-[#04C4D9]" />
        <span>Constructor de Medidas con Vista Previa de Tabla</span>
      </h3>
      <button
        type="button"
        @click="addParamRow"
        class="px-3 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-2xs"
      >
        <Plus class="w-4 h-4" />
        <span>+ Agregar Medida</span>
      </button>
    </div>

    <!-- VISTA PREVIA EN VIVO DE LA CABECERA Y TABLA DE CATÁLOGO -->
    <div class="bg-slate-900 text-white rounded-2xl p-4 shadow-sm space-y-2.5">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <div class="flex items-center gap-2">
          <Eye class="w-4 h-4 text-[#04C4D9]" />
          <span class="text-xs font-extrabold uppercase tracking-wide">
            Vista Previa: Así se verá en la Tabla del Catálogo
          </span>
        </div>
        <span class="text-[10px] font-mono text-slate-400">
          {{ dynamicParams.length }} columnas técnicas activas
        </span>
      </div>

      <!-- Simulación de la tabla técnica -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
              <th class="py-1.5 px-2.5 border-r border-slate-700">OEM / Código</th>
              <th class="py-1.5 px-2.5 border-r border-slate-700">Descripción</th>
              <th
                v-for="(p, pIdx) in dynamicParams"
                :key="`preview-col-${pIdx}`"
                class="py-1.5 px-2.5 border-r border-slate-700 text-[#04C4D9] font-mono whitespace-nowrap"
              >
                {{ p.etiqueta || `Medida ${pIdx + 1}` }}
                <span v-if="p.unidad" class="text-slate-400 font-sans text-[9px]">({{ p.unidad }})</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="bg-slate-850/60 text-slate-200 font-mono text-[11px]">
              <td class="py-2 px-2.5 border-r border-slate-700 text-slate-400 font-bold">13011-58010</td>
              <td class="py-2 px-2.5 border-r border-slate-700 text-white font-sans font-bold">{{ groupNombre || 'Pieza Rectificada' }}</td>
              <td
                v-for="(p, pIdx) in dynamicParams"
                :key="`preview-cell-${pIdx}`"
                class="py-2 px-2.5 border-r border-slate-700 text-emerald-400 font-bold"
              >
                {{ p.tipo_dato === 'booleano' ? 'STD / Cónico' : (p.unidad === '°' ? '45°' : (p.unidad === 'mm' ? (pIdx === 0 ? '95.00' : '1.50') : '10 pzs')) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Editor de Parámetros Compacto -->
    <div class="space-y-2.5">
      <div
        v-for="(param, idx) in dynamicParams"
        :key="param.id"
        class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="flex items-center gap-2 shrink-0">
          <span class="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-mono font-bold flex items-center justify-center">
            {{ idx + 1 }}
          </span>
          <input
            v-model="param.etiqueta"
            @input="handleParamLabelChange(param)"
            type="text"
            placeholder="Etiqueta columna..."
            class="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9] w-48"
          />
        </div>

        <div class="flex items-center gap-2 flex-1 flex-wrap">
          <input
            v-model="param.clave"
            type="text"
            placeholder="clave_tecnica"
            class="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9] flex-1 min-w-[120px]"
          />
          <select
            v-model="param.unidad"
            class="px-2 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9] w-24"
          >
            <option value="mm">mm</option>
            <option value="°">°</option>
            <option value="pulgadas">pulgadas</option>
            <option value="piezas">piezas</option>
            <option value="">Sin unidad</option>
          </select>
        </div>

        <div class="flex items-center gap-2 shrink-0 justify-end">
          <label class="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" v-model="param.requerido" class="w-3.5 h-3.5 rounded text-[#04C4D9]" />
            <span>Req</span>
          </label>
          <button
            type="button"
            @click="removeParamRow(idx)"
            class="p-1 text-slate-400 hover:text-rose-600 rounded transition"
          >
            <Trash2 class="w-4 h-4" />
          </button>
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
