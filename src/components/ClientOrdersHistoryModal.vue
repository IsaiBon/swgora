<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Cliente } from '@/services/clientesService'
import { ordersService, type Order, type OrderStatus } from '@/services/ordersService'
import {
  X,
  FileText,
  Calendar,
  Wrench,
  Plus,
  Phone,
  Package,
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  client: Cliente | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const orders = ref<Order[]>([])
const loading = ref(false)

const loadOrders = async () => {
  if (!props.client) {
    orders.value = []
    return
  }
  loading.value = true
  try {
    const allOrders = await ordersService.getOrders()
    const targetId = props.client.id?.toLowerCase().trim()
    const targetCode = props.client.codigo?.toLowerCase().trim()
    const targetName = props.client.nombre?.toLowerCase().trim()

    orders.value = allOrders.filter(o => {
      const matchId = Boolean(targetId && o.customerId?.toLowerCase().trim() === targetId)
      const matchCode = Boolean(targetCode && (
        (o.customerCode && o.customerCode.toLowerCase().trim() === targetCode) ||
        (o.workshopCode && o.workshopCode.toLowerCase().trim() === targetCode)
      ))
      const matchName = Boolean(targetName && o.customer?.toLowerCase().includes(targetName))
      return matchId || matchCode || matchName
    })
  } catch (err) {
    console.error('Error fetching client orders:', err)
    orders.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.isOpen, props.client],
  ([open, client]) => {
    if (open && client) {
      loadOrders()
    } else {
      orders.value = []
    }
  },
  { immediate: true }
)

const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case 'Terminado':
    case 'Completada':
    case 'Entregado':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'En Proceso':
      return 'bg-sky-50 text-[#04C4D9] border-[#05C7F2]/30'
    case 'Diagnóstico':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'Cancelada':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200'
  }
}

const goToNewOrder = () => {
  emit('close')
  if (props.client) {
    router.push({
      path: '/ordenes',
      query: {
        clienteId: props.client.id,
        codigo: props.client.codigo,
        cliente: props.client.nombre,
        telefono: props.client.telefono || undefined
      }
    })
  } else {
    router.push('/ordenes')
  }
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(val || 0)
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
    @click.self="$emit('close')"
  >
    <div
      class="bg-white w-full max-w-3xl rounded-[2rem] sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-[#05C7F2]/15 text-[#04C4D9] flex items-center justify-center shadow-inner">
            <FileText class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-slate-900 leading-tight">
                Historial de Órdenes de Rectificación
              </h3>
              <span
                v-if="client"
                :class="[
                  'text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border',
                  client.tipo === 'Tallerista'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
                ]"
              >
                {{ client.tipo }}
              </span>
              <span
                v-if="client?.codigo"
                class="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#0D0D0D] text-[#05F2F2] border border-slate-700"
              >
                {{ client.codigo }}
              </span>
            </div>
            <p v-if="client" class="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
              <span class="font-semibold text-slate-700">{{ client.nombre }}</span>
              <span v-if="client.telefono" class="inline-flex items-center gap-1 text-slate-500">
                <Phone class="w-3 h-3 text-slate-400" />
                {{ client.telefono }}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="$emit('close')"
          class="min-w-[44px] min-h-[44px] rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 flex items-center justify-center transition active:scale-95"
          aria-label="Cerrar modal"
        >
          <X class="w-6 h-6" />
        </button>
      </div>

      <!-- Action Sub-bar -->
      <div class="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <div class="text-xs font-semibold text-slate-600">
          <span v-if="loading">Consultando historial en base de datos...</span>
          <span v-else>
            Total órdenes asociadas: <strong class="text-slate-900">{{ orders.length }}</strong>
          </span>
        </div>

        <!-- + Nueva Orden Button -->
        <button
          type="button"
          @click="goToNewOrder"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0D0D0D] hover:bg-black text-white text-xs font-bold transition shadow-sm active:scale-95"
        >
          <Plus class="w-4 h-4 text-[#05F2F2]" />
          <span>Nueva Orden para este Cliente</span>
        </button>
      </div>

      <!-- Modal Body (Orders List) -->
      <div class="p-6 overflow-y-auto flex-1 space-y-3.5 bg-slate-50/50">
        <!-- Loading Spinner -->
        <div v-if="loading" class="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
          <div class="w-8 h-8 border-3 border-slate-200 border-t-[#05C7F2] rounded-full animate-spin"></div>
          <span class="text-xs font-medium">Cargando órdenes del cliente...</span>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="orders.length === 0"
          class="py-12 px-4 text-center bg-white rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center"
        >
          <div class="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <FileText class="w-7 h-7" />
          </div>
          <h4 class="text-base font-bold text-slate-800">
            Sin órdenes de servicio registradas
          </h4>
          <p class="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Este cliente no tiene órdenes de rectificación previas. Puedes iniciar la primera orden de trabajo en cualquier momento.
          </p>
          <button
            type="button"
            @click="goToNewOrder"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0D0D0D] hover:bg-black text-white text-xs font-bold transition shadow-md active:scale-95"
          >
            <Plus class="w-4 h-4 text-[#05F2F2]" />
            <span>Crear Primera Orden</span>
          </button>
        </div>

        <!-- Orders Cards -->
        <div
          v-else
          v-for="order in orders"
          :key="order.id"
          class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-[#05C7F2]/60 shadow-sm transition hover:shadow-md"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <!-- Order Number & Date -->
            <div class="flex items-center gap-3">
              <span class="text-sm font-black font-mono text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {{ order.orderNumber }}
              </span>
              <span class="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <Calendar class="w-3.5 h-3.5 text-slate-400" />
                {{ order.date }}
              </span>
            </div>

            <!-- Status Badge & Total -->
            <div class="flex items-center gap-3">
              <span
                :class="[
                  'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border',
                  getStatusBadge(order.status)
                ]"
              >
                {{ order.status }}
              </span>
              <span class="text-sm sm:text-base font-extrabold text-slate-900 font-mono">
                {{ formatCurrency(order.total) }}
              </span>
            </div>
          </div>

          <!-- Vehicle / Engine Details -->
          <div class="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">
                Vehículo / Motor:
              </div>
              <div class="font-semibold text-slate-800 flex items-center gap-1.5">
                <Wrench class="w-3.5 h-3.5 text-[#04C4D9]" />
                <span>
                  {{ order.vehicleBrand ? `${order.vehicleBrand} ${order.vehicleModel || ''}` : (order.engine || 'Motor no especificado') }}
                  <span v-if="order.engineType" class="text-slate-500 text-[11px] font-normal">({{ order.engineType }})</span>
                </span>
              </div>
            </div>

            <!-- Breakdown: Trabajos y Repuestos -->
            <div>
              <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">
                Detalle de Servicios:
              </div>
              <div class="text-slate-600 flex items-center gap-3 text-[11px]">
                <span class="inline-flex items-center gap-1">
                  <Wrench class="w-3 h-3 text-slate-400" />
                  {{ order.operations?.length || 0 }} operaciones
                </span>
                <span class="inline-flex items-center gap-1">
                  <Package class="w-3 h-3 text-slate-400" />
                  {{ order.parts?.length || 0 }} repuestos
                </span>
              </div>
            </div>
          </div>

          <!-- Observations snippet if available -->
          <div v-if="order.observations" class="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic line-clamp-1">
            "{{ order.observations }}"
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-white border-t border-slate-200 flex justify-end">
        <button
          type="button"
          @click="$emit('close')"
          class="min-h-[44px] px-6 py-2.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition active:scale-95"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>
