<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { Order } from '@/services/ordersService'
import { useTallerStore } from '@/stores/taller'

const props = withDefaults(
  defineProps<{
    order: Order | null
    variant?: 'preview' | 'pdf'
  }>(),
  {
    variant: 'preview'
  }
)

const tallerStore = useTallerStore()

onMounted(async () => {
  await tallerStore.loadTallerInfo()
})

const isCotizacion = computed(() => props.order?.type === 'cotizacion')

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

// Orden canónico de secciones idéntico al Excel y al formato físico de taller
const SECTION_ORDER_MAP: Record<string, number> = {
  'BIELAS': 1,
  'BANCADA': 2,
  'BANCADAS': 2,
  'CIGÜEÑAL': 3,
  'CULATA': 4,
  'BLOCKS': 5,
  'BLOCK': 5,
  'REPUESTOS': 6,
}

const LEFT_SECTION_NAMES = ['BIELAS', 'BANCADA', 'BANCADAS', 'CIGÜEÑAL', 'CULATA']
const RIGHT_SECTION_NAMES = ['BLOCKS', 'BLOCK', 'REPUESTOS']

const normalizeSectionTitle = (cat: string): string => {
  const upper = (cat || '').trim().toUpperCase()
  if (upper.includes('BIELA')) return 'BIELAS'
  if (upper.includes('BANCADA')) return 'BANCADA'
  if (upper.includes('CIGÜEÑAL') || upper.includes('CIGUENAL')) return 'CIGÜEÑAL'
  if (upper.includes('CULATA')) return 'CULATA'
  if (upper.includes('BLOCK')) return 'BLOCKS'
  if (upper.includes('REPUESTO')) return 'REPUESTOS'
  return upper || 'OPERACIONES'
}

