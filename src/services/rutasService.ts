import { supabase } from './supabase'
import {
  crearUsuario,
  cambiarRolUsuario,
  registrarCredencialUsuario,
} from './usuariosService'
import { perfilesService, type Perfil } from './perfilesService'

export interface RutaSucursal {
  id: string
  codigo: string
  nombre: string
  zona: string
  descripcion?: string
  estado: 'Activa' | 'Inactiva'
  tenantId?: string
  subAdminId?: string
  subAdminNombre?: string
  subAdminEmail?: string
  createdAt: string
}

export interface OrderRouteMetadata {
  rutaId: string
  rutaCodigo?: string
  rutaNombre: string
}

export interface IndependentTenantInfo {
  isIndependent: boolean
  tenantId?: string
  tallerNombre?: string
}

export interface TenantMembershipInfo extends IndependentTenantInfo {
  isTenantOwner: boolean
  baseRole?: string
}

export interface ActiveTenantContext {
  isIndependent: boolean
  tenantId: string | null
  tallerNombre?: string
  userId?: string
  userName?: string
}

const RUTAS_STORAGE_KEY = 'swgora_rutas_sucursales_v1'
const ORDER_ROUTES_MAP_KEY = 'swgora_order_routes_map_v1'
const ORDER_TENANTS_MAP_KEY = 'swgora_order_tenants_map_v1'
const INDEPENDENT_TENANTS_STORAGE_KEY = 'swgora_independent_tenants_v1'
const ROLE_SUBADMIN_PREFIX = 'subadmin|'
const ROLE_INDEPENDENT_PREFIX = 'independiente|'
const ROLE_TENANT_MEMBER_SEPARATOR = '||tenant|'
const TALLER_CODIGO_ROUTE_SEPARATOR = '__RUTA__'
const TALLER_CODIGO_TENANT_SEPARATOR = '__TENANT__'

let currentTenantContext: ActiveTenantContext | null = null

export function setActiveTenantContext(ctx: ActiveTenantContext | null): void {
  currentTenantContext = ctx ? { ...ctx } : null
}

export function getActiveTenantContext(): ActiveTenantContext {
  if (currentTenantContext) {
    return currentTenantContext
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('swgora_active_user')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.isIndependent && parsed?.tenantId) {
          return {
            isIndependent: true,
            tenantId: String(parsed.tenantId),
            tallerNombre: parsed.tenantWorkshopName || undefined,
            userId: parsed.id || undefined,
            userName: parsed.name || undefined,
          }
        }
        if (parsed?.id) {
          return {
            isIndependent: false,
            tenantId: null,
            userId: parsed.id,
            userName: parsed.name,
          }
        }
      }
    } catch {
      // Ignorar errores de parsing
    }
  }
  return { isIndependent: false, tenantId: null }
}

/**
 * Codifica el rol de un usuario interno perteneciente a un Taller Independiente
 * preservando su rol operativo real (`operador`, `consultor`, `admin`, `subadmin|...`)
 * más el identificador del tenant aislado.
 * Formato: <baseRole>||tenant|<tenantId>|<tallerNombre>
 */
export function encodeTenantMemberRole(
  baseRole: string,
  tenantId: string,
  tallerNombre?: string
): string {
  const extracted = extractTenantFromRole(baseRole)
  const cleanBase = extracted.baseRole?.trim() || 'operador'
  const cleanTenant = tenantId.replace(/\|/g, '-').trim()
  if (!cleanTenant) return cleanBase
  const cleanTaller = (tallerNombre || extracted.tallerNombre || '')
    .replace(/\|/g, ' ')
    .trim()
  return `${cleanBase}${ROLE_TENANT_MEMBER_SEPARATOR}${cleanTenant}|${cleanTaller}`
}

/**
 * Extrae información de pertenencia a tenant independiente (dueño o miembro interno)
 * desde el string `rol`.
 */
export function extractTenantFromRole(
  rawRole?: string | null
): TenantMembershipInfo {
  if (!rawRole) {
    return { isIndependent: false, isTenantOwner: false }
  }
  const trimmed = rawRole.trim()
  const lower = trimmed.toLowerCase()

  if (
    lower.startsWith(ROLE_INDEPENDENT_PREFIX) ||
    lower === 'independiente' ||
    lower === 'taller independiente' ||
    lower.includes('taller independiente')
  ) {
    const parsed = parseIndependentRole(trimmed)
    return {
      isIndependent: true,
      isTenantOwner: true,
      tenantId: parsed.tenantId,
      tallerNombre: parsed.tallerNombre,
      baseRole: trimmed,
    }
  }

  const sepIdx = lower.indexOf(ROLE_TENANT_MEMBER_SEPARATOR)
  if (sepIdx !== -1) {
    const baseRole = trimmed.slice(0, sepIdx).trim() || 'operador'
    const rest = trimmed.slice(sepIdx + ROLE_TENANT_MEMBER_SEPARATOR.length)
    const parts = rest.split('|')
    const tenantId = parts[0]?.trim() || undefined
    const tallerNombre = parts[1]?.trim() || undefined
    return {
      isIndependent: !!tenantId,
      isTenantOwner: false,
      tenantId,
      tallerNombre,
      baseRole,
    }
  }

  return {
    isIndependent: false,
    isTenantOwner: false,
    baseRole: trimmed,
  }
}

