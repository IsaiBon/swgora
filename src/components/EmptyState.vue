<script setup lang="ts">
import { FolderSearch, Plus, RotateCcw } from 'lucide-vue-next'

defineProps<{
  title: string
  description: string
  icon?: any
  actionText?: string
  secondaryActionText?: string
}>()

defineEmits<{
  (e: 'action'): void
  (e: 'secondaryAction'): void
}>()
</script>

<template>
  <div class="studio-card p-8 sm:p-12 text-center max-w-lg mx-auto border-dashed border-2 border-[#C7DCEB]">
    <!-- Contenedor Icono Pastel con Levitación Sutil -->
    <div class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#E8F3FA] border border-[#CBE2F2] flex items-center justify-center text-[#1E446E] shadow-xs animate-soft-float">
      <component :is="icon" v-if="icon" class="w-7 h-7" />
      <FolderSearch v-else class="w-7 h-7" />
    </div>

    <!-- Título y Descripción -->
    <h3 class="font-display text-lg sm:text-xl font-extrabold text-[#162436] tracking-tight mb-2">
      {{ title }}
    </h3>
    <p class="text-sm text-slate-500 mb-6 leading-relaxed max-w-sm mx-auto">
      {{ description }}
    </p>

    <!-- Botones de Acción -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <button
        v-if="actionText"
        type="button"
        @click="$emit('action')"
        class="studio-cta-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer"
      >
        <Plus class="w-4 h-4 stroke-[2.5]" />
        <span>{{ actionText }}</span>
      </button>

      <button
        v-if="secondaryActionText"
        type="button"
        @click="$emit('secondaryAction')"
        class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-[#EFF5FB] hover:border-[#BFD7EC] text-slate-700 text-xs sm:text-sm font-semibold active:scale-[0.98] transition-colors transition-transform duration-150 cursor-pointer"
      >
        <RotateCcw class="w-3.5 h-3.5 text-[#1E446E]" />
        <span>{{ secondaryActionText }}</span>
      </button>
    </div>
  </div>
</template>
