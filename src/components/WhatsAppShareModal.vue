<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { Order } from '@/services/ordersService'
import { clientesService } from '@/services/clientesService'
import { useTallerStore } from '@/stores/taller'
import { exportOrderToPdf } from '@/utils/pdfExport'
import WorkOrderDocument from '@/components/WorkOrderDocument.vue'
import WhatsAppIcon from '@/components/WhatsAppIcon.vue'
import {
  COUNTRY_DIAL_OPTIONS,
  WA_ME_SAFE_URL_LIMIT,
  buildOrderWhatsAppMessage,
  buildWaMeUrl,
  formatWaPhonePreview,
  formatVehicleEngineLabel,
  isValidWaPhoneDigits,
  parsePhoneForWhatsApp,
  resolveWaPhoneDigits,
  type WhatsAppMessagePreset,
} from '@/utils/whatsappShare'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Phone,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    isOpen: boolean
    order: Order | null
    fallbackPhone?: string | null
    initialShowSubtotals?: boolean
    onDownloadPdf?: (() => Promise<void>) | null
  }>(),
  {
    fallbackPhone: null,
    initialShowSubtotals: undefined,
    onDownloadPdf: null,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'shared', payload: { order: Order; phoneDigits: string; preset: WhatsAppMessagePreset }): void
}>()

const tallerStore = useTallerStore()

// Estado del destinatario
const countryCode = ref('503')
const localPhoneInput = ref('')
const savedSourcePhone = ref('')
const phoneError = ref<string | null>(null)
const isResolvingClientPhone = ref(false)
let sessionCounter = 0

// Opciones de mensaje
const preset = ref<WhatsAppMessagePreset>('detailed')
const includeItemPrices = ref(true)
const includeBlockSubtotals = ref(true)
const includeStatus = ref(true)
const includeObservations = ref(true)
const includeTallerContact = ref(true)
const customNote = ref('')

// Editor de mensaje
const editableMessage = ref('')
const isManuallyEdited = ref(false)
const copied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

// Descarga de PDF opcional para adjuntar
const isDownloadingPdf = ref(false)
const pdfDownloaded = ref(false)
const pdfError = ref<string | null>(null)
const renderOffscreenPdf = ref(false)
const offscreenContainerRef = ref<HTMLElement | null>(null)

const isCotizacion = computed(() => props.order?.type === 'cotizacion')

const resolvedPhoneDigits = computed(() =>
  resolveWaPhoneDigits(countryCode.value, localPhoneInput.value)
)

const hasPhoneInput = computed(() => localPhoneInput.value.trim().length > 0)

const isPhoneValid = computed(() => {
  if (!hasPhoneInput.value) return true
  return isValidWaPhoneDigits(resolvedPhoneDigits.value)
})

const phonePreviewLabel = computed(() => {
  if (!resolvedPhoneDigits.value) {
    return 'Elegir contacto directamente en WhatsApp'
  }
  return formatWaPhonePreview(resolvedPhoneDigits.value)
})

const waUrl = computed(() =>
  buildWaMeUrl(resolvedPhoneDigits.value, editableMessage.value)
)

const isUrlTooLong = computed(() => waUrl.value.length > WA_ME_SAFE_URL_LIMIT)

const vehicleSummary = computed(() =>
  props.order ? formatVehicleEngineLabel(props.order) : ''
)

const regenerateMessage = (force = false) => {
  if (!props.order) {
    editableMessage.value = ''
    return
  }
  if (isManuallyEdited.value && !force) return
  editableMessage.value = buildOrderWhatsAppMessage(
    props.order,
    tallerStore.tallerInfo,
    {
      preset: preset.value,
      includeItemPrices: includeItemPrices.value,
      includeBlockSubtotals: includeBlockSubtotals.value,
      includeStatus: includeStatus.value,
      includeObservations: includeObservations.value,
      includeTallerContact: includeTallerContact.value,
      customNote: customNote.value,
    }
  )
}

