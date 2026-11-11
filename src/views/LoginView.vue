<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  Check,
  RefreshCw,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Modo activo de la vista: 'login' | 'reset' (actualización de nueva contraseña)
type ViewMode = 'login' | 'reset'
const viewMode = ref<ViewMode>('login')

// Estado de Login
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const expiredLinkBanner = ref('')
const emailTouched = ref(false)

// Estado del Modal de Recuperación de Contraseña (resetPasswordForEmail)
const isRecoveryOpen = ref(false)
const recoveryEmail = ref('')
const isRecoverySubmitting = ref(false)
const recoveryError = ref('')
const recoverySent = ref(false)

// Estado de Vista de Nueva Contraseña (updateUser)
const newPassword = ref('')
const confirmPassword = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const isResetSubmitting = ref(false)
const resetError = ref('')
const resetSuccess = ref(false)

// Validación de correo electrónico
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isLoginEmailValid = computed(() => {
  const clean = email.value.trim()
  if (!clean) return false
  return EMAIL_REGEX.test(clean)
})

const showLoginEmailError = computed(() => {
  return emailTouched.value && email.value.trim().length > 0 && !isLoginEmailValid.value
})

// Reglas de fortaleza de contraseña
const passwordCriteria = computed(() => {
  const pwd = newPassword.value
  return [
    {
      id: 'length',
      label: 'Mínimo 8 caracteres',
      met: pwd.length >= 8,
    },
    {
      id: 'case',
      label: 'Mayúscula y minúscula (A-z)',
      met: /[A-Z]/.test(pwd) && /[a-z]/.test(pwd),
    },
    {
      id: 'number',
      label: 'Al menos un número (0-9)',
      met: /\d/.test(pwd),
    },
    {
      id: 'special',
      label: 'Carácter especial (!@#$%&*)',
      met: /[^A-Za-z0-9]/.test(pwd),
    },
  ]
})

const passwordScore = computed(() => {
  if (!newPassword.value) return 0
  return passwordCriteria.value.filter((c) => c.met).length
})

const passwordStrengthMeta = computed(() => {
  const score = passwordScore.value
  if (!newPassword.value) {
    return {
      label: 'Sin evaluar',
      textColor: 'text-slate-400',
      barColor: 'bg-slate-200',
    }
  }
  if (score <= 1) {
    return {
      label: 'Débil',
      textColor: 'text-rose-600',
      barColor: 'bg-rose-500',
    }
  }
  if (score === 2) {
    return {
      label: 'Regular',
      textColor: 'text-amber-600',
      barColor: 'bg-amber-500',
    }
  }
  if (score === 3) {
    return {
      label: 'Buena',
      textColor: 'text-[#004B97]',
      barColor: 'bg-[#04C4D9]',
    }
  }
  return {
    label: 'Fuerte',
    textColor: 'text-emerald-600',
    barColor: 'bg-emerald-500',
  }
})

const passwordsMatch = computed(() => {
  return (
    confirmPassword.value.length > 0 &&
    newPassword.value === confirmPassword.value
  )
})

const showPasswordMismatch = computed(() => {
  return (
    confirmPassword.value.length > 0 &&
    newPassword.value !== confirmPassword.value
  )
})

const canSubmitNewPassword = computed(() => {
  return (
    newPassword.value.length >= 8 &&
    passwordScore.value >= 2 &&
    passwordsMatch.value &&
    !isResetSubmitting.value
  )
})

// Detectar enlaces de recuperación o errores de enlaces expirados en URL / Store
function inspectUrlForAuthFlow() {
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const search = typeof window !== 'undefined' ? window.location.search : ''
  const combined = `${hash}&${search}`

  // 1. Verificar si el enlace de correo expiró o fue inválido (Supabase devuelve error_code=otp_expired o access_denied)
  if (
    combined.includes('error_code=otp_expired') ||
    combined.includes('error=access_denied') ||
    combined.includes('error_description=')
  ) {
    expiredLinkBanner.value =
      'El enlace de recuperación ha expirado o ya fue utilizado. Solicita uno nuevo para restablecer tu contraseña.'
    viewMode.value = 'login'
    authStore.clearPasswordRecovery()

    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    return
  }

  // 2. Verificar si viene de enlace válido de recuperación de contraseña
  if (
    authStore.isPasswordRecovery ||
    route.query.mode === 'reset' ||
    combined.includes('type=recovery')
  ) {
    viewMode.value = 'reset'
    expiredLinkBanner.value = ''
  }
}

