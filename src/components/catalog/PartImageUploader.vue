<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Link as LinkIcon,
  Maximize2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Star,
  Plus,
  Download
} from 'lucide-vue-next'
import { 
  uploadRepuestoImage, 
  uploadRepuestoDocument,
  formatFileSize, 
  type CompressionResult 
} from '@/services/storageService'
import type { DocumentoPdf } from '@/services/catalogService'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    imagenes?: string[]
    documentosPdf?: DocumentoPdf[]
    partCode?: string
    label?: string
    hint?: string
  }>(),
  {
    modelValue: '',
    imagenes: undefined,
    documentosPdf: undefined,
    partCode: 'repuesto',
    label: 'Imágenes Técnicas y Documentos PDF',
    hint: 'Soporta múltiples fotos (PNG, JPG, WEBP) y fichas técnicas en PDF.'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:imagenes', value: string[]): void
  (e: 'update:documentosPdf', value: DocumentoPdf[]): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const pdfInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref<boolean>(false)
const isDraggingPdf = ref<boolean>(false)
const isUploading = ref<boolean>(false)
const isUploadingPdf = ref<boolean>(false)
const errorMessage = ref<string | null>(null)
const uploadWarning = ref<string | null>(null)
const compressionStats = ref<CompressionResult | null>(null)
const showUrlInput = ref<boolean>(false)
const showPdfUrlInput = ref<boolean>(false)
const manualUrl = ref<string>('')
const manualPdfName = ref<string>('')
const manualPdfUrl = ref<string>('')
const isPreviewModalOpen = ref<boolean>(false)
const previewIndex = ref<number>(0)

const currentImages = computed<string[]>(() => {
  if (Array.isArray(props.imagenes) && props.imagenes.length > 0) {
    return Array.from(new Set(props.imagenes.map(u => String(u || '').trim()).filter(Boolean)))
  }
  const single = String(props.modelValue || '').trim()
  return single ? [single] : []
})

const currentDocs = computed<DocumentoPdf[]>(() => {
  return Array.isArray(props.documentosPdf) ? props.documentosPdf : []
})

watch(
  () => props.modelValue,
  (val) => {
    if (val && !manualUrl.value) {
      manualUrl.value = val
    }
  },
  { immediate: true }
)

const updateImageList = (nextList: string[]) => {
  const clean = Array.from(new Set(nextList.map(u => u.trim()).filter(Boolean)))
  emit('update:imagenes', clean)
  emit('update:modelValue', clean[0] || '')
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const triggerPdfInput = () => {
  pdfInputRef.value?.click()
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  await processImageFiles(Array.from(files))
  target.value = ''
}

const handleDrop = async (e: DragEvent) => {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const imgFiles: File[] = []
  const pdfFiles: File[] = []
  for (const f of Array.from(files)) {
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      pdfFiles.push(f)
    } else if (f.type.startsWith('image/')) {
      imgFiles.push(f)
    }
  }
  if (imgFiles.length > 0) await processImageFiles(imgFiles)
  if (pdfFiles.length > 0) await processPdfFiles(pdfFiles)
}

const handlePdfSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  await processPdfFiles(Array.from(files))
  target.value = ''
}

const handlePdfDrop = async (e: DragEvent) => {
  isDraggingPdf.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await processPdfFiles(Array.from(files))
}

const processImageFiles = async (files: File[]) => {
  errorMessage.value = null
  const validFiles = files.filter(file => {
    if (!file.type.startsWith('image/')) {
      errorMessage.value = 'Solo se admiten archivos de imagen (PNG, JPG, WEBP, SVG, GIF).'
      return false
    }
    if (file.size > 12 * 1024 * 1024) {
      errorMessage.value = `El archivo "${file.name}" supera el límite de 12 MB.`
      return false
    }
    return true
  })

  if (validFiles.length === 0) return

  isUploading.value = true
  try {
    const nextUrls = [...currentImages.value]
    for (const file of validFiles) {
      const result = await uploadRepuestoImage(file, props.partCode || 'repuesto')
      if (result.compression) {
        compressionStats.value = result.compression
      }
      if (result.warning) {
        uploadWarning.value = result.warning
      }
      nextUrls.push(result.url)
    }
    updateImageList(nextUrls)
    manualUrl.value = nextUrls[0] || ''
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar las imágenes'
    errorMessage.value = msg
  } finally {
    isUploading.value = false
  }
}

