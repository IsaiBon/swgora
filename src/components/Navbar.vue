<script setup lang="ts">
import { ref, computed } from 'vue'
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
  ChevronRight,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const mobileMenuOpen = ref(false)

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

const handleLogout = () => {
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
  if (route.path === '/ordenes') {
    router.push({ path: '/ordenes', query: { nueva: Date.now().toString() } })
  } else {
    router.push({ path: '/ordenes', query: { nueva: 'true' } })
  }
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full flex justify-center pointer-events-none px-2 sm:px-4">
    <!-- Notch Container Estilo Supaste / Dynamic Island -->
    <div
      class="pointer-events-auto relative w-full max-w-6xl h-14 bg-[#0a0a0a] text-white rounded-b-[22px] border-b border-x border-neutral-800/90 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.55)] px-3 sm:px-5 flex items-center justify-between transition-all"
    >
      <!-- Oreja Izquierda Curva Cóncava (Inverted Fillet Ear) -->
      <svg
        class="absolute top-0 -left-[20px] w-[20px] h-[20px] text-[#0a0a0a] fill-current pointer-events-none hidden md:block"
        viewBox="0 0 20 20"
      >
        <path d="M20 0 H0 C11.046 0 20 8.954 20 20 V0 Z" />
        <path d="M0 0 C11.046 0 20 8.954 20 20" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      </svg>

      <!-- Oreja Derecha Curva Cóncava (Inverted Fillet Ear) -->
      <svg
        class="absolute top-0 -right-[20px] w-[20px] h-[20px] text-[#0a0a0a] fill-current pointer-events-none hidden md:block"
        viewBox="0 0 20 20"
      >
        <path d="M0 0 H20 C8.954 0 0 8.954 0 20 Z" />
        <path d="M20 0 C8.954 0 0 8.954 0 20" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      </svg>

      <!-- 1. Left: Brand / Logo con efecto Glossy Glass (Estilo Supaste) -->
      <router-link
        :to="authStore.defaultRoute"
        class="flex items-center gap-2.5 group select-none shrink-0"
        title="Ir al inicio"
      >
        <!-- Ícono Squircle con brillo vítreo tipo iOS / Supaste -->
        <div
          class="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#05C7F2] via-[#0284c7] to-[#004b97] p-1.5 flex items-center justify-center shadow-md shadow-[#05C7F2]/25 ring-1 ring-white/30 overflow-hidden group-hover:scale-105 transition-transform"
        >
          <!-- Reflejo brillante de cristal superior -->
          <div class="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-xl pointer-events-none"></div>
          
          <!-- Monograma JR en blanco / cyan -->
          <svg viewBox="0 0 40 40" class="w-full h-full fill-none stroke-white stroke-[3.2] stroke-linecap-round stroke-linejoin-round drop-shadow-sm">
            <path d="M 14 10 H 20 V 26 C 20 30 17 32 13 32" />
            <path d="M 23 10 H 29 C 33 10 35 12 35 16 C 35 20 32 22 28 22 H 23 V 32" />
            <path d="M 27 22 L 34 32" stroke="#05F2F2" />
          </svg>
        </div>

        <!-- Texto de marca -->
        <div class="flex items-center gap-2">
          <span class="font-black text-white text-sm tracking-tight">JR BLANCO</span>
          <span class="hidden sm:inline-block text-[9px] font-mono font-bold tracking-widest text-[#05C7F2] bg-[#05C7F2]/10 border border-[#05C7F2]/30 px-1.5 py-0.5 rounded">
            SWGORA
          </span>
        </div>
      </router-link>

      <!-- 2. Center: Enlaces de Navegación (Desktop) -->
      <nav class="hidden lg:flex items-center gap-1">
        <router-link
          v-for="item in visibleNavItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 flex items-center gap-1.5',
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

      <!-- 3. Right: Botón Destacado '+ Nueva Orden' + Rol + Usuario -->
      <div class="flex items-center gap-2 sm:gap-2.5">
        <!-- Botón Blanco Destacado Estilo 'Download' de Supaste -->
        <button
          v-if="authStore.canAccess('/ordenes')"
          type="button"
          @click="handleNewOrder"
          class="bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs px-3.5 py-1.5 rounded-full shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          title="Crear nueva orden de trabajo o cotización"
        >
          <Plus class="w-3.5 h-3.5 stroke-[2.5]" />
          <span class="hidden sm:inline">Nueva Orden</span>
          <span class="sm:hidden">Orden</span>
        </button>

        <!-- Rol Interactivo con Clic para Alternar (Admin → Operador → Consultor) -->
        <button
          v-if="authStore.isAuthenticated"
          type="button"
          @click="cycleRole"
          class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer select-none shrink-0"
          :class="roleBadgeClass"
          title="Alternar rol en vivo para probar permisos (Admin → Operador → Consultor)"
        >
          <component :is="roleIcon" class="w-3 h-3 shrink-0" />
          <span>{{ authStore.user?.role || 'Consultor' }}</span>
        </button>

        <!-- Perfil Usuario & Logout -->
        <div v-if="authStore.isAuthenticated" class="flex items-center gap-1.5 shrink-0">
          <div class="w-7 h-7 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
            <img 
              v-if="authStore.user?.avatar" 
              :src="authStore.user.avatar" 
              :alt="authStore.user.name"
              class="w-full h-full object-cover" 
            />
            <UserIcon v-else class="w-3.5 h-3.5 text-neutral-400" />
          </div>

          <span class="hidden xl:inline text-xs font-semibold text-neutral-300 truncate max-w-[100px]">
            {{ authStore.user?.name }}
          </span>

          <!-- Botón Logout -->
          <button
            type="button"
            @click="handleLogout"
            class="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition"
            title="Cerrar sesión"
          >
            <LogOut class="w-3.5 h-3.5" />
          </button>
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
          class="lg:hidden p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition"
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
        class="pointer-events-auto absolute top-16 inset-x-3 sm:inset-x-6 max-w-lg mx-auto bg-[#0a0a0a]/95 backdrop-blur-xl border border-neutral-800 rounded-2xl p-4 shadow-2xl space-y-3 z-50 lg:hidden"
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

        <div class="pt-2 border-t border-neutral-800 flex items-center justify-between px-1">
          <!-- Rol selector móvil -->
          <button
            type="button"
            @click="cycleRole"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer select-none"
            :class="roleBadgeClass"
          >
            <component :is="roleIcon" class="w-3 h-3 shrink-0" />
            <span>Rol: {{ authStore.user?.role || 'Consultor' }}</span>
          </button>

          <!-- Cerrar sesión móvil -->
          <button
            type="button"
            @click="handleLogout"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition"
          >
            <LogOut class="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </Transition>
  </header>
</template>
