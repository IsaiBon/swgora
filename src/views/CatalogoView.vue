<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { 
  type Motor, 
  type Modelo,
  type RepuestoTecnico, 
  type Fabricante,
  type GrupoRepuesto,
  type Equivalencia,
  type ParametroTecnicoDefinicion,
  buildNestedTableHeaders,
  buildRowSpanMeta,
  normalizeText,
  resolveOptionBadgeClass,
  sanitizeGroupParams,
  sortMotorsByRelevance
} from '@/services/catalogService'
import AdminCatalogModal from '@/components/AdminCatalogModal.vue'
import PartImageLightbox from '@/components/catalog/PartImageLightbox.vue'
import ToleranceBadge from '@/components/ToleranceBadge.vue'
import { 
  Search, 
  X, 
  Wrench, 
  Copy, 
  Check, 
  CheckCircle2, 
  Plus, 
  RotateCcw, 
  Eye, 
  Layers, 
  CircleDot, 
  ChevronDown, 
  ChevronUp,
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Info, 
  FileText, 
  AlertCircle, 
  SlidersHorizontal,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  FolderPlus,
  Edit3,
  Ruler,
  Maximize2,
  Hash,
} from 'lucide-vue-next'

const catalogStore = useCatalogStore()

// =============================================================================
// ESTADO DE SELECCIÓN EN CASCADA (FABRICANTE -> MOTOR -> MODELO -> COMPONENTE)
// =============================================================================
const brandInput = ref<string>('')
const modelInput = ref<string>('')
const motorInput = ref<string>('')
const componentInput = ref<string>('')

const isBrandOpen = ref<boolean>(false)
const isModelOpen = ref<boolean>(false)
const isComponentOpen = ref<boolean>(false)

const selectedBrand = ref<Fabricante | null>(null)
const selectedModel = ref<Modelo | null>(null)
const selectedMotor = ref<Motor | null>(null)
const selectedComponent = ref<ComponentGroup | null>(null)
const selectedYear = ref<string>('')
const yearInput = ref<string>('')
const isYearOpen = ref<boolean>(false)
const showAllMotors = ref<boolean>(false)

const CUSTOM_YEARS_STORAGE_KEY = 'swgora_custom_years_v1'
function loadCustomYears(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_YEARS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
const customYears = ref<string[]>(loadCustomYears())

// Lista de años compatibles (personalizados + 1975 - 2026)
const availableYears = computed<string[]>(() => {
  const base = Array.from({ length: 2026 - 1975 + 1 }, (_, i) => String(2026 - i))
  const combined = [...customYears.value, ...base]
  return Array.from(new Set(combined))
})

const filteredYears = computed<string[]>(() => {
  const q = yearInput.value.trim().toLowerCase()
  if (!q || q === selectedYear.value.toLowerCase()) {
    return availableYears.value
  }
  return availableYears.value.filter(yr => yr.toLowerCase().includes(q))
})

const effectiveYearFilter = computed<string>(() => {
  if (selectedYear.value.trim()) return selectedYear.value.trim()
  const raw = yearInput.value.trim()
  return /^\d{4}$/.test(raw) ? raw : ''
})

function handleSelectYear(yr: string) {
  selectedYear.value = yr
  yearInput.value = yr
  isYearOpen.value = false
}

function onInputYear() {
  isYearOpen.value = true
  const raw = yearInput.value.trim()
  selectedYear.value = /^\d{4}$/.test(raw) ? raw : ''
}

function handleClearYear() {
  selectedYear.value = ''
  yearInput.value = ''
  isYearOpen.value = false
}

function doesYearMatchText(text: string | number | undefined | null, targetYear: number | string): boolean {
  if (text === undefined || text === null || text === '') return false
  const raw = String(text).trim()
  if (!raw || raw === '—') return false
  const targetStr = String(targetYear).trim()
  if (raw.includes(targetStr)) return true
  const parsedYear = Number(targetStr.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || targetStr)
  if (isNaN(parsedYear)) return false

  // Buscar rangos de 4 dígitos como "1995-2006", "1998 - 2005", "1995/2004", "1995 al 2006"
  const rangeRegex = /\b(19\d{2}|20\d{2})\s*(?:[-–—/]|al|a|hasta)\s*(19\d{2}|20\d{2}|act(?:ual)?|presente)?\b/gi
  let match: RegExpExecArray | null
  while ((match = rangeRegex.exec(raw)) !== null) {
    const start = Number(match[1])
    const endRaw = (match[2] || '').toLowerCase()
    const end = (!endRaw || endRaw.startsWith('act') || endRaw.startsWith('pres')) ? 2026 : Number(endRaw)
    if (!isNaN(start) && !isNaN(end) && parsedYear >= Math.min(start, end) && parsedYear <= Math.max(start, end)) {
      return true
    }
  }

  // Buscar "1998+" o "desde 1998"
  const openStartRegex = /\b(19\d{2}|20\d{2})\s*\+/g
  while ((match = openStartRegex.exec(raw)) !== null) {
    const start = Number(match[1])
    if (!isNaN(start) && parsedYear >= start) return true
  }

  return false
}

// Estado para modales rápidos de creación / edición de Marca, Motor, Modelo y Año desde la barra superior
const isQuickCreateBrandOpen = ref<boolean>(false)
const editingBrandId = ref<string | null>(null)
const quickBrandName = ref<string>('')
const quickBrandCountry = ref<string>('Japón')
const isSavingQuickBrand = ref<boolean>(false)

const isQuickCreateMotorOpen = ref<boolean>(false)
const editingMotorId = ref<string | null>(null)
const quickMotorBrandId = ref<string>('')
const quickMotorModelId = ref<string>('')
const quickMotorCode = ref<string>('')
const quickMotorName = ref<string>('')
const quickMotorSeries = ref<string>('')
const quickMotorCylinders = ref<number>(4)
const quickMotorCc = ref<number | undefined>(undefined)
const quickMotorFuel = ref<string>('Diésel')
const quickMotorYears = ref<string>('')
const isSavingQuickMotor = ref<boolean>(false)

const isQuickCreateModelOpen = ref<boolean>(false)
const editingModelId = ref<string | null>(null)
const quickModelBrandId = ref<string>('')
const quickModelName = ref<string>('')
const quickModelYearStart = ref<number | undefined>(undefined)
const quickModelYearEnd = ref<number | undefined>(undefined)
const isSavingQuickModel = ref<boolean>(false)

const isQuickCreateYearOpen = ref<boolean>(false)
const quickYearValue = ref<string>('')

// Conversor visual mm <-> milésimas de pulgada (÷ 25.4) sin alterar la base de datos
const unitMode = ref<'mm' | 'milesimas'>('mm')

const openQuickCreateBrandModal = (initialName?: string) => {
  editingBrandId.value = null
  quickBrandName.value = (initialName || brandInput.value || '').trim().toUpperCase()
  quickBrandCountry.value = 'Japón'
  isBrandOpen.value = false
  isQuickCreateBrandOpen.value = true
}

const openEditBrandModal = (fab: Fabricante) => {
  editingBrandId.value = fab.id
  quickBrandName.value = fab.nombre.toUpperCase()
  quickBrandCountry.value = fab.pais_origen || 'Japón'
  isBrandOpen.value = false
  isQuickCreateBrandOpen.value = true
}

const handleSaveQuickBrand = async () => {
  const cleanName = quickBrandName.value.trim().toUpperCase()
  if (!cleanName) return
  isSavingQuickBrand.value = true
  try {
    if (editingBrandId.value) {
      const updated = await catalogStore.updateFabricante(editingBrandId.value, {
        nombre: cleanName,
        pais_origen: quickBrandCountry.value.trim() || 'Japón'
      })
      isQuickCreateBrandOpen.value = false
      if (selectedBrand.value?.id === updated.id) {
        selectedBrand.value = updated
        brandInput.value = updated.nombre.toUpperCase()
      }
      showToast(`✓ Marca actualizada a "${updated.nombre}"`)
    } else {
      const created = await catalogStore.createFabricante({
        nombre: cleanName,
        pais_origen: quickBrandCountry.value.trim() || 'Japón'
      })
      isQuickCreateBrandOpen.value = false
      await handleSelectBrand(created)
      showToast(`✓ Marca "${created.nombre}" registrada y seleccionada`)
    }
  } finally {
    isSavingQuickBrand.value = false
  }
}

const openQuickCreateMotorModal = (initialCode?: string) => {
  editingMotorId.value = null
  quickMotorCode.value = (initialCode || motorInput.value || '').trim().toUpperCase()
  quickMotorBrandId.value = selectedBrand.value?.id || catalogStore.fabricantes[0]?.id || '11111111-1111-1111-1111-111111111101'
  quickMotorModelId.value = selectedModel.value?.id || ''
  quickMotorName.value = quickMotorCode.value ? `Motor ${quickMotorCode.value}` : ''
  quickMotorSeries.value = ''
  quickMotorCylinders.value = 4
  quickMotorCc.value = undefined
  quickMotorFuel.value = 'Diésel'
  quickMotorYears.value = selectedYear.value || ''
  isQuickCreateMotorOpen.value = true
}

const openEditMotorModal = (mot: Motor, e?: Event) => {
  e?.stopPropagation()
  editingMotorId.value = mot.id
  quickMotorBrandId.value = mot.fabricante_id
  quickMotorModelId.value = mot.modelo_id || ''
  quickMotorCode.value = mot.codigo
  quickMotorName.value = mot.nombre_comercial || ''
  quickMotorSeries.value = mot.denominacion_venta || ''
  quickMotorCylinders.value = mot.cilindros || 4
  quickMotorCc.value = mot.cilindrada_cc
  quickMotorFuel.value = mot.combustible || 'Diésel'
  quickMotorYears.value = mot.anios || ''
  isQuickCreateMotorOpen.value = true
}

const handleSaveQuickMotor = async () => {
  const cleanCode = quickMotorCode.value.trim().toUpperCase()
  if (!cleanCode) return
  isSavingQuickMotor.value = true
  try {
    if (editingMotorId.value) {
      const updated = await catalogStore.updateMotor(editingMotorId.value, {
        fabricante_id: quickMotorBrandId.value,
        modelo_id: quickMotorModelId.value || undefined,
        codigo: cleanCode,
        nombre_comercial: quickMotorName.value.trim() || `Motor ${cleanCode}`,
        denominacion_venta: quickMotorSeries.value.trim() || undefined,
        cilindros: Number(quickMotorCylinders.value) || 4,
        cilindrada_cc: quickMotorCc.value ? Number(quickMotorCc.value) : undefined,
        combustible: quickMotorFuel.value || 'Diésel',
        anios: quickMotorYears.value.trim() || undefined
      })
      isQuickCreateMotorOpen.value = false
      if (selectedMotor.value?.id === updated.id) {
        selectedMotor.value = updated
        motorInput.value = updated.codigo
      }
      showToast(`✓ Motor "${updated.codigo}" actualizado`)
    } else {
      const created = await catalogStore.createMotor({
        fabricante_id: quickMotorBrandId.value || selectedBrand.value?.id || '11111111-1111-1111-1111-111111111101',
        modelo_id: quickMotorModelId.value || selectedModel.value?.id,
        codigo: cleanCode,
        nombre_comercial: quickMotorName.value.trim() || `Motor ${cleanCode}`,
        denominacion_venta: quickMotorSeries.value.trim() || undefined,
        cilindros: Number(quickMotorCylinders.value) || 4,
        cilindrada_cc: quickMotorCc.value ? Number(quickMotorCc.value) : undefined,
        combustible: quickMotorFuel.value || 'Diésel',
        anios: quickMotorYears.value.trim() || undefined
      })
      isQuickCreateMotorOpen.value = false
      await handleSelectMotor(created)
      showToast(`✓ Motor "${created.codigo}" registrado y seleccionado`)
    }
  } finally {
    isSavingQuickMotor.value = false
  }
}

const openQuickCreateModelModal = (initialName?: string) => {
  editingModelId.value = null
  quickModelName.value = (initialName || modelInput.value || '').trim().toUpperCase()
  quickModelBrandId.value = selectedBrand.value?.id || catalogStore.fabricantes[0]?.id || '11111111-1111-1111-1111-111111111101'
  quickModelYearStart.value = selectedYear.value && !isNaN(Number(selectedYear.value)) ? Number(selectedYear.value) : undefined
  quickModelYearEnd.value = undefined
  isModelOpen.value = false
  isQuickCreateModelOpen.value = true
}

const openEditModelModal = (mod: Modelo) => {
  editingModelId.value = mod.id
  quickModelName.value = mod.nombre.toUpperCase()
  quickModelBrandId.value = mod.fabricante_id
  quickModelYearStart.value = mod.anio_inicio
  quickModelYearEnd.value = mod.anio_fin
  isModelOpen.value = false
  isQuickCreateModelOpen.value = true
}

const handleSaveQuickModel = async () => {
  const cleanName = quickModelName.value.trim().toUpperCase()
  const brandId = quickModelBrandId.value || selectedBrand.value?.id || catalogStore.fabricantes[0]?.id
  if (!cleanName || !brandId) return
  isSavingQuickModel.value = true
  try {
    if (editingModelId.value) {
      const updated = await catalogStore.updateModelo(editingModelId.value, {
        fabricante_id: brandId,
        nombre: cleanName,
        anio_inicio: quickModelYearStart.value ? Number(quickModelYearStart.value) : null,
        anio_fin: quickModelYearEnd.value ? Number(quickModelYearEnd.value) : null
      })
      isQuickCreateModelOpen.value = false
      if (selectedModel.value?.id === updated.id) {
        selectedModel.value = updated
        modelInput.value = updated.nombre
      }
      showToast(`✓ Modelo actualizado a "${updated.nombre}"`)
    } else {
      const created = await catalogStore.createModelo(
        brandId,
        cleanName,
        quickModelYearStart.value ? Number(quickModelYearStart.value) : undefined,
        quickModelYearEnd.value ? Number(quickModelYearEnd.value) : undefined
      )
      isQuickCreateModelOpen.value = false
      await handleSelectModel(created)
      showToast(`✓ Modelo "${created.nombre}" registrado y seleccionado`)
    }
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'No se pudo guardar el modelo')
  } finally {
    isSavingQuickModel.value = false
  }
}

const openQuickCreateYearModal = (initialYear?: string) => {
  quickYearValue.value = (initialYear || yearInput.value || '').trim()
  isYearOpen.value = false
  isQuickCreateYearOpen.value = true
}

const handleSaveQuickYear = (directValue?: string) => {
  const val = (directValue !== undefined ? directValue : quickYearValue.value).trim()
  if (!val) return
  if (!customYears.value.includes(val) && !availableYears.value.includes(val)) {
    customYears.value = [val, ...customYears.value]
    try {
      localStorage.setItem(CUSTOM_YEARS_STORAGE_KEY, JSON.stringify(customYears.value))
    } catch {
      // Silencioso
    }
  }
  isQuickCreateYearOpen.value = false
  handleSelectYear(val)
  showToast(`✓ Año "${val}" agregado y seleccionado`)
}

// Control de visibilidad de filtros en vista móvil para liberar espacio vertical
const isMobileFiltersOpen = ref<boolean>(false)

const activeFilterCount = computed<number>(() => {
  let count = 0
  if (selectedBrand.value || brandInput.value) count++
  if (selectedMotor.value || motorInput.value) count++
  if (selectedModel.value || modelInput.value) count++
  if (selectedYear.value) count++
  if (selectedComponent.value) count++
  return count
})

// =============================================================================
// ACCESIBILIDAD Y CONTROL POR TECLADO EN SELECTORES DE COMBOBOX
// =============================================================================
const brandInputRef = ref<HTMLInputElement | null>(null)
const motorInputRef = ref<HTMLInputElement | null>(null)
const modelInputRef = ref<HTMLInputElement | null>(null)
const componentInputRef = ref<HTMLInputElement | null>(null)

const highlightedBrandIdx = ref<number>(0)
const highlightedModelIdx = ref<number>(0)
const highlightedComponentIdx = ref<number>(0)

const scrollItemIntoView = (selector: string) => {
  nextTick(() => {
    const el = document.querySelector(selector)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

watch(highlightedBrandIdx, (val) => scrollItemIntoView(`.brand-item-${val}`))
watch(highlightedModelIdx, (val) => scrollItemIntoView(`.model-item-${val}`))
watch(highlightedComponentIdx, (val) => scrollItemIntoView(`.component-item-${val}`))

const handleBrandKeydown = (e: KeyboardEvent) => {
  if (!isBrandOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      isBrandOpen.value = true
      highlightedBrandIdx.value = 0
      e.preventDefault()
    }
    return
  }
  const len = filteredBrands.value.length
  if (len === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedBrandIdx.value = (highlightedBrandIdx.value + 1) % len
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedBrandIdx.value = (highlightedBrandIdx.value - 1 + len) % len
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedBrandIdx.value >= 0 && highlightedBrandIdx.value < len) {
      handleSelectBrand(filteredBrands.value[highlightedBrandIdx.value])
      setTimeout(() => motorInputRef.value?.focus(), 60)
    }
  } else if (e.key === 'Escape') {
    isBrandOpen.value = false
  }
}

const handleMotorKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (brandMotorsList.value.length > 0 && brandMotorsList.value[0]) {
      handleSelectMotor(brandMotorsList.value[0])
      setTimeout(() => componentInputRef.value?.focus(), 60)
    }
  } else if (e.key === 'Escape' && motorInput.value) {
    handleClearSelectedMotor()
  }
}

const handleModelKeydown = (e: KeyboardEvent) => {
  if (!isModelOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      isModelOpen.value = true
      highlightedModelIdx.value = 0
      e.preventDefault()
    }
    return
  }
  const len = filteredModels.value.length
  if (len === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedModelIdx.value = (highlightedModelIdx.value + 1) % len
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedModelIdx.value = (highlightedModelIdx.value - 1 + len) % len
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedModelIdx.value >= 0 && highlightedModelIdx.value < len) {
      handleSelectModel(filteredModels.value[highlightedModelIdx.value])
      setTimeout(() => componentInputRef.value?.focus(), 60)
    }
  } else if (e.key === 'Escape') {
    isModelOpen.value = false
  }
}

const handleComponentKeydown = (e: KeyboardEvent) => {
  if (!isComponentOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      isComponentOpen.value = true
      highlightedComponentIdx.value = 0
      e.preventDefault()
    }
    return
  }
  const len = filteredComponentGroups.value.length
  if (len === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedComponentIdx.value = (highlightedComponentIdx.value + 1) % len
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedComponentIdx.value = (highlightedComponentIdx.value - 1 + len) % len
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedComponentIdx.value >= 0 && highlightedComponentIdx.value < len) {
      handleSelectComponent(filteredComponentGroups.value[highlightedComponentIdx.value])
    }
  } else if (e.key === 'Escape') {
    isComponentOpen.value = false
  }
}

/**
 * Resaltado visual reactivo: destaca en VERDE ESMERALDA las coincidencias exactas (diff <= 0.05)
 * y en AMARILLO las cotas que entran dentro del rango de tolerancia universal / individual.
 */
function getMeasurementMatchClass(partValue: number | undefined | null, filterValue: number | undefined | null, tol: number = 1.0): string {
  if (filterValue === undefined || filterValue === null || isNaN(Number(filterValue)) || partValue === undefined || partValue === null || isNaN(Number(partValue))) {
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }
  const diff = Math.abs(Number(partValue) - Number(filterValue))
  if (diff <= 0.05) {
    return 'bg-emerald-100 text-emerald-950 border-emerald-400 font-black ring-1 ring-emerald-500/60 shadow-2xs'
  }
  if (diff <= tol) {
    return 'bg-amber-100 text-amber-950 border-amber-400 font-bold ring-1 ring-amber-400/60 shadow-2xs'
  }
  return 'bg-slate-100 text-slate-500 border-slate-200 opacity-60'
}

/**
 * Resuelve de forma unificada el valor de cualquier parámetro técnico de una pieza,
 * consultando propiedades directas, dimensiones JSON, especificaciones técnicas y aliases canónicos.
 */
function getPartParamValue(part: RepuestoTecnico, key: string): any {
  if (!part) return undefined
  const dims = (part.dimensiones as any) || {}
  const specs = (part.especificaciones_tecnicas as any) || {}
  const direct = (part as any)[key]
  if (direct !== undefined && direct !== null) return direct
  if (dims[key] !== undefined && dims[key] !== null) return dims[key]
  if (specs[key] !== undefined && specs[key] !== null) return specs[key]

  // Si la parte tiene sub-filas (ej. Cojinetes), buscar en las sub-filas (Biela, Bancada)
  if (Array.isArray(dims.subfilas) && dims.subfilas.length > 0) {
    for (const sf of dims.subfilas) {
      if (sf.medidas && sf.medidas[key] !== undefined && sf.medidas[key] !== null && sf.medidas[key] !== '') {
        return sf.medidas[key]
      }
    }
  }

  const k = key.toLowerCase()

  // Diámetro cabeza / hongo (válvulas)
  if (k.includes('cabeza') || k.includes('hongo')) {
    return part.diametro_cabeza_mm ?? dims.diametro_cabeza_mm ?? dims.hongo ?? dims.hongo_mm ?? specs.hongo
  }
  // Diámetro vástago (válvulas, guías)
  if (k.includes('vastago') || k.includes('stem')) {
    return part.diametro_vastago_mm ?? dims.diametro_vastago_mm ?? dims.vastago ?? dims.vastago_mm ?? specs.vastago
  }
  // Largo / Longitud total / Altura
  if (k.includes('longitud') || k.includes('largo') || k.includes('altura')) {
    return part.longitud_total_mm ?? part.altura_mm ?? dims.longitud_total_mm ?? dims.largo_mm ?? dims.altura_mm ?? dims.largo ?? dims.length_mm ?? specs.largo
  }
  // Diámetro interior
  if (k.includes('interior') || k === 'int' || k === 'd_int') {
    return part.diametro_interior_mm ?? part.diametro_cilindro_mm ?? dims.diametro_interior_mm ?? dims.diam_int ?? dims.interior_mm ?? specs.diametro_interior
  }
  // Diámetro exterior
  if (k.includes('exterior') || k === 'ext' || k === 'd_ext') {
    return part.diametro_exterior_mm ?? dims.diametro_exterior_mm ?? dims.diametro_exterior_1_mm ?? dims.diam_ext ?? dims.exterior_mm ?? specs.diametro_exterior
  }
  // Tipo de válvula o posición (Admisión / Escape / IN / EX)
  if (k.includes('tipo') || k.includes('posicion') || k.includes('funcion')) {
    const val = (part as any).tipo_valvula ?? dims.tipo_valvula ?? dims.posicion ?? dims.tipo ?? specs.tipo
    if (val) return val
    const nom = (part.nombre || '').toLowerCase()
    if (nom.includes('admis') || nom.includes(' in ') || nom.endsWith(' in') || nom.includes('intake')) return 'Admisión'
    if (nom.includes('escap') || nom.includes(' ex ') || nom.endsWith(' ex') || nom.includes('exhaust')) return 'Escape'
  }
  // Ángulo de asiento
  if (k.includes('angulo')) {
    return part.angulo_asiento_grados ?? dims.angulo_asiento_grados ?? dims.angulo ?? specs.angulo
  }
  // Cuñero / ranuras / stem end
  if (k.includes('cunero') || k.includes('cuñero') || k.includes('ranura') || k.includes('stem_end')) {
    return dims.stem_end ?? dims.cunero ?? dims.cuñero ?? dims.ranuras ?? specs.cunero
  }
  // Rosca / Pernos
  if (k.includes('rosca')) {
    return part.medida_rosca ?? dims.medida_rosca ?? specs.medida_rosca
  }
  // Pestañas (Camisas)
  if (k.includes('pestaña') || k.includes('pestana') || k.includes('flange')) {
    if (k.includes('diam') || k.includes('d')) return dims.diametro_pestana_mm ?? dims.flange_dia_mm ?? dims.flange_d
    if (k.includes('espesor') || k.includes('e') || k.includes('h')) return dims.espesor_pestana_mm ?? dims.flange_height_mm ?? dims.flange_h
  }

  return undefined
}

/**
 * Estilo y coloreado de coincidencia para badges de tipo y posición (Admisión/IN vs Escape/EX).
 * Verde en coincidencia exacta, Amarillo en coincidencia semántica/parcial.
 */
function getPositionOrTypeBadgeClass(partVal: any, filterVal: any, opciones?: string[]): string {
  const strPart = String(partVal || '').trim()
  const lower = strPart.toLowerCase()
  const isAdm = lower === 'in' || lower.includes('admis') || lower.includes('intake')
  const isEsc = lower === 'ex' || lower.includes('escap') || lower.includes('exhaust')

  if (!filterVal || filterVal === '') {
    if (opciones && opciones.length > 0 && strPart) {
      return `${resolveOptionBadgeClass(strPart, opciones)} font-bold text-[10px]`
    }
    if (isAdm) return 'bg-cyan-100 text-[#038391] border-cyan-300 font-bold uppercase text-[10px]'
    if (isEsc) return 'bg-amber-100 text-amber-900 border-amber-300 font-bold uppercase text-[10px]'
    return 'bg-slate-100 text-slate-800 border-slate-200 uppercase text-[10px] font-bold'
  }

  const strFilter = String(filterVal).trim().toLowerCase()
  if (strFilter === lower) {
    return 'bg-emerald-100 text-emerald-950 border-emerald-400 font-black ring-1 ring-emerald-500/60 text-[10px]'
  }

  const matches = (isAdm && (strFilter === 'in' || strFilter.includes('admis'))) ||
                  (isEsc && (strFilter === 'ex' || strFilter.includes('escap'))) ||
                  lower.includes(strFilter) || strFilter.includes(lower)

  if (matches) {
    return 'bg-amber-100 text-amber-950 border-amber-400 font-bold ring-1 ring-amber-400/60 text-[10px]'
  }

  return 'bg-slate-100 text-slate-500 border-slate-200 opacity-60 text-[10px]'
}


