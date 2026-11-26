import { supabase } from '@/services/supabase'

export interface OemColorPreset {
  id: string
  label: string
  bg: string
  border: string
  text: string
  swatch: string
}

export const OEM_COLOR_PRESETS: OemColorPreset[] = [
  { id: 'slate', label: 'Gris (Predeterminado)', bg: '#F1F5F9', border: '#CBD5E1', text: '#0F172A', swatch: '#64748B' },
  { id: 'blue', label: 'Azul Corporativo', bg: '#DBEAFE', border: '#93C5FD', text: '#1E3A8A', swatch: '#2563EB' },
  { id: 'cyan', label: 'Turquesa / Cyan', bg: '#CFFAFE', border: '#67E8F9', text: '#155E75', swatch: '#0891B2' },
  { id: 'emerald', label: 'Verde Esmeralda', bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', swatch: '#059669' },
  { id: 'amber', label: 'Ámbar / Amarillo', bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', swatch: '#D97706' },
  { id: 'orange', label: 'Naranja', bg: '#FFEDD5', border: '#FDBA74', text: '#9A3412', swatch: '#EA580C' },
  { id: 'rose', label: 'Rojo / Rosa', bg: '#FFE4E6', border: '#FDA4AF', text: '#9F1239', swatch: '#E11D48' },
  { id: 'indigo', label: 'Índigo', bg: '#E0E7FF', border: '#A5B4FC', text: '#3730A3', swatch: '#4F46E5' },
  { id: 'purple', label: 'Violeta', bg: '#F3E8FF', border: '#D8B4FE', text: '#6B21A8', swatch: '#9333EA' },
  { id: 'dark', label: 'Azul Marino', bg: '#0F2D59', border: '#1E3A8A', text: '#FFFFFF', swatch: '#0F2D59' },
]

const OEM_COLORS_CLOUD_ID = '__swgora_catalog_oem_colors_v1__'
const OEM_COLORS_STORAGE_KEY = 'swgora_catalog_oem_colors_v1'

const FAMILY_RESTRICTIONS_CLOUD_ID = '__swgora_user_family_restrictions_v1__'
const FAMILY_RESTRICTIONS_STORAGE_KEY = 'swgora_user_family_restrictions_v1'

const ADMIN_GRANTS_CLOUD_ID = '__swgora_admin_grants_v1__'
const ADMIN_GRANTS_STORAGE_KEY = 'swgora_admin_grants_v1'

const BRAND_SEARCH_CLOUD_ID = '__swgora_brand_search_stats_v1__'
const BRAND_SEARCH_STORAGE_KEY = 'swgora_brand_search_stats_v1'

const MOTOR_SEARCH_CLOUD_ID = '__swgora_motor_search_stats_v1__'
const MOTOR_SEARCH_STORAGE_KEY = 'swgora_motor_search_stats_v1'

export interface AdminRoleGrant {
  grantedById: string
  grantedByEmail: string
  grantedAt: string
}

export type AdminRoleGrantsMap = Record<string, AdminRoleGrant>
export type BrandSearchCountsMap = Record<string, number>
export type MotorSearchCountsMap = Record<string, number>

export type CatalogOemColorMap = Record<string, string>

export interface UserFamilyRestrictionEntry {
  restricted: boolean
  allowedFamilies: string[]
}

export type UserFamilyRestrictionsMap = Record<string, UserFamilyRestrictionEntry>

export function normalizeCatalogBrandKey(brand?: string | null): string {
  const clean = String(brand || '').trim().toUpperCase()
  return clean || 'OEM'
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHexColor(hex)) return null
  const clean = hex.trim().slice(1)
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

export function getOemBadgeInlineStyle(
  brand: string | null | undefined,
  colorsMap: CatalogOemColorMap
): Record<string, string> | undefined {
  const key = normalizeCatalogBrandKey(brand)
  const chosen = colorsMap[key]
  if (!chosen || chosen === 'slate') return undefined

  const preset = OEM_COLOR_PRESETS.find((p) => p.id === chosen)
  if (preset) {
    return {
      backgroundColor: preset.bg,
      borderColor: preset.border,
      color: preset.text,
    }
  }

  const rgb = hexToRgb(chosen)
  if (rgb) {
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
    return {
      backgroundColor: chosen,
      borderColor: chosen,
      color: luminance > 0.62 ? '#0F172A' : '#FFFFFF',
    }
  }

  return undefined
}

export function readLocalCatalogOemColors(): CatalogOemColorMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(OEM_COLORS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: CatalogOemColorMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) {
        out[normalizeCatalogBrandKey(k)] = v.trim()
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeLocalCatalogOemColors(map: CatalogOemColorMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(OEM_COLORS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota errors
  }
}

export async function fetchCatalogOemColors(): Promise<CatalogOemColorMap> {
  const local = readLocalCatalogOemColors()
  try {
    const { data, error } = await supabase
      .from('taller')
      .select('eslogan')
      .eq('id', OEM_COLORS_CLOUD_ID)
      .maybeSingle()

    if (error || !data?.eslogan) return local
    const parsed = JSON.parse(String(data.eslogan))
    if (!parsed || typeof parsed !== 'object') return local
    const out: CatalogOemColorMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) {
        out[normalizeCatalogBrandKey(k)] = v.trim()
      }
    }
    writeLocalCatalogOemColors(out)
    return out
  } catch {
    return local
  }
}

export async function saveCatalogOemColors(map: CatalogOemColorMap): Promise<CatalogOemColorMap> {
  const clean: CatalogOemColorMap = {}
  for (const [k, v] of Object.entries(map)) {
    const trimmed = String(v || '').trim()
    if (trimmed && trimmed !== 'slate') {
      clean[normalizeCatalogBrandKey(k)] = trimmed
    }
  }
  writeLocalCatalogOemColors(clean)
  try {
    await supabase
      .from('taller')
      .upsert(
        {
          id: OEM_COLORS_CLOUD_ID,
          nombre: 'Configuración Colores OEM',
          direccion: '',
          celular1: '',
          celular2: '',
          eslogan: JSON.stringify(clean),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  } catch (err) {
    console.warn('[CatalogPreferences] Error guardando colores OEM en Supabase:', err)
  }
  return clean
}

function sanitizeRestrictionsMap(raw: unknown): UserFamilyRestrictionsMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: UserFamilyRestrictionsMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = String(key || '').trim().toLowerCase()
    if (!cleanKey || !value || typeof value !== 'object') continue
    const rec = value as { restricted?: unknown; allowedFamilies?: unknown }
    const allowed = Array.isArray(rec.allowedFamilies)
      ? Array.from(
          new Set(
            rec.allowedFamilies
              .map((f) => String(f || '').trim().toLowerCase())
              .filter(Boolean)
          )
        )
      : []
    out[cleanKey] = {
      restricted: Boolean(rec.restricted),
      allowedFamilies: allowed,
    }
  }
  return out
}

export function readLocalUserFamilyRestrictions(): UserFamilyRestrictionsMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(FAMILY_RESTRICTIONS_STORAGE_KEY)
    if (!raw) return {}
    return sanitizeRestrictionsMap(JSON.parse(raw))
  } catch {
    return {}
  }
}