const applyRawPhone = (rawPhone?: string | null) => {
  const clean = (rawPhone || '').trim()
  savedSourcePhone.value = clean
  const parsed = parsePhoneForWhatsApp(clean, '503')
  countryCode.value = parsed.countryCode
  localPhoneInput.value = parsed.localNumber
  phoneError.value = null
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
    isManuallyEdited.value = false
    copied.value = false
    pdfDownloaded.value = false
    pdfError.value = null
    phoneError.value = null
    customNote.value = ''
    preset.value = 'detailed'
    includeItemPrices.value = true
    includeBlockSubtotals.value =
      typeof props.initialShowSubtotals === 'boolean'
        ? props.initialShowSubtotals
        : typeof props.order.showSubtotals === 'boolean'
          ? props.order.showSubtotals
          : true
    includeStatus.value = props.order.type !== 'cotizacion'
    includeObservations.value = Boolean(props.order.observations?.trim())
    includeTallerContact.value = true

    const initialPhone = props.order.customerPhone || props.fallbackPhone || ''
    applyRawPhone(initialPhone)

    await tallerStore.loadTallerInfo()
    if (currentSession !== sessionCounter) return
    regenerateMessage(true)

    // Si la orden no trae teléfono, buscarlo en el registro del cliente si existe vínculo
    const lookupKey = props.order.customerId || props.order.customerCode
    if (!initialPhone.trim() && lookupKey) {
      isResolvingClientPhone.value = true
      try {
        const client = await clientesService.getClienteById(lookupKey)
        if (
          currentSession === sessionCounter &&
          client?.telefono &&
          !localPhoneInput.value.trim()
        ) {
          applyRawPhone(client.telefono)
        }
      } catch {
        // Ignorar fallo de búsqueda silenciosa
      } finally {
        if (currentSession === sessionCounter) {
          isResolvingClientPhone.value = false
        }
      }
    }
  },
  { immediate: true }
)

watch(
  [
    preset,
    includeItemPrices,
    includeBlockSubtotals,
    includeStatus,
    includeObservations,
    includeTallerContact,
    customNote,
  ],
  () => {
    if (!props.isOpen || !props.order) return
    isManuallyEdited.value = false
    regenerateMessage(true)
  }
)

watch(localPhoneInput, () => {
  if (phoneError.value && isPhoneValid.value) {
    phoneError.value = null
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown, true)
  }
  if (copyTimeout) clearTimeout(copyTimeout)
})

const selectPreset = (nextPreset: WhatsAppMessagePreset) => {
  preset.value = nextPreset
}

const handleManualTextInput = () => {
  isManuallyEdited.value = true
}

const handleResetMessage = () => {
  isManuallyEdited.value = false
  regenerateMessage(true)
}

const clearPhoneForContactPicker = () => {
  localPhoneInput.value = ''
  phoneError.value = null
}

const restoreSavedPhone = () => {
  if (savedSourcePhone.value) {
    applyRawPhone(savedSourcePhone.value)
  }
}

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

const handleCopyMessage = async () => {
  const ok = await copyTextToClipboard(editableMessage.value)
  if (ok) {
    copied.value = true
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copied.value = false
    }, 2500)
  }
}

const validateRecipientPhone = (): boolean => {
  if (hasPhoneInput.value && !isPhoneValid.value) {
    phoneError.value =
      'Ingresa un número válido (mínimo 8 dígitos) o límpialo para elegir el contacto en WhatsApp.'
    return false
  }
  phoneError.value = null
  return true
}

const handleOpenWhatsApp = () => {
  if (!props.order) return
  if (!validateRecipientPhone()) return
  if (!editableMessage.value.trim()) return

  window.open(waUrl.value, '_blank', 'noopener,noreferrer')
  emit('shared', {
    order: props.order,
    phoneDigits: resolvedPhoneDigits.value,
    preset: preset.value,
  })
}

const handleCopyAndOpenEmptyChat = async () => {
  if (!props.order) return
  if (!validateRecipientPhone()) return

  await handleCopyMessage()
  const emptyChatUrl = buildWaMeUrl(resolvedPhoneDigits.value, '')
  window.open(emptyChatUrl, '_blank', 'noopener,noreferrer')
  emit('shared', {
    order: props.order,
    phoneDigits: resolvedPhoneDigits.value,
    preset: preset.value,
  })
}

