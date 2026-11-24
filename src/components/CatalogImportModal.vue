<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import {
  buildCatalogActorFromUser,
  canActorModifyRepuesto,
  type CatalogActor
} from '@/utils/catalogPermissions'
import {
  catalogService,
  normalizeText,
  type GrupoRepuesto,
  type RepuestoTecnico
} from '@/services/catalogService'
import {
  downloadCatalogExcelTemplate,
  downloadCatalogJsonTemplate,
  exportFamilyToExcel,
  exportFamilyToJson,
  exportAllCatalogToExcel,
  parseCatalogImportFile,
  parseCatalogJsonText,
  executeCatalogImport,
  type CatalogImportParseResult,
  type CatalogImportReport,
  type DuplicateStrategy,
  type ParsedFamilyRow,
  type ParsedMotorRow,
  type ParsedPartRow,
  type TemplateScope
} from '@/services/catalogImportService'
import {
  X,
  Upload,
  FileSpreadsheet,
  FileJson,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ClipboardPaste,
  Layers,
  Info,
  Trash2,
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldAlert
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  preselectedGroupId?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported', report: CatalogImportReport): void
}>()

const catalogStore = useCatalogStore()
const authStore = useAuthStore()
const currentCatalogActor = computed<CatalogActor | null>(() =>
  buildCatalogActorFromUser(authStore.user, authStore.isAdmin)
)

// Plantilla específica, exportación de familia y carga
const specificTarget = ref<string>('motors_only')
const exportFamilyId = ref<string>('')
const isExportingFamily = ref<boolean>(false)
const exportFeedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const defaultImportGroupId = ref<string>('')
const inputMode = ref<'file' | 'paste'>('file')
const rawJsonText = ref<string>('')
const selectedFile = ref<File | null>(null)
const isDragging = ref<boolean>(false)

// Opciones de importación y sincronización de familia
const duplicateStrategy = ref<DuplicateStrategy>('skip')
const autoCreateEntities = ref<boolean>(true)
const autoUpdateActivatedNotice = ref<boolean>(false)
const syncFamilyDeleteMissing = ref<boolean>(false)
const syncExistingParts = ref<RepuestoTecnico[]>([])
const isLoadingSyncParts = ref<boolean>(false)
const showSyncMissingPreview = ref<boolean>(false)
const pendingDestructiveConfirm = ref<boolean>(false)
let syncFetchToken = 0

// Estado de parseo, vista previa e importación
const parseError = ref<string | null>(null)
const parseResult = ref<CatalogImportParseResult | null>(null)
const previewTab = ref<'repuestos' | 'motores' | 'familias'>('repuestos')

const isImporting = ref<boolean>(false)
const progressCurrent = ref<number>(0)
const progressTotal = ref<number>(0)
const progressLabel = ref<string>('')
const importReport = ref<CatalogImportReport | null>(null)

const resolvedTemplateScope = computed<TemplateScope>(() => {
  if (specificTarget.value === 'motors_only') return 'motors_only'
  if (specificTarget.value === 'families_only') return 'families_only'
  return 'parts_only'
})

const selectedTemplateGroup = computed(() => {
  if (!specificTarget.value.startsWith('grupo:')) {
    return null
  }
  const codeOrId = specificTarget.value.slice('grupo:'.length)
  return (
    catalogStore.grupos.find(g => g.id === codeOrId || g.codigo === codeOrId) || null
  )
})

const isExportAllSelected = computed(() => exportFamilyId.value === '__ALL__')

const selectedExportGroup = computed<GrupoRepuesto | null>(() => {
  if (!exportFamilyId.value || exportFamilyId.value === '__ALL__') return null
  return (
    catalogStore.grupos.find(
      g => g.id === exportFamilyId.value || g.codigo === exportFamilyId.value
    ) || null
  )
})

const templateScopeHint = computed(() => {
  if (resolvedTemplateScope.value === 'motors_only') {
    return 'Incluye solo: Motores + Instrucciones'
  }
  if (resolvedTemplateScope.value === 'families_only') {
    return 'Incluye: Hoja Familias (todo en una sola hoja) + Instrucciones'
  }
  return selectedTemplateGroup.value
    ? `Incluye solo: Repuestos (${selectedTemplateGroup.value.nombre}) + Instrucciones`
    : 'Incluye solo: Repuestos (todas las medidas) + Instrucciones'
})

const selectedDefaultImportGroup = computed(() => {
  if (!defaultImportGroupId.value) return null
  return (
    catalogStore.grupos.find(
      g => g.id === defaultImportGroupId.value || g.codigo === defaultImportGroupId.value
    ) || null
  )
})

watch(specificTarget, newTarget => {
  if (newTarget.startsWith('grupo:')) {
    const targetCode = newTarget.slice('grupo:'.length)
    defaultImportGroupId.value = targetCode
    exportFamilyId.value = targetCode
  } else {
    defaultImportGroupId.value = ''
  }
})

watch(
  () => props.isOpen,
  open => {
    if (open) {
      if (props.preselectedGroupId) {
        const matched = catalogStore.grupos.find(
          g => g.id === props.preselectedGroupId || g.codigo === props.preselectedGroupId
        )
        const resolvedCode = matched?.codigo || props.preselectedGroupId
        specificTarget.value = `grupo:${resolvedCode}`
        exportFamilyId.value = resolvedCode
        defaultImportGroupId.value = resolvedCode
      } else {
        specificTarget.value = 'motors_only'
        exportFamilyId.value = catalogStore.grupos[0]?.codigo || ''
        defaultImportGroupId.value = ''
      }
      parseError.value = null
      importReport.value = null
      exportFeedback.value = null
      pendingDestructiveConfirm.value = false
    }
  }
)

const pickInitialPreviewTab = (res: CatalogImportParseResult): 'repuestos' | 'motores' | 'familias' => {
  if (res.parts.length > 0) {
    return 'repuestos'
  }
  if (res.families.length > 0 && res.motors.length === 0) {
    return 'familias'
  }
  if (res.motors.length > 0) {
    return 'motores'
  }
  return 'repuestos'
}

const applyPostParseState = (res: CatalogImportParseResult) => {
  previewTab.value = pickInitialPreviewTab(res)
  pendingDestructiveConfirm.value = false
  syncFamilyDeleteMissing.value = false
  showSyncMissingPreview.value = false
  if (res.isFamilyExportPackage) {
    duplicateStrategy.value = 'update'
    autoUpdateActivatedNotice.value = true
  } else {
    autoUpdateActivatedNotice.value = false
  }
}

