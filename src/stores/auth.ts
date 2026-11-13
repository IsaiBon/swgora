import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/authService'
import { perfilesService } from '@/services/perfilesService'
import { registrarCredencialUsuario } from '@/services/usuariosService'
import {
  parseSubAdminRole,
  parseIndependentRole,
  getIndependentTenantForUser,
  setActiveTenantContext,
  rutasService,
} from '@/services/rutasService'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

export type UserRole =
  | 'Administrador'
  | 'Taller Independiente'
  | 'Sub-Administrador'
  | 'Operador'
  | 'Consultor'
  | string

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  rawRole?: string
  isIndependent?: boolean
  tenantId?: string
  tenantWorkshopName?: string
  rutaId?: string
  rutaCodigo?: string
  rutaNombre?: string
  avatar?: string
}

const STORAGE_KEY = 'swgora_active_user'

/**
 * Normaliza cualquier string de rol a los roles oficiales del sistema
 */
export function normalizeRole(
  role?: string | null
):
  | 'Administrador'
  | 'Taller Independiente'
  | 'Sub-Administrador'
  | 'Operador'
  | 'Consultor' {
  if (!role) return 'Consultor'
  const indInfo = parseIndependentRole(role)
  if (indInfo.isIndependent) return 'Taller Independiente'
  const subAdminInfo = parseSubAdminRole(role)
  if (subAdminInfo.isSubAdmin) return 'Sub-Administrador'
  const lower = role.toLowerCase().trim()
  if (lower.includes('admin')) return 'Administrador'
  if (lower.includes('consult')) return 'Consultor'
  if (
    lower.includes('oper') ||
    lower.includes('taller') ||
    lower.includes('tecnic')
  ) {
    return 'Operador'
  }
  return 'Consultor'
}

/**
 * Retorna la ruta principal por defecto según el rol del usuario
 */
export function getDefaultRouteForRole(role: string): string {
  const norm = normalizeRole(role)
  switch (norm) {
    case 'Administrador':
    case 'Taller Independiente':
      return '/dashboard'
    case 'Sub-Administrador':
    case 'Operador':
      return '/ordenes'
    case 'Consultor':
      return '/catalogo'
    default:
      return '/catalogo'
  }
}

/**
 * Determina si una ruta es accesible por un rol determinado
 * - Administrador: Acceso completo a todo el sistema (incluyendo /rutas y /usuarios)
 * - Taller Independiente: Sistema propio aislado (Dashboard, Órdenes, Clientes, Mi Taller y Catálogo compartido; sin /usuarios ni /rutas)
 * - Sub-Administrador: Administra todas las órdenes de trabajo, clientes y catálogo pero SOLO de su ruta asignada
 * - Operador: Solo puede ver Órdenes y Catálogo (además de login)
 * - Consultor: Solo puede ver Catálogo (además de login). NUNCA Órdenes ni Clientes ni Dashboard.
 */
export function isRouteAllowedForRole(path: string, role: string): boolean {
  const norm = normalizeRole(role)
  if (norm === 'Administrador') return true
  if (norm === 'Taller Independiente') {
    return (
      path.startsWith('/dashboard') ||
      path.startsWith('/ordenes') ||
      path.startsWith('/catalogo') ||
      path.startsWith('/clientes') ||
      path.startsWith('/taller') ||
      path.startsWith('/login')
    )
  }
  if (norm === 'Sub-Administrador') {
    return (
      path.startsWith('/ordenes') ||
      path.startsWith('/clientes') ||
      path.startsWith('/catalogo') ||
      path.startsWith('/login')
    )
  }
  if (norm === 'Operador') {
    return (
      path.startsWith('/ordenes') ||
      path.startsWith('/catalogo') ||
      path.startsWith('/login')
    )
  }
  if (norm === 'Consultor') {
    return path.startsWith('/catalogo') || path.startsWith('/login')
  }
  return false
}

function loadInitialUser(): User | null {
  return null
}

