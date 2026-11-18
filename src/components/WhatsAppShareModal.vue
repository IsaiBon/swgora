<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { Order } from '@/services/ordersService'
import { useTallerStore } from '@/stores/taller'
import {
  generateOrderPdfFile,
  type GeneratedOrderPdf,
} from '@/utils/pdfExport'
import WorkOrderDocument from '@/components/WorkOrderDocument.vue'
import WhatsAppIcon from '@/components/WhatsAppIcon.vue'
import {
  WA_ME_SAFE_URL_LIMIT,
  buildOrderWhatsAppMessage,
  buildWaMeUrl,
  canNativeSharePdfFiles,
  formatVehicleEngineLabel,
  type WhatsAppMessagePreset,
} from '@/utils/whatsappShare'
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Share2,
  X,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    order: Order | null
    initialShowSubtotals?: boolean
    onGeneratePdf?: (() => Promise<GeneratedOrderPdf | null>) | null
  }>(),
  {
    initialShowSubtotals: undefined,
    onGeneratePdf: null,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'shared', payload: { order: Order; preset: WhatsAppMessagePreset }): void
}>()

const tallerStore = useTallerStore()
const DEFAULT_PRESET: WhatsAppMessagePreset = 'detailed'
let sessionCounter = 0

// Mensaje automático para WhatsApp
const generatedMessage = ref('')

// Estado de PDF para envío directo nativo
const cachedPdf = ref<GeneratedOrderPdf | null>(null)
const isNativeSharingPdf = ref(false)
const pdfStatusMessage = ref<string | null>(null)
const pdfError = ref<string | null>(null)
const renderOffscreenPdf = ref(false)
const offscreenContainerRef = ref<HTMLElement | null>(null)

const supportsNativePdfShare = computed(() => canNativeSharePdfFiles())
const isCotizacion = computed(() => props.order?.type === 'cotizacion')

const effectiveShowSubtotals = computed(() => {
  if (typeof props.initialShowSubtotals === 'boolean') return props.initialShowSubtotals
  if (typeof props.order?.showSubtotals === 'boolean') return props.order.showSubtotals
  return true
})

const waUrl = computed(() => buildWaMeUrl('', generatedMessage.value))
const isUrlTooLong = computed(() => waUrl.value.length > WA_ME_SAFE_URL_LIMIT)
const vehicleSummary = computed(() =>
  props.order ? formatVehicleEngineLabel(props.order) : ''
)

const buildMessage = () => {
  if (!props.order) {
    generatedMessage.value = ''
    return
  }
  generatedMessage.value = buildOrderWhatsAppMessage(
    props.order,
    tallerStore.tallerInfo,
    {
      preset: DEFAULT_PRESET,
      includeItemPrices: true,
      includeBlockSubtotals: effectiveShowSubtotals.value,
      includeStatus: props.order.type !== 'cotizacion',
      includeObservations: Boolean(props.order.observations?.trim()),
      includeTallerContact: true,
    }
  )
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    emit('close')
  }
}

watch(
  () => [props.isOpen, props.order?.id] as const,
  async ([open]) => {
    if (typeof window !== 'undefined') {
      if (open) {
        window.addEventListener('keydown', handleKeydown, true)
      } else {
        window.removeEventListener('keydown', handleKeydown, true)
      }
    }

    if (!open || !props.order) return

    const currentSession = ++sessionCounter
    cachedPdf.value = null
    pdfStatusMessage.value = null
    pdfError.value = null

    await tallerStore.loadTallerInfo()
    if (currentSession !== sessionCounter) return
    buildMessage()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown, true)
  }
})

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Usar respaldo con textarea temporal
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * Obtiene o genera el archivo PDF de la orden/cotización en memoria.
 */
const obtainOrderPdfFile = async (): Promise<GeneratedOrderPdf> => {
  if (cachedPdf.value) {
    return cachedPdf.value
  }
  if (!props.order) {
    throw new Error('No hay documento seleccionado.')
  }

  if (props.onGeneratePdf) {
    const generated = await props.onGeneratePdf()
    if (generated) {
      cachedPdf.value = generated
      return generated
    }
  }

  await tallerStore.loadTallerInfo()
  renderOffscreenPdf.value = true
  try {
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 90))

    const container = offscreenContainerRef.value
    const docEl =
      (container?.querySelector('#printable-work-order') as HTMLElement | null) ||
      container
    if (!docEl) {
      throw new Error('No se pudo preparar el documento PDF.')
    }
    const generated = await generateOrderPdfFile(docEl, props.order)
    cachedPdf.value = generated
    return generated
  } finally {
    renderOffscreenPdf.value = false
  }
}

/**
 * Envía el archivo PDF real mediante la hoja nativa del dispositivo (Android/iOS/OS compatible).
 */
const handleNativeSharePdf = async () => {
  if (!props.order || isNativeSharingPdf.value || !supportsNativePdfShare.value) return
  isNativeSharingPdf.value = true
  pdfError.value = null
  pdfStatusMessage.value = null

  try {
    const generated = await obtainOrderPdfFile()
    const docTitle = isCotizacion.value ? 'Cotización' : 'Orden de Trabajo'
    await navigator.share({
      title: `${docTitle} ${props.order.orderNumber}`,
      text: generatedMessage.value,
      files: [generated.file],
    })
    pdfStatusMessage.value = 'Archivo PDF compartido mediante el menú del dispositivo.'
    emit('shared', {
      order: props.order,
      preset: DEFAULT_PRESET,
    })
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.error('[WhatsAppShareModal] Error al compartir archivo PDF nativo:', err)
      pdfError.value = 'Tu navegador no completó el envío directo del archivo PDF.'
    }
  } finally {
    isNativeSharingPdf.value = false
  }
}

