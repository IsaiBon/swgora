import { supabase } from '@/services/supabase'
import {
  getActiveTenantContext,
  getUserTenantMembership,
  parseSubAdminRole,
} from '@/services/rutasService'

export interface TallerInfo {
  id: string
  nombre: string
  direccion: string
  celular1: string
  celular2: string
  eslogan?: string
  logo_url?: string
  iva_porcentaje?: number
  login_titulo?: string
  login_subtitulo?: string
  login_mensaje?: string
  login_bg_url?: string
  created_at?: string
  updated_at?: string
}

export const DEFAULT_TALLER_INFO: TallerInfo = {
  id: 'principal',
  nombre: 'TALLER INDUSTRIAL Y RECTIFICADO DE MOTORES',
  direccion: 'Col. Milagro de la Paz, Av. San Luis y Calle Oriente #12 San Miguel, El Salvador',
  celular1: '7831-2641',
  celular2: '7142-0401',
  eslogan: 'APOYARTE ES NUESTRO COMPROMISO',
  logo_url: '/logo-taller.png',
  iva_porcentaje: 13,
  login_titulo: 'JR Blanco',
  login_subtitulo: 'Taller Industrial y Rectificado de Motores',
  login_mensaje: 'Ingresa tus credenciales para acceder al sistema',
  login_bg_url: '/images/workshop-bg.jpg'
}

const LOCAL_STORAGE_KEY = 'swgora_taller_config'
const LOGIN_STORAGE_KEY = 'swgora_login_customization'
const CLOUD_LOGIN_TALLER_ID = '__swgora_login_customization__'

/**
 * Determina si el usuario activo pertenece al taller principal como Administrador
 * y tiene permiso para modificar la pantalla de inicio de sesión (Login).
 * Las cuentas de talleres independientes / amigos y roles no administradores quedan excluidos.
 */
export function canCurrentUserCustomizeLogin(): boolean {
  const ctx = getActiveTenantContext()
  if (ctx.isIndependent || Boolean(ctx.tenantId)) {
    return false
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }
  try {
    const rawUser = window.localStorage.getItem('swgora_active_user')
    if (!rawUser) return false
    const parsed = JSON.parse(rawUser) as {
      id?: string
      email?: string
      role?: string
      rawRole?: string
      isIndependent?: boolean
      tenantId?: string
    }
    if (parsed.isIndependent || parsed.tenantId) {
      return false
    }
    const membership = getUserTenantMembership({
      id: parsed.id,
      email: parsed.email,
      rawRole: parsed.rawRole || parsed.role,
    })
    if (membership.isIndependent) {
      return false
    }
    const subAdmin = parseSubAdminRole(parsed.rawRole || parsed.role)
    if (subAdmin.isSubAdmin) {
      return false
    }
    const roleLower = (parsed.role || '').trim().toLowerCase()
    const baseLower = (membership.baseRole || parsed.role || '').trim().toLowerCase()
    if (
      baseLower.includes('sub') ||
      baseLower.includes('independiente') ||
      roleLower.includes('sub') ||
      roleLower.includes('independiente')
    ) {
      return false
    }
    return roleLower === 'administrador' || roleLower === 'admin'
  } catch {
    return false
  }
}

function stripLoginFields(info: Partial<TallerInfo>): Partial<TallerInfo> {
  const clean: Partial<TallerInfo> = {}
  if (info.id !== undefined) clean.id = info.id
  if (info.nombre !== undefined) clean.nombre = info.nombre
  if (info.direccion !== undefined) clean.direccion = info.direccion
  if (info.celular1 !== undefined) clean.celular1 = info.celular1
  if (info.celular2 !== undefined) clean.celular2 = info.celular2
  if (info.eslogan !== undefined) clean.eslogan = info.eslogan
  if (info.logo_url !== undefined) clean.logo_url = info.logo_url
  if (info.iva_porcentaje !== undefined) clean.iva_porcentaje = info.iva_porcentaje
  return clean
}

