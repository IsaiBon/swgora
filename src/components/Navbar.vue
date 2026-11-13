<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore, normalizeRole } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useTallerStore } from '@/stores/taller'
import { useRouter, useRoute } from 'vue-router'
import {
  ShieldCheck,
  MapPin,
  Wrench,
  Building2,
  Eye,
  Plus,
  LogOut,
  Menu,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const uiStore = useUiStore()
const tallerStore = useTallerStore()
const router = useRouter()
const route = useRoute()

const userMenuOpen = ref(false)
const userMenuContainerRef = ref<HTMLElement | null>(null)
let closeTimeout: ReturnType<typeof setTimeout> | null = null

const pageTitleMap: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Panel Operativo y Telemetría',
    subtitle: 'Resumen de productividad y carga de rectificación',
  },
  '/ordenes': {
    title: 'Órdenes de Trabajo y Cotizaciones',
    subtitle: 'Mostrador, seguimiento por componentes e impresión',
  },
  '/rutas': {
    title: 'Rutas y Sucursales',
    subtitle: 'Control regional y sub-administradores asignados',
  },
  '/catalogo': {
    title: 'Catálogo Técnico',
    subtitle: 'Motores, medidas dimensionales y equivalencias',
  },
  '/clientes': {
    title: 'Clientes y Talleres',
    subtitle: 'Directorio comercial e historial de cuentas',
  },
  '/usuarios': {
    title: 'Administración de Usuarios',
    subtitle: 'Cuentas, credenciales y matriz de permisos',
  },
  '/taller': {
    title: 'Configuración de Taller',
    subtitle: 'Identidad corporativa, logotipo y membrete PDF',
  },
}

const currentPageMeta = computed(() => {
  return (
    pageTitleMap[route.path] || {
      title: 'SWGORA',
      subtitle: 'Sistema de Gestión Operativa',
    }
  )
})

const openUserMenu = () => {
  if (closeTimeout) clearTimeout(closeTimeout)
  userMenuOpen.value = true
}

const scheduleCloseUserMenu = () => {
  if (closeTimeout) clearTimeout(closeTimeout)
  closeTimeout = setTimeout(() => {
    userMenuOpen.value = false
  }, 200)
}

const toggleUserMenu = () => {
  if (closeTimeout) clearTimeout(closeTimeout)
  userMenuOpen.value = !userMenuOpen.value
}

const handleClickOutside = (event: MouseEvent) => {
  if (
    userMenuContainerRef.value &&
    !userMenuContainerRef.value.contains(event.target as Node)
  ) {
    userMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  void tallerStore.loadTallerInfo(true)
})

watch(
  () => [authStore.user?.id, authStore.activeTenantId],
  () => {
    void tallerStore.loadTallerInfo(true)
  }
)

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (closeTimeout) clearTimeout(closeTimeout)
})

const handleLogout = async () => {
  userMenuOpen.value = false
  uiStore.closeMobileSidebar()
  await authStore.logout()
  await router.replace('/login')
}

const roleIcon = computed(() => {
  const r = normalizeRole(authStore.user?.role)
  if (r === 'Administrador') return ShieldCheck
  if (r === 'Taller Independiente') return Building2
  if (r === 'Sub-Administrador') return MapPin
  if (r === 'Operador') return Wrench
  return Eye
})

const roleBadgeClass = computed(() => {
  const r = normalizeRole(authStore.user?.role)
  if (r === 'Administrador') return 'bg-blue-50 text-[#004B97] border-blue-200'
  if (r === 'Taller Independiente') return 'bg-cyan-50 text-cyan-800 border-cyan-200'
  if (r === 'Sub-Administrador') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (r === 'Operador') return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
})

const handleNewOrder = () => {
  userMenuOpen.value = false
  uiStore.closeMobileSidebar()
  uiStore.requestNewOrder()
  if (route.path !== '/ordenes') {
    router.push({ path: '/ordenes', query: { nueva: '1' } })
  }
}
</script>