// Barra de búsqueda global con debounce
const searchInput = ref<string>('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Vista activa ('motores' | 'grupos' | 'repuestos')
const activeViewTab = ref<'motores' | 'repuestos'>('motores')

// =============================================================================
// DEFINICIÓN DE GRUPOS / FAMILIAS DE PIEZAS (BASE + DINÁMICOS)
// =============================================================================
interface ComponentGroup {
  id: string
  title: string
  shortTitle: string
  category: string
  icon: string
  description: string
  sampleMeasurements: string
}

const baseComponentGroups: ComponentGroup[] = [
  {
    id: 'ajuste_valvula',
    title: 'Ajuste de válvula',
    shortTitle: 'Sellos de Válvula',
    category: 'Sellos',
    icon: 'CircleDot',
    description: 'Sellos y retenes de guía de válvula (Vitón / Alta temperatura)',
    sampleMeasurements: 'Diám. int. 4,8 mm, Diámetro exterior 10,8 mm y Altura 10 mm'
  },
  {
    id: 'valvula',
    title: 'Válvula de motor',
    shortTitle: 'Válvulas de Motor',
    category: 'Válvulas',
    icon: 'Wrench',
    description: 'Válvulas de admisión y escape estándar y sobremedida',
    sampleMeasurements: 'Hongo, vástago y altura'
  },
  {
    id: 'anillos_motor',
    title: 'Anillos de motor',
    shortTitle: 'Anillos de Pistón',
    category: 'Anillos',
    icon: 'Layers',
    description: 'Juegos de aros de pistón (Desglose explícito 1°, 2° y aceite)',
    sampleMeasurements: 'Diámetro, grosor primer anillo, altura grosor'
  },
  {
    id: 'tornillos_culata',
    title: 'Juego de tornillos de culata',
    shortTitle: 'Pernos de Culata',
    category: 'Pernos',
    icon: 'FileText',
    description: 'Tornillos y pernos de apriete para culata de cilindros',
    sampleMeasurements: 'Medida rosca, paso rosca, longitudes, cant.'
  },
  {
    id: 'casqueteria',
    title: 'Casquetería y Cojinetes',
    shortTitle: 'Casquetería',
    category: 'Casquetería',
    icon: 'CircleDot',
    description: 'Cojinetes de biela, bancada y arandelas axiales',
    sampleMeasurements: 'Muñón, alojamiento, ancho y tipo de cojinete'
  },
  {
    id: 'empaques_juntas',
    title: 'Empaques y Juntas',
    shortTitle: 'Empaques',
    category: 'Empaques',
    icon: 'Layers',
    description: 'Juntas de culata de grafito y multilámina MLS',
    sampleMeasurements: 'Diámetro de cilindro, espesor nominal'
  },
  {
    id: 'camisas_cilindro',
    title: 'Camisas de cilindro',
    shortTitle: 'Camisas de Cilindro',
    category: 'Camisas',
    icon: 'Layers',
    description: 'Camisas de cilindro terminadas y semiterminadas para bloque',
    sampleMeasurements: 'Int × Ext × Largo'
  },
  {
    id: 'guias_valvula',
    title: 'Guías de válvula',
    shortTitle: 'Guías de Válvula',
    category: 'Guías',
    icon: 'Layers',
    description: 'Guías de válvula para culata de motor (Admisión y Escape)',
    sampleMeasurements: 'Posición, Juego, Ø Int × Ø Ext × Largo'
  },
  {
    id: 'asientos_valvula',
    title: 'Asientos de válvula',
    shortTitle: 'Asientos de Válvula',
    category: 'Asientos',
    icon: 'CircleDot',
    description: 'Asientos de válvula para culata de cilindros',
    sampleMeasurements: 'Posición (IN/EX), cilindros'
  }
]

// Mapeo 100% dinámico de los grupos de Supabase con fallback a definiciones base
const componentGroups = computed<ComponentGroup[]>(() => {
  if (catalogStore.grupos && catalogStore.grupos.length > 0) {
    return catalogStore.grupos.map(g => {
      const base = baseComponentGroups.find(b => b.id === g.codigo || b.category.toLowerCase() === g.categoria.toLowerCase())
      return {
        id: g.codigo,
        title: g.nombre,
        shortTitle: g.categoria || g.nombre,
        category: g.categoria,
        icon: g.icono || (base ? base.icon : 'Layers'),
        description: g.descripcion || (base ? base.description : `Familia de ${g.nombre}`),
        sampleMeasurements: (g.parametros && g.parametros.length > 0)
          ? g.parametros.map(p => `${p.etiqueta}${p.unidad ? ` (${p.unidad})` : ''}`).slice(0, 3).join(', ')
          : (base ? base.sampleMeasurements : 'Medidas requeridas configuradas')
      }
    })
  }
  return baseComponentGroups
})

// =============================================================================
// FILTROS DE MEDIDAS TÉCNICAS Y TOLERANCIA UNIVERSAL (± mm)
// =============================================================================

// Filtro de Tolerancia Universal (± mm) aplicable a todas las cotas por defecto
const filterToleranciaMm = ref<number>(1.0)

// Diccionario reactivo de tolerancias específicas por cota individual (ej. 'selloDiamInt': 0.1)
const filterTolerancias = ref<Record<string, number | undefined>>({})

// Helper para obtener la tolerancia efectiva de un filtro específico (custom o fallback general)
function getTol(key: string): number {
  const custom = filterTolerancias.value[key]
  if (custom !== undefined && custom !== null && !isNaN(Number(custom)) && Number(custom) >= 0) {
    return Number(custom)
  }
  return filterToleranciaMm.value !== undefined && filterToleranciaMm.value !== null ? Number(filterToleranciaMm.value) : 1.0
}

const customTolerancesCount = computed(() => {
  return Object.values(filterTolerancias.value).filter(v => v !== undefined && v !== null && !isNaN(Number(v))).length
})

// Filtros para parámetros dinámicos de nuevos grupos
const dynamicParamFilters = ref<Record<string, any>>({})
const filterCodigoPart = ref<string>('')

const currentGroupDefinition = computed<GrupoRepuesto | null>(() => {
  if (!selectedComponent.value) return null
  const grp = catalogStore.grupos.find(g => g.codigo === selectedComponent.value?.id || g.id === selectedComponent.value?.id) || null
  if (!grp) return null
  if (grp.parametros && grp.parametros.length > 0) {
    return {
      ...grp,
      parametros: sanitizeGroupParams(grp.parametros)
    }
  }
  return grp
})

// Determina si la familia activa usa el formato unificado de tabla / sub-filas
const isCurrentGroupSubfilas = computed<boolean>(() => {
  if (!currentGroupDefinition.value) return false
  if (currentGroupDefinition.value.tipo_vista === 'tabla') return true
  const cfg = currentGroupDefinition.value.tabla_config
  return Boolean(
    cfg?.subfilas_activas ||
    cfg?.modo_filas === 'cojinetes' ||
    cfg?.modo_filas === 'subfilas' ||
    (cfg?.subfilas && cfg.subfilas.length > 0)
  )
})

const isCurrentGroupRingsTable = computed<boolean>(() => {
  if (!selectedComponent.value) return false
  if (isCurrentGroupSubfilas.value) return false
  return false
})

const isCurrentGroupGeneralTable = computed<boolean>(() => {
  if (!selectedComponent.value) return false
  if (isCurrentGroupSubfilas.value) return false
  return currentGroupDefinition.value?.tipo_vista === 'tabla' || isCurrentGroupRingsTable.value
})

const isPartTableFormat = (part: RepuestoTecnico): boolean => {
  if (isCurrentGroupSubfilas.value) return false
  if (isCurrentGroupRingsTable.value) return true
  if (currentGroupDefinition.value?.tipo_vista === 'tabla') return true
  if (currentGroupDefinition.value?.codigo === 'anillos_motor') return true
  return Array.isArray((part.dimensiones as any)?.anillos) && (part.dimensiones as any).anillos.length > 0
}

const isPartSubfilasFormat = (part: RepuestoTecnico): boolean => {
  if (isCurrentGroupSubfilas.value) return true
  const dims = part.dimensiones as any
  return Array.isArray(dims?.subfilas) && dims.subfilas.length > 0
}

export interface PartSubfilaDisplay {
  id?: string
  nombre: string
  codigo: string
  grupo?: string
  medidas: Record<string, any>
}

const getPartSubfilas = (part: RepuestoTecnico): PartSubfilaDisplay[] => {
  const dims = part.dimensiones as any
  const configuredPadres = currentGroupDefinition.value?.tabla_config?.subfila_padres || []
  if (Array.isArray(dims?.subfilas) && dims.subfilas.length > 0) {
    return dims.subfilas.map((sf: any, idx: number) => ({
      ...sf,
      grupo: (sf.grupo && String(sf.grupo).trim()) ? String(sf.grupo).trim() : (configuredPadres[idx] || '')
    }))
  }
  if (Array.isArray(dims?.anillos) && dims.anillos.length > 0) {
    const isConical = Boolean(part.diseno_conico || dims?.diseno_conico || dims?.keystone)
    return dims.anillos.map((ring: any, idx: number) => {
      const rawDesign =
        ring.tipo_diseno ||
        ring.identificador ||
        (ring.perfil && ring.perfil !== 'Estándar' ? ring.perfil : undefined) ||
        ring.forma ||
        (idx === 0 && isConical ? 'Cónico' : 'Plano')
      return {
        nombre: ring.posicion || `Anillo ${idx + 1}`,
        codigo: ring.codigo || (idx === 0 ? (part.codigo_oem || '') : ''),
        grupo: configuredPadres[idx] || '',
        medidas: {
          ...(ring.extra || {}),
          ...ring,
          diametro_cilindro_mm: ring.d1 ?? part.diametro_cilindro_mm,
          grosor_mm: ring.h1,
          altura_mm: ring.a1,
          tipo_diseno: rawDesign
        }
      }
    })
  }
  const configuredSubfilas = currentGroupDefinition.value?.tabla_config?.subfilas
  if (Array.isArray(configuredSubfilas) && configuredSubfilas.length > 0) {
    return configuredSubfilas.map((nombre, idx) => ({
      nombre,
      codigo: idx === 0 ? (part.codigo_oem || '') : '',
      grupo: configuredPadres[idx] || '',
      medidas: dims || {}
    }))
  }
  return [
    { nombre: 'Estándar', codigo: part.codigo_oem || '', grupo: configuredPadres[0] || '', medidas: dims || {} }
  ]
}

const currentGroupHasRowGroups = computed<boolean>(() => {
  const padres = currentGroupDefinition.value?.tabla_config?.subfila_padres
  if (Array.isArray(padres) && padres.some(g => g && g.trim())) return true
  return paginatedParts.value.some(p => getPartSubfilas(p).some(sf => sf.grupo && sf.grupo.trim()))
})

const getPartSubfilaRowSpans = (part: RepuestoTecnico) => {
  return buildRowSpanMeta(getPartSubfilas(part), sf => sf.grupo || '')
}

// Columnas técnicas visibles (en tabla) para la familia actual
const activeTableGroupColumns = computed<ParametroTecnicoDefinicion[]>(() => {
  if (!currentGroupDefinition.value?.parametros) return []
  return currentGroupDefinition.value.parametros
})

// Estructura de cabeceras de tabla anidadas (2 niveles: padre / sub-columnas)
const groupSubcolumnsHeaders = computed(() => {
  return buildNestedTableHeaders(activeTableGroupColumns.value)
})

// Determina si la familia actual activa el modo de sub-columnas
const hasGroupSubcolumns = computed<boolean>(() => {
  if (isCurrentGroupGeneralTable.value && !isCurrentGroupSubfilas.value) return false
  return groupSubcolumnsHeaders.value.hasSubcolumns
})

export interface CatalogFilterGroupBlock {
  parent: string | null
  params: ParametroTecnicoDefinicion[]
}

const groupedCatalogFilterParams = computed<CatalogFilterGroupBlock[]>(() => {
  if (!currentGroupDefinition.value?.parametros) return []
  const filterable = currentGroupDefinition.value.parametros.filter(p => p.filtrable !== false)
  const blocks: CatalogFilterGroupBlock[] = []

  for (const p of filterable) {
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

const hasGroupedFilterBlocks = computed<boolean>(() => {
  return groupedCatalogFilterParams.value.some(b => b.parent !== null)
})

const getShortParamFilterLabel = (param: ParametroTecnicoDefinicion): string => {
  const lbl = (param.etiqueta_corta || param.etiqueta || '').toLowerCase()
  const key = (param.clave || '').toLowerCase()
  if (lbl.includes('mín') || lbl.includes('min') || key.endsWith('_min') || key.endsWith('_min_mm')) {
    return 'Dmin (mm)'
  }
  if (lbl.includes('máx') || lbl.includes('max') || key.endsWith('_max') || key.endsWith('_max_mm')) {
    return 'Dmax (mm)'
  }
  return param.etiqueta_corta || param.etiqueta
}

const formatMetricNum = (num: number, unit?: string, decimals = 2): string => {
  if (unit === '°') return `${num}°`
  if (unitMode.value === 'milesimas' && (!unit || unit.toLowerCase() === 'mm')) {
    return `${(num / 25.4).toFixed(3)}"`
  }
  return decimals === -1
    ? (num % 1 === 0 ? num.toFixed(1) : String(num))
    : num.toFixed(decimals)
}

const formatPartParamColValue = (val: unknown, col: ParametroTecnicoDefinicion): string => {
  if (val == null || val === '') return '—'
  if (col.tipo_dato === 'booleano') return val ? 'Sí' : 'No'
  if (typeof val === 'number') {
    return formatMetricNum(val, col.unidad, 2)
  }
  if ((col.tipo_dato === 'numero' || col.unidad === 'mm') && !isNaN(Number(val))) {
    return formatMetricNum(Number(val), col.unidad, 2)
  }
  return String(val)
}

const getPartSubfilaRawValue = (sf: PartSubfilaDisplay, col: ParametroTecnicoDefinicion): unknown => {
  if (!sf.medidas) return undefined
  if (sf.medidas[col.clave] !== undefined) return sf.medidas[col.clave]
  const noSuffix = col.clave.replace(/_\d+$/, '')
  if (noSuffix !== col.clave && sf.medidas[noSuffix] !== undefined) return sf.medidas[noSuffix]
  if (col.columna_padre) {
    const parentSlug = col.columna_padre
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    if (parentSlug && col.clave.startsWith(`${parentSlug}_`)) {
      const stripped = col.clave.slice(parentSlug.length + 1)
      if (sf.medidas[stripped] !== undefined) return sf.medidas[stripped]
    }
  }
  return undefined
}

const getPartSubfilaValue = (sf: PartSubfilaDisplay, col: ParametroTecnicoDefinicion): string => {
  return formatPartParamColValue(getPartSubfilaRawValue(sf, col), col)
}

const CORE_TABLE_RING_KEYS = new Set([
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

const getTableGroupParam = (clave: string) => {
  const params = currentGroupDefinition.value?.parametros || []
  const direct = params.find(p => p.clave === clave)
  if (direct) return direct
  if (clave.endsWith('_h1')) {
    return params.find(p => p.clave === 'grosor_mm') || null
  }
  if (clave.endsWith('_a1')) {
    return params.find(p => p.clave === 'altura_mm') || null
  }
  return null
}

const getTableParamLabel = (clave: string, fallback: string): string => {
  const p = getTableGroupParam(clave)
  if (!p) return fallback
  return p.etiqueta_corta || p.etiqueta || fallback
}

const getTableParamUnit = (clave: string, fallback: string = 'mm'): string => {
  const p = getTableGroupParam(clave)
  return p ? p.unidad : fallback
}

const isTableParamInTable = (clave: string): boolean => {
  const p = getTableGroupParam(clave)
  return p ? Boolean(p.requerido) : true
}

const isTableParamInFilter = (clave: string): boolean => {
  if (clave === 'diseno_conico') {
    const p = currentGroupDefinition.value?.parametros.find(x => x.clave === 'diseno_conico')
    if (p) return p.filtrable !== false
    return currentGroupDefinition.value?.tabla_config?.habilitar_identificador !== false
  }
  const p = getTableGroupParam(clave)
  return p ? (p.filtrable !== false) : true
}

const tableColFirstHeader = computed<string>(() => {
  return currentGroupDefinition.value?.tabla_config?.titulo_primera_columna || 'Componente'
})

const tableShowIdentifier = computed<boolean>(() => {
  return currentGroupDefinition.value?.tabla_config?.habilitar_identificador !== false
})

const showTableColDiametro = computed<boolean>(() => isTableParamInTable('diametro_cilindro_mm'))
const showTableColGrosor = computed<boolean>(() => {
  const gParam = currentGroupDefinition.value?.parametros.find(p => p.clave === 'grosor_mm')
  if (gParam) return Boolean(gParam.requerido)
  return isTableParamInTable('anillo1_h1') || isTableParamInTable('anillo2_h1') || isTableParamInTable('aceite_h1')
})
const showTableColAltura = computed<boolean>(() => {
  const aParam = currentGroupDefinition.value?.parametros.find(p => p.clave === 'altura_mm')
  if (aParam) return Boolean(aParam.requerido)
  return isTableParamInTable('anillo1_a1') || isTableParamInTable('anillo2_a1') || isTableParamInTable('aceite_a1')
})

const tableColDiametroHeader = computed<string>(() => {
  const p = getTableGroupParam('diametro_cilindro_mm')
  if (!p) return 'Diámetro'
  const base = p.etiqueta_corta || p.etiqueta || 'Diámetro'
  return p.unidad && p.unidad !== 'mm' ? `${base} (${p.unidad})` : base
})

const tableColGrosorHeader = computed<string>(() => {
  const p = getTableGroupParam('grosor_mm') || getTableGroupParam('anillo1_h1') || getTableGroupParam('anillo2_h1') || getTableGroupParam('aceite_h1')
  if (!p) return 'Grosor'
  const base = p.etiqueta_corta || p.etiqueta || 'Grosor'
  return p.unidad && p.unidad !== 'mm' ? `${base} (${p.unidad})` : base
})

const tableColAlturaHeader = computed<string>(() => {
  const p = getTableGroupParam('altura_mm') || getTableGroupParam('anillo1_a1') || getTableGroupParam('anillo2_a1') || getTableGroupParam('aceite_a1')
  if (!p) return 'Altura'
  const base = p.etiqueta_corta || p.etiqueta || 'Altura'
  return p.unidad && p.unidad !== 'mm' ? `${base} (${p.unidad})` : base
})

const extraTableFilterParams = computed(() => {
  if (!currentGroupDefinition.value?.parametros) return []
  return currentGroupDefinition.value.parametros.filter(
    p => !CORE_TABLE_RING_KEYS.has(p.clave) && p.filtrable !== false
  )
})

// 1. Ajuste de válvula (Sellos)
const filterSelloDiamInt = ref<number | undefined>(undefined)
const filterSelloDiamExt = ref<number | undefined>(undefined)
const filterSelloAltura = ref<number | undefined>(undefined)

// 2. Válvula
const filterValvulaHongo = ref<number | undefined>(undefined)
const filterValvulaVastago = ref<number | undefined>(undefined)
const filterValvulaAltura = ref<number | undefined>(undefined)
const filterValvulaCunero = ref<string>('')

// 3. Anillos de motor: Diámetro, Anillos numerados (1, 2, 3...) y Anillo de aceite
const filterAnilloTab = ref<'todos' | '1' | '2' | '3' | 'aceite'>('todos')
const filterAnilloDiametro = ref<number | undefined>(undefined)      // Diámetro (la primera siempre)
const filterAnilloGrosor1 = ref<number | undefined>(undefined)        // 1: Grosor
const filterAnilloRadial1 = ref<number | undefined>(undefined)        // 1: Altura
const filterAnilloGrosor2 = ref<number | undefined>(undefined)        // 2: Grosor
const filterAnilloRadial2 = ref<number | undefined>(undefined)        // 2: Altura
const filterAnilloGrosor3 = ref<number | undefined>(undefined)        // 3: Grosor (si lleva 4 anillos)
const filterAnilloRadial3 = ref<number | undefined>(undefined)        // 3: Altura (si lleva 4 anillos)
const filterAnilloGrosorAceite = ref<number | undefined>(undefined)   // Anillo de aceite: Grosor (el último siempre)
const filterAnilloRadialAceite = ref<number | undefined>(undefined)   // Anillo de aceite: Altura (el último siempre)

// 4. Juego de tornillos de culata
const filterPernoMedidaRosca = ref<string>('')
const filterPernoGrosor = ref<number | undefined>(undefined)
const filterPernoPasoRosca = ref<number | undefined>(undefined)
const filterPernoLongitud = ref<number | undefined>(undefined)
const filterPernoCantidad = ref<number | undefined>(undefined)
const filterPernoPasoRosca1 = ref<number | undefined>(undefined)
const filterPernoLongitud1 = ref<number | undefined>(undefined)
const filterPernoLongitud2 = ref<number | undefined>(undefined)

// 5. Casquetería (Cojinetes y Bujes: MS, CB, TW, CH, PB)
const filterCasqueteTipo = ref<string>('') // 'MS', 'CB', 'TW', 'CH', 'PB'
const filterCasqueteShaft = ref<number | undefined>(undefined)   // SHAFT / Muñón eje mm
const filterCasqueteHousing = ref<number | undefined>(undefined) // HOUSING / Alojamiento mm
const filterCasqueteTWall = ref<number | undefined>(undefined)   // T WALL / Espesor pared mm
const filterCasqueteLength = ref<number | undefined>(undefined)  // LENGTH / Ancho casquete mm

// Validadores robustos para filtros de medida dimensional
const isFilterActive = (val: unknown): val is number => {
  return val !== undefined && val !== null && val !== '' && !isNaN(Number(val)) && Number(val) > 0
}

// Contador de filtros de medida activos (Especializado Anillos + Dinámico para todos los demás)
const activeMeasurementsCount = computed(() => {
  let count = 0
  if (filterCodigoPart.value.trim() !== '') {
    count++
  }
  if (selectedComponent.value && isCurrentGroupRingsTable.value) {
    count += [
      filterAnilloDiametro.value, 
      filterAnilloGrosor1.value, 
      filterAnilloRadial1.value,
      filterAnilloGrosor2.value, 
      filterAnilloRadial2.value,
      filterAnilloGrosor3.value,
      filterAnilloRadial3.value,
      filterAnilloGrosorAceite.value, 
      filterAnilloRadialAceite.value
    ].filter(isFilterActive).length
  }
  // Sumar filtros dinámicos activos
  count += Object.values(dynamicParamFilters.value).filter(v => v !== undefined && v !== null && v !== '').length
  return count
})

const resetMeasurementsFilters = () => {
  filterCodigoPart.value = ''
  filterSelloDiamInt.value = undefined
  filterSelloDiamExt.value = undefined
  filterSelloAltura.value = undefined

  filterValvulaHongo.value = undefined
  filterValvulaVastago.value = undefined
  filterValvulaAltura.value = undefined
  filterValvulaCunero.value = ''

  filterAnilloTab.value = 'todos'
  filterAnilloDiametro.value = undefined
  filterAnilloGrosor1.value = undefined
  filterAnilloRadial1.value = undefined
  filterAnilloGrosor2.value = undefined
  filterAnilloRadial2.value = undefined
  filterAnilloGrosor3.value = undefined
  filterAnilloRadial3.value = undefined
  filterAnilloGrosorAceite.value = undefined
  filterAnilloRadialAceite.value = undefined

  filterPernoMedidaRosca.value = ''
  filterPernoGrosor.value = undefined
  filterPernoPasoRosca.value = undefined
  filterPernoLongitud.value = undefined
  filterPernoCantidad.value = undefined
  filterPernoPasoRosca1.value = undefined
  filterPernoLongitud1.value = undefined
  filterPernoLongitud2.value = undefined

  filterCasqueteTipo.value = ''
  filterCasqueteShaft.value = undefined
  filterCasqueteHousing.value = undefined
  filterCasqueteTWall.value = undefined
  filterCasqueteLength.value = undefined

  dynamicParamFilters.value = {}
  filterTolerancias.value = {}

  showToast('Filtros de medidas restablecidos')
}

// =============================================================================
// TOAST Y COPIADO DE CÓDIGOS
// =============================================================================
const toastMessage = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (msg: string) => {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 2400)
}

const copiedCode = ref<string | null>(null)
const copyToClipboard = async (text: string, label?: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedCode.value = text
    showToast(`✓ Copiado: ${label ? `${label} ` : ''}${text}`)
    setTimeout(() => {
      if (copiedCode.value === text) copiedCode.value = null
    }, 1800)
  } catch {
    showToast(`Código: ${text}`)
  }
}

// Copiar Ficha Técnica Cruzada
const copyFullCross = async (part: RepuestoTecnico) => {
  const oemCodes = getPartOemCodes(part)
  const lines: string[] = [
    `REPARACIÓN: ${part.nombre} [${part.subsistema}]`,
    `OEM: ${oemCodes.length > 0 ? oemCodes.join(' / ') : part.codigo_oem}`
  ]
  const eqs = getPartEquivalencias(part)
  if (eqs && eqs.length > 0) {
    eqs.forEach(eq => {
      lines.push(`${eq.marca_alterna}: ${eq.codigo_alterno}`)
    })
  }
  if (part.categoria === 'Camisas' || part.dimensiones?.diametro_interior_mm || part.dimensiones?.diametro_exterior_mm) {
    const a = part.dimensiones?.diametro_interior_mm || part.diametro_cilindro_mm || '-'
    const b = part.dimensiones?.diametro_exterior_mm || '-'
    const c = part.dimensiones?.longitud_total_mm || part.longitud_total_mm || '-'
    lines.push(`Camisa: Int ${a}mm | Ext ${b}mm | Largo ${c}mm`)
  } else if (part.diametro_interior_mm) {
    lines.push(`Ajuste Válvula: Int ${part.diametro_interior_mm}mm | Ext ${part.diametro_exterior_mm}mm | Alt ${part.altura_mm}mm`)
  }
  if (part.diametro_cabeza_mm) {
    lines.push(`Válvula: Hongo ${part.diametro_cabeza_mm}mm | Vástago ${part.diametro_vastago_mm}mm | Altura ${part.longitud_total_mm}mm`)
  }
  if (part.diametro_cilindro_mm && part.categoria !== 'Camisas') {
    lines.push(`Anillos: Cil ${part.diametro_cilindro_mm}mm | Anillo 1: ${part.espesor_anillo1_mm || '-'}mm | Anillo 2: ${part.espesor_anillo2_mm || '-'}mm | Aceite: ${part.espesor_aceite_mm || '-'}mm`)
  }
  if (part.medida_rosca) {
    lines.push(`Tornillos Culata: ${part.medida_rosca}x${part.paso_rosca_mm || 1.25} | Long ${part.longitud_perno_mm || 120}mm | Cant: ${part.cantidad_piezas || 10}`)
  }
  await copyToClipboard(lines.join(' | '), 'Ficha técnica')
}

// Carrito / Agregar repuesto a Orden de Trabajo
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
      category: part.categoria,
      motor: part.motor?.codigo || selectedMotor.value?.codigo || 'Universal',
      timestamp: Date.now()
    })
    localStorage.setItem('swgora_cart_parts', JSON.stringify(cart))
  } catch {
    // Silencioso
  }
  showToast(`✓ ${part.codigo_oem} agregado a la Orden de Trabajo`)
  setTimeout(() => {
    if (addedPartId.value === part.id) addedPartId.value = null
  }, 1800)
}

const addSubfilaToWorkOrder = (part: RepuestoTecnico, subfila: { nombre: string; codigo: string }) => {
  const code = subfila.codigo?.trim() || part.codigo_oem
  const name = `${part.nombre} (${subfila.nombre})`
  const itemKey = `${part.id}-${subfila.nombre}`
  addedPartId.value = itemKey
  try {
    const raw = localStorage.getItem('swgora_cart_parts') || '[]'
    const cart = JSON.parse(raw)
    cart.push({
      id: itemKey,
      code: code,
      name: name,
      price: part.precio,
      category: part.categoria,
      motor: part.motor?.codigo || selectedMotor.value?.codigo || 'Universal',
      timestamp: Date.now()
    })
    localStorage.setItem('swgora_cart_parts', JSON.stringify(cart))
  } catch {
    // Silencioso
  }
  showToast(`✓ ${code} (${subfila.nombre}) agregado a la Orden`)
  setTimeout(() => {
    if (addedPartId.value === itemKey) addedPartId.value = null
  }, 1800)
}

// =============================================================================
// CASCADA REACTIVA: FABRICANTE -> MODELO -> CÓDIGO DE MOTOR
// =============================================================================

// 1. Filtrado de MARCAS / FABRICANTES
const filteredBrands = computed(() => {
  const q = brandInput.value.toLowerCase().trim()
  const list = catalogStore.fabricantes
  if (!q || (selectedBrand.value && q === selectedBrand.value.nombre.toLowerCase().trim())) {
    return list
  }
  return list.filter(f => 
    f.nombre.toLowerCase().includes(q) || 
    (f.pais_origen && f.pais_origen.toLowerCase().includes(q))
  )
})

const handleFocusBrand = (e?: Event) => {
  isBrandOpen.value = true
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
}

const handleSelectBrand = async (fab: Fabricante) => {
  selectedBrand.value = fab
  brandInput.value = fab.nombre.toUpperCase()
  isBrandOpen.value = false
  showAllMotors.value = false
  motorCurrentPage.value = 1

  // Reiniciar modelo y motor subordinados
  selectedModel.value = null
  modelInput.value = ''
  selectedMotor.value = null
  motorInput.value = ''

  // Limpiar filtros dimensionales para garantizar catálogo limpio en la nueva marca
  resetMeasurementsFilters()

  await catalogStore.selectFabricante(fab.id)

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, fab.id)
  } else {
    activeViewTab.value = 'motores'
  }
}

const handleClearSelectedBrand = async () => {
  brandInput.value = ''
  setTimeout(() => brandInputRef.value?.focus(), 50)
  selectedBrand.value = null
  await catalogStore.selectFabricante(null)

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category)
  } else if (selectedMotor.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
  } else {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  }
}

// 2. Filtrado de MODELOS (CASCADA NIVEL 2)
const filteredModels = computed(() => {
  const q = normalizeText(modelInput.value)
  const list = catalogStore.availableModelos
  if (!q || (selectedModel.value && q === normalizeText(selectedModel.value.nombre))) {
    return list
  }
  return list.filter(m => 
    normalizeText(m.nombre).includes(q) ||
    (m.fabricante_id && normalizeText(getBrandName(m.fabricante_id)).includes(q))
  )
})

const handleSelectModel = async (mod: Modelo) => {
  selectedModel.value = mod
  modelInput.value = mod.nombre
  isModelOpen.value = false
  motorCurrentPage.value = 1

  // Reiniciar motor subordinado solo si no coincide con el modelo
  if (selectedMotor.value && selectedMotor.value.modelo_id && selectedMotor.value.modelo_id !== mod.id) {
    selectedMotor.value = null
    motorInput.value = ''
  }

  // Si no había fabricante seleccionado y el modelo pertenece a uno, autocompletar fabricante
  if (!selectedBrand.value && mod.fabricante_id) {
    const fab = catalogStore.fabricantes.find(f => f.id === mod.fabricante_id)
    if (fab) {
      selectedBrand.value = fab
      brandInput.value = fab.nombre.toUpperCase()
    }
  }

  await catalogStore.selectModelo(mod.id)

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id, mod.id)
  } else {
    activeViewTab.value = 'motores'
  }
}

const handleClearSelectedModel = async () => {
  selectedModel.value = null
  setTimeout(() => modelInputRef.value?.focus(), 50)
  modelInput.value = ''
  await catalogStore.selectModelo(null)
  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id)
  }
}

const onFocusModel = (e?: Event) => {
  isModelOpen.value = true
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
}
const onInputModel = () => { isModelOpen.value = true }
const onFocusMotor = (e?: Event) => {
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
}
const onInputMotor = () => {
  // Al cambiar el filtro de motor, limpiar selección puntual y volver a mostrar los motores disponibles en la tabla
  if (selectedMotor.value) {
    selectedMotor.value = null
    catalogStore.selectedMotorId = null
  }
  activeViewTab.value = 'motores'
  if (motorInput.value.trim().length > 0 || !selectedBrand.value) {
    showAllMotors.value = true
  }
}

// 3. Filtrado de MOTORES DISPONIBLES (CASCADA NIVEL 3)
const availableMotors = computed(() => {
  return catalogStore.availableMotores
})

const handleSelectMotor = async (mot: Motor) => {
  selectedMotor.value = mot
  motorInput.value = mot.codigo

  // Limpiar filtros dimensionales previos para el nuevo motor
  resetMeasurementsFilters()

  await catalogStore.selectMotor(mot.id)

  // Actualizar marca acorde al motor elegido (cuando no había marca o difiere)
  if (mot.fabricante_id && (!selectedBrand.value || selectedBrand.value.id !== mot.fabricante_id)) {
    const fab = catalogStore.fabricantes.find(f => f.id === mot.fabricante_id)
    if (fab) {
      selectedBrand.value = fab
      brandInput.value = fab.nombre.toUpperCase()
    }
  }

  // Actualizar modelo asociado si existe
  if (mot.modelo_id) {
    const mod = catalogStore.modelos.find(m => m.id === mot.modelo_id)
    if (mod) {
      selectedModel.value = mod
      modelInput.value = mod.nombre
    }
  }

  // Al seleccionar un motor: cargar siempre sus repuestos (displayedParts filtra por selectedComponent automáticamente)
  activeViewTab.value = 'repuestos'
  await catalogStore.fetchRepuestosByMotor(mot.id)
}

const handleClearSelectedMotor = async () => {
  selectedMotor.value = null
  motorInput.value = ''
  catalogStore.selectedMotorId = null
  activeViewTab.value = 'motores'
  if (selectedBrand.value || selectedModel.value || effectiveYearFilter.value || showAllMotors.value) {
    catalogStore.repuestos = []
  } else if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category)
  } else {
    catalogStore.repuestos = []
  }
}

// 4. Filtrado de TIPOS DE COMPONENTE (BASE + DINÁMICOS)
const filteredComponentGroups = computed(() => {
  const q = componentInput.value.toLowerCase().trim()
  const list = componentGroups.value
  if (!q || (selectedComponent.value && (
    q === selectedComponent.value.title.toLowerCase().trim() ||
    q === selectedComponent.value.shortTitle.toLowerCase().trim() ||
    q === selectedComponent.value.category.toLowerCase().trim()
  ))) {
    return list
  }
  return list.filter(g => 
    g.title.toLowerCase().includes(q) || 
    g.shortTitle.toLowerCase().includes(q) ||
    g.category.toLowerCase().includes(q) ||
    g.description.toLowerCase().includes(q)
  )
})

const handleFocusComponent = (e?: Event) => {
  isComponentOpen.value = true
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
  if (!catalogStore.grupos || catalogStore.grupos.length === 0) {
    catalogStore.fetchGrupos()
  }
}

