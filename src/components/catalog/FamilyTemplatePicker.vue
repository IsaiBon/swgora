<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  BLANK_FAMILY_TEMPLATE,
  WORKSHOP_FAMILY_TEMPLATES,
  cloneExistingGrupoToTemplate,
  convertTemplateToGrupoInsert,
  type FamilyTemplate,
  type TemplateColumnDef
} from './FamilyTemplates'
import {
  buildNextAutoRowLabel,
  buildRowClusters,
  buildRowSpanMeta,
  getOptionBadgeClassByIndex,
  type GrupoRepuesto,
  type GrupoRepuestoInsert
} from '@/services/catalogService'
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
  FilePlus,
  Split,
  Binary,
  Hash,
  Type,
  ListFilter,
  GripVertical,
  Link2,
  Unlink2,
  Ruler
} from 'lucide-vue-next'

const props = defineProps<{
  existingGroups: GrupoRepuesto[]
  editingGroup?: GrupoRepuesto | null
  isSaving?: boolean
  isDeleting?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', payload: { data: GrupoRepuestoInsert; originalId?: string }): void
  (e: 'delete', id: string): void
  (e: 'cancel'): void
}>()

// Modo de selección: 'blank' | 'templates' | 'clone'
// Por defecto inicia en 'blank' (plantilla en blanco lista para personalizar)
const selectedSourceMode = ref<'blank' | 'templates' | 'clone'>('blank')

// Plantilla activa en el diseñador
const currentTemplate = ref<FamilyTemplate>(JSON.parse(JSON.stringify(BLANK_FAMILY_TEMPLATE)))

// Identidad editable de la familia
const editNombre = ref<string>('')
const editCategoria = ref<string>('')
const editSubsistema = ref<string>('Block')
const editDescripcion = ref<string>('')

// Selector de grupo existente para clonar
const selectedCloneGroupId = ref<string>('')

// Normaliza una plantilla al diseñador preservando su tipo_vista ('normal' vs 'tabla')
const normalizeTemplateForDesigner = (rawTpl: FamilyTemplate): FamilyTemplate => {
  const tpl: FamilyTemplate = JSON.parse(JSON.stringify(rawTpl))
  tpl.tipo_vista = tpl.tipo_vista === 'tabla' ? 'tabla' : 'normal'
  if (!tpl.tabla_config) {
    tpl.tabla_config = {
      titulo_primera_columna: 'Componente',
      modo_filas: 'subfilas',
      tiene_cabecera_marca: false,
      subfilas: ['Fila 1']
    }
  }
  const hasRows = Array.isArray(tpl.tabla_config.subfilas) && tpl.tabla_config.subfilas.length > 0
  if (!hasRows) {
    if (tpl.tabla_config.modo_filas === 'incremental') {
      tpl.tabla_config.subfilas = ['1° Anillo (Fuego)', '2° Anillo (Compresión)', 'Anillo de aceite']
    } else {
      tpl.tabla_config.subfilas = ['Fila 1']
    }
  }
  if (!tpl.tabla_config.modo_filas || tpl.tabla_config.modo_filas === 'libre' || tpl.tabla_config.modo_filas === 'cojinetes') {
    tpl.tabla_config.modo_filas = 'subfilas'
  }
  return tpl
}

// Inicializar desde props si se está editando una familia existente
const initializeFromGroup = (grp: GrupoRepuesto) => {
  const tpl = cloneExistingGrupoToTemplate(grp)
  currentTemplate.value = normalizeTemplateForDesigner(tpl)
  editNombre.value = grp.nombre
  editCategoria.value = grp.categoria
  editSubsistema.value = grp.subsistema || 'Block'
  editDescripcion.value = grp.descripcion || ''
  selectedSourceMode.value = 'clone'
}

// Cargar plantilla en blanco limpia
const loadBlankTemplate = () => {
  currentTemplate.value = normalizeTemplateForDesigner(BLANK_FAMILY_TEMPLATE)
  editNombre.value = ''
  editCategoria.value = ''
  editSubsistema.value = 'Block'
  editDescripcion.value = ''
  selectedSourceMode.value = 'blank'
}

// Cargar una plantilla de taller
const loadTemplate = (tpl: FamilyTemplate) => {
  currentTemplate.value = normalizeTemplateForDesigner(tpl)
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
      loadBlankTemplate()
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

// Icono según string
const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'Layers': return Layers
    case 'CircleDot': return CircleDot
    case 'SlidersHorizontal': return SlidersHorizontal
    case 'Wrench': return Wrench
    case 'Columns': return Columns
    case 'Table': return Table
    case 'Ruler': return Ruler
    default: return Layers
  }
}

// --- DRAG AND DROP NATIVO (SIN DEPENDENCIAS) ---
const draggedSubfilaIdx = ref<number | null>(null)
const dragOverSubfilaIdx = ref<number | null>(null)

const onSubfilaDragStart = (idx: number, event: DragEvent) => {
  draggedSubfilaIdx.value = idx
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(idx))
  }
}

const onSubfilaDragOver = (idx: number) => {
  if (draggedSubfilaIdx.value === null || draggedSubfilaIdx.value === idx) return
  dragOverSubfilaIdx.value = idx
}

const onSubfilaDrop = (targetIdx: number) => {
  const fromIdx = draggedSubfilaIdx.value
  draggedSubfilaIdx.value = null
  dragOverSubfilaIdx.value = null
  if (fromIdx === null || fromIdx === targetIdx) return
  const arr = ensureTablaSubfilas()
  const padres = ensureTablaSubfilaPadres()
  if (fromIdx < 0 || fromIdx >= arr.length) return
  const [moved] = arr.splice(fromIdx, 1)
  const [movedParent] = padres.splice(fromIdx, 1)
  if (moved !== undefined) {
    arr.splice(targetIdx, 0, moved)
    padres.splice(targetIdx, 0, movedParent || '')
  }
}

const onSubfilaDragEnd = () => {
  draggedSubfilaIdx.value = null
  dragOverSubfilaIdx.value = null
}

const draggedColIdx = ref<number | null>(null)
const dragOverColIdx = ref<number | null>(null)

const onColDragStart = (idx: number, event: DragEvent) => {
  draggedColIdx.value = idx
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(idx))
  }
}

const onColDragOver = (idx: number) => {
  if (draggedColIdx.value === null || draggedColIdx.value === idx) return
  dragOverColIdx.value = idx
}

const onColDrop = (targetIdx: number) => {
  const fromIdx = draggedColIdx.value
  draggedColIdx.value = null
  dragOverColIdx.value = null
  if (fromIdx === null || fromIdx === targetIdx) return
  const cols = currentTemplate.value.columnas
  if (fromIdx < 0 || fromIdx >= cols.length) return
  const [moved] = cols.splice(fromIdx, 1)
  if (moved) {
    cols.splice(targetIdx, 0, moved)
  }
}

const onColDragEnd = () => {
  draggedColIdx.value = null
  dragOverColIdx.value = null
}

// --- GESTIÓN INGENIOSA DE COLUMNAS ---
const addColumn = () => {
  currentTemplate.value.columnas.push({
    etiqueta: `Medida ${currentTemplate.value.columnas.length + 1}`,
    unidad: 'mm',
    tipo_dato: 'numero',
    requerido: true,
    filtrable: true
  })
}

// Agregar sub-columna hermana agrupada
const addSubcolumn = (targetIdx: number) => {
  const targetCol = currentTemplate.value.columnas[targetIdx]
  if (!targetCol) return

  // Si la columna actual no tiene grupo padre, asignarle uno derivado de su nombre o 'Grupo'
  if (!targetCol.columna_padre) {
    const parentName = targetCol.etiqueta.trim() || `Grupo ${targetIdx + 1}`
    targetCol.columna_padre = parentName
    targetCol.etiqueta = 'Mín'
  }

  // Insertar la nueva sub-columna inmediatamente después
  const newSubCol: TemplateColumnDef = {
    etiqueta: targetCol.etiqueta === 'Mín' ? 'Máx' : `Sub-medida`,
    columna_padre: targetCol.columna_padre,
    unidad: targetCol.unidad || 'mm',
    tipo_dato: targetCol.tipo_dato || 'numero',
    requerido: true,
    filtrable: true
  }

  currentTemplate.value.columnas.splice(targetIdx + 1, 0, newSubCol)
}

