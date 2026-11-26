<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { Order } from '@/services/ordersService'
import { useTallerStore } from '@/stores/taller'
import { generateOrderPdfFile } from '@/utils/pdfExport'
import {
  buildOrderWhatsAppMessage,
  canNativeSharePdfFiles,
} from '@/utils/whatsappShare'
import WorkOrderDocument from '@/components/WorkOrderDocument.vue'

export type DirectSharePdfResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string }

const tallerStore = useTallerStore()

const sharingOrderId = ref<string | null>(null)
const offscreenOrder = ref<Order | null>(null)
const offscreenShowSubtotals = ref<boolean>(true)
const offscreenContainerRef = ref<HTMLElement | null>(null)
const offscreenDocRef = ref<InstanceType<typeof WorkOrderDocument> | null>(null)

interface PendingNativeShare {
  file: File
  blob: Blob
  filename: string
  title: string
  text: string
  phone: string
}

const pendingShare = ref<PendingNativeShare | null>(null)
let pendingShareResolver: ((res: DirectSharePdfResult) => void) | null = null

const resolvePendingShare = (result: DirectSharePdfResult) => {
  pendingShare.value = null
  const resolver = pendingShareResolver
  pendingShareResolver = null
  if (resolver) resolver(result)
}

const handleConfirmPendingNativeShare = async () => {
  const payload = pendingShare.value
  if (!payload) return
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(payload.text).catch(() => undefined)
    }
    // Llamada síncrona dentro del toque del usuario (0 ms) para garantizar PDF + texto juntos
    await navigator.share({
      title: payload.title,
      text: payload.text,
      files: [payload.file],
    })
    resolvePendingShare({ status: 'shared' })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') {
      resolvePendingShare({ status: 'cancelled' })
      return
    }
    try {
      await navigator.share({
        files: [payload.file],
      })
      resolvePendingShare({ status: 'shared' })
    } catch (secondErr: unknown) {
      if (secondErr && typeof secondErr === 'object' && 'name' in secondErr && (secondErr as { name?: string }).name === 'AbortError') {
        resolvePendingShare({ status: 'cancelled' })
        return
      }
      handleFallbackDownloadAndWhatsApp()
    }
  }
}

const handleFallbackDownloadAndWhatsApp = () => {
  const payload = pendingShare.value
  if (!payload) return
  const blobUrl = URL.createObjectURL(payload.blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = payload.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 15000)

  const digits = payload.phone.replace(/\D/g, '')
  const waUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(payload.text)}`
    : `https://wa.me/?text=${encodeURIComponent(payload.text)}`
  window.open(waUrl, '_blank', 'noopener,noreferrer')
  resolvePendingShare({ status: 'shared' })
}