const handleSelectComponent = async (comp: ComponentGroup) => {
  selectedComponent.value = comp
  componentInput.value = comp.title
  isComponentOpen.value = false
  activeViewTab.value = 'repuestos'

  // Limpiar filtros dimensionales al alternar familias de componentes
  resetMeasurementsFilters()

  // Si hay motor seleccionado, cargar repuestos del motor
  if (selectedMotor.value) {
    await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
  } else {
    // Al solo tener seleccionado el componente (con o sin marca seleccionada):
    // Cargar todos los repuestos de este grupo directamente desde Supabase!
    await catalogStore.fetchRepuestosByGrupo(comp.category, undefined, selectedBrand.value?.id, selectedModel.value?.id)
  }
}

const handleClearSelectedComponent = async () => {
  componentInput.value = ''
  selectedComponent.value = null
  resetMeasurementsFilters()
  if (selectedMotor.value) {
    await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
    activeViewTab.value = 'repuestos'
  } else if (selectedBrand.value || brandInput.value) {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  } else {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  }
}

// Limpiar todo y restaurar estado
const handleResetAll = async () => {
  brandInput.value = ''
  setTimeout(() => brandInputRef.value?.focus(), 50)
  modelInput.value = ''
  motorInput.value = ''
  componentInput.value = ''
  searchInput.value = ''
  selectedBrand.value = null
  selectedModel.value = null
  selectedMotor.value = null
  selectedComponent.value = null
  selectedYear.value = ''
  yearInput.value = ''
  showAllMotors.value = false
  isBrandOpen.value = false
  isModelOpen.value = false
  isYearOpen.value = false
  isComponentOpen.value = false
  activeViewTab.value = 'motores'
  tableSearchFilter.value = ''
  tableBrandFilter.value = 'Todas las marcas'
  motorCurrentPage.value = 1
  resetMeasurementsFilters()
  await catalogStore.resetFilters()
  showToast('Filtros y búsqueda restablecidos')
}

// =============================================================================
// BÚSQUEDA GLOBAL CON DEBOUNCE (CÓDIGO PIEZA, DESCRIPCIÓN Y EQUIVALENCIA)
// =============================================================================
const handleSearchInput = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    catalogStore.searchParts(searchInput.value)
    if (searchInput.value.trim().length > 0) {
      activeViewTab.value = 'repuestos'
    }
  }, 300)
}

const handleClearSearch = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchInput.value = ''
  if (selectedMotor.value) {
    catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
  } else if (selectedComponent.value) {
    catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id, selectedModel.value?.id)
  } else {
    catalogStore.repuestos = []
    if (selectedBrand.value) {
      activeViewTab.value = 'motores'
    }
  }
}

// =============================================================================
// TABLA DE MOTORES DE LA MARCA (ESTILO TECDOC / AJUSA)
// =============================================================================
const brandMotorsList = computed<Motor[]>(() => {
  let list = availableMotors.value

  const q = motorInput.value.trim().toLowerCase()
  const isSelectedMotorCurrent = selectedMotor.value && (
    q === selectedMotor.value.codigo.toLowerCase().trim() ||
    (selectedMotor.value.nombre_comercial && q === selectedMotor.value.nombre_comercial.toLowerCase().trim()) ||
    (selectedMotor.value.denominacion_venta && q === selectedMotor.value.denominacion_venta.toLowerCase().trim())
  )

  if (q && !isSelectedMotorCurrent) {
    const matched = list.filter(m =>
      m.codigo.toLowerCase().includes(q) ||
      (m.nombre_comercial && m.nombre_comercial.toLowerCase().includes(q)) ||
      (m.denominacion_venta && m.denominacion_venta.toLowerCase().includes(q)) ||
      getMotorModelName(m).toLowerCase().includes(q) ||
      m.combustible.toLowerCase().includes(q) ||
      (m.fabricante_id && getBrandName(m.fabricante_id).toLowerCase().includes(q))
    )
    list = sortMotorsByRelevance(matched, q)
  }

  if (effectiveYearFilter.value) {
    const yr = Number(effectiveYearFilter.value)
    if (!isNaN(yr) && yr > 0) {
      list = list.filter(mot => {
        if ((mot as any).anios && String((mot as any).anios).trim() !== '') {
          return doesYearMatchText((mot as any).anios, yr)
        }
        if (mot.denominacion_venta && /\b(19|20)\d{2}\b/.test(mot.denominacion_venta)) {
          return doesYearMatchText(mot.denominacion_venta, yr)
        }
        if (mot.nombre_comercial && /\b(19|20)\d{2}\b/.test(mot.nombre_comercial)) {
          return doesYearMatchText(mot.nombre_comercial, yr)
        }
        if (mot.modelo_id) {
          const mod = catalogStore.modelos.find(m => m.id === mot.modelo_id)
          if (mod && mod.anio_inicio) {
            const end = mod.anio_fin || 2026
            return yr >= mod.anio_inicio && yr <= end
          }
        }
        return false
      })
    }
  }
  return list
})

const motorCurrentPage = ref<number>(1)
const motorPageSize = 10
const motorTotalPages = computed(() => Math.ceil(brandMotorsList.value.length / motorPageSize) || 1)
const paginatedMotors = computed(() => {
  const start = (motorCurrentPage.value - 1) * motorPageSize
  return brandMotorsList.value.slice(start, start + motorPageSize)
})
const motorStartIndex = computed(() => (motorCurrentPage.value - 1) * motorPageSize)
const motorEndIndex = computed(() => Math.min(motorCurrentPage.value * motorPageSize, brandMotorsList.value.length))

const goToFirstMotorPage = () => { motorCurrentPage.value = 1 }
const goToPrevMotorPage = () => { if (motorCurrentPage.value > 1) motorCurrentPage.value-- }
const goToNextMotorPage = () => { if (motorCurrentPage.value < motorTotalPages.value) motorCurrentPage.value++ }
const goToLastMotorPage = () => { motorCurrentPage.value = motorTotalPages.value }

watch([selectedBrand, selectedModel, selectedYear, yearInput, motorInput], () => {
  motorCurrentPage.value = 1
})

const getMotorModelName = (mot: Motor): string => {
  if (mot.modelo?.nombre) return mot.modelo.nombre
  if (mot.modelo_id) {
    const mod = catalogStore.modelos.find(m => m.id === mot.modelo_id)
    if (mod) return mod.nombre
  }
  return mot.denominacion_venta || '—'
}

const getMotorYearsLabel = (mot: Motor): string => {
  if (mot.anios && String(mot.anios).trim()) return String(mot.anios).trim()
  if (mot.modelo_id) {
    const mod = catalogStore.modelos.find(m => m.id === mot.modelo_id)
    if (mod?.anio_inicio) return `${mod.anio_inicio}${mod.anio_fin ? '–' + mod.anio_fin : '+'}`
  }
  return '—'
}

const getBrandName = (fabId: string): string => {
  const fab = catalogStore.fabricantes.find(f => f.id === fabId)
  return fab?.nombre.toUpperCase() || 'TOYOTA'
}

// =============================================================================
// FUNCIONES AUXILIARES PARA CUADRO TÉCNICO DE ANILLOS RIK / TALLER: d1 (D), h1 (B), a1 (T)
// =============================================================================
const conicalCache = new WeakMap<RepuestoTecnico, boolean>()
const ringsCache = new WeakMap<RepuestoTecnico, PartRingItem[]>()
const oemCache = new WeakMap<RepuestoTecnico, string[]>()

const isPartConical = (part: RepuestoTecnico | null | undefined): boolean => {
  if (!part) return false
  const cached = conicalCache.get(part)
  if (cached !== undefined) return cached

  const dims = part.dimensiones as any
  const spec = part.especificaciones_tecnicas as any
  const rings = dims?.anillos as any[] | undefined
  const hasConicalRing = Array.isArray(rings) && rings.some(r =>
    (r.perfil && (String(r.perfil).toUpperCase().includes('CÓNIC') || String(r.perfil).toUpperCase().includes('CONIC') || String(r.perfil).toUpperCase().includes('KEYSTONE'))) ||
    (r.forma && (String(r.forma).toUpperCase().includes('KEYSTONE') || String(r.forma).toUpperCase().includes('CÓNIC') || String(r.forma).toUpperCase().includes('CONIC')))
  )
  const res = Boolean(
    hasConicalRing ||
    part.diseno_conico ||
    dims?.diseno_conico ||
    spec?.diseno_conico ||
    dims?.keystone ||
    spec?.keystone ||
    (dims?.forma1 && String(dims.forma1).toUpperCase().includes('KEYSTONE')) ||
    (spec?.forma1 && String(spec.forma1).toUpperCase().includes('KEYSTONE'))
  )
  conicalCache.set(part, res)
  return res
}

const getKeystoneLabel = (part: RepuestoTecnico | null | undefined): string => {
  if (!part) return ''
  const dims = part.dimensiones as any
  const spec = part.especificaciones_tecnicas as any
  return dims?.keystone || spec?.keystone || dims?.forma1 || spec?.forma1 || '1ST=KEYSTONE'
}

interface PartRingItem {
  posicion: string
  d1: number | null
  h1: number | null
  a1: number | null
  perfil?: string
  identificador?: string
  extra?: Record<string, any>
  [key: string]: any
}

const getPartRingsList = (part: RepuestoTecnico): PartRingItem[] => {
  if (!part) return []
  const cached = ringsCache.get(part)
  if (cached) return cached

  let result: PartRingItem[]
  const rings = (part.dimensiones as any)?.anillos as any[] | undefined
  if (rings && rings.length > 0) {
    const total = rings.length
    result = rings.map((r, idx) => {
      const isLast = idx === total - 1
      const isOil = isCurrentGroupRingsTable.value && (String(r.posicion || '').toLowerCase().includes('oil') || String(r.posicion || '').toLowerCase().includes('aceite') || isLast)
      const rawPerfil = r.identificador || r.perfil || (r.forma && (
        String(r.forma).toUpperCase().includes('KEYSTONE') ||
        String(r.forma).toUpperCase().includes('CÓNIC') ||
        String(r.forma).toUpperCase().includes('CONIC') ||
        String(r.forma).toUpperCase().includes('ESPIRAL') ||
        String(r.forma).toUpperCase().includes('ESCALON') ||
        String(r.forma).toUpperCase().includes('RASPADOR')
      ) ? String(r.forma) : undefined) || (isCurrentGroupRingsTable.value && idx === 0 && isPartConical(part) ? 'Cónico / Keystone' : undefined)
      return {
        ...r,
        posicion: (r.posicion && String(r.posicion).trim()) ? String(r.posicion).trim() : (isOil ? 'Anillo de aceite' : (isCurrentGroupRingsTable.value ? `Anillo ${idx + 1}` : `Fila ${idx + 1}`)),
        d1: r.d1 != null ? Number(r.d1) : (part.diametro_cilindro_mm ? Number(part.diametro_cilindro_mm) : null),
        h1: r.h1 != null ? Number(r.h1) : null,
        a1: r.a1 != null ? Number(r.a1) : null,
        perfil: rawPerfil,
        identificador: r.identificador || rawPerfil,
        extra: r.extra || {}
      }
    })
  } else if (isCurrentGroupRingsTable.value || part.categoria === 'Anillos') {
    const d = part.diametro_cilindro_mm ? Number(part.diametro_cilindro_mm) : null
    const dims = part.dimensiones as any
    const fallback: PartRingItem[] = [
      {
        posicion: 'Anillo 1',
        d1: d,
        h1: part.espesor_anillo1_mm ? Number(part.espesor_anillo1_mm) : null,
        a1: dims?.espesor_radial1_mm ? Number(dims.espesor_radial1_mm) : (dims?.altura_radial1_mm ? Number(dims.altura_radial1_mm) : null),
        perfil: isPartConical(part) ? 'Cónico / Keystone' : undefined
      },
      {
        posicion: 'Anillo 2',
        d1: d,
        h1: part.espesor_anillo2_mm ? Number(part.espesor_anillo2_mm) : null,
        a1: dims?.espesor_radial2_mm ? Number(dims.espesor_radial2_mm) : (dims?.altura_radial2_mm ? Number(dims.altura_radial2_mm) : null)
      }
    ]
    if (part.espesor_anillo3_mm != null || dims?.espesor_anillo3_mm != null || dims?.altura_radial3_mm != null || dims?.espesor_radial3_mm != null) {
      fallback.push({
        posicion: 'Anillo 3',
        d1: d,
        h1: part.espesor_anillo3_mm != null ? Number(part.espesor_anillo3_mm) : (dims?.espesor_anillo3_mm != null ? Number(dims.espesor_anillo3_mm) : null),
        a1: dims?.altura_radial3_mm != null ? Number(dims.altura_radial3_mm) : (dims?.espesor_radial3_mm != null ? Number(dims.espesor_radial3_mm) : null)
      })
    }
    fallback.push({
      posicion: 'Anillo de aceite',
      d1: d,
      h1: part.espesor_aceite_mm ? Number(part.espesor_aceite_mm) : null,
      a1: dims?.altura_radial_aceite_mm ? Number(dims.altura_radial_aceite_mm) : (dims?.espesor_radial_aceite_mm ? Number(dims.espesor_radial_aceite_mm) : null)
    })
    result = fallback
  } else {
    // Para otra familia en tabla sin filas explícitas aún, creamos una fila por defecto
    const dims = (part.dimensiones as any) || {}
    result = [
      {
        posicion: currentGroupDefinition.value?.tabla_config?.subfilas?.[0] || '1',
        d1: null,
        h1: null,
        a1: null,
        extra: { ...dims }
      }
    ]
  }

  ringsCache.set(part, result)
  return result
}

const getGeneralTableRowValue = (ring: PartRingItem, clave: string): unknown => {
  if (!ring) return undefined
  if (ring.extra && ring.extra[clave] !== undefined) {
    return ring.extra[clave]
  }
  if ((ring as any)[clave] !== undefined) {
    return (ring as any)[clave]
  }
  if (clave === 'd1' || clave.includes('diametro')) return ring.d1
  if (clave === 'h1' || clave.includes('grosor')) return ring.h1
  if (clave === 'a1' || clave.includes('altura')) return ring.a1
  return undefined
}

const formatGeneralTableRowValue = (ring: PartRingItem, col: ParametroTecnicoDefinicion): string => {
  const val = getGeneralTableRowValue(ring, col.clave)
  if (val == null || val === '') return '—'
  if (col.tipo_dato === 'booleano') return val ? 'Sí' : 'No'
  if (typeof val === 'number') {
    return formatMetricNum(val, col.unidad, 2)
  }
  if ((col.tipo_dato === 'numero' || col.unidad === 'mm') && !isNaN(Number(val))) {
    return formatMetricNum(Number(val), col.unidad, 2)
  }
  return String(val)
}

const getRingDiametroCellClass = (d1: number | null | undefined): string => {
  if (filterAnilloDiametro.value === undefined || filterAnilloDiametro.value === null || isNaN(Number(filterAnilloDiametro.value))) {
    return 'text-slate-900'
  }
  if (d1 === undefined || d1 === null || isNaN(Number(d1))) {
    return 'text-slate-400 opacity-60'
  }
  const diff = Math.abs(Number(d1) - Number(filterAnilloDiametro.value))
  const tol = getTol('anilloDiametro')
  if (diff <= 0.05) {
    return '!bg-emerald-100 !text-emerald-950 font-black ring-1 ring-emerald-500/60 shadow-2xs'
  }
  if (diff <= tol) {
    return '!bg-amber-100 !text-amber-950 font-bold ring-1 ring-amber-400/60 shadow-2xs'
  }
  return 'text-slate-400 opacity-60'
}

const getRingGrosorCellClass = (ring: PartRingItem, rIdx: number, totalRings: number): string => {
  const isOil = rIdx === totalRings - 1 || ring.posicion === 'Anillo de aceite'
  let filterVal: number | undefined
  let tolName = 'anilloGrosor1'

  if (isOil) {
    filterVal = filterAnilloGrosorAceite.value
    tolName = 'anilloGrosorAceite'
  } else if (rIdx === 0) {
    filterVal = filterAnilloGrosor1.value
    tolName = 'anilloGrosor1'
  } else if (rIdx === 1) {
    filterVal = filterAnilloGrosor2.value
    tolName = 'anilloGrosor2'
  } else if (rIdx === 2) {
    filterVal = filterAnilloGrosor3.value
    tolName = 'anilloGrosor3'
  }

  if (filterVal === undefined || filterVal === null || isNaN(Number(filterVal))) {
    return 'text-slate-900'
  }
  if (ring.h1 === undefined || ring.h1 === null || isNaN(Number(ring.h1))) {
    return 'text-slate-400 opacity-60'
  }
  const diff = Math.abs(Number(ring.h1) - Number(filterVal))
  const tol = getTol(tolName)
  if (diff <= 0.05) {
    return '!bg-emerald-100 !text-emerald-950 font-black ring-1 ring-emerald-500/60 shadow-2xs'
  }
  if (diff <= tol) {
    return '!bg-amber-100 !text-amber-950 font-bold ring-1 ring-amber-400/60 shadow-2xs'
  }
  return 'text-slate-400 opacity-60'
}

const getRingAlturaCellClass = (ring: PartRingItem, rIdx: number, totalRings: number): string => {
  const isOil = rIdx === totalRings - 1 || ring.posicion === 'Anillo de aceite'
  let filterVal: number | undefined
  let tolName = 'anilloRadial1'

  if (isOil) {
    filterVal = filterAnilloRadialAceite.value
    tolName = 'anilloRadialAceite'
  } else if (rIdx === 0) {
    filterVal = filterAnilloRadial1.value
    tolName = 'anilloRadial1'
  } else if (rIdx === 1) {
    filterVal = filterAnilloRadial2.value
    tolName = 'anilloRadial2'
  } else if (rIdx === 2) {
    filterVal = filterAnilloRadial3.value
    tolName = 'anilloRadial3'
  }

  if (filterVal === undefined || filterVal === null || isNaN(Number(filterVal))) {
    return 'text-slate-900'
  }
  if (ring.a1 === undefined || ring.a1 === null || isNaN(Number(ring.a1))) {
    return 'text-slate-400 opacity-60'
  }
  const diff = Math.abs(Number(ring.a1) - Number(filterVal))
  const tol = getTol(tolName)
  if (diff <= 0.05) {
    return '!bg-emerald-100 !text-emerald-950 font-black ring-1 ring-emerald-500/60 shadow-2xs'
  }
  if (diff <= tol) {
    return '!bg-amber-100 !text-amber-950 font-bold ring-1 ring-amber-400/60 shadow-2xs'
  }
  return 'text-slate-400 opacity-60'
}

const formatRingVal = (val: number | null | undefined): string => {
  if (val == null || isNaN(val) || val === 0) return '—'
  return formatMetricNum(Number(val), 'mm', -1)
}

const getRingDetail = (part: RepuestoTecnico | null | undefined, ringIdx: number, prop: string): string => {
  if (!part) return '—'
  const rings = (part.dimensiones as any)?.anillos as any[] | undefined
  if (rings && rings[ringIdx]) {
    if (prop === 'forma') {
      const f = rings[ringIdx].forma
      const p = rings[ringIdx].perfil
      if (f && p && f !== p && p !== 'Plano' && p !== 'Estándar') return `${p} (${f})`
      if (p && p !== 'Plano' && p !== 'Estándar') return String(p)
      if (f) return String(f)
    } else if (rings[ringIdx][prop] != null && rings[ringIdx][prop] !== '') {
      return String(rings[ringIdx][prop])
    }
  }
  const dims = part.dimensiones as any
  if (ringIdx === 0) {
    if (prop === 'forma') return dims?.forma1 || (isPartConical(part) ? (getKeystoneLabel(part) || 'KEYSTONE (Cónico)') : '—')
    if (prop === 'material') return dims?.material1 || '—'
  }
  if (ringIdx === 1) {
    if (prop === 'forma') return dims?.forma2 || '—'
    if (prop === 'material') return dims?.material2 || '—'
  }
  if (ringIdx === 2) {
    if (prop === 'forma') return dims?.forma_oil || '—'
    if (prop === 'material') return dims?.material_oil || '—'
  }
  return '—'
}

// Modal informativo de motor
const selectedMotorInfoModal = ref<Motor | null>(null)
const openMotorInfo = (mot: Motor, e: MouseEvent) => {
  e.stopPropagation()
  selectedMotorInfoModal.value = mot
}
const closeMotorInfo = () => {
  selectedMotorInfoModal.value = null
}

// =============================================================================
// TABLA DE REPUESTOS Y FILTRADO POR MEDIDAS TÉCNICAS
// =============================================================================
const tableSearchFilter = ref<string>('')
const debouncedTableSearchFilter = ref<string>('')
let tableSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(tableSearchFilter, (val) => {
  if (tableSearchDebounceTimer) clearTimeout(tableSearchDebounceTimer)
  tableSearchDebounceTimer = setTimeout(() => {
    debouncedTableSearchFilter.value = val
  }, 150)
}, { immediate: true })

const tableBrandFilter = ref<string>('Todas las marcas')

const displayedParts = computed<RepuestoTecnico[]>(() => {
  let list = catalogStore.repuestos

  // 1. Filtrar por tipo de componente si está seleccionado
  if (selectedComponent.value) {
    const compId = selectedComponent.value.id
    const cat = selectedComponent.value.category?.toLowerCase() || ''
    const title = selectedComponent.value.title?.toLowerCase() || ''

    if (compId === 'ajuste_valvula' || cat === 'sellos') {
      list = list.filter(r => r.categoria === 'Sellos' || r.subsistema === 'Sellos y Juntas' || r.nombre.toLowerCase().includes('sello'))
    } else if (compId === 'valvula' || cat === 'válvulas' || cat === 'valvulas') {
      list = list.filter(r => (r.categoria === 'Válvulas' || r.categoria === 'Valvulas') && !r.categoria.includes('Guía') && !r.categoria.includes('Asiento'))
    } else if (compId === 'guias_valvula' || cat === 'guías' || cat === 'guias') {
      list = list.filter(r => r.categoria === 'Guías' || r.categoria === 'Guias')
    } else if (compId === 'asientos_valvula' || cat === 'asientos') {
      list = list.filter(r => r.categoria === 'Asientos')
    } else if (compId === 'anillos_motor' || cat === 'anillos') {
      list = list.filter(r => r.categoria === 'Anillos' || r.nombre.toLowerCase().includes('anillos') || r.nombre.toLowerCase().includes('aros'))
    } else if (compId === 'tornillos_culata' || cat === 'pernos') {
      list = list.filter(r => r.categoria === 'Pernos' || r.nombre.toLowerCase().includes('tornillos') || r.nombre.toLowerCase().includes('perno'))
    } else if (compId === 'casqueteria' || cat.includes('casquet') || cat.includes('cojinet')) {
      list = list.filter(r => r.categoria === 'Casquetería' || r.categoria === 'Casqueteria' || r.nombre.toLowerCase().includes('casquete') || r.nombre.toLowerCase().includes('cojinete'))
    } else if (compId === 'empaques_juntas' || cat === 'empaques') {
      list = list.filter(r => r.categoria === 'Empaques' || r.nombre.toLowerCase().includes('empaque') || r.nombre.toLowerCase().includes('junta'))
    } else {
      // Grupos personalizados dinámicos: coincidencia exacta de familia/categoría para no mezclar repuestos ajenos
      const famCodigo = compId.toLowerCase()
      const cleanCat = cat.trim()
      const cleanTitle = title.trim()
      list = list.filter(r => {
        const specGrupo = String((r.especificaciones_tecnicas as any)?.grupo_codigo || '').toLowerCase().trim()
        if (specGrupo && specGrupo === famCodigo) return true
        const partCat = (r.categoria || '').toLowerCase().trim()
        if (!partCat) return false
        return partCat === cleanCat || (cleanTitle !== '' && partCat === cleanTitle)
      })
    }

    // 2. Filtros de medidas dimensionales específicas
    // Caso Especializado: FAMILIAS EN TABLA / ANILLOS DE MOTOR (Mantiene estructura y cálculos exactos)
    if (isCurrentGroupRingsTable.value) {
      // Diámetro (la primera siempre)
      if (isFilterActive(filterAnilloDiametro.value)) {
        const tolAnilloDiametro = getTol('anilloDiametro')
        list = list.filter(r => {
          const d1 = getPartRingsList(r)[0]?.d1 ?? r.diametro_cilindro_mm
          return d1 != null && Math.abs(d1 - (filterAnilloDiametro.value || 0)) <= tolAnilloDiametro
        })
      }
      // Anillo 1: Grosor y Altura
      if (isFilterActive(filterAnilloGrosor1.value)) {
        const tol = getTol('anilloGrosor1')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          const h = rings[0]?.h1
          return h != null && Math.abs(h - (filterAnilloGrosor1.value || 0)) <= tol
        })
      }
      if (isFilterActive(filterAnilloRadial1.value)) {
        const tol = getTol('anilloRadial1')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          const a = rings[0]?.a1
          return a != null && Math.abs(a - (filterAnilloRadial1.value || 0)) <= tol
        })
      }
      // Anillo 2: Grosor y Altura
      if (isFilterActive(filterAnilloGrosor2.value)) {
        const tol = getTol('anilloGrosor2')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          const h = rings[1]?.h1
          return h != null && Math.abs(h - (filterAnilloGrosor2.value || 0)) <= tol
        })
      }
      if (isFilterActive(filterAnilloRadial2.value)) {
        const tol = getTol('anilloRadial2')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          const a = rings[1]?.a1
          return a != null && Math.abs(a - (filterAnilloRadial2.value || 0)) <= tol
        })
      }
      // Anillo 3: Grosor y Altura (para sets con 4 o más anillos)
      if (isFilterActive(filterAnilloGrosor3.value)) {
        const tol = getTol('anilloGrosor3')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          if (rings.length >= 4) {
            const h = rings[2]?.h1
            return h != null && Math.abs(h - (filterAnilloGrosor3.value || 0)) <= tol
          }
          return false
        })
      }
      if (isFilterActive(filterAnilloRadial3.value)) {
        const tol = getTol('anilloRadial3')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          if (rings.length >= 4) {
            const a = rings[2]?.a1
            return a != null && Math.abs(a - (filterAnilloRadial3.value || 0)) <= tol
          }
          return false
        })
      }
      // Anillo de aceite: Grosor y Altura (el último siempre)
      if (isFilterActive(filterAnilloGrosorAceite.value)) {
        const tol = getTol('anilloGrosorAceite')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          const oilRing = rings[rings.length - 1]
          return oilRing?.h1 != null && Math.abs(oilRing.h1 - (filterAnilloGrosorAceite.value || 0)) <= tol
        })
      }
      if (isFilterActive(filterAnilloRadialAceite.value)) {
        const tol = getTol('anilloRadialAceite')
        list = list.filter(r => {
          const rings = getPartRingsList(r)
          const oilRing = rings[rings.length - 1]
          return oilRing?.a1 != null && Math.abs(oilRing.a1 - (filterAnilloRadialAceite.value || 0)) <= tol
        })
      }
    }

    // 2.a.bis Filtro específico de Código de parte en la barra de medidas
    if (filterCodigoPart.value.trim()) {
      const q = filterCodigoPart.value.toLowerCase().trim()
      list = list.filter(r => 
        r.codigo_oem.toLowerCase().includes(q) ||
        getPartOemCodes(r).some(c => c.toLowerCase().includes(q)) ||
        (Array.isArray((r.dimensiones as any)?.subfilas) && (r.dimensiones as any).subfilas.some((sf: any) => sf.codigo?.toLowerCase().includes(q) || sf.nombre?.toLowerCase().includes(q))) ||
        r.equivalencias?.some(eq => eq.codigo_alterno.toLowerCase().includes(q))
      )
    }

    // 2.b. Filtros de parámetros dinámicos para todas las familias (guiados por la definición técnica)
    if (Object.keys(dynamicParamFilters.value).length > 0) {
      for (const [key, filterVal] of Object.entries(dynamicParamFilters.value)) {
        if (filterVal !== undefined && filterVal !== null && filterVal !== '') {
          const tolParam = getTol(key)
          list = list.filter(r => {
            const dims = (r.dimensiones as any) || {}
            // Si la pieza tiene sub-filas, comprobar si alguna sub-fila coincide con esta cota
            if (Array.isArray(dims.subfilas) && dims.subfilas.length > 0) {
              const matchedInSubfila = dims.subfilas.some((sf: any) => {
                const sfVal = sf.medidas ? sf.medidas[key] : undefined
                if (sfVal === undefined || sfVal === null || sfVal === '') return false
                if (typeof filterVal === 'number' || (!isNaN(Number(filterVal)) && !isNaN(Number(sfVal)))) {
                  return Math.abs(Number(sfVal) - Number(filterVal)) <= tolParam
                }
                const strSf = String(sfVal).toLowerCase().trim()
                const strFlt = String(filterVal).toLowerCase().trim()
                return strSf.includes(strFlt) || strFlt.includes(strSf)
              })
              if (matchedInSubfila) return true
            }

            // Si la pieza tiene filas en tabla (anillos o matriz general), comprobar si alguna fila coincide con esta cota
            if (Array.isArray(dims.anillos) && dims.anillos.length > 0) {
              const matchedInRow = dims.anillos.some((ring: any) => {
                const ringVal = ring.extra?.[key] !== undefined ? ring.extra[key] : (ring[key] !== undefined ? ring[key] : (
                  key === 'diametro_cilindro_mm' ? ring.d1 : (
                    key === 'grosor_mm' ? ring.h1 : (
                      key === 'altura_mm' ? ring.a1 : (
                        key === 'tipo_diseno' ? (ring.tipo_diseno || ring.identificador || ring.perfil || ring.forma) : undefined
                      )
                    )
                  )
                ))
                if (ringVal === undefined || ringVal === null || ringVal === '') return false
                if (typeof filterVal === 'number' || (!isNaN(Number(filterVal)) && !isNaN(Number(ringVal)))) {
                  return Math.abs(Number(ringVal) - Number(filterVal)) <= tolParam
                }
                const strR = String(ringVal).toLowerCase().trim()
                const strFlt = String(filterVal).toLowerCase().trim()
                return strR.includes(strFlt) || strFlt.includes(strR)
              })
              if (matchedInRow) return true
            }

            const partVal = getPartParamValue(r, key)
            if (partVal === undefined || partVal === null) return false

            // Comparación numérica con tolerancia individual de este parámetro
            if (typeof filterVal === 'number' || (!isNaN(Number(filterVal)) && !isNaN(Number(partVal)))) {
              const numPart = Number(partVal)
              const numFilter = Number(filterVal)
              return Math.abs(numPart - numFilter) <= tolParam
            }

            // Comparación de texto / selección inteligente
            const strPart = String(partVal).toLowerCase().trim()
            const strFilter = String(filterVal).toLowerCase().trim()

            // Manejo especial de posiciones automotrices (Admisión/IN vs Escape/EX)
            if (strFilter === 'in' || strFilter.includes('admis')) {
              return strPart === 'in' || strPart.includes('admis')
            }
            if (strFilter === 'ex' || strFilter.includes('escap')) {
              return strPart === 'ex' || strPart.includes('escap')
            }

            return strPart.includes(strFilter) || strFilter.includes(strPart)
          })
        }
      }
    }
  }

  // 1b. Filtros principales obligatorios sobre los componentes: Motor, Fabricante y Modelo
  if (selectedMotor.value) {
    const targetMotorId = selectedMotor.value.id
    list = list.filter(r => r.motor_id === targetMotorId || r.motor?.id === targetMotorId)
  }

  if (selectedBrand.value) {
    const brandId = selectedBrand.value.id
    const brandName = selectedBrand.value.nombre.toLowerCase().trim()
    list = list.filter(r => {
      if (r.motor?.fabricante_id === brandId) return true
      const fabName = r.motor?.fabricante?.nombre?.toLowerCase() || ''
      if (fabName && fabName.includes(brandName)) return true
      if (r.motor_id) {
        const mot = catalogStore.motores.find(m => m.id === r.motor_id)
        if (mot?.fabricante_id === brandId) return true
      }
      return false
    })
  }

  if (selectedModel.value) {
    const modelId = selectedModel.value.id
    const modelName = selectedModel.value.nombre.toLowerCase().trim()
    list = list.filter(r => {
      if (r.motor?.modelo_id === modelId) return true
      if (r.motor?.modelo?.nombre?.toLowerCase().includes(modelName)) return true
      if (r.motor?.denominacion_venta?.toLowerCase().includes(modelName)) return true
      if (r.motor_id) {
        return availableMotors.value.some(m => m.id === r.motor_id)
      }
      return false
    })
  }

  // 2.c. Filtro por Año de compatibilidad vehicular
  if (effectiveYearFilter.value) {
    const yr = Number(effectiveYearFilter.value)
    if (!isNaN(yr) && yr > 0) {
      list = list.filter(r => {
        const spec = (r.especificaciones_tecnicas || {}) as Record<string, any>
        const dims = (r.dimensiones || {}) as Record<string, any>
        const linkedMot = r.motor || (r.motor_id ? catalogStore.motores.find(m => m.id === r.motor_id) : undefined)
        const yearText = spec.ano || spec.anos || dims.anos || dims.ano || (linkedMot as any)?.anios
        if (yearText && String(yearText).trim() !== '' && String(yearText).trim() !== '—') {
          return doesYearMatchText(yearText, yr)
        }
        const motModelId = linkedMot?.modelo_id
        if (motModelId) {
          const mod = catalogStore.modelos.find(m => m.id === motModelId)
          if (mod?.anio_inicio) {
            const end = mod.anio_fin || 2026
            return yr >= mod.anio_inicio && yr <= end
          }
        }
        return true
      })
    }
  }

  // 3. Búsqueda por texto local dentro de la tabla (con debounce de 150ms para fluidez total)
  if (debouncedTableSearchFilter.value.trim()) {
    const q = debouncedTableSearchFilter.value.toLowerCase().trim()
    list = list.filter(r => 
      r.nombre.toLowerCase().includes(q) ||
      r.codigo_oem.toLowerCase().includes(q) ||
      getPartOemCodes(r).some(c => c.toLowerCase().includes(q)) ||
      r.equivalencias?.some(eq => eq.codigo_alterno.toLowerCase().includes(q) || eq.marca_alterna.toLowerCase().includes(q))
    )
  }

  // 4. Filtro de marca de catálogo alterno (reparado para Dokuro, Rik, NDC, Taiho, Ajusa, Pioneer)
  if (tableBrandFilter.value !== 'Todas las marcas') {
    const b = tableBrandFilter.value.toLowerCase().trim()
    list = list.filter(r => {
      // 1. Catálogo origen
      const origen = String(r.catalogo_origen || '').toLowerCase()
      if (origen.includes(b)) return true

      // 2. Especificaciones técnicas de catálogo
      const spec = (r.especificaciones_tecnicas || {}) as Record<string, any>
      const marcaCat = String(spec.marca_catalogo || '').toLowerCase()
      if (marcaCat.includes(b)) return true

      const fuenteStr = typeof spec.fuente === 'string' ? spec.fuente.toLowerCase() : JSON.stringify(spec.fuente || '').toLowerCase()
      if (fuenteStr.includes(b)) return true

      if (b === 'dokuro' && (spec.codigo_dokuro || spec.codigo_catalogo)) return true
      if (b === 'rik' && (spec.codigo_rik || spec.marca_catalogo === 'RIK')) return true
      if (b === 'npr' && (spec.codigo_npr || spec.marca_catalogo === 'NPR')) return true
      if (b === 'mrk' && (spec.codigo_mrk || spec.marca_catalogo === 'MRK' || spec.catalogo === 'MRK' || (r.dimensiones as any)?.catalogo === 'MRK')) return true
      if (b === 'taiho' && spec.codigo_taiho) return true

      // 3. Equivalencias cruzadas
      if (r.equivalencias?.some(eq => 
        eq.marca_alterna.toLowerCase().includes(b) ||
        eq.codigo_alterno.toLowerCase().includes(b) ||
        (eq.tipo_referencia && eq.tipo_referencia.toLowerCase().includes(b)) ||
        (eq.notas && eq.notas.toLowerCase().includes(b))
      )) {
        return true
      }

      // 4. Nombre
      if (r.nombre.toLowerCase().includes(b)) return true

      return false
    })
  }

  return list
})

