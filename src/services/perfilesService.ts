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
  /**
   * Obtiene el perfil de un usuario por su ID (UUID de auth.users)
   */
  async getPerfilById(id: string): Promise<Perfil | null> {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw error
    }
    return data as Perfil | null
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
    return (data as Perfil[]) || []
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
