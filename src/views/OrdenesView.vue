<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useTallerStore } from '@/stores/taller'
import { ordersService, type Order } from '@/services/ordersService'
import { rutasService, type RutaSucursal } from '@/services/rutasService'
import { useAnimatedNumber } from '@/composables/useAnimatedNumber'
import WorkOrderForm from '@/components/WorkOrderForm.vue'
import WorkOrderPrintModal from '@/components/WorkOrderPrintModal.vue'
import WorkOrderDocument from '@/components/WorkOrderDocument.vue'
import OperationsManagerModal from '@/components/OperationsManagerModal.vue'
import { exportOrderToPdf } from '@/utils/pdfExport'
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Printer, 
  Download,
  Trash2, 
  Wrench, 
  CheckCircle2, 
  FileText, 
  Lock, 
  SlidersHorizontal,
  Copy,
  AlertCircle,
  MapPin
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUiStore()
const tallerStore = useTallerStore()

// Vistas: 'list' (listado) o 'form' (formulario de creación/edición)
const currentView = ref<'list' | 'form'>('list')
const selectedOrderId = ref<string | null>(null)

// Acciones de apertura del formulario
const openNewOrder = () => {
  selectedOrderId.value = null
  currentView.value = 'form'
}

const openEditOrder = (id: string) => {
  selectedOrderId.value = id
  currentView.value = 'form'
}

// Abrir formulario reactivamente si se solicita desde el Navbar
watch(
  () => uiStore.newOrderTrigger,
  (val) => {
    if (val > 0) {
      openNewOrder()
    }
  }
)

// Abrir formulario automáticamente si se solicita por parámetros de ruta
watch(
  () => [route.query.nueva, route.query.clienteId, route.query.cliente, route.query.id],
  ([nueva, clienteId, cliente, id]) => {
    if (id) {
      openEditOrder(id as string)
    } else if (nueva || clienteId || cliente) {
      openNewOrder()
    }
  },
  { immediate: true }
)

// Lista de órdenes y rutas
const orders = ref<Order[]>([])
const rutas = ref<RutaSucursal[]>([])
const searchQuery = ref('')
const selectedStatus = ref<string>('Todos')
const selectedType = ref<string>('Todos')
const selectedRutaFilter = ref<string>('ALL') // 'ALL' | 'UNASSIGNED' | <ruta.id>

// Sincronizar filtro de ruta con el query param ?ruta=<id>
watch(
  () => route.query.ruta,
  (rutaParam) => {
    if (typeof rutaParam === 'string' && rutaParam.trim()) {
      selectedRutaFilter.value = rutaParam.trim()
    }
  },
  { immediate: true }
)

// Modal de impresión rápida desde la lista
const printModalOpen = ref(false)
const orderToPrint = ref<Order | null>(null)

// Modal de gestión de operaciones y servicios
const showOperationsModal = ref(false)

const loadOrders = async () => {
  const [ordersData, rutasData] = await Promise.all([
    ordersService.getOrders(),
    rutasService.getRutas(),
  ])
  orders.value = ordersData
  rutas.value = rutasData
}

onMounted(async () => {
  if (!authStore.canAccess('/ordenes')) {
    router.replace(authStore.defaultRoute)
    return
  }
  await loadOrders()
})

function orderMatchesRuta(
  order: Order,
  targetRutaId?: string | null,
  targetRutaCodigo?: string | null,
  targetRutaNombre?: string | null
): boolean {
  if (targetRutaId && order.rutaId === targetRutaId) return true
  if (
    targetRutaCodigo &&
    order.rutaCodigo &&
    order.rutaCodigo.toLowerCase() === targetRutaCodigo.toLowerCase()
  ) {
    return true
  }
  if (
    targetRutaNombre &&
    order.rutaNombre &&
    order.rutaNombre.toLowerCase() === targetRutaNombre.toLowerCase()
  ) {
    return true
  }
  return false
}

