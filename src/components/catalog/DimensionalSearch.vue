<script setup lang="ts">
import { ref } from 'vue'
import { catalogService, type RepuestoTecnico, type DimensionalFilter } from '@/services/catalogService'
import { Ruler, Search, RotateCcw, Plus, AlertCircle } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'add-to-order', repuesto: RepuestoTecnico): void
  (e: 'toast', msg: string): void
}>()

const activeTab = ref<'Válvulas' | 'Anillos' | 'Casquetería' | 'Sellos'>('Válvulas')

// Filtros para Válvulas
const valveHead = ref<number | undefined>(undefined)
const valveStem = ref<number | undefined>(undefined)
const valveLength = ref<number | undefined>(undefined)

// Filtros para Anillos
const ringBore = ref<number | undefined>(undefined)
const ring1 = ref<number | undefined>(undefined)
const ring2 = ref<number | undefined>(undefined)
const ringOil = ref<number | undefined>(undefined)

// Filtros para Casquetes
const bearingType = ref<'MS' | 'CB' | 'TW' | 'SH' | 'PB' | ''>('')
const bearingJournal = ref<number | undefined>(undefined)
const bearingWidth = ref<number | undefined>(undefined)

// Filtros para Sellos
const sealStem = ref<number | undefined>(undefined)

// Tolerancia
const tolerance = ref<number>(0.5)

// Resultados
const results = ref<RepuestoTecnico[]>([])
const hasSearched = ref(false)
const isSearching = ref(false)

const handleSearch = async () => {
  isSearching.value = true
  hasSearched.value = true

  const filter: DimensionalFilter = {
    categoria: activeTab.value,
    tolerancia_mm: tolerance.value,
    diametro_cabeza: valveHead.value,
    diametro_vastago: activeTab.value === 'Válvulas' ? valveStem.value : sealStem.value,
    longitud_total: valveLength.value,
    diametro_cilindro: ringBore.value,
    espesor_anillo1: ring1.value,
    espesor_anillo2: ring2.value,
    espesor_aceite: ringOil.value,
    tipo_cojinete: bearingType.value,
    diametro_munon: bearingJournal.value,
    ancho_casquete: bearingWidth.value
  }

  results.value = await catalogService.searchDimensional(filter)
  isSearching.value = false
}

const handleReset = () => {
  valveHead.value = undefined
  valveStem.value = undefined
  valveLength.value = undefined
  ringBore.value = undefined
  ring1.value = undefined
  ring2.value = undefined
  ringOil.value = undefined
  bearingType.value = ''
  bearingJournal.value = undefined
  bearingWidth.value = undefined
  sealStem.value = undefined
  results.value = []
  hasSearched.value = false
}

// Presets de medidas comunes en taller para pruebas rápidas
const applyPreset = (type: string) => {
  if (type === 'toyota_valve') {
    activeTab.value = 'Válvulas'
    valveHead.value = 42.5
    valveStem.value = 8.0
    valveLength.value = 103.5
  } else if (type === 'rings_96') {
    activeTab.value = 'Anillos'
    ringBore.value = 96.0
    ring1.value = 2.0
    ring2.value = 1.5
    ringOil.value = 4.0
  } else if (type === 'rings_89') {
    activeTab.value = 'Anillos'
    ringBore.value = 89.0
    ring1.value = 1.5
    ring2.value = 1.5
    ringOil.value = 2.8
  } else if (type === 'bearing_ms') {
    activeTab.value = 'Casquetería'
    bearingType.value = 'MS'
    bearingJournal.value = 62.0
    bearingWidth.value = 23.0
  }
  handleSearch()
}
</script>

