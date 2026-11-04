<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore, normalizeRole } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import { 
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  ShieldCheck,
  Wrench,
  Eye,
  Plus,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const mobileMenuOpen = ref(false)
const userMenuOpen = ref(false)
const userMenuContainerRef = ref<HTMLElement | null>(null)
let closeTimeout: ReturnType<typeof setTimeout> | null = null

interface NavItem {
  name: string
  path: string
  icon: any
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Órdenes', path: '/ordenes', icon: ShoppingCart },
  { name: 'Catálogo', path: '/catalogo', icon: Package },
  { name: 'Clientes', path: '/clientes', icon: Users },
  { name: 'Usuarios', path: '/usuarios', icon: ShieldCheck },
]

const visibleNavItems = computed(() => {
  return navItems.filter((item) => authStore.canAccess(item.path))
})

const isActive = (path: string) => {
  return route.path === path
}

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
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (closeTimeout) clearTimeout(closeTimeout)
})

const handleLogout = () => {
  userMenuOpen.value = false
  mobileMenuOpen.value = false
  authStore.logout()
  router.push('/login')
}

const cycleRole = () => {
  const current = normalizeRole(authStore.user?.role)
  let nextRole: 'Administrador' | 'Operador' | 'Consultor' = 'Administrador'
  if (current === 'Administrador') nextRole = 'Operador'
  else if (current === 'Operador') nextRole = 'Consultor'
  else nextRole = 'Administrador'

  authStore.setRole(nextRole)

  if (!authStore.canAccess(route.path)) {
    router.push(authStore.defaultRoute)
  }
}

const roleIcon = computed(() => {
  const r = normalizeRole(authStore.user?.role)
  if (r === 'Administrador') return ShieldCheck
  if (r === 'Operador') return Wrench
  return Eye
})

const roleBadgeClass = computed(() => {
  const r = normalizeRole(authStore.user?.role)
  if (r === 'Administrador') return 'bg-[#05C7F2]/15 text-[#05F2F2] border-[#05C7F2]/40 hover:bg-[#05C7F2]/25'
  if (r === 'Operador') return 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
  return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25'
})