// Órdenes visibles según el rol y la ruta seleccionada:
// - Si es Sub-Administrador: SOLO puede ver las órdenes de su ruta asignada
// - Si es Administrador General: ve todas o las filtradas por la ruta elegida
const scopedOrders = computed(() => {
  if (authStore.isSubAdmin) {
    return orders.value.filter((order) =>
      orderMatchesRuta(
        order,
        authStore.activeRutaId,
        authStore.activeRutaCodigo,
        authStore.activeRutaNombre
      )
    )
  }

  if (selectedRutaFilter.value === 'ALL') {
    return orders.value
  }
  if (selectedRutaFilter.value === 'UNASSIGNED') {
    return orders.value.filter((o) => !o.rutaId && !o.rutaNombre)
  }

  const targetRuta = rutas.value.find((r) => r.id === selectedRutaFilter.value)
  return orders.value.filter((o) =>
    orderMatchesRuta(
      o,
      selectedRutaFilter.value,
      targetRuta?.codigo,
      targetRuta?.nombre
    )
  )
})

function countOrdersForRuta(ruta: RutaSucursal): number {
  return orders.value.filter((o) =>
    orderMatchesRuta(o, ruta.id, ruta.codigo, ruta.nombre)
  ).length
}

const unassignedOrdersCount = computed(
  () => orders.value.filter((o) => !o.rutaId && !o.rutaNombre).length
)

const handleAssignOrderRuta = async (order: Order, newRutaId: string) => {
  const foundRuta = rutas.value.find((r) => r.id === newRutaId)
  await ordersService.updateOrder(order.id, {
    rutaId: foundRuta ? foundRuta.id : undefined,
    rutaCodigo: foundRuta ? foundRuta.codigo : undefined,
    rutaNombre: foundRuta ? foundRuta.nombre : undefined,
  })
  await loadOrders()
  showToast(
    foundRuta
      ? `Orden ${order.orderNumber} asignada a ${foundRuta.codigo} · ${foundRuta.nombre}.`
      : `Orden ${order.orderNumber} marcada como General (sin ruta específica).`,
    'info'
  )
}

const filteredOrders = computed(() => {
  return scopedOrders.value.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (order.workshop && order.workshop.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (order.vehicleBrand && order.vehicleBrand.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (order.vehicleModel && order.vehicleModel.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (order.engine && order.engine.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (order.rutaNombre && order.rutaNombre.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (order.rutaCodigo && order.rutaCodigo.toLowerCase().includes(searchQuery.value.toLowerCase()))

    const matchesStatus = 
      selectedStatus.value === 'Todos' || order.status === selectedStatus.value

    const matchesType = 
      selectedType.value === 'Todos' || order.type === selectedType.value

    return matchesSearch && matchesStatus && matchesType
  })
})

const openPrintOrder = (order: Order) => {
  orderToPrint.value = order
  printModalOpen.value = true
}

// Descarga directa de orden/cotización en formato PDF
const downloadingOrderId = ref<string | null>(null)
const orderForDownload = ref<Order | null>(null)
const downloadContainerRef = ref<HTMLElement | null>(null)

const handleDownloadOrder = async (order: Order) => {
  if (downloadingOrderId.value) return
  downloadingOrderId.value = order.id
  orderForDownload.value = order

  try {
    await tallerStore.loadTallerInfo()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 80))

    if (downloadContainerRef.value) {
      const docElement = downloadContainerRef.value.querySelector('#printable-work-order') as HTMLElement || downloadContainerRef.value
      await exportOrderToPdf(docElement, order)
      showToast(
        `${order.type === 'cotizacion' ? 'Cotización' : 'Orden'} ${order.orderNumber} descargada exitosamente en PDF.`,
        'success'
      )
    }
  } catch (error) {
    console.error('Error al descargar orden en PDF:', error)
    showToast(
      `No se pudo generar el PDF de la orden ${order.orderNumber}. Puedes abrir la vista previa e imprimirla en PDF.`,
      'error'
    )
  } finally {
    orderForDownload.value = null
    downloadingOrderId.value = null
  }
}

const isDuplicating = ref<string | null>(null)
const toastMessage = ref<{ text: string; type: 'success' | 'info' | 'error'; orderId?: string } | null>(null)
let toastTimeout: any = null

const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success', orderId?: string) => {
  if (toastTimeout) clearTimeout(toastTimeout)
  toastMessage.value = { text, type, orderId }
  toastTimeout = setTimeout(() => {
    toastMessage.value = null
  }, 5000)
}

