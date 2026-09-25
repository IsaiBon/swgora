<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ordersService, type Order } from '@/services/ordersService'
import { clientesService, type Cliente } from '@/services/clientesService'
import { 
  Users, 
  Package, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Wrench, 
  TrendingUp, 
  ArrowUpRight, 
  ChevronRight, 
  Activity, 
  Sparkles,
  Cog
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const orders = ref<Order[]>([])
const clients = ref<Cliente[]>([])
const selectedFilter = ref<'Todos' | 'En Proceso' | 'Pendiente' | 'Completada'>('Todos')
const loading = ref(true)

onMounted(async () => {
  if (!authStore.canAccess('/dashboard')) {
    router.replace(authStore.defaultRoute)
    return
  }

  try {
    const [fetchedOrders, fetchedClients] = await Promise.all([
      ordersService.getOrders(),
      clientesService.getClientes()
    ])
    orders.value = fetchedOrders
    clients.value = fetchedClients
  } finally {
    loading.value = false
  }
})

// === CÁLCULO DE KPIS REACTIVOS ===
const activeOrdersCount = computed(() => {
  return orders.value.filter(o => o.status === 'En Proceso' || o.status === 'Pendiente').length
})

const completedOrdersCount = computed(() => {
  return orders.value.filter(o => o.status === 'Completada').length
})

const totalClientsCount = computed(() => clients.value.length)
const activeClientsCount = computed(() => clients.value.filter((c: Cliente) => c.estado === 'Activo').length)

const monthlyRevenue = computed(() => {
  return orders.value
    .filter(o => o.status !== 'Cancelada')
    .reduce((sum, o) => sum + o.total, 0)
})

// === DESGLOSE POR COMPONENTE MECÁNICO (RECTIFICADORA) ===
interface ComponentWorkload {
  name: 'Culata' | 'Block' | 'Cigüeñal' | 'Bielas' | 'Bancadas'
  description: string
  count: number
  percentage: number
  color: string
  bgLight: string
  borderColor: string
}

const componentStats = computed<ComponentWorkload[]>(() => {
  const componentDefs: { 
    name: 'Culata' | 'Block' | 'Cigüeñal' | 'Bielas' | 'Bancadas'
    description: string
    color: string
    bgLight: string
    borderColor: string
  }[] = [
    {
      name: 'Culata',
      description: 'Cepillado, prueba hidráulica, guías y asientos',
      color: '#0891b2', // cyan-600
      bgLight: 'bg-cyan-50 text-cyan-800',
      borderColor: 'border-cyan-200'
    },
    {
      name: 'Block',
      description: 'Rectificado de cilindros, encamisado, plano',
      color: '#2563eb', // blue-600
      bgLight: 'bg-blue-50 text-blue-800',
      borderColor: 'border-blue-200'
    },
    {
      name: 'Cigüeñal',
      description: 'Rectificado de muñones, nitrurado y pulido',
      color: '#059669', // emerald-600
      bgLight: 'bg-emerald-50 text-emerald-800',
      borderColor: 'border-emerald-200'
    },
    {
      name: 'Bielas',
      description: 'Alineación, embocinado y rectificado de ojo',
      color: '#d97706', // amber-600
      bgLight: 'bg-amber-50 text-amber-800',
      borderColor: 'border-amber-200'
    },
    {
      name: 'Bancadas',
      description: 'Alineación de túnel, alesado y casquetería',
      color: '#7c3aed', // violet-600
      bgLight: 'bg-violet-50 text-violet-800',
      borderColor: 'border-violet-200'
    }
  ]

  const total = orders.value.length || 1

  return componentDefs.map(def => {
    const count = orders.value.filter(o => o.component === def.name).length
    const percentage = Math.round((count / total) * 100)
    return {
      ...def,
      count,
      percentage
    }
  })
})

// === FILTRADO DE ÓRDENES RECIENTES ===
const filteredRecentOrders = computed(() => {
  if (selectedFilter.value === 'Todos') {
    return orders.value
  }
  return orders.value.filter(o => o.status === selectedFilter.value)
})

const getStatusBadgeConfig = (status: Order['status']) => {
  switch (status) {
    case 'Completada':
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        icon: CheckCircle2,
        label: 'Terminado'
      }
    case 'En Proceso':
      return {
        bg: 'bg-sky-50 text-sky-700 border-sky-300',
        icon: Clock,
        label: 'En Proceso'
      }
    case 'Pendiente':
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-300',
        icon: AlertCircle,
        label: 'Pendiente'
      }
    default:
      return {
        bg: 'bg-slate-50 text-slate-700 border-slate-300',
        icon: AlertCircle,
        label: status
      }
  }
}
</script>

