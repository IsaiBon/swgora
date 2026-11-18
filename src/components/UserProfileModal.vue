<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { perfilesService } from '@/services/perfilesService'
import { cambiarPasswordUsuario } from '@/services/usuariosService'
import RoleBadge from '@/components/RoleBadge.vue'
import {
  X,
  Camera,
  Trash2,
  User as UserIcon,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  MapPin,
  Building2,
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()

const avatarInputRef = ref<HTMLInputElement | null>(null)
const nombreInput = ref('')
const nuevaPassword = ref('')
const mostrarPassword = ref(false)

const uploadingAvatar = ref(false)
const savingNombre = ref(false)
const savingPassword = ref(false)
const statusMessage = ref('')
const statusType = ref<'ok' | 'error'>('ok')

const userInitials = computed(() => {
  const parts = (authStore.user?.name || 'US').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'US'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] || ''}${parts[1]![0] || ''}`.toUpperCase()
})

const hasCustomAvatar = computed(() => {
  const url = authStore.user?.avatar || ''
  return Boolean(url) && !url.includes('images.unsplash.com/photo-1472099645785-5658abf4ff4e')
})

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nombreInput.value = authStore.user?.name || ''
      nuevaPassword.value = ''
      mostrarPassword.value = false
      statusMessage.value = ''
      statusType.value = 'ok'
    }
  }
)

const setFeedback = (type: 'ok' | 'error', msg: string) => {
  statusType.value = type
  statusMessage.value = msg
}

const triggerPickAvatar = () => {
  if (uploadingAvatar.value || !authStore.user?.id) return
  if (avatarInputRef.value) {
    avatarInputRef.value.value = ''
    avatarInputRef.value.click()
  }
}

const handleAvatarFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  const userId = authStore.user?.id
  if (!file || !userId) return

  if (!file.type.startsWith('image/')) {
    setFeedback('error', 'Selecciona un archivo de imagen válido (JPG, PNG o WebP).')
    return
  }

  uploadingAvatar.value = true
  statusMessage.value = ''
  try {
    const uploadedUrl = await perfilesService.uploadAvatar(file, userId)
    const { persistedInDb } = await perfilesService.updateAvatar(userId, uploadedUrl)
    authStore.updateCurrentUserProfile({ avatar_url: uploadedUrl })
    setFeedback(
      'ok',
      persistedInDb
        ? 'Tu foto de perfil se actualizó correctamente.'
        : 'Tu foto de perfil se actualizó en este navegador.'
    )
  } catch (err: unknown) {
    setFeedback(
      'error',
      err instanceof Error ? err.message : 'No se pudo actualizar tu foto de perfil.'
    )
  } finally {
    uploadingAvatar.value = false
  }
}

const handleRemoveAvatar = async () => {
  const userId = authStore.user?.id
  if (!userId || uploadingAvatar.value) return
  uploadingAvatar.value = true
  statusMessage.value = ''
  try {
    await perfilesService.updateAvatar(userId, null)
    authStore.updateCurrentUserProfile({ avatar_url: null })
    setFeedback('ok', 'Tu foto de perfil fue restablecida.')
  } catch (err: unknown) {
    setFeedback(
      'error',
      err instanceof Error ? err.message : 'No se pudo quitar la foto de perfil.'
    )
  } finally {
    uploadingAvatar.value = false
  }
}

const handleSaveNombre = async () => {
  const userId = authStore.user?.id
  if (!userId || savingNombre.value) return
  const cleanName = nombreInput.value.trim().replace(/\s+/g, ' ')
  if (cleanName.length < 2) {
    setFeedback('error', 'Escribe un nombre válido de al menos 2 caracteres.')
    return
  }
  if (cleanName === authStore.user?.name) {
    setFeedback('ok', 'Tu nombre ya está actualizado.')
    return
  }

  savingNombre.value = true
  statusMessage.value = ''
  try {
    const hasSession = await perfilesService.hasLiveSupabaseSession()
    if (hasSession && !authStore.isVaultSession) {
      await perfilesService.updatePerfil(userId, { nombre: cleanName })
    } else {
      perfilesService.updatePerfilInCache(userId, { nombre: cleanName })
    }
    authStore.updateCurrentUserProfile({ nombre: cleanName })
    setFeedback(
      'ok',
      hasSession && !authStore.isVaultSession
        ? 'Tu nombre fue actualizado correctamente.'
        : 'Tu nombre fue actualizado en este navegador.'
    )
  } catch (err: unknown) {
    setFeedback(
      'error',
      err instanceof Error ? err.message : 'No se pudo actualizar tu nombre.'
    )
  } finally {
    savingNombre.value = false
  }
}

const generateQuickPassword = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digitos = '23456789'
  const pick = (pool: string, len: number) =>
    Array.from({ length: len }, () => pool[Math.floor(Math.random() * pool.length)]).join('')
  nuevaPassword.value = `${pick(letras, 4)}-${pick(digitos, 4)}`
  mostrarPassword.value = true
}

const handleSavePassword = async () => {
  const userId = authStore.user?.id
  const userEmail = authStore.user?.email
  if (!userId || savingPassword.value) return

  const cleanPwd = nuevaPassword.value.trim()
  if (cleanPwd.length < 6) {
    setFeedback('error', 'La contraseña debe tener al menos 6 caracteres.')
    return
  }

  savingPassword.value = true
  statusMessage.value = ''
  try {
    const res = await cambiarPasswordUsuario({
      id: userId,
      email: userEmail,
      password: cleanPwd,
    })
    nuevaPassword.value = ''
    setFeedback(
      res.updatedInAuth || res.syncedInCloud ? 'ok' : 'error',
      res.updatedInAuth
        ? 'Tu contraseña se actualizó correctamente en Supabase Auth.'
        : res.syncedInCloud
          ? 'Tu contraseña se sincronizó en la bóveda en la nube.'
          : 'Solo se guardó localmente; inicia sesión con tu cuenta para sincronizar en la nube.'
    )
  } catch (err: unknown) {
    setFeedback(
      'error',
      err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.'
    )
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && authStore.user"
      class="fixed inset-0 z-[110] flex items-center justify-center bg-[#09132B]/70 backdrop-blur-sm p-4"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-mi-perfil-modal"
        class="studio-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden popover-pop-in"
      >
        <!-- Cabecera corporativa -->
        <div class="bg-gradient-to-r from-[#0D1B3E] via-[#004B97] to-[#0284C7] px-6 py-5 text-white flex items-start justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] aspect-square rounded-2xl bg-white/15 border border-white/25 overflow-hidden flex items-center justify-center shrink-0">
              <img
                v-if="authStore.user.avatar"
                :src="authStore.user.avatar"
                :alt="authStore.user.name"
                class="w-full h-full max-w-full max-h-full object-cover object-center block"
              />
              <span v-else class="text-sm font-black text-[#BFEBF2]">{{ userInitials }}</span>
            </div>
            <div class="min-w-0">
              <h2 id="titulo-mi-perfil-modal" class="text-base sm:text-lg font-extrabold font-display truncate">
                Mi Perfil y Datos
              </h2>
              <p class="text-xs text-blue-100/90 truncate font-mono">
                {{ authStore.user.email }}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Cerrar perfil"
            @click="emit('close')"
            class="rounded-xl p-2 text-white/75 transition hover:bg-white/15 hover:text-white cursor-pointer"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="p-5 sm:p-6 space-y-5">
          <!-- 1. FOTO DE PERFIL -->
          <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <input
              ref="avatarInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarFileSelected"
            />
            <div class="flex items-center gap-3.5 min-w-0 flex-1">
              <div class="relative shrink-0">
                <div class="w-16 h-16 sm:w-[72px] sm:h-[72px] min-w-[64px] min-h-[64px] max-w-[72px] max-h-[72px] aspect-square rounded-2xl overflow-hidden border-2 border-[#04C4D9]/60 bg-gradient-to-br from-[#0D1B3E] to-[#004B97] flex items-center justify-center text-white font-black shadow-sm shrink-0">
                  <img
                    v-if="authStore.user.avatar"
                    :src="authStore.user.avatar"
                    :alt="authStore.user.name"
                    class="w-full h-full max-w-full max-h-full object-cover object-center block"
                    style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
                  />
                  <span v-else>{{ userInitials }}</span>
                </div>
              </div>
              <div class="min-w-0">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Foto de perfil
                </h3>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  Visible en la barra superior y en tu cuenta de taller.
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                :disabled="uploadingAvatar"
                @click="triggerPickAvatar"
                class="inline-flex items-center gap-1.5 rounded-xl bg-[#004B97] hover:bg-[#0D1B3E] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Loader2 v-if="uploadingAvatar" class="w-3.5 h-3.5 animate-spin" />
                <Camera v-else class="w-3.5 h-3.5" />
                <span>{{ uploadingAvatar ? 'Subiendo…' : (hasCustomAvatar ? 'Cambiar foto' : 'Subir foto') }}</span>
              </button>

              <button
                v-if="hasCustomAvatar"
                type="button"
                :disabled="uploadingAvatar"
                @click="handleRemoveAvatar"
                class="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            </div>
          </div>

          <!-- 2. MIS DATOS PERSONALES -->
          <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                <UserIcon class="w-3.5 h-3.5 text-[#004B97]" />
                <span>Mis datos personales</span>
              </span>
              <RoleBadge :role="authStore.user.role || 'Consultor'" size="sm" />
            </div>

            <form class="space-y-3" @submit.prevent="handleSaveNombre">
              <div>
                <label for="mi-perfil-nombre" class="block text-[11px] font-bold text-slate-600 mb-1">
                  Nombre completo
                </label>
                <div class="flex flex-col sm:flex-row gap-2">
                  <input
                    id="mi-perfil-nombre"
                    v-model="nombreInput"
                    type="text"
                    required
                    maxlength="120"
                    :disabled="savingNombre"
                    placeholder="Tu nombre completo"
                    class="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-[#0D1B3E] outline-none transition focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/25"
                  />
                  <button
                    type="submit"
                    :disabled="savingNombre || nombreInput.trim() === authStore.user.name"
                    class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#004B97] hover:bg-[#0D1B3E] px-4 py-2 text-xs font-bold text-white transition cursor-pointer disabled:opacity-45"
                  >
                    <Loader2 v-if="savingNombre" class="w-3.5 h-3.5 animate-spin" />
                    <Save v-else class="w-3.5 h-3.5" />
                    <span>{{ savingNombre ? 'Guardando…' : 'Guardar nombre' }}</span>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Correo de acceso</span>
                  <span class="block mt-0.5 font-mono font-bold text-[#0D1B3E] truncate" :title="authStore.user.email">
                    {{ authStore.user.email }}
                  </span>
                </div>

                <div
                  v-if="authStore.isSubAdmin && authStore.activeRutaNombre"
                  class="rounded-xl border border-cyan-200 bg-cyan-50/60 px-3 py-2"
                >
                  <span class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#038391]">
                    <MapPin class="w-3 h-3" />
                    <span>Ruta asignada</span>
                  </span>
                  <span class="block mt-0.5 font-mono font-bold text-[#004B97] truncate">
                    {{ authStore.activeRutaCodigo ? `${authStore.activeRutaCodigo} · ` : '' }}{{ authStore.activeRutaNombre }}
                  </span>
                </div>
                <div
                  v-else-if="authStore.user.isIndependent && authStore.activeTenantWorkshopName"
                  class="rounded-xl border border-cyan-200 bg-cyan-50/60 px-3 py-2"
                >
                  <span class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#038391]">
                    <Building2 class="w-3 h-3" />
                    <span>Taller propio</span>
                  </span>
                  <span class="block mt-0.5 font-bold text-[#004B97] truncate">
                    {{ authStore.activeTenantWorkshopName }}
                  </span>
                </div>
              </div>
            </form>
          </div>

          <!-- 3. CAMBIAR MI CONTRASEÑA -->
          <form
            class="rounded-2xl border border-[#04C4D9]/35 bg-sky-50/55 p-4 space-y-3"
            @submit.prevent="handleSavePassword"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <label for="mi-perfil-password" class="text-xs font-extrabold uppercase tracking-wider text-[#0D1B3E]">
                Cambiar mi contraseña
              </label>
              <button
                type="button"
                :disabled="savingPassword"
                @click="generateQuickPassword"
                class="inline-flex items-center gap-1 rounded-full border border-[#04C4D9]/50 bg-white px-2.5 py-1 text-[11px] font-bold text-[#004B97] transition hover:bg-sky-100 cursor-pointer disabled:opacity-50"
              >
                <Sparkles class="h-3 w-3 text-[#04C4D9]" />
                <span>Generar clave</span>
              </button>
            </div>

            <div class="relative">
              <input
                id="mi-perfil-password"
                v-model="nuevaPassword"
                :type="mostrarPassword ? 'text' : 'password'"
                :disabled="savingPassword"
                placeholder="Nueva contraseña (mínimo 6 caracteres)"
                class="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold text-[#0D1B3E] placeholder-slate-400 outline-none transition focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/25"
              />
              <button
                type="button"
                @click="mostrarPassword = !mostrarPassword"
                class="absolute right-2.5 top-2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[#0D1B3E] cursor-pointer"
                :title="mostrarPassword ? 'Ocultar' : 'Mostrar'"
              >
                <EyeOff v-if="mostrarPassword" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </button>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-[11px] font-medium text-slate-500">
                Mínimo 6 caracteres · Aplica para tu cuenta actual
              </span>
              <button
                type="submit"
                :disabled="savingPassword || nuevaPassword.trim().length < 6"
                class="inline-flex items-center gap-1.5 rounded-xl studio-cta-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-45 cursor-pointer"
              >
                <Loader2 v-if="savingPassword" class="w-3.5 h-3.5 animate-spin" />
                <KeyRound v-else class="w-3.5 h-3.5" />
                <span>{{ savingPassword ? 'Actualizando…' : 'Actualizar contraseña' }}</span>
              </button>
            </div>
          </form>

          <!-- Feedback -->
          <div
            v-if="statusMessage"
            role="status"
            class="rounded-xl border p-3 text-xs font-semibold flex items-center gap-2"
            :class="
              statusType === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900'
            "
          >
            <AlertCircle v-if="statusType === 'error'" class="w-4 h-4 shrink-0 text-rose-600" />
            <CheckCircle2 v-else class="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{{ statusMessage }}</span>
          </div>

          <div class="flex justify-end pt-1">
            <button
              type="button"
              @click="emit('close')"
              class="rounded-xl bg-[#0D1B3E] hover:bg-[#004B97] px-5 py-2 text-xs font-bold text-white transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
