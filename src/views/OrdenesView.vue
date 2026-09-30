<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ordersService, type Order } from '@/services/ordersService'
import WorkOrderForm from '@/components/WorkOrderForm.vue'
import WorkOrderPrintModal from '@/components/WorkOrderPrintModal.vue'
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Printer,
  Trash2,
  Wrench,
  CheckCircle2,
  FileText,
  Lock
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// Vistas: 'list' (listado) o 'form' (formulario de creación/edición)
const currentView = ref<'list' | 'form'>('list')
const selectedOrderId = ref<string | null>(null)

// Lista de órdenes
const orders = ref<Order[]>([])
const searchQuery = ref('')
const selectedStatus = ref<string>('Todos')
const selectedType = ref<string>('Todos')

// Modal de impresión rápida desde la lista
const printModalOpen = ref(false)
const orderToPrint = ref<Order | null>(null)

const loadOrders = async () => {
  orders.value = await ordersService.getOrders()
}

onMounted(async () => {
  if (!authStore.canAccess('/ordenes')) {
    router.replace(authStore.defaultRoute)
    return
  }
  await loadOrders()
})

const filteredOrders = computed(() => {
  return orders.value.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (order.workshop && order.workshop.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (order.vehicleBrand && order.vehicleBrand.toLowerCase().includes(searchQuery.value.toLowerCase()))

    const matchesStatus = 
      selectedStatus.value === 'Todos' || order.status === selectedStatus.value

    const matchesType = 
      selectedType.value === 'Todos' || order.type === selectedType.value

    return matchesSearch && matchesStatus && matchesType
  })
})

// Acciones
const openNewOrder = () => {
  selectedOrderId.value = null
  currentView.value = 'form'
}

const openEditOrder = (id: string) => {
  selectedOrderId.value = id
  currentView.value = 'form'
}

const openPrintOrder = (order: Order) => {
  orderToPrint.value = order
  printModalOpen.value = true
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
}

const getStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'Terminado':
    case 'Completada':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'En Proceso':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'Recibido':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'Diagnóstico':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Pendiente':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'Entregado':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'Cancelada':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

// Estadísticas rápidas
const totalOrdersCount = computed(() => orders.value.length)
const activeOrdersCount = computed(() => orders.value.filter(o => o.status === 'En Proceso' || o.status === 'Diagnóstico' || o.status === 'Recibido').length)
const completedOrdersCount = computed(() => orders.value.filter(o => o.status === 'Terminado' || o.status === 'Entregado' || o.status === 'Completada').length)
const totalBilled = computed(() => orders.value.reduce((acc, curr) => acc + (curr.total || 0), 0))
</script>