/**
 * Codifica el rol de un Sub-Administrador incluyendo los metadatos de su ruta
 * para que viaje de forma nativa en `public.perfiles.rol` en Supabase.
 * Formato: subadmin|<rutaId>|<rutaCodigo>|<rutaNombre>|<rutaZona>
 */
export function encodeSubAdminRole(ruta: {
  id: string
  codigo: string
  nombre: string
  zona?: string
}): string {
  const cleanId = (ruta.id || '').replace(/\|/g, '-')
  const cleanCode = (ruta.codigo || 'RUT-01').replace(/\|/g, '-')
  const cleanName = (ruta.nombre || 'Ruta').replace(/\|/g, ' ')
  const cleanZona = (ruta.zona || '').replace(/\|/g, ' ')
  return `${ROLE_SUBADMIN_PREFIX}${cleanId}|${cleanCode}|${cleanName}|${cleanZona}`
}

/**
 * Extrae la información de la ruta desde el string de rol si es un Sub-Administrador
 */
export function parseSubAdminRole(rawRole?: string | null): {
  isSubAdmin: boolean
  rutaId?: string
  rutaCodigo?: string
  rutaNombre?: string
  rutaZona?: string
} {
  if (!rawRole) return { isSubAdmin: false }
  const extracted = extractTenantFromRole(rawRole)
  if (extracted.isTenantOwner) return { isSubAdmin: false }
  const trimmed = (extracted.baseRole || rawRole).trim()
  if (trimmed.toLowerCase().startsWith(ROLE_SUBADMIN_PREFIX)) {
    const parts = trimmed.split('|')
    return {
      isSubAdmin: true,
      rutaId: parts[1] || undefined,
      rutaCodigo: parts[2] || undefined,
      rutaNombre: parts[3] || undefined,
      rutaZona: parts[4] || undefined,
    }
  }
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('subadmin') ||
    lower.includes('sub-admin') ||
    lower.includes('sub_admin') ||
    lower.includes('admin_ruta') ||
    lower.includes('admin de ruta')
  ) {
    return {
      isSubAdmin: true,
    }
  }
  return { isSubAdmin: false }
}

/**
 * Codifica el rol de un Taller Independiente incluyendo su tenantId
 * y nombre de taller para que viaje en `public.perfiles.rol`.
 * Formato: independiente|<tenantId>|<tallerNombre>
 */
export function encodeIndependentRole(params: {
  tenantId: string
  tallerNombre?: string
}): string {
  const cleanTenantId = (params.tenantId || '').replace(/\|/g, '-').trim()
  const cleanTaller = (params.tallerNombre || '').replace(/\|/g, ' ').trim()
  return `${ROLE_INDEPENDENT_PREFIX}${cleanTenantId}|${cleanTaller}`
}

/**
 * Extrae información de tenant independiente desde `rol`.
 */
export function parseIndependentRole(rawRole?: string | null): IndependentTenantInfo {
  if (!rawRole) return { isIndependent: false }
  const trimmed = rawRole.trim()
  if (trimmed.toLowerCase().startsWith(ROLE_INDEPENDENT_PREFIX)) {
    const parts = trimmed.split('|')
    return {
      isIndependent: true,
      tenantId: parts[1]?.trim() || undefined,
      tallerNombre: parts[2]?.trim() || undefined,
    }
  }
  if (
    trimmed.toLowerCase() === 'independiente' ||
    trimmed.toLowerCase() === 'taller independiente' ||
    trimmed.toLowerCase().includes('taller independiente')
  ) {
    return { isIndependent: true }
  }
  return { isIndependent: false }
}

interface StoredIndependentTenantEntry {
  tenantId: string
  tallerNombre?: string
  isMember?: boolean
  baseRole?: string
}

interface StoredIndependentTenantMap {
  byId: Record<string, StoredIndependentTenantEntry>
  byEmail: Record<string, StoredIndependentTenantEntry>
}

function loadIndependentTenantMap(): StoredIndependentTenantMap {
  try {
    const raw = localStorage.getItem(INDEPENDENT_TENANTS_STORAGE_KEY)
    if (!raw) return { byId: {}, byEmail: {} }
    const parsed = JSON.parse(raw)
    return {
      byId: parsed?.byId && typeof parsed.byId === 'object' ? parsed.byId : {},
      byEmail:
        parsed?.byEmail && typeof parsed.byEmail === 'object'
          ? parsed.byEmail
          : {},
    }
  } catch {
    return { byId: {}, byEmail: {} }
  }
}

