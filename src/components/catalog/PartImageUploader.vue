<script setup lang="ts">
import { ref, watch } from 'vue'
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Link as LinkIcon,
  Maximize2
} from 'lucide-vue-next'
import { 
  uploadRepuestoImage, 
  formatFileSize, 
  type CompressionResult 
} from '@/services/storageService'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    partCode?: string
    label?: string
    hint?: string
  }>(),
  {
    modelValue: '',
    partCode: 'repuesto',
    label: 'Imagen Técnica / Diagrama de Explosión',
    hint: 'Soporta PNG, JPG, WEBP o SVG. Las imágenes se comprimen automáticamente para acelerar su carga en taller.'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref<boolean>(false)
const isUploading = ref<boolean>(false)
const errorMessage = ref<string | null>(null)
const compressionStats = ref<CompressionResult | null>(null)
const showUrlInput = ref<boolean>(false)
const manualUrl = ref<string>('')
const isPreviewModalOpen = ref<boolean>(false)

watch(
  () => props.modelValue,
  (val) => {
    if (val && !manualUrl.value) {
      manualUrl.value = val
    }
  },
  { immediate: true }
)

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  await processFile(files[0])
  target.value = ''
}

const handleDrop = async (e: DragEvent) => {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await processFile(files[0])
}

const processFile = async (file: File) => {
  errorMessage.value = null

  // Validar formato
  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Solo se admiten archivos de imagen (PNG, JPG, WEBP, SVG, GIF).'
    return
  }

  // Validar peso máximo inicial (máximo 12 MB antes de compresión)
  if (file.size > 12 * 1024 * 1024) {
    errorMessage.value = 'El archivo supera el límite de 12 MB. Elige una imagen más liviana.'
    return
  }

  isUploading.value = true
  try {
    const result = await uploadRepuestoImage(file, props.partCode || 'repuesto')
    if (result.compression) {
      compressionStats.value = result.compression
    }
    emit('update:modelValue', result.url)
    manualUrl.value = result.url
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al procesar la imagen'
    errorMessage.value = msg
  } finally {
    isUploading.value = false
  }
}

const removeImage = () => {
  emit('update:modelValue', '')
  manualUrl.value = ''
  compressionStats.value = null
  errorMessage.value = null
}

const applyManualUrl = () => {
  const clean = manualUrl.value.trim()
  if (!clean) {
    removeImage()
    return
  }
  emit('update:modelValue', clean)
  compressionStats.value = null
}
</script>

