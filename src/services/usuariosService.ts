import { supabase } from './supabase'

export interface NuevoUsuario {
  nombre: string
  email: string
  password: string
  rol: 'admin' | 'consultor' | 'operador'
}

export async function crearUsuario(datos: NuevoUsuario): Promise<void> {
  const { data, error } = await supabase.functions.invoke('crear-usuario', {
    body: {
      nombre: datos.nombre.trim(),
      email: datos.email.trim(),
      password: datos.password,
      rol: datos.rol,
    },
  })

  if (error) {
    let mensaje = 'No se pudo crear el usuario. Intenta nuevamente.'

    if (error.context instanceof Response) {
      const respuesta = await error.context.json().catch(() => null)

      if (typeof respuesta?.error === 'string') {
        mensaje = respuesta.error
      }
    }

    throw new Error(mensaje)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (!data?.usuario?.id) {
    throw new Error(
      'No se pudo confirmar la creación. Revisa Supabase antes de reintentar.'
    )
  }
}
export async function desactivarUsuario(usuarioId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    'desactivar-usuario',
    {
      body: { usuarioId },
    }
  )

  if (error) {
    let mensaje = 'No se pudo desactivar el usuario. Intenta nuevamente.'

    if (error.context instanceof Response) {
      const respuesta = await error.context.json().catch(() => null)

      if (typeof respuesta?.error === 'string') {
        mensaje = respuesta.error
      }
    }

    throw new Error(mensaje)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (
    data?.usuario?.id !== usuarioId ||
    data?.usuario?.estado !== 'Inactivo'
  ) {
    throw new Error(
      'No se pudo confirmar la desactivación. Actualiza la lista para comprobar el estado.'
    )
  }
}

export async function eliminarUsuario(usuarioId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    'eliminar-usuario',
    {
      body: {
        usuarioId,
        confirmar: true,
      },
    }
  )

  if (error) {
    let mensaje = 'No se pudo eliminar el usuario. Intenta nuevamente.'

    if (error.context instanceof Response) {
      const respuesta = await error.context.json().catch(() => null)

      if (typeof respuesta?.error === 'string') {
        mensaje = respuesta.error
      }
    }

    throw new Error(mensaje)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (data?.eliminado !== true || data?.usuarioId !== usuarioId) {
    throw new Error(
      'No se pudo confirmar la eliminación. Actualiza la lista para comprobarlo.'
    )
  }
}
export async function cambiarRolUsuario(
  usuarioId: string,
  rol: NuevoUsuario['rol']
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    'cambiar-rol-usuario',
    {
      body: {
        usuarioId,
        rol,
      },
    }
  )

  if (error) {
    let mensaje = 'No se pudo cambiar el rol. Intenta nuevamente.'

    if (error.context instanceof Response) {
      const respuesta = await error.context.json().catch(() => null)

      if (typeof respuesta?.error === 'string') {
        mensaje = respuesta.error
      }
    }

    throw new Error(mensaje)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (
    data?.usuario?.id !== usuarioId ||
    data?.usuario?.rol !== rol
  ) {
    throw new Error(
      'No se pudo confirmar el cambio de rol. Actualiza la lista para comprobarlo.'
    )
  }
}