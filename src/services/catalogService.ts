import { supabase } from './supabase'

// ==============================================================================
// 1. TIPOS DE DATOS: BASE DE DATOS CATÁLOGO DE RECTIFICACIÓN
// ==============================================================================

export type FabricanteTipo = 'OEM' | 'Aftermarket' | 'Alterno'

export interface Fabricante {
  id: string
  nombre: string
  pais_origen?: string
  tipo: FabricanteTipo
  created_at?: string
  updated_at?: string
}

export interface Motor {
  id: string
  fabricante_id?: string
  codigo: string
  cilindrada?: string
  configuracion?: string
  anio_inicio?: number
  anio_fin?: number
  fabricante?: Fabricante
  created_at?: string
  updated_at?: string
}

export type RepuestoCategoria =
  | 'Válvulas'
  | 'Guías de Válvula'
  | 'Sellos de Válvula'
  | 'Anillos'
  | 'Casquetería'
  | 'Pistones'
  | 'Camisas'
  | 'Empaques'
  | 'Pernos'

export type RepuestoEstado = 'Disponible' | 'Bajo Stock' | 'Agotado'

export type EquivalenciaTipo = 'Directa' | 'Adaptable con Maquinado' | 'Sobremedida'

export interface Equivalencia {
  id: string
  repuesto_id: string
  marca: string // Dokuro, Rik, NPR, NDC, Ajusa, Taiho, Pioneer, OEM, etc.
  codigo_equivalente: string
  tipo_equivalencia: EquivalenciaTipo
  notas?: string
  created_at?: string
}

export interface Repuesto {
  id: string
  codigo: string
  nombre: string
  categoria: RepuestoCategoria
  fabricante_id?: string
  fabricante_nombre?: string
  precio: number
  stock: number
  estado: RepuestoEstado
  imagen_url?: string
  especificaciones_tecnicas: Record<string, any> // JSONB: dimensiones indexables
  equivalencias?: Equivalencia[]
  motores_compatibles?: string[]
  created_at?: string
  updated_at?: string
}

// Compatibilidad con vistas anteriores
export interface CatalogProduct {
  id: string
  code: string
  name: string
  category: string
  price: number
  stock: number
  status: 'Disponible' | 'Bajo Stock' | 'Agotado'
  imageUrl: string
  especificaciones_tecnicas?: Record<string, any>
  created_at?: string
  updated_at?: string
}

// ==============================================================================
// 2. DATOS SEMILLA / MOCK DE RECTIFICACIÓN (MARCAS ALTERNAS Y DIMENSIONES)
// ==============================================================================

export const MOCK_FABRICANTES: Fabricante[] = [
  { id: 'fab-1', nombre: 'Toyota', tipo: 'OEM', pais_origen: 'Japón' },
  { id: 'fab-2', nombre: 'Nissan', tipo: 'OEM', pais_origen: 'Japón' },
  { id: 'fab-3', nombre: 'Isuzu', tipo: 'OEM', pais_origen: 'Japón' },
  { id: 'fab-4', nombre: 'Dokuro', tipo: 'Aftermarket', pais_origen: 'Japón' },
  { id: 'fab-5', nombre: 'Rik', tipo: 'Aftermarket', pais_origen: 'Japón' },
  { id: 'fab-6', nombre: 'NPR', tipo: 'Aftermarket', pais_origen: 'Japón' },
  { id: 'fab-7', nombre: 'NDC', tipo: 'Aftermarket', pais_origen: 'Japón' },
  { id: 'fab-8', nombre: 'Ajusa', tipo: 'Aftermarket', pais_origen: 'España' },
]

export const MOCK_MOTORES: Motor[] = [
  { id: 'mot-1', fabricante_id: 'fab-1', codigo: '3L', cilindrada: '2.8L', configuracion: 'L4 8V DIESEL' },
  { id: 'mot-2', fabricante_id: 'fab-1', codigo: '1KD-FTV', cilindrada: '3.0L', configuracion: 'L4 16V D4D TURBO DIESEL' },
  { id: 'mot-3', fabricante_id: 'fab-2', codigo: 'TD27', cilindrada: '2.7L', configuracion: 'L4 8V DIESEL' },
  { id: 'mot-4', fabricante_id: 'fab-3', codigo: '4JJ1', cilindrada: '3.0L', configuracion: 'L4 16V TURBO DIESEL' },
]

