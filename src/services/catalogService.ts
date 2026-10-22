import { supabase } from './supabase'

export type FabricanteTipo = 'OEM' | 'Aftermarket' | 'Alterno'
export type RepuestoCategoria = 'Válvulas' | 'Anillos' | 'Casquetería' | 'Sellos' | 'Empaques' | 'Pernos' | string
export type RepuestoEstado = 'Disponible' | 'Bajo Stock' | 'Agotado'
export type EquivalenciaTipo = 'Cruce Directo' | 'Directa' | 'Adaptable con Maquinado' | 'Sobremedida' | string

export interface Fabricante {
  id: string
  nombre: string
  pais_origen?: string
  logo_url?: string
  tipo?: FabricanteTipo
  activo: boolean
  orden_visual?: number
  engines_count?: number
}

export interface Modelo {
  id: string
  fabricante_id: string
  nombre: string
  anio_inicio?: number
  anio_fin?: number
  activo?: boolean
}

export interface Motor {
  id: string
  fabricante_id: string
  modelo_id?: string
  numero_id?: number | string
  codigo: string
  nombre_comercial?: string
  denominacion_venta?: string
  cilindrada_cc?: number
  cilindrada_texto?: string
  kw?: number
  cv?: number
  combustible: string
  cilindros: number
  valvulas: number
  diametro_cilindro_std_mm?: number
  carrera_piston_mm?: number
  configuracion?: string
  aspiracion?: string
  anios?: string
  especificaciones_tecnicas?: Record<string, unknown>
  fabricante?: Fabricante
  modelo?: Modelo
}

export interface Equivalencia {
  id: string
  repuesto_id: string
  marca_alterna: 'Dokuro' | 'Rik' | 'NPR' | 'NDC' | 'Ajusa' | 'Pioneer' | 'Taiho' | 'Toto' | 'TIK' | string
  codigo_alterno: string
  tipo_referencia?: string
  notas?: string
  especificaciones_tecnicas?: Record<string, unknown>
}

export type ParametroTipoDato = 'numero' | 'texto' | 'booleano' | 'seleccion'

export interface ParametroTecnicoDefinicion {
  id: string
  clave: string
  etiqueta: string
  unidad: string
  tipo_dato: ParametroTipoDato
  requerido: boolean
  descripcion?: string
  opciones?: string[]
  valor_minimo?: number
  valor_maximo?: number
}

export interface GrupoRepuesto {
  id: string
  codigo: string
  nombre: string
  categoria: string
  subsistema: string
  descripcion?: string
  icono?: string
  parametros: ParametroTecnicoDefinicion[]
  activo: boolean
  orden_visual?: number
  created_at?: string
  updated_at?: string
}

export interface GrupoRepuestoInsert {
  codigo?: string
  nombre: string
  categoria: string
  subsistema?: string
  descripcion?: string
  icono?: string
  parametros: ParametroTecnicoDefinicion[]
  activo?: boolean
  orden_visual?: number
}

export interface RepuestoTecnico {
  id: string
  motor_id?: string
  codigo_oem: string
  nombre: string
  subsistema: 'Culata' | 'Cigüeñal' | 'Block' | 'Bielas' | 'Sellos y Juntas' | string
  categoria: 'Válvulas' | 'Anillos' | 'Casquetería' | 'Sellos' | 'Empaques' | 'Pernos' | string
  precio: number
  stock: number
  estado: 'Disponible' | 'Bajo Stock' | 'Agotado'
  imagen_url?: string
  catalogo_origen?: 'Dokuro' | 'Rik' | 'NPR' | 'NDC' | 'Ajusa' | 'Pioneer' | 'OEM' | string

  // Dimensiones físicas - Válvulas
  diametro_cabeza_mm?: number | null
  diametro_vastago_mm?: number | null
  longitud_total_mm?: number | null
  angulo_asiento_grados?: number | null
  tipo_valvula?: 'Admisión' | 'Escape' | string | null

  // Dimensiones físicas - Sellos / Ajuste de Válvula
  diametro_interior_mm?: number | null
  diametro_exterior_mm?: number | null
  altura_mm?: number | null

  // Dimensiones físicas - Anillos
  diametro_cilindro_mm?: number | null
  espesor_anillo1_mm?: number | null
  espesor_anillo2_mm?: number | null
  espesor_aceite_mm?: number | null

  // Dimensiones físicas - Cojinetes / Casquetes NDC
  tipo_cojinete?: 'MS' | 'CB' | 'TW' | 'SH' | 'PB' | string | null
  diametro_munon_mm?: number | null
  diametro_alojamiento_mm?: number | null
  ancho_casquete_mm?: number | null

  // Dimensiones físicas - Pernos / Tornillos de Culata
  medida_rosca?: 'M10' | 'M11' | 'M12' | string | null
  paso_rosca_mm?: number | null
  longitud_perno_mm?: number | null
  cantidad_piezas?: number | null
  paso_rosca1_mm?: number | null
  longitud1_mm?: number | null
  longitud2_mm?: number | null

  dimensiones?: Record<string, unknown>
  especificaciones_tecnicas?: Record<string, unknown>

  equivalencias?: Equivalencia[]
  motor?: Motor
}

export type Repuesto = RepuestoTecnico

export interface DimensionalFilter {
  categoria: 'Válvulas' | 'Anillos' | 'Casquetería' | 'Sellos' | 'Pernos' | 'Todas'
  tolerancia_mm?: number

  // Válvulas
  diametro_cabeza?: number
  diametro_vastago?: number
  longitud_total?: number
  tipo_valvula?: string

  // Sellos
  diametro_interior?: number
  diametro_exterior?: number
  altura?: number

  // Anillos
  diametro_cilindro?: number
  espesor_anillo1?: number
  espesor_anillo2?: number
  espesor_aceite?: number

  // Cojinetes / Casquetes NDC
  tipo_cojinete?: 'MS' | 'CB' | 'TW' | 'SH' | 'PB' | ''
  diametro_munon?: number
  ancho_casquete?: number

  // Pernos de Culata
  medida_rosca?: string
  paso_rosca?: number
  longitud_perno?: number
  cantidad_piezas?: number
  paso_rosca1?: number
  longitud1?: number
  longitud2?: number
}

