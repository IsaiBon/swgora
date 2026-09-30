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
  ShieldCheck,
  Wrench,
  Eye,
  EyeOff,
  User,
  Lock,
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// State
const username = ref('admin@jrblanco.com')
const password = ref('admin123')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

// Recovery modal state
const isRecoveryOpen = ref(false)
const recoveryInput = ref('')
const isRecoverySubmitting = ref(false)
const recoverySent = ref(false)

const fillDemo = (role: 'Administrador' | 'Operador' | 'Consultor') => {
  if (role === 'Administrador') {
    username.value = 'admin@jrblanco.com'
    password.value = 'admin123'
  } else if (role === 'Operador') {
    username.value = 'operador@jrblanco.com'
    password.value = 'operador123'
  } else {
    username.value = 'consultor@jrblanco.com'
    password.value = 'consultor123'
  }
}

const handleLogin = async () => {
  errorMessage.value = ''
  if (!username.value.trim()) {
    errorMessage.value = 'Por favor ingresa tu usuario o correo.'
    return
  }
  if (!password.value) {
    errorMessage.value = 'Por favor ingresa tu contraseña.'
    return
  }

  isSubmitting.value = true
  try {
    await authStore.login(username.value, password.value)
    router.push(authStore.defaultRoute)
  } catch (err: any) {
    errorMessage.value = err?.message || 'Error al procesar el ingreso.'
  } finally {
    isSubmitting.value = false
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
      <div class="flex flex-col items-center justify-center mb-5 text-center">
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-950 p-1.5 shadow-xl ring-4 ring-[#04c4d9]/30 flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105">
          <img
            src="/logo-taller.png"
            alt="Logo Oficial Taller JR Blanco"
            class="w-full h-full object-contain select-none"
            @error="(e: any) => { e.target.style.display = 'none' }"
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

      <!-- Selector Rápido de Roles para Pruebas / Demostración -->
      <div class="mb-4 bg-slate-100 p-1 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-1 text-[11px]">
        <button
          type="button"
          @click="fillDemo('Administrador')"
          class="flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-slate-600 hover:text-slate-900 cursor-pointer"
          :class="username.includes('admin') ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-white/80'"
          title="Acceso total (Dashboard, Clientes, Órdenes, Catálogo)"
        >
          <ShieldCheck class="w-3.5 h-3.5 text-[#04c4d9]" />
          <span>Admin</span>
        </button>
        <button
          type="button"
          @click="fillDemo('Operador')"
          class="flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-slate-600 hover:text-slate-900 cursor-pointer"
          :class="username.includes('operador') ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-white/80'"
          title="Órdenes de Trabajo y Catálogo de Repuestos"
        >
          <Wrench class="w-3.5 h-3.5 text-amber-500" />
          <span>Operador</span>
        </button>
        <button
          type="button"
          @click="fillDemo('Consultor')"
          class="flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all text-slate-600 hover:text-slate-900 cursor-pointer"
          :class="username.includes('consultor') ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-white/80'"
          title="Consulta exclusiva de Catálogo de Repuestos"
        >
          <Eye class="w-3.5 h-3.5 text-emerald-500" />
          <span>Consultor</span>
        </button>
      </div>

      <!-- Mensaje de Error -->
      <div
        v-if="errorMessage"
        class="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"
      >
        <AlertCircle class="w-4 h-4 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Formulario -->
      <form @submit.prevent="handleLogin" class="space-y-3.5">
        <!-- Campo Usuario -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1 pl-1">
            Usuario o Correo
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User class="w-4 h-4" />
            </div>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              placeholder="admin@jrblanco.com"
              required
              class="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#04c4d9] focus:ring-2 focus:ring-[#04c4d9]/30"
            />
          </div>
        </div>

        <!-- Campo Contraseña -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1 pl-1">
            Contraseña
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock class="w-4 h-4" />
            </div>
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              required
              class="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#04c4d9] focus:ring-2 focus:ring-[#04c4d9]/30"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
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
            <span>{{ isSubmitting ? 'Ingresando...' : 'Iniciar Sesión' }}</span>
            <ArrowRight v-if="!isSubmitting" class="w-4 h-4" />
          </button>
        </div>

        <!-- Enlaces Secundarios: Recuperar Acceso -->
        <div class="pt-2 text-center">
          <button
            type="button"
            @click="isRecoveryOpen = true"
            class="text-xs text-slate-500 hover:text-slate-900 font-medium transition underline-offset-4 hover:underline"
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
            Ingresa tu correo electrónico corporativo o usuario registrado. Te enviaremos un código de seguridad para restablecer tu contraseña.
          </p>

          <form @submit.prevent="handleRecoverySubmit" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1 pl-1">
                Correo o Teléfono
              </label>
              <input
                v-model="recoveryInput"
                type="text"
                placeholder="ejemplo@jrblanco.com o 7831-2641"
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
              Hemos enviado las instrucciones a <strong>{{ recoveryInput }}</strong>. Revisa tu bandeja de entrada o mensajes.
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