function getTargetTallerId(): string {
  const ctx = getActiveTenantContext()
  return ctx.tenantId ? `taller_${ctx.tenantId}` : 'principal'
}

function getTallerStorageKey(): string {
  const ctx = getActiveTenantContext()
  return ctx.tenantId ? `${LOCAL_STORAGE_KEY}__${ctx.tenantId}` : LOCAL_STORAGE_KEY
}

function getDefaultTallerInfoForContext(): TallerInfo {
  const ctx = getActiveTenantContext()
  if (ctx.tenantId) {
    const defaultName = (ctx.tallerNombre || ctx.userName || 'MI TALLER MECÁNICO').toUpperCase()
    return {
      id: `taller_${ctx.tenantId}`,
      nombre: defaultName,
      direccion: 'Configura la dirección de tu taller',
      celular1: '',
      celular2: '',
      eslogan: 'SERVICIO MECÁNICO Y RECTIFICACIÓN',
      logo_url: '/logo-taller.png',
      iva_porcentaje: 13,
      login_titulo: ctx.tallerNombre || 'Mi Taller',
      login_subtitulo: 'Taller Industrial y Rectificado de Motores',
      login_mensaje: 'Ingresa tus credenciales para acceder al sistema',
      login_bg_url: '/images/workshop-bg.jpg',
    }
  }
  return { ...DEFAULT_TALLER_INFO }
}

