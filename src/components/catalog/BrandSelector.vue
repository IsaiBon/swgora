<script setup lang="ts">
import { computed } from 'vue'
import type { Fabricante, Modelo, Motor } from '@/services/catalogService'
import { Car } from 'lucide-vue-next'

const props = defineProps<{
  fabricantes: Fabricante[]
  modelos: Modelo[]
  motores: Motor[]
  selectedFabricanteId: string
  selectedModeloId: string
  selectedMotorId: string
}>()

const emit = defineEmits<{
  (e: 'update:selectedFabricanteId', val: string): void
  (e: 'update:selectedModeloId', val: string): void
  (e: 'update:selectedMotorId', val: string): void
  (e: 'select-motor', motor: Motor): void
}>()

const filteredModelos = computed(() => {
  if (!props.selectedFabricanteId) return props.modelos
  return props.modelos.filter(m => m.fabricante_id === props.selectedFabricanteId)
})

const filteredMotores = computed(() => {
  let list = props.motores
  if (props.selectedFabricanteId) {
    list = list.filter(m => m.fabricante_id === props.selectedFabricanteId)
  }
  if (props.selectedModeloId) {
    list = list.filter(m => m.modelo_id === props.selectedModeloId)
  }
  return list
})

const handleSelectFabricante = (fabId: string) => {
  emit('update:selectedFabricanteId', fabId)
  // Al cambiar fabricante, resetear modelo y motor
  const firstModel = props.modelos.find(m => m.fabricante_id === fabId)
  if (firstModel) {
    emit('update:selectedModeloId', firstModel.id)
    const firstMotor = props.motores.find(m => m.fabricante_id === fabId && m.modelo_id === firstModel.id)
    if (firstMotor) {
      emit('update:selectedMotorId', firstMotor.id)
      emit('select-motor', firstMotor)
      return
    }
  }
  emit('update:selectedModeloId', '')
  emit('update:selectedMotorId', '')
}

const handleSelectModelo = (modId: string) => {
  emit('update:selectedModeloId', modId)
  const firstMotor = props.motores.find(m => m.modelo_id === modId)
  if (firstMotor) {
    emit('update:selectedMotorId', firstMotor.id)
    emit('select-motor', firstMotor)
  } else {
    emit('update:selectedMotorId', '')
  }
}

const handleSelectMotor = (motId: string) => {
  emit('update:selectedMotorId', motId)
  const motor = props.motores.find(m => m.id === motId)
  if (motor) {
    emit('select-motor', motor)
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Grid de Marcas Preferidas (Cuadrícula Táctil para Mostrador / Tablet) -->
    <div>
      <div class="flex items-center justify-between mb-2.5">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Car class="w-3.5 h-3.5 text-[#04c4d9]" />
          Marcas Preferidas del Taller
        </h3>
        <span class="text-[11px] text-slate-400">Seleccione marca para ver modelos y motores</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <button
          v-for="brand in fabricantes"
          :key="brand.id"
          type="button"
          @click="handleSelectFabricante(brand.id)"
          :class="[
            'relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all min-h-[64px]',
            selectedFabricanteId === brand.id
              ? 'bg-gradient-to-b from-cyan-50 to-white border-[#04c4d9] text-[#038391] shadow-xs ring-2 ring-[#04c4d9]/20'
              : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700 hover:border-slate-300'
          ]"
        >
          <!-- Badge indicador de activo -->
          <span 
            v-if="selectedFabricanteId === brand.id" 
            class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#04c4d9]"
          ></span>

          <span class="text-sm font-black tracking-tight">{{ brand.nombre }}</span>
          <span class="text-[10px] text-slate-400 mt-0.5">{{ brand.pais_origen || 'Japón' }}</span>
        </button>
      </div>
    </div>

    <!-- Filtros en Cascada (Fabricante -> Modelo -> Código de Motor) -->
    <div class="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
        
        <!-- 1. Selector Fabricante -->
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            1. Fabricante
          </label>
          <div class="relative">
            <select
              :value="selectedFabricanteId"
              @change="handleSelectFabricante(($event.target as HTMLSelectElement).value)"
              class="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] cursor-pointer"
            >
              <option value="" disabled>Seleccione marca...</option>
              <option v-for="f in fabricantes" :key="f.id" :value="f.id">
                {{ f.nombre }} ({{ f.pais_origen || 'General' }})
              </option>
            </select>
          </div>
        </div>

        <!-- 2. Selector Modelo -->
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            2. Modelo de Vehículo
          </label>
          <select
            :value="selectedModeloId"
            @change="handleSelectModelo(($event.target as HTMLSelectElement).value)"
            class="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] cursor-pointer"
          >
            <option value="">Todos los modelos</option>
            <option v-for="m in filteredModelos" :key="m.id" :value="m.id">
              {{ m.nombre }} {{ m.anio_inicio ? `(${m.anio_inicio}-${m.anio_fin || 'Presente'})` : '' }}
            </option>
          </select>
        </div>

        <!-- 3. Selector Motor -->
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            3. Código de Motor
          </label>
          <select
            :value="selectedMotorId"
            @change="handleSelectMotor(($event.target as HTMLSelectElement).value)"
            class="w-full px-3 py-2 text-xs font-black bg-cyan-50/60 border border-cyan-300 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] cursor-pointer"
          >
            <option value="" disabled>Seleccione motor...</option>
            <option v-for="mot in filteredMotores" :key="mot.id" :value="mot.id">
              {{ mot.codigo }} — {{ mot.nombre_comercial || mot.combustible }}
            </option>
          </select>
        </div>

      </div>
    </div>
  </div>
</template>