function writeLocalUserFamilyRestrictions(map: UserFamilyRestrictionsMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FAMILY_RESTRICTIONS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota errors
  }
}

export async function fetchUserFamilyRestrictions(): Promise<UserFamilyRestrictionsMap> {
  const local = readLocalUserFamilyRestrictions()
  try {
    const { data, error } = await supabase
      .from('taller')
      .select('eslogan')
      .eq('id', FAMILY_RESTRICTIONS_CLOUD_ID)
      .maybeSingle()

    if (error || !data?.eslogan) return local
    const clean = sanitizeRestrictionsMap(JSON.parse(String(data.eslogan)))
    writeLocalUserFamilyRestrictions(clean)
    return clean
  } catch {
    return local
  }
}

export async function saveUserFamilyRestriction(params: {
  userId?: string | null
  email?: string | null
  restricted: boolean
  allowedFamilies: string[]
}): Promise<UserFamilyRestrictionsMap> {
  const current = await fetchUserFamilyRestrictions()
  const next: UserFamilyRestrictionsMap = { ...current }
  const cleanAllowed = Array.from(
    new Set(
      (params.allowedFamilies || [])
        .map((f) => String(f || '').trim().toLowerCase())
        .filter(Boolean)
    )
  )

  const keys = [
    params.userId ? `id:${String(params.userId).trim().toLowerCase()}` : '',
    params.email ? `email:${String(params.email).trim().toLowerCase()}` : '',
  ].filter(Boolean)

  for (const key of keys) {
    if (!params.restricted) {
      delete next[key]
    } else {
      next[key] = {
        restricted: true,
        allowedFamilies: cleanAllowed,
      }
    }
  }

  writeLocalUserFamilyRestrictions(next)
  try {
    await supabase
      .from('taller')
      .upsert(
        {
          id: FAMILY_RESTRICTIONS_CLOUD_ID,
          nombre: 'Restricciones de Familias por Usuario',
          direccion: '',
          celular1: '',
          celular2: '',
          eslogan: JSON.stringify(next),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  } catch (err) {
    console.warn('[CatalogPreferences] Error guardando restricciones de familias en Supabase:', err)
  }
  return next
}

export function resolveUserFamilyRestriction(
  map: UserFamilyRestrictionsMap,
  user: { id?: string | null; email?: string | null } | null | undefined
): UserFamilyRestrictionEntry | null {
  if (!user) return null
  const idKey = user.id ? `id:${String(user.id).trim().toLowerCase()}` : ''
  const emailKey = user.email ? `email:${String(user.email).trim().toLowerCase()}` : ''
  if (idKey && map[idKey]?.restricted) return map[idKey]
  if (emailKey && map[emailKey]?.restricted) return map[emailKey]
  return null
}

// =============================================================================
// REGISTRO DE QUIÉN OTORGÓ EL RANGO DE ADMINISTRADOR
// =============================================================================

function sanitizeAdminGrantsMap(raw: unknown): AdminRoleGrantsMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: AdminRoleGrantsMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = String(k || '').trim().toLowerCase()
    if (!cleanKey || !v || typeof v !== 'object') continue
    const rec = v as { grantedById?: unknown; grantedByEmail?: unknown; grantedAt?: unknown }
    const grantedById = String(rec.grantedById || '').trim()
    const grantedByEmail = String(rec.grantedByEmail || '').trim().toLowerCase()
    if (!grantedById && !grantedByEmail) continue
    out[cleanKey] = {
      grantedById,
      grantedByEmail,
      grantedAt: String(rec.grantedAt || new Date().toISOString()),
    }
  }
  return out
}