const removeColumn = (index: number) => {
  if (currentTemplate.value.columnas.length <= 1) return
  currentTemplate.value.columnas.splice(index, 1)
}

// Cambiar tipo de dato de una columna con valores predeterminados sensatos
const setColumnType = (col: TemplateColumnDef, newType: 'numero' | 'texto' | 'seleccion' | 'booleano') => {
  col.tipo_dato = newType
  if (newType === 'booleano') {
    col.unidad = ''
    if (!col.descripcion) col.descripcion = `Estado de ${col.etiqueta}`
  } else if (newType === 'numero') {
    if (!col.unidad) col.unidad = 'mm'
  } else if (newType === 'seleccion') {
    if (!col.opcionesStr && (!col.opciones || col.opciones.length === 0)) {
      col.opcionesStr = 'Opción A, Opción B'
    }
  }
}

// --- GESTIÓN UNIFICADA DE FILAS Y PRIMERA COLUMNA ---
const ensureTablaSubfilas = (): string[] => {
  if (!currentTemplate.value.tabla_config) {
    currentTemplate.value.tabla_config = {
      titulo_primera_columna: 'Componente',
      modo_filas: 'subfilas',
      subfilas: ['Componente 1'],
      tiene_cabecera_marca: false
    }
  } else if (!currentTemplate.value.tabla_config.modo_filas || currentTemplate.value.tabla_config.modo_filas === 'libre' || currentTemplate.value.tabla_config.modo_filas === 'cojinetes') {
    currentTemplate.value.tabla_config.modo_filas = 'subfilas'
  }
  if (!Array.isArray(currentTemplate.value.tabla_config.subfilas) || currentTemplate.value.tabla_config.subfilas.length === 0) {
    const base = (currentTemplate.value.tabla_config.titulo_primera_columna || '').trim() || 'Componente'
    currentTemplate.value.tabla_config.subfilas = [`${base} 1`]
  }
  return currentTemplate.value.tabla_config.subfilas
}

const ensureTablaSubfilaPadres = (): string[] => {
  const rows = ensureTablaSubfilas()
  const cfg = currentTemplate.value.tabla_config!
  if (!Array.isArray(cfg.subfila_padres)) {
    cfg.subfila_padres = rows.map(() => '')
  } else {
    while (cfg.subfila_padres.length < rows.length) cfg.subfila_padres.push('')
    if (cfg.subfila_padres.length > rows.length) cfg.subfila_padres.length = rows.length
  }
  return cfg.subfila_padres
}

const firstColumnTitle = computed({
  get(): string {
    return currentTemplate.value.tabla_config?.titulo_primera_columna ?? 'Componente'
  },
  set(val: string) {
    ensureTablaSubfilas()
    currentTemplate.value.tabla_config!.titulo_primera_columna = val
  }
})

const rowGroupColumnTitle = computed({
  get(): string {
    return currentTemplate.value.tabla_config?.titulo_grupo_filas ?? 'Grupo'
  },
  set(val: string) {
    ensureTablaSubfilas()
    currentTemplate.value.tabla_config!.titulo_grupo_filas = val
  }
})

const unifiedRows = computed<string[]>(() => {
  const arr = currentTemplate.value.tabla_config?.subfilas
  return Array.isArray(arr) && arr.length > 0 ? arr : ['Fila 1']
})

const updateUnifiedRowName = (idx: number, val: string) => {
  const arr = ensureTablaSubfilas()
  ensureTablaSubfilaPadres()
  arr[idx] = val
}

const addUnifiedRow = () => {
  const arr = ensureTablaSubfilas()
  const padres = ensureTablaSubfilaPadres()
  const nextLabel = buildNextAutoRowLabel(arr, currentTemplate.value.tabla_config?.titulo_primera_columna, true)
  arr.push(nextLabel)
  padres.push('')
}

const removeUnifiedRow = (index: number) => {
  const arr = currentTemplate.value.tabla_config?.subfilas
  if (!arr || arr.length <= 1) return
  arr.splice(index, 1)
  if (Array.isArray(currentTemplate.value.tabla_config?.subfila_padres)) {
    currentTemplate.value.tabla_config!.subfila_padres.splice(index, 1)
  }
}

// --- AGRUPACIÓN DE FILAS EN BLOQUES UNIDOS ("CENTRAR" + COLUMNA CENTRAL DE FILAS) ---
const rowClusterGroups = computed(() => {
  const padres = currentTemplate.value.tabla_config?.subfila_padres || []
  return buildRowClusters(unifiedRows.value, (_, i) => padres[i])
})

const hasGroupedRows = computed<boolean>(() => {
  return rowClusterGroups.value.some(c => c.isGrouped)
})

const previewRowSpans = computed(() => {
  if (!hasGroupedRows.value) return []
  const padres = currentTemplate.value.tabla_config?.subfila_padres || []
  return buildRowSpanMeta(previewSampleRows.value, (_, i) => padres[i])
})

const areAdjacentRowsJoined = (leftIdx: number): boolean => {
  const padres = currentTemplate.value.tabla_config?.subfila_padres || []
  const left = (padres[leftIdx] || '').trim()
  const right = (padres[leftIdx + 1] || '').trim()
  return left.length > 0 && left === right
}

const toggleJoinAdjacentRows = (leftIdx: number) => {
  const rows = ensureTablaSubfilas()
  const padres = ensureTablaSubfilaPadres()
  if (leftIdx < 0 || leftIdx >= rows.length - 1) return

  if (areAdjacentRowsJoined(leftIdx)) {
    const shared = (padres[leftIdx] || '').trim()
    let startIdx = leftIdx
    while (startIdx > 0 && (padres[startIdx - 1] || '').trim() === shared) startIdx--
    let endIdx = leftIdx + 1
    while (endIdx < rows.length - 1 && (padres[endIdx + 1] || '').trim() === shared) endIdx++

    const leftLen = leftIdx - startIdx + 1
    const rightLen = endIdx - leftIdx
    if (leftLen < 2) {
      padres[startIdx] = ''
    }
    if (rightLen < 2) {
      padres[endIdx] = ''
    } else if (leftLen >= 2) {
      const rightName = `${shared || 'Bloque'} 2`
      for (let i = leftIdx + 1; i <= endIdx; i++) {
        padres[i] = rightName
      }
    }
    return
  }

  let leftStart = leftIdx
  const leftParent = (padres[leftIdx] || '').trim()
  if (leftParent) {
    while (leftStart > 0 && (padres[leftStart - 1] || '').trim() === leftParent) leftStart--
  }

  let rightEnd = leftIdx + 1
  const rightParent = (padres[leftIdx + 1] || '').trim()
  if (rightParent) {
    while (rightEnd < rows.length - 1 && (padres[rightEnd + 1] || '').trim() === rightParent) rightEnd++
  }

  const centralName = leftParent || rightParent || 'Bloque Central'
  for (let i = leftStart; i <= rightEnd; i++) {
    padres[i] = centralName
  }
}

const renameRowCluster = (startIdx: number, endIdx: number, newName: string) => {
  const padres = ensureTablaSubfilaPadres()
  for (let i = startIdx; i <= endIdx; i++) {
    padres[i] = newName
  }
}

const ensureRowClusterNameOnBlur = (startIdx: number, endIdx: number) => {
  const padres = ensureTablaSubfilaPadres()
  if ((padres[startIdx] || '').trim() === '') {
    for (let i = startIdx; i <= endIdx; i++) {
      padres[i] = 'Bloque Central'
    }
  }
}

