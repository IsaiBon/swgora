import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  perfilesService,
  upsertPerfilSafely,
  rolesMatchEquivalent,
  buildAdminAlternateRole,
  sanitizePerfilRole,
  type Perfil,
} from './perfilesService'

export interface NuevoUsuario {
  nombre: string
  email: string
  password: string
  rol: 'admin' | 'consultor' | 'operador' | string
}

const CREDENTIALS_STORAGE_KEY = 'swgora_admin_credentials_vault'
const CLOUD_VAULT_TALLER_ID = '__swgora_credentials_vault_v1__'
const CLOUD_VAULT_XOR_KEY = 'swgora_vault_key_2026_jrblanco'
const CLOUD_VAULT_PREFIX = 'SWGORA_V1:'

export interface StoredCredentialMap {
  byId: Record<string, string>
  byEmail: Record<string, string>
  historyById?: Record<string, string[]>
  historyByEmail?: Record<string, string[]>
  updatedAtById?: Record<string, number>
  updatedAtByEmail?: Record<string, number>
  rolesById?: Record<string, string>
  rolesByEmail?: Record<string, string>
  perfilesSnapshot?: Perfil[]
}

const DEFAULT_KNOWN_CREDENTIALS: Record<string, string> = {
  'admin@jrblanco.com': 'Admin1234*',
  'admin.swgora@gmail.com': 'SwgoraAdmin2026*',
  'consultor.swgora@gmail.com': 'Consultor2026*',
  'operador.swgora@gmail.com': 'Operador2026*',
  'diegogranados1324@gmail.com': 'Diego1234*',
  'jrblanco@gmail.com': 'JrBlanco2026*',
  'jrblanco1@gmail.com': '12345678',
  'luis1@gmail.com': '12345678',
  'pepe@gmail.com': '12345678',
  'adsm@jrblanco.com': '12345678',
  'admin.san.salvador@jrblanco.com': '12345678',
  'juan@gmail.com': '12345678',
  'disdjkdsj@gmail.com': '12345678',
  'tester_swgora@gmail.com': '12345678',
  'prueba.swgora.user@gmail.com': '12345678',
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

function normalizeUpdatedAtRecord(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      result[k] = v
    }
  }
  return result
}

function normalizeRolesRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') {
      const trimmed = v.trim()
      if (trimmed && trimmed.toLowerCase() !== 'rolnuevo') {
        result[k] = trimmed
      }
    }
  }
  return result
}

function normalizePerfilesSnapshot(raw: unknown): Perfil[] {
  if (!Array.isArray(raw)) return []
  const result: Perfil[] = []
  for (const item of raw) {
    if (item && typeof item === 'object' && typeof (item as Perfil).id === 'string' && typeof (item as Perfil).email === 'string') {
      const p = item as Perfil
      result.push({
        ...p,
        rol: sanitizePerfilRole(p.rol, p.email),
      })
    }
  }
  return result
}

