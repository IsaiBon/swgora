import { supabase } from './supabase'

export type ClientType = 'Cliente' | 'Tallerista'
export type ClientStatus = 'Activo' | 'Inactivo'

export interface Cliente {
  id: string
  nombre: string
  telefono?: string | null
  direccion?: string | null
  tipo: ClientType
  estado: ClientStatus
  especificaciones_tecnicas?: Record<string, any>
  created_at: string
  updated_at?: string
}

export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type ClienteUpdate = Partial<Omit<Cliente, 'id' | 'created_at' | 'updated_at'>>

export interface ClienteFilters {
  search?: string
  tipo?: string
  estado?: string
}

const LOCAL_STORAGE_KEY = 'jrblanco_supabase_clientes_cache_v4'

const initialClientesDemo: Cliente[] = [
  {
    id: 'cli-01',
    nombre: 'Ing. Carlos Mendoza',
    telefono: '+52 55 4920 1840',
    direccion: 'Av. de las Industrias 1420, Bodega 4, Monterrey',
    tipo: 'Cliente',
    estado: 'Activo',
    especificaciones_tecnicas: {
      empresa: 'Transportes Logísticos del Norte',
      flotilla: '12 Tractocamiones Kenworth T680',
      notas: 'Mantenimiento Preventivo de Válvulas y Turbos'
    },
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cli-02',
    nombre: 'Maestro Jorge Ramos',
    telefono: '+52 81 8345 9912',
    direccion: 'Calzada Madero 2185 Poniente, Monterrey',
    tipo: 'Tallerista',
    estado: 'Activo',
    especificaciones_tecnicas: {
      taller: 'Taller Mecánico Especializado Ramos',
      servicios: 'Rectificación de Cabezas y Monoblocks para Motores Diesel'
    },
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cli-03',
    nombre: 'Lic. Mariana Garza',
    telefono: '+52 81 1234 5678',
    direccion: 'Parque Industrial Milenium, Nave 8, Apodaca',
    tipo: 'Cliente',
    estado: 'Activo',
    especificaciones_tecnicas: {
      empresa: 'Operadora Industrial Regio',
      servicios: 'Sistemas de Bombeo y Compresores de Alta Presión'
    },
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cli-04',
    nombre: 'Ing. Roberto Silva',
    telefono: '+52 55 7712 3490',
    direccion: 'Km 14.5 Carretera Nacional, Santiago',
    tipo: 'Tallerista',
    estado: 'Activo',
    especificaciones_tecnicas: {
      taller: 'Copa Centro Maquinaria',
      servicios: '6 Maquinarias Pesadas Caterpillar (Retroexcavadoras)'
    },
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cli-05',
    nombre: 'Sr. Alejandro Treviño',
    telefono: '+52 81 9988 7766',
    direccion: 'Av. Eugenio Garza Sada 3450, Monterrey',
    tipo: 'Cliente',
    estado: 'Inactivo',
    especificaciones_tecnicas: {
      notas: 'Pick-Up Ford F-250 (Inactivo por venta de unidad)'
    },
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date().toISOString(),
  },
]

function getLocalCache(): Cliente[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Error leyendo caché de clientes:', e)
  }
  setLocalCache(initialClientesDemo)
  return [...initialClientesDemo]
}

function setLocalCache(list: Cliente[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error guardando caché de clientes:', e)
  }
}

