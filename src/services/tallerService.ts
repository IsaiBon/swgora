import { supabase } from '@/services/supabase'

export interface TallerInfo {
  id: string
  nombre: string
  direccion: string
  celular1: string
  celular2: string
  eslogan?: string
  logo_url?: string
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
  logo_url: '/logo-taller.png'
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
        const info: TallerInfo = {
          id: data.id || 'principal',
          nombre: data.nombre || DEFAULT_TALLER_INFO.nombre,
          direccion: data.direccion || DEFAULT_TALLER_INFO.direccion,
          celular1: data.celular1 || DEFAULT_TALLER_INFO.celular1,
          celular2: data.celular2 !== undefined && data.celular2 !== null ? data.celular2 : DEFAULT_TALLER_INFO.celular2,
          eslogan: data.eslogan || DEFAULT_TALLER_INFO.eslogan,
          logo_url: data.logo_url || DEFAULT_TALLER_INFO.logo_url,
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
    const payload = {
      id: 'principal',
      nombre: (info.nombre?.trim() || DEFAULT_TALLER_INFO.nombre).toUpperCase(),
      direccion: info.direccion?.trim() || DEFAULT_TALLER_INFO.direccion,
      celular1: info.celular1?.trim() || DEFAULT_TALLER_INFO.celular1,
      celular2: info.celular2 !== undefined ? info.celular2.trim() : DEFAULT_TALLER_INFO.celular2,
      eslogan: info.eslogan?.trim() || DEFAULT_TALLER_INFO.eslogan,
      logo_url: info.logo_url || DEFAULT_TALLER_INFO.logo_url,
      updated_at: new Date().toISOString()
    }

    try {
      const { data, error } = await supabase
        .from('taller')
        .upsert(payload)
        .select('*')
        .single()

      if (!error && data) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
        }
        return data as TallerInfo
      } else if (error) {
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
  }
}
