<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: number | null | undefined
    fallback: number
    unit?: string
    step?: number
  }>(),
  {
    modelValue: undefined,
    fallback: 1.0,
    unit: 'mm',
    step: 0.05
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | undefined): void
}>()

const isCustom = computed(() => {
  return props.modelValue !== undefined && props.modelValue !== null && !isNaN(Number(props.modelValue))
})

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  const raw = target.value.trim()
  if (raw === '') {
    emit('update:modelValue', undefined)
  } else {
    const val = parseFloat(raw.replace(',', '.'))
    emit('update:modelValue', isNaN(val) ? undefined : val)
  }
}

const clearCustom = () => {
  emit('update:modelValue', undefined)
}
</script>

<template>
  <div 
    class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border transition text-[10px] font-mono font-bold"
    :class="isCustom ? 'bg-cyan-50 border-[#04C4D9] text-[#038391] shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200/60'"
    :title="isCustom ? `Tolerancia individual activa (±${modelValue}${unit}). Clic en ✕ para restablecer a general.` : `Tolerancia general (±${fallback}${unit}). Haz clic para fijar una tolerancia específica a este filtro.`"
  >
    <button
      v-if="isCustom"
      type="button"
      @click.stop="clearCustom"
      title="Restablecer a tolerancia general"
      class="text-[9px] text-slate-400 hover:text-red-500 font-bold mr-0.5 focus:outline-none"
    >
      ✕
    </button>
    <span class="text-slate-400 select-none">±</span>
    <input
      :value="modelValue ?? ''"
      @input="onInput"
      type="number"
      :step="step"
      min="0"
      max="50"
      :placeholder="String(fallback)"
      class="w-7 text-center bg-transparent font-bold focus:outline-none focus:w-10 transition-all text-[#038391]"
    />
    <span class="text-[9px] text-slate-400 select-none">{{ unit }}</span>
  </div>
</template>
