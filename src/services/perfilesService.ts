import { supabase } from './supabase'

export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: string
  estado: 'Activo' | 'Inactivo'
  credencial?: string | null
  avatar_url?: string | null
  sesion_unica?: boolean
  active_session_token?: string | null
  created_at: string
  updated_at: string
  localOnly?: boolean
}

export type PerfilUpdate = Partial<
  Omit<Perfil, 'id' | 'created_at' | 'updated_at' | 'estado'>
>

const PERFILES_CACHE_KEY = 'swgora_perfiles_cache_v1'

const KNOWN_ADMIN_EMAILS = new Set([
  'admin@jrblanco.com',
  'admin.swgora@gmail.com',
  'jrblanco@gmail.com',
  'jrblanco1@gmail.com',
  'luis1@gmail.com',
  'diegogranados1324@gmail.com',
])

function isCorruptedRoleString(value?: string | null): boolean {
  if (!value) return true
  const lower = value.trim().toLowerCase()
  return (
    !lower ||
    lower === 'rolnuevo' ||
    lower === 'undefined' ||
    lower === 'null'
  )
}

export function sanitizePerfilRole(
  rol?: string | null,
  email?: string | null,
  fallbackRol?: string | null
): string {
  if (!isCorruptedRoleString(rol)) {
    return rol!.trim()
  }
  if (!isCorruptedRoleString(fallbackRol)) {
    return fallbackRol!.trim()
  }
  const cleanEmail = (email || '').trim().toLowerCase()
  if (cleanEmail && KNOWN_ADMIN_EMAILS.has(cleanEmail)) {
    return 'admin'
  }
  return 'operador'
}

function readPerfilesCache(): Perfil[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(PERFILES_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as Perfil[]).map((p) => ({
      ...p,
      rol: sanitizePerfilRole(p.rol, p.email),
    }))
  } catch {
    return []
  }
}

function writePerfilesCache(lista: Perfil[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PERFILES_CACHE_KEY, JSON.stringify(lista))
  } catch {
    // Ignore storage quota errors
  }
}

function splitTenantSuffixFromRole(raw?: string | null): {
  base: string
  tenantKey: string
} {
  if (!raw) return { base: '', tenantKey: '' }
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  const idx = lower.indexOf('||tenant|')
  if (idx === -1) return { base: trimmed, tenantKey: '' }
  const base = trimmed.slice(0, idx).trim()
  const rest = trimmed.slice(idx + '||tenant|'.length)
  const tenantKey = (rest.split('|')[0] || '').trim().toLowerCase()
  return { base, tenantKey }
}

function normalizeBaseRoleFamily(raw?: string | null): string {
  if (!raw) return ''
  const lower = raw.trim().toLowerCase()
  if (!lower) return ''
  if (
    lower.startsWith('independiente|') ||
    lower === 'independiente' ||
    lower.includes('taller independiente')
  ) {
    return 'independiente'
  }
  if (lower.startsWith('subadmin|')) {
    const rutaId = (lower.split('|')[1] || '').trim()
    return rutaId ? `subadmin:${rutaId}` : 'subadmin'
  }
  if (lower.includes('sub-admin') || lower.includes('subadmin')) return 'subadmin'
  if (lower.includes('admin')) return 'admin'
  if (lower.includes('consult')) return 'consultor'
  if (
    lower.includes('oper') ||
    lower.includes('taller') ||
    lower.includes('tecnic')
  ) {
    return 'operador'
  }
  return lower
}

/**
 * Devuelve variante alterna ('administrador') si el rol base es 'admin'
 */
export function buildAdminAlternateRole(rawRole?: string | null): string | null {
  if (!rawRole) return null
  const trimmed = rawRole.trim()
  const lower = trimmed.toLowerCase()
  const idx = lower.indexOf('||tenant|')
  if (idx !== -1) {
    const base = trimmed.slice(0, idx).trim().toLowerCase()
    if (base === 'admin') {
      return `administrador${trimmed.slice(idx)}`
    }
    return null
  }
  if (lower === 'admin') return 'administrador'
  return null
}

