<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ordersService, type Order, type OrderStatus } from '@/services/ordersService'
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
  Activity, 
  Sparkles,
  Cog,
  Calendar,
  RefreshCw,
  DollarSign,
  FileText,
  Car,
  Eye,
  Building2,
  X,
  BarChart3,
  Search,
  CalendarDays
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// Estado principal de datos
const orders = ref<Order[]>([])
const clients = ref<Cliente[]>([])
const loading = ref(true)
const refreshing = ref(false)
const toastMessage = ref<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)
let toastTimeout: any = null

// Filtros Reactivos de Período Temporal
type TimePeriod = 'hoy' | 'semana' | 'mes' | 'ano' | 'todo' | 'personalizado'
const selectedPeriod = ref<TimePeriod>('mes')
const customStartDate = ref('')
const customEndDate = ref('')

// Filtro Reactivo de Cliente / Taller
const selectedClientFilter = ref<string>('ALL')

// Filtros de la Tabla de Órdenes Recientes
const tableSearchQuery = ref('')
const tableStatusFilter = ref<string>('Todos')
const tableComponentFilter = ref<string>('Todos')

// Notificación Toast
const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
  if (toastTimeout) clearTimeout(toastTimeout)
  toastMessage.value = { text, type }
  toastTimeout = setTimeout(() => {
    toastMessage.value = null
  }, 3500)
}

