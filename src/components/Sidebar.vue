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
  Building2,
  X,
  ChevronRight,
} from 'lucide-vue-next'

const uiStore = useUiStore()
const authStore = useAuthStore()
const route = useRoute()

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
  { name: 'Usuarios', path: '/usuarios', icon: Users },
  { name: 'Taller', path: '/taller', icon: Building2 },
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
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <router-link
          v-for="item in visibleNavItems"
          :key="item.path"
          :to="item.path"
          @click="uiStore.closeMobileSidebar"
          :class="[
            'group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150',
            isActive(item.path)
              ? 'bg-[#05C7F2]/15 text-[#05F2F2] border border-[#05C7F2]/30 shadow-xs'
              : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-white',
          ]"
        >
          <div class="flex items-center gap-2.5">
            <component
              :is="item.icon"
              :class="[
                'w-4 h-4 transition-transform group-hover:scale-105',
                isActive(item.path) ? 'text-[#05C7F2]' : 'text-neutral-400 group-hover:text-[#05C7F2]',
              ]"
            />
            <span>{{ item.name }}</span>
          </div>

          <ChevronRight
            :class="[
              'w-3.5 h-3.5 transition-transform opacity-0 group-hover:opacity-100',
              isActive(item.path) && 'opacity-100 text-[#05C7F2]',
            ]"
          />
        </router-link>
      </nav>

      <!-- Sidebar Footer / Role -->
      <div class="p-3 border-t border-neutral-800">
        <div class="bg-neutral-900/90 rounded-xl p-2 border border-neutral-800/80 flex items-center justify-between">
          <span class="text-[10px] text-neutral-400 font-medium">Rol</span>
          <RoleBadge :role="authStore.user?.role || 'Administrador'" size="sm" />
        </div>
      </div>
    </aside>
  </div>
</template>