<template>
  <header class="sticky top-0 z-40 h-16 w-full bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-2xs">
    <!-- Izquierda: Botón Hamburguesa Móvil / Colapso Desktop + Título Dinámico -->
    <div class="flex items-center gap-3 min-w-0">
      <!-- Hamburguesa Móvil -->
      <button
        type="button"
        @click="uiStore.toggleMobileSidebar"
        class="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#004B97] transition-colors cursor-pointer active:scale-[0.97]"
        aria-label="Abrir menú de navegación"
      >
        <Menu class="w-5 h-5" />
      </button>

      <!-- Botón colapsar rápido en desktop -->
      <button
        type="button"
        @click="uiStore.toggleSidebarCollapse"
        class="hidden lg:inline-flex p-2 rounded-xl border border-slate-200/80 bg-white hover:bg-blue-50/70 hover:border-blue-200 text-slate-500 hover:text-[#004B97] transition-colors cursor-pointer active:scale-[0.97]"
        :title="uiStore.isSidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'"
      >
        <PanelLeftOpen v-if="uiStore.isSidebarCollapsed" class="w-4 h-4" />
        <PanelLeftClose v-else class="w-4 h-4" />
      </button>

      <!-- Título Contextual de Vista -->
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="font-display text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
            {{ currentPageMeta.title }}
          </h2>
          <span
            class="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-50 text-[#038391] border border-cyan-200/80 text-[10px] font-bold shrink-0"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-[#04C4D9] animate-pulse"></span>
            En línea
          </span>
        </div>
        <p class="hidden sm:block text-[11px] text-slate-500 truncate">
          {{ currentPageMeta.subtitle }}
        </p>
      </div>
    </div>

    <!-- Derecha: Botón Rápido Nueva Orden + Perfil de Usuario -->
    <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
      <button
        v-if="authStore.canAccess('/ordenes')"
        type="button"
        @click="handleNewOrder"
        class="studio-cta-primary px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
        title="Crear nueva orden de trabajo o cotización"
      >
        <Plus class="w-4 h-4 stroke-[2.5]" />
        <span class="hidden sm:inline">Nueva Orden</span>
        <span class="sm:hidden">Orden</span>
      </button>

      <!-- Menú de Perfil -->
      <div
        v-if="authStore.isAuthenticated"
        ref="userMenuContainerRef"
        class="relative"
        @mouseenter="openUserMenu"
        @mouseleave="scheduleCloseUserMenu"
      >
        <button
          type="button"
          @click.stop="toggleUserMenu"
          class="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-50 hover:bg-[#EFF5FB] border border-slate-200/90 hover:border-[#BFD7EC] transition-colors cursor-pointer select-none shrink-0"
          :class="{ 'border-[#147488] bg-[#EFF5FB]': userMenuOpen }"
          aria-label="Perfil y opciones de usuario"
        >
          <div class="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-[#004B97] to-[#04C4D9] p-[1.5px] shrink-0">
            <div class="w-full h-full rounded-[6px] bg-white flex items-center justify-center overflow-hidden">
              <img
                v-if="authStore.user?.avatar"
                :src="authStore.user.avatar"
                :alt="authStore.user.name"
                class="w-full h-full object-cover"
              />
              <UserIcon v-else class="w-4 h-4 text-[#1E446E]" />
            </div>
          </div>

          <div class="hidden sm:block text-left leading-tight">
            <span class="block text-xs font-bold text-slate-900 truncate max-w-[115px]">
              {{ authStore.user?.name }}
            </span>
            <span class="block text-[10px] font-medium text-slate-500 truncate max-w-[115px]">
              {{ authStore.user?.role || 'Consultor' }}
            </span>
          </div>

          <ChevronDown
            class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200"
            :class="{ 'rotate-180 text-[#1E446E]': userMenuOpen }"
          />
        </button>

        <!-- Popover Origin-Aware -->
        <Transition name="popover-pop">
          <div
            v-if="userMenuOpen"
            style="transform-origin: top right;"
            class="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl p-4 text-slate-900 z-50 shadow-xl shadow-blue-950/10 pointer-events-auto"
            @mouseenter="openUserMenu"
            @mouseleave="scheduleCloseUserMenu"
          >
            <!-- Info del Usuario -->
            <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div class="w-11 h-11 rounded-xl overflow-hidden bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <img
                  v-if="authStore.user?.avatar"
                  :src="authStore.user.avatar"
                  :alt="authStore.user.name"
                  class="w-full h-full object-cover"
                />
                <UserIcon v-else class="w-5 h-5 text-[#004B97]" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-extrabold text-slate-900 truncate">
                  {{ authStore.user?.name || 'Usuario' }}
                </div>
                <div class="text-xs text-slate-500 truncate mt-0.5 font-mono">
                  {{ authStore.user?.email || 'usuario@jrblanco.com' }}
                </div>
              </div>
            </div>

            <!-- Rol -->
            <div class="py-3 border-b border-slate-100 flex items-center justify-between">
              <span class="text-[11px] font-semibold text-slate-500">Rol activo</span>
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border select-none"
                :class="roleBadgeClass"
              >
                <component :is="roleIcon" class="w-3.5 h-3.5 shrink-0" />
                <span>{{ authStore.user?.role || 'Consultor' }}</span>
              </span>
            </div>

            <!-- Ruta asignada (Sub-Admin) -->
            <div
              v-if="authStore.isSubAdmin && authStore.activeRutaNombre"
              class="py-2.5 border-b border-slate-100 text-xs flex items-center justify-between"
            >
              <span class="font-semibold text-slate-500">Ruta asignada</span>
              <span class="text-[#004B97] font-mono font-bold truncate max-w-[165px]">
                {{ authStore.activeRutaCodigo ? `${authStore.activeRutaCodigo} · ` : '' }}{{ authStore.activeRutaNombre }}
              </span>
            </div>

            <!-- Acceso rápido a Módulo Taller -->
            <div v-if="authStore.canAccess('/taller')" class="py-2.5 border-b border-slate-100">
              <router-link
                to="/taller"
                @click="userMenuOpen = false"
                class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-200 transition-colors group"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-blue-100/80 text-[#004B97] flex items-center justify-center">
                    <Building2 class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="text-xs font-bold text-slate-900 group-hover:text-[#004B97] transition-colors">
                      Módulo de Taller
                    </div>
                    <div class="text-[10px] text-slate-500">Logo, datos y membrete PDF</div>
                  </div>
                </div>
                <ChevronRight class="w-4 h-4 text-slate-400 group-hover:text-[#004B97] group-hover:translate-x-0.5 transition-transform" />
              </router-link>
            </div>
            <div v-else class="py-2.5 border-b border-slate-100 text-xs flex items-center justify-between">
              <span class="font-semibold text-slate-500">Taller</span>
              <span class="text-slate-900 font-bold">JR Blanco Motores</span>
            </div>

            <!-- Cerrar sesión -->
            <div class="pt-3">
              <button
                type="button"
                @click="handleLogout"
                class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <LogOut class="w-4 h-4 shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Enlace acceso si no autenticado -->
      <router-link
        v-else
        to="/login"
        class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#004B97] hover:bg-[#003A75] rounded-xl transition-colors"
      >
        <UserIcon class="w-3.5 h-3.5" />
        <span>Acceso</span>
      </router-link>
    </div>
  </header>
</template>