// Compatibilidad retroactiva para WorkOrderForm.vue
export interface CatalogProduct {
  id: string
  code: string
  name: string
  category: string
  price: number
  stock: number
  status: 'Disponible' | 'Bajo Stock' | 'Agotado'
  imageUrl: string
  especificaciones_tecnicas?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

// =============================================================================
// DATOS MOCK REALISTAS DEL TALLER JR BLANCO (DOKURO, RIK, NPR, NDC, AJUSA, PIONEER)
// =============================================================================

export const LOCAL_GROUPS_STORAGE_KEY = 'swgora_grupos_repuestos_v1'
export const LOCAL_PARTS_STORAGE_KEY = 'swgora_custom_repuestos_v1'

export const mockGruposRepuestos: GrupoRepuesto[] = [
  {
    id: 'grp-1',
    codigo: 'ajuste_valvula',
    nombre: 'Ajuste de válvula',
    categoria: 'Sellos',
    subsistema: 'Sellos y Juntas',
    descripcion: 'Sellos y retenes de guía de válvula (Vitón / Alta temperatura)',
    icono: 'CircleDot',
    activo: true,
    orden_visual: 1,
    parametros: [
      { id: 'p_sello_1', clave: 'diametro_interior_mm', etiqueta: 'Diámetro Interior', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Medida interna del retén' },
      { id: 'p_sello_2', clave: 'diametro_exterior_mm', etiqueta: 'Diámetro Exterior', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Diámetro de alojamiento en la guía' },
      { id: 'p_sello_3', clave: 'altura_mm', etiqueta: 'Altura Total', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Altura de la falda del sello' }
    ]
  },
  {
    id: 'grp-2',
    codigo: 'valvula',
    nombre: 'Válvula de motor',
    categoria: 'Válvulas',
    subsistema: 'Culata',
    descripcion: 'Válvulas de admisión y escape estándar y sobremedida',
    icono: 'Wrench',
    activo: true,
    orden_visual: 2,
    parametros: [
      { id: 'p_valv_1', clave: 'diametro_cabeza_mm', etiqueta: 'Diámetro de Cabeza (Hongo)', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Diámetro mayor del plato o hongo' },
      { id: 'p_valv_2', clave: 'diametro_vastago_mm', etiqueta: 'Diámetro de Vástago', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Grosor del vástago' },
      { id: 'p_valv_3', clave: 'longitud_total_mm', etiqueta: 'Longitud Total', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Largo de punta a cabeza' },
      { id: 'p_valv_4', clave: 'angulo_asiento_grados', etiqueta: 'Ángulo de Asiento', unidad: '°', tipo_dato: 'numero', requerido: false, descripcion: 'Ángulo de rectificación (ej. 45°)' },
      { id: 'p_valv_5', clave: 'tipo_valvula', etiqueta: 'Tipo de Válvula', unidad: '', tipo_dato: 'seleccion', requerido: true, opciones: ['Admisión', 'Escape'], descripcion: 'Función en la culata' }
    ]
  },
  {
    id: 'grp-3',
    codigo: 'anillos_motor',
    nombre: 'Anillos de motor',
    categoria: 'Anillos',
    subsistema: 'Block',
    descripcion: 'Juegos de aros de pistón (Desglose explícito 1°, 2° y aceite)',
    icono: 'Layers',
    activo: true,
    orden_visual: 3,
    parametros: [
      { id: 'p_anil_1', clave: 'diametro_cilindro_mm', etiqueta: 'Diámetro de Cilindro', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Calibre del orificio del cilindro' },
      { id: 'p_anil_2', clave: 'espesor_anillo1_mm', etiqueta: 'Espesor 1° Anillo (Compresión)', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Grosor del aro superior' },
      { id: 'p_anil_3', clave: 'espesor_anillo2_mm', etiqueta: 'Espesor 2° Anillo (Raspador)', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Grosor del segundo aro' },
      { id: 'p_anil_4', clave: 'espesor_aceite_mm', etiqueta: 'Espesor Anillo de Aceite', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Grosor del aro rascador de aceite' }
    ]
  },
  {
    id: 'grp-4',
    codigo: 'tornillos_culata',
    nombre: 'Juego de tornillos de culata',
    categoria: 'Pernos',
    subsistema: 'Culata',
    descripcion: 'Tornillos y pernos de apriete para culata de cilindros',
    icono: 'FileText',
    activo: true,
    orden_visual: 4,
    parametros: [
      { id: 'p_pern_1', clave: 'medida_rosca', etiqueta: 'Medida de Rosca', unidad: '', tipo_dato: 'texto', requerido: true, descripcion: 'Métrica de rosca (ej. M10, M11, M12)' },
      { id: 'p_pern_2', clave: 'paso_rosca_mm', etiqueta: 'Paso de Rosca', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Paso entre crestas (ej. 1.25, 1.50)' },
      { id: 'p_pern_3', clave: 'longitud_perno_mm', etiqueta: 'Longitud del Perno', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Largo del espárrago bajo cabeza' },
      { id: 'p_pern_4', clave: 'cantidad_piezas', etiqueta: 'Cantidad de Piezas', unidad: 'piezas', tipo_dato: 'numero', requerido: true, descripcion: 'Tornillos por juego' }
    ]
  },
  {
    id: 'grp-5',
    codigo: 'casqueteria',
    nombre: 'Casquetería y Cojinetes',
    categoria: 'Casquetería',
    subsistema: 'Cigüeñal',
    descripcion: 'Cojinetes de biela, bancada y arandelas axiales',
    icono: 'CircleDot',
    activo: true,
    orden_visual: 5,
    parametros: [
      { id: 'p_casq_1', clave: 'diametro_munon_mm', etiqueta: 'Diámetro de Muñón', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Diámetro del muñón de biela o bancada' },
      { id: 'p_casq_2', clave: 'ancho_casquete_mm', etiqueta: 'Ancho de Casquete', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Ancho o longitud del cojinete' }
    ]
  },
  {
    id: 'grp-6',
    codigo: 'empaques_juntas',
    nombre: 'Empaques y Juntas',
    categoria: 'Empaques',
    subsistema: 'Culata',
    descripcion: 'Juntas de culata de grafito y multilámina MLS',
    icono: 'Layers',
    activo: true,
    orden_visual: 6,
    parametros: [
      { id: 'p_emp_1', clave: 'diametro_cilindro_mm', etiqueta: 'Diámetro de Cilindro', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Diámetro del barreno del cilindro' },
      { id: 'p_emp_2', clave: 'espesor_mm', etiqueta: 'Espesor de Junta', unidad: 'mm', tipo_dato: 'numero', requerido: false, descripcion: 'Grosor nominal comprimido' }
    ]
  }
]

function getLocalDynamicGrupos(): GrupoRepuesto[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_GROUPS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalDynamicGrupo(grupo: GrupoRepuesto): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalDynamicGrupos()
    const idx = list.findIndex(g => g.codigo === grupo.codigo || g.id === grupo.id)
    if (idx >= 0) {
      list[idx] = grupo
    } else {
      list.push(grupo)
    }
    localStorage.setItem(LOCAL_GROUPS_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error guardando grupo en localStorage:', e)
  }
}

function getLocalCustomRepuestos(): RepuestoTecnico[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_PARTS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalCustomRepuesto(part: RepuestoTecnico): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalCustomRepuestos()
    const idx = list.findIndex(p => p.id === part.id || p.codigo_oem === part.codigo_oem)
    if (idx >= 0) {
      list[idx] = part
    } else {
      list.unshift(part)
    }
    localStorage.setItem(LOCAL_PARTS_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error guardando repuesto en localStorage:', e)
  }
}

export const mockFabricantes: Fabricante[] = [
  { id: 'fab-1', nombre: 'Toyota', pais_origen: 'Japón', logo_url: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 1, engines_count: 5 },
  { id: 'fab-2', nombre: 'Nissan', pais_origen: 'Japón', logo_url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 2, engines_count: 4 },
  { id: 'fab-3', nombre: 'Mitsubishi', pais_origen: 'Japón', logo_url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 3, engines_count: 3 },
  { id: 'fab-4', nombre: 'Isuzu', pais_origen: 'Japón', logo_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 4, engines_count: 3 },
  { id: 'fab-5', nombre: 'Honda', pais_origen: 'Japón', logo_url: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 5, engines_count: 2 },
  { id: 'fab-6', nombre: 'Hyundai', pais_origen: 'Corea del Sur', logo_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 6, engines_count: 2 },
  { id: 'fab-7', nombre: 'Ford', pais_origen: 'Estados Unidos', logo_url: 'https://images.unsplash.com/photo-1551830820-330a71b99659?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 7, engines_count: 2 },
  { id: 'fab-8', nombre: 'Chevrolet', pais_origen: 'Estados Unidos', logo_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=120&auto=format&fit=crop&q=80', activo: true, orden_visual: 8, engines_count: 2 }
]

export const mockModelos: Modelo[] = [
  { id: 'mod-1', fabricante_id: 'fab-1', nombre: 'Hilux', anio_inicio: 1988, anio_fin: 2024 },
  { id: 'mod-2', fabricante_id: 'fab-1', nombre: 'Hiace', anio_inicio: 1989, anio_fin: 2020 },
  { id: 'mod-3', fabricante_id: 'fab-1', nombre: 'Land Cruiser Prado', anio_inicio: 1996, anio_fin: 2022 },
  { id: 'mod-4', fabricante_id: 'fab-2', nombre: 'D21 Pick-up / Hardbody', anio_inicio: 1986, anio_fin: 1997 },
  { id: 'mod-5', fabricante_id: 'fab-2', nombre: 'Frontier D22 / D40', anio_inicio: 1998, anio_fin: 2018 },
  { id: 'mod-6', fabricante_id: 'fab-3', nombre: 'L200 Sportero', anio_inicio: 1992, anio_fin: 2020 },
  { id: 'mod-7', fabricante_id: 'fab-4', nombre: 'D-Max / Rodeo', anio_inicio: 1990, anio_fin: 2022 }
]

export const mockMotores: Motor[] = [
  // --- TOYOTA MOTORS (MATCHING IMAGE 1) ---
  {
    id: 'mot-toy-11b',
    fabricante_id: 'fab-1',
    numero_id: 3703,
    codigo: '11B',
    nombre_comercial: 'TOYOTA - 11B',
    denominacion_venta: '',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 2977,
    cilindrada_texto: '2977 cc / 3 l',
    kw: 61,
    cv: 83,
    combustible: 'Diésel',
    diametro_cilindro_std_mm: 95.0,
    aspiracion: 'Natural'
  },
  {
    id: 'mot-toy-12ht',
    fabricante_id: 'fab-1',
    numero_id: 4931,
    codigo: '12HT',
    nombre_comercial: 'TOYOTA - 12HT',
    denominacion_venta: '',
    cilindros: 6,
    valvulas: 12,
    cilindrada_cc: 3980,
    cilindrada_texto: '3980 cc / 4 l',
    kw: 100,
    cv: 136,
    combustible: 'Diésel',
    diametro_cilindro_std_mm: 91.0,
    aspiracion: 'Turbo'
  },
  {
    id: 'mot-toy-12r',
    fabricante_id: 'fab-1',
    numero_id: 9068,
    codigo: '12R',
    nombre_comercial: 'TOYOTA - 12R',
    denominacion_venta: '',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 1588,
    cilindrada_texto: '1588 cc / 1.6 l',
    kw: 49,
    cv: 67,
    combustible: 'Gasolina',
    diametro_cilindro_std_mm: 80.5,
    aspiracion: 'Carburador'
  },
  {
    id: 'mot-toy-12rj',
    fabricante_id: 'fab-1',
    numero_id: 3705,
    codigo: '12RJ',
    nombre_comercial: 'TOYOTA - 12RJ',
    denominacion_venta: '',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 1587,
    cilindrada_texto: '1587 cc / 1.6 l',
    kw: 49,
    cv: 66,
    combustible: 'Gasolina',
    diametro_cilindro_std_mm: 80.5,
    aspiracion: 'Carburador'
  },
  {
    id: 'mot-toy-13b',
    fabricante_id: 'fab-1',
    numero_id: 3706,
    codigo: '13B',
    nombre_comercial: 'TOYOTA - 13B',
    denominacion_venta: 'B Series',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 3432,
    cilindrada_texto: '3432 cc / 3.4 l',
    kw: 66,
    cv: 90,
    combustible: 'Diésel',
    diametro_cilindro_std_mm: 102.0,
    aspiracion: 'Natural'
  },
  {
    id: 'mot-toy-13bt',
    fabricante_id: 'fab-1',
    numero_id: 3707,
    codigo: '13B-T',
    nombre_comercial: 'TOYOTA - 13B-T',
    denominacion_venta: 'B Series',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 3431,
    cilindrada_texto: '3431 cc / 3.4 l',
    kw: 91,
    cv: 124,
    combustible: 'Diésel',
    diametro_cilindro_std_mm: 102.0,
    aspiracion: 'Turbo'
  },
  {
    id: 'mot-toy-13tu',
    fabricante_id: 'fab-1',
    numero_id: 9074,
    codigo: '13T-U',
    nombre_comercial: 'TOYOTA - 13T-U',
    denominacion_venta: '',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 1770,
    cilindrada_texto: '1770 cc / 1.8 l',
    kw: 70,
    cv: 95,
    combustible: 'Gasolina',
    diametro_cilindro_std_mm: 85.0,
    aspiracion: 'Carburador'
  },
  {
    id: 'mot-toy-14b',
    fabricante_id: 'fab-1',
    numero_id: 3708,
    codigo: '14B',
    nombre_comercial: 'TOYOTA - 14B',
    denominacion_venta: '',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 3661,
    cilindrada_texto: '3661 cc / 3.7 l',
    kw: 71,
    cv: 97,
    combustible: 'Diésel',
    diametro_cilindro_std_mm: 102.0,
    aspiracion: 'Inyección Directa'
  },
  {
    id: 'mot-toy-14bt',
    fabricante_id: 'fab-1',
    numero_id: 3709,
    codigo: '14BT',
    nombre_comercial: 'TOYOTA - 14BT',
    denominacion_venta: '',
    cilindros: 4,
    valvulas: 8,
    cilindrada_cc: 3661,
    cilindrada_texto: '3661 cc / 3.6 l',
    kw: 75,
    cv: 102,
    combustible: 'Diésel',
    diametro_cilindro_std_mm: 102.0,
    aspiracion: 'Turbo'
  },
  {
    id: 'mot-toy-15bf',
    fabricante_id: 'fab-1',
    numero_id: 27240,
    codigo: '15B-F',
    nombre_comercial: 'TOYOTA - 15B-F',
    denominacion_venta: '',
    cilindros: 4,
    valvulas: 16,
    cilindrada_cc: 4104,
    cilindrada_texto: '4104 cc / 4.1 l',
    kw: 92,
    cv: 125,
    combustible: 'Diésel',
    diametro_cilindro_std_mm: 108.0,
    aspiracion: 'Inyección Directa 16V'
  },
  {
    id: 'mot-1',
    fabricante_id: 'fab-1',
    modelo_id: 'mod-1',
    numero_id: 3710,
    codigo: '3L',
    nombre_comercial: 'TOYOTA - 3L',
    denominacion_venta: 'Hilux / Hiace',
    cilindrada_cc: 2779,
    cilindrada_texto: '2779 cc / 2.8 l',
    kw: 67,
    cv: 91,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 8,
    diametro_cilindro_std_mm: 96.000,
    carrera_piston_mm: 96.000,
    configuracion: 'L4 SOHC Atmosférico',
    aspiracion: 'Natural',
    anios: '1988 - 2004'
  },
  {
    id: 'mot-2',
    fabricante_id: 'fab-1',
    modelo_id: 'mod-1',
    numero_id: 5821,
    codigo: '1KD-FTV',
    nombre_comercial: 'TOYOTA - 1KD-FTV',
    denominacion_venta: 'D-4D Common Rail',
    cilindrada_cc: 2982,
    cilindrada_texto: '2982 cc / 3.0 l',
    kw: 126,
    cv: 171,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 16,
    diametro_cilindro_std_mm: 96.000,
    carrera_piston_mm: 103.000,
    configuracion: 'L4 DOHC Turbo Intercooler',
    aspiracion: 'Turbo Common Rail',
    anios: '2000 - 2015'
  },
  {
    id: 'mot-3',
    fabricante_id: 'fab-1',
    modelo_id: 'mod-1',
    numero_id: 3712,
    codigo: '5L / 5L-E',
    nombre_comercial: 'TOYOTA - 5L / 5L-E',
    denominacion_venta: 'Hilux',
    cilindrada_cc: 2986,
    cilindrada_texto: '2986 cc / 3.0 l',
    kw: 77,
    cv: 105,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 8,
    diametro_cilindro_std_mm: 99.500,
    carrera_piston_mm: 96.000,
    configuracion: 'L4 SOHC',
    aspiracion: 'Natural',
    anios: '1997 - 2008'
  },
  // --- NISSAN MOTORS ---
  {
    id: 'mot-4',
    fabricante_id: 'fab-2',
    modelo_id: 'mod-4',
    numero_id: 4101,
    codigo: 'Z24',
    nombre_comercial: 'NISSAN - Z24',
    denominacion_venta: 'Twin Spark',
    cilindrada_cc: 2389,
    cilindrada_texto: '2389 cc / 2.4 l',
    kw: 78,
    cv: 106,
    combustible: 'Gasolina',
    cilindros: 4,
    valvulas: 8,
    diametro_cilindro_std_mm: 89.000,
    carrera_piston_mm: 96.000,
    configuracion: 'L4 SOHC 8 Bujías',
    aspiracion: 'Carburado / Inyección',
    anios: '1983 - 1997'
  },
  {
    id: 'mot-5',
    fabricante_id: 'fab-2',
    modelo_id: 'mod-5',
    numero_id: 4102,
    codigo: 'YD25DDTi',
    nombre_comercial: 'NISSAN - YD25DDTi',
    denominacion_venta: 'Frontier D22 / D40',
    cilindrada_cc: 2488,
    cilindrada_texto: '2488 cc / 2.5 l',
    kw: 98,
    cv: 133,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 16,
    diametro_cilindro_std_mm: 89.000,
    carrera_piston_mm: 100.000,
    configuracion: 'L4 DOHC 16V Turbo',
    aspiracion: 'Turbo Intercooler',
    anios: '2001 - 2019'
  },
  // --- MITSUBISHI MOTORS ---
  {
    id: 'mot-6',
    fabricante_id: 'fab-3',
    modelo_id: 'mod-6',
    numero_id: 5201,
    codigo: '4D56 / 4D56T',
    nombre_comercial: 'MITSUBISHI - 4D56',
    denominacion_venta: 'L200 / Montero',
    cilindrada_cc: 2477,
    cilindrada_texto: '2477 cc / 2.5 l',
    kw: 62,
    cv: 84,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 8,
    diametro_cilindro_std_mm: 91.100,
    carrera_piston_mm: 95.000,
    configuracion: 'L4 SOHC Balancines',
    aspiracion: 'Turbo Intercooler',
    anios: '1986 - 2016'
  },
  // --- ISUZU MOTORS ---
  {
    id: 'mot-7',
    fabricante_id: 'fab-4',
    modelo_id: 'mod-7',
    numero_id: 6101,
    codigo: '4JB1 / 4JB1-T',
    nombre_comercial: 'ISUZU - 4JB1',
    denominacion_venta: 'D-Max / Rodeo',
    cilindrada_cc: 2771,
    cilindrada_texto: '2771 cc / 2.8 l',
    kw: 57,
    cv: 78,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 8,
    diametro_cilindro_std_mm: 93.000,
    carrera_piston_mm: 102.000,
    configuracion: 'L4 OHV Varillero',
    aspiracion: 'Turbo / Natural',
    anios: '1988 - 2005'
  }
]

export const mockRepuestos: RepuestoTecnico[] = []

/**
 * Mapea una fila de Supabase a RepuestoTecnico
 */
export function mapDbRepuestoToFrontend(item: Record<string, unknown>): RepuestoTecnico {
  const motorRaw = item.motor as Record<string, unknown> | undefined
  let motorData: Motor | undefined = undefined

  if (motorRaw) {
    const motorEspec = (motorRaw.especificaciones_tecnicas as Record<string, unknown>) || {}
    motorData = {
      id: String(motorRaw.id),
      fabricante_id: String(motorRaw.fabricante_id),
      modelo_id: motorRaw.modelo_id ? String(motorRaw.modelo_id) : undefined,
      numero_id: motorEspec.numero_id ? (motorEspec.numero_id as number | string) : undefined,
      codigo: String(motorRaw.codigo),
      nombre_comercial: motorRaw.nombre_comercial ? String(motorRaw.nombre_comercial) : undefined,
      denominacion_venta: motorEspec.denominacion_venta ? String(motorEspec.denominacion_venta) : undefined,
      cilindrada_cc: motorRaw.cilindrada_cc ? Number(motorRaw.cilindrada_cc) : undefined,
      cilindrada_texto: motorEspec.cilindrada_texto ? String(motorEspec.cilindrada_texto) : (motorRaw.cilindrada_cc ? `${motorRaw.cilindrada_cc} cc` : undefined),
      kw: motorEspec.kw ? Number(motorEspec.kw) : undefined,
      cv: motorEspec.cv ? Number(motorEspec.cv) : undefined,
      combustible: String(motorRaw.combustible || 'Diésel'),
      cilindros: Number(motorRaw.cilindros || 4),
      valvulas: Number(motorRaw.valvulas || 8),
      diametro_cilindro_std_mm: motorRaw.diametro_cilindro_std_mm ? Number(motorRaw.diametro_cilindro_std_mm) : undefined,
      carrera_piston_mm: motorRaw.carrera_piston_mm ? Number(motorRaw.carrera_piston_mm) : undefined,
      configuracion: motorRaw.configuracion ? String(motorRaw.configuracion) : undefined,
      aspiracion: motorRaw.aspiracion ? String(motorRaw.aspiracion) : undefined,
      anios: motorRaw.anios ? String(motorRaw.anios) : undefined,
      especificaciones_tecnicas: motorEspec,
      fabricante: motorRaw.fabricante as Fabricante | undefined,
      modelo: motorRaw.modelo as Modelo | undefined
    }
  }

  const dims = (item.dimensiones as Record<string, unknown>) || {}

  return {
    id: String(item.id),
    motor_id: item.motor_id ? String(item.motor_id) : undefined,
    codigo_oem: String(item.codigo_oem),
    nombre: String(item.nombre),
    subsistema: String(item.subsistema),
    categoria: String(item.categoria),
    precio: Number(item.precio || 0),
    stock: Number(item.stock || 0),
    estado: (item.estado as RepuestoTecnico['estado']) || 'Disponible',
    imagen_url: item.imagen_url ? String(item.imagen_url) : undefined,
    catalogo_origen: item.catalogo_origen ? String(item.catalogo_origen) : 'OEM',

    diametro_cabeza_mm: item.diametro_cabeza_mm != null ? Number(item.diametro_cabeza_mm) : null,
    diametro_vastago_mm: item.diametro_vastago_mm != null ? Number(item.diametro_vastago_mm) : null,
    longitud_total_mm: item.longitud_total_mm != null ? Number(item.longitud_total_mm) : null,
    angulo_asiento_grados: item.angulo_asiento_grados != null ? Number(item.angulo_asiento_grados) : null,

    diametro_interior_mm: item.diametro_interior_mm != null ? Number(item.diametro_interior_mm) : (dims.diametro_interior_mm != null ? Number(dims.diametro_interior_mm) : null),
    diametro_exterior_mm: item.diametro_exterior_mm != null ? Number(item.diametro_exterior_mm) : (dims.diametro_exterior_mm != null ? Number(dims.diametro_exterior_mm) : null),
    altura_mm: item.altura_mm != null ? Number(item.altura_mm) : (dims.altura_mm != null ? Number(dims.altura_mm) : null),

    diametro_cilindro_mm: item.diametro_cilindro_mm != null ? Number(item.diametro_cilindro_mm) : (dims.diametro_cilindro_mm != null ? Number(dims.diametro_cilindro_mm) : null),
    espesor_anillo1_mm: item.espesor_anillo1_mm != null ? Number(item.espesor_anillo1_mm) : (dims.espesor_anillo1_mm != null ? Number(dims.espesor_anillo1_mm) : null),
    espesor_anillo2_mm: item.espesor_anillo2_mm != null ? Number(item.espesor_anillo2_mm) : (dims.espesor_anillo2_mm != null ? Number(dims.espesor_anillo2_mm) : null),
    espesor_aceite_mm: item.espesor_aceite_mm != null ? Number(item.espesor_aceite_mm) : (dims.espesor_aceite_mm != null ? Number(dims.espesor_aceite_mm) : null),

    tipo_cojinete: item.tipo_cojinete ? String(item.tipo_cojinete) : (dims.tipo_cojinete ? String(dims.tipo_cojinete) : null),
    diametro_munon_mm: item.diametro_munon_mm != null ? Number(item.diametro_munon_mm) : (dims.diametro_munon_mm != null ? Number(dims.diametro_munon_mm) : null),
    diametro_alojamiento_mm: item.diametro_alojamiento_mm != null ? Number(item.diametro_alojamiento_mm) : (dims.diametro_alojamiento_mm != null ? Number(dims.diametro_alojamiento_mm) : null),
    ancho_casquete_mm: item.ancho_casquete_mm != null ? Number(item.ancho_casquete_mm) : (dims.ancho_casquete_mm != null ? Number(dims.ancho_casquete_mm) : null),

    medida_rosca: item.medida_rosca ? String(item.medida_rosca) : (dims.medida_rosca ? String(dims.medida_rosca) : null),
    paso_rosca_mm: item.paso_rosca_mm != null ? Number(item.paso_rosca_mm) : (dims.paso_rosca_mm != null ? Number(dims.paso_rosca_mm) : null),
    longitud_perno_mm: item.longitud_perno_mm != null ? Number(item.longitud_perno_mm) : (dims.longitud_perno_mm != null ? Number(dims.longitud_perno_mm) : null),
    cantidad_piezas: item.cantidad_piezas != null ? Number(item.cantidad_piezas) : (dims.cantidad_piezas != null ? Number(dims.cantidad_piezas) : null),
    paso_rosca1_mm: item.paso_rosca1_mm != null ? Number(item.paso_rosca1_mm) : (dims.paso_rosca1_mm != null ? Number(dims.paso_rosca1_mm) : null),
    longitud1_mm: item.longitud1_mm != null ? Number(item.longitud1_mm) : (dims.longitud1_mm != null ? Number(dims.longitud1_mm) : null),
    longitud2_mm: item.longitud2_mm != null ? Number(item.longitud2_mm) : (dims.longitud2_mm != null ? Number(dims.longitud2_mm) : null),

    dimensiones: dims,
    especificaciones_tecnicas: (item.especificaciones_tecnicas as Record<string, unknown>) || {},
    equivalencias: (item.equivalencias as Equivalencia[]) || [],
    motor: motorData
  }
}

export const catalogService = {
  /**
   * Obtiene la lista de fabricantes disponibles
   */
  /**
   * Obtiene la lista de fabricantes disponibles desde Supabase con recuento dinámico de motores
   */
  async getFabricantes(): Promise<Fabricante[]> {
    try {
      const { data, error } = await supabase
        .from('fabricantes')
        .select('*')
        .eq('activo', true)
        .order('orden_visual', { ascending: true })

      if (error || !data || data.length === 0) {
        return mockFabricantes
      }

      // Conteo dinámico de motores por fabricante
      const countMap: Record<string, number> = {}
      try {
        const { data: enginesData } = await supabase
          .from('motores')
          .select('fabricante_id')
        if (enginesData) {
          enginesData.forEach((row: { fabricante_id: string }) => {
            if (row.fabricante_id) {
              countMap[row.fabricante_id] = (countMap[row.fabricante_id] || 0) + 1
            }
          })
        }
      } catch {
        // Silencioso
      }

      return data.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        nombre: String(item.nombre),
        pais_origen: item.pais_origen ? String(item.pais_origen) : undefined,
        logo_url: item.logo_url ? String(item.logo_url) : undefined,
        activo: Boolean(item.activo),
        orden_visual: Number(item.orden_visual || 0),
        engines_count: countMap[String(item.id)] || undefined
      }))
    } catch {
      return mockFabricantes
    }
  },

  /**
   * Obtiene modelos de vehículos desde Supabase, opcionalmente filtrados por fabricante
   */
  async getModelos(fabricanteId?: string): Promise<Modelo[]> {
    try {
      let query = supabase.from('modelos').select('*').eq('activo', true)
      if (fabricanteId) {
        query = query.eq('fabricante_id', fabricanteId)
      }

      const { data, error } = await query.order('nombre', { ascending: true })

      if (error || !data || data.length === 0) {
        if (fabricanteId) {
          const filtered = mockModelos.filter(m => m.fabricante_id === fabricanteId)
          return filtered.length > 0 ? filtered : mockModelos
        }
        return mockModelos
      }

      return data.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        fabricante_id: String(item.fabricante_id),
        nombre: String(item.nombre),
        anio_inicio: item.anio_inicio ? Number(item.anio_inicio) : undefined,
        anio_fin: item.anio_fin ? Number(item.anio_fin) : undefined,
        activo: Boolean(item.activo)
      }))
    } catch {
      return fabricanteId ? mockModelos.filter(m => m.fabricante_id === fabricanteId) : mockModelos
    }
  },

  /**
   * Obtiene motores filtrados por fabricante o modelo directamente desde Supabase
   */
  async getMotores(fabricanteId?: string, modeloId?: string): Promise<Motor[]> {
    try {
      let query = supabase.from('motores').select('*, fabricante:fabricantes(*), modelo:modelos(*)')
      if (fabricanteId) {
        query = query.eq('fabricante_id', fabricanteId)
      }
      if (modeloId) {
        query = query.eq('modelo_id', modeloId)
      }

      const { data, error } = await query.order('codigo', { ascending: true })

      if (error || !data || data.length === 0) {
        let filtered = [...mockMotores]
        if (fabricanteId) {
          filtered = filtered.filter(m => m.fabricante_id === fabricanteId)
        }
        if (modeloId) {
          filtered = filtered.filter(m => m.modelo_id === modeloId)
        }
        return filtered.length > 0 ? filtered : mockMotores
      }

      return data.map((item: Record<string, unknown>) => {
        const espec = (item.especificaciones_tecnicas as Record<string, unknown>) || {}
        return {
          id: String(item.id),
          fabricante_id: String(item.fabricante_id),
          modelo_id: item.modelo_id ? String(item.modelo_id) : undefined,
          numero_id: espec.numero_id ? (espec.numero_id as number | string) : undefined,
          codigo: String(item.codigo),
          nombre_comercial: item.nombre_comercial ? String(item.nombre_comercial) : undefined,
          denominacion_venta: espec.denominacion_venta ? String(espec.denominacion_venta) : undefined,
          cilindrada_cc: item.cilindrada_cc ? Number(item.cilindrada_cc) : undefined,
          cilindrada_texto: espec.cilindrada_texto ? String(espec.cilindrada_texto) : (item.cilindrada_cc ? `${item.cilindrada_cc} cc` : undefined),
          kw: espec.kw ? Number(espec.kw) : undefined,
          cv: espec.cv ? Number(espec.cv) : undefined,
          combustible: String(item.combustible || 'Diésel'),
          cilindros: Number(item.cilindros || 4),
          valvulas: Number(item.valvulas || 8),
          diametro_cilindro_std_mm: item.diametro_cilindro_std_mm ? Number(item.diametro_cilindro_std_mm) : undefined,
          carrera_piston_mm: item.carrera_piston_mm ? Number(item.carrera_piston_mm) : undefined,
          configuracion: item.configuracion ? String(item.configuracion) : undefined,
          aspiracion: item.aspiracion ? String(item.aspiracion) : undefined,
          anios: item.anios ? String(item.anios) : undefined,
          especificaciones_tecnicas: espec,
          fabricante: item.fabricante as Fabricante | undefined,
          modelo: item.modelo as Modelo | undefined
        }
      })
    } catch {
      return mockMotores
    }
  },

  /**
   * Obtiene un motor por su ID con datos complementarios
   */
  async getMotorById(motorId: string): Promise<Motor | null> {
    const list = await this.getMotores()
    return list.find(m => m.id === motorId) || mockMotores.find(m => m.id === motorId) || null
  },

  /**
   * Obtiene repuestos técnicos para un motor específico con su matriz de equivalencias desde Supabase
   */
  async getRepuestosByMotor(motorId: string, subsistema?: string): Promise<RepuestoTecnico[]> {
    try {
      let query = supabase
        .from('repuestos_tecnicos')
        .select('*, equivalencias:equivalencias_repuestos(*), motor:motores(*, fabricante:fabricantes(*), modelo:modelos(*))')
        .eq('motor_id', motorId)

      if (subsistema && subsistema !== 'Todos') {
        query = query.eq('subsistema', subsistema)
      }

      const { data, error } = await query.order('subsistema', { ascending: true })

      if (error || !data || data.length === 0) {
        let filtered = mockRepuestos.filter(r => r.motor_id === motorId)
        if (subsistema && subsistema !== 'Todos') {
          filtered = filtered.filter(r => r.subsistema === subsistema)
        }
        return filtered.length > 0 ? filtered : mockRepuestos.filter(r => !subsistema || subsistema === 'Todos' || r.subsistema === subsistema)
      }

      return data.map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
    } catch {
      let filtered = mockRepuestos.filter(r => r.motor_id === motorId)
      if (subsistema && subsistema !== 'Todos') {
        filtered = filtered.filter(r => r.subsistema === subsistema)
      }
      return filtered
    }
  },

  /**
   * Obtiene todos los repuestos pertenecientes a una categoría/grupo técnico desde Supabase
   */
  async getRepuestosByGrupo(categoria: string, subsistema?: string, fabricanteId?: string): Promise<RepuestoTecnico[]> {
    try {
      let query = supabase
        .from('repuestos_tecnicos')
        .select('*, equivalencias:equivalencias_repuestos(*), motor:motores(*, fabricante:fabricantes(*), modelo:modelos(*))')

      if (categoria) {
        query = query.eq('categoria', categoria)
      }

      if (subsistema && subsistema !== 'Todos') {
        query = query.eq('subsistema', subsistema)
      }

      const { data, error } = await query.order('codigo_oem', { ascending: true })

      if (!error && data && data.length > 0) {
        let mapped = data.map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
        if (fabricanteId) {
          mapped = mapped.filter(r => r.motor?.fabricante_id === fabricanteId)
        }
        return mapped
      }

      // Si no hubo resultados por coincidencia exacta, probar búsqueda flexible por nombre o categoría
      if (categoria && (!data || data.length === 0)) {
        const { data: altData } = await supabase
          .from('repuestos_tecnicos')
          .select('*, equivalencias:equivalencias_repuestos(*), motor:motores(*, fabricante:fabricantes(*), modelo:modelos(*))')
          .or(`categoria.ilike.%${categoria}%,nombre.ilike.%${categoria}%`)
          .order('codigo_oem', { ascending: true })

        if (altData && altData.length > 0) {
          let mapped = altData.map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
          if (fabricanteId) {
            mapped = mapped.filter(r => r.motor?.fabricante_id === fabricanteId)
          }
          return mapped
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Error consultando repuestos por grupo en Supabase, usando respaldo:', err)
    }

    // Fallback con mockRepuestos y repuestos creados localmente
    const localParts = getLocalCustomRepuestos()
    let list = [...mockRepuestos, ...localParts]

    if (categoria) {
      const catLower = categoria.toLowerCase()
      list = list.filter(r =>
        (r.categoria && r.categoria.toLowerCase() === catLower) ||
        (r.categoria && r.categoria.toLowerCase().includes(catLower)) ||
        (r.nombre && r.nombre.toLowerCase().includes(catLower)) ||
        (r.subsistema && r.subsistema.toLowerCase().includes(catLower))
      )
    }

    if (fabricanteId) {
      list = list.filter(r => {
        const mot = mockMotores.find(m => m.id === r.motor_id)
        return mot?.fabricante_id === fabricanteId || r.motor?.fabricante_id === fabricanteId
      })
    }

    return list.map(r => {
      const mot = mockMotores.find(m => m.id === r.motor_id)
      const fab = mot ? mockFabricantes.find(f => f.id === mot.fabricante_id) : undefined
      return {
        ...r,
        motor: r.motor || (mot ? { ...mot, fabricante: fab } : undefined)
      }
    })
  },

  /**
   * Obtiene la lista de motores vinculados a un fabricante/marca específica
   */
  async getMotorsByBrand(brand: string): Promise<Motor[]> {
    if (!brand || brand.trim() === '') return mockMotores
    const cleanBrand = brand.toLowerCase().trim()
    const fab = mockFabricantes.find(f => f.nombre.toLowerCase() === cleanBrand)

    try {
      if (fab) {
        const { data, error } = await supabase
          .from('motores')
          .select('*, fabricante:fabricantes(*), modelo:modelos(*)')
          .eq('fabricante_id', fab.id)
        if (!error && data && data.length > 0) {
          return data.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            fabricante_id: String(item.fabricante_id),
            modelo_id: item.modelo_id ? String(item.modelo_id) : undefined,
            codigo: String(item.codigo),
            nombre_comercial: item.nombre_comercial ? String(item.nombre_comercial) : undefined,
            cilindrada_cc: item.cilindrada_cc ? Number(item.cilindrada_cc) : undefined,
            combustible: String(item.combustible || 'Diésel'),
            cilindros: Number(item.cilindros || 4),
            valvulas: Number(item.valvulas || 8),
            diametro_cilindro_std_mm: item.diametro_cilindro_std_mm ? Number(item.diametro_cilindro_std_mm) : undefined,
            carrera_piston_mm: item.carrera_piston_mm ? Number(item.carrera_piston_mm) : undefined,
            configuracion: item.configuracion ? String(item.configuracion) : undefined,
            aspiracion: item.aspiracion ? String(item.aspiracion) : undefined,
            anios: item.anios ? String(item.anios) : undefined,
            fabricante: item.fabricante as Fabricante | undefined,
            modelo: item.modelo as Modelo | undefined
          }))
        }
      }
    } catch {
      // Fallback a memoria local
    }

    if (fab) {
      return mockMotores
        .filter(m => m.fabricante_id === fab.id)
        .map(m => ({ ...m, fabricante: fab }))
    }

    return mockMotores.filter(m => {
      const f = mockFabricantes.find(fabItem => fabItem.id === m.fabricante_id)
      return f?.nombre.toLowerCase().includes(cleanBrand)
    }).map(m => ({
      ...m,
      fabricante: mockFabricantes.find(fabItem => fabItem.id === m.fabricante_id)
    }))
  },

  /**
   * Búsqueda principal por vehículo y jerarquía (Marca -> Motor -> Grupo de Repuestos)
   */
  async searchByVehicle(brand: string, motor: string, group?: string): Promise<RepuestoTecnico[]> {
    const cleanMotor = (motor || '').toLowerCase().trim()
    const matchingMotor = mockMotores.find(m =>
      m.id === motor ||
      m.codigo.toLowerCase() === cleanMotor ||
      m.codigo.toLowerCase().includes(cleanMotor)
    )

    const motorId = matchingMotor ? matchingMotor.id : motor

    let results = mockRepuestos.filter(r => r.motor_id === motorId)

    if (results.length === 0 && matchingMotor) {
      results = mockRepuestos.filter(r => r.motor_id === matchingMotor.id)
    }

    // Si aún no hay resultados pero se seleccionó una marca, traer repuestos de los motores de esa marca
    if (results.length === 0 && brand) {
      const motorsOfBrand = await this.getMotorsByBrand(brand)
      const motorIds = new Set(motorsOfBrand.map(m => m.id))
      results = mockRepuestos.filter(r => r.motor_id && motorIds.has(r.motor_id))
    }

    if (group && group !== 'Todos') {
      const g = group.toLowerCase()
      results = results.filter(r =>
        r.subsistema.toLowerCase() === g ||
        r.categoria.toLowerCase() === g ||
        r.subsistema.toLowerCase().includes(g) ||
        r.categoria.toLowerCase().includes(g)
      )
    }

    return results.map(r => {
      const mot = mockMotores.find(m => m.id === r.motor_id)
      const fab = mot ? mockFabricantes.find(f => f.id === mot.fabricante_id) : undefined
      return {
        ...r,
        motor: mot ? { ...mot, fabricante: fab } : undefined
      }
    })
  },

  /**
   * Búsqueda dimensional para adaptaciones de taller por medidas exactas en milímetros
   */
  async searchByDimensions(componentType: string, dimensions: Record<string, number | string>): Promise<RepuestoTecnico[]> {
    const type = (componentType || '').toLowerCase().trim()
    const tol = typeof dimensions.tolerancia_mm === 'number' ? dimensions.tolerancia_mm : 0.35

    const filtered = mockRepuestos.filter(r => {
      // 1. Sellos de Válvula / Ajuste de Válvula
      if (type.includes('sello') || type.includes('ajuste')) {
        if (r.categoria !== 'Sellos') return false

        // Diámetro interior (ej. 4.8 mm)
        const dInt = Number(dimensions.diametro_interior || dimensions.diametro_int || dimensions.d_int || dimensions.diametro_vastago || 0)
        if (dInt > 0) {
          const actualDInt = r.diametro_interior_mm ?? (r.dimensiones?.diametro_interior_mm as number) ?? r.diametro_vastago_mm
          if (!actualDInt || Math.abs(actualDInt - dInt) > 0.15) return false
        }

        // Diámetro exterior (ej. 10.8 mm)
        const dExt = Number(dimensions.diametro_exterior || dimensions.diametro_ext || dimensions.d_ext || 0)
        if (dExt > 0) {
          const actualDExt = r.diametro_exterior_mm ?? (r.dimensiones?.diametro_exterior_mm as number)
          if (!actualDExt || Math.abs(actualDExt - dExt) > 0.25) return false
        }

        // Altura (ej. 10 mm)
        const alt = Number(dimensions.altura || dimensions.altura_mm || dimensions.longitud || 0)
        if (alt > 0) {
          const actualAlt = r.altura_mm ?? (r.dimensiones?.altura_mm as number) ?? r.longitud_total_mm
          if (!actualAlt || Math.abs(actualAlt - alt) > 0.5) return false
        }

        return true
      }

      // 2. Válvula de motor
      if (type.includes('valvula') || type.includes('válvula')) {
        if (r.categoria !== 'Válvulas') return false

        const dHongo = Number(dimensions.diametro_cabeza || dimensions.diametro_hongo || 0)
        if (dHongo > 0) {
          if (!r.diametro_cabeza_mm || Math.abs(r.diametro_cabeza_mm - dHongo) > tol) return false
        }

        const dVastago = Number(dimensions.diametro_vastago || 0)
        if (dVastago > 0) {
          if (!r.diametro_vastago_mm || Math.abs(r.diametro_vastago_mm - dVastago) > 0.1) return false
        }

        const longTotal = Number(dimensions.longitud_total || dimensions.longitud || dimensions.altura || 0)
        if (longTotal > 0) {
          if (!r.longitud_total_mm || Math.abs(r.longitud_total_mm - longTotal) > (tol * 2)) return false
        }

        return true
      }

      // 3. Anillos de pistón / motor
      if (type.includes('anillo')) {
        if (r.categoria !== 'Anillos') return false

        const dCilindro = Number(dimensions.diametro_cilindro || dimensions.diametro || 0)
        if (dCilindro > 0) {
          if (!r.diametro_cilindro_mm || Math.abs(r.diametro_cilindro_mm - dCilindro) > tol) return false
        }

        const esp1 = Number(dimensions.espesor_anillo1 || dimensions.anillo1 || 0)
        if (esp1 > 0) {
          if (!r.espesor_anillo1_mm || Math.abs(r.espesor_anillo1_mm - esp1) > 0.15) return false
        }

        const esp2 = Number(dimensions.espesor_anillo2 || dimensions.anillo2 || 0)
        if (esp2 > 0) {
          if (!r.espesor_anillo2_mm || Math.abs(r.espesor_anillo2_mm - esp2) > 0.15) return false
        }

        const espAceite = Number(dimensions.espesor_aceite || dimensions.anillo_aceite || dimensions.aceite || 0)
        if (espAceite > 0) {
          if (!r.espesor_aceite_mm || Math.abs(r.espesor_aceite_mm - espAceite) > 0.15) return false
        }

        return true
      }

      // 4. Juego de tornillos / pernos de culata
      if (type.includes('perno') || type.includes('tornillo')) {
        if (r.categoria !== 'Pernos') return false

        const rosca = String(dimensions.medida_rosca || dimensions.rosca || '').trim().toUpperCase()
        if (rosca && r.medida_rosca && !r.medida_rosca.toUpperCase().includes(rosca)) {
          return false
        }

        const paso = Number(dimensions.paso_rosca || dimensions.paso || 0)
        if (paso > 0) {
          const actualPaso = r.paso_rosca_mm ?? r.paso_rosca1_mm
          if (actualPaso && Math.abs(actualPaso - paso) > 0.05) return false
        }

        const longitud = Number(dimensions.longitud_perno || dimensions.longitud || 0)
        if (longitud > 0) {
          const lMin = r.longitud1_mm ?? r.longitud_perno_mm ?? r.longitud_total_mm ?? 0
          const lMax = r.longitud2_mm ?? r.longitud_perno_mm ?? r.longitud_total_mm ?? 0
          const min = Math.min(lMin, lMax)
          const max = Math.max(lMin, lMax)
          if (longitud < (min - 2) || longitud > (max + 2)) return false
        }

        const cant = Number(dimensions.cantidad_piezas || dimensions.cantidad || 0)
        if (cant > 0 && r.cantidad_piezas && r.cantidad_piezas !== cant) {
          return false
        }

        return true
      }

      // 5. Casquetería NDC
      if (type.includes('casquete') || type.includes('cojinete')) {
        if (r.categoria !== 'Casquetería') return false
        if (dimensions.tipo_cojinete && r.tipo_cojinete !== dimensions.tipo_cojinete) return false
        const dMunon = Number(dimensions.diametro_munon || 0)
        if (dMunon > 0 && (!r.diametro_munon_mm || Math.abs(r.diametro_munon_mm - dMunon) > tol)) return false
        const ancho = Number(dimensions.ancho_casquete || 0)
        if (ancho > 0 && (!r.ancho_casquete_mm || Math.abs(r.ancho_casquete_mm - ancho) > tol)) return false
        return true
      }

      return false
    })

    return filtered.map(r => {
      const mot = mockMotores.find(m => m.id === r.motor_id)
      const fab = mot ? mockFabricantes.find(f => f.id === mot.fabricante_id) : undefined
      return {
        ...r,
        motor: mot ? { ...mot, fabricante: fab } : undefined
      }
    })
  },

  /**
   * Búsqueda directa e inversa por código original OEM o de catálogo alterno (Supabase con fallback)
   */
  async searchByCode(code: string): Promise<RepuestoTecnico[]> {
    if (!code || code.trim() === '') return []
    const clean = code.trim()
    const q = clean.toLowerCase().replace(/[-\s]/g, '')

    try {
      // 1. Buscar en equivalencias alternas para recolectar IDs
      const { data: equivData } = await supabase
        .from('equivalencias_repuestos')
        .select('repuesto_id')
        .or(`codigo_alterno.ilike.%${clean}%,marca_alterna.ilike.%${clean}%`)
        .limit(60)

      const repuestoIds = (equivData || [])
        .map(e => e.repuesto_id)
        .filter(Boolean) as string[]

      // 2. Buscar en repuestos_tecnicos
      let query = supabase
        .from('repuestos_tecnicos')
        .select('*, equivalencias:equivalencias_repuestos(*), motor:motores(*, fabricante:fabricantes(*), modelo:modelos(*))')

      if (repuestoIds.length > 0) {
        query = query.or(`codigo_oem.ilike.%${clean}%,nombre.ilike.%${clean}%,id.in.(${repuestoIds.join(',')})`)
      } else {
        query = query.or(`codigo_oem.ilike.%${clean}%,nombre.ilike.%${clean}%`)
      }

      const { data, error } = await query.limit(60)

      if (!error && data && data.length > 0) {
        return data.map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
      }
    } catch {
      // Fallback
    }

    const matches = mockRepuestos.filter(r => {
      const matchOem = r.codigo_oem.toLowerCase().replace(/[-\s]/g, '').includes(q)
      const matchNombre = r.nombre.toLowerCase().includes(clean.toLowerCase())
      const matchEquiv = r.equivalencias?.some(eq =>
        eq.codigo_alterno.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
        eq.marca_alterna.toLowerCase().includes(clean.toLowerCase())
      )
      return matchOem || matchNombre || matchEquiv
    })

    return matches.map(r => {
      const mot = mockMotores.find(m => m.id === r.motor_id)
      const fab = mot ? mockFabricantes.find(f => f.id === mot.fabricante_id) : undefined
      return {
        ...r,
        motor: mot ? { ...mot, fabricante: fab } : undefined
      }
    })
  },

  /**
   * Búsqueda global reactiva con soporte para código OEM, descripción y catálogo alterno
   */
  async searchGlobalParts(query: string): Promise<RepuestoTecnico[]> {
    return this.searchByCode(query)
  },

  /**
   * Obtiene la lista de grupos / familias de piezas y sus esquemas paramétricos técnicos
   */
  async getGrupos(): Promise<GrupoRepuesto[]> {
    const localGrupos = getLocalDynamicGrupos()

    try {
      const { data, error } = await supabase
        .from('grupos_repuestos')
        .select('*')
        .eq('activo', true)
        .order('orden_visual', { ascending: true })

      if (!error && data && data.length > 0) {
        const fromDb: GrupoRepuesto[] = data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          codigo: String(row.codigo),
          nombre: String(row.nombre),
          categoria: String(row.categoria),
          subsistema: String(row.subsistema || 'Block'),
          descripcion: row.descripcion ? String(row.descripcion) : undefined,
          icono: row.icono ? String(row.icono) : 'Layers',
          parametros: Array.isArray(row.parametros) ? (row.parametros as ParametroTecnicoDefinicion[]) : [],
          activo: Boolean(row.activo),
          orden_visual: Number(row.orden_visual || 0),
          created_at: row.created_at ? String(row.created_at) : undefined,
          updated_at: row.updated_at ? String(row.updated_at) : undefined
        }))

        // Fusionar con grupos locales creados que no estén en BD
        const merged = [...fromDb]
        for (const loc of localGrupos) {
          if (!merged.some(m => m.codigo === loc.codigo || m.id === loc.id)) {
            merged.push(loc)
          }
        }
        return merged
      }
    } catch (e) {
      console.warn('[CatalogService] Error consultando grupos_repuestos en Supabase, usando respaldo:', e)
    }

    // Fallback a mockGruposRepuestos + grupos locales
    const merged = [...mockGruposRepuestos]
    for (const loc of localGrupos) {
      if (!merged.some(m => m.codigo === loc.codigo || m.id === loc.id)) {
        merged.push(loc)
      }
    }
    return merged
  },

  /**
   * Obtiene un grupo por su código único
   */
  async getGrupoByCodigo(codigo: string): Promise<GrupoRepuesto | null> {
    const list = await this.getGrupos()
    return list.find(g => g.codigo === codigo) || null
  },

  /**
   * Registra un nuevo grupo o familia de piezas con sus parámetros técnicos requeridos
   */
  async createGrupo(grupoData: GrupoRepuestoInsert): Promise<GrupoRepuesto> {
    const slug = (grupoData.codigo || grupoData.nombre)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const newGroup: GrupoRepuesto = {
      id: `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      codigo: slug,
      nombre: grupoData.nombre.trim(),
      categoria: grupoData.categoria.trim() || grupoData.nombre.trim(),
      subsistema: grupoData.subsistema || 'Block',
      descripcion: grupoData.descripcion?.trim() || undefined,
      icono: grupoData.icono || 'Layers',
      parametros: grupoData.parametros || [],
      activo: grupoData.activo !== false,
      orden_visual: grupoData.orden_visual || 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Intentar inserción en Supabase
    try {
      const { data, error } = await supabase
        .from('grupos_repuestos')
        .insert({
          codigo: newGroup.codigo,
          nombre: newGroup.nombre,
          categoria: newGroup.categoria,
          subsistema: newGroup.subsistema,
          descripcion: newGroup.descripcion,
          icono: newGroup.icono,
          parametros: newGroup.parametros,
          activo: newGroup.activo,
          orden_visual: newGroup.orden_visual
        })
        .select('*')
        .single()

      if (!error && data) {
        newGroup.id = String(data.id)
      }
    } catch (err) {
      console.warn('[CatalogService] No se pudo guardar grupo en Supabase directamente, guardando en cache local:', err)
    }

    // Persistir siempre en localStorage para disponibilidad inmediata
    saveLocalDynamicGrupo(newGroup)
    return newGroup
  },

  /**
   * Modifica un grupo o familia de piezas existente (nombre, categoría, subsistema, icono, parámetros técnicos)
   */
  async updateGrupo(idOrCode: string, grupoData: Partial<GrupoRepuestoInsert>): Promise<GrupoRepuesto> {
    const existingList = await this.getGrupos()
    const existing = existingList.find(g => g.id === idOrCode || g.codigo === idOrCode)
    if (!existing) {
      throw new Error(`Grupo con identificador ${idOrCode} no encontrado`)
    }

    const updated: GrupoRepuesto = {
      ...existing,
      nombre: grupoData.nombre !== undefined ? grupoData.nombre.trim() : existing.nombre,
      categoria: grupoData.categoria !== undefined ? grupoData.categoria.trim() : existing.categoria,
      subsistema: grupoData.subsistema !== undefined ? grupoData.subsistema : existing.subsistema,
      descripcion: grupoData.descripcion !== undefined ? grupoData.descripcion.trim() : existing.descripcion,
      icono: grupoData.icono !== undefined ? grupoData.icono : existing.icono,
      parametros: grupoData.parametros !== undefined ? grupoData.parametros : existing.parametros,
      activo: grupoData.activo !== undefined ? grupoData.activo : existing.activo,
      orden_visual: grupoData.orden_visual !== undefined ? grupoData.orden_visual : existing.orden_visual,
      updated_at: new Date().toISOString()
    }

    // Intentar actualización en Supabase
    try {
      const { data, error } = await supabase
        .from('grupos_repuestos')
        .update({
          nombre: updated.nombre,
          categoria: updated.categoria,
          subsistema: updated.subsistema,
          descripcion: updated.descripcion,
          icono: updated.icono,
          parametros: updated.parametros,
          activo: updated.activo,
          orden_visual: updated.orden_visual,
          updated_at: updated.updated_at
        })
        .or(`id.eq.${updated.id},codigo.eq.${updated.codigo}`)
        .select('*')
        .single()

      if (!error && data) {
        updated.id = String(data.id)
      }
    } catch (err) {
      console.warn('[CatalogService] No se pudo actualizar grupo en Supabase directamente, guardando en cache local:', err)
    }

    // Persistir en cache local para disponibilidad inmediata
    saveLocalDynamicGrupo(updated)
    return updated
  },

  /**
   * Registra un nuevo repuesto técnico con sus equivalencias directamente en Supabase
   */
  async createRepuesto(
    part: Partial<RepuestoTecnico>,
    equivalencias?: Array<{ marca_alterna: string; codigo_alterno: string; notas?: string }>
  ): Promise<RepuestoTecnico> {
    const insertPayload = {
      motor_id: part.motor_id || null,
      codigo_oem: (part.codigo_oem || '').trim().toUpperCase(),
      nombre: (part.nombre || '').trim(),
      subsistema: part.subsistema || 'Culata',
      categoria: part.categoria || 'Válvulas',
      precio: Number(part.precio || 0),
      stock: Number(part.stock || 0),
      estado: part.estado || 'Disponible',
      imagen_url: part.imagen_url || null,
      diametro_cabeza_mm: part.diametro_cabeza_mm != null ? Number(part.diametro_cabeza_mm) : null,
      diametro_vastago_mm: part.diametro_vastago_mm != null ? Number(part.diametro_vastago_mm) : null,
      longitud_total_mm: part.longitud_total_mm != null ? Number(part.longitud_total_mm) : null,
      angulo_asiento_grados: part.angulo_asiento_grados != null ? Number(part.angulo_asiento_grados) : null,
      diametro_cilindro_mm: part.diametro_cilindro_mm != null ? Number(part.diametro_cilindro_mm) : null,
      espesor_anillo1_mm: part.espesor_anillo1_mm != null ? Number(part.espesor_anillo1_mm) : null,
      espesor_anillo2_mm: part.espesor_anillo2_mm != null ? Number(part.espesor_anillo2_mm) : null,
      espesor_aceite_mm: part.espesor_aceite_mm != null ? Number(part.espesor_aceite_mm) : null,
      tipo_cojinete: part.tipo_cojinete || null,
      diametro_munon_mm: part.diametro_munon_mm != null ? Number(part.diametro_munon_mm) : null,
      diametro_alojamiento_mm: part.diametro_alojamiento_mm != null ? Number(part.diametro_alojamiento_mm) : null,
      ancho_casquete_mm: part.ancho_casquete_mm != null ? Number(part.ancho_casquete_mm) : null,
      dimensiones: {
        diametro_interior_mm: part.diametro_interior_mm,
        diametro_exterior_mm: part.diametro_exterior_mm,
        altura_mm: part.altura_mm,
        medida_rosca: part.medida_rosca,
        paso_rosca_mm: part.paso_rosca_mm,
        longitud_perno_mm: part.longitud_perno_mm,
        cantidad_piezas: part.cantidad_piezas,
        paso_rosca1_mm: part.paso_rosca1_mm,
        longitud1_mm: part.longitud1_mm,
        longitud2_mm: part.longitud2_mm,
        ...(part.dimensiones || {})
      },
      especificaciones_tecnicas: part.especificaciones_tecnicas || {}
    }

    try {
      const { data: insertedPart, error: partError } = await supabase
        .from('repuestos_tecnicos')
        .insert(insertPayload)
        .select('*, motor:motores(*, fabricante:fabricantes(*), modelo:modelos(*))')
        .single()

      if (!partError && insertedPart) {
        let createdEquivs: Equivalencia[] = []
        if (equivalencias && equivalencias.length > 0) {
          const equivRows = equivalencias
            .filter(eq => eq.marca_alterna && eq.codigo_alterno)
            .map(eq => ({
              repuesto_id: insertedPart.id,
              marca_alterna: eq.marca_alterna.trim(),
              codigo_alterno: eq.codigo_alterno.trim().toUpperCase(),
              notas: eq.notas || null
            }))

          if (equivRows.length > 0) {
            const { data: savedEquivs } = await supabase
              .from('equivalencias_repuestos')
              .insert(equivRows)
              .select('*')
            if (savedEquivs) {
              createdEquivs = savedEquivs as Equivalencia[]
            }
          }
        }

        const mapped = mapDbRepuestoToFrontend({
          ...insertedPart,
          equivalencias: createdEquivs
        })
        saveLocalCustomRepuesto(mapped)
        mockRepuestos.unshift(mapped)
        return mapped
      }
    } catch (err) {
      console.warn('[CatalogService] Inserción en Supabase falló, usando respaldo local:', err)
    }

    // Fallback local garantizado
    const fallbackId = `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const mappedEquivs: Equivalencia[] = (equivalencias || []).map((eq, i) => ({
      id: `eq-${Date.now()}-${i}`,
      repuesto_id: fallbackId,
      marca_alterna: eq.marca_alterna,
      codigo_alterno: eq.codigo_alterno,
      notas: eq.notas
    }))

    const fallbackMotor = part.motor_id ? mockMotores.find(m => m.id === part.motor_id) : undefined

    const fallbackPart: RepuestoTecnico = {
      id: fallbackId,
      motor_id: part.motor_id,
      codigo_oem: insertPayload.codigo_oem,
      nombre: insertPayload.nombre,
      subsistema: insertPayload.subsistema,
      categoria: insertPayload.categoria,
      precio: insertPayload.precio,
      stock: insertPayload.stock,
      estado: insertPayload.estado as any,
      imagen_url: insertPayload.imagen_url || undefined,
      catalogo_origen: 'OEM',
      diametro_cabeza_mm: insertPayload.diametro_cabeza_mm,
      diametro_vastago_mm: insertPayload.diametro_vastago_mm,
      longitud_total_mm: insertPayload.longitud_total_mm,
      angulo_asiento_grados: insertPayload.angulo_asiento_grados,
      diametro_cilindro_mm: insertPayload.diametro_cilindro_mm,
      espesor_anillo1_mm: insertPayload.espesor_anillo1_mm,
      espesor_anillo2_mm: insertPayload.espesor_anillo2_mm,
      espesor_aceite_mm: insertPayload.espesor_aceite_mm,
      tipo_cojinete: insertPayload.tipo_cojinete as any,
      diametro_munon_mm: insertPayload.diametro_munon_mm,
      diametro_alojamiento_mm: insertPayload.diametro_alojamiento_mm,
      ancho_casquete_mm: insertPayload.ancho_casquete_mm,
      medida_rosca: insertPayload.dimensiones?.medida_rosca as any,
      paso_rosca_mm: insertPayload.dimensiones?.paso_rosca_mm as any,
      longitud_perno_mm: insertPayload.dimensiones?.longitud_perno_mm as any,
      cantidad_piezas: insertPayload.dimensiones?.cantidad_piezas as any,
      dimensiones: insertPayload.dimensiones,
      especificaciones_tecnicas: insertPayload.especificaciones_tecnicas,
      equivalencias: mappedEquivs,
      motor: fallbackMotor
    }

    saveLocalCustomRepuesto(fallbackPart)
    mockRepuestos.unshift(fallbackPart)
    return fallbackPart
  },

  /**
   * Búsqueda dimensional para adaptaciones (Compatibilidad retroactiva)
   */
  async searchDimensional(filters: DimensionalFilter): Promise<RepuestoTecnico[]> {
    const componentType = filters.categoria
    const dims: Record<string, number | string> = {
      tolerancia_mm: filters.tolerancia_mm || 0.35,
      diametro_interior: filters.diametro_interior || 0,
      diametro_exterior: filters.diametro_exterior || 0,
      altura: filters.altura || 0,
      diametro_cabeza: filters.diametro_cabeza || 0,
      diametro_vastago: filters.diametro_vastago || 0,
      longitud_total: filters.longitud_total || 0,
      diametro_cilindro: filters.diametro_cilindro || 0,
      espesor_anillo1: filters.espesor_anillo1 || 0,
      espesor_anillo2: filters.espesor_anillo2 || 0,
      espesor_aceite: filters.espesor_aceite || 0,
      tipo_cojinete: filters.tipo_cojinete || '',
      diametro_munon: filters.diametro_munon || 0,
      ancho_casquete: filters.ancho_casquete || 0,
      medida_rosca: filters.medida_rosca || '',
      paso_rosca: filters.paso_rosca || 0,
      longitud_perno: filters.longitud_perno || 0,
      cantidad_piezas: filters.cantidad_piezas || 0
    }
    return this.searchByDimensions(componentType, dims)
  },

  /**
   * Búsqueda inversa por código OEM o código alterno (Compatibilidad retroactiva)
   */
  async searchByCodeOrKeyword(query: string): Promise<RepuestoTecnico[]> {
    return this.searchByCode(query)
  },

  /**
   * getProducts() para soporte y retrocompatibilidad total con WorkOrderForm.vue
   */
  async getProducts(): Promise<CatalogProduct[]> {
    try {
      const technicalProducts: CatalogProduct[] = mockRepuestos.map(r => {
        const dokuro = r.equivalencias?.find(e => e.marca_alterna === 'Dokuro')?.codigo_alterno
        const rik = r.equivalencias?.find(e => e.marca_alterna === 'Rik')?.codigo_alterno
        const ndc = r.equivalencias?.find(e => e.marca_alterna === 'NDC')?.codigo_alterno
        const ajusa = r.equivalencias?.find(e => e.marca_alterna === 'Ajusa')?.codigo_alterno

        const extraCodes = [
          dokuro ? `Dokuro: ${dokuro}` : null,
          rik ? `Rik: ${rik}` : null,
          ndc ? `NDC: ${ndc}` : null,
          ajusa ? `Ajusa: ${ajusa}` : null
        ].filter(Boolean).join(' | ')

        return {
          id: r.id,
          code: r.codigo_oem,
          name: `${r.nombre} (${r.subsistema})${extraCodes ? ` [${extraCodes}]` : ''}`,
          category: r.subsistema,
          price: r.precio,
          stock: r.stock,
          status: r.estado,
          imageUrl: r.imagen_url || 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=300&auto=format&fit=crop&q=80',
          especificaciones_tecnicas: {
            subsistema: r.subsistema,
            categoria: r.categoria,
            diametro_cabeza: r.diametro_cabeza_mm,
            diametro_vastago: r.diametro_vastago_mm,
            longitud_total: r.longitud_total_mm,
            diametro_cilindro: r.diametro_cilindro_mm,
            tipo_cojinete: r.tipo_cojinete,
            equivalencias: r.equivalencias
          }
        }
      })

      return technicalProducts
    } catch {
      return []
    }
  }
}