<template>
  <div v-if="authStore.canAccess('/dashboard')" class="space-y-6 sm:space-y-8 pb-10">
    <!-- ==========================================
         ENCABEZADO Y ACCIONES RÁPIDAS PRINCIPALES
         ========================================== -->
    <header class="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
      <!-- Decoración sutil de fondo -->
      <div class="absolute -right-16 -top-16 w-64 h-64 bg-[#05C7F2]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6 relative z-10">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#05C7F2]/15 text-[#038896] border border-[#05C7F2]/30">
              <Sparkles class="w-3.5 h-3.5" />
              JR Blanco Rectificadora
            </span>
            <span class="text-[11px] sm:text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 sm:py-1 rounded-full">
              Panel Operativo v2.0
            </span>
          </div>

          <h1 class="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2 sm:mt-2.5">
            Dashboard Operativo del Taller
          </h1>
          <p class="text-xs sm:text-base text-slate-600 mt-1 max-w-2xl">
            Control de flujo de trabajo, componentes en rectificación, órdenes activas y estado general del taller.
          </p>
        </div>

        <!-- Botones de Acción Rápida -->
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <router-link
            to="/ordenes"
            class="inline-flex items-center justify-center px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white bg-[#0D0D0D] hover:bg-neutral-900 active:scale-95 rounded-xl sm:rounded-2xl shadow-md transition-all border border-neutral-800"
          >
            <Plus class="w-4 h-4 mr-1.5 text-[#05F2F2]" />
            + Nueva Orden
          </router-link>

          <router-link
            to="/clientes"
            class="inline-flex items-center justify-center px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-800 bg-white hover:bg-slate-50 active:scale-95 rounded-xl sm:rounded-2xl shadow-sm transition-all border border-slate-300"
          >
            <Users class="w-4 h-4 mr-1.5 text-blue-600" />
            + Nuevo Cliente
          </router-link>

          <router-link
            to="/catalogo"
            class="inline-flex items-center justify-center px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl sm:rounded-2xl transition-all"
          >
            <Package class="w-4 h-4 mr-1.5 text-slate-600" />
            Ver Catálogo
          </router-link>
        </div>
      </div>
    </header>

    <!-- ==========================================
         TARJETAS KPI (INDICADORES OPERATIVOS)
         ========================================== -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <!-- KPI 1: Órdenes Activas -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-600">
            Órdenes Activas
          </span>
          <div class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Clock class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-3xl sm:text-4xl font-black text-slate-900">
            {{ activeOrdersCount }}
          </span>
          <span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            En proceso / espera
          </span>
        </div>

        <p class="text-xs text-slate-600 mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
          <span>Total en flujo de trabajo</span>
          <router-link to="/ordenes" class="font-bold text-sky-700 hover:underline">
            Ver órdenes &rarr;
          </router-link>
        </p>
      </div>

      <!-- KPI 2: Servicios Completados -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-600">
            Trabajos Terminados
          </span>
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <CheckCircle2 class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-3xl sm:text-4xl font-black text-slate-900">
            {{ completedOrdersCount }}
          </span>
          <span class="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
            <ArrowUpRight class="w-3.5 h-3.5 mr-0.5" />
            100% listos
          </span>
        </div>

        <p class="text-xs text-slate-600 mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
          <span>Motores y piezas entregadas</span>
          <span class="font-semibold text-emerald-800">Listo para facturar</span>
        </p>
      </div>

      <!-- KPI 3: Clientes Registrados -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-600">
            Clientes y Talleres
          </span>
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Users class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-3xl sm:text-4xl font-black text-slate-900">
            {{ totalClientsCount }}
          </span>
          <span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {{ activeClientsCount }} activos
          </span>
        </div>

        <p class="text-xs text-slate-600 mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
          <span>Talleristas y particulares</span>
          <router-link to="/clientes" class="font-bold text-indigo-700 hover:underline">
            Gestionar &rarr;
          </router-link>
        </p>
      </div>

      <!-- KPI 4: Volumen Facturado -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-600">
            Volumen Operativo
          </span>
          <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <TrendingUp class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-2xl sm:text-3xl font-black text-slate-900">
            ${{ monthlyRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
          </span>
          <span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Mano de obra + repuestos
          </span>
        </div>

        <p class="text-xs text-slate-600 mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
          <span>Órdenes activas y cerradas</span>
          <span class="font-semibold text-slate-700">Mes en curso</span>
        </p>
      </div>
    </section>

    <!-- ==========================================
         SECCIÓN PRINCIPAL: 
         - SERVICIOS POR COMPONENTE MECÁNICO
         - ÓRDENES DE TRABAJO RECIENTES
         ========================================== -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
      
      <!-- DESGLOSE VISUAL: SERVICIOS POR COMPONENTE DEL MOTOR (1 Columna en desktop) -->
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Wrench class="w-5 h-5 text-[#038896]" />
                Servicios por Componente
              </h2>
              <p class="text-xs text-slate-600 mt-0.5">
                Demanda operativa segmentada por áreas del motor
              </p>
            </div>
            <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700">
              5 Bloques
            </span>
          </div>

          <div class="space-y-5 mt-6">
            <div 
              v-for="item in componentStats" 
              :key="item.name"
              class="group"
            >
              <div class="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                <div class="flex items-center gap-2">
                  <span 
                    :class="['px-2 py-0.5 rounded-md text-[11px] font-extrabold border', item.bgLight, item.borderColor]"
                  >
                    {{ item.name }}
                  </span>
                  <span class="text-[11px] text-slate-500 font-normal hidden sm:inline">
                    {{ item.description }}
                  </span>
                </div>
                <div class="text-right">
                  <span class="font-black text-slate-900">{{ item.count }} trab.</span>
                  <span class="text-slate-500 text-xs font-semibold ml-1">({{ item.percentage }}%)</span>
                </div>
              </div>

              <!-- Barra de Progreso Visual -->
              <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                <div 
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ 
                    width: `${Math.max(item.percentage, 8)}%`, 
                    backgroundColor: item.color 
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Resumen inferior del bloque de rectificación -->
        <div class="mt-8 pt-5 border-t border-slate-100 bg-slate-50/70 -mx-6 -mb-6 p-6 rounded-b-3xl">
          <div class="flex items-center justify-between text-xs text-slate-600">
            <span class="font-medium">Mayor demanda este mes:</span>
            <span class="font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-md">
              Culata & Block
            </span>
          </div>
          <p class="text-[11px] text-slate-500 mt-2">
            La carga de trabajo se equilibra entre pruebas hidráulicas, cepillado y rectificado de cilindros.
          </p>
        </div>
      </div>

      <!-- ÓRDENES DE TRABAJO RECIENTES (2 Columnas en desktop) -->
      <div class="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between">
        <div>
          <!-- Cabecera de la tabla y Filtros rápidos -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Activity class="w-5 h-5 text-blue-600" />
                Órdenes de Trabajo Recientes
              </h2>
              <p class="text-xs text-slate-600 mt-0.5">
                Seguimiento en mostrador de clientes, componentes mecánicos y estado
              </p>
            </div>

            <!-- Botones de Filtro Rápido -->
            <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
              <button
                v-for="filter in ['Todos', 'En Proceso', 'Pendiente', 'Completada']"
                :key="filter"
                type="button"
                @click="selectedFilter = filter as any"
                :class="[
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  selectedFilter === filter
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                ]"
              >
                {{ filter === 'Completada' ? 'Terminadas' : filter }}
              </button>
            </div>
          </div>

          <!-- Tabla responsiva de Órdenes -->
          <div class="overflow-x-auto mt-4 -mx-1 sm:mx-0">
            <table class="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr class="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-100">
                  <th class="py-3 px-2">Código / Fecha</th>
                  <th class="py-3 px-2">Cliente / Taller</th>
                  <th class="py-3 px-2">Componente & Motor</th>
                  <th class="py-3 px-2">Estado</th>
                  <th class="py-3 px-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
                <tr 
                  v-for="order in filteredRecentOrders" 
                  :key="order.id"
                  class="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  @click="router.push('/ordenes')"
                >
                  <!-- Código y Fecha -->
                  <td class="py-3 px-2">
                    <span class="font-extrabold text-indigo-700 block">
                      {{ order.orderNumber }}
                    </span>
                    <span class="text-[11px] text-slate-600">
                      {{ order.date }}
                    </span>
                  </td>

                  <!-- Cliente / Taller -->
                  <td class="py-3 px-2">
                    <span class="font-bold text-slate-900 block truncate max-w-[180px]">
                      {{ order.customer }}
                    </span>
                    <span class="text-[11px] text-slate-600">
                      Taller asociado
                    </span>
                  </td>

                  <!-- Componente y Motor -->
                  <td class="py-3 px-2">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                        {{ order.component || 'Culata' }}
                      </span>
                      <span class="text-xs text-slate-700 font-medium">
                        {{ order.engine || 'General' }}
                      </span>
                    </div>
                  </td>

                  <!-- Estado Visual con Badge e Icono -->
                  <td class="py-3 px-2">
                    <span
                      :class="[
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-xs',
                        getStatusBadgeConfig(order.status).bg
                      ]"
                    >
                      <component :is="getStatusBadgeConfig(order.status).icon" class="w-3.5 h-3.5" />
                      {{ getStatusBadgeConfig(order.status).label }}
                    </span>
                  </td>

                  <!-- Monto Total -->
                  <td class="py-3 px-2 text-right">
                    <span class="font-black text-slate-900 block">
                      ${{ order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
                    </span>
                    <span class="text-[10px] text-slate-600 font-semibold uppercase">
                      {{ order.type === 'cotizacion' ? 'Cotización' : 'M.O. + Rep.' }}
                    </span>
                  </td>
                </tr>

                <tr v-if="filteredRecentOrders.length === 0">
                  <td colspan="5" class="py-8 text-center text-slate-600 text-xs">
                    No se encontraron órdenes con el filtro seleccionado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer de la tabla con enlace directo -->
        <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-slate-600">
            Mostrando <strong>{{ filteredRecentOrders.length }}</strong> órdenes de rectificación
          </span>

          <router-link
            to="/ordenes"
            class="inline-flex items-center font-bold text-indigo-700 hover:text-indigo-900 transition-colors"
          >
            Ir a Gestión de Órdenes Completa
            <ChevronRight class="w-4 h-4 ml-1" />
          </router-link>
        </div>
      </div>
    </div>

    <!-- ==========================================
         BARRA DE ACCESOS RÁPIDOS Y AYUDA DE MOSTRADOR
         ========================================== -->
    <section class="bg-gradient-to-r from-slate-900 via-neutral-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-neutral-800">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-[#05C7F2]/20 text-[#05F2F2] flex items-center justify-center border border-[#05C7F2]/30 flex-shrink-0">
            <Cog class="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-extrabold tracking-tight">
              Flujo Operativo de Mostrador y Rectificación
            </h3>
            <p class="text-xs sm:text-sm text-slate-400 mt-0.5">
              Crea órdenes con captura directa de mano de obra por biela, bancada, cigüeñal, culata o block.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <router-link
            to="/ordenes"
            class="inline-flex items-center px-4 py-2.5 rounded-xl bg-[#05C7F2] text-neutral-950 font-bold text-xs sm:text-sm hover:bg-[#04C4D9] active:scale-95 transition"
          >
            <Plus class="w-4 h-4 mr-1.5" />
            Nueva Orden de Taller
          </router-link>

          <router-link
            to="/catalogo"
            class="inline-flex items-center px-4 py-2.5 rounded-xl bg-neutral-800 text-slate-200 font-semibold text-xs sm:text-sm hover:bg-neutral-700 active:scale-95 transition border border-neutral-700"
          >
            Búsqueda Dimensional
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin-slow 20s linear infinite;
}
</style>
