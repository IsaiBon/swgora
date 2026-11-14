import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/authService'
import { perfilesService, type Perfil } from '@/services/perfilesService'
import {
  registrarCredencialUsuario,
  obtenerCandidatosPasswordUsuario,
  verificarCredencialAdmin,
  sincronizarBovedaCredencialesDesdeNube,
  obtenerRolBovedaUsuario,
} from '@/services/usuariosService'
import {
  parseSubAdminRole,
  extractTenantFromRole,
  getUserTenantMembership,
  encodeSubAdminRole,
  encodeIndependentRole,
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
  isVaultSession?: boolean
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
  const tenantInfo = extractTenantFromRole(role)
  if (tenantInfo.isTenantOwner) return 'Taller Independiente'
  const effectiveRole = (tenantInfo.baseRole || role).trim()
  const subAdminInfo = parseSubAdminRole(effectiveRole)
  if (subAdminInfo.isSubAdmin) return 'Sub-Administrador'
  const lower = effectiveRole.toLowerCase()
  if (
    lower === 'taller independiente' ||
    lower === 'independiente' ||
    lower.startsWith('independiente|') ||
    lower.includes('taller independiente')
  ) {
    return 'Taller Independiente'
  }
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
 * - Taller Independiente: Sistema propio completo y aislado (Dashboard, Órdenes, Rutas, Clientes, Usuarios, Mi Taller y Catálogo compartido; sin opción de compartir sistema)
 * - Sub-Administrador: Administra todas las órdenes de trabajo, clientes y catálogo pero SOLO de su ruta asignada
 * - Operador: Solo puede ver Órdenes y Catálogo (además de login)
 * - Consultor: Solo puede ver Catálogo (además de login). NUNCA Órdenes ni Clientes ni Dashboard.
 */
export function isRouteAllowedForRole(path: string, role: string): boolean {
  const norm = normalizeRole(role)
  if (norm === 'Administrador' || norm === 'Taller Independiente') return true
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
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as User
    if (parsed?.id) {
      const membership = getUserTenantMembership({
        id: parsed.id,
        email: parsed.email,
        rawRole: parsed.rawRole || parsed.role,
      })
      if (membership.isTenantOwner) {
        parsed.role = 'Taller Independiente'
        parsed.isIndependent = true
        parsed.tenantId = membership.tenantId || parsed.tenantId
        parsed.tenantWorkshopName =
          membership.tallerNombre || parsed.tenantWorkshopName
      } else {
        parsed.role = normalizeRole(
          membership.baseRole || parsed.rawRole || parsed.role
        )
      }
      if (parsed.isVaultSession) {
        return parsed
      }
    }
  } catch {
    // Ignorar error de lectura local
  }
  return null
}