const handleNewOrder = () => {
  mobileMenuOpen.value = false
  userMenuOpen.value = false
  if (route.path === '/ordenes') {
    router.push({ path: '/ordenes', query: { nueva: Date.now().toString() } })
  } else {
    router.push({ path: '/ordenes', query: { nueva: 'true' } })
  }
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full flex justify-center pointer-events-none px-2 sm:px-4">
    <!-- Notch Container Compacto Estilo Supaste / Dynamic Island -->
    <div
      class="pointer-events-auto relative w-full sm:w-auto max-w-5xl h-12 bg-[#0a0a0a] text-white rounded-b-[20px] border-b border-x border-neutral-800/90 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.6)] px-3 sm:px-4 flex items-center justify-between sm:justify-center gap-3 sm:gap-6 lg:gap-8 transition-all"
    >
      <!-- Oreja Izquierda Curva Cóncava (Inverted Fillet Ear) -->
      <svg
        class="absolute top-0 -left-[18px] w-[18px] h-[18px] text-[#0a0a0a] fill-current pointer-events-none hidden md:block"
        viewBox="0 0 18 18"
      >
        <path d="M18 0 H0 C9.941 0 18 8.059 18 18 V0 Z" />
        <path d="M0 0 C9.941 0 18 8.059 18 18" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      </svg>

      <!-- Oreja Derecha Curva Cóncava (Inverted Fillet Ear) -->
      <svg
        class="absolute top-0 -right-[18px] w-[18px] h-[18px] text-[#0a0a0a] fill-current pointer-events-none hidden md:block"
        viewBox="0 0 18 18"
      >
        <path d="M0 0 H18 C8.059 0 0 8.059 0 18 Z" />
        <path d="M18 0 C8.059 0 0 8.059 0 18" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      </svg>

      <!-- 1. Left: Brand / Logo con efecto Glossy Glass (Estilo Supaste) -->
      <router-link
        :to="authStore.defaultRoute"
        class="flex items-center gap-2 group select-none shrink-0"
        title="Ir al inicio"
      >
        <!-- Ícono Squircle con brillo vítreo tipo iOS / Supaste -->
        <div
          class="relative w-7 h-7 rounded-lg bg-gradient-to-br from-[#05C7F2] via-[#0284c7] to-[#004b97] p-1 flex items-center justify-center shadow-sm shadow-[#05C7F2]/25 ring-1 ring-white/30 overflow-hidden group-hover:scale-105 transition-transform"
        >
          <!-- Reflejo brillante de cristal superior -->
          <div class="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-lg pointer-events-none"></div>
          
          <!-- Monograma JR en blanco / cyan -->
          <svg viewBox="0 0 40 40" class="w-full h-full fill-none stroke-white stroke-[3.2] stroke-linecap-round stroke-linejoin-round drop-shadow-sm">
            <path d="M 14 10 H 20 V 26 C 20 30 17 32 13 32" />
            <path d="M 23 10 H 29 C 33 10 35 12 35 16 C 35 20 32 22 28 22 H 23 V 32" />
            <path d="M 27 22 L 34 32" stroke="#05F2F2" />
          </svg>
        </div>

        <!-- Solo Nombre JR BLANCO (sin badge de SWGORA) -->
        <span class="font-black text-white text-xs sm:text-sm tracking-tight whitespace-nowrap">
          JR BLANCO
        </span>
      </router-link>

      <!-- 2. Center: Enlaces de Navegación (Desktop) -->
      <nav class="hidden lg:flex items-center gap-1 shrink-0">
        <router-link
          v-for="item in visibleNavItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap',
            isActive(item.path)
              ? 'bg-neutral-800 text-[#05F2F2] ring-1 ring-white/15 shadow-inner'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
          ]"
        >
          <component :is="item.icon" class="w-3.5 h-3.5" />
          <span>{{ item.name }}</span>
          <!-- Active Glow Dot -->
          <span
            v-if="isActive(item.path)"
            class="w-1.5 h-1.5 rounded-full bg-[#05C7F2] shadow-[0_0_6px_#05C7F2]"
          ></span>
        </router-link>
      </nav>

      <!-- 3. Right: Botón Destacado '+ Nueva Orden' + Perfil con Dropdown -->
      <div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <!-- Botón Blanco Destacado Estilo 'Download' de Supaste -->
        <button
          v-if="authStore.canAccess('/ordenes')"
          type="button"
          @click="handleNewOrder"
          class="bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs px-3 py-1 rounded-full shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          title="Crear nueva orden de trabajo o cotización"
        >
          <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
          <span class="hidden sm:inline">Nueva Orden</span>
          <span class="sm:hidden">Orden</span>
        </button>

        <!-- Dropdown de Usuario / Información y Cerrar Sesión -->
        <div
          v-if="authStore.isAuthenticated"
          ref="userMenuContainerRef"
          class="relative"
          @mouseenter="openUserMenu"
          @mouseleave="scheduleCloseUserMenu"
        >
          <!-- Gatillo del Perfil (Avatar + Nombre + Chevron) -->
          <button
            type="button"
            @click.stop="toggleUserMenu"
            class="flex items-center gap-1.5 px-2 py-0.5 rounded-full hover:bg-neutral-800/80 border border-transparent hover:border-neutral-700/60 transition cursor-pointer select-none group shrink-0"
            :class="{ 'bg-neutral-800 border-neutral-700/80': userMenuOpen }"
            aria-label="Perfil y opciones de usuario"
          >
            <div class="w-6 h-6 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 ring-1 ring-white/10 group-hover:ring-white/25 transition">
              <img 
                v-if="authStore.user?.avatar" 
                :src="authStore.user.avatar" 
                :alt="authStore.user.name"
                class="w-full h-full object-cover" 
              />
              <UserIcon v-else class="w-3.5 h-3.5 text-neutral-400" />
            </div>

            <span class="hidden sm:inline text-xs font-semibold text-neutral-200 group-hover:text-white transition truncate max-w-[110px]">
              {{ authStore.user?.name }}
            </span>

            <ChevronDown
              class="w-3 h-3 text-neutral-400 group-hover:text-white transition-transform duration-200"
              :class="{ 'rotate-180 text-white': userMenuOpen }"
            />
          </button>

          <!-- Menú Flotante Estilo Dark Glass / Supaste -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="transform -translate-y-2 opacity-0 scale-95"
            enter-to-class="transform translate-y-0 opacity-100 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="transform translate-y-0 opacity-100 scale-100"
            leave-to-class="transform -translate-y-2 opacity-0 scale-95"
          >
            <div
              v-if="userMenuOpen"
              class="absolute top-full right-0 mt-2 w-64 bg-[#0d0d0d]/98 backdrop-blur-xl border border-neutral-800/90 rounded-2xl p-3.5 shadow-[0_16px_40px_-6px_rgba(0,0,0,0.7)] text-white z-50 pointer-events-auto"
              @mouseenter="openUserMenu"
              @mouseleave="scheduleCloseUserMenu"
            >
              <!-- Info del Usuario -->
              <div class="flex items-center gap-3 pb-3 border-b border-neutral-800/80">
                <div class="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 ring-1 ring-white/15">
                  <img 
                    v-if="authStore.user?.avatar" 
                    :src="authStore.user.avatar" 
                    :alt="authStore.user.name"
                    class="w-full h-full object-cover" 
                  />
                  <UserIcon v-else class="w-5 h-5 text-neutral-400" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-white truncate">
                    {{ authStore.user?.name || 'Usuario' }}
                  </div>
                  <div class="text-[11px] text-neutral-400 truncate mt-0.5">
                    {{ authStore.user?.email || 'usuario@jrblanco.com' }}
                  </div>
                </div>
              </div>

              <!-- Sección de Rol de Usuario -->
              <div class="py-2.5 border-b border-neutral-800/80 flex items-center justify-between">
                <span class="text-[11px] font-medium text-neutral-400">Rol activo</span>
                <button
                  type="button"
                  @click="cycleRole"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer select-none"
                  :class="roleBadgeClass"
                  title="Clic para alternar rol en vivo (Admin → Operador → Consultor)"
                >
                  <component :is="roleIcon" class="w-3 h-3 shrink-0" />
                  <span>{{ authStore.user?.role || 'Consultor' }}</span>
                </button>
              </div>

              <!-- Información de la Empresa / Taller -->
              <div class="py-2 border-b border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
                <span>Taller</span>
                <span class="text-neutral-300 font-semibold">JR Blanco Motores</span>
              </div>

              <!-- Acción de Cerrar Sesión -->
              <div class="pt-2">
                <button
                  type="button"
                  @click="handleLogout"
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut class="w-4 h-4 shrink-0" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Acceso si no está autenticado -->
        <router-link
          v-else
          to="/login"
          class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-neutral-900 bg-white hover:bg-neutral-100 rounded-full shadow-sm transition"
        >
          <UserIcon class="w-3.5 h-3.5" />
          <span>Acceso</span>
        </router-link>

        <!-- Botón Menú Móvil (Hamburger / X) -->
        <button
          type="button"
          @click="mobileMenuOpen = !mobileMenuOpen"
          class="lg:hidden p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition"
          aria-label="Abrir menú"
        >
          <X v-if="mobileMenuOpen" class="w-5 h-5" />
          <Menu v-else class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Dropdown / Menú Móvil Desplegable Estilo Dark Glass -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform translate-y-0 opacity-100 scale-100"
      leave-to-class="transform -translate-y-2 opacity-0 scale-95"
    >
      <div
        v-if="mobileMenuOpen"
        class="pointer-events-auto absolute top-14 inset-x-3 sm:inset-x-6 max-w-lg mx-auto bg-[#0a0a0a]/95 backdrop-blur-xl border border-neutral-800 rounded-2xl p-4 shadow-2xl space-y-3 z-50 lg:hidden"
      >
        <div class="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2">
          Navegación
        </div>
        
        <div class="space-y-1">
          <router-link
            v-for="item in visibleNavItems"
            :key="item.path"
            :to="item.path"
            @click="mobileMenuOpen = false"
            :class="[
              'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition',
              isActive(item.path)
                ? 'bg-neutral-800 text-[#05F2F2] ring-1 ring-white/15'
                : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
            ]"
          >
            <div class="flex items-center gap-2.5">
              <component :is="item.icon" class="w-4 h-4" />
              <span>{{ item.name }}</span>
            </div>
            <ChevronRight class="w-3.5 h-3.5 text-neutral-500" />
          </router-link>
        </div>

        <div class="pt-3 border-t border-neutral-800 space-y-2.5">
          <!-- Info del Usuario Móvil -->
          <div class="flex items-center gap-3 px-2">
            <div class="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 ring-1 ring-white/10">
              <img 
                v-if="authStore.user?.avatar" 
                :src="authStore.user.avatar" 
                :alt="authStore.user.name"
                class="w-full h-full object-cover" 
              />
              <UserIcon v-else class="w-4 h-4 text-neutral-400" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-bold text-white truncate">{{ authStore.user?.name }}</div>
              <div class="text-[11px] text-neutral-400 truncate">{{ authStore.user?.email }}</div>
            </div>
          </div>

          <div class="flex items-center justify-between px-2 pt-1">
            <!-- Rol selector móvil -->
            <button
              type="button"
              @click="cycleRole"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer select-none"
              :class="roleBadgeClass"
            >
              <component :is="roleIcon" class="w-3 h-3 shrink-0" />
              <span>{{ authStore.user?.role || 'Consultor' }}</span>
            </button>

            <!-- Cerrar sesión móvil -->
            <button
              type="button"
              @click="handleLogout"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <LogOut class="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>
