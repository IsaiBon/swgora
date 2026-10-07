<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { clientesService, type Cliente, type ClientStatus } from '@/services/clientesService'
import ClientCard from '@/components/ClientCard.vue'
import ClientModal from '@/components/ClientModal.vue'
import ClientOrdersHistoryModal from '@/components/ClientOrdersHistoryModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  Search,
  Plus,
  RotateCcw,
  CheckCircle,
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// State: Por defecto filtrar clientes activos (Sprint 4)
const clients = ref<Cliente[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedType = ref<string>('Todos')
const selectedStatus = ref<string>('Activo')
const isModalOpen = ref(false)
const clientToEdit = ref<Cliente | null>(null)
const toastMessage = ref('')

// Historial de Órdenes del Cliente (Sprint 4)
const isOrdersModalOpen = ref(false)
const selectedClientForOrders = ref<Cliente | null>(null)

const typeCategories = ['Todos', 'Cliente', 'Tallerista']
const statusCategories = ['Todos', 'Activo', 'Inactivo']

const loadClients = async () => {
  loading.value = true
  try {
    clients.value = await clientesService.getClientes({
      search: searchQuery.value,
      tipo: selectedType.value,
      estado: selectedStatus.value,
    })
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
    const matchesQuery =
      !query ||
      (c.codigo && c.codigo.toLowerCase().includes(query)) ||
      c.nombre.toLowerCase().includes(query) ||
      (c.telefono && c.telefono.includes(query)) ||
      (c.direccion && c.direccion.toLowerCase().includes(query))

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
      await clientesService.createCliente(clientData as any)
      showToast('Cliente registrado exitosamente en PostgreSQL')
    }
    await loadClients()
    isModalOpen.value = false
  } catch (err: any) {
    showToast(err.message || 'Error al guardar cliente')
  }
}

// Borrado lógico (Inactivar / Reactivar)
const handleToggleStatus = async (id: string, newStatus: ClientStatus) => {
  try {
    if (newStatus === 'Inactivo') {
      await clientesService.deactivateCliente(id)
      showToast('Cliente inactivado (Borrado Lógico preservado)')
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

// Helpers para demo y filtros
const clearFilters = () => {
  searchQuery.value = ''
  selectedType.value = 'Todos'
  selectedStatus.value = 'Activo'
}

const handleRestoreDemo = async () => {
  clientesService.resetDemo()
  await loadClients()
  showToast('Datos de demostración restaurados')
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
      class="fixed bottom-6 right-6 z-50 bg-[#0D0D0D] text-white px-5 py-3 rounded-2xl shadow-2xl border border-[#05C7F2]/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <CheckCircle class="w-5 h-5 text-[#05F2F2]" />
      <span class="text-xs font-semibold">{{ toastMessage }}</span>
    </div>

    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#05C7F2]/15 text-[#04C4D9] border border-[#05C7F2]/30 uppercase tracking-wider">
            Sprint 4 • Historial de Órdenes y Catálogo
          </span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Directorio de Clientes y Talleristas
        </h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Historial de órdenes de rectificación vinculadas, llamadas y WhatsApp directos y filtro activo por defecto.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          @click="handleRestoreDemo"
          class="min-h-[44px] px-3.5 py-2 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
          title="Restaurar registros estándar de prueba"
        >
          <RotateCcw class="w-4 h-4 text-[#04C4D9]" />
          <span>Restaurar Demo</span>
        </button>

        <!-- New Client Button (Touch Friendly) -->
        <button
          type="button"
          @click="openCreateModal"
          class="min-h-[46px] px-6 py-2.5 rounded-full bg-[#0D0D0D] hover:bg-black text-white text-xs sm:text-sm font-bold shadow-md shadow-slate-300 hover:shadow-xl transition active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus class="w-4 h-4 text-[#05F2F2]" />
          <span>Nuevo Cliente / Tallerista</span>
        </button>
      </div>
    </div>

    <!-- Filters & Search Bar (Conectados a Supabase y PostgreSQL) -->
    <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
      <!-- Search Input -->
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search class="w-5 h-5" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por código (ej. CLI-001, TAL-001), nombre, teléfono o taller..."
            class="w-full min-h-[46px] pl-11 pr-4 rounded-full bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#05C7F2] transition shadow-inner"
          />
        </div>

        <div class="flex items-center gap-2 text-xs text-slate-500 font-medium px-2">
          <span>Mostrando <strong>{{ filteredClients.length }}</strong> de {{ clients.length }}</span>
        </div>
      </div>

      <!-- Filter Controls: Tipo y Estado -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <!-- Filtro por Tipo -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 whitespace-nowrap">
            Tipo:
          </span>
          <button
            v-for="t in typeCategories"
            :key="t"
            type="button"
            @click="selectedType = t"
            :class="[
              'min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border active:scale-95',
              selectedType === t
                ? 'bg-[#0D0D0D] text-white border-[#0D0D0D] shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
            ]"
          >
            {{ t }}
          </button>
        </div>

        <!-- Filtro por Estado (Borrado Lógico) -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 whitespace-nowrap">
            Estado:
          </span>
          <button
            v-for="s in statusCategories"
            :key="s"
            type="button"
            @click="selectedStatus = s"
            :class="[
              'min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border active:scale-95',
              selectedStatus === s
                ? s === 'Activo'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : s === 'Inactivo'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-[#0D0D0D] text-white border-[#0D0D0D] shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
            ]"
          >
            {{ s }}
          </button>
        </div>
      </div>
    </div>

    <!-- Clients Grid or Empty States -->
    <div v-if="filteredClients.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <ClientCard
        v-for="client in filteredClients"
        :key="client.id"
        :client="client"
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
        title="No hay clientes registrados en la base de datos"
        description="Aún no se han registrado clientes o talleristas en la tabla 'clientes' de PostgreSQL. Comienza registrando el primero o restaura los datos de demostración."
        actionText="Registrar Primer Cliente"
        secondaryActionText="Restaurar Clientes Demo"
        @action="openCreateModal"
        @secondaryAction="handleRestoreDemo"
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

    <!-- Modal for Client Order History (Sprint 4) -->
    <ClientOrdersHistoryModal
      :isOpen="isOrdersModalOpen"
      :client="selectedClientForOrders"
      @close="isOrdersModalOpen = false"
    />
  </div>
</template>
