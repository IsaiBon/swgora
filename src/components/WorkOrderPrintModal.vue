<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import type { Order } from '@/services/ordersService'
import { Printer, X, FileText } from 'lucide-vue-next'

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

// Extracción de partes de fecha para cuadrícula DÍA | MES | AÑO del Excel
const dateParts = computed(() => {
  if (!props.order?.date) return { day: '--', month: '--', year: '----' }
  const raw = props.order.date.split('T')[0]
  const parts = raw.split('-')
  if (parts.length === 3) {
    return { day: parts[2], month: parts[1], year: parts[0] }
  }
  return { day: '--', month: '--', year: '----' }
})

// Estados según orden de taller del Excel (Proceso / Pendiente)
const isEnProceso = computed(() => props.order?.status === 'En Proceso')
const isPendiente = computed(() => props.order?.status === 'Pendiente')

// Helper para detectar operaciones con medidas de tipo de válvula
const isValveTypeOperation = (opName: string) => {
  const lower = opName.toLowerCase()
  return (lower.includes('guías') || lower.includes('guias')) && (lower.includes('adapte') || lower.includes('válvula') || lower.includes('valvula'))
}

interface PrintableItem {
  id: string
  quantity: number
  description: string
  detail?: string
  unitPrice: number
  subtotal: number
}

interface PrintableSection {
  title: string
  items: PrintableItem[]
  subtotal: number
}

// Orden canónico de secciones idéntico al Excel (ORDEN DE TRABAJO.xlsx)
const SECTION_ORDER_MAP: Record<string, number> = {
  'BIELAS': 1,
  'BANCADA': 2,
  'BANCADAS': 2,
  'CIGÜEÑAL': 3,
  'CULATA': 4,
  'BLOCKS': 5,
  'BLOCK': 5,
}

const normalizeSectionTitle = (cat: string): string => {
  const upper = (cat || '').trim().toUpperCase()
  if (upper.includes('BIELA')) return 'BIELAS'
  if (upper.includes('BANCADA')) return 'BANCADA'
  if (upper.includes('CIGÜEÑAL') || upper.includes('CIGUENAL')) return 'CIGÜEÑAL'
  if (upper.includes('CULATA')) return 'CULATA'
  if (upper.includes('BLOCK')) return 'BLOCKS'
  return upper || 'OPERACIONES'
}

// Clean print: Agrupación exclusiva de operaciones mecánicas (sin sección de repuestos facturados)
const groupedSections = computed<PrintableSection[]>(() => {
  if (!props.order) return []

  const sectionsMap = new Map<string, PrintableItem[]>()

  // Operaciones de rectificación (Mano de Obra agrupada por componente mecánico)
  const operations = props.order.operations || []
  for (const op of operations) {
    if (op.quantity <= 0 || op.unitPrice < 0) continue
    if (op.category === 'Repuestos') continue // Se omite sección de repuestos facturados

    const title = normalizeSectionTitle(op.category)
    const items = sectionsMap.get(title) || []

    let detail: string | undefined = undefined
    if (op.measureBanco || op.measureBiela) {
      const parts: string[] = []
      if (op.measureBanco) parts.push(`Banco: ${op.measureBanco}`)
      if (op.measureBiela) parts.push(`Biela: ${op.measureBiela}`)
      detail = parts.join(' | ')
    } else if (op.measure) {
      detail = `${isValveTypeOperation(op.operation) ? 'Tipo: ' : 'Medida: '}${op.measure}`
    }

    items.push({
      id: op.id,
      quantity: op.quantity,
      description: op.operation,
      detail,
      unitPrice: op.unitPrice,
      subtotal: op.subtotal
    })
    sectionsMap.set(title, items)
  }

  // Construir secciones consolidadas con subtotales
  const result: PrintableSection[] = []
  for (const [title, items] of sectionsMap.entries()) {
    if (items.length > 0) {
      const subtotal = items.reduce((sum, it) => sum + (it.subtotal || 0), 0)
      result.push({
        title,
        items,
        subtotal
      })
    }
  }

  // Ordenar según el orden estándar del Excel
  result.sort((a, b) => {
    const orderA = SECTION_ORDER_MAP[a.title] ?? 99
    const orderB = SECTION_ORDER_MAP[b.title] ?? 99
    return orderA - orderB
  })

  return result
})