const ungroupRowCluster = (startIdx: number, endIdx: number) => {
  const padres = ensureTablaSubfilaPadres()
  for (let i = startIdx; i <= endIdx; i++) {
    padres[i] = ''
  }
}

const getParsedOptionsList = (col: TemplateColumnDef): string[] => {
  if (col.opcionesStr !== undefined) {
    return col.opcionesStr.split(',').map(s => s.trim()).filter(Boolean)
  }
  return Array.isArray(col.opciones) ? col.opciones : []
}

// Agrupación visual para la cabecera en vivo (Tier 1 y Tier 2 con sub-columnas)
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

interface ColumnClusterItem {
  col: TemplateColumnDef
  colIdx: number
}

interface ColumnCluster {
  key: string
  isGrouped: boolean
  name: string
  startIdx: number
  endIdx: number
  items: ColumnClusterItem[]
}

const columnClusterGroups = computed<ColumnCluster[]>(() => {
  const cols = currentTemplate.value.columnas
  const clusters: ColumnCluster[] = []
  let active: ColumnCluster | null = null

  cols.forEach((col, colIdx) => {
    const hasParent = col.columna_padre !== undefined && col.columna_padre !== null
    const parentVal = hasParent ? col.columna_padre! : ''

    if (hasParent) {
      if (active && active.isGrouped && active.name === parentVal) {
        active.endIdx = colIdx
        active.items.push({ col, colIdx })
      } else {
        if (active) clusters.push(active)
        active = {
          key: `grp-${colIdx}`,
          isGrouped: true,
          name: parentVal,
          startIdx: colIdx,
          endIdx: colIdx,
          items: [{ col, colIdx }]
        }
      }
    } else {
      if (active) {
        clusters.push(active)
        active = null
      }
      clusters.push({
        key: `single-${colIdx}`,
        isGrouped: false,
        name: '',
        startIdx: colIdx,
        endIdx: colIdx,
        items: [{ col, colIdx }]
      })
    }
  })

  if (active) clusters.push(active)
  return clusters
})

const areAdjacentColsJoined = (leftIdx: number): boolean => {
  const cols = currentTemplate.value.columnas
  const left = cols[leftIdx]
  const right = cols[leftIdx + 1]
  if (!left || !right) return false
  return (
    left.columna_padre !== undefined &&
    left.columna_padre !== null &&
    left.columna_padre === right.columna_padre
  )
}

const toggleJoinAdjacentColumns = (leftIdx: number) => {
  const cols = currentTemplate.value.columnas
  if (leftIdx < 0 || leftIdx >= cols.length - 1) return

  if (areAdjacentColsJoined(leftIdx)) {
    const shared = cols[leftIdx]!.columna_padre!
    let startIdx = leftIdx
    while (startIdx > 0 && cols[startIdx - 1]?.columna_padre === shared) startIdx--
    let endIdx = leftIdx + 1
    while (endIdx < cols.length - 1 && cols[endIdx + 1]?.columna_padre === shared) endIdx++

    const leftLen = leftIdx - startIdx + 1
    const rightLen = endIdx - leftIdx

    if (leftLen < 2) {
      cols[startIdx]!.columna_padre = undefined
    }
    if (rightLen < 2) {
      cols[endIdx]!.columna_padre = undefined
    } else if (leftLen >= 2) {
      const rightName = `${shared.trim() || 'Grupo'} 2`
      for (let i = leftIdx + 1; i <= endIdx; i++) {
        cols[i]!.columna_padre = rightName
      }
    }
    return
  }

  // Unir bloques cercanos: expandir a todo el grupo izquierdo y derecho contiguo y pasar el nombre central entre todas
  let leftStart = leftIdx
  const leftParent = cols[leftIdx]!.columna_padre
  if (leftParent !== undefined && leftParent !== null) {
    while (leftStart > 0 && cols[leftStart - 1]?.columna_padre === leftParent) leftStart--
  }

  let rightEnd = leftIdx + 1
  const rightParent = cols[leftIdx + 1]!.columna_padre
  if (rightParent !== undefined && rightParent !== null) {
    while (rightEnd < cols.length - 1 && cols[rightEnd + 1]?.columna_padre === rightParent) rightEnd++
  }

  const centralName =
    leftParent?.trim() ||
    rightParent?.trim() ||
    'Columna Central'

  for (let i = leftStart; i <= rightEnd; i++) {
    cols[i]!.columna_padre = centralName
  }
}

const renameColumnCluster = (startIdx: number, endIdx: number, newName: string) => {
  const cols = currentTemplate.value.columnas
  for (let i = startIdx; i <= endIdx; i++) {
    if (cols[i]) cols[i]!.columna_padre = newName
  }
}

const ensureClusterNameOnBlur = (startIdx: number, endIdx: number) => {
  const cols = currentTemplate.value.columnas
  if ((cols[startIdx]?.columna_padre || '').trim() === '') {
    for (let i = startIdx; i <= endIdx; i++) {
      if (cols[i]) cols[i]!.columna_padre = 'Columna Central'
    }
  }
}

const ungroupCluster = (startIdx: number, endIdx: number) => {
  const cols = currentTemplate.value.columnas
  for (let i = startIdx; i <= endIdx; i++) {
    if (cols[i]) cols[i]!.columna_padre = undefined
  }
}

// Muestra de filas en la vista previa
const previewSampleRows = computed<string[]>(() => {
  if (currentTemplate.value.tipo_vista === 'normal') {
    return ['Pieza STD']
  }
  const customRows = currentTemplate.value.tabla_config?.subfilas
  if (Array.isArray(customRows) && customRows.length > 0) {
    return customRows.map((r, i) => r?.trim() || `Fila ${i + 1}`)
  }
  return ['Fila 1']
})

// Validación, Borrado y Guardado
const validationError = ref<string>('')
const showDeleteConfirm = ref<boolean>(false)
const showCloneDeleteConfirm = ref<boolean>(false)

const handleDeleteCurrentFamily = () => {
  if (!props.editingGroup) return
  const targetId = props.editingGroup.id || props.editingGroup.codigo
  if (!targetId) return
  showDeleteConfirm.value = false
  emit('delete', targetId)
}

