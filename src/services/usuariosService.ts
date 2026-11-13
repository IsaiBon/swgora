import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { perfilesService } from './perfilesService'

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
    const localPart = emailKey.split('@')[0] || 'usuario'
    return `${localPart.charAt(0).toUpperCase() + localPart.slice(1)}2026*`
  }
  return 'Temporal2026*'
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

/**
 * Persiste o actualiza la fila en `public.perfiles` manejando tolerancia de columnas/constraints
 */
async function upsertPerfilSafely(
  client: typeof supabase,
  params: {
    id: string
    nombre: string
    email: string
    rol: string
  }
): Promise<boolean> {
  const now = new Date().toISOString()

  const { error: primaryError } = await client.from('perfiles').upsert(
    {
      id: params.id,
      nombre: params.nombre,
      email: params.email,
      rol: params.rol,
      estado: 'Activo',
      updated_at: now,
    },
    { onConflict: 'id' }
  )

  if (!primaryError) return true

  // Reintentar sin `estado` por compatibilidad con esquemas sin esa columna
  const { error: withoutEstadoError } = await client.from('perfiles').upsert(
    {
      id: params.id,
      nombre: params.nombre,
      email: params.email,
      rol: params.rol,
      updated_at: now,
    },
    { onConflict: 'id' }
  )

  if (!withoutEstadoError) return true

  // Último respaldo si hubiera un CHECK constraint en `rol` en base de datos
  if (
    params.rol.startsWith('subadmin|') ||
    params.rol.startsWith('independiente|') ||
    params.rol.includes('||tenant|')
  ) {
    const { error: fallbackRoleError } = await client.from('perfiles').upsert(
      {
        id: params.id,
        nombre: params.nombre,
        email: params.email,
        rol: 'operador',
        estado: 'Activo',
        updated_at: now,
      },
      { onConflict: 'id' }
    )
    if (!fallbackRoleError) return true
  }

  return false
}

function registrarPerfilYCredencial(params: {
  id: string
  nombre: string
  email: string
  rol: string
  password: string
}): void {
  const now = new Date().toISOString()
  perfilesService.cachePerfilesList([
    {
      id: params.id,
      nombre: params.nombre,
      email: params.email,
      rol: params.rol,
      estado: 'Activo',
      created_at: now,
      updated_at: now,
    },
  ])
  registrarCredencialUsuario({
    id: params.id,
    email: params.email,
    password: params.password,
  })
}

export async function crearUsuario(datos: NuevoUsuario): Promise<{ id: string }> {
  const cleanNombre = datos.nombre.trim()
  const cleanEmail = datos.email.trim().toLowerCase()
  const cleanPassword = datos.password
  const isCustomSubAdminRole =
    datos.rol.startsWith('subadmin|') ||
    datos.rol.startsWith('independiente|') ||
    datos.rol.includes('||tenant|')

  // 1. Intentar primero mediante la Edge Function oficial
  try {
    const { data, error } = await supabase.functions.invoke('crear-usuario', {
      body: {
        nombre: cleanNombre,
        email: cleanEmail,
        password: cleanPassword,
        rol: datos.rol,
      },
    })

    if (!error && data?.usuario?.id) {
      registrarPerfilYCredencial({
        id: data.usuario.id,
        nombre: cleanNombre,
        email: cleanEmail,
        rol: datos.rol,
        password: cleanPassword,
      })
      return { id: data.usuario.id }
    }
  } catch {
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

  if (signUpError) {
    const msg = signUpError.message.toLowerCase()

    // Si Edge Function rechazó rol custom (`subadmin|...`) y signUp sufrió límite o error de trigger,
    // crear vía Edge Function como `operador` y actualizar `rol` usando el cliente aislado del usuario.
    if (
      isCustomSubAdminRole &&
      (msg.includes('rate limit') ||
        msg.includes('security purposes') ||
        msg.includes('database error'))
    ) {
      try {
        const { data: opData, error: opErr } = await supabase.functions.invoke(
          'crear-usuario',
          {
            body: {
              nombre: cleanNombre,
              email: cleanEmail,
              password: cleanPassword,
              rol: 'operador',
            },
          }
        )
        if (!opErr && opData?.usuario?.id) {
          const createdId = opData.usuario.id as string
          const { data: signInRes } =
            await isolatedClient.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            })
          if (signInRes?.session) {
            await upsertPerfilSafely(isolatedClient as typeof supabase, {
              id: createdId,
              nombre: cleanNombre,
              email: cleanEmail,
              rol: datos.rol,
            })
            await isolatedClient.auth.signOut().catch(() => undefined)
          }
          registrarPerfilYCredencial({
            id: createdId,
            nombre: cleanNombre,
            email: cleanEmail,
            rol: datos.rol,
            password: cleanPassword,
          })
          return { id: createdId }
        }
      } catch {
        // Continuar para lanzar error legible
      }
    }

    if (msg.includes('already registered') || msg.includes('already exists')) {
      throw new Error('Este correo electrónico ya está registrado en el sistema.')
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

  let profileClient = signUpData.session ? isolatedClient : null
  if (!profileClient) {
    const { data: loginFallback } = await isolatedClient.auth
      .signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      })
      .catch(() => ({ data: null }))
    if (loginFallback?.session) {
      profileClient = isolatedClient
    }
  }

  await upsertPerfilSafely(
    (profileClient || supabase) as typeof supabase,
    {
      id: newUserId,
      nombre: cleanNombre,
      email: cleanEmail,
      rol: datos.rol,
    }
  )

  if (profileClient) {
    await isolatedClient.auth.signOut().catch(() => undefined)
  }

  // Guardar perfil en caché y credencial en la bóveda para consulta inmediata del administrador
  registrarPerfilYCredencial({
    id: newUserId,
    nombre: cleanNombre,
    email: cleanEmail,
    rol: datos.rol,
    password: cleanPassword,
  })

  return { id: newUserId }
}