// Materiales de taller registrados (solo nombres, sin cobro en $)
const orderMaterials = computed(() => {
  return (props.order?.materials || []).filter(m => m.name && m.name.trim().length > 0)
})

const computedLaborTotal = computed(() => {
  return groupedSections.value.reduce((sum, s) => sum + s.subtotal, 0)
})
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
        <div class="px-5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 z-20 shadow-sm print:hidden">
          <div class="flex items-center gap-2">
            <FileText class="w-4 h-4 text-cyan-400" />
            <span class="font-bold text-xs sm:text-sm tracking-tight">
              Vista Previa de Impresión - {{ isCotizacion ? 'Cotización' : 'Orden de Trabajo' }} {{ order.orderNumber }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handlePrint"
              class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#04c4d9] hover:bg-[#03a9bc] active:scale-95 text-white text-xs font-bold rounded-lg shadow transition"
              title="Imprimir o exportar en PDF"
            >
              <Printer class="w-3.5 h-3.5" />
              Imprimir / PDF
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
          <div
            id="printable-work-order"
            :class="[
              'p-5 sm:p-6 text-slate-800 relative bg-white mx-auto shadow-md rounded-xl border border-slate-200 print:shadow-none print:border-none print:rounded-none print:p-0',
              isCotizacion ? 'watermark-cotizacion' : 'order-formal-theme'
            ]"
          >
        <!-- Marca de agua para cotizaciones -->
        <div v-if="isCotizacion" class="watermark-text select-none">
          COTIZACIÓN
        </div>

        <!-- 1. ENCABEZADO IDÉNTICO A ORDEN DE TRABAJO.XLSX -->
        <div class="border-b-2 border-slate-900 pb-2.5 mb-2.5">
          <div class="flex items-start justify-between gap-3">
            
            <!-- Logo + Información de la Empresa Rectificadora -->
            <div class="flex items-center gap-3 flex-1">
              <div class="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
                <img
                  src="/logo-taller.png"
                  alt="Logo Rectificadora"
                  class="max-w-full max-h-full object-contain"
                  @error="(e: any) => e.target.style.display = 'none'"
                />
              </div>

              <div>
                <h1 class="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase font-sans leading-tight">
                  TALLER INDUSTRIAL Y RECTIFICADO DE MOTORES
                </h1>
                <p class="text-[10.5px] font-medium text-slate-700 mt-0.5 leading-snug">
                  Col. Milagro de la Paz, Av. San Luis y Calle Oriente #12 San Miguel, El Salvador
                </p>
                <div class="flex items-center gap-4 text-[10.5px] font-bold text-slate-800 mt-0.5">
                  <span>Cel: 7831-2641</span>
                  <span>Cel: 7142-0401</span>
                </div>
              </div>
            </div>

            <!-- Recuadro de Control: Orden de Trabajo / Cotización + Fecha + Estado -->
            <div class="w-52 shrink-0 border-2 border-slate-900 rounded-md p-1.5 bg-white text-center">
              <div class="text-[11px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5">
                {{ isCotizacion ? 'COTIZACIÓN' : 'ORDEN DE TRABAJO' }}
              </div>
              
              <div class="py-0.5 flex items-center justify-center gap-1">
                <span class="text-[11px] font-bold text-slate-600">N°:</span>
                <span class="text-base font-black font-mono text-rose-700 tracking-tight">{{ order.orderNumber }}</span>
              </div>

              <!-- Mini Cuadrícula Fecha: DIA | MES | AÑO -->
              <div class="grid grid-cols-3 border border-slate-400 text-[9.5px] my-0.5 rounded overflow-hidden">
                <div class="border-r border-slate-400 bg-slate-100 font-bold py-0.5">DÍA</div>
                <div class="border-r border-slate-400 bg-slate-100 font-bold py-0.5">MES</div>
                <div class="bg-slate-100 font-bold py-0.5">AÑO</div>
                <div class="border-r border-slate-400 font-mono font-bold py-0.5 text-slate-900">{{ dateParts.day }}</div>
                <div class="border-r border-slate-400 font-mono font-bold py-0.5 text-slate-900">{{ dateParts.month }}</div>
                <div class="font-mono font-bold py-0.5 text-slate-900">{{ dateParts.year }}</div>
              </div>

              <!-- Indicadores de Estado: Proceso / Pendiente -->
              <div class="flex items-center justify-around text-[9.5px] font-bold text-slate-800 pt-0.5">
                <span class="flex items-center gap-1">
                  <span class="w-3 h-3 border border-slate-700 inline-flex items-center justify-center text-[9px] font-black rounded-xs">
                    {{ isEnProceso ? '✓' : '' }}
                  </span>
                  Proceso
                </span>
                <span class="flex items-center gap-1">
                  <span class="w-3 h-3 border border-slate-700 inline-flex items-center justify-center text-[9px] font-black rounded-xs">
                    {{ isPendiente ? '✓' : '' }}
                  </span>
                  Pendiente
                </span>
              </div>
            </div>

          </div>
        </div>

        <!-- 2. BLOQUE DE INFORMACIÓN: CLIENTE Y VEHÍCULO (ESTILO CUADRÍCULA EXCEL) -->
        <div class="border border-slate-900 rounded p-2 mb-2.5 text-[11px] leading-tight bg-slate-50/50 print:bg-transparent">
          <div class="grid grid-cols-12 gap-x-3 gap-y-1">
            <!-- Fila 1 -->
            <div class="col-span-6 flex items-baseline gap-1">
              <span class="font-bold text-slate-800 uppercase text-[10px] shrink-0">Nombre:</span>
              <span class="font-semibold text-slate-900 border-b border-dotted border-slate-400 flex-1 truncate">{{ order.customer }}</span>
            </div>
            <div class="col-span-6 flex items-baseline gap-1">
              <span class="font-bold text-slate-800 uppercase text-[10px] shrink-0">Taller:</span>
              <span class="font-semibold text-slate-900 border-b border-dotted border-slate-400 flex-1 truncate">{{ order.workshop || 'Particular' }}</span>
            </div>

            <!-- Fila 2 -->
            <div class="col-span-8 flex items-baseline gap-1">
              <span class="font-bold text-slate-800 uppercase text-[10px] shrink-0">Dirección:</span>
              <span class="text-slate-800 border-b border-dotted border-slate-400 flex-1 truncate">{{ order.customerAddress || 'San Miguel, El Salvador' }}</span>
            </div>
            <div class="col-span-4 flex items-baseline gap-1">
              <span class="font-bold text-slate-800 uppercase text-[10px] shrink-0">Tel:</span>
              <span class="font-semibold text-slate-900 border-b border-dotted border-slate-400 flex-1 truncate">{{ order.customerPhone || 'N/A' }}</span>
            </div>

            <!-- Fila 3 -->
            <div class="col-span-6 flex items-baseline gap-1">
              <span class="font-bold text-slate-800 uppercase text-[10px] shrink-0">Marca:</span>
              <span class="font-semibold text-slate-900 border-b border-dotted border-slate-400 flex-1 truncate">{{ order.vehicleBrand || 'N/A' }}</span>
            </div>
            <div class="col-span-6 flex items-baseline gap-1">
              <span class="font-bold text-slate-800 uppercase text-[10px] shrink-0">Motor:</span>
              <span class="font-semibold text-slate-900 border-b border-dotted border-slate-400 flex-1 truncate">{{ order.vehicleModel || order.engine || order.engineType || 'N/A' }}</span>
            </div>

            <div v-if="order.observations" class="col-span-12 flex items-baseline gap-1 pt-0.5">
              <span class="font-bold text-slate-600 text-[9.5px] shrink-0 uppercase">Obs:</span>
              <span class="text-[10px] italic text-slate-700 truncate flex-1">{{ order.observations }}</span>
            </div>
          </div>
        </div>

        <!-- 3. TABLA DE OPERACIONES Y REPUESTOS FACTURADOS (FORMATO IDÉNTICO A EXCEL) -->
        <div class="flex-1 min-h-0">
          <div v-if="groupedSections.length > 0" class="border-2 border-slate-900 rounded overflow-hidden">
            <table class="w-full text-[10.5px]">
              <thead class="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase text-slate-900 text-[9.5px]">
                <tr>
                  <th class="py-1 px-2 text-center w-12 border-r border-slate-400">CANT.</th>
                  <th class="py-1 px-2 text-left border-r border-slate-400">OPERACIÓN DEL TRABAJO</th>
                  <th class="py-1 px-2 text-right w-20 border-r border-slate-400">PRECIO U.</th>
                  <th class="py-1 px-2 text-right w-20">VALOR ($)</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="section in groupedSections" :key="section.title">
                  <!-- Encabezado de Sección idéntico al Excel: BIELAS, BANCADA, CIGÜEÑAL, CULATA, BLOCKS, REPUESTOS, MATERIALES -->
                  <tr class="bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider no-break">
                    <td colspan="4" class="py-0.5 px-2.5">
                      <div class="flex justify-between items-center">
                        <span class="tracking-widest">{{ section.title }}</span>
                        <span class="text-[9px] font-normal text-slate-300">Subtotal: ${{ section.subtotal.toFixed(2) }}</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Filas de la sección (sin columna redundante de categoría/componente) -->
                  <tr
                    v-for="item in section.items"
                    :key="item.id"
                    class="leading-tight bg-white border-b border-slate-200"
                  >
                    <td class="py-0.5 px-2 text-center font-bold border-r border-slate-200">{{ item.quantity }}</td>
                    <td class="py-0.5 px-2 text-slate-900 border-r border-slate-200">
                      <span class="font-medium">{{ item.description }}</span>
                      <span v-if="item.detail" class="ml-1 text-[9.5px] font-bold text-slate-700">[{{ item.detail }}]</span>
                    </td>
                    <td class="py-0.5 px-2 text-right text-slate-700 border-r border-slate-200">${{ item.unitPrice.toFixed(2) }}</td>
                    <td class="py-0.5 px-2 text-right font-black text-slate-900">${{ item.subtotal.toFixed(2) }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <div v-else class="py-8 text-center text-xs text-slate-500 italic border border-dashed border-slate-300 rounded-lg">
            No hay operaciones ni repuestos facturados en este documento.
          </div>
        </div>

        <!-- 4. SECCIÓN DE MATERIALES (Solo nombre del material, sin precio $) -->
        <div v-if="orderMaterials.length > 0" class="mt-2 border border-slate-900 rounded overflow-hidden no-break bg-white">
          <div class="bg-slate-900 text-white font-black text-[9.5px] uppercase tracking-wider px-2 py-0.5">
            MATERIALES:
          </div>
          <div class="p-1.5 bg-white">
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
              <span v-for="mat in orderMaterials" :key="mat.id" class="inline-flex items-center gap-1 text-slate-800 font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0"></span>
                {{ mat.name }}
              </span>
            </div>
          </div>
        </div>

        <!-- 5. PIE DE PÁGINA: FIRMA + ESLOGAN + RECUADRO DE TOTALES -->
        <div class="mt-2.5 pt-2 border-t-2 border-slate-900 flex justify-between items-end gap-3 no-break">
          <!-- Izquierda: Eslogan y Términos -->
          <div class="flex-1 space-y-1.5">
            <div class="text-[11px] font-black italic text-slate-800 tracking-wide font-serif">
              "APOYARTE ES NUESTRO COMPROMISO"
            </div>
            
            <div class="pt-5 border-b border-slate-400 w-44 text-center">
              <span class="text-[9.5px] font-bold text-slate-700 uppercase">Firma de Conformidad</span>
            </div>
          </div>

          <!-- Derecha: Recuadro de Totales idéntico al Excel -->
          <div class="w-52 border-2 border-slate-900 rounded overflow-hidden bg-white text-[11px]">
            <div class="flex justify-between items-center px-3 py-1.5 bg-slate-900 text-white font-black text-xs">
              <span class="uppercase tracking-wider">TOTAL $:</span>
              <span class="text-base text-cyan-300 font-mono font-bold">${{ (computedLaborTotal || order.total).toFixed(2) }}</span>
            </div>
          </div>
        </div>
        </div>

      </div>
      <!-- Fin #printable-work-order-scroll -->

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
    <!-- Fin #work-order-print-modal-card -->

  </div>
  <!-- Fin #work-order-print-container -->
  </Teleport>
</template>

<style scoped>
/* Marca de agua solo para cotizaciones */
.watermark-cotizacion {
  position: relative;
}
.watermark-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 80px;
  font-weight: 900;
  color: rgba(100, 116, 139, 0.08);
  pointer-events: none;
  z-index: 0;
  letter-spacing: 0.18em;
}
</style>