export function readLocalAdminRoleGrants(): AdminRoleGrantsMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(ADMIN_GRANTS_STORAGE_KEY)
    if (!raw) return {}
    return sanitizeAdminGrantsMap(JSON.parse(raw))
  } catch {
    return {}
  }
}

function writeLocalAdminRoleGrants(map: AdminRoleGrantsMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(ADMIN_GRANTS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota errors
  }
}

export async function fetchAdminRoleGrants(): Promise<AdminRoleGrantsMap> {
  const local = readLocalAdminRoleGrants()
  try {
    const { data, error } = await supabase
      .from('taller')
      .select('eslogan')
      .eq('id', ADMIN_GRANTS_CLOUD_ID)
      .maybeSingle()

    if (error || !data?.eslogan) return local
    const remote = sanitizeAdminGrantsMap(JSON.parse(String(data.eslogan)))
    const merged: AdminRoleGrantsMap = { ...local, ...remote }
    writeLocalAdminRoleGrants(merged)
    return merged
  } catch {
    return local
  }
}

export async function recordAdminRoleGrant(params: {
  targetUserId?: string | null
  targetEmail?: string | null
  grantedById?: string | null
  grantedByEmail?: string | null
}): Promise<AdminRoleGrantsMap> {
  const current = await fetchAdminRoleGrants()
  const next: AdminRoleGrantsMap = { ...current }
  const entry: AdminRoleGrant = {
    grantedById: String(params.grantedById || '').trim(),
    grantedByEmail: String(params.grantedByEmail || '').trim().toLowerCase(),
    grantedAt: new Date().toISOString(),
  }
  if (params.targetUserId) {
    next[`id:${String(params.targetUserId).trim().toLowerCase()}`] = entry
  }
  if (params.targetEmail) {
    next[`email:${String(params.targetEmail).trim().toLowerCase()}`] = entry
  }
  writeLocalAdminRoleGrants(next)
  try {
    await supabase
      .from('taller')
      .upsert(
        {
          id: ADMIN_GRANTS_CLOUD_ID,
          nombre: 'Registro de Otorgamiento de Rango Admin',
          direccion: '',
          celular1: '',
          celular2: '',
          eslogan: JSON.stringify(next),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  } catch (err) {
    console.warn('[CatalogPreferences] Error guardando registro de rango admin:', err)
  }
  return next
}

export function canAdminRevokeTargetAdmin(
  grantsMap: AdminRoleGrantsMap,
  target: { id?: string | null; email?: string | null },
  actor: { id?: string | null; email?: string | null } | null | undefined
): boolean {
  if (!actor) return false
  const idKey = target.id ? `id:${String(target.id).trim().toLowerCase()}` : ''
  const emailKey = target.email ? `email:${String(target.email).trim().toLowerCase()}` : ''
  const grant = (idKey && grantsMap[idKey]) || (emailKey && grantsMap[emailKey]) || null
  if (!grant) return false
  const actorId = String(actor.id || '').trim()
  const actorEmail = String(actor.email || '').trim().toLowerCase()
  return Boolean(
    (grant.grantedById && actorId && grant.grantedById === actorId) ||
    (grant.grantedByEmail && actorEmail && grant.grantedByEmail === actorEmail)
  )
}

// =============================================================================
// POPULARIDAD DE BÚSQUEDA DE FABRICANTES (MÁS BUSCADOS PRIMERO)
// =============================================================================

function sanitizeBrandCounts(raw: unknown): BrandSearchCountsMap {
  if (!raw || typeof raw !== 'object') return {}
  const out: BrandSearchCountsMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k || '').trim().toLowerCase()
    const num = Number(v)
    if (key && Number.isFinite(num) && num > 0) {
      out[key] = Math.floor(num)
    }
  }
  return out
}