watch(
  () => authStore.isPasswordRecovery,
  (isRecovery) => {
    if (isRecovery) {
      viewMode.value = 'reset'
      isRecoveryOpen.value = false
      expiredLinkBanner.value = ''
    }
  }
)

watch(
  () => route.query.mode,
  (mode) => {
    if (mode === 'reset') {
      viewMode.value = 'reset'
      expiredLinkBanner.value = ''
    }
  }
)

onMounted(() => {
  inspectUrlForAuthFlow()
})

// Acción: Iniciar Sesión
const handleLogin = async () => {
  errorMessage.value = ''
  emailTouched.value = true
  const cleanEmail = email.value.trim()

  if (!cleanEmail) {
    errorMessage.value = 'Ingresa tu correo electrónico corporativo.'
    return
  }
  if (!EMAIL_REGEX.test(cleanEmail)) {
    errorMessage.value = 'El formato del correo electrónico no es válido.'
    return
  }
  if (!password.value) {
    errorMessage.value = 'Ingresa tu contraseña para continuar.'
    return
  }

  isSubmitting.value = true
  try {
    await authStore.login(cleanEmail, password.value)
    await router.replace(authStore.defaultRoute)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error
        ? err.message
        : 'No se pudo iniciar sesión. Verifica tus credenciales.'
  } finally {
    isSubmitting.value = false
  }
}

// Acción: Abrir Modal de Recuperación
const openRecoveryModal = () => {
  recoveryError.value = ''
  recoverySent.value = false
  if (email.value.trim() && !recoveryEmail.value) {
    recoveryEmail.value = email.value.trim()
  }
  isRecoveryOpen.value = true
}

const closeRecoveryModal = () => {
  isRecoveryOpen.value = false
  recoveryError.value = ''
}

// Acción: Enviar correo de recuperación con Supabase Auth (resetPasswordForEmail)
const handleRecoverySubmit = async () => {
  recoveryError.value = ''
  const targetEmail = recoveryEmail.value.trim()

  if (!targetEmail) {
    recoveryError.value = 'Ingresa el correo electrónico asociado a tu cuenta.'
    return
  }
  if (!EMAIL_REGEX.test(targetEmail)) {
    recoveryError.value = 'Ingresa una dirección de correo electrónico válida.'
    return
  }

  isRecoverySubmitting.value = true
  try {
    await authStore.requestPasswordReset(targetEmail)
    recoverySent.value = true
    expiredLinkBanner.value = ''
  } catch (err: unknown) {
    recoveryError.value =
      err instanceof Error
        ? err.message
        : 'No se pudo enviar el correo de recuperación. Intenta nuevamente.'
  } finally {
    isRecoverySubmitting.value = false
  }
}

// Acción: Actualizar Nueva Contraseña con Supabase Auth (updateUser)
const handlePasswordResetSubmit = async () => {
  resetError.value = ''

  if (newPassword.value.length < 8) {
    resetError.value = 'La nueva contraseña debe tener al menos 8 caracteres.'
    return
  }
  if (passwordScore.value < 2) {
    resetError.value =
      'Elige una contraseña más segura combinando letras, números o símbolos.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    resetError.value = 'Las contraseñas ingresadas no coinciden.'
    return
  }

  isResetSubmitting.value = true
  try {
    await authStore.updateUserPassword(newPassword.value)
    resetSuccess.value = true

    // Limpiar parámetros de recuperación de la URL
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState(null, '', '/login')
    }

    setTimeout(async () => {
      if (authStore.isAuthenticated) {
        await router.replace(authStore.defaultRoute)
      } else {
        returnToLogin()
      }
    }, 1800)
  } catch (err: unknown) {
    resetError.value =
      err instanceof Error
        ? err.message
        : 'No se pudo actualizar la contraseña. Solicita un nuevo enlace.'
  } finally {
    isResetSubmitting.value = false
  }
}

