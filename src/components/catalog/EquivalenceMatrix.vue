<script setup lang="ts">
import { ref, computed } from 'vue'
import type { RepuestoTecnico } from '@/services/catalogService'
import { 
  Copy, 
  Check, 
  Plus, 
  Info
} from 'lucide-vue-next'

const props = defineProps<{
  repuestos: RepuestoTecnico[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'add-to-order', repuesto: RepuestoTecnico): void
  (e: 'toast', msg: string): void
}>()

// Filtro de subsistema activo
const selectedSubsystem = ref<string>('Todos')
const subsystems = ['Todos', 'Culata', 'Block', 'Cigüeñal', 'Bielas', 'Sellos y Juntas']

// Búsqueda rápida local dentro de la matriz
const localFilter = ref('')

const filteredRepuestos = computed(() => {
  let list = props.repuestos

  if (selectedSubsystem.value !== 'Todos') {
    list = list.filter(r => r.subsistema === selectedSubsystem.value)
  }

  if (localFilter.value.trim()) {
    const q = localFilter.value.toLowerCase().trim()
    list = list.filter(r => {
      const matchName = r.nombre.toLowerCase().includes(q)
      const matchOem = r.codigo_oem.toLowerCase().includes(q)
      const matchEquiv = r.equivalencias?.some(eq => 
        eq.codigo_alterno.toLowerCase().includes(q) ||
        eq.marca_alterna.toLowerCase().includes(q)
      )
      return matchName || matchOem || matchEquiv
    })
  }

  return list
})

// Helpers para extraer código de cada marca en la equivalencia
const getBrandCode = (repuesto: RepuestoTecnico, brand: string): string | null => {
  const eq = repuesto.equivalencias?.find(e => e.marca_alterna.toLowerCase() === brand.toLowerCase())
  return eq ? eq.codigo_alterno : null
}

// Portapapeles
const copiedCode = ref<string | null>(null)
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedCode.value = text
    emit('toast', `Copiado: ${label} (${text})`)
    setTimeout(() => {
      if (copiedCode.value === text) copiedCode.value = null
    }, 2000)
  } catch {
    emit('toast', `No se pudo copiar automáticamente`)
  }
}

// Copiar resumen de equivalencias completo para taller
const copyFullCross = async (rep: RepuestoTecnico) => {
  const lines: string[] = [
    `Pieza: ${rep.nombre} (${rep.subsistema})`,
    `OEM: ${rep.codigo_oem}`
  ]

  rep.equivalencias?.forEach(eq => {
    lines.push(`${eq.marca_alterna}: ${eq.codigo_alterno}${eq.notas ? ` (${eq.notas})` : ''}`)
  })

  // Agregar medidas físicas si existen
  if (rep.diametro_cabeza_mm) lines.push(`Medidas: Cab Ø${rep.diametro_cabeza_mm}mm | Vást Ø${rep.diametro_vastago_mm}mm | Long ${rep.longitud_total_mm}mm`)
  if (rep.diametro_cilindro_mm) lines.push(`Medidas: Cil Ø${rep.diametro_cilindro_mm}mm | Anillos ${rep.espesor_anillo1_mm}/${rep.espesor_anillo2_mm}/${rep.espesor_aceite_mm}mm`)
  if (rep.tipo_cojinete) lines.push(`Cojinete NDC ${rep.tipo_cojinete}: Muñón Ø${rep.diametro_munon_mm || '-'}mm`)

  await copyToClipboard(lines.join(' | '), 'Matriz de equivalencias')
}

</script>