/**
 * Compara si dos cadenas de rol representan exactamente el mismo nivel y tenant
 */
export function rolesMatchEquivalent(
  a?: string | null,
  b?: string | null
): boolean {
  const left = splitTenantSuffixFromRole(a)
  const right = splitTenantSuffixFromRole(b)
  if (left.tenantKey !== right.tenantKey) return false
  const leftFamily = normalizeBaseRoleFamily(left.base)
  const rightFamily = normalizeBaseRoleFamily(right.base)
  return Boolean(leftFamily) && leftFamily === rightFamily
}

function isRichEncodedRole(rol?: string | null): boolean {
  if (!rol) return false
  const lower = rol.trim().toLowerCase()
  return (
    lower.startsWith('independiente|') ||
    lower.startsWith('subadmin|') ||
    lower.includes('||tenant|')
  )
}

interface MergeCacheOptions {
  markLocalOnly?: boolean
  replaceSyncedRows?: boolean
}

function mergePerfilesIntoCache(
  entradas: Perfil[],
  options: MergeCacheOptions = {}
): Perfil[] {
  const actuales = readPerfilesCache()
  if (!entradas.length) {
    return actuales
  }
  const prevById = new Map<string, Perfil>()
  for (const item of actuales) {
    if (item?.id) prevById.set(item.id, item)
  }

  const nextMap = new Map<string, Perfil>()
  if (!options.replaceSyncedRows) {
    for (const item of actuales) {
      if (item?.id) nextMap.set(item.id, item)
    }
  } else {
    // Al recibir filas reales de Supabase, conservar entradas pendientes de sincronización local
    const incomingIds = new Set(entradas.map((e) => e.id).filter(Boolean))
    const incomingEmails = new Set(
      entradas.map((e) => (e.email || '').trim().toLowerCase()).filter(Boolean)
    )
    for (const item of actuales) {
      const emailKey = (item.email || '').trim().toLowerCase()
      if (
        item?.id &&
        item.localOnly &&
        !incomingIds.has(item.id) &&
        (!emailKey || !incomingEmails.has(emailKey))
      ) {
        nextMap.set(item.id, item)
      }
    }
  }

  const mergedResultados: Perfil[] = []
  for (const item of entradas) {
    if (!item?.id) continue
    const prev = prevById.get(item.id)
    const incomingCorrupted = isCorruptedRoleString(item.rol)
    const incomingGeneric =
      incomingCorrupted || item.rol.trim().toLowerCase() === 'operador'
    const resolvedRol =
      incomingGeneric && isRichEncodedRole(prev?.rol)
        ? prev!.rol
        : incomingCorrupted
          ? sanitizePerfilRole(item.rol, item.email, prev?.rol)
          : item.rol
    const resolvedLocalOnly =
      options.markLocalOnly !== undefined
        ? options.markLocalOnly
        : item.localOnly !== undefined
          ? item.localOnly
          : prev?.localOnly
    const merged: Perfil = {
      ...prev,
      ...item,
      rol: resolvedRol,
      ...(resolvedLocalOnly !== undefined
        ? { localOnly: resolvedLocalOnly }
        : {}),
    }
    nextMap.set(item.id, merged)
    mergedResultados.push(merged)
  }
  const allValues = Array.from(nextMap.values())
  writePerfilesCache(allValues)
  return options.replaceSyncedRows ? allValues : mergedResultados
}

/**
 * Persiste o actualiza la fila en `public.perfiles` manejando tolerancia de columnas/constraints
 */
