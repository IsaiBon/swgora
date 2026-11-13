<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useTallerStore } from '@/stores/taller'
import { useRouter, useRoute } from 'vue-router'
import RoleBadge from '@/components/RoleBadge.vue'
import {
  LayoutDashboard,
  ShoppingCart,
  MapPin,
  Package,
  Users,
  ShieldCheck,
  Building2,
  X,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from 'lucide-vue-next'

const uiStore = useUiStore()
const authStore = useAuthStore()
const tallerStore = useTallerStore()
const router = useRouter()
const route = useRoute()

const tallerLogoUrl = computed(() => tallerStore.tallerInfo.logo_url || '/logo-taller.png')

interface NavItem {
  name: string
  path: string
  icon: any
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Órdenes', path: '/ordenes', icon: ShoppingCart },
  { name: 'Rutas', path: '/rutas', icon: MapPin },
  { name: 'Catálogo', path: '/catalogo', icon: Package },
  { name: 'Clientes', path: '/clientes', icon: Users },
  { name: 'Usuarios', path: '/usuarios', icon: ShieldCheck },
  { name: 'Taller', path: '/taller', icon: Building2 },
]

const visibleNavItems = computed(() => {
  return navItems.filter((item) => authStore.canAccess(item.path))
})

const isActive = (path: string) => {
  return route.path === path
}

const workshopDisplayName = computed(() => {
  if (authStore.user?.isIndependent) {
    return (
      tallerStore.tallerInfo.nombre ||
      authStore.activeTenantWorkshopName ||
      'MI TALLER'
    )
  }
  return 'JR BLANCO'
})

const handleNewOrder = () => {
  uiStore.closeMobileSidebar()
  uiStore.requestNewOrder()
  if (route.path !== '/ordenes') {
    router.push({ path: '/ordenes', query: { nueva: '1' } })
  }
}

onMounted(() => {
  void tallerStore.loadTallerInfo(true)
})

watch(
  () => [authStore.user?.id, authStore.activeTenantId],
  () => {
    void tallerStore.loadTallerInfo(true)
  }
)
</script>

<template>
  <!-- Contenedor lateral adaptable -->
  <div
    class="shrink-0 transition-[width] duration-300"
    :class="uiStore.isSidebarCollapsed ? 'lg:w-[82px]' : 'lg:w-[260px]'"
    style="transition-timing-function: var(--ease-drawer);"
  >
    <!-- Backdrop Móvil -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="uiStore.isMobileSidebarOpen"
        @click="uiStore.closeMobileSidebar"
        class="fixed inset-0 z-[45] bg-[#09132B]/55 backdrop-blur-xs lg:hidden"
      ></div>
    </Transition>

    <!-- Rail Zafiro Profundo -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex flex-col text-white overflow-hidden select-none border-r border-white/10 shadow-2xl lg:shadow-none lg:sticky lg:top-0 lg:h-screen lg:z-30 transition-[transform,width] duration-300',
        uiStore.isSidebarCollapsed ? 'w-[260px] lg:w-[82px]' : 'w-[260px]',
        uiStore.isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
      style="background: linear-gradient(175deg, #0D1B3E 0%, #091430 58%, #071026 100%); transition-timing-function: var(--ease-drawer);"
    >
      <!-- Halo sutil superior azul/cian -->
      <div
        class="pointer-events-none absolute -top-20 -left-16 w-60 h-60 rounded-full opacity-35 blur-3xl"
        style="background: radial-gradient(circle, #04C4D9 0%, #2563EB 55%, transparent 75%);"
      ></div>
      <!-- Cabecera de Marca del Taller -->
      <div class="relative h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <router-link
          :to="authStore.defaultRoute"
          @click="uiStore.closeMobileSidebar"
          class="flex items-center gap-3 min-w-0 group"
          title="Ir al inicio"
        >
          <div class="w-10 h-10 rounded-xl bg-white/95 p-1 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-[#BFEBF2]/50 group-hover:ring-[#BFEBF2] group-hover:scale-105 transition-transform duration-200">
            <img
              :src="tallerLogoUrl"
              alt="Logotipo del taller"
              class="w-full h-full object-contain"
            />
          </div>

          <div
            v-if="!uiStore.isSidebarCollapsed"
            class="min-w-0 leading-tight lg:block"
          >
            <span class="font-display block font-extrabold text-sm tracking-tight text-white truncate max-w-[150px]">
              {{ workshopDisplayName }}
            </span>
            <span class="block text-[10px] font-semibold tracking-wider uppercase text-[#BFEBF2] mt-0.5 truncate">
              {{ authStore.user?.isIndependent ? 'Sistema de Taller' : 'Rectificadora · SWGORA' }}
            </span>
          </div>
        </router-link>

        <!-- Cerrar en móvil -->
        <button
          type="button"
          @click="uiStore.closeMobileSidebar"
          class="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 lg:hidden cursor-pointer"
          aria-label="Cerrar menú"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Botón Acción Rápida en Barra Lateral -->
      <div v-if="authStore.canAccess('/ordenes')" class="relative px-3.5 pt-4 pb-2 shrink-0">
        <button
          type="button"
          @click="handleNewOrder"
          :class="[
            'bg-[#D5F2F6] hover:bg-[#BFEBF2] text-[#133B5E] border border-[#9BD6E2] shadow-xs w-full rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-97',
            uiStore.isSidebarCollapsed ? 'h-10 px-0' : 'py-2.5 px-3.5',
          ]"
          title="Crear nueva orden de trabajo o cotización"
        >
          <Plus class="w-4 h-4 stroke-[2.5] shrink-0" />
          <span v-if="!uiStore.isSidebarCollapsed" class="truncate">Nueva Orden</span>
        </button>
      </div>

      <!-- Enlaces de Navegación -->
      <nav class="relative flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
        <div
          v-if="!uiStore.isSidebarCollapsed"
          class="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-sky-100/55"
        >
          Módulos del Taller
        </div>

        <router-link
          v-for="item in visibleNavItems"
          :key="item.path"
          :to="item.path"
          @click="uiStore.closeMobileSidebar"
          :title="uiStore.isSidebarCollapsed ? item.name : undefined"
          :class="[
            'group relative flex items-center rounded-xl transition-all duration-200 cursor-pointer',
            uiStore.isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5',
            isActive(item.path)
              ? 'text-white shadow-lg shadow-blue-950/40 border border-transparent bg-origin-border bg-no-repeat'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.07] border border-transparent',
          ]"
          :style="isActive(item.path) ? { background: 'linear-gradient(90deg, rgba(4, 196, 217, 0.25) 0%, rgba(37, 99, 235, 0.22) 100%)', boxShadow: 'inset 0 0 0 1px rgba(56, 189, 248, 0.35)' } : undefined"
        >
          <!-- Indicador vertical en ítem activo -->
          <span
            v-if="isActive(item.path)"
            class="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#BFEBF2] animate-nav-pill"
          ></span>

          <div class="flex items-center gap-3 min-w-0">
            <div
              :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200',
                isActive(item.path)
                  ? 'bg-[#BFEBF2]/20 text-[#BFEBF2] scale-105'
                  : 'bg-white/[0.06] text-slate-300 group-hover:text-[#BFEBF2] group-hover:scale-105 group-hover:bg-white/[0.1]',
              ]"
            >
              <component :is="item.icon" class="w-4 h-4" />
            </div>

            <span
              v-if="!uiStore.isSidebarCollapsed"
              class="text-[13px] font-semibold truncate transition-transform duration-150 group-hover:translate-x-0.5"
            >
              {{ item.name }}
            </span>
          </div>

          <ChevronRight
            v-if="!uiStore.isSidebarCollapsed"
            :class="[
              'w-3.5 h-3.5 shrink-0 transition-all duration-150',
              isActive(item.path)
                ? 'opacity-100 text-[#BFEBF2] translate-x-0'
                : 'opacity-0 -translate-x-1 group-hover:opacity-70 group-hover:translate-x-0 text-slate-400',
            ]"
          />
        </router-link>
      </nav>

      <!-- Footer de Sidebar: Rol & Botón Colapsar -->
      <div class="relative p-3 border-t border-white/10 space-y-2 shrink-0 bg-black/15">
        <div
          v-if="!uiStore.isSidebarCollapsed"
          class="rounded-xl bg-white/[0.06] border border-white/10 p-2.5 flex items-center justify-between gap-2"
        >
          <span class="text-[11px] text-blue-200/75 font-semibold">Perfil</span>
          <RoleBadge :role="authStore.user?.role || 'Consultor'" size="sm" />
        </div>

        <button
          type="button"
          @click="uiStore.toggleSidebarCollapse"
          class="hidden lg:flex w-full items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-blue-200/80 hover:text-white hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer active:scale-[0.98]"
          :title="uiStore.isSidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'"
        >
          <PanelLeftOpen v-if="uiStore.isSidebarCollapsed" class="w-4 h-4 text-[#38BDF8]" />
          <PanelLeftClose v-else class="w-4 h-4 text-[#38BDF8]" />
          <span v-if="!uiStore.isSidebarCollapsed">Contraer menú</span>
        </button>
      </div>
    </aside>
  </div>
</template>
