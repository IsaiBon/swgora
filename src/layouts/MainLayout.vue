<script setup lang="ts">
import { useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import Sidebar from '@/components/Sidebar.vue'

const route = useRoute()
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
    <!-- Sidebar (Fijo/Sticky en desktop, Drawer deslizable en mobile) -->
    <Sidebar />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0 min-h-screen">
      <!-- Navbar (Oculto en /catalogo para que el catálogo tenga su navbar técnico Ajusa/TecDoc exclusivo por código de pieza) -->
      <Navbar v-if="route.path !== '/catalogo'" />

      <!-- Page Content -->
      <main :class="['flex-1 w-full', route.path === '/catalogo' ? 'p-0 max-w-none' : 'p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto']">
        <slot />
      </main>

      <!-- Footer -->
      <footer v-if="route.path !== '/catalogo'" class="py-4 px-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        SWGORA &copy; 2026 - JR Blanco Rectificadora de Motores
      </footer>
    </div>
  </div>
</template>