function applyTenantContextForUser(params: {
  id: string
  name: string
  isIndependent: boolean
  tenantId?: string | null
  workshopName?: string
}) {
  if (params.isIndependent) {
    setActiveTenantContext({
      isIndependent: true,
      tenantId: params.tenantId || null,
      tallerNombre: params.workshopName,
      userId: params.id,
      userName: params.name,
    })
  } else {
    setActiveTenantContext({
      isIndependent: false,
      tenantId: null,
      userId: params.id,
      userName: params.name,
    })
  }
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
  const isVaultSession = computed(
    () => Boolean(user.value?.isVaultSession) && !session.value
  )

  const isGlobalAdmin = computed(() => {
    const norm = normalizeRole(user.value?.role)
    return norm === 'Administrador' || norm === 'Taller Independiente'
  })

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

  function buildAndStoreUserFromPerfil(
    perfil: Perfil,
    fallbackRawRole?: string,
    isVaultSession = false
  ) {
    const isGenericDbRole =
      !perfil.rol ||
      perfil.rol.trim().toLowerCase() === 'operador' ||
      perfil.rol.trim().toLowerCase() === 'rolnuevo'
    const vaultRoleOverride = obtenerRolBovedaUsuario({
      id: perfil.id,
      email: perfil.email,
    })
    const hasRichFallback =
      !!fallbackRawRole &&
      (fallbackRawRole.startsWith('independiente|') ||
        fallbackRawRole.startsWith('subadmin|') ||
        fallbackRawRole.includes('||tenant|'))
    const rawRole =
      vaultRoleOverride ||
      (isGenericDbRole && hasRichFallback ? fallbackRawRole : perfil.rol) ||
      fallbackRawRole ||
      'consultor'
    const membership = getUserTenantMembership({
      id: perfil.id,
      email: perfil.email,
      rawRole,
    })
    const normalized = membership.isTenantOwner
      ? 'Taller Independiente'
      : normalizeRole(membership.baseRole || rawRole)

    const workshopName = membership.isIndependent
      ? membership.tallerNombre || `Taller de ${perfil.nombre}`
      : undefined

    const assignedRuta =
      normalized === 'Sub-Administrador'
        ? rutasService.getRutaForUser({
            id: perfil.id,
            email: perfil.email,
            rawRole,
          })
        : null

    applyTenantContextForUser({
      id: perfil.id,
      name: perfil.nombre,
      isIndependent: membership.isIndependent,
      tenantId: membership.tenantId || null,
      workshopName,
    })

    const u: User = {
      id: perfil.id,
      name: perfil.nombre,
      email: perfil.email,
      role: normalized,
      rawRole,
      isIndependent: membership.isIndependent,
      tenantId: membership.tenantId,
      tenantWorkshopName: workshopName,
      rutaId: assignedRuta?.id,
      rutaCodigo: assignedRuta?.codigo,
      rutaNombre: assignedRuta?.nombre,
      avatar:
        perfil.avatar_url ||
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
      ...(isVaultSession ? { isVaultSession: true } : {}),
    }

    user.value = u
    persistUser(u)
  }

  async function ensureBridgeSupabaseSession(): Promise<Session | null> {
    try {
      const current = await authService.getSession()
      if (current?.access_token) {
        session.value = current
        return current
      }
    } catch {
      // Continuar con autenticación puente
    }

    const bridgeAccounts: Array<[string, string]> = [
      ['admin@jrblanco.com', 'Admin1234*'],
      ['jrblanco1@gmail.com', '12345678'],
    ]
    for (const [bridgeEmail, bridgePassword] of bridgeAccounts) {
      try {
        const res = await authService.signIn(bridgeEmail, bridgePassword)
        if (res?.session) {
          session.value = res.session
          return res.session
        }
      } catch {
        // Probar siguiente cuenta puente
      }
    }
    return null
  }

  async function resolveProfileForVaultLogin(emailLower: string): Promise<Perfil | null> {
    const cached = perfilesService.getCachedPerfilByEmailOrId({ email: emailLower })
    if (cached) return cached

    await ensureBridgeSupabaseSession()
    await perfilesService.getPerfiles().catch(() => [])
    const cachedAfterFetch = perfilesService.getCachedPerfilByEmailOrId({
      email: emailLower,
    })
    if (cachedAfterFetch) return cachedAfterFetch

    const rutasData = await rutasService.getRutas().catch(() => [])
    const rutaMatch = rutasData.find(
      (r) => (r.subAdminEmail || '').trim().toLowerCase() === emailLower
    )
    if (rutaMatch) {
      const now = new Date().toISOString()
      const perfilRuta: Perfil = {
        id: rutaMatch.subAdminId || `ruta-user-${rutaMatch.id}`,
        nombre: rutaMatch.subAdminNombre?.trim() || `Encargado ${rutaMatch.nombre}`,
        email: emailLower,
        rol: encodeSubAdminRole(rutaMatch),
        estado: rutaMatch.estado === 'Inactiva' ? 'Inactivo' : 'Activo',
        created_at: rutaMatch.createdAt || now,
        updated_at: now,
      }
      perfilesService.cachePerfilesList([perfilRuta])
      return perfilRuta
    }

    const membership = getUserTenantMembership({ email: emailLower })
    if (membership.isIndependent && membership.tenantId) {
      const now = new Date().toISOString()
      const perfilInd: Perfil = {
        id: `ind-user-${membership.tenantId}`,
        nombre:
          membership.tallerNombre ||
          emailLower.split('@')[0] ||
          'Taller Independiente',
        email: emailLower,
        rol: membership.isTenantOwner
          ? encodeIndependentRole({
              tenantId: membership.tenantId,
              tallerNombre: membership.tallerNombre,
            })
          : membership.baseRole || 'operador',
        estado: 'Activo',
        created_at: now,
        updated_at: now,
      }
      perfilesService.cachePerfilesList([perfilInd])
      return perfilInd
    }

    return null
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

    const perfil = await perfilesService.ensurePerfilForAuthUser(sbUser, {
      nombre:
        typeof sbUser.user_metadata?.name === 'string'
          ? sbUser.user_metadata.name
          : undefined,
      rol:
        typeof sbUser.user_metadata?.role === 'string'
          ? sbUser.user_metadata.role
          : undefined,
    })

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

    buildAndStoreUserFromPerfil(perfil, sbUser.user_metadata?.role, false)
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

      let [currentSession] = await Promise.all([
        authService.getSession(),
        sincronizarBovedaCredencialesDesdeNube().catch(() => undefined),
      ])
      session.value = currentSession
      if (user.value?.isVaultSession && !isPasswordRecovery.value) {
        if (!currentSession) {
          currentSession = await ensureBridgeSupabaseSession()
        }
        applyTenantContextForUser({
          id: user.value.id,
          name: user.value.name,
          isIndependent: !!user.value.isIndependent,
          tenantId: user.value.tenantId || null,
          workshopName: user.value.tenantWorkshopName,
        })
      } else if (currentSession?.user && !isPasswordRecovery.value) {
        await syncUserWithProfile(currentSession.user)
      }

      authService.onAuthStateChange((event, newSession) => {
        session.value = newSession

        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecovery.value = true
          return
        }

        if (user.value?.isVaultSession && event !== 'SIGNED_OUT') {
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
          if (
            session.value !== newSession ||
            isPasswordRecovery.value ||
            user.value?.isVaultSession
          ) {
            return
          }

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
    const cleanEmail = email.trim()
    const cleanEmailLower = cleanEmail.toLowerCase()

    try {
      let data: Awaited<ReturnType<typeof authService.signIn>> | null = null
      try {
        data = await authService.signIn(cleanEmail, password)
      } catch (signInErr: unknown) {
        const errMsg =
          signInErr instanceof Error ? signInErr.message.toLowerCase() : ''
        const isInvalidCreds =
          errMsg.includes('invalid login credentials') ||
          errMsg.includes('invalid_credentials')

        if (isInvalidCreds) {
          await sincronizarBovedaCredencialesDesdeNube().catch(() => undefined)
        }

        if (
          !isInvalidCreds ||
          !verificarCredencialAdmin({ email: cleanEmailLower, password })
        ) {
          throw signInErr
        }

        // La contraseña ingresada coincide con la asignada por el Administrador en el panel.
        // 1) Intentar iniciar sesión con contraseñas anteriores conocidas para sincronizar el cambio en Supabase Auth.
        const candidatos = obtenerCandidatosPasswordUsuario({
          email: cleanEmailLower,
        })
        for (const prevPwd of candidatos) {
          if (prevPwd === password) continue
          try {
            const prevLogin = await authService.signIn(cleanEmail, prevPwd)
            if (prevLogin?.user) {
              await authService.updatePassword(password).catch(() => undefined)
              data = prevLogin
              break
            }
          } catch {
            // Probar siguiente candidato
          }
        }

        // 2) Si ninguna contraseña previa pudo iniciar sesión en Auth (p.ej. usuario de ruta o sobrescritura previa),
        // autenticar usando el perfil local/ruta verificado contra la bóveda del Administrador.
        if (!data) {
          const perfilLocal = await resolveProfileForVaultLogin(cleanEmailLower)
          if (!perfilLocal) {
            throw new Error(
              'No se encontró el perfil local del usuario. Pide al administrador abrir la sección Usuarios para sincronizar.'
            )
          }
          if (perfilLocal.estado && perfilLocal.estado !== 'Activo') {
            throw new Error(
              'Tu cuenta está desactivada. Contacta al administrador.'
            )
          }

          await ensureBridgeSupabaseSession()
          buildAndStoreUserFromPerfil(perfilLocal, perfilLocal.rol, true)
          registrarCredencialUsuario({
            id: perfilLocal.id,
            email: cleanEmailLower,
            password,
          })
          return
        }
      }

      session.value = data.session
      await syncUserWithProfile(data.user, true)
      registrarCredencialUsuario({
        id: data.user?.id,
        email: cleanEmailLower,
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

  /**
   * Inicia sesión directamente contra Supabase Auth sin recurrir al respaldo local
   */
  async function reautenticarEnSupabase(
    email: string,
    password: string
  ): Promise<void> {
    const cleanEmail = email.trim()
    const cleanEmailLower = cleanEmail.toLowerCase()
    if (!cleanEmail || !password) {
      throw new Error('Ingresa el correo y la contraseña de Supabase Auth.')
    }

    loading.value = true
    try {
      const data = await authService.signIn(cleanEmail, password)
      if (!data?.session || !data?.user) {
        throw new Error(
          'Supabase Auth no devolvió una sesión activa para esta cuenta.'
        )
      }
      session.value = data.session
      await syncUserWithProfile(data.user, true)
      registrarCredencialUsuario({
        id: data.user.id,
        email: cleanEmailLower,
        password,
      })
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        if (
          msg.includes('invalid login credentials') ||
          msg.includes('invalid_credentials')
        ) {
          throw new Error(
            'Correo o contraseña incorrectos en Supabase Auth. Verifica tus credenciales o actualiza la contraseña de esta cuenta en Supabase.'
          )
        }
        throw err
      }
      throw new Error('No se pudo conectar la sesión con Supabase Auth.')
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
      if (
        user.value?.id &&
        !user.value.isVaultSession &&
        !user.value.id.startsWith('demo-')
      ) {
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
      await authService.signOutLocal()
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
    isVaultSession,
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
    reautenticarEnSupabase,
    setRole,
    setDemoUser,
    register,
    logout,
    requestPasswordReset,
    updateUserPassword,
    clearPasswordRecovery,
  }
})