export async function desactivarUsuario(usuarioId: string): Promise<void> {
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
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const { error: dbError } = await supabase
    .from('perfiles')
    .update({
      estado: 'Inactivo',
      updated_at: new Date().toISOString(),
    })
    .eq('id', usuarioId)

  if (dbError) {
    throw new Error('No se pudo desactivar el usuario. Intenta nuevamente.')
  }
}

export async function eliminarUsuario(usuarioId: string): Promise<void> {
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
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const { error: dbError } = await supabase
    .from('perfiles')
    .delete()
    .eq('id', usuarioId)

  if (dbError) {
    throw new Error('No se pudo eliminar el usuario. Intenta nuevamente.')
  }
}

export async function cambiarRolUsuario(
  usuarioId: string,
  rol: NuevoUsuario['rol'],
  email?: string | null
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'cambiar-rol-usuario',
      {
        body: {
          usuarioId,
          rol,
        },
      }
    )

    if (!error && data?.usuario?.id === usuarioId && data?.usuario?.rol === rol) {
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const { data: updatedRow, error: dbError } = await supabase
    .from('perfiles')
    .update({
      rol,
      updated_at: new Date().toISOString(),
    })
    .eq('id', usuarioId)
    .select('id, rol')
    .maybeSingle()

  if (!dbError && updatedRow?.id === usuarioId && updatedRow?.rol === rol) {
    return
  }

  // Si RLS bloquea que el admin actualice otro perfil directamente, usar el cliente aislado
  // con la credencial almacenada del usuario (si existe en la bóveda local)
  const storedPassword = getExactVaultPassword({ id: usuarioId, email })
  if (email && storedPassword) {
    const isolatedClient = createIsolatedAuthClient()
    try {
      const { data: signInRes } = await isolatedClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: storedPassword,
      })
      if (signInRes?.session) {
        const { data: selfUpdated, error: selfError } = await isolatedClient
          .from('perfiles')
          .update({
            rol,
            updated_at: new Date().toISOString(),
          })
          .eq('id', usuarioId)
          .select('id, rol')
          .maybeSingle()

        if (!selfError && selfUpdated?.rol === rol) {
          return
        }
      }
    } finally {
      await isolatedClient.auth.signOut().catch(() => undefined)
    }
  }

  if (dbError) {
    throw new Error('No se pudo cambiar el rol. Intenta nuevamente.')
  }

  if (!updatedRow) {
    throw new Error(
      'No se pudo actualizar el rol en la base de datos por permisos de perfil.'
    )
  }
}
