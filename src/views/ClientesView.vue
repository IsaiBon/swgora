<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { clientesService, type Cliente, type ClienteInsert, type ClientStatus } from '@/services/clientesService'
import { ordersService, type Order } from '@/services/ordersService'
import { useAnimatedNumber } from '@/composables/useAnimatedNumber'
import ClientCard from '@/components/ClientCard.vue'
import ClientModal from '@/components/ClientModal.vue'
import ClientOrdersHistoryModal from '@/components/ClientOrdersHistoryModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  Search,
  Plus,
  RotateCcw,
  CheckCircle,
  Users,
  Wrench,
  DollarSign
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// State: Clientes activos por defecto
const clients = ref<Cliente[]>([])
const orders = ref<Order[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedType = ref<string>('Todos')
const selectedStatus = ref<string>('Activo')
const isModalOpen = ref(false)
const clientToEdit = ref<Cliente | null>(null)
const toastMessage = ref('')

// Historial de Órdenes del Cliente
const isOrdersModalOpen = ref(false)
const selectedClientForOrders = ref<Cliente | null>(null)

const typeCategories = ['Todos', 'Cliente', 'Tallerista']
const statusCategories = ['Todos', 'Activo', 'Inactivo']

// Vinculación de orden a cliente
const isOrderOfClient = (order: Order, client: Cliente): boolean => {
  const cId = (client.id || '').toLowerCase().trim()
  const cCode = (client.codigo || '').toLowerCase().trim()
  const cName = (client.nombre || '').toLowerCase().trim()
  const cTaller = (client.especificaciones_tecnicas?.taller || '').toLowerCase().trim()
  const cEmpresa = (client.especificaciones_tecnicas?.empresa || '').toLowerCase().trim()

  const oCustId = (order.customerId || '').toLowerCase().trim()
  const oCustCode = (order.customerCode || '').toLowerCase().trim()
  const oWsCode = (order.workshopCode || '').toLowerCase().trim()
  const oCustomer = (order.customer || '').toLowerCase().trim()
  const oWorkshop = (order.workshop || '').toLowerCase().trim()

  if (cId && oCustId && oCustId === cId) return true
  if (cCode && (oCustCode === cCode || oWsCode === cCode)) return true

  if (cName && (oCustomer === cName || oCustomer.includes(cName))) return true
  if (cTaller && (oWorkshop === cTaller || oWorkshop.includes(cTaller) || oCustomer === cTaller || oCustomer.includes(cTaller))) return true
  if (cEmpresa && (oCustomer === cEmpresa || oCustomer.includes(cEmpresa))) return true

  return false
}

// Cálculo reactivo de facturación por cliente
const clientBillingStats = computed<Record<string, { totalBilled: number; ordersCount: number }>>(() => {
  const map: Record<string, { totalBilled: number; ordersCount: number }> = {}

  clients.value.forEach(c => {
    let total = 0
    let count = 0

    orders.value.forEach(o => {
      if (o.status !== 'Cancelada' && isOrderOfClient(o, c)) {
        total += o.total || 0
        count++
      }
    })

    map[c.id] = { totalBilled: total, ordersCount: count }
  })

  return map
})

// Facturación global de todos los clientes
const totalBilledAllClients = computed(() => {
  return Object.values(clientBillingStats.value).reduce((acc, curr) => acc + curr.totalBilled, 0)
})

const animatedTotalClients = useAnimatedNumber(() => clients.value.length, 460)
const animatedTalleresCount = useAnimatedNumber(() => clients.value.filter(c => c.tipo === 'Tallerista').length, 460)
const animatedTotalBilledClients = useAnimatedNumber(() => totalBilledAllClients.value, 520)

const loadClients = async () => {
  loading.value = true
  try {
    const [fetchedClients, fetchedOrders] = await Promise.all([
      clientesService.getClientes({
        search: searchQuery.value,
        tipo: selectedType.value,
        estado: selectedStatus.value,
      }),
      ordersService.getOrders()
    ])
    clients.value = fetchedClients
    orders.value = fetchedOrders
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!authStore.canAccess('/clientes')) {
    router.replace(authStore.defaultRoute)
    return
  }
  await loadClients()
})

const filteredClients = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  return clients.value.filter((c) => {
    const workshop = (c.especificaciones_tecnicas?.taller || c.especificaciones_tecnicas?.empresa || '').toLowerCase()
    const matchesQuery =
      !query ||
      (c.codigo && c.codigo.toLowerCase().includes(query)) ||
      c.nombre.toLowerCase().includes(query) ||
      (c.telefono && c.telefono.includes(query)) ||
      (c.direccion && c.direccion.toLowerCase().includes(query)) ||
      workshop.includes(query)

    const matchesType = selectedType.value === 'Todos' || c.tipo === selectedType.value
    const matchesStatus = selectedStatus.value === 'Todos' || c.estado === selectedStatus.value

    return matchesQuery && matchesType && matchesStatus
  })
})

// Modal handlers
const openCreateModal = () => {
  clientToEdit.value = null
  isModalOpen.value = true
}