export function registerIndependentTenantUser(params: {
  userId?: string
  email?: string
  tenantId: string
  tallerNombre?: string
  isMember?: boolean
  baseRole?: string
}): void {
  if (!params.tenantId) return
  try {
    const map = loadIndependentTenantMap()
    const entry: StoredIndependentTenantEntry = {
      tenantId: params.tenantId.trim(),
      tallerNombre: params.tallerNombre?.trim() || undefined,
      ...(params.isMember !== undefined ? { isMember: params.isMember } : {}),
      ...(params.baseRole !== undefined ? { baseRole: params.baseRole } : {}),
    }
    if (params.userId) {
      map.byId[params.userId] = entry
    }
    if (params.email) {
      map.byEmail[params.email.trim().toLowerCase()] = entry
    }
    localStorage.setItem(INDEPENDENT_TENANTS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors
  }
}

export function getUserTenantMembership(user: {
  id?: string | null
  email?: string | null
  rawRole?: string | null
}): TenantMembershipInfo {
  const extracted = extractTenantFromRole(user.rawRole)
  if (extracted.isIndependent && extracted.tenantId) {
    return extracted
  }

  const map = loadIndependentTenantMap()
  const entry =
    (user.id && map.byId[user.id]) ||
    (user.email && map.byEmail[user.email.trim().toLowerCase()]) ||
    undefined

  if (entry) {
    const hasSpecificExtracted =
      !!extracted.baseRole &&
      extracted.baseRole.toLowerCase() !== 'operador' &&
      extracted.baseRole.toLowerCase() !== 'consultor'
    return {
      isIndependent: true,
      isTenantOwner: entry.isMember ? false : true,
      tenantId: entry.tenantId,
      tallerNombre: entry.tallerNombre || extracted.tallerNombre,
      baseRole:
        (hasSpecificExtracted ? extracted.baseRole : entry.baseRole) ||
        extracted.baseRole,
    }
  }

  if (extracted.isIndependent) {
    const seed = (user.id || user.email || 'user')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 10)
      .toLowerCase()
    return {
      isIndependent: true,
      isTenantOwner: extracted.isTenantOwner,
      tenantId: `ind-${seed}`,
      tallerNombre: extracted.tallerNombre,
      baseRole: extracted.baseRole,
    }
  }

  return extracted
}

export function getIndependentTenantForUser(user: {
  id?: string | null
  email?: string | null
  rawRole?: string | null
}): IndependentTenantInfo {
  const membership = getUserTenantMembership(user)
  if (!membership.isIndependent) {
    return { isIndependent: false }
  }
  return {
    isIndependent: true,
    tenantId: membership.tenantId,
    tallerNombre: membership.tallerNombre,
  }
}

/**
 * Codifica `taller_codigo` para almacenar el código del cliente/taller,
 * la ruta asignada y/o el tenant independiente en `public.ordenes_trabajo`
 * sin requerir columnas adicionales ni romper esquemas existentes.
 */
export function encodeTallerCodigoWithRoute(
  baseCode?: string | null,
  route?: OrderRouteMetadata | null,
  tenantId?: string | null
): string | null {
  const withoutTenant = (baseCode || '').split(TALLER_CODIGO_TENANT_SEPARATOR)[0] || ''
  const cleanBase = withoutTenant.split(TALLER_CODIGO_ROUTE_SEPARATOR)[0]?.trim() || ''

  let encoded = cleanBase
  if (route && route.rutaId && route.rutaNombre) {
    const payload = `${route.rutaId}::${route.rutaCodigo || ''}::${route.rutaNombre}`
    encoded = `${encoded}${TALLER_CODIGO_ROUTE_SEPARATOR}${payload}`
  }

  const cleanTenant = tenantId?.trim()
  if (cleanTenant) {
    encoded = `${encoded}${TALLER_CODIGO_TENANT_SEPARATOR}${cleanTenant}`
  }

  return encoded || null
}

/**
 * Decodifica `taller_codigo` proveniente de `public.ordenes_trabajo`
 * separando el código original del cliente/taller, la ruta y el tenant independiente.
 */
export function decodeTallerCodigoWithRoute(rawTallerCodigo?: string | null): {
  cleanCode?: string
  route?: OrderRouteMetadata
  tenantId?: string
} {
  if (!rawTallerCodigo) return {}

  let withoutTenant = rawTallerCodigo
  let tenantId: string | undefined
  if (rawTallerCodigo.includes(TALLER_CODIGO_TENANT_SEPARATOR)) {
    const tenantParts = rawTallerCodigo.split(TALLER_CODIGO_TENANT_SEPARATOR)
    withoutTenant = tenantParts[0] || ''
    tenantId = tenantParts[1]?.trim() || undefined
  }

  if (!withoutTenant.includes(TALLER_CODIGO_ROUTE_SEPARATOR)) {
    return {
      cleanCode: withoutTenant.trim() || undefined,
      tenantId,
    }
  }

  const [basePart, routePart] = withoutTenant.split(TALLER_CODIGO_ROUTE_SEPARATOR)
  const cleanCode = basePart?.trim() || undefined
  if (!routePart) {
    return { cleanCode, tenantId }
  }
  const [rutaId, rutaCodigo, rutaNombre] = routePart.split('::')
  if (rutaId && rutaNombre) {
    return {
      cleanCode,
      route: {
        rutaId: rutaId.trim(),
        rutaCodigo: rutaCodigo?.trim() || undefined,
        rutaNombre: rutaNombre.trim(),
      },
      tenantId,
    }
  }
  return { cleanCode, tenantId }
}