export async function upsertPerfilSafely(
  client: typeof supabase,
  params: {
    id: string
    nombre: string
    email: string
    rol: string
    avatar_url?: string | null
  }
): Promise<boolean> {
  const now = new Date().toISOString()
  const roleCandidates: string[] = [params.rol]
  const adminAlt = buildAdminAlternateRole(params.rol)
  if (adminAlt && !roleCandidates.includes(adminAlt)) {
    roleCandidates.push(adminAlt)
  }
  const allowOperadorFallback = isRichEncodedRole(params.rol)
  if (allowOperadorFallback && !roleCandidates.includes('operador')) {
    roleCandidates.push('operador')
  }

  for (const candidateRol of roleCandidates) {
    const basePayload = {
      id: params.id,
      nombre: params.nombre,
      email: params.email,
      rol: candidateRol,
      updated_at: now,
      ...(params.avatar_url ? { avatar_url: params.avatar_url } : {}),
    }

    const { error: primaryError } = await client
      .from('perfiles')
      .upsert({ ...basePayload, estado: 'Activo' }, { onConflict: 'id' })

    let upsertOk = !primaryError
    if (!upsertOk) {
      // Reintentar sin `estado` por compatibilidad con esquemas sin esa columna
      const { error: withoutEstadoError } = await client
        .from('perfiles')
        .upsert(basePayload, { onConflict: 'id' })
      upsertOk = !withoutEstadoError
    }

    if (!upsertOk) continue

    const isLastResortOperador =
      candidateRol === 'operador' && !rolesMatchEquivalent(candidateRol, params.rol)
    if (isLastResortOperador) {
      return true
    }

    // Verificar que un trigger o constraint en DB no haya degradado el rol (ej. admin -> consultor)
    try {
      const { data: verified, error: checkError } = await client
        .from('perfiles')
        .select('id, rol')
        .eq('id', params.id)
        .maybeSingle()

      if (!checkError && verified?.id === params.id) {
        if (rolesMatchEquivalent(verified.rol, params.rol)) {
          return true
        }
        // Si la DB sobrescribió el rol solicitado (p. ej. 'admin' rechazado), probar variante alterna
        continue
      }
    } catch {
      // Si el cliente aislado no tiene SELECT pero el upsert no falló, aceptar equivalente
    }

    if (rolesMatchEquivalent(candidateRol, params.rol)) {
      return true
    }
  }

  return false
}

function isMissingSessionColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string; details?: string }
  const msg = `${e.message || ''} ${e.details || ''}`.toLowerCase()
  return (
    e.code === '42703' ||
    e.code === 'PGRST204' ||
    msg.includes('sesion_unica') ||
    msg.includes('active_session_token')
  )
}

