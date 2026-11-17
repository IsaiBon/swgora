import { supabase } from './supabase'
import { compressImage } from './storageService'

export interface ParsedActiveDeviceSession {
  token: string
  label: string
  boundAt?: string
}

export interface DeviceSessionPolicyState {
  maxDevices: number
  devices: ParsedActiveDeviceSession[]
}

export function parseDeviceSessionState(raw?: string | null): DeviceSessionPolicyState {
  const clean = typeof raw === 'string' ? raw.trim() : ''
  if (!clean) {
    return { maxDevices: 1, devices: [] }
  }
  if (clean.startsWith('{')) {
    try {
      const parsed = JSON.parse(clean) as {
        max?: unknown
        devices?: unknown
        t?: unknown
        d?: unknown
        at?: unknown
      }

      if (Array.isArray(parsed.devices) || typeof parsed.max === 'number') {
        const rawMax = typeof parsed.max === 'number' && Number.isFinite(parsed.max) ? Math.floor(parsed.max) : 1
        const maxDevices = Math.max(1, Math.min(20, rawMax))
        const devices: ParsedActiveDeviceSession[] = []
        const seen = new Set<string>()
        if (Array.isArray(parsed.devices)) {
          for (const item of parsed.devices) {
            if (!item || typeof item !== 'object') continue
            const row = item as { t?: unknown; d?: unknown; at?: unknown }
            const token = typeof row.t === 'string' ? row.t.trim() : ''
            if (!token || seen.has(token)) continue
            seen.add(token)
            devices.push({
              token,
              label: typeof row.d === 'string' && row.d.trim() ? row.d.trim() : 'Dispositivo vinculado',
              boundAt: typeof row.at === 'string' && row.at.trim() ? row.at.trim() : undefined,
            })
          }
        }
        return { maxDevices, devices }
      }

      if (typeof parsed.t === 'string' && parsed.t.trim()) {
        return {
          maxDevices: 1,
          devices: [
            {
              token: parsed.t.trim(),
              label: typeof parsed.d === 'string' && parsed.d.trim() ? parsed.d.trim() : 'Dispositivo vinculado',
              boundAt: typeof parsed.at === 'string' && parsed.at.trim() ? parsed.at.trim() : undefined,
            },
          ],
        }
      }
    } catch {
      // Fallback a formato de token plano legado
    }
  }
  return {
    maxDevices: 1,
    devices: [
      {
        token: clean,
        label: 'Dispositivo vinculado',
      },
    ],
  }
}

export function serializeDeviceSessionState(state: DeviceSessionPolicyState): string | null {
  const maxDevices = Math.max(1, Math.min(20, Math.floor(state.maxDevices || 1)))
  const deduped: ParsedActiveDeviceSession[] = []
  const seen = new Set<string>()
  for (const d of state.devices || []) {
    const cleanToken = d.token.trim()
    if (!cleanToken || seen.has(cleanToken)) continue
    seen.add(cleanToken)
    deduped.push({
      token: cleanToken,
      label: (d.label || 'Dispositivo vinculado').trim(),
      boundAt: d.boundAt || new Date().toISOString(),
    })
  }
  if (maxDevices === 1 && deduped.length === 0) {
    return null
  }
  if (maxDevices === 1 && deduped.length === 1) {
    const first = deduped[0]!
    return JSON.stringify({
      t: first.token,
      d: first.label,
      at: first.boundAt,
    })
  }
  return JSON.stringify({
    max: maxDevices,
    devices: deduped.map((d) => ({
      t: d.token,
      d: d.label,
      at: d.boundAt,
    })),
  })
}

export function parseActiveSessionToken(raw?: string | null): ParsedActiveDeviceSession | null {
  return parseDeviceSessionState(raw).devices[0] || null
}

export function serializeActiveDeviceSession(
  token: string,
  label: string,
  boundAt = new Date().toISOString()
): string {
  return JSON.stringify({
    t: token,
    d: label.trim() || 'Dispositivo vinculado',
    at: boundAt,
  })
}

