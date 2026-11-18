<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { Order } from '@/services/ordersService'
import { uploadOrderPdf } from '@/services/storageService'
import { useTallerStore } from '@/stores/taller'
import {
  downloadPdfBlob,
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
  Check,
  CloudUpload,
  Download,
  ExternalLink,
  FileText,
  Link2,
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

// Estado de PDF (generación en memoria, subida para enlace en wa.me y envío directo)
const cachedPdf = ref<GeneratedOrderPdf | null>(null)
const uploadedPdfUrl = ref('')
const isUploadingPdf = ref(false)
const isDownloadingPdf = ref(false)
const isNativeSharingPdf = ref(false)
const isComboSending = ref(false)
const pdfDownloaded = ref(false)
const pdfStatusMessage = ref<string | null>(null)
const pdfError = ref<string | null>(null)
const popupBlockedUrl = ref<string | null>(null)
const renderOffscreenPdf = ref(false)
const offscreenContainerRef = ref<HTMLElement | null>(null)

const supportsNativePdfShare = computed(() => canNativeSharePdfFiles())
const isCotizacion = computed(() => props.order?.type === 'cotizacion')
const isPdfBusy = computed(
  () => isUploadingPdf.value || isDownloadingPdf.value || isNativeSharingPdf.value || isComboSending.value
)

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
      pdfUrl: uploadedPdfUrl.value || undefined,
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
    uploadedPdfUrl.value = ''
    pdfDownloaded.value = false
    pdfStatusMessage.value = null
    pdfError.value = null
    popupBlockedUrl.value = null

    await tallerStore.loadTallerInfo()
    if (currentSession !== sessionCounter) return
    buildMessage()
  },
  { immediate: true }
)

watch(uploadedPdfUrl, () => {
  if (!props.isOpen || !props.order) return
  buildMessage()
})

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
 * Genera el PDF, lo sube a Supabase Storage e incluye el enlace público directo en el mensaje wa.me.
 */
const handleAttachPdfLink = async (): Promise<boolean> => {
  if (!props.order || isPdfBusy.value) return false
  isUploadingPdf.value = true
  pdfError.value = null
  pdfStatusMessage.value = null

  try {
    const generated = await obtainOrderPdfFile()
    const uploadRes = await uploadOrderPdf(generated.file, {
      id: props.order.id,
      orderNumber: props.order.orderNumber,
      type: props.order.type,
    })

    if (uploadRes.isRemote && uploadRes.url) {
      uploadedPdfUrl.value = uploadRes.url
      pdfStatusMessage.value = 'Enlace del PDF agregado al mensaje de WhatsApp.'
      return true
    }

    pdfError.value =
      'El bucket "ordenes-pdf" aún no está habilitado en Supabase Storage. Usa "Enviar con PDF + wa.me" para descargarlo y adjuntarlo.'
    return false
  } catch (err) {
    console.error('[WhatsAppShareModal] Error subiendo PDF para wa.me:', err)
    pdfError.value = 'No se pudo generar o subir el PDF en este momento.'
    return false
  } finally {
    isUploadingPdf.value = false
  }
}

const handleRemovePdfLink = () => {
  uploadedPdfUrl.value = ''
  pdfStatusMessage.value = null
}

/**
 * Envía el archivo PDF real mediante la hoja nativa del dispositivo (Android/iOS/OS compatible).
 */
const handleNativeSharePdf = async () => {
  if (!props.order || isPdfBusy.value || !supportsNativePdfShare.value) return
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
      pdfError.value = 'Tu navegador no completó el envío directo del archivo. Usa "Enviar con PDF + wa.me".'
    }
  } finally {
    isNativeSharingPdf.value = false
  }
}