// Carga inicial y refresco desde Supabase
const loadDashboardData = async (isManualRefresh = false) => {
  if (isManualRefresh) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  try {
    const [fetchedOrders, fetchedClients] = await Promise.all([
      ordersService.getOrders(),
      clientesService.getClientes()
    ])
    orders.value = fetchedOrders
    clients.value = fetchedClients
    if (isManualRefresh) {
      showToast('Datos sincronizados correctamente con Supabase', 'success')
    }
  } catch (err) {
    console.error('[DashboardView] Error cargando datos de Supabase:', err)
    showToast('Error de conexión con Supabase. Usando caché local.', 'error')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(async () => {
  if (!authStore.canAccess('/dashboard')) {
    router.replace(authStore.defaultRoute)
    return
  }

  // Inicializar fechas para filtro personalizado (últimos 30 días)
  const today = new Date()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  customEndDate.value = today.toISOString().split('T')[0]
  customStartDate.value = thirtyDaysAgo.toISOString().split('T')[0]

  await loadDashboardData()
})

// === FILTRADO TEMPORAL Y DE CUENTA REACTIVO ===
const parseOrderDate = (order: Order): Date => {
  if (order.date) {
    const cleanDate = order.date.includes('T') ? order.date : `${order.date}T12:00:00`
    const d = new Date(cleanDate)
    if (!isNaN(d.getTime())) return d
  }
  if (order.createdAt) {
    const d = new Date(order.createdAt)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

const filteredOrders = computed(() => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  return orders.value.filter(order => {
    const orderDate = parseOrderDate(order)

    // 1. Filtro Temporal
    let matchesPeriod = true
    if (selectedPeriod.value === 'hoy') {
      matchesPeriod = orderDate >= todayStart && orderDate <= todayEnd
    } else if (selectedPeriod.value === 'semana') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000)
      matchesPeriod = orderDate >= oneWeekAgo && orderDate <= now
    } else if (selectedPeriod.value === 'mes') {
      matchesPeriod = orderDate.getFullYear() === now.getFullYear() && orderDate.getMonth() === now.getMonth()
    } else if (selectedPeriod.value === 'ano') {
      matchesPeriod = orderDate.getFullYear() === now.getFullYear()
    } else if (selectedPeriod.value === 'personalizado') {
      if (customStartDate.value) {
        const start = new Date(`${customStartDate.value}T00:00:00`)
        if (orderDate < start) matchesPeriod = false
      }
      if (customEndDate.value) {
        const end = new Date(`${customEndDate.value}T23:59:59`)
        if (orderDate > end) matchesPeriod = false
      }
    } else if (selectedPeriod.value === 'todo') {
      matchesPeriod = true
    }

    if (!matchesPeriod) return false

    // 2. Filtro de Cliente / Taller
    if (selectedClientFilter.value !== 'ALL') {
      const target = selectedClientFilter.value.toLowerCase().trim()
      const matchesClient = 
        (order.customerId && order.customerId.toLowerCase() === target) ||
        (order.customerCode && order.customerCode.toLowerCase() === target) ||
        (order.workshopCode && order.workshopCode.toLowerCase() === target) ||
        (order.customer && order.customer.toLowerCase().includes(target)) ||
        (order.workshop && order.workshop.toLowerCase().includes(target))
      if (!matchesClient) return false
    }

    return true
  })
})

// Período amigable mostrado en texto
const periodDescription = computed(() => {
  const now = new Date()
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  switch (selectedPeriod.value) {
    case 'hoy':
      return `Hoy (${now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })})`
    case 'semana':
      return 'Últimos 7 días'
    case 'mes':
      return `${monthNames[now.getMonth()]} ${now.getFullYear()}`
    case 'ano':
      return `Año ${now.getFullYear()}`
    case 'personalizado':
      return `${customStartDate.value || 'Inicio'} a ${customEndDate.value || 'Hoy'}`
    case 'todo':
      return 'Historial completo'
    default:
      return ''
  }
})

// Cliente seleccionado (si aplica)
const selectedClientInfo = computed(() => {
  if (selectedClientFilter.value === 'ALL') return null
  return clients.value.find(c => 
    c.id === selectedClientFilter.value || 
    c.codigo === selectedClientFilter.value ||
    c.nombre.toLowerCase() === selectedClientFilter.value.toLowerCase()
  ) || { nombre: selectedClientFilter.value, tipo: 'Cuenta' }
})

// === MÉTRICAS CLAVE (KPIS) ===
// Desglose de estados de órdenes activas
const statusCounts = computed(() => {
  const counts = {
    pendiente: 0,
    enProceso: 0,
    terminado: 0,
    entregado: 0,
    cancelada: 0,
    totalActivas: 0
  }

  filteredOrders.value.forEach(o => {
    const s = o.status
    if (s === 'Pendiente') counts.pendiente++
    else if (s === 'En Proceso') counts.enProceso++
    else if (s === 'Terminado' || s === 'Completada') counts.terminado++
    else if (s === 'Entregado') counts.entregado++
    else if (s === 'Cancelada') counts.cancelada++

    if (s !== 'Cancelada' && s !== 'Entregado') {
      counts.totalActivas++
    }
  })

  return counts
})

// Volumen de motores rectificados
const distinctEngines = computed(() => {
  const engineSet = new Set<string>()
  filteredOrders.value.forEach(o => {
    const code = o.engine || o.engineType || o.vehicleModel
    if (code && code.trim() && code.trim().toLowerCase() !== 'general') {
      engineSet.add(code.trim().toUpperCase())
    }
  })
  return Array.from(engineSet)
})

const totalEngineOrdersCount = computed(() => {
  return filteredOrders.value.filter(o => o.status !== 'Cancelada').length
})

// Facturación acumulada y desglose Mano de Obra vs Repuestos vs Materiales
const revenueMetrics = computed(() => {
  let total = 0
  let labor = 0
  let parts = 0
  let materials = 0

  filteredOrders.value
    .filter(o => o.status !== 'Cancelada')
    .forEach(o => {
      total += o.total || 0
      labor += o.laborTotal || 0
      parts += o.partsTotal || 0
      materials += o.materialsTotal || 0
    })

  const laborPercent = total > 0 ? Math.round((labor / total) * 100) : 0
  const partsPercent = total > 0 ? Math.round((parts / total) * 100) : 0
  const materialsPercent = total > 0 ? Math.max(0, 100 - laborPercent - partsPercent) : 0

  return {
    total,
    labor,
    parts,
    materials,
    laborPercent,
    partsPercent,
    materialsPercent
  }
})

// Clientes y talleres activos en el período
const activeAccountsInPeriodCount = computed(() => {
  const accounts = new Set<string>()
  filteredOrders.value.forEach(o => {
    if (o.customerId) accounts.add(o.customerId)
    else if (o.customer) accounts.add(o.customer.toLowerCase().trim())
  })
  return accounts.size
})

// === DESGLOSE POR COMPONENTE MECÁNICO (5 BLOQUES) ===
interface ComponentStat {
  name: 'Culata' | 'Block' | 'Cigüeñal' | 'Bielas' | 'Bancadas'
  description: string
  count: number
  percentage: number
  laborRevenue: number
  color: string
  bgLight: string
  borderColor: string
}

const componentStats = computed<ComponentStat[]>(() => {
  const defs: { 
    name: 'Culata' | 'Block' | 'Cigüeñal' | 'Bielas' | 'Bancadas'
    description: string
    color: string
    bgLight: string
    borderColor: string
  }[] = [
    {
      name: 'Culata',
      description: 'Cepillado, prueba hidráulica, guías, válvulas y asientos',
      color: '#0891b2', // cyan-600
      bgLight: 'bg-cyan-50 text-cyan-800',
      borderColor: 'border-cyan-200'
    },
    {
      name: 'Block',
      description: 'Rectificado de cilindros, encamisado, plano y bruñido',
      color: '#2563eb', // blue-600
      bgLight: 'bg-blue-50 text-blue-800',
      borderColor: 'border-blue-200'
    },
    {
      name: 'Cigüeñal',
      description: 'Rectificado de muñones bancada/biela, nitrurado y pulido',
      color: '#059669', // emerald-600
      bgLight: 'bg-emerald-50 text-emerald-800',
      borderColor: 'border-emerald-200'
    },
    {
      name: 'Bielas',
      description: 'Alineación, embocinado, cambio de bujes y rectificado de ojo',
      color: '#d97706', // amber-600
      bgLight: 'bg-amber-50 text-amber-800',
      borderColor: 'border-amber-200'
    },
    {
      name: 'Bancadas',
      description: 'Alineación de túnel, alesado, casquetería y ajuste',
      color: '#7c3aed', // violet-600
      bgLight: 'bg-violet-50 text-violet-800',
      borderColor: 'border-violet-200'
    }
  ]

  const totalFiltered = filteredOrders.value.length || 1

  return defs.map(def => {
    let count = 0
    let laborRevenue = 0

    filteredOrders.value.forEach(order => {
      const hasOps = order.operations?.some(op => op.category === def.name && op.subtotal > 0)
      const isPrimary = order.component === def.name

      if (isPrimary || hasOps) {
        count++
      }

      if (order.operations && order.operations.length > 0) {
        order.operations
          .filter(op => op.category === def.name)
          .forEach(op => {
            laborRevenue += op.subtotal || 0
          })
      } else if (isPrimary) {
        laborRevenue += order.laborTotal || 0
      }
    })

    const percentage = Math.round((count / totalFiltered) * 100)

    return {
      ...def,
      count,
      percentage,
      laborRevenue
    }
  })
})

// === TENDENCIAS MENSUALES (CARGA DE TRABAJO 2026) ===
interface MonthTrend {
  monthIndex: number
  monthShort: string
  monthFull: string
  orderCount: number
  revenue: number
  isCurrent: boolean
}

const monthlyTrends = computed<MonthTrend[]>(() => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const fullMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // Base de 12 meses
  const trends: MonthTrend[] = months.map((m, idx) => ({
    monthIndex: idx,
    monthShort: m,
    monthFull: fullMonths[idx],
    orderCount: 0,
    revenue: 0,
    isCurrent: idx === currentMonth
  }))

  // Considerar todas las órdenes del año actual (o filtradas si hay cliente seleccionado)
  orders.value.forEach(order => {
    // Si hay filtro de cliente, respetarlo en la tendencia
    if (selectedClientFilter.value !== 'ALL') {
      const target = selectedClientFilter.value.toLowerCase().trim()
      const matchesClient = 
        (order.customerId && order.customerId.toLowerCase() === target) ||
        (order.customerCode && order.customerCode.toLowerCase() === target) ||
        (order.workshopCode && order.workshopCode.toLowerCase() === target) ||
        (order.customer && order.customer.toLowerCase().includes(target)) ||
        (order.workshop && order.workshop.toLowerCase().includes(target))
      if (!matchesClient) return
    }

    const orderDate = parseOrderDate(order)
    if (orderDate.getFullYear() === currentYear && order.status !== 'Cancelada') {
      const mIdx = orderDate.getMonth()
      if (mIdx >= 0 && mIdx < 12) {
        trends[mIdx].orderCount++
        trends[mIdx].revenue += order.total || 0
      }
    }
  })

  return trends
})