export const MOCK_REPUESTOS: Repuesto[] = [
  {
    id: 'rep-01',
    codigo: 'OEM-13711-54020',
    nombre: 'Válvula de Admisión Toyota 3L / 5L',
    categoria: 'Válvulas',
    fabricante_id: 'fab-1',
    fabricante_nombre: 'Toyota',
    precio: 145.00,
    stock: 24,
    estado: 'Disponible',
    imagen_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=80',
    especificaciones_tecnicas: {
      diametro_cabeza_mm: 42.5,
      diametro_vastago_mm: 8.0,
      longitud_total_mm: 103.5,
      angulo_asiento_grados: 45,
      material: 'Acero martensítico nitrurado',
      ranuras: 1,
    },
    motores_compatibles: ['3L', '5L', '2L'],
    equivalencias: [
      {
        id: 'eq-01-1',
        repuesto_id: 'rep-01',
        marca: 'Dokuro',
        codigo_equivalente: 'DK-1044',
        tipo_equivalencia: 'Directa',
        notas: 'Válvula Dokuro japonesa estándar para culata Toyota L/2L/3L',
      },
      {
        id: 'eq-01-2',
        repuesto_id: 'rep-01',
        marca: 'Taiho',
        codigo_equivalente: 'TH-VA302',
        tipo_equivalencia: 'Directa',
      },
    ],
  },
  {
    id: 'rep-02',
    codigo: 'OEM-13011-54120',
    nombre: 'Juego de Anillos de Pistón Toyota 3L 96.00mm',
    categoria: 'Anillos',
    fabricante_id: 'fab-1',
    fabricante_nombre: 'Toyota',
    precio: 520.00,
    stock: 8,
    estado: 'Disponible',
    imagen_url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=300&auto=format&fit=crop&q=80',
    especificaciones_tecnicas: {
      diametro_cilindro_mm: 96.00,
      espesor_anillo_fuego_mm: 2.0,
      espesor_anillo_compresion_mm: 1.5,
      espesor_anillo_aceite_mm: 4.0,
      recubrimiento: 'Cromo duro / Fosfatizado',
    },
    motores_compatibles: ['3L'],
    equivalencias: [
      {
        id: 'eq-02-1',
        repuesto_id: 'rep-02',
        marca: 'Rik',
        codigo_equivalente: 'RIK-28006',
        tipo_equivalencia: 'Directa',
        notas: 'Juego Rik Japón grado OEM para 4 cilindros STD',
      },
      {
        id: 'eq-02-2',
        repuesto_id: 'rep-02',
        marca: 'NPR',
        codigo_equivalente: 'SDT10125ZZ',
        tipo_equivalencia: 'Directa',
        notas: 'NPR Nippon Piston Ring Japón',
      },
    ],
  },
  {
    id: 'rep-03',
    codigo: 'OEM-11701-54040',
    nombre: 'Casquetes de Bancada Toyota 3L / 5L (STD)',
    categoria: 'Casquetería',
    fabricante_id: 'fab-1',
    fabricante_nombre: 'Toyota',
    precio: 380.00,
    stock: 14,
    estado: 'Disponible',
    imagen_url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&auto=format&fit=crop&q=80',
    especificaciones_tecnicas: {
      diametro_munon_banco_mm: 62.00,
      diametro_alojamiento_mm: 67.00,
      ancho_cojinete_mm: 23.00,
      espesor_pared_mm: 2.485,
      medida: 'STD',
    },
    motores_compatibles: ['2L', '3L', '5L'],
    equivalencias: [
      {
        id: 'eq-03-1',
        repuesto_id: 'rep-03',
        marca: 'NDC',
        codigo_equivalente: 'MS-1402GP',
        tipo_equivalencia: 'Directa',
        notas: 'NDC Engine Bearings Japón aleación trimetal',
      },
      {
        id: 'eq-03-2',
        repuesto_id: 'rep-03',
        marca: 'Taiho',
        codigo_equivalente: 'M040A',
        tipo_equivalencia: 'Directa',
      },
    ],
  },
  {
    id: 'rep-04',
    codigo: 'OEM-11115-54070',
    nombre: 'Empaque de Culata Multilámina Toyota 3L (Grado 3)',
    categoria: 'Empaques',
    fabricante_id: 'fab-1',
    fabricante_nombre: 'Toyota',
    precio: 680.00,
    stock: 5,
    estado: 'Bajo Stock',
    imagen_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop&q=80',
    especificaciones_tecnicas: {
      espesor_instalado_mm: 1.45,
      diametro_orificio_cilindro_mm: 97.5,
      material: 'MLS (Multiple Layers Steel) acero inoxidable',
      muescas_identificacion: 3,
    },
    motores_compatibles: ['3L'],
    equivalencias: [
      {
        id: 'eq-04-1',
        repuesto_id: 'rep-04',
        marca: 'Ajusa',
        codigo_equivalente: '10087400',
        tipo_equivalencia: 'Directa',
        notas: 'Ajusa España junta de culata de alta compresión turbo',
      },
    ],
  },
  {
    id: 'rep-05',
    codigo: 'OEM-11011-43G00',
    nombre: 'Juego de Anillos Nissan TD27 96.00mm',
    categoria: 'Anillos',
    fabricante_id: 'fab-2',
    fabricante_nombre: 'Nissan',
    precio: 490.00,
    stock: 10,
    estado: 'Disponible',
    imagen_url: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=300&auto=format&fit=crop&q=80',
    especificaciones_tecnicas: {
      diametro_cilindro_mm: 96.00,
      espesor_anillo_fuego_mm: 2.5,
      espesor_anillo_compresion_mm: 2.0,
      espesor_anillo_aceite_mm: 3.0,
      recubrimiento: 'Cromo nitrurado',
    },
    motores_compatibles: ['TD27', 'TD27T', 'QD32'],
    equivalencias: [
      {
        id: 'eq-05-1',
        repuesto_id: 'rep-05',
        marca: 'Rik',
        codigo_equivalente: 'RIK-20885',
        tipo_equivalencia: 'Directa',
      },
      {
        id: 'eq-05-2',
        repuesto_id: 'rep-05',
        marca: 'NPR',
        codigo_equivalente: 'SWN30114ZZ',
        tipo_equivalencia: 'Directa',
      },
    ],
  },
]

