<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import JrLogo from '@/components/JrLogo.vue'
import RoleBadge from '@/components/RoleBadge.vue'
import { 
  Menu, 
  Bell, 
  Search, 
  LogOut, 
  User as UserIcon,
} from 'lucide-vue-next'

const uiStore = useUiStore()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const currentRouteTitle = computed(() => {
  switch (route.path) {
    case '/dashboard':
      return 'Dashboard Operativo'
    case '/ordenes':
      return 'Órdenes de Trabajo y Cotizaciones'
    case '/clientes':
      return 'Directorio de Clientes'
    case '/catalogo':
      return 'Catálogo Técnico de Repuestos'
    case '/login':
      return 'Acceso al Sistema'
    default:
      return 'Gestión de Taller'
  }
})

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 w-full flex items-center justify-between px-3 sm:px-6 shadow-xs">
    <!-- Left: Hamburger (Mobile) + Brand / Breadcrumb -->
    <div class="flex items-center gap-2.5 sm:gap-4">
      <button
        type="button"
        @click="uiStore.toggleMobileSidebar"
        class="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-[#05C7F2]"
        aria-label="Abrir menú de navegación"
      >
        <Menu class="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      <!-- Logo e Identidad visible en Mobile (en Desktop ya está en el Sidebar) -->
      <div class="flex items-center gap-2 lg:hidden">
        <JrLogo :size="30" />
        <div class="flex flex-col leading-none">
          <span class="text-xs font-black tracking-tight text-slate-900">JR BLANCO</span>
          <span class="text-[9px] text-[#038896] font-bold">SWGORA</span>
        </div>
      </div>

      <!-- Breadcrumb dinámico en Desktop (evita duplicar el logo con el Sidebar) -->
      <div class="hidden lg:flex items-center gap-2.5">
        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">SWGORA</span>
        <span class="text-slate-300 font-light">/</span>
        <h1 class="text-sm font-extrabold text-slate-900 tracking-tight">{{ currentRouteTitle }}</h1>
      </div>
    </div>

    <!-- Center: Search input (desktop) -->
    <div class="hidden md:flex items-center flex-1 max-w-md mx-4 lg:mx-6">
      <div class="relative w-full">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search class="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Buscar clientes, órdenes de taller, refacciones..."
          class="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#05C7F2] focus:border-transparent transition shadow-2xs"
        />
      </div>
    </div>

    <!-- Right: Notifications & User Profile -->
    <div class="flex items-center gap-1.5 sm:gap-3">
      <!-- Notification Icon -->
      <button 
        type="button"
        class="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"
        title="Notificaciones"
      >
        <Bell class="w-4 h-4 sm:w-5 sm:h-5" />
        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-[#05C7F2] rounded-full ring-2 ring-white"></span>
      </button>

      <div class="h-5 w-px bg-slate-200"></div>

      <!-- User Profile / Auth Actions -->
      <div v-if="authStore.isAuthenticated" class="flex items-center gap-2">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-xs">
            <img 
              v-if="authStore.user?.avatar" 
              :src="authStore.user.avatar" 
              :alt="authStore.user.name"
              class="w-full h-full object-cover" 
            />
            <UserIcon v-else class="w-4 h-4 text-slate-500" />
          </div>
          <div class="hidden md:block text-left leading-tight">
            <div class="text-xs font-bold text-slate-800">
              {{ authStore.user?.name }}
            </div>
            <div class="mt-0.5">
              <RoleBadge :role="authStore.user?.role || 'Administrador'" size="sm" :showIcon="false" />
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="handleLogout"
          class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition"
          title="Cerrar sesión"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>

      <router-link
        v-else
        to="/login"
        class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0D0D0D] hover:bg-black rounded-full shadow-xs transition"
      >
        <UserIcon class="w-3.5 h-3.5" />
        <span>Acceso</span>
      </router-link>
    </div>
  </header>
</template>

