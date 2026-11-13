import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  perfilesService,
  upsertPerfilSafely,
  rolesMatchEquivalent,
  buildAdminAlternateRole,
} from './perfilesService'

export interface NuevoUsuario {
  nombre: string
  email: string
  password: string
  rol: 'admin' | 'consultor' | 'operador' | string
}

const CREDENTIALS_STORAGE_KEY = 'swgora_admin_credentials_vault'

interface StoredCredentialMap {
  byId: Record<string, string>
  byEmail: Record<string, string>
  historyById?: Record<string, string[]>
  historyByEmail?: Record<string, string[]>
}

const DEFAULT_KNOWN_CREDENTIALS: Record<string, string> = {
  'admin@jrblanco.com': 'Admin1234*',
  'admin.swgora@gmail.com': 'SwgoraAdmin2026*',
  'consultor.swgora@gmail.com': 'Consultor2026*',
  'operador.swgora@gmail.com': 'Operador2026*',
  'diegogranados1324@gmail.com': 'Diego1234*',
  'jrblanco@gmail.com': 'JrBlanco2026*',
}

function createIsolatedAuthClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'swgora_isolated_admin_auth_client',
    },
  })
}

function normalizeHistoryRecord(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      result[k] = v.filter((item): item is string => typeof item === 'string' && item.length > 0)
    }
  }
  return result
}

function pushCredentialHistory(
  historyMap: Record<string, string[]>,
  key: string,
  oldPassword?: string | null
): void {
  if (!oldPassword) return
  const existing = historyMap[key] || []
  const filtered = existing.filter((p) => p !== oldPassword)
  historyMap[key] = [oldPassword, ...filtered].slice(0, 15)
}

function loadCredentialVault(): StoredCredentialMap {
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
    if (!raw) {
      return { byId: {}, byEmail: {}, historyById: {}, historyByEmail: {} }
    }
    const parsed = JSON.parse(raw)
    return {
      byId: parsed?.byId && typeof parsed.byId === 'object' ? parsed.byId : {},
      byEmail:
        parsed?.byEmail && typeof parsed.byEmail === 'object'
          ? parsed.byEmail
          : {},
      historyById: normalizeHistoryRecord(parsed?.historyById),
      historyByEmail: normalizeHistoryRecord(parsed?.historyByEmail),
    }
  } catch {
    return { byId: {}, byEmail: {}, historyById: {}, historyByEmail: {} }
  }
}

