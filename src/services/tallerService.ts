import { supabase } from '@/services/supabase'
import { getActiveTenantContext } from '@/services/rutasService'

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
  async getTallerInfo(): Promise<TallerInfo> {
    const targetId = getTargetTallerId()
    const storageKey = getTallerStorageKey()
    const defaults = getDefaultTallerInfoForContext()

    // 1. Obtener caché local de login y de taller como base inmediata
    let localLoginConfig: Partial<TallerInfo> = {}
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawLogin = window.localStorage.getItem(LOGIN_STORAGE_KEY)
        if (rawLogin) {
          localLoginConfig = JSON.parse(rawLogin)
        }
      } catch {}
    }

    try {
      // 2. Consultar taller en Supabase y el registro de personalización de login en paralelo
      const [tallerRes, loginRes] = await Promise.all([
        supabase.from('taller').select('*').eq('id', targetId).maybeSingle(),
        supabase.from('taller').select('*').eq('id', CLOUD_LOGIN_TALLER_ID).maybeSingle()
      ])

      let remoteLoginConfig: Partial<TallerInfo> = {}
      if (loginRes.data) {
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

      const activeLogin = {
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
          login_titulo: activeLogin.login_titulo || data.login_titulo || defaults.login_titulo,
          login_subtitulo: activeLogin.login_subtitulo || data.login_subtitulo || defaults.login_subtitulo,
          login_mensaje: activeLogin.login_mensaje || data.login_mensaje || defaults.login_mensaje,
          login_bg_url: activeLogin.login_bg_url || data.login_bg_url || defaults.login_bg_url,
          created_at: data.created_at,
          updated_at: data.updated_at
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, JSON.stringify(info))
          if (activeLogin.login_titulo) {
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

    return {
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
   */
  async updateTallerInfo(info: Partial<TallerInfo>): Promise<TallerInfo> {
    const targetId = getTargetTallerId()
    const storageKey = getTallerStorageKey()
    const defaults = getDefaultTallerInfoForContext()

    const ivaPct = info.iva_porcentaje !== undefined && !isNaN(Number(info.iva_porcentaje))
      ? Math.max(0, Math.min(100, Number(info.iva_porcentaje)))
      : (defaults.iva_porcentaje ?? 13)

    const basePayload = {
      id: targetId,
      nombre: (info.nombre?.trim() || defaults.nombre).toUpperCase(),
      direccion: info.direccion?.trim() || defaults.direccion,
      celular1: info.celular1 !== undefined ? info.celular1.trim() : defaults.celular1,
      celular2: info.celular2 !== undefined ? info.celular2.trim() : defaults.celular2,
      eslogan: info.eslogan?.trim() || defaults.eslogan,
      logo_url: info.logo_url || defaults.logo_url,
      updated_at: new Date().toISOString()
    }
    const fullPayload = {
      ...basePayload,
      iva_porcentaje: ivaPct,
      login_titulo: info.login_titulo !== undefined ? info.login_titulo.trim() : (defaults.login_titulo || 'JR Blanco'),
      login_subtitulo: info.login_subtitulo !== undefined ? info.login_subtitulo.trim() : (defaults.login_subtitulo || 'Taller Industrial y Rectificado de Motores'),
      login_mensaje: info.login_mensaje !== undefined ? info.login_mensaje.trim() : (defaults.login_mensaje || 'Ingresa tus credenciales para acceder al sistema'),
      login_bg_url: info.login_bg_url || defaults.login_bg_url || '/images/workshop-bg.jpg'
    }

    // Guardar de inmediato en caché local de login
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify({
        login_titulo: fullPayload.login_titulo,
        login_subtitulo: fullPayload.login_subtitulo,
        login_mensaje: fullPayload.login_mensaje,
        login_bg_url: fullPayload.login_bg_url,
        logo_url: fullPayload.logo_url
      }))
      window.localStorage.setItem(storageKey, JSON.stringify(fullPayload))
    }

    // Sincronizar en la nube en el registro especial de personalización del Login
    try {
      await supabase.from('taller').upsert({
        id: CLOUD_LOGIN_TALLER_ID,
        nombre: fullPayload.login_titulo,
        direccion: fullPayload.login_mensaje,
        celular1: fullPayload.login_subtitulo,
        logo_url: fullPayload.login_bg_url,
        eslogan: JSON.stringify({
          login_titulo: fullPayload.login_titulo,
          login_subtitulo: fullPayload.login_subtitulo,
          login_mensaje: fullPayload.login_mensaje,
          login_bg_url: fullPayload.login_bg_url,
          logo_url: fullPayload.logo_url
        }),
        updated_at: new Date().toISOString()
      })
    } catch (loginCloudErr) {
      console.warn('[tallerService] Advertencia sincronizando login en Supabase:', loginCloudErr)
    }

    try {
      const { data, error } = await supabase
        .from('taller')
        .upsert(fullPayload)
        .select('*')
        .single()

      if (!error && data) {
        const merged = { ...fullPayload, ...data } as TallerInfo
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
          const merged = { ...fullPayload, ...retryIvaData } as TallerInfo
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
          const merged = { ...fullPayload, ...retryData } as TallerInfo
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
