<script setup lang="ts">
</script>

<template>
  <div class="relative min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 bg-slate-950 overflow-x-hidden font-sans">
    <!-- Fondo fotográfico profesional de taller de rectificado de motores -->
    <div 
      class="absolute inset-0 bg-cover bg-center transition-all duration-700"
      style="background-image: url('/images/workshop-bg.jpg');"
    ></div>

    <!-- Overlay oscuro con gradiente y viñeta industrial de alto contraste -->
    <div class="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950/95 backdrop-blur-[1.5px]"></div>

    <!-- Barra superior sutil corporativa -->
    <header class="relative z-10 w-full max-w-5xl flex items-center justify-between py-3 px-2 text-xs">
      <div class="flex items-center gap-2 text-slate-300">
        <span class="inline-block w-2 h-2 rounded-full bg-[#04c4d9] animate-pulse"></span>
        <span class="font-bold tracking-wider uppercase text-[11px] text-white">SWGORA</span>
        <span class="text-slate-500 hidden sm:inline">•</span>
        <span class="text-slate-400 hidden sm:inline text-[11px]">Sistema Web de Gestión Operativa</span>
      </div>
      <div class="text-[11px] text-slate-400 font-medium hidden sm:block">
        Taller Industrial & Rectificado de Motores
      </div>
    </header>

    <!-- Contenedor central de Login -->
    <main class="relative z-10 w-full flex justify-center py-4 my-auto">
      <slot />
    </main>

    <!-- Pie de página formal corporativo -->
    <footer class="relative z-10 w-full max-w-5xl py-3 px-2 text-center text-[11px] text-slate-400 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-1.5">
      <span>© {{ new Date().getFullYear() }} JR Blanco - Taller Industrial y Rectificado de Motores</span>
      <span class="text-slate-400 italic font-serif">"Apoyarte es nuestro compromiso"</span>
    </footer>
  </div>
</template>
