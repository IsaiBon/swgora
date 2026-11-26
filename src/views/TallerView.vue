<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTallerStore } from '@/stores/taller'
import { DEFAULT_TALLER_INFO, type TallerInfo } from '@/services/tallerService'
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

// Archivos de personalización del Login (logo exclusivo y fondo)
const pendingLoginLogoFile = ref<File | null>(null)
const loginLogoInputRef = ref<HTMLInputElement | null>(null)
const pendingLoginBgFile = ref<File | null>(null)
const loginBgInputRef = ref<HTMLInputElement | null>(null)

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
  login_mensaje: 'Ingresa tus credenciales para acceder al sistema',
  login_bg_url: '/images/workshop-bg.jpg',
  login_logo_url: '',
  login_header_marca: 'SWGORA',
  login_header_descripcion: 'Sistema de Gestión Operativa y Rectificación',
  login_header_derecha: 'JR Blanco',
  login_header_badge: 'Acceso Seguro',
  login_footer_izquierda: `© ${new Date().getFullYear()} JR Blanco — Taller Industrial y Rectificado de Motores`,
  login_footer_derecha: 'Apoyarte es nuestro compromiso',
  login_email_label: 'Correo electrónico',
  login_email_placeholder: 'nombre@jrblanco.com',
  login_password_label: 'Contraseña',
  login_password_placeholder: 'Ingresa tu contraseña',
  login_forgot_text: '',
  login_button_text: 'INICIAR SESIÓN'
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

  const tituloFallback = current.login_titulo !== undefined ? current.login_titulo : (DEFAULT_TALLER_INFO.login_titulo || 'JR Blanco')
  const subtituloFallback = current.login_subtitulo !== undefined ? current.login_subtitulo : (DEFAULT_TALLER_INFO.login_subtitulo || 'Taller Industrial y Rectificado de Motores')
  form.login_titulo = tituloFallback
  form.login_subtitulo = subtituloFallback
  form.login_mensaje = current.login_mensaje !== undefined ? current.login_mensaje : (DEFAULT_TALLER_INFO.login_mensaje || 'Ingresa tus credenciales para acceder al sistema')
  form.login_bg_url = current.login_bg_url || DEFAULT_TALLER_INFO.login_bg_url || '/images/workshop-bg.jpg'
  form.login_logo_url = current.login_logo_url !== undefined ? current.login_logo_url : ''
  form.login_header_marca = current.login_header_marca !== undefined ? current.login_header_marca : (DEFAULT_TALLER_INFO.login_header_marca || 'SWGORA')
  form.login_header_descripcion = current.login_header_descripcion !== undefined ? current.login_header_descripcion : (DEFAULT_TALLER_INFO.login_header_descripcion || 'Sistema de Gestión Operativa y Rectificación')
  form.login_header_derecha = current.login_header_derecha !== undefined ? current.login_header_derecha : (tituloFallback || 'JR Blanco')
  form.login_header_badge = current.login_header_badge !== undefined ? current.login_header_badge : (DEFAULT_TALLER_INFO.login_header_badge || 'Acceso Seguro')
  form.login_footer_izquierda = current.login_footer_izquierda !== undefined
    ? current.login_footer_izquierda
    : `© ${new Date().getFullYear()} ${tituloFallback || 'JR Blanco'} — ${subtituloFallback || 'Taller Industrial y Rectificado de Motores'}`
  form.login_footer_derecha = current.login_footer_derecha !== undefined
    ? current.login_footer_derecha
    : (current.eslogan || DEFAULT_TALLER_INFO.login_footer_derecha || 'Apoyarte es nuestro compromiso')
  form.login_email_label = current.login_email_label !== undefined ? current.login_email_label : (DEFAULT_TALLER_INFO.login_email_label || 'Correo electrónico')
  form.login_email_placeholder = current.login_email_placeholder !== undefined ? current.login_email_placeholder : (DEFAULT_TALLER_INFO.login_email_placeholder || 'nombre@jrblanco.com')
  form.login_password_label = current.login_password_label !== undefined ? current.login_password_label : (DEFAULT_TALLER_INFO.login_password_label || 'Contraseña')
  form.login_password_placeholder = current.login_password_placeholder !== undefined ? current.login_password_placeholder : (DEFAULT_TALLER_INFO.login_password_placeholder || 'Ingresa tu contraseña')
  form.login_forgot_text = ''
  const rawBtn = (current.login_button_text ?? '').trim()
  form.login_button_text = (!rawBtn || rawBtn.toLowerCase() === 'iniciar sesión' || rawBtn.toLowerCase() === 'iniciar sesion')
    ? 'INICIAR SESIÓN'
    : rawBtn

  pendingLogoFile.value = null
  pendingLoginLogoFile.value = null
  pendingLoginBgFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  if (loginLogoInputRef.value) {
    loginLogoInputRef.value.value = ''
  }
  if (loginBgInputRef.value) {
    loginBgInputRef.value.value = ''
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

// Manejador de logo exclusivo del Login
const handleLoginLogoSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    showToast('El archivo es demasiado grande. El límite máximo es 5MB.', 'error')
    target.value = ''
    return
  }

  pendingLoginLogoFile.value = file
  const reader = new FileReader()
  reader.onload = () => {
    form.login_logo_url = reader.result as string
    showToast('Logo del Login previsualizado. Haz clic en "Guardar Personalización de Login" para aplicarlo.', 'success')
  }
  reader.readAsDataURL(file)
}