const maxMonthlyOrders = computed(() => {
  const max = Math.max(...monthlyTrends.value.map(m => m.orderCount))
  return max > 0 ? max : 1
})

const peakWorkloadMonth = computed(() => {
  let peak = monthlyTrends.value[0]
  monthlyTrends.value.forEach(m => {
    if (m.orderCount > peak.orderCount) peak = m
  })
  return peak.orderCount > 0 ? peak : null
})

// === TABLA DE ÓRDENES RECIENTES CON CAMBIO RÁPIDO DE ESTADO ===
const tableFilteredOrders = computed(() => {
  return filteredOrders.value.filter(order => {
    // Búsqueda textual
    if (tableSearchQuery.value.trim()) {
      const q = tableSearchQuery.value.toLowerCase().trim()
      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(q) ||
        order.customer.toLowerCase().includes(q) ||
        (order.workshop && order.workshop.toLowerCase().includes(q)) ||
        (order.vehicleBrand && order.vehicleBrand.toLowerCase().includes(q)) ||
        (order.vehicleModel && order.vehicleModel.toLowerCase().includes(q)) ||
        (order.engine && order.engine.toLowerCase().includes(q))
      if (!matchesSearch) return false
    }

    // Filtro por Estado en pestaña
    if (tableStatusFilter.value !== 'Todos') {
      if (tableStatusFilter.value === 'Activas') {
        if (order.status === 'Cancelada' || order.status === 'Entregado') return false
      } else if (tableStatusFilter.value === 'Terminadas') {
        if (order.status !== 'Terminado' && order.status !== 'Completada') return false
      } else if (order.status !== tableStatusFilter.value) {
        return false
      }
    }

    // Filtro por Componente en pestaña
    if (tableComponentFilter.value !== 'Todos') {
      const hasComp = order.component === tableComponentFilter.value ||
        order.operations?.some(op => op.category === tableComponentFilter.value)
      if (!hasComp) return false
    }

    return true
  })
})

// Cambio rápido de estado en línea (Inline Status Changer)
const updatingOrderId = ref<string | null>(null)