// Clean print: Agrupación de operaciones mecánicas organizadas estrictamente por su componente
const groupedSections = computed<PrintableSection[]>(() => {
  if (!props.order) return []

  const sectionsMap = new Map<string, PrintableItem[]>()

  // Operaciones de rectificación agrupadas por componente mecánico
  const operations = props.order.operations || []
  for (const op of operations) {
    const qty = Number(op.quantity) || 0
    const price = Number(op.unitPrice) || 0
    const subtotal = Number(op.subtotal) || 0
    if (qty <= 0 || (price <= 0 && subtotal <= 0)) continue

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
      quantity: qty,
      description: op.operation,
      detail,
      unitPrice: price,
      subtotal: subtotal
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

// Separación en 2 Columnas para formato físico 1 página (Estilo Orden Taller JR Blanco)
// Columna Izquierda: BIELAS, BANCADA, CIGÜEÑAL, CULATA
const finalLeftSections = computed<PrintableSection[]>(() => {
  return groupedSections.value.filter(s => LEFT_SECTION_NAMES.includes(s.title))
})

// Columna Derecha: BLOCKS, REPUESTOS
const finalRightSections = computed<PrintableSection[]>(() => {
  return groupedSections.value.filter(s => RIGHT_SECTION_NAMES.includes(s.title))
})

// Secciones adicionales si se registraron bajo categorías personalizadas
const extraSections = computed<PrintableSection[]>(() => {
  return groupedSections.value.filter(
    s => !LEFT_SECTION_NAMES.includes(s.title) && !RIGHT_SECTION_NAMES.includes(s.title)
  )
})

const displayLeftSections = computed<PrintableSection[]>(() => {
  const list = [...finalLeftSections.value]
  extraSections.value.forEach((sec, idx) => {
    if (idx % 2 === 0) list.push(sec)
  })
  return list
})

const displayRightSections = computed<PrintableSection[]>(() => {
  const list = [...finalRightSections.value]
  extraSections.value.forEach((sec, idx) => {
    if (idx % 2 === 1) list.push(sec)
  })
  return list
})

// Materiales de taller registrados (solo nombres, sin cobro en $)
const orderMaterials = computed(() => {
  return (props.order?.materials || []).filter(m => m.name && m.name.trim().length > 0)
})

const computedLaborTotal = computed(() => {
  return groupedSections.value.reduce((sum, s) => sum + s.subtotal, 0)
})

const hasIva = computed(() => {
  return Boolean(props.order?.hasIva)
})

const orderSubtotal = computed(() => {
  if (props.order?.subtotal !== undefined && props.order.subtotal > 0) {
    return props.order.subtotal
  }
  return computedLaborTotal.value
})

const orderIva = computed(() => {
  if (props.order?.iva !== undefined && props.order.iva > 0) {
    return props.order.iva
  }
  const pct = Number(tallerStore.tallerInfo.iva_porcentaje ?? 13)
  return Number((orderSubtotal.value * (pct / 100)).toFixed(2))
})

const orderGrandTotal = computed(() => {
  if (hasIva.value) {
    return Number((orderSubtotal.value + orderIva.value).toFixed(2))
  }
  return props.order?.total || computedLaborTotal.value
})
</script>

<template>
  <div
    v-if="order"
    id="printable-work-order"
    style="font-family: Arial, Helvetica, sans-serif;"
    :class="[
      'text-slate-900 relative bg-white mx-auto',
      variant === 'pdf'
        ? 'p-3.5 sm:p-4 rounded-none border-none shadow-none w-full max-w-[760px]'
        : 'p-4 sm:p-5 shadow-md rounded-xl border border-slate-200 print:shadow-none print:border-none print:rounded-none print:p-0 max-w-[780px]',
      isCotizacion ? 'watermark-cotizacion' : 'order-formal-theme'
    ]"
  >
    <!-- Marca de agua para cotizaciones -->
    <div v-if="isCotizacion" class="watermark-text select-none">
      COTIZACIÓN
    </div>

    <!-- 1. ENCABEZADO IDÉNTICO A ORDEN DE TRABAJO.XLSX -->
    <div class="border-b-2 border-slate-900 pb-3 mb-3">
      <div class="flex items-start justify-between gap-3">
        
        <!-- Logo + Información de la Empresa Rectificadora (Dinámica desde Supabase) -->
        <div class="flex items-center gap-3.5 flex-1">
          <div class="w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
            <img
              :src="tallerStore.tallerInfo.logo_url || '/logo-taller.png'"
              alt="Logo Rectificadora"
              class="max-w-full max-h-full object-contain"
              @error="(e: any) => { if (e.target.src !== '/logo-taller.png') e.target.src = '/logo-taller.png'; else e.target.style.display = 'none'; }"
            />
          </div>

          <div>
            <h1 class="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase leading-tight">
              {{ tallerStore.tallerInfo.nombre }}
            </h1>
            <p class="text-[11px] font-medium text-slate-700 mt-0.5 leading-snug">
              {{ tallerStore.tallerInfo.direccion }}
            </p>
            <div class="flex items-center gap-4 text-[11px] font-bold text-slate-800 mt-1">
              <span v-if="tallerStore.tallerInfo.celular1">Cel: {{ tallerStore.tallerInfo.celular1 }}</span>
              <span v-if="tallerStore.tallerInfo.celular2">Cel: {{ tallerStore.tallerInfo.celular2 }}</span>
            </div>
          </div>
        </div>

        <!-- Recuadro de Control: Orden de Trabajo / Cotización + Fecha + Estado -->
        <div class="w-52 shrink-0 border-2 border-slate-900 rounded-md p-2 bg-white text-center">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            {{ isCotizacion ? 'COTIZACIÓN' : 'ORDEN DE TRABAJO' }}
          </div>
          
          <div class="py-1 flex items-center justify-center gap-1.5">
            <span class="text-[11px] font-bold text-slate-600">N°:</span>
            <span class="text-base font-black font-mono text-rose-700 tracking-tight">{{ order.orderNumber }}</span>
          </div>

          <!-- Cuadrícula Fecha: DIA | MES | AÑO centrada simétricamente -->
          <table class="w-full border border-slate-400 text-[10px] my-1.5 border-collapse text-center" style="table-layout: fixed;">
            <thead>
              <tr class="bg-slate-100 text-slate-800 border-b border-slate-400">
                <th class="py-1 px-1 border-r border-slate-400 w-1/3 font-bold text-[9px] uppercase tracking-wider align-middle text-center" style="line-height: 1.2;">DÍA</th>
                <th class="py-1 px-1 border-r border-slate-400 w-1/3 font-bold text-[9px] uppercase tracking-wider align-middle text-center" style="line-height: 1.2;">MES</th>
                <th class="py-1 px-1 w-1/3 font-bold text-[9px] uppercase tracking-wider align-middle text-center" style="line-height: 1.2;">AÑO</th>
              </tr>
            </thead>
            <tbody>
              <tr class="font-bold text-slate-900">
                <td class="py-1.5 px-1 border-r border-slate-400 align-middle text-center text-[11px]" style="line-height: 1.2;">{{ dateParts.day }}</td>
                <td class="py-1.5 px-1 border-r border-slate-400 align-middle text-center text-[11px]" style="line-height: 1.2;">{{ dateParts.month }}</td>
                <td class="py-1.5 px-1 align-middle text-center text-[11px]" style="line-height: 1.2;">{{ dateParts.year }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Indicadores de Estado: Proceso / Pendiente -->
          <div class="flex items-center justify-around text-[10px] font-bold text-slate-800 pt-0.5">
            <span class="flex items-center gap-1.5">
              <span class="w-3.5 h-3.5 border border-slate-700 inline-flex items-center justify-center text-[9px] font-black rounded-xs">
                {{ isEnProceso ? '✓' : '' }}
              </span>
              Proceso
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3.5 h-3.5 border border-slate-700 inline-flex items-center justify-center text-[9px] font-black rounded-xs">
                {{ isPendiente ? '✓' : '' }}
              </span>
              Pendiente
            </span>
          </div>
        </div>

      </div>
    </div>

    <!-- 2. BLOQUE DE INFORMACIÓN: CLIENTE Y VEHÍCULO (TABLA NATIVA PURA SIN FLEXBOX) -->
    <div class="border-2 border-slate-900 rounded p-2 mb-2 bg-slate-50/50 print:bg-transparent">
      <table class="w-full text-[10.5px] border-collapse" style="table-layout: fixed;">
        <tbody>
          <!-- Fila 1: Nombre y Taller -->
          <tr>
            <td class="w-1/2 pr-2 py-1 align-middle border-b border-slate-300">
              <span class="font-bold text-slate-800 uppercase text-[9px] mr-1.5">Nombre:</span>
              <span class="font-semibold text-slate-900 text-[10.5px]">{{ order.customer || '— Sin Asignar —' }}</span>
            </td>
            <td class="w-1/2 pl-2 py-1 align-middle border-b border-slate-300">
              <span class="font-bold text-slate-800 uppercase text-[9px] mr-1.5">Taller:</span>
              <span class="font-semibold text-slate-900 text-[10.5px]">{{ order.workshop || 'Particular' }}</span>
            </td>
          </tr>

          <!-- Fila 2: Dirección y Teléfono -->
          <tr>
            <td class="w-2/3 pr-2 py-1 align-middle border-b border-slate-300">
              <span class="font-bold text-slate-800 uppercase text-[9px] mr-1.5">Dirección:</span>
              <span class="text-slate-800 text-[10px]">{{ order.customerAddress || 'San Miguel, El Salvador' }}</span>
            </td>
            <td class="w-1/3 pl-2 py-1 align-middle border-b border-slate-300">
              <span class="font-bold text-slate-800 uppercase text-[9px] mr-1.5">Tel:</span>
              <span class="font-semibold text-slate-900 text-[10.5px]">{{ order.customerPhone || 'N/A' }}</span>
            </td>
          </tr>

          <!-- Fila 3: Marca y Motor -->
          <tr>
            <td class="w-1/2 pr-2 py-1 align-middle border-b border-slate-300">
              <span class="font-bold text-slate-800 uppercase text-[9px] mr-1.5">Marca:</span>
              <span class="font-semibold text-slate-900 text-[10.5px]">{{ order.vehicleBrand || 'N/A' }}</span>
            </td>
            <td class="w-1/2 pl-2 py-1 align-middle border-b border-slate-300">
              <span class="font-bold text-slate-800 uppercase text-[9px] mr-1.5">Motor:</span>
              <span class="font-semibold text-slate-900 text-[10.5px]">{{ order.vehicleModel || order.engine || order.engineType || 'N/A' }}</span>
            </td>
          </tr>

          <!-- Fila 4: Observaciones (Opcional) -->
          <tr v-if="order.observations">
            <td colspan="2" class="pt-1 pb-0.5 align-middle">
              <span class="font-bold text-slate-600 text-[9px] uppercase mr-1.5">Obs:</span>
              <span class="text-[10px] italic text-slate-700">{{ order.observations }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 3. TABLA DE OPERACIONES Y REPUESTOS EN DOBLE COLUMNA / SECCIONES PARALELAS -->
    <div class="border-2 border-slate-900 rounded overflow-hidden bg-white mb-2">
      <table class="w-full border-collapse" style="table-layout: fixed;">
        <tbody>
          <tr>
            <!-- ================= SECCIÓN IZQUIERDA: BIELAS, BANCADA, CIGÜEÑAL, CULATA ================= -->
            <td class="w-1/2 align-top border-r-2 border-slate-900 p-0">
              <table class="w-full text-[9.5px] border-collapse" style="table-layout: fixed;">
                <thead class="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase text-slate-900 text-[8.5px]">
                  <tr>
                    <th class="py-1 px-1 text-center w-8 border-r border-slate-400">CANT.</th>
                    <th class="py-1 px-1.5 text-left border-r border-slate-400">OPERACIÓN DEL TRABAJO</th>
                    <th class="py-1 px-1 text-right w-14 border-r border-slate-400">PRECIO U.</th>
                    <th class="py-1 px-1.5 text-right w-14">VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-if="displayLeftSections.length > 0">
                    <template v-for="section in displayLeftSections" :key="section.title">
                      <!-- Encabezado de Sección: BIELAS, BANCADA, CIGÜEÑAL, CULATA -->
                      <tr class="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider">
                        <td colspan="4" class="py-0.5 px-1.5">
                          <div class="flex justify-between items-center leading-normal">
                            <span>{{ section.title }}</span>
                            <span class="text-[8.5px] font-medium text-slate-300">Subtotal: ${{ section.subtotal.toFixed(2) }}</span>
                          </div>
                        </td>
                      </tr>

                      <!-- Filas de operaciones de la sección -->
                      <tr
                        v-for="item in section.items"
                        :key="item.id"
                        class="bg-white border-b border-slate-200"
                      >
                        <td class="py-1 px-1 text-center font-bold text-slate-900 border-r border-slate-200 align-middle text-[9px]">
                          {{ item.quantity }}
                        </td>
                        <td class="py-1 px-1.5 text-slate-900 border-r border-slate-200 align-middle leading-snug">
                          <span class="font-medium text-[9.5px]">{{ item.description }}</span>
                          <span v-if="item.detail" class="ml-1 text-[8.5px] font-bold text-slate-600">[{{ item.detail }}]</span>
                        </td>
                        <td class="py-1 px-1 text-right text-slate-700 border-r border-slate-200 align-middle text-[9px] font-mono">
                          ${{ item.unitPrice.toFixed(2) }}
                        </td>
                        <td class="py-1 px-1.5 text-right font-black text-slate-900 align-middle text-[9.5px]">
                          ${{ item.subtotal.toFixed(2) }}
                        </td>
                      </tr>
                    </template>
                  </template>
                  <tr v-else class="border-b border-slate-200">
                    <td colspan="4" class="py-6 px-2 text-center text-[9.5px] text-slate-400 italic">
                      — Sin operaciones de bielas / culata facturadas —
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>

            <!-- ================= SECCIÓN DERECHA: BLOCKS Y REPUESTOS ================= -->
            <td class="w-1/2 align-top p-0">
              <table class="w-full text-[9.5px] border-collapse" style="table-layout: fixed;">
                <thead class="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase text-slate-900 text-[8.5px]">
                  <tr>
                    <th class="py-1 px-1 text-center w-8 border-r border-slate-400">CANT.</th>
                    <th class="py-1 px-1.5 text-left border-r border-slate-400">OPERACIÓN DEL TRABAJO</th>
                    <th class="py-1 px-1 text-right w-14 border-r border-slate-400">PRECIO U.</th>
                    <th class="py-1 px-1.5 text-right w-14">VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-if="displayRightSections.length > 0">
                    <template v-for="section in displayRightSections" :key="section.title">
                      <!-- Encabezado de Sección: BLOCKS, REPUESTOS -->
                      <tr class="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider">
                        <td colspan="4" class="py-0.5 px-1.5">
                          <div class="flex justify-between items-center leading-normal">
                            <span>{{ section.title }}</span>
                            <span class="text-[8.5px] font-medium text-slate-300">Subtotal: ${{ section.subtotal.toFixed(2) }}</span>
                          </div>
                        </td>
                      </tr>

                      <!-- Filas de operaciones y repuestos de la sección -->
                      <tr
                        v-for="item in section.items"
                        :key="item.id"
                        class="bg-white border-b border-slate-200"
                      >
                        <td class="py-1 px-1 text-center font-bold text-slate-900 border-r border-slate-200 align-middle text-[9px]">
                          {{ item.quantity }}
                        </td>
                        <td class="py-1 px-1.5 text-slate-900 border-r border-slate-200 align-middle leading-snug">
                          <span class="font-medium text-[9.5px]">{{ item.description }}</span>
                          <span v-if="item.detail" class="ml-1 text-[8.5px] font-bold text-slate-600">[{{ item.detail }}]</span>
                        </td>
                        <td class="py-1 px-1 text-right text-slate-700 border-r border-slate-200 align-middle text-[9px] font-mono">
                          ${{ item.unitPrice.toFixed(2) }}
                        </td>
                        <td class="py-1 px-1.5 text-right font-black text-slate-900 align-middle text-[9.5px]">
                          ${{ item.subtotal.toFixed(2) }}
                        </td>
                      </tr>
                    </template>
                  </template>
                  <tr v-else class="border-b border-slate-200">
                    <td colspan="4" class="py-6 px-2 text-center text-[9.5px] text-slate-400 italic">
                      — Sin repuestos ni operaciones de block facturadas —
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 4. PIE DE PÁGINA: MATERIALES + FIRMA + RECUADRO DE TOTALES (TABLA NATIVA 2 COLUMNAS) -->
    <table class="w-full border-collapse mt-2 no-break" style="table-layout: fixed;">
      <tbody>
        <tr>
          <!-- Izquierda: Materiales + Eslogan + Firma -->
          <td class="w-1/2 pr-2.5 align-bottom">
            <!-- Sección de Materiales (Idéntica a la hoja física de taller) -->
            <div v-if="orderMaterials.length > 0" class="border border-slate-900 rounded overflow-hidden mb-2">
              <div class="bg-slate-900 text-white font-black text-[8.5px] uppercase tracking-wider px-2 py-0.5">
                MATERIALES:
              </div>
              <div class="p-1 bg-white text-[9px] text-slate-800 leading-tight">
                <span v-for="(mat, idx) in orderMaterials" :key="mat.id" class="font-semibold">
                  {{ mat.name }}<span v-if="idx < orderMaterials.length - 1">, </span>
                </span>
              </div>
            </div>
            <div v-else class="text-[9px] text-slate-700 mb-2">
              <span class="font-bold uppercase text-[8.5px]">MATERIALES:</span>
              <span class="border-b border-slate-400 inline-block w-40 ml-1"></span>
            </div>

            <!-- Eslogan y Firma -->
            <div>
              <div class="text-[10px] font-black italic text-slate-800 tracking-wide font-serif mb-0.5">
                "{{ tallerStore.tallerInfo.eslogan || 'APOYARTE ES NUESTRO COMPROMISO' }}"
              </div>
              <div class="pt-5 border-b border-slate-600 w-44 text-center">
                <span class="text-[8.5px] font-bold text-slate-700 uppercase tracking-wider">FIRMA DE CONFORMIDAD</span>
              </div>
            </div>
          </td>

          <!-- Derecha: Recuadro de Totales alineado a la derecha -->
          <td class="w-1/2 pl-2.5 align-bottom text-right">
            <div class="inline-block text-left w-full max-w-[250px]">
              <div v-if="hasIva" class="border-2 border-slate-900 rounded overflow-hidden bg-white text-[9.5px]">
                <div class="flex justify-between items-center px-2.5 py-1 border-b border-slate-200">
                  <span class="font-bold text-slate-800 uppercase tracking-wider text-[8.5px]">TOTAL $:</span>
                  <span class="font-bold text-slate-900 font-mono text-[10px]">${{ orderSubtotal.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center px-2.5 py-1 border-b border-slate-200">
                  <span class="font-bold text-slate-800 uppercase tracking-wider text-[8.5px]">IVA ({{ tallerStore.tallerInfo.iva_porcentaje ?? 13 }}%):</span>
                  <span class="font-bold text-slate-900 font-mono text-[10px]">${{ orderIva.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center px-2.5 py-1.5 bg-slate-900 text-white font-black text-[10.5px]">
                  <span class="uppercase tracking-wider text-[8.5px]">TOTAL DEL TRABAJO $:</span>
                  <span class="text-xs font-mono font-bold text-cyan-300 print:text-white">${{ orderGrandTotal.toFixed(2) }}</span>
                </div>
              </div>
              <div v-else class="border-2 border-slate-900 rounded overflow-hidden bg-white text-[9.5px]">
                <div class="flex justify-between items-center px-2.5 py-1.5 bg-slate-900 text-white font-black text-xs">
                  <span class="uppercase tracking-wider text-[9px]">TOTAL $:</span>
                  <span class="text-sm text-cyan-300 print:text-white font-mono font-bold">${{ orderGrandTotal.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
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
