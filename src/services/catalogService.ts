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
  modelo_ids?: string[]
  modelos_nombres?: string[]
  numero_id?: number | string
  codigo: string
  nombre_comercial?: string
  denominacion_venta?: string
  cilindrada_cc?: number
  cilindrada_texto?: string
  kw?: number
  cv?: number
  combustible: string
  cilindros?: number
  valvulas?: number
  diametro_cilindro_std_mm?: number
  carrera_piston_mm?: number
  configuracion?: string
  aspiracion?: string
  anios?: string
  especificaciones_tecnicas?: Record<string, unknown>
  fabricante?: Fabricante
  modelo?: Modelo
  parts_count?: number
}

export interface Equivalencia {
  id: string
  repuesto_id: string
  marca_alterna: 'Dokuro' | 'Rik' | 'NDC' | 'Ajusa' | 'Pioneer' | 'Taiho' | 'Toto' | 'TIK' | string
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
  etiqueta_corta?: string
  unidad: string
  tipo_dato: ParametroTipoDato
  requerido: boolean
  filtrable?: boolean
  descripcion?: string
  opciones?: string[]
  valor_minimo?: number
  valor_maximo?: number
  columna_padre?: string // Columna superior/padre para sub-columnas (ej. "STD", "1er", "2da", "Diámetros")
  compartido_filas?: boolean // Si true en vista en tabla, comparte un único valor verticalmente entre todas las filas
}

export interface HeaderTier1Item<T = unknown> {
  id: string
  label: string
  isGroup: boolean
  colspan: number
  rowspan: number
  param?: T
  subParams?: T[]
}

export interface HeaderTier2Item<T = unknown> {
  id: string
  label: string
  unidad?: string
  param: T
}

export interface NestedHeadersResult<T = unknown> {
  hasSubcolumns: boolean
  tier1: HeaderTier1Item<T>[]
  tier2: HeaderTier2Item<T>[]
}

/**
 * Organiza columnas con sub-columnas en cabeceras HTML de dos niveles (rowspan / colspan).
 * ponytail: Utilidad pura y determinista sin dependencias externas.
 */
export function buildNestedTableHeaders<T extends { id: string; etiqueta: string; etiqueta_corta?: string; unidad?: string; columna_padre?: string }>(
  columns: T[]
): NestedHeadersResult<T> {
  const hasSubcolumns = columns.some(c => !!c.columna_padre && c.columna_padre.trim().length > 0)
  if (!hasSubcolumns) {
    return {
      hasSubcolumns: false,
      tier1: columns.map((c, idx) => ({
        id: c.id,
        label: c.etiqueta_corta?.trim() || c.etiqueta?.trim() || `Columna ${idx + 1}`,
        isGroup: false,
        colspan: 1,
        rowspan: 1,
        param: c
      })),
      tier2: []
    }
  }

  const tier1: HeaderTier1Item<T>[] = []
  const tier2: HeaderTier2Item<T>[] = []

  let currentParent: string | null = null
  let currentGroupChildren: T[] = []

  const flushGroup = () => {
    if (currentParent && currentGroupChildren.length > 0) {
      tier1.push({
        id: `grp-hdr-${currentParent}-${tier1.length}`,
        label: currentParent,
        isGroup: true,
        colspan: currentGroupChildren.length,
        rowspan: 1,
        subParams: [...currentGroupChildren]
      })
      for (const [cIdx, child] of currentGroupChildren.entries()) {
        tier2.push({
          id: child.id,
          label: child.etiqueta_corta?.trim() || child.etiqueta?.trim() || `Sub ${cIdx + 1}`,
          unidad: child.unidad,
          param: child
        })
      }
      currentParent = null
      currentGroupChildren = []
    }
  }

  for (const col of columns) {
    const parent = col.columna_padre?.trim()
    if (parent) {
      if (currentParent === parent) {
        currentGroupChildren.push(col)
      } else {
        flushGroup()
        currentParent = parent
        currentGroupChildren = [col]
      }
    } else {
      flushGroup()
      tier1.push({
        id: col.id,
        label: col.etiqueta_corta?.trim() || col.etiqueta?.trim() || `Columna ${tier1.length + 1}`,
        isGroup: false,
        colspan: 1,
        rowspan: 2,
        param: col
      })
    }
  }
  flushGroup()

  return { hasSubcolumns: true, tier1, tier2 }
}

const OPTION_BADGE_PALETTE = [
  'bg-white text-slate-600 border-slate-200 font-bold',           // 1ª opción: Blanco sutil (sin resaltar)
  'bg-amber-100 text-amber-900 border-amber-300 font-bold',       // 2ª opción: Amarillo
  'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold', // 3ª opción: Azul índigo
  'bg-sky-100 text-sky-900 border-sky-300 font-bold',             // 4ª opción: Azul
  'bg-purple-100 text-purple-900 border-purple-300 font-bold',    // 5ª opción: Morado
  'bg-rose-100 text-rose-900 border-rose-300 font-bold',          // 6ª opción: Rosa
  'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold'           // 7ª opción: Cian
] as const

export function getOptionBadgeClassByIndex(index: number): string {
  if (index < 0) return 'bg-slate-100 text-slate-700 border-slate-300 font-bold'
  return OPTION_BADGE_PALETTE[index % OPTION_BADGE_PALETTE.length]!
}

export function resolveOptionBadgeClass(value: unknown, opciones?: string[], isFilteredMatch?: boolean): string {
  const str = String(value ?? '').trim()
  if (!str) return 'bg-slate-50 text-slate-400 border-slate-200'
  const idx = Array.isArray(opciones)
    ? opciones.findIndex(o => o.trim().toLowerCase() === str.toLowerCase())
    : -1
  const base = getOptionBadgeClassByIndex(idx >= 0 ? idx : 0)
  return isFilteredMatch ? `${base} ring-2 ring-offset-1 ring-slate-900/30` : base
}

/** Normaliza un valor de parámetro tipo selección (string único, lista separada por comas o array) a string[]. */
export function parseMultiOptionValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of value) {
      const clean = String(item ?? '').trim()
      if (!clean) continue
      const key = clean.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(clean)
      }
    }
    return out
  }
  const str = String(value ?? '').trim()
  if (!str) return []
  const parts = str.split(',').map(s => s.trim()).filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const key = part.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(part)
    }
  }
  return out
}

/** Verifica si una opción está activa dentro de un valor único o múltiple. */
export function isOptionSelectedInValue(current: unknown, option: string): boolean {
  const target = option.trim().toLowerCase()
  if (!target) return false
  return parseMultiOptionValues(current).some(v => v.toLowerCase() === target)
}