const handleQuickStatusChange = async (order: Order, newStatus: OrderStatus) => {
  if (order.status === newStatus) return
  updatingOrderId.value = order.id

  const previousStatus = order.status
  order.status = newStatus // Actualización optimista inmediata

  try {
    const updated = await ordersService.updateOrderStatus(order.id, newStatus)
    if (updated) {
      showToast(`Orden ${order.orderNumber} actualizada a "${newStatus}"`, 'success')
    } else {
      order.status = previousStatus
      showToast(`No se pudo actualizar la orden ${order.orderNumber}`, 'error')
    }
  } catch (err) {
    order.status = previousStatus
    console.error('Error al actualizar estado:', err)
    showToast(`Error al guardar en Supabase`, 'error')
  } finally {
    updatingOrderId.value = null
  }
}

// Configuración de estilo visual para estados
const getStatusBadgeConfig = (status: OrderStatus) => {
  switch (status) {
    case 'Terminado':
    case 'Completada':
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        selectBg: 'bg-emerald-100/70 text-emerald-900 border-emerald-400',
        dot: 'bg-emerald-500',
        label: 'Terminado',
        icon: CheckCircle2
      }
    case 'En Proceso':
      return {
        bg: 'bg-sky-50 text-sky-800 border-sky-300',
        selectBg: 'bg-sky-100/70 text-sky-900 border-sky-400',
        dot: 'bg-sky-500',
        label: 'En Proceso',
        icon: Clock
      }
    case 'Pendiente':
    case 'Recibido':
    case 'Diagnóstico':
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-300',
        selectBg: 'bg-amber-100/70 text-amber-900 border-amber-400',
        dot: 'bg-amber-500',
        label: 'Pendiente',
        icon: AlertCircle
      }
    case 'Entregado':
      return {
        bg: 'bg-indigo-50 text-indigo-800 border-indigo-300',
        selectBg: 'bg-indigo-100/70 text-indigo-900 border-indigo-400',
        dot: 'bg-indigo-500',
        label: 'Entregado',
        icon: Package
      }
    case 'Cancelada':
      return {
        bg: 'bg-rose-50 text-rose-800 border-rose-300',
        selectBg: 'bg-rose-100/70 text-rose-900 border-rose-400',
        dot: 'bg-rose-500',
        label: 'Cancelada',
        icon: X
      }
    default:
      return {
        bg: 'bg-slate-50 text-slate-800 border-slate-300',
        selectBg: 'bg-slate-100 text-slate-900 border-slate-400',
        dot: 'bg-slate-500',
        label: status,
        icon: Activity
      }
  }
}
</script>

