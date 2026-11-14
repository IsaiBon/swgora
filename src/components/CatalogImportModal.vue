<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import {
  downloadCatalogExcelTemplate,
  downloadCatalogJsonTemplate,
  parseCatalogImportFile,
  parseCatalogJsonText,
  executeCatalogImport,
  type CatalogImportParseResult,
  type CatalogImportReport,
  type DuplicateStrategy,
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
  Info
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

// Plantilla y carga
const templateMode = ref<'general' | 'specific'>('general')
const specificTarget = ref<string>('motors_only')
const defaultImportGroupId = ref<string>('')
const inputMode = ref<'file' | 'paste'>('file')
const rawJsonText = ref<string>('')
const selectedFile = ref<File | null>(null)
const isDragging = ref<boolean>(false)

// Opciones de importación
const duplicateStrategy = ref<DuplicateStrategy>('skip')
const autoCreateEntities = ref<boolean>(true)

// Estado de parseo, vista previa e importación
const parseError = ref<string | null>(null)
const parseResult = ref<CatalogImportParseResult | null>(null)
const previewTab = ref<'repuestos' | 'motores'>('repuestos')

const isImporting = ref<boolean>(false)
const progressCurrent = ref<number>(0)
const progressTotal = ref<number>(0)
const progressLabel = ref<string>('')
const importReport = ref<CatalogImportReport | null>(null)

const resolvedTemplateScope = computed<TemplateScope>(() => {
  if (templateMode.value === 'general') return 'general'
  if (specificTarget.value === 'motors_only') return 'motors_only'
  return 'parts_only'
})

const selectedTemplateGroup = computed(() => {
  if (templateMode.value !== 'specific' || !specificTarget.value.startsWith('grupo:')) {
    return null
  }
  const codeOrId = specificTarget.value.slice('grupo:'.length)
  return (
    catalogStore.grupos.find(g => g.id === codeOrId || g.codigo === codeOrId) || null
  )
})

const templateScopeHint = computed(() => {
  if (resolvedTemplateScope.value === 'general') {
    return 'Incluye hojas: Repuestos + Motores + Instrucciones'
  }
  if (resolvedTemplateScope.value === 'motors_only') {
    return 'Incluye solo: Motores + Instrucciones'
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

watch(
  () => props.isOpen,
  open => {
    if (open) {
      if (props.preselectedGroupId) {
        templateMode.value = 'specific'
        specificTarget.value = `grupo:${props.preselectedGroupId}`
      } else {
        templateMode.value = 'general'
        specificTarget.value = 'motors_only'
      }
      defaultImportGroupId.value = props.preselectedGroupId || ''
      parseError.value = null
      importReport.value = null
    }
  }
)

const reparseCurrentInput = async () => {
  parseError.value = null
  try {
    if (inputMode.value === 'file' && selectedFile.value) {
      parseResult.value = await parseCatalogImportFile(
        selectedFile.value,
        catalogStore.grupos,
        selectedDefaultImportGroup.value
      )
      previewTab.value =
        parseResult.value.parts.length === 0 && parseResult.value.motors.length > 0
          ? 'motores'
          : 'repuestos'
    } else if (inputMode.value === 'paste' && rawJsonText.value.trim()) {
      parseResult.value = parseCatalogJsonText(
        rawJsonText.value,
        'json_pegado.json',
        catalogStore.grupos,
        selectedDefaultImportGroup.value
      )
      previewTab.value =
        parseResult.value.parts.length === 0 && parseResult.value.motors.length > 0
          ? 'motores'
          : 'repuestos'
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
}

const validMotorsCount = computed(
  () => parseResult.value?.motors.filter(m => m.status !== 'error').length || 0
)
const validPartsCount = computed(
  () => parseResult.value?.parts.filter(p => p.status !== 'error').length || 0
)
const errorRowsCount = computed(() => {
  if (!parseResult.value) return 0
  return (
    parseResult.value.motors.filter(m => m.status === 'error').length +
    parseResult.value.parts.filter(p => p.status === 'error').length
  )
})
const warningRowsCount = computed(() => {
  if (!parseResult.value) return 0
  return (
    parseResult.value.motors.filter(m => m.status === 'warning').length +
    parseResult.value.parts.filter(p => p.status === 'warning').length
  )
})

const progressPercent = computed(() => {
  if (progressTotal.value <= 0) return 0
  return Math.min(100, Math.round((progressCurrent.value / progressTotal.value) * 100))
})

const handleRunImport = async () => {
  if (!parseResult.value) return
  if (validMotorsCount.value + validPartsCount.value === 0) return

  isImporting.value = true
  progressCurrent.value = 0
  progressTotal.value = validMotorsCount.value + validPartsCount.value
  progressLabel.value = 'Preparando importación...'
  importReport.value = null

  try {
    const report = await executeCatalogImport(
      parseResult.value,
      {
        defaultGrupo: selectedDefaultImportGroup.value,
        duplicateStrategy: duplicateStrategy.value,
        autoCreateEntities: autoCreateEntities.value,
        onProgress: (cur, tot, lbl) => {
          progressCurrent.value = cur
          progressTotal.value = tot
          progressLabel.value = lbl
        }
      },
      {
        fabricantes: catalogStore.fabricantes,
        modelos: catalogStore.modelos,
        motores: catalogStore.motores,
        repuestos: catalogStore.repuestos
      }
    )

    importReport.value = report
    await catalogStore.initCatalog()
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
                Importar Catálogo (Excel / JSON) y Plantillas
              </h2>
              <p class="text-[11px] sm:text-xs text-blue-100/90">
                Descarga la plantilla con ejemplos o carga masivamente repuestos, equivalencias y motores.
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
          <!-- PASO 1: PLANTILLAS -->
          <section class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-md bg-[#004B97] text-white text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                <h3 class="text-xs sm:text-sm font-extrabold text-slate-900">
                  Descargar Plantilla de Ejemplo
                </h3>
              </div>

              <div class="inline-flex rounded-lg bg-white p-0.5 border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  @click="templateMode = 'general'"
                  :class="[
                    'px-3 py-1 rounded-md transition cursor-pointer',
                    templateMode === 'general'
                      ? 'bg-[#004B97] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  ]"
                >
                  Plantilla General
                </button>
                <button
                  type="button"
                  @click="templateMode = 'specific'"
                  :class="[
                    'px-3 py-1 rounded-md transition cursor-pointer',
                    templateMode === 'specific'
                      ? 'bg-[#004B97] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  ]"
                >
                  Plantilla Específica
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <div class="md:col-span-6">
                <template v-if="templateMode === 'general'">
                  <div class="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
                    <span class="font-bold text-slate-900">Catálogo Completo:</span>
                    descarga en un solo archivo las secciones de <strong>Motores</strong> y <strong>Repuestos</strong> con todas las columnas estándar.
                  </div>
                </template>
                <template v-else>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    ¿Qué datos desea llenar específicamente?
                  </label>
                  <select
                    v-model="specificTarget"
                    class="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#04C4D9]"
                  >
                    <option value="motors_only">Solo Motores (altas de motores y modelos)</option>
                    <option value="parts_all">Solo Repuestos (todas las medidas estándar)</option>
                    <option
                      v-for="g in catalogStore.grupos"
                      :key="`tpl-grp-${g.id}`"
                      :value="`grupo:${g.codigo}`"
                    >
                      Solo Repuestos · Familia: {{ g.nombre }}
                    </option>
                  </select>
                </template>
              </div>

              <div class="md:col-span-3">
                <button
                  type="button"
                  @click="downloadCatalogExcelTemplate(catalogStore.grupos, resolvedTemplateScope, selectedTemplateGroup)"
                  class="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Download class="w-3.5 h-3.5" />
                  <span>Plantilla Excel (.xlsx)</span>
                </button>
              </div>

              <div class="md:col-span-3">
                <button
                  type="button"
                  @click="downloadCatalogJsonTemplate(catalogStore.grupos, resolvedTemplateScope, selectedTemplateGroup)"
                  class="w-full px-3 py-2 rounded-lg bg-[#004B97] hover:bg-[#0D1B3E] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
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
                  Si el Código OEM ya existe
                </label>
                <select
                  v-model="duplicateStrategy"
                  class="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                >
                  <option value="skip">Omitir duplicado (recomendado)</option>
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
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  Repuestos listos: {{ validPartsCount }}
                </span>
                <span
                  v-if="parseResult.motors.length > 0"
                  class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-[#004B97]"
                >
                  Motores listos: {{ validMotorsCount }}
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
                  v-if="parseResult.motors.length > 0 && parseResult.parts.length > 0"
                  class="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold"
                >
                  <button
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

            <!-- Tabla Preview Repuestos -->
            <div
              v-if="previewTab === 'repuestos'"
              class="max-h-64 overflow-auto border border-slate-200 rounded-xl"
            >
              <table class="w-full text-left text-[11px] border-collapse">
                <thead class="sticky top-0 bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="py-2 px-2.5 border-b border-slate-200">Estado</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Código OEM</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Nombre / Descripción</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Familia</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Marca / Motor</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Alternos</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Medidas</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(row, rIdx) in parseResult.parts.slice(0, 100)"
                    :key="`prev-part-${rIdx}`"
                    :class="row.status === 'error' ? 'bg-rose-50/70' : 'hover:bg-slate-50'"
                  >
                    <td class="py-1.5 px-2.5 whitespace-nowrap">
                      <span
                        v-if="row.status === 'valid'"
                        class="inline-flex items-center gap-1 text-emerald-700 font-bold"
                      >
                        <CheckCircle2 class="w-3.5 h-3.5" /> Listo
                      </span>
                      <span
                        v-else-if="row.status === 'warning'"
                        class="inline-flex items-center gap-1 text-amber-700 font-bold"
                        :title="row.messages.join(' | ')"
                      >
                        <AlertTriangle class="w-3.5 h-3.5" /> Aviso
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 text-rose-700 font-bold"
                        :title="row.messages.join(' | ')"
                      >
                        <XCircle class="w-3.5 h-3.5" /> Error
                      </span>
                      <div v-if="row.messages.length > 0" class="text-[10px] text-slate-500">
                        {{ row.messages.join(' · ') }}
                      </div>
                    </td>
                    <td class="py-1.5 px-2.5 font-mono font-bold text-slate-900">
                      {{ row.codigo_oem || '—' }}
                      <div v-if="row.codigos_oem_adicionales.length > 0" class="text-[9px] text-slate-500">
                        +{{ row.codigos_oem_adicionales.join(', ') }}
                      </div>
                    </td>
                    <td class="py-1.5 px-2.5 font-medium text-slate-800 max-w-[200px] truncate">
                      {{ row.nombre || '—' }}
                    </td>
                    <td class="py-1.5 px-2.5 text-slate-700">
                      {{ row.resolvedGrupoNombre || row.categoria }}
                    </td>
                    <td class="py-1.5 px-2.5 text-slate-700">
                      {{ [row.fabricante, row.motorCodigo].filter(Boolean).join(' · ') || '—' }}
                      <div v-if="row.modelos.length > 0" class="text-[9px] text-slate-500 truncate max-w-[140px]">
                        {{ row.modelos.join(', ') }}
                      </div>
                    </td>
                    <td class="py-1.5 px-2.5 font-mono text-[10px] text-slate-600">
                      {{ row.equivalencias.map(e => `${e.marca_alterna}: ${e.codigo_alterno}`).join(', ') || '—' }}
                    </td>
                    <td class="py-1.5 px-2.5 font-mono text-[10px] text-slate-600 max-w-[180px] truncate">
                      {{ formatDimsSummary(row.dimensiones) }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div
                v-if="parseResult.parts.length > 100"
                class="px-3 py-1.5 text-[10px] text-slate-500 bg-slate-50 border-t border-slate-200 text-center"
              >
                Mostrando primeras 100 filas de {{ parseResult.parts.length }} repuestos detectados.
              </div>
            </div>

            <!-- Tabla Preview Motores -->
            <div
              v-else
              class="max-h-64 overflow-auto border border-slate-200 rounded-xl"
            >
              <table class="w-full text-left text-[11px] border-collapse">
                <thead class="sticky top-0 bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                  <tr>
                    <th class="py-2 px-2.5 border-b border-slate-200">Estado</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Fabricante</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Código Motor</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Modelos</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Cil / CC</th>
                    <th class="py-2 px-2.5 border-b border-slate-200">Combustible</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="(m, mIdx) in parseResult.motors.slice(0, 100)"
                    :key="`prev-mot-${mIdx}`"
                    :class="m.status === 'error' ? 'bg-rose-50/70' : 'hover:bg-slate-50'"
                  >
                    <td class="py-1.5 px-2.5">
                      <span v-if="m.status !== 'error'" class="text-emerald-700 font-bold">Listo</span>
                      <span v-else class="text-rose-700 font-bold">{{ m.messages.join(' · ') }}</span>
                    </td>
                    <td class="py-1.5 px-2.5 font-bold">{{ m.fabricante || '—' }}</td>
                    <td class="py-1.5 px-2.5 font-mono font-bold text-[#004B97]">{{ m.codigo || '—' }}</td>
                    <td class="py-1.5 px-2.5">{{ m.modelos.join(', ') || '—' }}</td>
                    <td class="py-1.5 px-2.5 font-mono">
                      {{ m.cilindros || '—' }} cil · {{ m.cilindrada_cc ? `${m.cilindrada_cc} cc` : '—' }}
                    </td>
                    <td class="py-1.5 px-2.5">{{ m.combustible }}</td>
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
                <span>Importando: {{ progressLabel }}</span>
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

          <!-- RESUMEN FINAL -->
          <div
            v-if="importReport"
            class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2.5"
          >
            <div class="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
              <CheckCircle2 class="w-5 h-5 text-emerald-600" />
              <span>Importación finalizada</span>
            </div>
            <div class="flex flex-wrap gap-2 text-xs font-bold">
              <span class="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800">
                Repuestos creados: {{ importReport.createdParts }}
              </span>
              <span
                v-if="importReport.updatedParts > 0"
                class="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-[#004B97]"
              >
                Actualizados: {{ importReport.updatedParts }}
              </span>
              <span
                v-if="importReport.skippedParts > 0"
                class="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600"
              >
                Omitidos: {{ importReport.skippedParts }}
              </span>
              <span
                v-if="importReport.createdMotors > 0"
                class="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800"
              >
                Motores creados: {{ importReport.createdMotors }}
              </span>
              <span
                v-if="importReport.createdBrands > 0 || importReport.createdModels > 0"
                class="px-2.5 py-1 rounded-lg bg-white border border-cyan-200 text-cyan-900"
              >
                Marcas: +{{ importReport.createdBrands }} · Modelos: +{{ importReport.createdModels }}
              </span>
            </div>
            <div
              v-if="importReport.errors.length > 0"
              class="max-h-32 overflow-auto rounded-lg bg-white border border-rose-200 p-2.5 space-y-1 text-[11px] text-rose-700"
            >
              <div class="font-bold">Observaciones / errores ({{ importReport.errors.length }}):</div>
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

          <div class="flex items-center gap-2">
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
              :disabled="isImporting || !parseResult || validMotorsCount + validPartsCount === 0"
              @click="handleRunImport"
              class="px-4 py-2 rounded-xl bg-[#004B97] hover:bg-[#0D1B3E] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <Loader2 v-if="isImporting" class="w-3.5 h-3.5 animate-spin" />
              <Upload v-else class="w-3.5 h-3.5" />
              <span>
                {{
                  isImporting
                    ? 'Importando...'
                    : `Importar ${validPartsCount + validMotorsCount} registro(s)`
                }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