const handleExportFamily = async (format: 'excel' | 'json') => {
  if (isExportingFamily.value) return
  const exportAll = isExportAllSelected.value
  const grupo = selectedExportGroup.value
  if (!exportAll && !grupo) return

  isExportingFamily.value = true
  exportFeedback.value = null
  try {
    const exportCtx = {
      motores: catalogStore.motores,
      fabricantes: catalogStore.fabricantes,
      modelos: catalogStore.modelos
    }

    if (exportAll) {
      const seen = new Set<string>()
      const allParts: RepuestoTecnico[] = []
      for (const g of catalogStore.grupos) {
        const gParts = await catalogService.getAllRepuestosForGrupoExport(g)
        for (const p of gParts) {
          if (!seen.has(p.id)) {
            seen.add(p.id)
            allParts.push(p)
          }
        }
      }
      if (format === 'excel') {
        const res = exportAllCatalogToExcel(catalogStore.grupos, allParts, exportCtx)
        exportFeedback.value = {
          type: 'success',
          text: `✓ Catálogo completo exportado en ${res.fileName} (${res.exportedPartsCount} repuesto(s) en la hoja Repuestos).`
        }
      } else {
        const payload = {
          exported_at: new Date().toISOString(),
          total_familias: catalogStore.grupos.length,
          total_repuestos: allParts.length,
          familias: catalogStore.grupos,
          repuestos: allParts
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `catalogo_completo_swgora_${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        exportFeedback.value = {
          type: 'success',
          text: `✓ Catálogo completo exportado en JSON (${allParts.length} repuesto(s)).`
        }
      }
      return
    }

    const allParts = await catalogService.getAllRepuestosForGrupoExport(grupo!)
    const res =
      format === 'excel'
        ? exportFamilyToExcel(grupo!, allParts, exportCtx)
        : exportFamilyToJson(grupo!, allParts, exportCtx)

    exportFeedback.value = {
      type: 'success',
      text: `✓ Familia "${grupo!.nombre}" exportada en ${res.fileName} (${res.exportedPartsCount} repuesto(s) en la hoja Repuestos). Edita o marca "eliminar" en el archivo y vuelve a cargarlo aquí.`
    }
  } catch (err) {
    exportFeedback.value = {
      type: 'error',
      text:
        err instanceof Error
          ? err.message
          : 'No se pudo exportar la familia completa.'
    }
  } finally {
    isExportingFamily.value = false
  }
}

const reparseCurrentInput = async () => {
  parseError.value = null
  try {
    if (inputMode.value === 'file' && selectedFile.value) {
      const parsed = await parseCatalogImportFile(
        selectedFile.value,
        catalogStore.grupos,
        selectedDefaultImportGroup.value
      )
      parseResult.value = parsed
      applyPostParseState(parsed)
    } else if (inputMode.value === 'paste' && rawJsonText.value.trim()) {
      const parsed = parseCatalogJsonText(
        rawJsonText.value,
        'json_pegado.json',
        catalogStore.grupos,
        selectedDefaultImportGroup.value
      )
      parseResult.value = parsed
      applyPostParseState(parsed)
    }
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : 'No se pudo interpretar el archivo'
    parseResult.value = null
  }
}

watch(defaultImportGroupId, () => {
  if (parseResult.value) {
    void reparseCurrentInput()
  }
})

const handleFileSelected = async (file: File | undefined | null) => {
  if (!file) return
  selectedFile.value = file
  importReport.value = null
  await reparseCurrentInput()
}

const onFileInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  void handleFileSelected(file)
  input.value = ''
}

const onDropFile = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    inputMode.value = 'file'
    void handleFileSelected(file)
  }
}

const handleParsePastedJson = () => {
  importReport.value = null
  if (!rawJsonText.value.trim()) {
    parseError.value = 'Pegue un contenido JSON válido antes de analizar.'
    parseResult.value = null
    return
  }
  void reparseCurrentInput()
}

const handleClearLoaded = () => {
  selectedFile.value = null
  rawJsonText.value = ''
  parseResult.value = null
  parseError.value = null
  importReport.value = null
  expandedPartIdx.value = null
  autoUpdateActivatedNotice.value = false
  syncFamilyDeleteMissing.value = false
  syncExistingParts.value = []
  showSyncMissingPreview.value = false
  pendingDestructiveConfirm.value = false
}

// =============================================================================
// EDICIÓN EN VIVO EN VISTA PREVIA ANTES DE IMPORTAR
// =============================================================================
const expandedPartIdx = ref<number | null>(null)

const SQL_COTA_FIELDS: Array<{ key: keyof ParsedPartRow; label: string; isText?: boolean }> = [
  { key: 'diametro_cilindro_mm', label: 'Diám. Cilindro (mm)' },
  { key: 'espesor_anillo1_mm', label: '1° Anillo (mm)' },
  { key: 'espesor_anillo2_mm', label: '2° Anillo (mm)' },
  { key: 'espesor_anillo3_mm', label: '3° Anillo (mm)' },
  { key: 'espesor_aceite_mm', label: 'Anillo Aceite (mm)' },
  { key: 'diametro_cabeza_mm', label: 'Ø Cabeza Válv. (mm)' },
  { key: 'diametro_vastago_mm', label: 'Ø Vástago (mm)' },
  { key: 'longitud_total_mm', label: 'Long. Total (mm)' },
  { key: 'angulo_asiento_grados', label: 'Ángulo (°)' },
  { key: 'diametro_interior_mm', label: 'Diám. Int. (mm)' },
  { key: 'diametro_exterior_mm', label: 'Diám. Ext. (mm)' },
  { key: 'altura_mm', label: 'Altura (mm)' },
  { key: 'medida_rosca', label: 'Medida Rosca', isText: true },
  { key: 'paso_rosca_mm', label: 'Paso Rosca (mm)' },
  { key: 'longitud_perno_mm', label: 'Long. Perno (mm)' },
  { key: 'cantidad_piezas', label: 'Cant. Piezas' },
]

const revalidateFamilyRow = (fam: ParsedFamilyRow) => {
  const msgs: string[] = []
  let st: ParsedFamilyRow['status'] = 'valid'
  if (fam.action === 'delete') {
    if (!fam.sourceId && !fam.codigo.trim() && !fam.nombre.trim()) {
      st = 'error'
      msgs.push('Falta id, codigo o nombre para eliminar')
    }
  } else {
    if (!fam.nombre.trim()) {
      st = 'error'
      msgs.push('Falta el nombre de la familia')
    }
    if (!fam.columnas || fam.columnas.length === 0) {
      if (st === 'valid') st = 'warning'
      msgs.push('Sin columnas definidas')
    }
  }
  fam.status = st
  fam.messages = msgs
}

const toggleFamilyRowAction = (fam: ParsedFamilyRow) => {
  if (!authStore.isAdmin && fam.action !== 'delete') return
  fam.action = fam.action === 'delete' ? 'upsert' : 'delete'
  pendingDestructiveConfirm.value = false
  revalidateFamilyRow(fam)
}

const onFamilyFilasInput = (fam: ParsedFamilyRow, val: string) => {
  const names = val
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  fam.filas = names.map(nombre => ({ nombre, tipo_fila: 'normal' as const }))
  revalidateFamilyRow(fam)
}

const removePreviewFamily = (idx: number) => {
  if (!parseResult.value) return
  parseResult.value.families.splice(idx, 1)
  pendingDestructiveConfirm.value = false
}

const revalidatePartRow = (row: ParsedPartRow) => {
  const msgs: string[] = []
  let st: ParsedPartRow['status'] = 'valid'
  if (row.action === 'delete') {
    if (!row.sourceId && !String(row.codigo_oem || '').trim()) {
      st = 'error'
      msgs.push('Falta id o codigo_oem para eliminar')
    }
  } else {
    if (!String(row.codigo_oem || '').trim()) {
      st = 'error'
      msgs.push('Falta codigo_oem')
    }
    if (!String(row.nombre || '').trim()) {
      st = 'error'
      msgs.push('Falta nombre del repuesto')
    }
    if (String(row.motorCodigo || '').trim() && !String(row.fabricante || '').trim()) {
      if (st === 'valid') st = 'warning'
      msgs.push('Motor indicado sin fabricante')
    }
  }
  row.status = st
  row.messages = msgs
}

const togglePartRowAction = (row: ParsedPartRow) => {
  row.action = row.action === 'delete' ? 'upsert' : 'delete'
  pendingDestructiveConfirm.value = false
  revalidatePartRow(row)
}

const onPartFamilyChange = (row: ParsedPartRow, value: string) => {
  row.familiaRaw = value
  const fromStore = catalogStore.grupos.find(
    g => g.codigo === value || g.nombre === value
  )
  if (fromStore) {
    row.resolvedGrupoCodigo = fromStore.codigo
    row.resolvedGrupoNombre = fromStore.nombre
    row.categoria = fromStore.categoria
    if (!row.subsistema || row.subsistema === 'Motor') {
      row.subsistema = fromStore.subsistema || 'Motor'
    }
  } else {
    const fromImport = parseResult.value?.families.find(
      f => f.codigo === value || f.nombre === value
    )
    if (fromImport) {
      row.resolvedGrupoCodigo = fromImport.codigo
      row.resolvedGrupoNombre = fromImport.nombre
      row.categoria = fromImport.categoria
      row.subsistema = fromImport.subsistema || row.subsistema
    } else if (value.trim()) {
      row.resolvedGrupoNombre = value.trim()
      row.categoria = value.trim()
    }
  }
  revalidatePartRow(row)
}

const onPartModelsInput = (row: ParsedPartRow, val: string) => {
  row.modelos = val
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (row.modelos.length > 0) {
    row.dimensiones.modelo = row.modelos.map(m => m.toUpperCase()).join(' / ')
    row.dimensiones.modelos = row.modelos.map(m => m.toUpperCase())
  } else {
    delete row.dimensiones.modelo
    delete row.dimensiones.modelos
  }
}

const onPartOemAdicionalesInput = (row: ParsedPartRow, val: string) => {
  row.codigos_oem_adicionales = val
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
}

const formatEquivalenciasText = (row: ParsedPartRow): string => {
  return row.equivalencias
    .map(e => (e.marca_alterna ? `${e.marca_alterna}: ${e.codigo_alterno}` : e.codigo_alterno))
    .join('; ')
}

const onPartEquivalenciasInput = (row: ParsedPartRow, val: string) => {
  const entries = val
    .split(/[;\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
  row.equivalencias = entries.map(entry => {
    const colonIdx = entry.indexOf(':')
    if (colonIdx > 0) {
      return {
        marca_alterna: entry.slice(0, colonIdx).trim(),
        codigo_alterno: entry.slice(colonIdx + 1).trim(),
      }
    }
    return { marca_alterna: 'Alterno', codigo_alterno: entry }
  })
}

const onPartYearInput = (row: ParsedPartRow, val: string) => {
  row.anio = val.trim() || undefined
  if (row.anio) {
    row.dimensiones.ano = row.anio
  } else {
    delete row.dimensiones.ano
  }
}

const getEditableDimensionKeys = (row: ParsedPartRow): string[] => {
  return Object.keys(row.dimensiones || {}).filter(
    k =>
      typeof row.dimensiones[k] !== 'object' &&
      !['marca', 'modelo', 'modelos', 'ano', 'codigos_oem_adicionales'].includes(k)
  )
}

const getVisibleSqlCotaFields = (row: ParsedPartRow) => {
  return SQL_COTA_FIELDS.filter(
    f => row[f.key] !== undefined && row[f.key] !== null && row[f.key] !== ''
  )
}

const onPartSqlCotaInput = (row: ParsedPartRow, key: keyof ParsedPartRow, isText: boolean | undefined, val: string) => {
  const clean = val.trim()
  if (!clean) {
    ;(row as any)[key] = null
    return
  }
  if (isText) {
    ;(row as any)[key] = clean
  } else {
    const num = Number(clean)
    ;(row as any)[key] = isNaN(num) ? null : num
  }
}

const onPartDimInput = (row: ParsedPartRow, dimKey: string, val: string) => {
  const clean = val.trim()
  if (!clean) {
    delete row.dimensiones[dimKey]
    return
  }
  const num = Number(clean)
  row.dimensiones[dimKey] = !isNaN(num) && clean !== '' ? num : clean
}

const removePreviewPart = (idx: number) => {
  if (!parseResult.value) return
  parseResult.value.parts.splice(idx, 1)
  pendingDestructiveConfirm.value = false
  if (expandedPartIdx.value === idx) expandedPartIdx.value = null
  else if (expandedPartIdx.value !== null && expandedPartIdx.value > idx) expandedPartIdx.value--
}

const revalidateMotorRow = (m: ParsedMotorRow) => {
  const msgs: string[] = []
  let st: ParsedMotorRow['status'] = 'valid'
  if (!String(m.codigo || '').trim()) {
    st = 'error'
    msgs.push('Falta el código de motor')
  }
  if (!String(m.fabricante || '').trim()) {
    st = 'error'
    msgs.push('Falta el fabricante / marca')
  }
  m.status = st
  m.messages = msgs
}

const onMotorModelsInput = (m: ParsedMotorRow, val: string) => {
  m.modelos = val
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

const removePreviewMotor = (idx: number) => {
  if (!parseResult.value) return
  parseResult.value.motors.splice(idx, 1)
}

// =============================================================================
// DETECCIÓN DE FAMILIA OBJETIVO Y SINCRONIZACIÓN DE ELIMINADOS
// =============================================================================
const detectedSyncGrupo = computed<GrupoRepuesto | null>(() => {
  const res = parseResult.value
  if (!res) return null
  if (res.families.some(f => f.action === 'delete')) return null

  const findGrupoInStore = (idHint?: string, codeHint?: string, nameHint?: string) => {
    return (
      catalogStore.grupos.find(
        g =>
          (idHint && g.id === idHint) ||
          (codeHint && normalizeText(g.codigo) === normalizeText(codeHint)) ||
          (nameHint && normalizeText(g.nombre) === normalizeText(nameHint))
      ) || null
    )
  }

  if (res.exportMeta) {
    const byMeta = findGrupoInStore(
      res.exportMeta.familia_id,
      res.exportMeta.familia_codigo,
      res.exportMeta.familia_nombre
    )
    if (byMeta) return byMeta
  }

  if (res.families.length === 1) {
    const f = res.families[0]!
    const byFamilyRow = findGrupoInStore(f.sourceId, f.codigo, f.nombre)
    if (byFamilyRow) return byFamilyRow
  }

  if (res.parts.length > 0) {
    const resolvedCodes = Array.from(
      new Set(res.parts.map(p => p.resolvedGrupoCodigo).filter((c): c is string => Boolean(c)))
    )
    if (resolvedCodes.length === 1) {
      const byParts = findGrupoInStore(undefined, resolvedCodes[0], undefined)
      if (byParts) return byParts
    }
  }

  if (selectedDefaultImportGroup.value && res.parts.length > 0) {
    return selectedDefaultImportGroup.value
  }

  return null
})

watch(
  [() => parseResult.value, detectedSyncGrupo],
  async ([res, grupo]) => {
    const token = ++syncFetchToken
    if (!res || !grupo) {
      syncExistingParts.value = []
      syncFamilyDeleteMissing.value = false
      isLoadingSyncParts.value = false
      return
    }
    isLoadingSyncParts.value = true
    try {
      const existingParts = await catalogService.getAllRepuestosForGrupoExport(grupo)
      if (token === syncFetchToken) {
        syncExistingParts.value = existingParts
      }
    } catch {
      if (token === syncFetchToken) {
        syncExistingParts.value = []
      }
    } finally {
      if (token === syncFetchToken) {
        isLoadingSyncParts.value = false
      }
    }
  }
)

const rawSyncMissingParts = computed<RepuestoTecnico[]>(() => {
  const res = parseResult.value
  if (!res || !detectedSyncGrupo.value) return []

  const fileIds = new Set(
    res.parts.map(p => p.sourceId).filter((id): id is string => Boolean(id))
  )
  const fileOems = new Set(
    res.parts.map(p => (p.codigo_oem || '').trim().toUpperCase()).filter(Boolean)
  )

  return syncExistingParts.value.filter(ep => {
    if (fileIds.has(ep.id)) return false
    const oem = (ep.codigo_oem || '').trim().toUpperCase()
    if (oem && fileOems.has(oem)) return false
    return true
  })
})

const syncMissingParts = computed<RepuestoTecnico[]>(() => {
  const actor = currentCatalogActor.value
  return rawSyncMissingParts.value.filter(ep => canActorModifyRepuesto(ep, actor))
})

const syncProtectedMissingCount = computed(
  () => Math.max(0, rawSyncMissingParts.value.length - syncMissingParts.value.length)
)

const validFamiliesCount = computed(
  () => parseResult.value?.families.filter(f => f.status !== 'error').length || 0
)
const validMotorsCount = computed(
  () => parseResult.value?.motors.filter(m => m.status !== 'error').length || 0
)
const validPartsCount = computed(
  () => parseResult.value?.parts.filter(p => p.status !== 'error').length || 0
)
const deleteFamiliesCount = computed(() =>
  authStore.isAdmin
    ? parseResult.value?.families.filter(f => f.status !== 'error' && f.action === 'delete').length || 0
    : 0
)
const explicitDeletePartsCount = computed(
  () => parseResult.value?.parts.filter(p => p.status !== 'error' && p.action === 'delete').length || 0
)
const syncMissingCount = computed(() =>
  syncFamilyDeleteMissing.value && detectedSyncGrupo.value ? syncMissingParts.value.length : 0
)
const totalDeleteOperationsCount = computed(
  () => deleteFamiliesCount.value + explicitDeletePartsCount.value + syncMissingCount.value
)
const hasAnyExecutableChange = computed(
  () =>
    validFamiliesCount.value +
      validMotorsCount.value +
      validPartsCount.value +
      syncMissingCount.value >
    0
)

const errorRowsCount = computed(() => {
  if (!parseResult.value) return 0
  return (
    parseResult.value.families.filter(f => f.status === 'error').length +
    parseResult.value.motors.filter(m => m.status === 'error').length +
    parseResult.value.parts.filter(p => p.status === 'error').length
  )
})
const warningRowsCount = computed(() => {
  if (!parseResult.value) return 0
  return (
    parseResult.value.families.filter(f => f.status === 'warning').length +
    parseResult.value.motors.filter(m => m.status === 'warning').length +
    parseResult.value.parts.filter(p => p.status === 'warning').length
  )
})

const progressPercent = computed(() => {
  if (progressTotal.value <= 0) return 0
  return Math.min(100, Math.round((progressCurrent.value / progressTotal.value) * 100))
})

const handleRunImport = async () => {
  if (!parseResult.value || !hasAnyExecutableChange.value) return

  if (totalDeleteOperationsCount.value > 0 && !pendingDestructiveConfirm.value) {
    pendingDestructiveConfirm.value = true
    return
  }

  pendingDestructiveConfirm.value = false
  const totalValid =
    validFamiliesCount.value +
    validMotorsCount.value +
    validPartsCount.value +
    (syncMissingCount.value > 0 ? 1 : 0)

  isImporting.value = true
  progressCurrent.value = 0
  progressTotal.value = totalValid
  progressLabel.value = 'Preparando importación...'
  importReport.value = null

  try {
    const report = await executeCatalogImport(
      parseResult.value,
      {
        defaultGrupo: selectedDefaultImportGroup.value,
        duplicateStrategy: duplicateStrategy.value,
        autoCreateEntities: autoCreateEntities.value,
        syncFamilyDeleteMissing: syncFamilyDeleteMissing.value,
        syncTargetGrupo: detectedSyncGrupo.value,
        deletePartsWithDeletedFamily: true,
        actor: currentCatalogActor.value,
        onProgress: (cur, tot, lbl) => {
          progressCurrent.value = cur
          progressTotal.value = tot
          progressLabel.value = lbl
        }
      },
      {
        grupos: catalogStore.grupos,
        fabricantes: catalogStore.fabricantes,
        modelos: catalogStore.modelos,
        motores: catalogStore.motores,
        repuestos: catalogStore.repuestos
      }
    )

    importReport.value = report
    const refreshTasks: Array<Promise<unknown>> = []
    if (report.createdFamilies + report.updatedFamilies + report.deletedFamilies > 0) {
      refreshTasks.push(catalogStore.fetchGrupos())
    }
    if (report.createdBrands > 0) {
      refreshTasks.push(catalogStore.fetchFabricantes())
    }
    if (report.createdModels > 0) {
      refreshTasks.push(catalogStore.fetchModelos())
    }
    if (report.createdMotors > 0 || report.createdModels > 0) {
      refreshTasks.push(catalogStore.fetchMotores())
    }
    if (refreshTasks.length > 0) {
      await Promise.all(refreshTasks)
    }
    emit('imported', report)
  } catch (err) {
    parseError.value =
      err instanceof Error ? err.message : 'Error inesperado durante la importación'
  } finally {
    isImporting.value = false
  }
}

const formatDimsSummary = (dims: Record<string, unknown>): string => {
  const entries = Object.entries(dims || {}).filter(
    ([k, v]) =>
      v !== undefined &&
      v !== null &&
      v !== '' &&
      typeof v !== 'object' &&
      !['marca', 'modelo', 'ano', 'codigos_oem_adicionales'].includes(k)
  )
  const ringsCount = Array.isArray(dims?.anillos) ? dims.anillos.length : 0
  const textParts = entries.slice(0, 4).map(([k, v]) => `${k.replace(/_mm$/i, '')}: ${v}`)
  if (ringsCount > 0) {
    textParts.unshift(`${ringsCount} anillos`)
  }
  return textParts.join(' · ') || '—'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs"
      @click.self="!isImporting && emit('close')"
    >
      <div class="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-[#0D1B3E] via-[#004B97] to-[#0284C7] px-5 py-4 text-white flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <FileSpreadsheet class="w-5 h-5 text-[#BFEBF2]" />
            </div>
            <div>
              <h2 class="text-base sm:text-lg font-extrabold tracking-tight">
                Importar / Exportar Catálogo (Excel / JSON) y Plantillas
              </h2>
              <p class="text-[11px] sm:text-xs text-blue-100/90">
                Exporta una familia completa para editar o eliminar por lote, descarga plantillas o carga archivos.
              </p>
            </div>
          </div>
          <button
            type="button"
            :disabled="isImporting"
            @click="emit('close')"
            class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50 cursor-pointer"
            title="Cerrar"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <!-- PASO 1: EXPORTAR FAMILIA COMPLETA Y PLANTILLAS -->
          <section class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-3.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-md bg-[#004B97] text-white text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                  Exportar Familia Completa o Descargar Plantilla
                </h3>
              </div>
            </div>

            <!-- Exportar familia entera con datos reales -->
            <div class="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <div class="text-[11px] font-extrabold text-[#004B97] uppercase tracking-wider flex items-center gap-1.5">
                  <Download class="w-3.5 h-3.5 text-[#04C4D9]" />
                  <span>Exportar Familia Entera (Esquema + Todos sus Repuestos)</span>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                <div class="md:col-span-6">
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Familia a exportar
                  </label>
                  <select
                    v-model="exportFamilyId"
                    :disabled="isExportingFamily || catalogStore.grupos.length === 0"
                    class="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#04C4D9] disabled:opacity-60"
                  >
                    <option value="__ALL__">
                      Todo el Catálogo (Todas las familias y repuestos)
                    </option>
                    <option
                      v-for="g in catalogStore.grupos"
                      :key="`exp-grp-${g.id}`"
                      :value="g.codigo"
                    >
                      {{ g.nombre }} ({{ g.categoria }})
                    </option>
                  </select>
                </div>

                <div class="md:col-span-3">
                  <button
                    type="button"
                    :disabled="isExportingFamily || (!selectedExportGroup && !isExportAllSelected)"
                    @click="handleExportFamily('excel')"
                    class="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Loader2 v-if="isExportingFamily" class="w-3.5 h-3.5 animate-spin" />
                    <Download v-else class="w-3.5 h-3.5" />
                    <span>Exportar Excel (.xlsx)</span>
                  </button>
                </div>

                <div class="md:col-span-3">
                  <button
                    type="button"
                    :disabled="isExportingFamily || (!selectedExportGroup && !isExportAllSelected)"
                    @click="handleExportFamily('json')"
                    class="w-full px-3 py-2 rounded-lg bg-[#004B97] hover:bg-[#0D1B3E] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Loader2 v-if="isExportingFamily" class="w-3.5 h-3.5 animate-spin" />
                    <FileJson v-else class="w-3.5 h-3.5" />
                    <span>Exportar JSON (.json)</span>
                  </button>
                </div>
              </div>

              <p class="text-[11px] text-slate-600">
                Descarga la familia completa con su ID interno para <strong>editar medidas, códigos OEM, precios</strong> o marcar filas con <code class="px-1 py-0.5 bg-white border border-cyan-200 rounded font-mono text-[10px]">accion = eliminar</code> y re-importar en el Paso 2.
              </p>

              <div
                v-if="exportFeedback"
                :class="[
                  'p-2.5 rounded-lg border text-xs font-semibold flex items-start gap-2',
                  exportFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                ]"
              >
                <CheckCircle2 v-if="exportFeedback.type === 'success'" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <XCircle v-else class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{{ exportFeedback.text }}</span>
              </div>
            </div>

            <!-- Plantilla vacía / de ejemplo -->
            <div class="pt-1 border-t border-slate-200/80 space-y-2.5">
              <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                <div class="md:col-span-6">
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    O descargar plantilla vacía de ejemplo
                  </label>
                  <select
                    v-model="specificTarget"
                    class="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                  >
                    <option value="motors_only">Solo Motores (altas de motores y modelos)</option>
                    <option value="families_only">Solo Familias (crear o actualizar familias, filas y columnas)</option>
                    <option value="parts_all">Solo Repuestos (todas las medidas estándar)</option>
                    <option
                      v-for="g in catalogStore.grupos"
                      :key="`tpl-grp-${g.id}`"
                      :value="`grupo:${g.codigo}`"
                    >
                      Solo Repuestos · Familia: {{ g.nombre }}
                    </option>
                  </select>
                </div>

                <div class="md:col-span-3">
                  <button
                    type="button"
                    @click="downloadCatalogExcelTemplate(catalogStore.grupos, resolvedTemplateScope, selectedTemplateGroup)"
                    class="w-full px-3 py-2 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Download class="w-3.5 h-3.5" />
                    <span>Plantilla Excel (.xlsx)</span>
                  </button>
                </div>

                <div class="md:col-span-3">
                  <button
                    type="button"
                    @click="downloadCatalogJsonTemplate(catalogStore.grupos, resolvedTemplateScope, selectedTemplateGroup)"
                    class="w-full px-3 py-2 rounded-lg bg-white hover:bg-sky-50 border border-[#004B97]/30 text-[#004B97] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <FileJson class="w-3.5 h-3.5" />
                    <span>Plantilla JSON (.json)</span>
                  </button>
                </div>
              </div>

              <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Info class="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                <span>{{ templateScopeHint }}</span>
              </div>
            </div>
          </section>

          <!-- PASO 2: CARGAR ARCHIVO O PEGAR JSON -->
          <section class="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-md bg-[#004B97] text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                  Cargar Archivo Excel / CSV / JSON
                </h3>
              </div>

              <div class="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  @click="inputMode = 'file'"
                  :class="[
                    'px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer',
                    inputMode === 'file' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  ]"
                >
                  <Upload class="w-3.5 h-3.5" />
                  <span>Subir Archivo</span>
                </button>
                <button
                  type="button"
                  @click="inputMode = 'paste'"
                  :class="[
                    'px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer',
                    inputMode === 'paste' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  ]"
                >
                  <ClipboardPaste class="w-3.5 h-3.5" />
                  <span>Pegar JSON</span>
                </button>
              </div>
            </div>

            <!-- Modo Archivo -->
            <div
              v-if="inputMode === 'file'"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="onDropFile"
              :class="[
                'rounded-xl border-2 border-dashed p-5 text-center transition',
                isDragging
                  ? 'border-[#04C4D9] bg-cyan-50/70'
                  : 'border-slate-300 bg-slate-50/50 hover:border-[#0284C7]'
              ]"
            >
              <input
                id="catalog-import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                class="hidden"
                @change="onFileInputChange"
              />
              <label
                for="catalog-import-file-input"
                class="cursor-pointer flex flex-col items-center gap-2"
              >
                <div class="w-10 h-10 rounded-full bg-cyan-100 text-[#004B97] flex items-center justify-center">
                  <Upload class="w-5 h-5" />
                </div>
                <div class="text-xs sm:text-sm font-bold text-slate-800">
                  {{ selectedFile ? `Archivo cargado: ${selectedFile.name}` : 'Haz clic aquí o arrastra tu archivo Excel (.xlsx, .xls, .csv) o JSON (.json)' }}
                </div>
                <span class="text-[11px] text-slate-500">
                  Formatos soportados: .xlsx, .xls, .csv, .json
                </span>
              </label>
            </div>

            <!-- Modo Pegar JSON -->
            <div v-else class="space-y-2">
              <textarea
                v-model="rawJsonText"
                rows="5"
                placeholder='Pega aquí tu JSON, por ejemplo: { "repuestos": [ { "codigo_oem": "13011-35041", "nombre": "Anillos 22R", ... } ] }'
                class="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#04C4D9]"
              ></textarea>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  @click="handleParsePastedJson"
                  class="px-3.5 py-1.5 rounded-lg bg-[#004B97] hover:bg-[#0D1B3E] text-white text-xs font-bold cursor-pointer transition"
                >
                  Analizar JSON
                </button>
              </div>
            </div>

            <!-- Opciones de importación -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
              <div class="md:col-span-5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Familia por defecto (si la fila no especifica)
                </label>
                <select
                  v-model="defaultImportGroupId"
                  class="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="">Según columna familia / categoría del archivo</option>
                  <option
                    v-for="g in catalogStore.grupos"
                    :key="`def-grp-${g.id}`"
                    :value="g.codigo"
                  >
                    {{ g.nombre }} ({{ g.categoria }})
                  </option>
                </select>
              </div>

              <div class="md:col-span-4">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Si el registro / OEM ya existe
                </label>
                <select
                  v-model="duplicateStrategy"
                  class="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="skip">Omitir duplicado</option>
                  <option value="update">Actualizar registro existente</option>
                  <option value="create">Crear siempre nuevo registro</option>
                </select>
              </div>

              <div class="md:col-span-3 flex items-end pb-1">
                <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    v-model="autoCreateEntities"
                    type="checkbox"
                    class="w-4 h-4 rounded border-slate-300 text-[#004B97] focus:ring-[#04C4D9]"
                  />
                  <span>Crear marcas / motores faltantes</span>
                </label>
              </div>
            </div>

            <!-- Aviso automático de archivo exportado -->
            <div
              v-if="parseResult && autoUpdateActivatedNotice"
              class="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[#004B97] text-xs font-semibold flex items-center gap-2"
            >
              <Info class="w-4 h-4 text-[#0284C7] shrink-0" />
              <span>
                Archivo de exportación detectado: se activó automáticamente <strong>«Actualizar registro existente»</strong> para aplicar ediciones por ID incluso si modificaste códigos OEM.
              </span>
            </div>

            <!-- Sincronización opcional de familia (eliminar faltantes) -->
            <div
              v-if="parseResult && detectedSyncGrupo"
              class="rounded-xl border p-3 space-y-2 transition"
              :class="syncFamilyDeleteMissing ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50/80 border-slate-200'"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="inline-flex items-start gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                  <input
                    v-model="syncFamilyDeleteMissing"
                    @change="pendingDestructiveConfirm = false"
                    type="checkbox"
                    :disabled="isLoadingSyncParts"
                    class="w-4 h-4 mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 accent-rose-600"
                  />
                  <span>
                    Sincronizar familia <span class="text-[#004B97]">«{{ detectedSyncGrupo.nombre }}»</span>:
                    <template v-if="isLoadingSyncParts">
                      <span class="text-slate-500 font-medium"> calculando diferencias...</span>
                    </template>
                    <template v-else-if="syncMissingParts.length > 0">
                      <span class="text-rose-700">
                        eliminar del catálogo los {{ syncMissingParts.length }} repuesto(s) propios que quitaste del archivo
                      </span>
                      <span v-if="syncProtectedMissingCount > 0" class="text-slate-500 font-medium">
                        ({{ syncProtectedMissingCount }} de otros usuarios/admin se conservarán intactos)
                      </span>
                    </template>
                    <template v-else>
                      <span class="text-emerald-700 font-semibold">
                        sin repuestos propios faltantes ({{ syncExistingParts.length }} evaluados<template v-if="syncProtectedMissingCount > 0"> · {{ syncProtectedMissingCount }} protegidos de otros usuarios</template>)
                      </span>
                    </template>
                  </span>
                </label>

                <button
                  v-if="syncFamilyDeleteMissing && syncMissingParts.length > 0"
                  type="button"
                  @click="showSyncMissingPreview = !showSyncMissingPreview"
                  class="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100/70 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{{ showSyncMissingPreview ? 'Ocultar lista' : `Ver ${syncMissingParts.length} a eliminar` }}</span>
                  <ChevronUp v-if="showSyncMissingPreview" class="w-3.5 h-3.5" />
                  <ChevronDown v-else class="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                v-if="syncFamilyDeleteMissing && showSyncMissingPreview && syncMissingParts.length > 0"
                class="max-h-36 overflow-auto rounded-lg border border-rose-200 bg-white divide-y divide-rose-100 text-[11px]"
              >
                <div
                  v-for="mp in syncMissingParts"
                  :key="`sync-miss-${mp.id}`"
                  class="px-3 py-1.5 flex items-center justify-between gap-2"
                >
                  <span class="font-mono font-bold text-rose-700 shrink-0">{{ mp.codigo_oem }}</span>
                  <span class="text-slate-700 truncate">{{ mp.nombre }}</span>
                </div>
              </div>
            </div>

            <!-- Error de parseo -->
            <div
              v-if="parseError"
              class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2"
            >
              <XCircle class="w-4 h-4 text-rose-600 shrink-0" />
              <span>{{ parseError }}</span>
            </div>
          </section>

          <!-- PASO 3: VISTA PREVIA -->
          <section
            v-if="parseResult"
            class="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="w-5 h-5 rounded-md bg-[#004B97] text-white text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                  Vista Previa ({{ parseResult.fileName }})
                </h3>
                <span class="text-[10px] font-semibold text-[#038391] bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
                  Editable antes de importar
                </span>
                <span
                  v-if="parseResult.families.length > 0"
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900"
                >
                  Familias: {{ validFamiliesCount }}
                </span>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  Repuestos: {{ validPartsCount }}
                </span>
                <span
                  v-if="parseResult.motors.length > 0"
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-[#004B97]"
                >
                  Motores: {{ validMotorsCount }}
                </span>
                <span
                  v-if="totalDeleteOperationsCount > 0"
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white"
                >
                  A eliminar: {{ totalDeleteOperationsCount }}
                </span>
                <span
                  v-if="warningRowsCount > 0"
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800"
                >
                  Advertencias: {{ warningRowsCount }}
                </span>
                <span
                  v-if="errorRowsCount > 0"
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800"
                >
                  Errores (se omitirán): {{ errorRowsCount }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <div
                  v-if="[parseResult.families.length > 0, parseResult.parts.length > 0, parseResult.motors.length > 0].filter(Boolean).length > 1"
                  class="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold"
                >
                  <button
                    v-if="parseResult.families.length > 0"
                    type="button"
                    @click="previewTab = 'familias'"
                    :class="[
                      'px-2.5 py-1 rounded-md transition cursor-pointer',
                      previewTab === 'familias' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    ]"
                  >
                    Familias ({{ parseResult.families.length }})
                  </button>
                  <button
                    v-if="parseResult.parts.length > 0"
                    type="button"
                    @click="previewTab = 'repuestos'"
                    :class="[
                      'px-2.5 py-1 rounded-md transition cursor-pointer',
                      previewTab === 'repuestos' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    ]"
                  >
                    Repuestos ({{ parseResult.parts.length }})
                  </button>
                  <button
                    v-if="parseResult.motors.length > 0"
                    type="button"
                    @click="previewTab = 'motores'"
                    :class="[
                      'px-2.5 py-1 rounded-md transition cursor-pointer',
                      previewTab === 'motores' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    ]"
                  >
                    Motores ({{ parseResult.motors.length }})
                  </button>
                </div>

                <button
                  type="button"
                  :disabled="isImporting"
                  @click="handleClearLoaded"
                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div
              v-for="(w, wIdx) in parseResult.warnings"
              :key="`pw-${wIdx}`"
              class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium"
            >
              {{ w }}
            </div>

            <div
              v-if="!authStore.isAdmin"
              class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2"
            >
              <ShieldAlert class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Permisos de carga:</strong> puedes crear familias nuevas, subir nuevos repuestos y modificar o eliminar únicamente los repuestos que hayas subido con tu usuario. Las familias ya existentes y repuestos de otros usuarios o del administrador permanecerán protegidos.
              </span>
            </div>

            <div
              v-if="deleteFamiliesCount > 0"
              class="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2"
            >
              <ShieldAlert class="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Atención: hay {{ deleteFamiliesCount }} familia(s) marcada(s) para eliminar. Al confirmar, se eliminará la familia completa junto con todos sus repuestos.
              </span>
            </div>

            <!-- Tabla Preview Familias (Editable antes de importar) -->
            <div
              v-if="previewTab === 'familias'"
              class="max-h-72 overflow-auto border border-slate-200 rounded-xl"
            >
              <table class="w-full text-left text-[11px] border-collapse">
                <thead class="sticky top-0 z-10 bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="py-2 px-2 border-b border-slate-200">Estado</th>
                    <th class="py-2 px-2 border-b border-slate-200">Acción</th>
                    <th class="py-2 px-2 border-b border-slate-200">Nombre de Familia</th>
                    <th class="py-2 px-2 border-b border-slate-200">Subsistema</th>
                    <th class="py-2 px-2 border-b border-slate-200">Vista</th>
                    <th class="py-2 px-2 border-b border-slate-200">Filas</th>
                    <th class="py-2 px-2 border-b border-slate-200">Columnas / Medidas</th>
                    <th class="py-2 px-2 border-b border-slate-200 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(fam, fIdx) in parseResult.families.slice(0, 100)"
                    :key="`prev-fam-${fIdx}`"
                    :class="
                      fam.status === 'error'
                        ? 'bg-rose-50/70'
                        : fam.action === 'delete'
                          ? 'bg-rose-50/80'
                          : 'hover:bg-slate-50/70'
                    "
                  >
                    <td class="py-1.5 px-2 whitespace-nowrap align-top">
                      <span
                        v-if="fam.status === 'error'"
                        class="inline-flex items-center gap-1 text-rose-700 font-bold"
                        :title="fam.messages.join(' | ')"
                      >
                        <XCircle class="w-3.5 h-3.5" /> Error
                      </span>
                      <span
                        v-else-if="fam.action === 'delete'"
                        class="inline-flex items-center gap-1 text-rose-700 font-bold"
                      >
                        <Trash2 class="w-3.5 h-3.5" /> Baja
                      </span>
                      <span
                        v-else-if="fam.status === 'valid'"
                        class="inline-flex items-center gap-1 text-emerald-700 font-bold"
                      >
                        <CheckCircle2 class="w-3.5 h-3.5" /> Listo
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 text-amber-700 font-bold"
                        :title="fam.messages.join(' | ')"
                      >
                        <AlertTriangle class="w-3.5 h-3.5" /> Aviso
                      </span>
                      <div v-if="fam.messages.length > 0" class="text-[10px] text-slate-500 max-w-[130px]">
                        {{ fam.messages.join(' · ') }}
                      </div>
                    </td>
                    <td class="py-1.5 px-2 align-top whitespace-nowrap">
                      <button
                        v-if="authStore.isAdmin"
                        type="button"
                        @click="toggleFamilyRowAction(fam)"
                        :class="[
                          'px-2 py-1 rounded-md border text-[10px] font-bold transition cursor-pointer inline-flex items-center gap-1',
                          fam.action === 'delete'
                            ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        ]"
                        :title="fam.action === 'delete' ? 'Cambiar a Guardar / Actualizar' : 'Marcar esta familia para eliminar'"
                      >
                        <Trash2 v-if="fam.action === 'delete'" class="w-3 h-3" />
                        <span>{{ fam.action === 'delete' ? 'Eliminar familia' : 'Guardar / Act.' }}</span>
                      </button>
                      <span
                        v-else
                        class="inline-flex items-center px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600"
                        title="Solo el administrador puede eliminar o sobrescribir familias existentes"
                      >
                        {{ fam.action === 'delete' ? 'Elim. bloqueada' : 'Nueva familia' }}
                      </span>
                    </td>
                    <td class="py-1.5 px-2 align-top space-y-1" :class="{ 'opacity-60': fam.action === 'delete' }">
                      <input
                        v-model="fam.nombre"
                        :disabled="fam.action === 'delete'"
                        @input="revalidateFamilyRow(fam)"
                        type="text"
                        placeholder="Nombre familia *"
                        class="w-40 px-2 py-1 rounded border border-slate-200 bg-white font-bold text-slate-900 text-[11px] focus:outline-none focus:border-[#04C4D9]"
                      />
                      <input
                        v-model="fam.codigo"
                        :disabled="fam.action === 'delete'"
                        type="text"
                        placeholder="codigo_slug"
                        class="block w-40 px-2 py-0.5 rounded border border-slate-100 bg-slate-50 font-mono text-[10px] text-slate-500 focus:outline-none focus:border-[#04C4D9]"
                      />
                    </td>
                    <td class="py-1.5 px-2 align-top" :class="{ 'opacity-60': fam.action === 'delete' }">
                      <select
                        v-model="fam.subsistema"
                        :disabled="fam.action === 'delete'"
                        class="px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                      >
                        <option value="Block">Block</option>
                        <option value="Culata">Culata</option>
                        <option value="Cigüeñal">Cigüeñal</option>
                        <option value="Motor">Motor</option>
                        <option value="General">General</option>
                      </select>
                    </td>
                    <td class="py-1.5 px-2 align-top" :class="{ 'opacity-60': fam.action === 'delete' }">
                      <select
                        v-model="fam.tipo_vista"
                        :disabled="fam.action === 'delete'"
                        class="px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-bold text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                      >
                        <option value="normal">Normal</option>
                        <option value="tabla">Tabla</option>
                      </select>
                    </td>
                    <td class="py-1.5 px-2 align-top" :class="{ 'opacity-60': fam.action === 'delete' }">
                      <input
                        v-if="fam.tipo_vista === 'tabla'"
                        :disabled="fam.action === 'delete'"
                        :value="fam.filas.map(r => r.nombre).join(', ')"
                        @change="onFamilyFilasInput(fam, ($event.target as HTMLInputElement).value)"
                        type="text"
                        placeholder="Fila 1, Fila 2..."
                        class="w-36 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                      />
                      <span v-else class="text-slate-400">—</span>
                    </td>
                    <td class="py-1.5 px-2 align-top font-mono text-[10px] text-slate-700 space-y-1" :class="{ 'opacity-60': fam.action === 'delete' }">
                      <div
                        v-for="(col, cIdx) in fam.columnas"
                        :key="`fam-col-${fIdx}-${cIdx}`"
                        class="flex items-center gap-1"
                      >
                        <input
                          v-model="col.etiqueta"
                          :disabled="fam.action === 'delete'"
                          type="text"
                          placeholder="Etiqueta"
                          class="w-28 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-sans focus:outline-none focus:border-[#04C4D9]"
                        />
                        <input
                          v-model="col.unidad"
                          :disabled="fam.action === 'delete'"
                          type="text"
                          placeholder="u."
                          class="w-12 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>
                    </td>
                    <td class="py-1.5 px-2 align-top text-right">
                      <button
                        type="button"
                        @click="removePreviewFamily(fIdx)"
                        class="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                        title="Quitar fila de la vista previa (no modifica la BD)"
                      >
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tabla Preview Repuestos (Editable antes de importar) -->
            <div
              v-else-if="previewTab === 'repuestos'"
              class="max-h-80 overflow-auto border border-slate-200 rounded-xl"
            >
              <table class="w-full text-left text-[11px] border-collapse">
                <thead class="sticky top-0 z-10 bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="py-2 px-2 border-b border-slate-200">Estado</th>
                    <th class="py-2 px-2 border-b border-slate-200">Acción</th>
                    <th class="py-2 px-2 border-b border-slate-200">Código OEM</th>
                    <th class="py-2 px-2 border-b border-slate-200">Nombre / Descripción</th>
                    <th class="py-2 px-2 border-b border-slate-200">Familia</th>
                    <th class="py-2 px-2 border-b border-slate-200">Marca / Motor / Año</th>
                    <th class="py-2 px-2 border-b border-slate-200">Alternos</th>
                    <th class="py-2 px-2 border-b border-slate-200">Medidas / Datos</th>
                    <th class="py-2 px-2 border-b border-slate-200 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <template
                    v-for="(row, rIdx) in parseResult.parts.slice(0, 100)"
                    :key="`prev-part-${rIdx}`"
                  >
                    <tr
                      :class="
                        row.status === 'error'
                          ? 'bg-rose-50/70'
                          : row.action === 'delete'
                            ? 'bg-rose-50/80'
                            : 'hover:bg-slate-50/70'
                      "
                    >
                      <td class="py-1.5 px-2 whitespace-nowrap align-top">
                        <span
                          v-if="row.status === 'error'"
                          class="inline-flex items-center gap-1 text-rose-700 font-bold"
                          :title="row.messages.join(' | ')"
                        >
                          <XCircle class="w-3.5 h-3.5" /> Error
                        </span>
                        <span
                          v-else-if="row.action === 'delete'"
                          class="inline-flex items-center gap-1 text-rose-700 font-bold"
                        >
                          <Trash2 class="w-3.5 h-3.5" /> Baja
                        </span>
                        <span
                          v-else-if="row.status === 'valid'"
                          class="inline-flex items-center gap-1 text-emerald-700 font-bold"
                        >
                          <CheckCircle2 class="w-3.5 h-3.5" /> Listo
                        </span>
                        <span
                          v-else
                          class="inline-flex items-center gap-1 text-amber-700 font-bold"
                          :title="row.messages.join(' | ')"
                        >
                          <AlertTriangle class="w-3.5 h-3.5" /> Aviso
                        </span>
                        <div v-if="row.messages.length > 0" class="text-[10px] text-slate-500 max-w-[130px]">
                          {{ row.messages.join(' · ') }}
                        </div>
                      </td>
                      <td class="py-1.5 px-2 align-top whitespace-nowrap">
                        <button
                          type="button"
                          @click="togglePartRowAction(row)"
                          :class="[
                            'px-2 py-1 rounded-md border text-[10px] font-bold transition cursor-pointer inline-flex items-center gap-1',
                            row.action === 'delete'
                              ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          ]"
                          :title="row.action === 'delete' ? 'Cambiar a Guardar / Actualizar' : 'Marcar para eliminar del catálogo'"
                        >
                          <Trash2 v-if="row.action === 'delete'" class="w-3 h-3" />
                          <span>{{ row.action === 'delete' ? 'Eliminar' : 'Guardar' }}</span>
                        </button>
                      </td>
                      <td class="py-1.5 px-2 align-top space-y-1" :class="{ 'opacity-60': row.action === 'delete' }">
                        <input
                          v-model="row.codigo_oem"
                          :disabled="row.action === 'delete'"
                          @input="revalidatePartRow(row)"
                          type="text"
                          placeholder="Código OEM *"
                          class="w-28 px-2 py-1 rounded border border-slate-200 bg-white font-mono font-bold text-slate-900 text-[11px] focus:outline-none focus:border-[#04C4D9]"
                        />
                        <input
                          :value="row.codigos_oem_adicionales.join(', ')"
                          :disabled="row.action === 'delete'"
                          @change="onPartOemAdicionalesInput(row, ($event.target as HTMLInputElement).value)"
                          type="text"
                          placeholder="+ OEMs (coma)"
                          class="block w-28 px-2 py-0.5 rounded border border-slate-100 bg-slate-50 font-mono text-[9px] text-slate-600 focus:outline-none focus:border-[#04C4D9]"
                        />
                      </td>
                      <td class="py-1.5 px-2 align-top" :class="{ 'opacity-60 line-through': row.action === 'delete' }">
                        <input
                          v-model="row.nombre"
                          :disabled="row.action === 'delete'"
                          @input="revalidatePartRow(row)"
                          type="text"
                          placeholder="Nombre / Descripción *"
                          class="w-40 px-2 py-1 rounded border border-slate-200 bg-white font-medium text-slate-800 text-[11px] focus:outline-none focus:border-[#04C4D9]"
                        />
                      </td>
                      <td class="py-1.5 px-2 align-top" :class="{ 'opacity-60': row.action === 'delete' }">
                        <select
                          :value="row.resolvedGrupoCodigo || row.familiaRaw || row.categoria"
                          :disabled="row.action === 'delete'"
                          @change="onPartFamilyChange(row, ($event.target as HTMLSelectElement).value)"
                          class="w-32 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                        >
                          <option
                            v-if="(row.familiaRaw || row.categoria) && !catalogStore.grupos.some(g => g.codigo === (row.resolvedGrupoCodigo || row.familiaRaw) || g.nombre === (row.familiaRaw || row.categoria))"
                            :value="row.familiaRaw || row.categoria"
                          >
                            {{ row.resolvedGrupoNombre || row.familiaRaw || row.categoria }}
                          </option>
                          <option
                            v-for="g in catalogStore.grupos"
                            :key="g.id"
                            :value="g.codigo"
                          >
                            {{ g.nombre }}
                          </option>
                        </select>
                      </td>
                      <td class="py-1.5 px-2 align-top space-y-1" :class="{ 'opacity-60': row.action === 'delete' }">
                        <div class="flex items-center gap-1">
                          <input
                            v-model="row.fabricante"
                            :disabled="row.action === 'delete'"
                            @input="revalidatePartRow(row)"
                            type="text"
                            placeholder="Marca"
                            class="w-20 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                          />
                          <input
                            v-model="row.motorCodigo"
                            :disabled="row.action === 'delete'"
                            @input="revalidatePartRow(row)"
                            type="text"
                            placeholder="Motor"
                            class="w-20 px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono text-[10px] font-bold text-[#004B97] focus:outline-none focus:border-[#04C4D9]"
                          />
                        </div>
                        <div class="flex items-center gap-1">
                          <input
                            :value="row.modelos.join(', ')"
                            :disabled="row.action === 'delete'"
                            @change="onPartModelsInput(row, ($event.target as HTMLInputElement).value)"
                            type="text"
                            placeholder="Modelos (coma)"
                            class="w-24 px-1.5 py-0.5 rounded border border-slate-100 bg-slate-50 text-[10px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                          />
                          <input
                            :value="row.anio || ''"
                            :disabled="row.action === 'delete'"
                            @input="onPartYearInput(row, ($event.target as HTMLInputElement).value)"
                            type="text"
                            placeholder="Año"
                            class="w-16 px-1.5 py-0.5 rounded border border-slate-100 bg-slate-50 font-mono text-[10px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                          />
                        </div>
                      </td>
                      <td class="py-1.5 px-2 align-top" :class="{ 'opacity-60': row.action === 'delete' }">
                        <input
                          :value="formatEquivalenciasText(row)"
                          :disabled="row.action === 'delete'"
                          @change="onPartEquivalenciasInput(row, ($event.target as HTMLInputElement).value)"
                          type="text"
                          placeholder="RIK: 123; NPR: 456"
                          class="w-36 px-2 py-1 rounded border border-slate-200 bg-white font-mono text-[10px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                        />
                      </td>
                      <td class="py-1.5 px-2 align-top" :class="{ 'opacity-60': row.action === 'delete' }">
                        <button
                          type="button"
                          :disabled="row.action === 'delete'"
                          @click="expandedPartIdx = expandedPartIdx === rIdx ? null : rIdx"
                          class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                          :class="expandedPartIdx === rIdx
                            ? 'bg-[#004B97] text-white border-[#004B97]'
                            : 'bg-slate-50 hover:bg-cyan-50 text-slate-700 border-slate-200 hover:border-[#04C4D9]'"
                          title="Editar medidas, precio y stock de esta fila"
                        >
                          <SlidersHorizontal class="w-3 h-3" />
                          <span>{{ expandedPartIdx === rIdx ? 'Ocultar' : 'Editar medidas' }}</span>
                        </button>
                        <div class="mt-0.5 font-mono text-[9px] text-slate-500 max-w-[160px] truncate">
                          {{ formatDimsSummary(row.dimensiones) }}
                        </div>
                      </td>
                      <td class="py-1.5 px-2 align-top text-right">
                        <button
                          type="button"
                          @click="removePreviewPart(rIdx)"
                          class="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                          title="Quitar fila de la vista previa (no elimina de BD; usa Acción -> Eliminar para borrar de BD)"
                        >
                          <X class="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    <!-- Fila desplegable para editar medidas, precio, stock y origen -->
                    <tr v-if="expandedPartIdx === rIdx && row.action !== 'delete'" class="bg-cyan-50/40">
                      <td colspan="9" class="px-3 py-2.5 border-t border-cyan-100">
                        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[10px]">
                          <div>
                            <label class="block font-bold text-slate-600 mb-0.5">Catálogo origen</label>
                            <input
                              v-model="row.catalogo_origen"
                              type="text"
                              class="w-full px-2 py-1 rounded border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                            />
                          </div>
                          <div>
                            <label class="block font-bold text-slate-600 mb-0.5">Precio</label>
                            <input
                              v-model.number="row.precio"
                              type="number"
                              step="0.01"
                              min="0"
                              class="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                            />
                          </div>
                          <div>
                            <label class="block font-bold text-slate-600 mb-0.5">Stock</label>
                            <input
                              v-model.number="row.stock"
                              type="number"
                              min="0"
                              class="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                            />
                          </div>
                          <div
                            v-for="cField in getVisibleSqlCotaFields(row)"
                            :key="`sql-${rIdx}-${String(cField.key)}`"
                          >
                            <label class="block font-bold text-slate-600 mb-0.5 truncate" :title="cField.label">
                              {{ cField.label }}
                            </label>
                            <input
                              :value="(row[cField.key] as string | number | null | undefined) ?? ''"
                              @input="onPartSqlCotaInput(row, cField.key, cField.isText, ($event.target as HTMLInputElement).value)"
                              :type="cField.isText ? 'text' : 'number'"
                              step="0.001"
                              class="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                            />
                          </div>
                          <div
                            v-for="dimKey in getEditableDimensionKeys(row)"
                            :key="`dim-${rIdx}-${dimKey}`"
                          >
                            <label class="block font-bold text-slate-600 mb-0.5 truncate" :title="dimKey">
                              {{ dimKey.replace(/_/g, ' ') }}
                            </label>
                            <input
                              :value="row.dimensiones[dimKey] ?? ''"
                              @input="onPartDimInput(row, dimKey, ($event.target as HTMLInputElement).value)"
                              type="text"
                              class="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
              <div
                v-if="parseResult.parts.length > 100"
                class="px-3 py-1.5 text-[10px] text-slate-500 bg-slate-50 border-t border-slate-200 text-center"
              >
                Mostrando primeras 100 filas de {{ parseResult.parts.length }} repuestos detectados.
              </div>
            </div>

            <!-- Tabla Preview Motores (Editable antes de importar) -->
            <div
              v-else
              class="max-h-72 overflow-auto border border-slate-200 rounded-xl"
            >
              <table class="w-full text-left text-[11px] border-collapse">
                <thead class="sticky top-0 z-10 bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="py-2 px-2 border-b border-slate-200">Estado</th>
                    <th class="py-2 px-2 border-b border-slate-200">Fabricante</th>
                    <th class="py-2 px-2 border-b border-slate-200">Código Motor</th>
                    <th class="py-2 px-2 border-b border-slate-200">Modelos</th>
                    <th class="py-2 px-2 border-b border-slate-200">Años</th>
                    <th class="py-2 px-2 border-b border-slate-200">Cil / CC</th>
                    <th class="py-2 px-2 border-b border-slate-200">Combustible</th>
                    <th class="py-2 px-2 border-b border-slate-200 text-right">Quitar</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(m, mIdx) in parseResult.motors.slice(0, 100)"
                    :key="`prev-mot-${mIdx}`"
                    :class="m.status === 'error' ? 'bg-rose-50/70' : 'hover:bg-slate-50/70'"
                  >
                    <td class="py-1.5 px-2 whitespace-nowrap">
                      <span v-if="m.status !== 'error'" class="text-emerald-700 font-bold">Listo</span>
                      <span v-else class="text-rose-700 font-bold">{{ m.messages.join(' · ') }}</span>
                    </td>
                    <td class="py-1.5 px-2">
                      <input
                        v-model="m.fabricante"
                        @input="revalidateMotorRow(m)"
                        type="text"
                        placeholder="Marca *"
                        class="w-24 px-2 py-1 rounded border border-slate-200 bg-white font-bold text-slate-800 text-[11px] focus:outline-none focus:border-[#04C4D9]"
                      />
                    </td>
                    <td class="py-1.5 px-2">
                      <input
                        v-model="m.codigo"
                        @input="revalidateMotorRow(m)"
                        type="text"
                        placeholder="Código *"
                        class="w-24 px-2 py-1 rounded border border-slate-200 bg-white font-mono font-bold text-[#004B97] text-[11px] focus:outline-none focus:border-[#04C4D9]"
                      />
                    </td>
                    <td class="py-1.5 px-2">
                      <input
                        :value="m.modelos.join(', ')"
                        @change="onMotorModelsInput(m, ($event.target as HTMLInputElement).value)"
                        type="text"
                        placeholder="Modelos (coma)"
                        class="w-32 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                      />
                    </td>
                    <td class="py-1.5 px-2">
                      <input
                        v-model="m.anios"
                        type="text"
                        placeholder="ej. 1998-2005"
                        class="w-24 px-2 py-1 rounded border border-slate-200 bg-white font-mono text-[11px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                      />
                    </td>
                    <td class="py-1.5 px-2">
                      <div class="flex items-center gap-1 font-mono">
                        <input
                          v-model.number="m.cilindros"
                          type="number"
                          min="1"
                          placeholder="Cil"
                          class="w-12 px-1.5 py-1 rounded border border-slate-200 bg-white text-[11px] focus:outline-none focus:border-[#04C4D9]"
                        />
                        <input
                          v-model.number="m.cilindrada_cc"
                          type="number"
                          min="0"
                          placeholder="CC"
                          class="w-16 px-1.5 py-1 rounded border border-slate-200 bg-white text-[11px] focus:outline-none focus:border-[#04C4D9]"
                        />
                      </div>
                    </td>
                    <td class="py-1.5 px-2">
                      <input
                        v-model="m.combustible"
                        type="text"
                        placeholder="Diésel / Gasolina"
                        class="w-24 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-700 focus:outline-none focus:border-[#04C4D9]"
                      />
                    </td>
                    <td class="py-1.5 px-2 text-right">
                      <button
                        type="button"
                        @click="removePreviewMotor(mIdx)"
                        class="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                        title="Quitar motor"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- BARRA DE PROGRESO -->
          <div
            v-if="isImporting"
            class="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3.5 space-y-2"
          >
            <div class="flex items-center justify-between text-xs font-bold text-[#004B97]">
              <span class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin text-[#04C4D9]" />
                <span>Procesando: {{ progressLabel }}</span>
              </span>
              <span class="font-mono">{{ progressCurrent }} / {{ progressTotal }} ({{ progressPercent }}%)</span>
            </div>
            <div class="w-full h-2 bg-white rounded-full overflow-hidden border border-cyan-200">
              <div
                class="h-full bg-gradient-to-r from-[#04C4D9] to-[#004B97] transition-all duration-200"
                :style="{ width: `${progressPercent}%` }"
              ></div>
            </div>
          </div>

          <!-- RESUMEN FINAL VISTOSO Y GRANDE -->
          <div
            v-if="importReport"
            class="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white p-5 sm:p-6 shadow-2xl space-y-4 ring-4 ring-emerald-200/70"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="flex items-center gap-3.5">
                <div class="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0 shadow-lg">
                  <CheckCircle2 class="w-8 h-8 text-white" />
                </div>
                <div>
                  <h4 class="text-lg sm:text-xl font-black tracking-tight text-white">
                    ¡Importación y sincronización completada!
                  </h4>
                  <p class="text-xs sm:text-sm text-emerald-50 font-medium mt-0.5">
                    Los registros fueron aplicados y sincronizados en el catálogo de SWGORA.
                  </p>
                </div>
              </div>
              <button
                type="button"
                @click="emit('close')"
                class="px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs sm:text-sm font-black shadow-md transition shrink-0 cursor-pointer"
              >
                Listo · Ver en Catálogo
              </button>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div
                v-if="importReport.createdFamilies > 0 || importReport.updatedFamilies > 0"
                class="rounded-xl bg-white/95 text-slate-900 p-3 shadow-sm border border-indigo-200"
              >
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">Familias creadas / act.</div>
                <div class="text-2xl font-black font-mono text-indigo-900 mt-0.5">
                  {{ importReport.createdFamilies }}
                  <span v-if="importReport.updatedFamilies > 0" class="text-sm text-[#004B97]">/ {{ importReport.updatedFamilies }}</span>
                </div>
              </div>
              <div class="rounded-xl bg-white/95 text-slate-900 p-3 shadow-sm border border-emerald-200">
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Motores creados</div>
                <div class="text-2xl font-black font-mono text-emerald-900 mt-0.5">{{ importReport.createdMotors }}</div>
              </div>
              <div class="rounded-xl bg-white/95 text-slate-900 p-3 shadow-sm border border-emerald-200">
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Repuestos creados</div>
                <div class="text-2xl font-black font-mono text-emerald-900 mt-0.5">{{ importReport.createdParts }}</div>
              </div>
              <div class="rounded-xl bg-white/95 text-slate-900 p-3 shadow-sm border border-sky-200">
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#004B97]">Actualizados</div>
                <div class="text-2xl font-black font-mono text-[#0D1B3E] mt-0.5">{{ importReport.updatedParts }}</div>
              </div>
              <div
                v-if="importReport.deletedParts > 0 || importReport.deletedFamilies > 0"
                class="rounded-xl bg-white/95 text-slate-900 p-3 shadow-sm border border-rose-300"
              >
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">Eliminados</div>
                <div class="text-2xl font-black font-mono text-rose-700 mt-0.5">
                  {{ importReport.deletedParts }}
                  <span v-if="importReport.deletedFamilies > 0" class="text-xs text-rose-600 block font-sans">
                    + {{ importReport.deletedFamilies }} fam.
                  </span>
                </div>
              </div>
              <div
                v-else
                class="rounded-xl bg-white/95 text-slate-900 p-3 shadow-sm border border-cyan-200"
              >
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">Marcas / Modelos</div>
                <div class="text-lg font-black font-mono text-cyan-950 mt-1">+{{ importReport.createdBrands }} / +{{ importReport.createdModels }}</div>
              </div>
            </div>

            <div
              v-if="importReport.skippedFamilies > 0 || importReport.skippedParts > 0 || importReport.skippedMotors > 0 || importReport.skippedUnauthorizedParts > 0"
              class="text-xs font-bold text-emerald-50 bg-black/15 rounded-xl px-3.5 py-2 inline-flex flex-wrap items-center gap-3"
            >
              <span v-if="importReport.skippedFamilies > 0">Familias omitidas: {{ importReport.skippedFamilies }}</span>
              <span v-if="importReport.skippedMotors > 0">Motores omitidos: {{ importReport.skippedMotors }}</span>
              <span v-if="importReport.skippedParts > 0">Repuestos omitidos: {{ importReport.skippedParts }}</span>
              <span
                v-if="importReport.skippedUnauthorizedParts > 0"
                class="px-2 py-0.5 rounded-md bg-amber-300 text-slate-900"
              >
                Protegidos sin permiso: {{ importReport.skippedUnauthorizedParts }}
              </span>
            </div>

            <div
              v-if="importReport.errors.length > 0"
              class="max-h-36 overflow-auto rounded-xl bg-white border border-rose-300 p-3 space-y-1 text-xs text-rose-700 shadow-inner"
            >
              <div class="font-extrabold">Observaciones / errores ({{ importReport.errors.length }}):</div>
              <div v-for="(err, eIdx) in importReport.errors" :key="`imp-err-${eIdx}`">
                <strong>{{ err.rowLabel }}:</strong> {{ err.message }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Layers class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span>{{ catalogStore.grupos.length }} familias disponibles en el sistema</span>
          </div>

          <!-- Confirmación destructiva de 2 pasos -->
          <div
            v-if="pendingDestructiveConfirm && totalDeleteOperationsCount > 0"
            class="flex flex-wrap items-center gap-2 bg-rose-50 border border-rose-300 rounded-xl px-3 py-2"
          >
            <span class="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <ShieldAlert class="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Se eliminarán permanentemente
                <template v-if="deleteFamiliesCount > 0">{{ deleteFamiliesCount }} familia(s)</template>
                <template v-if="deleteFamiliesCount > 0 && (explicitDeletePartsCount + syncMissingCount) > 0"> y </template>
                <template v-if="(explicitDeletePartsCount + syncMissingCount) > 0">{{ explicitDeletePartsCount + syncMissingCount }} repuesto(s)</template>.
                ¿Confirmar?
              </span>
            </span>
            <button
              type="button"
              :disabled="isImporting"
              @click="pendingDestructiveConfirm = false"
              class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              :disabled="isImporting"
              @click="handleRunImport"
              class="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>Sí, aplicar cambios y eliminar</span>
            </button>
          </div>

          <div v-else class="flex items-center gap-2">
            <button
              type="button"
              :disabled="isImporting"
              @click="emit('close')"
              class="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              :disabled="isImporting || !parseResult || !hasAnyExecutableChange"
              @click="handleRunImport"
              :class="[
                'px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer',
                totalDeleteOperationsCount > 0
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-[#004B97] hover:bg-[#0D1B3E]'
              ]"
            >
              <Loader2 v-if="isImporting" class="w-3.5 h-3.5 animate-spin" />
              <RefreshCw v-else-if="totalDeleteOperationsCount > 0" class="w-3.5 h-3.5" />
              <Upload v-else class="w-3.5 h-3.5" />
              <span>
                {{
                  isImporting
                    ? 'Procesando...'
                    : totalDeleteOperationsCount > 0
                      ? `Aplicar cambios (${totalDeleteOperationsCount} eliminación(es))`
                      : `Importar ${validFamiliesCount + validPartsCount + validMotorsCount} registro(s)`
                }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
