<script setup lang="ts">
</script>

<template>
  <div class="auth-shell relative min-h-screen w-full flex flex-col items-center justify-between px-4 py-5 sm:px-6 sm:py-6 bg-[#0F172A] overflow-x-hidden font-sans selection:bg-[#04C4D9]/25 selection:text-white">
    <!-- Imagen de fondo de taller con tratamiento arquitectónico de alto contraste -->
    <div
      class="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
      style="background-image: url('/images/workshop-bg.jpg');"
    ></div>

    <!-- Capas de profundidad con la paleta corporativa oficial (#1A2234, #004B97, #04C4D9) -->
    <div class="absolute inset-0 bg-gradient-to-b from-[#0F172A]/95 via-[#1A2234]/92 to-[#0F172A]/98 pointer-events-none"></div>
    <div
      class="absolute inset-0 pointer-events-none"
      style="background: radial-gradient(circle at 50% 0%, rgba(0, 75, 151, 0.28) 0%, rgba(4, 196, 217, 0.08) 38%, transparent 70%);"
    ></div>

    <!-- Línea superior de acento institucional -->
    <div class="fixed top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#004B97] via-[#04C4D9] to-[#004B97] z-30"></div>

    <!-- Encabezado minimalista corporativo -->
    <header class="relative z-10 w-full max-w-5xl flex items-center justify-between py-2 px-1 text-xs">
      <div class="flex items-center gap-2.5">
        <span class="inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#04C4D9] ring-4 ring-[#04C4D9]/15"></span>
        <span class="font-bold tracking-wider uppercase text-[11px] text-white">SWGORA</span>
        <span class="text-slate-600 hidden sm:inline">/</span>
        <span class="text-slate-300 hidden sm:inline text-[11px] font-medium">
          Sistema de Gestión Operativa y Rectificación
        </span>
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
        <span class="hidden sm:inline text-slate-400">JR Blanco</span>
        <span class="hidden sm:inline text-slate-600">•</span>
        <span class="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-slate-200 font-mono text-[10px] tabular-nums">
          Acceso Seguro
        </span>
      </div>
    </header>

    <!-- Contenedor central de autenticación -->
    <main class="relative z-10 w-full flex justify-center py-6 my-auto">
      <slot />
    </main>

    <!-- Pie de página institucional minimalista -->
    <footer class="relative z-10 w-full max-w-5xl pt-3 pb-1 px-1 text-[11px] text-slate-400 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-1.5">
      <span class="text-slate-300 font-medium">
        © {{ new Date().getFullYear() }} JR Blanco — Taller Industrial y Rectificado de Motores
      </span>
      <span class="text-slate-400">
        Apoyarte es nuestro compromiso
      </span>
    </footer>
  </div>
</template>