export const clientesService = {
  /**
   * Obtiene todos los clientes aplicando filtros opcionales (búsqueda, tipo, estado).
   */
  async getClientes(filters?: ClienteFilters): Promise<Cliente[]> {
    try {
      let query = supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.tipo && filters.tipo !== 'Todos') {
        query = query.eq('tipo', filters.tipo)
      }

      if (filters?.estado && filters.estado !== 'Todos') {
        query = query.eq('estado', filters.estado)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      if (data && data.length > 0) {
        const normalized: Cliente[] = data.map((item: any) => ({
          id: item.id,
          nombre: item.nombre || '',
          telefono: item.telefono || '',
          direccion: item.direccion || '',
          tipo: (item.tipo === 'Tallerista' ? 'Tallerista' : 'Cliente') as ClientType,
          estado: (item.estado === 'Inactivo' ? 'Inactivo' : 'Activo') as ClientStatus,
          especificaciones_tecnicas: item.especificaciones_tecnicas || {},
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        }))
        setLocalCache(normalized)

        if (filters?.search && filters.search.trim()) {
          const s = filters.search.toLowerCase().trim()
          return normalized.filter((c: Cliente) =>
            c.nombre.toLowerCase().includes(s) ||
            (c.telefono && c.telefono.includes(s)) ||
            (c.direccion && c.direccion.toLowerCase().includes(s))
          )
        }

        return normalized
      }
    } catch (err) {
      console.warn('[ClientesService] Fallback a caché local:', err)
    }

    // Fallback a almacenamiento local si Supabase está offline o no configurado
    let cached = getLocalCache()

    if (filters?.tipo && filters.tipo !== 'Todos') {
      cached = cached.filter(c => c.tipo === filters.tipo)
    }

    if (filters?.estado && filters.estado !== 'Todos') {
      cached = cached.filter(c => c.estado === filters.estado)
    }

    if (filters?.search && filters.search.trim()) {
      const s = filters.search.toLowerCase().trim()
      cached = cached.filter(c =>
        c.nombre.toLowerCase().includes(s) ||
        (c.telefono && c.telefono.includes(s)) ||
        (c.direccion && c.direccion.toLowerCase().includes(s))
      )
    }

    return cached
  },

  /**
   * Obtiene un cliente por su ID
   */
  async getClienteById(id: string): Promise<Cliente | null> {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) {
        return data as Cliente
      }
    } catch (err) {
      console.warn('[ClientesService] Error al obtener por ID en Supabase:', err)
    }

    const local = getLocalCache().find(c => c.id === id)
    return local || null
  },

  /**
   * Crea un nuevo cliente con estado 'Activo' por defecto
   */
  async createCliente(cliente: ClienteInsert): Promise<Cliente> {
    const newRecord: Cliente = {
      id: cliente.id || 'cli-' + Date.now(),
      nombre: cliente.nombre.trim(),
      telefono: cliente.telefono ? cliente.telefono.trim() : null,
      direccion: cliente.direccion ? cliente.direccion.trim() : null,
      tipo: cliente.tipo || 'Cliente',
      estado: cliente.estado || 'Activo',
      especificaciones_tecnicas: cliente.especificaciones_tecnicas || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{
          nombre: newRecord.nombre,
          telefono: newRecord.telefono,
          direccion: newRecord.direccion,
          tipo: newRecord.tipo,
          estado: newRecord.estado,
          especificaciones_tecnicas: newRecord.especificaciones_tecnicas
        }])
        .select()
        .single()

      if (!error && data) {
        newRecord.id = data.id
      }
    } catch (err) {
      console.warn('[ClientesService] Inserción guardada en caché local:', err)
    }

    const cache = getLocalCache()
    cache.unshift(newRecord)
    setLocalCache(cache)

    return newRecord
  },

  /**
   * Actualiza los datos de un cliente existente
   */
  async updateCliente(id: string, updates: ClienteUpdate): Promise<Cliente> {
    const updatedPayload = {
      ...updates,
      updated_at: new Date().toISOString()
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .update(updatedPayload)
        .eq('id', id)
        .select()
        .single()

      if (!error && data) {
        const cache = getLocalCache().map(c => c.id === id ? { ...c, ...data } : c)
        setLocalCache(cache)
        return data as Cliente
      }
    } catch (err) {
      console.warn('[ClientesService] Actualización aplicada en caché local:', err)
    }

    const cache = getLocalCache()
    const idx = cache.findIndex(c => c.id === id)
    if (idx !== -1) {
      cache[idx] = { ...cache[idx], ...updates, updated_at: new Date().toISOString() }
      setLocalCache(cache)
      return cache[idx]
    }

    throw new Error('Cliente no encontrado para actualizar')
  },

  /**
   * Borrado lógico: inactiva al cliente para preservar el historial de órdenes
   */
  async deactivateCliente(id: string): Promise<Cliente> {
    return this.updateCliente(id, { estado: 'Inactivo' })
  },

  /**
   * Reactiva a un cliente previamente inactivado
   */
  async reactivateCliente(id: string): Promise<Cliente> {
    return this.updateCliente(id, { estado: 'Activo' })
  },

  /**
   * Eliminación física (solo si se requiere purgar)
   */
  async deleteCliente(id: string): Promise<void> {
    try {
      await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
    } catch (err) {
      console.warn('[ClientesService] Eliminación local:', err)
    }

    const cache = getLocalCache().filter(c => c.id !== id)
    setLocalCache(cache)
  },

  /**
   * Restablece los clientes de demostración
   */
  resetDemo(): Cliente[] {
    setLocalCache(initialClientesDemo)
    return [...initialClientesDemo]
  }
}
