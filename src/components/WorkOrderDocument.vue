<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { Order } from '@/services/ordersService'
import { useTallerStore } from '@/stores/taller'

const props = withDefaults(
  defineProps<{
    order: Order | null
    variant?: 'preview' | 'pdf'
    layoutMode?: 'auto' | 'single' | 'double'
    showSubtotals?: boolean
  }>(),
  {
    variant: 'preview',
    layoutMode: 'auto',
    showSubtotals: undefined
  }
)

const shouldShowSubtotals = computed(() => {
  if (props.showSubtotals !== undefined) {
    return props.showSubtotals
  }
  if (props.order?.showSubtotals !== undefined) {
    return Boolean(props.order.showSubtotals)
  }
  return true
})

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

// Conteo total de filas estimadas en modo 1 sección continua
// (1 fila por encabezado de cada categoría + 1 fila por cada operación/repuesto)
const totalSingleRows = computed(() => {
  return groupedSections.value.reduce((sum, s) => sum + 1 + s.items.length, 0)
})

// Decisión de layout adaptable:
// - Si layoutMode === 'single': fuerza 1 sección (ancho completo).
// - Si layoutMode === 'double': fuerza 2 secciones (doble columna paralela).
// - Si layoutMode === 'auto':
//   Si totalSingleRows <= 13: cabe con holgura en 1 sección dentro de 1 página.
//   Si totalSingleRows > 13: pasa automáticamente a 2 secciones para aprovechar el ancho y mantenerse en 1 sola página.
const isDoubleSection = computed(() => {
  if (props.layoutMode === 'single') return false
  if (props.layoutMode === 'double') return true
  return totalSingleRows.value > 13
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
      <div class="flex items-center justify-between gap-4">
        
        <!-- Logo + Información de la Empresa Rectificadora (Dinámica desde Supabase) -->
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <div class="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center p-1 border border-slate-200 rounded-xl bg-slate-50/50">
            <img
              :src="tallerStore.tallerInfo.logo_url || '/logo-taller.png'"
              alt="Logo Rectificadora"
              class="max-w-full max-h-full object-contain"
              @error="(e: any) => { if (e.target.src !== '/logo-taller.png') e.target.src = '/logo-taller.png'; else e.target.style.display = 'none'; }"
            />
          </div>

          <div class="flex-1 min-w-0">
            <h1 class="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase leading-snug">
              {{ tallerStore.tallerInfo.nombre }}
            </h1>
            <p class="text-xs sm:text-[12px] font-medium text-slate-700 mt-1 leading-snug flex items-center gap-1.5">
              <span class="text-rose-600 text-sm shrink-0 select-none">📍</span>
              <span>{{ tallerStore.tallerInfo.direccion }}</span>
            </p>
            <div class="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs sm:text-[12px] font-bold text-slate-800 mt-1.5">
              <!-- WhatsApp Celular 1 -->
              <span v-if="tallerStore.tallerInfo.celular1" class="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" class="w-4 h-4 inline-block shrink-0 fill-[#25D366]">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.11 7.44C8.95 7.44 8.68 7.5 8.46 7.74C8.23 7.98 7.6 8.57 7.6 9.78C7.6 10.99 8.48 12.16 8.6 12.33C8.73 12.49 10.33 14.96 12.78 16.02C13.36 16.27 13.82 16.42 14.17 16.53C14.76 16.72 15.3 16.69 15.72 16.63C16.19 16.56 17.17 16.04 17.37 15.47C17.58 14.9 17.58 14.41 17.51 14.31C17.45 14.21 17.3 14.15 17.06 14.03C16.83 13.91 15.69 13.35 15.48 13.27C15.27 13.19 15.12 13.15 14.97 13.39C14.81 13.62 14.37 14.15 14.23 14.31C14.1 14.46 13.96 14.48 13.73 14.36C13.5 14.24 12.52 13.92 11.37 12.9C10.47 12.1 9.87 11.11 9.75 10.9C9.63 10.69 9.74 10.58 9.85 10.46C9.96 10.36 10.09 10.18 10.21 10.04C10.33 9.9 10.37 9.79 10.45 9.64C10.53 9.48 10.49 9.35 10.43 9.23C10.37 9.11 9.89 7.93 9.7 7.45C9.51 6.98 9.32 7.05 9.17 7.04C9.04 7.04 8.89 7.04 8.73 7.04"/>
                </svg>
                <span>Cel: {{ tallerStore.tallerInfo.celular1 }}</span>
              </span>
              <!-- WhatsApp Celular 2 -->
              <span v-if="tallerStore.tallerInfo.celular2" class="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" class="w-4 h-4 inline-block shrink-0 fill-[#25D366]">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.11 7.44C8.95 7.44 8.68 7.5 8.46 7.74C8.23 7.98 7.6 8.57 7.6 9.78C7.6 10.99 8.48 12.16 8.6 12.33C8.73 12.49 10.33 14.96 12.78 16.02C13.36 16.27 13.82 16.42 14.17 16.53C14.76 16.72 15.3 16.69 15.72 16.63C16.19 16.56 17.17 16.04 17.37 15.47C17.58 14.9 17.58 14.41 17.51 14.31C17.45 14.21 17.3 14.15 17.06 14.03C16.83 13.91 15.69 13.35 15.48 13.27C15.27 13.19 15.12 13.15 14.97 13.39C14.81 13.62 14.37 14.15 14.23 14.31C14.1 14.46 13.96 14.48 13.73 14.36C13.5 14.24 12.52 13.92 11.37 12.9C10.47 12.1 9.87 11.11 9.75 10.9C9.63 10.69 9.74 10.58 9.85 10.46C9.96 10.36 10.09 10.18 10.21 10.04C10.33 9.9 10.37 9.79 10.45 9.64C10.53 9.48 10.49 9.35 10.43 9.23C10.37 9.11 9.89 7.93 9.7 7.45C9.51 6.98 9.32 7.05 9.17 7.04C9.04 7.04 8.89 7.04 8.73 7.04"/>
                </svg>
                <span>Cel: {{ tallerStore.tallerInfo.celular2 }}</span>
              </span>
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

    <!-- 3. TABLA DE OPERACIONES Y REPUESTOS (ADAPTABLE: 1 SECCIÓN O 2 SECCIONES) -->
    
    <!-- CASO A: 1 SECCIÓN (COLUMNA ÚNICA COMPLETA) - Si cabe en 1 hoja -->
    <div v-if="!isDoubleSection" class="border-2 border-slate-900 rounded overflow-hidden bg-white mb-2">
      <table class="w-full text-[10px] border-collapse" style="table-layout: fixed;">
        <thead class="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase text-slate-900 text-[8.5px]">
          <tr>
            <th class="py-1 px-1.5 text-center w-12 border-r border-slate-400">CANT.</th>
            <th class="py-1 px-2 text-left border-r border-slate-400">OPERACIÓN DEL TRABAJO</th>
            <th class="py-1 px-2 text-right w-24 border-r border-slate-400">PRECIO U.</th>
            <th class="py-1 px-2 text-right w-24">VALOR</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="groupedSections.length > 0">
            <template v-for="section in groupedSections" :key="section.title">
              <!-- Encabezado de la Categoría (SIN FONDO NEGRO: Fondo claro y bordes para ahorrar tinta) -->
              <tr class="bg-slate-100 text-slate-900 font-black text-[9.5px] uppercase tracking-wider border-y border-slate-700">
                <td colspan="4" class="py-1 px-2">
                  <div class="flex justify-between items-center leading-normal">
                    <span>{{ section.title }}</span>
                    <span v-if="shouldShowSubtotals" class="text-[9px] font-semibold text-slate-600">Subtotal: ${{ section.subtotal.toFixed(2) }}</span>
                  </div>
                </td>
              </tr>

              <!-- Filas de operaciones / repuestos de la sección -->
              <tr
                v-for="item in section.items"
                :key="item.id"
                class="bg-white border-b border-slate-200"
              >
                <td class="py-1 px-1.5 text-center font-bold text-slate-900 border-r border-slate-200 align-middle text-[9.5px]">
                  {{ item.quantity }}
                </td>
                <td class="py-1 px-2 text-slate-900 border-r border-slate-200 align-middle leading-snug">
                  <span class="font-medium text-[10px]">{{ item.description }}</span>
                  <span v-if="item.detail" class="ml-1.5 text-[9px] font-bold text-slate-600">[{{ item.detail }}]</span>
                </td>
                <td class="py-1 px-2 text-right text-slate-700 border-r border-slate-200 align-middle text-[9.5px] font-mono">
                  ${{ item.unitPrice.toFixed(2) }}
                </td>
                <td class="py-1 px-2 text-right font-black text-slate-900 align-middle text-[10px]">
                  ${{ item.subtotal.toFixed(2) }}
                </td>
              </tr>
            </template>
          </template>
          <tr v-else class="border-b border-slate-200">
            <td colspan="4" class="py-8 px-2 text-center text-[10px] text-slate-400 italic">
              — Sin operaciones ni repuestos registrados —
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CASO B: 2 SECCIONES (DOBLE COLUMNA PARALELA) - Si no cabe en 1 sección en 1 hoja -->
    <div v-else class="border-2 border-slate-900 rounded overflow-hidden bg-white mb-2">
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
                      <!-- Encabezado de Sección: BIELAS, BANCADA, CIGÜEÑAL, CULATA (SIN FONDO NEGRO) -->
                      <tr class="bg-slate-100 text-slate-900 font-black text-[9px] uppercase tracking-wider border-y border-slate-700">
                        <td colspan="4" class="py-0.5 px-1.5">
                          <div class="flex justify-between items-center leading-normal">
                            <span>{{ section.title }}</span>
                            <span v-if="shouldShowSubtotals" class="text-[8.5px] font-semibold text-slate-600">Subtotal: ${{ section.subtotal.toFixed(2) }}</span>
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
                      <!-- Encabezado de Sección: BLOCKS, REPUESTOS (SIN FONDO NEGRO) -->
                      <tr class="bg-slate-100 text-slate-900 font-black text-[9px] uppercase tracking-wider border-y border-slate-700">
                        <td colspan="4" class="py-0.5 px-1.5">
                          <div class="flex justify-between items-center leading-normal">
                            <span>{{ section.title }}</span>
                            <span v-if="shouldShowSubtotals" class="text-[8.5px] font-semibold text-slate-600">Subtotal: ${{ section.subtotal.toFixed(2) }}</span>
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
              <div class="bg-slate-100 text-slate-900 font-black text-[8.5px] uppercase tracking-wider px-2 py-0.5 border-b border-slate-400">
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

          <!-- Derecha: Recuadro de Totales alineado a la derecha (SIN FONDOS NEGROS) -->
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
                <div class="flex justify-between items-center px-2.5 py-1.5 bg-slate-100 text-slate-900 font-black text-[10.5px] border-t-2 border-slate-900">
                  <span class="uppercase tracking-wider text-[8.5px]">TOTAL DEL TRABAJO $:</span>
                  <span class="text-xs font-mono font-black text-slate-900">${{ orderGrandTotal.toFixed(2) }}</span>
                </div>
              </div>
              <div v-else class="border-2 border-slate-900 rounded overflow-hidden bg-white text-[9.5px]">
                <div class="flex justify-between items-center px-2.5 py-1.5 bg-slate-100 text-slate-900 font-black text-xs border-t-2 border-slate-900">
                  <span class="uppercase tracking-wider text-[9px]">TOTAL $:</span>
                  <span class="text-sm text-slate-900 font-mono font-black">${{ orderGrandTotal.toFixed(2) }}</span>
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
