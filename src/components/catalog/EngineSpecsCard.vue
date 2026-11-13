<script setup lang="ts">
import type { Motor, Fabricante, Modelo } from '@/services/catalogService'
import { Cpu, Fuel, Gauge, Ruler, Layers } from 'lucide-vue-next'

const props = defineProps<{
  motor: Motor | null
  fabricante?: Fabricante | null
  modelo?: Modelo | null
}>()
</script>

<template>
  <div v-if="motor" class="studio-hero-banner text-white rounded-3xl p-5 sm:p-6 relative overflow-hidden">
    <div class="absolute -top-12 -right-12 w-48 h-48 bg-[#04C4D9]/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
      
      <!-- Ficha de Identificación -->
      <div>
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/15 text-[#BFEBF2] border border-white/20 flex items-center gap-1">
            <Cpu class="w-3 h-3" />
            Ficha Técnica de Motor
          </span>
          <span class="text-xs text-sky-100/80">
            {{ fabricante?.nombre }} • {{ modelo?.nombre || 'Aplicación Multimodelo' }}
          </span>
        </div>

        <div class="flex items-baseline gap-3">
          <h2 class="font-display text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            Motor {{ motor.codigo }}
          </h2>
          <span class="text-sm font-semibold text-sky-100">
            {{ motor.nombre_comercial }}
          </span>
        </div>

        <p class="text-xs text-slate-400 mt-1 max-w-2xl">
          Configuración: <span class="text-slate-200 font-medium">{{ motor.configuracion || 'L4 SOHC' }}</span> • 
          Aspiración: <span class="text-slate-200 font-medium">{{ motor.aspiracion || 'Natural' }}</span> • 
          Años: <span class="text-slate-200 font-medium">{{ motor.anios || 'General' }}</span>
        </p>
      </div>

      <!-- Cotas Mecánicas Críticas para Rectificación (STD) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
        
        <!-- Diámetro de Cilindro STD -->
        <div class="px-2.5 py-1">
          <div class="text-[10px] uppercase font-bold text-[#BFEBF2] flex items-center gap-1">
            <Ruler class="w-3 h-3" /> Ø Cilindro STD
          </div>
          <div class="text-lg font-black text-white mt-0.5">
            {{ motor.diametro_cilindro_std_mm ? `${motor.diametro_cilindro_std_mm.toFixed(2)} mm` : 'Consultar' }}
          </div>
        </div>

        <!-- Carrera de Pistón -->
        <div class="px-2.5 py-1 border-l border-white/10">
          <div class="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Layers class="w-3 h-3" /> Carrera
          </div>
          <div class="text-lg font-black text-white mt-0.5">
            {{ motor.carrera_piston_mm ? `${motor.carrera_piston_mm.toFixed(2)} mm` : '—' }}
          </div>
        </div>

        <!-- Cilindros y Válvulas -->
        <div class="px-2.5 py-1 border-l border-white/10">
          <div class="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Gauge class="w-3 h-3" /> Arquitectura
          </div>
          <div class="text-sm font-bold text-white mt-1">
            {{ motor.cilindros }} Cil. / {{ motor.valvulas }}V
          </div>
        </div>

        <!-- Combustible -->
        <div class="px-2.5 py-1 border-l border-white/10">
          <div class="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Fuel class="w-3 h-3" /> Combustible
          </div>
          <div class="text-sm font-bold text-cyan-300 mt-1">
            {{ motor.combustible }}
          </div>
        </div>

      </div>

    </div>
  </div>
</template>