const processPdfFiles = async (files: File[]) => {
  errorMessage.value = null
  const validPdfs = files.filter(file => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      errorMessage.value = `"${file.name}" no es un archivo PDF válido.`
      return false
    }
    if (file.size > 25 * 1024 * 1024) {
      errorMessage.value = `El PDF "${file.name}" supera el límite de 25 MB.`
      return false
    }
    return true
  })

  if (validPdfs.length === 0) return

  isUploadingPdf.value = true
  try {
    const nextDocs: DocumentoPdf[] = [...currentDocs.value]
    for (const file of validPdfs) {
      const result = await uploadRepuestoDocument(file, props.partCode || 'repuesto')
      if (result.warning) {
        uploadWarning.value = result.warning
      }
      nextDocs.push({
        nombre: file.name,
        url: result.url,
        size: file.size,
        uploaded_at: new Date().toISOString()
      })
    }
    emit('update:documentosPdf', nextDocs)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al subir documento PDF'
    errorMessage.value = msg
  } finally {
    isUploadingPdf.value = false
  }
}

const removeImageAt = (idx: number) => {
  const next = [...currentImages.value]
  next.splice(idx, 1)
  updateImageList(next)
  if (previewIndex.value >= next.length) {
    previewIndex.value = Math.max(0, next.length - 1)
  }
  if (next.length === 0) {
    manualUrl.value = ''
    compressionStats.value = null
  }
}

const setPrimaryImageAt = (idx: number) => {
  if (idx <= 0 || idx >= currentImages.value.length) return
  const next = [...currentImages.value]
  const [chosen] = next.splice(idx, 1)
  if (chosen) {
    next.unshift(chosen)
    updateImageList(next)
  }
}

const moveImage = (idx: number, delta: -1 | 1) => {
  const targetIdx = idx + delta
  if (targetIdx < 0 || targetIdx >= currentImages.value.length) return
  const next = [...currentImages.value]
  const temp = next[idx]!
  next[idx] = next[targetIdx]!
  next[targetIdx] = temp
  updateImageList(next)
}

const openImagePreviewAt = (idx: number) => {
  previewIndex.value = idx
  isPreviewModalOpen.value = true
}

const applyManualUrl = () => {
  const clean = manualUrl.value.trim()
  if (!clean) return
  updateImageList([...currentImages.value, clean])
  manualUrl.value = ''
  showUrlInput.value = false
  compressionStats.value = null
}