export function readLocalBrandSearchCounts(): BrandSearchCountsMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(BRAND_SEARCH_STORAGE_KEY)
    if (!raw) return {}
    return sanitizeBrandCounts(JSON.parse(raw))
  } catch {
    return {}
  }
}

function writeLocalBrandSearchCounts(map: BrandSearchCountsMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(BRAND_SEARCH_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota errors
  }
}

export async function fetchBrandSearchCounts(): Promise<BrandSearchCountsMap> {
  const local = readLocalBrandSearchCounts()
  try {
    const { data, error } = await supabase
      .from('taller')
      .select('eslogan')
      .eq('id', BRAND_SEARCH_CLOUD_ID)
      .maybeSingle()

    if (error || !data?.eslogan) return local
    const remote = sanitizeBrandCounts(JSON.parse(String(data.eslogan)))
    const merged: BrandSearchCountsMap = { ...local }
    for (const [k, v] of Object.entries(remote)) {
      merged[k] = Math.max(merged[k] || 0, v)
    }
    writeLocalBrandSearchCounts(merged)
    return merged
  } catch {
    return local
  }
}

export async function incrementBrandSearchCount(
  currentMap: BrandSearchCountsMap,
  brandName: string
): Promise<BrandSearchCountsMap> {
  const key = String(brandName || '').trim().toLowerCase()
  if (!key) return currentMap
  const next: BrandSearchCountsMap = {
    ...currentMap,
    [key]: (currentMap[key] || 0) + 1,
  }
  writeLocalBrandSearchCounts(next)
  try {
    await supabase
      .from('taller')
      .upsert(
        {
          id: BRAND_SEARCH_CLOUD_ID,
          nombre: 'Estadísticas de Búsqueda de Fabricantes',
          direccion: '',
          celular1: '',
          celular2: '',
          eslogan: JSON.stringify(next),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  } catch {
    // Keep local count silently
  }
  return next
}

// =============================================================================
// POPULARIDAD DE BÚSQUEDA DE MOTORES POR FABRICANTE (MÁS BUSCADOS PRIMERO)
// =============================================================================

export function buildMotorSearchKey(brandKey?: string | null, motorCode?: string | null): string {
  const b = String(brandKey || 'global').trim().toLowerCase() || 'global'
  const m = String(motorCode || '').trim().toLowerCase()
  return m ? `${b}::${m}` : ''
}

export function readLocalMotorSearchCounts(): MotorSearchCountsMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(MOTOR_SEARCH_STORAGE_KEY)
    if (!raw) return {}
    return sanitizeBrandCounts(JSON.parse(raw))
  } catch {
    return {}
  }
}

function writeLocalMotorSearchCounts(map: MotorSearchCountsMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(MOTOR_SEARCH_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore quota errors
  }
}

export async function fetchMotorSearchCounts(): Promise<MotorSearchCountsMap> {
  const local = readLocalMotorSearchCounts()
  try {
    const { data, error } = await supabase
      .from('taller')
      .select('eslogan')
      .eq('id', MOTOR_SEARCH_CLOUD_ID)
      .maybeSingle()

    if (error || !data?.eslogan) return local
    const remote = sanitizeBrandCounts(JSON.parse(String(data.eslogan)))
    const merged: MotorSearchCountsMap = { ...local }
    for (const [k, v] of Object.entries(remote)) {
      merged[k] = Math.max(merged[k] || 0, v)
    }
    writeLocalMotorSearchCounts(merged)
    return merged
  } catch {
    return local
  }
}

export async function incrementMotorSearchCount(
  currentMap: MotorSearchCountsMap,
  brandKey: string,
  motorCode: string
): Promise<MotorSearchCountsMap> {
  const key = buildMotorSearchKey(brandKey, motorCode)
  if (!key) return currentMap
  const next: MotorSearchCountsMap = {
    ...currentMap,
    [key]: (currentMap[key] || 0) + 1,
  }
  writeLocalMotorSearchCounts(next)
  try {
    await supabase
      .from('taller')
      .upsert(
        {
          id: MOTOR_SEARCH_CLOUD_ID,
          nombre: 'Estadísticas de Búsqueda de Motores por Fabricante',
          direccion: '',
          celular1: '',
          celular2: '',
          eslogan: JSON.stringify(next),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  } catch {
    // Keep local count silently
  }
  return next
}
