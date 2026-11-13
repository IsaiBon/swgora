<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTallerStore } from '@/stores/taller'
import {
  Building2,
  Phone,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  FileText,
  Upload,
  Image as ImageIcon,
  Trash2
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const tallerStore = useTallerStore()

// Archivo de logo pendiente de guardar
const pendingLogoFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Validación de permisos: Administrador o Taller Independiente
onMounted(async () => {
  if (!authStore.canAccess('/taller')) {
    router.replace(authStore.defaultRoute)
    return
  }

  await tallerStore.loadTallerInfo(true)
  resetForm()
})

const form = reactive({
  nombre: '',
  direccion: '',
  celular1: '',
  celular2: '',
  eslogan: '',
  logo_url: '/logo-taller.png',
  iva_porcentaje: 13
})

const isSaving = ref(false)
const toastMessage = ref<{ text: string; type: 'success' | 'error' } | null>(null)
let toastTimeout: any = null

const showToast = (text: string, type: 'success' | 'error' = 'success') => {
  if (toastTimeout) clearTimeout(toastTimeout)
  toastMessage.value = { text, type }
  toastTimeout = setTimeout(() => {
    toastMessage.value = null
  }, 4000)
}

const resetForm = () => {
  const current = tallerStore.tallerInfo
  form.nombre = current.nombre || ''
  form.direccion = current.direccion || ''
  form.celular1 = current.celular1 || ''
  form.celular2 = current.celular2 || ''
  form.eslogan = current.eslogan || ''
  form.logo_url = current.logo_url || '/logo-taller.png'
  form.iva_porcentaje = current.iva_porcentaje !== undefined ? Number(current.iva_porcentaje) : 13
  pendingLogoFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// Manejador de selección de nuevo logo
const handleLogoSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Validar tamaño máximo (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('El archivo es demasiado grande. El límite máximo es 5MB.', 'error')
    target.value = ''
    return
  }

  // Previsualizar inmediatamente en vivo
  pendingLogoFile.value = file
  const reader = new FileReader()
  reader.onload = () => {
    form.logo_url = reader.result as string
    showToast('Nuevo logotipo previsualizado. Haz clic en "Guardar Cambios" para aplicarlo.', 'success')
  }
  reader.readAsDataURL(file)
}

// Restablecer al logo oficial predeterminado
const resetToDefaultLogo = () => {
  form.logo_url = '/logo-taller.png'
  pendingLogoFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  showToast('Se restableció el logotipo al predeterminado del taller.', 'success')
}

const handleSubmit = async () => {
  if (!form.nombre.trim()) {
    showToast('El nombre del taller es obligatorio.', 'error')
    return
  }
  if (!form.direccion.trim()) {
    showToast('La dirección del taller es obligatoria.', 'error')
    return
  }
  if (!form.celular1.trim()) {
    showToast('El Celular 1 es obligatorio.', 'error')
    return
  }

  isSaving.value = true
  try {
    let finalLogoUrl = form.logo_url

    // Si hay un archivo nuevo seleccionado, subirlo a Supabase Storage
    if (pendingLogoFile.value) {
      try {
        finalLogoUrl = await tallerStore.uploadLogo(pendingLogoFile.value)
      } catch (uploadErr) {
        console.warn('Fallo subiendo archivo a Storage, usando Data URL local:', uploadErr)
      }
    }

    await tallerStore.updateTaller({
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      celular1: form.celular1.trim(),
      celular2: form.celular2.trim(),
      eslogan: form.eslogan.trim(),
      logo_url: finalLogoUrl,
      iva_porcentaje: Number(form.iva_porcentaje)
    })

    form.logo_url = finalLogoUrl
    pendingLogoFile.value = null
    showToast('Información y logotipo del taller actualizados en Supabase exitosamente.', 'success')
  } catch (err: any) {
    console.error('Error al guardar datos del taller:', err)
    showToast('Ocurrió un error al guardar los cambios en Supabase.', 'error')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Encabezado de Página -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
            <Building2 class="w-3 h-3 text-cyan-700" />
            Configuración Institucional
          </span>
          <span class="text-[11px] font-semibold text-slate-400">Exclusivo Administrador</span>
        </div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          Módulo de Taller
        </h1>
        <p class="text-xs text-slate-500 mt-1 max-w-2xl">
          Administra el logotipo y datos institucionales de la empresa rectificadora. Esta información se consulta y refleja automáticamente en los encabezados, membretes y totales de las órdenes de trabajo, cotizaciones y archivos PDF generados.
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="resetForm"
          :disabled="isSaving"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-xl shadow-xs transition disabled:opacity-50"
          title="Deshacer cambios no guardados"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          Restablecer
        </button>

        <button
          type="button"
          @click="handleSubmit"
          :disabled="isSaving"
          class="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] active:bg-[#0296a6] rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <Save class="w-4 h-4" />
          <span>{{ isSaving ? 'Guardando...' : 'Guardar Cambios' }}</span>
        </button>
      </div>
    </div>

    <!-- Layout en 2 Columnas: Formulario + Vista Previa en Vivo -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- Columna Izquierda: Formulario de Edición (7 cols) -->
      <div class="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div class="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-[#04c4d9]">
              <Building2 class="w-4 h-4" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-slate-900">Datos Generales y Logotipo</h2>
              <p class="text-[11px] text-slate-400">Información sincronizada en la base de datos de Supabase</p>
            </div>
          </div>
        </div>

        <!-- SECCIÓN DE LOGOTIPO -->
        <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4.5 space-y-3">
          <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon class="w-4 h-4 text-[#04c4d9]" />
            Logotipo del Taller
          </label>

          <div class="flex flex-col sm:flex-row items-center gap-4">
            <!-- Contenedor del Logo Actual -->
            <div class="w-24 h-24 shrink-0 rounded-2xl bg-white border-2 border-slate-200 p-2 shadow-xs flex items-center justify-center overflow-hidden">
              <img
                :src="form.logo_url || '/logo-taller.png'"
                alt="Vista previa de logo"
                class="max-w-full max-h-full object-contain"
                @error="(e: any) => e.target.src = '/logo-taller.png'"
              />
            </div>

            <!-- Botones de Acción de Logo -->
            <div class="flex-1 space-y-2 text-center sm:text-left">
              <div class="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  class="hidden"
                  @change="handleLogoSelect"
                />
                
                <button
                  type="button"
                  @click="fileInputRef?.click()"
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 rounded-xl shadow-xs transition"
                >
                  <Upload class="w-3.5 h-3.5 text-cyan-400" />
                  Cambiar Logotipo
                </button>

                <button
                  v-if="form.logo_url !== '/logo-taller.png'"
                  type="button"
                  @click="resetToDefaultLogo"
                  class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition"
                  title="Volver al logo inicial"
                >
                  <Trash2 class="w-3.5 h-3.5 text-rose-500" />
                  Restablecer
                </button>
              </div>

              <p class="text-[10.5px] text-slate-500 leading-relaxed">
                Admite archivos <strong>PNG, JPG, SVG o WebP</strong> (máx. 5 MB). Se recomienda una imagen cuadrada con fondo transparente para máxima fidelidad en el PDF impreso.
              </p>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- 1. Nombre del Taller -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nombre del Taller / Razón Social <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model="form.nombre"
                type="text"
                required
                placeholder="Ej. TALLER INDUSTRIAL Y RECTIFICADO DE MOTORES"
                class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>
            <p class="text-[10.5px] text-slate-400 mt-1">
              Aparecerá como título principal en mayúsculas en el membrete del documento PDF.
            </p>
          </div>

          <!-- 2. Dirección -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Dirección Completa <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <textarea
                v-model="form.direccion"
                rows="2"
                required
                placeholder="Ej. Col. Milagro de la Paz, Av. San Luis y Calle Oriente #12 San Miguel, El Salvador"
                class="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              ></textarea>
            </div>
            <p class="text-[10.5px] text-slate-400 mt-0.5">
              Ubicación física y referencia geográfica del taller.
            </p>
          </div>

          <!-- 3. Teléfonos / Celulares (2 Columnas) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Phone class="w-3 h-3 text-[#04c4d9]" />
                Celular 1 (Principal) <span class="text-rose-500">*</span>
              </label>
              <input
                v-model="form.celular1"
                type="text"
                required
                placeholder="Ej. 7831-2641"
                class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-mono font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Phone class="w-3 h-3 text-slate-400" />
                Celular 2 (Secundario)
              </label>
              <input
                v-model="form.celular2"
                type="text"
                placeholder="Ej. 7142-0401"
                class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-mono font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>
          </div>

          <!-- 4. Eslogan Comercial e IVA -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Eslogan / Lema Institucional
              </label>
              <input
                v-model="form.eslogan"
                type="text"
                placeholder="Ej. APOYARTE ES NUESTRO COMPROMISO"
                class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 italic focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              />
              <p class="text-[10.5px] text-slate-400 mt-1">
                Se imprime en el pie de página del documento junto a la firma de conformidad.
              </p>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Porcentaje de IVA (%)
              </label>
              <div class="relative flex items-center">
                <input
                  v-model.number="form.iva_porcentaje"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="13"
                  class="w-full px-3.5 py-2.5 pr-8 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
                />
                <span class="absolute right-3 text-xs font-bold text-slate-400">%</span>
              </div>
              <p class="text-[10.5px] text-slate-400 mt-1">
                Se aplica automáticamente al marcar IVA en órdenes y cotizaciones.
              </p>
            </div>
          </div>

          <!-- Botón de guardado dentro del formulario -->
          <div class="pt-3 flex justify-end">
            <button
              type="submit"
              :disabled="isSaving"
              class="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#04c4d9] hover:bg-[#03a9bc] active:bg-[#0296a6] rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Save class="w-4 h-4" />
              <span>{{ isSaving ? 'Guardando en Supabase...' : 'Guardar Información del Taller' }}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Columna Derecha: Vista Previa en Vivo (5 cols) -->
      <div class="lg:col-span-5 space-y-4">
        <div class="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-cyan-400" />
            <span class="text-xs font-bold">Vista Previa del Encabezado</span>
          </div>
          <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
            En Tiempo Real
          </span>
        </div>

        <!-- Tarjeta de simulación exacta del documento PDF -->
        <div class="bg-white rounded-2xl border-2 border-slate-300 shadow-sm p-5 space-y-4 font-sans text-slate-900">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-dashed border-slate-200 pb-2 flex items-center gap-1.5">
            <FileText class="w-3.5 h-3.5 text-slate-400" />
            Encabezado de Orden / Cotización PDF
          </div>

          <!-- Encabezado idéntico al PDF -->
          <div class="border-b-2 border-slate-900 pb-3">
            <div class="flex items-start gap-3">
              <!-- Logo dinámico con vista previa -->
              <div class="w-14 h-14 shrink-0 flex items-center justify-center border border-slate-200 rounded p-1 bg-white">
                <img
                  :src="form.logo_url || '/logo-taller.png'"
                  alt="Logo Rectificadora"
                  class="max-w-full max-h-full object-contain"
                  @error="(e: any) => e.target.src = '/logo-taller.png'"
                />
              </div>

              <!-- Textos reactivos -->
              <div class="flex-1 min-w-0">
                <h3 class="text-xs sm:text-sm font-black tracking-tight text-slate-900 uppercase leading-snug">
                  {{ form.nombre || 'NOMBRE DEL TALLER' }}
                </h3>
                <p class="text-[10px] font-medium text-slate-600 mt-0.5 leading-snug">
                  {{ form.direccion || 'Dirección del taller rectificador...' }}
                </p>
                <div class="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-800 mt-1">
                  <span v-if="form.celular1">Cel: {{ form.celular1 }}</span>
                  <span v-else class="text-slate-400 italic">Cel: (Sin registrar)</span>

                  <span v-if="form.celular2">Cel: {{ form.celular2 }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Pie de página con eslogan simulado -->
          <div class="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
            <span class="text-slate-500 font-medium">Eslogan:</span>
            <span class="font-black italic font-serif text-slate-800">
              "{{ form.eslogan || 'APOYARTE ES NUESTRO COMPROMISO' }}"
            </span>
          </div>

          <div class="bg-cyan-50 border border-cyan-200 rounded-xl p-3 text-[11px] text-cyan-900 flex items-start gap-2">
            <CheckCircle2 class="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
            <p>
              El logotipo y datos modificados aquí se reflejan de inmediato en todas las órdenes de trabajo, cotizaciones y documentos PDF descargados o impresos.
            </p>
          </div>
        </div>
      </div>

    </div>

    <!-- Toast Flotante -->
    <transition
      enter-active-class="transform transition ease-out duration-300"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="toastMessage" 
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold max-w-md backdrop-blur-md"
        :class="[
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-emerald-950/30' 
            : 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/30'
        ]"
      >
        <div 
          class="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          :class="toastMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'"
        >
          <CheckCircle2 v-if="toastMessage.type === 'success'" class="w-4 h-4" />
          <AlertCircle v-else class="w-4 h-4" />
        </div>
        <div class="flex-1 text-slate-100">{{ toastMessage.text }}</div>
      </div>
    </transition>
  </div>
</template>
