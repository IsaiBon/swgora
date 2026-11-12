import { supabase } from '@/services/supabase'

export interface TallerInfo {
  id: string
  nombre: string
  direccion: string
  celular1: string
  celular2: string
  eslogan?: string
  logo_url?: string
  iva_porcentaje?: number
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
  iva_porcentaje: 13
}

const LOCAL_STORAGE_KEY = 'swgora_taller_config'

export const tallerService = {
  /**
   * Obtiene la información institucional del taller desde Supabase.
   * Cuenta con respaldo local en localStorage y fallback a valores oficiales predeterminados.
   */
  async getTallerInfo(): Promise<TallerInfo> {
    try {
      const { data, error } = await supabase
        .from('taller')
        .select('*')
        .eq('id', 'principal')
        .single()

      if (!error && data) {
        let cachedIva = DEFAULT_TALLER_INFO.iva_porcentaje ?? 13
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const rawCache = window.localStorage.getItem(LOCAL_STORAGE_KEY)
            if (rawCache) {
              const parsedCache = JSON.parse(rawCache)
              if (parsedCache?.iva_porcentaje !== undefined && !isNaN(Number(parsedCache.iva_porcentaje))) {
                cachedIva = Number(parsedCache.iva_porcentaje)
              }
            }
          } catch { /* ignorar */ }
        }

        const info: TallerInfo = {
          id: data.id || 'principal',
          nombre: data.nombre || DEFAULT_TALLER_INFO.nombre,
          direccion: data.direccion || DEFAULT_TALLER_INFO.direccion,
          celular1: data.celular1 || DEFAULT_TALLER_INFO.celular1,
          celular2: data.celular2 !== undefined && data.celular2 !== null ? data.celular2 : DEFAULT_TALLER_INFO.celular2,
          eslogan: data.eslogan || DEFAULT_TALLER_INFO.eslogan,
          logo_url: data.logo_url || DEFAULT_TALLER_INFO.logo_url,
          iva_porcentaje: data.iva_porcentaje !== undefined && data.iva_porcentaje !== null
            ? Number(data.iva_porcentaje)
            : cachedIva,
          created_at: data.created_at,
          updated_at: data.updated_at
        }
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(info))
        }
        return info
      }
    } catch (err) {
      console.warn('[tallerService] Error consultando taller en Supabase, recurriendo a cache:', err)
    }

    // Fallback a localStorage si la BD no responde
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY)
        if (cached) {
          return JSON.parse(cached)
        }
      } catch {
        // Ignorar error de parsing
      }
    }

    return { ...DEFAULT_TALLER_INFO }
  },

  /**
   * Actualiza la información institucional del taller en Supabase y sincroniza localmente.
   */
  async updateTallerInfo(info: Partial<TallerInfo>): Promise<TallerInfo> {
    const ivaPct = info.iva_porcentaje !== undefined && !isNaN(Number(info.iva_porcentaje))
      ? Math.max(0, Math.min(100, Number(info.iva_porcentaje)))
      : (DEFAULT_TALLER_INFO.iva_porcentaje ?? 13)

    const basePayload = {
      id: 'principal',
      nombre: (info.nombre?.trim() || DEFAULT_TALLER_INFO.nombre).toUpperCase(),
      direccion: info.direccion?.trim() || DEFAULT_TALLER_INFO.direccion,
      celular1: info.celular1?.trim() || DEFAULT_TALLER_INFO.celular1,
      celular2: info.celular2 !== undefined ? info.celular2.trim() : DEFAULT_TALLER_INFO.celular2,
      eslogan: info.eslogan?.trim() || DEFAULT_TALLER_INFO.eslogan,
      logo_url: info.logo_url || DEFAULT_TALLER_INFO.logo_url,
      updated_at: new Date().toISOString()
    }
    const payload = { ...basePayload, iva_porcentaje: ivaPct }

    try {
      const { data, error } = await supabase
        .from('taller')
        .upsert(payload)
        .select('*')
        .single()

      if (!error && data) {
        const merged = { ...data, iva_porcentaje: data.iva_porcentaje ?? ivaPct } as TallerInfo
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
        }
        return merged
      } else if (error) {
        // Fallback si la columna iva_porcentaje aún no existe en Supabase
        const { data: retryData, error: retryErr } = await supabase
          .from('taller')
          .upsert(basePayload)
          .select('*')
          .single()
        if (!retryErr && retryData) {
          const merged = { ...retryData, iva_porcentaje: ivaPct } as TallerInfo
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
          }
          return merged
        }
        console.error('[tallerService] Error actualizando taller en Supabase:', error)
      }
    } catch (err) {
      console.error('[tallerService] Excepción actualizando taller:', err)
    }

    // Guardar en localStorage como fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
    }
    return payload as TallerInfo
  },

  /**
   * Sube un nuevo logotipo para el taller en Supabase Storage (bucket 'taller')
   * y retorna la URL pública. Cuenta con respaldo automático a Data URL base64.
   */
  async uploadLogo(file: File): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
      const cleanFileName = `logo_taller_${Date.now()}.${fileExt}`

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
        console.warn('[tallerService] Advertencia subiendo logo a Storage, usando Data URL:', error)
      }
    } catch (err) {
      console.warn('[tallerService] Excepción en uploadLogo:', err)
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
