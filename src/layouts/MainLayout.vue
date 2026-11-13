<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
import Navbar from '@/components/Navbar.vue'
</script>

<template>
  <div class="min-h-screen flex studio-canvas text-slate-900 font-sans antialiased">
    <!-- Menú Lateral Colapsable Zafiro -->
    <Sidebar />

    <!-- Área Principal -->
    <div class="flex-1 min-w-0 flex flex-col min-h-screen">
      <!-- Barra Superior Translúcida -->
      <Navbar />

      <!-- Contenido Principal -->
      <main class="flex-1 w-full p-4 sm:p-6 lg:p-7 max-w-[1440px] mx-auto">
        <slot />
      </main>

      <!-- Footer Luminoso -->
      <footer class="py-3.5 px-4 sm:px-7 border-t border-slate-200/80 bg-white/75 backdrop-blur-xs text-slate-500">
        <div class="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2 font-semibold text-slate-700">
            <span class="w-2 h-2 rounded-full bg-[#147488]"></span>
            <span>SWGORA · Sistema Operativo de Rectificación Automotriz</span>
          </div>
          <span class="text-slate-400">&copy; 2026 JR Blanco Rectificadora de Motores</span>
        </div>
      </footer>
    </div>
  </div>
</template>
