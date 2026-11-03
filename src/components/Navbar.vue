<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore, normalizeRole } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import JrLogo from '@/components/JrLogo.vue'
import { 
  Menu, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  ShieldCheck,
  Wrench,
  Eye,
} from 'lucide-vue-next'

const uiStore = useUiStore()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const currentRouteTitle = computed(() => {
  switch (route.path) {
    case '/dashboard':
      return 'Dashboard'
    case '/ordenes':
      return 'Órdenes'
    case '/clientes':
      return 'Clientes'
    case '/catalogo':
      return 'Catálogo'
    case '/usuarios':
      return 'Usuarios'
    case '/login':
      return 'Acceso'
    default:
      return 'Taller'
  }
})

const handleLogout = () => {
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
  if (r === 'Administrador') return 'bg-[#05C7F2]/15 text-[#038896] border-[#05C7F2]/40 hover:bg-[#05C7F2]/25'
  if (r === 'Operador') return 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
  return 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
})
</script>

<template>
  <header class="h-12 bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 w-full flex items-center justify-between px-3 sm:px-6 shadow-2xs">
    <!-- Left: Hamburger (Mobile) + Breadcrumb -->
    <div class="flex items-center gap-2.5">
      <button
        type="button"
        @click="uiStore.toggleMobileSidebar"
        class="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-none"
        aria-label="Abrir menú"
      >
        <Menu class="w-5 h-5" />
      </button>

      <!-- Mobile Brand Logo -->
      <div class="flex items-center gap-1.5 lg:hidden">
        <JrLogo :size="24" />
        <span class="text-xs font-black tracking-tight text-slate-900">JR BLANCO</span>
      </div>

      <!-- Desktop Breadcrumb -->
      <div class="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
        <span class="font-bold text-slate-400">JR Blanco</span>
        <ChevronRight class="w-3.5 h-3.5 text-slate-300" />
        <h1 class="text-xs font-black text-slate-900 tracking-tight">{{ currentRouteTitle }}</h1>
      </div>
    </div>

    <!-- Right: User Profile & Actions -->
    <div class="flex items-center gap-2 sm:gap-3">
      <div v-if="authStore.isAuthenticated" class="flex items-center gap-2">
        <!-- Rol Interactivo con Clic para Alternar (Admin → Operador → Consultor) -->
        <button
          type="button"
          @click="cycleRole"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer select-none"
          :class="roleBadgeClass"
          title="Alternar rol en vivo para probar permisos (Admin → Operador → Consultor)"
        >
          <component :is="roleIcon" class="w-3 h-3 shrink-0" />
          <span>{{ authStore.user?.role || 'Consultor' }}</span>
        </button>

        <div class="h-4 w-px bg-slate-200 hidden sm:block"></div>

        <!-- Usuario -->
        <div class="flex items-center gap-1.5">
          <div class="w-7 h-7 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <img 
              v-if="authStore.user?.avatar" 
              :src="authStore.user.avatar" 
              :alt="authStore.user.name"
              class="w-full h-full object-cover" 
            />
            <UserIcon v-else class="w-3.5 h-3.5 text-slate-500" />
          </div>
          <span class="hidden sm:inline text-xs font-bold text-slate-800 truncate max-w-[130px]">
            {{ authStore.user?.name }}
          </span>
        </div>

        <!-- Botón Logout -->
        <button
          type="button"
          @click="handleLogout"
          class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          title="Cerrar sesión"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>

      <router-link
        v-else
        to="/login"
        class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-2xs transition"
      >
        <UserIcon class="w-3.5 h-3.5" />
        <span>Acceso</span>
      </router-link>
    </div>
  </header>
</template>