const addManualPdfUrl = () => {
  const url = manualPdfUrl.value.trim()
  if (!url) return
  const name = manualPdfName.value.trim() || url.split('/').pop()?.split('?')[0] || 'Ficha Técnica.pdf'
  emit('update:documentosPdf', [
    ...currentDocs.value,
    {
      nombre: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`,
      url,
      uploaded_at: new Date().toISOString()
    }
  ])
  manualPdfUrl.value = ''
  manualPdfName.value = ''
  showPdfUrlInput.value = false
}

const removePdfAt = (idx: number) => {
  const next = [...currentDocs.value]
  next.splice(idx, 1)
  emit('update:documentosPdf', next)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Cabecera del Campo Multimedia -->
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
        <ImageIcon class="w-4 h-4 text-[#04C4D9]" />
        <span>{{ label }}</span>
        <span v-if="currentImages.length > 0" class="px-1.5 py-0.2 rounded-full bg-cyan-50 text-[#038391] border border-cyan-200 text-[10px] font-black">
          {{ currentImages.length }} foto(s)
        </span>
      </label>

      <button
        type="button"
        @click="showUrlInput = !showUrlInput"
        class="text-[11px] font-semibold text-[#038391] hover:underline flex items-center gap-1"
      >
        <LinkIcon class="w-3 h-3" />
        <span>{{ showUrlInput ? 'Subir archivo(s)' : 'Agregar URL de imagen' }}</span>
      </button>
    </div>

    <!-- Input oculto múltiple para imágenes -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- 1. MODO URL DIRECTA PARA FOTO -->
    <div v-if="showUrlInput" class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
      <div class="flex gap-2">
        <input
          v-model="manualUrl"
          type="url"
          placeholder="https://ejemplo.com/repuestos/valvula_13711.jpg"
          class="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#04C4D9]"
          @keydown.enter.prevent="applyManualUrl"
        />
        <button
          type="button"
          @click="applyManualUrl"
          class="px-3 py-1.5 bg-[#147488] hover:bg-[#105E6E] text-white text-xs font-bold rounded-lg transition cursor-pointer"
        >
          Agregar
        </button>
      </div>
      <p class="text-[10px] text-slate-400">
        Pega un enlace público para añadirlo a la galería de este repuesto.
      </p>
    </div>

    <!-- 2. GALERÍA DE MÚLTIPLES IMÁGENES -->
    <div v-if="currentImages.length > 0" class="space-y-2">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div
          v-for="(imgUrl, idx) in currentImages"
          :key="`up-img-${idx}-${imgUrl}`"
          class="relative bg-white border rounded-xl p-1.5 flex flex-col gap-1.5 group transition"
          :class="idx === 0 ? 'border-[#04C4D9] ring-1 ring-[#04C4D9]/30 shadow-xs' : 'border-slate-200 hover:border-slate-300'"
        >
          <div
            class="relative w-full h-20 rounded-lg overflow-hidden bg-slate-50 cursor-pointer flex items-center justify-center"
            @click="openImagePreviewAt(idx)"
            title="Clic para ampliar"
          >
            <img
              :src="imgUrl"
              :alt="`Foto ${idx + 1}`"
              class="w-full h-full object-contain p-0.5"
              loading="lazy"
            />
            <span
              v-if="idx === 0"
              class="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-[#004B97] text-white text-[9px] font-black uppercase tracking-wide shadow"
            >
              Principal
            </span>
            <div class="absolute inset-0 bg-slate-900/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <Maximize2 class="w-4 h-4 text-white" />
            </div>
          </div>

          <!-- Controles de reordenar / principal / eliminar -->
          <div class="flex items-center justify-between gap-1 text-[10px]">
            <div class="flex items-center gap-0.5">
              <button
                type="button"
                @click="moveImage(idx, -1)"
                :disabled="idx === 0"
                class="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition"
                title="Mover a la izquierda"
              >
                <ChevronLeft class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="moveImage(idx, 1)"
                :disabled="idx === currentImages.length - 1"
                class="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600 transition"
                title="Mover a la derecha"
              >
                <ChevronRight class="w-3 h-3" />
              </button>
            </div>

            <div class="flex items-center gap-0.5">
              <button
                v-if="idx !== 0"
                type="button"
                @click="setPrimaryImageAt(idx)"
                class="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition"
                title="Definir como foto principal"
              >
                <Star class="w-3 h-3" />
              </button>
              <button
                type="button"
                @click="removeImageAt(idx)"
                class="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                title="Quitar imagen"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Botón añadir más fotos rápido -->
        <button
          type="button"
          @click="triggerFileInput"
          :disabled="isUploading"
          class="min-h-[112px] border-2 border-dashed border-slate-300 hover:border-[#04C4D9] rounded-xl flex flex-col items-center justify-center gap-1 p-2 text-slate-500 hover:text-[#038391] bg-slate-50/70 hover:bg-cyan-50/30 transition cursor-pointer"
        >
          <Loader2 v-if="isUploading" class="w-5 h-5 text-[#04C4D9] animate-spin" />
          <Plus v-else class="w-5 h-5" />
          <span class="text-[10px] font-bold text-center">
            {{ isUploading ? 'Subiendo...' : 'Agregar Foto(s)' }}
          </span>
        </button>
      </div>

      <div v-if="compressionStats" class="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
        <CheckCircle2 class="w-3.5 h-3.5 text-cyan-600 shrink-0" />
        <span>Última imagen optimizada: {{ formatFileSize(compressionStats.originalSize) }} → {{ formatFileSize(compressionStats.compressedSize) }} (-{{ compressionStats.reductionPercent }}%)</span>
      </div>
    </div>

    <!-- 3. DROPZONE DE SUBIDA INICIAL DE IMÁGENES (Si no tiene ninguna) -->
    <div
      v-else-if="!showUrlInput"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      class="border-2 border-dashed rounded-xl p-4 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5"
      :class="[
        isDragging 
          ? 'border-[#04C4D9] bg-cyan-50/50 scale-[0.99]' 
          : 'border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50'
      ]"
      @click="triggerFileInput"
    >
      <div v-if="isUploading" class="py-1 flex flex-col items-center gap-1.5">
        <Loader2 class="w-7 h-7 text-[#04C4D9] animate-spin" />
        <span class="text-xs font-bold text-slate-700">Comprimiendo y alojando imágenes...</span>
      </div>
      <template v-else>
        <div class="w-9 h-9 rounded-full bg-cyan-50 flex items-center justify-center text-[#04C4D9]">
          <UploadCloud class="w-5 h-5" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-700">
            Arrastra aquí una o varias fotos, o <span class="text-[#038391] underline">explora tus archivos</span>
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5">{{ hint }}</p>
        </div>
      </template>
    </div>

    <!-- 4. DOCUMENTOS PDF TÉCNICOS (Hojas de catálogo, planos de montaje) -->
    <div class="pt-2 border-t border-slate-200/90 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
          <FileText class="w-3.5 h-3.5 text-rose-600" />
          <span>Fichas / Planos PDF</span>
          <span v-if="currentDocs.length > 0" class="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
            {{ currentDocs.length }}
          </span>
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="showPdfUrlInput = !showPdfUrlInput"
            class="text-[10px] font-semibold text-slate-500 hover:text-[#038391] underline cursor-pointer"
          >
            {{ showPdfUrlInput ? 'Ocultar URL' : 'URL PDF' }}
          </button>
          <button
            type="button"
            @click="triggerPdfInput"
            :disabled="isUploadingPdf"
            class="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:border-rose-400 text-[11px] font-bold text-slate-700 hover:text-rose-700 flex items-center gap-1 shadow-2xs transition cursor-pointer"
          >
            <Loader2 v-if="isUploadingPdf" class="w-3 h-3 animate-spin text-rose-600" />
            <Plus v-else class="w-3 h-3 text-rose-600" />
            <span>{{ isUploadingPdf ? 'Subiendo PDF...' : 'Adjuntar PDF' }}</span>
          </button>
        </div>
      </div>

      <input
        ref="pdfInputRef"
        type="file"
        multiple
        accept="application/pdf,.pdf"
        class="hidden"
        @change="handlePdfSelect"
      />

      <!-- Agregar PDF por URL -->
      <div v-if="showPdfUrlInput" class="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <input
            v-model="manualPdfName"
            type="text"
            placeholder="Nombre (ej. Hoja Técnica NPR.pdf)"
            class="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
          />
          <div class="flex gap-1">
            <input
              v-model="manualPdfUrl"
              type="url"
              placeholder="https://.../manual.pdf"
              class="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#04C4D9]"
              @keydown.enter.prevent="addManualPdfUrl"
            />
            <button
              type="button"
              @click="addManualPdfUrl"
              class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <!-- Lista de PDFs adjuntos / Zona drop compacta -->
      <div
        v-if="currentDocs.length > 0"
        class="space-y-1.5"
      >
        <div
          v-for="(doc, dIdx) in currentDocs"
          :key="`doc-pdf-${dIdx}-${doc.url}`"
          class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <FileText class="w-4 h-4 text-rose-600 shrink-0" />
            <div class="min-w-0">
              <p class="font-bold text-slate-800 truncate text-[11px]" :title="doc.nombre">{{ doc.nombre }}</p>
              <span v-if="doc.size" class="text-[9px] text-slate-400 font-mono">{{ formatFileSize(doc.size) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <a
              :href="doc.url"
              target="_blank"
              rel="noopener noreferrer"
              class="p-1 rounded hover:bg-slate-100 text-[#038391]"
              title="Ver PDF en nueva pestaña"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
            <a
              :href="doc.url"
              :download="doc.nombre"
              class="p-1 rounded hover:bg-slate-100 text-slate-600"
              title="Descargar PDF"
            >
              <Download class="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              @click="removePdfAt(dIdx)"
              class="p-1 rounded hover:bg-rose-50 text-rose-600"
              title="Quitar PDF"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div
        v-else
        @dragover.prevent="isDraggingPdf = true"
        @dragleave.prevent="isDraggingPdf = false"
        @drop.prevent="handlePdfDrop"
        @click="triggerPdfInput"
        class="border border-dashed rounded-lg px-3 py-2 text-center text-[11px] cursor-pointer transition"
        :class="isDraggingPdf ? 'border-rose-400 bg-rose-50/50 text-rose-700' : 'border-slate-300 bg-white/70 text-slate-500 hover:border-slate-400'"
      >
        Arrastra aquí hojas de catálogo o planos PDF (máx. 25 MB)
      </div>
    </div>

    <!-- Advertencia / Error -->
    <div v-if="uploadWarning" class="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-lg font-medium flex items-start gap-1.5">
      <AlertCircle class="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
      <span>{{ uploadWarning }}</span>
    </div>

    <div v-if="errorMessage" class="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg">
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Modal Lightbox Preview Local con Carrusel -->
    <div
      v-if="isPreviewModalOpen && currentImages.length > 0"
      class="fixed inset-0 z-50 bg-[#09132B]/75 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="isPreviewModalOpen = false"
    >
      <div class="studio-card bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] popover-pop-in">
        <div class="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white">
          <div class="flex items-center gap-2">
            <ImageIcon class="w-4 h-4 text-[#BFEBF2]" />
            <h4 class="text-xs font-bold font-display text-white uppercase tracking-wide">
              Galería Técnica ({{ previewIndex + 1 }} / {{ currentImages.length }})
            </h4>
          </div>
          <button
            type="button"
            @click="isPreviewModalOpen = false"
            class="text-xs font-bold text-white/80 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/15 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        <div class="relative flex-1 overflow-auto flex items-center justify-center bg-slate-50 p-3 min-h-[260px]">
          <button
            v-if="currentImages.length > 1"
            type="button"
            @click="previewIndex = (previewIndex - 1 + currentImages.length) % currentImages.length"
            class="absolute left-3 p-2 rounded-full bg-white/95 hover:bg-white shadow-md border border-slate-200 text-[#0D1B3E] transition cursor-pointer"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <img 
            :src="currentImages[previewIndex]" 
            alt="Plano / Foto" 
            class="max-w-full max-h-[58vh] object-contain rounded-xl"
          />
          <button
            v-if="currentImages.length > 1"
            type="button"
            @click="previewIndex = (previewIndex + 1) % currentImages.length"
            class="absolute right-3 p-2 rounded-full bg-white/95 hover:bg-white shadow-md border border-slate-200 text-[#0D1B3E] transition cursor-pointer"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <div class="flex items-center justify-between text-xs px-5 py-3.5 bg-white border-t border-slate-200">
          <a
            :href="currentImages[previewIndex]"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[#004B97] hover:underline flex items-center gap-1 text-[11px] font-bold"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span>Abrir en pestaña nueva</span>
          </a>

          <button
            type="button"
            @click="isPreviewModalOpen = false"
            class="px-4 py-1.5 bg-[#004B97] hover:bg-[#0D1B3E] text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

