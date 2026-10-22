import { supabase } from './supabase'

export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: string
  estado: 'Activo' | 'Inactivo'
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export type PerfilUpdate = Partial<
  Omit<Perfil, 'id' | 'created_at' | 'updated_at' | 'estado'>
>

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
}