<template>
  <div class="space-y-5">
    
    <!-- Encabezado del Modo Dimensional -->
    <div class="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700/80 shadow-md">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-[#04c4d9] flex items-center gap-1.5 mb-1">
            <Ruler class="w-3.5 h-3.5" />
            Módulo de Adaptaciones y Maquinado
          </span>
          <h2 class="text-xl font-black text-white">Búsqueda Dimensional por Medidas Físicas (mm)</h2>
          <p class="text-xs text-slate-400 mt-1 max-w-2xl">
            Identifique repuestos alternos compatibles cuando una pieza llega desgastada al mostrador, sin código de motor legible o para adaptaciones personalizadas.
          </p>
        </div>

        <!-- Presets Rápidos -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-slate-400 mr-1">Ejemplos:</span>
          <button
            type="button"
            @click="applyPreset('toyota_valve')"
            class="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 transition"
          >
            Válvula 42.5x8
          </button>
          <button
            type="button"
            @click="applyPreset('rings_96')"
            class="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 transition"
          >
            Anillos Ø96mm
          </button>
          <button
            type="button"
            @click="applyPreset('bearing_ms')"
            class="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-slate-200 transition"
          >
            Bancada Ø62mm
          </button>
        </div>
      </div>
    </div>

    <!-- Panel de Formulario por Categoría -->
    <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
      
      <!-- Pestañas de Tipo de Componente -->
      <div class="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          v-for="tab in (['Válvulas', 'Anillos', 'Casquetería', 'Sellos'] as const)"
          :key="tab"
          type="button"
          @click="activeTab = tab"
          :class="[
            'px-4 py-2 rounded-xl text-xs font-black transition min-h-[40px]',
            activeTab === tab
              ? 'bg-[#04c4d9] text-white shadow-xs'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
          ]"
        >
          {{ tab }}
        </button>

        <div class="ml-auto flex items-center gap-2">
          <label class="text-[11px] font-bold text-slate-500 uppercase">Tolerancia (±mm):</label>
          <select
            v-model.number="tolerance"
            class="px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
          >
            <option :value="0.1">± 0.10 mm (Precisión alta)</option>
            <option :value="0.25">± 0.25 mm</option>
            <option :value="0.5">± 0.50 mm (Estándar)</option>
            <option :value="1.0">± 1.00 mm (Adaptaciones)</option>
          </select>
        </div>
      </div>

      <!-- Formulario para Válvulas -->
      <div v-if="activeTab === 'Válvulas'" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Diámetro Cabeza / Hongo (mm)
          </label>
          <input
            v-model.number="valveHead"
            type="number"
            step="0.1"
            placeholder="Ej. 42.5"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Tolerancia de diámetro ±{{ tolerance }}mm</span>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Diámetro Vástago (mm)
          </label>
          <input
            v-model.number="valveStem"
            type="number"
            step="0.05"
            placeholder="Ej. 8.0 o 6.0"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Medida crítica del vástago</span>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Longitud Total (mm)
          </label>
          <input
            v-model.number="valveLength"
            type="number"
            step="0.1"
            placeholder="Ej. 103.5 o 116.5"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Desde asiento a punta de vástago</span>
        </div>
      </div>

      <!-- Formulario para Anillos -->
      <div v-if="activeTab === 'Anillos'" class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Diámetro Cilindro / Calibre (mm)
          </label>
          <input
            v-model.number="ringBore"
            type="number"
            step="0.1"
            placeholder="Ej. 96.0 o 89.0"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Calibre nominal estándar</span>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Espesor 1er Anillo (mm)
          </label>
          <input
            v-model.number="ring1"
            type="number"
            step="0.05"
            placeholder="Ej. 2.0 o 1.5"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Anillo de fuego / compresión</span>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Espesor 2do Anillo (mm)
          </label>
          <input
            v-model.number="ring2"
            type="number"
            step="0.05"
            placeholder="Ej. 1.5"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Anillo rascador</span>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Espesor Aceite (mm)
          </label>
          <input
            v-model.number="ringOil"
            type="number"
            step="0.05"
            placeholder="Ej. 4.0 o 2.8"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Anillo de control de aceite</span>
        </div>
      </div>

      <!-- Formulario para Casquetes NDC -->
      <div v-if="activeTab === 'Casquetería'" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Tipo de Cojinete (NDC)
          </label>
          <select
            v-model="bearingType"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          >
            <option value="">Todos los tipos</option>
            <option value="MS">MS - Casquetes de Bancada (Main Bearing)</option>
            <option value="CB">CB - Casquetes de Biela (Con-rod Bearing)</option>
            <option value="TW">TW - Arandelas Axiales / Empuje (Thrust Washer)</option>
            <option value="SH">SH - Casquetes de Leva (Camshaft)</option>
            <option value="PB">PB - Bocinas de Biela / Bulón (Pin Bushing)</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Diámetro de Muñón / Eje (mm)
          </label>
          <input
            v-model.number="bearingJournal"
            type="number"
            step="0.1"
            placeholder="Ej. 62.0 o 53.0"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Diámetro exterior de muñón cigüeñal</span>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Ancho del Casquete (mm)
          </label>
          <input
            v-model.number="bearingWidth"
            type="number"
            step="0.1"
            placeholder="Ej. 23.0 o 24.0"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 mt-1 block">Ancho axial del cojinete</span>
        </div>
      </div>

      <!-- Formulario para Sellos -->
      <div v-if="activeTab === 'Sellos'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Diámetro Interior / Vástago (mm)
          </label>
          <input
            v-model.number="sealStem"
            type="number"
            step="0.1"
            placeholder="Ej. 8.0 o 6.0"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#04c4d9] focus:outline-none"
          />
        </div>
      </div>

      <!-- Botones de Acción -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          @click="handleReset"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          Limpiar Filtros
        </button>

        <button
          type="button"
          @click="handleSearch"
          :disabled="isSearching"
          class="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-xl shadow-sm transition"
        >
          <Search class="w-4 h-4" />
          <span>{{ isSearching ? 'Buscando...' : 'Buscar Repuestos Compatibles' }}</span>
        </button>
      </div>

    </div>

    <!-- Resultados de Búsqueda Dimensional -->
    <div v-if="hasSearched" class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div class="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black text-slate-900 uppercase tracking-wider">Resultados de Adaptación:</span>
          <span class="px-2 py-0.5 rounded-full text-xs font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
            {{ results.length }} opciones encontradas
          </span>
        </div>
        <span class="text-xs text-slate-400">Tolerancia activa: ±{{ tolerance }} mm</span>
      </div>

      <div v-if="results.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-xs min-w-[900px]">
          <thead class="bg-white text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
            <tr>
              <th class="px-4 py-3">Repuesto</th>
              <th class="px-4 py-3">Código OEM</th>
              <th class="px-4 py-3">Cruce Dokuro / Rik / NDC</th>
              <th class="px-4 py-3">Cotas Físicas Registradas</th>
              <th class="px-4 py-3 text-right">Precio ($)</th>
              <th class="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="res in results" :key="res.id" class="hover:bg-slate-50 transition">
              <td class="px-4 py-3.5">
                <div class="font-bold text-slate-900">{{ res.nombre }}</div>
                <span class="text-[10px] text-slate-400">{{ res.subsistema }} • {{ res.categoria }}</span>
              </td>
              <td class="px-4 py-3.5 font-mono font-black text-cyan-900">
                {{ res.codigo_oem }}
              </td>
              <td class="px-4 py-3.5">
                <div class="flex flex-wrap gap-1 font-mono text-[11px]">
                  <span 
                    v-for="eq in res.equivalencias" 
                    :key="eq.id"
                    class="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700 border border-slate-200"
                  >
                    {{ eq.marca_alterna }}: {{ eq.codigo_alterno }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3.5">
                <div v-if="res.diametro_cabeza_mm" class="text-xs text-slate-700 font-mono">
                  Cab: <strong>Ø{{ res.diametro_cabeza_mm }}mm</strong> | Vást: <strong>Ø{{ res.diametro_vastago_mm }}mm</strong> | Long: <strong>{{ res.longitud_total_mm }}mm</strong>
                </div>
                <div v-else-if="res.diametro_cilindro_mm" class="text-xs text-slate-700 font-mono">
                  Cil: <strong>Ø{{ res.diametro_cilindro_mm }}mm</strong> | Anillos: <strong>{{ res.espesor_anillo1_mm }}/{{ res.espesor_anillo2_mm }}/{{ res.espesor_aceite_mm }}mm</strong>
                </div>
                <div v-else-if="res.tipo_cojinete" class="text-xs text-slate-700 font-mono">
                  NDC {{ res.tipo_cojinete }}: Muñón <strong>Ø{{ res.diametro_munon_mm }}mm</strong> | Ancho <strong>{{ res.ancho_casquete_mm }}mm</strong>
                </div>
                <span v-else class="text-slate-400 text-xs">Sin dimensiones registradas</span>
              </td>
              <td class="px-4 py-3.5 text-right font-black text-slate-900">
                ${{ res.precio.toFixed(2) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <button
                  type="button"
                  @click="emit('add-to-order', res)"
                  class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-lg transition shadow-xs"
                >
                  <Plus class="w-3.5 h-3.5" />
                  Agregar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="p-8 text-center text-slate-400">
        <AlertCircle class="w-8 h-8 mx-auto text-amber-500 mb-2" />
        <p class="font-bold text-slate-700">No se encontraron repuestos con esas medidas exactas</p>
        <p class="text-xs text-slate-400 mt-1">Pruebe aumentando el rango de tolerancia en el selector superior (ej. ±1.0 mm).</p>
      </div>
    </div>

  </div>
</template>