const handleDownloadOnlyPdf = async () => {
  if (!props.order || isPdfBusy.value) return
  isDownloadingPdf.value = true
  pdfError.value = null

  try {
    const generated = await obtainOrderPdfFile()
    downloadPdfBlob(generated.blob, generated.filename)
    pdfDownloaded.value = true
    pdfStatusMessage.value = 'PDF descargado. Arrástralo o adjúntalo dentro del chat de WhatsApp.'
  } catch (err) {
    console.error('[WhatsAppShareModal] Error descargando PDF:', err)
    pdfError.value = 'No se pudo generar el PDF. Inténtalo desde la vista previa.'
  } finally {
    isDownloadingPdf.value = false
  }
}

/**
 * Flujo de 1 clic para enviar con PDF:
 * intenta subir el PDF para incluir su enlace en wa.me; si el bucket no está disponible,
 * descarga el PDF localmente y abre wa.me para elegir el chat.
 */
const handleSendWithPdfAndWaMe = async () => {
  if (!props.order || isPdfBusy.value) return
  if (!generatedMessage.value.trim()) return

  isComboSending.value = true
  pdfError.value = null
  pdfStatusMessage.value = null
  popupBlockedUrl.value = null

  try {
    const generated = await obtainOrderPdfFile()

    if (!uploadedPdfUrl.value) {
      const uploadRes = await uploadOrderPdf(generated.file, {
        id: props.order.id,
        orderNumber: props.order.orderNumber,
        type: props.order.type,
      })

      if (uploadRes.isRemote && uploadRes.url) {
        uploadedPdfUrl.value = uploadRes.url
        await nextTick()
        pdfStatusMessage.value = 'PDF subido a la nube e incluido como enlace directo en wa.me.'
      } else {
        downloadPdfBlob(generated.blob, generated.filename)
        pdfDownloaded.value = true
        pdfStatusMessage.value =
          'PDF descargado en tu equipo. Arrástralo al chat de WhatsApp que se abrió.'
      }
    }

    const targetUrl = waUrl.value
    const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer')
    if (!opened) {
      popupBlockedUrl.value = targetUrl
    }

    emit('shared', {
      order: props.order,
      preset: DEFAULT_PRESET,
    })
  } catch (err) {
    console.error('[WhatsAppShareModal] Error en flujo PDF + wa.me:', err)
    pdfError.value = 'No se pudo preparar el PDF para WhatsApp.'
  } finally {
    isComboSending.value = false
  }
}

