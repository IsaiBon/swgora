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
  codigo: string
  nombre_comercial?: string
  cilindrada_cc?: number
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

  // Dimensiones físicas clave (números exactos en mm)
  diametro_cabeza_mm?: number | null
  diametro_vastago_mm?: number | null
  longitud_total_mm?: number | null
  angulo_asiento_grados?: number | null

  diametro_cilindro_mm?: number | null
  espesor_anillo1_mm?: number | null
  espesor_anillo2_mm?: number | null
  espesor_aceite_mm?: number | null

  tipo_cojinete?: 'MS' | 'CB' | 'TW' | 'SH' | 'PB' | string | null
  diametro_munon_mm?: number | null
  diametro_alojamiento_mm?: number | null
  ancho_casquete_mm?: number | null

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

  // Anillos
  diametro_cilindro?: number
  espesor_anillo1?: number
  espesor_anillo2?: number
  espesor_aceite?: number

  // Cojinetes / Casquetes NDC
  tipo_cojinete?: 'MS' | 'CB' | 'TW' | 'SH' | 'PB' | ''
  diametro_munon?: number
  ancho_casquete?: number

  // Sellos
  diametro_interior?: number
  diametro_exterior?: number
  altura?: number
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
  {
    id: 'mot-1',
    fabricante_id: 'fab-1',
    modelo_id: 'mod-1',
    codigo: '3L',
    nombre_comercial: '2.8L Diésel SOHC 8V',
    cilindrada_cc: 2779,
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
    codigo: '1KD-FTV',
    nombre_comercial: '3.0L D-4D Common Rail 16V',
    cilindrada_cc: 2982,
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
    codigo: '5L / 5L-E',
    nombre_comercial: '3.0L Diésel SOHC 8V',
    cilindrada_cc: 2986,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 8,
    diametro_cilindro_std_mm: 99.500,
    carrera_piston_mm: 96.000,
    configuracion: 'L4 SOHC',
    aspiracion: 'Natural',
    anios: '1997 - 2008'
  },
  {
    id: 'mot-4',
    fabricante_id: 'fab-2',
    modelo_id: 'mod-4',
    codigo: 'Z24',
    nombre_comercial: '2.4L Gasolina SOHC 8V (Twin Spark)',
    cilindrada_cc: 2389,
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
    codigo: 'YD25DDTi',
    nombre_comercial: '2.5L Diésel Common Rail 16V Turbo',
    cilindrada_cc: 2488,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 16,
    diametro_cilindro_std_mm: 89.000,
    carrera_piston_mm: 100.000,
    configuracion: 'L4 DOHC 16V Turbo',
    aspiracion: 'Turbo Intercooler',
    anios: '2001 - 2019'
  },
  {
    id: 'mot-6',
    fabricante_id: 'fab-3',
    modelo_id: 'mod-6',
    codigo: '4D56 / 4D56T',
    nombre_comercial: '2.5L Turbo Diésel SOHC 8V',
    cilindrada_cc: 2477,
    combustible: 'Diésel',
    cilindros: 4,
    valvulas: 8,
    diametro_cilindro_std_mm: 91.100,
    carrera_piston_mm: 95.000,
    configuracion: 'L4 SOHC Balancines',
    aspiracion: 'Turbo Intercooler',
    anios: '1986 - 2016'
  },
  {
    id: 'mot-7',
    fabricante_id: 'fab-4',
    modelo_id: 'mod-7',
    codigo: '4JB1 / 4JB1-T',
    nombre_comercial: '2.8L Diésel Inyección Directa 8V',
    cilindrada_cc: 2771,
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

export const mockRepuestos: RepuestoTecnico[] = [
  // --- TOYOTA 3L ---
  {
    id: 'rep-3l-1',
    motor_id: 'mot-1',
    codigo_oem: '13711-54020',
    nombre: 'Válvula de Admisión STD',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 165.00,
    stock: 24,
    estado: 'Disponible',
    diametro_cabeza_mm: 42.500,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 103.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1, material: '21-4N Magnético' },
    equivalencias: [
      { id: 'eq-1', repuesto_id: 'rep-3l-1', marca_alterna: 'Dokuro', codigo_alterno: '21-2856', notas: 'Japón STD Cabeza 42.5mm' },
      { id: 'eq-2', repuesto_id: 'rep-3l-1', marca_alterna: 'NPR', codigo_alterno: '07-0050', notas: 'Acero nitrurado' }
    ]
  },
  {
    id: 'rep-3l-2',
    motor_id: 'mot-1',
    codigo_oem: '13715-54020',
    nombre: 'Válvula de Escape STD',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 185.00,
    stock: 24,
    estado: 'Disponible',
    diametro_cabeza_mm: 36.000,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 103.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1, material: '21-4N Stellite' },
    equivalencias: [
      { id: 'eq-3', repuesto_id: 'rep-3l-2', marca_alterna: 'Dokuro', codigo_alterno: '22-2856', notas: 'Japón STD Stellite' }
    ]
  },
  {
    id: 'rep-3l-3',
    motor_id: 'mot-1',
    codigo_oem: '13011-54120',
    nombre: 'Juego de Anillos de Pistón STD (96mm)',
    subsistema: 'Block',
    categoria: 'Anillos',
    precio: 890.00,
    stock: 12,
    estado: 'Disponible',
    diametro_cilindro_mm: 96.000,
    espesor_anillo1_mm: 2.000,
    espesor_anillo2_mm: 2.000,
    espesor_aceite_mm: 4.000,
    dimensiones: { cilindros: 4, tipo_anillo1: 'Semi-Keystone BF-IB' },
    equivalencias: [
      { id: 'eq-4', repuesto_id: 'rep-3l-3', marca_alterna: 'Rik', codigo_alterno: '28006', notas: 'Riken Japón 96.00mm STD' },
      { id: 'eq-5', repuesto_id: 'rep-3l-3', marca_alterna: 'NPR', codigo_alterno: 'SDT10124ZY', notas: 'NPR Japón OEM 2.0/2.0/4.0mm' }
    ]
  },
  {
    id: 'rep-3l-liner',
    motor_id: 'mot-1',
    codigo_oem: '11461-54100',
    nombre: 'Camisa de Cilindro Semiterminada con Pestaña',
    subsistema: 'Block',
    categoria: 'Camisas',
    precio: 450.00,
    stock: 16,
    estado: 'Disponible',
    diametro_cilindro_mm: 96.000,
    dimensiones: {
      diametro_interior_a: 96.0,
      diametro_exterior_b: 100.0,
      longitud_c: 180.0,
      pestana_d: 105.0,
      altura_pestana_e: 3.5,
      tipo: 'D02 Pestaña Acabado S'
    },
    equivalencias: [
      { id: 'eq-3l-l1', repuesto_id: 'rep-3l-liner', marca_alterna: 'NPR', codigo_alterno: 'L55312-AA', notas: 'Camisa NPR Ø96 x 100 x 180mm' }
    ]
  },
  {
    id: 'rep-3l-4',
    motor_id: 'mot-1',
    codigo_oem: '11701-54030',
    nombre: 'Juego de Cojinetes de Bancada STD',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 680.00,
    stock: 8,
    estado: 'Disponible',
    tipo_cojinete: 'MS',
    diametro_munon_mm: 62.000,
    diametro_alojamiento_mm: 67.000,
    ancho_casquete_mm: 23.000,
    dimensiones: { posiciones: 5, ranura_central: true },
    equivalencias: [
      { id: 'eq-6', repuesto_id: 'rep-3l-4', marca_alterna: 'NDC', codigo_alterno: 'MS-1140A', notas: 'NDC Main Bearing Set STD' },
      { id: 'eq-7', repuesto_id: 'rep-3l-4', marca_alterna: 'Taiho', codigo_alterno: 'M029A', notas: 'Taiho Japón Bancada STD' }
    ]
  },
  {
    id: 'rep-3l-5',
    motor_id: 'mot-1',
    codigo_oem: '13041-54030',
    nombre: 'Juego de Cojinetes de Biela STD',
    subsistema: 'Bielas',
    categoria: 'Casquetería',
    precio: 490.00,
    stock: 10,
    estado: 'Disponible',
    tipo_cojinete: 'CB',
    diametro_munon_mm: 53.000,
    diametro_alojamiento_mm: 56.000,
    ancho_casquete_mm: 24.000,
    dimensiones: { posiciones: 4 },
    equivalencias: [
      { id: 'eq-8', repuesto_id: 'rep-3l-5', marca_alterna: 'NDC', codigo_alterno: 'CB-1140A', notas: 'NDC Con-rod Bearing STD' },
      { id: 'eq-9', repuesto_id: 'rep-3l-5', marca_alterna: 'Taiho', codigo_alterno: 'R029A', notas: 'Taiho Japón Biela STD' }
    ]
  },
  {
    id: 'rep-3l-6',
    motor_id: 'mot-1',
    codigo_oem: '11011-54020',
    nombre: 'Arandela de Empuje / Axiales STD',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 240.00,
    stock: 15,
    estado: 'Disponible',
    tipo_cojinete: 'TW',
    dimensiones: { espesor_std_mm: 2.50 },
    equivalencias: [
      { id: 'eq-10', repuesto_id: 'rep-3l-6', marca_alterna: 'NDC', codigo_alterno: 'TW-1140A', notas: 'Thrust Washer NDC STD' },
      { id: 'eq-11', repuesto_id: 'rep-3l-6', marca_alterna: 'Taiho', codigo_alterno: 'T029A', notas: 'Taiho Japón Axial STD' }
    ]
  },
  {
    id: 'rep-3l-7',
    motor_id: 'mot-1',
    codigo_oem: '11115-54073',
    nombre: 'Empaque de Culata Grafito 3 Muescas',
    subsistema: 'Culata',
    categoria: 'Empaques',
    precio: 750.00,
    stock: 6,
    estado: 'Disponible',
    diametro_cilindro_mm: 97.000,
    dimensiones: { espesor_mm: 1.45, muescas: 3, diametro_piston: 96.0 },
    equivalencias: [
      { id: 'eq-12', repuesto_id: 'rep-3l-7', marca_alterna: 'Ajusa', codigo_alterno: '10074200', notas: 'Junta de culata grafito 1.45mm' }
    ]
  },
  {
    id: 'rep-3l-8',
    motor_id: 'mot-1',
    codigo_oem: '90913-02089',
    nombre: 'Juego Sellos de Válvula 8mm Vitón (8 uds)',
    subsistema: 'Sellos y Juntas',
    categoria: 'Sellos',
    precio: 320.00,
    stock: 20,
    estado: 'Disponible',
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 10.200,
    dimensiones: { diametro_interior_mm: 8.0, diametro_exterior_mm: 11.2, altura_mm: 10.2 },
    equivalencias: [
      { id: 'eq-13', repuesto_id: 'rep-3l-8', marca_alterna: 'Dokuro', codigo_alterno: 'OS-3L', notas: 'Retén de vitón alta temperatura' },
      { id: 'eq-14', repuesto_id: 'rep-3l-8', marca_alterna: 'Ajusa', codigo_alterno: '12013800', notas: 'Juego retenes válvula 8x11.2x10.2' }
    ]
  },
  {
    id: 'rep-3l-9',
    motor_id: 'mot-1',
    codigo_oem: '90910-02096',
    nombre: 'Juego de Tornillos de Culata M12 L=120mm',
    subsistema: 'Culata',
    categoria: 'Pernos',
    precio: 850.00,
    stock: 5,
    estado: 'Disponible',
    longitud_total_mm: 120.000,
    dimensiones: { rosca: 'M12x1.25', longitud_mm: 120, cabeza: 'Polydrive 12pt' },
    equivalencias: [
      { id: 'eq-15', repuesto_id: 'rep-3l-9', marca_alterna: 'Pioneer', codigo_alterno: 'HB-3L', notas: 'Pernos culata Grado 12.9' },
      { id: 'eq-16', repuesto_id: 'rep-3l-9', marca_alterna: 'Ajusa', codigo_alterno: '81014300', notas: 'Juego tornillos culata 18 uds' }
    ]
  },

  // --- NISSAN Z24 ---
  {
    id: 'rep-z24-1',
    motor_id: 'mot-4',
    codigo_oem: '13201-21W00',
    nombre: 'Válvula de Admisión STD Z24',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 145.00,
    stock: 32,
    estado: 'Disponible',
    diametro_cabeza_mm: 42.000,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 116.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-17', repuesto_id: 'rep-z24-1', marca_alterna: 'Dokuro', codigo_alterno: '11-2081', notas: 'Válvula admisión 42.0x8.0x116.5mm' }
    ]
  },
  {
    id: 'rep-z24-2',
    motor_id: 'mot-4',
    codigo_oem: '13202-21W00',
    nombre: 'Válvula de Escape STD Z24',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 160.00,
    stock: 32,
    estado: 'Disponible',
    diametro_cabeza_mm: 38.000,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 116.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-18', repuesto_id: 'rep-z24-2', marca_alterna: 'Dokuro', codigo_alterno: '12-2081', notas: 'Válvula escape 38.0x8.0x116.5mm' }
    ]
  },
  {
    id: 'rep-z24-3',
    motor_id: 'mot-4',
    codigo_oem: '12033-10W00',
    nombre: 'Juego de Anillos STD (89mm) Z24',
    subsistema: 'Block',
    categoria: 'Anillos',
    precio: 780.00,
    stock: 16,
    estado: 'Disponible',
    diametro_cilindro_mm: 89.000,
    espesor_anillo1_mm: 1.500,
    espesor_anillo2_mm: 1.500,
    espesor_aceite_mm: 4.000,
    dimensiones: { cilindros: 4, forma: 'BF-IB / T1 / NIFF-S' },
    equivalencias: [
      { id: 'eq-19', repuesto_id: 'rep-z24-3', marca_alterna: 'Rik', codigo_alterno: '20025', notas: 'Riken Japón 89mm STD' },
      { id: 'eq-20', repuesto_id: 'rep-z24-3', marca_alterna: 'NPR', codigo_alterno: 'SWN30059ZZ', notas: 'NPR Japón OEM 1.5/1.5/4.0mm' }
    ]
  },
  {
    id: 'rep-z24-4',
    motor_id: 'mot-4',
    codigo_oem: '12207-21W00',
    nombre: 'Juego Cojinetes de Bancada STD Z24',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 620.00,
    stock: 10,
    estado: 'Disponible',
    tipo_cojinete: 'MS',
    diametro_munon_mm: 60.000,
    diametro_alojamiento_mm: 64.000,
    ancho_casquete_mm: 22.000,
    dimensiones: { posiciones: 5 },
    equivalencias: [
      { id: 'eq-21', repuesto_id: 'rep-z24-4', marca_alterna: 'NDC', codigo_alterno: 'MS-1011A', notas: 'NDC Main Bearing STD' },
      { id: 'eq-22', repuesto_id: 'rep-z24-4', marca_alterna: 'Taiho', codigo_alterno: 'M083A', notas: 'Taiho Japón Bancada STD' }
    ]
  },
  {
    id: 'rep-z24-5',
    motor_id: 'mot-4',
    codigo_oem: '12111-21W00',
    nombre: 'Juego Cojinetes de Biela STD Z24',
    subsistema: 'Bielas',
    categoria: 'Casquetería',
    precio: 460.00,
    stock: 12,
    estado: 'Disponible',
    tipo_cojinete: 'CB',
    diametro_munon_mm: 50.000,
    diametro_alojamiento_mm: 53.000,
    ancho_casquete_mm: 20.000,
    dimensiones: { posiciones: 4 },
    equivalencias: [
      { id: 'eq-23', repuesto_id: 'rep-z24-5', marca_alterna: 'NDC', codigo_alterno: 'CB-1011A', notas: 'NDC Con-rod Bearing STD' },
      { id: 'eq-24', repuesto_id: 'rep-z24-5', marca_alterna: 'Taiho', codigo_alterno: 'R083A', notas: 'Taiho Japón Biela STD' }
    ]
  },
  {
    id: 'rep-z24-6',
    motor_id: 'mot-4',
    codigo_oem: '11044-20G00',
    nombre: 'Empaque de Culata Grafito Z24',
    subsistema: 'Culata',
    categoria: 'Empaques',
    precio: 680.00,
    stock: 8,
    estado: 'Disponible',
    diametro_cilindro_mm: 90.000,
    dimensiones: { espesor_mm: 1.30 },
    equivalencias: [
      { id: 'eq-25', repuesto_id: 'rep-z24-6', marca_alterna: 'Ajusa', codigo_alterno: '10032900', notas: 'Junta culata grafito reforzado' }
    ]
  },

  // --- TOYOTA 1KD-FTV ---
  {
    id: 'rep-1kd-1',
    motor_id: 'mot-2',
    codigo_oem: '13711-30010',
    nombre: 'Válvula Admisión 1KD/2KD 16V (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 190.00,
    stock: 32,
    estado: 'Disponible',
    diametro_cabeza_mm: 30.500,
    diametro_vastago_mm: 6.000,
    longitud_total_mm: 98.200,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-26', repuesto_id: 'rep-1kd-1', marca_alterna: 'Dokuro', codigo_alterno: '21-3001', notas: 'Adm 30.5x6.0x98.2mm' }
    ]
  },
  {
    id: 'rep-1kd-2',
    motor_id: 'mot-2',
    codigo_oem: '13715-30010',
    nombre: 'Válvula Escape 1KD/2KD 16V (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 210.00,
    stock: 32,
    estado: 'Disponible',
    diametro_cabeza_mm: 26.500,
    diametro_vastago_mm: 6.000,
    longitud_total_mm: 98.200,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-27', repuesto_id: 'rep-1kd-2', marca_alterna: 'Dokuro', codigo_alterno: '22-3001', notas: 'Esc 26.5x6.0x98.2mm Stellite' }
    ]
  },
  {
    id: 'rep-1kd-3',
    motor_id: 'mot-2',
    codigo_oem: '13011-30020',
    nombre: 'Juego de Anillos STD 1KD-FTV (96mm)',
    subsistema: 'Block',
    categoria: 'Anillos',
    precio: 1150.00,
    stock: 10,
    estado: 'Disponible',
    diametro_cilindro_mm: 96.000,
    espesor_anillo1_mm: 2.000,
    espesor_anillo2_mm: 1.500,
    espesor_aceite_mm: 3.000,
    dimensiones: { cilindros: 4, nitrurado: true },
    equivalencias: [
      { id: 'eq-28', repuesto_id: 'rep-1kd-3', marca_alterna: 'Rik', codigo_alterno: '28140', notas: '96mm STD 2.0x1.5x3.0' },
      { id: 'eq-29', repuesto_id: 'rep-1kd-3', marca_alterna: 'NPR', codigo_alterno: 'SDT10175ZY', notas: 'NPR Japón OEM 2.0/1.5/3.0mm' }
    ]
  },
  {
    id: 'rep-1kd-4',
    motor_id: 'mot-2',
    codigo_oem: '11701-30020',
    nombre: 'Juego Cojinetes Bancada 1KD',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 780.00,
    stock: 6,
    estado: 'Disponible',
    tipo_cojinete: 'MS',
    diametro_munon_mm: 70.000,
    diametro_alojamiento_mm: 75.000,
    ancho_casquete_mm: 22.000,
    dimensiones: { posiciones: 5 },
    equivalencias: [
      { id: 'eq-30', repuesto_id: 'rep-1kd-4', marca_alterna: 'NDC', codigo_alterno: 'MS-1166A', notas: 'Bancada MS 1KD STD' },
      { id: 'eq-31', repuesto_id: 'rep-1kd-4', marca_alterna: 'Taiho', codigo_alterno: 'M048A', notas: 'Bancada STD Japón' }
    ]
  },
  {
    id: 'rep-1kd-5',
    motor_id: 'mot-2',
    codigo_oem: '13041-30020',
    nombre: 'Juego Cojinetes Biela 1KD',
    subsistema: 'Bielas',
    categoria: 'Casquetería',
    precio: 560.00,
    stock: 8,
    estado: 'Disponible',
    tipo_cojinete: 'CB',
    diametro_munon_mm: 59.000,
    diametro_alojamiento_mm: 62.000,
    ancho_casquete_mm: 21.000,
    dimensiones: { posiciones: 4 },
    equivalencias: [
      { id: 'eq-32', repuesto_id: 'rep-1kd-5', marca_alterna: 'NDC', codigo_alterno: 'CB-1166A', notas: 'Biela CB 1KD STD' },
      { id: 'eq-33', repuesto_id: 'rep-1kd-5', marca_alterna: 'Taiho', codigo_alterno: 'R048A', notas: 'Biela STD Japón' }
    ]
  },
  {
    id: 'rep-1kd-6',
    motor_id: 'mot-2',
    codigo_oem: '11115-30031',
    nombre: 'Empaque de Culata Multilámina MLS 1KD',
    subsistema: 'Culata',
    categoria: 'Empaques',
    precio: 1280.00,
    stock: 8,
    estado: 'Disponible',
    diametro_cilindro_mm: 97.000,
    dimensiones: { tipo: 'MLS Multilámina acero', espesor_mm: 1.25 },
    equivalencias: [
      { id: 'eq-34', repuesto_id: 'rep-1kd-6', marca_alterna: 'Ajusa', codigo_alterno: '10156900', notas: 'Junta culata MLS 1KD-FTV' }
    ]
  },

  // --- MITSUBISHI 4D56 ---
  {
    id: 'rep-4d56-1',
    motor_id: 'mot-6',
    codigo_oem: 'MD016301',
    nombre: 'Válvula de Admisión 4D56 (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 155.00,
    stock: 20,
    estado: 'Disponible',
    diametro_cabeza_mm: 40.000,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 136.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-35', repuesto_id: 'rep-4d56-1', marca_alterna: 'Dokuro', codigo_alterno: '31-2311', notas: 'Adm 40.0x8.0x136.5mm' }
    ]
  },
  {
    id: 'rep-4d56-2',
    motor_id: 'mot-6',
    codigo_oem: 'MD016302',
    nombre: 'Válvula de Escape 4D56 (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 175.00,
    stock: 20,
    estado: 'Disponible',
    diametro_cabeza_mm: 34.000,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 136.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-36', repuesto_id: 'rep-4d56-2', marca_alterna: 'Dokuro', codigo_alterno: '32-2311', notas: 'Esc 34.0x8.0x136.5mm' }
    ]
  },
  {
    id: 'rep-4d56-3',
    motor_id: 'mot-6',
    codigo_oem: 'MD050355',
    nombre: 'Juego de Anillos STD (91.1mm) 4D56',
    subsistema: 'Block',
    categoria: 'Anillos',
    precio: 860.00,
    stock: 14,
    estado: 'Disponible',
    diametro_cilindro_mm: 91.100,
    espesor_anillo1_mm: 2.500,
    espesor_anillo2_mm: 2.000,
    espesor_aceite_mm: 4.000,
    dimensiones: { cilindros: 4, forma: 'BF-K2 / T1-K2 / E-BC16' },
    equivalencias: [
      { id: 'eq-37', repuesto_id: 'rep-4d56-3', marca_alterna: 'Rik', codigo_alterno: '28410', notas: '91.1mm STD' },
      { id: 'eq-38', repuesto_id: 'rep-4d56-3', marca_alterna: 'NPR', codigo_alterno: 'SDM31038ZX', notas: 'NPR Japón OEM 2.5/2.0/4.0mm' }
    ]
  },
  {
    id: 'rep-4d56-4',
    motor_id: 'mot-6',
    codigo_oem: 'MD100021',
    nombre: 'Juego Cojinetes Bancada 4D56',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 650.00,
    stock: 9,
    estado: 'Disponible',
    tipo_cojinete: 'MS',
    diametro_munon_mm: 66.000,
    diametro_alojamiento_mm: 70.000,
    ancho_casquete_mm: 23.000,
    dimensiones: { posiciones: 5 },
    equivalencias: [
      { id: 'eq-39', repuesto_id: 'rep-4d56-4', marca_alterna: 'NDC', codigo_alterno: 'MS-1804A', notas: 'Bancada MS 4D56 STD' },
      { id: 'eq-40', repuesto_id: 'rep-4d56-4', marca_alterna: 'Taiho', codigo_alterno: 'M075A', notas: 'Taiho Bancada STD' }
    ]
  },
  {
    id: 'rep-4d56-5',
    motor_id: 'mot-6',
    codigo_oem: 'MD100023',
    nombre: 'Juego Cojinetes Biela 4D56',
    subsistema: 'Bielas',
    categoria: 'Casquetería',
    precio: 470.00,
    stock: 12,
    estado: 'Disponible',
    tipo_cojinete: 'CB',
    diametro_munon_mm: 53.000,
    diametro_alojamiento_mm: 56.000,
    ancho_casquete_mm: 21.000,
    dimensiones: { posiciones: 4 },
    equivalencias: [
      { id: 'eq-41', repuesto_id: 'rep-4d56-5', marca_alterna: 'NDC', codigo_alterno: 'CB-1804A', notas: 'Biela CB 4D56 STD' },
      { id: 'eq-42', repuesto_id: 'rep-4d56-5', marca_alterna: 'Taiho', codigo_alterno: 'R075A', notas: 'Taiho Biela STD' }
    ]
  },
  {
    id: 'rep-4d56-6',
    motor_id: 'mot-6',
    codigo_oem: 'MD302889',
    nombre: 'Empaque de Culata Grafito 4D56',
    subsistema: 'Culata',
    categoria: 'Empaques',
    precio: 720.00,
    stock: 7,
    estado: 'Disponible',
    diametro_cilindro_mm: 92.000,
    dimensiones: { espesor_mm: 1.40 },
    equivalencias: [
      { id: 'eq-43', repuesto_id: 'rep-4d56-6', marca_alterna: 'Ajusa', codigo_alterno: '10070500', notas: 'Junta culata 4D56T' }
    ]
  },

  // --- ISUZU 4JB1 ---
  {
    id: 'rep-4jb1-1',
    motor_id: 'mot-7',
    codigo_oem: '8-94133221-0',
    nombre: 'Válvula Admisión 4JB1 (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 170.00,
    stock: 24,
    estado: 'Disponible',
    diametro_cabeza_mm: 43.500,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 109.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-44', repuesto_id: 'rep-4jb1-1', marca_alterna: 'Dokuro', codigo_alterno: '41-2401', notas: 'Adm 43.5x8.0x109.5mm' }
    ]
  },
  {
    id: 'rep-4jb1-2',
    motor_id: 'mot-7',
    codigo_oem: '8-94133222-0',
    nombre: 'Válvula Escape 4JB1 (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 190.00,
    stock: 24,
    estado: 'Disponible',
    diametro_cabeza_mm: 37.000,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 109.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-45', repuesto_id: 'rep-4jb1-2', marca_alterna: 'Dokuro', codigo_alterno: '42-2401', notas: 'Esc 37.0x8.0x109.5mm' }
    ]
  },
  {
    id: 'rep-4jb1-3',
    motor_id: 'mot-7',
    codigo_oem: '8-94247-867-0',
    nombre: 'Juego de Anillos STD (93mm) 4JB1',
    subsistema: 'Block',
    categoria: 'Anillos',
    precio: 920.00,
    stock: 12,
    estado: 'Disponible',
    diametro_cilindro_mm: 93.000,
    espesor_anillo1_mm: 2.000,
    espesor_anillo2_mm: 2.000,
    espesor_aceite_mm: 4.000,
    dimensiones: { cilindros: 4, forma: 'BF-K1 / T1 / NIFF-S' },
    equivalencias: [
      { id: 'eq-46', repuesto_id: 'rep-4jb1-3', marca_alterna: 'Rik', codigo_alterno: '22005', notas: '93mm STD' },
      { id: 'eq-47', repuesto_id: 'rep-4jb1-3', marca_alterna: 'NPR', codigo_alterno: 'SDI10110ZX', notas: 'NPR Japón OEM 2.0/2.0/4.0mm' }
    ]
  },
  {
    id: 'rep-4jb1-liner',
    motor_id: 'mot-7',
    codigo_oem: '8-97176-683-0',
    nombre: 'Camisa de Cilindro Semiterminada 4JB1',
    subsistema: 'Block',
    categoria: 'Camisas',
    precio: 460.00,
    stock: 16,
    estado: 'Disponible',
    diametro_cilindro_mm: 93.000,
    dimensiones: { diametro_interior_a: 93.0, diametro_exterior_b: 95.0, longitud_c: 165.0, tipo: 'Cilíndrica seca' },
    equivalencias: [
      { id: 'eq-4jb1-l1', repuesto_id: 'rep-4jb1-liner', marca_alterna: 'NPR', codigo_alterno: 'L65005-DA', notas: 'Camisa NPR Ø93 x 95 x 165mm' }
    ]
  },
  {
    id: 'rep-4jb1-4',
    motor_id: 'mot-7',
    codigo_oem: '8-94453520-0',
    nombre: 'Juego Cojinetes Bancada 4JB1',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 710.00,
    stock: 8,
    estado: 'Disponible',
    tipo_cojinete: 'MS',
    diametro_munon_mm: 70.000,
    diametro_alojamiento_mm: 75.000,
    ancho_casquete_mm: 25.000,
    dimensiones: { posiciones: 5 },
    equivalencias: [
      { id: 'eq-48', repuesto_id: 'rep-4jb1-4', marca_alterna: 'NDC', codigo_alterno: 'MS-1402A', notas: 'Bancada MS 4JB1 STD' },
      { id: 'eq-49', repuesto_id: 'rep-4jb1-4', marca_alterna: 'Taiho', codigo_alterno: 'M092A', notas: 'Taiho Bancada STD' }
    ]
  },
  {
    id: 'rep-4jb1-5',
    motor_id: 'mot-7',
    codigo_oem: '8-94453518-0',
    nombre: 'Juego Cojinetes Biela 4JB1',
    subsistema: 'Bielas',
    categoria: 'Casquetería',
    precio: 520.00,
    stock: 10,
    estado: 'Disponible',
    tipo_cojinete: 'CB',
    diametro_munon_mm: 53.000,
    diametro_alojamiento_mm: 56.000,
    ancho_casquete_mm: 22.000,
    dimensiones: { posiciones: 4 },
    equivalencias: [
      { id: 'eq-50', repuesto_id: 'rep-4jb1-5', marca_alterna: 'NDC', codigo_alterno: 'CB-1402A', notas: 'Biela CB 4JB1 STD' },
      { id: 'eq-51', repuesto_id: 'rep-4jb1-5', marca_alterna: 'Taiho', codigo_alterno: 'R092A', notas: 'Taiho Biela STD' }
    ]
  },
  {
    id: 'rep-4jb1-6',
    motor_id: 'mot-7',
    codigo_oem: '8-94332326-0',
    nombre: 'Empaque de Culata Grafito 4JB1',
    subsistema: 'Culata',
    categoria: 'Empaques',
    precio: 740.00,
    stock: 6,
    estado: 'Disponible',
    diametro_cilindro_mm: 94.000,
    dimensiones: { espesor_mm: 1.50 },
    equivalencias: [
      { id: 'eq-52', repuesto_id: 'rep-4jb1-6', marca_alterna: 'Ajusa', codigo_alterno: '10091000', notas: 'Junta culata 4JB1 Isuzu' }
    ]
  },

  // --- TOYOTA 5L / 5L-E ---
  {
    id: 'rep-5l-1',
    motor_id: 'mot-3',
    codigo_oem: '13711-54020',
    nombre: 'Válvula de Admisión STD 5L',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 175.00,
    stock: 24,
    estado: 'Disponible',
    diametro_cabeza_mm: 42.500,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 103.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-5l-1', repuesto_id: 'rep-5l-1', marca_alterna: 'Dokuro', codigo_alterno: '21-2856', notas: 'Japón STD Cabeza 42.5mm' }
    ]
  },
  {
    id: 'rep-5l-2',
    motor_id: 'mot-3',
    codigo_oem: '13715-54020',
    nombre: 'Válvula de Escape STD 5L',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 195.00,
    stock: 24,
    estado: 'Disponible',
    diametro_cabeza_mm: 36.000,
    diametro_vastago_mm: 8.000,
    longitud_total_mm: 103.500,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-5l-2', repuesto_id: 'rep-5l-2', marca_alterna: 'Dokuro', codigo_alterno: '22-2856', notas: 'Japón STD Stellite' }
    ]
  },
  {
    id: 'rep-5l-3',
    motor_id: 'mot-3',
    codigo_oem: '13011-54130',
    nombre: 'Juego de Anillos STD (99.5mm) 5L',
    subsistema: 'Block',
    categoria: 'Anillos',
    precio: 950.00,
    stock: 12,
    estado: 'Disponible',
    diametro_cilindro_mm: 99.500,
    espesor_anillo1_mm: 2.000,
    espesor_anillo2_mm: 1.500,
    espesor_aceite_mm: 4.000,
    dimensiones: { cilindros: 4, forma: 'BF-IB / T1 / NIFF-S' },
    equivalencias: [
      { id: 'eq-5l-3a', repuesto_id: 'rep-5l-3', marca_alterna: 'Rik', codigo_alterno: '28020', notas: 'Riken Japón 99.5mm STD' },
      { id: 'eq-5l-3b', repuesto_id: 'rep-5l-3', marca_alterna: 'NPR', codigo_alterno: 'SDT10167ZZ', notas: 'NPR Japón OEM 2.0/1.5/4.0mm' }
    ]
  },
  {
    id: 'rep-5l-4',
    motor_id: 'mot-3',
    codigo_oem: '11701-54030',
    nombre: 'Juego de Cojinetes de Bancada STD 5L',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 690.00,
    stock: 8,
    estado: 'Disponible',
    tipo_cojinete: 'MS',
    diametro_munon_mm: 62.000,
    diametro_alojamiento_mm: 67.000,
    ancho_casquete_mm: 23.000,
    equivalencias: [
      { id: 'eq-5l-4', repuesto_id: 'rep-5l-4', marca_alterna: 'NDC', codigo_alterno: 'MS-1140A', notas: 'NDC Main Bearing STD' }
    ]
  },
  {
    id: 'rep-5l-5',
    motor_id: 'mot-3',
    codigo_oem: '13041-54030',
    nombre: 'Juego de Cojinetes de Biela STD 5L',
    subsistema: 'Bielas',
    categoria: 'Casquetería',
    precio: 510.00,
    stock: 10,
    estado: 'Disponible',
    tipo_cojinete: 'CB',
    diametro_munon_mm: 53.000,
    diametro_alojamiento_mm: 56.000,
    ancho_casquete_mm: 24.000,
    equivalencias: [
      { id: 'eq-5l-5', repuesto_id: 'rep-5l-5', marca_alterna: 'NDC', codigo_alterno: 'CB-1140A', notas: 'NDC Con-rod Bearing STD' }
    ]
  },
  {
    id: 'rep-5l-6',
    motor_id: 'mot-3',
    codigo_oem: '11115-54130',
    nombre: 'Empaque de Culata Grafito 5L',
    subsistema: 'Culata',
    categoria: 'Empaques',
    precio: 780.00,
    stock: 7,
    estado: 'Disponible',
    diametro_cilindro_mm: 100.500,
    dimensiones: { espesor_mm: 1.45 },
    equivalencias: [
      { id: 'eq-5l-6', repuesto_id: 'rep-5l-6', marca_alterna: 'Ajusa', codigo_alterno: '10111400', notas: 'Junta culata 5L grafito' }
    ]
  },

  // --- NISSAN YD25DDTi ---
  {
    id: 'rep-yd25-1',
    motor_id: 'mot-5',
    codigo_oem: '13201-EB300',
    nombre: 'Válvula de Admisión YD25 Common Rail (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 185.00,
    stock: 32,
    estado: 'Disponible',
    diametro_cabeza_mm: 28.000,
    diametro_vastago_mm: 6.000,
    longitud_total_mm: 98.600,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-yd25-1', repuesto_id: 'rep-yd25-1', marca_alterna: 'Dokuro', codigo_alterno: '21-4112', notas: 'Admisión YD25 16V' }
    ]
  },
  {
    id: 'rep-yd25-2',
    motor_id: 'mot-5',
    codigo_oem: '13202-EB300',
    nombre: 'Válvula de Escape YD25 Common Rail (STD)',
    subsistema: 'Culata',
    categoria: 'Válvulas',
    precio: 205.00,
    stock: 32,
    estado: 'Disponible',
    diametro_cabeza_mm: 26.000,
    diametro_vastago_mm: 6.000,
    longitud_total_mm: 98.600,
    angulo_asiento_grados: 45.00,
    dimensiones: { ranuras: 1 },
    equivalencias: [
      { id: 'eq-yd25-2', repuesto_id: 'rep-yd25-2', marca_alterna: 'Dokuro', codigo_alterno: '22-4112', notas: 'Escape YD25 16V Stellite' }
    ]
  },
  {
    id: 'rep-yd25-3',
    motor_id: 'mot-5',
    codigo_oem: '12033-VK520',
    nombre: 'Juego de Anillos STD (89mm) YD25DDTi',
    subsistema: 'Block',
    categoria: 'Anillos',
    precio: 1180.00,
    stock: 10,
    estado: 'Disponible',
    diametro_cilindro_mm: 89.000,
    espesor_anillo1_mm: 2.000,
    espesor_anillo2_mm: 2.000,
    espesor_aceite_mm: 3.000,
    dimensiones: { cilindros: 4, nitrurado: true },
    equivalencias: [
      { id: 'eq-yd25-3', repuesto_id: 'rep-yd25-3', marca_alterna: 'NPR', codigo_alterno: 'SDN30182ZZ', notas: 'NPR Japón OEM 2.0/2.0/3.0mm' },
      { id: 'eq-yd25-3b', repuesto_id: 'rep-yd25-3', marca_alterna: 'Rik', codigo_alterno: '20185', notas: 'Riken Japón 89mm STD' }
    ]
  },
  {
    id: 'rep-yd25-4',
    motor_id: 'mot-5',
    codigo_oem: '12207-AD200',
    nombre: 'Juego Cojinetes de Bancada STD YD25',
    subsistema: 'Cigüeñal',
    categoria: 'Casquetería',
    precio: 720.00,
    stock: 8,
    estado: 'Disponible',
    tipo_cojinete: 'MS',
    diametro_munon_mm: 63.000,
    diametro_alojamiento_mm: 67.000,
    ancho_casquete_mm: 22.000,
    equivalencias: [
      { id: 'eq-yd25-4', repuesto_id: 'rep-yd25-4', marca_alterna: 'NDC', codigo_alterno: 'MS-1125A', notas: 'NDC Bancada MS YD25' }
    ]
  },
  {
    id: 'rep-yd25-5',
    motor_id: 'mot-5',
    codigo_oem: '12111-AD200',
    nombre: 'Juego Cojinetes de Biela STD YD25',
    subsistema: 'Bielas',
    categoria: 'Casquetería',
    precio: 540.00,
    stock: 10,
    estado: 'Disponible',
    tipo_cojinete: 'CB',
    diametro_munon_mm: 50.000,
    diametro_alojamiento_mm: 53.000,
    ancho_casquete_mm: 19.500,
    equivalencias: [
      { id: 'eq-yd25-5', repuesto_id: 'rep-yd25-5', marca_alterna: 'NDC', codigo_alterno: 'CB-1125A', notas: 'NDC Biela CB YD25' }
    ]
  },
  {
    id: 'rep-yd25-6',
    motor_id: 'mot-5',
    codigo_oem: '11044-VK505',
    nombre: 'Empaque de Culata Multilámina MLS YD25',
    subsistema: 'Culata',
    categoria: 'Empaques',
    precio: 1220.00,
    stock: 6,
    estado: 'Disponible',
    diametro_cilindro_mm: 90.000,
    dimensiones: { tipo: 'MLS Multilámina acero', espesor_mm: 1.15 },
    equivalencias: [
      { id: 'eq-yd25-6', repuesto_id: 'rep-yd25-6', marca_alterna: 'Ajusa', codigo_alterno: '10160800', notas: 'Junta culata MLS YD25DDTi' }
    ]
  }
]