<template>
  <div v-if="authStore.canAccess('/dashboard')" class="space-y-6 sm:space-y-8 pb-12">

    <!-- TOAST NOTIFICACIÓN FLOTANTE -->
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
          toastMessage.type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50' : 
          toastMessage.type === 'error' ? 'bg-rose-950/90 text-rose-200 border-rose-500/50' : 
          'bg-slate-950/90 text-slate-200 border-slate-600'
        ]"
      >
        <CheckCircle2 v-if="toastMessage.type === 'success'" class="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <AlertCircle v-else class="w-5 h-5 text-rose-400 flex-shrink-0" />
        <span>{{ toastMessage.text }}</span>
      </div>
    </transition>

    <!-- ==========================================
         ENCABEZADO PRINCIPAL CON ACCIONES RÁPIDAS
         ========================================== -->
    <header class="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm relative overflow-hidden">
      <!-- Glow ambiental suave -->
      <div class="absolute -right-16 -top-16 w-72 h-72 bg-[#05C7F2]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#05C7F2]/15 text-[#038896] border border-[#05C7F2]/30">
              <Sparkles class="w-3.5 h-3.5 text-[#04C4D9]" />
              JR Blanco Rectificadora
            </span>
            <span class="text-[11px] sm:text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Supabase PostgreSQL 17 Conectado
            </span>
          </div>

          <h1 class="text-xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2 sm:mt-2.5">
            Dashboard Operativo de Administración
          </h1>
          <p class="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Métricas reales de rectificación, flujo de órdenes activas, volumen por cuenta y balance de mano de obra vs. repuestos.
          </p>
        </div>

        <!-- Barra de Botones de Acción Rápida -->
        <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <router-link
            to="/ordenes?nueva=true&tipo=orden"
            class="inline-flex items-center justify-center px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#0D0D0D] hover:bg-neutral-800 active:scale-95 rounded-xl shadow-sm transition-all border border-neutral-700"
          >
            <Plus class="w-4 h-4 mr-1.5 text-[#05F2F2]" />
            + Nueva Orden
          </router-link>

          <router-link
            to="/ordenes?nueva=true&tipo=cotizacion"
            class="inline-flex items-center justify-center px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl transition-all border border-slate-200"
          >
            <FileText class="w-4 h-4 mr-1.5 text-amber-600" />
            + Cotización
          </router-link>

          <router-link
            to="/clientes"
            class="inline-flex items-center justify-center px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 active:scale-95 rounded-xl border border-slate-300 shadow-2xs transition-all"
          >
            <Users class="w-4 h-4 mr-1.5 text-blue-600" />
            Clientes
          </router-link>

          <button
            type="button"
            @click="loadDashboardData(true)"
            :disabled="refreshing"
            class="inline-flex items-center justify-center p-2.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 transition-all disabled:opacity-50"
            title="Sincronizar datos con Supabase"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin text-[#038896]': refreshing }" />
          </button>
        </div>
      </div>
    </header>

    <!-- ==========================================
         PANEL DE FILTROS TEMPORALES Y POR TALLERISTA
         ========================================== -->
    <section class="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        
        <!-- Selector Reactivo de Rango de Fechas (Día / Mes / Año / Todo) -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Calendar class="w-3.5 h-3.5 text-[#038896]" />
            Período:
          </span>

          <div class="inline-flex items-center p-1 bg-slate-100 rounded-2xl gap-1 flex-wrap">
            <button
              type="button"
              @click="selectedPeriod = 'hoy'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                selectedPeriod === 'hoy'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              Hoy (Día)
            </button>
            <button
              type="button"
              @click="selectedPeriod = 'semana'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                selectedPeriod === 'semana'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              Esta Semana
            </button>
            <button
              type="button"
              @click="selectedPeriod = 'mes'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                selectedPeriod === 'mes'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              Mes Actual
            </button>
            <button
              type="button"
              @click="selectedPeriod = 'ano'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                selectedPeriod === 'ano'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              Año 2026
            </button>
            <button
              type="button"
              @click="selectedPeriod = 'todo'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                selectedPeriod === 'todo'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              Todo
            </button>
            <button
              type="button"
              @click="selectedPeriod = 'personalizado'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                selectedPeriod === 'personalizado'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              Rango
            </button>
          </div>
        </div>

        <!-- Filtro por Cliente o Taller (Medir volumen por cuenta) -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Building2 class="w-3.5 h-3.5 text-blue-600" />
            Tallerista / Cliente:
          </span>

          <div class="relative min-w-[240px] sm:min-w-[280px]">
            <select
              v-model="selectedClientFilter"
              class="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05C7F2] transition-colors"
            >
              <option value="ALL">Todos los clientes y talleres</option>
              <optgroup label="Talleres Mecánicos">
                <option 
                  v-for="c in clients.filter(cl => cl.tipo === 'Tallerista')" 
                  :key="c.id" 
                  :value="c.id"
                >
                  {{ c.nombre }} {{ c.especificaciones_tecnicas?.taller ? `(${c.especificaciones_tecnicas.taller})` : '' }}
                </option>
              </optgroup>
              <optgroup label="Clientes Particulares">
                <option 
                  v-for="c in clients.filter(cl => cl.tipo === 'Cliente')" 
                  :key="c.id" 
                  :value="c.id"
                >
                  {{ c.nombre }}
                </option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      <!-- Selector de fechas personalizado cuando está activo -->
      <div 
        v-if="selectedPeriod === 'personalizado'"
        class="pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap"
      >
        <span class="text-xs text-slate-500 font-medium">Definir fechas:</span>
        <div class="flex items-center gap-2">
          <label class="text-xs text-slate-600 font-semibold">Desde:</label>
          <input 
            type="date" 
            v-model="customStartDate"
            class="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium focus:ring-1 focus:ring-[#05C7F2]"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-slate-600 font-semibold">Hasta:</label>
          <input 
            type="date" 
            v-model="customEndDate"
            class="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium focus:ring-1 focus:ring-[#05C7F2]"
          />
        </div>
      </div>

      <!-- Banner de resumen del filtro activo -->
      <div class="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
            <CalendarDays class="w-3.5 h-3.5 text-slate-500" />
            Período: <strong class="text-slate-900">{{ periodDescription }}</strong>
          </span>

          <span 
            v-if="selectedClientInfo" 
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-semibold"
          >
            <Building2 class="w-3.5 h-3.5 text-blue-600" />
            Cuenta: <strong class="text-blue-950">{{ selectedClientInfo.nombre }}</strong>
            <button 
              type="button" 
              @click="selectedClientFilter = 'ALL'"
              class="ml-1 text-blue-600 hover:text-blue-900"
              title="Quitar filtro de cuenta"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </span>
        </div>

        <span class="text-slate-500 text-xs font-medium">
          Mostrando <strong>{{ filteredOrders.length }}</strong> órdenes en el período
        </span>
      </div>
    </section>

    <!-- ==========================================
         TARJETAS KPI (MÉTRICAS CLAVE DE TALLER)
         ========================================== -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      
      <!-- KPI 1: Órdenes Activas y desglose -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Órdenes Activas
          </span>
          <div class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Clock class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-3xl sm:text-4xl font-black text-slate-900">
            {{ statusCounts.totalActivas }}
          </span>
          <span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            En taller
          </span>
        </div>

        <!-- Chips de desglose de estado -->
        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[11px]">
          <span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200" title="Pendientes de diagnóstico o inicio">
            {{ statusCounts.pendiente }} Pend.
          </span>
          <span class="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 font-bold border border-sky-200" title="Actualmente en maquinado">
            {{ statusCounts.enProceso }} Proc.
          </span>
          <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200" title="Maquinado finalizado">
            {{ statusCounts.terminado }} Term.
          </span>
          <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold border border-indigo-200" title="Entregadas al cliente">
            {{ statusCounts.entregado }} Entr.
          </span>
        </div>
      </div>

      <!-- KPI 2: Volumen de Motores Rectificados -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Motores Rectificados
          </span>
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Car class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-3xl sm:text-4xl font-black text-slate-900">
            {{ totalEngineOrdersCount }}
          </span>
          <span class="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <ArrowUpRight class="w-3.5 h-3.5 mr-0.5" />
            {{ distinctEngines.length }} modelos
          </span>
        </div>

        <p class="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="truncate max-w-[190px]" :title="distinctEngines.join(', ')">
            {{ distinctEngines.slice(0, 3).join(', ') || 'Sin motores' }}
          </span>
          <span class="font-bold text-emerald-700 text-[11px]">Volumen</span>
        </p>
      </div>

      <!-- KPI 3: Facturación Acumulada y Balance Mano de Obra vs Repuestos -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Facturación Acumulada
          </span>
          <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <DollarSign class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-2xl sm:text-3xl font-black text-slate-900">
            ${{ revenueMetrics.total.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
          </span>
          <span class="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            Total período
          </span>
        </div>

        <!-- Barra de distribución Mano de Obra vs Repuestos -->
        <div class="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              class="h-full bg-[#038896]" 
              :style="{ width: `${revenueMetrics.laborPercent}%` }"
              :title="`Mano de obra: ${revenueMetrics.laborPercent}% ($${revenueMetrics.labor.toFixed(2)})`"
            ></div>
            <div 
              class="h-full bg-amber-500" 
              :style="{ width: `${revenueMetrics.partsPercent}%` }"
              :title="`Repuestos: ${revenueMetrics.partsPercent}% ($${revenueMetrics.parts.toFixed(2)})`"
            ></div>
            <div 
              class="h-full bg-slate-400" 
              :style="{ width: `${revenueMetrics.materialsPercent}%` }"
              :title="`Materiales: ${revenueMetrics.materialsPercent}% ($${revenueMetrics.materials.toFixed(2)})`"
            ></div>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span class="text-[#038896]">M.O. ${{ revenueMetrics.labor.toFixed(0) }} ({{ revenueMetrics.laborPercent }}%)</span>
            <span class="text-amber-700">Rep. ${{ revenueMetrics.parts.toFixed(0) }} ({{ revenueMetrics.partsPercent }}%)</span>
          </div>
        </div>
      </div>

      <!-- KPI 4: Cuentas y Talleres Activos -->
      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Cuentas Atendidas
          </span>
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Users class="w-6 h-6" />
          </div>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <span class="text-3xl sm:text-4xl font-black text-slate-900">
            {{ activeAccountsInPeriodCount }}
          </span>
          <span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            de {{ clients.length }} registradas
          </span>
        </div>

        <p class="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span>Talleristas y flotas activas</span>
          <router-link to="/clientes" class="font-bold text-indigo-700 hover:underline">
            Ver clientes &rarr;
          </router-link>
        </p>
      </div>
    </section>

    <!-- ==========================================
         GRÁFICOS Y VISUALIZACIONES TÉCNICAS:
         1. SERVICIOS POR COMPONENTE MECÁNICO (5 BLOQUES)
         2. TENDENCIAS DE CARGA DE TRABAJO MENSUAL (2026)
         ========================================== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
      
      <!-- 1. SERVICIOS POR COMPONENTE MECÁNICO (5 Columnas) -->
      <div class="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Wrench class="w-5 h-5 text-[#038896]" />
                Distribución por Componente
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Carga operativa en los 5 bloques mecánicos de rectificación
              </p>
            </div>
            <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700">
              5 Bloques
            </span>
          </div>

          <div class="space-y-4 mt-5">
            <div 
              v-for="item in componentStats" 
              :key="item.name"
              class="group p-2 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
              @click="tableComponentFilter = tableComponentFilter === item.name ? 'Todos' : item.name"
            >
              <div class="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                <div class="flex items-center gap-2">
                  <span 
                    :class="['px-2.5 py-0.5 rounded-lg text-xs font-black border', item.bgLight, item.borderColor]"
                  >
                    {{ item.name }}
                  </span>
                  <span class="text-[11px] text-slate-500 font-normal hidden xl:inline truncate max-w-[200px]">
                    {{ item.description }}
                  </span>
                </div>
                <div class="text-right">
                  <span class="font-black text-slate-900">{{ item.count }} trab.</span>
                  <span class="text-slate-500 text-xs font-semibold ml-1">({{ item.percentage }}%)</span>
                </div>
              </div>

              <!-- Barra Proporcional -->
              <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                <div 
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ 
                    width: `${Math.max(item.percentage, item.count > 0 ? 8 : 0)}%`, 
                    backgroundColor: item.color 
                  }"
                ></div>
              </div>

              <!-- Facturación generada por componente -->
              <div class="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-medium">
                <span>Mano de obra estimada:</span>
                <span class="font-bold text-slate-800">${{ item.laborRevenue.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Resumen inferior -->
        <div class="mt-6 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-6 -mb-6 p-5 rounded-b-3xl">
          <div class="flex items-center justify-between text-xs text-slate-700">
            <span class="font-medium">Filtrar tabla por componente:</span>
            <span 
              v-if="tableComponentFilter !== 'Todos'" 
              class="font-bold text-[#038896] bg-cyan-100 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
              @click="tableComponentFilter = 'Todos'"
            >
              {{ tableComponentFilter }} <X class="w-3 h-3" />
            </span>
            <span v-else class="text-slate-500 text-[11px]">Haz clic en cualquier bloque</span>
          </div>
        </div>
      </div>

      <!-- 2. TENDENCIAS DE CARGA DE TRABAJO MENSUAL (7 Columnas) -->
      <div class="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart3 class="w-5 h-5 text-indigo-600" />
                Tendencias de Carga Mensual (2026)
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Evolución de órdenes de rectificación y facturación a lo largo del año
              </p>
            </div>

            <div v-if="peakWorkloadMonth" class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold">
              <TrendingUp class="w-3.5 h-3.5 text-indigo-600" />
              Pico: {{ peakWorkloadMonth.monthFull }} ({{ peakWorkloadMonth.orderCount }} ord.)
            </div>
          </div>

          <!-- Gráfico visual de barras mensuales (SVG + CSS interactivo) -->
          <div class="mt-6">
            <div class="grid grid-cols-12 gap-1.5 sm:gap-2 h-48 items-end pt-6 pb-2 px-1">
              <div 
                v-for="month in monthlyTrends" 
                :key="month.monthIndex"
                class="flex flex-col items-center h-full justify-end group relative"
              >
                <!-- Tooltip al hover -->
                <div class="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
                  <span>{{ month.monthFull }}: {{ month.orderCount }} órdenes</span>
                  <span class="text-[#05F2F2]">${{ month.revenue.toFixed(0) }}</span>
                  <div class="w-2 h-2 bg-slate-900 rotate-45 -mb-1"></div>
                </div>

                <!-- Barra de volumen -->
                <div 
                  class="w-full rounded-t-lg transition-all duration-300 relative flex items-center justify-center"
                  :class="[
                    month.isCurrent 
                      ? 'bg-gradient-to-t from-[#038896] to-[#05C7F2] shadow-sm' 
                      : month.orderCount > 0 
                        ? 'bg-gradient-to-t from-slate-400 to-indigo-500 group-hover:from-indigo-600 group-hover:to-indigo-400' 
                        : 'bg-slate-100'
                  ]"
                  :style="{ 
                    height: `${month.orderCount > 0 ? Math.max((month.orderCount / maxMonthlyOrders) * 100, 15) : 8}%` 
                  }"
                >
                  <span 
                    v-if="month.orderCount > 0" 
                    class="text-[10px] font-black text-white drop-shadow-xs"
                  >
                    {{ month.orderCount }}
                  </span>
                </div>

                <!-- Etiqueta de mes -->
                <span 
                  class="text-[10px] sm:text-xs font-bold mt-2 transition-colors"
                  :class="[month.isCurrent ? 'text-[#038896] underline font-black' : 'text-slate-500 group-hover:text-slate-900']"
                >
                  {{ month.monthShort }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Resumen de tendencias en el pie -->
        <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="w-2.5 h-2.5 rounded-sm bg-[#05C7F2]"></span>
              Mes en curso
            </span>
            <span class="flex items-center gap-1.5 font-medium">
              <span class="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
              Meses cerrados
            </span>
          </div>
          <span class="font-bold text-slate-800">
            Total anual: {{ monthlyTrends.reduce((sum, m) => sum + m.orderCount, 0) }} órdenes
          </span>
        </div>
      </div>
    </div>

    <!-- ==========================================
         SECCIÓN PRINCIPAL: ÓRDENES RECIENTES
         CON CAMBIO RÁPIDO DE ESTADO (INLINE DROPDOWN)
         ========================================== -->
    <section class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7">
      
      <!-- Cabecera de la sección y barra de búsqueda/filtros -->
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Activity class="w-5 h-5 text-blue-600" />
            Órdenes de Trabajo y Cotizaciones
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Cambio rápido de estado en mostrador y acceso directo a órdenes
          </p>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <!-- Búsqueda textual rápida -->
          <div class="relative min-w-[200px] sm:min-w-[240px]">
            <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              v-model="tableSearchQuery"
              placeholder="Buscar por orden, cliente, motor..."
              class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#05C7F2]"
            />
          </div>

          <!-- Filtros de Pestaña de Estado -->
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl flex-wrap">
            <button
              v-for="st in ['Todos', 'Activas', 'Pendiente', 'En Proceso', 'Terminadas']"
              :key="st"
              type="button"
              @click="tableStatusFilter = st"
              :class="[
                'px-2.5 py-1 rounded-xl text-xs font-bold transition-all',
                tableStatusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              {{ st }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de Órdenes -->
      <div class="overflow-x-auto mt-4 -mx-2 sm:mx-0">
        <table class="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <th class="py-3 px-3">Código / Fecha</th>
              <th class="py-3 px-3">Cliente / Taller</th>
              <th class="py-3 px-3">Motor & Componente</th>
              <th class="py-3 px-3">Tipo</th>
              <th class="py-3 px-3">Estado Rápido</th>
              <th class="py-3 px-3 text-right">Facturación</th>
              <th class="py-3 px-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
            <tr 
              v-for="order in tableFilteredOrders" 
              :key="order.id"
              class="hover:bg-slate-50/90 transition-colors group"
            >
              <!-- 1. Código y Fecha -->
              <td class="py-3.5 px-3">
                <router-link 
                  :to="`/ordenes?id=${order.id}`" 
                  class="font-black text-indigo-700 hover:text-indigo-900 hover:underline block"
                >
                  {{ order.orderNumber }}
                </router-link>
                <span class="text-[11px] text-slate-500 block">
                  {{ order.date }}
                </span>
              </td>

              <!-- 2. Cliente y Taller -->
              <td class="py-3.5 px-3">
                <span class="font-bold text-slate-900 block truncate max-w-[200px]" :title="order.customer">
                  {{ order.customer }}
                </span>
                <span v-if="order.workshop" class="text-[11px] text-blue-700 font-semibold block truncate max-w-[200px]">
                  Taller: {{ order.workshop }}
                </span>
                <span v-else class="text-[11px] text-slate-500 block">
                  Cliente Particular
                </span>
              </td>

              <!-- 3. Motor y Componente Mecánico -->
              <td class="py-3.5 px-3">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                    {{ order.component || 'Culata' }}
                  </span>
                  <span class="text-xs text-slate-800 font-semibold truncate max-w-[140px]">
                    {{ order.engine || order.engineType || order.vehicleModel || 'General' }}
                  </span>
                </div>
              </td>

              <!-- 4. Tipo de Documento -->
              <td class="py-3.5 px-3">
                <span 
                  v-if="order.type === 'cotizacion'"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                >
                  Cotización
                </span>
                <span 
                  v-else
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#05C7F2]/15 text-[#038896] border border-[#05C7F2]/30"
                >
                  Orden Taller
                </span>
              </td>

              <!-- 5. Selector Rápido de Estado (Inline Quick Status Changer) -->
              <td class="py-3.5 px-3">
                <div class="relative inline-block">
                  <select
                    :value="order.status"
                    @change="handleQuickStatusChange(order, ($event.target as HTMLSelectElement).value as OrderStatus)"
                    :disabled="updatingOrderId === order.id"
                    :class="[
                      'text-xs font-bold py-1 pl-2.5 pr-7 rounded-full border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#05C7F2]',
                      getStatusBadgeConfig(order.status).selectBg,
                      updatingOrderId === order.id ? 'opacity-50 cursor-wait' : ''
                    ]"
                  >
                    <option value="Pendiente">⏳ Pendiente</option>
                    <option value="En Proceso">⚙️ En Proceso</option>
                    <option value="Terminado">✅ Terminado</option>
                    <option value="Entregado">📦 Entregado</option>
                    <option value="Cancelada">❌ Cancelada</option>
                  </select>
                </div>
              </td>

              <!-- 6. Facturación y desglose -->
              <td class="py-3.5 px-3 text-right">
                <span class="font-black text-slate-900 block">
                  ${{ order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
                </span>
                <span class="text-[10px] text-slate-500 font-medium block">
                  MO ${{ (order.laborTotal || 0).toFixed(0) }} · Rep ${{ (order.partsTotal || 0).toFixed(0) }}
                </span>
              </td>

              <!-- 7. Acción Directa -->
              <td class="py-3.5 px-3 text-center">
                <router-link
                  :to="`/ordenes?id=${order.id}`"
                  class="inline-flex items-center justify-center p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Abrir orden completa"
                >
                  <Eye class="w-4 h-4" />
                </router-link>
              </td>
            </tr>

            <!-- Estado Vacío -->
            <tr v-if="tableFilteredOrders.length === 0">
              <td colspan="7" class="py-10 text-center text-slate-500 text-xs">
                <div class="flex flex-col items-center justify-center gap-2">
                  <Activity class="w-8 h-8 text-slate-300" />
                  <p class="font-medium text-slate-700">No se encontraron órdenes con los filtros seleccionados.</p>
                  <p class="text-[11px] text-slate-400">Prueba cambiando el rango de fechas o limpiando el filtro de cliente.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer de la tabla -->
      <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
        <span class="text-slate-500">
          Mostrando <strong>{{ tableFilteredOrders.length }}</strong> de <strong>{{ filteredOrders.length }}</strong> órdenes
        </span>

        <router-link
          to="/ordenes"
          class="inline-flex items-center font-bold text-indigo-700 hover:text-indigo-900 transition-colors"
        >
          Gestor Completo de Órdenes &rarr;
        </router-link>
      </div>
    </section>

    <!-- ==========================================
         BANNER DE AYUDA Y ACCESO RÁPIDO OPERATIVO
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
              Administración de servicios por componente (Bielas, Bancadas, Cigüeñal, Culata, Block) con cotizaciones e impresión formal.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <router-link
            to="/ordenes?nueva=true&tipo=orden"
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