const returnToLogin = () => {
  viewMode.value = 'login'
  resetError.value = ''
  resetSuccess.value = false
  newPassword.value = ''
  confirmPassword.value = ''
  authStore.clearPasswordRecovery()
  if (route.query.mode) {
    router.replace({ path: '/login', query: {} })
  }
}

const handleLogoError = (e: Event) => {
  const target = e.target as HTMLImageElement | null
  if (target) {
    target.style.display = 'none'
  }
}
</script>

<template>
  <div class="w-full max-w-[420px] mx-auto">
    <!-- Tarjeta Principal Minimalista Corporativa -->
    <div
      class="auth-card relative bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgba(15,23,42,0.5)] border border-slate-200/90 overflow-hidden"
    >
      <!-- Barra superior de identidad (#004B97 -> #04C4D9) -->
      <div class="h-1.5 w-full bg-gradient-to-r from-[#004B97] via-[#04C4D9] to-[#004B97]"></div>

      <div class="p-6 sm:p-8">
        <!-- Cabecera de Marca JR Blanco -->
        <div class="flex flex-col items-center text-center mb-6">
          <div
            class="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-[#1A2234] p-2 shadow-md ring-1 ring-[#04C4D9]/40 flex items-center justify-center overflow-hidden mb-3.5"
          >
            <img
              src="/logo-taller.png"
              alt="Logo Oficial Taller JR Blanco"
              class="w-full h-full object-contain select-none"
              @error="handleLogoError"
            />
          </div>

          <h1 class="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight">
            {{ viewMode === 'login' ? 'JR Blanco' : 'Restablecer Contraseña' }}
          </h1>
          <p class="text-xs font-semibold text-[#004B97] mt-0.5">
            {{
              viewMode === 'login'
                ? 'Taller Industrial y Rectificado de Motores'
                : 'Configuración de seguridad de tu cuenta'
            }}
          </p>
          <p class="text-xs text-slate-500 mt-1">
            {{
              viewMode === 'login'
                ? 'Ingresa tus credenciales para acceder al sistema'
                : 'Crea una contraseña segura para recuperar tu acceso'
            }}
          </p>
        </div>

        <Transition name="view-switch" mode="out-in">
          <!-- ==========================================
               VISTA 1: INICIO DE SESIÓN (LOGIN)
               ========================================== -->
          <div v-if="viewMode === 'login'" key="login-view">
            <!-- Alerta de Enlace de Recuperación Expirado -->
            <div
              v-if="expiredLinkBanner"
              role="alert"
              class="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs"
            >
              <div class="flex items-start gap-2.5">
                <AlertTriangle class="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div class="flex-1 space-y-2">
                  <p class="font-medium leading-relaxed">
                    {{ expiredLinkBanner }}
                  </p>
                  <button
                    type="button"
                    @click="openRecoveryModal"
                    class="inline-flex items-center gap-1.5 text-xs font-bold text-[#004B97] hover:text-[#003A75] underline underline-offset-4 cursor-pointer"
                  >
                    <RefreshCw class="w-3.5 h-3.5" />
                    <span>Solicitar nuevo enlace</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Alerta de Error de Autenticación -->
            <div
              v-if="errorMessage"
              role="alert"
              aria-live="polite"
              class="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-feedback"
            >
              <AlertCircle class="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div class="flex-1">
                <span>{{ errorMessage }}</span>
              </div>
            </div>

            <!-- Formulario de Inicio de Sesión -->
            <form @submit.prevent="handleLogin" novalidate class="space-y-4">
              <!-- Campo: Correo Electrónico -->
              <div>
                <label
                  for="login-email"
                  class="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Correo electrónico
                </label>
                <div class="relative group">
                  <div
                    class="input-icon absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#004B97]"
                  >
                    <Mail class="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    v-model="email"
                    type="email"
                    inputmode="email"
                    autocomplete="email"
                    placeholder="nombre@jrblanco.com"
                    :disabled="isSubmitting"
                    :aria-invalid="showLoginEmailError"
                    aria-describedby="login-email-hint"
                    @blur="emailTouched = true"
                    @input="errorMessage = ''"
                    required
                    class="auth-input w-full bg-[#F8FAFC] border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:bg-white focus:border-[#004B97] focus:ring-3 focus:ring-[#04C4D9]/20 disabled:opacity-60"
                    :class="{
                      'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20':
                        showLoginEmailError,
                    }"
                  />
                </div>
                <p
                  v-if="showLoginEmailError"
                  id="login-email-hint"
                  class="mt-1 text-[11px] font-medium text-rose-600"
                >
                  Ingresa un formato de correo válido (ej. usuario@dominio.com).
                </p>
              </div>

              <!-- Campo: Contraseña -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label
                    for="login-password"
                    class="block text-xs font-semibold text-[#0F172A]"
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    @click="openRecoveryModal"
                    class="text-xs font-semibold text-[#004B97] hover:text-[#04C4D9] focus-visible:outline-none focus-visible:underline underline-offset-4 cursor-pointer link-micro"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <div class="relative group">
                  <div
                    class="input-icon absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#004B97]"
                  >
                    <Lock class="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    placeholder="Ingresa tu contraseña"
                    :disabled="isSubmitting"
                    @input="errorMessage = ''"
                    required
                    class="auth-input w-full bg-[#F8FAFC] border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:bg-white focus:border-[#004B97] focus:ring-3 focus:ring-[#04C4D9]/20 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="icon-btn absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  >
                    <EyeOff v-if="showPassword" class="w-4 h-4" />
                    <Eye v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Botón Primario Corporativo (#004B97 con acento #04C4D9) -->
              <div class="pt-1.5">
                <button
                  type="submit"
                  :disabled="isSubmitting"
                  class="btn-primary group w-full bg-[#004B97] hover:bg-[#003A75] text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-md shadow-[#004B97]/20 disabled:opacity-65 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin text-[#04C4D9]" />
                  <span>{{ isSubmitting ? 'Verificando credenciales...' : 'Iniciar Sesión' }}</span>
                  <ArrowRight
                    v-if="!isSubmitting"
                    class="btn-arrow w-4 h-4 text-[#04C4D9]"
                  />
                </button>
              </div>
            </form>
          </div>

          <!-- ==========================================
               VISTA 2: ACTUALIZACIÓN DE NUEVA CONTRASEÑA
               (Al abrir enlace de correo / mode=reset)
               ========================================== -->
          <div v-else key="reset-view">
            <!-- Estado de Éxito al Actualizar Contraseña -->
            <div v-if="resetSuccess" class="py-4 text-center space-y-4 animate-feedback">
              <div
                class="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center"
              >
                <CheckCircle2 class="w-6 h-6" />
              </div>
              <div class="space-y-1">
                <h2 class="text-base font-bold text-[#0F172A]">
                  ¡Contraseña actualizada!
                </h2>
                <p class="text-xs text-slate-500 leading-relaxed">
                  Tu nueva contraseña ha sido guardada correctamente. Redirigiendo al sistema...
                </p>
              </div>
              <button
                type="button"
                @click="
                  authStore.isAuthenticated
                    ? router.replace(authStore.defaultRoute)
                    : returnToLogin()
                "
                class="btn-primary w-full py-2.5 px-4 rounded-xl bg-[#004B97] hover:bg-[#003A75] text-white text-xs font-semibold cursor-pointer"
              >
                Continuar ahora
              </button>
            </div>

            <!-- Formulario de Nueva Contraseña -->
            <form
              v-else
              @submit.prevent="handlePasswordResetSubmit"
              novalidate
              class="space-y-4"
            >
              <!-- Alerta de Error en Cambio de Contraseña -->
              <div
                v-if="resetError"
                role="alert"
                class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-feedback"
              >
                <AlertCircle class="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div class="flex-1 space-y-1.5">
                  <p>{{ resetError }}</p>
                  <button
                    v-if="resetError.toLowerCase().includes('expirado') || resetError.toLowerCase().includes('enlace')"
                    type="button"
                    @click="openRecoveryModal"
                    class="inline-flex items-center gap-1 text-xs font-bold text-[#004B97] hover:text-[#003A75] underline underline-offset-4 cursor-pointer"
                  >
                    <span>Solicitar un nuevo enlace de correo</span>
                  </button>
                </div>
              </div>

              <!-- Campo: Nueva Contraseña -->
              <div>
                <label
                  for="reset-new-password"
                  class="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Nueva contraseña
                </label>
                <div class="relative group">
                  <div
                    class="input-icon absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#004B97]"
                  >
                    <Lock class="w-4 h-4" />
                  </div>
                  <input
                    id="reset-new-password"
                    v-model="newPassword"
                    :type="showNewPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    :disabled="isResetSubmitting"
                    @input="resetError = ''"
                    required
                    class="auth-input w-full bg-[#F8FAFC] border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:bg-white focus:border-[#004B97] focus:ring-3 focus:ring-[#04C4D9]/20 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    @click="showNewPassword = !showNewPassword"
                    class="icon-btn absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    :aria-label="showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  >
                    <EyeOff v-if="showNewPassword" class="w-4 h-4" />
                    <Eye v-else class="w-4 h-4" />
                  </button>
                </div>

                <!-- Indicador de Fortaleza de Contraseña -->
                <div
                  class="mt-3 p-3 rounded-xl bg-[#F8FAFC] border border-slate-200/90 space-y-2.5"
                  aria-live="polite"
                >
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-slate-600 flex items-center gap-1.5">
                      <ShieldCheck class="w-3.5 h-3.5 text-[#004B97]" />
                      Nivel de seguridad
                    </span>
                    <div class="flex items-center gap-1.5">
                      <span
                        class="font-bold text-xs"
                        :class="passwordStrengthMeta.textColor"
                      >
                        {{ passwordStrengthMeta.label }}
                      </span>
                      <span class="font-mono text-[11px] text-slate-400 tabular-nums">
                        ({{ passwordScore }}/4)
                      </span>
                    </div>
                  </div>

                  <!-- Barra segmentada de 4 niveles -->
                  <div class="grid grid-cols-4 gap-1.5" role="progressbar" :aria-valuenow="passwordScore" aria-valuemin="0" aria-valuemax="4">
                    <div
                      v-for="step in 4"
                      :key="step"
                      class="h-1.5 rounded-full strength-segment"
                      :class="
                        step <= passwordScore
                          ? passwordStrengthMeta.barColor
                          : 'bg-slate-200'
                      "
                    ></div>
                  </div>

                  <!-- Checklist de requisitos -->
                  <ul class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                    <li
                      v-for="rule in passwordCriteria"
                      :key="rule.id"
                      class="flex items-center gap-1.5 text-[11px] rule-item"
                      :class="
                        rule.met
                          ? 'text-emerald-700 font-medium'
                          : 'text-slate-500'
                      "
                    >
                      <span
                        class="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 rule-badge"
                        :class="
                          rule.met
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-slate-200/80 text-slate-400'
                        "
                      >
                        <Check class="w-2.5 h-2.5 stroke-[2.5]" />
                      </span>
                      <span>{{ rule.label }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Campo: Confirmar Nueva Contraseña -->
              <div>
                <label
                  for="reset-confirm-password"
                  class="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Confirmar nueva contraseña
                </label>
                <div class="relative group">
                  <div
                    class="input-icon absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#004B97]"
                  >
                    <Lock class="w-4 h-4" />
                  </div>
                  <input
                    id="reset-confirm-password"
                    v-model="confirmPassword"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    autocomplete="new-password"
                    placeholder="Repite tu nueva contraseña"
                    :disabled="isResetSubmitting"
                    :aria-invalid="showPasswordMismatch"
                    @input="resetError = ''"
                    required
                    class="auth-input w-full bg-[#F8FAFC] border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:bg-white focus:border-[#004B97] focus:ring-3 focus:ring-[#04C4D9]/20 disabled:opacity-60"
                    :class="{
                      'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20':
                        showPasswordMismatch,
                      'border-emerald-400 focus:border-emerald-500':
                        passwordsMatch,
                    }"
                  />
                  <button
                    type="button"
                    @click="showConfirmPassword = !showConfirmPassword"
                    class="icon-btn absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    :aria-label="showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'"
                  >
                    <EyeOff v-if="showConfirmPassword" class="w-4 h-4" />
                    <Eye v-else class="w-4 h-4" />
                  </button>
                </div>

                <p
                  v-if="showPasswordMismatch"
                  class="mt-1 text-[11px] font-medium text-rose-600"
                >
                  Las contraseñas no coinciden.
                </p>
                <p
                  v-else-if="passwordsMatch"
                  class="mt-1 text-[11px] font-medium text-emerald-600 flex items-center gap-1"
                >
                  <Check class="w-3 h-3 stroke-[2.5]" />
                  <span>Las contraseñas coinciden.</span>
                </p>
              </div>

              <!-- Acciones de Actualización -->
              <div class="pt-1 space-y-2.5">
                <button
                  type="submit"
                  :disabled="!canSubmitNewPassword"
                  class="btn-primary w-full bg-[#004B97] hover:bg-[#003A75] text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-md shadow-[#004B97]/20 disabled:opacity-55 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Loader2
                    v-if="isResetSubmitting"
                    class="w-4 h-4 animate-spin text-[#04C4D9]"
                  />
                  <span>
                    {{
                      isResetSubmitting
                        ? 'Actualizando contraseña...'
                        : 'Guardar Nueva Contraseña'
                    }}
                  </span>
                </button>

                <button
                  type="button"
                  @click="returnToLogin"
                  class="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 flex items-center justify-center gap-1.5 cursor-pointer link-micro"
                >
                  <ArrowLeft class="w-3.5 h-3.5" />
                  <span>Volver al inicio de sesión</span>
                </button>
              </div>
            </form>
          </div>
        </Transition>
      </div>
    </div>

    <!-- ==========================================
         MODAL DE RECUPERACIÓN DE CONTRASEÑA
         (supabase.auth.resetPasswordForEmail)
         ========================================== -->
    <Transition name="modal-fade">
      <div
        v-if="isRecoveryOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/70 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-modal-title"
        @click.self="closeRecoveryModal"
      >
        <div
          class="modal-card bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative"
        >
          <!-- Barra superior de acento -->
          <div class="h-1 w-full bg-gradient-to-r from-[#004B97] via-[#04C4D9] to-[#004B97]"></div>

          <div class="p-6 sm:p-7">
            <!-- Botón Cerrar -->
            <button
              type="button"
              @click="closeRecoveryModal"
              class="icon-btn absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Cerrar ventana de recuperación"
            >
              <X class="w-4 h-4" />
            </button>

            <!-- Paso 1: Solicitar enlace por correo -->
            <div v-if="!recoverySent">
              <div class="flex items-center gap-3 mb-4">
                <div
                  class="w-11 h-11 rounded-xl bg-[#004B97]/10 border border-[#004B97]/15 text-[#004B97] flex items-center justify-center shrink-0"
                >
                  <KeyRound class="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="recovery-modal-title"
                    class="text-base font-bold text-[#0F172A]"
                  >
                    Recuperar contraseña
                  </h2>
                  <p class="text-xs text-slate-500">
                    Verificación por correo electrónico
                  </p>
                </div>
              </div>

              <p class="text-xs text-slate-600 mb-4 leading-relaxed">
                Ingresa el correo asociado a tu cuenta de <strong>JR Blanco</strong>. Te enviaremos un enlace seguro para que definas una nueva contraseña.
              </p>

              <!-- Mensaje de error en modal -->
              <div
                v-if="recoveryError"
                role="alert"
                class="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 animate-feedback"
              >
                <AlertCircle class="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{{ recoveryError }}</span>
              </div>

              <form @submit.prevent="handleRecoverySubmit" novalidate class="space-y-4">
                <div>
                  <label
                    for="recovery-email-input"
                    class="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Correo electrónico registrado
                  </label>
                  <div class="relative group">
                    <div
                      class="input-icon absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#004B97]"
                    >
                      <Mail class="w-4 h-4" />
                    </div>
                    <input
                      id="recovery-email-input"
                      v-model="recoveryEmail"
                      type="email"
                      inputmode="email"
                      autocomplete="email"
                      placeholder="nombre@jrblanco.com"
                      :disabled="isRecoverySubmitting"
                      @input="recoveryError = ''"
                      required
                      class="auth-input w-full bg-[#F8FAFC] border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:bg-white focus:border-[#004B97] focus:ring-3 focus:ring-[#04C4D9]/20 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div class="pt-1 flex items-center gap-2.5">
                  <button
                    type="button"
                    @click="closeRecoveryModal"
                    class="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    :disabled="isRecoverySubmitting || !recoveryEmail.trim()"
                    class="btn-primary flex-1 py-2.5 px-4 rounded-xl bg-[#004B97] hover:bg-[#003A75] text-white text-xs font-semibold shadow-sm shadow-[#004B97]/20 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Loader2
                      v-if="isRecoverySubmitting"
                      class="w-3.5 h-3.5 animate-spin text-[#04C4D9]"
                    />
                    <span>
                      {{ isRecoverySubmitting ? 'Enviando...' : 'Enviar enlace' }}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            <!-- Paso 2: Confirmación de Enlace Enviado -->
            <div v-else class="text-center py-2 space-y-4 animate-feedback">
              <div
                class="w-12 h-12 mx-auto rounded-2xl bg-[#04C4D9]/15 border border-[#04C4D9]/30 text-[#004B97] flex items-center justify-center"
              >
                <CheckCircle2 class="w-6 h-6 text-[#04C4D9]" />
              </div>

              <div class="space-y-1.5">
                <h3 class="text-base font-bold text-[#0F172A]">
                  Revisa tu correo electrónico
                </h3>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Enviamos un enlace de recuperación a
                  <strong class="text-[#0F172A] font-semibold">{{ recoveryEmail }}</strong>.
                  Haz clic en el enlace del mensaje para definir tu nueva contraseña.
                </p>
              </div>

              <div class="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-left text-[11px] text-slate-500 space-y-1">
                <p class="font-semibold text-slate-700">¿No encuentras el correo?</p>
                <p>Revisa tu carpeta de spam o correo no deseado. El enlace es válido por tiempo limitado.</p>
              </div>

              <div class="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  @click="closeRecoveryModal"
                  class="btn-primary w-full py-2.5 rounded-xl bg-[#004B97] hover:bg-[#003A75] text-white text-xs font-semibold cursor-pointer"
                >
                  Volver al inicio de sesión
                </button>
                <button
                  type="button"
                  @click="recoverySent = false"
                  class="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-[#004B97] cursor-pointer link-micro"
                >
                  Enviar a otro correo o reintentar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Curvas de animación precisas (emil-design-eng & animate) */
.auth-card {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}

.auth-input {
  transition:
    background-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
    border-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.input-icon {
  transition: color 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.icon-btn {
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
}

.icon-btn:active {
  transform: scale(0.94);
}

.btn-primary {
  transition:
    background-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 160ms ease;
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-secondary {
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
}

.btn-secondary:active {
  transform: scale(0.98);
}

.btn-arrow {
  transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (hover: hover) and (pointer: fine) {
  .btn-primary:hover:not(:disabled) .btn-arrow {
    transform: translateX(3px);
  }
}

.link-micro {
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.strength-segment {
  transition: background-color 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.rule-item,
.rule-badge {
  transition:
    color 160ms ease,
    background-color 160ms ease;
}

/* Transición entre Vista Login y Vista Nueva Contraseña */
.view-switch-enter-active {
  transition:
    opacity 200ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.view-switch-leave-active {
  transition:
    opacity 140ms ease-in,
    transform 140ms ease-in;
}

.view-switch-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.99);
}

.view-switch-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

/* Transición del Modal de Recuperación */
.modal-fade-enter-active {
  transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.modal-fade-leave-active {
  transition: opacity 150ms ease-in;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-card {
  transition:
    transform 220ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 220ms cubic-bezier(0.23, 1, 0.32, 1);
}

.modal-fade-leave-active .modal-card {
  transition:
    transform 150ms ease-in,
    opacity 150ms ease-in;
}

.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}

@keyframes feedback-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-feedback {
  animation: feedback-in 180ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .auth-input,
  .input-icon,
  .icon-btn,
  .btn-primary,
  .btn-secondary,
  .btn-arrow,
  .link-micro,
  .strength-segment,
  .rule-item,
  .rule-badge,
  .view-switch-enter-active,
  .view-switch-leave-active,
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-fade-enter-active .modal-card,
  .modal-fade-leave-active .modal-card {
    transition: none !important;
    transform: none !important;
  }

  .animate-feedback {
    animation: none !important;
  }
}
</style>
