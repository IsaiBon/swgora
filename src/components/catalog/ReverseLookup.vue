<script setup lang="ts">
import { ref } from 'vue'
import { catalogService, type RepuestoTecnico, mockMotores } from '@/services/catalogService'
import { Search, Hash, Cpu, Copy, Check, Plus, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  initialQuery?: string
}>()

const emit = defineEmits<{
  (e: 'add-to-order', repuesto: RepuestoTecnico): void
  (e: 'toast', msg: string): void
}>()

const searchCode = ref(props.initialQuery || '')
const results = ref<RepuestoTecnico[]>([])
const isSearching = ref(false)
const hasSearched = ref(false)

const handleSearch = async () => {
  if (!searchCode.value.trim()) return
  isSearching.value = true
  hasSearched.value = true

  results.value = await catalogService.searchByCodeOrKeyword(searchCode.value)
  isSearching.value = false
}

// Búsqueda rápida con presets
const applyPreset = (code: string) => {
  searchCode.value = code
  handleSearch()
}

// Obtener nombre del motor compatible
const getEngineInfo = (motorId?: string): string => {
  if (!motorId) return 'Aplicación Universal / Rectificación'
  const mot = mockMotores.find(m => m.id === motorId)
  return mot ? `${mot.codigo} (${mot.nombre_comercial || mot.combustible})` : 'Motor de Taller'
}

// Copiar código
const copiedCode = ref<string | null>(null)
const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text)
  copiedCode.value = text
  emit('toast', `Copiado: ${text}`)
  setTimeout(() => {
    if (copiedCode.value === text) copiedCode.value = null
  }, 2000)
}
</script>

