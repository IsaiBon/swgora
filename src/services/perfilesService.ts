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
}

export type PerfilUpdate = Partial<
  Omit<Perfil, 'id' | 'created_at' | 'updated_at' | 'estado'>
>

const PERFILES_CACHE_KEY = 'swgora_perfiles_cache_v1'

function readPerfilesCache(): Perfil[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(PERFILES_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Perfil[]) : []
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

function isRichEncodedRole(rol?: string | null): boolean {
  if (!rol) return false
  const lower = rol.trim().toLowerCase()
  return (
    lower.startsWith('independiente|') ||
    lower.startsWith('subadmin|') ||
    lower.includes('||tenant|')
  )
}

function mergePerfilesIntoCache(entradas: Perfil[]): Perfil[] {
  const actuales = readPerfilesCache()
  if (!entradas.length) return []
  const mapa = new Map<string, Perfil>()
  for (const item of actuales) {
    if (item?.id) mapa.set(item.id, item)
  }
  const mergedResultados: Perfil[] = []
  for (const item of entradas) {
    if (!item?.id) continue
    const prev = mapa.get(item.id)
    const incomingGeneric =
      !item.rol || item.rol.trim().toLowerCase() === 'operador'
    const resolvedRol =
      incomingGeneric && isRichEncodedRole(prev?.rol) ? prev!.rol : item.rol
    const merged: Perfil = {
      ...prev,
      ...item,
      rol: resolvedRol,
    }
    mapa.set(item.id, merged)
    mergedResultados.push(merged)
  }
  writePerfilesCache(Array.from(mapa.values()))
  return mergedResultados
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
  cachePerfilesList(perfiles: Perfil[]): void {
    mergePerfilesIntoCache(perfiles)
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
        const merged = mergePerfilesIntoCache([data as Perfil])
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
   * Obtiene todos los perfiles de usuarios (solo para roles autorizados)
   */
  async getPerfiles(): Promise<Perfil[]> {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      throw error
    }
    const lista = (data as Perfil[]) || []
    const merged = mergePerfilesIntoCache(lista)
    return merged.length > 0 ? merged : lista
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
      mergePerfilesIntoCache([data as Perfil])
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