<template>
  <div class="space-y-4">
    
    <!-- Barra de Filtros por Subsistema Mecánico del Motor -->
    <div class="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
      <!-- Pills de Subsistemas -->
      <div class="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
        <button
          v-for="sub in subsystems"
          :key="sub"
          type="button"
          @click="selectedSubsystem = sub"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition min-h-[36px]',
            selectedSubsystem === sub
              ? 'bg-[#04c4d9] text-white shadow-xs'
              : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
          ]"
        >
          {{ sub }}
        </button>
      </div>

      <!-- Buscador rápido local en la tabla -->
      <div class="w-full sm:w-64">
        <input
          v-model="localFilter"
          type="text"
          placeholder="Filtrar por código o pieza..."
          class="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9]"
        />
      </div>
    </div>

    <!-- Tabla Técnica Multimarca (Estilo Catálogo TecDoc / Ajusa) -->
    <div class="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs min-w-[1100px]">
          <thead class="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600 sticky top-0 z-10">
            <tr>
              <th class="px-4 py-3 min-w-[200px]">Componente / Subsistema</th>
              <th class="px-4 py-3 min-w-[130px] text-cyan-800 bg-cyan-50/50">Código OEM</th>
              <th class="px-3 py-3 min-w-[100px] text-slate-700">Dokuro</th>
              <th class="px-3 py-3 min-w-[90px] text-slate-700">Rik</th>
              <th class="px-3 py-3 min-w-[110px] text-slate-700">NPR</th>
              <th class="px-3 py-3 min-w-[110px] text-slate-700">NDC (Japón)</th>
              <th class="px-3 py-3 min-w-[100px] text-slate-700">Ajusa</th>
              <th class="px-3 py-3 min-w-[110px] text-slate-700">Pioneer / Taiho</th>
              <th class="px-4 py-3 min-w-[220px]">Medidas Clave (mm)</th>
              <th class="px-3 py-3 text-right min-w-[80px]">Precio ($)</th>
              <th class="px-4 py-3 text-center min-w-[120px]">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="rep in filteredRepuestos"
              :key="rep.id"
              class="hover:bg-cyan-50/30 transition group"
            >
              
              <!-- 1. Componente & Subsistema -->
              <td class="px-4 py-3">
                <div class="font-bold text-slate-900 group-hover:text-cyan-700 transition">
                  {{ rep.nombre }}
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    {{ rep.subsistema }}
                  </span>
                  <span class="text-[10px] text-slate-400">
                    {{ rep.categoria }}
                  </span>
                </div>
              </td>

              <!-- 2. Código OEM con botón de copia -->
              <td class="px-4 py-3 bg-cyan-50/20 font-black text-cyan-900 font-mono">
                <div class="flex items-center justify-between gap-1">
                  <span>{{ rep.codigo_oem }}</span>
                  <button
                    type="button"
                    @click="copyToClipboard(rep.codigo_oem, 'OEM')"
                    class="p-1 text-slate-400 hover:text-cyan-700 hover:bg-cyan-100 rounded transition"
                    title="Copiar código OEM"
                  >
                    <Check v-if="copiedCode === rep.codigo_oem" class="w-3.5 h-3.5 text-emerald-600" />
                    <Copy v-else class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>

              <!-- 3. Dokuro (Válvulas) -->
              <td class="px-3 py-3 font-mono">
                <div v-if="getBrandCode(rep, 'Dokuro')" class="flex items-center justify-between gap-1">
                  <span class="font-bold text-slate-800">{{ getBrandCode(rep, 'Dokuro') }}</span>
                  <button
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Dokuro')!, 'Dokuro')"
                    class="p-0.5 text-slate-300 hover:text-slate-600"
                    title="Copiar Dokuro"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- 4. Rik (Anillos) -->
              <td class="px-3 py-3 font-mono">
                <div v-if="getBrandCode(rep, 'Rik')" class="flex items-center justify-between gap-1">
                  <span class="font-bold text-indigo-700">{{ getBrandCode(rep, 'Rik') }}</span>
                  <button
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Rik')!, 'Rik')"
                    class="p-0.5 text-slate-300 hover:text-slate-600"
                    title="Copiar Rik"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- 5. NPR (Anillos) -->
              <td class="px-3 py-3 font-mono">
                <div v-if="getBrandCode(rep, 'NPR')" class="flex items-center justify-between gap-1">
                  <span class="font-bold text-slate-800">{{ getBrandCode(rep, 'NPR') }}</span>
                  <button
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'NPR')!, 'NPR')"
                    class="p-0.5 text-slate-300 hover:text-slate-600"
                    title="Copiar NPR"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- 6. NDC (Cojinetes Bancada, Biela, Axial) -->
              <td class="px-3 py-3 font-mono">
                <div v-if="getBrandCode(rep, 'NDC')" class="space-y-0.5">
                  <div class="flex items-center justify-between gap-1">
                    <span class="font-black text-rose-700">{{ getBrandCode(rep, 'NDC') }}</span>
                    <button
                      type="button"
                      @click="copyToClipboard(getBrandCode(rep, 'NDC')!, 'NDC')"
                      class="p-0.5 text-slate-300 hover:text-slate-600"
                      title="Copiar NDC"
                    >
                      <Copy class="w-3 h-3" />
                    </button>
                  </div>
                  <span 
                    v-if="rep.tipo_cojinete" 
                    class="inline-block px-1 rounded text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200"
                  >
                    Tipo {{ rep.tipo_cojinete }}
                  </span>
                </div>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- 7. Ajusa (Juntas / Tornillos) -->
              <td class="px-3 py-3 font-mono">
                <div v-if="getBrandCode(rep, 'Ajusa')" class="flex items-center justify-between gap-1">
                  <span class="font-bold text-slate-800">{{ getBrandCode(rep, 'Ajusa') }}</span>
                  <button
                    type="button"
                    @click="copyToClipboard(getBrandCode(rep, 'Ajusa')!, 'Ajusa')"
                    class="p-0.5 text-slate-300 hover:text-slate-600"
                    title="Copiar Ajusa"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- 8. Pioneer / Taiho -->
              <td class="px-3 py-3 font-mono">
                <div v-if="getBrandCode(rep, 'Taiho') || getBrandCode(rep, 'Pioneer')" class="space-y-0.5">
                  <div v-if="getBrandCode(rep, 'Taiho')" class="text-slate-700">
                    <span class="text-[9px] text-slate-400 font-sans">Taiho: </span>
                    <strong class="font-black">{{ getBrandCode(rep, 'Taiho') }}</strong>
                  </div>
                  <div v-if="getBrandCode(rep, 'Pioneer')" class="text-slate-700">
                    <span class="text-[9px] text-slate-400 font-sans">Pioneer: </span>
                    <strong class="font-black">{{ getBrandCode(rep, 'Pioneer') }}</strong>
                  </div>
                </div>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- 9. Medidas Clave en mm -->
              <td class="px-4 py-3">
                <!-- Válvulas -->
                <div v-if="rep.diametro_cabeza_mm" class="flex flex-wrap gap-1 text-[10px]">
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Cab: <strong>Ø{{ rep.diametro_cabeza_mm.toFixed(1) }}</strong>
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Vást: <strong>Ø{{ rep.diametro_vastago_mm?.toFixed(1) }}</strong>
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Long: <strong>{{ rep.longitud_total_mm?.toFixed(1) }}mm</strong>
                  </span>
                </div>

                <!-- Anillos -->
                <div v-else-if="rep.diametro_cilindro_mm && rep.categoria === 'Anillos'" class="flex flex-wrap gap-1 text-[10px]">
                  <span class="px-1.5 py-0.5 rounded bg-indigo-50 font-mono text-indigo-800 border border-indigo-200">
                    Ø Cilindro: <strong>{{ rep.diametro_cilindro_mm.toFixed(2) }} mm</strong>
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Ranuras: <strong>{{ rep.espesor_anillo1_mm }}/{{ rep.espesor_anillo2_mm }}/{{ rep.espesor_aceite_mm }} mm</strong>
                  </span>
                </div>

                <!-- Cojinetes -->
                <div v-else-if="rep.tipo_cojinete" class="flex flex-wrap gap-1 text-[10px]">
                  <span v-if="rep.diametro_munon_mm" class="px-1.5 py-0.5 rounded bg-rose-50 font-mono text-rose-800 border border-rose-200">
                    Muñón: <strong>Ø{{ rep.diametro_munon_mm.toFixed(1) }} mm</strong>
                  </span>
                  <span v-if="rep.ancho_casquete_mm" class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Ancho: <strong>{{ rep.ancho_casquete_mm.toFixed(1) }} mm</strong>
                  </span>
                </div>

                <!-- Empaques / Sellos / Otros -->
                <div v-else-if="rep.dimensiones" class="flex flex-wrap gap-1 text-[10px]">
                  <span v-if="rep.dimensiones.espesor_mm" class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Espesor: <strong>{{ rep.dimensiones.espesor_mm }} mm</strong>
                  </span>
                  <span v-if="rep.dimensiones.diametro_interior_mm" class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Medida: <strong>{{ rep.dimensiones.diametro_interior_mm }}x{{ rep.dimensiones.diametro_exterior_mm }}x{{ rep.dimensiones.altura_mm }} mm</strong>
                  </span>
                  <span v-if="rep.dimensiones.rosca" class="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    Rosca: <strong>{{ rep.dimensiones.rosca }} L={{ rep.longitud_total_mm }}mm</strong>
                  </span>
                </div>

                <span v-else class="text-slate-300 text-[10px]">—</span>
              </td>

              <!-- 10. Precio -->
              <td class="px-3 py-3 text-right font-black text-slate-900">
                ${{ rep.precio.toFixed(2) }}
              </td>

              <!-- 11. Acciones -->
              <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    @click="copyFullCross(rep)"
                    class="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    title="Copiar toda la matriz de equivalencias"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    @click="emit('add-to-order', rep)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] rounded-lg shadow-xs transition"
                    title="Agregar a Orden de Trabajo"
                  >
                    <Plus class="w-3 h-3" />
                    <span>Agregar</span>
                  </button>
                </div>
              </td>

            </tr>

            <tr v-if="filteredRepuestos.length === 0">
              <td colspan="11" class="px-4 py-8 text-center text-slate-400">
                <Info class="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                No se encontraron repuestos para el subsistema o filtro seleccionado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