function persistUser(u: User | null) {
  try {
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    } else {
      localStorage.removeItem(STORAGE_KEY)
      setActiveTenantContext(null)
    }
  } catch (e) {
    console.warn('[AuthStore] Error guardando usuario:', e)
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(loadInitialUser())
  const session = ref<Session | null>(null)
  const isInitialized = ref(false)
  const loading = ref(false)
  const isPasswordRecovery = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  const isGlobalAdmin = computed(
    () => normalizeRole(user.value?.role) === 'Administrador'
  )

  const isIndependentAdmin = computed(
    () => normalizeRole(user.value?.role) === 'Taller Independiente'
  )

  const isSubAdmin = computed(
    () => normalizeRole(user.value?.role) === 'Sub-Administrador'
  )

  const activeTenantId = computed(() => user.value?.tenantId || null)
  const activeTenantWorkshopName = computed(
    () => user.value?.tenantWorkshopName || null
  )

  const activeRutaId = computed(() => user.value?.rutaId || null)
  const activeRutaCodigo = computed(() => user.value?.rutaCodigo || null)
  const activeRutaNombre = computed(() => user.value?.rutaNombre || null)

  const defaultRoute = computed(() => {
    return getDefaultRouteForRole(user.value?.role || 'Consultor')
  })

  function canAccess(path: string): boolean {
    return isRouteAllowedForRole(path, user.value?.role || 'Consultor')
  }

  const DEVICE_TOKEN_KEY = 'swgora_device_token'

  function getOrCreateDeviceToken(): string {
    if (typeof window === 'undefined') return 'server-device'
    let token = localStorage.getItem(DEVICE_TOKEN_KEY)
    if (!token) {
      token =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_TOKEN_KEY, token)
    }
    return token
  }

  async function syncUserWithProfile(
    sbUser: SupabaseUser | null,
    isExplicitLogin = false
  ) {
    if (!sbUser) {
      user.value = null
      persistUser(null)
      return
    }

    const perfil = await perfilesService.getPerfilById(sbUser.id)

    if (!perfil) {
      session.value = null
      user.value = null
      persistUser(null)

      try {
        await authService.signOutLocal()
      } catch (err) {
        console.error('[AuthStore] Error cerrando la sesión:', err)
      }

      throw new Error(
        'Tu cuenta no tiene un perfil asignado. Contacta al administrador.'
      )
    }

    if (perfil.estado && perfil.estado !== 'Activo') {
      session.value = null
      user.value = null
      persistUser(null)

      try {
        await authService.signOutLocal()
      } catch (err) {
        console.error('[AuthStore] Error cerrando la sesión:', err)
      }

      throw new Error(
        'Tu cuenta está desactivada. Contacta al administrador.'
      )
    }

    // Validación de sesión única por dispositivo
    const deviceToken = getOrCreateDeviceToken()
    if (perfil.sesion_unica) {
      const activeToken = perfil.active_session_token
      if (activeToken && activeToken !== deviceToken) {
        session.value = null
        user.value = null
        persistUser(null)

        try {
          await authService.signOutLocal()
        } catch (err) {
          console.error('[AuthStore] Error cerrando sesión duplicada:', err)
        }

        throw new Error(
          'Esta cuenta permite solo 1 dispositivo activo y ya tiene sesión abierta en otro equipo. Solicita al administrador liberar la sesión.'
        )
      }

      if (!activeToken || isExplicitLogin) {
        await perfilesService.claimDeviceSession(perfil.id, deviceToken)
      }
    }

    const rawRole = perfil.rol || sbUser.user_metadata?.role || 'consultor'
    const normalized = normalizeRole(rawRole)
    const indTenant = getIndependentTenantForUser({
      id: perfil.id,
      email: perfil.email,
      rawRole,
    })
    const workshopName = indTenant.isIndependent
      ? indTenant.tallerNombre || `Taller de ${perfil.nombre}`
      : undefined

    const assignedRuta = indTenant.isIndependent
      ? null
      : rutasService.getRutaForUser({
          id: perfil.id,
          email: perfil.email,
          rawRole,
        })

    if (indTenant.isIndependent) {
      setActiveTenantContext({
        isIndependent: true,
        tenantId: indTenant.tenantId || null,
        tallerNombre: workshopName,
        userId: perfil.id,
        userName: perfil.nombre,
      })
    } else {
      setActiveTenantContext({
        isIndependent: false,
        tenantId: null,
        userId: perfil.id,
        userName: perfil.nombre,
      })
    }

    const u: User = {
      id: perfil.id,
      name: perfil.nombre,
      email: perfil.email,
      role: normalized,
      rawRole,
      isIndependent: indTenant.isIndependent,
      tenantId: indTenant.tenantId,
      tenantWorkshopName: workshopName,
      rutaId: assignedRuta?.id,
      rutaCodigo: assignedRuta?.codigo,
      rutaNombre: assignedRuta?.nombre,
      avatar:
        perfil.avatar_url ||
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
    }

    user.value = u
    persistUser(u)
  }

  async function init() {
    if (isInitialized.value) return
    loading.value = true
    try {
      // Detectar si venimos de un enlace de recuperación de contraseña en la URL
      if (typeof window !== 'undefined') {
        const hash = window.location.hash || ''
        const search = window.location.search || ''
        if (
          hash.includes('type=recovery') ||
          search.includes('type=recovery') ||
          search.includes('mode=reset')
        ) {
          isPasswordRecovery.value = true
        }
      }

      const currentSession = await authService.getSession()
      session.value = currentSession
      if (currentSession?.user && !isPasswordRecovery.value) {
        await syncUserWithProfile(currentSession.user)
      }

      authService.onAuthStateChange((event, newSession) => {
        session.value = newSession

        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecovery.value = true
          return
        }

        if (!newSession) {
          user.value = null
          persistUser(null)
          return
        }

        // Evitar sincronización automática si estamos en flujo de nueva contraseña
        if (isPasswordRecovery.value) return

        // Evitar sincronización duplicada mientras login() ya está resolviendo el perfil
        if (loading.value) return

        setTimeout(() => {
          if (session.value !== newSession || isPasswordRecovery.value) return

          void syncUserWithProfile(newSession.user).catch((err: unknown) => {
            console.error('[AuthStore] Error verificando el perfil:', err)
          })
        }, 0)
      })
    } catch (err) {
      console.error('[AuthStore] Error inicializando sesión:', err)
    } finally {
      loading.value = false
      isInitialized.value = true
    }
  }

  function setRole(newRole: UserRole) {
    if (user.value) {
      const updatedUser: User = {
        ...user.value,
        role: normalizeRole(newRole),
      }
      user.value = updatedUser
      persistUser(updatedUser)
    }
  }

  function setDemoUser(name: string, role: UserRole) {
    const normRole = normalizeRole(role)
    const defaultName = normRole === 'Administrador'
      ? 'Roberto Blanco'
      : (normRole === 'Operador' ? 'Carlos Operador' : 'Elena Consultora')

    const defaultAvatar = normRole === 'Administrador'
      ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80'
      : (normRole === 'Operador'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80')

    const newUser: User = {
      id: 'demo-' + Date.now(),
      name: name.split('@')[0] || defaultName,
      email: name.includes('@') ? name : `${name}@jrblanco.com`,
      role: normRole,
      avatar: defaultAvatar,
    }

    user.value = newUser
    persistUser(newUser)
  }

  async function login(
    email: string,
    password: string
  ): Promise<void> {
    loading.value = true

    try {
      const data = await authService.signIn(email.trim(), password)

      session.value = data.session
      await syncUserWithProfile(data.user, true)
      registrarCredencialUsuario({
        id: data.user?.id,
        email: email.trim(),
        password,
      })
    } catch (err: unknown) {
      session.value = null
      user.value = null
      persistUser(null)

      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        if (
          err.message.includes('perfil') ||
          err.message.includes('desactivada') ||
          err.message.includes('dispositivo')
        ) {
          throw err
        }
        if (
          msg.includes('invalid login credentials') ||
          msg.includes('invalid_credentials')
        ) {
          throw new Error('Correo electrónico o contraseña incorrectos.')
        }
        if (msg.includes('email not confirmed')) {
          throw new Error('Debes confirmar tu correo electrónico antes de ingresar.')
        }
      }

      throw new Error(
        'No se pudo iniciar sesión. Revisa tus credenciales y conexión.'
      )
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, name?: string): Promise<void> {
    loading.value = true
    try {
      const data = await authService.signUp(email, password, name)
      if (data.session) {
        session.value = data.session
        await syncUserWithProfile(data.user)
      }
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    loading.value = true
    try {
      if (user.value?.id && !user.value.id.startsWith('demo-')) {
        try {
          const perfil = await perfilesService.getPerfilById(user.value.id)
          const deviceToken = getOrCreateDeviceToken()
          if (!perfil?.active_session_token || perfil.active_session_token === deviceToken) {
            await perfilesService.claimDeviceSession(user.value.id, null)
          }
        } catch {
          // Mejor esfuerzo al liberar bloqueo de dispositivo
        }
      }
      await authService.signOut()
    } finally {
      session.value = null
      user.value = null
      isPasswordRecovery.value = false
      persistUser(null)
      loading.value = false
    }
  }

  async function requestPasswordReset(email: string): Promise<void> {
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      throw new Error('Por favor ingresa tu correo electrónico.')
    }

    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/login?mode=reset`
          : undefined
      await authService.resetPasswordForEmail(cleanEmail, redirectTo)
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        if (
          msg.includes('rate limit') ||
          msg.includes('security purposes') ||
          msg.includes('over_email_send_rate_limit')
        ) {
          throw new Error(
            'Por seguridad, espera unos segundos antes de solicitar un nuevo enlace.'
          )
        }
        if (msg.includes('invalid') || msg.includes('unable to validate email')) {
          throw new Error('Ingresa una dirección de correo electrónico válida.')
        }
      }
      throw new Error(
        'No se pudo enviar el enlace de recuperación. Verifica el correo e inténtalo de nuevo.'
      )
    }
  }

  async function updateUserPassword(newPassword: string): Promise<void> {
    loading.value = true
    try {
      const updatedUser = await authService.updatePassword(newPassword)
      isPasswordRecovery.value = false
      if (updatedUser) {
        await syncUserWithProfile(updatedUser)
        registrarCredencialUsuario({
          id: updatedUser.id,
          email: updatedUser.email,
          password: newPassword,
        })
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        if (
          msg.includes('different from the old password') ||
          msg.includes('same_password')
        ) {
          throw new Error(
            'La nueva contraseña debe ser diferente a tu contraseña anterior.'
          )
        }
        if (msg.includes('weak_password') || msg.includes('at least')) {
          throw new Error(
            'La contraseña es demasiado débil. Asegúrate de cumplir todos los criterios de seguridad.'
          )
        }
        if (
          msg.includes('session_not_found') ||
          msg.includes('auth session missing') ||
          msg.includes('jwt') ||
          msg.includes('expired')
        ) {
          throw new Error(
            'El enlace de recuperación ha expirado o no es válido. Solicita uno nuevo.'
          )
        }
        if (
          err.message.includes('perfil') ||
          err.message.includes('desactivada')
        ) {
          throw err
        }
      }
      throw new Error(
        'No se pudo actualizar la contraseña. Solicita un nuevo enlace de recuperación e inténtalo de nuevo.'
      )
    } finally {
      loading.value = false
    }
  }

  function clearPasswordRecovery() {
    isPasswordRecovery.value = false
  }

  return {
    user,
    session,
    isAuthenticated,
    isGlobalAdmin,
    isIndependentAdmin,
    isSubAdmin,
    activeTenantId,
    activeTenantWorkshopName,
    activeRutaId,
    activeRutaCodigo,
    activeRutaNombre,
    isInitialized,
    loading,
    isPasswordRecovery,
    defaultRoute,
    canAccess,
    init,
    login,
    setRole,
    setDemoUser,
    register,
    logout,
    requestPasswordReset,
    updateUserPassword,
    clearPasswordRecovery,
  }
})