// =============================================================================
// PAGINACIÓN Y CONTROL DE RENDERIZADO DEL LADO DEL CLIENTE
// =============================================================================
const partsPerPage = ref<number>(50)
const currentPartsPage = ref<number>(1)

const partsTotalPages = computed(() => {
  if (partsPerPage.value === -1) return 1
  return Math.max(1, Math.ceil(displayedParts.value.length / partsPerPage.value))
})

const paginatedParts = computed<RepuestoTecnico[]>(() => {
  if (partsPerPage.value === -1) return displayedParts.value
  const start = (currentPartsPage.value - 1) * partsPerPage.value
  return displayedParts.value.slice(start, start + partsPerPage.value)
})

const goToFirstPartsPage = () => { currentPartsPage.value = 1 }
const goToPrevPartsPage = () => { if (currentPartsPage.value > 1) currentPartsPage.value-- }
const goToNextPartsPage = () => { if (currentPartsPage.value < partsTotalPages.value) currentPartsPage.value++ }
const goToLastPartsPage = () => { currentPartsPage.value = partsTotalPages.value }

// Reiniciar a primera página cuando cambian los filtros reactivos
watch([
  debouncedTableSearchFilter, 
  tableBrandFilter, 
  selectedComponent, 
  selectedBrand, 
  selectedMotor, 
  filterAnilloTab, 
  filterAnilloDiametro, 
  filterAnilloGrosor1, 
  filterAnilloRadial1, 
  filterAnilloGrosor2, 
  filterAnilloRadial2, 
  filterAnilloGrosorAceite, 
  filterAnilloRadialAceite
], () => {
  currentPartsPage.value = 1
})

// Badges de marcas y catálogos
const getBrandBadgeClass = (brand?: string | null): string => {
  const b = String(brand || '').toLowerCase().trim()
  if (b.includes('dokuro')) return 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
  if (b.includes('rik')) return 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold'
  if (b.includes('ndc')) return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
  if (b.includes('taiho')) return 'bg-purple-100 text-purple-800 border-purple-300 font-bold'
  if (b.includes('ajusa')) return 'bg-[#0f2d59] text-white border-blue-950 font-bold'
  if (b.includes('mrk') || b.includes('mkr')) return 'bg-teal-100 text-teal-800 border-teal-300 font-bold'
  if (b.includes('npr')) return 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
  if (b === 'oem' || b.includes('oem')) return 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
  return 'bg-slate-100 text-slate-700 border-slate-200 font-bold'
}

// Resuelve la marca principal de catálogo de un repuesto (ej. RIK, MRK, NPR, AJUSA)
const getPartCatalogBrand = (part: RepuestoTecnico | null | undefined): string | null => {
  if (!part) return null
  const orig = String(part.catalogo_origen || '').trim()
  if (orig && orig !== 'OEM') return orig.toUpperCase()

  const spec = (part.especificaciones_tecnicas || {}) as Record<string, any>
  if (spec.marca_catalogo) return String(spec.marca_catalogo).toUpperCase()

  if (spec.codigo_rik || (part.codigo_oem && part.codigo_oem.startsWith('RIK-')) || part.nombre?.includes('RIK')) {
    return 'RIK'
  }
  if (spec.codigo_mrk || (part.dimensiones as any)?.catalogo === 'MRK' || (part.codigo_oem && part.codigo_oem.startsWith('MG'))) {
    return 'MRK'
  }
  if (spec.codigo_npr || part.nombre?.includes('NPR') || (part.codigo_oem && part.codigo_oem.startsWith('NPR-'))) {
    return 'NPR'
  }
  if (spec.codigo_ajusa || part.nombre?.includes('Ajusa')) {
    return 'AJUSA'
  }
  if (spec.codigo_dokuro || part.nombre?.includes('Dokuro')) {
    return 'DOKURO'
  }
  if (typeof spec.fuente === 'string') {
    const f = spec.fuente.toLowerCase()
    if (f.includes('rik')) return 'RIK'
    if (f.includes('mrk')) return 'MRK'
    if (f.includes('npr')) return 'NPR'
    if (f.includes('ajusa')) return 'AJUSA'
    if (f.includes('dokuro')) return 'DOKURO'
  }
  return orig || null
}

const splitCleanCodes = (val: unknown): string[] => {
  if (!val) return []
  return String(val)
    .split(/[,\/;|\n]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
}

/**
 * Obtiene todos los Códigos Originales de Fabricante (OEM) de un repuesto (principal + adicionales),
 * garantizando separación estricta respecto a las Equivalencias Multimarca Alternas y dividiendo
 * cualquier lista separada por comas, barras o espacios en badges independientes.
 */
const getPartOemCodes = (part: RepuestoTecnico | null | undefined): string[] => {
  if (!part) return []
  const cached = oemCache.get(part)
  if (cached) return cached

  const spec = (part.especificaciones_tecnicas || {}) as Record<string, any>
  const dims = (part.dimensiones || {}) as Record<string, any>
  const primaryDisplayCode = spec.codigo_dokuro || spec.codigo_mrk || spec.codigo_rik || spec.codigo_npr || part.codigo_oem || ''

  const candidates: string[] = []
  if (primaryDisplayCode) candidates.push(...splitCleanCodes(primaryDisplayCode))
  if (part.codigo_oem) candidates.push(...splitCleanCodes(part.codigo_oem))

  const extraSources = [
    part.codigos_oem_adicionales,
    spec.codigos_oem_adicionales,
    dims.codigos_oem_adicionales,
    spec.referencias_oem
  ]
  for (const src of extraSources) {
    if (Array.isArray(src)) {
      for (const item of src) {
        candidates.push(...splitCleanCodes(item))
      }
    } else if (typeof src === 'string') {
      candidates.push(...splitCleanCodes(src))
    }
  }

  // También rescatar equivalencias que fueron etiquetadas como marca 'OEM'
  if (Array.isArray(part.equivalencias)) {
    for (const eq of part.equivalencias) {
      if (String(eq.marca_alterna || '').trim().toUpperCase() === 'OEM') {
        candidates.push(...splitCleanCodes(eq.codigo_alterno))
      }
    }
  }

  const result = Array.from(new Set(candidates.filter(Boolean)))
  oemCache.set(part, result)
  return result
}

// Filtra equivalencias multimarca alternas (excluyendo códigos OEM originales que van en su propia columna)
const getPartEquivalencias = (part: RepuestoTecnico | null | undefined): Equivalencia[] => {
  if (!part) return []
  const oemSet = new Set(getPartOemCodes(part))
  const list: Equivalencia[] = (part.equivalencias || []).filter(eq => {
    const brand = String(eq.marca_alterna || '').trim().toUpperCase()
    const code = String(eq.codigo_alterno || '').trim().toUpperCase()
    if (brand === 'OEM' || oemSet.has(code)) return false
    return true
  })
  const seenCodes = new Set(list.map(e => (e.codigo_alterno || '').trim().toUpperCase()))

  // Agregar código Dokuro si está en especificaciones y no es el código principal mostrado
  const dokCode = ((part.especificaciones_tecnicas as any)?.codigo_dokuro as string | undefined)?.trim()?.toUpperCase()
  if (dokCode && dokCode !== (part.codigo_oem || '').trim().toUpperCase() && !seenCodes.has(dokCode) && !oemSet.has(dokCode)) {
    seenCodes.add(dokCode)
    list.unshift({
      id: `dok-${dokCode}`,
      repuesto_id: part.id,
      marca_alterna: 'Dokuro',
      codigo_alterno: dokCode,
      tipo_referencia: 'Código Directo Dokuro'
    })
  }

  // Agregar código MRK si está en especificaciones y no es el código principal mostrado
  const mrkCode = ((part.especificaciones_tecnicas as any)?.codigo_mrk as string | undefined)?.trim()?.toUpperCase()
  if (mrkCode && mrkCode !== (part.codigo_oem || '').trim().toUpperCase() && !seenCodes.has(mrkCode) && !oemSet.has(mrkCode)) {
    seenCodes.add(mrkCode)
    list.unshift({
      id: `mrk-${mrkCode}`,
      repuesto_id: part.id,
      marca_alterna: 'MRK',
      codigo_alterno: mrkCode,
      tipo_referencia: 'Código Directo MRK'
    })
  }

  return list.filter(eq => {
    if (eq.marca_alterna.toLowerCase() === 'rik') {
      const cleanPartCode = (part.codigo_oem || '').replace(/^RIK-/i, '').trim().toUpperCase()
      const cleanEqCode = (eq.codigo_alterno || '').trim().toUpperCase()
      const cleanRikSpec = (((part.especificaciones_tecnicas as any)?.codigo_rik as string | undefined) || '').trim().toUpperCase()
      if (cleanPartCode === cleanEqCode || (cleanRikSpec && cleanRikSpec === cleanEqCode)) {
        return false
      }
    }
    return true
  })
}

// Modal de Ficha Técnica
const isTechnicalModalOpen = ref<boolean>(false)
const modalPart = ref<RepuestoTecnico | null>(null)

const EXCLUDED_MODAL_DIM_KEYS = new Set([
  'anillos',
  'diametro_interior_mm',
  'diametro_exterior_mm',
  'altura_mm',
  'diametro_cabeza_mm',
  'diametro_vastago_mm',
  'longitud_total_mm',
  'stem_end',
  'cunero',
  'cuñero',
  'ranuras',
  'diametro_cilindro_mm',
  'espesor_anillo1_mm',
  'espesor_anillo2_mm',
  'espesor_anillo3_mm',
  'espesor_aceite_mm',
  'medida_rosca',
  'paso_rosca_mm',
  'marca_catalogo',
  'catalogo_origen',
  'catalogo',
  'fuente',
  'codigo_dokuro',
  'codigo_mrk',
  'codigo_rik',
  'codigo_npr',
  'codigo_ajusa',
  'codigo_taiho',
  'codigo_ndc',
  'codigo_catalogo',
  'vehiculo',
  'ano',
  'anos',
  'cilindros',
  'motores_texto',
  'cilindrada',
  'formato_visualizacion',
  'codigos_oem_adicionales',
  'referencias_oem',
  'diseno_conico',
  'keystone',
  'hongo',
  'hongo_mm',
  'vastago',
  'vastago_mm',
  'largo',
  'largo_mm',
  'length_mm',
  'diam_int',
  'interior_mm',
  'diametro_interior',
  'diam_ext',
  'exterior_mm',
  'diametro_exterior',
  'diametro_exterior_1_mm'
])

const getModalExtraDimensions = (part: RepuestoTecnico | null | undefined): Array<{ key: string; label: string; value: string }> => {
  if (!part || !part.dimensiones || typeof part.dimensiones !== 'object') return []
  const dims = part.dimensiones as Record<string, any>
  const grpCode = resolveGroupIdFromPart(part)
  const grp = catalogStore.grupos.find(g => g.codigo === grpCode || g.id === grpCode)
  const params = grp?.parametros || []

  const rows: Array<{ key: string; label: string; value: string }> = []
  for (const [rawKey, rawVal] of Object.entries(dims)) {
    if (EXCLUDED_MODAL_DIM_KEYS.has(rawKey)) continue
    if (rawVal === undefined || rawVal === null || rawVal === '' || typeof rawVal === 'object') continue

    const paramDef = params.find(p => p.clave === rawKey)
    const baseLabel = paramDef?.etiqueta || rawKey.replace(/_mm$/i, '').replace(/_/g, ' ')
    const label = paramDef?.columna_padre ? `${paramDef.columna_padre} › ${baseLabel}` : baseLabel
    const unit = paramDef?.unidad || (rawKey.endsWith('_mm') ? 'mm' : (rawKey.includes('angulo') || rawKey.includes('grados') ? '°' : ''))
    const valStr = String(rawVal).trim()
    const formattedVal = unit && !valStr.toLowerCase().endsWith(unit.toLowerCase()) ? `${valStr} ${unit}` : valStr

    rows.push({
      key: rawKey,
      label,
      value: formattedVal
    })
  }
  return rows
}

const isLightboxOpen = ref<boolean>(false)
const lightboxPart = ref<RepuestoTecnico | null>(null)

const openLightbox = (part: RepuestoTecnico) => {
  if (!part || !part.imagen_url) return
  lightboxPart.value = part
  isLightboxOpen.value = true
}

const closeLightbox = () => {
  isLightboxOpen.value = false
  lightboxPart.value = null
}

const openTechnicalSheet = (part: RepuestoTecnico) => {
  modalPart.value = part
  isTechnicalModalOpen.value = true
}

const closeTechnicalSheet = () => {
  isTechnicalModalOpen.value = false
  modalPart.value = null
}

// =============================================================================
// MODAL ADMINISTRATIVO DE CATÁLOGO (NUEVO REPUESTO / NUEVA FAMILIA DINÁMICA / EDITAR GRUPO)
// =============================================================================
const isAdminModalOpen = ref<boolean>(false)
const adminModalTab = ref<'repuesto' | 'grupo'>('repuesto')
const adminModalEditGroupId = ref<string | null>(null)
const adminModalEditPart = ref<RepuestoTecnico | null>(null)

const resolveGroupIdFromPart = (part?: RepuestoTecnico | null): string | null => {
  if (!part) return selectedComponent.value?.id || null
  const cat = (part.categoria || '').toLowerCase().trim()
  const matched = catalogStore.grupos.find(g =>
    g.codigo.toLowerCase() === cat ||
    g.categoria.toLowerCase() === cat ||
    g.nombre.toLowerCase() === cat
  )
  if (matched) return matched.codigo
  if (cat.includes('anillo')) return 'anillos_motor'
  if (cat.includes('sello')) return 'ajuste_valvula'
  if (cat.includes('guía') || cat.includes('guia')) return 'guias_valvula'
  if (cat.includes('asiento')) return 'asientos_valvula'
  if (cat.includes('válvula') || cat.includes('valvula')) return 'valvula'
  if (cat.includes('perno') || cat.includes('tornillo')) return 'tornillos_culata'
  if (cat.includes('casquet') || cat.includes('cojinet')) return 'casqueteria'
  if (cat.includes('camisa')) return 'camisas_cilindro'
  if (cat.includes('empaque') || cat.includes('junta')) return 'empaques_juntas'
  return selectedComponent.value?.id || null
}

const handleCreateNewGroup = () => {
  adminModalTab.value = 'grupo'
  adminModalEditGroupId.value = null
  adminModalEditPart.value = null
  isAdminModalOpen.value = true
}

const openAdminCatalogModal = (tab: 'repuesto' | 'grupo' = 'repuesto', editGroupId?: string | null) => {
  adminModalTab.value = tab
  adminModalEditGroupId.value = editGroupId || null
  adminModalEditPart.value = null
  isAdminModalOpen.value = true
}

const handleEditGroup = (grpId?: string | null) => {
  const targetId = grpId || selectedComponent.value?.id || resolveGroupIdFromPart(modalPart.value)
  openAdminCatalogModal('grupo', targetId)
}

const handleEditPart = (part: RepuestoTecnico) => {
  adminModalTab.value = 'repuesto'
  adminModalEditGroupId.value = null
  adminModalEditPart.value = part
  isAdminModalOpen.value = true
}

// Retrocompatibilidad con openAddPartModal
const openAddPartModal = () => {
  openAdminCatalogModal('repuesto')
}

const onPartCreated = (newPart: RepuestoTecnico) => {
  showToast(`✓ Repuesto ${newPart.codigo_oem} (${newPart.nombre}) registrado exitosamente`)
  activeViewTab.value = 'repuestos'
  openTechnicalSheet(newPart)
}

const onPartUpdated = (updatedPart: RepuestoTecnico) => {
  showToast(`✓ Repuesto ${updatedPart.codigo_oem} modificado exitosamente`)
  adminModalEditPart.value = null
  if (modalPart.value && modalPart.value.id === updatedPart.id) {
    modalPart.value = updatedPart
  }
}

const toggleMotorsWithPartsOnly = async () => {
  await catalogStore.toggleOnlyMotorsWithParts()
  showToast(catalogStore.onlyMotorsWithParts 
    ? 'Filtro activado: Omitiendo motores sin repuestos asociados' 
    : 'Filtro desactivado: Mostrando todos los motores registrados')
}

const onGroupCreated = async (newGroup: GrupoRepuesto) => {
  isAdminModalOpen.value = false
  adminModalEditGroupId.value = null
  showToast(`✓ Familia "${newGroup.nombre}" creada con ${newGroup.parametros.length} parámetros técnicos`)
  await catalogStore.fetchGrupos()
  const found = componentGroups.value.find(g => g.id === newGroup.codigo || g.id === newGroup.id)
  if (found) {
    selectedComponent.value = found
    componentInput.value = found.title
    activeViewTab.value = 'repuestos'
    if (selectedMotor.value) {
      await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
    } else {
      await catalogStore.fetchRepuestosByGrupo(found.category, undefined, selectedBrand.value?.id, selectedModel.value?.id)
    }
  }
}

const onGroupUpdated = async (updatedGroup: GrupoRepuesto) => {
  isAdminModalOpen.value = false
  adminModalEditGroupId.value = null
  showToast(`✓ Familia "${updatedGroup.nombre}" actualizada con ${updatedGroup.parametros.length} parámetros técnicos`)
  await catalogStore.fetchGrupos()
  const found = componentGroups.value.find(g => g.id === updatedGroup.codigo || g.id === updatedGroup.id)
  if (found) {
    selectedComponent.value = found
    await catalogStore.fetchRepuestosByGrupo(found.category, undefined, selectedBrand.value?.id)
  }
}

const onPartDeleted = (_deletedPartId?: string) => {
  showToast('✓ Repuesto eliminado exitosamente del catálogo')
  adminModalEditPart.value = null
  isAdminModalOpen.value = false
}

// Cerrar dropdowns al hacer clic fuera
const handleDocumentClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.combobox-brand')) isBrandOpen.value = false
  if (!target.closest('.combobox-model')) isModelOpen.value = false
  if (!target.closest('.combobox-year')) isYearOpen.value = false
  if (!target.closest('.combobox-component')) isComponentOpen.value = false
}

onMounted(async () => {
  document.addEventListener('click', handleDocumentClick)
  // Inicialización de datos reales desde Supabase
  await catalogStore.initCatalog()
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  if (toastTimer) clearTimeout(toastTimer)
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})
</script>