export function getBrowserDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo web'
  const ua = navigator.userAgent || ''
  let os = 'Equipo'
  if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  let browser = 'Navegador'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari'

  return `${os} · ${browser}`
}

export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: string
  estado: 'Activo' | 'Inactivo'
  credencial?: string | null
  telefono?: string | null
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
    telefono?: string | null
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
      ...(params.telefono !== undefined ? { telefono: params.telefono } : {}),
      ...(params.avatar_url ? { avatar_url: params.avatar_url } : {}),
    }

    const { error: primaryError } = await client
      .from('perfiles')
      .upsert({ ...basePayload, estado: 'Activo' }, { onConflict: 'id' })

    let upsertOk = !primaryError
    if (!upsertOk && params.telefono !== undefined && isMissingTelefonoColumnError(primaryError)) {
      const { telefono: _ignoredTel, ...payloadSinTelefono } = basePayload
      const { error: retrySinTel } = await client
        .from('perfiles')
        .upsert({ ...payloadSinTelefono, estado: 'Activo' }, { onConflict: 'id' })
      upsertOk = !retrySinTel
      if (!upsertOk) {
        const { error: withoutEstadoSinTel } = await client
          .from('perfiles')
          .upsert(payloadSinTelefono, { onConflict: 'id' })
        upsertOk = !withoutEstadoSinTel
      }
    }
    if (!upsertOk) {
      // Reintentar sin `estado` por compatibilidad con esquemas sin esa columna
      const { error: withoutEstadoError } = await client
        .from('perfiles')
        .upsert(basePayload, { onConflict: 'id' })
      upsertOk = !withoutEstadoError
      if (!upsertOk && params.telefono !== undefined && isMissingTelefonoColumnError(withoutEstadoError)) {
        const { telefono: _ignoredTel, ...payloadSinTelefono } = basePayload
        const { error: retryBoth } = await client
          .from('perfiles')
          .upsert(payloadSinTelefono, { onConflict: 'id' })
        upsertOk = !retryBoth
      }
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

function isMissingTelefonoColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string; details?: string }
  const msg = `${e.message || ''} ${e.details || ''}`.toLowerCase()
  return (
    (e.code === '42703' || e.code === 'PGRST204') &&
    msg.includes('telefono')
  ) || msg.includes("column 'telefono'") || msg.includes('column "telefono"') || msg.includes('perfiles.telefono')
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
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('perfiles')
      .update({
        ...updates,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      if ('telefono' in updates && isMissingTelefonoColumnError(error)) {
        const { telefono, ...rest } = updates
        this.updatePerfilInCache(id, { telefono: telefono ?? null })
        if (Object.keys(rest).length > 0) {
          const { data: restData, error: restError } = await supabase
            .from('perfiles')
            .update({
              ...rest,
              updated_at: now,
            })
            .eq('id', id)
            .select()
            .maybeSingle()
          if (restError) throw restError
          if (restData) {
            const merged = mergePerfilesIntoCache(
              [{ ...(restData as Perfil), telefono: telefono ?? null }],
              { markLocalOnly: false }
            )
            return merged[0] ?? ({ ...(restData as Perfil), telefono: telefono ?? null })
          }
        }
        const cached = this.getCachedPerfilByEmailOrId({ id })
        if (cached) {
          return { ...cached, telefono: telefono ?? null, updated_at: now }
        }
      }
      throw error
    }
    if (!data) {
      throw new Error(
        'No se pudo actualizar el perfil en Supabase (sin permisos RLS o el perfil no existe en la nube).'
      )
    }
    mergePerfilesIntoCache([data as Perfil], { markLocalOnly: false })
    return data as Perfil
  },

  /**
   * Comprime y sube la foto de perfil del usuario al bucket 'taller' (o genera un Data URL compacto de respaldo).
   */
  async uploadAvatar(file: File, userId: string): Promise<string> {
    let fileToUpload: File = file
    try {
      const compressed = await compressImage(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.84,
      })
      fileToUpload = compressed.file
    } catch {
      fileToUpload = file
    }

    const cleanUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
    const ext = fileToUpload.name.split('.').pop()?.toLowerCase() || 'webp'
    const filePath = `avatars/${cleanUserId}_${Date.now()}.${ext}`

    try {
      const { data, error } = await supabase.storage
        .from('taller')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileToUpload.type || 'image/webp',
        })

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('taller')
          .getPublicUrl(data.path)

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl
        }
      } else if (error) {
        console.warn('[perfilesService] Error subiendo avatar a Storage, usando Data URL:', error.message)
      }
    } catch (err) {
      console.warn('[perfilesService] Excepción subiendo avatar a Storage:', err)
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(fileToUpload)
    })
  },

  /**
   * Actualiza la foto de perfil (avatar_url) en `public.perfiles` y en el caché local.
   * Si no hay sesión real en Supabase (sesión de bóveda local), respalda el cambio localmente.
   */
  async updateAvatar(id: string, avatarUrl: string | null): Promise<{ perfil: Perfil | null; persistedInDb: boolean }> {
    const hasSession = await this.hasLiveSupabaseSession()
    if (!hasSession) {
      this.updatePerfilInCache(id, { avatar_url: avatarUrl })
      const cached = this.getCachedPerfilByEmailOrId({ id })
      return { perfil: cached, persistedInDb: false }
    }

    const updated = await this.updatePerfil(id, { avatar_url: avatarUrl })
    return { perfil: updated, persistedInDb: true }
  },

  /**
   * Activa o desactiva la restricción de sesión única (1 dispositivo a la vez).
   * Al desactivarla limpia cualquier token de dispositivo activo.
   */
  async setSesionUnica(id: string, sesionUnica: boolean): Promise<Perfil> {
    return this.setMaxDevicesPolicy(id, sesionUnica ? 1 : null, null)
  },

  /**
   * Configura el límite de dispositivos autorizados para la cuenta (`null` = Multi-dispositivo libre, `1..20` = límite fijo).
   */
  async setMaxDevicesPolicy(
    id: string,
    maxDevices: number | null,
    currentRawToken?: string | null
  ): Promise<Perfil> {
    const updates: PerfilUpdate =
      maxDevices === null
        ? { sesion_unica: false, active_session_token: null }
        : (() => {
            const clampedMax = Math.max(1, Math.min(20, Math.floor(maxDevices)))
            const current = parseDeviceSessionState(currentRawToken)
            const serialized = serializeDeviceSessionState({
              maxDevices: clampedMax,
              devices: current.devices.slice(0, clampedMax),
            })
            return { sesion_unica: true, active_session_token: serialized }
          })()
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
   * Desvincula un dispositivo específico (o todos si `deviceTokenToRemove === null`), conservando el límite de dispositivos.
   */
  async removeBoundDevice(
    id: string,
    deviceTokenToRemove: string | null,
    currentRawToken?: string | null
  ): Promise<Perfil> {
    const current = parseDeviceSessionState(currentRawToken)
    const remainingDevices =
      deviceTokenToRemove === null
        ? []
        : current.devices.filter((d) => d.token !== deviceTokenToRemove)
    const serialized = serializeDeviceSessionState({
      maxDevices: current.maxDevices,
      devices: remainingDevices,
    })
    return await this.updatePerfil(id, {
      active_session_token: serialized,
    })
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

      if (error) {
        if (!isMissingSessionColumnError(error)) {
          console.warn('[perfilesService] No se pudo actualizar active_session_token:', error.message)
        }
        return
      }
      this.updatePerfilInCache(id, { active_session_token: deviceToken })
    } catch (err) {
      console.warn('[perfilesService] Error en claimDeviceSession:', err)
    }
  },
}
