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

// Modo de layout de la tabla: 'auto' (adaptable), 'single' (1 sección), 'double' (2 secciones)
const selectedLayout = ref<'auto' | 'single' | 'double'>('auto')

// Control de visibilidad de subtotales por componente
const showSubtotalsOverride = ref<boolean>(true)

watch(
  () => props.order,
  (newOrder) => {
    if (newOrder) {
      showSubtotalsOverride.value = newOrder.showSubtotals !== undefined ? Boolean(newOrder.showSubtotals) : true
    }
  },
  { immediate: true }
)

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
      const orderToExport = {
        ...props.order,
        showSubtotals: showSubtotalsOverride.value
      }
      await exportOrderToPdf(el, orderToExport)
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
      class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 print:p-0 print:bg-white print:static print:overflow-visible"
      role="dialog"
      aria-modal="true"
    >
      <!-- Modal Card con scroll interno y barra superior fija -->
      <div
        id="work-order-print-modal-card"
        class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:rounded-none my-auto"
      >
        <!-- 1. Barra superior fija (Sticky / Siempre visible) -->
        <div class="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 z-20 shadow-sm print:hidden">
          <div class="flex items-center gap-2">
            <FileText class="w-4 h-4 text-cyan-400" />
            <span class="font-bold text-xs sm:text-sm tracking-tight">
              Vista Previa de Impresión - {{ isCotizacion ? 'Cotización' : 'Orden de Trabajo' }} {{ order.orderNumber }}
            </span>
          </div>

          <!-- Controles de Vista: Modo de Layout y Subtotales -->
          <div class="flex items-center gap-2">
            <!-- Selector de Modo de Layout (Adaptable, 1 Sección, 2 Secciones) -->
            <div class="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300">
              <span class="px-2 text-slate-400 text-[10.5px] uppercase font-bold hidden sm:inline">Diseño:</span>
              <button
                type="button"
                @click="selectedLayout = 'auto'"
                :class="selectedLayout === 'auto' ? 'bg-[#004b97] text-white shadow-xs' : 'hover:text-white'"
                class="px-2 py-1 rounded transition text-xs"
                title="Adaptable automáticamente según cantidad de operaciones"
              >
                Auto (Adaptable)
              </button>
              <button
                type="button"
                @click="selectedLayout = 'single'"
                :class="selectedLayout === 'single' ? 'bg-[#004b97] text-white shadow-xs' : 'hover:text-white'"
                class="px-2 py-1 rounded transition text-xs"
                title="Forzar 1 sección (ancho completo)"
              >
                1 Sección
              </button>
              <button
                type="button"
                @click="selectedLayout = 'double'"
                :class="selectedLayout === 'double' ? 'bg-[#004b97] text-white shadow-xs' : 'hover:text-white'"
                class="px-2 py-1 rounded transition text-xs"
                title="Forzar 2 secciones (doble columna paralela)"
              >
                2 Secciones
              </button>
            </div>

            <!-- Botón Rápido de Subtotales por Componente -->
            <button
              type="button"
              @click="showSubtotalsOverride = !showSubtotalsOverride"
              :class="showSubtotalsOverride ? 'bg-slate-800 text-cyan-300 border-cyan-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'"
              class="px-2.5 py-1 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5"
              title="mostrar subtotales por componente"
            >
              <span class="text-slate-300">Subtotales:</span>
              <span class="font-black text-[11px]">{{ showSubtotalsOverride ? 'SÍ' : 'NO' }}</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handlePrint"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#04c4d9] hover:bg-[#03a9bc] active:scale-95 text-white text-xs font-bold rounded-lg shadow transition"
              title="Imprimir documento"
            >
              <Printer class="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              type="button"
              @click="handleDownload"
              :disabled="isDownloading"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow transition disabled:opacity-50"
              title="Descargar orden como archivo PDF"
            >
              <Download class="w-3.5 h-3.5" :class="{ 'animate-bounce': isDownloading }" />
              <span>{{ isDownloading ? 'Generando PDF...' : 'Descargar PDF' }}</span>
            </button>
            <button
              type="button"
              @click="emit('close')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition"
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
          class="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/70 print:p-0 print:bg-white print:overflow-visible"
        >
          <!-- Hoja física de la orden limpia -->
          <WorkOrderDocument :order="order" :layoutMode="selectedLayout" :showSubtotals="showSubtotalsOverride" />
        </div>

        <!-- 3. Barra de pie informativa y salida rápida (oculta en impresión) -->
        <div class="px-5 py-2.5 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center shrink-0 print:hidden">
          <span class="flex items-center gap-1.5">
            <span>Haz clic fuera del recuadro o presiona</span>
            <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono text-[10px] shadow-xs">Esc</kbd>
            <span>para salir</span>
          </span>
          <button
            type="button"
            @click="emit('close')"
            class="font-bold text-slate-700 hover:text-slate-900 transition text-xs"
          >
            Cerrar vista
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