const shareOrder = async (
  order: Order,
  options?: { sourceElement?: HTMLElement | null; showSubtotals?: boolean }
): Promise<DirectSharePdfResult> => {
  if (sharingOrderId.value) {
    return { status: 'cancelled' }
  }

  if (!canNativeSharePdfFiles()) {
    return {
      status: 'unsupported',
      message:
        'Tu navegador actual no soporta el envío directo de archivos PDF. Abre el sistema desde tu teléfono o un navegador compatible (Chrome, Edge o Safari).',
    }
  }

  const showSubtotals =
    typeof options?.showSubtotals === 'boolean'
      ? options.showSubtotals
      : typeof order.showSubtotals === 'boolean'
        ? order.showSubtotals
        : true

  const orderToShare: Order = { ...order, showSubtotals }
  sharingOrderId.value = order.id

  try {
    if (!tallerStore.tallerInfo?.nombre) {
      await tallerStore.loadTallerInfo()
    }

    let targetElement = options?.sourceElement || null
    if (!targetElement) {
      offscreenShowSubtotals.value = showSubtotals
      offscreenOrder.value = orderToShare
      await nextTick()
      await offscreenDocRef.value?.evaluateAutoLayout()
      await nextTick()

      const container = offscreenContainerRef.value
      targetElement =
        (container?.querySelector('#printable-work-order') as HTMLElement | null) ||
        container
    }

    if (!targetElement) {
      return {
        status: 'error',
        message: 'No se pudo preparar el documento PDF para compartir.',
      }
    }

    const generated = await generateOrderPdfFile(targetElement, orderToShare)
    const docTitle = order.type === 'cotizacion' ? 'Cotización' : 'Orden de Trabajo'
    const text = buildOrderWhatsAppMessage(orderToShare, tallerStore.tallerInfo, {
      preset: 'detailed',
      includeItemPrices: true,
      includeBlockSubtotals: showSubtotals,
      includeStatus: order.type !== 'cotizacion',
      includeObservations: Boolean(order.observations?.trim()),
      includeTallerContact: true,
    })

    // Copiar mensaje al portapapeles como respaldo (WhatsApp móvil a veces omite el texto al adjuntar PDF)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => undefined)
    }

    // Intentar compartir nativamente (con texto + archivo)
    try {
      await navigator.share({
        title: `${docTitle} ${order.orderNumber}`,
        text,
        files: [generated.file],
      })
      return { status: 'shared' }
    } catch (shareErr: unknown) {
      if (
        shareErr &&
        typeof shareErr === 'object' &&
        'name' in shareErr &&
        (shareErr as { name?: string }).name === 'AbortError'
      ) {
        return { status: 'cancelled' }
      }

      // En móvil, si generar el PDF tardó >1s, el gesto de usuario expira (NotAllowedError).
      // Mostramos un botón de 1 toque con el PDF ya generado en memoria para que navigator.share
      // se ejecute en 0ms y envíe PDF + texto juntos a WhatsApp (sin caer a texto solo).
      return await new Promise<DirectSharePdfResult>((resolve) => {
        pendingShareResolver = resolve
        pendingShare.value = {
          file: generated.file,
          blob: generated.blob,
          filename: generated.filename,
          title: `${docTitle} ${order.orderNumber}`,
          text,
          phone: order.customerPhone || '',
        }
      })
    }
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name?: string }).name === 'AbortError'
    ) {
      return { status: 'cancelled' }
    }
    console.error('[DirectOrderPdfShare] Error al compartir archivo PDF directo:', err)
    return {
      status: 'error',
      message: 'Tu navegador no completó el envío directo del archivo PDF.',
    }
  } finally {
    offscreenOrder.value = null
    sharingOrderId.value = null
  }
}

defineExpose({
  shareOrder,
  sharingOrderId,
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="offscreenOrder"
      class="fixed top-0 left-0 w-[780px] bg-white pointer-events-none print:hidden"
      style="z-index: -9999;"
      aria-hidden="true"
    >
      <div ref="offscreenContainerRef" class="bg-white">
        <WorkOrderDocument
          ref="offscreenDocRef"
          :order="offscreenOrder"
          :showSubtotals="offscreenShowSubtotals"
          variant="pdf"
        />
      </div>
    </div>

    <!-- Confirmación de 1 toque cuando el PDF ya está listo en memoria (garantiza PDF + texto en móvil) -->
    <div
      v-if="pendingShare"
      class="fixed inset-0 z-[120] bg-[#09132B]/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
      @click.self="resolvePendingShare({ status: 'cancelled' })"
    >
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden">
        <div class="px-5 py-4 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white">
          <h3 class="font-display font-extrabold text-sm text-white">PDF listo para enviar</h3>
          <p class="text-[11px] text-sky-100/85 mt-0.5 truncate">{{ pendingShare.filename }}</p>
        </div>
        <div class="p-5 space-y-3">
          <p class="text-xs text-slate-600 leading-relaxed">
            Toca el botón verde para compartir el <strong>archivo PDF junto con el mensaje</strong> directamente en WhatsApp.
          </p>
          <button
            type="button"
            @click="handleConfirmPendingNativeShare"
            class="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-extrabold shadow-sm transition cursor-pointer"
          >
            Enviar PDF + Mensaje por WhatsApp
          </button>
          <button
            type="button"
            @click="handleFallbackDownloadAndWhatsApp"
            class="w-full py-2 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            Descargar PDF y abrir WhatsApp
          </button>
          <button
            type="button"
            @click="resolvePendingShare({ status: 'cancelled' })"
            class="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
