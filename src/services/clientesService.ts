import { supabase } from './supabase'
import { getActiveTenantContext } from './rutasService'

export type ClientType = 'Cliente' | 'Tallerista'
export type ClientStatus = 'Activo' | 'Inactivo'

export interface Cliente {
  id: string
  codigo: string
  nombre: string
  telefono?: string | null
  direccion?: string | null
  tipo: ClientType
  estado: ClientStatus
  tenantId?: string
  especificaciones_tecnicas?: Record<string, any>
  created_at: string
  updated_at?: string
}

export type ClienteInsert = Omit<Cliente, 'id' | 'codigo' | 'created_at' | 'updated_at'> & {
  id?: string
  codigo?: string
  created_at?: string
  updated_at?: string
}

export type ClienteUpdate = Partial<Omit<Cliente, 'id' | 'created_at' | 'updated_at'>>

export interface ClienteFilters {
  search?: string
  tipo?: string
  estado?: string
}

const LOCAL_STORAGE_KEY = 'swgora_clientes_cache_v1'
const LEGACY_STORAGE_KEY = 'jrblanco_supabase_clientes_cache_v5'
const CLIENT_TENANT_CODE_SEP = '__'

function encodeClientCodeForDb(
  cleanCode: string,
  tenantId?: string | null
): string {
  const clean = (cleanCode || '').trim()
  if (!tenantId) return clean
  return `${tenantId}${CLIENT_TENANT_CODE_SEP}${clean}`
}

function decodeClientRowTenant(item: any): {
  cleanCode: string
  tenantId: string | null
} {
  const rawCode = String(item?.codigo || '')
  if (rawCode.includes(CLIENT_TENANT_CODE_SEP)) {
    const [prefix, ...rest] = rawCode.split(CLIENT_TENANT_CODE_SEP)
    if (prefix && prefix.startsWith('ind-')) {
      return {
        cleanCode: rest.join(CLIENT_TENANT_CODE_SEP),
        tenantId: prefix,
      }
    }
  }
  if (item?.especificaciones_tecnicas?.tenant_id) {
    return {
      cleanCode: rawCode,
      tenantId: String(item.especificaciones_tecnicas.tenant_id),
    }
  }
  if (item?.tenantId) {
    return {
      cleanCode: rawCode,
      tenantId: String(item.tenantId),
    }
  }
  return {
    cleanCode: rawCode,
    tenantId: null,
  }
}

function getClientesStorageKey(): string {
  const tenantId = getActiveTenantContext().tenantId
  return tenantId ? `${LOCAL_STORAGE_KEY}__${tenantId}` : LOCAL_STORAGE_KEY
}