const handleDuplicateOrder = async (order: Order) => {
  const confirmDuplicate = confirm(
    `¿Deseas duplicar la orden ${order.orderNumber}?\n\nSe creará una nueva orden con un número consecutivo nuevo, manteniendo las operaciones, repuestos y datos del motor, con la información del cliente y taller en blanco.`
  )
  if (!confirmDuplicate) return

  isDuplicating.value = order.id
  try {
    const duplicated = await ordersService.duplicateOrder(order.id)
    if (duplicated) {
      await loadOrders()
      showToast(
        `Orden ${order.orderNumber} duplicada exitosamente como ${duplicated.orderNumber} con cliente/taller en blanco.`,
        'success',
        duplicated.id
      )
    } else {
      showToast('No se pudo duplicar la orden.', 'error')
    }
  } catch (err) {
    console.error('Error al duplicar orden:', err)
    showToast('Error al conectar con la base de datos al duplicar la orden.', 'error')
  } finally {
    isDuplicating.value = null
  }
}

const handleDeleteOrder = async (id: string) => {
  if (confirm('¿Estás seguro de que deseas eliminar esta orden de trabajo?')) {
    await ordersService.deleteOrder(id)
    await loadOrders()
  }
}

const handleOrderSaved = async () => {
  await loadOrders()
  currentView.value = 'list'
  selectedOrderId.value = null
  if (route.query.nueva || route.query.clienteId || route.query.cliente) {
    router.replace({ path: '/ordenes' })
  }
}

const handleCloseForm = () => {
  currentView.value = 'list'
  selectedOrderId.value = null
  if (route.query.nueva || route.query.clienteId || route.query.cliente) {
    router.replace({ path: '/ordenes' })
  }
}

const getStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'Terminado':
    case 'Completada':
      return 'bg-cyan-50 text-[#038391] border-cyan-300'
    case 'En Proceso':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'Recibido':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'Diagnóstico':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Pendiente':
      return 'bg-[#F6F0E4] text-[#6E5835] border-[#E6DAC2]'
    case 'Entregado':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'Cancelada':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

// Estadísticas rápidas (calculadas sobre el alcance visible o ruta filtrada)
const totalOrdersCount = computed(() => scopedOrders.value.length)
const activeOrdersCount = computed(() => scopedOrders.value.filter(o => o.status === 'En Proceso' || o.status === 'Diagnóstico' || o.status === 'Recibido').length)
const completedOrdersCount = computed(() => scopedOrders.value.filter(o => o.status === 'Terminado' || o.status === 'Entregado' || o.status === 'Completada').length)
const totalBilled = computed(() => scopedOrders.value.reduce((acc, curr) => acc + (curr.total || 0), 0))

const animatedTotalOrders = useAnimatedNumber(() => totalOrdersCount.value, 460)
const animatedActiveOrders = useAnimatedNumber(() => activeOrdersCount.value, 460)
const animatedCompletedOrders = useAnimatedNumber(() => completedOrdersCount.value, 460)
const animatedTotalBilled = useAnimatedNumber(() => totalBilled.value, 520)
</script>