// ==============================================================================
// 3. CATALOG SERVICE
// ==============================================================================

export const catalogService = {
  /**
   * Obtiene todos los fabricantes (Toyota, Nissan, Dokuro, Rik, NPR, NDC, Ajusa, etc.)
   */
  async getFabricantes(): Promise<Fabricante[]> {
    try {
      const { data, error } = await supabase
        .from('fabricantes')
        .select('*')
        .order('nombre', { ascending: true })

      if (error || !data || data.length === 0) {
        return [...MOCK_FABRICANTES]
      }
      return data
    } catch {
      return [...MOCK_FABRICANTES]
    }
  },

  /**
   * Obtiene motores automotrices registrados en Supabase
   */
  async getMotores(fabricanteId?: string): Promise<Motor[]> {
    try {
      let query = supabase.from('motores').select('*, fabricante:fabricantes(*)')
      if (fabricanteId) {
        query = query.eq('fabricante_id', fabricanteId)
      }
      const { data, error } = await query.order('codigo', { ascending: true })

      if (error || !data || data.length === 0) {
        if (fabricanteId) {
          return MOCK_MOTORES.filter(m => m.fabricante_id === fabricanteId)
        }
        return [...MOCK_MOTORES]
      }
      return data
    } catch {
      return [...MOCK_MOTORES]
    }
  },

  /**
   * Obtiene repuestos de rectificación con filtros por categoría, búsqueda y motor
   */
  async getRepuestos(filters?: {
    categoria?: string
    search?: string
    motorCodigo?: string
  }): Promise<Repuesto[]> {
    try {
      let query = supabase
        .from('repuestos')
        .select('*, fabricante:fabricantes(nombre), equivalencias(*)')
        .order('codigo', { ascending: true })

      if (filters?.categoria && filters.categoria !== 'Todas') {
        query = query.eq('categoria', filters.categoria)
      }

      if (filters?.search) {
        const s = filters.search.trim()
        query = query.or(`codigo.ilike.%${s}%,nombre.ilike.%${s}%`)
      }

      const { data, error } = await query

      if (error || !data || data.length === 0) {
        return this.filterMockRepuestos(filters)
      }

      return data.map((item: any) => ({
        id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
        categoria: item.categoria,
        fabricante_id: item.fabricante_id,
        fabricante_nombre: item.fabricante?.nombre,
        precio: Number(item.precio),
        stock: item.stock,
        estado: item.estado,
        imagen_url: item.imagen_url,
        especificaciones_tecnicas: item.especificaciones_tecnicas || {},
        equivalencias: item.equivalencias || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
    } catch {
      return this.filterMockRepuestos(filters)
    }
  },

  filterMockRepuestos(filters?: {
    categoria?: string
    search?: string
    motorCodigo?: string
  }): Repuesto[] {
    let result = [...MOCK_REPUESTOS]

    if (filters?.categoria && filters.categoria !== 'Todas') {
      result = result.filter(r => r.categoria === filters.categoria)
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim()
      result = result.filter(
        r =>
          r.codigo.toLowerCase().includes(q) ||
          r.nombre.toLowerCase().includes(q) ||
          r.equivalencias?.some(
            eq => eq.codigo_equivalente.toLowerCase().includes(q) || eq.marca.toLowerCase().includes(q)
          )
      )
    }

    if (filters?.motorCodigo) {
      const mc = filters.motorCodigo.toLowerCase().trim()
      result = result.filter(r =>
        r.motores_compatibles?.some(m => m.toLowerCase().includes(mc))
      )
    }

    return result
  },

  /**
   * Búsqueda por dimensiones en el campo JSONB especificaciones_tecnicas
   * ej. buscar válvulas con diametro_vastago_mm = 8.0 y diametro_cabeza_mm = 42.5
   */
  async searchByDimension(
    categoria: RepuestoCategoria,
    dimensionCriteria: Record<string, any>
  ): Promise<Repuesto[]> {
    try {
      const { data, error } = await supabase
        .from('repuestos')
        .select('*, equivalencias(*)')
        .eq('categoria', categoria)
        .contains('especificaciones_tecnicas', dimensionCriteria)

      if (error || !data || data.length === 0) {
        return MOCK_REPUESTOS.filter(r => {
          if (r.categoria !== categoria) return false
          return Object.entries(dimensionCriteria).every(([k, v]) => {
            return r.especificaciones_tecnicas[k] === v
          })
        })
      }
      return data
    } catch {
      return []
    }
  },

  /**
   * Obtiene la tabla de equivalencias técnicas para un repuesto específico o marca alterna
   */
  async getEquivalencias(repuestoId?: string, marca?: string): Promise<Equivalencia[]> {
    try {
      let query = supabase.from('equivalencias').select('*')
      if (repuestoId) query = query.eq('repuesto_id', repuestoId)
      if (marca) query = query.eq('marca', marca)

      const { data, error } = await query
      if (error || !data || data.length === 0) {
        const allEq = MOCK_REPUESTOS.flatMap(r => r.equivalencias || [])
        return allEq.filter(eq => (!repuestoId || eq.repuesto_id === repuestoId) && (!marca || eq.marca === marca))
      }
      return data
    } catch {
      return []
    }
  },

  /**
   * Compatibilidad hacia atrás para CatalogoView.vue
   */
  async getProducts(): Promise<CatalogProduct[]> {
    const repuestos = await this.getRepuestos()
    return repuestos.map(r => ({
      id: r.id,
      code: r.codigo,
      name: r.nombre,
      category: r.categoria,
      price: r.precio,
      stock: r.stock,
      status: r.estado,
      imageUrl: r.imagen_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=80',
      especificaciones_tecnicas: r.especificaciones_tecnicas,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }))
  },
}