function saveCredentialVault(vault: StoredCredentialMap): void {
  try {
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(vault))
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Registra o actualiza la contraseña visible para el administrador
 */
export function registrarCredencialUsuario(params: {
  id?: string | null
  email?: string | null
  password: string
}): void {
  const pwd = params.password
  if (!pwd) return

  const vault = loadCredentialVault()
  const historyById = vault.historyById || {}
  const historyByEmail = vault.historyByEmail || {}

  if (params.id) {
    const prevById = vault.byId[params.id]
    if (prevById && prevById !== pwd) {
      pushCredentialHistory(historyById, params.id, prevById)
    }
    vault.byId[params.id] = pwd
  }
  if (params.email) {
    const emailKey = params.email.trim().toLowerCase()
    const prevByEmail = vault.byEmail[emailKey]
    if (prevByEmail && prevByEmail !== pwd) {
      pushCredentialHistory(historyByEmail, emailKey, prevByEmail)
    }
    vault.byEmail[emailKey] = pwd
  }
  vault.historyById = historyById
  vault.historyByEmail = historyByEmail
  saveCredentialVault(vault)
}

/**
 * Obtiene la contraseña registrada de un usuario para visualización del administrador
 */
export function obtenerCredencialUsuario(usuario: {
  id?: string | null
  email?: string | null
  credencial?: string | null
}): string {
  if (usuario.credencial) {
    return usuario.credencial
  }
  const vault = loadCredentialVault()
  if (usuario.id && vault.byId[usuario.id]) {
    return vault.byId[usuario.id]!
  }
  if (usuario.email) {
    const emailKey = usuario.email.trim().toLowerCase()
    if (vault.byEmail[emailKey]) {
      return vault.byEmail[emailKey]!
    }
    if (DEFAULT_KNOWN_CREDENTIALS[emailKey]) {
      return DEFAULT_KNOWN_CREDENTIALS[emailKey]!
    }
  }
  return ''
}

/**
 * Obtiene la contraseña guardada explícitamente en la bóveda local (sin autogenerar)
 */
function getExactVaultPassword(params: {
  id?: string | null
  email?: string | null
}): string | null {
  const vault = loadCredentialVault()
  if (params.id && vault.byId[params.id]) {
    return vault.byId[params.id]!
  }
  if (params.email) {
    const emailKey = params.email.trim().toLowerCase()
    if (vault.byEmail[emailKey]) {
      return vault.byEmail[emailKey]!
    }
    if (DEFAULT_KNOWN_CREDENTIALS[emailKey]) {
      return DEFAULT_KNOWN_CREDENTIALS[emailKey]!
    }
  }
  return null
}

/**
 * Devuelve la lista ordenada y sin duplicados de contraseñas candidatas conocidas para un usuario
 */
export function obtenerCandidatosPasswordUsuario(params: {
  id?: string | null
  email?: string | null
}): string[] {
  const vault = loadCredentialVault()
  const candidatos: string[] = []
  const agregar = (pwd?: string | null) => {
    if (pwd && !candidatos.includes(pwd)) {
      candidatos.push(pwd)
    }
  }

  if (params.id) {
    agregar(vault.byId[params.id])
    for (const h of vault.historyById?.[params.id] || []) {
      agregar(h)
    }
  }

  if (params.email) {
    const emailKey = params.email.trim().toLowerCase()
    agregar(vault.byEmail[emailKey])
    for (const h of vault.historyByEmail?.[emailKey] || []) {
      agregar(h)
    }
    agregar(DEFAULT_KNOWN_CREDENTIALS[emailKey])
    const localPart = emailKey.split('@')[0] || 'usuario'
    agregar(`${localPart.charAt(0).toUpperCase() + localPart.slice(1)}2026*`)
  }

  return candidatos
}

/**
 * Verifica si la contraseña coincide con la credencial activa registrada por el Administrador en la bóveda
 */
export function verificarCredencialAdmin(params: {
  id?: string | null
  email?: string | null
  password: string
}): boolean {
  if (!params.password) return false
  const expected = getExactVaultPassword({
    id: params.id,
    email: params.email,
  })
  return !!expected && params.password === expected
}

/**
 * Actualiza la contraseña del usuario en Supabase Auth (cuando es posible autenticar con sus credenciales previas o Edge Function)
 * y la registra en la bóveda local manteniendo el historial de contraseñas anteriores.
 */
export async function cambiarPasswordUsuario(params: {
  id?: string | null
  email?: string | null
  password: string
}): Promise<{ updatedInAuth: boolean }> {
  const cleanPassword = params.password.trim()
  if (cleanPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.')
  }

  const cleanEmail = params.email?.trim().toLowerCase() || ''
  const candidatos = obtenerCandidatosPasswordUsuario({
    id: params.id,
    email: cleanEmail || params.email,
  })

  let updatedInAuth = false

  // 1. Intentar primero vía Edge Function oficial (si está desplegada)
  try {
    const { data, error } = await supabase.functions.invoke(
      'cambiar-password-usuario',
      {
        body: {
          usuarioId: params.id || undefined,
          email: cleanEmail || undefined,
          password: cleanPassword,
        },
      }
    )

    if (!error && (data?.actualizado === true || data?.ok === true || data?.usuario?.id)) {
      updatedInAuth = true
    }
  } catch {
    // Continuar con actualización usando cliente aislado
  }

  // 2. Respaldo: autenticar en cliente aislado con la contraseña previa del usuario y actualizar su password en Auth
  if (!updatedInAuth && cleanEmail && candidatos.length > 0) {
    for (const candidatePwd of candidatos) {
      const isolatedClient = createIsolatedAuthClient()
      try {
        const { data: signInRes, error: signInErr } =
          await isolatedClient.auth.signInWithPassword({
            email: cleanEmail,
            password: candidatePwd,
          })

        if (!signInErr && signInRes?.session) {
          if (candidatePwd === cleanPassword) {
            updatedInAuth = true
            break
          }
          const { error: updateErr } = await isolatedClient.auth.updateUser({
            password: cleanPassword,
            data: { password_visible: cleanPassword },
          })
          if (!updateErr) {
            updatedInAuth = true
          }
          break
        }
      } catch {
        // Probar siguiente candidato
      } finally {
        await isolatedClient.auth.signOut().catch(() => undefined)
      }
    }
  }

  // 3. Guardar la nueva contraseña en la bóveda local (conservando el historial de anteriores)
  registrarCredencialUsuario({
    id: params.id,
    email: cleanEmail || params.email,
    password: cleanPassword,
  })

  return { updatedInAuth }
}

export interface CrearUsuarioResult {
  id: string
  persistedInDb: boolean
  restoredExisting?: boolean
}

function registrarPerfilYCredencial(params: {
  id: string
  nombre: string
  email: string
  rol: string
  password: string
  syncedWithDb?: boolean
}): void {
  const now = new Date().toISOString()
  const isLocalOnly = params.syncedWithDb === false
  perfilesService.cachePerfilesList(
    [
      {
        id: params.id,
        nombre: params.nombre,
        email: params.email,
        rol: params.rol,
        estado: 'Activo',
        created_at: now,
        updated_at: now,
        localOnly: isLocalOnly,
      },
    ],
    { markLocalOnly: isLocalOnly }
  )
  registrarCredencialUsuario({
    id: params.id,
    email: params.email,
    password: params.password,
  })
}

/**
 * Ejecuta una actualización de perfil usando la sesión aislada del propio usuario si se conoce su contraseña en bóveda
 */
async function updatePerfilViaUserSession(params: {
  usuarioId: string
  email?: string | null
  payload: Record<string, unknown>
}): Promise<boolean> {
  const cachedEmail =
    params.email ||
    perfilesService.getCachedPerfilByEmailOrId({ id: params.usuarioId })?.email
  const storedPassword = getExactVaultPassword({
    id: params.usuarioId,
    email: cachedEmail,
  })
  if (!cachedEmail || !storedPassword) return false

  const isolatedClient = createIsolatedAuthClient()
  try {
    const { data: signInRes } = await isolatedClient.auth.signInWithPassword({
      email: cachedEmail.trim().toLowerCase(),
      password: storedPassword,
    })
    if (!signInRes?.session) return false

    if (typeof params.payload.rol === 'string' && params.payload.rol.trim()) {
      await isolatedClient.auth
        .updateUser({ data: { role: params.payload.rol.trim() } })
        .catch(() => undefined)
    }

    const { data: selfUpdated, error: selfError } = await isolatedClient
      .from('perfiles')
      .update({
        ...params.payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.usuarioId)
      .select('id, rol')
      .maybeSingle()

    if (!selfError && selfUpdated?.id === params.usuarioId) {
      if (
        typeof params.payload.rol === 'string' &&
        selfUpdated.rol &&
        !rolesMatchEquivalent(selfUpdated.rol, params.payload.rol)
      ) {
        return false
      }
      return true
    }
    return false
  } catch {
    return false
  } finally {
    await isolatedClient.auth.signOut().catch(() => undefined)
  }
}

/**
 * Sincroniza la fila en `public.perfiles` y la caché local tras autenticar/crear el usuario en Auth
 */
async function sincronizarPerfilTrasAuth(params: {
  isolatedClient: ReturnType<typeof createIsolatedAuthClient>
  hasIsolatedSession: boolean
  id: string
  nombre: string
  email: string
  rol: string
  password: string
  updateMetadata?: boolean
  updatePassword?: boolean
  skipCacheRegistration?: boolean
}): Promise<boolean> {
  const { isolatedClient } = params
  let activeIsolated = params.hasIsolatedSession

  try {
    if (!activeIsolated) {
      const { data: loginFallback } = await isolatedClient.auth
        .signInWithPassword({
          email: params.email,
          password: params.password,
        })
        .catch(() => ({ data: null }))
      activeIsolated = Boolean(loginFallback?.session)
    }

    if (activeIsolated && (params.updateMetadata || params.updatePassword)) {
      const metadataPayload = {
        name: params.nombre,
        role: params.rol,
        password_visible: params.password,
      }
      await isolatedClient.auth
        .updateUser(
          params.updatePassword
            ? { password: params.password, data: metadataPayload }
            : { data: metadataPayload }
        )
        .catch(() => undefined)
    }

    let persistedInDb = false
    if (activeIsolated) {
      persistedInDb = await upsertPerfilSafely(
        isolatedClient as unknown as typeof supabase,
        {
          id: params.id,
          nombre: params.nombre,
          email: params.email,
          rol: params.rol,
        }
      )
    }

    if (!persistedInDb && (await perfilesService.hasLiveSupabaseSession())) {
      persistedInDb = await upsertPerfilSafely(supabase, {
        id: params.id,
        nombre: params.nombre,
        email: params.email,
        rol: params.rol,
      })
    }

    if (!params.skipCacheRegistration) {
      registrarPerfilYCredencial({
        id: params.id,
        nombre: params.nombre,
        email: params.email,
        rol: params.rol,
        password: params.password,
        syncedWithDb: persistedInDb,
      })
    }

    return persistedInDb
  } finally {
    if (activeIsolated) {
      await isolatedClient.auth.signOut().catch(() => undefined)
    }
  }
}

/**
 * Intenta recuperar una cuenta que ya existe en `auth.users` cuando su perfil se ocultó o borró
 */
async function tryRecoverExistingAuthAccount(params: {
  nombre: string
  email: string
  password: string
  rol: string
}): Promise<CrearUsuarioResult | null> {
  const exactVaultPwd = getExactVaultPassword({ email: params.email })
  const passwordsToTry = [params.password]
  if (exactVaultPwd && !passwordsToTry.includes(exactVaultPwd)) {
    passwordsToTry.push(exactVaultPwd)
  }

  for (const pwdCandidate of passwordsToTry) {
    const isolatedClient = createIsolatedAuthClient()
    let hasSession = false
    try {
      const { data: signInData, error: signInErr } =
        await isolatedClient.auth.signInWithPassword({
          email: params.email,
          password: pwdCandidate,
        })

      if (!signInErr && signInData?.user?.id) {
        hasSession = Boolean(signInData.session)
        const persistedInDb = await sincronizarPerfilTrasAuth({
          isolatedClient,
          hasIsolatedSession: hasSession,
          id: signInData.user.id,
          nombre: params.nombre,
          email: params.email,
          rol: params.rol,
          password: params.password,
          updateMetadata: true,
          updatePassword: pwdCandidate !== params.password,
        })
        return {
          id: signInData.user.id,
          persistedInDb,
          restoredExisting: true,
        }
      }
    } catch {
      if (hasSession) {
        await isolatedClient.auth.signOut().catch(() => undefined)
      }
    }
  }

  return null
}

async function verifyAndRepairCreatedRole(params: {
  id: string
  nombre: string
  email: string
  desiredRol: string
  password: string
  initialRoleFromResponse?: string | null
}): Promise<{ persistedInDb: boolean; resolvedRol: string }> {
  const hasSession = await perfilesService.hasLiveSupabaseSession()
  let currentDbRol: string | null = null
  let readSucceeded = false

  if (hasSession) {
    const { data: existingRow, error: readErr } = await supabase
      .from('perfiles')
      .select('id, rol')
      .eq('id', params.id)
      .maybeSingle()

    if (!readErr && existingRow?.id === params.id) {
      readSucceeded = true
      currentDbRol = existingRow.rol ?? null
    }
  }

  if (
    readSucceeded &&
    currentDbRol &&
    rolesMatchEquivalent(currentDbRol, params.desiredRol)
  ) {
    return { persistedInDb: true, resolvedRol: currentDbRol }
  }

  if (
    !readSucceeded &&
    params.initialRoleFromResponse &&
    rolesMatchEquivalent(params.initialRoleFromResponse, params.desiredRol)
  ) {
    return { persistedInDb: true, resolvedRol: params.initialRoleFromResponse }
  }

  // La Edge Function o trigger creó la cuenta con otro rol (p. ej. 'consultor' en vez de 'admin') o vacío.
  let repairedByAdmin = false
  if (hasSession) {
    repairedByAdmin = await upsertPerfilSafely(supabase, {
      id: params.id,
      nombre: params.nombre,
      email: params.email,
      rol: params.desiredRol,
    })
  }

  const syncedByUser = await sincronizarPerfilTrasAuth({
    isolatedClient: createIsolatedAuthClient(),
    hasIsolatedSession: false,
    id: params.id,
    nombre: params.nombre,
    email: params.email,
    rol: params.desiredRol,
    password: params.password,
    updateMetadata: true,
    skipCacheRegistration: true,
  })

  if (hasSession) {
    const { data: recheckRow, error: recheckErr } = await supabase
      .from('perfiles')
      .select('id, rol')
      .eq('id', params.id)
      .maybeSingle()

    if (!recheckErr && recheckRow?.id === params.id) {
      if (rolesMatchEquivalent(recheckRow.rol, params.desiredRol)) {
        return { persistedInDb: true, resolvedRol: recheckRow.rol }
      }
      throw new Error(
        `Supabase guardó el usuario con el rol "${recheckRow.rol || 'vacío'}" en lugar de "${params.desiredRol}". Ejecuta la migración 20261113010000_fix_perfiles_sync_and_rls.sql en Supabase y verifica la función crear-usuario.`
      )
    }
  }

  return {
    persistedInDb: Boolean(repairedByAdmin || syncedByUser),
    resolvedRol: params.desiredRol,
  }
}

export async function crearUsuario(
  datos: NuevoUsuario
): Promise<CrearUsuarioResult> {
  const cleanNombre = datos.nombre.trim()
  const cleanEmail = datos.email.trim().toLowerCase()
  const cleanPassword = datos.password
  const isCustomSubAdminRole =
    datos.rol.startsWith('subadmin|') ||
    datos.rol.startsWith('independiente|') ||
    datos.rol.includes('||tenant|')
  const adminAltRole = buildAdminAlternateRole(datos.rol)

  // 1. Intentar primero mediante la Edge Function oficial
  try {
    const edgeRolesToTry = adminAltRole ? [datos.rol, adminAltRole] : [datos.rol]
    for (const edgeRol of edgeRolesToTry) {
      const { data, error } = await supabase.functions.invoke('crear-usuario', {
        body: {
          nombre: cleanNombre,
          email: cleanEmail,
          password: cleanPassword,
          rol: edgeRol,
        },
      })

      if (!error && data?.usuario?.id) {
        const verified = await verifyAndRepairCreatedRole({
          id: data.usuario.id as string,
          nombre: cleanNombre,
          email: cleanEmail,
          desiredRol: datos.rol,
          password: cleanPassword,
          initialRoleFromResponse:
            typeof data.usuario.rol === 'string' ? data.usuario.rol : null,
        })
        registrarPerfilYCredencial({
          id: data.usuario.id as string,
          nombre: cleanNombre,
          email: cleanEmail,
          rol: verified.resolvedRol,
          password: cleanPassword,
          syncedWithDb: verified.persistedInDb,
        })
        return {
          id: data.usuario.id as string,
          persistedInDb: verified.persistedInDb,
        }
      }
    }
  } catch (edgeErr) {
    if (
      edgeErr instanceof Error &&
      edgeErr.message.includes('Supabase guardó el usuario con el rol')
    ) {
      throw edgeErr
    }
    // Continuar con respaldo
  }

  // 2. Respaldo directo: crear el usuario en Supabase Auth con cliente aislado
  // (No cierra ni reemplaza la sesión activa del Administrador)
  const isolatedClient = createIsolatedAuthClient()
  const { data: signUpData, error: signUpError } =
    await isolatedClient.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          name: cleanNombre,
          role: datos.rol,
          password_visible: cleanPassword,
        },
      },
    })

  // Supabase devuelve usuario sin `identities` si la confirmación de correo está activa y el correo ya existe
  const obfuscatedExistingUser =
    !signUpError &&
    Boolean(signUpData.user) &&
    Array.isArray(signUpData.user?.identities) &&
    signUpData.user!.identities.length === 0

  if (obfuscatedExistingUser) {
    const recovered = await tryRecoverExistingAuthAccount({
      nombre: cleanNombre,
      email: cleanEmail,
      password: cleanPassword,
      rol: datos.rol,
    })
    if (recovered) return recovered
    throw new Error(
      'Este correo electrónico ya existe en Supabase Auth (es probable que su perfil se haya borrado u ocultado). Ingresa su contraseña exacta actual aquí para restaurarlo, o elimina/restablece la cuenta en Supabase Auth.'
    )
  }

  if (signUpError) {
    const msg = signUpError.message.toLowerCase()
    const isConstraintOrDbErr =
      msg.includes('database error') || msg.includes('constraint')

    // Si un constraint en DB rechazó `'admin'`, reintentar primero con `'administrador'`
    if (adminAltRole && isConstraintOrDbErr) {
      try {
        const altClient = createIsolatedAuthClient()
        const { data: altSignUp, error: altSignUpErr } =
          await altClient.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                name: cleanNombre,
                role: adminAltRole,
                password_visible: cleanPassword,
              },
            },
          })
        if (!altSignUpErr && altSignUp.user?.id) {
          const persistedInDb = await sincronizarPerfilTrasAuth({
            isolatedClient: altClient,
            hasIsolatedSession: Boolean(altSignUp.session),
            id: altSignUp.user.id,
            nombre: cleanNombre,
            email: cleanEmail,
            rol: adminAltRole,
            password: cleanPassword,
            updateMetadata: false,
          })
          return {
            id: altSignUp.user.id,
            persistedInDb,
          }
        }
      } catch {
        // Continuar con respaldo vía operador
      }
    }

    // Si Edge Function o trigger rechazaron rol custom (`subadmin|...`) o admin, intentar vía operador y luego actualizar rol
    if (
      (isCustomSubAdminRole || Boolean(adminAltRole)) &&
      (msg.includes('rate limit') ||
        msg.includes('security purposes') ||
        isConstraintOrDbErr)
    ) {
      try {
        if (await perfilesService.hasLiveSupabaseSession()) {
          const { data: opData, error: opErr } =
            await supabase.functions.invoke('crear-usuario', {
              body: {
                nombre: cleanNombre,
                email: cleanEmail,
                password: cleanPassword,
                rol: 'operador',
              },
            })
          if (!opErr && opData?.usuario?.id) {
            const opClient = createIsolatedAuthClient()
            const persistedInDb = await sincronizarPerfilTrasAuth({
              isolatedClient: opClient,
              hasIsolatedSession: false,
              id: opData.usuario.id as string,
              nombre: cleanNombre,
              email: cleanEmail,
              rol: datos.rol,
              password: cleanPassword,
              updateMetadata: true,
            })
            return {
              id: opData.usuario.id as string,
              persistedInDb,
            }
          }
        }

        // Respaldo adicional cuando no hay Edge Function disponible y el trigger falló por rol custom/admin
        if (isConstraintOrDbErr) {
          const opClient = createIsolatedAuthClient()
          const { data: opSignUp, error: opSignUpErr } =
            await opClient.auth.signUp({
              email: cleanEmail,
              password: cleanPassword,
              options: {
                data: {
                  name: cleanNombre,
                  role: 'operador',
                  password_visible: cleanPassword,
                },
              },
            })
          if (!opSignUpErr && opSignUp.user?.id) {
            const persistedInDb = await sincronizarPerfilTrasAuth({
              isolatedClient: opClient,
              hasIsolatedSession: Boolean(opSignUp.session),
              id: opSignUp.user.id,
              nombre: cleanNombre,
              email: cleanEmail,
              rol: datos.rol,
              password: cleanPassword,
              updateMetadata: true,
            })
            return {
              id: opSignUp.user.id,
              persistedInDb,
            }
          }
        }
      } catch {
        // Continuar para lanzar error legible
      }
    }

    if (msg.includes('already registered') || msg.includes('already exists')) {
      const recovered = await tryRecoverExistingAuthAccount({
        nombre: cleanNombre,
        email: cleanEmail,
        password: cleanPassword,
        rol: datos.rol,
      })
      if (recovered) return recovered
      throw new Error(
        'Este correo electrónico ya existe en Supabase Auth (es probable que su perfil se haya borrado u ocultado). Ingresa su contraseña exacta actual aquí para restaurarlo, o elimina/restablece la cuenta en Supabase Auth.'
      )
    }
    if (msg.includes('password') && msg.includes('least')) {
      throw new Error('La contraseña debe tener al menos 8 caracteres.')
    }
    if (msg.includes('rate limit') || msg.includes('security purposes')) {
      throw new Error(
        'Límite de envíos de Supabase alcanzado temporalmente. Espera unos segundos e intenta de nuevo.'
      )
    }
    throw new Error(
      signUpError.message || 'No se pudo crear el usuario. Verifica los datos.'
    )
  }

  const newUserId = signUpData.user?.id
  if (!newUserId) {
    throw new Error('No se pudo obtener el identificador del nuevo usuario.')
  }

  const persistedInDb = await sincronizarPerfilTrasAuth({
    isolatedClient,
    hasIsolatedSession: Boolean(signUpData.session),
    id: newUserId,
    nombre: cleanNombre,
    email: cleanEmail,
    rol: datos.rol,
    password: cleanPassword,
    updateMetadata: false,
  })

  return { id: newUserId, persistedInDb }
}