export const perfilesService = {
  getCachedPerfiles(): Perfil[] {
    return readPerfilesCache()
  },

  cachePerfilesList(
    perfiles: Perfil[],
    options?: { markLocalOnly?: boolean }
  ): void {
    mergePerfilesIntoCache(perfiles, {
      markLocalOnly: options?.markLocalOnly,
    })
  },

  removePerfilFromCache(id: string): void {
    if (!id) return
    const actuales = readPerfilesCache()
    const filtrados = actuales.filter((p) => p.id !== id)
    if (filtrados.length !== actuales.length) {
      writePerfilesCache(filtrados)
    }
  },

  updatePerfilInCache(id: string, updates: Partial<Perfil>): void {
    if (!id) return
    const actuales = readPerfilesCache()
    let updated = false
    const lista = actuales.map((p) => {
      if (p.id !== id) return p
      updated = true
      return {
        ...p,
        ...updates,
        updated_at: new Date().toISOString(),
      }
    })
    if (updated) {
      writePerfilesCache(lista)
    }
  },

  async hasLiveSupabaseSession(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession()
      return Boolean(data?.session?.access_token)
    } catch {
      return false
    }
  },

  getCachedPerfilByEmailOrId(params: {
    id?: string | null
    email?: string | null
  }): Perfil | null {
    const lista = readPerfilesCache()
    if (params.id) {
      const porId = lista.find((p) => p.id === params.id)
      if (porId) return porId
    }
    if (params.email) {
      const emailKey = params.email.trim().toLowerCase()
      const porEmail = lista.find(
        (p) => (p.email || '').trim().toLowerCase() === emailKey
      )
      if (porEmail) return porEmail
    }
    return null
  },

  /**
   * Obtiene el perfil de un usuario por su ID (UUID de auth.users)
   */
  async getPerfilById(id: string): Promise<Perfil | null> {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        const fallback = this.getCachedPerfilByEmailOrId({ id })
        if (fallback) return fallback
        throw error
      }
      if (data) {
        const merged = mergePerfilesIntoCache([data as Perfil], {
          markLocalOnly: false,
        })
        return merged[0] ?? (data as Perfil)
      }
      return this.getCachedPerfilByEmailOrId({ id })
    } catch (err) {
      const fallback = this.getCachedPerfilByEmailOrId({ id })
      if (fallback) return fallback
      throw err
    }
  },

  /**
   * Obtiene o autorrepara el perfil en `public.perfiles` para un usuario ya autenticado en Supabase Auth.
   * Evita rechazar logins legítimos si el trigger no creó la fila o fue borrada de `public.perfiles`.
   */
  async ensurePerfilForAuthUser(
    sbUser: {
      id: string
      email?: string | null
      created_at?: string | null
      user_metadata?: Record<string, unknown> | null
    },
    extraFallback?: { nombre?: string; rol?: string }
  ): Promise<Perfil> {
    const cleanEmail = (sbUser.email || '').trim().toLowerCase()
    const cached = this.getCachedPerfilByEmailOrId({
      id: sbUser.id,
      email: cleanEmail || undefined,
    })

    const metaName =
      typeof sbUser.user_metadata?.name === 'string'
        ? sbUser.user_metadata.name.trim()
        : ''
    const metaRole =
      typeof sbUser.user_metadata?.role === 'string'
        ? sbUser.user_metadata.role.trim()
        : ''
    const metaAvatar =
      typeof sbUser.user_metadata?.avatar_url === 'string'
        ? sbUser.user_metadata.avatar_url
        : null

    let dbError: unknown = null
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle()

      if (error) {
        dbError = error
      } else if (data) {
        const dbPerfil = data as Perfil
        if (isCorruptedRoleString(dbPerfil.rol)) {
          const rescuedRol = sanitizePerfilRole(
            dbPerfil.rol,
            dbPerfil.email || cleanEmail || cached?.email,
            (cached?.rol && isRichEncodedRole(cached.rol) ? cached.rol : '') ||
              metaRole ||
              cached?.rol ||
              extraFallback?.rol
          )
          const rescuedNombre =
            dbPerfil.nombre?.trim() ||
            metaName ||
            cached?.nombre ||
            extraFallback?.nombre ||
            (cleanEmail ? cleanEmail.split('@')[0] : '') ||
            'Usuario'
          await upsertPerfilSafely(supabase, {
            id: dbPerfil.id,
            nombre: rescuedNombre,
            email: dbPerfil.email || cleanEmail || cached?.email || '',
            rol: rescuedRol,
            avatar_url: dbPerfil.avatar_url || metaAvatar || cached?.avatar_url || null,
          })
          const repairedRow: Perfil = {
            ...dbPerfil,
            nombre: rescuedNombre,
            rol: rescuedRol,
          }
          const mergedRepaired = mergePerfilesIntoCache([repairedRow], {
            markLocalOnly: false,
          })
          return mergedRepaired[0] ?? repairedRow
        }
        const merged = mergePerfilesIntoCache([dbPerfil], {
          markLocalOnly: false,
        })
        return merged[0] ?? dbPerfil
      }
    } catch (err) {
      dbError = err
    }

    const nombre =
      metaName ||
      cached?.nombre ||
      extraFallback?.nombre ||
      (cleanEmail ? cleanEmail.split('@')[0] : '') ||
      'Usuario'
    const rol = sanitizePerfilRole(
      null,
      cleanEmail || cached?.email,
      (cached?.rol && isRichEncodedRole(cached.rol) ? cached.rol : '') ||
        metaRole ||
        cached?.rol ||
        extraFallback?.rol
    )
    const now = new Date().toISOString()

    // Intentar restaurar la fila faltante en `public.perfiles` (RLS `auth.uid() = id` lo permite)
    const repaired = !dbError
      ? await upsertPerfilSafely(supabase, {
          id: sbUser.id,
          nombre,
          email: cleanEmail || cached?.email || '',
          rol,
          avatar_url: metaAvatar || cached?.avatar_url || null,
        })
      : false

    if (repaired) {
      const { data: reloaded } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle()
      if (reloaded) {
        const merged = mergePerfilesIntoCache(
          [{ ...(reloaded as Perfil), rol }],
          { markLocalOnly: false }
        )
        return merged[0] ?? ({ ...(reloaded as Perfil), rol })
      }
    }

    const synthesized: Perfil = {
      id: sbUser.id,
      nombre,
      email: cleanEmail || cached?.email || '',
      rol,
      estado: cached?.estado || 'Activo',
      avatar_url: metaAvatar || cached?.avatar_url || null,
      sesion_unica: cached?.sesion_unica,
      active_session_token: cached?.active_session_token,
      created_at: cached?.created_at || sbUser.created_at || now,
      updated_at: now,
      localOnly: !repaired,
    }
    mergePerfilesIntoCache([synthesized], { markLocalOnly: !repaired })
    return synthesized
  },

  /**
   * Obtiene todos los perfiles de usuarios (conservando respaldo local si RLS oculta filas sin sesión Auth)
   */
  async getPerfiles(): Promise<Perfil[]> {
    const cached = readPerfilesCache()
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .order('nombre', { ascending: true })

      if (error) {
        if (cached.length > 0) return cached
        throw error
      }

      const lista = (data as Perfil[]) || []
      if (lista.length === 0) {
        return cached
      }

      const merged = mergePerfilesIntoCache(lista, {
        markLocalOnly: false,
        replaceSyncedRows: true,
      })
      return merged.length > 0 ? merged : lista
    } catch (err) {
      if (cached.length > 0) return cached
      throw err
    }
  },

  /**
   * Actualiza los datos de un perfil
   */
  async updatePerfil(id: string, updates: PerfilUpdate): Promise<Perfil> {
    const { data, error } = await supabase
      .from('perfiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }
    if (data) {
      mergePerfilesIntoCache([data as Perfil], { markLocalOnly: false })
    }
    return data as Perfil
  },

  /**
   * Activa o desactiva la restricción de sesión única (1 dispositivo a la vez).
   * Al desactivarla limpia cualquier token de dispositivo activo.
   */
  async setSesionUnica(id: string, sesionUnica: boolean): Promise<Perfil> {
    const updates: PerfilUpdate = { sesion_unica: sesionUnica }
    if (!sesionUnica) {
      updates.active_session_token = null
    }
    try {
      return await this.updatePerfil(id, updates)
    } catch (error) {
      if (isMissingSessionColumnError(error)) {
        throw new Error(
          'La base de datos aún no tiene las columnas de sesión única. Ejecuta la migración 20261112010000_add_taller_iva_and_session_policy.sql en Supabase.'
        )
      }
      throw error
    }
  },

  /**
   * Registra o libera el token de dispositivo activo en el perfil del usuario.
   * Tolerante a esquemas sin migrar para no bloquear el inicio de sesión normal.
   */
  async claimDeviceSession(id: string, deviceToken: string | null): Promise<void> {
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({
          active_session_token: deviceToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error && !isMissingSessionColumnError(error)) {
        console.warn('[perfilesService] No se pudo actualizar active_session_token:', error.message)
      }
    } catch (err) {
      console.warn('[perfilesService] Error en claimDeviceSession:', err)
    }
  },
}
