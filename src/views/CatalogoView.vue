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
  type DocumentoPdf,
  buildNestedTableHeaders,
  buildNormalRowSegmentMeta,
  buildRowSpanMeta,
  normalizeLegacyRingDesign,
  normalizeText,
  parseMultiOptionValues,
  resolveOptionBadgeClass,
  resolveSubfilaColumnValue,
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
  Trash2,
  Ruler,
  Maximize2,
  Hash,
  ArrowUpDown,
  Download,
  ExternalLink,
} from 'lucide-vue-next'

const catalogStore = useCatalogStore()

// =============================================================================
// ESTADO DE SELECCIÓN EN CASCADA (FABRICANTE -> MOTOR -> MODELO -> COMPONENTE)
// =============================================================================
const brandInput = ref<string>('')
const modelInput = ref<string>('')
const motorInput = ref<string>('')
const motorMatchMode = ref<'startsWith' | 'contains'>('startsWith')
const componentInput = ref<string>('')

const isBrandOpen = ref<boolean>(false)
const isMotorOpen = ref<boolean>(false)
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
const confirmDeleteBrand = ref<boolean>(false)
const isDeletingQuickBrand = ref<boolean>(false)

const isQuickCreateMotorOpen = ref<boolean>(false)
const editingMotorId = ref<string | null>(null)
const quickMotorBrandId = ref<string>('')
const quickMotorModelId = ref<string>('')
const quickMotorAdditionalModelIds = ref<string[]>([])
const quickMotorCode = ref<string>('')
const quickMotorName = ref<string>('')
const quickMotorSeries = ref<string>('')
const quickMotorCylinders = ref<number>(4)
const quickMotorCc = ref<number | undefined>(undefined)
const quickMotorFuel = ref<string>('Diésel')
const quickMotorYears = ref<string>('')
const isSavingQuickMotor = ref<boolean>(false)
const confirmDeleteMotor = ref<boolean>(false)
const isDeletingQuickMotor = ref<boolean>(false)

const isQuickCreateModelOpen = ref<boolean>(false)
const editingModelId = ref<string | null>(null)
const quickModelBrandId = ref<string>('')
const quickModelName = ref<string>('')
const quickModelYearStart = ref<number | undefined>(undefined)
const quickModelYearEnd = ref<number | undefined>(undefined)
const quickModelMotorIds = ref<string[]>([])
const quickModelMotorQuery = ref<string>('')
const quickModelAvailableMotors = ref<Motor[]>([])
const loadingQuickModelMotors = ref<boolean>(false)
const isSavingQuickModel = ref<boolean>(false)
const confirmDeleteModel = ref<boolean>(false)
const isDeletingQuickModel = ref<boolean>(false)

const isQuickCreateYearOpen = ref<boolean>(false)
const quickYearValue = ref<string>('')

// Conversor visual mm <-> milésimas de pulgada (÷ 25.4) sin alterar la base de datos
const unitMode = ref<'mm' | 'milesimas'>('mm')

const openQuickCreateBrandModal = (initialName?: string) => {
  editingBrandId.value = null
  confirmDeleteBrand.value = false
  quickBrandName.value = (initialName || brandInput.value || '').trim().toUpperCase()
  quickBrandCountry.value = 'Japón'
  isBrandOpen.value = false
  isQuickCreateBrandOpen.value = true
}

const openEditBrandModal = (fab: Fabricante, startDelete = false) => {
  editingBrandId.value = fab.id
  confirmDeleteBrand.value = startDelete
  quickBrandName.value = fab.nombre.toUpperCase()
  quickBrandCountry.value = fab.pais_origen || 'Japón'
  isBrandOpen.value = false
  isQuickCreateBrandOpen.value = true
}