export const catalogService = {
  /**
   * Obtiene la lista de fabricantes disponibles
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

      return data.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        nombre: String(item.nombre),
        pais_origen: item.pais_origen ? String(item.pais_origen) : undefined,
        logo_url: item.logo_url ? String(item.logo_url) : undefined,
        activo: Boolean(item.activo),
        orden_visual: Number(item.orden_visual || 0)
      }))
    } catch {
      return mockFabricantes
    }
  },

  /**
   * Obtiene modelos de vehículos, opcionalmente filtrados por fabricante
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
   * Obtiene motores filtrados por fabricante o modelo
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
        especificaciones_tecnicas: (item.especificaciones_tecnicas as Record<string, unknown>) || {},
        fabricante: item.fabricante as Fabricante | undefined,
        modelo: item.modelo as Modelo | undefined
      }))
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
   * Obtiene repuestos técnicos para un motor específico con su matriz de equivalencias
   */
  async getRepuestosByMotor(motorId: string, subsistema?: string): Promise<RepuestoTecnico[]> {
    try {
      let query = supabase
        .from('repuestos_tecnicos')
        .select('*, equivalencias:equivalencias_repuestos(*)')
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

      return data.map((item: Record<string, unknown>) => ({
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

        diametro_cabeza_mm: item.diametro_cabeza_mm ? Number(item.diametro_cabeza_mm) : null,
        diametro_vastago_mm: item.diametro_vastago_mm ? Number(item.diametro_vastago_mm) : null,
        longitud_total_mm: item.longitud_total_mm ? Number(item.longitud_total_mm) : null,
        angulo_asiento_grados: item.angulo_asiento_grados ? Number(item.angulo_asiento_grados) : null,

        diametro_cilindro_mm: item.diametro_cilindro_mm ? Number(item.diametro_cilindro_mm) : null,
        espesor_anillo1_mm: item.espesor_anillo1_mm ? Number(item.espesor_anillo1_mm) : null,
        espesor_anillo2_mm: item.espesor_anillo2_mm ? Number(item.espesor_anillo2_mm) : null,
        espesor_aceite_mm: item.espesor_aceite_mm ? Number(item.espesor_aceite_mm) : null,

        tipo_cojinete: item.tipo_cojinete ? String(item.tipo_cojinete) : null,
        diametro_munon_mm: item.diametro_munon_mm ? Number(item.diametro_munon_mm) : null,
        diametro_alojamiento_mm: item.diametro_alojamiento_mm ? Number(item.diametro_alojamiento_mm) : null,
        ancho_casquete_mm: item.ancho_casquete_mm ? Number(item.ancho_casquete_mm) : null,

        dimensiones: (item.dimensiones as Record<string, unknown>) || {},
        especificaciones_tecnicas: (item.especificaciones_tecnicas as Record<string, unknown>) || {},
        equivalencias: (item.equivalencias as Equivalencia[]) || []
      }))
    } catch {
      let filtered = mockRepuestos.filter(r => r.motor_id === motorId)
      if (subsistema && subsistema !== 'Todos') {
        filtered = filtered.filter(r => r.subsistema === subsistema)
      }
      return filtered
    }
  },

  /**
   * Búsqueda dimensional para adaptaciones de taller (Válvulas, Anillos, Cojinetes, Sellos)
   */
  async searchDimensional(filters: DimensionalFilter): Promise<RepuestoTecnico[]> {
    const tol = filters.tolerancia_mm !== undefined ? filters.tolerancia_mm : 0.5
    const all = mockRepuestos

    return all.filter(r => {
      // Filtrado por categoría si está especificada
      if (filters.categoria !== 'Todas' && r.categoria !== filters.categoria) {
        return false
      }

      // Filtro para Válvulas
      if (filters.categoria === 'Válvulas' || (!filters.categoria && r.categoria === 'Válvulas')) {
        if (filters.diametro_cabeza !== undefined && filters.diametro_cabeza > 0) {
          if (!r.diametro_cabeza_mm || Math.abs(r.diametro_cabeza_mm - filters.diametro_cabeza) > tol) {
            return false
          }
        }
        if (filters.diametro_vastago !== undefined && filters.diametro_vastago > 0) {
          if (!r.diametro_vastago_mm || Math.abs(r.diametro_vastago_mm - filters.diametro_vastago) > (tol > 0.1 ? 0.1 : tol)) {
            return false
          }
        }
        if (filters.longitud_total !== undefined && filters.longitud_total > 0) {
          if (!r.longitud_total_mm || Math.abs(r.longitud_total_mm - filters.longitud_total) > (tol * 2)) {
            return false
          }
        }
      }

      // Filtro para Anillos de Pistón
      if (filters.categoria === 'Anillos' || (!filters.categoria && r.categoria === 'Anillos')) {
        if (filters.diametro_cilindro !== undefined && filters.diametro_cilindro > 0) {
          if (!r.diametro_cilindro_mm || Math.abs(r.diametro_cilindro_mm - filters.diametro_cilindro) > tol) {
            return false
          }
        }
        if (filters.espesor_anillo1 !== undefined && filters.espesor_anillo1 > 0) {
          if (!r.espesor_anillo1_mm || Math.abs(r.espesor_anillo1_mm - filters.espesor_anillo1) > 0.15) {
            return false
          }
        }
        if (filters.espesor_anillo2 !== undefined && filters.espesor_anillo2 > 0) {
          if (!r.espesor_anillo2_mm || Math.abs(r.espesor_anillo2_mm - filters.espesor_anillo2) > 0.15) {
            return false
          }
        }
      }

      // Filtro para Casquetes / Cojinetes NDC
      if (filters.categoria === 'Casquetería' || (!filters.categoria && r.categoria === 'Casquetería')) {
        if (filters.tipo_cojinete && r.tipo_cojinete !== filters.tipo_cojinete) {
          return false
        }
        if (filters.diametro_munon !== undefined && filters.diametro_munon > 0) {
          if (!r.diametro_munon_mm || Math.abs(r.diametro_munon_mm - filters.diametro_munon) > tol) {
            return false
          }
        }
        if (filters.ancho_casquete !== undefined && filters.ancho_casquete > 0) {
          if (!r.ancho_casquete_mm || Math.abs(r.ancho_casquete_mm - filters.ancho_casquete) > tol) {
            return false
          }
        }
      }

      // Filtro para Sellos
      if (filters.categoria === 'Sellos' || (!filters.categoria && r.categoria === 'Sellos')) {
        if (filters.diametro_vastago !== undefined && filters.diametro_vastago > 0) {
          if (!r.diametro_vastago_mm || Math.abs(r.diametro_vastago_mm - filters.diametro_vastago) > 0.1) {
            return false
          }
        }
      }

      return true
    })
  },

  /**
   * Búsqueda inversa por código OEM o código alterno (Dokuro, Rik, NPR, NDC, Ajusa)
   */
  async searchByCodeOrKeyword(query: string): Promise<RepuestoTecnico[]> {
    if (!query || query.trim() === '') return []
    const q = query.toLowerCase().trim().replace(/[-\s]/g, '')

    return mockRepuestos.filter(r => {
      const matchOem = r.codigo_oem.toLowerCase().replace(/[-\s]/g, '').includes(q)
      const matchNombre = r.nombre.toLowerCase().includes(query.toLowerCase())
      const matchEquiv = r.equivalencias?.some(eq =>
        eq.codigo_alterno.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
        eq.marca_alterna.toLowerCase().includes(query.toLowerCase())
      )

      return matchOem || matchNombre || matchEquiv
    })
  },

  /**
   * getProducts() para soporte y retrocompatibilidad total con WorkOrderForm.vue
   */
  async getProducts(): Promise<CatalogProduct[]> {
    try {
      // Mapear repuestos técnicos a la estructura de CatalogProduct
      const technicalProducts: CatalogProduct[] = mockRepuestos.map(r => {
        // Encontrar cruce Dokuro o Rik o NDC si existe
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