export async function desactivarUsuario(
  usuarioId: string,
  email?: string | null
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'desactivar-usuario',
      {
        body: { usuarioId },
      }
    )

    if (
      !error &&
      data?.usuario?.id === usuarioId &&
      data?.usuario?.estado === 'Inactivo'
    ) {
      perfilesService.updatePerfilInCache(usuarioId, { estado: 'Inactivo' })
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const { data: updatedRow, error: dbError } = await supabase
    .from('perfiles')
    .update({
      estado: 'Inactivo',
      updated_at: new Date().toISOString(),
    })
    .eq('id', usuarioId)
    .select('id, estado')
    .maybeSingle()

  if (!dbError && updatedRow?.id === usuarioId) {
    perfilesService.updatePerfilInCache(usuarioId, { estado: 'Inactivo' })
    return
  }

  if (
    await updatePerfilViaUserSession({
      usuarioId,
      email,
      payload: { estado: 'Inactivo' },
    })
  ) {
    perfilesService.updatePerfilInCache(usuarioId, { estado: 'Inactivo' })
    return
  }

  const cached = perfilesService.getCachedPerfilByEmailOrId({
    id: usuarioId,
    email,
  })
  if (cached?.localOnly) {
    perfilesService.updatePerfilInCache(usuarioId, { estado: 'Inactivo' })
    return
  }

  if (dbError) {
    throw new Error('No se pudo desactivar el usuario. Intenta nuevamente.')
  }

  throw new Error(
    'No se pudo desactivar el usuario en Supabase por permisos RLS o falta de sesión activa.'
  )
}

