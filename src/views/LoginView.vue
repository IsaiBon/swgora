<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// State
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

// Recovery modal state
const isRecoveryOpen = ref(false)
const recoveryInput = ref('')
const isRecoverySubmitting = ref(false)
const recoverySent = ref(false)

const handleLogin = async () => {
  errorMessage.value = ''
  const cleanEmail = email.value.trim()

  if (!cleanEmail) {
    errorMessage.value = 'Por favor ingresa tu correo electrónico.'
    return
  }
  if (!password.value) {
    errorMessage.value = 'Por favor ingresa tu contraseña.'
    return
  }

  isSubmitting.value = true
  try {
    await authStore.login(cleanEmail, password.value)
    await router.replace(authStore.defaultRoute)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Error al procesar el ingreso.'
  } finally {
    isSubmitting.value = false
  }
}

const handleLogoError = (e: Event) => {
  const target = e.target as HTMLImageElement | null
  if (target) {
    target.style.display = 'none'
  }
}

const handleRecoverySubmit = () => {
  if (!recoveryInput.value.trim()) return
  isRecoverySubmitting.value = true
  setTimeout(() => {
    isRecoverySubmitting.value = false
    recoverySent.value = true
  }, 600)
}

const closeRecoveryModal = () => {
  isRecoveryOpen.value = false
  recoverySent.value = false
  recoveryInput.value = ''
}
</script>

<template>
  <div class="w-full max-w-sm sm:max-w-md mx-auto">
    <!-- Card Principal de Login Formal Corporativo -->
    <div
      class="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/80 transition-all duration-300"
    >
      <!-- Branding Corporativo Oficial: Logo Taller JR Blanco -->
      <div class="flex flex-col items-center justify-center mb-6 text-center">
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-950 p-1.5 shadow-xl ring-4 ring-[#04c4d9]/30 flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105">
          <img
            src="/logo-taller.png"
            alt="Logo Oficial Taller JR Blanco"
            class="w-full h-full object-contain select-none"
            @error="handleLogoError"
          />
        </div>
        <h1 class="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-3 uppercase">
          JR Blanco
        </h1>
        <p class="text-[11px] font-bold text-[#04c4d9] tracking-wider uppercase">
          Taller Industrial y Rectificado de Motores
        </p>
        <p class="text-xs text-slate-500 mt-1">
          Ingresa tus credenciales para acceder al sistema
        </p>
      </div>

      <!-- Mensaje de Error -->
      <div
        v-if="errorMessage"
        role="alert"
        class="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2"
      >
        <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Formulario de Autenticación Directa -->
      <form @submit.prevent="handleLogin" novalidate class="space-y-4">
        <!-- Campo Correo Electrónico -->
        <div>
          <label
            for="login-email"
            class="block text-xs font-bold text-slate-700 mb-1.5 pl-1"
          >
            Correo Electrónico
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail class="w-4 h-4" />
            </div>
            <input
              id="login-email"
              v-model="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              placeholder="correo@ejemplo.com"
              :disabled="isSubmitting"
              @input="errorMessage = ''"
              required
              class="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#04c4d9] focus:ring-2 focus:ring-[#04c4d9]/30 disabled:opacity-60"
            />
          </div>
        </div>

        <!-- Campo Contraseña -->
        <div>
          <label
            for="login-password"
            class="block text-xs font-bold text-slate-700 mb-1.5 pl-1"
          >
            Contraseña
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
              class="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#04c4d9] focus:ring-2 focus:ring-[#04c4d9]/30 disabled:opacity-60"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              tabindex="-1"
              title="Mostrar / ocultar contraseña"
            >
              <EyeOff v-if="showPassword" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Botón Entrar Formal Corporativo -->
        <div class="pt-2">
          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full bg-[#04c4d9] hover:bg-[#03a9bc] active:scale-[0.99] text-white font-bold py-3 px-6 rounded-full text-center text-sm tracking-wide transition-all shadow-lg shadow-[#04c4d9]/25 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <span>{{ isSubmitting ? 'Validando acceso...' : 'Iniciar Sesión' }}</span>
            <ArrowRight v-if="!isSubmitting" class="w-4 h-4" />
          </button>
        </div>

        <!-- Enlaces Secundarios: Recuperar Acceso -->
        <div class="pt-1 text-center">
          <button
            type="button"
            @click="isRecoveryOpen = true"
            class="text-xs text-slate-500 hover:text-slate-900 font-medium transition underline-offset-4 hover:underline cursor-pointer"
          >
            ¿Olvidaste tu contraseña? Recuperar acceso
          </button>
        </div>
      </form>
    </div>

    <!-- Modal de Recuperación de Acceso -->
    <div
      v-if="isRecoveryOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="closeRecoveryModal"
    >
      <div
        class="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative"
      >
        <!-- Botón Cerrar -->
        <button
          type="button"
          @click="closeRecoveryModal"
          class="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X class="w-5 h-5" />
        </button>

        <div v-if="!recoverySent">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-2xl bg-[#04c4d9]/15 text-[#04c4d9] flex items-center justify-center">
              <KeyRound class="w-6 h-6" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Recuperar Acceso</h3>
              <p class="text-xs text-slate-500">JR Blanco - Taller Industrial</p>
            </div>
          </div>

          <p class="text-xs text-slate-600 mb-5 leading-relaxed">
            Ingresa tu correo electrónico registrado. Te enviaremos las instrucciones para restablecer tu contraseña.
          </p>

          <form @submit.prevent="handleRecoverySubmit" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1 pl-1">
                Correo Electrónico
              </label>
              <input
                v-model="recoveryInput"
                type="email"
                placeholder="correo@ejemplo.com"
                required
                class="w-full bg-slate-50 border border-slate-300 rounded-full px-5 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#04c4d9] focus:bg-white"
              />
            </div>

            <div class="pt-2 flex gap-3">
              <button
                type="button"
                @click="closeRecoveryModal"
                class="flex-1 py-2.5 px-4 rounded-full border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isRecoverySubmitting"
                class="flex-1 py-2.5 px-4 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-semibold transition disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{{ isRecoverySubmitting ? 'Enviando...' : 'Enviar Código' }}</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Estado de éxito en recuperación -->
        <div v-else class="text-center py-4 space-y-4">
          <div class="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 class="w-8 h-8" />
          </div>
          <div>
            <h4 class="text-base font-bold text-slate-900">¡Enlace Enviado!</h4>
            <p class="text-xs text-slate-500 mt-1">
              Hemos enviado las instrucciones a <strong>{{ recoveryInput }}</strong>. Revisa tu bandeja de entrada.
            </p>
          </div>
          <button
            type="button"
            @click="closeRecoveryModal"
            class="w-full py-2.5 rounded-full bg-[#04c4d9] hover:bg-[#03a9bc] text-white text-xs font-bold transition cursor-pointer"
          >
            Entendido, volver al Login
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
