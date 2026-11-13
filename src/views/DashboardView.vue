<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ordersService, type Order, type OrderStatus } from '@/services/ordersService'
import { clientesService, type Cliente } from '@/services/clientesService'
import { rutasService, type RutaSucursal } from '@/services/rutasService'
import { useAnimatedNumber } from '@/composables/useAnimatedNumber'
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
  Cog, 
  DollarSign, 
  Car, 
  Eye, 
  Building2, 
  X, 
  BarChart3, 
  Search, 
  CalendarDays,
  MapPin
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// Estado principal de datos
const orders = ref<Order[]>([])
const clients = ref<Cliente[]>([])
const rutas = ref<RutaSucursal[]>([])
const loading = ref(true)
const toastMessage = ref<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)
let toastTimeout: any = null

// Filtros Reactivos de Período Temporal
type TimePeriod = 'hoy' | 'semana' | 'mes' | 'ano' | 'todo' | 'personalizado'
const selectedPeriod = ref<TimePeriod>('mes')
const customStartDate = ref('')
const customEndDate = ref('')

// Buscador Reactivo de Cliente / Taller consultado directamente en Supabase y Filtro de Ruta
const supabaseClients = ref<Cliente[]>([])
const selectedClient = ref<Cliente | null>(null)
const selectedClientFilter = ref<string>('ALL')
const selectedRutaFilter = ref<string>('ALL')
const clientSearchInput = ref('')
const isClientDropdownOpen = ref(false)
const isSearchingClients = ref(false)
const clientSearchContainerRef = ref<HTMLElement | null>(null)
let clientSearchDebounce: any = null

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

// Carga inicial consultando directamente Supabase (sin caché local)
const loadDashboardData = async () => {
  loading.value = true
  try {
    const [fetchedOrders, fetchedClients, fetchedRutas] = await Promise.all([
      ordersService.getOrders(),
      clientesService.getClientesFromSupabase(),
      rutasService.getRutas(),
    ])
    orders.value = fetchedOrders
    supabaseClients.value = fetchedClients
    clients.value = fetchedClients
    rutas.value = fetchedRutas
  } catch (err) {
    console.error('[DashboardView] Error cargando datos de Supabase:', err)
    showToast('Error de conexión con Supabase al cargar clientes.', 'error')
  } finally {
    loading.value = false
  }
}

// Búsqueda asistida en vivo directo en Supabase
const handleClientSearchInput = () => {
  isClientDropdownOpen.value = true
  if (clientSearchDebounce) clearTimeout(clientSearchDebounce)
  clientSearchDebounce = setTimeout(async () => {
    isSearchingClients.value = true
    try {
      supabaseClients.value = await clientesService.getClientesFromSupabase(clientSearchInput.value)
    } catch (err) {
      console.error('[DashboardView] Error buscando clientes en Supabase:', err)
    } finally {
      isSearchingClients.value = false
    }
  }, 250)
}

const selectClient = (client: Cliente | null) => {
  selectedClient.value = client
  selectedClientFilter.value = client ? client.id : 'ALL'
  clientSearchInput.value = ''
  isClientDropdownOpen.value = false
}

const clearClientFilter = () => {
  selectClient(null)
}

const handleClickOutsideClientSearch = (event: MouseEvent) => {
  if (clientSearchContainerRef.value && !clientSearchContainerRef.value.contains(event.target as Node)) {
    isClientDropdownOpen.value = false
  }
}

