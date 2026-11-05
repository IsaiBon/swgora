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
  Info, 
  Tag, 
  Hash, 
  Ruler, 
  FolderPlus, 
  PackagePlus, 
  Loader2,
  Edit3,
  Search,
  ChevronDown,
  Check
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
    if (props.initialTab) activeTab.value = props.initialTab
    if (props.editPart) {
      loadPartForEditing(props.editPart)
    } else if (props.preselectedGroupId) {
      selectedGroupCode.value = props.preselectedGroupId
    } else if (!selectedGroupCode.value && catalogStore.grupos.length > 0) {
      selectedGroupCode.value = catalogStore.grupos[0].codigo
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

  // Identificar el grupo correspondiente
  const catLower = (part.categoria || '').toLowerCase()
  const subLower = (part.subsistema || '').toLowerCase()
  const matchedGroup = catalogStore.grupos.find(g => 
    g.categoria.toLowerCase() === catLower ||
    g.codigo.toLowerCase() === catLower ||
    g.nombre.toLowerCase().includes(catLower) ||
    g.subsistema.toLowerCase() === subLower
  ) || catalogStore.grupos[0]

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
  if (part.espesor_aceite_mm != null) loadedParams.espesor_aceite_mm = part.espesor_aceite_mm

  if (part.tipo_cojinete != null) loadedParams.tipo_cojinete = part.tipo_cojinete
  if (part.diametro_munon_mm != null) loadedParams.diametro_munon_mm = part.diametro_munon_mm
  if (part.diametro_alojamiento_mm != null) loadedParams.diametro_alojamiento_mm = part.diametro_alojamiento_mm
  if (part.ancho_casquete_mm != null) loadedParams.ancho_casquete_mm = part.ancho_casquete_mm

  if (part.medida_rosca != null) loadedParams.medida_rosca = part.medida_rosca
  if (part.paso_rosca_mm != null) loadedParams.paso_rosca_mm = part.paso_rosca_mm
  if (part.longitud_perno_mm != null) loadedParams.longitud_perno_mm = part.longitud_perno_mm
  if (part.cantidad_piezas != null) loadedParams.cantidad_piezas = part.cantidad_piezas

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
    <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
      
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
      <div class="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 text-slate-800">

        <!-- ----------------------------------------------------------------- -->
        <!-- PESTAÑA 1: FORMULARIO REACTIVO DE ALTA / EDICIÓN DE REPUESTO     -->
        <!-- ----------------------------------------------------------------- -->
        <div v-if="activeTab === 'repuesto'" class="space-y-6">

          <!-- Banner Informativo si está editando un repuesto existente -->
          <div v-if="isEditPartMode" class="bg-cyan-50 border border-cyan-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
                <Edit3 class="w-4 h-4 text-[#038391]" />
              </div>
              <div>
                <p class="text-xs font-extrabold text-[#038391]">
                  Modificando Repuesto Existente: <span class="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-cyan-200">{{ partCodigoOem || editingPartId }}</span>
                </p>
                <p class="text-[11px] text-slate-500">
                  Puede actualizar el código OEM, motor, cotas dimensionales de maquinado y equivalencias de marcas alternas.
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

          <!-- 1. Familia de Repuesto -->
          <div class="bg-cyan-50/40 border border-cyan-200/80 rounded-2xl p-4.5 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-900">
                Familia de Repuesto
              </label>

              <button
                type="button"
                @click="activeTab = 'grupo'"
                class="text-xs font-bold text-[#038896] hover:text-[#04C4D9] flex items-center gap-1 transition"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>+ Nueva Familia</span>
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
              Datos del Repuesto
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

              <!-- Motor Asociado (Buscador reactivo con autocompletado) -->
              <div class="relative combobox-motor-asociado">
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-slate-700">
                    Motor Asociado (Opcional)
                  </label>
                  <span v-if="selectedMotor" class="text-[10px] font-bold text-[#038896] bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                    {{ selectedMotor.codigo }}
                  </span>
                  <span v-else class="text-[10px] font-medium text-slate-400">
                    Universal
                  </span>
                </div>

                <div class="relative flex items-center">
                  <Search class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    v-model="motorSearchQuery"
                    type="text"
                    placeholder="Buscar motor (ej. 3L, Z24, 4JB1, Hilux)..."
                    @focus="onMotorFocus"
                    @input="onMotorInput"
                    class="w-full pl-9 pr-14 py-2 text-xs font-bold bg-slate-50 border rounded-xl focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20"
                    :class="selectedMotor ? 'border-cyan-300 bg-cyan-50/20' : 'border-slate-300'"
                  />

                  <div class="absolute right-2 flex items-center gap-1">
                    <button
                      v-if="partMotorId || motorSearchQuery"
                      type="button"
                      @click="clearMotor"
                      class="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
                      title="Quitar motor y dejar como Universal"
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      @click="isMotorDropdownOpen = !isMotorDropdownOpen"
                      class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Ver lista de motores"
                    >
                      <ChevronDown class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Dropdown de resultados flotante -->
                <div
                  v-if="isMotorDropdownOpen"
                  class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100"
                >
                  <!-- Opción Universal -->
                  <div
                    @click="selectMotor(null)"
                    class="px-3.5 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition"
                    :class="!partMotorId ? 'bg-cyan-50 font-bold text-[#038896]' : 'text-slate-700'"
                  >
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full" :class="!partMotorId ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                      <span>Universal / Todos los Motores</span>
                    </div>
                    <Check v-if="!partMotorId" class="w-3.5 h-3.5 text-[#038896]" />
                  </div>

                  <!-- Lista de motores filtrados -->
                  <div
                    v-for="mot in filteredMotoresList"
                    :key="mot.id"
                    @click="selectMotor(mot)"
                    class="px-3 py-2 hover:bg-cyan-50/70 cursor-pointer text-xs flex items-center justify-between transition"
                    :class="partMotorId === mot.id ? 'bg-cyan-50 text-cyan-900 font-bold' : 'text-slate-800'"
                  >
                    <div class="min-w-0 pr-2">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span 
                          v-if="getBrandName(mot.fabricante_id)" 
                          class="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider rounded bg-slate-200 text-slate-700"
                        >
                          {{ getBrandName(mot.fabricante_id) }}
                        </span>
                        <strong class="font-mono text-xs font-black text-slate-900">{{ mot.codigo }}</strong>
                        <span v-if="mot.nombre_comercial" class="text-slate-600 font-medium truncate">
                          {{ mot.nombre_comercial }}
                        </span>
                        <span v-if="mot.denominacion_venta" class="text-slate-400 text-[11px]">
                          ({{ mot.denominacion_venta }})
                        </span>
                      </div>
                    </div>

                    <div class="shrink-0 flex items-center gap-2">
                      <span v-if="mot.cilindros || mot.cilindrada_texto || mot.cilindrada_cc" class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        <template v-if="mot.cilindros">{{ mot.cilindros }} Cil<template v-if="mot.cilindrada_texto || mot.cilindrada_cc"> • </template></template><span v-if="mot.cilindrada_texto || mot.cilindrada_cc">{{ mot.cilindrada_texto || `${mot.cilindrada_cc} cc` }}</span>
                      </span>
                      <Check v-if="partMotorId === mot.id" class="w-3.5 h-3.5 text-[#038896]" />
                    </div>
                  </div>

                  <!-- Sin resultados -->
                  <div v-if="filteredMotoresList.length === 0" class="p-3 text-center text-xs text-slate-500">
                    <p class="font-medium">No se encontraron motores para "{{ motorSearchQuery }}"</p>
                    <button
                      type="button"
                      @click="selectMotor(null)"
                      class="mt-1.5 text-xs font-bold text-[#038896] hover:underline"
                    >
                      Dejar como Universal / Sin motor
                    </button>
                  </div>
                </div>

                <!-- Resumen técnico del motor seleccionado -->
                <div v-if="selectedMotor" class="mt-1 flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-lg">
                  <span class="font-bold text-slate-800">{{ getBrandName(selectedMotor.fabricante_id) }} {{ selectedMotor.codigo }}</span>
                  <span v-if="selectedMotor.cilindrada_texto || selectedMotor.cilindrada_cc">• {{ selectedMotor.cilindrada_texto || `${selectedMotor.cilindrada_cc} cc` }}</span>
                  <span v-if="selectedMotor.combustible">• {{ selectedMotor.combustible }}</span>
                </div>
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
                  <option value="Taiho">Taiho (Japón)</option>
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

              <!-- Selector y subida de Imagen Técnica / Diagrama de explosión -->
              <div class="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200">
                <PartImageUploader
                  v-model="partImagenUrl"
                  :part-code="partCodigoOem"
                  label="Imagen Técnica / Diagrama de Explosión"
                  hint="Sube la foto del repuesto, plano de despiece o cota CAD. Se optimizará automáticamente para carga rápida en taller."
                />
              </div>
            </div>
          </div>

          <!-- 3. Parámetros Técnicos -->
          <div class="space-y-4">
            <div class="flex items-center justify-between border-b pb-2 border-slate-200">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Ruler class="w-4 h-4 text-[#04C4D9]" />
                Cotas Técnicas
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

          <!-- 4. Cruces y Marcas Alternas -->
          <div class="space-y-3">
            <div class="flex items-center justify-between border-b pb-2 border-slate-200">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Hash class="w-4 h-4 text-[#04C4D9]" />
                Marcas Alternas
              </h3>
              <button
                type="button"
                @click="addEquivalenceRow"
                class="text-xs font-bold text-[#038896] hover:text-[#04C4D9] flex items-center gap-1"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>+ Cruce Alterno</span>
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
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <SlidersHorizontal class="w-4 h-4 text-[#04C4D9]" />
                Parámetros y Medidas
              </h3>

              <button
                type="button"
                @click="addParamRow"
                class="px-3 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-2xs shrink-0"
              >
                <Plus class="w-4 h-4" />
                <span>+ Medida</span>
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
                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Entrada</label>
                    <select
                      v-model="param.tipo_dato"
                      class="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                    >
                      <option value="numero">Número Decimal (ej. cotas mm)</option>
                      <option value="seleccion">Menú Desplegable / Opciones (ej. Admisión / Escape)</option>
                      <option value="texto">Texto Libre</option>
                      <option value="booleano">Booleano (Sí/No)</option>
                    </select>
                  </div>

                  <!-- Opciones para Menú Desplegable (Cascada de selección) -->
                  <div v-if="param.tipo_dato === 'seleccion'" class="sm:col-span-2 lg:col-span-4 bg-cyan-50/70 p-3 rounded-xl border border-cyan-200/80">
                    <div class="flex items-center justify-between mb-1">
                      <label class="block text-[11px] font-bold text-[#038391]">
                        Opciones del Menú Desplegable (separadas por coma)
                      </label>
                      <span class="text-[10px] text-slate-500 font-medium">Ej: Admisión, Escape ó IN, EX</span>
                    </div>
                    <input
                      v-model="param.opcionesStr"
                      type="text"
                      placeholder="Escribe las opciones separadas por coma (ej. Admisión, Escape)"
                      class="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-cyan-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#04C4D9]"
                    />
                    <div class="flex items-center gap-1.5 flex-wrap mt-2">
                      <span class="text-[10px] text-slate-500 font-bold">Vista previa del menú:</span>
                      <span
                        v-for="opt in (param.opcionesStr || '').split(',').map(s => s.trim()).filter(Boolean)"
                        :key="opt"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[#038391] text-[10px] font-bold border border-cyan-300 shadow-2xs"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-[#04C4D9]"></span>
                        {{ opt }}
                      </span>
                      <span v-if="!(param.opcionesStr || '').trim()" class="text-[10px] text-slate-400 italic">
                        Escribe las opciones separadas por coma para definir las alternativas del filtro.
                      </span>
                    </div>
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