const handleOpenWhatsApp = () => {
  if (!props.order) return
  if (!generatedMessage.value.trim()) return

  window.open(waUrl.value, '_blank', 'noopener,noreferrer')
  emit('shared', {
    order: props.order,
    preset: DEFAULT_PRESET,
  })
}

const handleCopyAndOpenEmptyChat = async () => {
  if (!props.order) return

  await copyTextToClipboard(generatedMessage.value)
  const emptyChatUrl = buildWaMeUrl('', '')
  window.open(emptyChatUrl, '_blank', 'noopener,noreferrer')
  emit('shared', {
    order: props.order,
    preset: DEFAULT_PRESET,
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && order"
      class="fixed inset-0 z-[60] overflow-y-auto bg-[#09132B]/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-share-modal-title"
      @click.self="emit('close')"
    >
      <div
        class="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 popover-pop-in my-auto"
      >
        <!-- Header -->
        <div
          class="px-5 py-4 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white flex items-center justify-between gap-3 shrink-0"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-10 h-10 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-md shrink-0"
            >
              <WhatsAppIcon class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <h3
                id="wa-share-modal-title"
                class="font-display font-extrabold text-sm sm:text-base text-white tracking-tight truncate"
              >
                Compartir por WhatsApp
              </h3>
              <p class="text-[11px] sm:text-xs text-[#BFEBF2]/90 truncate">
                {{ isCotizacion ? 'Cotización' : 'Orden de Trabajo' }}
                <span class="font-mono font-bold text-white">{{ order.orderNumber }}</span>
                <span v-if="order.customer"> · {{ order.customer }}</span>
                <span v-if="vehicleSummary"> · {{ vehicleSummary }}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="emit('close')"
            class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
            title="Cerrar (Esc)"
            aria-label="Cerrar modal de WhatsApp"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-50/70 space-y-3.5">
          <!-- Envío de documento -->
          <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#0D1B3E] flex items-center gap-1.5">
                <FileText class="w-3.5 h-3.5 text-[#038391]" />
                <span>{{ supportsNativePdfShare ? 'Enviar Documento PDF' : 'Compartir por WhatsApp (wa.me)' }}</span>
              </span>
            </div>

            <p class="text-xs text-slate-500 leading-relaxed">
              <template v-if="supportsNativePdfShare">
                Puedes enviar el archivo <strong>PDF directamente</strong> desde tu dispositivo o abrir WhatsApp (<span class="font-mono font-semibold">wa.me</span>) con el detalle completo de la {{ isCotizacion ? 'cotización' : 'orden' }}.
              </template>
              <template v-else>
                Se abrirá WhatsApp (<span class="font-mono font-semibold">wa.me</span>) con el detalle completo de la {{ isCotizacion ? 'cotización' : 'orden' }} listo para elegir el contacto o grupo.
              </template>
            </p>

            <div v-if="supportsNativePdfShare" class="grid grid-cols-1 gap-2">
              <!-- Envío nativo de archivo PDF (Android / iOS / OS compatible) -->
              <button
                type="button"
                @click="handleNativeSharePdf"
                :disabled="isNativeSharingPdf"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Share2 class="w-3.5 h-3.5" :class="{ 'animate-pulse': isNativeSharingPdf }" />
                <span>{{ isNativeSharingPdf ? 'Preparando archivo...' : 'Enviar archivo PDF directo (App)' }}</span>
              </button>
            </div>

            <p v-if="pdfStatusMessage" class="text-[11px] font-semibold text-[#038391] leading-snug">
              {{ pdfStatusMessage }}
            </p>
            <p v-if="pdfError" class="text-[11px] font-semibold text-rose-600 leading-snug">
              {{ pdfError }}
            </p>
          </div>

          <!-- Aviso si la URL excede el límite recomendado para wa.me -->
          <div
            v-if="isUrlTooLong"
            class="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p class="text-[11px] leading-snug">
                El detalle completo es extenso para un enlace <span class="font-mono font-bold">wa.me</span> y podría recortarse. Usa <strong>Copiar y abrir chat</strong>.
              </p>
            </div>
            <button
              type="button"
              @click="handleCopyAndOpenEmptyChat"
              class="shrink-0 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition cursor-pointer"
            >
              Copiar y abrir chat
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-end gap-2 shrink-0"
        >
          <button
            type="button"
            @click="emit('close')"
            class="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            @click="handleOpenWhatsApp"
            :disabled="!generatedMessage.trim()"
            class="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            <WhatsAppIcon class="w-4 h-4" />
            <span>Abrir en WhatsApp (wa.me)</span>
            <ExternalLink class="w-3.5 h-3.5 opacity-85" />
          </button>
        </div>
      </div>

      <!-- Contenedor temporal oculto cuando se solicita PDF desde fuera de la vista previa -->
      <div
        v-if="renderOffscreenPdf && order"
        class="fixed top-0 left-0 w-[780px] bg-white pointer-events-none"
        style="z-index: -9999;"
        aria-hidden="true"
      >
        <div ref="offscreenContainerRef" class="bg-white">
          <WorkOrderDocument
            :order="order"
            :showSubtotals="effectiveShowSubtotals"
            variant="pdf"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