<template>
  <div class="space-y-5">
    
    <!-- Encabezado y Barra de Búsqueda Inversa -->
    <div class="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700/80 shadow-md">
      <div class="max-w-3xl">
        <span class="text-xs font-bold uppercase tracking-wider text-[#04c4d9] flex items-center gap-1.5 mb-1">
          <Hash class="w-3.5 h-3.5" />
          Búsqueda Inversa de Repuestos y Equivalencias
        </span>
        <h2 class="text-xl font-black text-white">Consulte cualquier código OEM o de Marca Alterna</h2>
        <p class="text-xs text-slate-400 mt-1">
          Ingrese un número de parte de Dokuro, Rik, NPR, NDC, Ajusa o código original de concesionario para descubrir sus medidas físicas y todos los motores compatibles.
        </p>

        <!-- Input de Búsqueda -->
        <div class="mt-4 flex flex-col sm:flex-row gap-2.5">
          <div class="relative flex-1">
            <input
              v-model="searchCode"
              type="text"
              @keyup.enter="handleSearch"
              placeholder="Ej. 28006, 21-2856, MS-1140A, 13711-54020, 10074200..."
              class="w-full pl-4 pr-10 py-3 text-sm bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-[#04c4d9] font-mono font-bold"
            />
          </div>

          <button
            type="button"
            @click="handleSearch"
            :disabled="isSearching"
            class="px-6 py-3 text-xs font-black text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0 min-h-[44px]"
          >
            <Search class="w-4 h-4" />
            <span>{{ isSearching ? 'Buscando...' : 'Buscar Código' }}</span>
          </button>
        </div>

        <!-- Presets Populares -->
        <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span>Consultas directas rápidas:</span>
          <button 
            type="button" 
            @click="applyPreset('28006')" 
            class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 font-mono text-[11px] font-bold"
          >
            Rik 28006
          </button>
          <button 
            type="button" 
            @click="applyPreset('21-2856')" 
            class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 font-mono text-[11px] font-bold"
          >
            Dokuro 21-2856
          </button>
          <button 
            type="button" 
            @click="applyPreset('MS-1140A')" 
            class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 font-mono text-[11px] font-bold"
          >
            NDC MS-1140A
          </button>
          <button 
            type="button" 
            @click="applyPreset('10074200')" 
            class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 font-mono text-[11px] font-bold"
          >
            Ajusa 10074200
          </button>
        </div>
      </div>
    </div>

    <!-- Resultados -->
    <div v-if="hasSearched" class="space-y-4">
      <div v-if="results.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="item in results"
          :key="item.id"
          class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition"
        >
          <div>
            <!-- Header de la pieza -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-50 text-cyan-800 border border-cyan-200">
                  {{ item.subsistema }} • {{ item.categoria }}
                </span>
                <h3 class="text-base font-bold text-slate-900 mt-1">{{ item.nombre }}</h3>
              </div>
              <div class="text-right">
                <span class="text-lg font-black text-slate-900">${{ item.precio.toFixed(2) }}</span>
                <span class="block text-[10px] text-emerald-600 font-semibold">{{ item.estado }}</span>
              </div>
            </div>

            <!-- Código OEM -->
            <div class="mt-3 p-2.5 bg-slate-50 rounded-xl flex items-center justify-between font-mono text-xs">
              <div>
                <span class="text-[10px] text-slate-400 block font-sans uppercase">Código Original OEM:</span>
                <strong class="text-slate-900 text-sm">{{ item.codigo_oem }}</strong>
              </div>
              <button
                type="button"
                @click="copyText(item.codigo_oem)"
                class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                title="Copiar código OEM"
              >
                <Check v-if="copiedCode === item.codigo_oem" class="w-4 h-4 text-emerald-600" />
                <Copy v-else class="w-4 h-4" />
              </button>
            </div>

            <!-- Matriz de Marcas Alternas Cruzadas -->
            <div class="mt-3">
              <span class="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Equivalencias Multimarca:</span>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="eq in item.equivalencias"
                  :key="eq.id"
                  class="p-2 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                >
                  <div>
                    <span class="text-[10px] text-slate-400 block">{{ eq.marca_alterna }}</span>
                    <strong class="font-mono text-slate-800">{{ eq.codigo_alterno }}</strong>
                  </div>
                  <button
                    type="button"
                    @click="copyText(eq.codigo_alterno)"
                    class="p-1 text-slate-400 hover:text-slate-700"
                    title="Copiar"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Dimensiones Físicas -->
            <div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <span class="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cotas Físicas Registradas:</span>
              <div v-if="item.diametro_cabeza_mm" class="font-mono text-xs text-slate-800">
                Cabeza: Ø{{ item.diametro_cabeza_mm }}mm | Vástago: Ø{{ item.diametro_vastago_mm }}mm | Longitud: {{ item.longitud_total_mm }}mm
              </div>
              <div v-else-if="item.diametro_cilindro_mm" class="font-mono text-xs text-slate-800">
                Cilindro: Ø{{ item.diametro_cilindro_mm }}mm | Ranuras: {{ item.espesor_anillo1_mm }}/{{ item.espesor_anillo2_mm }}/{{ item.espesor_aceite_mm }}mm
              </div>
              <div v-else-if="item.tipo_cojinete" class="font-mono text-xs text-slate-800">
                Cojinete NDC {{ item.tipo_cojinete }}: Muñón Ø{{ item.diametro_munon_mm }}mm | Ancho {{ item.ancho_casquete_mm }}mm
              </div>
              <div v-else class="text-slate-400 text-xs">Especificaciones estándar según catálogo OEM</div>
            </div>

            <!-- Motor Compatible -->
            <div class="mt-2.5 flex items-center gap-1.5 text-xs text-cyan-800 font-semibold bg-cyan-50/70 p-2 rounded-lg">
              <Cpu class="w-3.5 h-3.5 text-[#04c4d9]" />
              <span>Aplicación: {{ getEngineInfo(item.motor_id) }}</span>
            </div>
          </div>

          <!-- Botón de Acción -->
          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              @click="emit('add-to-order', item)"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-xl shadow-xs transition"
            >
              <Plus class="w-4 h-4" />
              <span>Agregar a Orden de Trabajo</span>
            </button>
          </div>
        </div>
      </div>

      <div v-else class="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400">
        <AlertCircle class="w-8 h-8 mx-auto text-amber-500 mb-2" />
        <h4 class="font-bold text-slate-700">No se encontraron piezas con el código ingresado</h4>
        <p class="text-xs text-slate-400 mt-1">Verifique el número de parte o intente buscar en el módulo de búsqueda vehicular.</p>
      </div>
    </div>

  </div>
</template>
