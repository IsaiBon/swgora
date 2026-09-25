<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import JrLogo from '@/components/JrLogo.vue'
import RoleBadge from '@/components/RoleBadge.vue'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  LogIn,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-vue-next'

const uiStore = useUiStore()
const authStore = useAuthStore()
const route = useRoute()

interface NavItem {
  name: string
  path: string
  icon: any
  badge?: string
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', path: '/clientes', icon: Users, badge: '6' },
  { name: 'Órdenes', path: '/ordenes', icon: ShoppingCart, badge: '4' },
  { name: 'Catálogo', path: '/catalogo', icon: Package },
  { name: 'Login / Acceso', path: '/login', icon: LogIn },
]

const visibleNavItems = computed(() => {
  return navItems.filter((item) => authStore.canAccess(item.path))
})

const isActive = (path: string) => {
  return route.path === path
}
</script>

<template>
  <div class="lg:w-64 lg:shrink-0">
    <!-- Mobile Backdrop Overlay -->
    <div
      v-if="uiStore.isMobileSidebarOpen"
      @click="uiStore.closeMobileSidebar"
      class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
    ></div>

    <!-- Sidebar Container -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 w-64 bg-[#0D0D0D] text-slate-100 flex flex-col transition-transform duration-300 ease-in-out border-r border-neutral-800 shadow-2xl lg:shadow-none lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-40',
        uiStore.isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <!-- Sidebar Header -->
      <div class="h-16 flex items-center justify-between px-4 border-b border-neutral-800">
        <router-link
          to="/dashboard"
          @click="uiStore.closeMobileSidebar"
          class="flex items-center gap-2.5 text-white font-bold text-base tracking-wider hover:opacity-90 transition"
        >
          <JrLogo :size="36" />
          <div class="leading-none">
            <span class="text-white font-bold tracking-tight">JR BLANCO</span>
            <span class="block text-[10px] text-[#05C7F2] font-mono tracking-widest mt-0.5">SWGORA</span>
          </div>
        </router-link>

        <!-- Close Button (Mobile only) -->
        <button
          type="button"
          @click="uiStore.closeMobileSidebar"
          class="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        <div class="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          Módulos Principales
        </div>

        <router-link
          v-for="item in visibleNavItems"
          :key="item.path"
          :to="item.path"
          @click="uiStore.closeMobileSidebar"
          :class="[
            'group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            isActive(item.path)
              ? 'bg-[#05C7F2]/15 text-[#05F2F2] border border-[#05C7F2]/40 shadow-sm'
              : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white',
          ]"
        >
          <div class="flex items-center gap-3">
            <component
              :is="item.icon"
              :class="[
                'w-5 h-5 transition-transform group-hover:scale-110',
                isActive(item.path) ? 'text-[#05C7F2]' : 'text-neutral-400 group-hover:text-[#05C7F2]',
              ]"
            />
            <span>{{ item.name }}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span
              v-if="item.badge"
              :class="[
                'text-[11px] px-2 py-0.5 rounded-full font-semibold',
                isActive(item.path)
                  ? 'bg-[#05C7F2] text-black'
                  : 'bg-neutral-800 text-[#05C7F2]',
              ]"
            >
              {{ item.badge }}
            </span>
            <ChevronRight
              :class="[
                'w-4 h-4 transition-transform opacity-0 group-hover:opacity-100',
                isActive(item.path) && 'opacity-100 text-[#05C7F2]',
              ]"
            />
          </div>
        </router-link>
      </nav>

      <!-- Sidebar Footer / Role & Sprint -->
      <div class="p-3.5 border-t border-neutral-800 space-y-2">
        <!-- Active User Role Indicator -->
        <div class="bg-neutral-900/90 rounded-xl p-2.5 border border-neutral-800 flex items-center justify-between">
          <div class="text-[11px] text-neutral-400 font-medium">Rol Activo:</div>
          <RoleBadge :role="authStore.user?.role || 'Administrador'" size="sm" />
        </div>

        <div class="p-2.5 bg-neutral-900/60 rounded-xl border border-neutral-800 flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-[#05C7F2]/10 text-[#05C7F2]">
            <Sparkles class="w-3.5 h-3.5" />
          </div>
          <div class="text-xs">
            <div class="font-semibold text-neutral-200 text-[11px]">Sprint 2</div>
            <div class="text-neutral-400 text-[10px]">Autenticación, Roles y Clientes</div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