export const tallerService = {
  /**
   * Obtiene la información institucional del taller desde Supabase.
   * Cuenta con respaldo local en localStorage y fallback a valores oficiales predeterminados.
   */
  async getTallerInfo(options?: { forLoginScreen?: boolean }): Promise<TallerInfo> {
    const forLoginScreen = Boolean(options?.forLoginScreen)
    const ctx = getActiveTenantContext()
    const isIndependentContext = !forLoginScreen && (ctx.isIndependent || Boolean(ctx.tenantId))
    const targetId = forLoginScreen ? 'principal' : getTargetTallerId()
    const storageKey = forLoginScreen ? LOCAL_STORAGE_KEY : getTallerStorageKey()
    const defaults = forLoginScreen ? { ...DEFAULT_TALLER_INFO } : getDefaultTallerInfoForContext()

    // 1. Obtener caché local de login únicamente en el contexto principal / pantalla de acceso
    let localLoginConfig: Partial<TallerInfo> = {}
    if (!isIndependentContext && typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawLogin = window.localStorage.getItem(LOGIN_STORAGE_KEY)
        if (rawLogin) {
          localLoginConfig = JSON.parse(rawLogin)
        }
      } catch {}
    }

    try {
      // 2. Consultar taller en Supabase; solo el contexto principal/login consulta personalización de Login
      const [tallerRes, loginRes] = await Promise.all([
        supabase.from('taller').select('*').eq('id', targetId).maybeSingle(),
        isIndependentContext
          ? Promise.resolve({ data: null, error: null })
          : supabase.from('taller').select('*').eq('id', CLOUD_LOGIN_TALLER_ID).maybeSingle()
      ])

      let remoteLoginConfig: Partial<TallerInfo> = {}
      if (!isIndependentContext && loginRes.data) {
        if (loginRes.data.eslogan) {
          try {
            remoteLoginConfig = JSON.parse(loginRes.data.eslogan)
          } catch {}
        }
        if (!remoteLoginConfig.login_titulo) {
          remoteLoginConfig = {
            login_titulo: loginRes.data.nombre,
            login_subtitulo: loginRes.data.celular1,
            login_mensaje: loginRes.data.direccion,
            login_bg_url: loginRes.data.logo_url
          }
        }
      }

      const activeLogin = isIndependentContext
        ? {}
        : {
            ...localLoginConfig,
            ...remoteLoginConfig
          }

      if (!tallerRes.error && tallerRes.data) {
        const data = tallerRes.data
        let cachedIva = defaults.iva_porcentaje ?? 13
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const rawCache = window.localStorage.getItem(storageKey)
            if (rawCache) {
              const parsedCache = JSON.parse(rawCache)
              if (parsedCache?.iva_porcentaje !== undefined && !isNaN(Number(parsedCache.iva_porcentaje))) {
                cachedIva = Number(parsedCache.iva_porcentaje)
              }
            }
          } catch {}
        }

        const info: TallerInfo = {
          id: data.id || targetId,
          nombre: data.nombre || defaults.nombre,
          direccion: data.direccion || defaults.direccion,
          celular1: data.celular1 !== undefined && data.celular1 !== null ? data.celular1 : defaults.celular1,
          celular2: data.celular2 !== undefined && data.celular2 !== null ? data.celular2 : defaults.celular2,
          eslogan: data.eslogan || defaults.eslogan,
          logo_url: data.logo_url || defaults.logo_url,
          iva_porcentaje: data.iva_porcentaje !== undefined && data.iva_porcentaje !== null
            ? Number(data.iva_porcentaje)
            : cachedIva,
          login_titulo: isIndependentContext
            ? defaults.login_titulo
            : (activeLogin.login_titulo || data.login_titulo || defaults.login_titulo),
          login_subtitulo: isIndependentContext
            ? defaults.login_subtitulo
            : (activeLogin.login_subtitulo || data.login_subtitulo || defaults.login_subtitulo),
          login_mensaje: isIndependentContext
            ? defaults.login_mensaje
            : (activeLogin.login_mensaje || data.login_mensaje || defaults.login_mensaje),
          login_bg_url: isIndependentContext
            ? defaults.login_bg_url
            : (activeLogin.login_bg_url || data.login_bg_url || defaults.login_bg_url),
          created_at: data.created_at,
          updated_at: data.updated_at
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, JSON.stringify(info))
          if (!isIndependentContext && activeLogin.login_titulo) {
            window.localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(activeLogin))
          }
        }
        return info
      }
    } catch (err) {
      console.warn('[tallerService] Error consultando taller en Supabase, recurriendo a cache:', err)
    }

    // Fallback a localStorage si la BD no responde
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = window.localStorage.getItem(storageKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (isIndependentContext) {
            return {
              ...defaults,
              ...stripLoginFields(parsed)
            }
          }
          return {
            ...defaults,
            ...parsed,
            ...localLoginConfig
          }
        }
      } catch {
        // Ignorar error de parsing
      }
    }

    return isIndependentContext
      ? { ...defaults }
      : {
          ...defaults,
          ...localLoginConfig
        }
  },

  /**
   * Inicializa el registro de taller propio para una nueva cuenta independiente
   */
  async initIndependentTaller(params: {
    tenantId: string
    nombreTaller: string
  }): Promise<void> {
    const cleanTenantId = params.tenantId.trim()
    if (!cleanTenantId) return

    const tallerId = `taller_${cleanTenantId}`
    const storageKey = `${LOCAL_STORAGE_KEY}__${cleanTenantId}`
    const initialInfo: TallerInfo = {
      id: tallerId,
      nombre: (params.nombreTaller.trim() || 'MI TALLER MECÁNICO').toUpperCase(),
      direccion: 'Configura la dirección de tu taller',
      celular1: '0000-0000',
      celular2: '',
      eslogan: 'SERVICIO MECÁNICO Y RECTIFICACIÓN',
      logo_url: '/logo-taller.png',
      iva_porcentaje: 13,
      updated_at: new Date().toISOString(),
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(initialInfo))
      } catch {
        // Ignore storage errors
      }
    }

    try {
      await supabase.from('taller').upsert(initialInfo)
    } catch {
      // Respaldo local ya persistido
    }
  },

  /**
   * Actualiza la información institucional del taller en Supabase y sincroniza localmente.
   * Solo el Administrador del taller principal puede modificar la personalización del Login.
   */
  async updateTallerInfo(info: Partial<TallerInfo>): Promise<TallerInfo> {
    const ctx = getActiveTenantContext()
    const isIndependentContext = ctx.isIndependent || Boolean(ctx.tenantId)
    const allowLoginCustomization = canCurrentUserCustomizeLogin()

    const targetId = getTargetTallerId()
    const storageKey = getTallerStorageKey()
    const defaults = getDefaultTallerInfoForContext()

    if (!allowLoginCustomization && (!isIndependentContext || targetId === 'principal' || targetId === CLOUD_LOGIN_TALLER_ID)) {
      throw new Error('No tienes permisos para modificar la configuración principal ni el inicio de sesión.')
    }

    const safeInfo = allowLoginCustomization ? info : stripLoginFields(info)

    const ivaPct = safeInfo.iva_porcentaje !== undefined && !isNaN(Number(safeInfo.iva_porcentaje))
      ? Math.max(0, Math.min(100, Number(safeInfo.iva_porcentaje)))
      : (defaults.iva_porcentaje ?? 13)

    const basePayload = {
      id: targetId,
      nombre: (safeInfo.nombre?.trim() || defaults.nombre).toUpperCase(),
      direccion: safeInfo.direccion?.trim() || defaults.direccion,
      celular1: safeInfo.celular1 !== undefined ? safeInfo.celular1.trim() : defaults.celular1,
      celular2: safeInfo.celular2 !== undefined ? safeInfo.celular2.trim() : defaults.celular2,
      eslogan: safeInfo.eslogan?.trim() || defaults.eslogan,
      logo_url: safeInfo.logo_url || defaults.logo_url,
      updated_at: new Date().toISOString()
    }
    const fullPayload = allowLoginCustomization
      ? {
          ...basePayload,
          iva_porcentaje: ivaPct,
          login_titulo: safeInfo.login_titulo !== undefined ? safeInfo.login_titulo.trim() : (defaults.login_titulo || 'JR Blanco'),
          login_subtitulo: safeInfo.login_subtitulo !== undefined ? safeInfo.login_subtitulo.trim() : (defaults.login_subtitulo || 'Taller Industrial y Rectificado de Motores'),
          login_mensaje: safeInfo.login_mensaje !== undefined ? safeInfo.login_mensaje.trim() : (defaults.login_mensaje || 'Ingresa tus credenciales para acceder al sistema'),
          login_bg_url: safeInfo.login_bg_url || defaults.login_bg_url || '/images/workshop-bg.jpg'
        }
      : {
          ...basePayload,
          iva_porcentaje: ivaPct
        }

    // Guardar caché local; solo el Administrador principal puede actualizar la caché global de Login
    if (typeof window !== 'undefined' && window.localStorage) {
      if (allowLoginCustomization) {
        const loginPayload = fullPayload as typeof fullPayload & {
          login_titulo: string
          login_subtitulo: string
          login_mensaje: string
          login_bg_url: string
        }
        window.localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify({
          login_titulo: loginPayload.login_titulo,
          login_subtitulo: loginPayload.login_subtitulo,
          login_mensaje: loginPayload.login_mensaje,
          login_bg_url: loginPayload.login_bg_url,
          logo_url: loginPayload.logo_url
        }))
      }
      window.localStorage.setItem(storageKey, JSON.stringify(fullPayload))
    }

    // Sincronizar en la nube el registro global de Login únicamente para el Administrador principal
    if (allowLoginCustomization) {
      const loginPayload = fullPayload as typeof fullPayload & {
        login_titulo: string
        login_subtitulo: string
        login_mensaje: string
        login_bg_url: string
      }
      try {
        await supabase.from('taller').upsert({
          id: CLOUD_LOGIN_TALLER_ID,
          nombre: loginPayload.login_titulo,
          direccion: loginPayload.login_mensaje,
          celular1: loginPayload.login_subtitulo,
          logo_url: loginPayload.login_bg_url,
          eslogan: JSON.stringify({
            login_titulo: loginPayload.login_titulo,
            login_subtitulo: loginPayload.login_subtitulo,
            login_mensaje: loginPayload.login_mensaje,
            login_bg_url: loginPayload.login_bg_url,
            logo_url: loginPayload.logo_url
          }),
          updated_at: new Date().toISOString()
        })
      } catch (loginCloudErr) {
        console.warn('[tallerService] Advertencia sincronizando login en Supabase:', loginCloudErr)
      }
    }

    try {
      const { data, error } = await supabase
        .from('taller')
        .upsert(fullPayload)
        .select('*')
        .single()

      if (!error && data) {
        const merged = (allowLoginCustomization
          ? { ...fullPayload, ...data }
          : { ...fullPayload, ...stripLoginFields(data as Partial<TallerInfo>) }) as TallerInfo
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, JSON.stringify(merged))
        }
        return merged
      } else if (error) {
        // Fallback 1: Si faltan las nuevas columnas de login, intentar con basePayload + iva_porcentaje
        const payloadWithIva = { ...basePayload, iva_porcentaje: ivaPct }
        const { data: retryIvaData, error: retryIvaErr } = await supabase
          .from('taller')
          .upsert(payloadWithIva)
          .select('*')
          .single()

        if (!retryIvaErr && retryIvaData) {
          const merged = (allowLoginCustomization
            ? { ...fullPayload, ...retryIvaData }
            : { ...fullPayload, ...stripLoginFields(retryIvaData as Partial<TallerInfo>) }) as TallerInfo
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(storageKey, JSON.stringify(merged))
          }
          return merged
        }

        // Fallback 2: Intentar solo basePayload
        const { data: retryData, error: retryErr } = await supabase
          .from('taller')
          .upsert(basePayload)
          .select('*')
          .single()
        if (!retryErr && retryData) {
          const merged = (allowLoginCustomization
            ? { ...fullPayload, ...retryData }
            : { ...fullPayload, ...stripLoginFields(retryData as Partial<TallerInfo>) }) as TallerInfo
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(storageKey, JSON.stringify(merged))
          }
          return merged
        }
        console.error('[tallerService] Error actualizando taller en Supabase:', error)
      }
    } catch (err) {
      console.error('[tallerService] Excepción actualizando taller:', err)
    }

    // Guardar en localStorage como fallback garantizado
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify(fullPayload))
    }
    return fullPayload as TallerInfo
  },

  /**
   * Sube un nuevo logotipo para el taller en Supabase Storage (bucket 'taller')
   * y retorna la URL pública. Cuenta con respaldo automático a Data URL base64.
   */
  async uploadLogo(file: File): Promise<string> {
    return this.uploadAsset(file, 'logo_taller')
  },

  /**
   * Sube una nueva imagen de fondo para la pantalla de Login en Supabase Storage (bucket 'taller')
   */
  async uploadLoginBg(file: File): Promise<string> {
    if (!canCurrentUserCustomizeLogin()) {
      throw new Error('No tienes permisos para modificar el fondo del inicio de sesión.')
    }
    return this.uploadAsset(file, 'login_bg')
  },

  /**
   * Sube un archivo gráfico al bucket 'taller' o genera un Data URL de respaldo
   */
  async uploadAsset(file: File, prefix = 'asset'): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
      const cleanFileName = `${prefix}_${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('taller')
        .upload(cleanFileName, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('taller')
          .getPublicUrl(cleanFileName)

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl
        }
      } else if (error) {
        console.warn(`[tallerService] Advertencia subiendo ${prefix} a Storage, usando Data URL:`, error)
      }
    } catch (err) {
      console.warn(`[tallerService] Excepción en uploadAsset (${prefix}):`, err)
    }

    // Fallback: Convertir archivo a Data URL base64 ultra-estable
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
}
