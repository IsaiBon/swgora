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
    await tallerStore.loadTallerInfo()

    let targetElement = options?.sourceElement || null
    if (!targetElement) {
      offscreenShowSubtotals.value = showSubtotals
      offscreenOrder.value = orderToShare
      await nextTick()
      await offscreenDocRef.value?.evaluateAutoLayout()
      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 60))

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

    await navigator.share({
      title: `${docTitle} ${order.orderNumber}`,
      text,
      files: [generated.file],
    })

    return { status: 'shared' }
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
  </Teleport>
</template>
