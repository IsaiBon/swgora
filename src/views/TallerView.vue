<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTallerStore } from '@/stores/taller'
import type { TallerInfo } from '@/services/tallerService'
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
  Trash2,
  LogIn,
  KeyRound,
  ExternalLink,
  Mail,
  Lock,
  ArrowRight
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const tallerStore = useTallerStore()

// Pestaña activa: 'membrete' | 'login'
type TallerTab = 'membrete' | 'login'
const activeTab = ref<TallerTab>('membrete')

// Archivo de logo pendiente de guardar
const pendingLogoFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Validación de permisos: Administrador o Taller Independiente
// (Solo el Administrador principal puede personalizar el Login)
watch(
  () => authStore.canCustomizeLogin,
  (allowed) => {
    if (!allowed && activeTab.value === 'login') {
      activeTab.value = 'membrete'
    }
  },
  { immediate: true }
)

onMounted(async () => {
  if (!authStore.canAccess('/taller')) {
    router.replace(authStore.defaultRoute)
    return
  }

  if (!authStore.canCustomizeLogin) {
    activeTab.value = 'membrete'
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
  iva_porcentaje: 13,
  login_titulo: 'JR Blanco',
  login_subtitulo: 'Taller Industrial y Rectificado de Motores',
  login_mensaje: 'Ingresa tus credenciales para acceder al sistema'
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
  form.login_titulo = current.login_titulo || 'JR Blanco'
  form.login_subtitulo = current.login_subtitulo || 'Taller Industrial y Rectificado de Motores'
  form.login_mensaje = current.login_mensaje || 'Ingresa tus credenciales para acceder al sistema'

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

// Preestablecer título de Login con el nombre del taller (solo Administrador principal)
const syncLoginTitleWithWorkshop = () => {
  if (!authStore.canCustomizeLogin) return
  if (form.nombre.trim()) {
    form.login_titulo = form.nombre.trim()
    showToast('Título del Login sincronizado con el Nombre del Taller.', 'success')
  }
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

    // Si hay un logo nuevo seleccionado, subirlo a Supabase Storage
    if (pendingLogoFile.value) {
      try {
        finalLogoUrl = await tallerStore.uploadLogo(pendingLogoFile.value)
      } catch (uploadErr) {
        console.warn('Fallo subiendo logo a Storage, usando Data URL local:', uploadErr)
      }
    }

    const payload: Partial<TallerInfo> = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      celular1: form.celular1.trim(),
      celular2: form.celular2.trim(),
      eslogan: form.eslogan.trim(),
      logo_url: finalLogoUrl,
      iva_porcentaje: Number(form.iva_porcentaje),
    }

    if (authStore.canCustomizeLogin) {
      payload.login_titulo = form.login_titulo.trim() || 'JR Blanco'
      payload.login_subtitulo = form.login_subtitulo.trim() || 'Taller Industrial y Rectificado de Motores'
      payload.login_mensaje = form.login_mensaje.trim() || 'Ingresa tus credenciales para acceder al sistema'
    }

    await tallerStore.updateTaller(payload)

    form.logo_url = finalLogoUrl
    pendingLogoFile.value = null
    showToast(
      authStore.canCustomizeLogin
        ? 'Información del taller y personalización del Login guardadas exitosamente.'
        : 'Información del taller guardada exitosamente.',
      'success'
    )
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
    <!-- Encabezado Hero Studio -->
    <div class="studio-hero-banner p-6 sm:p-7 text-white relative overflow-hidden">
      <div class="pointer-events-none absolute -top-16 -right-12 w-56 h-56 rounded-full bg-[#04C4D9]/25 blur-3xl"></div>
      <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="space-y-1.5">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            <Building2 class="w-3.5 h-3.5 text-[#BFEBF2]" />
            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#BFEBF2]">
              {{ authStore.canCustomizeLogin ? 'IDENTIDAD · MEMBRETE CORPORATIVO & PANTALLA DE ACCESO' : 'IDENTIDAD · MEMBRETE CORPORATIVO & DOCUMENTOS PDF' }}
            </span>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Módulo de Taller
          </h1>
          <p class="text-xs sm:text-sm text-sky-100/85 max-w-2xl">
            {{ authStore.canCustomizeLogin
              ? 'Administra el logotipo y membrete oficial de órdenes y cotizaciones, y personaliza la identidad visual de la pantalla de inicio de sesión (Login).'
              : 'Administra el logotipo, datos y membrete oficial de las órdenes de trabajo y cotizaciones PDF de tu taller.' }}
          </p>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            @click="resetForm"
            :disabled="isSaving"
            class="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-white/12 hover:bg-white/20 active:scale-[0.97] border border-white/20 rounded-xl transition-all duration-150 disabled:opacity-50 cursor-pointer"
            title="Deshacer cambios no guardados"
          >
            <RotateCcw class="w-3.5 h-3.5 text-[#BFEBF2]" />
            Restablecer
          </button>

          <button
            type="button"
            @click="handleSubmit"
            :disabled="isSaving"
            class="studio-cta-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-lg shadow-[#04c4d9]/20"
          >
            <Save class="w-4 h-4" />
            <span>{{ isSaving ? 'Guardando...' : 'Guardar Cambios' }}</span>
          </button>
        </div>
      </div>

      <!-- Barra de Pestañas de Navegación del Módulo -->
      <div class="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center gap-2">
        <button
          type="button"
          @click="activeTab = 'membrete'"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
          :class="activeTab === 'membrete'
            ? 'bg-white text-[#004b97] shadow-md ring-2 ring-white/60'
            : 'text-white/80 hover:text-white hover:bg-white/10'"
        >
          <FileText class="w-4 h-4" :class="activeTab === 'membrete' ? 'text-[#004b97]' : 'text-[#BFEBF2]'" />
          <span>Membrete de Órdenes & PDF</span>
        </button>

        <button
          v-if="authStore.canCustomizeLogin"
          type="button"
          @click="activeTab = 'login'"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
          :class="activeTab === 'login'
            ? 'bg-white text-[#004b97] shadow-md ring-2 ring-white/60'
            : 'text-white/80 hover:text-white hover:bg-white/10'"
        >
          <LogIn class="w-4 h-4" :class="activeTab === 'login' ? 'text-[#004b97]' : 'text-[#BFEBF2]'" />
          <span>Personalización del Login</span>
        </button>

        <a
          v-if="authStore.canCustomizeLogin"
          href="/login"
          target="_blank"
          rel="noopener noreferrer"
          class="ml-auto hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 hover:text-white underline underline-offset-4 cursor-pointer"
          title="Abrir pantalla de login en nueva pestaña"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          <span>Ver Login en vivo</span>
        </a>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- PESTAÑA 1: MEMBRETE Y DOCUMENTOS PDF -->
    <!-- ========================================================================= -->
    <div v-if="activeTab === 'membrete'" class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      
      <!-- Columna Izquierda: Formulario de Datos Institucionales (7 cols) -->
      <div class="lg:col-span-7 studio-card overflow-hidden">
        <div class="bg-[#F4F8FC] px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-xl bg-[#E8F1FA] text-[#1B4978] border border-[#CFE1F4] flex items-center justify-center">
              <Building2 class="w-4 h-4" />
            </span>
            <div>
              <h2 class="font-display text-sm sm:text-base font-extrabold text-[#162436] tracking-tight">Datos Generales y Logotipo</h2>
              <p class="text-[11px] text-slate-500">Se imprimen en el encabezado de órdenes de trabajo y cotizaciones</p>
            </div>
          </div>
        </div>
        
        <div class="p-5 sm:p-6 space-y-6">

          <!-- SECCIÓN DE LOGOTIPO -->
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4.5 space-y-3">
            <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon class="w-4 h-4 text-[#04c4d9]" />
              Logotipo Oficial del Taller
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
                    class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1E446E] hover:bg-[#19314D] active:scale-95 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <Upload class="w-3.5 h-3.5 text-[#BFEBF2]" />
                    Cambiar Logotipo
                  </button>

                  <button
                    v-if="form.logo_url !== '/logo-taller.png'"
                    type="button"
                    @click="resetToDefaultLogo"
                    class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition cursor-pointer"
                    title="Volver al logo inicial"
                  >
                    <Trash2 class="w-3.5 h-3.5 text-rose-500" />
                    Restablecer
                  </button>
                </div>

                <p class="text-[10.5px] text-slate-500 leading-relaxed">
                  Admite archivos <strong>PNG, JPG, SVG o WebP</strong> (máx. 5 MB). Se recomienda una imagen cuadrada con fondo transparente para máxima fidelidad en el PDF impreso<template v-if="authStore.canCustomizeLogin"> y en la pantalla de inicio de sesión</template>.
                </p>
              </div>
            </div>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- 1. Nombre del Taller -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Nombre del Taller / Razón Social <span class="text-rose-500">*</span>
                </label>
                <button
                  v-if="authStore.canCustomizeLogin"
                  type="button"
                  @click="syncLoginTitleWithWorkshop"
                  class="text-[11px] font-semibold text-[#004b97] hover:underline cursor-pointer"
                  title="Copiar este nombre al título de la pantalla de login"
                >
                  Usar también en Login
                </button>
              </div>
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
                Ubicación física y referencia geográfica del taller con emoji de ubicación 📍 en el PDF.
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
                  {{ authStore.canCustomizeLogin
                    ? 'Se imprime en el pie de página del documento y al final del Login.'
                    : 'Se imprime en el pie de página de tus órdenes y cotizaciones PDF.' }}
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
                  Se aplica automáticamente al marcar IVA en órdenes.
                </p>
              </div>
            </div>

            <!-- Botón de guardado dentro del formulario -->
            <div class="pt-3 flex justify-end">
              <button
                type="submit"
                :disabled="isSaving"
                class="studio-cta-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-md"
              >
                <Save class="w-4 h-4" />
                <span>{{ isSaving ? 'Guardando en Supabase...' : 'Guardar Información del Taller' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Columna Derecha: Vista Previa del Membrete (5 cols) -->
      <div class="lg:col-span-5 space-y-4">
        <div class="studio-card overflow-hidden">
          <div class="bg-[#F4F8FC] px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] flex items-center justify-center">
                <Sparkles class="w-4 h-4" />
              </span>
              <span class="font-display text-sm font-extrabold text-[#0F1E2E] tracking-tight">Vista Previa del Encabezado</span>
            </div>
            <span class="text-[10px] bg-[#E8F1FA] border border-[#CFE1F4] text-[#1B4978] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
              Tiempo Real
            </span>
          </div>

          <!-- Tarjeta de simulación exacta del documento PDF -->
          <div class="p-5 space-y-4 font-sans text-slate-900 bg-white">
            <div class="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest border-b border-dashed border-slate-200 pb-2 flex items-center gap-1.5">
              <FileText class="w-3.5 h-3.5 text-slate-400" />
              Encabezado de Orden / Cotización PDF
            </div>

            <!-- Encabezado idéntico al PDF -->
            <div class="border-b-2 border-slate-900 pb-3">
              <div class="flex items-center gap-4">
                <!-- Logo dinámico con vista previa -->
                <div class="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center border border-slate-200 rounded-xl p-1 bg-white">
                  <img
                    :src="form.logo_url || '/logo-taller.png'"
                    alt="Logo Rectificadora"
                    class="max-w-full max-h-full object-contain"
                    @error="(e: any) => e.target.src = '/logo-taller.png'"
                  />
                </div>

                <!-- Textos reactivos -->
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase leading-snug">
                    {{ form.nombre || 'NOMBRE DEL TALLER' }}
                  </h3>
                  <p class="text-xs font-medium text-slate-600 mt-0.5 leading-snug flex items-center gap-1.5">
                    <span class="text-rose-600 text-xs shrink-0 select-none">📍</span>
                    <span>{{ form.direccion || 'Dirección del taller rectificador...' }}</span>
                  </p>
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-800 mt-1">
                    <span v-if="form.celular1" class="inline-flex items-center gap-1">
                      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 inline-block shrink-0 fill-[#25D366]">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.11 7.44C8.95 7.44 8.68 7.5 8.46 7.74C8.23 7.98 7.6 8.57 7.6 9.78C7.6 10.99 8.48 12.16 8.6 12.33C8.73 12.49 10.33 14.96 12.78 16.02C13.36 16.27 13.82 16.42 14.17 16.53C14.76 16.72 15.3 16.69 15.72 16.63C16.19 16.56 17.17 16.04 17.37 15.47C17.58 14.9 17.58 14.41 17.51 14.31C17.45 14.21 17.3 14.15 17.06 14.03C16.83 13.91 15.69 13.35 15.48 13.27C15.27 13.19 15.12 13.15 14.97 13.39C14.81 13.62 14.37 14.15 14.23 14.31C14.1 14.46 13.96 14.48 13.73 14.36C13.5 14.24 12.52 13.92 11.37 12.9C10.47 12.1 9.87 11.11 9.75 10.9C9.63 10.69 9.74 10.58 9.85 10.46C9.96 10.36 10.09 10.18 10.21 10.04C10.33 9.9 10.37 9.79 10.45 9.64C10.53 9.48 10.49 9.35 10.43 9.23C10.37 9.11 9.89 7.93 9.7 7.45C9.51 6.98 9.32 7.05 9.17 7.04C9.04 7.04 8.89 7.04 8.73 7.04"/>
                      </svg>
                      <span>Cel: {{ form.celular1 }}</span>
                    </span>
                    <span v-else class="text-slate-400 italic">Cel: (Sin registrar)</span>

                    <span v-if="form.celular2" class="inline-flex items-center gap-1">
                      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 inline-block shrink-0 fill-[#25D366]">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.11 7.44C8.95 7.44 8.68 7.5 8.46 7.74C8.23 7.98 7.6 8.57 7.6 9.78C7.6 10.99 8.48 12.16 8.6 12.33C8.73 12.49 10.33 14.96 12.78 16.02C13.36 16.27 13.82 16.42 14.17 16.53C14.76 16.72 15.3 16.69 15.72 16.63C16.19 16.56 17.17 16.04 17.37 15.47C17.58 14.9 17.58 14.41 17.51 14.31C17.45 14.21 17.3 14.15 17.06 14.03C16.83 13.91 15.69 13.35 15.48 13.27C15.27 13.19 15.12 13.15 14.97 13.39C14.81 13.62 14.37 14.15 14.23 14.31C14.1 14.46 13.96 14.48 13.73 14.36C13.5 14.24 12.52 13.92 11.37 12.9C10.47 12.1 9.87 11.11 9.75 10.9C9.63 10.69 9.74 10.58 9.85 10.46C9.96 10.36 10.09 10.18 10.21 10.04C10.33 9.9 10.37 9.79 10.45 9.64C10.53 9.48 10.49 9.35 10.43 9.23C10.37 9.11 9.89 7.93 9.7 7.45C9.51 6.98 9.32 7.05 9.17 7.04C9.04 7.04 8.89 7.04 8.73 7.04"/>
                      </svg>
                      <span>Cel: {{ form.celular2 }}</span>
                    </span>
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

            <div class="bg-cyan-50 border border-cyan-200 rounded-md p-3 text-[11px] text-cyan-900 flex items-start gap-2">
              <CheckCircle2 class="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
              <p>
                El logotipo y datos modificados aquí se reflejan de inmediato en todas las órdenes de trabajo, cotizaciones y documentos PDF descargados o impresos.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- PESTAÑA 2: PERSONALIZACIÓN DEL LOGIN -->
    <!-- ========================================================================= -->
    <div v-else-if="authStore.canCustomizeLogin && activeTab === 'login'" class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

      <!-- Columna Izquierda: Formulario de Personalización del Login (7 cols) -->
      <div class="lg:col-span-7 studio-card overflow-hidden">
        <div class="bg-[#F4F8FC] px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-xl bg-[#E8F1FA] text-[#1B4978] border border-[#CFE1F4] flex items-center justify-center">
              <KeyRound class="w-4 h-4" />
            </span>
            <div>
              <h2 class="font-display text-sm sm:text-base font-extrabold text-[#162436] tracking-tight">Personalización del Inicio de Sesión</h2>
              <p class="text-[11px] text-slate-500">Configura los textos, mensajes y el wallpaper de la pantalla de acceso</p>
            </div>
          </div>
        </div>

        <div class="p-5 sm:p-6 space-y-6">

          <!-- 1. Título Principal en la Tarjeta de Login -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Título Principal de la Marca en Login <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model="form.login_titulo"
                type="text"
                required
                placeholder="Ej. JR Blanco"
                class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>
            <p class="text-[10.5px] text-slate-400 mt-1">
              Nombre destacado en la cabecera de la tarjeta blanca de autenticación y en la barra superior.
            </p>
          </div>

          <!-- 2. Subtítulo o Giro Comercial -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Subtítulo / Giro Comercial
            </label>
            <div class="relative">
              <input
                v-model="form.login_subtitulo"
                type="text"
                placeholder="Ej. Taller Industrial y Rectificado de Motores"
                class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>
            <p class="text-[10.5px] text-slate-400 mt-1">
              Línea en color azul institucional debajo del título del taller.
            </p>
          </div>

          <!-- 3. Mensaje de Bienvenida / Instrucción -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mensaje de Bienvenida / Indicación
            </label>
            <div class="relative">
              <input
                v-model="form.login_mensaje"
                type="text"
                placeholder="Ej. Ingresa tus credenciales para acceder al sistema"
                class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>
            <p class="text-[10.5px] text-slate-400 mt-1">
              Orientación para los operarios, técnicos y administradores que inician sesión.
            </p>
          </div>

          <!-- 4. Nota informativa sobre el logotipo -->
          <div class="bg-sky-50/70 border border-sky-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-sky-900">
            <Sparkles class="w-4 h-4 text-[#004b97] shrink-0 mt-0.5" />
            <div class="space-y-0.5">
              <p class="font-bold">Logotipo sincronizado:</p>
              <p class="text-[11px] text-sky-800">
                La pantalla de Login utiliza el logotipo oficial configurado en la pestaña <strong>"Membrete de Órdenes & PDF"</strong>. Al cambiar el logo allí, se actualiza automáticamente en el Login.
              </p>
            </div>
          </div>

          <!-- Botón de guardado dentro del formulario -->
          <div class="pt-3 flex justify-end">
            <button
              type="button"
              @click="handleSubmit"
              :disabled="isSaving"
              class="studio-cta-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-md"
            >
              <Save class="w-4 h-4" />
              <span>{{ isSaving ? 'Guardando en Supabase...' : 'Guardar Personalización de Login' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Columna Derecha: Vista Previa en Vivo del Login (5 cols) -->
      <div class="lg:col-span-5 space-y-4">
        <div class="studio-card overflow-hidden">
          <div class="bg-[#F4F8FC] px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-[#E3F5F8] text-[#12697A] border border-[#C1E8EF] flex items-center justify-center">
                <Sparkles class="w-4 h-4" />
              </span>
              <span class="font-display text-sm font-extrabold text-[#0F1E2E] tracking-tight">Vista Previa del Login</span>
            </div>
            <span class="text-[10px] bg-[#E8F1FA] border border-[#CFE1F4] text-[#1B4978] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
              En Vivo
            </span>
          </div>

          <!-- Simulación exacta de AuthLayout y LoginView -->
          <div class="p-3 sm:p-4 bg-slate-900">
            <div class="relative w-full rounded-2xl overflow-hidden bg-[#09132B] border border-slate-700/80 shadow-2xl p-4 sm:p-5 flex flex-col items-center justify-between min-h-[500px]">
              
              <!-- Fondo simulado predeterminado -->
              <div
                class="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
                style="background-image: url('/images/workshop-bg.jpg');"
              ></div>
              <div class="absolute inset-0 bg-gradient-to-br from-[#09132B]/95 via-[#0D1B3E]/90 to-[#004B97]/85 pointer-events-none"></div>

              <!-- Línea superior de acento -->
              <div class="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#04C4D9] via-[#2563EB] to-[#004B97] z-10"></div>

              <!-- Header simulado -->
              <div class="relative z-10 w-full flex items-center justify-between text-[9px] text-slate-300 pb-3 border-b border-white/10">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#BFEBF2]"></span>
                  <span class="font-bold text-white tracking-wider">SWGORA</span>
                </div>
                <span class="font-mono text-slate-400">{{ form.login_titulo || 'JR Blanco' }}</span>
              </div>

              <!-- Tarjeta Blanca Simulada -->
              <div class="relative z-10 w-full max-w-[310px] my-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-white/90">
                <!-- Barra superior de identidad -->
                <div class="h-1 w-full bg-gradient-to-r from-[#0D1B3E] via-[#004B97] to-[#04C4D9]"></div>

                <div class="p-5 text-center">
                  <!-- Logo Flotante -->
                  <div class="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-[#0D1B3E] to-[#004B97] p-1.5 shadow-md flex items-center justify-center overflow-hidden mb-2.5">
                    <img
                      :src="form.logo_url || '/logo-taller.png'"
                      alt="Logo Login"
                      class="w-full h-full object-contain"
                      @error="(e: any) => e.target.src = '/logo-taller.png'"
                    />
                  </div>

                  <!-- Título Personalizado -->
                  <h3 class="text-base font-extrabold text-[#0D1B3E] tracking-tight leading-tight">
                    {{ form.login_titulo || 'JR Blanco' }}
                  </h3>

                  <!-- Subtítulo Personalizado -->
                  <p class="text-[9.5px] font-bold uppercase tracking-wider text-[#004B97] mt-0.5">
                    {{ form.login_subtitulo || 'Taller Industrial y Rectificado de Motores' }}
                  </p>

                  <!-- Mensaje Personalizado -->
                  <p class="text-[10px] text-slate-500 mt-1 leading-tight">
                    {{ form.login_mensaje || 'Ingresa tus credenciales para acceder al sistema' }}
                  </p>

                  <!-- Campos Simulados -->
                  <div class="mt-3.5 space-y-2 text-left">
                    <div>
                      <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Mail class="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          disabled
                          placeholder="nombre@taller.com"
                          class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-[10px] text-slate-400 cursor-not-allowed select-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Lock class="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="password"
                          disabled
                          value="••••••••••••"
                          class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-[10px] text-slate-400 cursor-not-allowed select-none"
                        />
                      </div>
                    </div>

                    <!-- Botón Simulado -->
                    <div class="pt-1">
                      <div class="w-full bg-[#004B97] text-white font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1.5 shadow-xs select-none">
                        <span>Iniciar Sesión</span>
                        <ArrowRight class="w-3 h-3 text-[#04C4D9]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer simulado -->
              <div class="relative z-10 w-full pt-2 border-t border-white/10 flex items-center justify-between text-[8px] text-slate-400">
                <span>© {{ new Date().getFullYear() }} {{ form.login_titulo || 'JR Blanco' }}</span>
                <span>{{ form.eslogan || 'Apoyarte es nuestro compromiso' }}</span>
              </div>

            </div>
          </div>

          <div class="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
            <span class="text-[11px] text-slate-500 font-medium">
              Los cambios se reflejan de inmediato al presionar Guardar.
            </span>
            <a
              href="/login"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs font-bold text-[#004b97] hover:underline cursor-pointer"
            >
              <span>Abrir Login</span>
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
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
            ? 'bg-[#0D1B3E]/95 text-[#BFEBF2] border-[#04C4D9]/50 shadow-[#0D1B3E]/30' 
            : 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/30'
        ]"
      >
        <div 
          class="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
          :class="toastMessage.type === 'success' ? 'bg-[#04C4D9]/20 text-[#04C4D9]' : 'bg-rose-500/20 text-rose-400'"
        >
          <CheckCircle2 v-if="toastMessage.type === 'success'" class="w-4 h-4" />
          <AlertCircle v-else class="w-4 h-4" />
        </div>
        <div class="flex-1 text-slate-100">{{ toastMessage.text }}</div>
      </div>
    </transition>
  </div>
</template>