const handleOpenWhatsApp = () => {
  if (!props.order) return
  if (!generatedMessage.value.trim()) return

  popupBlockedUrl.value = null
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
          <!-- Envío con PDF -->
          <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#0D1B3E] flex items-center gap-1.5">
                <FileText class="w-3.5 h-3.5 text-[#038391]" />
                <span>Enviar Documento PDF</span>
              </span>
              <span
                v-if="uploadedPdfUrl"
                class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
              >
                <Check class="w-3 h-3" />
                Enlace listo
              </span>
            </div>

            <p class="text-xs text-slate-500 leading-relaxed">
              Por seguridad, <span class="font-mono font-semibold">wa.me</span> solo envía texto. Puedes <strong>subir el PDF para incluir su enlace directo en wa.me</strong>{{ supportsNativePdfShare ? ', enviar el archivo PDF directo desde tu dispositivo' : '' }} o descargarlo al instante.
            </p>

            <!-- Estado si ya hay enlace de PDF en el mensaje -->
            <div
              v-if="uploadedPdfUrl"
              class="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-900 space-y-1.5"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold flex items-center gap-1">
                  <Link2 class="w-3.5 h-3.5 text-[#25D366]" />
                  Enlace PDF incluido en el mensaje
                </span>
                <button
                  type="button"
                  @click="handleRemovePdfLink"
                  class="text-[10.5px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Quitar
                </button>
              </div>
              <a
                :href="uploadedPdfUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="block font-mono text-[10px] text-[#004B97] truncate hover:underline"
              >
                {{ uploadedPdfUrl }}
              </a>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <!-- Subir PDF a la nube e insertar link en wa.me -->
              <button
                v-if="!uploadedPdfUrl"
                type="button"
                @click="handleAttachPdfLink"
                :disabled="isPdfBusy"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-[#004B97] hover:bg-[#0D1B3E] text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <CloudUpload class="w-3.5 h-3.5" :class="{ 'animate-pulse': isUploadingPdf }" />
                <span>{{ isUploadingPdf ? 'Subiendo PDF a la nube...' : 'Agregar enlace PDF al mensaje wa.me' }}</span>
              </button>

              <!-- Envío nativo de archivo PDF (Android / iOS / OS compatible) -->
              <button
                v-if="supportsNativePdfShare"
                type="button"
                @click="handleNativeSharePdf"
                :disabled="isPdfBusy"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Share2 class="w-3.5 h-3.5" :class="{ 'animate-pulse': isNativeSharingPdf }" />
                <span>{{ isNativeSharingPdf ? 'Preparando archivo...' : 'Enviar archivo PDF directo (App)' }}</span>
              </button>

              <!-- Descarga rápida local -->
              <button
                type="button"
                @click="handleDownloadOnlyPdf"
                :disabled="isPdfBusy"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer disabled:opacity-50"
                :class="[
                  pdfDownloaded
                    ? 'bg-cyan-50 text-[#038391] border-cyan-300'
                    : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#004B97] border-slate-200 hover:border-blue-300',
                  uploadedPdfUrl && !supportsNativePdfShare ? 'sm:col-span-2' : ''
                ]"
              >
                <Check v-if="pdfDownloaded && !isDownloadingPdf" class="w-3.5 h-3.5" />
                <Download v-else class="w-3.5 h-3.5" :class="{ 'animate-bounce': isDownloadingPdf }" />
                <span>
                  {{
                    isDownloadingPdf
                      ? 'Generando PDF...'
                      : pdfDownloaded
                        ? 'PDF descargado ✓'
                        : `Solo descargar ${isCotizacion ? 'Cotización' : 'Orden'} PDF`
                  }}
                </span>
              </button>
            </div>

            <p v-if="pdfStatusMessage" class="text-[11px] font-semibold text-[#038391] leading-snug">
              {{ pdfStatusMessage }}
            </p>
            <p v-if="pdfError" class="text-[11px] font-semibold text-rose-600 leading-snug">
              {{ pdfError }}
            </p>
          </div>

          <!-- Respaldo si el navegador bloqueó ventana emergente tras generar PDF -->
          <div
            v-if="popupBlockedUrl"
            class="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <span class="text-[11px] font-semibold leading-snug">
              El PDF ya está listo, pero el navegador bloqueó la pestaña automática. Haz clic para abrir WhatsApp:
            </span>
            <a
              :href="popupBlockedUrl"
              target="_blank"
              rel="noopener noreferrer"
              @click="popupBlockedUrl = null"
              class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-[11px] font-bold transition"
            >
              <WhatsAppIcon class="w-3.5 h-3.5" />
              <span>Abrir WhatsApp ahora</span>
            </a>
          </div>

          <!-- Aviso si la URL excede el límite recomendado para wa.me -->
          <div
            v-if="isUrlTooLong"
            class="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p class="text-[11px] leading-snug">
                El detalle completo es extenso para un enlace <span class="font-mono font-bold">wa.me</span> y podría recortarse. Usa <strong>Copiar y abrir chat</strong> o envíalo mediante PDF.
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
            @click="handleSendWithPdfAndWaMe"
            :disabled="isPdfBusy || !generatedMessage.trim()"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#004B97] hover:bg-[#0D1B3E] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Genera el PDF (lo enlaza en la nube o lo descarga) y abre wa.me en un clic"
          >
            <FileText class="w-3.5 h-3.5 text-[#BFEBF2]" :class="{ 'animate-pulse': isComboSending }" />
            <span>{{ isComboSending ? 'Preparando PDF...' : 'Enviar con PDF + wa.me' }}</span>
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