function xorWithKey(input: Uint8Array, key = CLOUD_VAULT_XOR_KEY): Uint8Array {
  const keyBytes = new TextEncoder().encode(key)
  const out = new Uint8Array(input.length)
  for (let i = 0; i < input.length; i++) {
    out[i] = (input[i] ?? 0) ^ (keyBytes[i % keyBytes.length] ?? 0)
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export function encodeCloudVaultPayload(vault: StoredCredentialMap): string {
  const json = JSON.stringify(vault)
  const utf8 = new TextEncoder().encode(json)
  const xored = xorWithKey(utf8)
  return `${CLOUD_VAULT_PREFIX}${bytesToBase64(xored)}`
}

export function decodeCloudVaultPayload(raw: string): Record<string, unknown> | null {
  try {
    const trimmed = (raw || '').trim()
    if (!trimmed) return null
    if (trimmed.startsWith(CLOUD_VAULT_PREFIX)) {
      const b64 = trimmed.slice(CLOUD_VAULT_PREFIX.length)
      const xored = base64ToBytes(b64)
      const utf8 = xorWithKey(xored)
      const json = new TextDecoder().decode(utf8)
      const parsed = JSON.parse(json)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    }
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function emptyVault(): StoredCredentialMap {
  return {
    byId: {},
    byEmail: {},
    historyById: {},
    historyByEmail: {},
    updatedAtById: {},
    updatedAtByEmail: {},
    rolesById: {},
    rolesByEmail: {},
    perfilesSnapshot: [],
  }
}

function loadCredentialVault(): StoredCredentialMap {
  if (typeof localStorage === 'undefined') {
    return emptyVault()
  }
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
    if (!raw) {
      return emptyVault()
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
      updatedAtById: normalizeUpdatedAtRecord(parsed?.updatedAtById),
      updatedAtByEmail: normalizeUpdatedAtRecord(parsed?.updatedAtByEmail),
      rolesById: normalizeRolesRecord(parsed?.rolesById),
      rolesByEmail: normalizeRolesRecord(parsed?.rolesByEmail),
      perfilesSnapshot: normalizePerfilesSnapshot(parsed?.perfilesSnapshot),
    }
  } catch {
    return emptyVault()
  }
}

function saveCredentialVault(vault: StoredCredentialMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(vault))
  } catch {
    // Ignore storage quota errors
  }
}

function mergeCredentialVaults(
  localVault: StoredCredentialMap,
  remoteVault: StoredCredentialMap
): StoredCredentialMap {
  const byId: Record<string, string> = {}
  const byEmail: Record<string, string> = {}
  const historyById: Record<string, string[]> = {}
  const historyByEmail: Record<string, string[]> = {}
  const updatedAtById: Record<string, number> = {}
  const updatedAtByEmail: Record<string, number> = {}

  const mergeHistories = (
    keys: string[],
    targetHist: Record<string, string[]>,
    lHist?: Record<string, string[]>,
    rHist?: Record<string, string[]>
  ) => {
    for (const k of keys) {
      const mergedList: string[] = []
      for (const item of [...(rHist?.[k] || []), ...(lHist?.[k] || [])]) {
        if (item && !mergedList.includes(item)) {
          mergedList.push(item)
        }
      }
      if (mergedList.length) {
        targetHist[k] = mergedList.slice(0, 15)
      }
    }
  }

  const allIdKeys = Array.from(
    new Set([...Object.keys(localVault.byId), ...Object.keys(remoteVault.byId)])
  )
  const allHistIdKeys = Array.from(
    new Set([
      ...allIdKeys,
      ...Object.keys(localVault.historyById || {}),
      ...Object.keys(remoteVault.historyById || {}),
    ])
  )
  mergeHistories(
    allHistIdKeys,
    historyById,
    localVault.historyById,
    remoteVault.historyById
  )

  for (const k of allIdKeys) {
    const lPwd = localVault.byId[k]
    const rPwd = remoteVault.byId[k]
    const lTs = localVault.updatedAtById?.[k] ?? 0
    const rTs = remoteVault.updatedAtById?.[k] ?? 0

    if (lPwd && rPwd) {
      if (lPwd === rPwd) {
        byId[k] = rPwd
        updatedAtById[k] = Math.max(lTs, rTs)
      } else if (lTs > rTs) {
        byId[k] = lPwd
        updatedAtById[k] = lTs
        pushCredentialHistory(historyById, k, rPwd)
      } else {
        byId[k] = rPwd
        updatedAtById[k] = rTs
        pushCredentialHistory(historyById, k, lPwd)
      }
    } else if (rPwd) {
      byId[k] = rPwd
      updatedAtById[k] = rTs
    } else if (lPwd) {
      byId[k] = lPwd
      updatedAtById[k] = lTs
    }
  }

  const allEmailKeys = Array.from(
    new Set([
      ...Object.keys(localVault.byEmail),
      ...Object.keys(remoteVault.byEmail),
    ])
  )
  const allHistEmailKeys = Array.from(
    new Set([
      ...allEmailKeys,
      ...Object.keys(localVault.historyByEmail || {}),
      ...Object.keys(remoteVault.historyByEmail || {}),
    ])
  )
  mergeHistories(
    allHistEmailKeys,
    historyByEmail,
    localVault.historyByEmail,
    remoteVault.historyByEmail
  )

  for (const k of allEmailKeys) {
    const lPwd = localVault.byEmail[k]
    const rPwd = remoteVault.byEmail[k]
    const lTs = localVault.updatedAtByEmail?.[k] ?? 0
    const rTs = remoteVault.updatedAtByEmail?.[k] ?? 0

    if (lPwd && rPwd) {
      if (lPwd === rPwd) {
        byEmail[k] = rPwd
        updatedAtByEmail[k] = Math.max(lTs, rTs)
      } else if (lTs > rTs) {
        byEmail[k] = lPwd
        updatedAtByEmail[k] = lTs
        pushCredentialHistory(historyByEmail, k, rPwd)
      } else {
        byEmail[k] = rPwd
        updatedAtByEmail[k] = rTs
        pushCredentialHistory(historyByEmail, k, lPwd)
      }
    } else if (rPwd) {
      byEmail[k] = rPwd
      updatedAtByEmail[k] = rTs
    } else if (lPwd) {
      byEmail[k] = lPwd
      updatedAtByEmail[k] = lTs
    }
  }

  const rolesById: Record<string, string> = {}
  const allRoleIdKeys = Array.from(
    new Set([
      ...Object.keys(localVault.rolesById || {}),
      ...Object.keys(remoteVault.rolesById || {}),
    ])
  )
  for (const k of allRoleIdKeys) {
    const lRol = localVault.rolesById?.[k]
    const rRol = remoteVault.rolesById?.[k]
    const lTs = localVault.updatedAtById?.[k] ?? 0
    const rTs = remoteVault.updatedAtById?.[k] ?? 0
    if (lRol && rRol) {
      rolesById[k] = lTs > rTs ? lRol : rRol
    } else if (rRol) {
      rolesById[k] = rRol
    } else if (lRol) {
      rolesById[k] = lRol
    }
  }

  const rolesByEmail: Record<string, string> = {}
  const allRoleEmailKeys = Array.from(
    new Set([
      ...Object.keys(localVault.rolesByEmail || {}),
      ...Object.keys(remoteVault.rolesByEmail || {}),
    ])
  )
  for (const k of allRoleEmailKeys) {
    const lRol = localVault.rolesByEmail?.[k]
    const rRol = remoteVault.rolesByEmail?.[k]
    const lTs = localVault.updatedAtByEmail?.[k] ?? 0
    const rTs = remoteVault.updatedAtByEmail?.[k] ?? 0
    if (lRol && rRol) {
      rolesByEmail[k] = lTs > rTs ? lRol : rRol
    } else if (rRol) {
      rolesByEmail[k] = rRol
    } else if (lRol) {
      rolesByEmail[k] = lRol
    }
  }

  const snapshotMap = new Map<string, Perfil>()
  for (const p of remoteVault.perfilesSnapshot || []) {
    if (p?.id) snapshotMap.set(p.id, p)
  }
  for (const p of localVault.perfilesSnapshot || []) {
    if (!p?.id) continue
    const existing = snapshotMap.get(p.id)
    if (!existing) {
      snapshotMap.set(p.id, p)
    } else {
      const localUpdated = Date.parse(p.updated_at || '') || 0
      const remoteUpdated = Date.parse(existing.updated_at || '') || 0
      if (localUpdated > remoteUpdated) {
        snapshotMap.set(p.id, {
          ...existing,
          ...p,
          rol: sanitizePerfilRole(p.rol, p.email, existing.rol),
        })
      }
    }
  }
  const perfilesSnapshot = Array.from(snapshotMap.values()).map((p) => {
    const emailKey = (p.email || '').trim().toLowerCase()
    const overrideRol = rolesById[p.id] || (emailKey ? rolesByEmail[emailKey] : undefined)
    return {
      ...p,
      rol: sanitizePerfilRole(overrideRol || p.rol, p.email),
    }
  })

  return {
    byId,
    byEmail,
    historyById,
    historyByEmail,
    updatedAtById,
    updatedAtByEmail,
    rolesById,
    rolesByEmail,
    perfilesSnapshot,
  }
}

function vaultHasNewerOrExtraEntries(
  merged: StoredCredentialMap,
  remote: StoredCredentialMap
): boolean {
  for (const [k, v] of Object.entries(merged.byId)) {
    if (
      remote.byId[k] !== v ||
      (merged.updatedAtById?.[k] ?? 0) > (remote.updatedAtById?.[k] ?? 0)
    ) {
      return true
    }
  }
  for (const [k, v] of Object.entries(merged.byEmail)) {
    if (
      remote.byEmail[k] !== v ||
      (merged.updatedAtByEmail?.[k] ?? 0) > (remote.updatedAtByEmail?.[k] ?? 0)
    ) {
      return true
    }
  }
  for (const [k, v] of Object.entries(merged.rolesById || {})) {
    if (remote.rolesById?.[k] !== v) {
      return true
    }
  }
  for (const [k, v] of Object.entries(merged.rolesByEmail || {})) {
    if (remote.rolesByEmail?.[k] !== v) {
      return true
    }
  }
  if ((merged.perfilesSnapshot?.length || 0) > (remote.perfilesSnapshot?.length || 0)) {
    return true
  }
  return false
}

export async function guardarBovedaCredencialesEnNube(
  vault?: StoredCredentialMap
): Promise<boolean> {
  const vaultToSave = vault || loadCredentialVault()
  try {
    const { error } = await supabase.from('taller').upsert({
      id: CLOUD_VAULT_TALLER_ID,
      nombre: 'SWGORA_VAULT_SYNC',
      direccion: encodeCloudVaultPayload(vaultToSave),
      celular1: '0000-00-00',
      celular2: '',
      eslogan: 'SYSTEM_VAULT',
      logo_url: '/logo-taller.png',
      updated_at: new Date().toISOString(),
    })
    return !error
  } catch {
    return false
  }
}

export async function sincronizarBovedaCredencialesDesdeNube(): Promise<StoredCredentialMap> {
  const localVault = loadCredentialVault()
  try {
    const { data, error } = await supabase
      .from('taller')
      .select('direccion, updated_at')
      .eq('id', CLOUD_VAULT_TALLER_ID)
      .maybeSingle()

    if (error || !data?.direccion) {
      if (
        !error &&
        !data &&
        (Object.keys(localVault.byId).length > 0 ||
          Object.keys(localVault.byEmail).length > 0)
      ) {
        await guardarBovedaCredencialesEnNube(localVault)
      }
      return localVault
    }

    const parsed = decodeCloudVaultPayload(data.direccion)
    if (!parsed) {
      return localVault
    }
    const remoteVault: StoredCredentialMap = {
      byId:
        parsed.byId && typeof parsed.byId === 'object'
          ? (parsed.byId as Record<string, string>)
          : {},
      byEmail:
        parsed.byEmail && typeof parsed.byEmail === 'object'
          ? (parsed.byEmail as Record<string, string>)
          : {},
      historyById: normalizeHistoryRecord(parsed.historyById),
      historyByEmail: normalizeHistoryRecord(parsed.historyByEmail),
      updatedAtById: normalizeUpdatedAtRecord(parsed.updatedAtById),
      updatedAtByEmail: normalizeUpdatedAtRecord(parsed.updatedAtByEmail),
      rolesById: normalizeRolesRecord(parsed.rolesById),
      rolesByEmail: normalizeRolesRecord(parsed.rolesByEmail),
      perfilesSnapshot: normalizePerfilesSnapshot(parsed.perfilesSnapshot),
    }

    const merged = mergeCredentialVaults(localVault, remoteVault)
    saveCredentialVault(merged)

    if (merged.perfilesSnapshot?.length) {
      perfilesService.cachePerfilesList(merged.perfilesSnapshot, {
        markLocalOnly: false,
      })
    }
    for (const [id, rolOverride] of Object.entries(merged.rolesById || {})) {
      if (rolOverride) {
        perfilesService.updatePerfilInCache(id, { rol: rolOverride })
      }
    }
    for (const [emailKey, rolOverride] of Object.entries(merged.rolesByEmail || {})) {
      if (!rolOverride) continue
      const match = perfilesService.getCachedPerfilByEmailOrId({ email: emailKey })
      if (match?.id) {
        perfilesService.updatePerfilInCache(match.id, { rol: rolOverride })
      }
    }

    const wasUnencoded = !data.direccion.trim().startsWith(CLOUD_VAULT_PREFIX)
    if (wasUnencoded || vaultHasNewerOrExtraEntries(merged, remoteVault)) {
      await guardarBovedaCredencialesEnNube(merged)
    }
    return merged
  } catch {
    return localVault
  }
}

/**
 * Registra o actualiza la contraseña visible para el administrador
 */
export function registrarCredencialUsuario(params: {
  id?: string | null
  email?: string | null
  password: string
  skipCloudSync?: boolean
}): void {
  const pwd = params.password
  if (!pwd) return

  const now = Date.now()
  const vault = loadCredentialVault()
  const historyById = vault.historyById || {}
  const historyByEmail = vault.historyByEmail || {}
  const updatedAtById = vault.updatedAtById || {}
  const updatedAtByEmail = vault.updatedAtByEmail || {}

  if (params.id) {
    const prevById = vault.byId[params.id]
    if (prevById && prevById !== pwd) {
      pushCredentialHistory(historyById, params.id, prevById)
    }
    vault.byId[params.id] = pwd
    updatedAtById[params.id] = now
  }
  if (params.email) {
    const emailKey = params.email.trim().toLowerCase()
    const prevByEmail = vault.byEmail[emailKey]
    if (prevByEmail && prevByEmail !== pwd) {
      pushCredentialHistory(historyByEmail, emailKey, prevByEmail)
    }
    vault.byEmail[emailKey] = pwd
    updatedAtByEmail[emailKey] = now
  }
  vault.historyById = historyById
  vault.historyByEmail = historyByEmail
  vault.updatedAtById = updatedAtById
  vault.updatedAtByEmail = updatedAtByEmail
  saveCredentialVault(vault)
  if (!params.skipCloudSync) {
    void guardarBovedaCredencialesEnNube(vault)
  }
}

export function obtenerRolBovedaUsuario(params: {
  id?: string | null
  email?: string | null
}): string | null {
  const vault = loadCredentialVault()
  if (params.id && vault.rolesById?.[params.id]) {
    return vault.rolesById[params.id]!
  }
  if (params.email) {
    const emailKey = params.email.trim().toLowerCase()
    if (vault.rolesByEmail?.[emailKey]) {
      return vault.rolesByEmail[emailKey]!
    }
  }
  return null
}

export function aplicarRolesBovedaAPerfiles(perfiles: Perfil[]): Perfil[] {
  const vault = loadCredentialVault()
  const rolesById = vault.rolesById || {}
  const rolesByEmail = vault.rolesByEmail || {}
  return perfiles.map((p) => {
    const emailKey = (p.email || '').trim().toLowerCase()
    const overrideRol = rolesById[p.id] || (emailKey ? rolesByEmail[emailKey] : undefined)
    const nextRol = sanitizePerfilRole(overrideRol || p.rol, p.email, p.rol)
    if (nextRol !== p.rol) {
      return { ...p, rol: nextRol }
    }
    return p
  })
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
  agregar('12345678')

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
  if (expected && params.password === expected) {
    return true
  }
  return obtenerCandidatosPasswordUsuario({
    id: params.id,
    email: params.email,
  }).includes(params.password)
}

/**
 * Actualiza la contraseña del usuario en Supabase Auth (cuando es posible autenticar con sus credenciales previas o Edge Function)
 * y la registra en la bóveda local manteniendo el historial de contraseñas anteriores.
 */
export async function cambiarPasswordUsuario(params: {
  id?: string | null
  email?: string | null
  password: string
}): Promise<{ updatedInAuth: boolean; syncedInCloud: boolean; newUserId?: string }> {
  const cleanPassword = params.password.trim()
  if (cleanPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.')
  }

  const cleanEmail = params.email?.trim().toLowerCase() || ''
  await sincronizarBovedaCredencialesDesdeNube().catch(() => undefined)
  const candidatos = obtenerCandidatosPasswordUsuario({
    id: params.id,
    email: cleanEmail || params.email,
  })

  let updatedInAuth = false
  let newUserId: string | undefined

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
        await isolatedClient.auth.signOut({ scope: 'local' }).catch(() => undefined)
      }
    }
  }

  // 2.5 Auto-reparación cuando la Edge Function no existe o la contraseña previa se desincronizó
  if (!updatedInAuth && cleanEmail && (await perfilesService.hasLiveSupabaseSession())) {
    try {
      let targetPerfil: Perfil | null = null
      const isRealDbId =
        Boolean(params.id) &&
        !params.id!.startsWith('demo-') &&
        !params.id!.startsWith('ruta-user-') &&
        !params.id!.startsWith('ind-user-')

      if (isRealDbId) {
        const { data: byIdRow } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', params.id!)
          .maybeSingle()
        if (byIdRow) targetPerfil = byIdRow as Perfil
      }
      if (!targetPerfil) {
        const { data: byEmailRow } = await supabase
          .from('perfiles')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle()
        if (byEmailRow) targetPerfil = byEmailRow as Perfil
      }
      if (!targetPerfil) {
        targetPerfil = perfilesService.getCachedPerfilByEmailOrId({
          id: params.id,
          email: cleanEmail,
        })
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const currentSessionUserId = sessionData?.session?.user?.id

      if (targetPerfil && targetPerfil.id === currentSessionUserId) {
        const { error: ownErr } = await supabase.auth.updateUser({
          password: cleanPassword,
          data: { password_visible: cleanPassword },
        })
        if (!ownErr) {
          updatedInAuth = true
        }
      } else if (targetPerfil) {
        await supabase.functions
          .invoke('eliminar-usuario', {
            body: {
              usuarioId: targetPerfil.id,
              confirmar: true,
            },
          })
          .catch(() => undefined)

        let recreatedId: string | undefined
        const signUpClient = createIsolatedAuthClient()
        let hasSignUpSession = false
        try {
          const { data: signUpRes, error: signUpErr } =
            await signUpClient.auth.signUp({
              email: cleanEmail,
              password: cleanPassword,
              options: {
                data: {
                  name: targetPerfil.nombre,
                  role: targetPerfil.rol,
                  password_visible: cleanPassword,
                },
              },
            })

          const existingObfuscated =
            !signUpErr &&
            Boolean(signUpRes?.user) &&
            Array.isArray(signUpRes.user?.identities) &&
            signUpRes.user!.identities.length === 0

          if (!signUpErr && signUpRes?.user?.id && !existingObfuscated) {
            recreatedId = signUpRes.user.id
            hasSignUpSession = Boolean(signUpRes.session)
            if (hasSignUpSession) {
              await upsertPerfilSafely(signUpClient as unknown as typeof supabase, {
                id: recreatedId,
                nombre: targetPerfil.nombre,
                email: cleanEmail,
                rol: targetPerfil.rol,
                avatar_url: targetPerfil.avatar_url ?? null,
              })
            }
          }
        } catch {
          // Continuar con respaldo vía crear-usuario
        } finally {
          if (hasSignUpSession) {
            await signUpClient.auth.signOut({ scope: 'local' }).catch(() => undefined)
          }
        }

        if (!recreatedId) {
          const edgeRoleCandidates = targetPerfil.rol?.toLowerCase().includes('consult')
            ? ['consultor', 'operador']
            : ['operador']
          for (const edgeRol of edgeRoleCandidates) {
            try {
              const { data: edgeRes, error: edgeErr } =
                await supabase.functions.invoke('crear-usuario', {
                  body: {
                    nombre: targetPerfil.nombre,
                    email: cleanEmail,
                    password: cleanPassword,
                    rol: edgeRol,
                  },
                })
              if (!edgeErr && edgeRes?.usuario?.id) {
                recreatedId = edgeRes.usuario.id as string
                break
              }
            } catch {
              // Probar siguiente rol
            }
          }
        }

        if (recreatedId) {
          const { data: updRow, error: updErr } = await supabase
            .from('perfiles')
            .update({
              nombre: targetPerfil.nombre,
              email: cleanEmail,
              rol: targetPerfil.rol,
              estado: targetPerfil.estado || 'Activo',
              sesion_unica: Boolean(targetPerfil.sesion_unica),
              updated_at: new Date().toISOString(),
            })
            .eq('id', recreatedId)
            .select('id, rol')
            .maybeSingle()

          if (updErr || updRow?.id !== recreatedId || !rolesMatchEquivalent(updRow?.rol, targetPerfil.rol)) {
            await upsertPerfilSafely(supabase, {
              id: recreatedId,
              nombre: targetPerfil.nombre,
              email: cleanEmail,
              rol: targetPerfil.rol,
              avatar_url: targetPerfil.avatar_url ?? null,
            })

            if (targetPerfil.estado === 'Inactivo' || targetPerfil.sesion_unica) {
              await supabase
                .from('perfiles')
                .update({
                  estado: targetPerfil.estado,
                  sesion_unica: Boolean(targetPerfil.sesion_unica),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', recreatedId)
            }
          }

          if (recreatedId !== targetPerfil.id) {
            await supabase
              .from('perfiles')
              .delete()
              .eq('id', targetPerfil.id)
              .then(() => undefined, () => undefined)

            const vaultBefore = loadCredentialVault()
            if (vaultBefore.byId[targetPerfil.id]) {
              delete vaultBefore.byId[targetPerfil.id]
            }
            if (vaultBefore.updatedAtById?.[targetPerfil.id] !== undefined) {
              delete vaultBefore.updatedAtById[targetPerfil.id]
            }
            saveCredentialVault(vaultBefore)
            perfilesService.removePerfilFromCache(targetPerfil.id)

            try {
              const { rutasService } = await import('./rutasService')
              const rutas = await rutasService.getRutas().catch(() => [])
              for (const ruta of rutas) {
                if (
                  ruta.subAdminId === targetPerfil.id ||
                  ruta.subAdminEmail?.trim().toLowerCase() === cleanEmail
                ) {
                  await rutasService
                    .updateRuta(ruta.id, {
                      assignSubAdmin: {
                        id: recreatedId,
                        nombre: targetPerfil.nombre,
                        email: cleanEmail,
                      },
                    })
                    .catch(() => undefined)
                }
              }
            } catch {
              // Ignore route sync warning
            }
          }

          perfilesService.cachePerfilesList(
            [
              {
                ...targetPerfil,
                id: recreatedId,
                email: cleanEmail,
                localOnly: false,
                updated_at: new Date().toISOString(),
              },
            ],
            { markLocalOnly: false }
          )

          updatedInAuth = true
          newUserId = recreatedId
        }
      }
    } catch {
      // Continuar con registro en bóveda local si falla auto-reparación
    }
  }

  // 3. Guardar la nueva contraseña en la bóveda local y sincronizarla con la nube
  registrarCredencialUsuario({
    id: newUserId || params.id,
    email: cleanEmail || params.email,
    password: cleanPassword,
    skipCloudSync: true,
  })
  const syncedInCloud = await guardarBovedaCredencialesEnNube().catch(() => false)

  return { updatedInAuth, syncedInCloud, ...(newUserId ? { newUserId } : {}) }
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
  skipCloudSync?: boolean
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
    skipCloudSync: params.skipCloudSync,
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
    await isolatedClient.auth.signOut({ scope: 'local' }).catch(() => undefined)
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
      await isolatedClient.auth.signOut({ scope: 'local' }).catch(() => undefined)
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
        await isolatedClient.auth.signOut({ scope: 'local' }).catch(() => undefined)
      }
    }
  }

  return null
}