function loadStoredRutas(): RutaSucursal[] {
  try {
    const raw = localStorage.getItem(RUTAS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveStoredRutas(rutas: RutaSucursal[]): void {
  try {
    localStorage.setItem(RUTAS_STORAGE_KEY, JSON.stringify(rutas))
  } catch (e) {
    console.warn('[RutasService] No se pudo guardar en localStorage:', e)
  }
}

function loadOrderRoutesMap(): Record<string, OrderRouteMetadata> {
  try {
    const raw = localStorage.getItem(ORDER_ROUTES_MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveOrderRoutesMap(map: Record<string, OrderRouteMetadata>): void {
  try {
    localStorage.setItem(ORDER_ROUTES_MAP_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors
  }
}

function loadOrderTenantsMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ORDER_TENANTS_MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveOrderTenantsMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(ORDER_TENANTS_MAP_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Normaliza un nombre de ruta para comparaciones sin distinción de mayúsculas, acentos ni espacios múltiples
 */
export function normalizarNombreRuta(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function validarDuplicadoRuta(
  rutas: RutaSucursal[],
  params: { nombre: string; codigo: string; excludeId?: string }
): void {
  const nombreKey = normalizarNombreRuta(params.nombre)
  const codigoKey = params.codigo.trim().toUpperCase()

  if (!nombreKey) {
    throw new Error('El nombre de la ruta o sucursal es obligatorio.')
  }
  if (!codigoKey) {
    throw new Error('El código de la ruta es obligatorio.')
  }

  for (const r of rutas) {
    if (params.excludeId && r.id === params.excludeId) continue

    if (normalizarNombreRuta(r.nombre || '') === nombreKey) {
      throw new Error(
        `Ya existe una ruta registrada con el nombre "${r.nombre}" (${r.codigo}). Usa un nombre diferente.`
      )
    }

    if ((r.codigo || '').trim().toUpperCase() === codigoKey) {
      throw new Error(
        `Ya existe una ruta registrada con el código "${r.codigo}" (${r.nombre}). Usa un código diferente.`
      )
    }
  }
}

function getRutaTenantId(ruta: Pick<RutaSucursal, 'id' | 'tenantId'>): string | null {
  if (ruta.tenantId?.trim()) return ruta.tenantId.trim()
  if (ruta.id.startsWith('ruta-') && ruta.id.includes('__')) {
    const prefix = ruta.id.slice(5).split('__')[0]?.trim()
    if (prefix) return prefix
  }
  return null
}

function isRutaInActiveTenant(
  ruta: Pick<RutaSucursal, 'id' | 'tenantId'>,
  ctx = getActiveTenantContext()
): boolean {
  const rutaTenant = getRutaTenantId(ruta)
  if (ctx.isIndependent) {
    return !!ctx.tenantId && rutaTenant === ctx.tenantId
  }
  return !rutaTenant
}

function buildTenantScopedRole(
  baseRole: string,
  tenantId?: string | null,
  tallerNombre?: string
): string {
  const cleanTenant = tenantId?.trim()
  if (!cleanTenant) return baseRole
  return encodeTenantMemberRole(baseRole, cleanTenant, tallerNombre)
}

export const rutasService = {
  /**
   * Obtiene todas las rutas locales del taller activo de forma síncrona
   */
  getRutasSync(): RutaSucursal[] {
    return loadStoredRutas().filter((r) => isRutaInActiveTenant(r))
  },

  /**
   * Sincroniza las rutas con Supabase (`public.perfiles` y `public.rutas` si existe)
   * reconstruyendo automáticamente cualquier ruta creada desde otro dispositivo,
   * completamente aisladas por taller (principal vs taller independiente).
   */
  async getRutas(): Promise<RutaSucursal[]> {
    const ctx = getActiveTenantContext()
    const localRutas = loadStoredRutas()
    const byId = new Map<string, RutaSucursal>()

    for (const r of localRutas) {
      byId.set(r.id, {
        ...r,
        tenantId: getRutaTenantId(r) || undefined,
      })
    }

    // 1. Intentar leer tabla `rutas` de Supabase si existe
    try {
      const { data: dbRutas, error } = await supabase
        .from('rutas')
        .select('*')
        .order('created_at', { ascending: true })

      if (!error && Array.isArray(dbRutas)) {
        for (const row of dbRutas) {
          const rowTenant =
            (row as { tenant_id?: string | null }).tenant_id?.trim() ||
            getRutaTenantId({ id: row.id }) ||
            undefined
          byId.set(row.id, {
            id: row.id,
            codigo: row.codigo || 'RUT-01',
            nombre: row.nombre,
            zona: row.zona || '',
            descripcion: row.descripcion || '',
            estado: row.estado === 'Inactiva' ? 'Inactiva' : 'Activa',
            tenantId: rowTenant,
            subAdminId: row.sub_admin_id || undefined,
            subAdminNombre: row.sub_admin_nombre || undefined,
            subAdminEmail: row.sub_admin_email || undefined,
            createdAt: row.created_at || new Date().toISOString(),
          })
        }
      }
    } catch {
      // Tabla `rutas` opcional; continuamos con sincronización vía `perfiles`
    }

    // 2. Sincronizar desde `public.perfiles` para detectar Sub-Administradores y sus rutas
    try {
      const perfiles = await perfilesService.getPerfiles()
      for (const perfil of perfiles) {
        const parsed = parseSubAdminRole(perfil.rol)
        const membership = getUserTenantMembership({
          id: perfil.id,
          email: perfil.email,
          rawRole: perfil.rol,
        })
        const perfilTenant = membership.isIndependent
          ? membership.tenantId || null
          : null

        if (parsed.isSubAdmin && parsed.rutaId && parsed.rutaNombre) {
          const existing = byId.get(parsed.rutaId)
          if (existing) {
            existing.subAdminId = perfil.id
            existing.subAdminNombre = perfil.nombre
            existing.subAdminEmail = perfil.email
            if (!existing.tenantId && perfilTenant) {
              existing.tenantId = perfilTenant
            }
            if (!existing.zona && parsed.rutaZona) {
              existing.zona = parsed.rutaZona
            }
            if (!existing.codigo && parsed.rutaCodigo) {
              existing.codigo = parsed.rutaCodigo
            }
          } else {
            byId.set(parsed.rutaId, {
              id: parsed.rutaId,
              codigo: parsed.rutaCodigo || `RUT-0${byId.size + 1}`,
              nombre: parsed.rutaNombre,
              zona: parsed.rutaZona || 'Ruta Comercial',
              estado: perfil.estado === 'Inactivo' ? 'Inactiva' : 'Activa',
              tenantId: perfilTenant || getRutaTenantId({ id: parsed.rutaId }) || undefined,
              subAdminId: perfil.id,
              subAdminNombre: perfil.nombre,
              subAdminEmail: perfil.email,
              createdAt: perfil.created_at || new Date().toISOString(),
            })
          }
        } else if (perfil.email) {
          // Vincular UUID faltante si alguna ruta local coincide por correo y tenant
          const emailLower = perfil.email.trim().toLowerCase()
          for (const ruta of byId.values()) {
            const rutaTenant = getRutaTenantId(ruta)
            if (
              rutaTenant === perfilTenant &&
              ruta.subAdminEmail?.trim().toLowerCase() === emailLower &&
              !ruta.subAdminId
            ) {
              ruta.subAdminId = perfil.id
              ruta.subAdminNombre = perfil.nombre || ruta.subAdminNombre
            }
          }
        }
      }
    } catch {
      // Si el usuario actual no tiene permiso de listar todos los perfiles, usar caché local
    }

    const merged = Array.from(byId.values()).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, undefined, { numeric: true })
    )
    saveStoredRutas(merged)
    return merged.filter((r) => isRutaInActiveTenant(r, ctx))
  },

  /**
   * Genera el siguiente código correlativo de ruta del taller activo (ej. RUT-01, RUT-02)
   */
  getNextRutaCode(): string {
    const rutas = loadStoredRutas().filter((r) => isRutaInActiveTenant(r))
    const existentes = new Set(
      rutas.map((r) => (r.codigo || '').trim().toUpperCase()).filter(Boolean)
    )
    let nextNum = 1
    for (const r of rutas) {
      const match = (r.codigo || '').match(/(\d+)/)
      if (match && match[1]) {
        const num = parseInt(match[1], 10)
        if (!Number.isNaN(num) && num >= nextNum) {
          nextNum = num + 1
        }
      }
    }
    let candidate = `RUT-${String(nextNum).padStart(2, '0')}`
    while (existentes.has(candidate)) {
      nextNum += 1
      candidate = `RUT-${String(nextNum).padStart(2, '0')}`
    }
    return candidate
  },

  /**
   * Obtiene la ruta asignada a un usuario (respetando aislamiento por tenant)
   */
  getRutaForUser(user: {
    id?: string | null
    email?: string | null
    rawRole?: string | null
  }): RutaSucursal | null {
    const parsed = parseSubAdminRole(user.rawRole)
    const membership = getUserTenantMembership(user)
    const userTenant = membership.isIndependent
      ? membership.tenantId || null
      : null
    const rutas = loadStoredRutas().filter(
      (r) => getRutaTenantId(r) === userTenant
    )

    if (parsed.rutaId) {
      const foundById = rutas.find((r) => r.id === parsed.rutaId)
      if (foundById) return foundById
      if (parsed.rutaNombre) {
        return {
          id: parsed.rutaId,
          codigo: parsed.rutaCodigo || 'RUT-01',
          nombre: parsed.rutaNombre,
          zona: parsed.rutaZona || '',
          estado: 'Activa',
          tenantId: userTenant || undefined,
          subAdminId: user.id || undefined,
          subAdminEmail: user.email || undefined,
          createdAt: new Date().toISOString(),
        }
      }
    }

    if (user.id) {
      const bySubAdminId = rutas.find((r) => r.subAdminId === user.id)
      if (bySubAdminId) return bySubAdminId
    }

    if (user.email) {
      const lowerEmail = user.email.trim().toLowerCase()
      const byEmail = rutas.find(
        (r) => r.subAdminEmail?.trim().toLowerCase() === lowerEmail
      )
      if (byEmail) return byEmail
    }

    return null
  },

  /**
   * Crea una nueva Ruta / Sucursal y automáticamente crea o asigna la cuenta
   * de su Sub-Administrador en Supabase Auth + `public.perfiles` dentro del taller activo.
   */
  async createRutaWithSubAdmin(params: {
    codigo?: string
    nombre: string
    zona?: string
    descripcion?: string
    modoSubAdmin: 'nuevo' | 'existente' | 'sin_asignar'
    subAdminNombre?: string
    subAdminEmail?: string
    subAdminPassword?: string
    existingUserId?: string
  }): Promise<{
    ruta: RutaSucursal
    credenciales?: { nombre: string; email: string; password: string }
  }> {
    const ctx = getActiveTenantContext()
    const activeTenantId =
      ctx.isIndependent && ctx.tenantId ? ctx.tenantId.trim() : null
    const rutasTenant = await this.getRutas().catch(() =>
      loadStoredRutas().filter((r) => isRutaInActiveTenant(r, ctx))
    )
    const cleanNombre = params.nombre.trim().replace(/\s+/g, ' ')
    const cleanCodigo = (params.codigo?.trim() || this.getNextRutaCode()).toUpperCase()
    validarDuplicadoRuta(rutasTenant, {
      nombre: cleanNombre,
      codigo: cleanCodigo,
    })

    const cleanZona = (params.zona || '').trim()
    const tsSuffix = Date.now().toString(36)
    const rutaId = activeTenantId
      ? `ruta-${activeTenantId.replace(/__/g, '-')}__${tsSuffix}`
      : `ruta-${tsSuffix}`

    const nuevaRuta: RutaSucursal = {
      id: rutaId,
      codigo: cleanCodigo,
      nombre: cleanNombre,
      zona: cleanZona,
      descripcion: params.descripcion?.trim() || '',
      estado: 'Activa',
      ...(activeTenantId ? { tenantId: activeTenantId } : {}),
      createdAt: new Date().toISOString(),
    }

    const encodedSubBase = encodeSubAdminRole(nuevaRuta)
    const encodedRole = buildTenantScopedRole(
      encodedSubBase,
      activeTenantId,
      ctx.tallerNombre
    )
    let credencialesCreadas:
      | { nombre: string; email: string; password: string }
      | undefined

    if (params.modoSubAdmin === 'nuevo') {
      const adminNombre = (
        params.subAdminNombre || `Admin ${cleanNombre}`
      ).trim()
      const adminEmail = (params.subAdminEmail || '').trim().toLowerCase()
      const adminPassword = params.subAdminPassword || ''

      if (!adminEmail) {
        throw new Error(
          'Ingresa el correo electrónico para el Sub-Administrador de la ruta.'
        )
      }
      if (adminPassword.length < 8) {
        throw new Error(
          'La contraseña del Sub-Administrador debe tener al menos 8 caracteres.'
        )
      }

      // Crear el usuario en Supabase Auth + tabla perfiles con el rol de Sub-Admin de esta ruta
      const usuarioCreado = await crearUsuario({
        nombre: adminNombre,
        email: adminEmail,
        password: adminPassword,
        rol: encodedRole as any,
      })

      // Buscar el perfil recién creado para verificar o sincronizar rol
      let createdPerfil: Perfil | undefined
      try {
        const perfiles = await perfilesService.getPerfiles()
        createdPerfil = perfiles.find(
          (p) =>
            p.id === usuarioCreado.id ||
            p.email?.trim().toLowerCase() === adminEmail
        )
        if (createdPerfil && createdPerfil.rol !== encodedRole) {
          await cambiarRolUsuario(
            createdPerfil.id,
            encodedRole as any,
            adminEmail
          )
        }
      } catch (syncErr) {
        console.warn('[RutasService] Aviso al sincronizar perfil de ruta:', syncErr)
      }

      const resolvedUserId = createdPerfil?.id || usuarioCreado.id
      nuevaRuta.subAdminId = resolvedUserId
      nuevaRuta.subAdminNombre = adminNombre
      nuevaRuta.subAdminEmail = adminEmail

      if (activeTenantId) {
        registerIndependentTenantUser({
          userId: resolvedUserId,
          email: adminEmail,
          tenantId: activeTenantId,
          tallerNombre: ctx.tallerNombre,
          isMember: true,
          baseRole: encodedSubBase,
        })
      }

      registrarCredencialUsuario({
        id: resolvedUserId,
        email: adminEmail,
        password: adminPassword,
      })

      credencialesCreadas = {
        nombre: adminNombre,
        email: adminEmail,
        password: adminPassword,
      }
    } else if (params.modoSubAdmin === 'existente' && params.existingUserId) {
      const perfiles = await perfilesService.getPerfiles()
      const targetPerfil = perfiles.find((p) => p.id === params.existingUserId)
      if (!targetPerfil) {
        throw new Error('No se encontró el usuario seleccionado.')
      }

      try {
        await cambiarRolUsuario(
          targetPerfil.id,
          encodedRole as any,
          targetPerfil.email
        )
      } catch (err) {
        console.warn('[RutasService] No se pudo actualizar rol en perfiles:', err)
      }
      nuevaRuta.subAdminId = targetPerfil.id
      nuevaRuta.subAdminNombre = targetPerfil.nombre
      nuevaRuta.subAdminEmail = targetPerfil.email

      if (activeTenantId) {
        registerIndependentTenantUser({
          userId: targetPerfil.id,
          email: targetPerfil.email,
          tenantId: activeTenantId,
          tallerNombre: ctx.tallerNombre,
          isMember: true,
          baseRole: encodedSubBase,
        })
      }
    }

    // Intentar guardar en tabla `rutas` de Supabase si existe
    try {
      await supabase.from('rutas').upsert({
        id: nuevaRuta.id,
        codigo: nuevaRuta.codigo,
        nombre: nuevaRuta.nombre,
        zona: nuevaRuta.zona,
        descripcion: nuevaRuta.descripcion,
        estado: nuevaRuta.estado,
        sub_admin_id: nuevaRuta.subAdminId || null,
        sub_admin_nombre: nuevaRuta.subAdminNombre || null,
        sub_admin_email: nuevaRuta.subAdminEmail || null,
        created_at: nuevaRuta.createdAt,
      })
    } catch {
      // Respaldo transparente en localStorage + perfiles
    }

    const allStored = loadStoredRutas()
    allStored.push(nuevaRuta)
    saveStoredRutas(allStored)

    return {
      ruta: nuevaRuta,
      credenciales: credencialesCreadas,
    }
  },

  /**
   * Actualiza los datos de una ruta existente y sincroniza el rol de su Sub-Administrador
   */
  async updateRuta(
    id: string,
    updates: Partial<
      Pick<RutaSucursal, 'codigo' | 'nombre' | 'zona' | 'descripcion' | 'estado'>
    > & {
      assignUserId?: string | null
      assignSubAdmin?: {
        id?: string
        nombre?: string
        email?: string
      } | null
    }
  ): Promise<RutaSucursal> {
    const ctx = getActiveTenantContext()
    const allRutas = loadStoredRutas()
    const index = allRutas.findIndex((r) => r.id === id)
    if (index === -1) {
      throw new Error('No se encontró la ruta especificada.')
    }

    const current = allRutas[index]!
    const rutaTenant = getRutaTenantId(current)
    const updated: RutaSucursal = {
      ...current,
      codigo: updates.codigo !== undefined ? updates.codigo.trim().toUpperCase() : current.codigo,
      nombre:
        updates.nombre !== undefined
          ? updates.nombre.trim().replace(/\s+/g, ' ')
          : current.nombre,
      zona: updates.zona !== undefined ? updates.zona.trim() : current.zona,
      descripcion:
        updates.descripcion !== undefined
          ? updates.descripcion.trim()
          : current.descripcion,
      estado: updates.estado !== undefined ? updates.estado : current.estado,
    }

    if (updates.nombre !== undefined || updates.codigo !== undefined) {
      const tenantRutas = allRutas.filter(
        (r) => getRutaTenantId(r) === rutaTenant
      )
      validarDuplicadoRuta(tenantRutas, {
        nombre: updated.nombre,
        codigo: updated.codigo,
        excludeId: id,
      })
    }

    const encodedSubBase = encodeSubAdminRole(updated)
    const encodedRole = buildTenantScopedRole(
      encodedSubBase,
      rutaTenant,
      ctx.tallerNombre
    )
    const revertRole = buildTenantScopedRole(
      'operador',
      rutaTenant,
      ctx.tallerNombre
    )

    if (updates.assignSubAdmin !== undefined) {
      if (updates.assignSubAdmin === null) {
        if (current.subAdminId) {
          try {
            await cambiarRolUsuario(
              current.subAdminId,
              revertRole,
              current.subAdminEmail
            )
          } catch {
            // Ignore
          }
        }
        updated.subAdminId = undefined
        updated.subAdminNombre = undefined
        updated.subAdminEmail = undefined
      } else {
        if (
          current.subAdminId &&
          updates.assignSubAdmin.id &&
          current.subAdminId !== updates.assignSubAdmin.id
        ) {
          try {
            await cambiarRolUsuario(
              current.subAdminId,
              revertRole,
              current.subAdminEmail
            )
          } catch {
            // Ignore
          }
        }
        updated.subAdminId = updates.assignSubAdmin.id || updated.subAdminId
        updated.subAdminNombre =
          updates.assignSubAdmin.nombre || updated.subAdminNombre
        updated.subAdminEmail =
          updates.assignSubAdmin.email || updated.subAdminEmail
        if (updated.subAdminId) {
          if (rutaTenant) {
            registerIndependentTenantUser({
              userId: updated.subAdminId,
              email: updated.subAdminEmail,
              tenantId: rutaTenant,
              tallerNombre: ctx.tallerNombre,
              isMember: true,
              baseRole: encodedSubBase,
            })
          }
          try {
            await cambiarRolUsuario(
              updated.subAdminId,
              encodedRole as any,
              updated.subAdminEmail
            )
          } catch (err) {
            console.warn('[RutasService] Aviso al asignar rol de ruta:', err)
          }
        }
      }
    } else if (updates.assignUserId !== undefined) {
      if (updates.assignUserId === null || updates.assignUserId === '') {
        if (current.subAdminId) {
          try {
            await cambiarRolUsuario(
              current.subAdminId,
              revertRole,
              current.subAdminEmail
            )
          } catch {
            // Ignore if offline or RLS
          }
        }
        updated.subAdminId = undefined
        updated.subAdminNombre = undefined
        updated.subAdminEmail = undefined
      } else {
        const perfiles = await perfilesService.getPerfiles().catch(() => [] as Perfil[])
        const target = perfiles.find((p) => p.id === updates.assignUserId)
        if (target) {
          if (rutaTenant) {
            registerIndependentTenantUser({
              userId: target.id,
              email: target.email,
              tenantId: rutaTenant,
              tallerNombre: ctx.tallerNombre,
              isMember: true,
              baseRole: encodedSubBase,
            })
          }
          try {
            await cambiarRolUsuario(target.id, encodedRole as any, target.email)
          } catch (err) {
            console.warn('[RutasService] Aviso al cambiar rol de ruta:', err)
          }
          updated.subAdminId = target.id
          updated.subAdminNombre = target.nombre
          updated.subAdminEmail = target.email
        }
      }
    } else if (updated.subAdminId) {
      // Actualizar el nombre/código de la ruta en el rol del Sub-Administrador actual
      try {
        await cambiarRolUsuario(
          updated.subAdminId,
          encodedRole as any,
          updated.subAdminEmail
        )
      } catch {
        // Ignore if offline
      }
    }

    allRutas[index] = updated
    saveStoredRutas(allRutas)

    try {
      await supabase
        .from('rutas')
        .update({
          codigo: updated.codigo,
          nombre: updated.nombre,
          zona: updated.zona,
          descripcion: updated.descripcion,
          estado: updated.estado,
          sub_admin_id: updated.subAdminId || null,
          sub_admin_nombre: updated.subAdminNombre || null,
          sub_admin_email: updated.subAdminEmail || null,
        })
        .eq('id', id)
    } catch {
      // Ignore if table not created yet
    }

    return updated
  },

  /**
   * Elimina una ruta y opcionalmente pasa a su Sub-Administrador a rol 'operador' dentro del mismo taller
   */
  async deleteRuta(id: string): Promise<void> {
    const ctx = getActiveTenantContext()
    const allRutas = loadStoredRutas()
    const target = allRutas.find((r) => r.id === id)
    const rutaTenant = target ? getRutaTenantId(target) : null
    const revertRole = buildTenantScopedRole(
      'operador',
      rutaTenant,
      ctx.tallerNombre
    )

    if (target?.subAdminId) {
      try {
        await cambiarRolUsuario(target.subAdminId, revertRole, target.subAdminEmail)
      } catch {
        // Ignore
      }
    }

    const filtered = allRutas.filter((r) => r.id !== id)
    saveStoredRutas(filtered)

    try {
      await supabase.from('rutas').delete().eq('id', id)
    } catch {
      // Ignore
    }
  },

  /**
   * Registra la asociación entre una orden de trabajo y una ruta en caché local
   */
  setOrderRoute(
    orderId: string,
    orderNumber: string | undefined,
    route?: OrderRouteMetadata | null
  ): void {
    const map = loadOrderRoutesMap()
    if (!route || !route.rutaId) {
      delete map[orderId]
      if (orderNumber) delete map[orderNumber]
    } else {
      map[orderId] = route
      if (orderNumber) map[orderNumber] = route
    }
    saveOrderRoutesMap(map)
  },

  /**
   * Obtiene la ruta asociada a una orden desde el mapa local si no venía en la fila
   */
  getOrderRoute(
    orderId?: string | null,
    orderNumber?: string | null
  ): OrderRouteMetadata | undefined {
    const map = loadOrderRoutesMap()
    if (orderId && map[orderId]) return map[orderId]
    if (orderNumber && map[orderNumber]) return map[orderNumber]
    return undefined
  },

  /**
   * Registra la asociación entre una orden de trabajo y un tenant independiente
   */
  setOrderTenant(
    orderId: string,
    orderNumber: string | undefined,
    tenantId?: string | null
  ): void {
    const map = loadOrderTenantsMap()
    const clean = tenantId?.trim()
    if (!clean) {
      delete map[orderId]
      if (orderNumber) delete map[orderNumber]
    } else {
      map[orderId] = clean
      if (orderNumber) map[orderNumber] = clean
    }
    saveOrderTenantsMap(map)
  },

  /**
   * Obtiene el tenant independiente asociado a una orden si no venía en la fila
   */
  getOrderTenant(
    orderId?: string | null,
    orderNumber?: string | null
  ): string | undefined {
    const map = loadOrderTenantsMap()
    if (orderId && map[orderId]) return map[orderId]
    if (orderNumber && map[orderNumber]) return map[orderNumber]
    return undefined
  },
}
