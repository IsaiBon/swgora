<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  catalogService, 
  type Motor, 
  type RepuestoTecnico, 
  mockMotores,
  mockRepuestos
} from '@/services/catalogService'
import { 
  Search, 
  X, 
  Ruler, 
  Copy, 
  Check, 
  Plus, 
  RotateCcw,
  CheckCircle2,
  Info
} from 'lucide-vue-next'

// Estado principal
const searchCode = ref('')
const selectedMotorId = ref<string>('mot-1') // Toyota 3L por defecto
const selectedSubsystem = ref<string>('Todos')
const subsystems = ['Todos', 'Culata', 'Cigüeñal', 'Block', 'Bielas', 'Sellos y Juntas']

// Motores y repuestos
const motores = ref<Motor[]>(mockMotores)
const allRepuestos = ref<RepuestoTecnico[]>(mockRepuestos)

// Búsqueda dimensional compacta (toggle)
const showDimensional = ref(false)
const dimCategory = ref<'Válvulas' | 'Anillos' | 'Casquetería' | 'Sellos'>('Válvulas')
const dimHead = ref<number | undefined>(undefined)
const dimStem = ref<number | undefined>(undefined)
const dimLength = ref<number | undefined>(undefined)
const dimBore = ref<number | undefined>(undefined)
const dimRing1 = ref<number | undefined>(undefined)
const dimJournal = ref<number | undefined>(undefined)
const dimTolerance = ref<number>(0.5)

// Portapapeles y notificaciones
const copiedCode = ref<string | null>(null)
const toastMessage = ref<string | null>(null)
let toastTimeout: ReturnType<typeof setTimeout> | null = null

const showToast = (msg: string) => {
  if (toastTimeout) clearTimeout(toastTimeout)
  toastMessage.value = msg
  toastTimeout = setTimeout(() => {
    toastMessage.value = null
  }, 2200)
}

const copyToClipboard = async (code: string, brand?: string) => {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = code
    showToast(`Copiado: ${brand ? `${brand} ` : ''}${code}`)
    setTimeout(() => {
      if (copiedCode.value === code) copiedCode.value = null
    }, 1800)
  } catch {
    showToast(`Código: ${code}`)
  }
}

// Carga inicial de datos
onMounted(async () => {
  try {
    const remoteMotores = await catalogService.getMotores()
    if (remoteMotores.length > 0) motores.value = remoteMotores

    const remoteRepuestos = await catalogService.getRepuestosByMotor(selectedMotorId.value)
    if (remoteRepuestos.length > 0) {
      allRepuestos.value = mockRepuestos
    }
  } catch {
    // Fallback reactivo ya asignado
  }
})

// Motor activo seleccionado
const currentMotor = computed(() => {
  if (selectedMotorId.value === 'todos') return null
  return motores.value.find(m => m.id === selectedMotorId.value) || null
})

// Lista filtrada de repuestos
const filteredRepuestos = computed(() => {
  let list = allRepuestos.value

  // 1. Filtro por código de parte si hay texto en el input superior
  const q = searchCode.value.trim().toLowerCase().replace(/[-\s]/g, '')
  if (q) {
    return list.filter(r => {
      const matchOem = r.codigo_oem.toLowerCase().replace(/[-\s]/g, '').includes(q)
      const matchName = r.nombre.toLowerCase().includes(searchCode.value.toLowerCase())
      const matchEquiv = r.equivalencias?.some(eq =>
        eq.codigo_alterno.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
        eq.marca_alterna.toLowerCase().includes(q)
      )
      return matchOem || matchName || matchEquiv
    })
  }

  // 2. Filtro por motor seleccionado (si no es 'todos')
  if (selectedMotorId.value !== 'todos') {
    list = list.filter(r => r.motor_id === selectedMotorId.value)
  }

  // 3. Filtro por subsistema mecánico
  if (selectedSubsystem.value !== 'Todos') {
    list = list.filter(r => r.subsistema === selectedSubsystem.value)
  }

  // 4. Filtro dimensional si el panel está desplegado y tiene cotas
  if (showDimensional.value) {
    const tol = dimTolerance.value
    list = list.filter(r => {
      if (dimCategory.value === 'Válvulas' && r.categoria === 'Válvulas') {
        if (dimHead.value && r.diametro_cabeza_mm && Math.abs(r.diametro_cabeza_mm - dimHead.value) > tol) return false
        if (dimStem.value && r.diametro_vastago_mm && Math.abs(r.diametro_vastago_mm - dimStem.value) > 0.1) return false
        if (dimLength.value && r.longitud_total_mm && Math.abs(r.longitud_total_mm - dimLength.value) > (tol * 2)) return false
        return true
      }
      if (dimCategory.value === 'Anillos' && r.categoria === 'Anillos') {
        if (dimBore.value && r.diametro_cilindro_mm && Math.abs(r.diametro_cilindro_mm - dimBore.value) > tol) return false
        if (dimRing1.value && r.espesor_anillo1_mm && Math.abs(r.espesor_anillo1_mm - dimRing1.value) > 0.15) return false
        return true
      }
      if (dimCategory.value === 'Casquetería' && r.categoria === 'Casquetería') {
        if (dimJournal.value && r.diametro_munon_mm && Math.abs(r.diametro_munon_mm - dimJournal.value) > tol) return false
        return true
      }
      return true
    })
  }

  return list
})

