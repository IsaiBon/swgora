<script setup lang="ts">
import { computed } from 'vue'
import { ShieldCheck, Wrench, Eye, Building2, Users } from 'lucide-vue-next'
import { normalizeRole, type UserRole } from '@/stores/auth'

const props = withDefaults(
  defineProps<{
    role: UserRole | string
    size?: 'sm' | 'md' | 'lg'
    showIcon?: boolean
  }>(),
  {
    size: 'md',
    showIcon: true,
  }
)

const normalized = computed(() => normalizeRole(props.role))

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-2 py-0.5 text-[10px] gap-1'
    case 'lg':
      return 'px-3.5 py-1.5 text-xs gap-2'
    case 'md':
    default:
      return 'px-2.5 py-1 text-[11px] gap-1.5'
  }
})

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-3 h-3'
    case 'lg':
      return 'w-4 h-4'
    case 'md':
    default:
      return 'w-3.5 h-3.5'
  }
})

const badgeClasses = computed(() => {
  switch (normalized.value) {
    case 'Administrador':
      return 'bg-[#1E446E] text-white border-[#2B5C8F]/50 shadow-xs'
    case 'Sub-Administrador':
      return 'bg-[#2B5C8F] text-white border-[#3B6EA5]/50 shadow-xs'
    case 'Taller Independiente':
      return 'bg-[#E3F5F8] text-[#12697A] border-[#9AD2DC] shadow-xs'
    case 'Operador':
      return 'bg-[#F6F0E4] text-[#6E5835] border-[#E6DAC2] shadow-xs'
    case 'Consultor':
      return 'bg-slate-600 text-white border-slate-500/40 shadow-xs'
    default:
      return 'bg-slate-600 text-white border-slate-500/40 shadow-xs'
  }
})

const iconComponent = computed(() => {
  switch (normalized.value) {
    case 'Administrador':
      return ShieldCheck
    case 'Sub-Administrador':
      return Users
    case 'Taller Independiente':
      return Building2
    case 'Operador':
      return Wrench
    case 'Consultor':
      return Eye
    default:
      return ShieldCheck
  }
})

const iconColorClass = computed(() => {
  switch (normalized.value) {
    case 'Administrador':
      return 'text-[#38BDF8]'
    case 'Sub-Administrador':
      return 'text-indigo-200'
    case 'Taller Independiente':
      return 'text-[#091430]'
    case 'Operador':
      return 'text-amber-100'
    case 'Consultor':
      return 'text-slate-200'
    default:
      return 'text-slate-200'
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center font-mono font-bold uppercase tracking-wider rounded-full border transition-colors duration-150 select-none',
      sizeClasses,
      badgeClasses,
    ]"
  >
    <component
      v-if="showIcon"
      :is="iconComponent"
      :class="[iconSize, iconColorClass]"
    />
    <span>{{ normalized }}</span>
  </span>
</template>
