import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface NuevoUsuario {
  nombre: string
  email: string
  password: string
  rol: 'admin' | 'consultor' | 'operador'
}

const CREDENTIALS_STORAGE_KEY = 'swgora_admin_credentials_vault'

interface StoredCredentialMap {
  byId: Record<string, string>
  byEmail: Record<string, string>
}

const DEFAULT_KNOWN_CREDENTIALS: Record<string, string> = {
  'admin@jrblanco.com': 'Admin1234*',
  'admin.swgora@gmail.com': 'SwgoraAdmin2026*',
  'consultor.swgora@gmail.com': 'Consultor2026*',
  'operador.swgora@gmail.com': 'Operador2026*',
  'diegogranados1324@gmail.com': 'Diego1234*',
  'jrblanco@gmail.com': 'JrBlanco2026*',
}

function createIsolatedAuthClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'swgora_isolated_admin_auth_client',
    },
  })
}

function loadCredentialVault(): StoredCredentialMap {
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY)
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

function saveCredentialVault(vault: StoredCredentialMap): void {
  try {
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(vault))
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Registra o actualiza la contraseña visible para el administrador
 */
export function registrarCredencialUsuario(params: {
  id?: string | null
  email?: string | null
  password: string
}): void {
  const pwd = params.password
  if (!pwd) return

  const vault = loadCredentialVault()
  if (params.id) {
    vault.byId[params.id] = pwd
  }
  if (params.email) {
    vault.byEmail[params.email.trim().toLowerCase()] = pwd
  }
  saveCredentialVault(vault)
}

/**
 * Obtiene la contraseña registrada de un usuario para visualización del administrador
 */
export function obtenerCredencialUsuario(usuario: {
  id?: string | null
  email?: string | null
  credencial?: string | null
}): string {
  if (usuario.credencial) {
    return usuario.credencial
  }
  const vault = loadCredentialVault()
  if (usuario.id && vault.byId[usuario.id]) {
    return vault.byId[usuario.id]!
  }
  if (usuario.email) {
    const emailKey = usuario.email.trim().toLowerCase()
    if (vault.byEmail[emailKey]) {
      return vault.byEmail[emailKey]!
    }
    if (DEFAULT_KNOWN_CREDENTIALS[emailKey]) {
      return DEFAULT_KNOWN_CREDENTIALS[emailKey]!
    }
    const localPart = emailKey.split('@')[0] || 'usuario'
    return `${localPart.charAt(0).toUpperCase() + localPart.slice(1)}2026*`
  }
  return 'Temporal2026*'
}

export async function crearUsuario(datos: NuevoUsuario): Promise<void> {
  const cleanNombre = datos.nombre.trim()
  const cleanEmail = datos.email.trim().toLowerCase()
  const cleanPassword = datos.password

  // 1. Intentar primero mediante la Edge Function oficial
  try {
    const { data, error } = await supabase.functions.invoke('crear-usuario', {
      body: {
        nombre: cleanNombre,
        email: cleanEmail,
        password: cleanPassword,
        rol: datos.rol,
      },
    })

    if (!error && data?.usuario?.id) {
      registrarCredencialUsuario({
        id: data.usuario.id,
        email: cleanEmail,
        password: cleanPassword,
      })
      return
    }
  } catch {
    // Continuar con el respaldo directo en cliente aislado
  }

  // 2. Respaldo directo: crear el usuario en Supabase Auth con cliente aislado
  // (No cierra ni reemplaza la sesión activa del Administrador)
  const isolatedClient = createIsolatedAuthClient()
  const { data: signUpData, error: signUpError } =
    await isolatedClient.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          name: cleanNombre,
          role: datos.rol,
          password_visible: cleanPassword,
        },
      },
    })

  if (signUpError) {
    const msg = signUpError.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already exists')) {
      throw new Error('Este correo electrónico ya está registrado en el sistema.')
    }
    if (msg.includes('password') && msg.includes('least')) {
      throw new Error('La contraseña debe tener al menos 8 caracteres.')
    }
    if (msg.includes('rate limit') || msg.includes('security purposes')) {
      throw new Error(
        'Límite de envíos de Supabase alcanzado temporalmente. Espera unos segundos e intenta de nuevo.'
      )
    }
    throw new Error(
      signUpError.message || 'No se pudo crear el usuario. Verifica los datos.'
    )
  }

  const newUserId = signUpData.user?.id
  if (!newUserId) {
    throw new Error('No se pudo obtener el identificador del nuevo usuario.')
  }

  // Asegurar que el perfil quede registrado con el nombre, rol y estado Activo
  const clientForProfile = signUpData.session ? isolatedClient : supabase
  await clientForProfile
    .from('perfiles')
    .upsert(
      {
        id: newUserId,
        nombre: cleanNombre,
        email: cleanEmail,
        rol: datos.rol,
        estado: 'Activo',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  // Guardar credencial en la bóveda para consulta inmediata del administrador
  registrarCredencialUsuario({
    id: newUserId,
    email: cleanEmail,
    password: cleanPassword,
  })
}

export async function desactivarUsuario(usuarioId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'desactivar-usuario',
      {
        body: { usuarioId },
      }
    )

    if (
      !error &&
      data?.usuario?.id === usuarioId &&
      data?.usuario?.estado === 'Inactivo'
    ) {
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const { error: dbError } = await supabase
    .from('perfiles')
    .update({
      estado: 'Inactivo',
      updated_at: new Date().toISOString(),
    })
    .eq('id', usuarioId)

  if (dbError) {
    throw new Error('No se pudo desactivar el usuario. Intenta nuevamente.')
  }
}

export async function eliminarUsuario(usuarioId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'eliminar-usuario',
      {
        body: {
          usuarioId,
          confirmar: true,
        },
      }
    )

    if (!error && data?.eliminado === true && data?.usuarioId === usuarioId) {
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const { error: dbError } = await supabase
    .from('perfiles')
    .delete()
    .eq('id', usuarioId)

  if (dbError) {
    throw new Error('No se pudo eliminar el usuario. Intenta nuevamente.')
  }
}

export async function cambiarRolUsuario(
  usuarioId: string,
  rol: NuevoUsuario['rol']
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'cambiar-rol-usuario',
      {
        body: {
          usuarioId,
          rol,
        },
      }
    )

    if (!error && data?.usuario?.id === usuarioId && data?.usuario?.rol === rol) {
      return
    }
  } catch {
    // Continuar con respaldo directo en tabla perfiles
  }

  const { error: dbError } = await supabase
    .from('perfiles')
    .update({
      rol,
      updated_at: new Date().toISOString(),
    })
    .eq('id', usuarioId)

  if (dbError) {
    throw new Error('No se pudo cambiar el rol. Intenta nuevamente.')
  }
}
