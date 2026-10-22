import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/authService'
import { perfilesService } from '@/services/perfilesService'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

export type UserRole = 'Administrador' | 'Operador' | 'Consultor' | string

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

const STORAGE_KEY = 'swgora_active_user'

/**
 * Normaliza cualquier string de rol a los 3 roles oficiales del sistema
 */
export function normalizeRole(role?: string | null): 'Administrador' | 'Operador' | 'Consultor' {
  if (!role) return 'Consultor'
  const lower = role.toLowerCase().trim()
  if (lower.includes('admin')) return 'Administrador'
  if (lower.includes('consult')) return 'Consultor'
  if (lower.includes('oper') || lower.includes('taller') || lower.includes('tecnic')) return 'Operador'
  return 'Consultor'
}

/**
 * Retorna la ruta principal por defecto según el rol del usuario
 */
export function getDefaultRouteForRole(role: string): string {
  const norm = normalizeRole(role)
  switch (norm) {
    case 'Administrador':
      return '/dashboard'
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
 * - Administrador: Acceso completo a todo el sistema
 * - Operador: Solo puede ver Órdenes y Catálogo (además de login)
 * - Consultor: Solo puede ver Catálogo (además de login). NUNCA Órdenes ni Clientes ni Dashboard.
 */
export function isRouteAllowedForRole(path: string, role: string): boolean {
  const norm = normalizeRole(role)
  if (norm === 'Administrador') return true
  if (norm === 'Operador') {
    return path.startsWith('/ordenes') || path.startsWith('/catalogo') || path.startsWith('/login')
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

  const isAuthenticated = computed(() => user.value !== null)

  const defaultRoute = computed(() => {
    return getDefaultRouteForRole(user.value?.role || 'Consultor')
  })

  function canAccess(path: string): boolean {
    return isRouteAllowedForRole(path, user.value?.role || 'Consultor')
  }

  function mapSupabaseUser(sbUser: SupabaseUser | null): User | null {
    if (!sbUser) return null
    return {
      id: sbUser.id,
      name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'Usuario',
      email: sbUser.email || '',
      role: normalizeRole(sbUser.user_metadata?.role || 'Consultor'),
      avatar: sbUser.user_metadata?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
    }
  }

  async function syncUserWithProfile(sbUser: SupabaseUser | null) {
    user.value = null
    persistUser(null)

    if (!sbUser) return

    const perfil = await perfilesService.getPerfilById(sbUser.id)

    if (!perfil) {
      throw new Error(
        'Tu cuenta no tiene un perfil. Contacta al administrador.'
      )
    }

    if (perfil.estado !== 'Activo') {
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

    const u: User = {
      id: perfil.id,
      name: perfil.nombre,
      email: perfil.email,
      role: normalizeRole(perfil.rol),
      avatar: perfil.avatar_url ||
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
    }

    user.value = u
    persistUser(u)
  }

  async function init() {
    if (isInitialized.value) return
    loading.value = true
    try {
      const currentSession = await authService.getSession()
      session.value = currentSession
      if (currentSession?.user) {
        await syncUserWithProfile(currentSession.user)
      }

      authService.onAuthStateChange((_event, newSession) => {
  session.value = newSession

  if (!newSession) {
    user.value = null
    persistUser(null)
    return
  }

  setTimeout(() => {
    if (session.value !== newSession) return

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
      await syncUserWithProfile(data.user)
    } catch {
      session.value = null
      user.value = null
      persistUser(null)

      throw new Error(
        'No se pudo iniciar sesión. Revisa tu correo, contraseña y conexión.'
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
      await authService.signOut()
    } finally {
      session.value = null
      user.value = null
      persistUser(null)
      loading.value = false
    }
  }

  return {
    user,
    session,
    isAuthenticated,
    isInitialized,
    loading,
    defaultRoute,
    canAccess,
    init,
    login,
    setRole,
    setDemoUser,
    register,
    logout,
  }
})