const openEditModal = (client: Cliente) => {
  clientToEdit.value = client
  isModalOpen.value = true
}

const openOrdersModal = (client: Cliente) => {
  selectedClientForOrders.value = client
  isOrdersModalOpen.value = true
}

const handleSaveClient = async (clientData: Partial<Cliente>) => {
  try {
    if (clientData.id) {
      await clientesService.updateCliente(clientData.id, clientData)
      showToast('Cliente actualizado correctamente')
    } else {
      await clientesService.createCliente(clientData as ClienteInsert)
      showToast('Cliente registrado exitosamente')
    }
    await loadClients()
    isModalOpen.value = false
  } catch (err: any) {
    showToast(err.message || 'Error al guardar cliente')
  }
}

// Inactivar / Reactivar cliente
const handleToggleStatus = async (id: string, newStatus: ClientStatus) => {
  try {
    if (newStatus === 'Inactivo') {
      await clientesService.deactivateCliente(id)
      showToast('Cliente marcado como inactivo')
    } else {
      await clientesService.reactivateCliente(id)
      showToast('Cliente reactivado exitosamente')
    }
    await loadClients()
    isModalOpen.value = false
  } catch (err: any) {
    showToast(err.message || 'Error al actualizar estado')
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedType.value = 'Todos'
  selectedStatus.value = 'Activo'
}

const showToast = (msg: string) => {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 3200)
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Toast Notification -->
    <div
      v-if="toastMessage"
      class="fixed bottom-6 right-6 z-50 bg-[#19314D] text-white px-4 py-3 rounded-2xl shadow-2xl border border-[#BFEBF2]/30 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <CheckCircle class="w-4 h-4 text-[#BFEBF2]" />
      <span class="text-xs font-semibold">{{ toastMessage }}</span>
    </div>

    <!-- Header Hero Section -->
    <section class="studio-hero-banner p-6 sm:p-7 text-white relative overflow-hidden space-y-5">
      <div class="pointer-events-none absolute -top-16 -right-12 w-60 h-60 rounded-full bg-[#04C4D9]/25 blur-3xl"></div>
      <div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="space-y-1.5">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            <span class="w-2 h-2 rounded-full bg-[#BFEBF2] animate-pulse"></span>
            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#BFEBF2]">
              CLIENTES · DIRECTORIO DE TALLERES
            </span>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Directorio de Clientes y Talleristas
          </h1>
          <p class="text-xs sm:text-sm text-sky-100/85 max-w-2xl">
            Administración de clientes y talleres mecánicos, historial de órdenes de rectificación y contacto directo.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            @click="loadClients"
            :disabled="loading"
            class="min-h-[40px] px-3.5 py-2 rounded-xl border border-white/20 bg-white/12 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 flex items-center gap-1.5 active:scale-[0.97] disabled:opacity-60 cursor-pointer"
            title="Actualizar lista de clientes"
          >
            <RotateCcw class="w-3.5 h-3.5 text-[#BFEBF2]" :class="{ 'animate-spin': loading }" />
            <span>Actualizar</span>
          </button>

          <!-- New Client Button (Touch Friendly) -->
          <button
            type="button"
            @click="openCreateModal"
            class="studio-cta-primary min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus class="w-4 h-4 stroke-[2.5]" />
            <span>Nuevo Cliente / Tallerista</span>
          </button>
        </div>
      </div>

      <!-- Barra de Búsqueda y Filtros Integrada -->
      <div class="relative z-10 bg-white rounded-2xl p-4 text-slate-900 shadow-md border border-[#DCE5EE] space-y-3">
        <!-- Search Input -->
        <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div class="relative flex-1">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search class="w-4 h-4" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por código (ej. CLI-001, TAL-001), nombre, teléfono o taller..."
              class="w-full min-h-[40px] pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-[#162436] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#147488] focus:ring-2 focus:ring-[#147488]/20 transition-all"
            />
          </div>

          <div class="flex items-center gap-2 font-mono text-[11px] text-[#1B4978] font-semibold px-3 py-1.5 rounded-xl bg-[#EBF3FA] border border-[#D3E3F2] shrink-0">
            <span>Mostrando <strong class="text-[#162436]">{{ filteredClients.length }}</strong> de {{ clients.length }}</span>
          </div>
        </div>

        <!-- Filter Controls: Tipo y Estado -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/80">
          <!-- Filtro por Tipo -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <span class="font-mono text-[10px] font-bold text-[#1B4978] uppercase tracking-wider mr-1 whitespace-nowrap">
              Tipo:
            </span>
            <button
              v-for="t in typeCategories"
              :key="t"
              type="button"
              @click="selectedType = t"
              :class="[
                'min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 border active:scale-[0.97] cursor-pointer',
                selectedType === t
                  ? 'bg-[#1E446E] text-white border-[#1E446E] shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:border-[#147488]',
              ]"
            >
              {{ t }}
            </button>
          </div>

          <!-- Filtro por Estado -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <span class="font-mono text-[10px] font-bold text-[#1B4978] uppercase tracking-wider mr-1 whitespace-nowrap">
              Estado:
            </span>
            <button
              v-for="s in statusCategories"
              :key="s"
              type="button"
              @click="selectedStatus = s"
              :class="[
                'min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 border active:scale-[0.97] cursor-pointer',
                selectedStatus === s
                  ? s === 'Activo'
                    ? 'bg-[#038391] text-white border-[#038391] shadow-xs'
                    : s === 'Inactivo'
                      ? 'bg-[#6E5835] text-white border-[#6E5835] shadow-xs'
                      : 'bg-[#1E446E] text-white border-[#1E446E] shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:border-[#147488]',
              ]"
            >
              {{ s }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Resumen de Métricas de Clientes y Facturación -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
      <div class="studio-kpi-card workshop-stagger-1 p-5 flex flex-col justify-between">
        <div class="relative z-10 flex items-center justify-between gap-2">
          <span class="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Directorio</span>
          <span class="w-9 h-9 rounded-xl bg-[#E8F1FA] text-[#1B4978] border border-[#CFE1F4] flex items-center justify-center">
            <Users class="w-4 h-4" />
          </span>
        </div>
        <div class="relative z-10 mt-3 flex items-baseline justify-between gap-2">
          <span class="font-display tabular-nums text-3xl font-extrabold text-[#162436]">{{ Math.round(animatedTotalClients) }}</span>
          <span class="px-2 py-0.5 rounded-full bg-[#E8F1FA] text-[#1B4978] font-mono text-[11px] font-bold">
            {{ clients.filter(c => c.estado === 'Activo').length }} activos
          </span>
        </div>
      </div>

      <div class="studio-kpi-card workshop-stagger-2 p-5 flex flex-col justify-between">
        <div class="relative z-10 flex items-center justify-between gap-2">
          <span class="font-mono text-[10px] font-bold text-[#12697A] uppercase tracking-wider">Talleres Mecánicos</span>
          <span class="w-9 h-9 rounded-xl bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] flex items-center justify-center">
            <Wrench class="w-4 h-4" />
          </span>
        </div>
        <div class="relative z-10 mt-3 flex items-baseline justify-between gap-2">
          <span class="font-display tabular-nums text-3xl font-extrabold text-[#162436]">{{ Math.round(animatedTalleresCount) }}</span>
          <span class="px-2 py-0.5 rounded-full bg-[#E3F5F8] text-[#12697A] font-mono text-[11px] font-bold">
            {{ clients.filter(c => c.tipo === 'Cliente').length }} particulares
          </span>
        </div>
      </div>

      <div class="studio-kpi-card workshop-stagger-3 p-5 flex flex-col justify-between">
        <div class="relative z-10 flex items-center justify-between gap-2">
          <span class="font-mono text-[10px] font-bold text-[#004B97] uppercase tracking-wider">Facturación Total</span>
          <span class="w-9 h-9 rounded-xl bg-sky-50 text-[#004B97] border border-sky-200/80 flex items-center justify-center">
            <DollarSign class="w-4 h-4" />
          </span>
        </div>
        <div class="relative z-10 mt-3 flex items-baseline justify-between gap-2">
          <span class="font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#004B97]">
            ${{ animatedTotalBilledClients.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </span>
          <span class="px-2 py-0.5 rounded-full bg-sky-50 text-[#004B97] font-mono text-[11px] font-bold">Facturado</span>
        </div>
      </div>
    </div>

    <!-- Clients Grid or Empty States -->
    <div v-if="filteredClients.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <ClientCard
        v-for="client in filteredClients"
        :key="client.id"
        :client="client"
        :total-billed="clientBillingStats[client.id]?.totalBilled || 0"
        :orders-count="clientBillingStats[client.id]?.ordersCount || 0"
        @edit="openEditModal"
        @toggleStatus="handleToggleStatus"
        @viewOrders="openOrdersModal"
      />
    </div>

    <!-- Empty State: When search/filter returns 0 results -->
    <div v-else-if="clients.length > 0">
      <EmptyState
        title="Sin coincidencias encontradas"
        :description="`No se encontraron clientes con el término '${searchQuery}' o los filtros seleccionados (Tipo: ${selectedType}, Estado: ${selectedStatus}).`"
        actionText="Limpiar Filtros"
        @action="clearFilters"
      />
    </div>

    <!-- Empty State: When no clients exist at all -->
    <div v-else>
      <EmptyState
        title="No hay clientes registrados"
        description="Aún no se han registrado clientes o talleres en el sistema. Comienza registrando el primero para vincular órdenes de rectificación."
        actionText="Registrar Primer Cliente"
        @action="openCreateModal"
      />
    </div>

    <!-- Modal for Create and Edit -->
    <ClientModal
      :isOpen="isModalOpen"
      :clientToEdit="clientToEdit"
      @close="isModalOpen = false"
      @save="handleSaveClient"
      @toggleStatus="handleToggleStatus"
    />

    <!-- Modal for Client Order History -->
    <ClientOrdersHistoryModal
      :isOpen="isOrdersModalOpen"
      :client="selectedClientForOrders"
      @close="isOrdersModalOpen = false"
    />
  </div>
</template>