export const initialClientesDemo: Cliente[] = [
  {
    id: 'cli-01',
    codigo: 'CLI-001',
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
    codigo: 'TAL-001',
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
    codigo: 'CLI-002',
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
    codigo: 'TAL-002',
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
    codigo: 'CLI-003',
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

export function generateClientCode(tipo: ClientType, currentList: Cliente[]): string {
  const prefix = tipo === 'Tallerista' ? 'TAL' : 'CLI'
  const regex = new RegExp(`^${prefix}-(\\d+)`, 'i')
  let maxNum = 0
  for (const c of currentList) {
    if (c.codigo) {
      const match = c.codigo.match(regex)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    }
  }
  const nextNum = maxNum + 1
  return `${prefix}-${nextNum.toString().padStart(3, '0')}`
}

function getLocalCache(): Cliente[] {
  const activeTenantId = getActiveTenantContext().tenantId
  try {
    const raw = activeTenantId
      ? localStorage.getItem(getClientesStorageKey())
      : localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      const list = (JSON.parse(raw) as Cliente[]).filter((c) =>
        activeTenantId ? c.tenantId === activeTenantId : !c.tenantId
      )
      let updated = false
      for (let i = 0; i < list.length; i++) {
        if (!list[i].codigo) {
          list[i].codigo = generateClientCode(list[i].tipo || 'Cliente', list.slice(0, i))
          updated = true
        }
      }
      if (updated) {
        setLocalCache(list)
      }
      return list
    }
  } catch (e) {
    console.error('Error leyendo caché de clientes:', e)
  }
  if (activeTenantId) {
    setLocalCache([])
    return []
  }
  setLocalCache(initialClientesDemo)
  return [...initialClientesDemo]
}

function setLocalCache(list: Cliente[]) {
  try {
    localStorage.setItem(getClientesStorageKey(), JSON.stringify(list))
  } catch (e) {
    console.error('Error guardando caché de clientes:', e)
  }
}

export const clientesService = {
  /**
   * Genera el próximo código sugerido según el tipo (CLI-### o TAL-###)
   */
  getNextClientCode(tipo: ClientType): string {
    const current = getLocalCache()
    return generateClientCode(tipo, current)
  },

  /**
   * Obtiene todos los clientes aplicando filtros opcionales (búsqueda, tipo, estado).
   */
  async getClientesFromSupabase(searchQuery?: string): Promise<Cliente[]> {
    const activeTenantId = getActiveTenantContext().tenantId
    try {
      const query = supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true })

      const { data, error } = await query

      if (error) {
        console.error('[ClientesService] Error consultando clientes desde Supabase:', error)
        return []
      }

      const tenantRows = (data || []).filter((item: any) => {
        const decoded = decodeClientRowTenant(item)
        return (decoded.tenantId || null) === activeTenantId
      })

      const mapped: Cliente[] = tenantRows.map((item: any, idx: number) => {
        const decoded = decodeClientRowTenant(item)
        const tipo = (item.tipo === 'Tallerista' ? 'Tallerista' : 'Cliente') as ClientType
        return {
          id: item.id,
          codigo: decoded.cleanCode || generateClientCode(tipo, tenantRows.slice(0, idx)),
          nombre: item.nombre || '',
          telefono: item.telefono || '',
          direccion: item.direccion || '',
          tipo,
          estado: (item.estado === 'Inactivo' ? 'Inactivo' : 'Activo') as ClientStatus,
          tenantId: decoded.tenantId || undefined,
          especificaciones_tecnicas: {
            ...(item.especificaciones_tecnicas || {}),
            ...(item.taller && !item.especificaciones_tecnicas?.taller ? { taller: item.taller } : {})
          },
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        }
      })

      if (searchQuery && searchQuery.trim()) {
        const s = searchQuery.toLowerCase().trim()
        return mapped.filter((c) => {
          const taller = (c.especificaciones_tecnicas?.taller || '').toLowerCase()
          const empresa = (c.especificaciones_tecnicas?.empresa || '').toLowerCase()
          return (
            c.nombre.toLowerCase().includes(s) ||
            (c.codigo && c.codigo.toLowerCase().includes(s)) ||
            taller.includes(s) ||
            empresa.includes(s)
          )
        })
      }

      return mapped
    } catch (err) {
      console.error('[ClientesService] Error inesperado consultando Supabase:', err)
      return []
    }
  },

  /**
   * Obtiene todos los clientes aplicando filtros opcionales (búsqueda, tipo, estado).
   */
  async getClientes(filters?: ClienteFilters): Promise<Cliente[]> {
    const activeTenantId = getActiveTenantContext().tenantId
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

      if (data) {
        const tenantRows = data.filter((item: any) => {
          const decoded = decodeClientRowTenant(item)
          return (decoded.tenantId || null) === activeTenantId
        })

        const normalized: Cliente[] = tenantRows.map((item: any, idx: number) => {
          const decoded = decodeClientRowTenant(item)
          const tipo = (item.tipo === 'Tallerista' ? 'Tallerista' : 'Cliente') as ClientType
          return {
            id: item.id,
            codigo: decoded.cleanCode || generateClientCode(tipo, tenantRows.slice(0, idx)),
            nombre: item.nombre || '',
            telefono: item.telefono || '',
            direccion: item.direccion || '',
            tipo,
            estado: (item.estado === 'Inactivo' ? 'Inactivo' : 'Activo') as ClientStatus,
            tenantId: decoded.tenantId || undefined,
            especificaciones_tecnicas: {
              ...(item.especificaciones_tecnicas || {}),
              ...(item.taller && !item.especificaciones_tecnicas?.taller ? { taller: item.taller } : {})
            },
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
          }
        })
        if (normalized.length > 0 || activeTenantId) {
          setLocalCache(normalized)
        }

        if (filters?.search && filters.search.trim()) {
          const s = filters.search.toLowerCase().trim()
          return normalized.filter((c: Cliente) => {
            const taller = (c.especificaciones_tecnicas?.taller || '').toLowerCase()
            const empresa = (c.especificaciones_tecnicas?.empresa || '').toLowerCase()
            return (
              (c.codigo && c.codigo.toLowerCase().includes(s)) ||
              c.nombre.toLowerCase().includes(s) ||
              ((c as any).cedula && (c as any).cedula.toLowerCase().includes(s)) ||
              (c.telefono && c.telefono.includes(s)) ||
              (c.direccion && c.direccion.toLowerCase().includes(s)) ||
              taller.includes(s) ||
              empresa.includes(s)
            )
          })
        }

        if (normalized.length > 0 || activeTenantId) {
          return normalized
        }
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
      cached = cached.filter(c => {
        const taller = (c.especificaciones_tecnicas?.taller || '').toLowerCase()
        const empresa = (c.especificaciones_tecnicas?.empresa || '').toLowerCase()
        return (
          (c.codigo && c.codigo.toLowerCase().includes(s)) ||
          c.nombre.toLowerCase().includes(s) ||
          ((c as any).cedula && (c as any).cedula.toLowerCase().includes(s)) ||
          (c.telefono && c.telefono.includes(s)) ||
          (c.direccion && c.direccion.toLowerCase().includes(s)) ||
          taller.includes(s) ||
          empresa.includes(s)
        )
      })
    }

    return cached
  },

  /**
   * Obtiene un cliente por su ID o por su código único
   */
  async getClienteById(idOrCodigo: string): Promise<Cliente | null> {
    const activeTenantId = getActiveTenantContext().tenantId
    try {
      const dbCodigo = encodeClientCodeForDb(idOrCodigo, activeTenantId)
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .or(`id.eq.${idOrCodigo},codigo.eq.${dbCodigo}`)
        .maybeSingle()

      if (!error && data) {
        const decoded = decodeClientRowTenant(data)
        if ((decoded.tenantId || null) === activeTenantId) {
          return {
            ...(data as Cliente),
            codigo: decoded.cleanCode || data.codigo,
            tenantId: decoded.tenantId || undefined,
          }
        }
      }
    } catch (err) {
      console.warn('[ClientesService] Error al obtener por ID en Supabase:', err)
    }

    const local = getLocalCache().find(c => c.id === idOrCodigo || c.codigo === idOrCodigo)
    return local || null
  },

  /**
   * Crea un nuevo cliente con estado 'Activo' por defecto y código generado automáticamente
   */
  async createCliente(cliente: ClienteInsert): Promise<Cliente> {
    const activeTenantId = getActiveTenantContext().tenantId
    const cache = getLocalCache()
    const autoCode = cliente.codigo || generateClientCode(cliente.tipo || 'Cliente', cache)
    const specsWithTenant = {
      ...(cliente.especificaciones_tecnicas || {}),
      ...(activeTenantId ? { tenant_id: activeTenantId } : {}),
    }

    const newRecord: Cliente = {
      id: cliente.id || 'cli-' + Date.now(),
      codigo: autoCode,
      nombre: cliente.nombre.trim(),
      telefono: cliente.telefono ? cliente.telefono.trim() : null,
      direccion: cliente.direccion ? cliente.direccion.trim() : null,
      tipo: cliente.tipo || 'Cliente',
      estado: 'Activo', // Al crear cliente siempre es Activo
      tenantId: activeTenantId || undefined,
      especificaciones_tecnicas: specsWithTenant,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{
          codigo: encodeClientCodeForDb(newRecord.codigo, activeTenantId),
          nombre: newRecord.nombre,
          telefono: newRecord.telefono,
          direccion: newRecord.direccion,
          taller: newRecord.especificaciones_tecnicas?.taller || null,
          tipo: newRecord.tipo,
          estado: newRecord.estado,
          especificaciones_tecnicas: newRecord.especificaciones_tecnicas
        }])
        .select()
        .single()

      if (!error && data) {
        newRecord.id = data.id
        const decoded = decodeClientRowTenant(data)
        if (decoded.cleanCode) newRecord.codigo = decoded.cleanCode
      }
    } catch (err) {
      console.warn('[ClientesService] Inserción guardada en caché local:', err)
    }

    cache.unshift(newRecord)
    setLocalCache(cache)

    return newRecord
  },

  /**
   * Actualiza los datos de un cliente existente
   */
  async updateCliente(id: string, updates: ClienteUpdate): Promise<Cliente> {
    const activeTenantId = getActiveTenantContext().tenantId
    const updatedPayload: any = {
      ...updates,
      updated_at: new Date().toISOString()
    }
    delete updatedPayload.tenantId

    if (updates.especificaciones_tecnicas) {
      updatedPayload.especificaciones_tecnicas = {
        ...updates.especificaciones_tecnicas,
        ...(activeTenantId ? { tenant_id: activeTenantId } : {}),
      }
      if (updates.especificaciones_tecnicas.taller !== undefined) {
        updatedPayload.taller = updates.especificaciones_tecnicas.taller
      }
    }
    if (updates.codigo !== undefined && activeTenantId) {
      updatedPayload.codigo = encodeClientCodeForDb(updates.codigo, activeTenantId)
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .update(updatedPayload)
        .eq('id', id)
        .select()
        .single()

      if (!error && data) {
        const decoded = decodeClientRowTenant(data)
        const normalizedUpdated: Cliente = {
          ...(data as Cliente),
          codigo: decoded.cleanCode || data.codigo,
          tenantId: decoded.tenantId || activeTenantId || undefined,
        }
        const cache = getLocalCache().map(c => (c.id === id ? { ...c, ...normalizedUpdated } : c))
        setLocalCache(cache)
        return normalizedUpdated
      }
    } catch (err) {
      console.warn('[ClientesService] Error actualizando en Supabase:', err)
    }

    const cache = getLocalCache()
    const index = cache.findIndex(c => c.id === id)
    if (index === -1) {
      throw new Error('Cliente no encontrado')
    }

    cache[index] = {
      ...cache[index],
      ...updates,
      updated_at: updatedPayload.updated_at,
    }
    setLocalCache(cache)

    return cache[index]
  },

  /**
   * Borrado Lógico: Inactiva al cliente para no romper integridad relacional
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
   * Restaura los clientes demo iniciales
   */
  resetDemo(): Cliente[] {
    if (getActiveTenantContext().tenantId) {
      setLocalCache([])
      return []
    }
    setLocalCache(initialClientesDemo)
    return [...initialClientesDemo]
  }
}