/** Alterna una opción dentro de un campo multi-selección manteniendo el orden definido cuando existe. */
export function toggleMultiOptionValue(current: unknown, option: string, orderedOptions?: string[]): string[] {
  const cleanOpt = option.trim()
  const list = parseMultiOptionValues(current)
  const existsIdx = list.findIndex(v => v.toLowerCase() === cleanOpt.toLowerCase())
  if (existsIdx >= 0) {
    list.splice(existsIdx, 1)
  } else {
    list.push(cleanOpt)
  }
  if (Array.isArray(orderedOptions) && orderedOptions.length > 0) {
    const orderMap = new Map(orderedOptions.map((o, i) => [o.trim().toLowerCase(), i]))
    list.sort((a, b) => {
      const ia = orderMap.get(a.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
      const ib = orderMap.get(b.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
      return ia - ib
    })
  }
  return list
}

/** Normaliza perfiles legados de catálogos RIK/OEM (ej. RECTANGULAR, ESTÁNDAR) hacia las opciones unificadas de Diseño / Perfil. */
export function normalizeLegacyRingDesign(candidates: Array<unknown>, isConicalFallback = false): string {
  const raw = candidates.map(c => String(c ?? '').trim()).find(Boolean) || ''
  if (!raw) return isConicalFallback ? 'Cónico' : 'Plano'
  const up = raw.toUpperCase()
  if (
    up === 'RECTANGULAR' ||
    up === 'RECTANGULAR / PLANO' ||
    up === 'ESTANDAR' ||
    up === 'ESTÁNDAR' ||
    up === 'STANDARD' ||
    up === 'PLANO'
  ) {
    return isConicalFallback ? 'Cónico' : 'Plano'
  }
  if (up.includes('SEMI')) return 'Semi-cónico'
  if (up.includes('KEYSTONE') || up.includes('CÓNIC') || up.includes('CONIC')) return 'Cónico'
  if (up.includes('DOBLE ESPIRAL')) return 'Doble Espiral'
  if (up.includes('ESPIRAL')) return '1 Espiral'
  if (up.includes('ESCALON')) return 'Escalonado'
  return raw
}

/** Resuelve el valor de una celda en subfilas/anillos soportando claves canónicas y alias renombrados al editar familias. */
export function resolveSubfilaColumnValue(
  medidas: Record<string, any> | undefined,
  col: Pick<ParametroTecnicoDefinicion, 'clave' | 'etiqueta' | 'etiqueta_corta' | 'columna_padre'>
): unknown {
  if (!medidas) return undefined
  const isSet = (v: unknown) => v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0)
  if (isSet(medidas[col.clave])) return medidas[col.clave]

  const noSuffix = col.clave.replace(/_\d+$/, '')
  if (noSuffix !== col.clave && isSet(medidas[noSuffix])) return medidas[noSuffix]

  if (col.columna_padre) {
    const parentSlug = col.columna_padre
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    if (parentSlug && col.clave.startsWith(`${parentSlug}_`)) {
      const stripped = col.clave.slice(parentSlug.length + 1)
      if (isSet(medidas[stripped])) return medidas[stripped]
    }
  }

  const colKey = (col.clave || '').toLowerCase()
  const colLabel = (col.etiqueta_corta || col.etiqueta || '').toLowerCase()

  if (
    (colKey.includes('diametro') || colLabel.includes('diámetro') || colLabel.includes('diametro')) &&
    !colKey.includes('interior') &&
    !colKey.includes('exterior') &&
    !colKey.includes('vastago') &&
    !colKey.includes('cabeza') &&
    !colKey.includes('munon') &&
    !colKey.includes('alojamiento') &&
    !colKey.includes('bulon')
  ) {
    const d = medidas.diametro_cilindro_mm ?? medidas.diametro_de_cilindro ?? medidas.diametro ?? medidas.d1
    if (isSet(d)) return d
  }

  if (colKey.includes('grosor') || colLabel.includes('grosor') || colKey.includes('espesor') || colLabel.includes('espesor')) {
    const h = medidas.grosor_mm ?? medidas.grosor ?? medidas.h1
    if (isSet(h)) return h
  }

  if (colKey.includes('altura') || colLabel.includes('altura') || colKey.includes('radial')) {
    const a = medidas.altura_mm ?? medidas.altura ?? medidas.a1
    if (isSet(a)) return a
  }

  if (
    colKey.includes('diseno') ||
    colKey.includes('diseño') ||
    colKey.includes('perfil') ||
    colLabel.includes('diseño') ||
    colLabel.includes('diseno') ||
    colLabel.includes('perfil')
  ) {
    const raw =
      medidas.tipo_diseno ??
      medidas.diseno_perfil ??
      medidas.diseno ??
      medidas.identificador ??
      medidas.perfil ??
      medidas.forma
    if (isSet(raw)) return normalizeLegacyRingDesign([raw])
  }

  return undefined
}

/** Genera el nombre automático de una nueva fila usando la etiqueta del primer campo/columna + número consecutivo. */
export function buildNextAutoRowLabel(existingNames: string[], firstColTitle?: string, preferFirstCol = false): string {
  const titleClean = (firstColTitle || '').trim()
  const firstRow = (existingNames[0] || '').trim()
  const numberedMatch = firstRow.match(/^(.+?)\s+\d+$/)
  const firstRowBase = numberedMatch ? numberedMatch[1]!.trim() : ''

  let base = titleClean || 'Componente'
  if (!preferFirstCol && firstRowBase && firstRowBase.toLowerCase() !== 'fila') {
    base = firstRowBase
  } else if (
    titleClean.toLowerCase() === 'componente' &&
    firstRowBase &&
    firstRowBase.toLowerCase() !== 'fila'
  ) {
    base = firstRowBase
  }

  const used = new Set(existingNames.map(n => (n || '').trim().toLowerCase()))
  let num = existingNames.length + 1
  while (used.has(`${base.toLowerCase()} ${num}`)) {
    num++
  }
  return `${base} ${num}`
}

export interface RowClusterItem<T = string> {
  rowIdx: number
  name: T
  parent: string
}

export interface RowCluster<T = string> {
  key: string
  name: string
  isGrouped: boolean
  startIdx: number
  endIdx: number
  items: RowClusterItem<T>[]
}

export function buildRowClusters<T>(
  rows: T[],
  getParent: (row: T, idx: number) => string | undefined,
  isCentral?: (row: T, idx: number) => boolean
): RowCluster<T>[] {
  const clusters: RowCluster<T>[] = []
  let i = 0
  while (i < rows.length) {
    if (isCentral?.(rows[i]!, i)) {
      clusters.push({
        key: `r-central-${i}`,
        name: '',
        isGrouped: false,
        startIdx: i,
        endIdx: i,
        items: [{ rowIdx: i, name: rows[i]!, parent: '' }]
      })
      i++
      continue
    }
    const parentName = (getParent(rows[i]!, i) || '').trim()
    if (!parentName) {
      clusters.push({
        key: `r-single-${i}`,
        name: '',
        isGrouped: false,
        startIdx: i,
        endIdx: i,
        items: [{ rowIdx: i, name: rows[i]!, parent: '' }]
      })
      i++
    } else {
      const start = i
      const items: RowClusterItem<T>[] = []
      while (
        i < rows.length &&
        !isCentral?.(rows[i]!, i) &&
        (getParent(rows[i]!, i) || '').trim() === parentName
      ) {
        items.push({ rowIdx: i, name: rows[i]!, parent: parentName })
        i++
      }
      clusters.push({
        key: `r-group-${start}-${parentName}`,
        name: parentName,
        isGrouped: true,
        startIdx: start,
        endIdx: i - 1,
        items
      })
    }
  }
  return clusters
}

export interface RowSpanCellMeta {
  show: boolean
  rowspan: number
  label: string
}

export function buildRowSpanMeta<T>(
  rows: T[],
  getParent: (row: T, idx: number) => string | undefined,
  isCentral?: (row: T, idx: number) => boolean
): RowSpanCellMeta[] {
  const meta: RowSpanCellMeta[] = new Array(rows.length)
  let i = 0
  while (i < rows.length) {
    if (isCentral?.(rows[i]!, i)) {
      meta[i] = { show: false, rowspan: 0, label: '' }
      i++
      continue
    }
    const label = (getParent(rows[i]!, i) || '').trim()
    if (!label) {
      meta[i] = { show: true, rowspan: 1, label: '' }
      i++
    } else {
      const start = i
      while (
        i < rows.length &&
        !isCentral?.(rows[i]!, i) &&
        (getParent(rows[i]!, i) || '').trim() === label
      ) {
        i++
      }
      const span = i - start
      meta[start] = { show: true, rowspan: span, label }
      for (let j = start + 1; j < i; j++) {
        meta[j] = { show: false, rowspan: 0, label }
      }
    }
  }
  return meta
}

export interface NormalRowSegmentMeta {
  isCentral: boolean
  showShared: boolean
  sharedRowspan: number
}

/**
 * Calcula los segmentos contiguos de filas normales para que columnas con
 * `compartido_filas` (rowspan) nunca atraviesen una fila central (colspan total).
 */
export function buildNormalRowSegmentMeta(isCentralFlags: boolean[]): NormalRowSegmentMeta[] {
  const meta: NormalRowSegmentMeta[] = new Array(isCentralFlags.length)
  let i = 0
  while (i < isCentralFlags.length) {
    if (isCentralFlags[i]) {
      meta[i] = { isCentral: true, showShared: false, sharedRowspan: 0 }
      i++
      continue
    }
    const start = i
    while (i < isCentralFlags.length && !isCentralFlags[i]) {
      i++
    }
    const span = i - start
    meta[start] = { isCentral: false, showShared: true, sharedRowspan: span }
    for (let j = start + 1; j < i; j++) {
      meta[j] = { isCentral: false, showShared: false, sharedRowspan: 0 }
    }
  }
  return meta
}

export function sanitizeGroupParams(params: ParametroTecnicoDefinicion[]): ParametroTecnicoDefinicion[] {
  if (!Array.isArray(params)) return []
  const seen = new Map<string, number>()
  return params.map(p => {
    let key = p.clave
    if (p.columna_padre && p.columna_padre.trim()) {
      const parentSlug = p.columna_padre
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      if (parentSlug && !key.startsWith(parentSlug)) {
        key = `${parentSlug}_${key}`
      }
    }
    const count = seen.get(key) || 0
    if (count > 0) {
      let suffix = count + 1
      let uniqueKey = `${key}_${suffix}`
      while (seen.has(uniqueKey)) {
        suffix++
        uniqueKey = `${key}_${suffix}`
      }
      key = uniqueKey
    }
    seen.set(key, (seen.get(key) || 0) + 1)
    return { ...p, clave: key }
  })
}

export type GrupoTipoVista = 'normal' | 'tabla'

export interface RepuestoSubfilaItem {
  id?: string
  tipo: string
  nombre: string
  codigo: string
  grupo?: string
  es_fila_central?: boolean
  medidas: Record<string, any>
  extra?: Record<string, any>
}

export interface TablaConfiguracion {
  titulo_primera_columna: string
  titulo_grupo_filas?: string
  modo_filas: 'incremental' | 'libre' | 'cojinetes' | 'subfilas'
  usar_prefijo_titulo?: boolean
  etiqueta_ultima_fila?: string
  habilitar_identificador: boolean
  etiqueta_identificador: string
  opciones_identificador?: string[]
  subfilas_activas?: boolean
  tiene_cabecera_marca?: boolean
  etiqueta_marca?: string
  subfilas?: string[]
  subfila_padres?: string[]
  subfila_tipos?: Array<'normal' | 'central'>
}

export interface GrupoRepuesto {
  id: string
  codigo: string
  nombre: string
  categoria: string
  subsistema: string
  descripcion?: string
  icono?: string
  tipo_vista?: GrupoTipoVista
  tabla_config?: TablaConfiguracion
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
  tipo_vista?: GrupoTipoVista
  tabla_config?: TablaConfiguracion
  parametros: ParametroTecnicoDefinicion[]
  activo?: boolean
  orden_visual?: number
}

export interface DocumentoPdf {
  nombre: string
  url: string
  size?: number
  uploaded_at?: string
}

export interface DimensionesAnillo {
  posicion?: string
  tipo_aro?: 'fuego' | 'compresion' | 'aceite' | string
  d1?: number | null
  h1?: number | null
  a1?: number | null
  perfil?: string
  forma?: string
  diseno?: string
  identificador?: string
  codigo?: string
  [key: string]: unknown
}

export interface CasqueteriaSpec {
  tipo?: 'MS' | 'CB' | 'TW' | 'SH' | 'PB' | string
  std_min?: number | null
  std_max?: number | null
  ov_025_min?: number | null
  ov_025_max?: number | null
  ov_050_min?: number | null
  ov_050_max?: number | null
  ov_075_min?: number | null
  ov_075_max?: number | null
  [key: string]: unknown
}

export interface RepuestoTecnico {
  id: string
  motor_id?: string
  codigo_oem: string
  codigos_oem_adicionales?: string[]
  nombre: string
  subsistema: 'Culata' | 'Cigüeñal' | 'Block' | 'Bielas' | 'Sellos y Juntas' | string
  categoria: 'Válvulas' | 'Anillos' | 'Casquetería' | 'Sellos' | 'Empaques' | 'Pernos' | string
  precio: number
  stock: number
  estado: 'Disponible' | 'Bajo Stock' | 'Agotado'
  imagen_url?: string
  imagenes?: string[]
  documentos_pdf?: DocumentoPdf[]
  disenos_anillo?: string[]
  descripcion_tecnica?: string
  catalogo_origen?: 'Dokuro' | 'Rik' | 'NDC' | 'Ajusa' | 'Pioneer' | 'Taiho' | 'OEM' | string

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
  espesor_anillo3_mm?: number | null
  espesor_aceite_mm?: number | null
  diseno_conico?: boolean | null
  keystone?: string | null

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
  imagenes?: string[]
  documentos_pdf?: DocumentoPdf[]
  descripcion_tecnica?: string
  especificaciones_tecnicas?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

// =============================================================================
// SELECCIÓN ESTRICTA DE COLUMNAS, PAGINACIÓN POR CURSOR Y CACHÉ EN MEMORIA
// =============================================================================

export type PaginatedRepuestosList = RepuestoTecnico[] & {
  totalCount?: number
  hasMore?: boolean
  nextCursor?: string | null
}

export interface CatalogQueryOptions {
  cursor?: string
  limit?: number
  bypassCache?: boolean
}

export const REPUESTO_STRICT_COLUMNS = 
  'id,motor_id,codigo_oem,nombre,subsistema,categoria,precio,stock,estado,imagen_url,' +
  'diametro_cabeza_mm,diametro_vastago_mm,longitud_total_mm,angulo_asiento_grados,' +
  'diametro_cilindro_mm,espesor_anillo1_mm,espesor_anillo2_mm,espesor_aceite_mm,' +
  'tipo_cojinete,diametro_munon_mm,diametro_alojamiento_mm,ancho_casquete_mm,' +
  'dimensiones,especificaciones_tecnicas,' +
  'equivalencias:equivalencias_repuestos(id,repuesto_id,marca_alterna,codigo_alterno,tipo_referencia,notas,especificaciones_tecnicas),' +
  'motor:motores(id,fabricante_id,modelo_id,codigo,nombre_comercial,cilindrada_cc,combustible,cilindros,valvulas,diametro_cilindro_std_mm,anios,especificaciones_tecnicas,fabricante:fabricantes(id,nombre,logo_url),modelo:modelos(id,nombre))'

interface CacheEntry<T> {
  data: T
  timestamp: number
}
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutos

const partsCache = new Map<string, CacheEntry<PaginatedRepuestosList>>()
const countCache = new Map<string, CacheEntry<number>>()

export function clearCatalogPartsCache() {
  partsCache.clear()
  countCache.clear()
}

export async function getRepuestosCount(categoria?: string, subsistema?: string): Promise<number> {
  const countKey = `${categoria || ''}|${subsistema || ''}`
  const cached = countCache.get(countKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  try {
    let countQuery = supabase
      .from('repuestos_tecnicos')
      .select('*', { count: 'exact', head: true })
    if (categoria) {
      countQuery = countQuery.eq('categoria', categoria)
    }
    if (subsistema && subsistema !== 'Todos') {
      countQuery = countQuery.eq('subsistema', subsistema)
    }
    const { count, error } = await countQuery
    const res = (!error && count != null) ? count : 0
    countCache.set(countKey, { data: res, timestamp: Date.now() })
    return res
  } catch {
    return 0
  }
}

// =============================================================================
// DATOS MOCK REALISTAS DEL TALLER JR BLANCO (DOKURO, RIK, NDC, AJUSA, PIONEER)
// =============================================================================

export const LOCAL_GROUPS_STORAGE_KEY = 'swgora_grupos_repuestos_v1'
export const LOCAL_PARTS_STORAGE_KEY = 'swgora_custom_repuestos_v1'
export const LOCAL_BRANDS_STORAGE_KEY = 'swgora_custom_fabricantes_v1'
export const LOCAL_MOTORS_STORAGE_KEY = 'swgora_custom_motores_v1'
export const LOCAL_MODELS_STORAGE_KEY = 'swgora_custom_modelos_v1'

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
      { id: 'p_valv_1', clave: 'diametro_cabeza_mm', etiqueta: 'Hongo (Ø mm)', unidad: 'mm', tipo_dato: 'numero', requerido: true, descripcion: 'Diámetro mayor del plato o hongo' },
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
    descripcion: 'Juegos de aros de pistón (1°, 2°, aceite y perfiles Cónico / Espiral)',
    icono: 'Layers',
    tipo_vista: 'tabla',
    tabla_config: {
      titulo_primera_columna: 'Componente',
      modo_filas: 'subfilas',
      subfilas_activas: true,
      subfilas: ['1° Anillo (Fuego)', '2° Anillo (Compresión)', 'Anillo de aceite'],
      tiene_cabecera_marca: false,
      habilitar_identificador: false,
      etiqueta_identificador: ''
    },
    activo: true,
    orden_visual: 3,
    parametros: [
      { id: 'p_anil_1', clave: 'diametro_cilindro_mm', etiqueta: 'Diámetro', etiqueta_corta: 'Diámetro', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Calibre del orificio del cilindro' },
      { id: 'p_anil_2', clave: 'grosor_mm', etiqueta: 'Grosor', etiqueta_corta: 'Grosor', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Espesor o grosor axial del anillo' },
      { id: 'p_anil_3', clave: 'altura_mm', etiqueta: 'Altura', etiqueta_corta: 'Altura', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Altura o ancho radial del anillo' },
      { id: 'p_anil_4', clave: 'tipo_diseno', etiqueta: 'Diseño / Perfil', etiqueta_corta: 'Diseño', unidad: '', tipo_dato: 'seleccion', opciones: ['Cónico', 'Semi-cónico', 'Escalonado', '1 Espiral', 'Doble Espiral', 'Plano'], requerido: false, filtrable: true, descripcion: 'Perfil o tipo de diseño del anillo' }
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
  },
  {
    id: 'grp-7',
    codigo: 'camisas_cilindro',
    nombre: 'Camisas de cilindro',
    categoria: 'Camisas',
    subsistema: 'Block',
    descripcion: 'Camisas de cilindro terminadas y semiterminadas para bloque',
    icono: 'Layers',
    activo: true,
    orden_visual: 7,
    parametros: [
      { id: 'p_cam_1', clave: 'diametro_interior_mm', etiqueta: 'Diámetro Interior (A)', etiqueta_corta: 'A (INT)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro interior de la camisa (Cota A)' },
      { id: 'p_cam_2', clave: 'diametro_exterior_mm', etiqueta: 'Diámetro Exterior (B)', etiqueta_corta: 'B (EXT)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro exterior de la camisa (Cota B)' },
      { id: 'p_cam_3', clave: 'longitud_total_mm', etiqueta: 'Longitud Total (C)', etiqueta_corta: 'C (LARGO)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Largo o altura total de la camisa (Cota C)' },
      { id: 'p_cam_4', clave: 'diametro_pestana_mm', etiqueta: 'Diámetro Pestaña (D)', etiqueta_corta: 'D (PEST)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro exterior de la pestaña (Cota D)' },
      { id: 'p_cam_5', clave: 'espesor_pestana_mm', etiqueta: 'Espesor Pestaña (E)', etiqueta_corta: 'E (ESP)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Espesor o altura de la pestaña (Cota E)' },
      { id: 'p_cam_6', clave: 'acabado', etiqueta: 'Acabado', etiqueta_corta: 'Acabado', unidad: '', tipo_dato: 'seleccion', opciones: ['Terminada', 'Semiterminada'], requerido: false, filtrable: true, descripcion: 'Acabado de la camisa' },
      { id: 'p_cam_7', clave: 'tipo_camisa', etiqueta: 'Tipo', etiqueta_corta: 'Tipo', unidad: '', tipo_dato: 'texto', requerido: false, filtrable: true, descripcion: 'Tipo de camisa' }
    ]
  },
  {
    id: 'grp-8',
    codigo: 'guias_valvula',
    nombre: 'Guías de válvula',
    categoria: 'Guías',
    subsistema: 'Culata',
    descripcion: 'Guías de válvula para culata de motor (Admisión y Escape)',
    icono: 'Layers',
    activo: true,
    orden_visual: 8,
    parametros: [
      { id: 'p_gui_1', clave: 'posicion', etiqueta: 'Posición', etiqueta_corta: 'POS', unidad: '', tipo_dato: 'seleccion', opciones: ['IN (Admisión)', 'EX (Escape)'], requerido: true, filtrable: true, descripcion: 'Posición en culata' },
      { id: 'p_gui_2', clave: 'diametro_interior_mm', etiqueta: 'Diámetro Interior', etiqueta_corta: 'Ø Int', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro interior de la guía' },
      { id: 'p_gui_3', clave: 'diametro_exterior_mm', etiqueta: 'Diámetro Exterior', etiqueta_corta: 'Ø Ext', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro exterior de la guía' },
      { id: 'p_gui_4', clave: 'longitud_total_mm', etiqueta: 'Longitud Total', etiqueta_corta: 'Largo', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Largo total de la guía' },
      { id: 'p_gui_5', clave: 'juego_set', etiqueta: 'Juego / Set', etiqueta_corta: 'Set', unidad: 'piezas', tipo_dato: 'numero', requerido: false, filtrable: false, descripcion: 'Cantidad por juego' }
    ]
  },
  {
    id: 'grp-9',
    codigo: 'asientos_valvula',
    nombre: 'Asientos de válvula',
    categoria: 'Asientos',
    subsistema: 'Culata',
    descripcion: 'Asientos de válvula para culata de cilindros',
    icono: 'CircleDot',
    activo: true,
    orden_visual: 9,
    parametros: [
      { id: 'p_asi_1', clave: 'posicion', etiqueta: 'Posición', etiqueta_corta: 'POS', unidad: '', tipo_dato: 'seleccion', opciones: ['IN (Admisión)', 'EX (Escape)'], requerido: true, filtrable: true, descripcion: 'Posición en culata' },
      { id: 'p_asi_2', clave: 'diametro_exterior_mm', etiqueta: 'Diámetro Exterior', etiqueta_corta: 'Ø Ext', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro exterior del asiento' },
      { id: 'p_asi_3', clave: 'diametro_interior_mm', etiqueta: 'Diámetro Interior', etiqueta_corta: 'Ø Int', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro interior del asiento' },
      { id: 'p_asi_4', clave: 'altura_mm', etiqueta: 'Altura / Espesor', etiqueta_corta: 'Altura', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Altura o espesor del asiento' },
      { id: 'p_asi_5', clave: 'angulo_asiento_grados', etiqueta: 'Ángulo de Asiento', etiqueta_corta: 'Ángulo', unidad: '°', tipo_dato: 'numero', requerido: false, filtrable: true, descripcion: 'Ángulo de rectificación' }
    ]
  }
]

const LOCAL_DELETED_GROUPS_KEY = 'swgora_deleted_groups_v1'

function getLocalDeletedGroupKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_GROUPS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

function getLocalDynamicGrupos(): GrupoRepuesto[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_GROUPS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as GrupoRepuesto[]
  } catch {
    return []
  }
}

function removeLocalDynamicGrupo(idOrCode: string): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalDynamicGrupos().filter(g => g.id !== idOrCode && g.codigo !== idOrCode)
    localStorage.setItem(LOCAL_GROUPS_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error eliminando grupo de localStorage:', e)
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

function removeLocalCustomRepuesto(partId: string): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalCustomRepuestos().filter(p => p.id !== partId && p.codigo_oem !== partId)
    localStorage.setItem(LOCAL_PARTS_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error eliminando repuesto de localStorage:', e)
  }
}

function getLocalCustomFabricantes(): Fabricante[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_BRANDS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalCustomFabricante(fab: Fabricante): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalCustomFabricantes()
    const idx = list.findIndex(f => f.id === fab.id || f.nombre.toLowerCase() === fab.nombre.toLowerCase())
    if (idx >= 0) {
      list[idx] = fab
    } else {
      list.push(fab)
    }
    localStorage.setItem(LOCAL_BRANDS_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error guardando fabricante en localStorage:', e)
  }
}

function getLocalCustomMotores(): Motor[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_MOTORS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalCustomMotor(motor: Motor): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalCustomMotores()
    const idx = list.findIndex(m => m.id === motor.id || (m.codigo.toLowerCase() === motor.codigo.toLowerCase() && m.fabricante_id === motor.fabricante_id))
    if (idx >= 0) {
      list[idx] = motor
    } else {
      list.push(motor)
    }
    localStorage.setItem(LOCAL_MOTORS_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error guardando motor en localStorage:', e)
  }
}

function getLocalCustomModelos(): Modelo[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_MODELS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalCustomModelo(modelo: Modelo): void {
  if (typeof window === 'undefined') return
  try {
    const list = getLocalCustomModelos()
    const idx = list.findIndex(m => m.id === modelo.id || (m.nombre.toLowerCase() === modelo.nombre.toLowerCase() && m.fabricante_id === modelo.fabricante_id))
    if (idx >= 0) {
      list[idx] = modelo
    } else {
      list.push(modelo)
    }
    localStorage.setItem(LOCAL_MODELS_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Error guardando modelo en localStorage:', e)
  }
}

function isCatalogUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || '').trim())
}

function removeLocalCustomFabricante(id: string): void {
  if (typeof window !== 'undefined') {
    try {
      const nextFabs = getLocalCustomFabricantes().filter(f => f.id !== id)
      localStorage.setItem(LOCAL_BRANDS_STORAGE_KEY, JSON.stringify(nextFabs))
      const nextMods = getLocalCustomModelos().filter(m => m.fabricante_id !== id)
      localStorage.setItem(LOCAL_MODELS_STORAGE_KEY, JSON.stringify(nextMods))
      const nextMotors = getLocalCustomMotores().filter(m => m.fabricante_id !== id)
      localStorage.setItem(LOCAL_MOTORS_STORAGE_KEY, JSON.stringify(nextMotors))
    } catch {
      // Silencioso
    }
  }
  for (let i = mockFabricantes.length - 1; i >= 0; i--) {
    if (mockFabricantes[i]!.id === id) mockFabricantes.splice(i, 1)
  }
  for (let i = mockModelos.length - 1; i >= 0; i--) {
    if (mockModelos[i]!.fabricante_id === id) mockModelos.splice(i, 1)
  }
  for (let i = mockMotores.length - 1; i >= 0; i--) {
    if (mockMotores[i]!.fabricante_id === id) mockMotores.splice(i, 1)
  }
}

function removeLocalCustomModelo(id: string): void {
  if (typeof window !== 'undefined') {
    try {
      const nextMods = getLocalCustomModelos().filter(m => m.id !== id)
      localStorage.setItem(LOCAL_MODELS_STORAGE_KEY, JSON.stringify(nextMods))
      const nextMotors = getLocalCustomMotores().map(m => (m.modelo_id === id ? { ...m, modelo_id: undefined } : m))
      localStorage.setItem(LOCAL_MOTORS_STORAGE_KEY, JSON.stringify(nextMotors))
    } catch {
      // Silencioso
    }
  }
  for (let i = mockModelos.length - 1; i >= 0; i--) {
    if (mockModelos[i]!.id === id) mockModelos.splice(i, 1)
  }
  mockMotores.forEach(m => {
    if (m.modelo_id === id) m.modelo_id = undefined
  })
}

function removeLocalCustomMotor(id: string): void {
  if (typeof window !== 'undefined') {
    try {
      const nextMotors = getLocalCustomMotores().filter(m => m.id !== id)
      localStorage.setItem(LOCAL_MOTORS_STORAGE_KEY, JSON.stringify(nextMotors))
    } catch {
      // Silencioso
    }
  }
  for (let i = mockMotores.length - 1; i >= 0; i--) {
    if (mockMotores[i]!.id === id) mockMotores.splice(i, 1)
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

function resolveCatalogoOrigen(item: Record<string, unknown>, spec: Record<string, any>): string {
  if (item.catalogo_origen) return String(item.catalogo_origen)
  if (spec.marca_catalogo) {
    const mc = String(spec.marca_catalogo).toUpperCase()
    if (mc === 'DOKURO') return 'Dokuro'
    if (mc === 'MRK') return 'MRK'
    if (mc === 'RIK') return 'Rik'
    if (mc === 'NPR') return 'NPR'
    return String(spec.marca_catalogo)
  }
  if (spec.codigo_rik) return 'Rik'
  if (spec.codigo_mrk) return 'MRK'
  if (spec.codigo_npr) return 'NPR'
  if (spec.codigo_dokuro) return 'Dokuro'
  if (spec.codigo_taiho) return 'Taiho'
  if (typeof spec.fuente === 'string') {
    const f = spec.fuente.toLowerCase()
    if (f.includes('rik')) return 'Rik'
    if (f.includes('npr')) return 'NPR'
    if (f.includes('mrk')) return 'MRK'
  }
  return 'OEM'
}

/**
 * Mapea una fila de Supabase a RepuestoTecnico
 */
export function mapDbRepuestoToFrontend(item: Record<string, unknown>): RepuestoTecnico {
  const motorRaw = item.motor as Record<string, unknown> | undefined
  let motorData: Motor | undefined = undefined

  if (motorRaw) {
    const motorEspec = (motorRaw.especificaciones_tecnicas as Record<string, unknown>) || {}
    const motorSpecIds = Array.isArray(motorEspec.modelo_ids) ? motorEspec.modelo_ids.map(String).filter(Boolean) : []
    const motorSpecNames = Array.isArray(motorEspec.modelos_nombres) ? motorEspec.modelos_nombres.map(String).filter(Boolean) : []
    motorData = {
      id: String(motorRaw.id),
      fabricante_id: String(motorRaw.fabricante_id),
      modelo_id: motorRaw.modelo_id ? String(motorRaw.modelo_id) : undefined,
      modelo_ids: motorSpecIds.length > 0 ? motorSpecIds : undefined,
      modelos_nombres: motorSpecNames.length > 0 ? motorSpecNames : undefined,
      numero_id: motorEspec.numero_id ? (motorEspec.numero_id as number | string) : undefined,
      codigo: String(motorRaw.codigo),
      nombre_comercial: motorRaw.nombre_comercial ? String(motorRaw.nombre_comercial) : undefined,
      denominacion_venta: motorEspec.denominacion_venta ? String(motorEspec.denominacion_venta) : undefined,
      cilindrada_cc: motorRaw.cilindrada_cc ? Number(motorRaw.cilindrada_cc) : undefined,
      cilindrada_texto: motorEspec.cilindrada_texto ? String(motorEspec.cilindrada_texto) : (motorRaw.cilindrada_cc ? `${motorRaw.cilindrada_cc} cc` : undefined),
      kw: motorEspec.kw ? Number(motorEspec.kw) : undefined,
      cv: motorEspec.cv ? Number(motorEspec.cv) : undefined,
      combustible: String(motorRaw.combustible || 'Diésel'),
      cilindros: motorRaw.cilindros ? Number(motorRaw.cilindros) : undefined,
      valvulas: motorRaw.valvulas ? Number(motorRaw.valvulas) : undefined,
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
  const spec = (item.especificaciones_tecnicas as Record<string, unknown>) || {}

  const rawAdditionalOems =
    (Array.isArray(item.codigos_oem_adicionales) ? item.codigos_oem_adicionales : null) ||
    (Array.isArray(spec.codigos_oem_adicionales) ? spec.codigos_oem_adicionales : null) ||
    (Array.isArray(dims.codigos_oem_adicionales) ? dims.codigos_oem_adicionales : null) ||
    (Array.isArray(spec.referencias_oem) ? spec.referencias_oem : null) ||
    []

  // Separar códigos si vienen con comas, barras o saltos de línea
  const rawOemParts = String(item.codigo_oem || '')
    .split(/[,\/;|\n]+/)
    .map(c => c.trim().toUpperCase())
    .filter(Boolean)

  const primaryOem = rawOemParts[0] || String(item.codigo_oem || '')
  const oemFromMain = rawOemParts.slice(1)

  const extraFlat: string[] = []
  if (Array.isArray(rawAdditionalOems)) {
    for (const add of rawAdditionalOems) {
      extraFlat.push(...String(add || '').split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean))
    }
  } else if (typeof rawAdditionalOems === 'string') {
    extraFlat.push(...String(rawAdditionalOems).split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean))
  }

  const codigosOemAdicionales = Array.from(
    new Set([...oemFromMain, ...extraFlat].filter(c => c.length > 0 && c !== primaryOem))
  )

  const rawImagenes =
    (Array.isArray(item.imagenes) ? item.imagenes : null) ||
    (Array.isArray(spec.imagenes) ? spec.imagenes : null) ||
    (Array.isArray(dims.imagenes) ? dims.imagenes : null) ||
    []
  const basePrimaryImg = item.imagen_url ? String(item.imagen_url).trim() : ''
  const imagenesList = Array.from(
    new Set(
      [basePrimaryImg, ...rawImagenes.map(u => String(u || '').trim())].filter(Boolean)
    )
  )

  const rawDocs =
    (Array.isArray(item.documentos_pdf) ? item.documentos_pdf : null) ||
    (Array.isArray(spec.documentos_pdf) ? spec.documentos_pdf : null) ||
    (Array.isArray(dims.documentos_pdf) ? dims.documentos_pdf : null) ||
    []
  const documentosPdf: DocumentoPdf[] = rawDocs
    .filter((d: unknown): d is Record<string, unknown> => Boolean(d && typeof d === 'object' && (d as Record<string, unknown>).url))
    .map(d => ({
      nombre: String(d.nombre || 'Documento PDF'),
      url: String(d.url),
      size: d.size != null ? Number(d.size) : undefined,
      uploaded_at: d.uploaded_at ? String(d.uploaded_at) : undefined
    }))

  const rawDisenos =
    (Array.isArray(item.disenos_anillo) ? item.disenos_anillo : null) ||
    (Array.isArray(spec.disenos_anillo) ? spec.disenos_anillo : null) ||
    (Array.isArray(dims.disenos_anillo) ? dims.disenos_anillo : null) ||
    []
  const disenosAnillo = Array.from(
    new Set(rawDisenos.map(d => String(d || '').trim()).filter(Boolean))
  )

  const descripcionTecnica =
    (item.descripcion_tecnica ? String(item.descripcion_tecnica) : '') ||
    (spec.descripcion_tecnica ? String(spec.descripcion_tecnica) : '') ||
    (dims.descripcion_tecnica ? String(dims.descripcion_tecnica) : '') ||
    undefined

  return {
    id: String(item.id),
    motor_id: item.motor_id ? String(item.motor_id) : undefined,
    codigo_oem: primaryOem,
    codigos_oem_adicionales: codigosOemAdicionales,
    nombre: String(item.nombre),
    subsistema: String(item.subsistema),
    categoria: String(item.categoria),
    precio: Number(item.precio || 0),
    stock: Number(item.stock || 0),
    estado: (item.estado as RepuestoTecnico['estado']) || 'Disponible',
    imagen_url: imagenesList[0] || undefined,
    imagenes: imagenesList,
    documentos_pdf: documentosPdf,
    disenos_anillo: disenosAnillo,
    descripcion_tecnica: descripcionTecnica,
    catalogo_origen: resolveCatalogoOrigen(item, spec),

    diametro_cabeza_mm: item.diametro_cabeza_mm != null 
      ? Number(item.diametro_cabeza_mm) 
      : (dims.hongo_mm != null 
          ? Number(dims.hongo_mm) 
          : (dims.diametro_cabeza_mm != null ? Number(dims.diametro_cabeza_mm) : null)),
    diametro_vastago_mm: item.diametro_vastago_mm != null 
      ? Number(item.diametro_vastago_mm) 
      : (dims.diametro_vastago_mm != null ? Number(dims.diametro_vastago_mm) : null),
    longitud_total_mm: item.longitud_total_mm != null 
      ? Number(item.longitud_total_mm) 
      : (dims.longitud_total_mm != null ? Number(dims.longitud_total_mm) : null),
    angulo_asiento_grados: item.angulo_asiento_grados != null 
      ? Number(item.angulo_asiento_grados) 
      : (dims.angulo_asiento_grados != null ? Number(dims.angulo_asiento_grados) : null),

    diametro_interior_mm: item.diametro_interior_mm != null ? Number(item.diametro_interior_mm) : (dims.diametro_interior_mm != null ? Number(dims.diametro_interior_mm) : null),
    diametro_exterior_mm: item.diametro_exterior_mm != null ? Number(item.diametro_exterior_mm) : (dims.diametro_exterior_mm != null ? Number(dims.diametro_exterior_mm) : null),
    altura_mm: item.altura_mm != null ? Number(item.altura_mm) : (dims.altura_mm != null ? Number(dims.altura_mm) : null),

    diametro_cilindro_mm: item.diametro_cilindro_mm != null ? Number(item.diametro_cilindro_mm) : (dims.diametro_cilindro_mm != null ? Number(dims.diametro_cilindro_mm) : null),
    espesor_anillo1_mm: item.espesor_anillo1_mm != null ? Number(item.espesor_anillo1_mm) : (dims.espesor_anillo1_mm != null ? Number(dims.espesor_anillo1_mm) : null),
    espesor_anillo2_mm: item.espesor_anillo2_mm != null ? Number(item.espesor_anillo2_mm) : (dims.espesor_anillo2_mm != null ? Number(dims.espesor_anillo2_mm) : null),
    espesor_anillo3_mm: item.espesor_anillo3_mm != null ? Number(item.espesor_anillo3_mm) : (dims.espesor_anillo3_mm != null ? Number(dims.espesor_anillo3_mm) : null),
    espesor_aceite_mm: item.espesor_aceite_mm != null ? Number(item.espesor_aceite_mm) : (dims.espesor_aceite_mm != null ? Number(dims.espesor_aceite_mm) : null),
    diseno_conico: dims.diseno_conico != null ? Boolean(dims.diseno_conico) : (spec.diseno_conico != null ? Boolean(spec.diseno_conico) : false),
    keystone: dims.keystone ? String(dims.keystone) : (spec.keystone ? String(spec.keystone) : null),

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

/**
 * Normaliza texto para comparar/buscar: minúsculas, sin tildes y sin espacios repetidos.
 * Debe coincidir con la función SQL public.normalizar_texto.
 */
export const normalizeText = (t: string): string =>
  (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const extractModelTokensFromRaw = (
  specObj?: Record<string, unknown> | null,
  dimsObj?: Record<string, unknown> | null
): string[] => {
  const s = specObj || {}
  const d = dimsObj || {}
  const rawEntries = [
    ...(Array.isArray(s.modelos) ? s.modelos.map(String) : []),
    ...(Array.isArray(d.modelos) ? d.modelos.map(String) : []),
    ...(Array.isArray(s.modelos_adicionales) ? s.modelos_adicionales.map(String) : []),
    ...(Array.isArray(d.modelos_adicionales) ? d.modelos_adicionales.map(String) : []),
    s.modelo ? String(s.modelo) : '',
    d.modelo ? String(d.modelo) : ''
  ].filter(Boolean)

  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of rawEntries) {
    for (const tok of String(entry).split(/[,\/;|\n]+/)) {
      const clean = tok.replace(/\s+/g, ' ').trim()
      if (!clean) continue
      const low = clean.toLowerCase()
      if (low === 'n/a' || low === 'na' || low === 'universal' || low === 'varios' || low === '-' || low === '—') {
        continue
      }
      const key = normalizeText(clean)
      if (key && !seen.has(key)) {
        seen.add(key)
        out.push(clean)
      }
    }
  }
  return out
}

const extractPartModelTokens = (part: Partial<RepuestoTecnico>): string[] => {
  return extractModelTokensFromRaw(
    (part.especificaciones_tecnicas as Record<string, unknown>) || {},
    (part.dimensiones as Record<string, unknown>) || {}
  )
}

export const catalogService = {
  /**
   * Obtiene la lista de fabricantes disponibles
   */
  /**
   * Obtiene la lista de fabricantes disponibles desde Supabase con recuento dinámico de motores
   */
  async getFabricantes(): Promise<Fabricante[]> {
    const localFabs = getLocalCustomFabricantes()
    try {
      const { data, error } = await supabase
        .from('fabricantes')
        .select('*')
        .eq('activo', true)
        .order('orden_visual', { ascending: true })

      if (error || !data || data.length === 0) {
        const merged = [...mockFabricantes]
        for (const loc of localFabs) {
          if (!merged.some(f => f.id === loc.id || f.nombre.toLowerCase() === loc.nombre.toLowerCase())) {
            merged.push(loc)
          }
        }
        return merged
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

      const dbFabs: Fabricante[] = data.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        nombre: String(item.nombre),
        pais_origen: item.pais_origen ? String(item.pais_origen) : undefined,
        logo_url: item.logo_url ? String(item.logo_url) : undefined,
        activo: Boolean(item.activo),
        orden_visual: Number(item.orden_visual || 0),
        engines_count: countMap[String(item.id)] || undefined
      }))

      for (const loc of localFabs) {
        if (!dbFabs.some(f => f.id === loc.id || f.nombre.toLowerCase() === loc.nombre.toLowerCase())) {
          dbFabs.push(loc)
        }
      }

      return dbFabs
    } catch {
      const merged = [...mockFabricantes]
      for (const loc of localFabs) {
        if (!merged.some(f => f.id === loc.id || f.nombre.toLowerCase() === loc.nombre.toLowerCase())) {
          merged.push(loc)
        }
      }
      return merged
    }
  },

  /**
   * Registra un nuevo fabricante/marca en Supabase con respaldo local inmediato
   */
  async createFabricante(fabData: { nombre: string; pais_origen?: string; tipo?: FabricanteTipo }): Promise<Fabricante> {
    const cleanName = fabData.nombre.trim()
    const newFab: Fabricante = {
      id: `fab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nombre: cleanName,
      pais_origen: fabData.pais_origen?.trim() || 'Internacional',
      tipo: fabData.tipo || 'OEM',
      activo: true,
      orden_visual: 50,
      engines_count: 0
    }

    try {
      const { data, error } = await supabase
        .from('fabricantes')
        .insert({
          nombre: newFab.nombre,
          pais_origen: newFab.pais_origen,
          activo: true,
          orden_visual: newFab.orden_visual
        })
        .select('*')
        .single()

      if (!error && data) {
        newFab.id = String(data.id)
      }
    } catch (err) {
      console.warn('[CatalogService] Inserción de fabricante en Supabase falló, guardando localmente:', err)
    }

    saveLocalCustomFabricante(newFab)
    if (!mockFabricantes.some(f => f.id === newFab.id || f.nombre.toLowerCase() === newFab.nombre.toLowerCase())) {
      mockFabricantes.push(newFab)
    }
    return newFab
  },

  /**
   * Actualiza un fabricante/marca existente en Supabase y caché local
   */
  async updateFabricante(id: string, fabData: { nombre: string; pais_origen?: string }): Promise<Fabricante> {
    const cleanName = fabData.nombre.trim().toUpperCase()
    const cleanCountry = fabData.pais_origen?.trim() || 'Internacional'

    let updated: Fabricante = {
      id,
      nombre: cleanName,
      pais_origen: cleanCountry,
      tipo: 'OEM',
      activo: true,
      orden_visual: 50
    }

    try {
      const { data, error } = await supabase
        .from('fabricantes')
        .update({ nombre: cleanName, pais_origen: cleanCountry })
        .eq('id', id)
        .select('*')
        .maybeSingle()

      if (!error && data) {
        updated = {
          ...updated,
          id: String(data.id),
          nombre: String(data.nombre),
          pais_origen: data.pais_origen ? String(data.pais_origen) : cleanCountry
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Error actualizando fabricante en Supabase:', err)
    }

    const localList = getLocalCustomFabricantes()
    const localIdx = localList.findIndex(f => f.id === id)
    if (localIdx >= 0) {
      localList[localIdx] = { ...localList[localIdx], ...updated }
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_BRANDS_STORAGE_KEY, JSON.stringify(localList))
      }
    }
    const mockIdx = mockFabricantes.findIndex(f => f.id === id)
    if (mockIdx >= 0) mockFabricantes[mockIdx] = { ...mockFabricantes[mockIdx], ...updated }

    return updated
  },

  /**
   * Elimina un fabricante/marca de Supabase y caché local
   */
  async deleteFabricante(id: string): Promise<boolean> {
    if (isCatalogUuid(id)) {
      const { error } = await supabase.from('fabricantes').delete().eq('id', id)
      if (error) {
        throw new Error(error.message || 'No se pudo eliminar la marca en la base de datos')
      }
    }
    removeLocalCustomFabricante(id)
    return true
  },

  /**
   * Obtiene modelos de vehículos desde Supabase, opcionalmente filtrados por fabricante
   */
  async getModelos(fabricanteId?: string): Promise<Modelo[]> {
    const localMods = getLocalCustomModelos()
    try {
      let query = supabase.from('modelos').select('*').eq('activo', true)
      if (fabricanteId) {
        query = query.eq('fabricante_id', fabricanteId)
      }

      const { data, error } = await query.order('nombre', { ascending: true })

      // Solo se usan datos de respaldo si hubo error, o si la BD está vacía y no se filtró por marca
      if (error || !data || (data.length === 0 && !fabricanteId)) {
        const base = fabricanteId ? mockModelos.filter(m => m.fabricante_id === fabricanteId) : [...mockModelos]
        for (const loc of localMods) {
          if ((!fabricanteId || loc.fabricante_id === fabricanteId) && !base.some(m => m.id === loc.id || (m.nombre.toLowerCase() === loc.nombre.toLowerCase() && m.fabricante_id === loc.fabricante_id))) {
            base.push(loc)
          }
        }
        return base
      }

      const dbMods: Modelo[] = data.map((item: Record<string, unknown>) => ({
        id: String(item.id),
        fabricante_id: String(item.fabricante_id),
        nombre: String(item.nombre),
        anio_inicio: item.anio_inicio ? Number(item.anio_inicio) : undefined,
        anio_fin: item.anio_fin ? Number(item.anio_fin) : undefined,
        activo: Boolean(item.activo)
      }))

      for (const loc of localMods) {
        if ((!fabricanteId || loc.fabricante_id === fabricanteId) && !dbMods.some(m => m.id === loc.id || (m.nombre.toLowerCase() === loc.nombre.toLowerCase() && m.fabricante_id === loc.fabricante_id))) {
          dbMods.push(loc)
        }
      }

      return dbMods
    } catch {
      const base = fabricanteId ? mockModelos.filter(m => m.fabricante_id === fabricanteId) : [...mockModelos]
      for (const loc of localMods) {
        if ((!fabricanteId || loc.fabricante_id === fabricanteId) && !base.some(m => m.id === loc.id || (m.nombre.toLowerCase() === loc.nombre.toLowerCase() && m.fabricante_id === loc.fabricante_id))) {
          base.push(loc)
        }
      }
      return base
    }
  },

  /**
   * Crea un modelo para un fabricante (o devuelve el existente si ya hay uno equivalente,
   * sin distinguir mayúsculas ni tildes). Usa la función SQL public.crear_modelo con respaldo local.
   */
  async createModelo(fabricanteId: string, nombre: string, anioInicio?: number, anioFin?: number): Promise<Modelo> {
    const limpio = nombre.replace(/\s+/g, ' ').trim()
    if (!fabricanteId || !limpio) throw new Error('Indica la marca y el nombre del modelo')

    const fallbackMod: Modelo = {
      id: `mod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fabricante_id: fabricanteId,
      nombre: limpio,
      anio_inicio: anioInicio || undefined,
      anio_fin: anioFin || undefined,
      activo: true
    }

    try {
      const { data, error } = await supabase.rpc('crear_modelo', { p_fabricante_id: fabricanteId, p_nombre: limpio })
      if (!error && data) {
        const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
        if (row && row.id) {
          fallbackMod.id = String(row.id)
          fallbackMod.fabricante_id = String(row.fabricante_id || fabricanteId)
          fallbackMod.nombre = String(row.nombre || limpio)
          if (anioInicio || anioFin) {
            await supabase
              .from('modelos')
              .update({ anio_inicio: anioInicio ?? null, anio_fin: anioFin ?? null })
              .eq('id', fallbackMod.id)
          }
          if (anioInicio || row.anio_inicio) fallbackMod.anio_inicio = Number(anioInicio || row.anio_inicio)
          if (anioFin || row.anio_fin) fallbackMod.anio_fin = Number(anioFin || row.anio_fin)
        }
      } else {
        const { data: insData, error: insError } = await supabase
          .from('modelos')
          .insert({
            fabricante_id: fabricanteId,
            nombre: limpio,
            anio_inicio: anioInicio || null,
            anio_fin: anioFin || null,
            activo: true
          })
          .select('*')
          .single()
        if (!insError && insData) {
          fallbackMod.id = String(insData.id)
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Respaldo local al crear modelo:', err)
    }

    saveLocalCustomModelo(fallbackMod)
    if (!mockModelos.some(m => m.id === fallbackMod.id || (m.nombre.toLowerCase() === fallbackMod.nombre.toLowerCase() && m.fabricante_id === fallbackMod.fabricante_id))) {
      mockModelos.push(fallbackMod)
    }
    return fallbackMod
  },

  /**
   * Actualiza un modelo de vehículo (nombre, marca y años) en Supabase y caché local
   */
  async updateModelo(
    id: string,
    modData: { nombre: string; fabricante_id?: string; anio_inicio?: number | null; anio_fin?: number | null }
  ): Promise<Modelo> {
    const limpio = modData.nombre.replace(/\s+/g, ' ').trim().toUpperCase()
    let updated: Modelo = {
      id,
      fabricante_id: modData.fabricante_id || '',
      nombre: limpio,
      anio_inicio: modData.anio_inicio ?? undefined,
      anio_fin: modData.anio_fin ?? undefined,
      activo: true
    }

    try {
      const payload: Record<string, unknown> = {
        nombre: limpio,
        anio_inicio: modData.anio_inicio ?? null,
        anio_fin: modData.anio_fin ?? null
      }
      if (modData.fabricante_id) payload.fabricante_id = modData.fabricante_id

      const { data, error } = await supabase
        .from('modelos')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle()

      if (!error && data) {
        updated = {
          id: String(data.id),
          fabricante_id: String(data.fabricante_id),
          nombre: String(data.nombre),
          anio_inicio: data.anio_inicio ? Number(data.anio_inicio) : undefined,
          anio_fin: data.anio_fin ? Number(data.anio_fin) : undefined,
          activo: Boolean(data.activo)
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Error actualizando modelo en Supabase:', err)
    }

    const localList = getLocalCustomModelos()
    const localIdx = localList.findIndex(m => m.id === id)
    if (localIdx >= 0) {
      localList[localIdx] = { ...localList[localIdx], ...updated }
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_MODELS_STORAGE_KEY, JSON.stringify(localList))
      }
    }
    const mockIdx = mockModelos.findIndex(m => m.id === id)
    if (mockIdx >= 0) mockModelos[mockIdx] = { ...mockModelos[mockIdx], ...updated }

    return updated
  },

  /**
   * Elimina un modelo de vehículo en Supabase y limpia sus vínculos
   */
  async deleteModelo(id: string): Promise<boolean> {
    if (isCatalogUuid(id)) {
      await supabase.from('modelo_motor').delete().eq('modelo_id', id)
      await supabase.from('motores').update({ modelo_id: null }).eq('modelo_id', id)
      const { error } = await supabase.from('modelos').delete().eq('id', id)
      if (error) {
        throw new Error(error.message || 'No se pudo eliminar el modelo en la base de datos')
      }
    }
    removeLocalCustomModelo(id)
    return true
  },

  /**
   * IDs de motores asociados a un modelo (relación N:M modelo_motor + vínculo antiguo motores.modelo_id + respaldo local)
   */
  async getMotorIdsByModelo(modeloId: string): Promise<string[]> {
    const ids = new Set<string>()
    try {
      const { data: links } = await supabase
        .from('modelo_motor').select('motor_id').eq('modelo_id', modeloId).not('motor_id', 'is', null)
      ;(links || []).forEach((l: Record<string, unknown>) => ids.add(String(l.motor_id)))
      const { data: legacy } = await supabase.from('motores').select('id').eq('modelo_id', modeloId)
      ;(legacy || []).forEach((l: Record<string, unknown>) => ids.add(String(l.id)))
    } catch (err) {
      console.warn('[CatalogService] Error consultando motores por modelo:', err)
    }

    for (const m of [...getLocalCustomMotores(), ...mockMotores]) {
      const extraIds = Array.isArray((m.especificaciones_tecnicas as any)?.modelo_ids)
        ? ((m.especificaciones_tecnicas as any).modelo_ids as string[])
        : []
      if (m.modelo_id === modeloId || m.modelo_ids?.includes(modeloId) || extraIds.includes(modeloId)) {
        ids.add(m.id)
      }
    }
    return [...ids]
  },

  /**
   * IDs de modelos que comparten un motor (el mismo motor puede montarse en varios modelos)
   */
  async getModeloIdsByMotor(motorId: string): Promise<string[]> {
    const ids = new Set<string>()
    try {
      const { data: links } = await supabase.from('modelo_motor').select('modelo_id').eq('motor_id', motorId)
      ;(links || []).forEach((l: Record<string, unknown>) => ids.add(String(l.modelo_id)))
      const { data: legacy } = await supabase.from('motores').select('modelo_id, especificaciones_tecnicas').eq('id', motorId)
      ;(legacy || []).forEach((l: Record<string, unknown>) => {
        if (l.modelo_id) ids.add(String(l.modelo_id))
        const specIds = (l.especificaciones_tecnicas as Record<string, unknown> | undefined)?.modelo_ids
        if (Array.isArray(specIds)) {
          specIds.forEach(x => { if (x) ids.add(String(x)) })
        }
      })
    } catch (err) {
      console.warn('[CatalogService] Error consultando modelos por motor:', err)
    }

    for (const m of [...getLocalCustomMotores(), ...mockMotores]) {
      if (m.id === motorId) {
        if (m.modelo_id) ids.add(m.modelo_id)
        m.modelo_ids?.forEach(x => { if (x) ids.add(x) })
        const specIds = (m.especificaciones_tecnicas as Record<string, unknown> | undefined)?.modelo_ids
        if (Array.isArray(specIds)) {
          specIds.forEach(x => { if (x) ids.add(String(x)) })
        }
      }
    }
    return [...ids]
  },

  /**
   * Sincroniza la lista exacta de modelos asociados a un motor en la tabla N:M modelo_motor
   */
  async syncMotorModelos(
    motorId: string,
    motorCodigo: string,
    modeloIds: string[]
  ): Promise<void> {
    if (!motorId) return
    const uniqueModelIds = Array.from(new Set(modeloIds.map(id => String(id || '').trim()).filter(Boolean)))
    const cleanCodigo = (motorCodigo || '').trim()
    const normalizedCodigo = normalizeText(cleanCodigo) || cleanCodigo.toLowerCase()

    try {
      if (isCatalogUuid(motorId)) {
        const { data: existingLinks } = await supabase
          .from('modelo_motor')
          .select('modelo_id')
          .eq('motor_id', motorId)

        const toRemove = (existingLinks || [])
          .map((l: Record<string, unknown>) => String(l.modelo_id || ''))
          .filter(mid => mid && !uniqueModelIds.includes(mid))

        if (uniqueModelIds.length === 0) {
          await supabase.from('modelo_motor').delete().eq('motor_id', motorId)
        } else if (toRemove.length > 0) {
          await supabase
            .from('modelo_motor')
            .delete()
            .eq('motor_id', motorId)
            .in('modelo_id', toRemove)
        }

        const uuidModelIds = uniqueModelIds.filter(isCatalogUuid)
        if (uuidModelIds.length > 0 && normalizedCodigo) {
          const rows = uuidModelIds.map(mid => ({
            modelo_id: mid,
            motor_id: motorId,
            motor_codigo: cleanCodigo,
            motor_codigo_normalizado: normalizedCodigo
          }))
          await supabase
            .from('modelo_motor')
            .upsert(rows, { onConflict: 'modelo_id,motor_codigo_normalizado' })
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Error sincronizando modelos del motor en Supabase:', err)
    }

    for (const m of mockMotores) {
      if (m.id === motorId) {
        m.modelo_id = uniqueModelIds[0] || undefined
        m.modelo_ids = uniqueModelIds
      }
    }
  },

  /**
   * Sincroniza la lista unificada de modelos de un motor hacia todos sus repuestos asociados
   */
  async syncMotorModelsToRepuestos(
    motorId: string,
    modelNames: string[],
    brandName?: string
  ): Promise<void> {
    if (!motorId) return
    const cleanModels: string[] = []
    const seen = new Set<string>()
    for (const entry of modelNames) {
      for (const tok of String(entry || '').split(/[,\/;|\n]+/)) {
        const clean = tok.replace(/\s+/g, ' ').trim().toUpperCase()
        if (!clean) continue
        const low = clean.toLowerCase()
        if (low === 'n/a' || low === 'na' || low === 'universal' || low === 'varios' || low === '-' || low === '—') continue
        const key = normalizeText(clean)
        if (key && !seen.has(key)) {
          seen.add(key)
          cleanModels.push(clean)
        }
      }
    }

    const combinedModeloLabel = cleanModels.join(' / ')
    const modelosAdicionalesClean = cleanModels.slice(1)
    const brandClean = brandName ? brandName.trim().toUpperCase() : ''

    try {
      if (isCatalogUuid(motorId)) {
        const { data: repRows } = await supabase
          .from('repuestos_tecnicos')
          .select('id, especificaciones_tecnicas, dimensiones')
          .eq('motor_id', motorId)

        if (repRows && repRows.length > 0) {
          await Promise.all(
            (repRows as Array<Record<string, unknown>>).map(async row => {
              const prevSpec = (row.especificaciones_tecnicas as Record<string, unknown>) || {}
              const prevDims = (row.dimensiones as Record<string, unknown>) || {}
              const resolvedBrand =
                brandClean ||
                (prevSpec.marca ? String(prevSpec.marca).trim().toUpperCase() : '') ||
                (prevDims.marca ? String(prevDims.marca).trim().toUpperCase() : '')
              const vehiculoLabel =
                cleanModels.length > 0
                  ? (resolvedBrand ? `${resolvedBrand} ${combinedModeloLabel}` : combinedModeloLabel)
                  : undefined

              const nextSpec: Record<string, unknown> = {
                ...prevSpec,
                modelo: combinedModeloLabel,
                modelos: cleanModels,
                modelos_adicionales: modelosAdicionalesClean,
                ...(vehiculoLabel ? { vehiculo: vehiculoLabel } : {})
              }
              if (cleanModels.length === 0) {
                delete nextSpec.vehiculo
              }

              const nextDims: Record<string, unknown> = {
                ...prevDims,
                modelo: combinedModeloLabel,
                modelos: cleanModels,
                modelos_adicionales: modelosAdicionalesClean,
                ...(vehiculoLabel ? { vehiculo: vehiculoLabel } : {})
              }
              if (cleanModels.length === 0) {
                delete nextDims.vehiculo
              }

              await supabase
                .from('repuestos_tecnicos')
                .update({
                  especificaciones_tecnicas: nextSpec,
                  dimensiones: nextDims
                })
                .eq('id', String(row.id))
            })
          )
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Error propagando modelos del motor a repuestos en Supabase:', err)
    }

    const applyToPart = (p: RepuestoTecnico): RepuestoTecnico => {
      if (p.motor_id !== motorId) return p
      const prevSpec = (p.especificaciones_tecnicas as Record<string, unknown>) || {}
      const prevDims = (p.dimensiones as Record<string, unknown>) || {}
      const resolvedBrand =
        brandClean ||
        (prevSpec.marca ? String(prevSpec.marca).trim().toUpperCase() : '') ||
        (prevDims.marca ? String(prevDims.marca).trim().toUpperCase() : '')
      const vehiculoLabel =
        cleanModels.length > 0
          ? (resolvedBrand ? `${resolvedBrand} ${combinedModeloLabel}` : combinedModeloLabel)
          : undefined

      const nextSpec: Record<string, unknown> = {
        ...prevSpec,
        modelo: combinedModeloLabel,
        modelos: cleanModels,
        modelos_adicionales: modelosAdicionalesClean,
        ...(vehiculoLabel ? { vehiculo: vehiculoLabel } : {})
      }
      if (cleanModels.length === 0) delete nextSpec.vehiculo

      const nextDims: Record<string, unknown> = {
        ...prevDims,
        modelo: combinedModeloLabel,
        modelos: cleanModels,
        modelos_adicionales: modelosAdicionalesClean,
        ...(vehiculoLabel ? { vehiculo: vehiculoLabel } : {})
      }
      if (cleanModels.length === 0) delete nextDims.vehiculo

      return {
        ...p,
        especificaciones_tecnicas: nextSpec,
        dimensiones: nextDims,
        motor: p.motor
          ? { ...p.motor, modelos_nombres: cleanModels }
          : p.motor
      }
    }

    for (let i = 0; i < mockRepuestos.length; i++) {
      if (mockRepuestos[i].motor_id === motorId) {
        mockRepuestos[i] = applyToPart(mockRepuestos[i])
      }
    }

    const localParts = getLocalCustomRepuestos()
    for (const lp of localParts) {
      if (lp.motor_id === motorId) {
        saveLocalCustomRepuesto(applyToPart(lp))
      }
    }

    clearCatalogPartsCache()
  },

  /**
   * Garantiza que los nombres de modelo declarados en un repuesto existan, queden vinculados a su motor
   * y se propaguen al resto de repuestos y fichas de ese motor
   */
  async syncPartModelsWithMotor(
    motorId: string,
    rawModelNames: string[],
    replaceExact: boolean = false
  ): Promise<void> {
    if (!motorId) return
    const parsedNames = Array.from(
      new Set(
        rawModelNames
          .flatMap(entry => String(entry || '').split(/[,\/;|\n]+/))
          .map(s => s.replace(/\s+/g, ' ').trim())
          .filter(s => {
            if (!s) return false
            const low = s.toLowerCase()
            return low !== 'n/a' && low !== 'na' && low !== 'universal' && low !== 'varios' && low !== '-' && low !== '—'
          })
      )
    )
    if (parsedNames.length === 0) return

    try {
      let fabricanteId = ''
      let motorCodigo = ''
      let currentPrimaryModeloId: string | undefined
      let currentSpec: Record<string, unknown> = {}
      let brandName = ''

      if (isCatalogUuid(motorId)) {
        const { data: dbMot } = await supabase
          .from('motores')
          .select('id, codigo, fabricante_id, modelo_id, especificaciones_tecnicas, fabricante:fabricantes(nombre)')
          .eq('id', motorId)
          .maybeSingle()
        if (dbMot) {
          fabricanteId = String(dbMot.fabricante_id || '')
          motorCodigo = String(dbMot.codigo || '')
          currentPrimaryModeloId = dbMot.modelo_id ? String(dbMot.modelo_id) : undefined
          currentSpec = (dbMot.especificaciones_tecnicas as Record<string, unknown>) || {}
          const fabObj = (dbMot as Record<string, unknown>).fabricante as { nombre?: string } | undefined
          if (fabObj?.nombre) brandName = String(fabObj.nombre)
        }
      }

      if (!fabricanteId) {
        const localMot = [...getLocalCustomMotores(), ...mockMotores].find(m => m.id === motorId)
        if (localMot) {
          fabricanteId = localMot.fabricante_id
          motorCodigo = localMot.codigo
          currentPrimaryModeloId = localMot.modelo_id
          currentSpec = (localMot.especificaciones_tecnicas as Record<string, unknown>) || {}
          if (localMot.fabricante?.nombre) brandName = localMot.fabricante.nombre
        }
      }

      if (!fabricanteId) return

      const fabModelos = await this.getModelos(fabricanteId)
      const resolvedPartModelIds: string[] = []
      const resolvedPartModelNames: string[] = []

      for (const name of parsedNames) {
        const normName = normalizeText(name)
        let matched = fabModelos.find(m => normalizeText(m.nombre) === normName)
        if (!matched) {
          matched = await this.createModelo(fabricanteId, name.toUpperCase())
          fabModelos.push(matched)
        }
        resolvedPartModelIds.push(matched.id)
        resolvedPartModelNames.push(matched.nombre)
      }

      const existingIds = replaceExact ? [] : await this.getModeloIdsByMotor(motorId)
      const mergedModelIds = Array.from(
        new Set(
          replaceExact
            ? resolvedPartModelIds
            : [...existingIds, ...(currentPrimaryModeloId ? [currentPrimaryModeloId] : []), ...resolvedPartModelIds].filter(Boolean)
        )
      )
      const mergedModelNames = Array.from(
        new Set(
          replaceExact
            ? resolvedPartModelNames
            : [
                ...(Array.isArray(currentSpec.modelos_nombres) ? (currentSpec.modelos_nombres as string[]) : []),
                ...mergedModelIds
                  .map(mid => fabModelos.find(m => m.id === mid)?.nombre || '')
                  .filter(Boolean),
                ...resolvedPartModelNames
              ]
        )
      )

      const nextPrimaryId = replaceExact
        ? (mergedModelIds[0] || null)
        : (currentPrimaryModeloId || mergedModelIds[0] || null)
      const nextSpec: Record<string, unknown> = {
        ...currentSpec,
        modelo_ids: mergedModelIds,
        modelos_nombres: mergedModelNames
      }

      if (isCatalogUuid(motorId)) {
        await supabase
          .from('motores')
          .update({
            modelo_id: nextPrimaryId,
            especificaciones_tecnicas: nextSpec
          })
          .eq('id', motorId)
      }

      await this.syncMotorModelos(motorId, motorCodigo, mergedModelIds)
      await this.syncMotorModelsToRepuestos(motorId, mergedModelNames, brandName)
    } catch (err) {
      console.warn('[CatalogService] Error sincronizando modelos del repuesto con su motor:', err)
    }
  },

  /**
   * Sincroniza los motores vinculados a un modelo en la tabla N:M modelo_motor
   */
  async syncModeloMotores(
    modeloId: string,
    selectedMotors: Array<{ id: string; codigo: string }>
  ): Promise<void> {
    if (!modeloId) return
    const targetIds = new Set(selectedMotors.map(m => m.id))

    try {
      const existingIds = await this.getMotorIdsByModelo(modeloId)
      const toRemove = existingIds.filter(id => !targetIds.has(id))

      if (toRemove.length > 0) {
        await supabase
          .from('modelo_motor')
          .delete()
          .eq('modelo_id', modeloId)
          .in('motor_id', toRemove)
        await supabase
          .from('motores')
          .update({ modelo_id: null })
          .eq('modelo_id', modeloId)
          .in('id', toRemove)
      }

      if (selectedMotors.length > 0) {
        const rows = selectedMotors.map(mot => ({
          modelo_id: modeloId,
          motor_id: mot.id,
          motor_codigo: mot.codigo,
          motor_codigo_normalizado: normalizeText(mot.codigo) || mot.codigo.trim().toLowerCase()
        }))
        await supabase
          .from('modelo_motor')
          .upsert(rows, { onConflict: 'modelo_id,motor_codigo_normalizado' })
      }
    } catch (err) {
      console.warn('[CatalogService] Error sincronizando modelo_motor en Supabase:', err)
    }

    for (const m of mockMotores) {
      if (targetIds.has(m.id) && !m.modelo_id) {
        m.modelo_id = modeloId
      } else if (!targetIds.has(m.id) && m.modelo_id === modeloId) {
        m.modelo_id = undefined
      }
    }
  },

  /**
   * Obtiene motores filtrados por fabricante o modelo directamente desde Supabase
   */
  async getMotores(fabricanteId?: string, modeloId?: string, onlyWithParts: boolean = false): Promise<Motor[]> {
    const localMotors = getLocalCustomMotores()
    try {
      const selectFields = onlyWithParts
        ? '*, fabricante:fabricantes(*), modelo:modelos(*), repuestos_tecnicos!inner(id, especificaciones_tecnicas, dimensiones)'
        : '*, fabricante:fabricantes(*), modelo:modelos(*), repuestos_tecnicos(id, especificaciones_tecnicas, dimensiones)'

      let motorIdsFilter: string[] | undefined
      if (modeloId) {
        const motorIds = await this.getMotorIdsByModelo(modeloId)
        // Si no hay ningún motor vinculado se devuelve lista vacía (no los de otros modelos)
        if (motorIds.length === 0) return []
        motorIdsFilter = motorIds
      }

      const pageSize = 1000
      const maxPages = 6
      const allData: Record<string, unknown>[] = []
      let queryError: unknown = null

      for (let page = 0; page < maxPages; page++) {
        let query = supabase.from('motores').select(selectFields)
        if (fabricanteId) {
          query = query.eq('fabricante_id', fabricanteId)
        }
        if (motorIdsFilter) {
          query = query.in('id', motorIdsFilter)
        }
        const from = page * pageSize
        const to = from + pageSize - 1
        const { data: batch, error } = await query.order('codigo', { ascending: true }).range(from, to)
        if (error) {
          queryError = error
          break
        }
        if (batch && batch.length > 0) {
          allData.push(...(batch as unknown as Record<string, unknown>[]))
        }
        if (!batch || batch.length < pageSize) {
          break
        }
      }

      if (queryError || (allData.length === 0 && !fabricanteId && !modeloId)) {
        let filtered = [...mockMotores]
        for (const loc of localMotors) {
          if (!filtered.some(m => m.id === loc.id || (m.codigo.toLowerCase() === loc.codigo.toLowerCase() && m.fabricante_id === loc.fabricante_id))) {
            filtered.push(loc)
          }
        }
        if (fabricanteId) {
          filtered = filtered.filter(m => m.fabricante_id === fabricanteId)
        }
        if (modeloId) {
          filtered = filtered.filter(m => {
            const specIds = Array.isArray((m.especificaciones_tecnicas as any)?.modelo_ids) ? (m.especificaciones_tecnicas as any).modelo_ids : []
            return m.modelo_id === modeloId || m.modelo_ids?.includes(modeloId) || specIds.includes(modeloId)
          })
        }
        return filtered.length > 0 ? filtered : mockMotores
      }

      const [modelosCatalog, mmLinks]: [Modelo[], Array<{ motor_id: string; modelo_id: string }>] = await Promise.all([
        this.getModelos(fabricanteId).catch((): Modelo[] => []),
        (async (): Promise<Array<{ motor_id: string; modelo_id: string }>> => {
          const uuidIds = allData.map(item => String(item.id || '')).filter(isCatalogUuid)
          if (uuidIds.length === 0) return []
          const chunkSize = 250
          const chunks: string[][] = []
          for (let i = 0; i < uuidIds.length; i += chunkSize) {
            chunks.push(uuidIds.slice(i, i + chunkSize))
          }
          const results = await Promise.all(
            chunks.map(async (chunk): Promise<Array<{ motor_id: string; modelo_id: string }>> => {
              try {
                const { data } = await supabase
                  .from('modelo_motor')
                  .select('motor_id, modelo_id')
                  .in('motor_id', chunk)
                return (data || []) as Array<{ motor_id: string; modelo_id: string }>
              } catch {
                return []
              }
            })
          )
          return results.flat()
        })()
      ])

      const modeloById = new Map<string, Modelo>(modelosCatalog.map((m: Modelo) => [m.id, m]))
      const motorToModelIdsMap = new Map<string, Set<string>>()
      for (const link of mmLinks) {
        if (!link.motor_id || !link.modelo_id) continue
        const mId = String(link.motor_id)
        const modId = String(link.modelo_id)
        if (!motorToModelIdsMap.has(mId)) motorToModelIdsMap.set(mId, new Set())
        motorToModelIdsMap.get(mId)!.add(modId)
      }

      const dbMotors: Motor[] = allData.map((item: Record<string, unknown>) => {
        const motorId = String(item.id)
        const fabIdStr = String(item.fabricante_id || '')
        const espec = (item.especificaciones_tecnicas as Record<string, unknown>) || {}
        const repArray = Array.isArray(item.repuestos_tecnicos) ? (item.repuestos_tecnicos as Array<Record<string, unknown>>) : []
        const specModelIds = Array.isArray(espec.modelo_ids) ? espec.modelo_ids.map(String).filter(Boolean) : []
        const specModelNames = Array.isArray(espec.modelos_nombres) ? espec.modelos_nombres.map(String).filter(Boolean) : []
        const primaryModeloId = item.modelo_id ? String(item.modelo_id) : undefined
        const primaryModeloObj = item.modelo as Modelo | undefined

        const partExtractedNames: string[] = []
        const partResolvedIds: string[] = []
        for (const rep of repArray) {
          const tokens = extractModelTokensFromRaw(
            rep.especificaciones_tecnicas as Record<string, unknown> | undefined,
            rep.dimensiones as Record<string, unknown> | undefined
          )
          for (const tok of tokens) {
            partExtractedNames.push(tok)
            const normTok = normalizeText(tok)
            const matchedMod = modelosCatalog.find(
              m => (!fabIdStr || m.fabricante_id === fabIdStr) && normalizeText(m.nombre) === normTok
            )
            if (matchedMod) {
              partResolvedIds.push(matchedMod.id)
            }
          }
        }

        const combinedIds = Array.from(
          new Set([
            ...(primaryModeloId ? [primaryModeloId] : []),
            ...(motorToModelIdsMap.get(motorId) ? Array.from(motorToModelIdsMap.get(motorId)!) : []),
            ...specModelIds,
            ...partResolvedIds
          ].filter(Boolean))
        )
        const rawResolvedNames = [
          ...(primaryModeloObj?.nombre ? [primaryModeloObj.nombre] : []),
          ...combinedIds.map(mid => modeloById.get(mid)?.nombre || '').filter(Boolean),
          ...specModelNames,
          ...partExtractedNames
        ].filter(Boolean)
        const resolvedNames: string[] = []
        const seenModelKeys = new Set<string>()
        for (const name of rawResolvedNames) {
          const clean = String(name).replace(/\s+/g, ' ').trim()
          const key = normalizeText(clean)
          if (key && !seenModelKeys.has(key)) {
            seenModelKeys.add(key)
            resolvedNames.push(clean)
          }
        }

        return {
          id: motorId,
          fabricante_id: String(item.fabricante_id),
          modelo_id: primaryModeloId || combinedIds[0] || undefined,
          modelo_ids: combinedIds,
          modelos_nombres: resolvedNames,
          numero_id: espec.numero_id ? (espec.numero_id as number | string) : undefined,
          codigo: String(item.codigo),
          nombre_comercial: item.nombre_comercial ? String(item.nombre_comercial) : undefined,
          denominacion_venta: espec.denominacion_venta ? String(espec.denominacion_venta) : undefined,
          cilindrada_cc: item.cilindrada_cc ? Number(item.cilindrada_cc) : undefined,
          cilindrada_texto: espec.cilindrada_texto ? String(espec.cilindrada_texto) : (item.cilindrada_cc ? `${item.cilindrada_cc} cc` : undefined),
          kw: espec.kw ? Number(espec.kw) : undefined,
          cv: espec.cv ? Number(espec.cv) : undefined,
          combustible: String(item.combustible || 'Diésel'),
          cilindros: item.cilindros ? Number(item.cilindros) : undefined,
          valvulas: item.valvulas ? Number(item.valvulas) : undefined,
          diametro_cilindro_std_mm: item.diametro_cilindro_std_mm ? Number(item.diametro_cilindro_std_mm) : undefined,
          carrera_piston_mm: item.carrera_piston_mm ? Number(item.carrera_piston_mm) : undefined,
          configuracion: item.configuracion ? String(item.configuracion) : undefined,
          aspiracion: item.aspiracion ? String(item.aspiracion) : undefined,
          anios: item.anios ? String(item.anios) : (espec.anios ? String(espec.anios) : undefined),
          especificaciones_tecnicas: espec,
          fabricante: item.fabricante as Fabricante | undefined,
          modelo: primaryModeloObj,
          parts_count: repArray.length
        }
      })

      for (const loc of localMotors) {
        if (fabricanteId && loc.fabricante_id !== fabricanteId) continue
        if (!dbMotors.some(m => m.id === loc.id || (m.codigo.toLowerCase() === loc.codigo.toLowerCase() && m.fabricante_id === loc.fabricante_id))) {
          dbMotors.push(loc)
        }
      }

      return dbMotors
    } catch {
      const merged = [...mockMotores]
      for (const loc of localMotors) {
        if (!merged.some(m => m.id === loc.id)) merged.push(loc)
      }
      return merged
    }
  },

  /**
   * Registra un nuevo motor en Supabase con respaldo local inmediato
   */
  async createMotor(motorData: Partial<Motor>): Promise<Motor> {
    const cleanCodigo = (motorData.codigo || '').trim().toUpperCase()
    const fabList = await this.getFabricantes()
    const matchedFab = fabList.find(f => f.id === motorData.fabricante_id) || fabList[0]
    const fabName = matchedFab ? matchedFab.nombre.toUpperCase() : 'MOTOR'
    const targetFabId = matchedFab?.id || motorData.fabricante_id || 'fab-1'
    const allModelos = await this.getModelos(targetFabId).catch(() => [] as Modelo[])

    const normalizedModelIds = Array.from(
      new Set(
        (Array.isArray(motorData.modelo_ids)
          ? motorData.modelo_ids
          : (motorData.modelo_id ? [motorData.modelo_id] : [])
        ).map(id => String(id || '').trim()).filter(Boolean)
      )
    )
    const primaryModeloId = normalizedModelIds[0] || undefined
    const primaryModeloObj = primaryModeloId ? allModelos.find(m => m.id === primaryModeloId) : undefined
    const resolvedModelNames = Array.from(
      new Set([
        ...normalizedModelIds.map(id => allModelos.find(m => m.id === id)?.nombre || '').filter(Boolean),
        ...(Array.isArray(motorData.modelos_nombres) ? motorData.modelos_nombres.map(n => String(n || '').trim()).filter(Boolean) : [])
      ])
    )

    const espec: Record<string, unknown> = {
      denominacion_venta: motorData.denominacion_venta || '',
      cilindrada_texto: motorData.cilindrada_cc
        ? `${motorData.cilindrada_cc} cc / ${(Number(motorData.cilindrada_cc) / 1000).toFixed(1)} l`
        : undefined,
      kw: motorData.kw || undefined,
      cv: motorData.cv || undefined,
      anios: motorData.anios || undefined,
      ...(motorData.especificaciones_tecnicas || {}),
      modelo_ids: normalizedModelIds,
      modelos_nombres: resolvedModelNames
    }

    const newMotor: Motor = {
      id: `mot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fabricante_id: targetFabId,
      modelo_id: primaryModeloId,
      modelo_ids: normalizedModelIds,
      modelos_nombres: resolvedModelNames,
      codigo: cleanCodigo,
      nombre_comercial: motorData.nombre_comercial || `${fabName} - ${cleanCodigo}`,
      denominacion_venta: motorData.denominacion_venta || '',
      cilindrada_cc: motorData.cilindrada_cc ? Number(motorData.cilindrada_cc) : undefined,
      cilindrada_texto: espec.cilindrada_texto as string | undefined,
      combustible: motorData.combustible || 'Diésel',
      cilindros: motorData.cilindros ? Number(motorData.cilindros) : 4,
      valvulas: motorData.valvulas ? Number(motorData.valvulas) : 8,
      diametro_cilindro_std_mm: motorData.diametro_cilindro_std_mm ? Number(motorData.diametro_cilindro_std_mm) : undefined,
      aspiracion: motorData.aspiracion || 'Natural',
      anios: motorData.anios || undefined,
      especificaciones_tecnicas: espec,
      fabricante: matchedFab,
      modelo: primaryModeloObj,
      parts_count: 0
    }

    try {
      const { data, error } = await supabase
        .from('motores')
        .insert({
          fabricante_id: newMotor.fabricante_id,
          modelo_id: newMotor.modelo_id || null,
          codigo: newMotor.codigo,
          nombre_comercial: newMotor.nombre_comercial,
          cilindrada_cc: newMotor.cilindrada_cc || null,
          combustible: newMotor.combustible,
          cilindros: newMotor.cilindros || 4,
          valvulas: newMotor.valvulas || 8,
          diametro_cilindro_std_mm: newMotor.diametro_cilindro_std_mm || null,
          aspiracion: newMotor.aspiracion || null,
          anios: newMotor.anios || null,
          especificaciones_tecnicas: espec
        })
        .select('*, fabricante:fabricantes(*), modelo:modelos(*)')
        .single()

      if (!error && data) {
        newMotor.id = String(data.id)
        if (data.fabricante) newMotor.fabricante = data.fabricante as Fabricante
        if (data.modelo) newMotor.modelo = data.modelo as Modelo
      }
    } catch (err) {
      console.warn('[CatalogService] Inserción de motor en Supabase falló, guardando localmente:', err)
    }

    await this.syncMotorModelos(newMotor.id, newMotor.codigo, normalizedModelIds)
    if (resolvedModelNames.length > 0) {
      await this.syncMotorModelsToRepuestos(newMotor.id, resolvedModelNames, fabName)
    }
    saveLocalCustomMotor(newMotor)
    if (!mockMotores.some(m => m.id === newMotor.id)) {
      mockMotores.unshift(newMotor)
    }
    return newMotor
  },

  /**
   * Actualiza un motor existente en Supabase y caché local
   */
  async updateMotor(id: string, motorData: Partial<Motor>): Promise<Motor> {
    const cleanCodigo = (motorData.codigo || '').trim().toUpperCase()
    const fabList = await this.getFabricantes()
    const matchedFab = fabList.find(f => f.id === motorData.fabricante_id)
    const fabName = matchedFab ? matchedFab.nombre.toUpperCase() : 'MOTOR'
    const targetFabId = motorData.fabricante_id || matchedFab?.id || ''
    const allModelos = await this.getModelos(targetFabId || undefined).catch(() => [] as Modelo[])

    const normalizedModelIds = Array.from(
      new Set(
        (Array.isArray(motorData.modelo_ids)
          ? motorData.modelo_ids
          : (motorData.modelo_id ? [motorData.modelo_id] : [])
        ).map(mid => String(mid || '').trim()).filter(Boolean)
      )
    )
    const primaryModeloId = normalizedModelIds[0] || undefined
    const primaryModeloObj = primaryModeloId ? allModelos.find(m => m.id === primaryModeloId) : undefined
    const resolvedModelNames = Array.from(
      new Set([
        ...normalizedModelIds.map(mid => allModelos.find(m => m.id === mid)?.nombre || '').filter(Boolean),
        ...(Array.isArray(motorData.modelos_nombres) ? motorData.modelos_nombres.map(n => String(n || '').trim()).filter(Boolean) : [])
      ])
    )

    const espec: Record<string, unknown> = {
      ...(motorData.especificaciones_tecnicas || {}),
      denominacion_venta: motorData.denominacion_venta || '',
      cilindrada_texto: motorData.cilindrada_cc
        ? `${motorData.cilindrada_cc} cc / ${(Number(motorData.cilindrada_cc) / 1000).toFixed(1)} l`
        : undefined,
      anios: motorData.anios || undefined,
      modelo_ids: normalizedModelIds,
      modelos_nombres: resolvedModelNames
    }

    let updated: Motor = {
      id,
      fabricante_id: targetFabId,
      modelo_id: primaryModeloId,
      modelo_ids: normalizedModelIds,
      modelos_nombres: resolvedModelNames,
      codigo: cleanCodigo,
      nombre_comercial: motorData.nombre_comercial?.trim() || `${fabName} - ${cleanCodigo}`,
      denominacion_venta: motorData.denominacion_venta || '',
      cilindrada_cc: motorData.cilindrada_cc ? Number(motorData.cilindrada_cc) : undefined,
      cilindrada_texto: espec.cilindrada_texto as string | undefined,
      combustible: motorData.combustible || 'Diésel',
      cilindros: motorData.cilindros ? Number(motorData.cilindros) : 4,
      valvulas: motorData.valvulas ? Number(motorData.valvulas) : 8,
      anios: motorData.anios || undefined,
      especificaciones_tecnicas: espec,
      fabricante: matchedFab,
      modelo: primaryModeloObj
    }

    try {
      const { data, error } = await supabase
        .from('motores')
        .update({
          fabricante_id: updated.fabricante_id || undefined,
          modelo_id: updated.modelo_id || null,
          codigo: updated.codigo,
          nombre_comercial: updated.nombre_comercial,
          cilindrada_cc: updated.cilindrada_cc || null,
          combustible: updated.combustible,
          cilindros: updated.cilindros || 4,
          valvulas: updated.valvulas || 8,
          anios: updated.anios || null,
          especificaciones_tecnicas: espec
        })
        .eq('id', id)
        .select('*, fabricante:fabricantes(*), modelo:modelos(*)')
        .maybeSingle()

      if (!error && data) {
        updated = {
          ...updated,
          id: String(data.id),
          modelo_ids: normalizedModelIds,
          modelos_nombres: resolvedModelNames,
          fabricante: (data.fabricante as Fabricante) || updated.fabricante,
          modelo: (data.modelo as Modelo) || updated.modelo
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Error actualizando motor en Supabase:', err)
    }

    await this.syncMotorModelos(updated.id, updated.codigo, normalizedModelIds)
    await this.syncMotorModelsToRepuestos(updated.id, resolvedModelNames, fabName)
    clearCatalogPartsCache()

    const localList = getLocalCustomMotores()
    const localIdx = localList.findIndex(m => m.id === id)
    if (localIdx >= 0) {
      localList[localIdx] = { ...localList[localIdx], ...updated }
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_MOTORS_STORAGE_KEY, JSON.stringify(localList))
      }
    }
    const mockIdx = mockMotores.findIndex(m => m.id === id)
    if (mockIdx >= 0) mockMotores[mockIdx] = { ...mockMotores[mockIdx], ...updated }

    return updated
  },

  /**
   * Elimina un código de motor en Supabase y limpia sus vínculos con modelos/repuestos
   */
  async deleteMotor(id: string): Promise<boolean> {
    if (isCatalogUuid(id)) {
      await supabase.from('modelo_motor').delete().eq('motor_id', id)
      await supabase.from('repuestos_tecnicos').update({ motor_id: null }).eq('motor_id', id)
      const { error } = await supabase.from('motores').delete().eq('id', id)
      if (error) {
        throw new Error(error.message || 'No se pudo eliminar el motor en la base de datos')
      }
    }
    removeLocalCustomMotor(id)
    return true
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
        .select(REPUESTO_STRICT_COLUMNS as any)
        .eq('motor_id', motorId)

      if (subsistema && subsistema !== 'Todos') {
        query = query.eq('subsistema', subsistema)
      }

      const { data, error } = await query.order('subsistema', { ascending: true })

      if (error || !data || (data as any[]).length === 0) {
        let filtered = mockRepuestos.filter(r => r.motor_id === motorId)
        if (subsistema && subsistema !== 'Todos') {
          filtered = filtered.filter(r => r.subsistema === subsistema)
        }
        return filtered.length > 0 ? filtered : mockRepuestos.filter(r => !subsistema || subsistema === 'Todos' || r.subsistema === subsistema)
      }

      return (data as any[]).map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
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
   * Utiliza selección estricta de columnas, paginación por cursor en lugar de offset, y caché en memoria
   */
  async getRepuestosByGrupo(
    categoria: string, 
    subsistema?: string, 
    fabricanteId?: string, 
    modeloId?: string,
    options?: CatalogQueryOptions
  ): Promise<PaginatedRepuestosList> {
    const limit = options?.limit !== undefined ? options.limit : 150
    const cursor = options?.cursor
    const cacheKey = `${categoria || ''}|${subsistema || ''}|${fabricanteId || ''}|${modeloId || ''}|${cursor || ''}|${limit}`

    if (!options?.bypassCache && partsCache.has(cacheKey)) {
      const entry = partsCache.get(cacheKey)!
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data
      }
    }

    try {
      // Motores compatibles con el modelo; los repuestos universales (sin motor) siempre se conservan
      const motorIdsModelo = modeloId ? new Set(await this.getMotorIdsByModelo(modeloId)) : null
      const filtrar = (list: RepuestoTecnico[]) => list.filter(r => {
        if (!r.motor_id) return true
        if (fabricanteId && r.motor?.fabricante_id !== fabricanteId) return false
        if (motorIdsModelo && !motorIdsModelo.has(r.motor_id)) return false
        return true
      })

      // Conteo eficiente mediante Head request en Supabase (solo en primera página)
      const countPromise = cursor
        ? Promise.resolve(countCache.get(`${categoria || ''}|${subsistema || ''}`)?.data ?? 0)
        : getRepuestosCount(categoria, subsistema)

      let query = supabase
        .from('repuestos_tecnicos')
        .select(REPUESTO_STRICT_COLUMNS as any)

      if (categoria) {
        query = query.eq('categoria', categoria)
      }

      if (subsistema && subsistema !== 'Todos') {
        query = query.eq('subsistema', subsistema)
      }

      if (cursor) {
        query = query.gt('codigo_oem', cursor)
      }

      if (limit > 0) {
        query = query.limit(limit)
      }

      const [{ data, error }, totalCount] = await Promise.all([
        query.order('codigo_oem', { ascending: true }),
        countPromise
      ])

      const rows = data as any[] | null
      if (!error && rows && rows.length > 0) {
        const hasMore = limit > 0 && rows.length === limit
        const nextCursor = hasMore ? (rows[rows.length - 1]?.codigo_oem as string) : null
        const mapped = rows.map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
        const filtered = filtrar(mapped) as PaginatedRepuestosList
        filtered.totalCount = totalCount || filtered.length
        filtered.hasMore = hasMore
        filtered.nextCursor = nextCursor

        partsCache.set(cacheKey, { data: filtered, timestamp: Date.now() })
        return filtered
      }

      // Si no hubo resultados por coincidencia exacta y es primera página, probar búsqueda flexible por nombre o categoría
      if (categoria && !cursor && (!rows || rows.length === 0)) {
        let altQuery = supabase
          .from('repuestos_tecnicos')
          .select(REPUESTO_STRICT_COLUMNS as any)
          .or(`categoria.ilike.%${categoria}%,nombre.ilike.%${categoria}%`)
          .order('codigo_oem', { ascending: true })

        if (limit > 0) {
          altQuery = altQuery.limit(limit)
        }

        const { data: altData } = await altQuery
        const altRows = altData as any[] | null

        if (altRows && altRows.length > 0) {
          const hasMore = limit > 0 && altRows.length === limit
          const nextCursor = hasMore ? (altRows[altRows.length - 1]?.codigo_oem as string) : null
          const mapped = altRows.map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
          const filtered = filtrar(mapped) as PaginatedRepuestosList
          filtered.totalCount = filtered.length
          filtered.hasMore = hasMore
          filtered.nextCursor = nextCursor

          partsCache.set(cacheKey, { data: filtered, timestamp: Date.now() })
          return filtered
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

    const result = list.map(r => {
      const mot = mockMotores.find(m => m.id === r.motor_id)
      const fab = mot ? mockFabricantes.find(f => f.id === mot.fabricante_id) : undefined
      return {
        ...r,
        motor: r.motor || (mot ? { ...mot, fabricante: fab } : undefined)
      }
    }) as PaginatedRepuestosList

    result.totalCount = result.length
    result.hasMore = false
    result.nextCursor = null
    return result
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
            cilindros: item.cilindros ? Number(item.cilindros) : undefined,
            valvulas: item.valvulas ? Number(item.valvulas) : undefined,
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
        .select(REPUESTO_STRICT_COLUMNS as any)

      if (repuestoIds.length > 0) {
        query = query.or(`codigo_oem.ilike.%${clean}%,nombre.ilike.%${clean}%,id.in.(${repuestoIds.join(',')})`)
      } else {
        query = query.or(`codigo_oem.ilike.%${clean}%,nombre.ilike.%${clean}%`)
      }

      const { data, error } = await query.limit(60)

      if (!error && data && (data as any[]).length > 0) {
        return (data as any[]).map((item: Record<string, unknown>) => mapDbRepuestoToFrontend(item))
      }
    } catch {
      // Fallback
    }

    const matches = mockRepuestos.filter(r => {
      const matchOem = r.codigo_oem.toLowerCase().replace(/[-\s]/g, '').includes(q)
      const matchAdditionalOem = r.codigos_oem_adicionales?.some(c => c.toLowerCase().replace(/[-\s]/g, '').includes(q))
      const matchNombre = r.nombre.toLowerCase().includes(clean.toLowerCase())
      const matchEquiv = r.equivalencias?.some(eq =>
        eq.codigo_alterno.toLowerCase().replace(/[-\s]/g, '').includes(q) ||
        eq.marca_alterna.toLowerCase().includes(clean.toLowerCase())
      )
      return matchOem || matchAdditionalOem || matchNombre || matchEquiv
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
    const normalizeTableGroup = (grp: GrupoRepuesto): GrupoRepuesto => {
      const isTable = grp.tipo_vista === 'tabla' || grp.codigo === 'anillos_motor'
      if (!isTable) {
        return {
          ...grp,
          parametros: sanitizeGroupParams(grp.parametros)
        }
      }

      const defaultTablaConfig: TablaConfiguracion = {
        titulo_primera_columna: grp.categoria || 'Componente',
        modo_filas: 'subfilas',
        usar_prefijo_titulo: true,
        etiqueta_ultima_fila: '',
        habilitar_identificador: false,
        etiqueta_identificador: '',
        opciones_identificador: ['Cónico', 'Semi-cónico', 'Escalonado', '1 Espiral', 'Doble Espiral']
      }

      const metaTablaConfig = (grp.parametros?.[0] as any)?._tabla_config as TablaConfiguracion | undefined
      const resolvedTablaConfig: TablaConfiguracion = {
        ...(grp.tabla_config || metaTablaConfig || defaultTablaConfig)
      }

      const isAnillosCategory = grp.codigo === 'anillos_motor' || (grp.categoria || '').toLowerCase().includes('anillo')
      const hadSubfilasActivas = Boolean(resolvedTablaConfig.subfilas_activas)

      // Reparar grupos en tabla ya creados (ej. con `subfilas` guardadas bajo modo_filas incremental/cojinetes/libre o restos de 'Anillo de aceite')
      if (!isAnillosCategory && resolvedTablaConfig.etiqueta_ultima_fila === 'Anillo de aceite') {
        resolvedTablaConfig.etiqueta_ultima_fila = ''
      }
      if (!Array.isArray(resolvedTablaConfig.subfilas) || resolvedTablaConfig.subfilas.length === 0) {
        resolvedTablaConfig.subfilas = isAnillosCategory
          ? ['1° Anillo (Fuego)', '2° Anillo (Compresión)', 'Anillo de aceite']
          : ['Fila 1']
      }
      resolvedTablaConfig.modo_filas = 'subfilas'
      resolvedTablaConfig.subfilas_activas = true
      if (Array.isArray(resolvedTablaConfig.subfila_padres)) {
        resolvedTablaConfig.subfila_padres = resolvedTablaConfig.subfilas.map(
          (_, idx) => (resolvedTablaConfig.subfila_padres?.[idx] || '').trim()
        )
      }

      // Si aún tiene las claves individuales antiguas (anillo1_h1, anillo2_h1, aceite_h1), migrarlas al esquema general de columnas
      const legacyPerRingKeys = new Set([
        'anillo1_h1', 'anillo1_a1', 'anillo2_h1', 'anillo2_a1',
        'anillo3_h1', 'anillo3_a1', 'aceite_h1', 'aceite_a1', 'diseno_conico',
        'espesor_anillo1_mm', 'espesor_anillo2_mm', 'espesor_anillo3_mm', 'espesor_aceite_mm',
        'altura_anillo1_mm', 'altura_anillo2_mm', 'altura_anillo3_mm', 'altura_aceite_mm'
      ])
      const hasLegacyRingParams = grp.parametros.some(p => legacyPerRingKeys.has(p.clave))
      let normalizedParams = [...(grp.parametros || [])]

      if (hasLegacyRingParams) {
        const diamOld = grp.parametros.find(p => p.clave === 'diametro_cilindro_mm')
        const h1Old = grp.parametros.find(p => p.clave === 'anillo1_h1')
        const a1Old = grp.parametros.find(p => p.clave === 'anillo1_a1')
        const extraCustom = grp.parametros.filter(p => p.clave !== 'diametro_cilindro_mm' && !legacyPerRingKeys.has(p.clave))

        normalizedParams = [
          {
            id: diamOld?.id || 'p_anil_1',
            clave: 'diametro_cilindro_mm',
            etiqueta: diamOld?.etiqueta && !diamOld.etiqueta.includes('(d1)') ? diamOld.etiqueta : 'Diámetro',
            etiqueta_corta: diamOld?.etiqueta_corta || 'Diámetro',
            unidad: diamOld?.unidad ?? 'mm',
            tipo_dato: diamOld?.tipo_dato || 'numero',
            requerido: diamOld ? diamOld.requerido : true,
            filtrable: diamOld?.filtrable !== false,
            descripcion: diamOld?.descripcion || 'Calibre del orificio del cilindro'
          },
          {
            id: h1Old?.id || 'p_anil_2',
            clave: 'grosor_mm',
            etiqueta: 'Grosor',
            etiqueta_corta: 'Grosor',
            unidad: h1Old?.unidad ?? 'mm',
            tipo_dato: 'numero',
            requerido: h1Old ? h1Old.requerido : true,
            filtrable: h1Old?.filtrable !== false,
            descripcion: 'Espesor o grosor axial del anillo'
          },
          {
            id: a1Old?.id || 'p_anil_3',
            clave: 'altura_mm',
            etiqueta: 'Altura',
            etiqueta_corta: 'Altura',
            unidad: a1Old?.unidad ?? 'mm',
            tipo_dato: 'numero',
            requerido: true,
            filtrable: a1Old?.filtrable !== false,
            descripcion: 'Altura o ancho radial del anillo'
          },
          ...extraCustom
        ]
      }

      // Migrar automáticamente registros legados de anillos_motor al formato unificado de familia
      // sin sobrescribir cambios ya guardados desde Modificar Familia.
      if (grp.codigo === 'anillos_motor' && !hadSubfilasActivas) {
        if (!resolvedTablaConfig.titulo_primera_columna || resolvedTablaConfig.titulo_primera_columna === 'Anillo') {
          resolvedTablaConfig.titulo_primera_columna = 'Componente'
        }
        const hasDesignCol = normalizedParams.some(p =>
          p.clave === 'tipo_diseno' ||
          (p.etiqueta || '').toLowerCase().includes('dise') ||
          (p.etiqueta || '').toLowerCase().includes('perfil') ||
          (p.etiqueta || '').toLowerCase().includes('cónic') ||
          (p.etiqueta || '').toLowerCase().includes('conic')
        )
        if (!hasDesignCol) {
          normalizedParams.push({
            id: 'p_anil_4',
            clave: 'tipo_diseno',
            etiqueta: 'Diseño / Perfil',
            etiqueta_corta: 'Diseño',
            unidad: '',
            tipo_dato: 'seleccion',
            opciones: ['Cónico', 'Semi-cónico', 'Escalonado', '1 Espiral', 'Doble Espiral', 'Plano'],
            requerido: false,
            filtrable: true,
            descripcion: 'Perfil o tipo de diseño del anillo'
          })
        }
      }

      return {
        ...grp,
        tipo_vista: 'tabla',
        tabla_config: resolvedTablaConfig,
        parametros: sanitizeGroupParams(normalizedParams)
      }
    }

    try {
      const { data, error } = await supabase
        .from('grupos_repuestos')
        .select('*')
        .eq('activo', true)
        .order('orden_visual', { ascending: true })

      if (error) {
        throw error
      }

      if (Array.isArray(data)) {
        // Supabase es la fuente única de verdad entre desarrollo y producción:
        // descartamos cachés locales previas cuando la BD responde correctamente.
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(LOCAL_GROUPS_STORAGE_KEY)
          localStorage.removeItem(LOCAL_DELETED_GROUPS_KEY)
        }

        return data.map((row: Record<string, unknown>) => {
          const params = Array.isArray(row.parametros) ? (row.parametros as ParametroTecnicoDefinicion[]) : []
          const metaTipoVista = (params[0] as any)?._tipo_vista as GrupoTipoVista | undefined
          const metaTablaConfig = (params[0] as any)?._tabla_config as TablaConfiguracion | undefined
          const codigoStr = String(row.codigo)
          const resolvedTipoVista: GrupoTipoVista =
            (row.tipo_vista as GrupoTipoVista) ||
            metaTipoVista ||
            (codigoStr === 'anillos_motor' ? 'tabla' : 'normal')

          return normalizeTableGroup({
            id: String(row.id),
            codigo: codigoStr,
            nombre: String(row.nombre),
            categoria: String(row.categoria),
            subsistema: String(row.subsistema || 'Block'),
            descripcion: row.descripcion ? String(row.descripcion) : undefined,
            icono: row.icono ? String(row.icono) : 'Layers',
            tipo_vista: resolvedTipoVista,
            tabla_config: (row.tabla_config as TablaConfiguracion | undefined) || metaTablaConfig,
            parametros: params,
            activo: Boolean(row.activo),
            orden_visual: Number(row.orden_visual || 0),
            created_at: row.created_at ? String(row.created_at) : undefined,
            updated_at: row.updated_at ? String(row.updated_at) : undefined
          })
        })
      }
    } catch (e) {
      console.warn('[CatalogService] Error consultando grupos_repuestos en Supabase, usando respaldo:', e)
    }

    // Fallback offline a mockGruposRepuestos + cache local únicamente si Supabase no está disponible
    const localGrupos = getLocalDynamicGrupos()
    const deletedKeys = getLocalDeletedGroupKeys()
    const merged = mockGruposRepuestos.map(normalizeTableGroup)
    for (const locRaw of localGrupos) {
      const loc = normalizeTableGroup(locRaw)
      const existingIdx = merged.findIndex(m => m.codigo === loc.codigo || m.id === loc.id)
      if (existingIdx >= 0) {
        merged[existingIdx] = {
          ...merged[existingIdx],
          ...loc
        }
      } else {
        merged.push(loc)
      }
    }
    return merged.filter(g => !deletedKeys.has(g.id) && !deletedKeys.has(g.codigo))
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

    const tipoVista: GrupoTipoVista = grupoData.tipo_vista || (slug === 'anillos_motor' ? 'tabla' : 'normal')
    const tablaConfig = tipoVista === 'tabla' ? grupoData.tabla_config : undefined
    const paramsWithMeta = (grupoData.parametros || []).map((p, idx) =>
      idx === 0 ? ({ ...p, _tipo_vista: tipoVista, _tabla_config: tablaConfig } as ParametroTecnicoDefinicion) : p
    )

    const newGroup: GrupoRepuesto = {
      id: `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      codigo: slug,
      nombre: grupoData.nombre.trim(),
      categoria: grupoData.categoria.trim() || grupoData.nombre.trim(),
      subsistema: grupoData.subsistema || 'Block',
      descripcion: grupoData.descripcion?.trim() || undefined,
      icono: grupoData.icono || 'Layers',
      tipo_vista: tipoVista,
      tabla_config: tablaConfig,
      parametros: paramsWithMeta,
      activo: grupoData.activo !== false,
      orden_visual: grupoData.orden_visual || 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Insertar directamente en Supabase (fuente única de verdad)
    const { data, error } = await supabase
      .from('grupos_repuestos')
      .insert({
        codigo: newGroup.codigo,
        nombre: newGroup.nombre,
        categoria: newGroup.categoria,
        subsistema: newGroup.subsistema,
        descripcion: newGroup.descripcion ?? null,
        icono: newGroup.icono,
        parametros: newGroup.parametros,
        activo: newGroup.activo,
        orden_visual: newGroup.orden_visual
      })
      .select('*')
      .single()

    if (error || !data) {
      console.error('[CatalogService] Error creando familia en Supabase:', error)
      throw new Error(error?.message || 'No se pudo crear la familia en Supabase')
    }

    newGroup.id = String(data.id)
    if (data.created_at) newGroup.created_at = String(data.created_at)
    if (data.updated_at) newGroup.updated_at = String(data.updated_at)
    removeLocalDynamicGrupo(newGroup.id)
    removeLocalDynamicGrupo(newGroup.codigo)
    return newGroup
  },

  /**
   * Modifica un grupo o familia de piezas existente (nombre, categoría, subsistema, icono, tipo_vista, tabla_config, parámetros técnicos)
   */
  async updateGrupo(idOrCode: string, grupoData: Partial<GrupoRepuestoInsert>): Promise<GrupoRepuesto> {
    const existingList = await this.getGrupos()
    const existing = existingList.find(g => g.id === idOrCode || g.codigo === idOrCode)
    if (!existing) {
      throw new Error(`Grupo con identificador ${idOrCode} no encontrado`)
    }

    const resolvedTipoVista: GrupoTipoVista =
      grupoData.tipo_vista !== undefined
        ? grupoData.tipo_vista
        : (existing.tipo_vista || (existing.codigo === 'anillos_motor' ? 'tabla' : 'normal'))

    const resolvedTablaConfig: TablaConfiguracion | undefined =
      resolvedTipoVista === 'tabla'
        ? (grupoData.tabla_config !== undefined ? grupoData.tabla_config : existing.tabla_config)
        : undefined

    const rawParams = grupoData.parametros !== undefined ? grupoData.parametros : existing.parametros
    const paramsWithMeta = rawParams.map((p, idx) =>
      idx === 0 ? ({ ...p, _tipo_vista: resolvedTipoVista, _tabla_config: resolvedTablaConfig } as ParametroTecnicoDefinicion) : p
    )

    const updated: GrupoRepuesto = {
      ...existing,
      nombre: grupoData.nombre !== undefined ? grupoData.nombre.trim() : existing.nombre,
      categoria: grupoData.categoria !== undefined ? grupoData.categoria.trim() : existing.categoria,
      subsistema: grupoData.subsistema !== undefined ? grupoData.subsistema : existing.subsistema,
      descripcion: grupoData.descripcion !== undefined ? grupoData.descripcion.trim() : existing.descripcion,
      icono: grupoData.icono !== undefined ? grupoData.icono : existing.icono,
      tipo_vista: resolvedTipoVista,
      tabla_config: resolvedTablaConfig,
      parametros: paramsWithMeta,
      activo: grupoData.activo !== undefined ? grupoData.activo : existing.activo,
      orden_visual: grupoData.orden_visual !== undefined ? grupoData.orden_visual : existing.orden_visual,
      updated_at: new Date().toISOString()
    }

    // Actualizar directamente en Supabase (fuente única de verdad)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updated.id)
    const dbPayload = {
      nombre: updated.nombre,
      categoria: updated.categoria,
      subsistema: updated.subsistema,
      descripcion: updated.descripcion ?? null,
      icono: updated.icono,
      parametros: updated.parametros,
      activo: updated.activo,
      orden_visual: updated.orden_visual,
      updated_at: updated.updated_at
    }

    const baseUpdate = supabase.from('grupos_repuestos').update(dbPayload)
    const { data, error } = await (
      isUuid
        ? baseUpdate.or(`id.eq.${updated.id},codigo.eq.${updated.codigo}`)
        : baseUpdate.eq('codigo', updated.codigo)
    )
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('[CatalogService] Error actualizando familia en Supabase:', error)
      throw new Error(error.message || 'No se pudo actualizar la familia en Supabase')
    }

    if (data) {
      updated.id = String(data.id)
    } else {
      // Si el grupo provenía de respaldo local y aún no existía en BD, insertarlo en Supabase
      const { data: inserted, error: insertError } = await supabase
        .from('grupos_repuestos')
        .insert({
          codigo: updated.codigo,
          ...dbPayload
        })
        .select('*')
        .single()
      if (insertError || !inserted) {
        console.error('[CatalogService] Error insertando familia en Supabase:', insertError)
        throw new Error(insertError?.message || 'No se pudo sincronizar la familia en Supabase')
      }
      updated.id = String(inserted.id)
    }

    removeLocalDynamicGrupo(updated.id)
    removeLocalDynamicGrupo(updated.codigo)
    return updated
  },

  /**
   * Elimina (o desactiva si hay restricciones de FK/RLS) una familia / grupo del catálogo
   */
  async deleteGrupo(idOrCode: string, codigoHint?: string): Promise<boolean> {
    const cleanId = String(idOrCode || '').trim()
    if (!cleanId) return false

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)
    const codeTarget = codigoHint?.trim() || (!isUuid ? cleanId : '')

    let query = supabase.from('grupos_repuestos').delete()
    if (isUuid && codeTarget) {
      query = query.or(`id.eq.${cleanId},codigo.eq.${codeTarget}`)
    } else if (isUuid) {
      query = query.eq('id', cleanId)
    } else {
      query = query.eq('codigo', codeTarget)
    }
    const { error } = await query

    if (error) {
      // Fallback: desactivar en BD si existen restricciones referenciales o políticas de DELETE
      let soft = supabase.from('grupos_repuestos').update({ activo: false, updated_at: new Date().toISOString() })
      if (isUuid && codeTarget) {
        soft = soft.or(`id.eq.${cleanId},codigo.eq.${codeTarget}`)
      } else if (isUuid) {
        soft = soft.eq('id', cleanId)
      } else {
        soft = soft.eq('codigo', codeTarget)
      }
      const { error: softError } = await soft
      if (softError) {
        console.error('[CatalogService] Error eliminando familia en Supabase:', softError)
        throw new Error(softError.message || error.message || 'No se pudo eliminar la familia en Supabase')
      }
    }

    removeLocalDynamicGrupo(cleanId)
    if (codeTarget && codeTarget !== cleanId) removeLocalDynamicGrupo(codeTarget)
    return true
  },

  /**
   * Registra un nuevo repuesto técnico con sus equivalencias directamente en Supabase
   */
  async createRepuesto(
    part: Partial<RepuestoTecnico>,
    equivalencias?: Array<{ marca_alterna: string; codigo_alterno: string; notas?: string }>
  ): Promise<RepuestoTecnico> {
    const rawOemParts = String(part.codigo_oem || '')
      .split(/[,\/;|\n]+/)
      .map(c => c.trim().toUpperCase())
      .filter(Boolean)
    const primaryOem = rawOemParts[0] || (part.codigo_oem || '').trim().toUpperCase()
    const oemFromMain = rawOemParts.slice(1)
    const rawAdditional = Array.isArray(part.codigos_oem_adicionales) ? part.codigos_oem_adicionales : []
    const extraFlat: string[] = []
    for (const a of rawAdditional) {
      extraFlat.push(...String(a || '').split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean))
    }
    const finalAdditional = Array.from(new Set([...oemFromMain, ...extraFlat].filter(c => c && c !== primaryOem)))

    const finalImagenes = Array.from(
      new Set([
        ...(Array.isArray(part.imagenes) ? part.imagenes.map(u => String(u || '').trim()) : []),
        part.imagen_url ? String(part.imagen_url).trim() : ''
      ].filter(Boolean))
    )
    const primaryImagenUrl = finalImagenes[0] || part.imagen_url || null
    const finalDocsPdf = Array.isArray(part.documentos_pdf) ? part.documentos_pdf : []
    const finalDisenos = Array.isArray(part.disenos_anillo) ? Array.from(new Set(part.disenos_anillo.map(d => String(d || '').trim()).filter(Boolean))) : []
    const finalDescripcion = part.descripcion_tecnica ? String(part.descripcion_tecnica).trim() : undefined

    const insertPayload = {
      motor_id: part.motor_id || null,
      codigo_oem: primaryOem,
      nombre: (part.nombre || '').trim(),
      subsistema: part.subsistema || 'Culata',
      categoria: part.categoria || 'Válvulas',
      precio: Number(part.precio || 0),
      stock: Number(part.stock || 0),
      estado: part.estado || 'Disponible',
      imagen_url: primaryImagenUrl,
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
        espesor_anillo3_mm: part.espesor_anillo3_mm != null ? Number(part.espesor_anillo3_mm) : null,
        codigos_oem_adicionales: finalAdditional,
        ...(finalDisenos.length > 0 ? { disenos_anillo: finalDisenos } : {}),
        ...(finalDescripcion ? { descripcion_tecnica: finalDescripcion } : {}),
        ...(part.dimensiones || {})
      },
      especificaciones_tecnicas: {
        codigos_oem_adicionales: finalAdditional,
        imagenes: finalImagenes,
        documentos_pdf: finalDocsPdf,
        ...(finalDisenos.length > 0 ? { disenos_anillo: finalDisenos } : {}),
        ...(finalDescripcion ? { descripcion_tecnica: finalDescripcion } : {}),
        ...(part.especificaciones_tecnicas || {})
      }
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
        if (mapped.motor_id) {
          const modelTokens = extractPartModelTokens(part)
          if (modelTokens.length > 0) {
            await this.syncPartModelsWithMotor(mapped.motor_id, modelTokens, false)
          }
        }
        clearCatalogPartsCache()
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
      codigos_oem_adicionales: part.codigos_oem_adicionales || [],
      nombre: insertPayload.nombre,
      subsistema: insertPayload.subsistema,
      categoria: insertPayload.categoria,
      precio: insertPayload.precio,
      stock: insertPayload.stock,
      estado: insertPayload.estado as any,
      imagen_url: insertPayload.imagen_url || undefined,
      imagenes: finalImagenes,
      documentos_pdf: finalDocsPdf,
      disenos_anillo: finalDisenos,
      descripcion_tecnica: finalDescripcion,
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

    clearCatalogPartsCache()
    saveLocalCustomRepuesto(fallbackPart)
    mockRepuestos.unshift(fallbackPart)
    return fallbackPart
  },

  /**
   * Modifica un repuesto técnico existente y actualiza sus equivalencias en Supabase
   */
  async updateRepuesto(
    partId: string,
    part: Partial<RepuestoTecnico>,
    equivalencias?: Array<{ marca_alterna: string; codigo_alterno: string; notas?: string }>
  ): Promise<RepuestoTecnico> {
    const rawOemParts = part.codigo_oem !== undefined
      ? String(part.codigo_oem || '').split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean)
      : []
    const primaryOem = rawOemParts.length > 0
      ? rawOemParts[0]
      : (part.codigo_oem !== undefined ? (part.codigo_oem || '').trim().toUpperCase() : undefined)
    const oemFromMain = rawOemParts.slice(1)
    const rawAdditional = Array.isArray(part.codigos_oem_adicionales) ? part.codigos_oem_adicionales : []
    const extraFlat: string[] = []
    for (const a of rawAdditional) {
      extraFlat.push(...String(a || '').split(/[,\/;|\n]+/).map(c => c.trim().toUpperCase()).filter(Boolean))
    }
    const finalAdditional = Array.from(new Set([...oemFromMain, ...extraFlat].filter(c => c && c !== primaryOem)))

    const hasImagenes = part.imagenes !== undefined
    const resolvedImagenes = hasImagenes
      ? Array.from(new Set((part.imagenes || []).map(u => String(u || '').trim()).filter(Boolean)))
      : (part.imagen_url ? [String(part.imagen_url).trim()] : undefined)
    const resolvedPrimaryImage = resolvedImagenes !== undefined
      ? (resolvedImagenes[0] || null)
      : (part.imagen_url !== undefined ? (part.imagen_url || null) : undefined)

    const updatePayload: Record<string, unknown> = {
      motor_id: part.motor_id !== undefined ? (part.motor_id || null) : undefined,
      codigo_oem: primaryOem,
      nombre: part.nombre !== undefined ? (part.nombre || '').trim() : undefined,
      subsistema: part.subsistema !== undefined ? part.subsistema : undefined,
      categoria: part.categoria !== undefined ? part.categoria : undefined,
      precio: part.precio !== undefined ? Number(part.precio || 0) : undefined,
      stock: part.stock !== undefined ? Number(part.stock || 0) : undefined,
      estado: part.estado !== undefined ? part.estado : undefined,
      imagen_url: resolvedPrimaryImage,
      diametro_cabeza_mm: part.diametro_cabeza_mm !== undefined ? (part.diametro_cabeza_mm != null ? Number(part.diametro_cabeza_mm) : null) : undefined,
      diametro_vastago_mm: part.diametro_vastago_mm !== undefined ? (part.diametro_vastago_mm != null ? Number(part.diametro_vastago_mm) : null) : undefined,
      longitud_total_mm: part.longitud_total_mm !== undefined ? (part.longitud_total_mm != null ? Number(part.longitud_total_mm) : null) : undefined,
      angulo_asiento_grados: part.angulo_asiento_grados !== undefined ? (part.angulo_asiento_grados != null ? Number(part.angulo_asiento_grados) : null) : undefined,
      diametro_cilindro_mm: part.diametro_cilindro_mm !== undefined ? (part.diametro_cilindro_mm != null ? Number(part.diametro_cilindro_mm) : null) : undefined,
      espesor_anillo1_mm: part.espesor_anillo1_mm !== undefined ? (part.espesor_anillo1_mm != null ? Number(part.espesor_anillo1_mm) : null) : undefined,
      espesor_anillo2_mm: part.espesor_anillo2_mm !== undefined ? (part.espesor_anillo2_mm != null ? Number(part.espesor_anillo2_mm) : null) : undefined,
      espesor_aceite_mm: part.espesor_aceite_mm !== undefined ? (part.espesor_aceite_mm != null ? Number(part.espesor_aceite_mm) : null) : undefined,
      tipo_cojinete: part.tipo_cojinete !== undefined ? (part.tipo_cojinete || null) : undefined,
      diametro_munon_mm: part.diametro_munon_mm !== undefined ? (part.diametro_munon_mm != null ? Number(part.diametro_munon_mm) : null) : undefined,
      diametro_alojamiento_mm: part.diametro_alojamiento_mm !== undefined ? (part.diametro_alojamiento_mm != null ? Number(part.diametro_alojamiento_mm) : null) : undefined,
      ancho_casquete_mm: part.ancho_casquete_mm !== undefined ? (part.ancho_casquete_mm != null ? Number(part.ancho_casquete_mm) : null) : undefined,
      dimensiones: part.dimensiones !== undefined ? {
        ...(part.dimensiones || {}),
        codigos_oem_adicionales: finalAdditional,
        ...(part.disenos_anillo !== undefined ? { disenos_anillo: part.disenos_anillo } : {}),
        ...(part.descripcion_tecnica !== undefined ? { descripcion_tecnica: part.descripcion_tecnica } : {})
      } : undefined,
      especificaciones_tecnicas: part.especificaciones_tecnicas !== undefined ? {
        ...(part.especificaciones_tecnicas || {}),
        codigos_oem_adicionales: finalAdditional,
        ...(resolvedImagenes !== undefined ? { imagenes: resolvedImagenes } : {}),
        ...(part.documentos_pdf !== undefined ? { documentos_pdf: part.documentos_pdf } : {}),
        ...(part.disenos_anillo !== undefined ? { disenos_anillo: part.disenos_anillo } : {}),
        ...(part.descripcion_tecnica !== undefined ? { descripcion_tecnica: part.descripcion_tecnica } : {})
      } : undefined,
      updated_at: new Date().toISOString()
    }

    // Limpiar claves undefined
    Object.keys(updatePayload).forEach(k => {
      if (updatePayload[k] === undefined) delete updatePayload[k]
    })

    try {
      const { data: updatedPart, error: partError } = await supabase
        .from('repuestos_tecnicos')
        .update(updatePayload)
        .eq('id', partId)
        .select('*, motor:motores(*, fabricante:fabricantes(*), modelo:modelos(*))')
        .single()

      if (!partError && updatedPart) {
        let finalEquivs: Equivalencia[] = []

        if (equivalencias !== undefined) {
          await supabase.from('equivalencias_repuestos').delete().eq('repuesto_id', partId)

          const validRows = equivalencias
            .filter(eq => eq.marca_alterna && eq.codigo_alterno && eq.codigo_alterno.trim().length > 0)
            .map(eq => ({
              repuesto_id: partId,
              marca_alterna: eq.marca_alterna.trim(),
              codigo_alterno: eq.codigo_alterno.trim().toUpperCase(),
              notas: eq.notas || null
            }))

          if (validRows.length > 0) {
            const { data: savedEquivs } = await supabase
              .from('equivalencias_repuestos')
              .insert(validRows)
              .select('*')
            if (savedEquivs) {
              finalEquivs = savedEquivs as Equivalencia[]
            }
          }
        } else {
          const { data: currentEquivs } = await supabase
            .from('equivalencias_repuestos')
            .select('*')
            .eq('repuesto_id', partId)
          if (currentEquivs) {
            finalEquivs = currentEquivs as Equivalencia[]
          }
        }

        const mapped = mapDbRepuestoToFrontend({
          ...updatedPart,
          equivalencias: finalEquivs
        })
        if (mapped.motor_id) {
          const modelTokens = extractPartModelTokens(part)
          if (modelTokens.length > 0) {
            await this.syncPartModelsWithMotor(mapped.motor_id, modelTokens, true)
          }
        }
        clearCatalogPartsCache()
        saveLocalCustomRepuesto(mapped)
        const mockIdx = mockRepuestos.findIndex(r => r.id === partId)
        if (mockIdx >= 0) {
          mockRepuestos[mockIdx] = mapped
        }
        return mapped
      }
    } catch (err) {
      console.warn('[CatalogService] Actualización en Supabase falló, usando respaldo local:', err)
    }

    // Fallback local
    const localParts = getLocalCustomRepuestos()
    const foundIdx = localParts.findIndex(p => p.id === partId)
    const existing = foundIdx >= 0 ? localParts[foundIdx] : mockRepuestos.find(r => r.id === partId)

    const updatedLocalPart: RepuestoTecnico = {
      ...(existing || ({} as RepuestoTecnico)),
      ...part,
      id: partId,
      equivalencias: equivalencias
        ? equivalencias.map((eq, i) => ({
            id: `eq-${Date.now()}-${i}`,
            repuesto_id: partId,
            marca_alterna: eq.marca_alterna,
            codigo_alterno: eq.codigo_alterno,
            notas: eq.notas
          }))
        : existing?.equivalencias || []
    }

    clearCatalogPartsCache()
    saveLocalCustomRepuesto(updatedLocalPart)
    const mIdx = mockRepuestos.findIndex(r => r.id === partId)
    if (mIdx >= 0) {
      mockRepuestos[mIdx] = updatedLocalPart
    }
    return updatedLocalPart
  },

  /**
   * Elimina un repuesto técnico de Supabase y del almacenamiento local
   */
  async deleteRepuesto(partId: string): Promise<boolean> {
    clearCatalogPartsCache()
    try {
      // 1. Eliminar equivalencias asociadas en Supabase
      await supabase
        .from('equivalencias_repuestos')
        .delete()
        .eq('repuesto_id', partId)

      // 2. Eliminar repuesto técnico en Supabase
      const { error } = await supabase
        .from('repuestos_tecnicos')
        .delete()
        .or(`id.eq.${partId},codigo_oem.eq.${partId}`)

      if (error) {
        console.warn('[CatalogService] Advertencia al eliminar en Supabase:', error.message)
      }
    } catch (err) {
      console.warn('[CatalogService] Error eliminando repuesto en Supabase:', err)
    }

    // 3. Eliminar de localStorage
    removeLocalCustomRepuesto(partId)

    // 4. Eliminar de mockRepuestos en memoria si existe
    const mockIdx = mockRepuestos.findIndex(r => r.id === partId || r.codigo_oem === partId)
    if (mockIdx >= 0) {
      mockRepuestos.splice(mockIdx, 1)
    }

    return true
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

/**
 * Ordena una lista de motores según la relevancia de búsqueda:
 * 1. Coincidencia exacta del código (ej. "2L" === "2L")
 * 2. Coincidencia exacta alfanumérica (ej. "2-L" vs "2L")
 * 3. Código que inicia con el término seguido de delimitador (ej. "2L-T", "2L TE", "2L/II", "2L_T")
 * 4. Código que inicia directamente con el término (ej. "2LT", "2LTE")
 * 5. Denominación de venta o nombre comercial idéntico
 * 6. Denominación de venta o nombre comercial que inicia con el término
 * 7. Código que contiene el término como palabra o delimitado (ej. "TOYOTA 2L", "MOTOR-2L")
 * 8. Código que contiene el término en cualquier parte (ej. "12L", "42L")
 * 9. Cualquier otra coincidencia
 * A igualdad de relevancia, el código más corto va primero, seguido de orden alfabético natural.
 */
export function sortMotorsByRelevance(motors: Motor[], query: string): Motor[] {
  const q = query.trim().toLowerCase()
  if (!q) return motors

  const qClean = q.replace(/[^a-z0-9]/g, '')

  const scoreMotor = (m: Motor): number => {
    const code = (m.codigo || '').trim().toLowerCase()
    const codeClean = code.replace(/[^a-z0-9]/g, '')
    const commName = (m.nombre_comercial || '').trim().toLowerCase()
    const denName = (m.denominacion_venta || '').trim().toLowerCase()

    // 0: Coincidencia EXACTA absoluta de código (ej: "2L" === "2L")
    if (code === q) return 0

    // 1: Coincidencia EXACTA alfanumérica de código (ej: "2-l" vs "2l")
    if (codeClean === qClean) return 1

    // 2: Código inicia con la consulta seguido de delimitador (ej: "2L-T", "2L TE", "2L/II", "2L_T")
    if (code.startsWith(q + '-') || code.startsWith(q + ' ') || code.startsWith(q + '_') || code.startsWith(q + '/')) {
      return 2
    }

    // 3: Código inicia directamente con la consulta (ej: "2LT", "2LTE")
    if (code.startsWith(q)) return 3

    // 4: Denominación de venta o nombre comercial es exactamente igual a la consulta
    if (denName === q || commName === q) return 4

    // 5: Denominación o nombre comercial inicia con la consulta
    if (denName.startsWith(q) || commName.startsWith(q)) return 5

    // 6: Código contiene la consulta delimitada (ej: "TOYOTA 2L", "D-2L")
    if (code.includes(' ' + q) || code.includes('-' + q) || code.includes('_' + q) || code.includes('/' + q)) return 6

    // 7: Código contiene la consulta en cualquier parte
    if (code.includes(q)) return 7

    // 8: Denominación o nombre comercial contiene la consulta
    if (denName.includes(q) || commName.includes(q)) return 8

    // 9: Otras coincidencias
    return 9
  }

  return [...motors].sort((a, b) => {
    const scoreA = scoreMotor(a)
    const scoreB = scoreMotor(b)
    if (scoreA !== scoreB) {
      return scoreA - scoreB
    }
    // A igualdad de relevancia, el código más corto va primero (ej: "2L-T" antes que "2L-TE")
    const lenDiff = (a.codigo || '').length - (b.codigo || '').length
    if (lenDiff !== 0) return lenDiff

    // Si tienen igual longitud, orden alfanumérico natural
    return (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true })
  })
}