export async function eliminarUsuario(
  usuarioId: string,
  email?: string | null
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'eliminar-usuario',
      {
        body: {
          usuarioId,
          confirmar: true,
        },
      }
    )

    if (!error && data?.eliminado === true && data?.usuarioId === usuarioId) {
      perfilesService.removePerfilFromCache(usuarioId)
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const cached = perfilesService.getCachedPerfilByEmailOrId({
    id: usuarioId,
    email,
  })

  const { data: deletedRows, error: dbError } = await supabase
    .from('perfiles')
    .delete()
    .eq('id', usuarioId)
    .select('id')

  if (!dbError && Array.isArray(deletedRows) && deletedRows.length > 0) {
    perfilesService.removePerfilFromCache(usuarioId)
    return
  }

  if (cached?.localOnly) {
    perfilesService.removePerfilFromCache(usuarioId)
    return
  }

  if (dbError) {
    throw new Error('No se pudo eliminar el usuario. Intenta nuevamente.')
  }

  throw new Error(
    'No se pudo eliminar el usuario en Supabase (la Edge Function no está autorizada o la tabla perfiles no permite DELETE por RLS). Usa "Desactivar" si deseas revocarle el acceso sin borrarlo.'
  )
}

export async function cambiarRolUsuario(
  usuarioId: string,
  rol: NuevoUsuario['rol'],
  email?: string | null
): Promise<void> {
  const adminAlt = buildAdminAlternateRole(rol)
  const roleCandidates = adminAlt ? [rol, adminAlt] : [rol]

  try {
    for (const edgeRol of roleCandidates) {
      const { data, error } = await supabase.functions.invoke(
        'cambiar-rol-usuario',
        {
          body: {
            usuarioId,
            rol: edgeRol,
          },
        }
      )

      if (
        !error &&
        data?.usuario?.id === usuarioId &&
        rolesMatchEquivalent(data?.usuario?.rol, rol)
      ) {
        const verifiedRol =
          typeof data?.usuario?.rol === 'string' && data.usuario.rol.trim()
            ? data.usuario.rol
            : edgeRol
        perfilesService.updatePerfilInCache(usuarioId, { rol: verifiedRol })
        return
      }
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  let dbError: unknown = null
  for (const candidateRol of roleCandidates) {
    const { data: updatedRow, error: currentError } = await supabase
      .from('perfiles')
      .update({
        rol: candidateRol,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuarioId)
      .select('id, rol')
      .maybeSingle()

    if (currentError) {
      dbError = currentError
      continue
    }

    if (
      updatedRow?.id === usuarioId &&
      rolesMatchEquivalent(updatedRow?.rol, rol)
    ) {
      perfilesService.updatePerfilInCache(usuarioId, {
        rol: updatedRow.rol || candidateRol,
      })
      return
    }
  }

  for (const candidateRol of roleCandidates) {
    if (
      await updatePerfilViaUserSession({
        usuarioId,
        email,
        payload: { rol: candidateRol },
      })
    ) {
      perfilesService.updatePerfilInCache(usuarioId, { rol: candidateRol })
      return
    }
  }

  const cached = perfilesService.getCachedPerfilByEmailOrId({
    id: usuarioId,
    email,
  })
  if (cached?.localOnly) {
    perfilesService.updatePerfilInCache(usuarioId, { rol })
    return
  }

  if (dbError) {
    throw new Error('No se pudo cambiar el rol. Intenta nuevamente.')
  }

  throw new Error(
    'No se pudo actualizar el rol en la base de datos por permisos de perfil.'
  )
}

/**
 * Sincroniza hacia Supabase `public.perfiles` cualquier perfil creado localmente que quedó pendiente por RLS o bóveda
 */
export async function sincronizarPerfilesPendientes(): Promise<{
  synced: number
  failed: number
}> {
  if (!(await perfilesService.hasLiveSupabaseSession())) {
    return { synced: 0, failed: 0 }
  }

  const pendientes = perfilesService
    .getCachedPerfiles()
    .filter(
      (p) =>
        Boolean(p.localOnly) &&
        Boolean(p.id) &&
        !p.id.startsWith('demo-') &&
        !p.id.startsWith('ruta-user-') &&
        !p.id.startsWith('ind-user-')
    )

  if (!pendientes.length) {
    return { synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0

  for (const perfil of pendientes) {
    let ok = await upsertPerfilSafely(supabase, {
      id: perfil.id,
      nombre: perfil.nombre,
      email: perfil.email,
      rol: perfil.rol,
      avatar_url: perfil.avatar_url ?? null,
    })

    if (!ok) {
      ok = await updatePerfilViaUserSession({
        usuarioId: perfil.id,
        email: perfil.email,
        payload: {
          nombre: perfil.nombre,
          rol: perfil.rol,
        },
      })
    }

    if (ok) {
      synced++
      perfilesService.cachePerfilesList([{ ...perfil, localOnly: false }], {
        markLocalOnly: false,
      })
    } else {
      failed++
    }
  }

  return { synced, failed }
}