onMounted(async () => {
  if (!authStore.canAccess('/dashboard')) {
    router.replace(authStore.defaultRoute)
    return
  }

  document.addEventListener('click', handleClickOutsideClientSearch)

  // Inicializar fechas para filtro personalizado (últimos 30 días)
  const today = new Date()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  customEndDate.value = today.toISOString().split('T')[0]
  customStartDate.value = thirtyDaysAgo.toISOString().split('T')[0]

  await loadDashboardData()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutsideClientSearch)
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

    // 2. Filtro de Cliente / Taller consultado en Supabase
    if (selectedClient.value) {
      const c = selectedClient.value
      const targetId = (c.id || '').toLowerCase()
      const targetCode = (c.codigo || '').toLowerCase()
      const targetName = (c.nombre || '').toLowerCase()
      const targetTaller = (c.especificaciones_tecnicas?.taller || '').toLowerCase()

      const matchesClient = 
        (order.customerId && order.customerId.toLowerCase() === targetId) ||
        (order.customerCode && order.customerCode.toLowerCase() === targetCode) ||
        (order.workshopCode && order.workshopCode.toLowerCase() === targetCode) ||
        (targetName && order.customer && order.customer.toLowerCase().includes(targetName)) ||
        (targetTaller && order.customer && order.customer.toLowerCase().includes(targetTaller)) ||
        (targetTaller && order.workshop && order.workshop.toLowerCase().includes(targetTaller)) ||
        (targetName && order.workshop && order.workshop.toLowerCase().includes(targetName))

      if (!matchesClient) return false
    }

    // 3. Filtro por Ruta / Sucursal
    if (selectedRutaFilter.value !== 'ALL') {
      if (selectedRutaFilter.value === 'UNASSIGNED') {
        if (order.rutaId || order.rutaNombre) return false
      } else {
        const targetRuta = rutas.value.find(r => r.id === selectedRutaFilter.value)
        const matchesRuta =
          order.rutaId === selectedRutaFilter.value ||
          (targetRuta && order.rutaCodigo?.toLowerCase() === targetRuta.codigo.toLowerCase()) ||
          (targetRuta && order.rutaNombre?.toLowerCase() === targetRuta.nombre.toLowerCase())
        if (!matchesRuta) return false
      }
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

// Cliente seleccionado consultado directamente en Supabase
const selectedClientInfo = computed(() => {
  return selectedClient.value
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
      color: '#3D9DB0', // soft aqua derived from #04C4D9
      bgLight: 'bg-[#E3F5F8] text-[#12697A]',
      borderColor: 'border-[#C1E8EF]'
    },
    {
      name: 'Block',
      description: 'Rectificado de cilindros, encamisado, plano y bruñido',
      color: '#2B5C8F', // muted cobalt derived from #004B97
      bgLight: 'bg-[#E8F1FA] text-[#1B4978]',
      borderColor: 'border-[#CFE1F4]'
    },
    {
      name: 'Cigüeñal',
      description: 'Rectificado de muñones bancada/biela, nitrurado y pulido',
      color: '#0284C7', // cerulean blue
      bgLight: 'bg-sky-50 text-[#0369A1]',
      borderColor: 'border-sky-200'
    },
    {
      name: 'Bielas',
      description: 'Alineación, embocinado, cambio de bujes y rectificado de ojo',
      color: '#A4844F', // warm mineral sand
      bgLight: 'bg-[#F6F0E4] text-[#6E5835]',
      borderColor: 'border-[#E6DAC2]'
    },
    {
      name: 'Bancadas',
      description: 'Alineación de túnel, alesado, casquetería y ajuste',
      color: '#5B658E', // slate indigo
      bgLight: 'bg-[#EDF0F7] text-[#3B446B]',
      borderColor: 'border-[#D5DCF0]'
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
    if (selectedClient.value) {
      const c = selectedClient.value
      const targetId = (c.id || '').toLowerCase()
      const targetCode = (c.codigo || '').toLowerCase()
      const targetName = (c.nombre || '').toLowerCase()
      const targetTaller = (c.especificaciones_tecnicas?.taller || '').toLowerCase()

      const matchesClient = 
        (order.customerId && order.customerId.toLowerCase() === targetId) ||
        (order.customerCode && order.customerCode.toLowerCase() === targetCode) ||
        (order.workshopCode && order.workshopCode.toLowerCase() === targetCode) ||
        (targetName && order.customer && order.customer.toLowerCase().includes(targetName)) ||
        (targetTaller && order.customer && order.customer.toLowerCase().includes(targetTaller)) ||
        (targetTaller && order.workshop && order.workshop.toLowerCase().includes(targetTaller)) ||
        (targetName && order.workshop && order.workshop.toLowerCase().includes(targetName))

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
        bg: 'bg-cyan-50 text-[#038391] border-cyan-300',
        selectBg: 'bg-cyan-100/70 text-[#0D1B3E] border-cyan-400',
        dot: 'bg-[#04C4D9]',
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

const animatedActiveOrders = useAnimatedNumber(() => statusCounts.value.totalActivas, 460)
const animatedEnginesCount = useAnimatedNumber(() => totalEngineOrdersCount.value, 480)
const animatedRevenueTotal = useAnimatedNumber(() => revenueMetrics.value.total, 540)
const animatedAccountsCount = useAnimatedNumber(() => activeAccountsInPeriodCount.value, 460)
</script>

<template>
  <div v-if="authStore.canAccess('/dashboard')" class="space-y-6 pb-10">

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
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold max-w-md backdrop-blur-md"
        :class="[
          toastMessage.type === 'success' ? 'bg-[#0D1B3E]/95 text-[#BFEBF2] border-[#04C4D9]/50' :
          toastMessage.type === 'error' ? 'bg-rose-950/95 text-rose-100 border-rose-400/50' :
          'bg-[#0D1B3E]/95 text-slate-100 border-[#04C4D9]/40'
        ]"
      >
        <CheckCircle2 v-if="toastMessage.type === 'success'" class="w-5 h-5 text-[#04C4D9] flex-shrink-0" />
        <AlertCircle v-else class="w-5 h-5 text-rose-400 flex-shrink-0" />
        <span>{{ toastMessage.text }}</span>
      </div>
    </transition>

    <!-- ==========================================
         BENTO HERO SPOTLIGHT + CONTROL OPERATIVO
         ========================================== -->
    <section class="relative z-20 grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">

      <!-- Hero Command Banner (8 cols) -->
      <div class="xl:col-span-8 studio-hero-banner p-6 sm:p-7 text-white relative z-20 overflow-visible flex flex-col justify-between gap-5">
        <!-- Halo ambiental cian (con recorte propio para no cortar el desplegable) -->
        <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
          <div class="absolute -top-16 -right-12 w-64 h-64 rounded-full bg-[#04C4D9]/25 blur-3xl"></div>
        </div>

        <!-- Header & Selector de Período -->
        <div class="relative z-10 flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
              <span class="w-2 h-2 rounded-full bg-[#BFEBF2] animate-pulse shrink-0"></span>
              <span class="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#BFEBF2] whitespace-nowrap">
                JR BLANCO STUDIO · TELEMETRÍA
              </span>
              <span class="font-mono text-[10px] text-white/90 font-semibold border-l border-white/20 pl-2 whitespace-nowrap">
                {{ filteredOrders.length }} órdenes
              </span>
            </div>

            <!-- Selector Segmentado de Período -->
            <div class="inline-flex items-center p-1 bg-[#09132B]/45 backdrop-blur-md border border-white/15 rounded-xl gap-1 flex-wrap">
              <button
                type="button"
                @click="selectedPeriod = 'hoy'"
                :class="[
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer',
                  selectedPeriod === 'hoy'
                    ? 'bg-white text-[#0D1B3E] shadow-sm'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                ]"
              >
                Hoy (Día)
              </button>
              <button
                type="button"
                @click="selectedPeriod = 'semana'"
                :class="[
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer',
                  selectedPeriod === 'semana'
                    ? 'bg-white text-[#0D1B3E] shadow-sm'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                ]"
              >
                Esta Semana
              </button>
              <button
                type="button"
                @click="selectedPeriod = 'mes'"
                :class="[
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer',
                  selectedPeriod === 'mes'
                    ? 'bg-white text-[#0D1B3E] shadow-sm'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                ]"
              >
                Mes Actual
              </button>
              <button
                type="button"
                @click="selectedPeriod = 'ano'"
                :class="[
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer',
                  selectedPeriod === 'ano'
                    ? 'bg-white text-[#0D1B3E] shadow-sm'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                ]"
              >
                Año 2026
              </button>
              <button
                type="button"
                @click="selectedPeriod = 'todo'"
                :class="[
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer',
                  selectedPeriod === 'todo'
                    ? 'bg-white text-[#0D1B3E] shadow-sm'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                ]"
              >
                Todo
              </button>
              <button
                type="button"
                @click="selectedPeriod = 'personalizado'"
                :class="[
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer',
                  selectedPeriod === 'personalizado'
                    ? 'bg-white text-[#0D1B3E] shadow-sm'
                    : 'text-blue-100/80 hover:text-white hover:bg-white/10'
                ]"
              >
                Rango
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Dashboard Operativo de Taller
            </h1>
            <p class="text-xs sm:text-sm text-blue-100/90 max-w-2xl">
              Control visual de rectificación, rutas, cuentas activas y balance de facturación en tiempo real.
            </p>
          </div>
        </div>

        <!-- Barra Luminosa Integrada de Filtros (Ruta, Cliente, Rango) -->
        <div class="relative z-20 bg-white/95 backdrop-blur-md rounded-2xl p-4 text-slate-900 shadow-lg border border-white/60 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <!-- Ruta -->
            <div class="md:col-span-5 flex items-center gap-2 min-w-0">
              <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-[#004B97] flex items-center gap-1 shrink-0">
                <MapPin class="w-3.5 h-3.5 text-[#04C4D9]" />
                Ruta:
              </span>
              <div class="relative flex-1 min-w-0">
                <select
                  v-model="selectedRutaFilter"
                  class="w-full pl-3 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#0D1B3E] focus:bg-white focus:outline-none focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/25 transition-all truncate"
                >
                  <option value="ALL">Todas las rutas ({{ orders.length }})</option>
                  <option
                    v-for="r in rutas"
                    :key="r.id"
                    :value="r.id"
                  >
                    {{ r.codigo }} · {{ r.nombre }}
                  </option>
                  <option value="UNASSIGNED">General (Sin ruta asignada)</option>
                </select>
              </div>
            </div>

            <!-- Buscador Cliente / Tallerista -->
            <div class="md:col-span-7 flex items-center gap-2 min-w-0">
              <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-[#004B97] flex items-center gap-1 shrink-0">
                <Building2 class="w-3.5 h-3.5 text-[#04C4D9]" />
                Tallerista:
              </span>

              <div ref="clientSearchContainerRef" class="relative flex-1 min-w-0">
                <!-- Vista cuando hay un cliente seleccionado -->
                <div
                  v-if="selectedClient"
                  class="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50 border border-[#004B97]/30 rounded-xl text-xs"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#004B97] text-white flex-shrink-0">
                      {{ selectedClient.codigo || (selectedClient.tipo === 'Tallerista' ? 'TAL' : 'CLI') }}
                    </span>
                    <div class="truncate">
                      <span class="font-bold text-[#0D1B3E] block truncate">{{ selectedClient.nombre }}</span>
                      <span v-if="selectedClient.especificaciones_tecnicas?.taller" class="text-[10px] text-[#004B97] font-medium block truncate">
                        Taller: {{ selectedClient.especificaciones_tecnicas.taller }}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    @click="clearClientFilter"
                    class="p-1 hover:bg-blue-100 text-[#004B97] rounded-lg transition flex-shrink-0 cursor-pointer"
                    title="Quitar filtro de cliente"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Input Buscador cuando NO hay cliente seleccionado -->
                <div v-else class="relative">
                  <Search class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    v-model="clientSearchInput"
                    @focus="isClientDropdownOpen = true"
                    @input="handleClientSearchInput"
                    placeholder="Buscar cliente o taller en Supabase..."
                    class="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-[#0D1B3E] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/25 transition-all"
                  />
                  <span v-if="isSearchingClients" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <div class="w-3.5 h-3.5 border-2 border-[#04C4D9] border-t-transparent rounded-full animate-spin"></div>
                  </span>
                </div>

                <!-- Desplegable de Resultados de Búsqueda de Supabase -->
                <Transition name="popover-pop">
                  <div
                    v-if="isClientDropdownOpen && !selectedClient"
                    class="origin-top sm:origin-top-right absolute z-50 top-full mt-2 left-0 sm:left-auto sm:right-0 w-full sm:w-[380px] max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                  >
                    <div class="px-3.5 py-2.5 bg-[#19314D] text-white flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-bold">
                      <span class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-[#04C4D9] animate-pulse"></span>
                        Clientes en Supabase
                      </span>
                      <span v-if="supabaseClients.length > 0" class="text-[#BFEBF2]">
                        {{ supabaseClients.length }} disp.
                      </span>
                    </div>

                    <div class="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                      <button
                        type="button"
                        @click="selectClient(null)"
                        class="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 font-semibold transition cursor-pointer"
                      >
                        <span class="flex items-center gap-2">
                          <Users class="w-4 h-4 text-slate-400" />
                          Todos los clientes y talleres
                        </span>
                        <span class="font-mono text-[10px] text-slate-400">Sin filtro</span>
                      </button>

                      <button
                        v-for="c in supabaseClients"
                        :key="c.id"
                        type="button"
                        @click="selectClient(c)"
                        class="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 transition group flex items-start gap-2.5 cursor-pointer"
                      >
                        <span
                          class="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold mt-0.5 flex-shrink-0 bg-[#004B97] text-white"
                        >
                          {{ c.codigo }}
                        </span>
                        <div class="flex-1 min-w-0">
                          <div class="font-bold text-[#0D1B3E] group-hover:text-[#004B97] truncate">
                            {{ c.nombre }}
                          </div>
                          <div v-if="c.especificaciones_tecnicas?.taller" class="text-[11px] text-[#12697A] font-semibold truncate">
                            Taller: {{ c.especificaciones_tecnicas.taller }}
                          </div>
                          <div v-else-if="c.telefono" class="text-[10px] font-mono text-slate-400 truncate">
                            Tel: {{ c.telefono }}
                          </div>
                        </div>
                        <span class="font-mono text-[10px] font-medium text-slate-400 flex-shrink-0">
                          {{ c.tipo }}
                        </span>
                      </button>

                      <div v-if="!isSearchingClients && supabaseClients.length === 0" class="px-4 py-6 text-center text-slate-500 text-xs">
                        No se encontraron clientes en Supabase que coincidan con "{{ clientSearchInput }}".
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- Fila inferior de estado del filtro -->
          <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200/80 text-[#004B97] font-mono text-[11px] font-bold">
                <CalendarDays class="w-3.5 h-3.5 text-[#04C4D9]" />
                {{ periodDescription }}
              </span>

              <span
                v-if="selectedClientInfo"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-50 text-[#004B97] border border-cyan-200 font-semibold text-xs"
              >
                <Building2 class="w-3.5 h-3.5 text-[#04C4D9]" />
                <strong>{{ selectedClientInfo.nombre }}</strong>
                <button
                  type="button"
                  @click="clearClientFilter"
                  class="ml-1 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Quitar filtro de cuenta"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </span>
            </div>

            <span class="font-mono text-[11px] text-slate-500 font-medium">
              Mostrando <strong class="text-[#0D1B3E]">{{ filteredOrders.length }}</strong> órdenes
            </span>
          </div>

          <!-- Selector de fechas personalizado cuando está activo -->
          <div
            v-if="selectedPeriod === 'personalizado'"
            class="pt-2.5 border-t border-slate-200/80 flex items-center gap-3 flex-wrap"
          >
            <span class="font-mono text-[11px] text-[#004B97] font-bold uppercase">Rango personalizado:</span>
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-600 font-semibold">Desde:</label>
              <input
                type="date"
                v-model="customStartDate"
                class="px-2.5 py-1 text-xs border border-slate-200 rounded-xl bg-slate-50 font-mono focus:bg-white focus:border-[#04C4D9] focus:outline-none"
              />
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-600 font-semibold">Hasta:</label>
              <input
                type="date"
                v-model="customEndDate"
                class="px-2.5 py-1 text-xs border border-slate-200 rounded-xl bg-slate-50 font-mono focus:bg-white focus:border-[#04C4D9] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Spotlight Financiero y Acción Rápida (4 cols) -->
      <div class="xl:col-span-4 studio-card p-6 flex flex-col justify-between relative z-10 overflow-hidden workshop-stagger-1">

        <div class="relative z-10">
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-[#038391] border border-cyan-200 font-mono text-[10px] font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-[#04C4D9] animate-pulse"></span>
              Balance de Ingresos
            </span>
            <span class="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#004B97]">
              <Package class="w-3.5 h-3.5 text-[#04C4D9]" />
              {{ filteredOrders.length }} docs
            </span>
          </div>

          <div class="mt-4">
            <p class="text-xs font-semibold text-slate-500">Facturación acumulada del período</p>
            <p class="font-display tabular-nums text-3xl sm:text-4xl font-extrabold text-[#0D1B3E] tracking-tight mt-1">
              ${{ animatedRevenueTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </p>
          </div>

          <!-- Barra de Composición Vibrante -->
          <div class="mt-5 space-y-2.5">
            <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200/70">
              <div
                class="h-full rounded-l-full bg-[#2B5C8F] transition-all duration-500"
                :style="{ width: `${revenueMetrics.laborPercent}%` }"
                :title="`Mano de obra: ${revenueMetrics.laborPercent}% ($${revenueMetrics.labor.toFixed(2)})`"
              ></div>
              <div
                class="h-full bg-[#4EAEC0] transition-all duration-500"
                :style="{ width: `${revenueMetrics.partsPercent}%` }"
                :title="`Repuestos: ${revenueMetrics.partsPercent}% ($${revenueMetrics.parts.toFixed(2)})`"
              ></div>
              <div
                class="h-full rounded-r-full bg-slate-400 transition-all duration-500"
                :style="{ width: `${revenueMetrics.materialsPercent}%` }"
                :title="`Materiales: ${revenueMetrics.materialsPercent}% ($${revenueMetrics.materials.toFixed(2)})`"
              ></div>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div class="rounded-xl bg-[#E8F1FA] border border-[#CFE1F4] px-3 py-2">
                <span class="block text-[10px] font-mono uppercase tracking-wider font-bold text-[#1B4978]">Mano de Obra ({{ revenueMetrics.laborPercent }}%)</span>
                <span class="font-mono tabular-nums text-sm font-extrabold text-[#0F1E2E]">${{ revenueMetrics.labor.toFixed(2) }}</span>
              </div>
              <div class="rounded-xl bg-[#E3F5F8] border border-[#C1E8EF] px-3 py-2">
                <span class="block text-[10px] font-mono uppercase tracking-wider font-bold text-[#12697A]">Repuestos ({{ revenueMetrics.partsPercent }}%)</span>
                <span class="font-mono tabular-nums text-sm font-extrabold text-[#0F1E2E]">${{ revenueMetrics.parts.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="relative z-10 mt-5 pt-4 border-t border-slate-100 flex items-center gap-2.5">
          <router-link
            to="/ordenes?nueva=true&tipo=orden"
            class="studio-cta-primary flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm"
          >
            <Plus class="w-4 h-4 stroke-[2.5]" />
            <span>Nueva Orden</span>
          </router-link>
          <router-link
            to="/ordenes"
            class="inline-flex items-center justify-center px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-[#0D1B3E] hover:text-[#004B97] font-bold text-xs transition-colors"
            title="Ir al gestor de órdenes"
          >
            <ArrowUpRight class="w-4 h-4" />
          </router-link>
        </div>
      </div>

    </section>

    <!-- ==========================================
         TARJETAS KPI ANIMADAS (BENTO ROW)
         ========================================== -->
    <section class="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

      <!-- KPI 1: Órdenes Activas y desglose -->
      <div class="studio-kpi-card workshop-stagger-1 p-5 flex flex-col justify-between">
        <div class="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#E3F5F8]"></div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Órdenes Activas
            </span>
            <span class="w-9 h-9 rounded-xl bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] flex items-center justify-center">
              <Clock class="w-4 h-4" />
            </span>
          </div>

          <div class="mt-3 flex items-baseline justify-between">
            <span class="font-display tabular-nums text-3xl sm:text-4xl font-extrabold text-[#0F1E2E]">
              {{ Math.round(animatedActiveOrders) }}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-[#E3F5F8] text-[#12697A] font-mono text-[10px] font-bold uppercase">
              En taller
            </span>
          </div>
        </div>

        <div class="relative z-10 mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
          <span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200/80" title="Pendientes de diagnóstico o inicio">
            {{ statusCounts.pendiente }} Pend
          </span>
          <span class="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-bold border border-sky-200/80" title="Actualmente en maquinado">
            {{ statusCounts.enProceso }} Proc
          </span>
          <span class="px-2 py-0.5 rounded-md bg-cyan-50 text-[#038391] font-bold border border-cyan-200/80" title="Maquinado finalizado">
            {{ statusCounts.terminado }} Term
          </span>
          <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80" title="Entregadas al cliente">
            {{ statusCounts.entregado }} Entr
          </span>
        </div>
      </div>

      <!-- KPI 2: Volumen de Motores Rectificados -->
      <div class="studio-kpi-card workshop-stagger-2 p-5 flex flex-col justify-between">
        <div class="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#04C4D9]/12"></div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Motores Rectificados
            </span>
            <span class="w-9 h-9 rounded-xl bg-[#E3F5F8] text-[#038391] border border-[#C1E8EF] flex items-center justify-center">
              <Car class="w-4 h-4" />
            </span>
          </div>

          <div class="mt-3 flex items-baseline justify-between">
            <span class="font-display tabular-nums text-3xl sm:text-4xl font-extrabold text-[#0D1B3E]">
              {{ Math.round(animatedEnginesCount) }}
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-50 text-[#038391] font-mono text-[10px] font-bold">
              <ArrowUpRight class="w-3 h-3 mr-0.5" />
              {{ distinctEngines.length }} modelos
            </span>
          </div>
        </div>

        <p class="relative z-10 text-xs text-slate-600 mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="truncate max-w-[185px] font-mono text-[11px] text-slate-600" :title="distinctEngines.join(', ')">
            {{ distinctEngines.slice(0, 3).join(', ') || 'Sin motores' }}
          </span>
          <span class="font-mono font-bold text-[#038391] text-[10px] uppercase">Volumen</span>
        </p>
      </div>

      <!-- KPI 3: Facturación Acumulada y Balance Mano de Obra vs Repuestos -->
      <div class="studio-kpi-card workshop-stagger-3 p-5 flex flex-col justify-between">
        <div class="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#F6F0E4]"></div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Ingresos del Período
            </span>
            <span class="w-9 h-9 rounded-xl bg-[#F6F0E4] text-[#6E5835] border border-[#E6DAC2] flex items-center justify-center">
              <DollarSign class="w-4 h-4" />
            </span>
          </div>

          <div class="mt-3 flex items-baseline justify-between gap-2">
            <span class="font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#0F1E2E] truncate">
              ${{ animatedRevenueTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-[#F6F0E4] text-[#6E5835] font-mono text-[10px] font-bold uppercase shrink-0">
              Total
            </span>
          </div>
        </div>

        <div class="relative z-10 mt-4 pt-3 border-t border-slate-100 space-y-1.5">
          <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              class="h-full bg-[#2B5C8F]"
              :style="{ width: `${revenueMetrics.laborPercent}%` }"
              :title="`Mano de obra: ${revenueMetrics.laborPercent}% ($${revenueMetrics.labor.toFixed(2)})`"
            ></div>
            <div
              class="h-full bg-[#4EAEC0]"
              :style="{ width: `${revenueMetrics.partsPercent}%` }"
              :title="`Repuestos: ${revenueMetrics.partsPercent}% ($${revenueMetrics.parts.toFixed(2)})`"
            ></div>
            <div
              class="h-full bg-slate-400"
              :style="{ width: `${revenueMetrics.materialsPercent}%` }"
              :title="`Materiales: ${revenueMetrics.materialsPercent}% ($${revenueMetrics.materials.toFixed(2)})`"
            ></div>
          </div>
          <div class="flex items-center justify-between font-mono text-[10px] font-semibold">
            <span class="text-[#1B4978]">M.O. {{ revenueMetrics.laborPercent }}%</span>
            <span class="text-[#12697A]">Rep. {{ revenueMetrics.partsPercent }}%</span>
          </div>
        </div>
      </div>

      <!-- KPI 4: Cuentas y Talleres Activos -->
      <div class="studio-kpi-card workshop-stagger-4 p-5 flex flex-col justify-between">
        <div class="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#004B97]/12"></div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Cuentas Atendidas
            </span>
            <span class="w-9 h-9 rounded-xl bg-blue-50 text-[#004B97] border border-blue-100 flex items-center justify-center">
              <Users class="w-4 h-4" />
            </span>
          </div>

          <div class="mt-3 flex items-baseline justify-between">
            <span class="font-display tabular-nums text-3xl sm:text-4xl font-extrabold text-[#0D1B3E]">
              {{ Math.round(animatedAccountsCount) }}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-blue-50 text-[#004B97] font-mono text-[10px] font-bold">
              de {{ clients.length }} reg.
            </span>
          </div>
        </div>

        <p class="relative z-10 text-xs text-slate-600 mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="font-medium text-slate-500">Talleristas y flotas</span>
          <router-link to="/clientes" class="font-mono text-[11px] font-bold text-[#004B97] hover:text-[#04C4D9] transition-colors">
            Ver directorio &rarr;
          </router-link>
        </p>
      </div>
    </section>

    <!-- ==========================================
         GRÁFICOS Y VISUALIZACIONES TÉCNICAS:
         1. SERVICIOS POR COMPONENTE MECÁNICO (5 BLOQUES)
         2. TENDENCIAS DE CARGA DE TRABAJO MENSUAL (2026)
         ========================================== -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">

      <!-- 1. SERVICIOS POR COMPONENTE MECÁNICO (5 Columnas) -->
      <div class="lg:col-span-5 studio-card overflow-hidden flex flex-col justify-between">
        <div>
          <div class="px-5 py-4 border-b border-slate-100 bg-[#F4F8FC] flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-9 h-9 rounded-xl bg-[#E8F1FA] text-[#1B4978] border border-[#CFE1F4] flex items-center justify-center shrink-0">
                <Wrench class="w-4 h-4" />
              </span>
              <div class="min-w-0">
                <h2 class="font-display text-sm sm:text-base font-extrabold text-[#0F1E2E] tracking-tight">
                  Distribución por Componente
                </h2>
                <p class="text-[11px] text-slate-500 truncate">
                  Carga operativa en los 5 bloques mecánicos
                </p>
              </div>
            </div>
            <span class="font-mono px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#E8F1FA] text-[#1B4978] border border-[#CFE1F4] shrink-0">
              5 Bloques
            </span>
          </div>

          <div class="p-4 sm:p-5 space-y-2.5">
            <div
              v-for="item in componentStats"
              :key="item.name"
              :class="[
                'group p-3 rounded-xl border transition-all duration-150 cursor-pointer',
                tableComponentFilter === item.name
                  ? 'bg-blue-50/70 border-[#04C4D9] shadow-sm'
                  : 'border-transparent hover:bg-slate-50/90 hover:border-slate-200'
              ]"
              @click="tableComponentFilter = tableComponentFilter === item.name ? 'Todos' : item.name"
            >
              <div class="flex items-center justify-between text-xs sm:text-sm font-bold text-[#0D1B3E] mb-2">
                <div class="flex items-center gap-2">
                  <span
                    :class="['px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border', item.bgLight, item.borderColor]"
                  >
                    {{ item.name }}
                  </span>
                  <span class="text-[11px] text-slate-500 font-normal hidden xl:inline truncate max-w-[190px]">
                    {{ item.description }}
                  </span>
                </div>
                <div class="text-right font-mono tabular-nums">
                  <span class="font-extrabold text-[#0D1B3E]">{{ item.count }} trab.</span>
                  <span class="text-slate-500 text-xs font-semibold ml-1">({{ item.percentage }}%)</span>
                </div>
              </div>

              <!-- Barra Proporcional Animada -->
              <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-[width] duration-500 ease-out"
                  :style="{
                    width: `${Math.max(item.percentage, item.count > 0 ? 8 : 0)}%`,
                    backgroundColor: item.color
                  }"
                ></div>
              </div>

              <!-- Facturación generada por componente -->
              <div class="flex items-center justify-between mt-1.5 text-[11px] text-slate-500 font-medium">
                <span>Mano de obra estimada:</span>
                <span class="font-mono tabular-nums font-bold text-[#0D1B3E]">${{ item.laborRevenue.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Resumen inferior -->
        <div class="border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <div class="flex items-center justify-between text-xs text-slate-700">
            <span class="font-medium text-slate-600">Filtrar tabla por componente:</span>
            <span
              v-if="tableComponentFilter !== 'Todos'"
              class="font-mono text-[11px] font-bold text-[#004B97] bg-cyan-50 border border-[#04C4D9]/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:bg-cyan-100 transition-colors"
              @click="tableComponentFilter = 'Todos'"
            >
              {{ tableComponentFilter }} <X class="w-3 h-3" />
            </span>
            <span v-else class="font-mono text-slate-400 text-[11px]">Clic en cualquier bloque</span>
          </div>
        </div>
      </div>

      <!-- 2. TENDENCIAS DE CARGA DE TRABAJO MENSUAL (7 Columnas) -->
      <div class="lg:col-span-7 studio-card overflow-hidden flex flex-col justify-between">
        <div>
          <div class="px-5 py-4 border-b border-slate-100 bg-[#F4F8FC] flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-9 h-9 rounded-xl bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] flex items-center justify-center shrink-0">
                <BarChart3 class="w-4 h-4" />
              </span>
              <div class="min-w-0">
                <h2 class="font-display text-sm sm:text-base font-extrabold text-[#0F1E2E] tracking-tight">
                  Tendencias de Carga Mensual (2026)
                </h2>
                <p class="text-[11px] text-slate-500 truncate">
                  Evolución de órdenes de rectificación y facturación anual
                </p>
              </div>
            </div>

            <div v-if="peakWorkloadMonth" class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6F0E4] text-[#6E5835] border border-[#E6DAC2] font-mono text-[11px] font-bold shrink-0">
              <TrendingUp class="w-3.5 h-3.5" />
              Pico: {{ peakWorkloadMonth.monthFull }} ({{ peakWorkloadMonth.orderCount }} ord.)
            </div>
          </div>

          <!-- Gráfico visual de barras mensuales animado -->
          <div class="p-4 sm:p-5">
            <div class="grid grid-cols-12 gap-1.5 sm:gap-2.5 h-56 items-end pt-10 pb-2 px-1 border-b border-slate-200/80">
              <div
                v-for="month in monthlyTrends"
                :key="month.monthIndex"
                class="flex flex-col items-center h-full justify-end group relative"
              >
                <!-- Tooltip al hover -->
                <div class="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-[#19314D] text-white text-[10px] font-mono font-bold py-1.5 px-2.5 rounded-xl shadow-lg border border-white/15 pointer-events-none whitespace-nowrap">
                  <span>{{ month.monthFull }}: {{ month.orderCount }} órdenes</span>
                  <span class="text-[#BFEBF2]">${{ month.revenue.toFixed(0) }}</span>
                  <div class="w-2 h-2 bg-[#19314D] rotate-45 -mb-1"></div>
                </div>

                <!-- Barra de volumen -->
                <div
                  class="studio-bar-rise w-full rounded-t-lg transition-[height,background-color] duration-300 relative flex items-center justify-center group-hover:opacity-90"
                  :class="[
                    month.isCurrent
                      ? 'bg-[#3D9DB0] shadow-xs'
                      : month.orderCount > 0
                        ? 'bg-[#2B5C8F]'
                        : 'bg-slate-200/70'
                  ]"
                  :style="{
                    height: `${month.orderCount > 0 ? Math.max((month.orderCount / maxMonthlyOrders) * 100, 15) : 8}%`,
                    animationDelay: `${month.monthIndex * 32}ms`
                  }"
                >
                  <span
                    v-if="month.orderCount > 0"
                    class="font-mono tabular-nums text-[10px] font-extrabold text-white"
                  >
                    {{ month.orderCount }}
                  </span>
                </div>

                <!-- Etiqueta de mes -->
                <span
                  class="font-mono text-[10px] sm:text-xs font-bold mt-2 transition-colors"
                  :class="[month.isCurrent ? 'text-[#004B97] underline font-black' : 'text-slate-500 group-hover:text-[#0D1B3E]']"
                >
                  {{ month.monthShort }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Resumen de tendencias en el pie -->
        <div class="border-t border-slate-100 bg-slate-50/70 px-5 py-3 flex items-center justify-between text-xs text-slate-600">
          <div class="flex items-center gap-4">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-[#3D9DB0]"></span>
              Mes en curso
            </span>
            <span class="flex items-center gap-1.5 font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-[#004B97]"></span>
              Meses cerrados
            </span>
          </div>
          <span class="font-mono tabular-nums font-bold text-[#0D1B3E]">
            Total anual: {{ monthlyTrends.reduce((sum, m) => sum + m.orderCount, 0) }} órdenes
          </span>
        </div>
      </div>
    </div>

    <!-- ==========================================
         SECCIÓN PRINCIPAL: ÓRDENES RECIENTES
         CON CAMBIO RÁPIDO DE ESTADO (INLINE DROPDOWN)
         ========================================== -->
    <section class="studio-card overflow-hidden">

      <!-- Cabecera clara luminosa + barra de búsqueda/filtros integrada -->
      <div class="px-5 py-4 border-b border-slate-100 bg-[#F4F8FC] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-xl bg-[#E8F1FA] text-[#1B4978] border border-[#CFE1F4] flex items-center justify-center shrink-0">
            <Activity class="w-4 h-4" />
          </span>
          <div>
            <h2 class="font-display text-sm sm:text-base font-extrabold text-[#0F1E2E] tracking-tight">
              Órdenes de Trabajo y Cotizaciones
            </h2>
            <p class="text-[11px] text-slate-500">
              Cambio rápido de estado en mostrador y acceso directo a órdenes
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <!-- Búsqueda textual rápida -->
          <div class="relative min-w-[200px] sm:min-w-[240px]">
            <Search class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              v-model="tableSearchQuery"
              placeholder="Buscar por orden, cliente, motor..."
              class="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#0D1B3E] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/20 transition-all"
            />
          </div>

          <!-- Filtros de Pestaña de Estado -->
          <div class="flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl flex-wrap">
            <button
              v-for="st in ['Todos', 'Activas', 'Pendiente', 'En Proceso', 'Terminadas']"
              :key="st"
              type="button"
              @click="tableStatusFilter = st"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97] cursor-pointer',
                tableStatusFilter === st
                  ? 'bg-[#004B97] text-white shadow-sm'
                  : 'text-slate-600 hover:text-[#0D1B3E] hover:bg-white/70'
              ]"
            >
              {{ st }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de Órdenes -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr class="studio-table-head font-mono text-[10px] font-bold uppercase tracking-wider">
              <th class="py-3 px-4">Código / Fecha</th>
              <th class="py-3 px-3">Cliente / Taller</th>
              <th class="py-3 px-3">Motor & Componente</th>
              <th class="py-3 px-3">Tipo</th>
              <th class="py-3 px-3">Estado Rápido</th>
              <th class="py-3 px-3 text-right">Facturación</th>
              <th class="py-3 px-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
            <tr
              v-for="order in tableFilteredOrders"
              :key="order.id"
              class="hover:bg-blue-50/40 transition-colors group"
            >
              <!-- 1. Código y Fecha -->
              <td class="py-3 px-4">
                <router-link
                  :to="`/ordenes?id=${order.id}`"
                  class="font-mono font-bold text-xs text-[#004B97] hover:text-white bg-blue-50 hover:bg-[#004B97] border border-blue-200/70 px-2.5 py-0.5 rounded-lg inline-block transition-colors"
                >
                  {{ order.orderNumber }}
                </router-link>
                <span class="font-mono tabular-nums text-[11px] text-slate-500 block mt-0.5">
                  {{ order.date }}
                </span>
              </td>

              <!-- 2. Cliente y Taller -->
              <td class="py-3 px-3">
                <span class="font-bold text-[#0D1B3E] block truncate max-w-[200px]" :title="order.customer">
                  {{ order.customer }}
                </span>
                <span v-if="order.workshop" class="text-[11px] text-[#004B97] font-semibold block truncate max-w-[200px]">
                  Taller: {{ order.workshop }}
                </span>
                <span v-else class="text-[11px] text-slate-500 block">
                  Cliente Particular
                </span>
              </td>

              <!-- 3. Motor y Componente Mecánico -->
              <td class="py-3 px-3">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-lg font-bold text-[11px] bg-slate-100 text-[#0D1B3E] border border-slate-200/80">
                    {{ order.component || 'Culata' }}
                  </span>
                  <span class="text-xs text-slate-700 font-semibold truncate max-w-[140px]">
                    {{ order.engine || order.engineType || order.vehicleModel || 'General' }}
                  </span>
                </div>
              </td>

              <!-- 4. Tipo de Documento -->
              <td class="py-3 px-3">
                <span
                  v-if="order.type === 'cotizacion'"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200"
                >
                  Cotización
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-cyan-50 text-[#004B97] border border-cyan-200"
                >
                  Orden Taller
                </span>
              </td>

              <!-- 5. Selector Rápido de Estado (Inline Quick Status Changer) -->
              <td class="py-3 px-3">
                <div class="relative inline-block">
                  <select
                    :value="order.status"
                    @change="handleQuickStatusChange(order, ($event.target as HTMLSelectElement).value as OrderStatus)"
                    :disabled="updatingOrderId === order.id"
                    :class="[
                      'text-xs font-bold py-1 pl-2.5 pr-7 rounded-xl border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#04C4D9]',
                      getStatusBadgeConfig(order.status).selectBg,
                      updatingOrderId === order.id ? 'opacity-50 cursor-wait' : ''
                    ]"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Terminado">Terminado</option>
                    <option value="Entregado">Entregado</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </td>

              <!-- 6. Facturación y desglose -->
              <td class="py-3 px-3 text-right">
                <span class="font-mono tabular-nums font-extrabold text-[#0D1B3E] block">
                  ${{ order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 }) }}
                </span>
                <span class="font-mono tabular-nums text-[10px] text-slate-500 font-medium block">
                  MO ${{ (order.laborTotal || 0).toFixed(0) }} · Rep ${{ (order.partsTotal || 0).toFixed(0) }}
                </span>
              </td>

              <!-- 7. Acción Directa -->
              <td class="py-3 px-4 text-center">
                <router-link
                  :to="`/ordenes?id=${order.id}`"
                  class="inline-flex items-center justify-center p-2 text-slate-500 hover:text-[#004B97] hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl transition-all"
                  title="Abrir orden completa"
                >
                  <Eye class="w-4 h-4" />
                </router-link>
              </td>
            </tr>

            <!-- Estado Vacío -->
            <tr v-if="tableFilteredOrders.length === 0">
              <td colspan="7" class="py-12 text-center text-slate-500 text-xs">
                <div class="flex flex-col items-center justify-center gap-2">
                  <div class="w-12 h-12 rounded-2xl bg-blue-50 text-[#004B97] flex items-center justify-center">
                    <Activity class="w-6 h-6" />
                  </div>
                  <p class="font-bold text-[#0D1B3E]">No se encontraron órdenes con los filtros seleccionados.</p>
                  <p class="text-[11px] text-slate-400">Prueba cambiando el rango de fechas o limpiando el filtro de cliente.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer de la tabla -->
      <div class="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
        <span class="text-slate-600 font-mono tabular-nums text-[11px]">
          Mostrando <strong>{{ tableFilteredOrders.length }}</strong> de <strong>{{ filteredOrders.length }}</strong> órdenes
        </span>

        <router-link
          to="/ordenes"
          class="inline-flex items-center font-mono text-[11px] font-bold text-[#004B97] hover:text-[#04C4D9] transition-colors"
        >
          Gestor Completo de Órdenes &rarr;
        </router-link>
      </div>
    </section>

    <!-- ==========================================
         BANNER DE ACCESO RÁPIDO STUDIO
         ========================================== -->
    <section class="studio-hero-banner p-6 text-white relative overflow-hidden">
      <div class="pointer-events-none absolute -right-12 -bottom-16 w-60 h-60 rounded-full bg-[#04C4D9]/25 blur-2xl"></div>
      <div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm text-[#BFEBF2] flex items-center justify-center border border-white/20 shrink-0 shadow-sm">
            <Cog class="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h3 class="font-display text-base sm:text-lg font-extrabold tracking-tight text-white">
              Flujo Operativo de Mostrador y Rectificación
            </h3>
            <p class="text-xs sm:text-sm text-blue-100/90 mt-0.5">
              Administración de servicios por componente (Bielas, Bancadas, Cigüeñal, Culata, Block) con cotizaciones e impresión formal.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <router-link
            to="/ordenes?nueva=true&tipo=orden"
            class="studio-cta-primary inline-flex items-center px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm"
          >
            <Plus class="w-4 h-4 mr-1.5" />
            Nueva Orden de Taller
          </router-link>

          <router-link
            to="/catalogo"
            class="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm active:scale-[0.98] transition-all duration-150 border border-white/20 backdrop-blur-sm"
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