<template>
  <div v-if="authStore.canAccess('/ordenes')" class="space-y-6">
    
    <!-- Vista 1: Formulario de Nueva Orden / Edición (Basado en Diego/html/index.html) -->
    <div v-if="currentView === 'form'">
      <WorkOrderForm
        :initial-order-id="selectedOrderId"
        :default-ruta-id="selectedRutaFilter"
        @close="handleCloseForm"
        @saved="handleOrderSaved"
      />
    </div>

    <!-- Vista 2: Listado de Órdenes y Cotizaciones -->
    <div v-else class="space-y-6">

      <!-- Banner Hero de Órdenes -->
      <section class="studio-hero-banner p-6 sm:p-7 text-white relative overflow-hidden">
        <div class="pointer-events-none absolute -top-16 -right-12 w-60 h-60 rounded-full bg-[#04C4D9]/25 blur-3xl"></div>
        <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15">
              <span class="w-2 h-2 rounded-full bg-[#BFEBF2] animate-pulse"></span>
              <span class="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#BFEBF2]">
                ÓRDENES · TALLER DE RECTIFICACIÓN
              </span>
            </div>
            <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Órdenes de Trabajo y Cotizaciones
            </h1>
            <p class="text-xs sm:text-sm text-sky-100/85 max-w-xl">
              Gestión y seguimiento de rectificación por componentes: Bielas, Bancadas, Cigüeñal, Culata y Block.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              @click="showOperationsModal = true"
              class="inline-flex items-center px-3.5 py-2.5 text-xs font-bold text-white bg-white/12 hover:bg-white/20 active:scale-[0.97] border border-white/20 rounded-xl transition-all duration-150 cursor-pointer"
              title="Editar y administrar la lista de operaciones y servicios del taller"
            >
              <SlidersHorizontal class="w-4 h-4 mr-1.5 text-[#BFEBF2]" />
              Operaciones y Servicios
            </button>

            <button
              type="button"
              @click="openNewOrder"
              class="studio-cta-primary inline-flex items-center px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl cursor-pointer"
            >
              <Plus class="w-4 h-4 mr-1.5 stroke-[2.5]" />
              Nueva Orden de Trabajo
            </button>
          </div>
        </div>

        <!-- Banner Exclusivo para Sub-Administrador de Ruta -->
        <div
          v-if="authStore.isSubAdmin"
          class="relative z-10 mt-5 bg-[#15365A] text-white border border-white/15 rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="space-y-0.5">
            <div class="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#BFEBF2]">
              <MapPin class="w-3.5 h-3.5 text-[#BFEBF2]" />
              <span>Ruta Asignada · {{ authStore.activeRutaCodigo ? `${authStore.activeRutaCodigo} · ` : '' }}{{ authStore.activeRutaNombre || 'Ruta' }}</span>
            </div>
            <p class="text-xs text-sky-100/90">
              Visualizando y administrando únicamente las órdenes de trabajo y cotizaciones pertenecientes a tu ruta asignada.
            </p>
          </div>
          <div class="shrink-0">
            <button
              type="button"
              @click="openNewOrder"
              class="studio-cta-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              <Plus class="w-4 h-4 stroke-[2.5]" />
              <span>Crear Orden en {{ authStore.activeRutaCodigo || 'mi Ruta' }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Barra de Filtrado por Ruta / Sucursal para Administrador General -->
      <section
        v-if="authStore.isGlobalAdmin"
        class="studio-card p-4 sm:p-5 space-y-3"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] flex items-center justify-center">
              <MapPin class="w-4 h-4" />
            </span>
            <span class="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1B4978]">
              Filtrar por Ruta / Sucursal
            </span>
            <span class="text-xs text-slate-500 hidden md:inline">
              · Todas las órdenes o filtra por sucursal y Sub-Administrador
            </span>
          </div>

          <button
            type="button"
            @click="router.push('/rutas')"
            class="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-[#004B97] text-[#004B97] hover:text-white border border-blue-200/80 px-3 py-1.5 text-[11px] font-bold active:scale-[0.98] transition-all duration-150 cursor-pointer self-start sm:self-auto"
          >
            <MapPin class="w-3.5 h-3.5" />
            <span>Administrar Rutas ({{ rutas.length }})</span>
          </button>
        </div>

        <div class="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            @click="selectedRutaFilter = 'ALL'"
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer border',
              selectedRutaFilter === 'ALL'
                ? 'bg-[#004B97] text-white border-[#004B97] shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#04C4D9] hover:bg-blue-50/40'
            ]"
          >
            <span>Todas las rutas</span>
            <span
              class="font-mono px-1.5 py-0.5 rounded-md text-[10px]"
              :class="selectedRutaFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'"
            >
              {{ orders.length }}
            </span>
          </button>

          <button
            v-for="r in rutas"
            :key="r.id"
            type="button"
            @click="selectedRutaFilter = r.id"
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer border',
              selectedRutaFilter === r.id
                ? 'bg-[#1E446E] text-white border-[#1E446E] shadow-sm'
                : 'bg-slate-50 text-[#0F1E2E] border-slate-200 hover:border-[#9AD2DC] hover:bg-[#F4F8FC]'
            ]"
          >
            <span
              class="font-mono text-[11px] font-black"
              :class="selectedRutaFilter === r.id ? 'text-[#BFEBF2]' : 'text-[#147488]'"
            >
              {{ r.codigo }}
            </span>
            <span>{{ r.nombre }}</span>
            <span
              class="font-mono px-1.5 py-0.5 rounded-md text-[10px] font-extrabold"
              :class="selectedRutaFilter === r.id ? 'bg-white/20 text-white' : 'bg-white text-[#0D1B3E] border border-slate-200'"
            >
              {{ countOrdersForRuta(r) }}
            </span>
          </button>

          <button
            type="button"
            @click="selectedRutaFilter = 'UNASSIGNED'"
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer border',
              selectedRutaFilter === 'UNASSIGNED'
                ? 'bg-[#004B97] text-white border-[#004B97] shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#04C4D9]'
            ]"
          >
            <span>General / Sin ruta</span>
            <span
              class="font-mono px-1.5 py-0.5 rounded-md text-[10px]"
              :class="selectedRutaFilter === 'UNASSIGNED' ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'"
            >
              {{ unassignedOrdersCount }}
            </span>
          </button>
        </div>
      </section>

      <!-- Tarjetas KPI Animadas -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div class="studio-kpi-card workshop-stagger-1 p-5 flex flex-col justify-between">
          <div class="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#004B97]/12"></div>
          <div class="relative z-10 flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Órdenes</span>
            <span class="w-8 h-8 rounded-xl bg-blue-50 text-[#004B97] border border-blue-100 flex items-center justify-center shrink-0">
              <FileText class="w-4 h-4" />
            </span>
          </div>
          <div class="relative z-10 font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#0D1B3E] mt-2">
            {{ Math.round(animatedTotalOrders) }}
          </div>
          <div class="relative z-10 mt-3 pt-2.5 border-t border-slate-100 font-mono text-[10px] text-slate-500">
            Registro total en sistema
          </div>
        </div>

        <div class="studio-kpi-card workshop-stagger-2 p-5 flex flex-col justify-between">
          <div class="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#E3F5F8]"></div>
          <div class="relative z-10 flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] font-bold text-[#1B4978] uppercase tracking-wider">En Taller / Proceso</span>
            <span class="w-8 h-8 rounded-xl bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] flex items-center justify-center shrink-0">
              <Wrench class="w-4 h-4" />
            </span>
          </div>
          <div class="relative z-10 font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#004B97] mt-2">
            {{ Math.round(animatedActiveOrders) }}
          </div>
          <div class="relative z-10 mt-3 pt-2.5 border-t border-slate-100 font-mono text-[10px] text-slate-500">
            Órdenes activas en banco
          </div>
        </div>

        <div class="studio-kpi-card workshop-stagger-3 p-5 flex flex-col justify-between">
          <div class="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#04C4D9]/12"></div>
          <div class="relative z-10 flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] font-bold text-[#038391] uppercase tracking-wider">Terminadas</span>
            <span class="w-8 h-8 rounded-xl bg-[#E3F5F8] text-[#038391] border border-[#C1E8EF] flex items-center justify-center shrink-0">
              <CheckCircle2 class="w-4 h-4" />
            </span>
          </div>
          <div class="relative z-10 font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#038391] mt-2">
            {{ Math.round(animatedCompletedOrders) }}
          </div>
          <div class="relative z-10 mt-3 pt-2.5 border-t border-slate-100 font-mono text-[10px] text-slate-500">
            Listas para entrega
          </div>
        </div>

        <div v-if="authStore.isGlobalAdmin || authStore.isSubAdmin" class="studio-kpi-card workshop-stagger-4 p-5 flex flex-col justify-between">
          <div class="relative z-10 flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] font-bold text-[#6E5835] uppercase tracking-wider">
              {{ authStore.isSubAdmin ? 'Facturación de Ruta' : 'Facturación Total' }}
            </span>
            <span class="w-8 h-8 rounded-xl bg-[#F6F0E4] text-[#6E5835] border border-[#E6DAC2] flex items-center justify-center font-mono text-xs font-black shrink-0">
              $
            </span>
          </div>
          <div class="relative z-10 font-display tabular-nums text-xl sm:text-2xl font-extrabold text-[#162436] mt-2 truncate">
            ${{ animatedTotalBilled.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
          <div class="relative z-10 mt-3 pt-2.5 border-t border-slate-100 font-mono text-[10px] text-slate-500">
            Acumulado del filtro actual
          </div>
        </div>
        <div v-else class="studio-kpi-card workshop-stagger-4 p-5 flex flex-col justify-between">
          <div class="relative z-10 flex items-center justify-between gap-2">
            <span class="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Control Operacional</span>
            <span class="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
              <Lock class="w-4 h-4" />
            </span>
          </div>
          <div class="relative z-10 mt-3">
            <span class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 text-[#162436] border border-slate-200">
              <Lock class="w-3 h-3 text-slate-500" />
              Montos Reservados
            </span>
          </div>
          <div class="relative z-10 mt-3 pt-2.5 border-t border-slate-100 font-mono text-[10px] text-slate-400">
            Acceso financiero exclusivo a Admin
          </div>
        </div>
      </div>

      <!-- Tabla Elevada de Órdenes + Barra de Búsqueda y Filtros -->
      <div class="studio-card overflow-hidden">
        <!-- Barra de Herramientas Luminosa -->
        <div class="bg-[#F4F8FC] border-b border-slate-100 px-4 py-3.5 sm:px-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <!-- Input de búsqueda -->
          <div class="relative w-full md:w-96">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search class="w-4 h-4" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por N° de orden, cliente, taller o vehículo..."
              class="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-[#0D1B3E] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20 transition-all"
            />
          </div>

          <!-- Filtros por Tipo y Estado -->
          <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto pb-0.5 md:pb-0">
            <!-- Filtro por Tipo (Orden vs Cotización) -->
            <div class="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
              <button
                v-for="tOpt in [
                  { value: 'Todos', label: 'Todos' },
                  { value: 'orden', label: 'Órdenes' },
                  { value: 'cotizacion', label: 'Cotizaciones' }
                ]"
                :key="tOpt.value"
                type="button"
                @click="selectedType = tOpt.value"
                :class="[
                  'px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer',
                  selectedType === tOpt.value
                    ? 'bg-[#004B97] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0D1B3E] hover:bg-white/70'
                ]"
              >
                {{ tOpt.label }}
              </button>
            </div>

            <div class="flex items-center gap-1.5 overflow-x-auto">
              <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5 flex items-center gap-1">
                <Filter class="w-3.5 h-3.5 text-[#147488]" /> Estado:
              </span>
              <button
                v-for="status in ['Todos', 'En Proceso', 'Pendiente']"
                :key="status"
                type="button"
                @click="selectedStatus = status"
                :class="[
                  'px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer border',
                  selectedStatus === status
                    ? 'bg-[#147488] text-white border-[#147488] shadow-sm'
                    : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-white hover:border-[#9AD2DC]'
                ]"
              >
                {{ status }}
              </button>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs min-w-[760px]">
            <thead class="studio-table-head font-mono text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th class="px-5 py-3.5">N° Orden</th>
                <th class="px-5 py-3.5">Ruta / Sucursal</th>
                <th class="px-5 py-3.5">Cliente / Taller</th>
                <th class="px-5 py-3.5">Vehículo / Motor</th>
                <th class="px-5 py-3.5">Fecha</th>
                <th class="px-5 py-3.5 text-center">Tipo</th>
                <th class="px-5 py-3.5">Estado</th>
                <th v-if="authStore.isGlobalAdmin || authStore.isSubAdmin" class="px-5 py-3.5 text-right">Total ($)</th>
                <th v-else class="px-5 py-3.5 text-center">Operación / Ítems</th>
                <th class="px-5 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="order in filteredOrders"
                :key="order.id"
                class="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                @click="openEditOrder(order.id)"
              >
                <td class="px-5 py-3.5">
                  <span class="font-mono tabular-nums font-bold text-[#004B97] bg-blue-50 border border-blue-200/70 px-2.5 py-1 rounded-lg inline-block group-hover:bg-[#004B97] group-hover:text-white transition-colors">
                    {{ order.orderNumber }}
                  </span>
                </td>
                <td class="px-5 py-3.5" @click.stop>
                  <!-- Si es Administrador General y hay rutas creadas: selector rápido de ruta -->
                  <div v-if="authStore.isGlobalAdmin && rutas.length > 0">
                    <select
                      :value="order.rutaId || ''"
                      @change="handleAssignOrderRuta(order, ($event.target as HTMLSelectElement).value)"
                      class="rounded-full px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#04C4D9]"
                      :class="
                        order.rutaId || order.rutaNombre
                          ? 'bg-blue-50 text-[#004B97] border-blue-200 hover:border-[#04C4D9]'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-[#04C4D9]'
                      "
                      title="Cambiar ruta asignada a esta orden"
                    >
                      <option value="" class="bg-white text-slate-800">General (Sin ruta)</option>
                      <option
                        v-for="r in rutas"
                        :key="r.id"
                        :value="r.id"
                        class="bg-white text-slate-900"
                      >
                        {{ r.codigo }} · {{ r.nombre }}
                      </option>
                    </select>
                  </div>
                  <!-- Badge informativo de la ruta -->
                  <span
                    v-else-if="order.rutaNombre || order.rutaCodigo"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-[#004B97] border border-blue-200"
                  >
                    <MapPin class="w-3 h-3 text-[#04C4D9]" />
                    <span>{{ order.rutaCodigo ? `${order.rutaCodigo} · ` : '' }}{{ order.rutaNombre }}</span>
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"
                  >
                    General
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <div class="font-bold text-[#0D1B3E]">{{ order.customer || '— Sin Asignar —' }}</div>
                  <div v-if="order.workshop" class="text-[11px] text-[#004B97] font-medium">{{ order.workshop }}</div>
                  <div v-else-if="!order.customer" class="text-[11px] text-amber-600 font-semibold">Cliente por asignar</div>
                </td>
                <td class="px-5 py-3.5 text-slate-700">
                  <div class="font-semibold text-[#0D1B3E]">{{ [order.vehicleBrand, order.vehicleModel || order.engine].filter(Boolean).join(' ') || 'Motor de banco' }}</div>
                  <div v-if="order.engineType && order.engineType !== (order.vehicleModel || order.engine)" class="text-[11px] text-slate-400">{{ order.engineType }}</div>
                </td>
                <td class="px-5 py-3.5 font-mono tabular-nums text-slate-500 text-[11px]">
                  {{ order.date }}
                </td>
                <td class="px-5 py-3.5 text-center">
                  <span
                    :class="[
                      'inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider',
                      order.type === 'cotizacion'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-cyan-50 text-[#004B97] border border-cyan-200'
                    ]"
                  >
                    {{ order.type === 'cotizacion' ? 'Cotización' : 'Orden' }}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border',
                      getStatusBadge(order.status)
                    ]"
                  >
                    {{ order.status }}
                  </span>
                </td>
                <td v-if="authStore.isGlobalAdmin || authStore.isSubAdmin" class="px-5 py-3.5 text-right font-mono tabular-nums font-extrabold text-[#0D1B3E]">
                  ${{ order.total.toFixed(2) }}
                </td>
                <td v-else class="px-5 py-3.5 text-center">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                    title="Visible solo para Administrador"
                  >
                    <Lock class="w-3.5 h-3.5 text-slate-400" />
                    <span>Operativa / En Taller</span>
                  </span>
                </td>
                <td class="px-5 py-3.5 text-center" @click.stop>
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      @click="openEditOrder(order.id)"
                      class="p-1.5 text-slate-400 hover:text-[#004B97] hover:bg-blue-50 rounded-xl transition active:scale-95"
                      title="Editar orden"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      @click="handleDuplicateOrder(order)"
                      :disabled="isDuplicating === order.id"
                      class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition active:scale-95 disabled:opacity-50"
                      title="Duplicar orden (nuevo número, cliente en blanco)"
                    >
                      <Copy class="w-4 h-4" :class="{ 'animate-pulse text-indigo-600': isDuplicating === order.id }" />
                    </button>
                    <button
                      type="button"
                      @click="openPrintOrder(order)"
                      class="p-1.5 text-slate-400 hover:text-[#0D1B3E] hover:bg-slate-100 rounded-xl transition active:scale-95"
                      title="Imprimir (Clean Print)"
                    >
                      <Printer class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      @click="handleDownloadOrder(order)"
                      :disabled="downloadingOrderId === order.id"
                      class="p-1.5 text-slate-400 hover:text-[#038391] hover:bg-cyan-50 rounded-xl transition active:scale-95 disabled:opacity-50"
                      :title="`Descargar ${order.type === 'cotizacion' ? 'cotización' : 'orden'} (PDF)`"
                    >
                      <Download class="w-4 h-4" :class="{ 'animate-bounce text-[#038391]': downloadingOrderId === order.id }" />
                    </button>
                    <button
                      type="button"
                      @click="handleDeleteOrder(order.id)"
                      class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition active:scale-95"
                      title="Eliminar orden"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredOrders.length === 0">
                <td colspan="9" class="px-6 py-12 text-center text-slate-400 text-xs">
                  No se encontraron órdenes ni cotizaciones con los criterios seleccionados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal de Impresión rápida -->
    <WorkOrderPrintModal
      :is-open="printModalOpen"
      :order="orderToPrint"
      @close="printModalOpen = false"
    />

    <!-- Modal de Administración de Operaciones y Servicios -->
    <OperationsManagerModal
      v-if="showOperationsModal"
      @close="showOperationsModal = false"
    />

    <!-- Contenedor fuera de pantalla para descarga directa en PDF desde la tabla -->
    <div
      v-if="orderForDownload"
      class="fixed top-0 left-0 w-[780px] bg-white pointer-events-none"
      style="z-index: -9999;"
      aria-hidden="true"
    >
      <div ref="downloadContainerRef" class="bg-white">
        <WorkOrderDocument :order="orderForDownload" variant="pdf" />
      </div>
    </div>

    <!-- Toast Flotante de Notificaciones -->
    <transition
      enter-active-class="transform transition ease-out duration-300"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="toastMessage" 
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold max-w-md backdrop-blur-md"
        :class="[
          toastMessage.type === 'success' ? 'bg-[#0D1B3E]/95 text-[#BFEBF2] border-[#04C4D9]/50' : 
          toastMessage.type === 'error' ? 'bg-rose-950/90 text-rose-200 border-rose-500/50' : 
          'bg-slate-950/90 text-slate-200 border-slate-600'
        ]"
      >
        <CheckCircle2 v-if="toastMessage.type === 'success'" class="w-5 h-5 text-[#04C4D9] flex-shrink-0" />
        <AlertCircle v-else class="w-5 h-5 text-rose-400 flex-shrink-0" />
        <div class="flex-1">
          <span>{{ toastMessage.text }}</span>
          <button 
            v-if="toastMessage.orderId" 
            type="button" 
            @click="openEditOrder(toastMessage.orderId!)"
            class="block mt-1 text-xs font-bold text-[#BFEBF2] hover:underline"
          >
            Abrir orden para asignar cliente &rarr;
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