<template>
  <div class="space-y-2">
    <!-- Cabecera del Campo -->
    <div class="flex items-center justify-between">
      <label class="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
        <ImageIcon class="w-4 h-4 text-[#04C4D9]" />
        <span>{{ label }}</span>
      </label>

      <button
        type="button"
        @click="showUrlInput = !showUrlInput"
        class="text-[11px] font-semibold text-[#038391] hover:underline flex items-center gap-1"
      >
        <LinkIcon class="w-3 h-3" />
        <span>{{ showUrlInput ? 'Subir archivo' : 'Ingresar URL directa' }}</span>
      </button>
    </div>

    <!-- 1. MODO URL DIRECTA -->
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
          class="px-3 py-1.5 bg-[#04C4D9] hover:bg-[#03a9bc] text-white text-xs font-bold rounded-lg transition"
        >
          Aplicar
        </button>
      </div>
      <p class="text-[10px] text-slate-400">
        Pega un enlace público de Cloudinary, Unsplash o el sitio del fabricante.
      </p>
    </div>

    <!-- 2. VISTA PREVIA SI YA TIENE IMAGEN -->
    <div 
      v-if="modelValue && !showUrlInput" 
      class="relative bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3.5 group"
    >
      <!-- Thumbnail miniatura -->
      <div 
        class="relative w-28 h-28 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-xs shrink-0 cursor-pointer"
        @click="isPreviewModalOpen = true"
        title="Clic para ver en tamaño completo"
      >
        <img 
          :src="modelValue" 
          alt="Vista previa del repuesto" 
          class="w-full h-full object-contain p-1"
          loading="lazy"
        />
        <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
          <Maximize2 class="w-5 h-5 text-white" />
        </div>
      </div>

      <!-- Información y Acciones -->
      <div class="flex-1 min-w-0 space-y-1.5 text-left w-full sm:w-auto">
        <div class="flex items-center gap-1.5">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 class="w-3 h-3 text-emerald-600" />
            Imagen Asignada
          </span>

          <span 
            v-if="compressionStats" 
            class="text-[10px] font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200"
          >
            Optimizado: {{ formatFileSize(compressionStats.originalSize) }} → {{ formatFileSize(compressionStats.compressedSize) }} (-{{ compressionStats.reductionPercent }}%)
          </span>
        </div>

        <p class="text-[11px] text-slate-600 truncate font-mono" :title="modelValue">
          {{ modelValue }}
        </p>

        <!-- Botonera de acciones -->
        <div class="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            @click="isPreviewModalOpen = true"
            class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1"
          >
            <Maximize2 class="w-3.5 h-3.5 text-slate-500" />
            <span>Ver Ampliada</span>
          </button>

          <button
            type="button"
            @click="triggerFileInput"
            class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[#038391] transition flex items-center gap-1"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            <span>Reemplazar</span>
          </button>

          <button
            type="button"
            @click="removeImage"
            class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 transition flex items-center gap-1"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Quitar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. DROPZONE DE SUBIDA (Si no tiene imagen o se desea reemplazar) -->
    <div
      v-else-if="!showUrlInput"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      class="border-2 border-dashed rounded-xl p-4 sm:p-5 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2"
      :class="[
        isDragging 
          ? 'border-[#04C4D9] bg-cyan-50/50 scale-[0.99]' 
          : 'border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50'
      ]"
      @click="triggerFileInput"
    >
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- Estado: Subiendo / Optimizando -->
      <div v-if="isUploading" class="py-2 flex flex-col items-center gap-2">
        <Loader2 class="w-8 h-8 text-[#04C4D9] animate-spin" />
        <span class="text-xs font-bold text-slate-700">Comprimiendo y alojando imagen en la nube...</span>
        <span class="text-[10px] text-slate-400">Optimizando dimensiones para carga ultrarrápida</span>
      </div>

      <!-- Estado: Esperando archivo -->
      <template v-else>
        <div class="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-[#04C4D9]">
          <UploadCloud class="w-5 h-5" />
        </div>

        <div>
          <p class="text-xs font-bold text-slate-700">
            Arrastra aquí el diagrama o foto, o <span class="text-[#038391] underline">explora tus archivos</span>
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5">
            {{ hint }}
          </p>
        </div>
      </template>
    </div>

    <!-- Mensaje de Error -->
    <div v-if="errorMessage" class="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg">
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Modal Lightbox Preview Local -->
    <div
      v-if="isPreviewModalOpen && modelValue"
      class="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
      @click.self="isPreviewModalOpen = false"
    >
      <div class="bg-white rounded-2xl max-w-xl w-full p-4 space-y-3 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <ImageIcon class="w-4 h-4 text-[#04C4D9]" />
            <h4 class="text-xs font-bold text-slate-900 uppercase">Vista Previa de Imagen Técnica</h4>
          </div>
          <button
            type="button"
            @click="isPreviewModalOpen = false"
            class="text-xs font-bold text-slate-400 hover:text-slate-800"
          >
            Cerrar
          </button>
        </div>

        <div class="flex-1 overflow-auto flex items-center justify-center bg-slate-50 rounded-xl p-2 min-h-[240px]">
          <img 
            :src="modelValue" 
            alt="Plano / Foto" 
            class="max-w-full max-h-[60vh] object-contain rounded-lg"
          />
        </div>

        <div class="flex items-center justify-between text-xs pt-1">
          <a
            :href="modelValue"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[#038391] hover:underline flex items-center gap-1 text-[11px] font-semibold"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span>Abrir en pestaña nueva</span>
          </a>

          <button
            type="button"
            @click="isPreviewModalOpen = false"
            class="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
