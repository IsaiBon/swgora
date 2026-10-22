import { supabase } from './supabase'
import type { Session, User, AuthResponse, AuthTokenResponsePassword } from '@supabase/supabase-js'

export interface AuthUserProfile {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export const authService = {
  /**
   * Registra un nuevo usuario con correo y contraseña en Supabase Auth
   */
  async signUp(email: string, password: string, name?: string): Promise<AuthResponse['data']> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
          role: 'Operador',
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  },

  /**
   * Inicia sesión con correo y contraseña
   */
  async signIn(email: string, password: string): Promise<AuthTokenResponsePassword['data']> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    return data
  },

  /**
   * Cierra la sesión activa
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
  },

  async signOutLocal(): Promise<void> {
  const { error } = await supabase.auth.signOut({
    scope: 'local',
  })

  if (error) {
    throw error
  }
},

  /**
   * Obtiene la sesión actual
   */
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      throw error
    }
    return data.session
  },

  /**
   * Obtiene el usuario autenticado actual
   */
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      throw error
    }
    return data.user
  },

  /**
   * Escucha cambios en el estado de autenticación (login, logout, refresh de token)
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  },
}