<template>
  <div v-if="authStore.canAccess('/ordenes')" class="space-y-6">
    
    <!-- Vista 1: Formulario de Nueva Orden / Edición (Basado en Diego/html/index.html) -->
    <div v-if="currentView === 'form'">
      <WorkOrderForm
        :initial-order-id="selectedOrderId"
        @close="currentView = 'list'"
        @saved="handleOrderSaved"
      />
    </div>

    <!-- Vista 2: Listado de Órdenes y Cotizaciones -->
    <div v-else class="space-y-6">
      <!-- Encabezado -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Órdenes de Trabajo y Cotizaciones</h1>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">
              Taller de Rectificación
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Gestión y seguimiento de rectificación por componentes: Bielas, Bancadas, Cigüeñal, Culata y Block.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="openNewOrder"
            class="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-xl shadow-sm transition"
          >
            <Plus class="w-4 h-4 mr-1.5" />
            Nueva Orden de Trabajo
          </button>
        </div>
      </div>

      <!-- Tarjetas de Métricas Rápidas -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Órdenes</span>
            <div class="text-2xl font-black text-slate-900 mt-0.5">{{ totalOrdersCount }}</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <FileText class="w-5 h-5" />
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider">En Taller / Proceso</span>
            <div class="text-2xl font-black text-cyan-700 mt-0.5">{{ activeOrdersCount }}</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-[#04c4d9]">
            <Wrench class="w-5 h-5" />
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Terminadas</span>
            <div class="text-2xl font-black text-emerald-700 mt-0.5">{{ completedOrdersCount }}</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 class="w-5 h-5" />
          </div>
        </div>

        <div v-if="authStore.user?.role === 'Administrador'" class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Facturación Total</span>
            <div class="text-2xl font-black text-slate-900 mt-0.5">${{ totalBilled.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}</div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
            $
          </div>
        </div>
        <div v-else class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Control Operacional</span>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                <Lock class="w-3 h-3 text-slate-400" />
                Montos Reservados
              </span>
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5">Acceso financiero exclusivo a Admin</p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <Lock class="w-5 h-5" />
          </div>
        </div>
      </div>

      <!-- Filtros y Búsqueda -->
      <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <!-- Input de búsqueda -->
        <div class="relative w-full md:w-96">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search class="w-4 h-4" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por N° de orden, cliente, taller o vehículo..."
            class="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9]"
          />
        </div>

        <!-- Filtros por Estado -->
        <div class="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span class="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter class="w-3.5 h-3.5" /> Estado:
          </span>
          <button
            v-for="status in ['Todos', 'Recibido', 'Diagnóstico', 'En Proceso', 'Terminado', 'Entregado']"
            :key="status"
            type="button"
            @click="selectedStatus = status"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition',
              selectedStatus === status
                ? 'bg-[#04c4d9] text-white shadow-xs'
                : 'text-slate-600 bg-slate-100 hover:bg-slate-200',
            ]"
          >
            {{ status }}
          </button>
        </div>
      </div>

      <!-- Tabla de Órdenes -->
      <div class="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs min-w-[760px]">
            <thead class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-5 py-3">N° Orden</th>
                <th class="px-5 py-3">Cliente / Taller</th>
                <th class="px-5 py-3">Vehículo / Motor</th>
                <th class="px-5 py-3">Fecha</th>
                <th class="px-5 py-3 text-center">Tipo</th>
                <th class="px-5 py-3">Estado</th>
                <th v-if="authStore.user?.role === 'Administrador'" class="px-5 py-3 text-right">Total ($)</th>
                <th v-else class="px-5 py-3 text-center">Operación / Ítems</th>
                <th class="px-5 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="order in filteredOrders"
                :key="order.id"
                class="hover:bg-slate-50/70 transition cursor-pointer"
                @click="openEditOrder(order.id)"
              >
                <td class="px-5 py-3.5 font-bold text-[#04c4d9]">
                  {{ order.orderNumber }}
                </td>
                <td class="px-5 py-3.5">
                  <div class="font-bold text-slate-900">{{ order.customer }}</div>
                  <div v-if="order.workshop" class="text-[10px] text-slate-400">{{ order.workshop }}</div>
                </td>
                <td class="px-5 py-3.5 text-slate-700">
                  <div class="font-medium">{{ [order.vehicleBrand, order.vehicleModel].filter(Boolean).join(' ') || 'Motor de banco' }}</div>
                  <div v-if="order.engineType" class="text-[10px] text-slate-400">{{ order.engineType }}</div>
                </td>
                <td class="px-5 py-3.5 text-slate-500">
                  {{ order.date }}
                </td>
                <td class="px-5 py-3.5 text-center">
                  <span
                    :class="[
                      'inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                      order.type === 'cotizacion'
                        ? 'bg-slate-100 text-slate-700 border border-slate-300'
                        : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                    ]"
                  >
                    {{ order.type === 'cotizacion' ? 'Cotización' : 'Orden' }}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <span
                    :class="[
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                      getStatusBadge(order.status)
                    ]"
                  >
                    {{ order.status }}
                  </span>
                </td>
                <td v-if="authStore.user?.role === 'Administrador'" class="px-5 py-3.5 text-right font-black text-slate-900">
                  ${{ order.total.toFixed(2) }}
                </td>
                <td v-else class="px-5 py-3.5 text-center">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200" title="Montos financieros restringidos para administradores">
                    <Wrench class="w-3.5 h-3.5 text-[#04c4d9]" />
                    <span>{{ (order.parts?.length || 0) + (order.operations?.length || 0) }} ítems</span>
                  </span>
                </td>
                <td class="px-5 py-3.5 text-center" @click.stop>
                  <div class="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      @click="openEditOrder(order.id)"
                      class="p-1.5 text-slate-400 hover:text-[#04c4d9] hover:bg-cyan-50 rounded-lg transition"
                      title="Editar orden"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      @click="openPrintOrder(order)"
                      class="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Imprimir (Clean Print)"
                    >
                      <Printer class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      @click="handleDeleteOrder(order.id)"
                      class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar orden"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredOrders.length === 0">
                <td colspan="8" class="px-6 py-12 text-center text-slate-400 text-xs">
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
  </div>
</template>