const useMembreteLogoForLogin = () => {
  form.login_logo_url = ''
  pendingLoginLogoFile.value = null
  if (loginLogoInputRef.value) {
    loginLogoInputRef.value.value = ''
  }
  showToast('El Login usará el mismo logotipo que el Membrete de Órdenes.', 'success')
}

// Manejador de imagen de fondo para el Login
const handleLoginBgSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 8 * 1024 * 1024) {
    showToast('La imagen de fondo es demasiado grande. El límite máximo es 8MB.', 'error')
    target.value = ''
    return
  }

  pendingLoginBgFile.value = file
  const reader = new FileReader()
  reader.onload = () => {
    form.login_bg_url = reader.result as string
    showToast('Imagen de fondo previsualizada. Haz clic en "Guardar Personalización de Login" para aplicarla.', 'success')
  }
  reader.readAsDataURL(file)
}

const resetToDefaultLoginBg = () => {
  form.login_bg_url = '/images/workshop-bg.jpg'
  pendingLoginBgFile.value = null
  if (loginBgInputRef.value) {
    loginBgInputRef.value.value = ''
  }
  showToast('Se restableció el fondo de pantalla al predeterminado.', 'success')
}

const resetLoginDefaults = () => {
  if (!authStore.canCustomizeLogin) return
  form.login_titulo = DEFAULT_TALLER_INFO.login_titulo || 'JR Blanco'
  form.login_subtitulo = DEFAULT_TALLER_INFO.login_subtitulo || 'Taller Industrial y Rectificado de Motores'
  form.login_mensaje = DEFAULT_TALLER_INFO.login_mensaje || 'Ingresa tus credenciales para acceder al sistema'
  form.login_bg_url = DEFAULT_TALLER_INFO.login_bg_url || '/images/workshop-bg.jpg'
  form.login_logo_url = ''
  form.login_header_marca = DEFAULT_TALLER_INFO.login_header_marca || 'SWGORA'
  form.login_header_descripcion = DEFAULT_TALLER_INFO.login_header_descripcion || 'Sistema de Gestión Operativa y Rectificación'
  form.login_header_derecha = DEFAULT_TALLER_INFO.login_header_derecha || 'JR Blanco'
  form.login_header_badge = DEFAULT_TALLER_INFO.login_header_badge || 'Acceso Seguro'
  form.login_footer_izquierda = `© ${new Date().getFullYear()} JR Blanco — Taller Industrial y Rectificado de Motores`
  form.login_footer_derecha = DEFAULT_TALLER_INFO.login_footer_derecha || 'Apoyarte es nuestro compromiso'
  form.login_email_label = DEFAULT_TALLER_INFO.login_email_label || 'Correo electrónico'
  form.login_email_placeholder = DEFAULT_TALLER_INFO.login_email_placeholder || 'nombre@jrblanco.com'
  form.login_password_label = DEFAULT_TALLER_INFO.login_password_label || 'Contraseña'
  form.login_password_placeholder = DEFAULT_TALLER_INFO.login_password_placeholder || 'Ingresa tu contraseña'
  form.login_forgot_text = ''
  form.login_button_text = DEFAULT_TALLER_INFO.login_button_text || 'INICIAR SESIÓN'
  pendingLoginLogoFile.value = null
  pendingLoginBgFile.value = null
  if (loginLogoInputRef.value) loginLogoInputRef.value.value = ''
  if (loginBgInputRef.value) loginBgInputRef.value.value = ''
  showToast('Textos e imagen del Login restablecidos a los valores por defecto. Presiona Guardar para aplicar.', 'success')
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
    let finalLoginLogoUrl = form.login_logo_url
    let finalLoginBgUrl = form.login_bg_url

    // Si hay un logo nuevo seleccionado, subirlo a Supabase Storage
    if (pendingLogoFile.value) {
      try {
        finalLogoUrl = await tallerStore.uploadLogo(pendingLogoFile.value)
      } catch (uploadErr) {
        console.warn('Fallo subiendo logo a Storage, usando Data URL local:', uploadErr)
      }
    }

    if (authStore.canCustomizeLogin) {
      if (pendingLoginLogoFile.value) {
        try {
          finalLoginLogoUrl = await tallerStore.uploadLoginLogo(pendingLoginLogoFile.value)
        } catch (uploadErr) {
          console.warn('Fallo subiendo logo del Login a Storage, usando Data URL local:', uploadErr)
        }
      }
      if (pendingLoginBgFile.value) {
        try {
          finalLoginBgUrl = await tallerStore.uploadLoginBg(pendingLoginBgFile.value)
        } catch (uploadErr) {
          console.warn('Fallo subiendo fondo del Login a Storage, usando Data URL local:', uploadErr)
        }
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
      payload.login_titulo = form.login_titulo.trim()
      payload.login_subtitulo = form.login_subtitulo.trim()
      payload.login_mensaje = form.login_mensaje.trim()
      payload.login_bg_url = finalLoginBgUrl || '/images/workshop-bg.jpg'
      payload.login_logo_url = finalLoginLogoUrl.trim()
      payload.login_header_marca = form.login_header_marca.trim()
      payload.login_header_descripcion = form.login_header_descripcion.trim()
      payload.login_header_derecha = form.login_header_derecha.trim()
      payload.login_header_badge = form.login_header_badge.trim()
      payload.login_footer_izquierda = form.login_footer_izquierda.trim()
      payload.login_footer_derecha = form.login_footer_derecha.trim()
      payload.login_email_label = form.login_email_label.trim() || 'Correo electrónico'
      payload.login_email_placeholder = form.login_email_placeholder.trim()
      payload.login_password_label = form.login_password_label.trim() || 'Contraseña'
      payload.login_password_placeholder = form.login_password_placeholder.trim()
      payload.login_forgot_text = ''
      payload.login_button_text = form.login_button_text.trim() || 'INICIAR SESIÓN'
    }

    await tallerStore.updateTaller(payload)

    form.logo_url = finalLogoUrl
    form.login_logo_url = finalLoginLogoUrl
    form.login_bg_url = finalLoginBgUrl || '/images/workshop-bg.jpg'
    pendingLogoFile.value = null
    pendingLoginLogoFile.value = null
    pendingLoginBgFile.value = null
    showToast(
      authStore.canCustomizeLogin
        ? 'Información del taller y personalización completa del Login guardadas exitosamente.'
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
                  placeholder="Nombre del taller"
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
                  placeholder="Dirección del taller"
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
                  placeholder="Teléfono 1"
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
                  placeholder="Teléfono 2"
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
                  placeholder="Eslogan"
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

      <!-- Columna Izquierda: Formulario Completo de Personalización del Login (7 cols) -->
      <div class="lg:col-span-7 studio-card overflow-hidden">
        <div class="bg-[#F4F8FC] px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-xl bg-[#E8F1FA] text-[#1B4978] border border-[#CFE1F4] flex items-center justify-center">
              <KeyRound class="w-4 h-4" />
            </span>
            <div>
              <h2 class="font-display text-sm sm:text-base font-extrabold text-[#162436] tracking-tight">Personalización Completa del Login</h2>
              <p class="text-[11px] text-slate-500">Edita esquinas, insignias, textos, etiquetas, botón, logo y fondo del inicio de sesión</p>
            </div>
          </div>

          <button
            type="button"
            @click="resetLoginDefaults"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-[#004b97] bg-white hover:bg-blue-50 border border-slate-200 rounded-xl transition cursor-pointer"
            title="Restaurar todos los textos e imágenes del Login a los valores por defecto"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Restablecer Login</span>
          </button>
        </div>

        <div class="p-5 sm:p-6 space-y-6">

          <!-- SECCIÓN A: ESQUINAS Y CUADROS DE TEXTO DEL LOGIN -->
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4.5 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                1. Esquinas y Barras Exteriores del Login
              </h3>
              <span class="text-[10px] text-slate-500">Deja vacío cualquier campo si prefieres ocultarlo</span>
            </div>

            <!-- Esquina Superior Izquierda -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Esquina Sup. Izquierda · Marca / Sigla
                </label>
                <input
                  v-model="form.login_header_marca"
                  type="text"
                  placeholder="Marca en cabecera"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Esquina Sup. Izquierda · Descripción
                </label>
                <input
                  v-model="form.login_header_descripcion"
                  type="text"
                  placeholder="Descripción en cabecera"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
            </div>

            <!-- Esquina Superior Derecha -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Esquina Sup. Derecha · Texto
                </label>
                <input
                  v-model="form.login_header_derecha"
                  type="text"
                  placeholder="Nombre del taller"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Esquina Sup. Derecha · Cuadrito / Badge
                </label>
                <input
                  v-model="form.login_header_badge"
                  type="text"
                  placeholder="Etiqueta de seguridad"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
            </div>

            <!-- Esquinas Inferiores -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Esquina Inf. Izquierda · Pie Institucional
                </label>
                <input
                  v-model="form.login_footer_izquierda"
                  type="text"
                  placeholder="Texto pie izquierdo"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Esquina Inf. Derecha · Lema / Eslogan
                </label>
                <input
                  v-model="form.login_footer_derecha"
                  type="text"
                  placeholder="Texto pie derecho"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
            </div>
          </div>

          <!-- SECCIÓN B: TARJETA CENTRAL DEL LOGIN -->
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4.5 space-y-4">
            <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              2. Encabezado de la Tarjeta Central
            </h3>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Título Principal de la Marca en Login
              </label>
              <input
                v-model="form.login_titulo"
                type="text"
                placeholder="Nombre del taller"
                class="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Subtítulo / Giro Comercial
              </label>
              <input
                v-model="form.login_subtitulo"
                type="text"
                placeholder="Subtítulo"
                class="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mensaje de Bienvenida / Indicación
              </label>
              <input
                v-model="form.login_mensaje"
                type="text"
                placeholder="Mensaje de bienvenida"
                class="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>
          </div>

          <!-- SECCIÓN C: CAMPOS DEL FORMULARIO Y BOTÓN -->
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4.5 space-y-4">
            <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              3. Campos de Acceso y Botón
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Etiqueta de Correo
                </label>
                <input
                  v-model="form.login_email_label"
                  type="text"
                  placeholder="Correo electrónico"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Placeholder de Correo
                </label>
                <input
                  v-model="form.login_email_placeholder"
                  type="text"
                  placeholder="nombre@jrblanco.com"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Etiqueta de Contraseña
                </label>
                <input
                  v-model="form.login_password_label"
                  type="text"
                  placeholder="Contraseña"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">
                  Placeholder de Contraseña
                </label>
                <input
                  v-model="form.login_password_placeholder"
                  type="text"
                  placeholder="Ingresa tu contraseña"
                  class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
                />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">
                Texto del Botón Principal
              </label>
              <input
                v-model="form.login_button_text"
                type="text"
                placeholder="INICIAR SESIÓN"
                class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-[#04c4d9] transition"
              />
            </div>
          </div>

          <!-- SECCIÓN D: LOGOTIPO E IMAGEN DE FONDO DEL LOGIN -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Logo exclusivo de Login -->
            <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
              <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon class="w-4 h-4 text-[#04c4d9]" />
                Logotipo del Login
              </label>

              <div class="flex items-center gap-3">
                <div class="w-16 h-16 shrink-0 rounded-xl bg-gradient-to-br from-[#0D1B3E] to-[#004B97] p-1.5 border border-slate-200 flex items-center justify-center overflow-hidden">
                  <img
                    :src="form.login_logo_url || form.logo_url || '/logo-taller.png'"
                    alt="Logo del Login"
                    class="max-w-full max-h-full object-contain"
                    @error="(e: any) => e.target.src = '/logo-taller.png'"
                  />
                </div>
                <div class="space-y-1.5 min-w-0">
                  <input
                    ref="loginLogoInputRef"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    class="hidden"
                    @change="handleLoginLogoSelect"
                  />
                  <button
                    type="button"
                    @click="loginLogoInputRef?.click()"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-[#1E446E] hover:bg-[#19314D] rounded-lg transition cursor-pointer"
                  >
                    <Upload class="w-3 h-3 text-[#BFEBF2]" />
                    <span>Cambiar Logo</span>
                  </button>
                  <button
                    v-if="form.login_logo_url"
                    type="button"
                    @click="useMembreteLogoForLogin"
                    class="block text-[10.5px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Usar logo del Membrete
                  </button>
                  <p v-else class="text-[10px] text-slate-500 leading-tight">
                    Sincronizado con el Membrete
                  </p>
                </div>
              </div>
            </div>

            <!-- Imagen de fondo del Login -->
            <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
              <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon class="w-4 h-4 text-[#04c4d9]" />
                Imagen de Fondo
              </label>

              <div class="flex items-center gap-3">
                <div class="w-20 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-300 bg-[#09132B] relative">
                  <img
                    :src="form.login_bg_url || '/images/workshop-bg.jpg'"
                    alt="Fondo de Login"
                    class="w-full h-full object-cover opacity-75"
                    @error="(e: any) => e.target.src = '/images/workshop-bg.jpg'"
                  />
                </div>
                <div class="space-y-1.5 min-w-0">
                  <input
                    ref="loginBgInputRef"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    @change="handleLoginBgSelect"
                  />
                  <button
                    type="button"
                    @click="loginBgInputRef?.click()"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-[#004b97] hover:bg-[#003a75] rounded-lg transition cursor-pointer"
                  >
                    <Upload class="w-3 h-3 text-[#BFEBF2]" />
                    <span>Cambiar Fondo</span>
                  </button>
                  <button
                    v-if="form.login_bg_url !== '/images/workshop-bg.jpg'"
                    type="button"
                    @click="resetToDefaultLoginBg"
                    class="inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    <Trash2 class="w-3 h-3" />
                    <span>Fondo predeterminado</span>
                  </button>
                  <p v-else class="text-[10px] text-slate-500 leading-tight">
                    Fondo oficial activo
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Botón de guardado dentro del formulario -->
          <div class="pt-2 flex flex-wrap items-center justify-end gap-3">
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
      <div class="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
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
            <div class="relative w-full rounded-2xl overflow-hidden bg-[#09132B] border border-slate-700/80 shadow-2xl p-4 sm:p-5 flex flex-col items-center justify-between min-h-[540px]">

              <!-- Fondo simulado reactivo -->
              <div
                class="absolute inset-0 bg-cover bg-center opacity-45 pointer-events-none"
                :style="{ backgroundImage: `url('${form.login_bg_url || '/images/workshop-bg.jpg'}')` }"
              ></div>
              <div class="absolute inset-0 bg-gradient-to-br from-[#09132B]/80 via-[#0D1B3E]/75 to-[#004B97]/70 pointer-events-none"></div>

              <!-- Línea superior de acento -->
              <div class="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#04C4D9] via-[#2563EB] to-[#004B97] z-10"></div>

              <!-- Header simulado (Esquinas superiores) -->
              <div class="relative z-10 w-full flex items-center justify-between gap-2 text-[8.5px] text-slate-300 pb-3 border-b border-white/10">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span v-if="form.login_header_marca || form.login_header_descripcion" class="w-1.5 h-1.5 rounded-full bg-[#BFEBF2] shrink-0"></span>
                  <span v-if="form.login_header_marca" class="font-bold text-white tracking-wider uppercase shrink-0">{{ form.login_header_marca }}</span>
                  <span v-if="form.login_header_marca && form.login_header_descripcion" class="text-slate-500">/</span>
                  <span v-if="form.login_header_descripcion" class="text-slate-300 truncate">{{ form.login_header_descripcion }}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span v-if="form.login_header_derecha" class="text-slate-300 truncate max-w-[85px]">{{ form.login_header_derecha }}</span>
                  <span v-if="form.login_header_derecha && form.login_header_badge" class="text-slate-500">•</span>
                  <span v-if="form.login_header_badge" class="px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/15 text-slate-200 font-mono text-[8px]">
                    {{ form.login_header_badge }}
                  </span>
                </div>
              </div>

              <!-- Tarjeta Blanca Simulada -->
              <div class="relative z-10 w-full max-w-[310px] my-4 bg-white rounded-2xl shadow-xl overflow-hidden border border-white/90">
                <!-- Barra superior de identidad -->
                <div class="h-1 w-full bg-gradient-to-r from-[#0D1B3E] via-[#004B97] to-[#04C4D9]"></div>

                <div class="p-5 text-center">
                  <!-- Logo Flotante -->
                  <div class="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-[#0D1B3E] to-[#004B97] p-1.5 shadow-md flex items-center justify-center overflow-hidden mb-2.5">
                    <img
                      :src="form.login_logo_url || form.logo_url || '/logo-taller.png'"
                      alt="Logo Login"
                      class="w-full h-full object-contain"
                      @error="(e: any) => e.target.src = '/logo-taller.png'"
                    />
                  </div>

                  <!-- Título Personalizado -->
                  <h3 v-if="form.login_titulo" class="text-base font-extrabold text-[#0D1B3E] tracking-tight leading-tight">
                    {{ form.login_titulo }}
                  </h3>

                  <!-- Subtítulo Personalizado -->
                  <p v-if="form.login_subtitulo" class="text-[9.5px] font-bold uppercase tracking-wider text-[#004B97] mt-0.5">
                    {{ form.login_subtitulo }}
                  </p>

                  <!-- Mensaje Personalizado -->
                  <p v-if="form.login_mensaje" class="text-[10px] text-slate-500 mt-1 leading-tight">
                    {{ form.login_mensaje }}
                  </p>

                  <!-- Campos Simulados -->
                  <div class="mt-3.5 space-y-2 text-left">
                    <div>
                      <div class="text-[9px] font-semibold text-[#0F172A] mb-1">
                        {{ form.login_email_label || 'Correo electrónico' }}
                      </div>
                      <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Mail class="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="text"
                          disabled
                          :placeholder="form.login_email_placeholder"
                          class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-[10px] text-slate-400 cursor-not-allowed select-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div class="text-[9px] font-semibold text-[#0F172A] mb-1">
                        {{ form.login_password_label || 'Contraseña' }}
                      </div>
                      <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Lock class="w-3.5 h-3.5" />
                        </div>
                        <input
                          type="password"
                          disabled
                          :placeholder="form.login_password_placeholder"
                          class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-[10px] text-slate-400 cursor-not-allowed select-none"
                        />
                      </div>
                    </div>

                    <!-- Botón Simulado -->
                    <div class="pt-1">
                      <div class="w-full bg-[#004B97] text-white font-bold tracking-wide py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1.5 shadow-xs select-none">
                        <span>{{ form.login_button_text || 'INICIAR SESIÓN' }}</span>
                        <ArrowRight class="w-3 h-3 text-[#04C4D9]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer simulado (Esquinas inferiores) -->
              <div class="relative z-10 w-full pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[8px] text-slate-400">
                <span class="truncate">{{ form.login_footer_izquierda }}</span>
                <span class="truncate text-right">{{ form.login_footer_derecha }}</span>
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