const handleDeleteQuickBrand = async () => {
  const targetId = editingBrandId.value
  if (!targetId) return
  const targetName = quickBrandName.value.trim().toUpperCase() || 'Marca'
  isDeletingQuickBrand.value = true
  try {
    await catalogStore.deleteFabricante(targetId)
    isQuickCreateBrandOpen.value = false
    confirmDeleteBrand.value = false
    if (selectedBrand.value?.id === targetId) {
      selectedBrand.value = null
      brandInput.value = ''
    }
    if (selectedModel.value?.fabricante_id === targetId) {
      selectedModel.value = null
      modelInput.value = ''
    }
    if (selectedMotor.value?.fabricante_id === targetId) {
      selectedMotor.value = null
    }
    showToast(`✓ Marca "${targetName}" eliminada`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'No se pudo eliminar la marca')
  } finally {
    isDeletingQuickBrand.value = false
  }
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

const addQuickMotorModelRow = () => {
  quickMotorAdditionalModelIds.value.push('')
}

const removeQuickMotorModelRow = (idx: number) => {
  quickMotorAdditionalModelIds.value.splice(idx, 1)
}

const openQuickCreateMotorModal = (initialCode?: string) => {
  editingMotorId.value = null
  confirmDeleteMotor.value = false
  quickMotorCode.value = (initialCode || motorInput.value || '').trim().toUpperCase()
  quickMotorBrandId.value = selectedBrand.value?.id || catalogStore.fabricantes[0]?.id || '11111111-1111-1111-1111-111111111101'
  quickMotorModelId.value = selectedModel.value?.id || ''
  quickMotorAdditionalModelIds.value = []
  quickMotorName.value = quickMotorCode.value ? `Motor ${quickMotorCode.value}` : ''
  quickMotorSeries.value = ''
  quickMotorCylinders.value = 4
  quickMotorCc.value = undefined
  quickMotorFuel.value = 'Diésel'
  quickMotorYears.value = selectedYear.value || ''
  isQuickCreateMotorOpen.value = true
}

const openEditMotorModal = async (mot: Motor, e?: Event, startDelete = false) => {
  e?.stopPropagation()
  editingMotorId.value = mot.id
  confirmDeleteMotor.value = startDelete
  quickMotorBrandId.value = mot.fabricante_id
  if (mot.fabricante_id && !catalogStore.modelos.some(m => m.fabricante_id === mot.fabricante_id)) {
    await catalogStore.fetchModelos(mot.fabricante_id).catch(() => {})
  }
  const rawIds = [
    ...(Array.isArray(mot.modelo_ids) ? mot.modelo_ids : []),
    ...(Array.isArray((mot.especificaciones_tecnicas as any)?.modelo_ids) ? (mot.especificaciones_tecnicas as any).modelo_ids : []),
    ...(mot.modelo_id ? [mot.modelo_id] : [])
  ].map(id => String(id || '').trim()).filter(Boolean)
  for (const nm of getMotorModelNamesList(mot)) {
    const matchedMod = catalogStore.modelos.find(
      m => m.fabricante_id === mot.fabricante_id && normalizeText(m.nombre) === normalizeText(nm)
    )
    if (matchedMod && !rawIds.includes(matchedMod.id)) {
      rawIds.push(matchedMod.id)
    }
  }
  const uniqueIds = Array.from(new Set(rawIds))
  quickMotorModelId.value = uniqueIds[0] || ''
  quickMotorAdditionalModelIds.value = uniqueIds.slice(1)
  quickMotorCode.value = mot.codigo
  quickMotorName.value = mot.nombre_comercial || ''
  quickMotorSeries.value = mot.denominacion_venta || ''
  quickMotorCylinders.value = mot.cilindros || 4
  quickMotorCc.value = mot.cilindrada_cc
  quickMotorFuel.value = mot.combustible || 'Diésel'
  quickMotorYears.value = mot.anios || ''
  isQuickCreateMotorOpen.value = true
}

const handleDeleteQuickMotor = async () => {
  const targetId = editingMotorId.value
  if (!targetId) return
  const targetCode = quickMotorCode.value.trim().toUpperCase() || 'Motor'
  isDeletingQuickMotor.value = true
  try {
    await catalogStore.deleteMotor(targetId)
    isQuickCreateMotorOpen.value = false
    confirmDeleteMotor.value = false
    if (selectedMotor.value?.id === targetId) {
      selectedMotor.value = null
      motorInput.value = ''
    }
    showToast(`✓ Motor "${targetCode}" eliminado`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'No se pudo eliminar el motor')
  } finally {
    isDeletingQuickMotor.value = false
  }
}

const handleSaveQuickMotor = async () => {
  const cleanCode = quickMotorCode.value.trim().toUpperCase()
  if (!cleanCode) return
  isSavingQuickMotor.value = true
  try {
    const allModelIds = Array.from(
      new Set([quickMotorModelId.value, ...quickMotorAdditionalModelIds.value].map(id => String(id || '').trim()).filter(Boolean))
    )
    const resolvedModelNames = allModelIds
      .map(mid => catalogStore.modelos.find(m => m.id === mid)?.nombre || '')
      .filter(Boolean)

    if (editingMotorId.value) {
      const updated = await catalogStore.updateMotor(editingMotorId.value, {
        fabricante_id: quickMotorBrandId.value,
        modelo_id: allModelIds[0] || undefined,
        modelo_ids: allModelIds,
        modelos_nombres: resolvedModelNames,
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
      const fallbackModelIds = allModelIds.length > 0 ? allModelIds : (selectedModel.value?.id ? [selectedModel.value.id] : [])
      const created = await catalogStore.createMotor({
        fabricante_id: quickMotorBrandId.value || selectedBrand.value?.id || '11111111-1111-1111-1111-111111111101',
        modelo_id: fallbackModelIds[0] || undefined,
        modelo_ids: fallbackModelIds,
        modelos_nombres: fallbackModelIds.map(mid => catalogStore.modelos.find(m => m.id === mid)?.nombre || '').filter(Boolean),
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

const filteredQuickModelMotors = computed<Motor[]>(() => {
  const q = quickModelMotorQuery.value.trim().toLowerCase()
  const list = quickModelAvailableMotors.value
  if (!q) return list
  return sortMotorsByRelevance(
    list.filter(m =>
      m.codigo.toLowerCase().includes(q) ||
      (m.nombre_comercial && m.nombre_comercial.toLowerCase().includes(q)) ||
      (m.denominacion_venta && m.denominacion_venta.toLowerCase().includes(q))
    ),
    q
  )
})

const loadQuickModelMotors = async (brandId: string) => {
  if (!brandId) {
    quickModelAvailableMotors.value = []
    return
  }
  loadingQuickModelMotors.value = true
  try {
    quickModelAvailableMotors.value = await catalogStore.getMotoresForBrand(brandId)
  } finally {
    loadingQuickModelMotors.value = false
  }
}

watch(quickModelBrandId, async (newBrandId, oldBrandId) => {
  if (!isQuickCreateModelOpen.value || !newBrandId) return
  if (oldBrandId && newBrandId !== oldBrandId) {
    quickModelMotorIds.value = []
    await loadQuickModelMotors(newBrandId)
  }
})

const toggleQuickModelMotor = (motorId: string) => {
  if (quickModelMotorIds.value.includes(motorId)) {
    quickModelMotorIds.value = quickModelMotorIds.value.filter(id => id !== motorId)
  } else {
    quickModelMotorIds.value = [...quickModelMotorIds.value, motorId]
  }
}

const openQuickCreateModelModal = async (initialName?: string) => {
  editingModelId.value = null
  confirmDeleteModel.value = false
  quickModelName.value = (initialName || modelInput.value || '').trim().toUpperCase()
  const brandId =
    selectedMotor.value?.fabricante_id ||
    selectedBrand.value?.id ||
    catalogStore.fabricantes[0]?.id ||
    '11111111-1111-1111-1111-111111111101'
  quickModelBrandId.value = brandId
  quickModelYearStart.value = selectedYear.value && !isNaN(Number(selectedYear.value)) ? Number(selectedYear.value) : undefined
  quickModelYearEnd.value = undefined
  quickModelMotorQuery.value = ''
  quickModelMotorIds.value =
    selectedMotor.value && selectedMotor.value.fabricante_id === brandId ? [selectedMotor.value.id] : []
  isModelOpen.value = false
  isQuickCreateModelOpen.value = true
  await loadQuickModelMotors(brandId)
}

const openEditModelModal = async (mod: Modelo, startDelete = false) => {
  editingModelId.value = mod.id
  confirmDeleteModel.value = startDelete
  quickModelName.value = mod.nombre.toUpperCase()
  quickModelBrandId.value = mod.fabricante_id
  quickModelYearStart.value = mod.anio_inicio
  quickModelYearEnd.value = mod.anio_fin
  quickModelMotorQuery.value = ''
  quickModelMotorIds.value = []
  isModelOpen.value = false
  isQuickCreateModelOpen.value = true
  const [, linkedIds] = await Promise.all([
    loadQuickModelMotors(mod.fabricante_id),
    catalogStore.getMotorIdsByModelo(mod.id).catch(() => [] as string[])
  ])
  quickModelMotorIds.value = linkedIds
}

const handleDeleteQuickModel = async () => {
  const targetId = editingModelId.value
  if (!targetId) return
  const targetName = quickModelName.value.trim().toUpperCase() || 'Modelo'
  isDeletingQuickModel.value = true
  try {
    await catalogStore.deleteModelo(targetId)
    isQuickCreateModelOpen.value = false
    confirmDeleteModel.value = false
    if (selectedModel.value?.id === targetId) {
      selectedModel.value = null
      modelInput.value = ''
    }
    showToast(`✓ Modelo "${targetName}" eliminado`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'No se pudo eliminar el modelo')
  } finally {
    isDeletingQuickModel.value = false
  }
}

const handleSaveQuickModel = async () => {
  const cleanName = quickModelName.value.trim().toUpperCase()
  const brandId = quickModelBrandId.value || selectedBrand.value?.id || catalogStore.fabricantes[0]?.id
  if (!cleanName || !brandId) return
  isSavingQuickModel.value = true
  try {
    const motorsToLink = quickModelAvailableMotors.value
      .filter(m => quickModelMotorIds.value.includes(m.id))
      .map(m => ({ id: m.id, codigo: m.codigo }))

    if (editingModelId.value) {
      const updated = await catalogStore.updateModelo(editingModelId.value, {
        fabricante_id: brandId,
        nombre: cleanName,
        anio_inicio: quickModelYearStart.value ? Number(quickModelYearStart.value) : null,
        anio_fin: quickModelYearEnd.value ? Number(quickModelYearEnd.value) : null
      })
      await catalogStore.syncModeloMotores(updated.id, motorsToLink)
      isQuickCreateModelOpen.value = false
      if (selectedModel.value?.id === updated.id) {
        selectedModel.value = updated
        modelInput.value = updated.nombre
        await catalogStore.fetchMotores(brandId, updated.id)
      }
      showToast(
        motorsToLink.length > 0
          ? `✓ Modelo "${updated.nombre}" actualizado y vinculado con ${motorsToLink.length} motor(es)`
          : `✓ Modelo actualizado a "${updated.nombre}"`
      )
    } else {
      const created = await catalogStore.createModelo(
        brandId,
        cleanName,
        quickModelYearStart.value ? Number(quickModelYearStart.value) : undefined,
        quickModelYearEnd.value ? Number(quickModelYearEnd.value) : undefined
      )
      await catalogStore.syncModeloMotores(created.id, motorsToLink)
      isQuickCreateModelOpen.value = false
      await handleSelectModel(created)
      showToast(
        motorsToLink.length > 0
          ? `✓ Modelo "${created.nombre}" registrado y vinculado con ${motorsToLink.length} motor(es)`
          : `✓ Modelo "${created.nombre}" registrado y seleccionado`
      )
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
const highlightedMotorIdx = ref<number>(0)
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
watch(highlightedMotorIdx, (val) => scrollItemIntoView(`.motor-item-${val}`))
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
  const list = brandMotorsList.value.slice(0, 60)
  if (e.key === 'Enter') {
    if (list[0]) {
      e.preventDefault()
      handleSelectMotor(list[0])
      setTimeout(() => componentInputRef.value?.focus(), 60)
    }
  } else if (e.key === 'Escape') {
    isMotorOpen.value = false
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
 * Resaltado visual reactivo: destaca en AZUL CELESTE las coincidencias exactas (diff <= 0.05)
 * y en AMARILLO las cotas que entran dentro del rango de tolerancia universal / individual.
 */
function getMeasurementMatchClass(partValue: number | undefined | null, filterValue: number | undefined | null, tol: number = 1.0): string {
  if (filterValue === undefined || filterValue === null || isNaN(Number(filterValue)) || partValue === undefined || partValue === null || isNaN(Number(partValue))) {
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }
  const diff = Math.abs(Number(partValue) - Number(filterValue))
  if (diff <= 0.05) {
    return 'bg-sky-100 text-[#0D1B3E] border-sky-400 font-black ring-1 ring-sky-500/60 shadow-2xs'
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
 * Azul celeste en coincidencia exacta, Amarillo en coincidencia semántica/parcial.
 */
function getPositionOrTypeBadgeClass(partVal: any, filterVal: any, opciones?: string[]): string {
  const tokens = parseMultiOptionValues(partVal)
  const strPart = tokens.join(', ')
  const lower = strPart.toLowerCase()
  const isAdm = lower === 'in' || lower.includes('admis') || lower.includes('intake')
  const isEsc = lower === 'ex' || lower.includes('escap') || lower.includes('exhaust')

  if (!filterVal || filterVal === '') {
    if (opciones && opciones.length > 0 && tokens.length > 0) {
      return `${resolveOptionBadgeClass(tokens[0], opciones)} font-bold text-[10px]`
    }
    if (isAdm) return 'bg-cyan-100 text-[#038391] border-cyan-300 font-bold uppercase text-[10px]'
    if (isEsc) return 'bg-amber-100 text-amber-900 border-amber-300 font-bold uppercase text-[10px]'
    return 'bg-slate-100 text-slate-800 border-slate-200 uppercase text-[10px] font-bold'
  }

  const strFilter = String(filterVal).trim().toLowerCase()
  if (strFilter === lower || tokens.some(t => t.toLowerCase() === strFilter)) {
    return 'bg-sky-100 text-[#0D1B3E] border-sky-400 font-black ring-1 ring-sky-500/60 text-[10px]'
  }

  const matches = (isAdm && (strFilter === 'in' || strFilter.includes('admis'))) ||
                  (isEsc && (strFilter === 'ex' || strFilter.includes('escap'))) ||
                  tokens.some(t => t.toLowerCase().includes(strFilter) || strFilter.includes(t.toLowerCase()))

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

const resolveGroupDefinitionForPart = (part?: RepuestoTecnico | null): GrupoRepuesto | null => {
  if (currentGroupDefinition.value) return currentGroupDefinition.value
  if (!part) return null

  const spec = (part.especificaciones_tecnicas || {}) as Record<string, unknown>
  const dims = (part.dimensiones || {}) as Record<string, unknown>
  const specCode = String(spec.grupo_codigo || dims.grupo_codigo || '').toLowerCase().trim()
  const cat = (part.categoria || '').toLowerCase().trim()
  const nom = (part.nombre || '').toLowerCase().trim()

  let matched: GrupoRepuesto | null =
    catalogStore.grupos.find(
      g =>
        (specCode && (g.codigo.toLowerCase() === specCode || g.id.toLowerCase() === specCode)) ||
        g.codigo.toLowerCase() === cat ||
        g.categoria.toLowerCase() === cat ||
        g.nombre.toLowerCase() === cat
    ) || null

  if (!matched && Array.isArray(dims.subfilas) && dims.subfilas.length > 0) {
    const firstRow = dims.subfilas.find((sf: any) => !sf?.es_fila_central && sf?.medidas && typeof sf.medidas === 'object')
    const measureKeys = firstRow ? Object.keys(firstRow.medidas as Record<string, unknown>) : []
    if (measureKeys.length > 0) {
      let bestScore = 0
      for (const g of catalogStore.grupos) {
        if (!g.parametros?.length) continue
        const score = g.parametros.filter(p => measureKeys.includes(p.clave)).length
        if (score > bestScore) {
          bestScore = score
          matched = g
        }
      }
    }
  }

  if (!matched) {
    let semanticCode = ''
    if (cat.includes('anillo') || nom.includes('anillo') || Array.isArray(dims.anillos)) semanticCode = 'anillos_motor'
    else if (cat.includes('sello')) semanticCode = 'ajuste_valvula'
    else if (cat.includes('guía') || cat.includes('guia')) semanticCode = 'guias_valvula'
    else if (cat.includes('asiento')) semanticCode = 'asientos_valvula'
    else if (cat.includes('válvula') || cat.includes('valvula')) semanticCode = 'valvula'
    else if (cat.includes('perno') || cat.includes('tornillo')) semanticCode = 'tornillos_culata'
    else if (cat.includes('casquet') || cat.includes('cojinet') || cat.includes('metal') || Boolean(part.tipo_cojinete)) semanticCode = 'casqueteria'
    else if (cat.includes('camisa')) semanticCode = 'camisas_cilindro'
    else if (cat.includes('empaque') || cat.includes('junta')) semanticCode = 'empaques_juntas'

    if (semanticCode) {
      matched = catalogStore.grupos.find(g => g.codigo === semanticCode) || null
    }
  }

  if (!matched) return null
  if (matched.parametros && matched.parametros.length > 0) {
    return {
      ...matched,
      parametros: sanitizeGroupParams(matched.parametros)
    }
  }
  return matched
}

const getPartTableColumns = (part?: RepuestoTecnico | null): ParametroTecnicoDefinicion[] => {
  const grp = resolveGroupDefinitionForPart(part)
  if (grp?.parametros && grp.parametros.length > 0) {
    return grp.parametros
  }
  if (activeTableGroupColumns.value.length > 0) {
    return activeTableGroupColumns.value
  }
  if (!part) return []
  const rows = getPartSubfilas(part).filter(sf => !sf.es_fila_central)
  const keys = new Set<string>()
  for (const sf of rows) {
    for (const [k, v] of Object.entries(sf.medidas || {})) {
      if (['posicion', 'tipo_aro', 'perfil', 'forma', 'identificador', 'extra', 'codigo', 'id'].includes(k)) continue
      if (v !== undefined && v !== null && v !== '') {
        keys.add(k)
      }
    }
  }
  return Array.from(keys).map((k, idx) => ({
    id: `fallback-${k}-${idx}`,
    clave: k,
    etiqueta: k.replace(/_mm$/i, '').replace(/_/g, ' '),
    unidad: k.toLowerCase().endsWith('_mm') ? 'mm' : '',
    tipo_dato: typeof rows[0]?.medidas?.[k] === 'boolean' ? 'booleano' : (typeof rows[0]?.medidas?.[k] === 'number' ? 'numero' : 'texto'),
    requerido: true
  }))
}

const getPartGroupSubcolumnsHeaders = (part?: RepuestoTecnico | null) => {
  return buildNestedTableHeaders(getPartTableColumns(part))
}

const getPartHasGroupSubcolumns = (part?: RepuestoTecnico | null): boolean => {
  return getPartGroupSubcolumnsHeaders(part).hasSubcolumns
}

const getPartTableColFirstHeader = (part?: RepuestoTecnico | null): string => {
  return resolveGroupDefinitionForPart(part)?.tabla_config?.titulo_primera_columna || tableColFirstHeader.value || 'Componente'
}

// Determina si la familia activa usa Vista en Tabla (sub-tabla incrustada dentro de la 4ta columna)
const isCurrentGroupTableView = computed<boolean>(() => {
  if (!currentGroupDefinition.value) return false
  return currentGroupDefinition.value.tipo_vista === 'tabla'
})

const isPartEmbeddedTableFormat = (part: RepuestoTecnico): boolean => {
  if (currentGroupDefinition.value?.tipo_vista === 'normal') return false
  if (isCurrentGroupTableView.value) return true
  const resolvedGrp = resolveGroupDefinitionForPart(part)
  if (resolvedGrp?.tipo_vista === 'tabla') return true
  const dims = part.dimensiones as any
  return (
    (Array.isArray(dims?.subfilas) && dims.subfilas.length > 0) ||
    (Array.isArray(dims?.anillos) && dims.anillos.length > 0)
  )
}

export interface PartSubfilaDisplay {
  id?: string
  nombre: string
  codigo: string
  grupo?: string
  es_fila_central?: boolean
  medidas: Record<string, any>
}

const getPartSubfilas = (part: RepuestoTecnico): PartSubfilaDisplay[] => {
  const dims = part.dimensiones as any
  const grpDef = resolveGroupDefinitionForPart(part)
  const configuredPadres = grpDef?.tabla_config?.subfila_padres || []
  const configuredTipos = grpDef?.tabla_config?.subfila_tipos || []
  if (Array.isArray(dims?.subfilas) && dims.subfilas.length > 0) {
    return dims.subfilas.map((sf: any, idx: number) => {
      const esCentral = sf.es_fila_central !== undefined ? Boolean(sf.es_fila_central) : (configuredTipos[idx] === 'central')
      return {
        ...sf,
        es_fila_central: esCentral,
        grupo: esCentral ? '' : ((sf.grupo && String(sf.grupo).trim()) ? String(sf.grupo).trim() : (configuredPadres[idx] || '')),
        medidas: esCentral
          ? {}
          : (sf.medidas?.tipo_diseno !== undefined
            ? {
                ...sf.medidas,
                tipo_diseno: Array.isArray(sf.medidas.tipo_diseno)
                  ? sf.medidas.tipo_diseno.map((x: unknown) => normalizeLegacyRingDesign([x]))
                  : normalizeLegacyRingDesign([sf.medidas.tipo_diseno])
              }
            : (sf.medidas || {}))
      }
    })
  }
  if (
    (Array.isArray(dims?.anillos) && dims.anillos.length > 0) ||
    grpDef?.codigo === 'anillos_motor' ||
    part.categoria === 'Anillos'
  ) {
    const isConical = Boolean(part.diseno_conico || dims?.diseno_conico || dims?.keystone)
    return getPartRingsList(part).map((ring: any, idx: number) => {
      const rawDesign = normalizeLegacyRingDesign(
        [ring.tipo_diseno, ring.identificador, ring.perfil, ring.forma],
        idx === 0 && isConical
      )
      return {
        nombre: ring.posicion || `Anillo ${idx + 1}`,
        codigo: ring.codigo || (idx === 0 ? (part.codigo_oem || '') : ''),
        grupo: configuredPadres[idx] || '',
        es_fila_central: false,
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
  const configuredSubfilas = grpDef?.tabla_config?.subfilas
  if (Array.isArray(configuredSubfilas) && configuredSubfilas.length > 0) {
    return configuredSubfilas.map((nombre, idx) => {
      const esCentral = configuredTipos[idx] === 'central'
      return {
        nombre,
        codigo: esCentral ? '' : (idx === 0 ? (part.codigo_oem || '') : ''),
        grupo: esCentral ? '' : (configuredPadres[idx] || ''),
        es_fila_central: esCentral,
        medidas: esCentral ? {} : (dims || {})
      }
    })
  }
  return [
    { nombre: 'Estándar', codigo: part.codigo_oem || '', grupo: configuredPadres[0] || '', es_fila_central: false, medidas: dims || {} }
  ]
}

const getPartSubfilaRowSpans = (part: RepuestoTecnico) => {
  return buildRowSpanMeta(
    getPartSubfilas(part),
    sf => sf.grupo || '',
    sf => Boolean(sf.es_fila_central)
  )
}

const getPartSubfilaSharedMeta = (part: RepuestoTecnico) => {
  return buildNormalRowSegmentMeta(getPartSubfilas(part).map(sf => Boolean(sf.es_fila_central)))
}

const partHasRowGroups = (part: RepuestoTecnico): boolean => {
  return getPartSubfilaRowSpans(part).some(m => m.label.length > 0)
}

const getPartMiniTableColspan = (part: RepuestoTecnico): number => {
  return (partHasRowGroups(part) ? 1 : 0) + 1 + getPartTableColumns(part).length
}

const getPartDisplayOemCodes = (part: RepuestoTecnico): string[] => {
  const baseCodes = getPartOemCodes(part)
  const dims = part.dimensiones as any
  if (!Array.isArray(dims?.subfilas) || dims.subfilas.length === 0) return baseCodes
  const merged = new Set(baseCodes)
  for (const sf of dims.subfilas) {
    const c = String(sf?.codigo || '').trim().toUpperCase()
    if (c) merged.add(c)
  }
  return Array.from(merged)
}

// Compatibilidad y soporte dedicado para tabla de anillos
const isCurrentGroupRingsTable = computed<boolean>(() => {
  if (!selectedComponent.value) return false
  const compId = (selectedComponent.value.id || '').toLowerCase()
  const cat = (selectedComponent.value.category || '').toLowerCase()
  const grpCode = (currentGroupDefinition.value?.codigo || '').toLowerCase()
  return compId === 'anillos_motor' || grpCode === 'anillos_motor' || cat === 'anillos' || cat.includes('anillo')
})

// Orientación de tabla (Horizontal <-> Vertical), por defecto Vertical para Casquetería / Cojinetes
const tableOrientations = ref<Record<string, 'vertical' | 'horizontal'>>({})
const modalTableOrientation = ref<'vertical' | 'horizontal'>('horizontal')
const previewPdfUrl = ref<string | null>(null)

const isCasqueteriaOrCojinetesContext = computed<boolean>(() => {
  const compId = (selectedComponent.value?.id || '').toLowerCase()
  const cat = (selectedComponent.value?.category || '').toLowerCase()
  const title = (selectedComponent.value?.title || '').toLowerCase()
  const grpCode = (currentGroupDefinition.value?.codigo || '').toLowerCase()
  const grpCat = (currentGroupDefinition.value?.categoria || '').toLowerCase()
  const joined = `${compId} ${cat} ${title} ${grpCode} ${grpCat}`
  return (
    joined.includes('casqueter') ||
    joined.includes('cojinet') ||
    joined.includes('metal') ||
    joined.includes('biela') ||
    joined.includes('bancada') ||
    joined.includes('ndc')
  )
})

const getPartIsBearingLike = (part?: RepuestoTecnico | null): boolean => {
  if (!part) return isCasqueteriaOrCojinetesContext.value
  const cat = (part.categoria || '').toLowerCase()
  const nom = (part.nombre || '').toLowerCase()
  const sub = (part.subsistema || '').toLowerCase()
  return (
    Boolean(part.tipo_cojinete) ||
    cat.includes('casquet') ||
    cat.includes('cojinet') ||
    cat.includes('metal') ||
    nom.includes('cojinete') ||
    nom.includes('casquete') ||
    sub === 'cigüeñal' ||
    sub === 'bielas'
  )
}

const currentOrientationKey = computed<string>(() => {
  return currentGroupDefinition.value?.codigo || selectedComponent.value?.id || 'global'
})

const currentTableOrientation = computed<'vertical' | 'horizontal'>(() => {
  const key = currentOrientationKey.value
  const saved = tableOrientations.value[key]
  if (saved) return saved
  return isCasqueteriaOrCojinetesContext.value ? 'vertical' : 'horizontal'
})

const toggleCurrentTableOrientation = () => {
  const key = currentOrientationKey.value
  tableOrientations.value[key] = currentTableOrientation.value === 'vertical' ? 'horizontal' : 'vertical'
}

const isTechnicalOrientationAvailable = computed<boolean>(() => {
  return Boolean(
    isCurrentGroupTableView.value ||
    isCasqueteriaOrCojinetesContext.value ||
    isCurrentGroupRingsTable.value ||
    (currentGroupDefinition.value?.parametros && currentGroupDefinition.value.parametros.length > 0) ||
    displayedParts.value.some(p => isPartEmbeddedTableFormat(p) || Boolean(resolveGroupDefinitionForPart(p)?.parametros?.length))
  )
})

export interface VerticalSpecRow {
  label: string
  parent: string
  showParent: boolean
  parentRowspan: number
  col: ParametroTecnicoDefinicion
}

const getPartImagesList = (part?: RepuestoTecnico | null): string[] => {
  if (!part) return []
  const spec = (part.especificaciones_tecnicas || {}) as Record<string, any>
  const dims = (part.dimensiones || {}) as Record<string, any>
  const list = [
    ...(Array.isArray(part.imagenes) ? part.imagenes : []),
    ...(Array.isArray(spec.imagenes) ? spec.imagenes : []),
    ...(Array.isArray(dims.imagenes) ? dims.imagenes : []),
    part.imagen_url || ''
  ]
  return Array.from(new Set(list.map(u => String(u || '').trim()).filter(Boolean)))
}

const getPartPdfsList = (part?: RepuestoTecnico | null): DocumentoPdf[] => {
  if (!part) return []
  const spec = (part.especificaciones_tecnicas || {}) as Record<string, any>
  const raw = Array.isArray(part.documentos_pdf)
    ? part.documentos_pdf
    : (Array.isArray(spec.documentos_pdf) ? spec.documentos_pdf : [])
  return raw.filter((d: any): d is DocumentoPdf => Boolean(d && d.url))
}

const getPartRingDesigns = (part?: RepuestoTecnico | null): string[] => {
  if (!part) return []
  const spec = (part.especificaciones_tecnicas || {}) as Record<string, any>
  const dims = (part.dimensiones || {}) as Record<string, any>
  const collected = new Set<string>()
  const explicit = [
    ...(Array.isArray(part.disenos_anillo) ? part.disenos_anillo : []),
    ...(Array.isArray(spec.disenos_anillo) ? spec.disenos_anillo : []),
    ...(Array.isArray(dims.disenos_anillo) ? dims.disenos_anillo : [])
  ]
  for (const item of explicit) {
    const clean = String(item || '').trim()
    if (clean) collected.add(clean)
  }
  const subfilas = Array.isArray(dims.subfilas) ? dims.subfilas : []
  for (const sf of subfilas) {
    const d = sf?.medidas?.tipo_diseno || sf?.medidas?.diseno || sf?.medidas?.perfil
    if (d && String(d).trim() && String(d).trim() !== 'Plano' && String(d).trim() !== 'Estándar') {
      collected.add(String(d).trim())
    }
  }
  const rings = Array.isArray(dims.anillos) ? dims.anillos : []
  for (const r of rings) {
    const d = r?.tipo_diseno || r?.identificador || r?.perfil || r?.forma
    if (d && String(d).trim() && String(d).trim() !== 'Plano' && String(d).trim() !== 'Estándar') {
      collected.add(String(d).trim())
    }
  }
  return Array.from(collected)
}

const getPartTechDescription = (part?: RepuestoTecnico | null): string => {
  if (!part) return ''
  const spec = (part.especificaciones_tecnicas || {}) as Record<string, any>
  const dims = (part.dimensiones || {}) as Record<string, any>
  return String(
    part.descripcion_tecnica ||
    spec.descripcion_tecnica ||
    dims.descripcion_tecnica ||
    spec.notas_aplicacion ||
    ''
  ).trim()
}

const getVerticalSpecRowsForColumns = (cols: ParametroTecnicoDefinicion[]): VerticalSpecRow[] => {
  const rows: VerticalSpecRow[] = cols.map(col => ({
    label: col.etiqueta_corta || col.etiqueta,
    parent: (col.columna_padre || '').trim(),
    showParent: false,
    parentRowspan: 1,
    col
  }))
  const spanMeta = buildRowSpanMeta(
    rows,
    r => r.parent,
    () => false
  )
  return rows.map((r, i) => ({
    ...r,
    showParent: spanMeta[i]?.show ?? true,
    parentRowspan: spanMeta[i]?.rowspan ?? 1
  }))
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

// Sub-columnas activas tanto en Vista Normal (columnas externas) como en Vista en Tabla (mini-tabla)
const hasGroupSubcolumns = computed<boolean>(() => {
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
  if (Array.isArray(val)) {
    const joined = val.map(v => String(v ?? '').trim()).filter(Boolean).join(', ')
    return joined || '—'
  }
  if (col.tipo_dato === 'booleano') return val ? 'Sí' : 'No'
  if (typeof val === 'number') {
    return formatMetricNum(val, col.unidad, 2)
  }
  if ((col.tipo_dato === 'numero' || col.unidad === 'mm') && !isNaN(Number(val))) {
    return formatMetricNum(Number(val), col.unidad, 2)
  }
  return String(val)
}

const getPartMiniTableCellRawValue = (
  part: RepuestoTecnico,
  sf: PartSubfilaDisplay,
  col: ParametroTecnicoDefinicion
): unknown => {
  const rowVal = resolveSubfilaColumnValue(sf.medidas, col)
  if (!col.compartido_filas) return rowVal
  if (rowVal !== undefined && rowVal !== null && rowVal !== '') return rowVal
  const allRows = getPartSubfilas(part)
  for (const r of allRows) {
    if (r.es_fila_central) continue
    const candidate = resolveSubfilaColumnValue(r.medidas, col)
    if (candidate !== undefined && candidate !== null && candidate !== '') return candidate
  }
  return getPartParamValue(part, col.clave)
}

const getPartMiniTableCellValue = (
  part: RepuestoTecnico,
  sf: PartSubfilaDisplay,
  col: ParametroTecnicoDefinicion
): string => {
  return formatPartParamColValue(getPartMiniTableCellRawValue(part, sf, col), col)
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

// 3. Anillos de motor: Diámetro, Anillos numerados (1, 2, 3, 4+...) y Anillo de aceite (siempre última fila)
const RING_DESIGN_FILTER_OPTIONS = [
  'Cromado',
  'Biselado',
  'Raspador',
  'Recto',
  'Nitro',
  'Cónico',
  'Semi-cónico',
  '1 Espiral',
  'Doble Espiral',
  'Escalonado',
  'Plano'
]

export interface ExtraRingFilterSlot {
  grosor?: number
  altura?: number
}

const filterAnilloTab = ref<'todos' | '1' | '2' | '3' | 'aceite'>('todos')
const filterAnilloDiametro = ref<number | undefined>(undefined)      // Diámetro (la primera siempre)
const filterAnilloGrosor1 = ref<number | undefined>(undefined)        // 1: Grosor
const filterAnilloRadial1 = ref<number | undefined>(undefined)        // 1: Altura
const filterAnilloGrosor2 = ref<number | undefined>(undefined)        // 2: Grosor
const filterAnilloRadial2 = ref<number | undefined>(undefined)        // 2: Altura
const filterAnilloGrosor3 = ref<number | undefined>(undefined)        // 3: Grosor (para 4+ anillos)
const filterAnilloRadial3 = ref<number | undefined>(undefined)        // 3: Altura (para 4+ anillos)
const extraRingFilters = ref<ExtraRingFilterSlot[]>([])               // 4°, 5°, ... dinámicos antes del de aceite
const filterAnilloGrosorAceite = ref<number | undefined>(undefined)   // Anillo de aceite: Grosor (el último siempre)
const filterAnilloRadialAceite = ref<number | undefined>(undefined)   // Anillo de aceite: Altura (el último siempre)
const filterAnilloDisenos = ref<string[]>([])                         // Diseño múltiple de anillos

const addExtraRingFilterSlot = () => {
  if (extraRingFilters.value.length >= 5) return
  extraRingFilters.value.push({ grosor: undefined, altura: undefined })
}

const removeExtraRingFilterSlot = (idx: number) => {
  extraRingFilters.value.splice(idx, 1)
}

const toggleFilterAnilloDiseno = (chip: string) => {
  const idx = filterAnilloDisenos.value.findIndex(d => d.toLowerCase() === chip.toLowerCase())
  if (idx >= 0) {
    filterAnilloDisenos.value.splice(idx, 1)
  } else {
    filterAnilloDisenos.value.push(chip)
  }
}

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
      ...extraRingFilters.value.flatMap(slot => [slot.grosor, slot.altura]),
      filterAnilloGrosorAceite.value, 
      filterAnilloRadialAceite.value
    ].filter(isFilterActive).length
    count += filterAnilloDisenos.value.length
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
  extraRingFilters.value = []
  filterAnilloGrosorAceite.value = undefined
  filterAnilloRadialAceite.value = undefined
  filterAnilloDisenos.value = []

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

// =============================================================================
// CASCADA REACTIVA BIDIRECCIONAL: FABRICANTE <-> MODELO <-> CÓDIGO DE MOTOR
// =============================================================================
const doesMotorMatchModel = (mot: Motor, mod: Modelo): boolean => {
  if (mot.modelo_id && mot.modelo_id === mod.id) return true
  if (mot.modelo?.id && mot.modelo.id === mod.id) return true
  if (Array.isArray(mot.modelo_ids) && mot.modelo_ids.includes(mod.id)) return true
  const specIds = (mot.especificaciones_tecnicas as any)?.modelo_ids
  if (Array.isArray(specIds) && specIds.includes(mod.id)) return true
  const modName = normalizeText(mod.nombre)
  if (!modName) return false
  if (getMotorModelNamesList(mot).some(n => normalizeText(n) === modName)) return true
  if (mot.denominacion_venta && normalizeText(mot.denominacion_venta).includes(modName)) return true
  if (mot.nombre_comercial && normalizeText(mot.nombre_comercial).includes(modName)) return true
  return false
}

const editableBrandTarget = computed<Fabricante | null>(() => {
  if (selectedBrand.value) return selectedBrand.value
  const q = brandInput.value.trim().toLowerCase()
  if (q) {
    return (
      filteredBrands.value.find(b => b.nombre.toLowerCase() === q) ||
      filteredBrands.value[0] ||
      null
    )
  }
  return null
})

const editableMotorTarget = computed<Motor | null>(() => {
  if (selectedMotor.value) return selectedMotor.value
  const q = motorInput.value.trim().toLowerCase()
  if (q) {
    return (
      brandMotorsList.value.find(m => m.codigo.toLowerCase() === q) ||
      brandMotorsList.value[0] ||
      null
    )
  }
  return brandMotorsList.value.length === 1 ? brandMotorsList.value[0] : null
})

const editableModelTarget = computed<Modelo | null>(() => {
  if (selectedModel.value) return selectedModel.value
  const q = normalizeText(modelInput.value)
  if (q) {
    return (
      filteredModels.value.find(m => normalizeText(m.nombre) === q) ||
      filteredModels.value[0] ||
      null
    )
  }
  return null
})

const editableComponentTarget = computed<ComponentGroup | null>(() => {
  if (selectedComponent.value) return selectedComponent.value
  const q = componentInput.value.trim().toLowerCase()
  if (q) {
    return (
      filteredComponentGroups.value.find(
        g => g.title.toLowerCase() === q || g.shortTitle.toLowerCase() === q
      ) ||
      filteredComponentGroups.value[0] ||
      null
    )
  }
  return null
})

// 1. Filtrado de MARCAS / FABRICANTES (reacciona a Motor / Modelo activos)
const filteredBrands = computed(() => {
  const q = brandInput.value.toLowerCase().trim()
  let list = catalogStore.fabricantes

  if (selectedMotor.value?.fabricante_id) {
    list = list.filter(f => f.id === selectedMotor.value!.fabricante_id)
  } else if (motorInput.value.trim()) {
    const matchingBrandIds = new Set(brandMotorsList.value.map(m => m.fabricante_id).filter(Boolean))
    list = list.filter(f => matchingBrandIds.has(f.id))
  } else if (selectedModel.value?.fabricante_id && !selectedBrand.value) {
    list = list.filter(f => f.id === selectedModel.value!.fabricante_id)
  }

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

const onInputBrand = async () => {
  isBrandOpen.value = true
  highlightedBrandIdx.value = 0
  if (selectedBrand.value && brandInput.value.trim().toLowerCase() !== selectedBrand.value.nombre.toLowerCase().trim()) {
    selectedBrand.value = null
    selectedModel.value = null
    modelInput.value = ''
    selectedMotor.value = null
    showAllMotors.value = Boolean(motorInput.value.trim())
    await catalogStore.selectFabricante(null)
    if (selectedComponent.value) {
      activeViewTab.value = 'repuestos'
      await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category)
    } else {
      catalogStore.repuestos = []
      activeViewTab.value = 'motores'
    }
  }
}

const handleSelectBrand = async (fab: Fabricante) => {
  const keepModel = selectedModel.value?.fabricante_id === fab.id ? selectedModel.value : null
  const keepMotor = selectedMotor.value?.fabricante_id === fab.id ? selectedMotor.value : null
  const prevMotorModelIds = [...catalogStore.modeloIdsDelMotor]

  selectedBrand.value = fab
  brandInput.value = fab.nombre.toUpperCase()
  isBrandOpen.value = false
  showAllMotors.value = Boolean(motorInput.value.trim())
  motorCurrentPage.value = 1

  // Conservar modelo y motor si pertenecen a la misma marca; nunca borrar motorInput
  if (!keepModel) {
    selectedModel.value = null
    modelInput.value = ''
  }
  selectedMotor.value = keepMotor

  // Limpiar filtros dimensionales para garantizar catálogo limpio en la nueva marca
  resetMeasurementsFilters()

  await catalogStore.selectFabricante(fab.id)

  if (keepModel) {
    await catalogStore.selectModelo(keepModel.id)
  }
  if (keepMotor) {
    catalogStore.selectedMotorId = keepMotor.id
    catalogStore.modeloIdsDelMotor = prevMotorModelIds.length > 0 ? prevMotorModelIds : [...(keepMotor.modelo_ids || [])]
  }

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    if (keepMotor) {
      await catalogStore.fetchRepuestosByMotor(keepMotor.id)
    } else {
      await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, fab.id, keepModel?.id)
    }
  } else if (keepMotor && activeViewTab.value === 'repuestos') {
    await catalogStore.fetchRepuestosByMotor(keepMotor.id)
  } else {
    activeViewTab.value = 'motores'
  }
}

const handleClearSelectedBrand = async () => {
  brandInput.value = ''
  setTimeout(() => brandInputRef.value?.focus(), 50)
  selectedBrand.value = null
  selectedModel.value = null
  modelInput.value = ''
  selectedMotor.value = null
  showAllMotors.value = Boolean(motorInput.value.trim())
  await catalogStore.selectFabricante(null)

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category)
  } else {
    catalogStore.repuestos = []
    activeViewTab.value = 'motores'
  }
}

// 2. Filtrado de MODELOS (CASCADA NIVEL 2: filtra por Marca y por Motor activo/escrito)
const filteredModels = computed(() => {
  const q = normalizeText(modelInput.value)
  let list = catalogStore.availableModelos

  if (!selectedMotor.value && motorInput.value.trim()) {
    const mq = motorInput.value.trim().toLowerCase()
    const motorsForInput = availableMotors.value.filter(m => {
      const code = (m.codigo || '').toLowerCase().trim()
      return motorMatchMode.value === 'startsWith' ? code.startsWith(mq) : code.includes(mq)
    })
    const matched = list.filter(m => motorsForInput.some(mot => doesMotorMatchModel(mot, m)))
    if (matched.length > 0) {
      list = matched
    }
  }

  if (!q || (selectedModel.value && q === normalizeText(selectedModel.value.nombre))) {
    return list
  }
  return list.filter(m =>
    normalizeText(m.nombre).includes(q) ||
    (m.fabricante_id && normalizeText(getBrandName(m.fabricante_id)).includes(q))
  )
})

const handleSelectModel = async (mod: Modelo) => {
  const preservedMotor =
    selectedMotor.value && doesMotorMatchModel(selectedMotor.value, mod)
      ? selectedMotor.value
      : null
  const prevMotorModelIds = [...catalogStore.modeloIdsDelMotor]

  selectedModel.value = mod
  modelInput.value = mod.nombre
  isModelOpen.value = false
  motorCurrentPage.value = 1
  if (motorInput.value.trim()) {
    showAllMotors.value = true
  }

  // Conservar motorInput escrito por el usuario (ej. "2L");
  // solo deseleccionar selectedMotor puntual si ya no coincide con el modelo elegido.
  selectedMotor.value = preservedMotor

  // Si no había fabricante seleccionado o difiere, autocompletar fabricante del modelo
  if (mod.fabricante_id && (!selectedBrand.value || selectedBrand.value.id !== mod.fabricante_id)) {
    const fab = catalogStore.fabricantes.find(f => f.id === mod.fabricante_id)
    if (fab) {
      selectedBrand.value = fab
      brandInput.value = fab.nombre.toUpperCase()
    }
  }

  await catalogStore.selectModelo(mod.id)

  if (preservedMotor) {
    catalogStore.selectedMotorId = preservedMotor.id
    catalogStore.modeloIdsDelMotor = prevMotorModelIds.length > 0 ? prevMotorModelIds : [...(preservedMotor.modelo_ids || [])]
  }

  if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    if (preservedMotor) {
      await catalogStore.fetchRepuestosByMotor(preservedMotor.id)
    } else {
      await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id, mod.id)
    }
  } else if (preservedMotor && activeViewTab.value === 'repuestos') {
    await catalogStore.fetchRepuestosByMotor(preservedMotor.id)
  } else {
    activeViewTab.value = 'motores'
  }
}

const handleClearSelectedModel = async () => {
  const preservedMotor = selectedMotor.value
  const prevMotorModelIds = [...catalogStore.modeloIdsDelMotor]

  selectedModel.value = null
  setTimeout(() => modelInputRef.value?.focus(), 50)
  modelInput.value = ''
  if (motorInput.value.trim()) {
    showAllMotors.value = true
  }
  await catalogStore.selectModelo(null)

  if (preservedMotor) {
    selectedMotor.value = preservedMotor
    catalogStore.selectedMotorId = preservedMotor.id
    catalogStore.modeloIdsDelMotor = prevMotorModelIds.length > 0 ? prevMotorModelIds : [...(preservedMotor.modelo_ids || [])]
    if (selectedComponent.value || activeViewTab.value === 'repuestos') {
      activeViewTab.value = 'repuestos'
      await catalogStore.fetchRepuestosByMotor(preservedMotor.id)
    } else {
      activeViewTab.value = 'motores'
    }
  } else if (selectedComponent.value) {
    activeViewTab.value = 'repuestos'
    await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id)
  } else {
    activeViewTab.value = 'motores'
  }
}

const onFocusModel = (e?: Event) => {
  isModelOpen.value = true
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
}
const onInputModel = async () => {
  isModelOpen.value = true
  motorCurrentPage.value = 1
  if (motorInput.value.trim()) {
    showAllMotors.value = true
  }
  if (selectedModel.value && normalizeText(modelInput.value) !== normalizeText(selectedModel.value.nombre)) {
    const preservedMotor = selectedMotor.value
    const prevMotorModelIds = [...catalogStore.modeloIdsDelMotor]
    selectedModel.value = null
    await catalogStore.selectModelo(null)
    if (preservedMotor) {
      const modQuery = normalizeText(modelInput.value)
      const stillMatches = !modQuery || getMotorModelNamesList(preservedMotor).some(n => normalizeText(n).includes(modQuery))
      if (stillMatches) {
        selectedMotor.value = preservedMotor
        catalogStore.selectedMotorId = preservedMotor.id
        catalogStore.modeloIdsDelMotor = prevMotorModelIds.length > 0 ? prevMotorModelIds : [...(preservedMotor.modelo_ids || [])]
      } else {
        selectedMotor.value = null
      }
    }
    if (selectedComponent.value) {
      activeViewTab.value = 'repuestos'
      if (selectedMotor.value) {
        await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
      } else {
        await catalogStore.fetchRepuestosByGrupo(selectedComponent.value.category, undefined, selectedBrand.value?.id)
      }
    } else if (selectedMotor.value && activeViewTab.value === 'repuestos') {
      await catalogStore.fetchRepuestosByMotor(selectedMotor.value.id)
    } else {
      activeViewTab.value = 'motores'
    }
  }
}
const onFocusMotor = (e?: Event) => {
  isMotorOpen.value = false
  activeViewTab.value = 'motores'
  showAllMotors.value = true
  if (e?.target) {
    (e.target as HTMLInputElement).select?.()
  }
}
const onInputMotor = () => {
  isMotorOpen.value = false
  motorCurrentPage.value = 1
  // Al cambiar el filtro de motor, limpiar selección puntual y volver a mostrar los motores disponibles en la tabla
  if (selectedMotor.value) {
    selectedMotor.value = null
    catalogStore.selectedMotorId = null
    catalogStore.modeloIdsDelMotor = []
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
  isMotorOpen.value = false

  // Limpiar filtros dimensionales previos para el nuevo motor
  resetMeasurementsFilters()

  await catalogStore.selectMotor(mot.id)

  // Actualizar marca acorde al motor elegido
  if (mot.fabricante_id && (!selectedBrand.value || selectedBrand.value.id !== mot.fabricante_id)) {
    const fab = catalogStore.fabricantes.find(f => f.id === mot.fabricante_id) || mot.fabricante
    if (fab) {
      selectedBrand.value = fab
      brandInput.value = fab.nombre.toUpperCase()
    }
  }

  // Si el motor ya trae modelo asignado (o único modelo compatible), seleccionarlo automáticamente;
  // de lo contrario, limpiar cualquier modelo previo incompatible.
  const resolvedModelId = catalogStore.selectedModeloId || mot.modelo_id || mot.modelo?.id || null
  if (resolvedModelId) {
    const mod =
      catalogStore.modelos.find(m => m.id === resolvedModelId) ||
      (mot.modelo && mot.modelo.id === resolvedModelId ? mot.modelo : null)
    if (mod) {
      selectedModel.value = mod
      modelInput.value = mod.nombre
    }
  } else if (catalogStore.availableModelos.length === 1) {
    const singleMod = catalogStore.availableModelos[0]
    selectedModel.value = singleMod
    modelInput.value = singleMod.nombre
    catalogStore.selectedModeloId = singleMod.id
  } else if (
    selectedModel.value &&
    !catalogStore.availableModelos.some(m => m.id === selectedModel.value?.id)
  ) {
    selectedModel.value = null
    modelInput.value = ''
  }

  // Al seleccionar un motor: cargar siempre sus repuestos (displayedParts filtra por selectedComponent automáticamente)
  activeViewTab.value = 'repuestos'
  await catalogStore.fetchRepuestosByMotor(mot.id)
}

const handleClearSelectedMotor = async () => {
  selectedMotor.value = null
  motorInput.value = ''
  isMotorOpen.value = false
  catalogStore.selectedMotorId = null
  catalogStore.modeloIdsDelMotor = []
  if (selectedBrand.value || selectedModel.value) {
    await catalogStore.fetchMotores(selectedBrand.value?.id, selectedModel.value?.id)
  }
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
  isMotorOpen.value = false
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

  if (selectedModel.value) {
    list = list.filter(m => doesMotorMatchModel(m, selectedModel.value!))
  } else if (modelInput.value.trim()) {
    const modQuery = normalizeText(modelInput.value)
    if (modQuery) {
      const matchingModelIds = new Set(
        catalogStore.modelos
          .filter(mod => normalizeText(mod.nombre).includes(modQuery))
          .map(mod => mod.id)
      )
      list = list.filter(m => {
        if (normalizeText(getMotorModelName(m)).includes(modQuery)) return true
        const mIds = [
          ...(m.modelo_id ? [m.modelo_id] : []),
          ...(Array.isArray(m.modelo_ids) ? m.modelo_ids : []),
          ...(Array.isArray((m.especificaciones_tecnicas as any)?.modelo_ids)
            ? ((m.especificaciones_tecnicas as any).modelo_ids as string[])
            : [])
        ]
        return mIds.some(id => matchingModelIds.has(id))
      })
    }
  }

  const q = motorInput.value.trim().toLowerCase()
  const isSelectedMotorCurrent = selectedMotor.value && (
    q === selectedMotor.value.codigo.toLowerCase().trim() ||
    (selectedMotor.value.nombre_comercial && q === selectedMotor.value.nombre_comercial.toLowerCase().trim()) ||
    (selectedMotor.value.denominacion_venta && q === selectedMotor.value.denominacion_venta.toLowerCase().trim())
  )

  if (q && !isSelectedMotorCurrent) {
    const matched = motorMatchMode.value === 'startsWith'
      ? list.filter(m => m.codigo.toLowerCase().trim().startsWith(q))
      : list.filter(m => m.codigo.toLowerCase().trim().includes(q))
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

watch([selectedBrand, selectedModel, modelInput, selectedYear, yearInput, motorInput, motorMatchMode], () => {
  motorCurrentPage.value = 1
})

const getMotorModelNamesList = (mot: Motor): string[] => {
  const names: string[] = []
  const seen = new Set<string>()
  const addName = (raw?: string | null) => {
    const clean = String(raw || '').replace(/\s+/g, ' ').trim()
    if (!clean || clean === '—' || clean === '-') return
    const key = normalizeText(clean)
    if (key && !seen.has(key)) {
      seen.add(key)
      names.push(clean)
    }
  }

  const allIds = [
    ...(Array.isArray(mot.modelo_ids) ? mot.modelo_ids : []),
    ...(Array.isArray((mot.especificaciones_tecnicas as any)?.modelo_ids)
      ? ((mot.especificaciones_tecnicas as any).modelo_ids as string[])
      : []),
    ...(mot.modelo_id ? [mot.modelo_id] : [])
  ]
  for (const mid of allIds) {
    const found = catalogStore.modelos.find(m => m.id === mid)
    if (found) addName(found.nombre)
  }

  if (mot.modelo?.nombre) addName(mot.modelo.nombre)
  if (Array.isArray(mot.modelos_nombres)) {
    mot.modelos_nombres.forEach(addName)
  }
  const specNames = (mot.especificaciones_tecnicas as any)?.modelos_nombres
  if (Array.isArray(specNames)) {
    specNames.forEach(addName)
  }
  return names
}

const getMotorModelName = (mot: Motor): string => {
  const names = getMotorModelNamesList(mot)
  if (names.length > 0) return names.join(', ')
  return mot.denominacion_venta || '—'
}

const getPartVehicleModelsLabel = (part: RepuestoTecnico): string => {
  const spec = (part.especificaciones_tecnicas as Record<string, unknown>) || {}
  const dims = (part.dimensiones as Record<string, unknown>) || {}
  const linkedFromStore = part.motor_id ? catalogStore.motores.find(m => m.id === part.motor_id) : undefined
  const linkedMot = linkedFromStore || part.motor

  const brandName = (
    part.motor?.fabricante?.nombre ||
    (linkedMot?.fabricante_id ? getBrandName(linkedMot.fabricante_id) : '') ||
    (spec.marca ? String(spec.marca) : '') ||
    (Array.isArray(spec.fabricantes) && spec.fabricantes[0] ? String(spec.fabricantes[0]) : '') ||
    (dims.marca ? String(dims.marca) : '')
  )
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

  const models: string[] = []
  const seen = new Set<string>()
  const addModelName = (raw?: string | null) => {
    for (const partTok of String(raw || '').split(/[,\/;|\n]+/)) {
      const clean = partTok.replace(/\s+/g, ' ').trim()
      if (!clean) continue
      const low = clean.toLowerCase()
      if (low === '—' || low === '-' || low === 'n/a' || low === 'na' || low === 'universal' || low === 'varios') continue
      const key = normalizeText(clean)
      if (key && !seen.has(key)) {
        seen.add(key)
        models.push(clean)
      }
    }
  }

  if (linkedMot) {
    getMotorModelNamesList(linkedMot).forEach(n => addModelName(n))
  }
  if (part.motor && part.motor !== linkedMot) {
    getMotorModelNamesList(part.motor).forEach(n => addModelName(n))
  }

  const pushJsonModels = (val: unknown) => {
    if (Array.isArray(val)) {
      val.forEach(v => pushJsonModels(v))
    } else if (typeof val === 'string' && val.trim()) {
      addModelName(val)
    }
  }
  pushJsonModels(spec.modelos)
  pushJsonModels(dims.modelos)
  pushJsonModels(spec.modelos_adicionales)
  pushJsonModels(dims.modelos_adicionales)
  pushJsonModels(spec.modelo)
  pushJsonModels(dims.modelo)

  if (models.length > 0) {
    const joined = models.join(', ')
    return brandName ? `${brandName} ${joined}` : joined
  }

  const rawVeh = String(spec.vehiculo || dims.vehiculo || '').replace(/\s+/g, ' ').trim()
  return rawVeh
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
  }
  if (ringIdx === 1) {
    if (prop === 'forma') return dims?.forma2 || '—'
  }
  if (ringIdx === 2) {
    if (prop === 'forma') return dims?.forma_oil || '—'
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
    // Caso Especializado: FAMILIAS EN TABLA / ANILLOS DE MOTOR (Diámetro, 1°..N°, Aceite y Diseño múltiple)
    if (isCurrentGroupRingsTable.value) {
      const extractNormalizedRings = (r: RepuestoTecnico) => {
        const subfilas = getPartSubfilas(r).filter(sf => !sf.es_fila_central)
        if (subfilas.length > 0) {
          const rows = subfilas.map((sf) => {
            const dVal = resolveSubfilaColumnValue(sf.medidas, { clave: 'diametro_cilindro_mm', etiqueta: 'Diámetro' })
            const hVal = resolveSubfilaColumnValue(sf.medidas, { clave: 'grosor_mm', etiqueta: 'Grosor' })
            const aVal = resolveSubfilaColumnValue(sf.medidas, { clave: 'altura_mm', etiqueta: 'Altura' })
            return {
              isOil: sf.nombre.toLowerCase().includes('aceite') || sf.nombre.toLowerCase().includes('oil'),
              d1: dVal != null && !isNaN(Number(dVal)) ? Number(dVal) : (r.diametro_cilindro_mm != null ? Number(r.diametro_cilindro_mm) : null),
              h1: hVal != null && !isNaN(Number(hVal)) ? Number(hVal) : null,
              a1: aVal != null && !isNaN(Number(aVal)) ? Number(aVal) : null
            }
          })
          const explicitOilIdx = rows.findIndex(x => x.isOil)
          const oilIdx = explicitOilIdx >= 0 ? explicitOilIdx : (rows.length >= 2 ? rows.length - 1 : -1)
          const oilRing = oilIdx >= 0 ? rows[oilIdx] : null
          const compRings = rows.filter((_, idx) => idx !== oilIdx)
          return { rows, compRings, oilRing }
        }
        const rings = getPartRingsList(r)
        const oilIdx = rings.findIndex(x =>
          String(x.posicion || '').toLowerCase().includes('aceite') ||
          String(x.posicion || '').toLowerCase().includes('oil')
        )
        const resolvedOilIdx = oilIdx >= 0 ? oilIdx : (rings.length >= 2 ? rings.length - 1 : -1)
        const oilRing = resolvedOilIdx >= 0 ? rings[resolvedOilIdx] : null
        const compRings = rings.filter((_, idx) => idx !== resolvedOilIdx)
        return { rows: rings, compRings, oilRing }
      }

      // Diámetro (la primera siempre)
      if (isFilterActive(filterAnilloDiametro.value)) {
        const tolAnilloDiametro = getTol('anilloDiametro')
        list = list.filter(r => {
          const { rows } = extractNormalizedRings(r)
          const d1 = rows.find(x => x.d1 != null)?.d1 ?? r.diametro_cilindro_mm
          return d1 != null && Math.abs(Number(d1) - (filterAnilloDiametro.value || 0)) <= tolAnilloDiametro
        })
      }

      // 1°, 2°, 3°, y ranuras adicionales dinámicas de compresión (4°, 5°...)
      const compressionFilters: Array<{ grosor?: number; altura?: number; tolKeyG: string; tolKeyA: string }> = [
        { grosor: filterAnilloGrosor1.value, altura: filterAnilloRadial1.value, tolKeyG: 'anilloGrosor1', tolKeyA: 'anilloRadial1' },
        { grosor: filterAnilloGrosor2.value, altura: filterAnilloRadial2.value, tolKeyG: 'anilloGrosor2', tolKeyA: 'anilloRadial2' },
        { grosor: filterAnilloGrosor3.value, altura: filterAnilloRadial3.value, tolKeyG: 'anilloGrosor3', tolKeyA: 'anilloRadial3' },
        ...extraRingFilters.value.map((slot, idx) => ({
          grosor: slot.grosor,
          altura: slot.altura,
          tolKeyG: `anilloGrosor${idx + 4}`,
          tolKeyA: `anilloRadial${idx + 4}`
        }))
      ]

      compressionFilters.forEach((cf, idx) => {
        if (isFilterActive(cf.grosor)) {
          const tol = getTol(cf.tolKeyG)
          list = list.filter(r => {
            const { compRings } = extractNormalizedRings(r)
            const h = compRings[idx]?.h1
            return h != null && Math.abs(Number(h) - (cf.grosor || 0)) <= tol
          })
        }
        if (isFilterActive(cf.altura)) {
          const tol = getTol(cf.tolKeyA)
          list = list.filter(r => {
            const { compRings } = extractNormalizedRings(r)
            const a = compRings[idx]?.a1
            return a != null && Math.abs(Number(a) - (cf.altura || 0)) <= tol
          })
        }
      })

      // Anillo de aceite: Grosor y Altura (siempre última fila)
      if (isFilterActive(filterAnilloGrosorAceite.value)) {
        const tol = getTol('anilloGrosorAceite')
        list = list.filter(r => {
          const { oilRing } = extractNormalizedRings(r)
          return oilRing?.h1 != null && Math.abs(Number(oilRing.h1) - (filterAnilloGrosorAceite.value || 0)) <= tol
        })
      }
      if (isFilterActive(filterAnilloRadialAceite.value)) {
        const tol = getTol('anilloRadialAceite')
        list = list.filter(r => {
          const { oilRing } = extractNormalizedRings(r)
          return oilRing?.a1 != null && Math.abs(Number(oilRing.a1) - (filterAnilloRadialAceite.value || 0)) <= tol
        })
      }

      // Filtro multi-select de Diseño de Anillos (chips acumulables)
      if (filterAnilloDisenos.value.length > 0) {
        const selectedTokens = filterAnilloDisenos.value.map(d => normalizeText(d))
        list = list.filter(r => {
          const partDesigns = getPartRingDesigns(r).map(d => normalizeText(d))
          const desc = normalizeText(getPartTechDescription(r))
          return selectedTokens.every(tok =>
            partDesigns.some(pd => pd.includes(tok) || tok.includes(pd)) ||
            (desc && desc.includes(tok))
          )
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
          const paramDef = currentGroupDefinition.value?.parametros.find(p => p.clave === key) || { clave: key, etiqueta: key }
          list = list.filter(r => {
            const dims = (r.dimensiones as any) || {}
            if (isPartEmbeddedTableFormat(r) || (Array.isArray(dims.subfilas) && dims.subfilas.length > 0) || (Array.isArray(dims.anillos) && dims.anillos.length > 0)) {
              const matchedInRow = getPartSubfilas(r).some((sf) => {
                if (sf.es_fila_central) return false
                const sfVal = resolveSubfilaColumnValue(sf.medidas, paramDef)
                if (sfVal === undefined || sfVal === null || sfVal === '') return false
                if (typeof filterVal === 'number' || (!Array.isArray(sfVal) && !isNaN(Number(filterVal)) && !isNaN(Number(sfVal)))) {
                  return Math.abs(Number(sfVal) - Number(filterVal)) <= tolParam
                }
                const strFlt = String(filterVal).toLowerCase().trim()
                const tokens = parseMultiOptionValues(sfVal).map(s => s.toLowerCase())
                if (tokens.some(t => t === strFlt || t.includes(strFlt) || strFlt.includes(t))) {
                  return true
                }
                const strSf = String(sfVal).toLowerCase().trim()
                return strSf.includes(strFlt) || strFlt.includes(strSf)
              })
              if (matchedInRow) return true
              if (Array.isArray(dims.subfilas) || Array.isArray(dims.anillos) || r.categoria === 'Anillos') return false
            }

            const partVal = getPartParamValue(r, key)
            if (partVal === undefined || partVal === null) return false

            // Comparación numérica con tolerancia individual de este parámetro
            if (typeof filterVal === 'number' || (!Array.isArray(partVal) && !isNaN(Number(filterVal)) && !isNaN(Number(partVal)))) {
              const numPart = Number(partVal)
              const numFilter = Number(filterVal)
              return Math.abs(numPart - numFilter) <= tolParam
            }

            // Comparación de texto / selección inteligente (soporta múltiples opciones)
            const partTokens = parseMultiOptionValues(partVal).map(s => s.toLowerCase())
            const strPart = partTokens.join(', ') || String(partVal).toLowerCase().trim()
            const strFilter = String(filterVal).toLowerCase().trim()

            // Manejo especial de posiciones automotrices (Admisión/IN vs Escape/EX)
            if (strFilter === 'in' || strFilter.includes('admis')) {
              return partTokens.some(t => t === 'in' || t.includes('admis')) || strPart === 'in' || strPart.includes('admis')
            }
            if (strFilter === 'ex' || strFilter.includes('escap')) {
              return partTokens.some(t => t === 'ex' || t.includes('escap')) || strPart === 'ex' || strPart.includes('escap')
            }

            return partTokens.some(t => t === strFilter || t.includes(strFilter) || strFilter.includes(t)) || strPart.includes(strFilter) || strFilter.includes(strPart)
          })
        }
      }
    }
  }

  // 1b. Filtros principales obligatorios sobre los componentes: Motor, Fabricante y Modelo
  if (selectedMotor.value) {
    const targetMotorId = selectedMotor.value.id
    list = list.filter(r => r.motor_id === targetMotorId || r.motor?.id === targetMotorId)
  } else if (motorInput.value.trim()) {
    const mq = motorInput.value.trim().toLowerCase()
    const matchingMotorIds = new Set(brandMotorsList.value.map(m => m.id))
    const codeMatches = (rawCode?: string | null) => {
      const c = String(rawCode || '').trim().toLowerCase()
      if (!c) return false
      return motorMatchMode.value === 'startsWith' ? c.startsWith(mq) : c.includes(mq)
    }
    list = list.filter(r => {
      if (r.motor_id && matchingMotorIds.has(r.motor_id)) return true
      if (r.motor?.id && matchingMotorIds.has(r.motor.id)) return true
      if (codeMatches(r.motor?.codigo)) return true
      const compat = (r.especificaciones_tecnicas as any)?.motores_compatibles
      if (Array.isArray(compat) && compat.some((c: unknown) => codeMatches(String(c)))) return true
      return false
    })
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
  filterAnilloGrosor3,
  filterAnilloRadial3,
  filterAnilloGrosorAceite, 
  filterAnilloRadialAceite,
  filterAnilloDisenos,
  extraRingFilters
], () => {
  currentPartsPage.value = 1
}, { deep: true })

// Badges de marcas y catálogos
const getBrandBadgeClass = (brand?: string | null): string => {
  const b = String(brand || '').toLowerCase().trim()
  if (b.includes('dokuro')) return 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
  if (b.includes('rik')) return 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold'
  if (b.includes('ndc')) return 'bg-cyan-100 text-cyan-800 border-cyan-300 font-bold'
  if (b.includes('taiho')) return 'bg-purple-100 text-purple-800 border-purple-300 font-bold'
  if (b.includes('ajusa')) return 'bg-[#0f2d59] text-white border-blue-950 font-bold'
  if (b.includes('mrk') || b.includes('mkr')) return 'bg-sky-100 text-sky-800 border-sky-300 font-bold'
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
const lightboxInitialIndex = ref<number>(0)

const openLightbox = (part: RepuestoTecnico, initialIndex = 0) => {
  const imgs = getPartImagesList(part)
  if (!part || imgs.length === 0) return
  lightboxPart.value = part
  lightboxInitialIndex.value = initialIndex >= 0 && initialIndex < imgs.length ? initialIndex : 0
  isLightboxOpen.value = true
}

const closeLightbox = () => {
  isLightboxOpen.value = false
  lightboxPart.value = null
  lightboxInitialIndex.value = 0
}

const openTechnicalSheet = (part: RepuestoTecnico) => {
  modalPart.value = part
  modalTableOrientation.value = getPartIsBearingLike(part) ? 'vertical' : currentTableOrientation.value
  previewPdfUrl.value = null
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
  isComponentOpen.value = false
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
  adminModalEditPart.value = null
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
  adminModalEditPart.value = null
  showToast(`✓ Familia "${updatedGroup.nombre}" actualizada con ${updatedGroup.parametros.length} parámetros técnicos`)
  await catalogStore.fetchGrupos()
  const found = componentGroups.value.find(g => g.id === updatedGroup.codigo || g.id === updatedGroup.id)
  if (found) {
    selectedComponent.value = found
    await catalogStore.fetchRepuestosByGrupo(found.category, undefined, selectedBrand.value?.id)
  }
}

const onGroupDeleted = async (deletedGroupId?: string) => {
  isAdminModalOpen.value = false
  adminModalEditGroupId.value = null
  adminModalEditPart.value = null
  const currentId = selectedComponent.value?.id
  await catalogStore.fetchGrupos()
  if (
    currentId &&
    (currentId === deletedGroupId || !componentGroups.value.some(g => g.id === currentId))
  ) {
    selectedComponent.value = null
    componentInput.value = ''
  }
  showToast('✓ Familia eliminada del catálogo')
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
  if (!target.closest('.combobox-motor')) isMotorOpen.value = false
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
        class="fixed bottom-6 right-6 z-50 bg-[#19314D] text-white px-4 py-2.5 rounded-xl shadow-2xl border border-[#C1E8EF]/35 flex items-center gap-2.5 popover-pop-in"
      >
        <CheckCircle2 class="w-4 h-4 text-[#BFEBF2] shrink-0" />
        <span class="text-xs font-semibold">{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ========================================================================= -->
    <!-- HEADER SECTION (HORIZON GARAGE STUDIO)                                    -->
    <!-- ========================================================================= -->
    <div class="studio-hero-banner p-6 sm:p-7 text-white relative overflow-hidden">
      <div class="pointer-events-none absolute -top-16 -right-12 w-60 h-60 rounded-full bg-[#04C4D9]/25 blur-3xl"></div>
      <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="space-y-1.5">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
            <span class="w-2 h-2 rounded-full bg-[#BFEBF2] animate-pulse"></span>
            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#BFEBF2]">
              CATÁLOGO · MOTORES, MEDIDAS Y REPUESTOS
            </span>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Catálogo Técnico
          </h1>
          <p class="text-xs sm:text-sm text-blue-100/90">
            Consulta paramétrica de motores, tolerancias métricas y compatibilidad de repuestos.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            @click="openAdminCatalogModal('repuesto')"
            class="studio-cta-primary px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            title="Dar de alta repuesto en catálogo"
          >
            <Plus class="w-4 h-4 stroke-[2.5]" />
            <span>+ Repuesto</span>
          </button>

          <button
            type="button"
            @click="handleCreateNewGroup"
            class="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm text-xs font-bold transition-all duration-150 flex items-center gap-1.5 active:scale-[0.97] cursor-pointer"
            title="Crear nueva familia de componentes paramétricos"
          >
            <FolderPlus class="w-3.5 h-3.5 text-[#BFEBF2]" />
            <span>+ Nueva Familia</span>
          </button>

          <button
            type="button"
            @click="handleResetAll"
            class="px-3.5 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition-all duration-150 active:scale-[0.97] flex items-center gap-1.5 cursor-pointer"
            title="Restaurar registros y filtros"
          >
            <RotateCcw class="w-3.5 h-3.5 text-[#BFEBF2]" />
            <span>Restaurar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Banner de Error si falla la conexión -->
    <div 
      v-if="catalogStore.error || catalogStore.repuestosError" 
      class="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-rose-800 text-xs font-semibold"
    >
      <div class="flex items-center gap-2">
        <AlertTriangle class="w-4 h-4 text-rose-600 shrink-0" />
        <span>{{ catalogStore.error || catalogStore.repuestosError }}</span>
      </div>
      <button 
        type="button"
        @click="catalogStore.initCatalog()"
        class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
      >
        <RefreshCw class="w-3 h-3" />
        <span>Reintentar</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- BARRA SUPERIOR FIJA: FILTROS REACTIVOS EN CASCADA                         -->
    <!-- ========================================================================= -->
    <div class="sticky top-[72px] z-20 studio-card backdrop-blur-md p-2.5 sm:p-3 space-y-1.5 overflow-visible">
      
      <!-- Fila Superior: Buscador Universal + Chips Activos + Pestañas + Botón Filtros Móvil -->
      <div class="flex items-center gap-2 flex-wrap lg:flex-nowrap">
        <div class="relative flex-1 min-w-[200px]">
          <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            v-model="searchInput"
            @input="handleSearchInput"
            type="text"
            placeholder="Buscar por código OEM, cruce o descripción..."
            class="w-full pl-8 pr-12 py-1.5 h-[32px] text-[11px] placeholder:text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9] focus:ring-1 focus:ring-[#04C4D9] transition"
          />
          <div class="absolute right-2 top-1.5 flex items-center gap-1">
            <Loader2 v-if="catalogStore.isSearching" class="w-3.5 h-3.5 text-[#04C4D9] animate-spin" />
            <button
              v-if="searchInput"
              type="button"
              @click="handleClearSearch"
              class="p-0.5 text-slate-400 hover:text-slate-600 rounded"
              title="Limpiar búsqueda"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Badges activos integrados en la fila superior -->
        <div v-if="selectedBrand || selectedModel || selectedMotor || motorInput.trim() || selectedYear || selectedComponent" class="hidden md:flex items-center gap-1 flex-wrap">
          <span v-if="selectedBrand || brandInput" class="px-2 py-0.5 rounded-md bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] text-[11px] font-bold">
            {{ selectedBrand?.nombre || brandInput }}
          </span>
          <span v-if="selectedModel" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold">
            <span>{{ selectedModel.nombre }}</span>
            <button type="button" @click="handleClearSelectedModel" class="text-slate-400 hover:text-rose-500 cursor-pointer"><X class="w-2.5 h-2.5" /></button>
          </span>
          <span v-if="selectedMotor || motorInput.trim()" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1E446E] text-white font-mono text-[11px] font-bold">
            <span>{{ selectedMotor?.codigo || motorInput.trim().toUpperCase() }}</span>
            <button type="button" @click="handleClearSelectedMotor" class="text-slate-300 hover:text-rose-300 cursor-pointer"><X class="w-2.5 h-2.5" /></button>
          </span>
          <span v-if="selectedYear" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[11px] font-bold">
            <span>{{ selectedYear }}</span>
            <button type="button" @click="selectedYear = ''" class="text-amber-500 hover:text-rose-500 cursor-pointer"><X class="w-2.5 h-2.5" /></button>
          </span>
          <span v-if="selectedComponent" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-[#0D1B3E] border border-sky-200 text-[11px] font-bold">
            <span>{{ selectedComponent.title }}</span>
            <button type="button" @click="handleClearSelectedComponent" class="text-sky-500 hover:text-rose-500 cursor-pointer"><X class="w-2.5 h-2.5" /></button>
          </span>
        </div>

        <!-- Pestañas para alternar entre lista de motores y repuestos -->
        <div v-if="selectedComponent" class="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
          <button
            type="button"
            @click="activeViewTab = 'motores'"
            :class="[
              'px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer',
              activeViewTab === 'motores' ? 'bg-white text-[#1E446E] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Motores ({{ brandMotorsList.length }})
          </button>
          <button
            type="button"
            @click="activeViewTab = 'repuestos'"
            :class="[
              'px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer',
              activeViewTab === 'repuestos' ? 'bg-white text-[#147488] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Repuestos ({{ displayedParts.length }})
          </button>
        </div>

        <!-- Botón Toggle de Filtros Avanzados (Solo Móvil / Tablet < lg) -->
        <button
          type="button"
          @click="isMobileFiltersOpen = !isMobileFiltersOpen"
          class="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 border shadow-2xs select-none active:scale-95"
          :class="isMobileFiltersOpen 
            ? 'bg-[#004B97] text-white border-[#004B97]' 
            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'"
          :title="isMobileFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros de vehículo y motor'"
        >
          <SlidersHorizontal class="w-3.5 h-3.5 text-[#147488]" />
          <span>Filtros</span>
          <span 
            v-if="activeFilterCount > 0" 
            class="w-4 h-4 rounded-full bg-[#147488] text-white text-[10px] font-black flex items-center justify-center leading-none"
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
          'gap-2 items-end transition-all duration-200',
          isMobileFiltersOpen 
            ? 'grid grid-cols-2 lg:grid-cols-5 pt-0.5' 
            : 'hidden lg:grid lg:grid-cols-5'
        ]"
      >
        
        <!-- 1. FABRICANTE -->
        <div class="relative combobox-brand">
          <div class="flex items-center justify-between mb-0.5 min-h-[18px]">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Fabricante
            </label>
          </div>

          <div class="h-[32px] flex items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-[#04C4D9] focus-within:ring-1 focus-within:ring-[#04C4D9] transition overflow-hidden">
            <input
              ref="brandInputRef"
              v-model="brandInput"
              @focus="handleFocusBrand"
              @click="handleFocusBrand"
              @input="onInputBrand()"
              @keydown="handleBrandKeydown"
              type="text"
              placeholder="Fabricante..."
              class="flex-1 min-w-0 h-full pl-2.5 pr-1 text-[11px] placeholder:text-[11px] font-bold bg-transparent focus:outline-none"
            />
            <div class="flex items-center gap-0.5 pr-1.5 pl-1 border-l border-slate-200/80 shrink-0">
              <button
                v-if="editableBrandTarget"
                type="button"
                @click="openEditBrandModal(editableBrandTarget)"
                class="p-1 text-slate-500 hover:text-[#004B97] rounded transition cursor-pointer"
                title="Editar o eliminar marca"
              >
                <Edit3 class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="openQuickCreateBrandModal(brandInput)"
                class="p-1 text-[#038391] hover:text-[#04C4D9] rounded transition cursor-pointer"
                title="Nueva marca"
              >
                <Plus class="w-3 h-3" />
              </button>
              <button
                v-if="brandInput"
                type="button"
                @click="handleClearSelectedBrand"
                class="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpiar marca"
              >
                <X class="w-3 h-3" />
              </button>
              <ChevronDown
                @click="isBrandOpen = !isBrandOpen"
                class="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600"
              />
            </div>
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
                <button
                  type="button"
                  @click.stop="openEditBrandModal(fab)"
                  class="p-1 text-slate-400 hover:text-[#004B97] hover:bg-blue-50 rounded transition cursor-pointer"
                  :title="`Editar marca ${fab.nombre}`"
                >
                  <Edit3 class="w-3 h-3" />
                </button>
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
              class="w-full px-3 py-2.5 text-left text-xs font-bold text-[#12697A] bg-[#E3F5F8]/80 hover:bg-[#147488] hover:text-white transition flex items-center justify-between border-t border-[#C1E8EF] cursor-pointer"
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
          <div class="flex items-center justify-between mb-0.5 gap-1 min-h-[18px]">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Motor
            </label>
            <div class="flex items-center gap-1">
              <!-- Buscador Dual de Motores: Inicia vs Cont -->
              <div
                class="inline-flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-200 text-[9px] font-extrabold"
                title="Cambiar modo de coincidencia al buscar código de motor"
              >
                <button
                  type="button"
                  @click="motorMatchMode = 'startsWith'"
                  :class="[
                    'px-1.5 py-0.2 rounded transition cursor-pointer',
                    motorMatchMode === 'startsWith'
                      ? 'bg-[#1E446E] text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  ]"
                  title="Búsqueda ordenada: códigos que comienzan con lo escrito (ej. 8L -> 8L...)"
                >
                  Inicia
                </button>
                <button
                  type="button"
                  @click="motorMatchMode = 'contains'"
                  :class="[
                    'px-1.5 py-0.2 rounded transition cursor-pointer',
                    motorMatchMode === 'contains'
                      ? 'bg-[#147488] text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  ]"
                  title="Búsqueda flexible: códigos o nombres que contengan el texto"
                >
                  Cont
                </button>
              </div>
              <button
                type="button"
                @click="toggleMotorsWithPartsOnly"
                class="text-[9px] font-bold px-1.5 py-0.5 rounded transition cursor-pointer"
                :class="catalogStore.onlyMotorsWithParts 
                  ? 'bg-[#04C4D9]/15 text-[#038391] border border-[#04C4D9]/40' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'"
                :title="catalogStore.onlyMotorsWithParts ? 'Mostrando solo motores con repuestos' : 'Mostrando todos los motores'"
              >
                {{ catalogStore.onlyMotorsWithParts ? 'C/Rep' : 'Todos' }}
              </button>
            </div>
          </div>

          <div class="h-[32px] flex items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-[#04C4D9] focus-within:ring-1 focus-within:ring-[#04C4D9] transition overflow-hidden">
            <input
              ref="motorInputRef"
              v-model="motorInput"
              @focus="onFocusMotor"
              @click="onFocusMotor"
              @input="onInputMotor"
              @keydown="handleMotorKeydown"
              type="text"
              placeholder="Motor..."
              class="flex-1 min-w-0 h-full pl-2.5 pr-1 text-[11px] placeholder:text-[11px] font-mono font-bold bg-transparent focus:outline-none"
            />
            <div class="flex items-center gap-0.5 pr-1.5 pl-1 border-l border-slate-200/80 shrink-0">
              <button
                v-if="editableMotorTarget"
                type="button"
                @click="openEditMotorModal(editableMotorTarget)"
                class="p-1 text-slate-500 hover:text-[#004B97] rounded transition cursor-pointer"
                :title="`Editar o eliminar motor ${editableMotorTarget.codigo}`"
              >
                <Edit3 class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="openQuickCreateMotorModal(motorInput)"
                class="p-1 text-[#038391] hover:text-[#04C4D9] rounded transition cursor-pointer"
                title="Nuevo motor"
              >
                <Plus class="w-3 h-3" />
              </button>
              <button
                v-if="motorInput"
                type="button"
                @click="handleClearSelectedMotor"
                class="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpiar motor"
              >
                <X class="w-3 h-3" />
              </button>
              <ChevronDown
                @click="onFocusMotor(); motorInputRef?.focus()"
                class="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600"
              />
            </div>
          </div>
        </div>

        <!-- 3. MODELO -->
        <div class="relative combobox-model">
          <div class="flex items-center justify-between mb-0.5 min-h-[18px]">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Modelo
            </label>
          </div>

          <div class="h-[32px] flex items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-[#04C4D9] focus-within:ring-1 focus-within:ring-[#04C4D9] transition overflow-hidden">
            <input
              ref="modelInputRef"
              v-model="modelInput"
              @focus="onFocusModel"
              @click="onFocusModel"
              @input="onInputModel(); highlightedModelIdx = 0"
              @keydown="handleModelKeydown"
              type="text"
              :placeholder="selectedMotor ? ('Modelos con ' + selectedMotor.codigo + '...') : 'Modelo...'"
              class="flex-1 min-w-0 h-full pl-2.5 pr-1 text-[11px] placeholder:text-[11px] font-bold bg-transparent focus:outline-none"
            />
            <div class="flex items-center gap-0.5 pr-1.5 pl-1 border-l border-slate-200/80 shrink-0">
              <button
                v-if="editableModelTarget"
                type="button"
                @click="openEditModelModal(editableModelTarget)"
                class="p-1 text-slate-500 hover:text-[#004B97] rounded transition cursor-pointer"
                title="Editar o eliminar modelo"
              >
                <Edit3 class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="openQuickCreateModelModal(modelInput)"
                class="p-1 text-[#038391] hover:text-[#04C4D9] rounded transition cursor-pointer"
                title="Nuevo modelo"
              >
                <Plus class="w-3 h-3" />
              </button>
              <button
                v-if="modelInput"
                type="button"
                @click="handleClearSelectedModel"
                class="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpiar modelo"
              >
                <X class="w-3 h-3" />
              </button>
              <ChevronDown
                @click="isModelOpen = !isModelOpen"
                class="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600"
              />
            </div>
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
                <button
                  type="button"
                  @click.stop="openEditModelModal(mod)"
                  class="p-1 text-slate-400 hover:text-[#004B97] hover:bg-blue-50 rounded transition cursor-pointer"
                  :title="`Editar modelo ${mod.nombre}`"
                >
                  <Edit3 class="w-3 h-3" />
                </button>
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
              class="w-full px-3 py-2.5 text-left text-xs font-bold text-[#12697A] bg-[#E3F5F8]/80 hover:bg-[#147488] hover:text-white transition flex items-center justify-between border-t border-[#C1E8EF] cursor-pointer"
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
          <div class="flex items-center justify-between mb-0.5 min-h-[18px]">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Año
            </label>
          </div>

          <div class="h-[32px] flex items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-[#04C4D9] focus-within:ring-1 focus-within:ring-[#04C4D9] transition overflow-hidden">
            <input
              v-model="yearInput"
              @focus="isYearOpen = true"
              @click="isYearOpen = true"
              @input="onInputYear"
              @keydown.enter.prevent="filteredYears[0] ? handleSelectYear(filteredYears[0]) : (yearInput.trim() ? handleSaveQuickYear(yearInput) : null)"
              type="text"
              placeholder="Todos..."
              class="flex-1 min-w-0 h-full pl-2.5 pr-1 text-[11px] placeholder:text-[11px] font-mono font-bold bg-transparent focus:outline-none"
            />
            <div class="flex items-center gap-0.5 pr-1.5 pl-1 border-l border-slate-200/80 shrink-0">
              <button
                type="button"
                @click="openQuickCreateYearModal(yearInput)"
                class="p-1 text-[#038391] hover:text-[#04C4D9] rounded transition cursor-pointer"
                title="Nuevo año"
              >
                <Plus class="w-3 h-3" />
              </button>
              <button
                v-if="selectedYear || yearInput"
                type="button"
                @click="handleClearYear"
                class="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpiar año"
              >
                <X class="w-3 h-3" />
              </button>
              <ChevronDown
                @click="isYearOpen = !isYearOpen"
                class="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600"
              />
            </div>
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
              class="w-full px-3 py-2.5 text-left text-xs font-bold text-[#12697A] bg-[#E3F5F8]/80 hover:bg-[#147488] hover:text-white transition flex items-center justify-between border-t border-[#C1E8EF] cursor-pointer"
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
          <div class="flex items-center justify-between mb-0.5 min-h-[18px]">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Componente
            </label>
          </div>

          <div class="h-[32px] flex items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:bg-white focus-within:border-[#04C4D9] focus-within:ring-1 focus-within:ring-[#04C4D9] transition overflow-hidden">
            <input
              ref="componentInputRef"
              v-model="componentInput"
              @focus="handleFocusComponent"
              @click="handleFocusComponent"
              @input="isComponentOpen = true; highlightedComponentIdx = 0"
              @keydown="handleComponentKeydown"
              type="text"
              placeholder="Componente..."
              class="flex-1 min-w-0 h-full pl-2.5 pr-1 text-[11px] placeholder:text-[11px] font-bold bg-transparent focus:outline-none"
            />
            <div class="flex items-center gap-0.5 pr-1.5 pl-1 border-l border-slate-200/80 shrink-0">
              <button
                v-if="editableComponentTarget"
                type="button"
                @click="handleEditGroup(editableComponentTarget.id)"
                class="p-1 text-slate-500 hover:text-[#004B97] rounded transition cursor-pointer"
                title="Editar o eliminar familia"
              >
                <Edit3 class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="handleCreateNewGroup"
                class="p-1 text-[#038391] hover:text-[#04C4D9] rounded transition cursor-pointer"
                title="Nueva familia"
              >
                <Plus class="w-3 h-3" />
              </button>
              <button
                v-if="componentInput"
                type="button"
                @click="handleClearSelectedComponent"
                class="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpiar componente"
              >
                <X class="w-3 h-3" />
              </button>
              <ChevronDown
                @click="isComponentOpen = !isComponentOpen"
                class="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600"
              />
            </div>
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
              <div class="flex items-center gap-2.5 min-w-0">
                <CircleDot v-if="grp.id === 'ajuste_valvula' || grp.category === 'Sellos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Wrench v-else-if="grp.id === 'valvula' || grp.category === 'Válvulas'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'anillos_motor' || grp.category === 'Anillos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <FileText v-else-if="grp.id === 'tornillos_culata' || grp.category === 'Pernos'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <CircleDot v-else-if="grp.id === 'casqueteria' || grp.category === 'Casquetería'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else-if="grp.id === 'empaques_juntas' || grp.category === 'Empaques'" class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <Layers v-else class="w-4 h-4 text-[#04C4D9] shrink-0" />
                <span class="font-bold text-slate-900 text-xs truncate">{{ grp.title }}</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  type="button"
                  @click.stop="handleEditGroup(grp.id)"
                  class="p-1 text-slate-400 hover:text-[#004B97] hover:bg-blue-50 rounded transition cursor-pointer"
                  :title="`Editar componente ${grp.title}`"
                >
                  <Edit3 class="w-3 h-3" />
                </button>
                <Check v-if="selectedComponent?.id === grp.id" class="w-4 h-4 text-[#04C4D9]" />
              </div>
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
            class="w-full py-2 bg-[#1E446E] hover:bg-[#19314D] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm cursor-pointer"
          >
            <ChevronUp class="w-3.5 h-3.5 text-[#BFEBF2]" />
            <span>Ocultar filtros y ver resultados</span>
          </button>
        </div>

      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- ESTADO 1: PANTALLA INICIAL (MINIMALISTA)                                   -->
    <!-- ========================================================================= -->
    <div 
      v-if="!selectedBrand && !brandInput && !selectedMotor && !motorInput && !selectedModel && !selectedYear && !yearInput && !selectedComponent && !searchInput && !showAllMotors" 
      class="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 text-center max-w-lg mx-auto space-y-3.5 my-6"
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
      <div class="studio-card rounded-2xl shadow-2xs overflow-hidden">
        
        <!-- Barra de Estado / Paginación Resumen -->
        <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white py-2 px-4 flex items-center justify-between text-xs font-medium">
          <span class="text-sky-100 font-mono text-[11px]">
            Mostrando {{ motorStartIndex + 1 }}-{{ motorEndIndex }} de {{ brandMotorsList.length }} motores
          </span>
          <span class="text-[11px] text-[#BFEBF2] font-semibold font-sans">Página {{ motorCurrentPage }} / {{ motorTotalPages }}</span>
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
                      class="text-[9px] px-1.5 py-0.2 rounded bg-[#147488] text-white font-bold"
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

                <!-- 12. Editar / eliminar motor -->
                <td class="py-2 px-2 text-center align-middle" @click.stop>
                  <button
                    type="button"
                    @click="openEditMotorModal(mot, $event)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-[#004B97] hover:bg-blue-50 transition cursor-pointer"
                    title="Editar o eliminar motor, modelo o año"
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
      <div v-if="selectedComponent" class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
        
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
                  ? 'bg-[#147488] text-white shadow-2xs'
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
          <!-- Botón + Anillo adicional (4°, 5°...) y cilindros -->
          <div
            v-if="extraRingFilters.length < 5 || selectedMotor?.cilindros"
            class="flex items-center justify-end gap-2 flex-wrap"
          >
            <button
              v-if="extraRingFilters.length < 5"
              type="button"
              @click="addExtraRingFilterSlot"
              class="px-2.5 py-1 rounded-lg bg-white border border-cyan-300 hover:bg-cyan-50 text-[10px] font-extrabold text-[#004B97] flex items-center gap-1 shadow-2xs transition cursor-pointer"
              title="Agregar filtro para 4° anillo, 5° anillo, etc."
            >
              <Plus class="w-3 h-3 text-[#04C4D9]" />
              <span>+ {{ extraRingFilters.length + 4 }}° Anillo</span>
            </button>
            <div v-if="selectedMotor?.cilindros" class="flex items-center gap-1.5 text-[10px] text-cyan-800 bg-cyan-50/80 px-2.5 py-1 rounded-md border border-cyan-200/70 font-medium">
              <span class="font-bold text-[#038391]">{{ selectedMotor.cilindros }} Cilindros</span>
            </div>
          </div>

          <!-- Campos de búsqueda: Diámetro + Anillos numerados (1°, 2°, 3°, 4°...) + Anillo de aceite SIEMPRE al final -->
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <!-- Diámetro (siempre primero) -->
            <div v-if="isTableParamInFilter('diametro_cilindro_mm')" class="bg-blue-50/50 p-2 rounded-lg border border-blue-200/90 flex flex-col justify-between">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[10px] font-black uppercase tracking-wider text-[#004B97] truncate" title="Diámetro nominal del cilindro / pistón">
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
              <span class="text-[9px] text-slate-500 mt-1 block">Diámetro ({{ getTableParamUnit('diametro_cilindro_mm', 'mm') || 'mm' }})</span>
            </div>

            <!-- 1er Anillo (Fuego): Grosor y Altura -->
            <div v-if="isTableParamInFilter('anillo1_h1') || isTableParamInFilter('anillo1_a1')" class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/90">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                <span>1er Anillo</span>
                <span class="text-[9px] text-slate-400 font-normal">Fuego</span>
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

            <!-- 2do Anillo: Grosor y Altura -->
            <div v-if="isTableParamInFilter('anillo2_h1') || isTableParamInFilter('anillo2_a1')" class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/90">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                <span>2do Anillo</span>
                <span class="text-[9px] text-slate-400 font-normal">Compr.</span>
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

            <!-- 3er Anillo: Grosor y Altura -->
            <div class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/90">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                <span>3er Anillo</span>
                <span class="text-[9px] text-[#038391] font-mono font-semibold">Compr.</span>
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

            <!-- Anillos adicionales dinámicos (4°, 5°, ... antes del anillo de aceite) -->
            <div
              v-for="(slot, sIdx) in extraRingFilters"
              :key="`extra-ring-flt-${sIdx}`"
              class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/90"
            >
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 mb-1 flex items-center justify-between">
                <span>{{ sIdx + 4 }}° Anillo</span>
                <button
                  type="button"
                  @click="removeExtraRingFilterSlot(sIdx)"
                  class="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  title="Quitar filtro de este anillo"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div>
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Grosor</label>
                    <ToleranceBadge v-model="filterTolerancias[`anilloGrosor${sIdx + 4}`]" :fallback="filterToleranciaMm" :step="0.02" />
                  </div>
                  <input
                    v-model.number="slot.grosor"
                    type="number"
                    step="0.05"
                    placeholder="2.0"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-0.5">
                    <label class="block text-[9px] font-bold uppercase text-slate-600 truncate">Altura</label>
                    <ToleranceBadge v-model="filterTolerancias[`anilloRadial${sIdx + 4}`]" :fallback="filterToleranciaMm" :step="0.05" />
                  </div>
                  <input
                    v-model.number="slot.altura"
                    type="number"
                    step="0.05"
                    placeholder="3.0"
                    class="w-full px-2 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                  />
                </div>
              </div>
            </div>

            <!-- Anillo de aceite: con los otros anillos (siempre última posición de los anillos) -->
            <div
              v-if="isTableParamInFilter('aceite_h1') || isTableParamInFilter('aceite_a1')"
              class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/90"
            >
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                <span>Anillo Aceite</span>
                <span class="text-[9px] text-slate-400 font-normal">Rasc.</span>
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

            <!-- Filtro Multi-Select de Diseño de Anillos (Chips acumulables) -->
            <div class="col-span-full bg-slate-50/80 p-2 rounded-xl border border-slate-200/90 flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-600 mr-1">
                Diseño de Anillos:
              </span>
              <button
                v-for="chip in RING_DESIGN_FILTER_OPTIONS"
                :key="`flt-design-${chip}`"
                type="button"
                @click="toggleFilterAnilloDiseno(chip)"
                :class="[
                  'px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer flex items-center gap-1',
                  filterAnilloDisenos.some(d => d.toLowerCase() === chip.toLowerCase())
                    ? 'bg-[#004B97] text-white border-[#004B97] shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                ]"
              >
                <Check v-if="filterAnilloDisenos.some(d => d.toLowerCase() === chip.toLowerCase())" class="w-2.5 h-2.5 text-[#04C4D9]" />
                <span>{{ chip }}</span>
              </button>
              <button
                v-if="filterAnilloDisenos.length > 0"
                type="button"
                @click="filterAnilloDisenos = []"
                class="text-[10px] font-bold text-rose-600 hover:underline ml-1 cursor-pointer"
              >
                Limpiar diseños ({{ filterAnilloDisenos.length }})
              </button>
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
          <div v-if="hasGroupedFilterBlocks" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
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
      <div class="studio-card rounded-2xl shadow-2xs overflow-hidden">
        
        <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap text-xs font-bold">
          <span class="flex items-center gap-1.5">
            <span>{{ selectedComponent?.title || 'Piezas Técnicas' }}</span>
            <span class="font-normal text-[#BFEBF2] font-mono text-[11px]">({{ displayedParts.length }} registros)</span>
          </span>
          <div class="flex items-center gap-2 ml-auto">
            <button
              v-if="isTechnicalOrientationAvailable"
              type="button"
              @click="toggleCurrentTableOrientation"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[#04C4D9] text-[11px] font-bold transition cursor-pointer"
              :title="currentTableOrientation === 'vertical' ? 'Cambiar vista de tabla a Horizontal' : 'Cambiar vista de tabla a Vertical'"
            >
              <ArrowUpDown class="w-3 h-3" />
              <span>{{ currentTableOrientation === 'vertical' ? 'Vista Vertical' : 'Vista Horizontal' }}</span>
            </button>
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
        </div>

        <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table class="w-full text-left text-xs border-separate border-spacing-0">
            <!-- Caso A: Cabecera con Sub-columnas Anidadas de 2 Niveles (Solo Vista Normal Horizontal con sub-columnas) -->
            <thead v-if="hasGroupSubcolumns && !isCurrentGroupTableView && currentTableOrientation === 'horizontal'" class="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th rowspan="2" class="py-1.5 px-3 w-44 min-w-[150px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Componente
                </th>
                <th rowspan="2" class="py-1.5 px-2.5 w-40 min-w-[140px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Código OEM
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

            <!-- Caso B: Cabecera Estándar de 4 Columnas (Vista Normal plana o Vista en Tabla con sub-tabla incrustada) -->
            <thead v-else class="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th class="py-1.5 px-3 w-44 min-w-[150px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Componente
                </th>
                <th class="py-1.5 px-2.5 w-40 min-w-[140px] whitespace-nowrap align-middle border-b border-r border-slate-200 bg-slate-100/95">
                  Código OEM
                </th>
                
                <th v-if="isCurrentGroupTableView" class="py-1.5 px-3 min-w-[260px] whitespace-nowrap align-middle border-b border-slate-200 bg-slate-100/95">
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
                <td class="py-2 px-3 border-b border-slate-100"><div class="h-3.5 w-28 bg-slate-200 rounded"></div></td>
                <td class="py-2 px-2.5 border-b border-slate-100"><div class="h-3.5 w-24 bg-slate-200 rounded"></div></td>
                <template v-if="hasGroupSubcolumns && !isCurrentGroupTableView && currentTableOrientation === 'horizontal'">
                  <td v-for="col in activeTableGroupColumns" :key="`skel-col-${col.id}`" class="py-2 px-2 border-b border-slate-100"><div class="h-3.5 w-12 mx-auto bg-slate-200 rounded"></div></td>
                </template>
                <td v-else class="py-2 px-3 border-b border-slate-100"><div class="h-3.5 w-36 bg-slate-200 rounded"></div></td>
                <td class="py-2 px-3 text-right border-b border-slate-100"><div class="h-3.5 w-14 bg-slate-200 rounded ml-auto"></div></td>
              </tr>
            </tbody>

            <tbody v-else class="divide-y divide-slate-100">
              <template v-for="part in paginatedParts" :key="part.id">
                <tr class="hover:bg-slate-50 transition group">
                <!-- 1. Componente con Miniatura Técnica y Lightbox -->
                <td class="py-2 px-3 align-middle border-b border-slate-100">
                  <div class="flex items-center gap-2.5">
                    <!-- Miniatura técnica interactiva -->
                    <div
                      class="relative w-11 h-11 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 transition"
                      :class="getPartImagesList(part).length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-[#04C4D9] group/thumb bg-white shadow-2xs' : ''"
                      @click="getPartImagesList(part).length > 0 && openLightbox(part)"
                      :title="getPartImagesList(part).length > 0 ? `Clic para ampliar galería (${getPartImagesList(part).length} imagen${getPartImagesList(part).length > 1 ? 'es' : ''})` : 'Sin diagrama cargado'"
                    >
                      <img
                        v-if="getPartImagesList(part).length > 0"
                        :src="getPartImagesList(part)[0]"
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

                      <!-- Indicador de múltiples fotos -->
                      <span
                        v-if="getPartImagesList(part).length > 1"
                        class="absolute bottom-0.5 right-0.5 px-1 py-0 rounded bg-slate-900/80 text-white text-[9px] font-black leading-tight"
                      >
                        +{{ getPartImagesList(part).length - 1 }}
                      </span>

                      <!-- Indicador de PDF adjunto -->
                      <span
                        v-if="getPartPdfsList(part).length > 0"
                        class="absolute top-0.5 left-0.5 px-1 py-0 rounded bg-rose-600 text-white text-[8px] font-black leading-tight"
                        title="Contiene ficha técnica en PDF"
                      >
                        PDF
                      </span>

                      <!-- Overlay de zoom en hover cuando hay imagen -->
                      <div
                        v-if="getPartImagesList(part).length > 0"
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
                        v-if="getPartVehicleModelsLabel(part) || (part.especificaciones_tecnicas as any)?.ano || (part.especificaciones_tecnicas as any)?.cilindros"
                        class="flex flex-wrap items-center gap-1 mt-1 text-[10px]"
                      >
                        <span 
                          v-if="getPartVehicleModelsLabel(part)"
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200"
                          title="Modelo de vehículo y aplicación técnica"
                        >
                          {{ getPartVehicleModelsLabel(part) }}
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
                        class="px-1 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300"
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
                      <div v-if="getPartDisplayOemCodes(part).length > 0" class="flex flex-wrap items-center gap-1.5">
                        <div
                          v-for="oemCode in getPartDisplayOemCodes(part)"
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
                            <Check v-if="copiedCode === oemCode" class="w-3.5 h-3.5 text-[#038391]" />
                            <Copy v-else class="w-3.5 h-3.5 hover:text-slate-700" />
                          </button>
                        </div>
                      </div>

                      <span v-else class="text-xs text-slate-400 font-mono italic">
                        {{ part.codigo_oem || '—' }}
                      </span>
                    </div>

                    <!-- Códigos Alternos / Catálogos agrupados en Código OEM -->
                    <div v-if="getPartEquivalencias(part).length > 0" class="flex flex-wrap gap-1 pt-0.5">
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
                    </div>
                  </div>
                </td>

                <!-- 4. MEDIDAS Y COTAS (Vista Normal con sub-columnas, Vista Normal estándar o Vista en Tabla incrustada) -->
                <template v-if="hasGroupSubcolumns && !isCurrentGroupTableView && currentTableOrientation === 'horizontal'">
                  <td 
                    v-for="col in activeTableGroupColumns" 
                    :key="`td-subcol-${part.id}-${col.id}`"
                    class="py-2 px-2 text-center align-middle border-b border-r border-slate-100 font-mono font-bold text-xs"
                    :class="getMeasurementMatchClass(getPartParamValue(part, col.clave), dynamicParamFilters[col.clave], getTol(col.clave))"
                  >
                    <div
                      v-if="col.tipo_dato === 'seleccion' && parseMultiOptionValues(getPartParamValue(part, col.clave)).length > 0"
                      class="flex flex-wrap items-center justify-center gap-1"
                    >
                      <span
                        v-for="optItem in parseMultiOptionValues(getPartParamValue(part, col.clave))"
                        :key="`sc-${part.id}-${col.id}-${optItem}`"
                        class="inline-flex items-center px-2 py-0.5 rounded-md border font-sans font-extrabold text-[11px]"
                        :class="resolveOptionBadgeClass(optItem, col.opciones)"
                      >
                        {{ optItem }}
                      </span>
                    </div>
                    <span
                      v-else-if="col.tipo_dato === 'booleano'"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black"
                      :class="getPartParamValue(part, col.clave) ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500'"
                    >
                      {{ getPartParamValue(part, col.clave) ? 'Sí' : 'No' }}
                    </span>
                    <template v-else>
                      {{ formatPartParamColValue(getPartParamValue(part, col.clave), col) }}
                    </template>
                  </td>
                </template>

                <td v-else class="py-2 px-3 align-middle border-b border-slate-100">
                  
                  <!-- VISTA EN TABLA: Sub-tabla incrustada dentro de la columna (con orientación Vertical u Horizontal) -->
                  <div v-if="isPartEmbeddedTableFormat(part)" class="py-1">
                    <!-- ORIENTACIÓN VERTICAL (Por defecto en Casquetería / Cojinetes, conmutable) -->
                    <div
                      v-if="currentTableOrientation === 'vertical'"
                      class="inline-block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs font-mono select-text"
                    >
                      <table class="border-collapse text-center text-xs">
                        <thead>
                          <tr class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <th
                              v-if="getPartHasGroupSubcolumns(part)"
                              class="px-2.5 py-1 border-r border-slate-200 bg-blue-50/80 text-[#004B97] font-black text-left whitespace-nowrap"
                            >
                              Medida
                            </th>
                            <th class="px-2.5 py-1 border-r border-slate-200 text-left whitespace-nowrap">
                              Parámetro
                            </th>
                            <th
                              v-for="(sf, sfColIdx) in getPartSubfilas(part).filter(s => !s.es_fila_central)"
                              :key="`mt-vhead-${part.id}-${sfColIdx}`"
                              class="px-2.5 py-1 whitespace-nowrap"
                              :class="sfColIdx < getPartSubfilas(part).filter(s => !s.es_fila_central).length - 1 ? 'border-r border-slate-200' : ''"
                            >
                              <div class="flex flex-col items-center">
                                <span
                                  v-if="partHasRowGroups(part) && sf.grupo"
                                  class="text-[8px] font-black text-[#004B97] uppercase leading-tight"
                                >
                                  {{ sf.grupo }}
                                </span>
                                <span class="font-bold text-slate-800">{{ sf.nombre || `Item ${sfColIdx + 1}` }}</span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-[11px]">
                          <!-- Filas centrales preservadas como banner superior -->
                          <tr
                            v-for="(csf, csfIdx) in getPartSubfilas(part).filter(s => s.es_fila_central)"
                            :key="`mt-vcent-${part.id}-${csfIdx}`"
                            class="bg-slate-50/80"
                          >
                            <td
                              :colspan="(getPartHasGroupSubcolumns(part) ? 2 : 1) + Math.max(1, getPartSubfilas(part).filter(s => !s.es_fila_central).length)"
                              class="px-2.5 py-1 font-bold text-slate-800 text-center"
                            >
                              {{ csf.nombre || '—' }}
                            </td>
                          </tr>

                          <!-- Filas verticales: atributos/medidas -->
                          <tr
                            v-for="(vRow, vIdx) in getVerticalSpecRowsForColumns(getPartTableColumns(part))"
                            :key="`mt-vrow-${part.id}-${vRow.col.id || vIdx}`"
                            class="hover:bg-slate-50/70 transition"
                          >
                            <td
                              v-if="getPartHasGroupSubcolumns(part) && vRow.showParent"
                              :rowspan="vRow.parentRowspan"
                              class="px-2.5 py-1 border-r border-slate-200 bg-blue-50/40 text-left align-middle font-black text-[#004B97] text-[10px] uppercase whitespace-nowrap"
                            >
                              {{ vRow.parent || 'General' }}
                            </td>
                            <td class="px-2.5 py-1 bg-slate-50/70 font-bold text-slate-700 border-r border-slate-200 text-left whitespace-nowrap">
                              {{ vRow.label }}
                              <span v-if="vRow.col.unidad && vRow.col.tipo_dato !== 'booleano' && vRow.col.tipo_dato !== 'seleccion'" class="text-[8px] font-normal text-slate-500 lowercase">({{ unitMode === 'milesimas' && vRow.col.unidad === 'mm' ? 'pulg' : vRow.col.unidad }})</span>
                            </td>
                            <td
                              v-for="(sf, sfValIdx) in getPartSubfilas(part).filter(s => !s.es_fila_central)"
                              :key="`mt-vcell-${part.id}-${vIdx}-${sfValIdx}`"
                              class="px-2.5 py-1 font-mono font-bold transition text-slate-900 whitespace-nowrap"
                              :class="[
                                sfValIdx < getPartSubfilas(part).filter(s => !s.es_fila_central).length - 1 ? 'border-r border-slate-200' : '',
                                getMeasurementMatchClass(getPartMiniTableCellRawValue(part, sf, vRow.col) as any, dynamicParamFilters[vRow.col.clave], getTol(vRow.col.clave))
                              ]"
                            >
                              <div
                                v-if="vRow.col.tipo_dato === 'seleccion' && parseMultiOptionValues(getPartMiniTableCellRawValue(part, sf, vRow.col)).length > 0"
                                class="flex flex-wrap items-center justify-center gap-1"
                              >
                                <span
                                  v-for="optItem in parseMultiOptionValues(getPartMiniTableCellRawValue(part, sf, vRow.col))"
                                  :key="`mv-${part.id}-${vIdx}-${sfValIdx}-${optItem}`"
                                  class="inline-flex items-center px-1.5 py-0.2 rounded border font-sans font-extrabold text-[10px]"
                                  :class="resolveOptionBadgeClass(optItem, vRow.col.opciones)"
                                >
                                  {{ optItem }}
                                </span>
                              </div>
                              <span
                                v-else-if="vRow.col.tipo_dato === 'booleano'"
                                class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black"
                                :class="getPartMiniTableCellRawValue(part, sf, vRow.col) ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500'"
                              >
                                {{ getPartMiniTableCellRawValue(part, sf, vRow.col) ? 'Sí' : 'No' }}
                              </span>
                              <template v-else>
                                {{ getPartMiniTableCellValue(part, sf, vRow.col) }}
                              </template>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- ORIENTACIÓN HORIZONTAL -->
                    <div v-else class="inline-block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs font-mono select-text">
                      <table class="border-collapse text-center text-xs">
                        <thead>
                          <!-- Tier 1 dentro de la mini-tabla cuando hay sub-columnas agrupadas -->
                          <tr
                            v-if="getPartGroupSubcolumnsHeaders(part).hasSubcolumns"
                            class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200"
                          >
                            <th
                              v-if="partHasRowGroups(part)"
                              rowspan="2"
                              class="px-2.5 py-1 border-r border-slate-200 bg-cyan-50/70 text-[#004B97] font-black text-center align-middle"
                            >
                              {{ resolveGroupDefinitionForPart(part)?.tabla_config?.titulo_grupo_filas || 'Grupo' }}
                            </th>
                            <th rowspan="2" class="px-2.5 py-1 border-r border-slate-200 text-left align-middle">
                              {{ getPartTableColFirstHeader(part) }}
                            </th>
                            <template v-for="item in getPartGroupSubcolumnsHeaders(part).tier1" :key="`mt-t1-${part.id}-${item.id}`">
                              <th
                                v-if="item.isGroup"
                                :colspan="item.colspan"
                                class="py-1 px-2 border-r border-b border-slate-200 bg-blue-50/80 text-[#004B97] font-black text-center text-[10px]"
                              >
                                {{ item.label }}
                              </th>
                              <th
                                v-else
                                rowspan="2"
                                class="py-1 px-2 border-r border-slate-200 text-slate-700 font-bold text-center align-middle whitespace-nowrap"
                              >
                                {{ item.label }}
                              </th>
                            </template>
                          </tr>

                          <tr class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <template v-if="!getPartGroupSubcolumnsHeaders(part).hasSubcolumns">
                              <th
                                v-if="partHasRowGroups(part)"
                                class="px-2.5 py-1 border-r border-slate-200 bg-cyan-50/70 text-[#004B97] font-black text-center"
                              >
                                {{ resolveGroupDefinitionForPart(part)?.tabla_config?.titulo_grupo_filas || 'Grupo' }}
                              </th>
                              <th class="px-2.5 py-1 border-r border-slate-200 text-left whitespace-nowrap">
                                {{ getPartTableColFirstHeader(part) }}
                              </th>
                            </template>
                            <template
                              v-for="(col, cIdx) in getPartTableColumns(part)"
                              :key="`mt-col-${part.id}-${col.id || cIdx}`"
                            >
                              <th
                                v-if="!getPartGroupSubcolumnsHeaders(part).hasSubcolumns || (col.columna_padre && col.columna_padre.trim())"
                                class="px-2.5 py-1 whitespace-nowrap"
                                :class="cIdx < getPartTableColumns(part).length - 1 ? 'border-r border-slate-200' : ''"
                              >
                                {{ col.etiqueta_corta || col.etiqueta }}
                                <span v-if="col.unidad && col.tipo_dato !== 'booleano' && col.tipo_dato !== 'seleccion'" class="text-[8px] font-normal text-slate-500 lowercase">({{ unitMode === 'milesimas' && col.unidad === 'mm' ? 'pulg' : col.unidad }})</span>
                              </th>
                            </template>
                          </tr>
                        </thead>

                        <tbody class="divide-y divide-slate-100 text-[11px]">
                          <tr
                            v-for="(sf, sfIdx) in getPartSubfilas(part)"
                            :key="`mt-sf-${part.id}-${sfIdx}`"
                            class="hover:bg-slate-50/70 transition"
                          >
                            <!-- Fila central: cubre todas las columnas de la tabla con el mismo diseño que las demás filas -->
                            <td
                              v-if="sf.es_fila_central"
                              :colspan="getPartMiniTableColspan(part)"
                              class="px-2.5 py-1.5 bg-slate-50/70 font-bold text-slate-800 text-center whitespace-nowrap"
                            >
                              {{ sf.nombre || '—' }}
                            </td>

                            <template v-else>
                            <!-- Columna agrupadora de filas (rowspan) cuando existe unión -->
                            <td
                              v-if="partHasRowGroups(part) && getPartSubfilaRowSpans(part)[sfIdx]?.show"
                              :rowspan="getPartSubfilaRowSpans(part)[sfIdx]?.rowspan"
                              class="px-2.5 py-1 border-r border-slate-200 bg-cyan-50/45 text-center align-middle font-black text-[#004B97] uppercase text-[10px] tracking-wider"
                            >
                              {{ getPartSubfilaRowSpans(part)[sfIdx]?.label || '—' }}
                            </td>

                            <!-- Nombre de la fila (Componente / Anillo / Sección) -->
                            <td class="px-2.5 py-1 bg-slate-50/70 font-bold text-slate-700 border-r border-slate-200 text-left whitespace-nowrap">
                              <div class="flex items-center gap-1.5">
                                <span
                                  class="w-1.5 h-1.5 rounded-full shrink-0"
                                  :class="sfIdx === 0 ? 'bg-[#004B97]' : (sfIdx === 1 ? 'bg-[#04C4D9]' : 'bg-slate-400')"
                                ></span>
                                <span>{{ sf.nombre }}</span>
                              </div>
                            </td>

                            <!-- Columnas de medidas / booleanos / opciones -->
                            <template
                              v-for="(col, cIdx) in getPartTableColumns(part)"
                              :key="`mt-val-${part.id}-${sfIdx}-${col.id || cIdx}`"
                            >
                              <td
                                v-if="!col.compartido_filas || getPartSubfilaSharedMeta(part)[sfIdx]?.showShared"
                                :rowspan="col.compartido_filas ? (getPartSubfilaSharedMeta(part)[sfIdx]?.sharedRowspan || 1) : undefined"
                                class="px-2.5 py-1 font-mono font-bold transition text-slate-900 whitespace-nowrap"
                                :class="[
                                  cIdx < getPartTableColumns(part).length - 1 ? 'border-r border-slate-200' : '',
                                  col.compartido_filas ? 'align-middle bg-cyan-50/15' : '',
                                  getMeasurementMatchClass(getPartMiniTableCellRawValue(part, sf, col) as any, dynamicParamFilters[col.clave], getTol(col.clave))
                                ]"
                              >
                                <div
                                  v-if="col.tipo_dato === 'seleccion' && parseMultiOptionValues(getPartMiniTableCellRawValue(part, sf, col)).length > 0"
                                  class="flex flex-wrap items-center justify-center gap-1"
                                >
                                  <span
                                    v-for="optItem in parseMultiOptionValues(getPartMiniTableCellRawValue(part, sf, col))"
                                    :key="`mh-${part.id}-${sfIdx}-${col.id}-${optItem}`"
                                    class="inline-flex items-center px-1.5 py-0.2 rounded border font-sans font-extrabold text-[10px]"
                                    :class="resolveOptionBadgeClass(optItem, col.opciones)"
                                  >
                                    {{ optItem }}
                                  </span>
                                </div>
                                <span
                                  v-else-if="col.tipo_dato === 'booleano'"
                                  class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black"
                                  :class="getPartMiniTableCellRawValue(part, sf, col) ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500'"
                                >
                                  {{ getPartMiniTableCellRawValue(part, sf, col) ? 'Sí' : 'No' }}
                                </span>
                                <template v-else>
                                  {{ getPartMiniTableCellValue(part, sf, col) }}
                                </template>
                              </td>
                            </template>
                            </template>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- Caso Dinámico General: Vertical (tabla atributo-valor) u Horizontal (badges) -->
                  <div
                    v-else-if="(resolveGroupDefinitionForPart(part)?.parametros?.length || 0) > 0 && currentTableOrientation === 'vertical'"
                    class="py-1"
                  >
                    <div class="inline-block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs font-mono text-[11px] select-text">
                      <table class="border-collapse">
                        <thead>
                          <tr class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <th v-if="getPartHasGroupSubcolumns(part)" class="px-2.5 py-1 border-r border-slate-200 bg-blue-50/80 text-[#004B97] text-left">Grupo</th>
                            <th class="px-2.5 py-1 border-r border-slate-200 text-left">Especificación</th>
                            <th class="px-2.5 py-1 text-right">Valor / Medida</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                          <tr
                            v-for="(vRow, vIdx) in getVerticalSpecRowsForColumns((resolveGroupDefinitionForPart(part)?.parametros || []).filter(p => p.requerido !== false || getPartParamValue(part, p.clave) != null))"
                            :key="`flat-v-${part.id}-${vRow.col.clave}-${vIdx}`"
                            class="hover:bg-slate-50/70 transition"
                          >
                            <td
                              v-if="getPartHasGroupSubcolumns(part) && vRow.showParent"
                              :rowspan="vRow.parentRowspan"
                              class="px-2.5 py-1 border-r border-slate-200 bg-blue-50/40 font-black text-[#004B97] text-[10px] uppercase align-middle whitespace-nowrap"
                            >
                              {{ vRow.parent || 'General' }}
                            </td>
                            <td class="px-2.5 py-1 bg-slate-50/70 font-sans font-bold text-slate-600 border-r border-slate-200 whitespace-nowrap">
                              {{ vRow.label }}
                            </td>
                            <td
                              class="px-2.5 py-1 text-right font-bold whitespace-nowrap"
                              :class="getMeasurementMatchClass(getPartParamValue(part, vRow.col.clave), dynamicParamFilters[vRow.col.clave], getTol(vRow.col.clave))"
                            >
                              <div
                                v-if="vRow.col.tipo_dato === 'seleccion' && parseMultiOptionValues(getPartParamValue(part, vRow.col.clave)).length > 0"
                                class="flex flex-wrap items-center justify-end gap-1"
                              >
                                <span
                                  v-for="optItem in parseMultiOptionValues(getPartParamValue(part, vRow.col.clave))"
                                  :key="`fv-${part.id}-${vIdx}-${optItem}`"
                                  class="inline-flex items-center px-1.5 py-0.2 rounded border font-sans font-extrabold text-[10px]"
                                  :class="resolveOptionBadgeClass(optItem, vRow.col.opciones)"
                                >
                                  {{ optItem }}
                                </span>
                              </div>
                              <span
                                v-else-if="vRow.col.tipo_dato === 'booleano'"
                                class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black"
                                :class="getPartParamValue(part, vRow.col.clave) ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500'"
                              >
                                {{ getPartParamValue(part, vRow.col.clave) ? 'Sí' : 'No' }}
                              </span>
                              <template v-else>
                                {{ formatPartParamColValue(getPartParamValue(part, vRow.col.clave), vRow.col) }}
                              </template>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div 
                    v-else-if="(resolveGroupDefinitionForPart(part)?.parametros?.length || 0) > 0" 
                    class="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-800"
                  >
                    <template 
                      v-for="p in (resolveGroupDefinitionForPart(part)?.parametros || []).filter(p => p.requerido !== false || getPartParamValue(part, p.clave) != null)" 
                      :key="p.clave"
                    >
                      <!-- Caso A: Posición / Tipo de Válvula / Selección (soporta múltiples opciones) -->
                      <template v-if="p.tipo_dato === 'seleccion' || p.clave === 'posicion' || p.clave === 'tipo_valvula' || p.clave === 'tipo'">
                        <template v-if="parseMultiOptionValues(getPartParamValue(part, p.clave)).length > 0">
                          <span
                            v-for="optItem in parseMultiOptionValues(getPartParamValue(part, p.clave))"
                            :key="`flat-sel-${part.id}-${p.clave}-${optItem}`"
                            class="px-1.5 py-0.5 rounded border transition"
                            :class="getPositionOrTypeBadgeClass(optItem, dynamicParamFilters[p.clave], p.opciones)"
                          >
                            {{ optItem }}
                          </span>
                        </template>
                        <span
                          v-else
                          class="px-1.5 py-0.5 rounded border transition"
                          :class="getPositionOrTypeBadgeClass(getPartParamValue(part, p.clave), dynamicParamFilters[p.clave], p.opciones)"
                        >
                          {{ p.etiqueta_corta || p.etiqueta }}
                        </span>
                      </template>

                      <!-- Caso A2: Estado booleano (Sí / No) -->
                      <span
                        v-else-if="p.tipo_dato === 'booleano'"
                        class="px-1.5 py-0.5 rounded border text-[11px] transition inline-flex items-center gap-1"
                        :class="getPartParamValue(part, p.clave) ? 'bg-cyan-50 text-[#038391] border-cyan-200 font-bold' : 'bg-slate-100 text-slate-600 border-slate-200'"
                      >
                        <span class="text-slate-500 text-[10px] uppercase font-sans">{{ p.etiqueta_corta || p.etiqueta }}:</span>
                        <strong>{{ getPartParamValue(part, p.clave) ? 'Sí' : 'No' }}</strong>
                      </span>

                      <!-- Caso B: Parámetro Numérico con Unidad y Resaltado Azul / Amarillo -->
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
                          ? 'bg-[#004B97] text-white'
                          : 'bg-[#147488] hover:bg-[#105E6E] text-white shadow-2xs'
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
                <td
                  :colspan="hasGroupSubcolumns && !isCurrentGroupTableView && currentTableOrientation === 'horizontal' ? 3 + Math.max(1, activeTableGroupColumns.length) : 4"
                  class="py-10 text-center text-slate-400 bg-white"
                >
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
                        class="px-2.5 py-1 rounded-lg bg-[#147488] hover:bg-[#105E6E] text-white text-xs font-bold"
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
        class="fixed inset-0 z-50 bg-[#09132B]/65 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="closeMotorInfo"
      >
        <div class="studio-card bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col popover-pop-in">
          <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white px-5 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Info class="w-4 h-4 text-[#BFEBF2]" />
              <h3 class="font-display text-sm font-bold text-white">
                Ficha Motor: {{ getBrandName(selectedMotorInfoModal.fabricante_id) }} - {{ selectedMotorInfoModal.codigo }}
              </h3>
            </div>
            <button
              type="button"
              @click="closeMotorInfo"
              class="p-1.5 text-white/75 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
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
              <div class="col-span-2 pt-1.5 border-t border-slate-200/80">
                <span class="text-[10px] text-slate-400 font-sans uppercase block">Modelos de Vehículo Vinculados</span>
                <strong class="text-slate-900 font-sans">{{ getMotorModelName(selectedMotorInfoModal) }}</strong>
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

          <div class="bg-slate-50/90 px-5 py-3 border-t border-slate-200/80 flex items-center justify-between">
            <button
              type="button"
              @click="closeMotorInfo"
              class="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              @click="handleSelectMotor(selectedMotorInfoModal); closeMotorInfo()"
              class="studio-cta-primary px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
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
        class="fixed inset-0 z-50 bg-[#09132B]/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
        @click.self="closeTechnicalSheet"
      >
        <div class="studio-card bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] popover-pop-in">
          
          <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white px-5 py-3.5 flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono font-bold uppercase tracking-widest text-[#BFEBF2] block">
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
            
            <!-- Galería de Imágenes / Diagramas Técnicos en la Ficha -->
            <div v-if="getPartImagesList(modalPart).length > 0" class="space-y-2">
              <div
                class="relative bg-slate-900/5 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer group hover:border-[#04C4D9] transition"
                @click="openLightbox(modalPart, 0)"
                title="Clic para ampliar galería técnica"
              >
                <span
                  v-if="getPartImagesList(modalPart).length > 1"
                  class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-[10px] font-bold"
                >
                  {{ getPartImagesList(modalPart).length }} fotos
                </span>
                <img
                  :src="getPartImagesList(modalPart)[0]"
                  :alt="modalPart.nombre"
                  class="max-h-48 object-contain rounded-lg"
                />
                <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1E446E] text-white text-[10px] font-bold group-hover:bg-[#147488] transition shadow-xs">
                  <Maximize2 class="w-3 h-3" />
                  <span>{{ getPartImagesList(modalPart).length > 1 ? `Ver Galería Completa (${getPartImagesList(modalPart).length})` : 'Ampliar Diagrama en Pantalla Completa' }}</span>
                </div>
              </div>

              <div v-if="getPartImagesList(modalPart).length > 1" class="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  v-for="(imgUrl, imgIdx) in getPartImagesList(modalPart)"
                  :key="`modal-thumb-${imgIdx}`"
                  type="button"
                  @click="openLightbox(modalPart, imgIdx)"
                  class="w-14 h-14 rounded-lg border border-slate-200 hover:border-[#04C4D9] overflow-hidden shrink-0 bg-white transition relative group"
                  :title="`Abrir imagen ${imgIdx + 1}`"
                >
                  <img :src="imgUrl" :alt="`${modalPart.nombre} (${imgIdx + 1})`" class="w-full h-full object-cover group-hover:scale-105 transition" />
                  <span class="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-900/75 text-white text-[8px] font-bold">{{ imgIdx + 1 }}</span>
                </button>
              </div>
            </div>

            <!-- Documentos PDF Técnicos Adjuntos -->
            <div
              v-if="getPartPdfsList(modalPart).length > 0"
              class="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                  <FileText class="w-3.5 h-3.5 text-rose-600" />
                  <span>Documentos PDF Técnicos ({{ getPartPdfsList(modalPart).length }})</span>
                </h4>
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="(pdfDoc, pdfIdx) in getPartPdfsList(modalPart)"
                  :key="`modal-pdf-${pdfIdx}`"
                  class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-rose-200/80"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black shrink-0">PDF</span>
                    <span class="font-semibold text-slate-800 truncate text-xs" :title="pdfDoc.nombre">{{ pdfDoc.nombre }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      @click="previewPdfUrl = previewPdfUrl === pdfDoc.url ? null : pdfDoc.url"
                      class="px-2 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Eye class="w-3 h-3" />
                      <span>{{ previewPdfUrl === pdfDoc.url ? 'Ocultar' : 'Vista Previa' }}</span>
                    </button>
                    <a
                      :href="pdfDoc.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="p-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                      title="Abrir PDF en nueva pestaña"
                    >
                      <ExternalLink class="w-3 h-3" />
                    </a>
                    <a
                      :href="pdfDoc.url"
                      :download="pdfDoc.nombre"
                      class="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 transition"
                      title="Descargar PDF"
                    >
                      <Download class="w-3 h-3" />
                      <span>Descargar</span>
                    </a>
                  </div>
                </div>
              </div>
              <div v-if="previewPdfUrl" class="pt-1">
                <iframe
                  :src="previewPdfUrl"
                  class="w-full h-80 rounded-lg border border-rose-200 bg-white"
                  title="Vista previa de ficha técnica PDF"
                ></iframe>
              </div>
            </div>

            <!-- Diseño(s) de Anillos y Descripción Técnica / Notas de Aplicación -->
            <div
              v-if="getPartRingDesigns(modalPart).length > 0 || getPartTechDescription(modalPart)"
              class="bg-cyan-50/50 border border-cyan-200/80 rounded-xl p-3 space-y-2"
            >
              <div v-if="getPartRingDesigns(modalPart).length > 0" class="flex flex-wrap items-center gap-1.5">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#038391] mr-1">
                  Diseño de Anillos:
                </span>
                <span
                  v-for="dsn in getPartRingDesigns(modalPart)"
                  :key="`modal-dsn-${dsn}`"
                  class="px-2 py-0.5 rounded-full bg-white border border-cyan-300 text-[#038391] font-bold text-[10px]"
                >
                  {{ dsn }}
                </span>
              </div>
              <div v-if="getPartTechDescription(modalPart)">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 block mb-0.5">
                  Descripción Técnica / Notas de Aplicación
                </span>
                <p class="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                  {{ getPartTechDescription(modalPart) }}
                </p>
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
              v-if="getPartVehicleModelsLabel(modalPart) || (modalPart.especificaciones_tecnicas as any)?.ano || (modalPart.especificaciones_tecnicas as any)?.cilindros"
              class="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center gap-3 text-xs"
            >
              <div v-if="getPartVehicleModelsLabel(modalPart)" class="flex items-center gap-1.5">
                <span class="text-blue-600 font-bold">Vehículo:</span>
                <strong class="text-blue-950 font-bold">{{ getPartVehicleModelsLabel(modalPart) }}</strong>
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
                  <Check v-if="copiedCode === oemCode" class="w-3.5 h-3.5 text-[#038391]" />
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

            <!-- CASO ANILLOS: CUADRO TÉCNICO OFICIAL RIK / TALLER (DISEÑO SWGORA, SIN MATERIAL/TRATAMIENTO) -->
            <div v-if="(modalPart.categoria === 'Anillos' || (modalPart.categoria || '').toLowerCase().includes('anillo')) && ((modalPart.dimensiones as any)?.anillos || modalPart.diametro_cilindro_mm || getPartSubfilas(modalPart).length > 0)">
              <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
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
                <div class="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    @click="modalTableOrientation = modalTableOrientation === 'vertical' ? 'horizontal' : 'vertical'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                    :title="modalTableOrientation === 'vertical' ? 'Cambiar a tabla horizontal' : 'Cambiar a tabla vertical'"
                  >
                    <ArrowUpDown class="w-3 h-3 text-[#038391]" />
                    <span>{{ modalTableOrientation === 'vertical' ? 'Vista Vertical' : 'Vista Horizontal' }}</span>
                  </button>
                  <span v-if="(modalPart.dimensiones as any)?.cilindros && Number((modalPart.dimensiones as any).cilindros) > 0" class="px-2 py-0.5 rounded bg-cyan-50 text-[#038391] font-bold text-[11px] font-mono border border-cyan-200">
                    {{ (modalPart.dimensiones as any).cilindros }} Cilindros
                  </span>
                </div>
              </div>

              <!-- Cuadro RIK ORIENTACIÓN VERTICAL -->
              <div v-if="modalTableOrientation === 'vertical'" class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs font-mono text-xs overflow-x-auto">
                <table class="w-full border-collapse text-center">
                  <thead>
                    <tr class="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <th class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider text-left">Cota / Medida</th>
                      <th
                        v-for="(ring, rIdx) in getPartRingsList(modalPart)"
                        :key="`rik-vh-${rIdx}`"
                        class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider"
                      >
                        {{ ring.posicion === 'Anillo de aceite' ? 'Oil' : (rIdx === 0 ? '1st' : (rIdx === 1 ? '2nd' : (rIdx === 2 ? '3rd' : `${rIdx + 1}th`))) }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs">
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200 text-left">d 1 (Diám. mm)</td>
                      <td v-for="(ring, rIdx) in getPartRingsList(modalPart)" :key="`rik-vd-${rIdx}`" class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900">{{ formatRingVal(ring.d1) }}</td>
                    </tr>
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200 text-left">h 1 (Grosor mm)</td>
                      <td v-for="(ring, rIdx) in getPartRingsList(modalPart)" :key="`rik-vh1-${rIdx}`" class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900">{{ formatRingVal(ring.h1) }}</td>
                    </tr>
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200 text-left">a 1 (Altura mm)</td>
                      <td v-for="(ring, rIdx) in getPartRingsList(modalPart)" :key="`rik-va-${rIdx}`" class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900">{{ formatRingVal(ring.a1) }}</td>
                    </tr>
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200 text-left">Shape / Diseño</td>
                      <td v-for="(_ring, rIdx) in getPartRingsList(modalPart)" :key="`rik-vf-${rIdx}`" class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-800">{{ getRingDetail(modalPart, rIdx, 'forma') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Cuadro RIK ORIENTACIÓN HORIZONTAL -->
              <div v-else class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs font-mono text-xs">
                <table class="w-full border-collapse text-center">
                  <thead>
                    <tr class="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <th rowspan="2" class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider">Position</th>
                      <th colspan="3" class="px-4 py-1 text-xs font-bold uppercase tracking-wider border-b border-slate-200">Size (mm)</th>
                      <th rowspan="2" class="px-3 py-1.5 border-l border-slate-200 text-[11px] font-bold uppercase tracking-wider">Shape (Forma)</th>
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

            <!-- CASO FAMILIAS EN TABLA (CASQUETERÍA / COJINETES / SUBFILAS): SOPORTE VERTICAL ↔ HORIZONTAL -->
            <div v-else-if="getPartSubfilas(modalPart).length > 0 && getPartTableColumns(modalPart).length > 0">
              <div class="flex items-center justify-between mb-2 gap-2">
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-[#04C4D9]"></span>
                  Matriz Técnica - {{ modalPart.nombre }}
                </h4>
                <button
                  type="button"
                  @click="modalTableOrientation = modalTableOrientation === 'vertical' ? 'horizontal' : 'vertical'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                >
                  <ArrowUpDown class="w-3 h-3 text-[#038391]" />
                  <span>{{ modalTableOrientation === 'vertical' ? 'Vista Vertical' : 'Vista Horizontal' }}</span>
                </button>
              </div>

              <div v-if="modalTableOrientation === 'vertical'" class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs font-mono text-xs overflow-x-auto">
                <table class="w-full border-collapse text-center">
                  <thead>
                    <tr class="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <th v-if="getPartHasGroupSubcolumns(modalPart)" class="px-3 py-1.5 border-r border-slate-200 bg-blue-50/80 text-[#004B97] text-xs font-black uppercase tracking-wider text-left">Medida</th>
                      <th class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider text-left">Parámetro</th>
                      <th
                        v-for="(sf, sfColIdx) in getPartSubfilas(modalPart).filter(s => !s.es_fila_central)"
                        :key="`modal-vh-${sfColIdx}`"
                        class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider"
                      >
                        <div class="flex flex-col items-center">
                          <span v-if="partHasRowGroups(modalPart) && sf.grupo" class="text-[9px] text-[#004B97] font-black">{{ sf.grupo }}</span>
                          <span>{{ sf.nombre || `Item ${sfColIdx + 1}` }}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs">
                    <tr
                      v-for="(csf, csfIdx) in getPartSubfilas(modalPart).filter(s => s.es_fila_central)"
                      :key="`modal-vc-${csfIdx}`"
                      class="bg-slate-50/80"
                    >
                      <td
                        :colspan="(getPartHasGroupSubcolumns(modalPart) ? 2 : 1) + Math.max(1, getPartSubfilas(modalPart).filter(s => !s.es_fila_central).length)"
                        class="px-3 py-1.5 font-bold text-slate-800 text-center"
                      >
                        {{ csf.nombre || '—' }}
                      </td>
                    </tr>
                    <tr
                      v-for="(vRow, vIdx) in getVerticalSpecRowsForColumns(getPartTableColumns(modalPart))"
                      :key="`modal-vrow-${vIdx}`"
                      class="hover:bg-slate-50/70 transition"
                    >
                      <td
                        v-if="getPartHasGroupSubcolumns(modalPart) && vRow.showParent"
                        :rowspan="vRow.parentRowspan"
                        class="px-3 py-1.5 border-r border-slate-200 bg-blue-50/40 font-black text-[#004B97] uppercase text-[10px] text-left align-middle"
                      >
                        {{ vRow.parent || 'General' }}
                      </td>
                      <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200 text-left">
                        {{ vRow.label }}
                        <span v-if="vRow.col.unidad && vRow.col.tipo_dato !== 'booleano' && vRow.col.tipo_dato !== 'seleccion'" class="text-[9px] text-slate-400 font-normal">({{ vRow.col.unidad }})</span>
                      </td>
                      <td
                        v-for="(sf, sfValIdx) in getPartSubfilas(modalPart).filter(s => !s.es_fila_central)"
                        :key="`modal-vv-${vIdx}-${sfValIdx}`"
                        class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900"
                      >
                        <div
                          v-if="vRow.col.tipo_dato === 'seleccion' && parseMultiOptionValues(getPartMiniTableCellRawValue(modalPart, sf, vRow.col)).length > 0"
                          class="flex flex-wrap items-center justify-center gap-1"
                        >
                          <span
                            v-for="optItem in parseMultiOptionValues(getPartMiniTableCellRawValue(modalPart, sf, vRow.col))"
                            :key="`mod-vv-${vIdx}-${sfValIdx}-${optItem}`"
                            class="inline-flex items-center px-1.5 py-0.2 rounded border font-sans font-extrabold text-[10px]"
                            :class="resolveOptionBadgeClass(optItem, vRow.col.opciones)"
                          >
                            {{ optItem }}
                          </span>
                        </div>
                        <template v-else>
                          {{ getPartMiniTableCellValue(modalPart, sf, vRow.col) }}
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs font-mono text-xs overflow-x-auto">
                <table class="w-full border-collapse text-center">
                  <thead>
                    <tr class="bg-slate-100 text-slate-800 border-b border-slate-200">
                      <th v-if="partHasRowGroups(modalPart)" class="px-3 py-1.5 border-r border-slate-200 bg-cyan-50/70 text-[#004B97] text-xs font-black uppercase text-center">
                        {{ resolveGroupDefinitionForPart(modalPart)?.tabla_config?.titulo_grupo_filas || 'Grupo' }}
                      </th>
                      <th class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider text-left">{{ getPartTableColFirstHeader(modalPart) }}</th>
                      <th
                        v-for="col in getPartTableColumns(modalPart)"
                        :key="`m-subcol-${col.id}`"
                        class="px-2.5 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider"
                      >
                        <span v-if="col.columna_padre" class="block text-[9px] text-[#004B97] font-black">{{ col.columna_padre }}</span>
                        {{ col.etiqueta_corta || col.etiqueta }}
                        <span v-if="col.unidad" class="text-[9px] text-slate-400 font-normal">({{ col.unidad }})</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs">
                    <tr
                      v-for="(sf, sfIdx) in getPartSubfilas(modalPart)"
                      :key="`m-sf-${sfIdx}`"
                      class="hover:bg-slate-50/70 transition"
                    >
                      <td
                        v-if="sf.es_fila_central"
                        :colspan="getPartMiniTableColspan(modalPart)"
                        class="px-3 py-1.5 bg-slate-50/70 font-bold text-slate-800 text-center"
                      >
                        {{ sf.nombre || '—' }}
                      </td>
                      <template v-else>
                        <td
                          v-if="partHasRowGroups(modalPart) && getPartSubfilaRowSpans(modalPart)[sfIdx]?.show"
                          :rowspan="getPartSubfilaRowSpans(modalPart)[sfIdx]?.rowspan"
                          class="px-2.5 py-1.5 border-r border-slate-200 bg-cyan-50/45 text-center align-middle font-black text-[#004B97] uppercase text-[10px]"
                        >
                          {{ getPartSubfilaRowSpans(modalPart)[sfIdx]?.label || '—' }}
                        </td>
                        <td class="px-3 py-1.5 bg-slate-50 font-bold text-slate-700 border-r border-slate-200 text-left">{{ sf.nombre }}</td>
                        <td
                          v-for="col in getPartTableColumns(modalPart)"
                          :key="`m-sfv-${sfIdx}-${col.id}`"
                          class="px-2.5 py-1.5 border-r border-slate-200 font-bold text-slate-900"
                        >
                          <div
                            v-if="col.tipo_dato === 'seleccion' && parseMultiOptionValues(getPartMiniTableCellRawValue(modalPart, sf, col)).length > 0"
                            class="flex flex-wrap items-center justify-center gap-1"
                          >
                            <span
                              v-for="optItem in parseMultiOptionValues(getPartMiniTableCellRawValue(modalPart, sf, col))"
                              :key="`mod-vh-${sfIdx}-${col.id}-${optItem}`"
                              class="inline-flex items-center px-1.5 py-0.2 rounded border font-sans font-extrabold text-[10px]"
                              :class="resolveOptionBadgeClass(optItem, col.opciones)"
                            >
                              {{ optItem }}
                            </span>
                          </div>
                          <template v-else>
                            {{ getPartMiniTableCellValue(modalPart, sf, col) }}
                          </template>
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
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
                      <th class="px-3 py-1.5 border-r border-slate-200 text-xs font-bold uppercase tracking-wider text-left">{{ getPartTableColFirstHeader(modalPart) }}</th>
                      <th
                        v-for="col in getPartTableColumns(modalPart)"
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
                        v-for="col in getPartTableColumns(modalPart)"
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

          <div class="bg-slate-50/90 px-5 py-3.5 border-t border-slate-200/80 flex items-center justify-between">
            <button
              type="button"
              @click="copyFullCross(modalPart)"
              class="px-3.5 py-2 border border-slate-200 bg-white text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Copy class="w-3.5 h-3.5" />
              <span>Copiar Ficha</span>
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="handleEditPart(modalPart); closeTechnicalSheet()"
                class="px-3.5 py-2 border border-[#04C4D9]/35 bg-sky-50 hover:bg-sky-100 text-[#004B97] font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                title="Modificar especificaciones y equivalencias de este repuesto"
              >
                <Edit3 class="w-3.5 h-3.5" />
                <span>Modificar Repuesto</span>
              </button>

              <button
                type="button"
                @click="addToWorkOrder(modalPart); closeTechnicalSheet()"
                class="studio-cta-primary px-4 py-2 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
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
        class="fixed inset-0 z-50 bg-[#09132B]/65 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="isQuickCreateBrandOpen = false"
      >
        <div class="studio-card bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden popover-pop-in">
          <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white px-5 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-[#BFEBF2]" />
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

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div v-if="editingBrandId">
                <div v-if="confirmDeleteBrand" class="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                  <span class="text-[10px] font-bold text-rose-700">¿Eliminar marca y sus motores/modelos?</span>
                  <button
                    type="button"
                    :disabled="isDeletingQuickBrand"
                    @click="handleDeleteQuickBrand"
                    class="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-bold cursor-pointer"
                  >
                    {{ isDeletingQuickBrand ? 'Eliminando...' : 'Sí, eliminar' }}
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteBrand = false"
                    class="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    No
                  </button>
                </div>
                <button
                  v-else
                  type="button"
                  @click="confirmDeleteBrand = true"
                  class="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
              <span v-else></span>

              <div class="flex items-center gap-2">
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
                  class="studio-cta-primary px-4 py-2 rounded-xl disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ editingBrandId ? 'Guardar Cambios' : 'Guardar y Seleccionar' }}</span>
                </button>
              </div>
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
        class="fixed inset-0 z-50 bg-[#09132B]/65 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="isQuickCreateMotorOpen = false"
      >
        <div class="studio-card bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden popover-pop-in">
          <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white px-5 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Wrench class="w-4 h-4 text-[#BFEBF2]" />
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
                <div class="flex items-center justify-between gap-2 mb-1">
                  <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Modelo(s) de Vehículo
                  </label>
                  <button
                    type="button"
                    @click="addQuickMotorModelRow()"
                    class="text-[10px] font-extrabold text-[#038391] hover:text-[#004B97] transition cursor-pointer"
                  >
                    + Agregar modelo
                  </button>
                </div>
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
                <div
                  v-for="(_, mIdx) in quickMotorAdditionalModelIds"
                  :key="`quick-motor-extra-mod-${mIdx}`"
                  class="flex items-center gap-1.5 mt-1.5"
                >
                  <select
                    v-model="quickMotorAdditionalModelIds[mIdx]"
                    class="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                  >
                    <option value="">Seleccionar modelo adicional</option>
                    <option
                      v-for="mod in catalogStore.modelos.filter(m => !quickMotorBrandId || m.fabricante_id === quickMotorBrandId)"
                      :key="`extra-opt-${mIdx}-${mod.id}`"
                      :value="mod.id"
                    >
                      {{ mod.nombre }}
                    </option>
                  </select>
                  <button
                    type="button"
                    @click="removeQuickMotorModelRow(mIdx)"
                    class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Quitar modelo"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
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

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div v-if="editingMotorId">
                <div v-if="confirmDeleteMotor" class="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                  <span class="text-[10px] font-bold text-rose-700">¿Eliminar motor?</span>
                  <button
                    type="button"
                    :disabled="isDeletingQuickMotor"
                    @click="handleDeleteQuickMotor"
                    class="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-bold cursor-pointer"
                  >
                    {{ isDeletingQuickMotor ? 'Eliminando...' : 'Sí, eliminar' }}
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteMotor = false"
                    class="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    No
                  </button>
                </div>
                <button
                  v-else
                  type="button"
                  @click="confirmDeleteMotor = true"
                  class="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
              <span v-else></span>

              <div class="flex items-center gap-2">
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
                  class="studio-cta-primary px-4 py-2 rounded-xl disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>Guardar Motor</span>
                </button>
              </div>
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
        class="fixed inset-0 z-50 bg-[#09132B]/65 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="isQuickCreateModelOpen = false"
      >
        <div class="studio-card bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden popover-pop-in">
          <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white px-5 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-[#BFEBF2]" />
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

            <!-- Vincular con Motor(es) de la Marca -->
            <div class="border border-slate-200 rounded-xl p-2.5 bg-slate-50/70 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Vincular con Motor(es)
                </label>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="quickModelMotorIds.length > 0 ? 'bg-cyan-100 text-[#004B97]' : 'bg-slate-200/70 text-slate-500'">
                  {{ quickModelMotorIds.length }} seleccionado(s)
                </span>
              </div>

              <!-- Chips de motores seleccionados -->
              <div v-if="quickModelMotorIds.length > 0" class="flex flex-wrap gap-1">
                <span
                  v-for="selId in quickModelMotorIds"
                  :key="`chip-mot-${selId}`"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#004B97] text-white font-mono font-bold text-[10px]"
                >
                  <span>{{ quickModelAvailableMotors.find(m => m.id === selId)?.codigo || 'Motor' }}</span>
                  <button
                    type="button"
                    @click="toggleQuickModelMotor(selId)"
                    class="text-slate-300 hover:text-rose-400 cursor-pointer"
                    title="Quitar vínculo"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </span>
              </div>

              <div class="relative flex items-center">
                <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  v-model="quickModelMotorQuery"
                  type="text"
                  placeholder="Buscar motor por código para vincular..."
                  class="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                />
              </div>

              <div class="max-h-36 overflow-y-auto bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                <div v-if="loadingQuickModelMotors" class="p-3 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <Loader2 class="w-3.5 h-3.5 animate-spin text-[#04C4D9]" />
                  <span>Cargando motores de la marca...</span>
                </div>
                <div v-else-if="filteredQuickModelMotors.length === 0" class="p-2.5 text-center text-[11px] text-slate-400">
                  No hay motores disponibles para esta marca
                </div>
                <button
                  v-else
                  v-for="mot in filteredQuickModelMotors"
                  :key="`qm-mot-${mot.id}`"
                  type="button"
                  @click="toggleQuickModelMotor(mot.id)"
                  class="w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between gap-2 hover:bg-cyan-50/70 transition cursor-pointer"
                  :class="quickModelMotorIds.includes(mot.id) ? 'bg-cyan-50/80 text-[#004B97] font-bold' : 'text-slate-700'"
                >
                  <div class="flex items-center gap-2 min-w-0 truncate">
                    <span
                      class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition"
                      :class="quickModelMotorIds.includes(mot.id) ? 'bg-[#004B97] border-[#004B97] text-white' : 'border-slate-300 bg-white'"
                    >
                      <Check v-if="quickModelMotorIds.includes(mot.id)" class="w-3 h-3" />
                    </span>
                    <span class="font-mono font-bold">{{ mot.codigo }}</span>
                    <span v-if="mot.denominacion_venta || mot.nombre_comercial" class="text-[10px] text-slate-500 truncate">
                      — {{ mot.denominacion_venta || mot.nombre_comercial }}
                    </span>
                  </div>
                  <span v-if="mot.cilindrada_texto || mot.cilindrada_cc" class="text-[10px] font-mono text-slate-400 shrink-0">
                    {{ mot.cilindrada_texto || `${mot.cilindrada_cc} cc` }}
                  </span>
                </button>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div v-if="editingModelId">
                <div v-if="confirmDeleteModel" class="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                  <span class="text-[10px] font-bold text-rose-700">¿Eliminar modelo?</span>
                  <button
                    type="button"
                    :disabled="isDeletingQuickModel"
                    @click="handleDeleteQuickModel"
                    class="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-bold cursor-pointer"
                  >
                    {{ isDeletingQuickModel ? 'Eliminando...' : 'Sí, eliminar' }}
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteModel = false"
                    class="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    No
                  </button>
                </div>
                <button
                  v-else
                  type="button"
                  @click="confirmDeleteModel = true"
                  class="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
              <span v-else></span>

              <div class="flex items-center gap-2">
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
                  class="studio-cta-primary px-4 py-2 rounded-xl disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ editingModelId ? 'Guardar Cambios' : 'Guardar Modelo' }}</span>
                </button>
              </div>
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
        class="fixed inset-0 z-50 bg-[#09132B]/65 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="isQuickCreateYearOpen = false"
      >
        <div class="studio-card bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden popover-pop-in">
          <div class="bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white px-5 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-[#BFEBF2]" />
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
                class="studio-cta-primary px-4 py-2 rounded-xl disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer"
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
      :initial-index="lightboxInitialIndex"
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
      @group-deleted="onGroupDeleted"
    />

  </div>
</template>