const handleDeleteSelectedCloneFamily = () => {
  if (!selectedCloneGroupId.value) return
  const target = props.existingGroups.find(
    g => g.codigo === selectedCloneGroupId.value || g.id === selectedCloneGroupId.value
  )
  const targetId = target?.id || selectedCloneGroupId.value
  showCloneDeleteConfirm.value = false
  selectedCloneGroupId.value = ''
  emit('delete', targetId)
}

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
  // Al crear una nueva familia, usar siempre el nombre propio como categoría para no heredar repuestos de una plantilla base
  const categoriaAUsar = props.editingGroup
    ? (editCategoria.value || editNombre.value.trim())
    : editNombre.value.trim()

  const payload = convertTemplateToGrupoInsert(
    currentTemplate.value,
    editNombre.value,
    categoriaAUsar,
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
    <!-- BARRA SUPERIOR: MODO DE TRABAJO (PLANTILLA EN BLANCO ACTIVA POR DEFECTO) -->
    <div class="bg-slate-100 p-2.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
      <div class="flex items-center gap-1.5 flex-wrap">
        <!-- BOTÓN 1: PLANTILLA EN BLANCO (DEFAULT) -->
        <button
          type="button"
          @click="loadBlankTemplate"
          :class="[
            'px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer',
            selectedSourceMode === 'blank'
              ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          ]"
        >
          <FilePlus class="w-3.5 h-3.5 text-[#04C4D9]" />
          <span>Plantilla en Blanco</span>
          <span v-if="selectedSourceMode === 'blank'" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        </button>

        <!-- BOTÓN 2: PLANTILLAS DE TALLER PRECONFIGURADAS -->
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
          <Sparkles class="w-3.5 h-3.5 text-amber-500" />
          <span>Plantillas de Taller</span>
        </button>

        <!-- BOTÓN 3: COPIAR DE EXISTENTE -->
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
      </div>

      <!-- Selector desplegable si está en modo copiar / gestionar existente -->
      <div v-if="selectedSourceMode === 'clone'" class="flex flex-wrap items-center gap-2">
        <select
          v-model="selectedCloneGroupId"
          @change="showCloneDeleteConfirm = false; handleCloneExisting()"
          class="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#04C4D9] shadow-2xs"
        >
          <option value="" disabled>Selecciona una familia existente...</option>
          <option v-for="grp in existingGroups" :key="grp.id" :value="grp.codigo">
            {{ grp.nombre }} ({{ grp.parametros.length }} medidas)
          </option>
        </select>

        <template v-if="selectedCloneGroupId">
          <button
            v-if="!showCloneDeleteConfirm"
            type="button"
            @click="showCloneDeleteConfirm = true"
            :disabled="props.isDeleting"
            class="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
            title="Borrar esta familia del catálogo"
          >
            <Trash2 class="w-3.5 h-3.5 text-rose-600" />
            <span>Borrar</span>
          </button>

          <div v-else class="flex items-center gap-1.5 bg-rose-100 border border-rose-300 px-2 py-1 rounded-xl">
            <span class="text-[11px] font-bold text-rose-900">¿Borrar familia?</span>
            <button
              type="button"
              @click="handleDeleteSelectedCloneFamily"
              :disabled="props.isDeleting"
              class="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-black cursor-pointer disabled:opacity-50"
            >
              Sí
            </button>
            <button
              type="button"
              @click="showCloneDeleteConfirm = false"
              class="px-2 py-0.5 text-slate-600 hover:text-slate-900 text-[11px] font-bold cursor-pointer"
            >
              No
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- TARJETAS DE PLANTILLAS RÁPIDAS (SÓLO SI EL USUARIO HACE CLIC EN 'PLANTILLAS DE TALLER') -->
    <div v-if="selectedSourceMode === 'templates'" class="space-y-2 animate-in fade-in duration-200">
      <div class="flex items-center justify-between">
        <label class="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles class="w-4 h-4 text-amber-500" />
          <span>Plantillas Rápidas del Taller (Haz clic en una para cargar su estructura)</span>
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="tpl in WORKSHOP_FAMILY_TEMPLATES"
          :key="tpl.id"
          @click="loadTemplate(tpl)"
          :class="[
            'p-3.5 rounded-2xl border transition-all text-left cursor-pointer relative group flex flex-col justify-between shadow-2xs',
            currentTemplate.id === tpl.id
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
            <span class="flex items-center gap-1 text-[#038391] font-black">
              <span>Usar plantilla</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- WORKBENCH PRINCIPAL: IDENTIDAD + OPCIONES INGENIOSAS + VISTA PREVIA INTERACTIVA -->
    <div class="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-6">
      
      <!-- 1. IDENTIDAD BÁSICA DE LA FAMILIA -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div class="md:col-span-5">
          <label class="block text-xs font-black text-slate-800 mb-1">
            Nombre de la Familia <span class="text-rose-500">*</span>
          </label>
          <input
            v-model="editNombre"
            type="text"
            placeholder="Ej. Retenes de válvulas, Camisas de cilindro, Cojinetes..."
            class="w-full px-3.5 py-2.5 text-xs font-black bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#04C4D9] transition shadow-2xs"
          />
        </div>

        <div class="md:col-span-4">
          <label class="block text-xs font-black text-slate-800 mb-1">
            Parte del Motor (Subsistema)
          </label>
          <select
            v-model="editSubsistema"
            class="w-full px-3 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#04C4D9] transition shadow-2xs"
          >
            <option value="Block">Block de Cilindros</option>
            <option value="Culata">Culata / Tapa de Cilindros</option>
            <option value="Cigüeñal">Cigüeñal / Bancada / Bielas</option>
            <option value="General">General / Accesorios / Sellos</option>
          </select>
        </div>

        <div class="md:col-span-3">
          <label class="block text-xs font-black text-slate-800 mb-1">
            Formato de Visualización
          </label>
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              @click="currentTemplate.tipo_vista = 'normal'"
              :class="[
                'flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer',
                currentTemplate.tipo_vista === 'normal' ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              Vista Normal
            </button>
            <button
              type="button"
              @click="currentTemplate.tipo_vista = 'tabla'; ensureTablaSubfilas()"
              :class="[
                'flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer',
                currentTemplate.tipo_vista === 'tabla' ? 'bg-white text-[#004B97] shadow-2xs ring-1 ring-cyan-200' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              Vista en Tabla
            </button>
          </div>
        </div>
      </div>

      <!-- 2. DISEÑADOR UNIFICADO DE FILAS (SOLO EN VISTA EN TABLA) -->
      <div
        v-if="currentTemplate.tipo_vista === 'tabla'"
        class="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h5 class="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Layers class="w-4 h-4 text-[#004B97]" />
              <span>Filas de la familia (1 pieza o bloques múltiples conectados)</span>
            </h5>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Personaliza la primera columna y usa <strong>+ Agregar Fila</strong> para añadir piezas juntas, ranuras o pasos y reordenarlos arrastrando.
            </p>
          </div>

          <button
            type="button"
            @click="addUnifiedRow"
            class="px-3.5 py-1.5 bg-[#004B97] hover:bg-[#003875] text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95 self-start sm:self-auto shrink-0"
          >
            <Plus class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span>+ Agregar Fila</span>
          </button>
        </div>

        <!-- Editor editable de la 1ra columna y nombre columna central de filas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div class="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/90">
            <label class="text-[11px] font-black text-slate-700 shrink-0">
              1ra columna:
            </label>
            <input
              v-model="firstColumnTitle"
              type="text"
              placeholder="Ej. Componente, Posición, Sección, Anillo..."
              class="flex-1 px-2.5 py-1 text-xs font-black text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#04C4D9]"
            />
          </div>

          <div v-if="hasGroupedRows" class="flex items-center gap-2 bg-cyan-50/60 px-3 py-2 rounded-xl border border-cyan-200">
            <label class="text-[11px] font-black text-[#004B97] shrink-0">
              Columna central filas:
            </label>
            <input
              v-model="rowGroupColumnTitle"
              type="text"
              placeholder="Ej. Grupo, Bloque, Sección..."
              class="flex-1 px-2.5 py-1 text-xs font-black text-slate-900 bg-white border border-cyan-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
            />
          </div>
        </div>

        <!-- Bloques arrastrables de filas con uniones ("Centrar") y columna central compartida -->
        <div class="overflow-x-auto pb-1">
          <div class="flex items-stretch gap-y-2 flex-wrap">
            <template v-for="(rCluster, rcIdx) in rowClusterGroups" :key="rCluster.key">
              <!-- Contenedor de cluster: unido si está centrado/agrupado, o bloque suelto -->
              <div
                :class="[
                  'flex flex-col justify-between transition',
                  rCluster.isGrouped
                    ? 'p-2.5 rounded-2xl bg-cyan-50/55 border-2 border-dashed border-[#04C4D9]/70 space-y-2'
                    : ''
                ]"
              >
                <!-- Cabecera editable de la columna central compartida entre todas las filas unidas -->
                <div
                  v-if="rCluster.isGrouped"
                  class="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-cyan-200 shadow-2xs"
                >
                  <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    <Link2 class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                    <span class="text-[10px] font-black uppercase tracking-wider text-[#004B97] shrink-0">
                      Central:
                    </span>
                    <input
                      :value="rCluster.name"
                      @input="renameRowCluster(rCluster.startIdx, rCluster.endIdx, ($event.target as HTMLInputElement).value)"
                      @blur="ensureRowClusterNameOnBlur(rCluster.startIdx, rCluster.endIdx)"
                      type="text"
                      placeholder="Nombre central (ej. Parte Superior...)"
                      class="flex-1 min-w-[130px] text-xs font-black text-slate-900 bg-cyan-50/40 px-2 py-0.5 rounded-lg border border-cyan-200 focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>
                  <button
                    type="button"
                    @click="ungroupRowCluster(rCluster.startIdx, rCluster.endIdx)"
                    class="px-2 py-0.5 rounded-lg text-[10px] font-black text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer shrink-0"
                    title="Separar todo este grupo de filas"
                  >
                    <Unlink2 class="w-3 h-3" />
                    <span>Separar</span>
                  </button>
                </div>

                <!-- Filas dentro del bloque + puente interno separador -->
                <div class="flex items-center flex-wrap gap-y-2">
                  <template v-for="(item, itemPos) in rCluster.items" :key="item.rowIdx">
                    <div
                      draggable="true"
                      @dragstart="onSubfilaDragStart(item.rowIdx, $event)"
                      @dragover.prevent="onSubfilaDragOver(item.rowIdx)"
                      @drop.prevent="onSubfilaDrop(item.rowIdx)"
                      @dragend="onSubfilaDragEnd"
                      :class="[
                        'flex items-center gap-1.5 bg-white border-2 px-2.5 py-1.5 rounded-xl shadow-2xs transition select-none cursor-grab active:cursor-grabbing',
                        draggedSubfilaIdx === item.rowIdx
                          ? 'opacity-50 border-[#04C4D9] scale-95'
                          : (dragOverSubfilaIdx === item.rowIdx
                            ? 'border-[#004B97] ring-2 ring-[#04C4D9]/40 bg-cyan-50/40'
                            : (rCluster.isGrouped
                              ? 'border-[#04C4D9]/70 hover:border-[#004B97]'
                              : 'border-slate-300 hover:border-[#04C4D9]'))
                      ]"
                    >
                      <GripVertical class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span class="w-4 h-4 rounded-full bg-[#004B97] text-white text-[9px] font-mono font-bold flex items-center justify-center shrink-0">
                        {{ item.rowIdx + 1 }}
                      </span>
                      <input
                        :value="item.name"
                        @input="updateUnifiedRowName(item.rowIdx, ($event.target as HTMLInputElement).value)"
                        type="text"
                        class="w-32 text-xs font-black text-slate-800 bg-transparent focus:outline-none"
                        placeholder="Nombre de fila"
                      />
                      <button
                        v-if="unifiedRows.length > 1"
                        type="button"
                        @click="removeUnifiedRow(item.rowIdx)"
                        class="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition"
                        title="Quitar fila"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <!-- Puente interno dentro del grupo unido (permite separar justo entre estas dos) -->
                    <div
                      v-if="itemPos < rCluster.items.length - 1"
                      class="flex items-center px-1 shrink-0"
                    >
                      <span class="w-2 h-0.5 bg-[#04C4D9]"></span>
                      <button
                        type="button"
                        @click="toggleJoinAdjacentRows(item.rowIdx)"
                        class="px-1.5 py-0.5 rounded-full bg-white border border-[#04C4D9] text-[#004B97] hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 shadow-2xs transition flex items-center cursor-pointer"
                        title="Unidas bajo columna central (clic para separar aquí)"
                      >
                        <Link2 class="w-3 h-3" />
                      </button>
                      <span class="w-2 h-0.5 bg-[#04C4D9]"></span>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Puente con botón CENTRAR entre filas o grupos cercanos -->
              <div
                v-if="rcIdx < rowClusterGroups.length - 1"
                class="flex items-center px-1 shrink-0"
              >
                <span class="w-2 border-t-2 border-dotted border-slate-300"></span>
                <button
                  type="button"
                  @click="toggleJoinAdjacentRows(rCluster.endIdx)"
                  class="px-2 py-1 rounded-full bg-white border border-slate-300 hover:border-[#04C4D9] hover:bg-cyan-50 text-slate-600 hover:text-[#004B97] shadow-2xs transition flex items-center gap-1 cursor-pointer group"
                  title="Centrar y unir filas cercanas bajo una misma columna central"
                >
                  <Link2 class="w-3 h-3 text-[#04C4D9] group-hover:scale-110 transition" />
                  <span class="text-[9px] font-black leading-none">Centrar</span>
                </button>
                <span class="w-2 border-t-2 border-dotted border-slate-300"></span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 3. CONFIGURADOR VISUAL DE COLUMNAS CON ESTADOS (SÍ/NO, NÚMEROS, SUB-COLUMNAS) -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal class="w-4 h-4 text-[#04C4D9]" />
              <span>Columnas de Medidas y Estados</span>
            </h4>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Personaliza cada medida o estado, arrástralas para ordenar y usa <strong>Centrar</strong> entre columnas cercanas para unirlas bajo una columna central compartida (2, 3, 4 o más sub-columnas).
            </p>
          </div>

          <button
            type="button"
            @click="addColumn"
            class="px-3.5 py-1.5 bg-[#004B97] hover:bg-[#003875] text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
          >
            <Plus class="w-3.5 h-3.5 text-[#04C4D9]" />
            <span>+ Agregar Columna</span>
          </button>
        </div>

        <!-- DISEÑADOR VISUAL DE COLUMNAS UNIDAS CON BOTÓN CENTRAR ENTRE BLOQUES CERCANOS -->
        <div class="overflow-x-auto pb-2">
          <div class="flex items-stretch gap-y-2 min-w-max">
            <template v-for="(cluster, clIdx) in columnClusterGroups" :key="cluster.key">
              <!-- Contenedor de cluster: unido si está centrado/agrupado, o tarjeta suelta -->
              <div
                :class="[
                  'flex flex-col justify-between transition',
                  cluster.isGrouped
                    ? 'p-3 rounded-2xl bg-cyan-50/55 border-2 border-dashed border-[#04C4D9]/70 space-y-2.5'
                    : ''
                ]"
              >
                <!-- Barra editable de Columna Central compartida para todas las columnas unidas (2, 3, 4+) -->
                <div
                  v-if="cluster.isGrouped"
                  class="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#04C4D9]/60 shadow-2xs"
                >
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <span class="px-2 py-0.5 rounded-md bg-[#004B97] text-white text-[10px] font-black uppercase tracking-wider shrink-0">
                      Columna Central · {{ cluster.items.length }} sub-col
                    </span>
                    <input
                      :value="cluster.name"
                      @input="renameColumnCluster(cluster.startIdx, cluster.endIdx, ($event.target as HTMLInputElement).value)"
                      @blur="ensureClusterNameOnBlur(cluster.startIdx, cluster.endIdx)"
                      type="text"
                      placeholder="Nombre columna central (ej. STD, 0.25, Luz...)"
                      class="flex-1 min-w-[160px] text-xs font-black text-slate-900 bg-cyan-50/40 px-2.5 py-1 rounded-lg border border-cyan-200 focus:outline-none focus:border-[#04C4D9]"
                    />
                  </div>
                  <button
                    type="button"
                    @click="ungroupCluster(cluster.startIdx, cluster.endIdx)"
                    class="px-2 py-1 rounded-lg text-[10px] font-black text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer shrink-0"
                    title="Separar todo este bloque de columnas"
                  >
                    <Unlink2 class="w-3 h-3" />
                    <span>Separar todo</span>
                  </button>
                </div>

                <!-- Columnas dentro del cluster + puentes internos entre bloques cercanos -->
                <div class="flex items-stretch">
                  <template v-for="(item, itemPos) in cluster.items" :key="item.colIdx">
                    <div
                      draggable="true"
                      @dragstart="onColDragStart(item.colIdx, $event)"
                      @dragover.prevent="onColDragOver(item.colIdx)"
                      @drop.prevent="onColDrop(item.colIdx)"
                      @dragend="onColDragEnd"
                      :class="[
                        'w-[260px] shrink-0 p-3 rounded-2xl border space-y-2 relative group transition flex flex-col justify-between',
                        draggedColIdx === item.colIdx
                          ? 'opacity-50 bg-cyan-50/40 border-[#04C4D9]'
                          : (dragOverColIdx === item.colIdx
                            ? 'bg-cyan-50/50 border-[#004B97] ring-2 ring-[#04C4D9]/40'
                            : (cluster.isGrouped
                              ? 'bg-white border-2 border-[#04C4D9]/60 shadow-2xs'
                              : 'bg-slate-50/90 border-slate-200 hover:border-slate-300'))
                      ]"
                    >
                      <!-- Cabecera de Columna -->
                      <div class="flex items-center justify-between gap-1.5">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span
                            class="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing shrink-0"
                            title="Arrastra para reordenar columna"
                          >
                            <GripVertical class="w-3.5 h-3.5" />
                          </span>
                          <span class="w-5 h-5 rounded-md bg-slate-900 text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                            {{ item.colIdx + 1 }}
                          </span>
                          <input
                            v-model="item.col.etiqueta"
                            type="text"
                            placeholder="Nombre de sub-columna..."
                            class="font-black text-xs text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-[#04C4D9] focus:outline-none w-28 truncate"
                          />
                        </div>

                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            @click="addSubcolumn(item.colIdx)"
                            class="px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-white border border-cyan-300 text-[#038391] hover:bg-cyan-50 transition flex items-center gap-0.5 shadow-2xs cursor-pointer"
                            title="Duplicar como sub-columna unida bajo el mismo título central"
                          >
                            <Split class="w-3 h-3 text-[#04C4D9]" />
                            <span>+ Sub</span>
                          </button>

                          <button
                            v-if="currentTemplate.columnas.length > 1"
                            type="button"
                            @click="removeColumn(item.colIdx)"
                            class="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Eliminar columna"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <!-- Selector de Tipo de Dato con Badges -->
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
                          <button
                            type="button"
                            @click="setColumnType(item.col, 'numero')"
                            :class="[
                              'flex-1 py-0.5 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer',
                              (item.col.tipo_dato || 'numero') === 'numero' ? 'bg-[#004B97] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            ]"
                          >
                            <Hash class="w-3 h-3" />
                            <span>Núm</span>
                          </button>

                          <button
                            type="button"
                            @click="setColumnType(item.col, 'booleano')"
                            :class="[
                              'flex-1 py-0.5 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer',
                              item.col.tipo_dato === 'booleano' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            ]"
                            title="Estado Sí / No (ej. Cónico, Nitrurado, Ranurado)"
                          >
                            <Binary class="w-3 h-3" />
                            <span>Sí/No</span>
                          </button>

                          <button
                            type="button"
                            @click="setColumnType(item.col, 'seleccion')"
                            :class="[
                              'flex-1 py-0.5 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer',
                              item.col.tipo_dato === 'seleccion' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            ]"
                            title="Opciones desplegables"
                          >
                            <ListFilter class="w-3 h-3" />
                            <span>Opc</span>
                          </button>

                          <button
                            type="button"
                            @click="setColumnType(item.col, 'texto')"
                            :class="[
                              'flex-1 py-0.5 rounded-lg transition flex items-center justify-center gap-0.5 cursor-pointer',
                              item.col.tipo_dato === 'texto' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            ]"
                          >
                            <Type class="w-3 h-3" />
                            <span>Txt</span>
                          </button>
                        </div>

                        <!-- Parámetros específicos según el tipo -->
                        <div v-if="(item.col.tipo_dato || 'numero') === 'numero'" class="flex items-center gap-2">
                          <span class="text-[10px] font-bold text-slate-500">Unidad:</span>
                          <input
                            v-model="item.col.unidad"
                            type="text"
                            placeholder="mm, pulg, °..."
                            class="w-20 px-2 py-0.5 text-[11px] font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
                          />
                        </div>

                        <div v-else-if="item.col.tipo_dato === 'booleano'" class="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1">
                          <Check class="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Estado Sí / No (ej. Cónico)</span>
                        </div>

                        <div v-else-if="item.col.tipo_dato === 'seleccion'" class="space-y-1.5">
                          <input
                            v-model="item.col.opcionesStr"
                            type="text"
                            placeholder="Opciones separadas por coma..."
                            class="w-full px-2 py-1 text-[10px] font-bold bg-white border border-purple-200 rounded-lg focus:outline-none focus:border-purple-400"
                          />
                          <div v-if="getParsedOptionsList(item.col).length > 0" class="flex flex-wrap gap-1">
                            <span
                              v-for="(optLabel, oIdx) in getParsedOptionsList(item.col)"
                              :key="`${item.colIdx}-opt-${oIdx}`"
                              class="px-1.5 py-0.5 rounded-md border text-[9px] leading-tight"
                              :class="getOptionBadgeClassByIndex(oIdx)"
                            >
                              {{ oIdx + 1 }}. {{ optLabel }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Puente interno dentro del grupo unido (permite separar justo entre estas dos) -->
                    <div
                      v-if="itemPos < cluster.items.length - 1"
                      class="flex flex-col items-center justify-center px-1.5 shrink-0"
                    >
                      <div class="flex items-center">
                        <span class="w-2 h-0.5 bg-[#04C4D9]"></span>
                        <button
                          type="button"
                          @click="toggleJoinAdjacentColumns(item.colIdx)"
                          class="px-1.5 py-1 rounded-full bg-white border border-[#04C4D9] text-[#004B97] hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 shadow-2xs transition flex items-center gap-1 text-[9px] font-black cursor-pointer"
                          title="Unidas en la misma columna central (clic para separar aquí)"
                        >
                          <Link2 class="w-3 h-3" />
                        </button>
                        <span class="w-2 h-0.5 bg-[#04C4D9]"></span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Puente con botón CENTRAR entre columnas o grupos cercanos -->
              <div
                v-if="clIdx < columnClusterGroups.length - 1"
                class="flex flex-col items-center justify-center px-1.5 shrink-0"
              >
                <div class="flex items-center">
                  <span class="w-2 border-t-2 border-dotted border-slate-300"></span>
                  <button
                    type="button"
                    @click="toggleJoinAdjacentColumns(cluster.endIdx)"
                    class="px-2 py-1 rounded-full bg-white border border-slate-300 hover:border-[#04C4D9] hover:bg-cyan-50 text-slate-600 hover:text-[#004B97] shadow-2xs transition flex flex-col items-center gap-0.5 cursor-pointer group"
                    title="Centrar y unir columnas cercanas bajo una misma columna central"
                  >
                    <Link2 class="w-3.5 h-3.5 text-[#04C4D9] group-hover:scale-110 transition" />
                    <span class="text-[9px] font-black leading-none">Centrar</span>
                  </button>
                  <span class="w-2 border-t-2 border-dotted border-slate-300"></span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 4. VISTA PREVIA INTERACTIVA EN VIVO (TAL CUAL SE VERÁ EN EL CATÁLOGO) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
            <Eye class="w-4 h-4 text-[#04C4D9]" />
            <span>
              Vista Previa ({{ currentTemplate.tipo_vista === 'tabla' ? 'Vista en Tabla' : 'Vista Normal' }}): Así se verá en el catálogo
            </span>
          </div>
          <span class="text-[11px] text-slate-400">
            {{ currentTemplate.columnas.length }} columnas configuradas
          </span>
        </div>

        <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
          <div class="bg-[#0a192f] text-white px-4 py-2 text-xs font-bold flex items-center justify-between">
            <div>
              <span>{{ editNombre || 'Nueva Familia' }}</span>
              <span class="text-slate-400 font-mono text-[11px] font-normal ml-1.5">(1 registro)</span>
            </div>
            <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              TODOS LOS MOTORES
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <!-- Cabecera 2 niveles solo cuando es Vista Normal con sub-columnas agrupadas -->
              <thead
                v-if="currentTemplate.tipo_vista === 'normal' && hasGroupedHeaders"
                class="bg-slate-100/95 text-slate-600 font-bold uppercase tracking-wider text-[10px]"
              >
                <tr>
                  <th rowspan="2" class="py-1.5 px-3 border-b border-r border-slate-200 whitespace-nowrap w-44">Componente</th>
                  <th rowspan="2" class="py-1.5 px-2.5 border-b border-r border-slate-200 whitespace-nowrap w-28">Código OEM</th>
                  <th rowspan="2" class="py-1.5 px-2.5 border-b border-r border-slate-200 whitespace-nowrap w-32">Catálogos Alternos</th>
                  <template v-for="(grp, gIdx) in previewHeaderGroups" :key="`n-t1-${gIdx}`">
                    <th
                      v-if="grp.name !== ''"
                      :colspan="grp.colspan"
                      class="py-1 px-2 text-center font-black text-[#004B97] bg-blue-50/90 border-b border-r border-slate-200 text-[10px]"
                    >
                      {{ grp.name }}
                    </th>
                    <th
                      v-else
                      rowspan="2"
                      class="py-1.5 px-2 text-center border-b border-r border-slate-200 text-slate-700 whitespace-nowrap"
                    >
                      {{ grp.cols[0]?.etiqueta || 'Medida' }}
                    </th>
                  </template>
                  <th rowspan="2" class="py-1.5 px-3 text-right border-b border-slate-200 whitespace-nowrap w-28">Acciones</th>
                </tr>
                <tr class="bg-slate-50 text-[9px] text-slate-600 font-bold uppercase">
                  <template v-for="(grp, gIdx) in previewHeaderGroups" :key="`n-t2-${gIdx}`">
                    <template v-if="grp.name !== ''">
                      <th
                        v-for="(subCol, sIdx) in grp.cols"
                        :key="`n-sub-${gIdx}-${sIdx}`"
                        class="py-1 px-2 text-center border-b border-r border-slate-200 whitespace-nowrap font-mono"
                      >
                        {{ subCol.etiqueta || `Col ${sIdx + 1}` }}
                      </th>
                    </template>
                  </template>
                </tr>
              </thead>

              <!-- Cabecera estándar de 5 columnas (Vista Normal plana o Vista en Tabla) -->
              <thead v-else class="bg-slate-100/95 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th class="py-1.5 px-3 border-b border-r border-slate-200 whitespace-nowrap w-48">Componente</th>
                  <th class="py-1.5 px-2.5 border-b border-r border-slate-200 whitespace-nowrap w-28">Código OEM</th>
                  <th class="py-1.5 px-2.5 border-b border-r border-slate-200 whitespace-nowrap w-32">Catálogos Alternos</th>
                  <th class="py-1.5 px-3 border-b border-r border-slate-200 whitespace-nowrap">
                    {{ (editNombre || 'MEDIDAS').toUpperCase() }}:
                    {{ currentTemplate.columnas.map(c => c.etiqueta || 'Medida').join(currentTemplate.tipo_vista === 'tabla' ? ' / ' : ' × ') }}
                  </th>
                  <th class="py-1.5 px-3 text-right border-b border-slate-200 whitespace-nowrap w-28">Acciones</th>
                </tr>
              </thead>

              <tbody>
                <tr class="hover:bg-slate-50/70 transition">
                  <!-- 1. COMPONENTE (siempre primero con imagen + marca + motor) -->
                  <td class="py-2.5 px-3 align-middle border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                      <div class="w-11 h-11 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                        <Layers class="w-4 h-4" />
                      </div>
                      <div class="min-w-0">
                        <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 mb-0.5">
                          OEM
                        </span>
                        <div class="font-bold text-slate-900 text-xs leading-tight truncate max-w-[140px]">
                          {{ editNombre ? `${editNombre} de muestra` : 'Repuesto de Muestra' }}
                        </div>
                        <div class="text-[10px] font-semibold text-slate-400 uppercase mt-0.5 leading-snug">
                          <span class="text-slate-600 font-bold">TOYOTA •</span>
                          {{ editSubsistema.toUpperCase() }} • MOTOR 2L • CATÁLOGO OEM
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- 2. CÓDIGO OEM -->
                  <td class="py-2.5 px-2.5 align-middle border-b border-slate-100">
                    <div class="inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-900">
                      <span>12345678</span>
                      <Copy class="w-3 h-3 text-slate-400" />
                    </div>
                  </td>

                  <!-- 3. CATÁLOGOS ALTERNOS -->
                  <td class="py-2.5 px-2.5 align-middle border-b border-slate-100 text-[10px] text-slate-400 italic">
                    Sin cruces
                  </td>

                  <!-- 4A. VISTA NORMAL CON SUB-COLUMNAS -->
                  <template v-if="currentTemplate.tipo_vista === 'normal' && hasGroupedHeaders">
                    <td
                      v-for="(col, colIdx) in currentTemplate.columnas"
                      :key="`pv-n-sub-${colIdx}`"
                      class="py-2 px-2 text-center align-middle border-b border-r border-slate-100 font-mono font-bold text-[11px]"
                    >
                      <span
                        v-if="col.tipo_dato === 'booleano'"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800"
                      >
                        <Check class="w-3 h-3 text-emerald-600" />
                        <span>Sí</span>
                      </span>
                      <span
                        v-else-if="col.tipo_dato === 'seleccion'"
                        class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] border"
                        :class="getOptionBadgeClassByIndex(0)"
                      >
                        {{ getParsedOptionsList(col)[0] || 'Opción' }}
                      </span>
                      <span v-else-if="(col.tipo_dato || 'numero') === 'numero'" class="text-slate-700">
                        45.00
                      </span>
                      <span v-else class="text-slate-400 italic">—</span>
                    </td>
                  </template>

                  <!-- 4B. VISTA NORMAL PLANA (chips/cotas en línea) -->
                  <td
                    v-else-if="currentTemplate.tipo_vista === 'normal'"
                    class="py-2.5 px-3 align-middle border-b border-slate-100"
                  >
                    <div class="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                      <template v-for="(col, colIdx) in currentTemplate.columnas" :key="`pv-n-chip-${colIdx}`">
                        <span
                          v-if="col.tipo_dato === 'seleccion'"
                          class="px-2 py-0.5 rounded border text-[11px]"
                          :class="getOptionBadgeClassByIndex(0)"
                        >
                          {{ getParsedOptionsList(col)[0] || col.etiqueta || 'Opción' }}
                        </span>
                        <span
                          v-else-if="col.tipo_dato === 'booleano'"
                          class="px-2 py-0.5 rounded border text-[11px] bg-emerald-50 text-emerald-800 border-emerald-200 font-bold"
                        >
                          {{ col.etiqueta || 'Estado' }}: Sí
                        </span>
                        <span
                          v-else-if="(col.tipo_dato || 'numero') === 'numero'"
                          class="px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-200 text-[11px] inline-flex items-center gap-1"
                        >
                          <span class="text-slate-500 text-[10px] uppercase font-sans">{{ col.etiqueta || `Col ${colIdx + 1}` }}:</span>
                          <strong>45.00 {{ col.unidad || '' }}</strong>
                        </span>
                        <span
                          v-else
                          class="px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-200 text-[11px] inline-flex items-center gap-1"
                        >
                          <span class="text-slate-500 text-[10px] uppercase font-sans">{{ col.etiqueta || `Col ${colIdx + 1}` }}:</span>
                          <strong>—</strong>
                        </span>
                      </template>
                    </div>
                  </td>

                  <!-- 4C. VISTA EN TABLA (MINI-TABLA INCRUSTADA COMO EN LA IMAGEN 2) -->
                  <td v-else class="py-2 px-3 align-middle border-b border-slate-100">
                    <div class="inline-block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs font-mono select-text">
                      <table class="border-collapse text-center text-xs">
                        <thead>
                          <!-- Tier 1 cuando hay sub-columnas agrupadas dentro de la mini-tabla -->
                          <tr v-if="hasGroupedHeaders" class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <th
                              v-if="hasGroupedRows"
                              rowspan="2"
                              class="px-2.5 py-1 border-r border-slate-200 bg-cyan-50/70 text-[#004B97] font-black text-center align-middle"
                            >
                              {{ rowGroupColumnTitle }}
                            </th>
                            <th rowspan="2" class="px-2 py-1 border-r border-slate-200 text-left align-middle">
                              <input
                                v-model="firstColumnTitle"
                                type="text"
                                class="w-28 px-1.5 py-0.5 font-black text-[10px] uppercase text-slate-800 bg-white/80 border border-dashed border-slate-300 rounded focus:bg-white focus:border-[#04C4D9] focus:outline-none"
                                placeholder="Componente"
                                title="Haz clic para cambiar el nombre de la primera columna"
                              />
                            </th>
                            <template v-for="(grp, gIdx) in previewHeaderGroups" :key="`mt-t1-${gIdx}`">
                              <th
                                v-if="grp.name !== ''"
                                :colspan="grp.colspan"
                                class="py-1 px-2 border-r border-b border-slate-200 bg-blue-50/80 text-[#004B97] font-black text-center text-[10px]"
                              >
                                {{ grp.name }}
                              </th>
                              <th
                                v-else
                                rowspan="2"
                                class="py-1 px-2 border-r border-slate-200 text-slate-700 font-bold text-center align-middle whitespace-nowrap"
                              >
                                {{ grp.cols[0]?.etiqueta || 'Col' }}
                              </th>
                            </template>
                          </tr>

                          <tr class="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <template v-if="!hasGroupedHeaders">
                              <th
                                v-if="hasGroupedRows"
                                class="px-2.5 py-1 border-r border-slate-200 bg-cyan-50/70 text-[#004B97] font-black"
                              >
                                {{ rowGroupColumnTitle }}
                              </th>
                              <th class="px-2 py-1 border-r border-slate-200 text-left">
                                <input
                                  v-model="firstColumnTitle"
                                  type="text"
                                  class="w-28 px-1.5 py-0.5 font-black text-[10px] uppercase text-slate-800 bg-white/80 border border-dashed border-slate-300 rounded focus:bg-white focus:border-[#04C4D9] focus:outline-none"
                                  placeholder="Componente"
                                  title="Haz clic para cambiar el nombre de la primera columna"
                                />
                              </th>
                            </template>
                            <template v-for="(col, cIdx) in currentTemplate.columnas" :key="`mt-col-${cIdx}`">
                              <th
                                v-if="!hasGroupedHeaders || (col.columna_padre && col.columna_padre.trim())"
                                class="px-2.5 py-1 whitespace-nowrap"
                                :class="cIdx < currentTemplate.columnas.length - 1 ? 'border-r border-slate-200' : ''"
                              >
                                {{ col.etiqueta || `Col ${cIdx + 1}` }}
                                <span v-if="col.unidad && col.tipo_dato !== 'booleano' && col.tipo_dato !== 'seleccion'" class="text-[8px] font-normal text-slate-500 lowercase">({{ col.unidad }})</span>
                              </th>
                            </template>
                          </tr>
                        </thead>

                        <tbody class="divide-y divide-slate-100 text-[11px]">
                          <tr
                            v-for="(rowLabel, rIdx) in previewSampleRows"
                            :key="`mt-row-${rIdx}`"
                            class="hover:bg-slate-50/70 transition"
                          >
                            <td
                              v-if="hasGroupedRows && previewRowSpans[rIdx]?.show"
                              :rowspan="previewRowSpans[rIdx]?.rowspan || 1"
                              class="px-2.5 py-1 font-black text-[10px] text-center align-middle border-r border-slate-200 uppercase"
                              :class="previewRowSpans[rIdx]?.label ? 'bg-cyan-50/70 text-[#004B97]' : 'bg-slate-50/40 text-slate-400'"
                            >
                              {{ previewRowSpans[rIdx]?.label || '—' }}
                            </td>
                            <td class="px-2.5 py-1 bg-slate-50/70 font-bold text-slate-700 border-r border-slate-200 text-left whitespace-nowrap">
                              {{ rowLabel }}
                            </td>
                            <td
                              v-for="(col, colIdx) in currentTemplate.columnas"
                              :key="`mt-val-${rIdx}-${colIdx}`"
                              class="px-2.5 py-1 font-mono font-bold text-slate-800 whitespace-nowrap"
                              :class="colIdx < currentTemplate.columnas.length - 1 ? 'border-r border-slate-200' : ''"
                            >
                              <span
                                v-if="col.tipo_dato === 'booleano'"
                                class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black"
                                :class="rIdx === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'"
                              >
                                <Check v-if="rIdx === 0" class="w-2.5 h-2.5 text-emerald-600" />
                                <span>{{ rIdx === 0 ? 'Sí' : 'No' }}</span>
                              </span>
                              <span
                                v-else-if="col.tipo_dato === 'seleccion'"
                                class="inline-flex items-center px-1.5 py-0.2 rounded border font-sans font-extrabold text-[10px]"
                                :class="getOptionBadgeClassByIndex(getParsedOptionsList(col).length > 0 ? rIdx % getParsedOptionsList(col).length : 0)"
                              >
                                {{ getParsedOptionsList(col).length > 0 ? getParsedOptionsList(col)[rIdx % getParsedOptionsList(col).length] : 'Opción' }}
                              </span>
                              <span v-else-if="(col.tipo_dato || 'numero') === 'numero'">
                                {{ (45.00 + rIdx * 0.25).toFixed(2) }}
                              </span>
                              <span v-else class="text-slate-400 italic">—</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>

                  <!-- 5. ACCIONES -->
                  <td class="py-2.5 px-3 align-middle text-right border-b border-slate-100 whitespace-nowrap">
                    <div class="inline-flex items-center gap-1">
                      <span class="px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-[10px] font-semibold inline-flex items-center gap-1">
                        <Eye class="w-3 h-3 text-slate-400" />
                        Ficha
                      </span>
                      <span class="px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-[10px] font-semibold">
                        Editar
                      </span>
                      <span class="px-2 py-1 rounded-md bg-[#04C4D9] text-white text-[10px] font-bold">
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

      <!-- MENSAJE DE ERROR DE VALIDACIÓN -->
      <div v-if="validationError" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
        {{ validationError }}
      </div>

      <!-- BOTONES DE ACCIÓN -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div>
          <template v-if="props.editingGroup">
            <button
              v-if="!showDeleteConfirm"
              type="button"
              @click="showDeleteConfirm = true"
              :disabled="props.isDeleting || props.isSaving"
              class="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Eliminar permanentemente esta familia del catálogo"
            >
              <Trash2 class="w-3.5 h-3.5 text-rose-600" />
              <span>Eliminar Familia</span>
            </button>

            <div v-else class="flex items-center gap-1.5 bg-rose-100 border border-rose-300 p-1 rounded-xl">
              <span class="text-[11px] font-bold text-rose-900 px-2">¿Eliminar esta familia?</span>
              <button
                type="button"
                @click="handleDeleteCurrentFamily"
                :disabled="props.isDeleting"
                class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw v-if="props.isDeleting" class="w-3 h-3 animate-spin" />
                <span v-else>Sí, borrar</span>
              </button>
              <button
                type="button"
                @click="showDeleteConfirm = false"
                class="px-2 py-1 text-slate-600 hover:text-slate-900 text-xs font-bold cursor-pointer"
              >
                No
              </button>
            </div>
          </template>
        </div>

        <div class="flex items-center gap-3 ml-auto">
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
            :disabled="props.isSaving || props.isDeleting"
            class="px-6 py-2.5 rounded-xl text-xs font-black bg-[#04C4D9] hover:bg-[#03a9bc] text-slate-950 transition flex items-center gap-2 shadow-2xs disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw v-if="props.isSaving" class="w-4 h-4 animate-spin" />
            <Check v-else class="w-4 h-4" />
            <span>{{ props.editingGroup ? 'Guardar Cambios de Familia' : 'Guardar y Crear Familia' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