// Helper para obtener código de marca en la matriz
const getBrandCode = (repuesto: RepuestoTecnico, brand: string): string | null => {
  const eq = repuesto.equivalencias?.find(e => e.marca_alterna.toLowerCase() === brand.toLowerCase())
  return eq ? eq.codigo_alterno : null
}

// Helper para obtener el nombre del motor al buscar por código libre
const getMotorName = (motorId?: string): string => {
  if (!motorId) return 'Universal'
  const mot = motores.value.find(m => m.id === motorId)
  return mot ? mot.codigo : 'Taller'
}

// Limpiar filtros dimensionales
const resetDimensions = () => {
  dimHead.value = undefined
  dimStem.value = undefined
  dimLength.value = undefined
  dimBore.value = undefined
  dimRing1.value = undefined
  dimJournal.value = undefined
}
</script>

<template>
  <div class="space-y-3 pb-8">
    
    <!-- Toast Flotante de Notificación -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-3 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-3 opacity-0"
    >
      <div 
        v-if="toastMessage" 
        class="fixed bottom-5 right-5 z-50 bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 text-xs font-bold"
      >
        <CheckCircle2 class="w-4 h-4 text-[#04c4d9]" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- 1. BARRA SUPERIOR COMPACTA: BÚSQUEDA EXCLUSIVA POR CÓDIGO DE PIEZA + SELECTOR DE MOTOR -->
    <div class="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5">
      
      <!-- Buscador Central por Código de Pieza -->
      <div class="relative flex-1 w-full">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search class="w-4 h-4 text-[#04c4d9]" />
        </div>
        <input
          v-model="searchCode"
          type="text"
          placeholder="Buscar por código de pieza (OEM, Dokuro, Rik, NPR, NDC, Ajusa, Pioneer...)"
          class="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 font-mono font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] focus:border-transparent transition"
        />
        <button
          v-if="searchCode"
          @click="searchCode = ''"
          type="button"
          class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
          title="Limpiar búsqueda"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Filtro Directo de Motor y Botón Dimensional -->
      <div class="flex items-center gap-2 w-full md:w-auto shrink-0">
        <select
          v-model="selectedMotorId"
          class="flex-1 md:flex-none px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] cursor-pointer"
        >
          <option value="todos">Todos los Motores</option>
          <option v-for="mot in motores" :key="mot.id" :value="mot.id">
            {{ mot.codigo }} ({{ mot.combustible }})
          </option>
        </select>

        <button
          type="button"
          @click="showDimensional = !showDimensional"
          :class="[
            'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition whitespace-nowrap',
            showDimensional
              ? 'bg-[#04c4d9] text-white border-[#04c4d9] shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          ]"
        >
          <Ruler class="w-3.5 h-3.5" />
          <span>Medidas (mm)</span>
        </button>
      </div>

    </div>

    <!-- 2. PANEL COMPACTO DE MEDIDAS (SOLO SI SE ACTIVA) -->
    <div v-if="showDimensional" class="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-[#04c4d9] uppercase text-[10px] tracking-wider">Búsqueda por Medidas:</span>
          <div class="flex items-center gap-1">
            <button
              v-for="cat in (['Válvulas', 'Anillos', 'Casquetería', 'Sellos'] as const)"
              :key="cat"
              type="button"
              @click="dimCategory = cat"
              :class="[
                'px-2 py-0.5 rounded text-[11px] font-bold transition',
                dimCategory === cat ? 'bg-[#04c4d9] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              ]"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="resetDimensions"
            class="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RotateCcw class="w-3 h-3" /> Limpiar
          </button>
          <button @click="showDimensional = false" class="text-slate-400 hover:text-white text-xs px-1">✕</button>
        </div>
      </div>

      <!-- Inputs en 1 sola fila compacta -->
      <div v-if="dimCategory === 'Válvulas'" class="grid grid-cols-3 gap-2">
        <input v-model.number="dimHead" type="number" step="0.1" placeholder="Cabeza Ø (ej. 42.5)" class="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-[#04c4d9]" />
        <input v-model.number="dimStem" type="number" step="0.05" placeholder="Vástago Ø (ej. 8.0)" class="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-[#04c4d9]" />
        <input v-model.number="dimLength" type="number" step="0.1" placeholder="Largo mm (ej. 103.5)" class="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-[#04c4d9]" />
      </div>

      <div v-else-if="dimCategory === 'Anillos'" class="grid grid-cols-2 gap-2">
        <input v-model.number="dimBore" type="number" step="0.1" placeholder="Diámetro Cilindro Ø (ej. 96.0)" class="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-[#04c4d9]" />
        <input v-model.number="dimRing1" type="number" step="0.05" placeholder="Espesor 1er Anillo (ej. 2.0)" class="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-[#04c4d9]" />
      </div>

      <div v-else-if="dimCategory === 'Casquetería'" class="grid grid-cols-1 gap-2">
        <input v-model.number="dimJournal" type="number" step="0.1" placeholder="Diámetro Muñón Ø mm (ej. 62.0 o 53.0)" class="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-[#04c4d9]" />
      </div>

      <div v-else class="grid grid-cols-1 gap-2">
        <input v-model.number="dimStem" type="number" step="0.1" placeholder="Diámetro Interior Sello / Vástago (ej. 8.0)" class="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-[#04c4d9]" />
      </div>
    </div>

    <!-- 3. BARRA DE SUBSISTEMAS Y FICHA RÁPIDA AGRUPADA -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
      
      <!-- Pastillas de Subsistemas -->
      <div class="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
        <button
          v-for="sub in subsystems"
          :key="sub"
          type="button"
          @click="selectedSubsystem = sub"
          :class="[
            'px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition',
            selectedSubsystem === sub
              ? 'bg-[#04c4d9] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          ]"
        >
          {{ sub }}
        </button>
      </div>

      <!-- Ficha de Motor Sutil (Solo texto informativo sin banners pesados) -->
      <div v-if="currentMotor" class="text-[11px] text-slate-500 flex items-center gap-1.5 shrink-0">
        <span class="font-bold text-slate-800">Motor {{ currentMotor.codigo }}:</span>
        <span>{{ currentMotor.nombre_comercial }}</span>
        <span v-if="currentMotor.diametro_cilindro_std_mm" class="font-mono text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded font-bold">
          Ø{{ currentMotor.diametro_cilindro_std_mm.toFixed(2) }}mm
        </span>
      </div>
      <div v-else class="text-[11px] text-slate-400">
        Mostrando repuestos de todos los motores
      </div>

    </div>

    <!-- 4. TABLA UNIFICADA DE EQUIVALENCIAS Y MEDIDAS (COMPACTA Y DE ALTA DENSIDAD) -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs min-w-[950px]">
          <thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 sticky top-0">
            <tr>
              <th class="px-3.5 py-2.5 min-w-[190px]">Pieza / Subsistema</th>
              <th class="px-3 py-2.5 min-w-[120px] bg-cyan-50/50 text-cyan-900">Código OEM</th>
              <th class="px-3 py-2.5 min-w-[320px]">Cruces Multimarca (Dokuro / Rik / NPR / NDC / Ajusa)</th>
              <th class="px-3 py-2.5 min-w-[180px]">Medidas (mm)</th>
              <th class="px-3 py-2.5 text-right min-w-[80px]">Precio ($)</th>
              <th class="px-3 py-2.5 text-center min-w-[80px]">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="rep in filteredRepuestos"
              :key="rep.id"
              class="hover:bg-cyan-50/20 transition group"
            >
              
              <!-- 1. Pieza y Subsistema -->
              <td class="px-3.5 py-2">
                <div class="font-bold text-slate-900 group-hover:text-cyan-700 transition leading-tight">
                  {{ rep.nombre }}
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span class="font-semibold text-slate-600">{{ rep.subsistema }}</span>
                  <span>•</span>
                  <span class="text-cyan-700 font-mono font-bold">{{ getMotorName(rep.motor_id) }}</span>
                </div>
              </td>

              <!-- 2. Código OEM -->
              <td class="px-3 py-2 bg-cyan-50/20 font-mono font-black text-cyan-950">
                <button
                  type="button"
                  @click="copyToClipboard(rep.codigo_oem, 'OEM')"
                  class="inline-flex items-center gap-1 text-left hover:text-cyan-700 transition"
                  title="Copiar OEM"
                >
                  <span>{{ rep.codigo_oem }}</span>
                  <Check v-if="copiedCode === rep.codigo_oem" class="w-3 h-3 text-emerald-600 inline" />
                  <Copy v-else class="w-3 h-3 text-slate-300 group-hover:text-slate-400 inline" />
                </button>
              </td>

              <!-- 3. Cruces Multimarca (Pastillas compactas en 1 sola celda) -->
              <td class="px-3 py-2">
                <div class="flex flex-wrap items-center gap-1.5">
                  <!-- Dokuro -->
                  <button
                    v-if="getBrandCode(rep, 'Dokuro')"
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Dokuro')!, 'Dokuro')"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                    title="Copiar código Dokuro"
                  >
                    <span class="text-[9px] text-slate-400 font-sans">Dok:</span> <strong>{{ getBrandCode(rep, 'Dokuro') }}</strong>
                  </button>

                  <!-- Rik -->
                  <button
                    v-if="getBrandCode(rep, 'Rik')"
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Rik')!, 'Rik')"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition"
                    title="Copiar código Rik"
                  >
                    <span class="text-[9px] text-indigo-500 font-sans">Rik:</span> <strong>{{ getBrandCode(rep, 'Rik') }}</strong>
                  </button>

                  <!-- NPR -->
                  <button
                    v-if="getBrandCode(rep, 'NPR')"
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'NPR')!, 'NPR')"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                    title="Copiar código NPR"
                  >
                    <span class="text-[9px] text-slate-400 font-sans">NPR:</span> <strong>{{ getBrandCode(rep, 'NPR') }}</strong>
                  </button>

                  <!-- NDC -->
                  <button
                    v-if="getBrandCode(rep, 'NDC')"
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'NDC')!, 'NDC')"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 transition"
                    title="Copiar código NDC"
                  >
                    <span class="text-[9px] text-rose-500 font-sans">NDC:</span> <strong>{{ getBrandCode(rep, 'NDC') }}</strong>
                    <span v-if="rep.tipo_cojinete" class="ml-1 text-[9px] text-rose-600 font-bold">({{ rep.tipo_cojinete }})</span>
                  </button>

                  <!-- Ajusa -->
                  <button
                    v-if="getBrandCode(rep, 'Ajusa')"
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Ajusa')!, 'Ajusa')"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                    title="Copiar código Ajusa"
                  >
                    <span class="text-[9px] text-slate-400 font-sans">Aju:</span> <strong>{{ getBrandCode(rep, 'Ajusa') }}</strong>
                  </button>

                  <!-- Taiho / Pioneer -->
                  <button
                    v-if="getBrandCode(rep, 'Taiho')"
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Taiho')!, 'Taiho')"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                  >
                    <span class="text-[9px] text-slate-400 font-sans">Taiho:</span> <strong>{{ getBrandCode(rep, 'Taiho') }}</strong>
                  </button>

                  <button
                    v-if="getBrandCode(rep, 'Pioneer')"
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Pioneer')!, 'Pioneer')"
                    class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                  >
                    <span class="text-[9px] text-slate-400 font-sans">Pioneer:</span> <strong>{{ getBrandCode(rep, 'Pioneer') }}</strong>
                  </button>
                </div>
              </td>

              <!-- 4. Medidas Clave (mm) -->
              <td class="px-3 py-2 font-mono text-[11px] text-slate-700">
                <span v-if="rep.diametro_cabeza_mm">
                  Cab Ø<strong>{{ rep.diametro_cabeza_mm }}</strong> • Vást Ø<strong>{{ rep.diametro_vastago_mm }}</strong> • L<strong>{{ rep.longitud_total_mm }}</strong>
                </span>
                <span v-else-if="rep.diametro_cilindro_mm">
                  Ø<strong>{{ rep.diametro_cilindro_mm }}</strong> • <strong>{{ rep.espesor_anillo1_mm }}/{{ rep.espesor_anillo2_mm }}/{{ rep.espesor_aceite_mm }}</strong>
                </span>
                <span v-else-if="rep.tipo_cojinete">
                  {{ rep.tipo_cojinete }} • Muñón Ø<strong>{{ rep.diametro_munon_mm || '-' }}</strong> • Ancho <strong>{{ rep.ancho_casquete_mm || '-' }}</strong>
                </span>
                <span v-else-if="rep.dimensiones?.espesor_mm">
                  Espesor <strong>{{ rep.dimensiones.espesor_mm }} mm</strong>
                </span>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- 5. Precio -->
              <td class="px-3 py-2 text-right font-black text-slate-900">
                ${{ rep.precio.toFixed(2) }}
              </td>

              <!-- 6. Acción rápida -->
              <td class="px-3 py-2 text-center">
                <button
                  type="button"
                  @click="showToast(`Agregado a la orden: ${rep.codigo_oem} (${rep.nombre})`)"
                  class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-md transition shadow-2xs"
                  title="Agregar a cotización u orden"
                >
                  <Plus class="w-3 h-3" />
                  <span>Agregar</span>
                </button>
              </td>

            </tr>

            <!-- Estado Vacío -->
            <tr v-if="filteredRepuestos.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-slate-400">
                <Info class="w-5 h-5 mx-auto mb-1 text-slate-300" />
                <span class="text-xs">No se encontraron piezas con ese código o medida.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>
