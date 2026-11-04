<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText, 
  Layers,
} from 'lucide-vue-next'
import type { RepuestoTecnico } from '@/services/catalogService'

const props = defineProps<{
  isOpen: boolean
  part: RepuestoTecnico | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const zoomLevel = ref<number>(1)
const isCopied = ref<boolean>(false)
const imageLoading = ref<boolean>(true)
const imageError = ref<boolean>(false)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      zoomLevel.value = 1
      imageLoading.value = true
      imageError.value = false
    }
  }
)

const handleZoomIn = () => {
  if (zoomLevel.value < 3) {
    zoomLevel.value = Math.min(3, +(zoomLevel.value + 0.25).toFixed(2))
  }
}

const handleZoomOut = () => {
  if (zoomLevel.value > 0.5) {
    zoomLevel.value = Math.max(0.5, +(zoomLevel.value - 0.25).toFixed(2))
  }
}

const handleResetZoom = () => {
  zoomLevel.value = 1
}

const copyImageUrl = async () => {
  if (!props.part?.imagen_url) return
  try {
    await navigator.clipboard.writeText(props.part.imagen_url)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Error al copiar URL de imagen:', err)
  }
}

const downloadImage = () => {
  if (!props.part?.imagen_url) return
  const link = document.createElement('a')
  link.href = props.part.imagen_url
  link.download = `diagrama_${props.part.codigo_oem || 'repuesto'}`
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const onKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return
  if (e.key === 'Escape') {
    emit('close')
  } else if (e.key === '+' || e.key === '=') {
    handleZoomIn()
  } else if (e.key === '-') {
    handleZoomOut()
  } else if (e.key === '0') {
    handleResetZoom()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div
    v-if="isOpen && part"
    class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 transition-all duration-200 select-none animate-in fade-in"
    @click.self="emit('close')"
  >
    <!-- BARRA SUPERIOR / CABECERA -->
    <div class="flex items-center justify-between bg-slate-900/90 text-white px-4 py-3 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[#04C4D9] shrink-0">
          <Layers class="w-5 h-5" />
        </div>

        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono text-xs font-black text-[#04C4D9] bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              OEM: {{ part.codigo_oem }}
            </span>
            <span class="text-[11px] text-slate-400 font-medium">
              {{ part.subsistema }} • {{ part.categoria }}
            </span>
            <span v-if="part.catalogo_origen" class="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {{ part.catalogo_origen }}
            </span>
          </div>

          <h3 class="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
            {{ part.nombre }}
          </h3>
        </div>
      </div>

      <!-- Controles de cabecera -->
      <div class="flex items-center gap-2">
        <!-- Control de Zoom -->
        <div class="hidden sm:flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700 text-xs text-slate-300">
          <button
            type="button"
            @click="handleZoomOut"
            class="p-1 hover:text-white hover:bg-slate-700 rounded transition"
            title="Alejar (-)"
          >
            <ZoomOut class="w-4 h-4" />
          </button>
          <span class="font-mono text-[11px] w-12 text-center">{{ Math.round(zoomLevel * 100) }}%</span>
          <button
            type="button"
            @click="handleZoomIn"
            class="p-1 hover:text-white hover:bg-slate-700 rounded transition"
            title="Acercar (+)"
          >
            <ZoomIn class="w-4 h-4" />
          </button>
          <button
            type="button"
            @click="handleResetZoom"
            class="p-1 hover:text-white hover:bg-slate-700 rounded transition ml-1"
            title="Restablecer escala (0)"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Botón Cerrar -->
        <button
          type="button"
          @click="emit('close')"
          class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
          title="Cerrar lightbox (Esc)"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- ÁREA CENTRAL: VISOR DE IMAGEN -->
    <div 
      class="flex-1 my-3 overflow-hidden flex items-center justify-center relative rounded-2xl bg-slate-900/40 border border-slate-800/80 p-2 sm:p-6"
      @click.self="emit('close')"
    >
      <!-- Indicador de carga -->
      <div v-if="imageLoading && !imageError" class="absolute inset-0 flex items-center justify-center text-slate-400 gap-2">
        <span class="w-6 h-6 border-2 border-[#04C4D9] border-t-transparent rounded-full animate-spin"></span>
        <span class="text-xs font-bold text-slate-300">Cargando diagrama técnico...</span>
      </div>

      <!-- Error al cargar imagen -->
      <div v-if="imageError" class="text-center p-6 space-y-2 text-slate-400">
        <FileText class="w-12 h-12 text-slate-600 mx-auto" />
        <h4 class="text-sm font-bold text-white">No se pudo cargar la imagen técnica</h4>
        <p class="text-xs text-slate-400 max-w-sm">
          Es posible que el enlace haya cambiado o la imagen requiera permisos adicionales.
        </p>
        <a
          v-if="part.imagen_url"
          :href="part.imagen_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs font-bold text-[#04C4D9] hover:underline pt-2"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          <span>Intentar abrir directamente</span>
        </a>
      </div>

      <!-- Imagen con zoom -->
      <img
        v-show="!imageError"
        :src="part.imagen_url"
        :alt="part.nombre"
        class="max-w-full max-h-[72vh] object-contain transition-transform duration-150 ease-out rounded-lg shadow-2xl cursor-zoom-in"
        :style="{ transform: `scale(${zoomLevel})` }"
        @load="imageLoading = false"
        @error="imageError = true; imageLoading = false"
        @dblclick="zoomLevel === 1 ? handleZoomIn() : handleResetZoom()"
      />
    </div>

    <!-- BARRA INFERIOR / ACCIONES Y COTAS TÉCNICAS -->
    <div class="bg-slate-900/90 text-white px-4 py-2.5 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
      <!-- Resumen de medidas clave debajo del diagrama -->
      <div class="flex items-center gap-2 flex-wrap text-xs font-mono text-slate-300">
        <span class="text-[10px] uppercase font-sans font-bold text-slate-400">Cotas Rápidas:</span>

        <span v-if="part.diametro_interior_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          Ø Int: <strong>{{ part.diametro_interior_mm }}mm</strong>
        </span>
        <span v-if="part.diametro_exterior_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          Ø Ext: <strong>{{ part.diametro_exterior_mm }}mm</strong>
        </span>
        <span v-if="part.altura_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          Alt: <strong>{{ part.altura_mm }}mm</strong>
        </span>

        <span v-if="part.diametro_cabeza_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          Hongo: <strong>{{ part.diametro_cabeza_mm }}mm</strong>
        </span>
        <span v-if="part.diametro_vastago_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          Vástago: <strong>{{ part.diametro_vastago_mm }}mm</strong>
        </span>
        <span v-if="part.longitud_total_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          Largo: <strong>{{ part.longitud_total_mm }}mm</strong>
        </span>

        <span v-if="part.diametro_cilindro_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          Ø Cil: <strong>{{ part.diametro_cilindro_mm }}mm</strong>
        </span>
        <span v-if="part.espesor_anillo1_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          1°: <strong>{{ part.espesor_anillo1_mm }}mm</strong>
        </span>
        <span v-if="part.espesor_anillo2_mm" class="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          2°: <strong>{{ part.espesor_anillo2_mm }}mm</strong>
        </span>
      </div>

      <!-- Botones de Acción -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="downloadImage"
          class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 border border-slate-700"
          title="Descargar diagrama"
        >
          <Download class="w-3.5 h-3.5 text-slate-400" />
          <span>Descargar</span>
        </button>

        <button
          type="button"
          @click="copyImageUrl"
          class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 border border-slate-700"
          title="Copiar enlace de la imagen"
        >
          <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-400" />
          <Copy v-else class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ isCopied ? 'Enlace Copiado' : 'Copiar URL' }}</span>
        </button>

        <a
          v-if="part.imagen_url"
          :href="part.imagen_url"
          target="_blank"
          rel="noopener noreferrer"
          class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 border border-slate-700"
          title="Abrir imagen en nueva pestaña"
        >
          <ExternalLink class="w-3.5 h-3.5 text-slate-400" />
          <span>Abrir Original</span>
        </a>

        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 rounded-xl bg-[#04C4D9] hover:bg-[#03a9bc] text-white text-xs font-bold transition shadow-md"
        >
          Listo
        </button>
      </div>
    </div>
  </div>
</template>
