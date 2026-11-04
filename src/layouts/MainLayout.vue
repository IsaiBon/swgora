<script setup lang="ts">
import Navbar from '@/components/Navbar.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-[#05C7F2]/20 selection:text-[#038896]">
    <!-- Navbar Notch estilo Supaste centrado y suspendido en la parte superior -->
    <Navbar />

    <!-- Main Content Area (Aprovechamiento completo del espacio de trabajo) -->
    <main class="flex-1 w-full p-3 sm:p-6 lg:p-8 max-w-[1400px] mx-auto pt-3 sm:pt-5">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="py-4 px-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
      SWGORA &copy; 2026 - JR Blanco Rectificadora de Motores
    </footer>
  </div>
</template>