<template>
  <div class="space-y-4 pb-12 select-none">

    <!-- Toast Notification Flotante -->
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
        class="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700/60 flex items-center gap-2.5"
      >
        <CheckCircle2 class="w-4 h-4 text-[#04C4D9] shrink-0" />
        <span class="text-xs font-semibold">{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- HEADER SECTION (MINIMALISTA)                                              -->
    <!-- ========================================================================= -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Catálogo
        </h1>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          @click="openAdminCatalogModal('repuesto')"
          class="px-3.5 py-2 rounded-xl bg-[#04C4D9] hover:bg-[#03a9bc] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
          title="Dar de alta repuesto en catálogo"
        >
          <Plus class="w-4 h-4" />
          <span>+ Repuesto</span>
        </button>

        <button
          type="button"
          @click="handleCreateNewGroup"
          class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95"
          title="Crear nueva familia de componentes paramétricos"
        >
          <FolderPlus class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>+ Nueva Familia</span>
        </button>

        <button
          type="button"
          @click="handleResetAll"
          class="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition flex items-center gap-1.5"
          title="Restaurar registros y filtros"
        >
          <RotateCcw class="w-3.5 h-3.5 text-slate-400" />
          <span>Restaurar</span>
        </button>
      </div>
    </div>

    <!-- Banner de Error si falla la conexión -->
    <div 
      v-if="catalogStore.error || catalogStore.repuestosError" 
      class="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3 text-rose-800 text-xs font-semibold"
    >
      <div class="flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 text-rose-600 shrink-0" />
        <span>{{ catalogStore.error || catalogStore.repuestosError }}</span>
      </div>
      <button 
        type="button"
        @click="catalogStore.initCatalog()"
        class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
      >
        <RefreshCw class="w-3 h-3" />
        <span>Reintentar</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- BARRA SUPERIOR FIJA: FILTROS REACTIVOS EN CASCADA                         -->
    <!-- Top-14 (56px) para despejar completamente el Navbar flotante al hacer scroll -->
    <!-- ========================================================================= -->
    <div class="sticky top-14 z-30 bg-white/95 backdrop-blur-md p-2.5 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-md transition-all duration-200 space-y-2 overflow-visible">
      
      <!-- Fila Superior: Buscador Universal + Botón Filtros Móvil -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            v-model="searchInput"
            @input="handleSearchInput"
            type="text"
            placeholder="Buscar por código OEM, cruce o descripción..."
            class="w-full pl-9 pr-14 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] transition"
          />
          <div class="absolute right-2.5 top-2 flex items-center gap-1">
            <Loader2 v-if="catalogStore.isSearching" class="w-4 h-4 text-[#04C4D9] animate-spin" />
            <button
              v-if="searchInput"
              type="button"
              @click="handleClearSearch"
              class="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="Limpiar búsqueda"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Botón Toggle de Filtros Avanzados (Solo Móvil / Tablet < lg) -->
        <button
          type="button"
          @click="isMobileFiltersOpen = !isMobileFiltersOpen"
          class="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition shrink-0 border shadow-2xs select-none active:scale-95"
          :class="isMobileFiltersOpen 
            ? 'bg-slate-900 text-white border-slate-900' 
            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'"
          :title="isMobileFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros de vehículo y motor'"
        >
          <SlidersHorizontal class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>Filtros</span>
          <span 
            v-if="activeFilterCount > 0" 
            class="w-4 h-4 rounded-full bg-[#04C4D9] text-white text-[10px] font-black flex items-center justify-center leading-none"
          >
            {{ activeFilterCount }}
          </span>
          <ChevronDown 
            class="w-3.5 h-3.5 transition-transform duration-200" 
            :class="{ 'rotate-180 text-white': isMobileFiltersOpen, 'text-slate-400': !isMobileFiltersOpen }" 
          />
        </button>
      </div>

      <div 
        :class="[
          'gap-2.5 items-end transition-all duration-200',
          isMobileFiltersOpen 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 pt-1' 
            : 'hidden lg:grid lg:grid-cols-5'
        ]"
      >
        
        <!-- 1. FABRICANTE -->
        <div class="relative combobox-brand">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Fabricante
            </label>
            <div class="flex items-center gap-2">
              <button
                v-if="selectedBrand"
                type="button"
                @click="openEditBrandModal(selectedBrand)"
                class="text-[10px] font-bold text-slate-500 hover:text-[#004B97] flex items-center gap-0.5 transition cursor-pointer"
                title="Editar marca seleccionada"
              >
                <Edit3 class="w-3 h-3" />
                <span>Editar</span>
              </button>
              <button
                type="button"
                @click="openQuickCreateBrandModal(brandInput)"
                class="text-[10px] font-bold text-[#038391] hover:text-[#04C4D9] flex items-center gap-0.5 transition cursor-pointer"
                title="Registrar una nueva marca o fabricante"
              >
                <Plus class="w-3 h-3" />
                <span>Nueva</span>
              </button>
            </div>
          </div>

          <div class="relative flex items-center">
            <input
              ref="brandInputRef"
              v-model="brandInput"
              @focus="handleFocusBrand"
              @click="handleFocusBrand"
              @input="isBrandOpen = true; highlightedBrandIdx = 0"
              @keydown="handleBrandKeydown"
              type="text"
              placeholder="Buscar fabricante..."
              class="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] min-h-[40px] transition"
            />
            <button
              v-if="brandInput"
              type="button"
              @click="handleClearSelectedBrand"
              class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
              title="Limpiar marca"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <ChevronDown
              @click="isBrandOpen = !isBrandOpen"
              class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
            />
          </div>

          <!-- Dropdown Marcas -->
          <div
            v-if="isBrandOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-50"
          >
            <div
              v-for="(fab, fIdx) in filteredBrands"
              :key="fab.id"
              @click="handleSelectBrand(fab)"
              @mouseenter="highlightedBrandIdx = fIdx"
              :class="[
                'px-3 py-2 cursor-pointer text-xs flex items-center justify-between transition brand-item-' + fIdx,
                highlightedBrandIdx === fIdx ? 'bg-cyan-100/90 text-[#038391] ring-1 ring-inset ring-[#04C4D9]' : (selectedBrand?.id === fab.id ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-800 hover:bg-cyan-50/70')
              ]"
            >
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="selectedBrand?.id === fab.id ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                <strong class="font-bold">{{ fab.nombre.toUpperCase() }}</strong>
                <span class="text-slate-400 text-[10px]">({{ fab.pais_origen || 'Japón' }})</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] text-slate-400 font-mono">{{ fab.engines_count || 'Varios' }} motores</span>
                <Check v-if="selectedBrand?.id === fab.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
              </div>
            </div>
            <div v-if="filteredBrands.length === 0" class="p-2.5 text-center text-xs text-slate-400">
              No hay marcas coincidentes
            </div>
            <!-- Acción rápida para registrar marca no existente -->
            <button
              v-if="brandInput.trim().length > 0 && !catalogStore.fabricantes.some(f => f.nombre.toLowerCase() === brandInput.trim().toLowerCase())"
              type="button"
              @mousedown.prevent="openQuickCreateBrandModal(brandInput)"
              class="w-full px-3 py-2.5 text-left text-xs font-bold text-[#038391] bg-cyan-50/90 hover:bg-[#04C4D9] hover:text-white transition flex items-center justify-between border-t border-cyan-200 cursor-pointer"
            >
              <span class="flex items-center gap-1.5 truncate">
                <Plus class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">+ Registrar nueva marca "{{ brandInput.trim().toUpperCase() }}"</span>
              </span>
              <span class="text-[9px] font-mono uppercase opacity-80 shrink-0 ml-1">Crear</span>
            </button>
          </div>
        </div>

        <!-- 2. MOTOR -->
        <div class="relative combobox-motor">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Motor
            </label>
            <div class="flex items-center gap-1.5">
              <button
                v-if="selectedMotor"
                type="button"
                @click="openEditMotorModal(selectedMotor)"
                class="text-[10px] font-bold text-slate-500 hover:text-[#004B97] flex items-center gap-0.5 transition cursor-pointer"
                title="Editar motor seleccionado"
              >
                <Edit3 class="w-3 h-3" />
                <span>Editar</span>
              </button>
              <button
                type="button"
                @click="openQuickCreateMotorModal(motorInput)"
                class="text-[10px] font-bold text-[#038391] hover:text-[#04C4D9] flex items-center gap-0.5 transition cursor-pointer"
                title="Registrar un nuevo código de motor"
              >
                <Plus class="w-3 h-3" />
                <span>Nuevo</span>
              </button>
              <button
                type="button"
                @click="toggleMotorsWithPartsOnly"
                class="text-[10px] font-bold px-1.5 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                :class="catalogStore.onlyMotorsWithParts 
                  ? 'bg-[#04C4D9]/15 text-[#038391] border border-[#04C4D9]/40' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'"
                :title="catalogStore.onlyMotorsWithParts ? 'Mostrando solo motores con repuestos' : 'Mostrando todos los motores'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="catalogStore.onlyMotorsWithParts ? 'bg-[#04C4D9]' : 'bg-slate-400'"></span>
                <span>{{ catalogStore.onlyMotorsWithParts ? 'Con repuestos' : 'Todos' }}</span>
              </button>
            </div>
          </div>

          <div class="relative flex items-center">
            <input
              ref="motorInputRef"
              v-model="motorInput"
              @focus="onFocusMotor"
              @input="onInputMotor"
              @keydown="handleMotorKeydown"
              type="text"
              placeholder="Filtrar código de motor en la tabla..."
              class="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] min-h-[40px] transition"
            />
            <button
              v-if="motorInput"
              type="button"
              @click="handleClearSelectedMotor"
              class="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Limpiar motor"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- 3. MODELO -->
        <div class="relative combobox-model">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Modelo
            </label>
            <div class="flex items-center gap-2">
              <button
                v-if="selectedModel"
                type="button"
                @click="openEditModelModal(selectedModel)"
                class="text-[10px] font-bold text-slate-500 hover:text-[#004B97] flex items-center gap-0.5 transition cursor-pointer"
                title="Editar modelo seleccionado"
              >
                <Edit3 class="w-3 h-3" />
                <span>Editar</span>
              </button>
              <button
                type="button"
                @click="openQuickCreateModelModal(modelInput)"
                class="text-[10px] font-bold text-[#038391] hover:text-[#04C4D9] flex items-center gap-0.5 transition cursor-pointer"
                title="Registrar un nuevo modelo de vehículo"
              >
                <Plus class="w-3 h-3" />
                <span>Nuevo</span>
              </button>
            </div>
          </div>

          <div class="relative flex items-center">
            <input
              ref="modelInputRef"
              v-model="modelInput"
              @focus="onFocusModel"
              @click="onFocusModel"
              @input="onInputModel(); highlightedModelIdx = 0"
              @keydown="handleModelKeydown"
              type="text"
              :placeholder="selectedMotor ? ('Modelos con ' + selectedMotor.codigo + '...') : 'Buscar modelo...'"
              class="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] min-h-[40px] transition"
            />
            <button
              v-if="modelInput"
              type="button"
              @click="handleClearSelectedModel"
              class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
              title="Limpiar modelo"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <ChevronDown
              @click="isModelOpen = !isModelOpen"
              class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
            />
          </div>

          <!-- Dropdown Modelos -->
          <div
            v-if="isModelOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-50"
          >
            <div
              v-for="(mod, mdIdx) in filteredModels"
              :key="mod.id"
              @click="handleSelectModel(mod)"
              @mouseenter="highlightedModelIdx = mdIdx"
              :class="[
                'px-3 py-2 cursor-pointer text-xs flex items-center justify-between transition model-item-' + mdIdx,
                highlightedModelIdx === mdIdx ? 'bg-cyan-100/90 text-[#038391] ring-1 ring-inset ring-[#04C4D9]' : (selectedModel?.id === mod.id ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-800 hover:bg-cyan-50/70')
              ]"
            >
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="selectedModel?.id === mod.id ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                <div>
                  <span v-if="!selectedBrand && mod.fabricante_id" class="text-[10px] font-bold text-[#038391] mr-1 uppercase">
                    {{ getBrandName(mod.fabricante_id) }}
                  </span>
                  <strong class="font-bold">{{ mod.nombre }}</strong>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <span v-if="mod.anio_inicio" class="text-[10px] text-slate-400 font-mono">
                  {{ mod.anio_inicio }} - {{ mod.anio_fin || 'Act' }}
                </span>
                <Check v-if="selectedModel?.id === mod.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
              </div>
            </div>
            <div v-if="filteredModels.length === 0" class="p-2.5 text-center text-xs text-slate-400">
              No hay modelos coincidentes
            </div>
            <!-- Acción rápida para registrar nuevo modelo -->
            <button
              type="button"
              @mousedown.prevent="openQuickCreateModelModal(modelInput)"
              class="w-full px-3 py-2.5 text-left text-xs font-bold text-[#038391] bg-cyan-50/90 hover:bg-[#04C4D9] hover:text-white transition flex items-center justify-between border-t border-cyan-200 cursor-pointer"
            >
              <span class="flex items-center gap-1.5 truncate">
                <Plus class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">
                  {{ modelInput.trim() ? `+ Registrar nuevo modelo "${modelInput.trim().toUpperCase()}"` : '+ Registrar nuevo modelo' }}
                </span>
              </span>
              <span class="text-[9px] font-mono uppercase opacity-80 shrink-0 ml-1">Crear</span>
            </button>
          </div>
        </div>

        <!-- 4. AÑO DE COMPATIBILIDAD -->
        <div class="relative combobox-year">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Año
            </label>
            <button
              type="button"
              @click="openQuickCreateYearModal(yearInput)"
              class="text-[10px] font-bold text-[#038391] hover:text-[#04C4D9] flex items-center gap-0.5 transition"
              title="Agregar un nuevo año o rango de compatibilidad"
            >
              <Plus class="w-3 h-3" />
              <span>Nuevo</span>
            </button>
          </div>

          <div class="relative flex items-center">
            <input
              v-model="yearInput"
              @focus="isYearOpen = true"
              @click="isYearOpen = true"
              @input="onInputYear"
              @keydown.enter.prevent="filteredYears[0] ? handleSelectYear(filteredYears[0]) : (yearInput.trim() ? handleSaveQuickYear(yearInput) : null)"
              type="text"
              placeholder="Todos los años..."
              class="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] min-h-[40px] transition"
            />
            <button
              v-if="selectedYear || yearInput"
              type="button"
              @click="handleClearYear"
              class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
              title="Limpiar año"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <ChevronDown
              @click="isYearOpen = !isYearOpen"
              class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
            />
          </div>

          <!-- Dropdown Años -->
          <div
            v-if="isYearOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-50"
          >
            <div
              @click="handleClearYear"
              class="px-3 py-2 cursor-pointer text-xs flex items-center justify-between transition hover:bg-cyan-50/70"
              :class="!selectedYear ? 'bg-cyan-50/60 font-bold text-[#038391]' : 'text-slate-600'"
            >
              <span>Todos los años</span>
              <Check v-if="!selectedYear" class="w-3.5 h-3.5 text-[#04C4D9]" />
            </div>
            <div
              v-for="yr in filteredYears"
              :key="yr"
              @click="handleSelectYear(yr)"
              class="px-3 py-2 cursor-pointer text-xs font-mono font-bold flex items-center justify-between transition"
              :class="selectedYear === yr ? 'bg-cyan-50/60 text-[#038391]' : 'text-slate-800 hover:bg-cyan-50/70'"
            >
              <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="selectedYear === yr ? 'bg-[#04C4D9]' : 'bg-slate-300'"></span>
                <span>{{ yr }}</span>
              </div>
              <Check v-if="selectedYear === yr" class="w-3.5 h-3.5 text-[#04C4D9]" />
            </div>
            <button
              type="button"
              @mousedown.prevent="yearInput.trim() && !availableYears.includes(yearInput.trim()) ? handleSaveQuickYear(yearInput) : openQuickCreateYearModal(yearInput)"
              class="w-full px-3 py-2.5 text-left text-xs font-bold text-[#038391] bg-cyan-50/90 hover:bg-[#04C4D9] hover:text-white transition flex items-center justify-between border-t border-cyan-200 cursor-pointer"
            >
              <span class="flex items-center gap-1.5 truncate">
                <Plus class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">
                  {{ yearInput.trim() && !availableYears.includes(yearInput.trim()) ? `+ Agregar año "${yearInput.trim()}"` : '+ Agregar nuevo año' }}
                </span>
              </span>
              <span class="text-[9px] font-mono uppercase opacity-80 shrink-0 ml-1">Crear</span>
            </button>
          </div>
        </div>

        <!-- 5. COMPONENTE -->
        <div class="relative combobox-component">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Componente
            </label>
            <button
              type="button"
              @click="handleCreateNewGroup"
              class="text-[11px] font-bold text-[#038391] hover:text-[#04C4D9] flex items-center gap-1 transition"
              title="Crear nueva familia paramétrica"
            >
              <Plus class="w-3 h-3 text-[#04C4D9]" />
              <span>+ Nueva Familia</span>
            </button>
          </div>

          <div class="relative flex items-center">
            <input
              ref="componentInputRef"
              v-model="componentInput"
              @focus="handleFocusComponent"
              @click="handleFocusComponent"
              @input="isComponentOpen = true; highlightedComponentIdx = 0"
              @keydown="handleComponentKeydown"
              type="text"
              placeholder="Buscar componente..."
              class="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] min-h-[40px] transition"
            />
            <button
              v-if="componentInput"
              type="button"
              @click="handleClearSelectedComponent"
              class="absolute right-7 p-1 text-slate-400 hover:text-slate-600"
              title="Limpiar componente"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <ChevronDown
              @click="isComponentOpen = !isComponentOpen"
              class="w-4 h-4 text-slate-400 absolute right-2.5 cursor-pointer hover:text-slate-600"
            />
          </div>

          <!-- Dropdown Tipos de Componente -->
          <div
            v-if="isComponentOpen"
            class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-50"
          >
            <div
              v-for="(grp, cIdx) in filteredComponentGroups"
              :key="grp.id"
              @click="handleSelectComponent(grp)"
              @mouseenter="highlightedComponentIdx = cIdx"
              :class="[
                'px-3 py-2 cursor-pointer text-xs flex items-center justify-between transition component-item-' + cIdx,
                highlightedComponentIdx === cIdx ? 'bg-cyan-100/90 text-[#038391] ring-1 ring-inset ring-[#04C4D9]' : (selectedComponent?.id === grp.id ? 'bg-cyan-50/60 text-[#038391] font-bold' : 'text-slate-800 hover:bg-cyan-50/70')
              ]"
            >
              <div class="flex items-center gap-2.5">
                <CircleDot v-if="grp.id === 'ajuste_valvula' || grp.category === 'Sellos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Wrench v-else-if="grp.id === 'valvula' || grp.category === 'Válvulas'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'anillos_motor' || grp.category === 'Anillos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <FileText v-else-if="grp.id === 'tornillos_culata' || grp.category === 'Pernos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <CircleDot v-else-if="grp.id === 'casqueteria' || grp.category === 'Casquetería'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'empaques_juntas' || grp.category === 'Empaques'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <span class="font-bold text-slate-900 text-xs">{{ grp.title }}</span>
              </div>
              <Check v-if="selectedComponent?.id === grp.id" class="w-4 h-4 text-[#04C4D9] shrink-0 ml-2" />
            </div>
            <div v-if="filteredComponentGroups.length === 0" class="p-3 text-center text-xs text-slate-400">
              No hay componentes coincidentes
            </div>
            <!-- Botón de acción para crear nueva familia técnica dentro del dropdown -->
            <button
              type="button"
              @click="handleCreateNewGroup(); isComponentOpen = false"
              class="w-full px-3 py-2 text-xs font-bold text-[#038391] bg-cyan-50/70 hover:bg-cyan-100 flex items-center justify-between border-t border-cyan-100 transition sticky bottom-0"
              title="Crear nueva familia de componentes"
            >
              <span class="flex items-center gap-1.5 truncate">
                <FolderPlus class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                <span>+ Crear nueva familia de componentes</span>
              </span>
              <span class="text-[9px] font-mono uppercase opacity-80 shrink-0 ml-1">Nuevo</span>
            </button>
          </div>
        </div>

        <!-- Botón de acción para cerrar filtros en móvil y ver resultados -->
        <div v-if="isMobileFiltersOpen" class="col-span-full lg:hidden pt-1.5">
          <button
            type="button"
            @click="isMobileFiltersOpen = false"
            class="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm"
          >
            <ChevronUp class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span>Ocultar filtros y ver resultados</span>
          </button>
        </div>

      </div>

      <!-- Barra informativa activa de selección en cascada (Minimalista) -->
      <div v-if="selectedBrand || selectedModel || selectedMotor || selectedYear || selectedComponent" class="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Activos:</span>
          
          <span v-if="selectedBrand || brandInput" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-[#038391] border border-cyan-200/80 font-bold text-xs">
            <span>{{ selectedBrand?.nombre || brandInput }}</span>
          </span>

          <span v-if="selectedModel" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs">
            <span>{{ selectedModel.nombre }}</span>
            <button type="button" @click="handleClearSelectedModel" class="text-slate-400 hover:text-rose-500 ml-0.5">
              <X class="w-3 h-3" />
            </button>
          </span>

          <span v-if="selectedMotor" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-xs">
            <span>{{ selectedMotor.codigo }}</span>
            <button type="button" @click="handleClearSelectedMotor" class="text-slate-400 hover:text-rose-400 ml-0.5">
              <X class="w-3 h-3" />
            </button>
          </span>

          <span v-if="selectedYear" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold text-xs">
            <span>Año {{ selectedYear }}</span>
            <button type="button" @click="selectedYear = ''" class="text-amber-500 hover:text-rose-500 ml-0.5">
              <X class="w-3 h-3" />
            </button>
          </span>

          <span v-if="selectedComponent" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 font-bold text-xs">
            <span>{{ selectedComponent.title }}</span>
            <button type="button" @click="handleClearSelectedComponent" class="text-blue-400 hover:text-rose-500 ml-0.5">
              <X class="w-3 h-3" />
            </button>
          </span>
        </div>

        <!-- Pestañas para alternar entre lista de motores y repuestos -->
        <div v-if="selectedComponent" class="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            type="button"
            @click="activeViewTab = 'motores'"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-bold transition',
              activeViewTab === 'motores' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Motores ({{ brandMotorsList.length }})
          </button>
          <button
            type="button"
            @click="activeViewTab = 'repuestos'"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-bold transition',
              activeViewTab === 'repuestos' ? 'bg-white text-[#04C4D9] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Repuestos ({{ displayedParts.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 1: PANTALLA INICIAL (MINIMALISTA)                                   -->
    <!-- ========================================================================= -->
    <div 
      v-if="!selectedBrand && !brandInput && !selectedMotor && !motorInput && !selectedModel && !selectedYear && !yearInput && !selectedComponent && !searchInput && !showAllMotors" 
      class="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 text-center max-w-lg mx-auto space-y-3.5 my-6"
    >
      <div class="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-200/80 text-[#04C4D9] flex items-center justify-center mx-auto shadow-2xs">
        <Sparkles class="w-6 h-6" />
      </div>
      <div>
        <h2 class="text-base font-extrabold text-slate-900">
          Búsqueda de Motores y Repuestos
        </h2>
        <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          Seleccione un fabricante, motor o componente para explorar el catálogo técnico o cotas métricas.
        </p>
      </div>

      <!-- Botones de acceso rápido a marcas principales y opción Ver todos -->
      <div class="pt-3 border-t border-slate-100">
        <div class="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            @click="showAllMotors = true; activeViewTab = 'motores'"
            class="px-3 py-1 rounded-full border border-cyan-300 bg-cyan-50/90 hover:bg-cyan-100 text-xs font-bold text-[#038391] transition active:scale-95 flex items-center gap-1"
          >
            <Layers class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span>Ver todos los motores</span>
          </button>
          <button
            v-for="fab in catalogStore.fabricantes.slice(0, 8)"
            :key="fab.id"
            type="button"
            @click="handleSelectBrand(fab)"
            class="px-3 py-1 rounded-full border border-slate-200 hover:border-[#04C4D9] hover:bg-cyan-50/60 text-xs font-semibold text-slate-700 transition active:scale-95"
          >
            {{ fab.nombre }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 2: TABLA DE MOTORES (MINIMALISTA, LIMPIA Y RÁPIDA)                 -->
    <!-- ========================================================================= -->
    <div 
      v-else-if="(selectedBrand || brandInput || motorInput || selectedModel || selectedYear || yearInput || showAllMotors || (activeViewTab === 'motores' && !selectedMotor)) && (!selectedMotor || activeViewTab === 'motores') && !searchInput && (!selectedComponent || activeViewTab === 'motores')"
      class="space-y-3.5"
    >
      <!-- Encabezado de la tabla de motores -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
          <h3 class="text-xs sm:text-sm font-bold text-slate-900">
            Motores disponibles:
            <span class="text-[#038391] uppercase font-extrabold">
              {{ selectedBrand?.nombre || brandInput || (motorInput ? `Coincidencias "${motorInput.trim().toUpperCase()}"` : 'Todos los fabricantes') }}
            </span>
            <span v-if="selectedModel" class="text-slate-600 font-medium ml-1">({{ selectedModel.nombre }})</span>
            <span v-if="effectiveYearFilter" class="text-amber-700 font-mono text-xs font-bold ml-1.5">· Año {{ effectiveYearFilter }}</span>
          </h3>
          <span class="text-xs font-mono text-slate-400">({{ brandMotorsList.length }})</span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="toggleMotorsWithPartsOnly"
            class="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            :class="catalogStore.onlyMotorsWithParts 
              ? 'bg-[#04C4D9]/15 text-[#038391] border-[#04C4D9]/40 hover:bg-[#04C4D9]/25' 
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'"
            :title="catalogStore.onlyMotorsWithParts ? 'Mostrando solo motores con repuestos' : 'Mostrando todos los motores'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="catalogStore.onlyMotorsWithParts ? 'bg-[#04C4D9]' : 'bg-slate-400'"></span>
            <span>{{ catalogStore.onlyMotorsWithParts ? 'Solo con repuestos' : 'Todos los motores' }}</span>
          </button>
        </div>
      </div>

      <!-- TABLA TÉCNICA DE MOTORES -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
        <!-- Barra de Estado / Paginación Resumen -->
        <div class="bg-slate-900 text-white py-1.5 px-3.5 flex items-center justify-between text-xs font-medium">
          <span class="text-slate-300 font-mono text-[11px]">
            Mostrando {{ motorStartIndex + 1 }}-{{ motorEndIndex }} de {{ brandMotorsList.length }} motores
          </span>
          <span class="text-[11px] text-slate-400 font-sans">Página {{ motorCurrentPage }} / {{ motorTotalPages }}</span>
        </div>

        <!-- Contenedor con scroll interno -->
        <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table class="w-full text-left text-xs border-separate border-spacing-0">
            <thead class="sticky top-0 z-10 bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th class="py-2 px-2.5 w-9 text-center border-r border-b border-slate-200 bg-slate-50"></th>
                <th class="py-2 px-3 w-24 border-r border-b border-slate-200 bg-slate-50">ID / Ref</th>
                <th class="py-2 px-3.5 w-44 border-r border-b border-slate-200 bg-slate-50">Código Motor</th>
                <th class="py-2 px-3 w-36 border-r border-b border-slate-200 bg-slate-50">Modelo</th>
                <th class="py-2 px-3 w-24 text-center border-r border-b border-slate-200 bg-slate-50">Año</th>
                <th class="py-2 px-3.5 w-36 border-r border-b border-slate-200 bg-slate-50">Denominación</th>
                <th class="py-2 px-2.5 w-16 text-center border-r border-b border-slate-200 bg-slate-50">Cil</th>
                <th class="py-2 px-3 w-32 border-r border-b border-slate-200 bg-slate-50">Cilindrada</th>
                <th class="py-2 px-2.5 w-14 text-center border-r border-b border-slate-200 bg-slate-50">kW</th>
                <th class="py-2 px-2.5 w-14 text-center border-r border-b border-slate-200 bg-slate-50">CV</th>
                <th class="py-2 px-2.5 w-24 text-center border-r border-b border-slate-200 bg-slate-50">Repuestos</th>
                <th class="py-2 px-2 w-16 text-center border-b border-slate-200 bg-slate-50">Editar</th>
              </tr>
            </thead>

            <!-- Skeleton loading de motores -->
            <tbody v-if="catalogStore.loadingMotores" class="divide-y divide-slate-100">
              <tr v-for="n in 5" :key="`skel-mot-${n}`" class="animate-pulse bg-slate-50/50">
                <td class="py-2.5 px-2.5 text-center"><div class="w-3.5 h-3.5 bg-slate-200 rounded-full mx-auto"></div></td>
                <td class="py-2.5 px-3"><div class="h-3 w-16 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-3.5"><div class="h-3 w-28 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-3"><div class="h-3 w-24 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-3"><div class="h-3 w-16 bg-slate-200 rounded mx-auto"></div></td>
                <td class="py-2.5 px-3.5"><div class="h-3 w-20 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-2.5 text-center"><div class="h-3 w-6 bg-slate-200 rounded mx-auto"></div></td>
                <td class="py-2.5 px-3"><div class="h-3 w-20 bg-slate-200 rounded"></div></td>
                <td class="py-2.5 px-2.5 text-center"><div class="h-3 w-6 bg-slate-200 rounded mx-auto"></div></td>
                <td class="py-2.5 px-2.5 text-center"><div class="h-3 w-6 bg-slate-200 rounded mx-auto"></div></td>
                <td class="py-2.5 px-2.5 text-center"><div class="h-3 w-12 bg-slate-200 rounded mx-auto"></div></td>
                <td class="py-2.5 px-2 text-center"><div class="h-3 w-6 bg-slate-200 rounded mx-auto"></div></td>
              </tr>
            </tbody>

            <tbody v-else class="divide-y divide-slate-100">
              <tr
                v-for="mot in paginatedMotors"
                :key="mot.id"
                @click="handleSelectMotor(mot)"
                :class="[
                  'transition cursor-pointer group',
                  selectedMotor?.id === mot.id 
                    ? 'bg-cyan-50/80 font-bold' 
                    : 'hover:bg-slate-50 text-slate-700'
                ]"
              >
                <!-- 1. Icono de Información (i) -->
                <td class="py-2 px-2.5 text-center align-middle border-r border-slate-100">
                  <button
                    type="button"
                    @click="openMotorInfo(mot, $event)"
                    class="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 inline-flex items-center justify-center transition"
                    title="Ver ficha técnica del motor"
                  >
                    <Info class="w-3.5 h-3.5" />
                  </button>
                </td>

                <!-- 2. Número / ID -->
                <td class="py-2 px-3 font-mono text-slate-500 text-[11px] align-middle border-r border-slate-100">
                  {{ mot.numero_id || '—' }}
                </td>

                <!-- 3. Código de Motor -->
                <td class="py-2 px-3.5 font-semibold text-slate-800 align-middle border-r border-slate-100">
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-slate-900 group-hover:text-[#038391] transition">
                      {{ getBrandName(mot.fabricante_id) }} - {{ mot.codigo }}
                    </span>
                    <span 
                      v-if="selectedMotor?.id === mot.id"
                      class="text-[9px] px-1.5 py-0.2 rounded bg-[#04C4D9] text-white font-bold"
                    >
                      Activo
                    </span>
                  </div>
                </td>

                <!-- 4. Modelo Vehicular -->
                <td class="py-2 px-3 font-semibold text-slate-700 align-middle border-r border-slate-100">
                  {{ getMotorModelName(mot) }}
                </td>

                <!-- 5. Años -->
                <td class="py-2 px-3 text-center font-mono text-[11px] text-slate-600 align-middle border-r border-slate-100">
                  {{ getMotorYearsLabel(mot) }}
                </td>

                <!-- 6. Denominación de Venta -->
                <td class="py-2 px-3.5 text-slate-600 align-middle border-r border-slate-100">
                  {{ mot.denominacion_venta || '—' }}
                </td>

                <!-- 7. Cilindros -->
                <td class="py-2 px-2.5 text-center font-mono text-slate-800 align-middle border-r border-slate-100">
                  {{ mot.cilindros || '—' }}
                </td>

                <!-- 8. Cilindrada -->
                <td class="py-2 px-3 font-mono text-slate-800 align-middle border-r border-slate-100">
                  {{ mot.cilindrada_texto || (mot.cilindrada_cc ? `${mot.cilindrada_cc} cc` : '—') }}
                </td>

                <!-- 9. kW -->
                <td class="py-2 px-2.5 text-center font-mono text-slate-700 align-middle border-r border-slate-100">
                  {{ mot.kw || '—' }}
                </td>

                <!-- 10. CV -->
                <td class="py-2 px-2.5 text-center font-mono text-slate-700 align-middle border-r border-slate-100">
                  {{ mot.cv || '—' }}
                </td>

                <!-- 11. Repuestos Disponibles -->
                <td class="py-2 px-2.5 text-center align-middle border-r border-slate-100">
                  <span 
                    class="inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[10px]"
                    :class="(mot.parts_count || 0) > 0 ? 'bg-cyan-50 text-[#038391] border border-cyan-200' : 'bg-slate-100 text-slate-400'"
                  >
                    {{ mot.parts_count || 0 }} pzs
                  </span>
                </td>

                <!-- 12. Editar motor/modelo/año -->
                <td class="py-2 px-2 text-center align-middle" @click.stop>
                  <button
                    type="button"
                    @click="openEditMotorModal(mot, $event)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-[#004B97] hover:bg-blue-50 transition cursor-pointer"
                    title="Editar código de motor, modelo o año"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>

              <tr v-if="paginatedMotors.length === 0">
                <td colspan="12" class="py-8 text-center text-slate-400 bg-white">
                  No hay motores que coincidan con la búsqueda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pie de Tabla con Paginación -->
        <div class="bg-slate-50 py-2 px-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span class="text-[11px] text-slate-500">Página {{ motorCurrentPage }} de {{ motorTotalPages }}</span>
          
          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="goToFirstMotorPage"
              :disabled="motorCurrentPage === 1"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Primera página"
            >
              <ChevronsLeft class="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              @click="goToPrevMotorPage"
              :disabled="motorCurrentPage === 1"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Página anterior"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
            </button>

            <span class="px-2 font-mono font-bold text-slate-700 text-xs">
              {{ motorCurrentPage }}
            </span>

            <button
              type="button"
              @click="goToNextMotorPage"
              :disabled="motorCurrentPage === motorTotalPages"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Página siguiente"
            >
              <ChevronRight class="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              @click="goToLastMotorPage"
              :disabled="motorCurrentPage === motorTotalPages"
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              title="Última página"
            >
              <ChevronsRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      <!-- Acceso directo a componentes -->
      <div class="flex items-center gap-1.5 flex-wrap pt-1">
        <span class="text-[11px] font-bold text-slate-500 mr-1">Componentes:</span>
        <button
          v-for="grp in componentGroups"
          :key="grp.id"
          type="button"
          @click="handleSelectComponent(grp)"
          class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:border-[#04C4D9] hover:text-[#038391] transition flex items-center gap-1.5 shadow-2xs"
        >
          <CircleDot v-if="grp.id === 'ajuste_valvula' || grp.category === 'Sellos'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
          <Wrench v-else-if="grp.id === 'valvula' || grp.category === 'Válvulas'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
          <Layers v-else-if="grp.id === 'anillos_motor' || grp.category === 'Anillos'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
          <FileText v-else-if="grp.id === 'tornillos_culata' || grp.category === 'Pernos'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
          <CircleDot v-else-if="grp.id === 'casqueteria' || grp.category === 'Casquetería'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
          <Layers v-else-if="grp.id === 'empaques_juntas' || grp.category === 'Empaques'" class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
          <Layers v-else class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
          <span>{{ grp.title }}</span>
        </button>
      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 3: MOTOR Y/O COMPONENTE / BÚSQUEDA ACTIVA -> TABLA DE REPUESTOS     -->
    <!-- ========================================================================= -->
    <div v-else class="space-y-3.5">
      
      <!-- ======================================================================= -->
      <!-- BARRA DE FILTROS DE MEDIDAS TÉCNICAS (MINIMALISTA)                      -->
      <!-- ======================================================================= -->
      <div v-if="selectedComponent" class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <SlidersHorizontal class="w-3.5 h-3.5 text-[#04C4D9]" />
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-800">
              Filtros: {{ selectedComponent.title }}
            </h4>
            <span v-if="activeMeasurementsCount > 0" class="text-[10px] font-bold px-2 py-0.2 rounded-full bg-cyan-100 text-[#038391]">
              {{ activeMeasurementsCount }} aplicado(s)
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handleCreateNewGroup"
              class="px-2.5 py-1 text-xs font-semibold text-[#038391] bg-cyan-50 hover:bg-cyan-100 rounded-lg flex items-center gap-1 transition"
              title="Crear una nueva familia de componentes"
            >
              <Plus class="w-3 h-3 text-[#04C4D9]" />
              <span>+ Nueva Familia</span>
            </button>

            <button
              type="button"
              @click="handleEditGroup(selectedComponent.id)"
              class="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
              title="Modificar parámetros del grupo"
            >
              <Edit3 class="w-3 h-3 text-slate-500" />
              <span>Modificar Grupo</span>
            </button>

            <button
              v-if="activeMeasurementsCount > 0"
              type="button"
              @click="resetMeasurementsFilters"
              class="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 ml-1"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        <!-- CONTROL DE TOLERANCIA UNIVERSAL (± mm) -->
        <div class="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5">
              <Ruler class="w-3.5 h-3.5 text-[#04C4D9]" />
              <span class="text-xs font-bold text-slate-700">Tolerancia General:</span>
            </div>
            <span 
              v-if="customTolerancesCount > 0" 
              class="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-cyan-100 text-[#004b97] rounded-full font-bold border border-cyan-200"
            >
              <span>{{ customTolerancesCount }} personalizada{{ customTolerancesCount > 1 ? 's' : '' }}</span>
              <button 
                type="button" 
                @click="filterTolerancias = {}" 
                title="Restablecer todas las tolerancias a la general"
                class="hover:text-red-600 font-black ml-0.5 text-xs transition"
              >
                ✕
              </button>
            </span>
          </div>

          <div class="flex items-center gap-1 flex-wrap">
            <button
              v-for="tolOption in [0.2, 0.5, 1.0]"
              :key="tolOption"
              type="button"
              @click="filterToleranciaMm = tolOption"
              :class="[
                'px-2 py-0.5 rounded text-[11px] font-mono font-bold transition',
                filterToleranciaMm === tolOption
                  ? 'bg-[#04C4D9] text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              ]"
            >
              ±{{ tolOption }} mm
            </button>

            <div class="flex items-center gap-1 ml-1 pl-2 border-l border-slate-300">
              <span class="text-xs text-slate-400 font-bold">±</span>
              <input
                v-model.number="filterToleranciaMm"
                type="number"
                step="0.1"
                min="0"
                max="100"
                class="w-14 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-center focus:outline-none focus:border-[#04C4D9]"
                title="Tolerancia en mm"
              />
              <span class="text-xs text-slate-500 font-bold">mm</span>
            </div>
          </div>
        </div>

        <!-- FILTROS ESPECIALIZADOS PARA FAMILIAS EN TABLA / ANILLOS DE MOTOR (Sincronizado con Gestor de Familias) -->
        <div v-if="isCurrentGroupRingsTable" class="space-y-2.5">
          <!-- Barra superior de selección de Anillo y Nota Técnica -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
            <!-- Tabs de navegación: Todos, 1, 2, 3, Anillo de aceite -->
            <div class="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                @click="filterAnilloTab = 'todos'"
                class="px-2.5 py-1 rounded-md transition"
                :class="filterAnilloTab === 'todos' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'"
              >
                Todos
              </button>
              <button
                v-if="isTableParamInFilter('anillo1_h1') || isTableParamInFilter('anillo1_a1')"
                type="button"
                @click="filterAnilloTab = '1'"
                class="px-2.5 py-1 rounded-md transition flex items-center gap-1"
                :class="filterAnilloTab === '1' ? 'bg-[#04C4D9] text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'"
              >
                <span>Anillo 1</span>
                <span v-if="filterAnilloGrosor1 !== undefined || filterAnilloRadial1 !== undefined" class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </button>
              <button
                v-if="isTableParamInFilter('anillo2_h1') || isTableParamInFilter('anillo2_a1')"
                type="button"
                @click="filterAnilloTab = '2'"
                class="px-2.5 py-1 rounded-md transition flex items-center gap-1"
                :class="filterAnilloTab === '2' ? 'bg-[#04C4D9] text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'"
              >
                <span>Anillo 2</span>
                <span v-if="filterAnilloGrosor2 !== undefined || filterAnilloRadial2 !== undefined" class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </button>
              <button
                type="button"
                @click="filterAnilloTab = '3'"
                class="px-2.5 py-1 rounded-md transition flex items-center gap-1"
                :class="filterAnilloTab === '3' ? 'bg-[#04C4D9] text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'"
              >
                <span>Anillo 3</span>
                <span v-if="filterAnilloGrosor3 !== undefined || filterAnilloRadial3 !== undefined" class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </button>
              <button
                v-if="isTableParamInFilter('aceite_h1') || isTableParamInFilter('aceite_a1')"
                type="button"
                @click="filterAnilloTab = 'aceite'"
                class="px-2.5 py-1 rounded-md transition flex items-center gap-1"
                :class="filterAnilloTab === 'aceite' ? 'bg-[#04C4D9] text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'"
              >
                <span>Anillo de aceite</span>
                <span v-if="filterAnilloGrosorAceite !== undefined || filterAnilloRadialAceite !== undefined" class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </button>
            </div>

            <!-- Información técnica del motor seleccionado -->
            <div v-if="selectedMotor?.cilindros" class="flex items-center gap-1.5 text-[10px] text-cyan-800 bg-cyan-50/80 px-2.5 py-1 rounded-md border border-cyan-200/70 font-medium">
              <span class="font-bold text-[#038391]">{{ selectedMotor.cilindros }} Cilindros</span>
            </div>
          </div>

          <!-- Campos de búsqueda: Diámetro + Pares Grosor y Altura a la par -->
          <!-- Modo 'todos': muestra Diámetro y cada anillo con sus campos a la par -->
          <div v-if="filterAnilloTab === 'todos'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <!-- Diámetro (la primera siempre) -->
            <div v-if="isTableParamInFilter('diametro_cilindro_mm')" class="bg-slate-50/70 p-2 rounded-lg border border-slate-200/90 flex flex-col justify-between">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate" title="Diámetro nominal del cilindro / pistón">
                  {{ getTableParamLabel('diametro_cilindro_mm', 'Diámetro') }}
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloDiametro']" :fallback="filterToleranciaMm" :unit="getTableParamUnit('diametro_cilindro_mm', 'mm')" />
              </div>
              <input
                v-model.number="filterAnilloDiametro"
                type="number"
                step="0.1"
                placeholder="ej. 88.0"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
              <span class="text-[9px] text-slate-500 mt-1 block">Diámetro nominal ({{ getTableParamUnit('diametro_cilindro_mm', 'mm') || 'mm' }})</span>
            </div>

            <!-- 1: Grosor y Altura a la par -->
            <div v-if="isTableParamInFilter('anillo1_h1') || isTableParamInFilter('anillo1_a1')" class="bg-slate-50/70 p-2 rounded-lg border border-slate-200/90">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Anillo 1
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div v-if="isTableParamInFilter('anillo1_h1')">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Grosor</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloGrosor1']" :fallback="filterToleranciaMm" :step="0.02" :unit="getTableParamUnit('anillo1_h1', 'mm')" />
                  </div>
                  <input
                    v-model.number="filterAnilloGrosor1"
                    type="number"
                    step="0.05"
                    placeholder="1.2"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
                <div v-if="isTableParamInFilter('anillo1_a1')">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Altura</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloRadial1']" :fallback="filterToleranciaMm" :step="0.05" :unit="getTableParamUnit('anillo1_a1', 'mm')" />
                  </div>
                  <input
                    v-model.number="filterAnilloRadial1"
                    type="number"
                    step="0.05"
                    placeholder="2.5"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
              </div>
            </div>

            <!-- 2: Grosor y Altura a la par -->
            <div v-if="isTableParamInFilter('anillo2_h1') || isTableParamInFilter('anillo2_a1')" class="bg-slate-50/70 p-2 rounded-lg border border-slate-200/90">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Anillo 2
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div v-if="isTableParamInFilter('anillo2_h1')">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Grosor</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloGrosor2']" :fallback="filterToleranciaMm" :step="0.02" :unit="getTableParamUnit('anillo2_h1', 'mm')" />
                  </div>
                  <input
                    v-model.number="filterAnilloGrosor2"
                    type="number"
                    step="0.05"
                    placeholder="1.5"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
                <div v-if="isTableParamInFilter('anillo2_a1')">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Altura</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloRadial2']" :fallback="filterToleranciaMm" :step="0.05" :unit="getTableParamUnit('anillo2_a1', 'mm')" />
                  </div>
                  <input
                    v-model.number="filterAnilloRadial2"
                    type="number"
                    step="0.05"
                    placeholder="2.5"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
              </div>
            </div>

            <!-- 3: Grosor y Altura a la par (para 4 anillos) -->
            <div class="bg-slate-50/70 p-2 rounded-lg border border-slate-200/90">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                <span>Anillo 3</span>
                <span class="text-[9px] text-[#038391] font-mono font-semibold">4 aros</span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div>
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Grosor</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloGrosor3']" :fallback="filterToleranciaMm" :step="0.02" />
                  </div>
                  <input
                    v-model.number="filterAnilloGrosor3"
                    type="number"
                    step="0.05"
                    placeholder="2.0"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Altura</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloRadial3']" :fallback="filterToleranciaMm" :step="0.05" />
                  </div>
                  <input
                    v-model.number="filterAnilloRadial3"
                    type="number"
                    step="0.05"
                    placeholder="3.0"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
              </div>
            </div>

            <!-- Anillo de aceite: Grosor y Altura a la par (el último siempre) -->
            <div v-if="isTableParamInFilter('aceite_h1') || isTableParamInFilter('aceite_a1')" class="bg-slate-50/70 p-2 rounded-lg border border-slate-200/90">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1">
                Anillo de aceite
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div v-if="isTableParamInFilter('aceite_h1')">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Grosor</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloGrosorAceite']" :fallback="filterToleranciaMm" :step="0.02" :unit="getTableParamUnit('aceite_h1', 'mm')" />
                  </div>
                  <input
                    v-model.number="filterAnilloGrosorAceite"
                    type="number"
                    step="0.05"
                    placeholder="2.8"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
                <div v-if="isTableParamInFilter('aceite_a1')">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Altura</label>
                    <ToleranceBadge v-model="filterTolerancias['anilloRadialAceite']" :fallback="filterToleranciaMm" :step="0.05" :unit="getTableParamUnit('aceite_a1', 'mm')" />
                  </div>
                  <input
                    v-model.number="filterAnilloRadialAceite"
                    type="number"
                    step="0.05"
                    placeholder="2.8"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Modos Individuales (1, 2, 3, aceite): Enfocados con Diámetro y el par Grosor/Altura a la par -->
          <div v-else-if="filterAnilloTab === '1'" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Diámetro (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloDiametro']" :fallback="filterToleranciaMm" />
              </div>
              <input
                v-model.number="filterAnilloDiametro"
                type="number"
                step="0.1"
                placeholder="ej. 88.0"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo 1: Grosor (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloGrosor1']" :fallback="filterToleranciaMm" :step="0.02" />
              </div>
              <input
                v-model.number="filterAnilloGrosor1"
                type="number"
                step="0.05"
                placeholder="ej. 1.2"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo 1: Altura (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloRadial1']" :fallback="filterToleranciaMm" :step="0.05" />
              </div>
              <input
                v-model.number="filterAnilloRadial1"
                type="number"
                step="0.05"
                placeholder="ej. 2.5"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>
          </div>

          <div v-else-if="filterAnilloTab === '2'" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Diámetro (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloDiametro']" :fallback="filterToleranciaMm" />
              </div>
              <input
                v-model.number="filterAnilloDiametro"
                type="number"
                step="0.1"
                placeholder="ej. 88.0"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo 2: Grosor (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloGrosor2']" :fallback="filterToleranciaMm" :step="0.02" />
              </div>
              <input
                v-model.number="filterAnilloGrosor2"
                type="number"
                step="0.05"
                placeholder="ej. 1.5"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo 2: Altura (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloRadial2']" :fallback="filterToleranciaMm" :step="0.05" />
              </div>
              <input
                v-model.number="filterAnilloRadial2"
                type="number"
                step="0.05"
                placeholder="ej. 2.5"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
          </div>

          <div v-else-if="filterAnilloTab === '3'" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Diámetro (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloDiametro']" :fallback="filterToleranciaMm" />
              </div>
              <input
                v-model.number="filterAnilloDiametro"
                type="number"
                step="0.1"
                placeholder="ej. 88.0"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo 3: Grosor (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloGrosor3']" :fallback="filterToleranciaMm" :step="0.02" />
              </div>
              <input
                v-model.number="filterAnilloGrosor3"
                type="number"
                step="0.05"
                placeholder="ej. 2.0"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo 3: Altura (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloRadial3']" :fallback="filterToleranciaMm" :step="0.05" />
              </div>
              <input
                v-model.number="filterAnilloRadial3"
                type="number"
                step="0.05"
                placeholder="ej. 3.0"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
          </div>

          <div v-else-if="filterAnilloTab === 'aceite'" class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Diámetro (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloDiametro']" :fallback="filterToleranciaMm" />
              </div>
              <input
                v-model.number="filterAnilloDiametro"
                type="number"
                step="0.1"
                placeholder="ej. 88.0"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo de aceite: Grosor (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloGrosorAceite']" :fallback="filterToleranciaMm" :step="0.02" />
              </div>
              <input
                v-model.number="filterAnilloGrosorAceite"
                type="number"
                step="0.05"
                placeholder="ej. 2.8"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
            <div>
              <div class="flex items-center justify-between mb-0.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
                  Anillo de aceite: Altura (mm)
                </label>
                <ToleranceBadge v-model="filterTolerancias['anilloRadialAceite']" :fallback="filterToleranciaMm" :step="0.05" />
              </div>
              <input
                v-model.number="filterAnilloRadialAceite"
                type="number"
                step="0.05"
                placeholder="ej. 2.8"
                class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              />
            </div>
          </div>

          <!-- Parámetros adicionales configurados en la familia en tabla -->
          <div
            v-if="extraTableFilterParams.length > 0"
            class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/80"
          >
            <div v-for="param in extraTableFilterParams" :key="`tbl-flt-${param.clave}`">
              <template v-if="param.tipo_dato === 'numero'">
                <div class="flex items-center justify-between mb-0.5">
                  <label class="block text-[10px] font-bold text-slate-600 truncate">
                    {{ param.etiqueta }}
                    <span v-if="param.unidad" class="text-slate-400 font-normal">({{ param.unidad }})</span>
                  </label>
                  <ToleranceBadge v-model="filterTolerancias[param.clave]" :fallback="filterToleranciaMm" :unit="param.unidad || 'mm'" />
                </div>
                <input
                  v-model.number="dynamicParamFilters[param.clave]"
                  type="number"
                  step="0.1"
                  :placeholder="`ej. 50 ${param.unidad || ''}`"
                  class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </template>
              <template v-else-if="param.tipo_dato === 'seleccion' || (param.opciones && param.opciones.length > 0)">
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5 truncate">{{ param.etiqueta }}</label>
                <select
                  v-model="dynamicParamFilters[param.clave]"
                  class="w-full px-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="">Todas las opciones</option>
                  <option v-for="opt in (param.opciones || [])" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </template>
              <template v-else>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5 truncate">
                  {{ param.etiqueta }}
                  <span v-if="param.unidad" class="text-slate-400 font-normal">({{ param.unidad }})</span>
                </label>
                <input
                  v-model="dynamicParamFilters[param.clave]"
                  type="text"
                  placeholder="Filtrar..."
                  class="w-full px-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </template>
            </div>
          </div>
        </div>

        <!-- FILTROS TÉCNICOS DINÁMICOS BASADOS EN PARÁMETROS DE LA FAMILIA (SUPABASE / STORE) -->
        <div 
          v-else-if="currentGroupDefinition?.parametros && currentGroupDefinition.parametros.length > 0"
          class="space-y-2.5"
        >
          <!-- Caso A: Si la familia tiene sub-columnas / etapas agrupadas (ej. Cojinetes: Código, STD: Dmin y Dmax, 1er...) -->
          <div v-if="hasGroupedFilterBlocks" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
            <!-- Bloque 1: Filtro de Código / Identificador de Parte -->
            <div class="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition space-y-1.5 shadow-2xs flex flex-col justify-between">
              <div class="flex items-center justify-between pb-1 border-b border-slate-200">
                <div class="flex items-center gap-1.5">
                  <Hash class="w-3.5 h-3.5 text-[#004B97]" />
                  <span class="text-xs font-black uppercase tracking-wider text-[#004B97] font-mono">
                    Código
                  </span>
                </div>
                <span class="text-[9px] font-bold text-slate-400 uppercase">OEM / Parte</span>
              </div>
              <div class="relative flex-1 flex flex-col justify-center">
                <input
                  v-model="filterCodigoPart"
                  type="text"
                  placeholder="ej. 4-4160, 7367..."
                  class="w-full pl-2.5 pr-7 py-1.5 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9] shadow-2xs"
                />
                <button
                  v-if="filterCodigoPart"
                  type="button"
                  @click="filterCodigoPart = ''"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Limpiar código"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
              <span class="text-[9px] text-slate-400 font-sans block truncate">Biela, Bancada o alterno</span>
            </div>

            <!-- Bloques Agrupados por Etapa / Columna Padre (STD, 1er, 2da, 3er, 4ta...) -->
            <div 
              v-for="block in groupedCatalogFilterParams.filter(b => b.parent !== null)" 
              :key="block.parent!"
              class="bg-blue-50/40 p-2.5 rounded-xl border border-blue-200/90 hover:border-blue-300 transition space-y-1.5 shadow-2xs"
            >
              <!-- Cabecera del Grupo (ej. STD, 1er, 2da...) -->
              <div class="flex items-center justify-between pb-1 border-b border-blue-200/80">
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-[#004B97]"></span>
                  <span class="text-xs font-black uppercase tracking-wider text-[#004B97] font-mono">
                    {{ block.parent }}
                  </span>
                </div>
                <span class="text-[9px] font-bold text-[#038391] bg-blue-100/80 px-1.5 py-0.2 rounded font-mono">
                  {{ block.params.map(p => getShortParamFilterLabel(p).replace(' (mm)', '')).join(' · ') }}
                </span>
              </div>

              <!-- Inputs de medidas (ej. Dmin y Dmax lado a lado) -->
              <div :class="block.params.length === 2 ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-1 gap-1.5'">
                <div v-for="param in block.params" :key="param.clave">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-extrabold uppercase text-slate-700 truncate" :title="param.etiqueta">
                      {{ getShortParamFilterLabel(param) }}
                    </label>
                    <ToleranceBadge v-if="param.tipo_dato === 'numero'" v-model="filterTolerancias[param.clave]" :fallback="filterToleranciaMm" :unit="param.unidad || 'mm'" />
                  </div>
                  <input
                    v-if="param.tipo_dato === 'numero'"
                    v-model.number="dynamicParamFilters[param.clave]"
                    type="number"
                    step="0.001"
                    placeholder="0.00"
                    class="w-full px-2 py-1 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9] shadow-2xs"
                  />
                  <input
                    v-else
                    v-model="dynamicParamFilters[param.clave]"
                    type="text"
                    placeholder="—"
                    class="w-full px-2 py-1 text-xs font-bold text-center bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9] shadow-2xs"
                  />
                </div>
              </div>
            </div>

            <!-- Bloque para parámetros sueltos sin padre (si existen) -->
            <div 
              v-for="block in groupedCatalogFilterParams.filter(b => b.parent === null)" 
              :key="'standalone-block'"
              class="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/90 hover:border-slate-300 transition space-y-1.5 shadow-2xs"
            >
              <div class="flex items-center justify-between pb-1 border-b border-slate-200">
                <span class="text-xs font-black uppercase tracking-wider text-slate-700 font-mono">
                  Otras Cotas
                </span>
              </div>
              <div class="grid grid-cols-1 gap-1.5">
                <div v-for="param in block.params" :key="param.clave">
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-700 truncate">
                      {{ param.etiqueta_corta || param.etiqueta }}
                    </label>
                    <ToleranceBadge v-if="param.tipo_dato === 'numero'" v-model="filterTolerancias[param.clave]" :fallback="filterToleranciaMm" :unit="param.unidad || 'mm'" />
                  </div>
                  <input
                    v-if="param.tipo_dato === 'numero'"
                    v-model.number="dynamicParamFilters[param.clave]"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    class="w-full px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                  <input
                    v-else
                    v-model="dynamicParamFilters[param.clave]"
                    type="text"
                    placeholder="Filtrar..."
                    class="w-full px-2 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Caso B: Formato plano estándar cuando no hay sub-columnas / padres -->
          <div 
            v-else
            class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
          >
            <div 
              v-for="param in currentGroupDefinition.parametros.filter(p => p.filtrable !== false)" 
              :key="param.clave"
            >
              <!-- Caso A: Número Decimal con Tolerancia Específica / Universal -->
              <template v-if="param.tipo_dato === 'numero'">
                <div class="flex items-center justify-between mb-0.5">
                  <label class="block text-[10px] font-bold text-slate-600 truncate">
                    {{ param.etiqueta }} 
                    <span v-if="param.unidad" class="text-slate-400 font-normal">({{ param.unidad }})</span>
                  </label>
                  <ToleranceBadge v-model="filterTolerancias[param.clave]" :fallback="filterToleranciaMm" :unit="param.unidad || 'mm'" />
                </div>
                <input
                  v-model.number="dynamicParamFilters[param.clave]"
                  type="number"
                  step="0.1"
                  :placeholder="`ej. 50 ${param.unidad || ''}`"
                  class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </template>

              <!-- Caso B: Menú Desplegable / Cascada de Selección (ej. Admisión / Escape, IN / EX) -->
              <template v-else-if="param.tipo_dato === 'seleccion' || (param.opciones && param.opciones.length > 0)">
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5 truncate">
                  {{ param.etiqueta }}
                </label>
                <select
                  v-model="dynamicParamFilters[param.clave]"
                  class="w-full px-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="">Todas las opciones</option>
                  <option v-for="opt in (param.opciones || [])" :key="opt" :value="opt">
                    {{ opt }}
                  </option>
                </select>
              </template>

              <!-- Caso C: Texto libre -->
              <template v-else>
                <label class="block text-[10px] font-bold text-slate-600 mb-0.5 truncate">
                  {{ param.etiqueta }}
                </label>
                <input
                  v-model="dynamicParamFilters[param.clave]"
                  type="text"
                  placeholder="Filtrar..."
                  class="w-full px-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </template>
            </div>
          </div>
        </div>

        <!-- Buscador de texto y filtro por catálogo -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div class="relative w-full sm:w-72">
            <input
              v-model="tableSearchFilter"
              type="text"
              placeholder="Filtrar en esta tabla..."
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
            />
            <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>

          <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <!-- Conversor instantáneo mm <-> milésimas (÷ 25.4) -->
            <div
              class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs"
              title="Convertir cotas entre milímetros y pulgadas / milésimas (mm ÷ 25.4)"
            >
              <button
                type="button"
                @click="unitMode = 'mm'"
                :class="[
                  'px-2 py-0.5 rounded-md text-[11px] font-black transition cursor-pointer',
                  unitMode === 'mm' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                ]"
              >
                mm
              </button>
              <button
                type="button"
                @click="unitMode = 'milesimas'"
                :class="[
                  'px-2 py-0.5 rounded-md text-[11px] font-black transition cursor-pointer',
                  unitMode === 'milesimas' ? 'bg-[#004B97] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                ]"
              >
                milésimas (÷25.4)
              </button>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="text-xs text-slate-500 font-medium">Catálogo:</span>
              <select
                v-model="tableBrandFilter"
                class="px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
              >
                <option value="Todas las marcas">Todas las marcas</option>
                <option value="Rik">Rik</option>
                <option value="NPR">NPR</option>
                <option value="MRK">MRK</option>
                <option value="Ajusa">Ajusa</option>
                <option value="NDC">NDC</option>
                <option value="Pioneer">Pioneer</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      <!-- TABLA TÉCNICA DE REPUESTOS EN FORMATO MATRIZ (MINIMALISTA) -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        
        <div class="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between text-xs font-bold">
          <span class="flex items-center gap-1.5">
            <span>{{ selectedComponent?.title || 'Piezas Técnicas' }}</span>
            <span class="font-normal text-slate-400 font-mono text-[11px]">({{ displayedParts.length }} registros)</span>
          </span>
          <span v-if="selectedMotor" class="font-mono text-[#04C4D9] text-[11px]">
            MOTOR {{ selectedMotor.codigo }}
          </span>
          <span v-else-if="selectedBrand" class="font-mono text-[#04C4D9] uppercase text-[11px]">
            {{ selectedBrand.nombre }}
          </span>
          <span v-else class="font-mono text-slate-400 text-[11px]">
            TODOS LOS MOTORES
          </span>
        </div>

        <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table class="w-full text-left text-xs border-separate border-spacing-0">
            <!-- Caso A: Cabecera con Sub-columnas Anidadas de 2 Niveles -->
            <thead v-if="hasGroupSubcolumns" class="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th
                  v-if="isCurrentGroupSubfilas && currentGroupHasRowGroups"
                  rowspan="2"
                  class="py-1.5 px-2.5 text-center whitespace-nowrap align-middle border-b border-r border-slate-200 bg-cyan-50/70 text-[#004B97] font-black"
                >
                  {{ currentGroupDefinition?.tabla_config?.titulo_grupo_filas || 'Grupo' }}
                </th>
                <th rowspan="2" class="py-1.5 px-3 whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95" :class="isCurrentGroupSubfilas ? 'w-28 text-center' : 'w-44 min-w-[150px]'">
                  {{ isCurrentGroupSubfilas ? (currentGroupDefinition?.tabla_config?.titulo_primera_columna || 'Componente') : 'Componente' }}
                </th>
                <th rowspan="2" class="py-1.5 px-2.5 w-28 min-w-[95px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Código OEM
                </th>
                <th v-if="!isCurrentGroupSubfilas" rowspan="2" class="py-1.5 px-2.5 w-36 min-w-[130px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Catálogos Alternos
                </th>
                
                <!-- Columnas Padre / Standalone de la Familia -->
                <template v-for="item in groupSubcolumnsHeaders.tier1" :key="item.id">
                  <th 
                    v-if="item.isGroup"
                    :colspan="item.colspan"
                    class="py-1 px-2.5 text-center font-black text-[#004B97] bg-blue-50/90 border-b border-r border-slate-200 tracking-wider text-[11px]"
                  >
                    {{ item.label }}
                  </th>
                  <th 
                    v-else
                    rowspan="2"
                    class="py-1.5 px-2.5 text-center align-middle font-bold text-slate-700 border-b border-r border-slate-200 bg-slate-100/95 whitespace-nowrap"
                  >
                    {{ item.label }}
                  </th>
                </template>

                <th rowspan="2" class="py-1.5 px-3 w-24 text-right whitespace-nowrap align-middle border-b border-slate-200 bg-slate-100/95">Acciones</th>
              </tr>
              <!-- Fila 2 de Cabecera: Sub-columnas -->
              <tr class="bg-slate-50 text-[9px] text-slate-600 font-bold uppercase tracking-tight">
                <th 
                  v-for="sub in groupSubcolumnsHeaders.tier2"
                  :key="sub.id"
                  class="py-1 px-2 text-center border-b border-r border-slate-200 whitespace-nowrap bg-slate-50 font-mono"
                >
                  <span>{{ sub.label }}</span>
                  <span v-if="sub.unidad" class="text-[8px] text-slate-400 font-normal ml-0.5">({{ unitMode === 'milesimas' && sub.unidad === 'mm' ? 'pulg' : sub.unidad }})</span>
                </th>
              </tr>
            </thead>

            <!-- Caso B: Cabecera Estándar (o Tabla Unificada plana sin sub-columnas) -->
            <thead v-else class="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th
                  v-if="isCurrentGroupSubfilas && currentGroupHasRowGroups"
                  class="py-1.5 px-2.5 text-center whitespace-nowrap align-middle border-b border-r border-slate-200 bg-cyan-50/70 text-[#004B97] font-black"
                >
                  {{ currentGroupDefinition?.tabla_config?.titulo_grupo_filas || 'Grupo' }}
                </th>
                <th class="py-1.5 px-3 whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95" :class="isCurrentGroupSubfilas ? 'w-32 text-left' : 'w-44 min-w-[150px]'">
                  {{ isCurrentGroupSubfilas ? (currentGroupDefinition?.tabla_config?.titulo_primera_columna || 'Componente') : 'Componente' }}
                </th>
                <th class="py-1.5 px-2.5 w-28 min-w-[95px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Código OEM
                </th>
                <th v-if="!isCurrentGroupSubfilas" class="py-1.5 px-2.5 w-36 min-w-[130px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Catálogos Alternos
                </th>
                
                <template v-if="isCurrentGroupSubfilas">
                  <th
                    v-for="col in activeTableGroupColumns"
                    :key="`th-sub-flat-${col.id}`"
                    class="py-1.5 px-2 text-center whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95"
                  >
                    {{ col.etiqueta_corta || col.etiqueta }}
                    <span v-if="col.unidad" class="text-[8px] font-normal text-slate-400 lowercase ml-0.5">({{ unitMode === 'milesimas' && col.unidad === 'mm' ? 'pulg' : col.unidad }})</span>
                  </th>
                </template>
                <th v-else-if="isCurrentGroupRingsTable" class="py-1.5 px-3 min-w-[260px] whitespace-nowrap align-middle border-b border-slate-200 bg-slate-100/95">
                  {{ (selectedComponent?.title || 'MEDIDAS').toUpperCase() }}: {{ [showTableColDiametro ? tableColDiametroHeader : null, showTableColGrosor ? tableColGrosorHeader : null, showTableColAltura ? tableColAlturaHeader : null].filter(Boolean).join(' / ') || 'Especificaciones' }}
                </th>
                <th v-else-if="currentGroupDefinition?.tipo_vista === 'tabla'" class="py-1.5 px-3 min-w-[260px] whitespace-nowrap align-middle border-b border-slate-200 bg-slate-100/95">
                  {{ (selectedComponent?.title || 'MEDIDAS').toUpperCase() }}: {{ activeTableGroupColumns.map(c => c.etiqueta_corta || c.etiqueta).join(' / ') || 'Especificaciones' }}
                </th>
                <th v-else-if="currentGroupDefinition?.parametros && currentGroupDefinition.parametros.length > 0" class="py-1.5 px-3 whitespace-nowrap align-middle border-b border-slate-200 bg-slate-100/95">
                  {{ (selectedComponent?.title || selectedComponent?.category || 'COTAS').toUpperCase() }}: {{ currentGroupDefinition.parametros.filter(p => p.requerido).map(p => p.etiqueta_corta || p.etiqueta).join(' × ') || currentGroupDefinition.parametros.map(p => p.etiqueta_corta || p.etiqueta).slice(0, 4).join(' × ') }}
                </th>
                <th v-else class="py-1.5 px-3 whitespace-nowrap align-middle border-b border-slate-200 bg-slate-100/95">
                  Especificaciones Técnicas (mm)
                </th>

                <th class="py-1.5 px-3 w-24 text-right whitespace-nowrap align-middle border-b border-slate-200 bg-slate-100/95">Acciones</th>
              </tr>
            </thead>

            <!-- Skeleton loading de repuestos -->
            <tbody v-if="catalogStore.loadingRepuestos || catalogStore.isSearching" class="divide-y divide-slate-100">
              <tr v-for="n in 5" :key="`skel-rep-${n}`" class="animate-pulse bg-slate-50/50">
                <td v-if="isCurrentGroupSubfilas && currentGroupHasRowGroups" class="py-2 px-2.5 border-b border-slate-100"><div class="h-3.5 w-16 mx-auto bg-slate-200 rounded"></div></td>
                <td class="py-2 px-3 border-b border-slate-100"><div class="h-3.5 w-28 bg-slate-200 rounded"></div></td>
                <td class="py-2 px-2.5 border-b border-slate-100"><div class="h-3.5 w-20 bg-slate-200 rounded"></div></td>
                <td v-if="!isCurrentGroupSubfilas" class="py-2 px-2.5 border-b border-slate-100"><div class="h-3.5 w-24 bg-slate-200 rounded"></div></td>
                <template v-if="hasGroupSubcolumns || isCurrentGroupSubfilas">
                  <td v-for="col in activeTableGroupColumns" :key="`skel-col-${col.id}`" class="py-2 px-2 border-b border-slate-100"><div class="h-3.5 w-12 mx-auto bg-slate-200 rounded"></div></td>
                </template>
                <td v-else class="py-2 px-3 border-b border-slate-100"><div class="h-3.5 w-36 bg-slate-200 rounded"></div></td>
                <td class="py-2 px-3 text-right border-b border-slate-100"><div class="h-3.5 w-14 bg-slate-200 rounded ml-auto"></div></td>
              </tr>
            </tbody>

            <tbody v-else class="divide-y divide-slate-100">
              <template v-for="part in paginatedParts" :key="part.id">
                <!-- CASO A: Matriz Unificada con Sub-filas y Uniones Centrales -->
                <template v-if="isPartSubfilasFormat(part)">
                  <!-- Cabecera de repuesto con banner de marca (cuando aplica) -->
                  <tr
                    v-if="currentGroupDefinition?.tabla_config?.tiene_cabecera_marca || (part.dimensiones as any)?.marca_banner"
                    class="bg-sky-50/60 border-t-2 border-slate-300 font-sans"
                  >
                    <td class="py-1.5 px-3 border-b border-r border-slate-200 text-center font-black uppercase text-[#004B97] bg-sky-100/70 tracking-wider text-xs whitespace-nowrap">
                      {{ (part.dimensiones as any)?.marca_banner || (part.especificaciones_tecnicas as any)?.marca || (selectedMotor?.fabricante_id ? getBrandName(selectedMotor.fabricante_id) : 'Pieza') }}
                    </td>
                    <td :colspan="activeTableGroupColumns.length + (currentGroupHasRowGroups ? 2 : 1)" class="py-1.5 px-3 border-b border-r border-slate-200 font-sans text-xs">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-extrabold text-slate-900">{{ (part.dimensiones as any)?.aplicacion_banner || part.nombre }}</span>
                          <span v-if="part.motor?.codigo" class="px-1.5 py-0.5 rounded bg-white text-slate-700 text-[10px] font-mono font-bold border border-slate-200">
                            {{ part.motor.codigo }}
                          </span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span v-if="(part.dimensiones as any)?.sobremedidas || (part.dimensiones as any)?.notas_banner" class="text-[10px] font-mono font-bold text-[#004B97] bg-white px-2 py-0.5 rounded border border-cyan-200">
                            {{ (part.dimensiones as any)?.sobremedidas || (part.dimensiones as any)?.notas_banner }}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="py-1.5 px-3 text-right border-b border-slate-200 whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          @click="openTechnicalSheet(part)"
                          class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Ver ficha técnica"
                        >
                          <Eye class="w-3 h-3 text-[#004B97]" />
                          <span>Ficha</span>
                        </button>
                        <button
                          type="button"
                          @click="handleEditPart(part)"
                          class="px-2.5 py-0.5 rounded bg-[#004B97] hover:bg-blue-900 text-white text-[10px] font-extrabold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Modificar especificaciones de este repuesto"
                        >
                          <Edit3 class="w-3 h-3 text-cyan-300" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Cabecera sutil del conjunto (sin banner de marca forzado) -->
                  <tr v-else class="bg-slate-50/90 border-t-2 border-slate-200 font-sans">
                    <td
                      :colspan="activeTableGroupColumns.length + (currentGroupHasRowGroups ? 3 : 2)"
                      class="py-1.5 px-3 border-b border-r border-slate-200 text-left text-xs"
                    >
                      <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-extrabold text-slate-900">{{ part.nombre }}</span>
                          <span
                            v-if="(part.especificaciones_tecnicas as any)?.marca || (selectedMotor?.fabricante_id ? getBrandName(selectedMotor.fabricante_id) : '')"
                            class="px-1.5 py-0.5 rounded bg-white text-[#004B97] text-[10px] font-bold border border-slate-200 uppercase"
                          >
                            {{ (part.especificaciones_tecnicas as any)?.marca || (selectedMotor?.fabricante_id ? getBrandName(selectedMotor.fabricante_id) : '') }}
                          </span>
                          <span
                            v-if="part.motor?.codigo"
                            class="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-mono font-bold"
                          >
                            {{ part.motor.codigo }}
                          </span>
                        </div>
                        <span
                          v-if="(part.dimensiones as any)?.aplicacion_banner || (part.dimensiones as any)?.sobremedidas || (part.dimensiones as any)?.notas_banner"
                          class="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200"
                        >
                          {{ (part.dimensiones as any)?.aplicacion_banner || (part.dimensiones as any)?.sobremedidas || (part.dimensiones as any)?.notas_banner }}
                        </span>
                      </div>
                    </td>
                    <td class="py-1.5 px-3 text-right border-b border-slate-200 whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          @click="openTechnicalSheet(part)"
                          class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Ver ficha técnica"
                        >
                          <Eye class="w-3 h-3 text-[#004B97]" />
                          <span>Ficha</span>
                        </button>
                        <button
                          type="button"
                          @click="handleEditPart(part)"
                          class="px-2.5 py-0.5 rounded bg-[#004B97] hover:bg-blue-900 text-white text-[10px] font-extrabold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Modificar especificaciones de este repuesto"
                        >
                          <Edit3 class="w-3 h-3 text-cyan-300" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Sub-filas del repuesto y uniones centrales -->
                  <tr
                    v-for="(sf, sfIdx) in getPartSubfilas(part)"
                    :key="`sf-${part.id}-${sfIdx}`"
                    class="hover:bg-slate-50/80 transition font-mono text-xs border-b border-slate-100"
                  >
                    <!-- Columna central agrupadora de filas (rowspan) -->
                    <td
                      v-if="currentGroupHasRowGroups && getPartSubfilaRowSpans(part)[sfIdx]?.show"
                      :rowspan="getPartSubfilaRowSpans(part)[sfIdx]?.rowspan"
                      class="py-2 px-2.5 border-r border-slate-200 bg-cyan-50/35 text-center align-middle font-black text-[#004B97] uppercase text-[10px] tracking-wider"
                    >
                      {{ getPartSubfilaRowSpans(part)[sfIdx]?.label || '—' }}
                    </td>

                    <!-- Col 1: Nombre de la Sub-fila -->
                    <td class="py-2 px-3 border-r border-slate-200 font-bold text-slate-800 text-left bg-slate-50/50">
                      <div class="flex items-center gap-1.5">
                        <span
                          class="w-2 h-2 rounded-full shrink-0"
                          :class="sfIdx === 0 ? 'bg-[#004B97]' : (sfIdx === 1 ? 'bg-[#04C4D9]' : 'bg-slate-400')"
                        ></span>
                        <span class="font-black">{{ sf.nombre }}</span>
                      </div>
                    </td>

                    <!-- Col 2: Código específico de esta sub-fila -->
                    <td class="py-2 px-2.5 border-r border-slate-200 font-mono font-bold text-slate-900">
                      <div class="flex items-center gap-1">
                        <span>{{ sf.codigo || part.codigo_oem || '—' }}</span>
                        <button
                          v-if="sf.codigo || part.codigo_oem"
                          type="button"
                          @click.stop="copyToClipboard(sf.codigo || part.codigo_oem, sf.nombre)"
                          class="p-0.5 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                        >
                          <Copy class="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    <!-- Columnas de Maquinado / Opciones con Color por Posición -->
                    <td
                      v-for="col in activeTableGroupColumns"
                      :key="`td-sf-${part.id}-${sfIdx}-${col.id}`"
                      class="py-2 px-2 text-center border-r border-slate-100 font-mono font-bold"
                    >
                      <span
                        v-if="col.tipo_dato === 'seleccion' && getPartSubfilaRawValue(sf, col)"
                        class="inline-flex items-center px-2 py-0.5 rounded-md border font-sans font-extrabold text-[11px]"
                        :class="resolveOptionBadgeClass(String(getPartSubfilaRawValue(sf, col)), col.opciones)"
                      >
                        {{ getPartSubfilaValue(sf, col) }}
                      </span>
                      <template v-else>
                        {{ getPartSubfilaValue(sf, col) }}
                      </template>
                    </td>

                    <!-- Botón específico + A Orden por sub-fila -->
                    <td class="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        @click="addSubfilaToWorkOrder(part, sf)"
                        class="px-2.5 py-1 rounded text-[10px] font-extrabold transition shadow-2xs border cursor-pointer whitespace-nowrap"
                        :class="addedPartId === `${part.id}-${sf.nombre}`
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-cyan-50 border-cyan-300 text-[#038391] hover:bg-cyan-100'"
                        :title="`Agregar solo ${sf.nombre} a la Orden`"
                      >
                        {{ addedPartId === `${part.id}-${sf.nombre}` ? '✓ OK' : `+ ${sf.nombre}` }}
                      </button>
                    </td>
                  </tr>
                </template>

                <!-- CASO B: Fila estándar de repuesto (Existente) -->
                <tr
                  v-else
                  class="hover:bg-slate-50 transition group"
                >
                <!-- 1. Componente con Miniatura Técnica y Lightbox -->
                <td class="py-2 px-3 align-middle border-b border-slate-100">
                  <div class="flex items-center gap-2.5">
                    <!-- Miniatura técnica interactiva -->
                    <div
                      class="relative w-11 h-11 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 transition"
                      :class="part.imagen_url ? 'cursor-pointer hover:ring-2 hover:ring-[#04C4D9] group/thumb bg-white shadow-2xs' : ''"
                      @click="part.imagen_url && openLightbox(part)"
                      :title="part.imagen_url ? 'Clic para ampliar diagrama / imagen técnica' : 'Sin diagrama cargado'"
                    >
                      <img
                        v-if="part.imagen_url"
                        :src="part.imagen_url"
                        :alt="part.nombre"
                        class="w-full h-full object-cover transition duration-200 group-hover/thumb:scale-110"
                        loading="lazy"
                      />
                      <span v-else class="p-1 text-slate-400 group-hover:text-slate-600 transition">
                        <CircleDot v-if="selectedComponent?.id === 'ajuste_valvula' || part.categoria === 'Sellos'" class="w-4 h-4" />
                        <Wrench v-else-if="selectedComponent?.id === 'valvula' || part.categoria === 'Válvulas'" class="w-4 h-4" />
                        <Layers v-else-if="selectedComponent?.id === 'anillos_motor' || part.categoria === 'Anillos'" class="w-4 h-4" />
                        <FileText v-else-if="selectedComponent?.id === 'tornillos_culata' || part.categoria === 'Pernos'" class="w-4 h-4" />
                        <CircleDot v-else-if="selectedComponent?.id === 'casqueteria' || part.categoria === 'Casquetería'" class="w-4 h-4" />
                        <Layers v-else-if="selectedComponent?.id === 'empaques_juntas' || part.categoria === 'Empaques'" class="w-4 h-4" />
                        <Wrench v-else-if="selectedComponent?.id === 'guias_valvula' || part.categoria === 'Guías'" class="w-4 h-4" />
                        <CircleDot v-else-if="selectedComponent?.id === 'asientos_valvula' || part.categoria === 'Asientos'" class="w-4 h-4" />
                        <Layers v-else class="w-4 h-4" />
                      </span>

                      <!-- Overlay de zoom en hover cuando hay imagen -->
                      <div
                        v-if="part.imagen_url"
                        class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition duration-150"
                      >
                        <Maximize2 class="w-3.5 h-3.5 text-white drop-shadow" />
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span 
                          v-if="getPartCatalogBrand(part)"
                          class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                          :class="getBrandBadgeClass(getPartCatalogBrand(part))"
                        >
                          {{ getPartCatalogBrand(part) }}
                        </span>
                        <div class="font-bold text-slate-900 text-xs leading-tight">
                          {{ part.nombre }}
                        </div>
                      </div>

                      <!-- Badges de vehículo, año y cilindros (Información técnica estilo Dokuro / TecDoc) -->
                      <div 
                        v-if="(part.especificaciones_tecnicas as any)?.vehiculo || (part.especificaciones_tecnicas as any)?.ano || (part.especificaciones_tecnicas as any)?.cilindros"
                        class="flex flex-wrap items-center gap-1 mt-1 text-[10px]"
                      >
                        <span 
                          v-if="(part.especificaciones_tecnicas as any)?.vehiculo"
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200"
                          title="Modelo de vehículo y aplicación técnica"
                        >
                          {{ (part.especificaciones_tecnicas as any).vehiculo }}
                        </span>
                        <span 
                          v-if="(part.especificaciones_tecnicas as any)?.ano && (part.especificaciones_tecnicas as any)?.ano !== '—'"
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200"
                          title="Años de aplicación"
                        >
                          {{ (part.especificaciones_tecnicas as any).ano }}
                        </span>
                        <span 
                          v-if="(part.especificaciones_tecnicas as any)?.cilindros"
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200 font-mono"
                          title="Cantidad de cilindros"
                        >
                          {{ (part.especificaciones_tecnicas as any).cilindros }}
                        </span>
                      </div>

                      <span class="text-[10px] font-semibold text-slate-400 uppercase mt-0.5 block">
                        <span v-if="part.motor?.fabricante?.nombre || (part.motor?.fabricante_id && getBrandName(part.motor.fabricante_id)) || ((part.especificaciones_tecnicas as any)?.fabricantes && (part.especificaciones_tecnicas as any).fabricantes[0])" class="text-slate-600 font-bold mr-1">
                          {{ part.motor?.fabricante?.nombre || (part.motor?.fabricante_id ? getBrandName(part.motor.fabricante_id) : undefined) || (part.especificaciones_tecnicas as any).fabricantes[0] }} •
                        </span>
                        {{ part.subsistema }}
                        <span v-if="part.motor?.codigo || ((part.especificaciones_tecnicas as any)?.motores_compatibles && (part.especificaciones_tecnicas as any).motores_compatibles.length > 0)">
                          • Motor {{ part.motor?.codigo || (part.especificaciones_tecnicas as any).motores_compatibles.join('/') }}
                        </span>
                        <span v-if="getPartCatalogBrand(part)" class="text-slate-500 font-bold">
                          • Catálogo {{ getPartCatalogBrand(part) }}
                        </span>
                      </span>
                    </div>
                  </div>
                </td>

                <!-- 2. Código OEM / Principal de Catálogo (Soporta múltiples códigos OEM originales) -->
                <td class="py-2 px-2.5 align-middle border-b border-slate-100">
                  <div class="flex flex-col gap-1">
                    <!-- Código Principal -->
                    <div class="flex items-center gap-1 flex-wrap">
                      <span 
                        v-if="getPartCatalogBrand(part) === 'DOKURO' || part.catalogo_origen?.toLowerCase() === 'dokuro' || (part.especificaciones_tecnicas as any)?.marca_catalogo === 'DOKURO'"
                        class="px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300"
                        title="Código oficial del catálogo Dokuro"
                      >
                        DOKURO
                      </span>
                      <span 
                        v-else-if="getPartCatalogBrand(part) === 'MRK' || part.catalogo_origen?.toLowerCase() === 'mrk' || (part.especificaciones_tecnicas as any)?.marca_catalogo === 'MRK' || (part.especificaciones_tecnicas as any)?.codigo_mrk"
                        class="px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-300"
                        title="Código oficial del catálogo MRK"
                      >
                        MRK
                      </span>
                      <span 
                        v-else-if="getPartCatalogBrand(part) === 'RIK' || part.catalogo_origen?.toLowerCase() === 'rik' || (part.especificaciones_tecnicas as any)?.marca_catalogo?.toUpperCase() === 'RIK' || (part.especificaciones_tecnicas as any)?.codigo_rik || part.codigo_oem?.startsWith('RIK-') || part.nombre?.includes('RIK')"
                        class="px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300"
                        title="Código oficial del catálogo RIK"
                      >
                        RIK
                      </span>
                      <span 
                        v-else-if="getPartCatalogBrand(part) === 'NPR' || part.catalogo_origen?.toLowerCase() === 'npr' || (part.especificaciones_tecnicas as any)?.marca_catalogo?.toUpperCase() === 'NPR' || (part.especificaciones_tecnicas as any)?.codigo_npr || part.codigo_oem?.startsWith('NPR-') || part.nombre?.includes('NPR')"
                        class="px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300"
                        title="Código oficial del catálogo NPR"
                      >
                        NPR
                      </span>
                      <span 
                        v-else-if="getPartCatalogBrand(part) === 'AJUSA' || part.catalogo_origen?.toLowerCase() === 'ajusa' || (part.especificaciones_tecnicas as any)?.marca_catalogo?.toUpperCase() === 'AJUSA' || (part.especificaciones_tecnicas as any)?.codigo_ajusa"
                        class="px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#0f2d59] text-white border border-blue-950"
                        title="Código oficial del catálogo Ajusa"
                      >
                        AJUSA
                      </span>
                      <!-- Cuadritos independientes para cada código OEM (mismo color para todos) -->
                      <div v-if="getPartOemCodes(part).length > 0" class="flex flex-wrap items-center gap-1.5">
                        <div
                          v-for="oemCode in getPartOemCodes(part)"
                          :key="`table-oem-${part.id}-${oemCode}`"
                          class="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200/80 hover:border-slate-300 transition shadow-2xs"
                          :title="`Código OEM: ${oemCode}`"
                        >
                          <span>{{ oemCode }}</span>
                          <button
                            type="button"
                            @click.stop="copyToClipboard(oemCode, 'OEM')"
                            class="p-0.5 text-slate-400 hover:text-slate-800 rounded transition"
                            :title="`Copiar código ${oemCode}`"
                          >
                            <Check v-if="copiedCode === oemCode" class="w-3.5 h-3.5 text-emerald-600" />
                            <Copy v-else class="w-3.5 h-3.5 hover:text-slate-700" />
                          </button>
                        </div>
                      </div>

                      <span v-else class="text-xs text-slate-400 font-mono italic">
                        {{ part.codigo_oem || '—' }}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- 3. Códigos Alternos por Catálogo -->
                <td class="py-2 px-2.5 align-middle border-b border-slate-100">
                  <div class="flex flex-wrap gap-1">
                    <template v-if="getPartEquivalencias(part).length > 0">
                      <span
                        v-for="eq in getPartEquivalencias(part)"
                        :key="eq.id"
                        @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                        :class="[
                          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono cursor-pointer transition hover:opacity-80',
                          getBrandBadgeClass(eq.marca_alterna)
                        ]"
                        :title="`Clic para copiar código ${eq.marca_alterna}`"
                      >
                        <span class="font-sans text-[9px] uppercase opacity-90">{{ eq.marca_alterna }}:</span>
                        <strong>{{ eq.codigo_alterno }}</strong>
                      </span>
                    </template>
                    <span v-else class="text-[10px] text-slate-400 italic">
                      Sin cruces
                    </span>
                  </div>
                </td>

                <!-- 4. MEDIDAS Y COTAS (Modo Sub-columnas Anidadas o formato estándar) -->
                <template v-if="hasGroupSubcolumns">
                  <td 
                    v-for="col in activeTableGroupColumns" 
                    :key="`td-subcol-${part.id}-${col.id}`"
                    class="py-2 px-2 text-center align-middle border-b border-r border-slate-100 font-mono font-bold text-xs"
                    :class="getMeasurementMatchClass(getPartParamValue(part, col.clave), dynamicParamFilters[col.clave], getTol(col.clave))"
                  >
                    <span
                      v-if="col.tipo_dato === 'seleccion' && getPartParamValue(part, col.clave)"
                      class="inline-flex items-center px-2 py-0.5 rounded-md border font-sans font-extrabold text-[11px]"
                      :class="resolveOptionBadgeClass(String(getPartParamValue(part, col.clave)), col.opciones)"
                    >
                      {{ formatPartParamColValue(getPartParamValue(part, col.clave), col) }}
                    </span>
                    <template v-else>
                      {{ formatPartParamColValue(getPartParamValue(part, col.clave), col) }}
                    </template>
                  </td>
                </template>

                <td v-else class="py-2 px-3 align-middle border-b border-slate-100">
                  
                  <!-- Caso Especializado: Familias en Tabla / Anillos de motor (Sincronizado con Gestor de Familias) -->
                  <div v-if="isPartTableFormat(part)" class="py-1">
                    <div class="inline-block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs font-mono select-text">
                      <table class="border-collapse text-center text-xs">
                        <thead>
                          <tr class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <th class="px-2.5 py-1 border-r border-slate-200 text-left">{{ tableColFirstHeader }}</th>

                            <!-- Si es la familia clásica de anillos de motor -->
                            <template v-if="isCurrentGroupRingsTable">
                              <th v-if="showTableColDiametro" class="px-2.5 py-1 border-r border-slate-200">{{ tableColDiametroHeader }}</th>
                              <th v-if="showTableColGrosor" class="px-2.5 py-1 border-r border-slate-200">{{ tableColGrosorHeader }}</th>
                              <th v-if="showTableColAltura" class="px-2.5 py-1">{{ tableColAlturaHeader }}</th>
                            </template>

                            <!-- Si es cualquier otra familia general en tabla / matriz -->
                            <template v-else>
                              <th
                                v-for="(col, cIdx) in activeTableGroupColumns"
                                :key="`gen-col-${cIdx}`"
                                class="px-2.5 py-1"
                                :class="cIdx < activeTableGroupColumns.length - 1 ? 'border-r border-slate-200' : ''"
                              >
                                {{ col.etiqueta_corta || col.etiqueta }}
                                <span v-if="col.unidad" class="text-[8px] font-normal text-slate-500 lowercase">({{ col.unidad }})</span>
                              </th>
                            </template>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-[11px]">
                          <tr
                            v-for="(ring, rIdx) in getPartRingsList(part)"
                            :key="rIdx"
                            class="hover:bg-slate-50/70 transition"
                          >
                            <td class="px-2.5 py-1 bg-slate-50/70 font-bold text-slate-700 border-r border-slate-200 text-left whitespace-nowrap">
                              <span>{{ ring.posicion }}</span>
                              <span
                                v-if="tableShowIdentifier && (ring.identificador || (ring.perfil && ring.perfil !== 'Plano' && ring.perfil !== 'Estándar') || (isCurrentGroupRingsTable && rIdx === 0 && isPartConical(part)))"
                                class="ml-1 text-[9px] px-1 py-0.2 rounded font-extrabold border uppercase tracking-tight"
                                :class="(ring.perfil && (ring.perfil.toLowerCase().includes('cónico') || ring.perfil.toLowerCase().includes('conico') || ring.perfil.toLowerCase().includes('keystone'))) || (isCurrentGroupRingsTable && rIdx === 0 && isPartConical(part))
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-cyan-50 text-[#038391] border-cyan-300'"
                                :title="ring.identificador || ring.perfil || (isCurrentGroupRingsTable ? getKeystoneLabel(part) : undefined) || 'Identificador de fila'"
                              >
                                {{ ring.identificador || (ring.perfil ? (ring.perfil.includes('Keystone') ? (currentGroupDefinition?.tabla_config?.etiqueta_identificador || 'Cónico') : ring.perfil) : (currentGroupDefinition?.tabla_config?.etiqueta_identificador || 'Cónico')) }}
                              </span>
                            </td>

                            <!-- Columnas para Anillos -->
                            <template v-if="isCurrentGroupRingsTable">
                              <td 
                                v-if="showTableColDiametro"
                                class="px-2.5 py-1 border-r border-slate-200 font-mono font-bold transition"
                                :class="getRingDiametroCellClass(ring.d1)"
                              >
                                {{ formatRingVal(ring.d1) }}
                              </td>
                              <td 
                                v-if="showTableColGrosor"
                                class="px-2.5 py-1 border-r border-slate-200 font-mono font-bold transition"
                                :class="getRingGrosorCellClass(ring, rIdx, getPartRingsList(part).length)"
                              >
                                {{ formatRingVal(ring.h1) }}
                              </td>
                              <td 
                                v-if="showTableColAltura"
                                class="px-2.5 py-1 font-mono font-bold transition"
                                :class="getRingAlturaCellClass(ring, rIdx, getPartRingsList(part).length)"
                              >
                                {{ formatRingVal(ring.a1) }}
                              </td>
                            </template>

                            <!-- Columnas para cualquier otra familia en tabla general -->
                            <template v-else>
                              <td
                                v-for="(col, cIdx) in activeTableGroupColumns"
                                :key="`gen-val-${cIdx}`"
                                class="px-2.5 py-1 font-mono font-bold transition text-slate-900"
                                :class="[
                                  cIdx < activeTableGroupColumns.length - 1 ? 'border-r border-slate-200' : '',
                                  getMeasurementMatchClass(getGeneralTableRowValue(ring, col.clave) as any, dynamicParamFilters[col.clave], getTol(col.clave))
                                ]"
                              >
                                <span
                                  v-if="col.tipo_dato === 'seleccion' && getGeneralTableRowValue(ring, col.clave)"
                                  class="inline-flex items-center px-1.5 py-0.2 rounded border font-sans font-extrabold text-[10px]"
                                  :class="resolveOptionBadgeClass(String(getGeneralTableRowValue(ring, col.clave)), col.opciones)"
                                >
                                  {{ formatGeneralTableRowValue(ring, col) }}
                                </span>
                                <template v-else>
                                  {{ formatGeneralTableRowValue(ring, col) }}
                                </template>
                              </td>
                            </template>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- Caso Dinámico General: Todas las familias consultan parámetros técnicos de Supabase / Store -->
                  <div 
                    v-else-if="currentGroupDefinition?.parametros && currentGroupDefinition.parametros.length > 0" 
                    class="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-800"
                  >
                    <template 
                      v-for="p in currentGroupDefinition.parametros.filter(p => p.requerido)" 
                      :key="p.clave"
                    >
                      <!-- Caso A: Posición / Tipo de Válvula / Selección -->
                      <span 
                        v-if="p.tipo_dato === 'seleccion' || p.clave === 'posicion' || p.clave === 'tipo_valvula' || p.clave === 'tipo'"
                        class="px-1.5 py-0.5 rounded border transition"
                        :class="getPositionOrTypeBadgeClass(getPartParamValue(part, p.clave), dynamicParamFilters[p.clave], p.opciones)"
                      >
                        {{ getPartParamValue(part, p.clave) || p.etiqueta_corta || p.etiqueta }}
                      </span>

                      <!-- Caso B: Parámetro Numérico con Unidad y Resaltado Verde / Amarillo -->
                      <span 
                        v-else-if="p.tipo_dato === 'numero' || (p.unidad && p.unidad !== '')"
                        class="px-1.5 py-0.5 rounded border text-[11px] transition inline-flex items-center gap-1"
                        :class="getMeasurementMatchClass(getPartParamValue(part, p.clave), dynamicParamFilters[p.clave], getTol(p.clave))"
                      >
                        <span class="text-slate-500 text-[10px] uppercase font-sans">{{ p.etiqueta_corta || p.etiqueta }}:</span>
                        <strong class="text-slate-900">
                          {{ getPartParamValue(part, p.clave) != null ? (unitMode === 'milesimas' && (!p.unidad || p.unidad === 'mm') ? formatPartParamColValue(getPartParamValue(part, p.clave), p) : `${getPartParamValue(part, p.clave)} ${p.unidad || ''}`.trim()) : '—' }}
                        </strong>
                      </span>

                      <!-- Caso C: Texto libre / Otro -->
                      <span 
                        v-else
                        class="px-1.5 py-0.5 rounded border text-[11px] transition inline-flex items-center gap-1"
                        :class="dynamicParamFilters[p.clave] ? (String(getPartParamValue(part, p.clave) || '').toLowerCase().includes(String(dynamicParamFilters[p.clave]).toLowerCase()) ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold ring-1 ring-amber-400/60 shadow-2xs' : 'bg-slate-100 text-slate-500 opacity-60') : 'bg-slate-100 text-slate-800 border-slate-200'"
                      >
                        <span class="text-slate-500 text-[10px] uppercase font-sans">{{ p.etiqueta_corta || p.etiqueta }}:</span>
                        <strong class="text-slate-900">{{ getPartParamValue(part, p.clave) || '—' }}</strong>
                      </span>
                    </template>
                  </div>

                  <!-- Caso Fallback: Sin parámetros definidos -->
                  <div v-else class="text-[11px] text-slate-500 font-mono">
                    {{ part.categoria }} • Ref: {{ part.subsistema || 'General' }}
                  </div>

                </td>

                <!-- 5. Acciones Rápidas -->
                <td class="py-2 px-3 align-middle text-right border-b border-slate-100">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      @click="openTechnicalSheet(part)"
                      class="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition flex items-center gap-1"
                      title="Ver ficha técnica"
                    >
                      <Eye class="w-3 h-3 text-slate-400" />
                      <span>Ficha</span>
                    </button>

                    <button
                      type="button"
                      @click="handleEditPart(part)"
                      class="px-2 py-1 rounded-md border border-slate-200 hover:bg-cyan-50 hover:border-cyan-200 text-slate-700 hover:text-[#038391] text-[11px] font-semibold transition flex items-center gap-1"
                      title="Modificar especificaciones y equivalencias de este repuesto"
                    >
                      <Edit3 class="w-3 h-3 text-[#04C4D9]" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      @click="addToWorkOrder(part)"
                      :class="[
                        'px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1',
                        addedPartId === part.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#04C4D9] hover:bg-[#03a9bc] text-white shadow-2xs'
                      ]"
                    >
                      <Check v-if="addedPartId === part.id" class="w-3 h-3" />
                      <Plus v-else class="w-3 h-3" />
                      <span>{{ addedPartId === part.id ? 'Listo' : 'A Orden' }}</span>
                    </button>
                  </div>
                </td>
              </tr>
            </template>

              <!-- Empty State -->
              <tr v-if="displayedParts.length === 0">
                <td colspan="5" class="py-10 text-center text-slate-400 bg-white">
                  <div class="max-w-sm mx-auto space-y-2">
                    <AlertCircle class="w-6 h-6 text-slate-300 mx-auto" />
                    <h4 class="text-xs font-bold text-slate-700">No hay repuestos coincidentes</h4>
                    <p class="text-[11px] text-slate-400">
                      No se encontraron piezas con las cotas o términos ingresados.
                    </p>
                    <div class="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        @click="resetMeasurementsFilters"
                        class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                      >
                        Limpiar Filtros
                      </button>
                      <button
                        type="button"
                        @click="openAddPartModal"
                        class="px-2.5 py-1 rounded-lg bg-[#04C4D9] text-white text-xs font-bold"
                      >
                        + Añadir Repuesto
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pie de Tabla con Paginación y Carga Eficiente de Repuestos -->
        <div class="bg-slate-50 py-2.5 px-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div class="flex items-center gap-3">
            <span class="text-[11px] text-slate-600 font-medium">
              Mostrando
              <strong class="font-mono text-slate-900">
                {{ displayedParts.length === 0 ? 0 : (currentPartsPage - 1) * (partsPerPage === -1 ? displayedParts.length : partsPerPage) + 1 }}-{{ Math.min(currentPartsPage * (partsPerPage === -1 ? displayedParts.length : partsPerPage), displayedParts.length) }}
              </strong>
              de
              <strong class="font-mono text-slate-900">{{ displayedParts.length }}</strong>
              registros
            </span>

            <!-- Controles de carga de más registros -->
            <div v-if="catalogStore.hasMoreRepuestos" class="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span class="text-[10px] text-slate-500 font-mono">
                ({{ catalogStore.repuestos.length }} de {{ catalogStore.totalRepuestosCount }})
              </span>
              <button
                type="button"
                @click="catalogStore.loadMoreRepuestos()"
                :disabled="catalogStore.isLoadingMore"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-[#004b97] hover:bg-sky-100 border border-sky-200 text-[11px] font-bold transition disabled:opacity-50"
                title="Cargar más repuestos"
              >
                <Loader2 v-if="catalogStore.isLoadingMore" class="w-3 h-3 animate-spin" />
                <Plus v-else class="w-3 h-3" />
                <span>+ Cargar más (+150)</span>
              </button>
              <button
                type="button"
                @click="catalogStore.loadAllRepuestos()"
                :disabled="catalogStore.isLoadingMore"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 text-[11px] font-semibold transition disabled:opacity-50"
                title="Cargar todos los registros restantes"
              >
                <span>Cargar todos</span>
              </button>
            </div>
          </div>

          <!-- Selector de filas por página y controles de paginación -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>Por pág:</span>
              <select
                v-model.number="partsPerPage"
                @change="currentPartsPage = 1"
                class="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#04C4D9]"
              >
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
                <option :value="-1">Todos</option>
              </select>
            </div>

            <div class="flex items-center gap-1">
              <span class="text-[11px] text-slate-500 mr-1.5 font-mono">
                Pág. {{ currentPartsPage }} / {{ partsTotalPages }}
              </span>

              <button
                type="button"
                @click="goToFirstPartsPage"
                :disabled="currentPartsPage === 1"
                class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                title="Primera página"
              >
                <ChevronsLeft class="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                @click="goToPrevPartsPage"
                :disabled="currentPartsPage === 1"
                class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                title="Página anterior"
              >
                <ChevronLeft class="w-3.5 h-3.5" />
              </button>

              <span class="px-2 font-mono font-bold text-slate-700 text-xs">
                {{ currentPartsPage }}
              </span>

              <button
                type="button"
                @click="goToNextPartsPage"
                :disabled="currentPartsPage === partsTotalPages"
                class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                title="Página siguiente"
              >
                <ChevronRight class="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                @click="goToLastPartsPage"
                :disabled="currentPartsPage === partsTotalPages"
                class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                title="Última página"
              >
                <ChevronsRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- MODAL 1: INFORMACIÓN TÉCNICA DEL MOTOR                                    -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="selectedMotorInfoModal" 
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="closeMotorInfo"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Info class="w-4 h-4 text-[#04C4D9]" />
              <h3 class="text-sm font-bold text-white">
                Ficha Motor: {{ getBrandName(selectedMotorInfoModal.fabricante_id) }} - {{ selectedMotorInfoModal.codigo }}
              </h3>
            </div>
            <button
              type="button"
              @click="closeMotorInfo"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-4 text-xs space-y-3 font-mono">
            <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">ID de Motor</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.numero_id || '—' }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Denominación</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.denominacion_venta || 'Estándar' }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Cilindrada</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.cilindrada_texto || `${selectedMotorInfoModal.cilindrada_cc} cc` }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Arquitectura</span>
                <strong class="text-slate-900"><template v-if="selectedMotorInfoModal.cilindros">{{ selectedMotorInfoModal.cilindros }} Cil<template v-if="selectedMotorInfoModal.valvulas"> / </template></template><template v-if="selectedMotorInfoModal.valvulas">{{ selectedMotorInfoModal.valvulas }}V</template></strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Potencia</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.kw || '—' }} kW ({{ selectedMotorInfoModal.cv || '—' }} CV)</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Combustible</span>
                <strong class="text-slate-900">{{ selectedMotorInfoModal.combustible }}</strong>
              </div>
            </div>

            <div class="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200/70 text-slate-700 text-xs">
              <div class="font-bold text-slate-900 mb-1 font-sans">Datos de Rectificación:</div>
              <ul class="space-y-1 text-[11px]">
                <li v-if="selectedMotorInfoModal.diametro_cilindro_std_mm">• Diámetro de Cilindro STD: <strong>{{ selectedMotorInfoModal.diametro_cilindro_std_mm }} mm</strong></li>
                <li>• Aspiración: <strong>{{ selectedMotorInfoModal.aspiracion || 'Natural' }}</strong></li>
              </ul>
            </div>
          </div>

          <div class="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              @click="closeMotorInfo"
              class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-100"
            >
              Cerrar
            </button>
            <button
              type="button"
              @click="handleSelectMotor(selectedMotorInfoModal); closeMotorInfo()"
              class="px-3.5 py-1.5 rounded-lg bg-[#04C4D9] hover:bg-[#03a9bc] text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <Check class="w-3.5 h-3.5" />
              <span>Seleccionar Motor</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL 2: FICHA TÉCNICA COMPLETA DE ARTÍCULO                               -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="isTechnicalModalOpen && modalPart" 
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        @click.self="closeTechnicalSheet"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
          
          <div class="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono font-bold uppercase tracking-widest text-[#04C4D9] block">
                  Ficha Técnica de Homologación
                </span>
                <span 
                  v-if="getPartCatalogBrand(modalPart)"
                  class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                  :class="getBrandBadgeClass(getPartCatalogBrand(modalPart))"
                >
                  {{ getPartCatalogBrand(modalPart) }}
                </span>
              </div>
              <h3 class="text-base font-black text-white mt-0.5">
                {{ modalPart.nombre }}
              </h3>
            </div>
            <button
              type="button"
              @click="closeTechnicalSheet"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-5 overflow-y-auto space-y-3.5 text-xs">
            
            <!-- Imagen Técnica / Diagrama en la Ficha -->
            <div 
              v-if="modalPart.imagen_url"
              class="relative bg-slate-900/5 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer group hover:border-[#04C4D9] transition"
              @click="openLightbox(modalPart)"
              title="Clic para ampliar diagrama técnico"
            >
              <img 
                :src="modalPart.imagen_url" 
                :alt="modalPart.nombre" 
                class="max-h-48 object-contain rounded-lg"
              />
              <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold group-hover:bg-[#04C4D9] transition shadow-xs">
                <Maximize2 class="w-3 h-3" />
                <span>Ampliar Diagrama en Pantalla Completa</span>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Código Principal</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span 
                    v-if="getPartCatalogBrand(modalPart)"
                    class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    :class="getBrandBadgeClass(getPartCatalogBrand(modalPart))"
                  >
                    {{ getPartCatalogBrand(modalPart) }}
                  </span>
                  <strong class="text-xs font-black text-slate-900">{{ (modalPart.especificaciones_tecnicas as any)?.codigo_mrk || (modalPart.especificaciones_tecnicas as any)?.codigo_rik || (modalPart.especificaciones_tecnicas as any)?.codigo_npr || (modalPart.especificaciones_tecnicas as any)?.codigo_dokuro || modalPart.codigo_oem }}</strong>
                </div>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Subsistema</span>
                <strong class="text-xs font-black text-[#038391]">{{ modalPart.subsistema }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Categoría</span>
                <strong class="text-xs font-black text-slate-900">{{ modalPart.categoria }}</strong>
              </div>
            </div>

            <!-- Aplicación técnica del vehículo, año y cilindros (Estilo Dokuro / TecDoc) -->
            <div 
              v-if="(modalPart.especificaciones_tecnicas as any)?.vehiculo || (modalPart.especificaciones_tecnicas as any)?.ano || (modalPart.especificaciones_tecnicas as any)?.cilindros"
              class="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center gap-3 text-xs"
            >
              <div v-if="(modalPart.especificaciones_tecnicas as any)?.vehiculo" class="flex items-center gap-1.5">
                <span class="text-blue-600 font-bold">Vehículo:</span>
                <strong class="text-blue-950 font-bold">{{ (modalPart.especificaciones_tecnicas as any).vehiculo }}</strong>
              </div>
              <div v-if="(modalPart.especificaciones_tecnicas as any)?.ano" class="flex items-center gap-1.5">
                <span class="text-slate-600 font-bold">Año:</span>
                <strong class="text-slate-900 font-mono">{{ (modalPart.especificaciones_tecnicas as any).ano }}</strong>
              </div>
              <div v-if="(modalPart.especificaciones_tecnicas as any)?.cilindros" class="flex items-center gap-1.5">
                <span class="text-amber-700 font-bold">⚙️ Cilindros:</span>
                <strong class="text-amber-900 font-mono">{{ (modalPart.especificaciones_tecnicas as any).cilindros }}</strong>
              </div>
            </div>

            <!-- Bloque A: Códigos Originales del Fabricante (OEM) -->
            <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <div class="flex items-center justify-between mb-1.5">
                <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-[#004B97]"></span>
                  <span>Códigos Originales del Fabricante (OEM)</span>
                </h4>
                <span class="text-[10px] font-mono font-bold text-slate-600">
                  {{ getPartOemCodes(modalPart).length }} código(s)
                </span>
              </div>
              <div v-if="getPartOemCodes(modalPart).length > 0" class="flex flex-wrap gap-1.5">
                <button
                  v-for="oemCode in getPartOemCodes(modalPart)"
                  :key="`modal-oem-${oemCode}`"
                  type="button"
                  @click="copyToClipboard(oemCode, 'OEM')"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-900 font-mono text-xs cursor-pointer transition shadow-2xs"
                  :title="`Clic para copiar Código OEM: ${oemCode}`"
                >
                  <strong class="font-bold">{{ oemCode }}</strong>
                  <Check v-if="copiedCode === oemCode" class="w-3.5 h-3.5 text-emerald-600" />
                  <Copy v-else class="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>

            <!-- Bloque B: Equivalencias Multimarca Alternas -->
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Equivalencias Cruzadas Multimarca (Alternos)
              </h4>
              <div v-if="getPartEquivalencias(modalPart).length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div
                  v-for="eq in getPartEquivalencias(modalPart)"
                  :key="eq.id"
                  class="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white"
                >
                  <div class="flex items-center gap-1.5">
                    <span :class="['px-1.5 py-0.2 rounded text-[9px] uppercase font-bold', getBrandBadgeClass(eq.marca_alterna)]">
                      {{ eq.marca_alterna }}
                    </span>
                    <strong class="font-mono text-xs text-slate-900">{{ eq.codigo_alterno }}</strong>
                  </div>
                  <button
                    type="button"
                    @click="copyToClipboard(eq.codigo_alterno, eq.marca_alterna)"
                    class="text-slate-400 hover:text-slate-800 p-1"
                    title="Copiar código"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div v-else class="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                Sin equivalencias cruzadas registradas para esta pieza.
              </div>
            </div>

            <!-- CASO ANILLOS: CUADRO TÉCNICO OFICIAL RIK / TALLER (DISEÑO SWGORA) -->
            <div v-if="(modalPart.categoria === 'Anillos' || (modalPart.categoria || '').toLowerCase().includes('anillo')) && ((modalPart.dimensiones as any)?.anillos || modalPart.diametro_cilindro_mm)">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
                    Matriz Técnica RIK - Cotas de Aros de Pistón
                  </h4>
                  <span
                    v-if="isPartConical(modalPart)"
                    class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1"
                    :title="getKeystoneLabel(modalPart)"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Cónico (Keystone)
                  </span>
                </div>
                <span v-if="(modalPart.dimensiones as any)?.cilindros && Number((modalPart.dimensiones as any).cilindros) > 0" class="px-2 py-0.5 rounded bg-cyan-50 text-[#038391] font-bold text-[11px] font-mono border border-cyan-200">
                  {{ (modalPart.dimensiones as any).cilindros }} Cilindros
                </span>
              </div>

              <!-- Cuadro RIK con diseño corporativo SWGORA -->
              <div class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs font-mono text-xs">
                <table class="w-full border-collapse text-center">
                  <thead>
                    <tr class="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <th rowspan="2" class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider">Position</th>
                      <th colspan="3" class="px-4 py-1 text-xs font-bold uppercase tracking-wider border-b border-slate-200">Size (mm)</th>
                      <th rowspan="2" class="px-3 py-1.5 border-l border-slate-200 text-[11px] font-bold uppercase tracking-wider">Shape (Forma)</th>
                      <th rowspan="2" class="px-3 py-1.5 border-l border-slate-200 text-[11px] font-bold uppercase tracking-wider">Material</th>
                      <th rowspan="2" class="px-3 py-1.5 border-l border-slate-200 text-[11px] font-bold uppercase tracking-wider">Tratamiento</th>
                    </tr>
                    <tr class="bg-slate-50 text-slate-600 text-[10px] font-semibold border-b border-slate-200">
                      <th class="px-2.5 py-1 border-r border-slate-200">
                        <span class="block font-bold">d 1</span>
                        <span class="block text-[9px] text-slate-400 font-normal">(D)</span>
                      </th>
                      <th class="px-2.5 py-1 border-r border-slate-200">
                        <span class="block font-bold">h 1</span>
                        <span class="block text-[9px] text-slate-400 font-normal">(B)</span>
                      </th>
                      <th class="px-2.5 py-1">
                        <span class="block font-bold">a 1</span>
                        <span class="block text-[9px] text-slate-400 font-normal">(T)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs">
                    <tr 
                      v-for="(ring, rIdx) in getPartRingsList(modalPart)" 
                      :key="rIdx" 
                      class="hover:bg-slate-50/70 transition"
                    >
                      <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200">
                        {{ ring.posicion === 'Anillo de aceite' ? 'Oil' : (rIdx === 0 ? '1st' : (rIdx === 1 ? '2nd' : (rIdx === 2 ? '3rd' : `${rIdx + 1}th`))) }}
                      </td>
                      <td class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900">{{ formatRingVal(ring.d1) }}</td>
                      <td class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900">{{ formatRingVal(ring.h1) }}</td>
                      <td class="px-2.5 py-1.5 font-bold text-slate-900">{{ formatRingVal(ring.a1) }}</td>
                      <td class="px-3 py-1.5 border-l border-slate-200 bg-slate-50 font-bold text-slate-800">{{ getRingDetail(modalPart, rIdx, 'forma') }}</td>
                      <td class="px-3 py-1.5 border-l border-slate-200 bg-white text-slate-700">{{ getRingDetail(modalPart, rIdx, 'material') }}</td>
                      <td class="px-3 py-1.5 border-l border-slate-200 bg-slate-50 text-slate-700 font-sans text-[11px]">{{ [getRingDetail(modalPart, rIdx, 'tratamiento_ext'), getRingDetail(modalPart, rIdx, 'tratamiento_int')].filter(t => t !== '—').join(' / ') || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Metadatos de motor asociados al juego de aros -->
              <div v-if="(modalPart.dimensiones as any)?.cilindrada || (modalPart.dimensiones as any)?.motores_texto || (modalPart.dimensiones as any)?.anos" class="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-sans flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                <span v-if="(modalPart.dimensiones as any)?.cilindrada">
                  <strong>Cilindrada:</strong> {{ (modalPart.dimensiones as any).cilindrada }}
                </span>
                <span v-if="(modalPart.dimensiones as any)?.motores_texto">
                  <strong>Motores compatibles:</strong> {{ (modalPart.dimensiones as any).motores_texto }}
                </span>
                <span v-if="(modalPart.dimensiones as any)?.anos">
                  <strong>Años:</strong> {{ (modalPart.dimensiones as any).anos }}
                </span>
              </div>
            </div>

            <!-- CASO FAMILIAS EN TABLA GENERALES: MATRIZ DE FILAS Y COLUMNAS TÉCNICAS -->
            <div v-else-if="Array.isArray((modalPart.dimensiones as any)?.anillos) && (modalPart.dimensiones as any).anillos.length > 0">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
                  Matriz Técnica - {{ modalPart.nombre }}
                </h4>
              </div>
              <div class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs font-mono text-xs">
                <table class="w-full border-collapse text-center">
                  <thead>
                    <tr class="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <th class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider text-left">{{ tableColFirstHeader }}</th>
                      <th
                        v-for="col in activeTableGroupColumns"
                        :key="`m-col-${col.id}`"
                        class="px-2.5 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider"
                      >
                        {{ col.etiqueta_corta || col.etiqueta }}
                        <span v-if="col.unidad" class="text-[9px] text-slate-400 font-normal">({{ col.unidad }})</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs">
                    <tr
                      v-for="(ring, rIdx) in getPartRingsList(modalPart)"
                      :key="rIdx"
                      class="hover:bg-slate-50/70 transition"
                    >
                      <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200 text-left">
                        <span>{{ ring.posicion }}</span>
                        <span
                          v-if="ring.identificador || (ring.perfil && ring.perfil !== 'Plano')"
                          class="ml-1 text-[9px] px-1 py-0.2 rounded font-extrabold border uppercase tracking-tight bg-cyan-50 text-[#038391] border-cyan-300"
                        >
                          {{ ring.identificador || ring.perfil }}
                        </span>
                      </td>
                      <td
                        v-for="col in activeTableGroupColumns"
                        :key="`m-val-${col.id}`"
                        class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900"
                      >
                        {{ formatGeneralTableRowValue(ring, col) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- CASO OTROS COMPONENTES: TABLA DE ESPECIFICACIONES GENERALES -->
            <div v-else>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Especificaciones Métricas (mm)
              </h4>
              <table class="w-full border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 font-mono text-xs">
                <tbody>
                  <tr v-if="modalPart.diametro_interior_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Diámetro Interior:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_interior_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_exterior_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Diámetro Exterior:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_exterior_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.altura_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Altura:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.altura_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_cabeza_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Hongo:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_cabeza_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.diametro_vastago_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Vástago:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_vastago_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.longitud_total_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Longitud Total:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.longitud_total_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.dimensiones?.stem_end || modalPart.dimensiones?.cunero || modalPart.dimensiones?.ranuras" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Cuñero / Ranura:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.dimensiones?.stem_end || modalPart.dimensiones?.cunero || modalPart.dimensiones?.ranuras }}</td>
                  </tr>
                  <tr v-if="modalPart.diametro_cilindro_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Diámetro Cilindro:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.diametro_cilindro_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_anillo1_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">1° Anillo (Fuego):</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_anillo1_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_anillo2_mm" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">2° Anillo (Compresión):</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_anillo2_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.espesor_aceite_mm">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Anillo de Aceite:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.espesor_aceite_mm }} mm</td>
                  </tr>
                  <tr v-if="modalPart.medida_rosca" class="bg-slate-50/50">
                    <td class="py-1.5 px-3 text-slate-500 font-sans">Rosca y Paso:</td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right">{{ modalPart.medida_rosca }} × {{ modalPart.paso_rosca_mm || 1.25 }} mm</td>
                  </tr>
                  <tr 
                    v-for="extraDim in getModalExtraDimensions(modalPart)" 
                    :key="`dyn-dim-${extraDim.key}`"
                    class="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td class="py-1.5 px-3 text-slate-500 font-sans capitalize">
                      {{ extraDim.label }}:
                    </td>
                    <td class="py-1.5 px-3 text-slate-900 font-bold text-right font-mono">
                      {{ extraDim.value }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          <div class="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              @click="copyFullCross(modalPart)"
              class="px-3.5 py-1.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5"
            >
              <Copy class="w-3.5 h-3.5" />
              <span>Copiar Ficha</span>
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="handleEditPart(modalPart); closeTechnicalSheet()"
                class="px-3.5 py-1.5 border border-cyan-200 bg-cyan-50/60 hover:bg-cyan-100 text-[#038391] font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
                title="Modificar especificaciones y equivalencias de este repuesto"
              >
                <Edit3 class="w-3.5 h-3.5" />
                <span>Modificar Repuesto</span>
              </button>

              <button
                type="button"
                @click="addToWorkOrder(modalPart); closeTechnicalSheet()"
                class="px-4 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition"
              >
                <Plus class="w-4 h-4" />
                <span>Agregar a Orden</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL RÁPIDO 3A: REGISTRAR NUEVA MARCA / FABRICANTE                        -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isQuickCreateBrandOpen"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="isQuickCreateBrandOpen = false"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-[#04C4D9]" />
              <h3 class="text-sm font-bold text-white">{{ editingBrandId ? 'Editar Marca / Fabricante' : 'Registrar Nueva Marca / Fabricante' }}</h3>
            </div>
            <button
              type="button"
              @click="isQuickCreateBrandOpen = false"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <form @submit.prevent="handleSaveQuickBrand" class="p-4 space-y-3 text-xs">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Nombre de la Marca / Fabricante *
              </label>
              <input
                v-model="quickBrandName"
                type="text"
                required
                placeholder="ej. CUMMINS, HINO, SUBARU, VOLVO..."
                class="w-full px-3 py-2 text-xs font-bold uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>

            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                País de Origen
              </label>
              <select
                v-model="quickBrandCountry"
                class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              >
                <option value="Japón">Japón</option>
                <option value="Corea del Sur">Corea del Sur</option>
                <option value="Estados Unidos">Estados Unidos</option>
                <option value="Alemania">Alemania</option>
                <option value="Europa">Europa</option>
                <option value="China">China</option>
                <option value="Brasil">Brasil</option>
                <option value="Internacional">Internacional</option>
              </select>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                @click="isQuickCreateBrandOpen = false"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSavingQuickBrand || !quickBrandName.trim()"
                class="px-4 py-1.5 rounded-lg bg-[#04C4D9] hover:bg-[#03a9bc] disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Check class="w-3.5 h-3.5" />
                <span>{{ editingBrandId ? 'Guardar Cambios' : 'Guardar y Seleccionar' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL RÁPIDO 3B: REGISTRAR NUEVO CÓDIGO DE MOTOR                          -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isQuickCreateMotorOpen"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="isQuickCreateMotorOpen = false"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Wrench class="w-4 h-4 text-[#04C4D9]" />
              <h3 class="text-sm font-bold text-white">{{ editingMotorId ? 'Editar Motor en Catálogo' : 'Registrar Nuevo Motor en Catálogo' }}</h3>
            </div>
            <button
              type="button"
              @click="isQuickCreateMotorOpen = false"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <form @submit.prevent="handleSaveQuickMotor" class="p-4 space-y-3 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Marca / Fabricante *
                </label>
                <select
                  v-model="quickMotorBrandId"
                  required
                  class="w-full px-2.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option v-for="fab in catalogStore.fabricantes" :key="fab.id" :value="fab.id">
                    {{ fab.nombre.toUpperCase() }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Código de Motor *
                </label>
                <input
                  v-model="quickMotorCode"
                  type="text"
                  required
                  placeholder="ej. 7L, 1GD-FTV, 4JJ3..."
                  class="w-full px-2.5 py-2 text-xs font-mono font-black uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Modelo de Vehículo
                </label>
                <select
                  v-model="quickMotorModelId"
                  class="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="">Sin modelo específico</option>
                  <option
                    v-for="mod in catalogStore.modelos.filter(m => !quickMotorBrandId || m.fabricante_id === quickMotorBrandId)"
                    :key="mod.id"
                    :value="mod.id"
                  >
                    {{ mod.nombre }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Denominación / Serie
                </label>
                <input
                  v-model="quickMotorSeries"
                  type="text"
                  placeholder="ej. Serie L / Hilux / Dyna"
                  class="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Años de Aplicación
                </label>
                <input
                  v-model="quickMotorYears"
                  type="text"
                  placeholder="ej. 1978-1980, 1981-1990"
                  class="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Cilindros</label>
                <input
                  v-model.number="quickMotorCylinders"
                  type="number"
                  min="1"
                  max="16"
                  class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Cilindrada (cc)</label>
                <input
                  v-model.number="quickMotorCc"
                  type="number"
                  placeholder="ej. 2977"
                  class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                />
              </div>

              <div>
                <label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Combustible</label>
                <select
                  v-model="quickMotorFuel"
                  class="w-full px-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                >
                  <option value="Diésel">Diésel</option>
                  <option value="Turbo Diésel">Turbo Diésel</option>
                  <option value="Gasolina">Gasolina</option>
                </select>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                @click="isQuickCreateMotorOpen = false"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSavingQuickMotor || !quickMotorCode.trim()"
                class="px-4 py-1.5 rounded-lg bg-[#04C4D9] hover:bg-[#03a9bc] disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Check class="w-3.5 h-3.5" />
                <span>Guardar Motor</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL RÁPIDO 3C: REGISTRAR NUEVO MODELO DE VEHÍCULO                        -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isQuickCreateModelOpen"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="isQuickCreateModelOpen = false"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-[#04C4D9]" />
              <h3 class="text-sm font-bold text-white">{{ editingModelId ? 'Editar Modelo en Catálogo' : 'Registrar Nuevo Modelo en Catálogo' }}</h3>
            </div>
            <button
              type="button"
              @click="isQuickCreateModelOpen = false"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <form @submit.prevent="handleSaveQuickModel" class="p-4 space-y-3 text-xs">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Marca / Fabricante *
              </label>
              <select
                v-model="quickModelBrandId"
                required
                class="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              >
                <option v-for="fab in catalogStore.fabricantes" :key="fab.id" :value="fab.id">
                  {{ fab.nombre.toUpperCase() }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Nombre del Modelo *
              </label>
              <input
                v-model="quickModelName"
                type="text"
                required
                placeholder="ej. HILUX, NP300, L200, H100, COROLLA..."
                class="w-full px-3 py-2 text-xs font-bold uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Año Inicio (Opcional)</label>
                <input
                  v-model.number="quickModelYearStart"
                  type="number"
                  placeholder="ej. 1998"
                  class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase text-slate-600 mb-1">Año Fin (Opcional)</label>
                <input
                  v-model.number="quickModelYearEnd"
                  type="number"
                  placeholder="ej. 2026"
                  class="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                />
              </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                @click="isQuickCreateModelOpen = false"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSavingQuickModel || !quickModelName.trim()"
                class="px-4 py-1.5 rounded-lg bg-[#04C4D9] hover:bg-[#03a9bc] disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Check class="w-3.5 h-3.5" />
                <span>{{ editingModelId ? 'Guardar Cambios' : 'Guardar Modelo' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- MODAL RÁPIDO 3D: REGISTRAR NUEVO AÑO / RANGO DE COMPATIBILIDAD             -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isQuickCreateYearOpen"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="isQuickCreateYearOpen = false"
      >
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-[#04C4D9]" />
              <h3 class="text-sm font-bold text-white">Agregar Nuevo Año</h3>
            </div>
            <button
              type="button"
              @click="isQuickCreateYearOpen = false"
              class="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <form @submit.prevent="handleSaveQuickYear()" class="p-4 space-y-3 text-xs">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Año o Rango de Compatibilidad *
              </label>
              <input
                v-model="quickYearValue"
                type="text"
                required
                placeholder="ej. 1968, 2027, 1998-2005..."
                class="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              />
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                @click="isQuickCreateYearOpen = false"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="!quickYearValue.trim()"
                class="px-4 py-1.5 rounded-lg bg-[#04C4D9] hover:bg-[#03a9bc] disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Check class="w-3.5 h-3.5" />
                <span>Guardar y Seleccionar</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- LIGHTBOX MODAL: VISOR DE DIAGRAMAS / IMÁGENES TÉCNICAS EN ALTA DEFINICIÓN -->
    <!-- ========================================================================= -->
    <PartImageLightbox
      :is-open="isLightboxOpen"
      :part="lightboxPart"
      @close="closeLightbox"
    />

    <AdminCatalogModal
      :is-open="isAdminModalOpen"
      :initial-tab="adminModalTab"
      :preselected-group-id="adminModalTab === 'repuesto' ? (selectedComponent?.id || undefined) : (adminModalEditGroupId || undefined)"
      :preselected-motor-id="selectedMotor?.id || null"
      :edit-group-id="adminModalEditGroupId"
      :edit-part="adminModalEditPart"
      @close="isAdminModalOpen = false; adminModalEditGroupId = null; adminModalEditPart = null"
      @part-created="onPartCreated"
      @part-updated="onPartUpdated"
      @part-deleted="onPartDeleted"
      @group-created="onGroupCreated"
      @group-updated="onGroupUpdated"
    />

  </div>
</template>