const handleDownloadAttachmentPdf = async () => {
  if (!props.order || isDownloadingPdf.value) return
  isDownloadingPdf.value = true
  pdfError.value = null

  try {
    if (props.onDownloadPdf) {
      await props.onDownloadPdf()
    } else {
      await tallerStore.loadTallerInfo()
      renderOffscreenPdf.value = true
      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 80))

      const container = offscreenContainerRef.value
      const docEl =
        (container?.querySelector('#printable-work-order') as HTMLElement | null) ||
        container
      if (!docEl) {
        throw new Error('No se pudo preparar el documento PDF.')
      }
      await exportOrderToPdf(docEl, props.order)
    }
    pdfDownloaded.value = true
  } catch (err) {
    console.error('[WhatsAppShareModal] Error generando PDF:', err)
    pdfError.value = 'No se pudo generar el PDF. Inténtalo desde la vista previa.'
  } finally {
    renderOffscreenPdf.value = false
    isDownloadingPdf.value = false
  }
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
        class="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 popover-pop-in my-auto"
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
                Compartir por WhatsApp Business
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
        <div class="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-50/70">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <!-- Columna Izquierda: Destinatario, Plantilla y PDF -->
            <div class="md:col-span-5 space-y-3.5">
              <!-- Destinatario -->
              <div class="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5 shadow-sm">
                <div class="flex items-center justify-between gap-2">
                  <label class="text-[11px] font-bold uppercase tracking-wider text-[#0D1B3E] flex items-center gap-1.5">
                    <Phone class="w-3.5 h-3.5 text-[#25D366]" />
                    <span>Destinatario (wa.me)</span>
                  </label>
                  <span
                    v-if="isResolvingClientPhone"
                    class="text-[10px] font-medium text-slate-400"
                  >
                    Buscando tel...
                  </span>
                </div>

                <div class="flex gap-1.5">
                  <select
                    v-model="countryCode"
                    aria-label="Código de país"
                    class="w-32 shrink-0 px-2 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-[#0D1B3E] focus:outline-none focus:bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 cursor-pointer"
                  >
                    <option
                      v-for="opt in COUNTRY_DIAL_OPTIONS"
                      :key="opt.code || 'custom'"
                      :value="opt.code"
                    >
                      {{ opt.label }}
                    </option>
                  </select>

                  <input
                    v-model="localPhoneInput"
                    type="tel"
                    inputmode="tel"
                    placeholder="Ej. 7831-2641"
                    class="flex-1 min-w-0 px-3 py-2 text-xs font-mono font-semibold bg-slate-50 border rounded-xl text-[#0D1B3E] placeholder-slate-400 focus:outline-none focus:bg-white transition"
                    :class="
                      phoneError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                        : 'border-slate-200 focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20'
                    "
                  />
                </div>

                <p v-if="phoneError" class="text-[11px] font-semibold text-rose-600">
                  {{ phoneError }}
                </p>

                <!-- Preview de enlace wa.me y acciones rápidas de teléfono -->
                <div class="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                  <span
                    class="inline-flex items-center gap-1 text-[10.5px] font-mono px-2 py-0.5 rounded-lg border"
                    :class="
                      resolvedPhoneDigits
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                        : 'bg-sky-50 text-[#004B97] border-sky-200 font-semibold'
                    "
                  >
                    <UserCheck v-if="resolvedPhoneDigits" class="w-3 h-3 text-[#25D366]" />
                    <span>{{ resolvedPhoneDigits ? `wa.me/${resolvedPhoneDigits}` : 'wa.me/ (Elegir chat)' }}</span>
                  </span>

                  <button
                    v-if="hasPhoneInput"
                    type="button"
                    @click="clearPhoneForContactPicker"
                    class="text-[10.5px] font-semibold text-slate-500 hover:text-[#004B97] underline cursor-pointer"
                  >
                    Elegir contacto en app
                  </button>
                  <button
                    v-else-if="savedSourcePhone"
                    type="button"
                    @click="restoreSavedPhone"
                    class="text-[10.5px] font-semibold text-[#004B97] hover:underline cursor-pointer"
                  >
                    Usar tel. cliente ({{ savedSourcePhone }})
                  </button>
                </div>

                <p class="text-[10.5px] text-slate-500 leading-snug">
                  {{ phonePreviewLabel }}. Al abrir <span class="font-mono font-semibold">wa.me</span> podrás usar WhatsApp Business o tu app instalada.
                </p>
              </div>

              <!-- Plantilla de Mensaje -->
              <div class="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5 shadow-sm">
                <div class="text-[11px] font-bold uppercase tracking-wider text-[#0D1B3E]">
                  Formato del Mensaje
                </div>

                <div class="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    @click="selectPreset('detailed')"
                    class="px-3 py-2 rounded-xl border text-left transition cursor-pointer"
                    :class="
                      preset === 'detailed'
                        ? 'bg-emerald-50/80 border-[#25D366] text-[#0D1B3E] shadow-sm'
                        : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white'
                    "
                  >
                    <div class="text-xs font-bold flex items-center justify-between">
                      <span>Detalle Completo</span>
                      <span
                        v-if="preset === 'detailed'"
                        class="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                      >
                        Activo
                      </span>
                    </div>
                    <p class="text-[10.5px] text-slate-500 mt-0.5">
                      Bloques mecánicos, operaciones, medidas y total.
                    </p>
                  </button>

                  <button
                    type="button"
                    @click="selectPreset('executive')"
                    class="px-3 py-2 rounded-xl border text-left transition cursor-pointer"
                    :class="
                      preset === 'executive'
                        ? 'bg-emerald-50/80 border-[#25D366] text-[#0D1B3E] shadow-sm'
                        : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white'
                    "
                  >
                    <div class="text-xs font-bold flex items-center justify-between">
                      <span>Resumen Ejecutivo</span>
                      <span
                        v-if="preset === 'executive'"
                        class="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                      >
                        Activo
                      </span>
                    </div>
                    <p class="text-[10.5px] text-slate-500 mt-0.5">
                      Datos del motor, áreas trabajadas y total neto.
                    </p>
                  </button>

                  <button
                    type="button"
                    @click="selectPreset('pdf_companion')"
                    class="px-3 py-2 rounded-xl border text-left transition cursor-pointer"
                    :class="
                      preset === 'pdf_companion'
                        ? 'bg-emerald-50/80 border-[#25D366] text-[#0D1B3E] shadow-sm'
                        : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white'
                    "
                  >
                    <div class="text-xs font-bold flex items-center justify-between">
                      <span>Saludo para Adjuntar PDF</span>
                      <span
                        v-if="preset === 'pdf_companion'"
                        class="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded"
                      >
                        Activo
                      </span>
                    </div>
                    <p class="text-[10.5px] text-slate-500 mt-0.5">
                      Mensaje corto ideal al adjuntar el documento PDF.
                    </p>
                  </button>
                </div>

                <!-- Opciones granulares -->
                <div class="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
                  <label
                    v-if="preset === 'detailed'"
                    class="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <input
                      v-model="includeItemPrices"
                      type="checkbox"
                      class="w-3.5 h-3.5 accent-[#004B97] rounded cursor-pointer"
                    />
                    <span>Incluir precios por ítem</span>
                  </label>

                  <label
                    v-if="preset === 'detailed' && includeItemPrices"
                    class="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <input
                      v-model="includeBlockSubtotals"
                      type="checkbox"
                      class="w-3.5 h-3.5 accent-[#004B97] rounded cursor-pointer"
                    />
                    <span>Incluir subtotales por bloque</span>
                  </label>

                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      v-model="includeStatus"
                      type="checkbox"
                      class="w-3.5 h-3.5 accent-[#004B97] rounded cursor-pointer"
                    />
                    <span>Incluir estado ({{ order.status }})</span>
                  </label>

                  <label
                    v-if="order.observations?.trim()"
                    class="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <input
                      v-model="includeObservations"
                      type="checkbox"
                      class="w-3.5 h-3.5 accent-[#004B97] rounded cursor-pointer"
                    />
                    <span>Incluir observaciones</span>
                  </label>

                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      v-model="includeTallerContact"
                      type="checkbox"
                      class="w-3.5 h-3.5 accent-[#004B97] rounded cursor-pointer"
                    />
                    <span>Incluir teléfonos del taller</span>
                  </label>

                  <div class="pt-1.5">
                    <label class="block text-[10.5px] font-semibold text-slate-500 mb-1">
                      Nota adicional rápida (opcional):
                    </label>
                    <input
                      v-model="customNote"
                      type="text"
                      placeholder="Ej. Listo para entregar antes de las 5:00 p.m."
                      class="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0D1B3E] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#04C4D9]"
                    />
                  </div>
                </div>
              </div>

              <!-- Opción de PDF para adjuntar en WhatsApp Business -->
              <div class="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2 shadow-sm">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-[#0D1B3E] flex items-center gap-1.5">
                    <FileText class="w-3.5 h-3.5 text-[#038391]" />
                    <span>Adjuntar PDF (Opcional)</span>
                  </span>
                </div>
                <p class="text-[10.5px] text-slate-500 leading-snug">
                  Los enlaces <span class="font-mono">wa.me</span> envían texto directo. Si deseas enviar también la hoja formal, descarga el PDF y arrástralo al chat.
                </p>
                <button
                  type="button"
                  @click="handleDownloadAttachmentPdf"
                  :disabled="isDownloadingPdf"
                  class="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50"
                  :class="
                    pdfDownloaded
                      ? 'bg-cyan-50 text-[#038391] border-cyan-300'
                      : 'bg-slate-50 hover:bg-blue-50 text-[#004B97] border-slate-200 hover:border-blue-300'
                  "
                >
                  <Check v-if="pdfDownloaded && !isDownloadingPdf" class="w-3.5 h-3.5" />
                  <Download v-else class="w-3.5 h-3.5" :class="{ 'animate-bounce': isDownloadingPdf }" />
                  <span>
                    {{
                      isDownloadingPdf
                        ? 'Generando PDF...'
                        : pdfDownloaded
                          ? 'PDF descargado — listo para adjuntar'
                          : `Descargar ${isCotizacion ? 'Cotización' : 'Orden'} PDF`
                    }}
                  </span>
                </button>
                <p v-if="pdfError" class="text-[10.5px] font-semibold text-rose-600">
                  {{ pdfError }}
                </p>
              </div>
            </div>

            <!-- Columna Derecha: Vista Previa Editable y Envío -->
            <div class="md:col-span-7 flex flex-col gap-3">
              <div class="bg-white rounded-2xl border border-slate-200 p-3.5 flex-1 flex flex-col gap-2 shadow-sm">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-[#0D1B3E]">
                      Vista Previa del Mensaje (Editable)
                    </span>
                    <span
                      v-if="isManuallyEdited"
                      class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                    >
                      Editado
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      v-if="isManuallyEdited"
                      type="button"
                      @click="handleResetMessage"
                      class="inline-flex items-center gap-1 text-[11px] font-bold text-[#004B97] hover:underline cursor-pointer"
                      title="Volver a generar el texto automático"
                    >
                      <RotateCcw class="w-3 h-3" />
                      <span>Restablecer</span>
                    </button>
                    <span class="font-mono text-[10px] text-slate-400">
                      {{ editableMessage.length }} car.
                    </span>
                  </div>
                </div>

                <textarea
                  v-model="editableMessage"
                  @input="handleManualTextInput"
                  rows="16"
                  aria-label="Mensaje a enviar por WhatsApp"
                  class="w-full flex-1 min-h-[340px] p-3 text-xs leading-relaxed text-slate-800 bg-[#F4FBF6]/60 border border-emerald-200/80 rounded-xl focus:outline-none focus:bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 resize-y font-sans"
                ></textarea>
              </div>

              <!-- Aviso si la URL excede el límite recomendado para wa.me -->
              <div
                v-if="isUrlTooLong"
                class="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div class="flex items-start gap-2">
                  <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p class="text-[11px] leading-snug">
                    El detalle es extenso para la URL de <span class="font-mono font-bold">wa.me</span> y podría recortarse en algunos navegadores. Usa <strong>Resumen Ejecutivo</strong> o copia el texto y pégalo en el chat.
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
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0"
        >
          <button
            type="button"
            @click="handleCopyMessage"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-[0.98]"
            :class="
              copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            "
          >
            <Check v-if="copied" class="w-3.5 h-3.5" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copied ? '¡Mensaje copiado!' : 'Copiar mensaje' }}</span>
          </button>

          <div class="flex items-center gap-2 ml-auto">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              @click="handleOpenWhatsApp"
              :disabled="!editableMessage.trim()"
              class="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <WhatsAppIcon class="w-4 h-4" />
              <span>Abrir en WhatsApp (wa.me)</span>
              <ExternalLink class="w-3.5 h-3.5 opacity-85" />
            </button>
          </div>
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
            :showSubtotals="includeBlockSubtotals"
            variant="pdf"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
