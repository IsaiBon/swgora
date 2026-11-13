<script setup lang="ts">
import { computed, watch, onUnmounted, ref } from 'vue'
import type { Order } from '@/services/ordersService'
import { Printer, Download, X, FileText } from 'lucide-vue-next'
import WorkOrderDocument from './WorkOrderDocument.vue'
import { exportOrderToPdf } from '@/utils/pdfExport'

const props = defineProps<{
  order: Order | null
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// Cerrar al presionar la tecla Escape
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

// Añadir / quitar clase al body para aislar completamente la impresión y registrar tecla Escape
watch(
  () => props.isOpen,
  (open) => {
    if (typeof document !== 'undefined') {
      if (open) {
        document.body.classList.add('printing-modal-active')
        window.addEventListener('keydown', handleKeydown)
      } else {
        document.body.classList.remove('printing-modal-active')
        window.removeEventListener('keydown', handleKeydown)
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('printing-modal-active')
    window.removeEventListener('keydown', handleKeydown)
  }
})

const isCotizacion = computed(() => props.order?.type === 'cotizacion')

const handlePrint = () => {
  window.print()
}

const isDownloading = ref(false)

const handleDownload = async () => {
  if (!props.order || isDownloading.value) return
  isDownloading.value = true
  try {
    const el = document.getElementById('printable-work-order')
    if (el) {
      await exportOrderToPdf(el, props.order)
    }
  } catch (error) {
    console.error('Error al generar PDF de la orden:', error)
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && order"
      id="work-order-print-container"
      @click.self="emit('close')"
      class="fixed inset-0 z-50 overflow-y-auto bg-[#09132B]/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5 print:p-0 print:bg-white print:static print:overflow-visible"
      role="dialog"
      aria-modal="true"
    >
      <!-- Modal Card con scroll interno y barra superior fija -->
      <div
        id="work-order-print-modal-card"
        class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 popover-pop-in print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:rounded-none my-auto"
      >
        <!-- 1. Barra superior fija (Sticky / Siempre visible) -->
        <div class="px-5 py-3.5 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white flex items-center justify-between shrink-0 z-20 shadow-sm print:hidden">
          <div class="flex items-center gap-2.5">
            <FileText class="w-4 h-4 text-[#BFEBF2]" />
            <span class="font-bold font-display text-xs sm:text-sm tracking-tight">
              Vista Previa de Impresión - {{ isCotizacion ? 'Cotización' : 'Orden de Trabajo' }} {{ order.orderNumber }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handlePrint"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 studio-cta-primary active:scale-95 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
              title="Imprimir documento"
            >
              <Printer class="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              type="button"
              @click="handleDownload"
              :disabled="isDownloading"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#038391] hover:bg-[#147488] active:scale-95 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
              title="Descargar orden como archivo PDF"
            >
              <Download class="w-3.5 h-3.5" :class="{ 'animate-bounce': isDownloading }" />
              <span>{{ isDownloading ? 'Generando PDF...' : 'Descargar PDF' }}</span>
            </button>
            <button
              type="button"
              @click="emit('close')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition cursor-pointer"
              title="Cerrar vista previa (Esc)"
            >
              <X class="w-4 h-4" />
              <span class="hidden sm:inline">Cerrar (Esc)</span>
            </button>
          </div>
        </div>

        <!-- 2. Contenedor scrollable interno para adaptar el documento -->
        <div
          id="printable-work-order-scroll"
          class="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/80 print:p-0 print:bg-white print:overflow-visible"
        >
          <!-- Hoja física de la orden limpia -->
          <WorkOrderDocument :order="order" />
        </div>

        <!-- 3. Barra de pie informativa y salida rápida (oculta en impresión) -->
        <div class="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center shrink-0 print:hidden">
          <span class="flex items-center gap-1.5">
            <span>Haz clic fuera del recuadro o presiona</span>
            <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded-md text-[#0D1B3E] font-mono text-[10px] shadow-xs">Esc</kbd>
            <span>para salir</span>
          </span>
          <button
            type="button"
            @click="emit('close')"
            class="font-bold text-[#004B97] hover:text-[#0D1B3E] transition text-xs cursor-pointer"
          >
            Cerrar vista
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