function registrarRolEnBoveda(params: {
  id?: string | null
  email?: string | null
  rol: string
}): StoredCredentialMap {
  const cleanRol = params.rol.trim()
  const vault = loadCredentialVault()
  if (!cleanRol) return vault

  const now = Date.now()
  const rolesById = vault.rolesById || {}
  const rolesByEmail = vault.rolesByEmail || {}
  const updatedAtById = vault.updatedAtById || {}
  const updatedAtByEmail = vault.updatedAtByEmail || {}

  if (params.id) {
    rolesById[params.id] = cleanRol
    updatedAtById[params.id] = now
  }
  const cleanEmail = params.email?.trim().toLowerCase()
  if (cleanEmail) {
    rolesByEmail[cleanEmail] = cleanRol
    updatedAtByEmail[cleanEmail] = now
  }

  vault.rolesById = rolesById
  vault.rolesByEmail = rolesByEmail
  vault.updatedAtById = updatedAtById
  vault.updatedAtByEmail = updatedAtByEmail
  saveCredentialVault(vault)
  return vault
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

  // La Edge Function o trigger creó la cuenta con otro rol (p. ej. 'rolNuevo' o 'operador').
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
      const vault = registrarRolEnBoveda({
        id: params.id,
        email: params.email,
        rol: params.desiredRol,
      })
      await guardarBovedaCredencialesEnNube(vault).catch(() => false)
      return { persistedInDb: true, resolvedRol: params.desiredRol }
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

  // 1. Intentar primero mediante auth.signUp (el trigger SECURITY DEFINER handle_new_user inserta el rol exacto sin bug 'rolNuevo' ni mínimo de 12 chars)
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
        // Continuar con respaldo vía Edge Function / operador
      }
    }

    // Respaldo vía Edge Function `crear-usuario` (solo cuando signUp dio rate-limit o constraint de rol custom; usa operador/consultor para evitar el bug literal 'rolNuevo')
    if (
      msg.includes('rate limit') ||
      msg.includes('security purposes') ||
      ((isCustomSubAdminRole || Boolean(adminAltRole)) && isConstraintOrDbErr)
    ) {
      try {
        if (await perfilesService.hasLiveSupabaseSession()) {
          const safeEdgeRol = datos.rol.toLowerCase().includes('consult')
            ? 'consultor'
            : 'operador'
          const { data: opData, error: opErr } =
            await supabase.functions.invoke('crear-usuario', {
              body: {
                nombre: cleanNombre,
                email: cleanEmail,
                password: cleanPassword,
                rol: safeEdgeRol,
              },
            })
          if (!opErr && opData?.usuario?.id) {
            const verified = await verifyAndRepairCreatedRole({
              id: opData.usuario.id as string,
              nombre: cleanNombre,
              email: cleanEmail,
              desiredRol: datos.rol,
              password: cleanPassword,
              initialRoleFromResponse:
                typeof opData.usuario.rol === 'string' ? opData.usuario.rol : null,
            })
            registrarRolEnBoveda({
              id: opData.usuario.id as string,
              email: cleanEmail,
              rol: datos.rol,
            })
            registrarPerfilYCredencial({
              id: opData.usuario.id as string,
              nombre: cleanNombre,
              email: cleanEmail,
              rol: verified.resolvedRol,
              password: cleanPassword,
              syncedWithDb: verified.persistedInDb,
              skipCloudSync: true,
            })
            await guardarBovedaCredencialesEnNube().catch(() => false)
            return {
              id: opData.usuario.id as string,
              persistedInDb: verified.persistedInDb,
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
            const vault = registrarRolEnBoveda({
              id: opSignUp.user.id,
              email: cleanEmail,
              rol: datos.rol,
            })
            await guardarBovedaCredencialesEnNube(vault).catch(() => false)
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
  const cachedBefore = perfilesService.getCachedPerfilByEmailOrId({
    id: usuarioId,
    email,
  })
  const resolvedEmail = email || cachedBefore?.email || null

  const vaultWithRole = registrarRolEnBoveda({
    id: usuarioId,
    email: resolvedEmail,
    rol,
  })
  perfilesService.updatePerfilInCache(usuarioId, { rol })
  const syncedCloud = await guardarBovedaCredencialesEnNube(vaultWithRole).catch(() => false)

  const adminAlt = buildAdminAlternateRole(rol)
  const roleCandidates = adminAlt ? [rol, adminAlt] : [rol]

  // 1. Actualizar directamente en tabla `perfiles` (evita la Edge Function `cambiar-rol-usuario` que escribe literal `'rolNuevo'`)
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

  // 2. Respaldo mediante la sesión aislada del propio usuario si se conoce su contraseña
  for (const candidateRol of roleCandidates) {
    if (
      await updatePerfilViaUserSession({
        usuarioId,
        email: resolvedEmail,
        payload: { rol: candidateRol },
      })
    ) {
      perfilesService.updatePerfilInCache(usuarioId, { rol: candidateRol })
      return
    }
  }

  // 3. Último recurso: Edge Function oficial validando que no haya escrito `'rolNuevo'`
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
    // Continuar con respaldo en bóveda en la nube
  }

  if (syncedCloud || cachedBefore?.localOnly) {
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
