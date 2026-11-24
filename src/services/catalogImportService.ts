import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import {
  catalogService,
  chunkArray,
  clearCatalogPartsCache,
  normalizeText,
  runWithConcurrency,
  type Fabricante,
  type GrupoRepuesto,
  type Modelo,
  type Motor,
  type RepuestoTecnico,
  type TablaConfiguracion
} from './catalogService'
import {
  canActorModifyRepuesto,
  extractRepuestoOwner,
  preserveOwnerOnSpecs,
  stampOwnerOnSpecs,
  type CatalogActor,
  type RepuestoOwnerMeta
} from '@/utils/catalogPermissions'
import {
  convertTemplateToGrupoInsert,
  type FamilyTemplate,
  type TemplateColumnDef
} from '@/components/catalog/FamilyTemplates'

export type DuplicateStrategy = 'skip' | 'update' | 'create'
export type TemplateScope = 'general' | 'motors_only' | 'parts_only' | 'families_only'
export type ImportRowAction = 'upsert' | 'delete'

export interface FamilyExportMeta {
  tipo: 'exportacion_familia'
  version: 1
  familia_id: string
  familia_codigo: string
  familia_nombre: string
  familia_categoria: string
  exportado_en: string
  total_repuestos: number
}

export interface ParsedFamilyRow {
  rowIndex: number
  sheetName: string
  sourceId?: string
  action: ImportRowAction
  codigo: string
  nombre: string
  categoria: string
  subsistema: string
  descripcion?: string
  icono: string
  tipo_vista: 'normal' | 'tabla'
  titulo_primera_columna?: string
  titulo_grupo_filas?: string
  rawTablaConfig?: Partial<TablaConfiguracion>
  filas: Array<{ nombre: string; tipo_fila: 'normal' | 'central'; grupo_central?: string }>
  columnas: TemplateColumnDef[]
  status: 'valid' | 'warning' | 'error'
  messages: string[]
}

export interface ParsedMotorRow {
  rowIndex: number
  sheetName: string
  codigo: string
  fabricante: string
  numero_id?: string
  denominacion_venta?: string
  modelos: string[]
  cilindros?: number
  valvulas?: number
  cilindrada_cc?: number
  kw?: number
  cv?: number
  combustible: string
  diametro_cilindro_std_mm?: number
  aspiracion?: string
  anios?: string
  status: 'valid' | 'warning' | 'error'
  messages: string[]
}

export interface ParsedEquivalenciaInput {
  marca_alterna: string
  codigo_alterno: string
  notas?: string
}

export interface ParsedPartRow {
  rowIndex: number
  sheetName: string
  sourceId?: string
  action: ImportRowAction
  codigo_oem: string
  codigos_oem_adicionales: string[]
  nombre: string
  familiaRaw: string
  resolvedGrupoCodigo?: string
  resolvedGrupoNombre?: string
  subsistema: string
  categoria: string
  fabricante: string
  motorCodigo: string
  modelos: string[]
  anio?: string
  catalogo_origen: string
  precio: number
  stock: number
  estado: 'Disponible' | 'Bajo Stock' | 'Agotado'
  descripcion_tecnica?: string
  imagen_url?: string
  imagenes?: string[]
  equivalencias: ParsedEquivalenciaInput[]
  dimensiones: Record<string, unknown>
  disenos_anillo: string[]
  // Cotas estándar mapeadas directamente en columnas SQL
  diametro_cabeza_mm?: number | null
  diametro_vastago_mm?: number | null
  longitud_total_mm?: number | null
  angulo_asiento_grados?: number | null
  diametro_interior_mm?: number | null
  diametro_exterior_mm?: number | null
  altura_mm?: number | null
  diametro_cilindro_mm?: number | null
  espesor_anillo1_mm?: number | null
  espesor_anillo2_mm?: number | null
  espesor_anillo3_mm?: number | null
  espesor_aceite_mm?: number | null
  medida_rosca?: string | null
  paso_rosca_mm?: number | null
  longitud_perno_mm?: number | null
  cantidad_piezas?: number | null
  status: 'valid' | 'warning' | 'error'
  messages: string[]
}

export interface CatalogImportParseResult {
  fileName: string
  format: 'excel' | 'json'
  families: ParsedFamilyRow[]
  motors: ParsedMotorRow[]
  parts: ParsedPartRow[]
  warnings: string[]
  exportMeta?: FamilyExportMeta | null
  isFamilyExportPackage?: boolean
}

export interface CatalogImportOptions {
  defaultGrupo?: GrupoRepuesto | null
  duplicateStrategy: DuplicateStrategy
  autoCreateEntities: boolean
  syncFamilyDeleteMissing?: boolean
  syncTargetGrupo?: GrupoRepuesto | null
  deletePartsWithDeletedFamily?: boolean
  actor?: CatalogActor | null
  onProgress?: (current: number, total: number, label: string) => void
}

export interface CatalogImportReport {
  createdFamilies: number
  updatedFamilies: number
  deletedFamilies: number
  skippedFamilies: number
  createdMotors: number
  skippedMotors: number
  createdParts: number
  updatedParts: number
  deletedParts: number
  skippedParts: number
  skippedUnauthorizedParts: number
  createdBrands: number
  createdModels: number
  deletedPartIds: string[]
  deletedFamilyIds: string[]
  errors: Array<{ rowLabel: string; message: string }>
}

// =============================================================================
// UTILIDADES DE NORMALIZACIÓN Y PARSEO
// =============================================================================

const normalizeKey = (raw: string): string => {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const parseNumberValue = (val: unknown): number | null => {
  if (val === undefined || val === null || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null
  const str = String(val).trim().replace(',', '.')
  if (!str) return null
  const num = Number(str)
  return Number.isFinite(num) ? num : null
}

const splitTokens = (val: unknown): string[] => {
  if (Array.isArray(val)) {
    return val.flatMap(v => splitTokens(v))
  }
  return String(val || '')
    .split(/[,;/|\n]+/)
    .map(t => t.trim())
    .filter(Boolean)
}

const pickField = (normRow: Record<string, unknown>, aliases: string[]): unknown => {
  for (const alias of aliases) {
    const k = normalizeKey(alias)
    if (normRow[k] !== undefined && normRow[k] !== null && String(normRow[k]).trim() !== '') {
      return normRow[k]
    }
  }
  return undefined
}

const KNOWN_ALT_BRAND_COLUMNS: Array<{ aliases: string[]; brand: string }> = [
  { aliases: ['codigo_dokuro', 'dokuro'], brand: 'DOKURO' },
  { aliases: ['codigo_rik', 'rik'], brand: 'RIK' },
  { aliases: ['codigo_npr', 'npr'], brand: 'NPR' },
  { aliases: ['codigo_ajusa', 'ajusa'], brand: 'AJUSA' },
  { aliases: ['codigo_ndc', 'ndc'], brand: 'NDC' },
  { aliases: ['codigo_taiho', 'taiho'], brand: 'TAIHO' },
  { aliases: ['codigo_mrk', 'mrk'], brand: 'MRK' },
  { aliases: ['codigo_pioneer', 'pioneer'], brand: 'PIONEER' },
  { aliases: ['codigo_tp', 'tp'], brand: 'TP' }
]

const parseEquivalenciasField = (
  raw: unknown,
  normRow: Record<string, unknown>
): ParsedEquivalenciaInput[] => {
  const result: ParsedEquivalenciaInput[] = []
  const seen = new Set<string>()

  const pushEq = (marca: string, codigo: string, notas?: string) => {
    const cleanBrand = String(marca || '').trim().toUpperCase()
    const cleanCode = String(codigo || '').trim().toUpperCase()
    if (!cleanBrand || !cleanCode) return
    const sig = `${cleanBrand}::${cleanCode}`
    if (seen.has(sig)) return
    seen.add(sig)
    result.push({ marca_alterna: cleanBrand, codigo_alterno: cleanCode, notas })
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        pushEq(
          String(obj.marca_alterna || obj.marca || obj.catalogo || ''),
          String(obj.codigo_alterno || obj.codigo || ''),
          obj.notas ? String(obj.notas) : undefined
        )
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      for (const code of splitTokens(v)) {
        pushEq(k, code)
      }
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return parseEquivalenciasField(JSON.parse(trimmed), normRow)
      } catch {
        // continuar como texto plano
      }
    }
    const entries = trimmed.split(/[;\n|]+/).map(s => s.trim()).filter(Boolean)
    for (const entry of entries) {
      const sepMatch = entry.match(/^([^:=]+)\s*[:=]\s*(.+)$/)
      if (sepMatch) {
        const brand = sepMatch[1]!.trim()
        for (const code of splitTokens(sepMatch[2])) {
          pushEq(brand, code)
        }
      } else {
        pushEq('ALTERNO', entry)
      }
    }
  }

  // Rescatar columnas individuales por marca alterna en Excel
  for (const col of KNOWN_ALT_BRAND_COLUMNS) {
    const val = pickField(normRow, col.aliases)
    if (val !== undefined) {
      for (const code of splitTokens(val)) {
        pushEq(col.brand, code)
      }
    }
  }

  return result
}

const resolveGrupoMatch = (
  rawFamilia: string,
  grupos: GrupoRepuesto[],
  defaultGrupo?: GrupoRepuesto | null
): GrupoRepuesto | undefined => {
  const clean = normalizeText(rawFamilia || '')
  if (clean) {
    const exact = grupos.find(
      g =>
        normalizeText(g.codigo) === clean ||
        normalizeText(g.nombre) === clean ||
        normalizeText(g.categoria) === clean ||
        normalizeText(g.id) === clean
    )
    if (exact) return exact
    const partial = grupos.find(
      g =>
        normalizeText(g.nombre).includes(clean) ||
        clean.includes(normalizeText(g.codigo)) ||
        clean.includes(normalizeText(g.categoria))
    )
    if (partial) return partial
  }
  return defaultGrupo || undefined
}

const buildRowNormalizedMap = (row: Record<string, unknown>): Record<string, unknown> => {
  const norm: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeKey(k)
    if (nk) norm[nk] = v
  }
  return norm
}

const parseMotorRowObject = (
  rawObj: Record<string, unknown>,
  rowIndex: number,
  sheetName: string
): ParsedMotorRow | null => {
  const norm = buildRowNormalizedMap(rawObj)
  const codigo = String(
    pickField(norm, ['codigo', 'codigo_motor', 'motor', 'engine_code']) || ''
  )
    .trim()
    .toUpperCase()
  const fabricante = String(
    pickField(norm, ['fabricante', 'marca', 'brand', 'manufacturer']) || ''
  ).trim()

  // Omitir filas completamente vacías
  const nonEmptyValues = Object.values(rawObj).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
  if (nonEmptyValues.length === 0) return null

  const rawModelos = pickField(norm, ['modelos', 'modelo', 'modelos_compatibles', 'vehiculo'])
  const modelos = splitTokens(rawModelos)
  const cilindros = parseNumberValue(pickField(norm, ['cilindros', 'cil', 'cylinders'])) ?? undefined
  const valvulas = parseNumberValue(pickField(norm, ['valvulas', 'valves'])) ?? undefined
  const cilindrada_cc = parseNumberValue(pickField(norm, ['cilindrada_cc', 'cilindrada', 'cc'])) ?? undefined
  const kw = parseNumberValue(pickField(norm, ['kw', 'potencia_kw'])) ?? undefined
  const cv = parseNumberValue(pickField(norm, ['cv', 'hp', 'potencia_cv'])) ?? undefined
  const diamStd =
    parseNumberValue(pickField(norm, ['diametro_cilindro_std_mm', 'diametro_std', 'bore_mm'])) ?? undefined
  const combustible = String(pickField(norm, ['combustible', 'fuel']) || 'Diésel').trim() || 'Diésel'
  const aspiracion = String(pickField(norm, ['aspiracion', 'aspiration']) || 'Natural').trim()
  const denominacion = String(
    pickField(norm, ['denominacion_venta', 'denominacion', 'serie', 'nombre_comercial']) || ''
  ).trim()
  const numeroIdRaw = pickField(norm, ['numero_id', 'id_tecnico', 'numero'])
  const numero_id = numeroIdRaw !== undefined ? String(numeroIdRaw).trim() : undefined
  const anios = String(pickField(norm, ['anios', 'anio', 'ano', 'years']) || '').trim() || undefined

  const messages: string[] = []
  let status: ParsedMotorRow['status'] = 'valid'
  if (!codigo) {
    status = 'error'
    messages.push('Falta el código de motor')
  }
  if (!fabricante) {
    status = 'error'
    messages.push('Falta el fabricante / marca')
  }

  return {
    rowIndex,
    sheetName,
    codigo,
    fabricante,
    numero_id,
    denominacion_venta: denominacion || (modelos.length > 0 ? modelos.join(' / ') : undefined),
    modelos,
    cilindros,
    valvulas,
    cilindrada_cc,
    kw,
    cv,
    combustible,
    diametro_cilindro_std_mm: diamStd,
    aspiracion,
    anios,
    status,
    messages
  }
}

const parseRowAction = (raw: unknown): ImportRowAction => {
  const norm = normalizeKey(String(raw || ''))
  if (['eliminar', 'borrar', 'delete', 'remove', 'quitar', 'baja'].includes(norm)) {
    return 'delete'
  }
  return 'upsert'
}

const dedupeColumnDefs = (cols: TemplateColumnDef[]): TemplateColumnDef[] => {
  const seen = new Set<string>()
  const result: TemplateColumnDef[] = []
  for (const col of cols) {
    const keySig = col.clave
      ? normalizeKey(col.clave)
      : normalizeKey(`${col.columna_padre || ''}_${col.etiqueta || ''}`)
    if (!keySig || seen.has(keySig)) continue
    seen.add(keySig)
    result.push(col)
  }
  return result
}

const buildSyntheticGruposForParsing = (
  baseGrupos: GrupoRepuesto[],
  parsedFamilies: ParsedFamilyRow[]
): GrupoRepuesto[] => {
  const merged = [...baseGrupos]
  for (const fRow of parsedFamilies) {
    if (fRow.action === 'delete' || fRow.status === 'error' || !fRow.nombre.trim()) continue
    const tpl: FamilyTemplate = {
      id: fRow.codigo || fRow.sourceId || `imp_${Date.now()}`,
      nombre: fRow.nombre,
      categoria: fRow.categoria || fRow.nombre,
      subsistema: fRow.subsistema || 'Block',
      descripcion: fRow.descripcion || `Familia ${fRow.nombre}`,
      icono: fRow.icono || 'Layers',
      tipo_vista: fRow.tipo_vista,
      ...(fRow.tipo_vista === 'tabla'
        ? {
            tabla_config: {
              ...(fRow.rawTablaConfig || {}),
              titulo_primera_columna: fRow.titulo_primera_columna || 'Componente',
              ...(fRow.titulo_grupo_filas ? { titulo_grupo_filas: fRow.titulo_grupo_filas } : {}),
              modo_filas: fRow.rawTablaConfig?.modo_filas || 'subfilas',
              subfilas_activas: true,
              subfilas: fRow.filas.length > 0 ? fRow.filas.map(r => r.nombre) : ['Componente 1'],
              subfila_padres: fRow.filas.length > 0 ? fRow.filas.map(r => r.grupo_central || '') : [''],
              subfila_tipos: fRow.filas.length > 0 ? fRow.filas.map(r => r.tipo_fila) : ['normal']
            }
          }
        : {}),
      columnas: fRow.columnas
    }
    const insertPayload = convertTemplateToGrupoInsert(
      tpl,
      fRow.nombre,
      fRow.categoria || fRow.nombre,
      fRow.subsistema
    )
    const syntheticGrupo: GrupoRepuesto = {
      id: fRow.sourceId || fRow.codigo || insertPayload.codigo || fRow.nombre,
      codigo: fRow.codigo || insertPayload.codigo || fRow.nombre,
      nombre: insertPayload.nombre,
      categoria: insertPayload.categoria,
      subsistema: insertPayload.subsistema || fRow.subsistema || 'Block',
      descripcion: insertPayload.descripcion,
      icono: insertPayload.icono || 'Layers',
      tipo_vista: insertPayload.tipo_vista,
      tabla_config: insertPayload.tabla_config,
      parametros: insertPayload.parametros,
      activo: true
    }

    const idx = merged.findIndex(
      g =>
        (fRow.sourceId && g.id === fRow.sourceId) ||
        normalizeText(g.codigo) === normalizeText(syntheticGrupo.codigo) ||
        normalizeText(g.nombre) === normalizeText(syntheticGrupo.nombre)
    )
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...syntheticGrupo, id: merged[idx]!.id }
    } else {
      merged.push(syntheticGrupo)
    }
  }
  return merged
}

const parsePartRowObject = (
  rawObj: Record<string, unknown>,
  rowIndex: number,
  sheetName: string,
  grupos: GrupoRepuesto[],
  defaultGrupo?: GrupoRepuesto | null
): ParsedPartRow | null => {
  const nonEmptyValues = Object.values(rawObj).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
  if (nonEmptyValues.length === 0) return null

  const norm = buildRowNormalizedMap(rawObj)
  const sourceId =
    String(pickField(norm, ['id', 'repuesto_id', 'part_id']) || '').trim() || undefined
  const action = parseRowAction(pickField(norm, ['accion', 'operacion', 'action']))

  const rawOemVal = pickField(norm, ['codigo_oem', 'oem', 'codigo', 'numero_parte', 'part_number'])
  const oemTokens = splitTokens(rawOemVal).map(c => c.toUpperCase())
  const extraOemTokens = splitTokens(
    pickField(norm, ['codigos_oem_adicionales', 'oem_adicionales', 'otros_oem'])
  ).map(c => c.toUpperCase())
  const codigo_oem = oemTokens[0] || ''
  const codigos_oem_adicionales = Array.from(
    new Set([...oemTokens.slice(1), ...extraOemTokens].filter(c => c && c !== codigo_oem))
  )

  const fabricante = String(pickField(norm, ['fabricante', 'marca', 'brand']) || '').trim()
  const motorCodigo = String(
    pickField(norm, ['motor', 'codigo_motor', 'motor_codigo', 'engine']) || ''
  )
    .trim()
    .toUpperCase()
  const modelos = splitTokens(pickField(norm, ['modelos', 'modelo', 'vehiculo']))
  const anio = String(pickField(norm, ['anio', 'ano', 'anios', 'years']) || '').trim() || undefined

  const familiaRaw = String(
    pickField(norm, ['familia', 'grupo', 'componente', 'categoria']) || ''
  ).trim()
  const resolvedGrupo = resolveGrupoMatch(familiaRaw, grupos, defaultGrupo)

  const categoria = String(
    pickField(norm, ['categoria']) || resolvedGrupo?.categoria || 'General'
  ).trim()
  const subsistema = String(
    pickField(norm, ['subsistema']) || resolvedGrupo?.subsistema || 'Motor'
  ).trim()

  const rawNombre = String(pickField(norm, ['nombre', 'descripcion', 'producto']) || '').trim()
  const autoNombre = [
    fabricante.toUpperCase(),
    modelos.join(' / '),
    resolvedGrupo?.nombre || categoria,
    codigo_oem ? `(${codigo_oem})` : ''
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
  const nombre = rawNombre || autoNombre

  const catalogo_origen = String(
    pickField(norm, ['catalogo_origen', 'catalogo', 'marca_catalogo', 'origen']) || 'OEM'
  )
    .trim()
    .toUpperCase()

  const precio = parseNumberValue(pickField(norm, ['precio', 'price'])) ?? 0
  const stock = parseNumberValue(pickField(norm, ['stock', 'cantidad', 'existencia'])) ?? 0
  const rawEstado = String(pickField(norm, ['estado', 'status']) || 'Disponible').trim()
  const estado: ParsedPartRow['estado'] =
    rawEstado === 'Bajo Stock' || rawEstado === 'Agotado' ? rawEstado : 'Disponible'
  const descripcion_tecnica =
    String(pickField(norm, ['descripcion_tecnica', 'notas', 'observaciones']) || '').trim() || undefined
  let imagen_url = String(pickField(norm, ['imagen_url', 'foto', 'imagen']) || '').trim() || undefined

  const extraImagenes: string[] = []
  const rawImagenesSource = rawObj.imagenes ?? pickField(norm, ['imagenes_json', 'imagenes'])
  if (Array.isArray(rawImagenesSource)) {
    for (const u of rawImagenesSource) {
      const cleanU = String(u || '').trim()
      if (cleanU) extraImagenes.push(cleanU)
    }
  } else if (typeof rawImagenesSource === 'string' && rawImagenesSource.trim()) {
    const trimmedImg = rawImagenesSource.trim()
    if (trimmedImg.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmedImg)
        if (Array.isArray(arr)) {
          arr.forEach(u => {
            const cleanU = String(u || '').trim()
            if (cleanU) extraImagenes.push(cleanU)
          })
        }
      } catch {
        // Ignorar JSON inválido en imagenes_json
      }
    } else {
      trimmedImg
        .split(/[\n,;]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(u => extraImagenes.push(u))
    }
  }
  const imagenes = Array.from(
    new Set([...(imagen_url ? [imagen_url] : []), ...extraImagenes].filter(Boolean))
  )
  if (!imagen_url && imagenes.length > 0) {
    imagen_url = imagenes[0]
  }

  const equivalencias = parseEquivalenciasField(
    pickField(norm, ['equivalencias', 'alternos', 'cruces', 'catalogos_alternos']),
    norm
  )

  // Construir dimensiones base
  const dimensiones: Record<string, unknown> = {}
  const rawDimJson = rawObj.dimensiones && typeof rawObj.dimensiones === 'object' ? (rawObj.dimensiones as Record<string, unknown>) : null
  if (rawDimJson) {
    Object.assign(dimensiones, rawDimJson)
  } else {
    const dimJsonText = pickField(norm, ['dimensiones_json', 'dimensiones'])
    if (typeof dimJsonText === 'string' && dimJsonText.trim().startsWith('{')) {
      try {
        Object.assign(dimensiones, JSON.parse(dimJsonText.trim()))
      } catch {
        // Ignorar JSON inválido en celda
      }
    }
  }

  // Mapear parámetros dinámicos definidos en la familia resuelta (incluyendo alias con columna_padre)
  const paramLabelCounts = new Map<string, number>()
  for (const p of resolvedGrupo?.parametros || []) {
    const k = normalizeKey(p.etiqueta)
    if (k) paramLabelCounts.set(k, (paramLabelCounts.get(k) || 0) + 1)
  }
  const ambiguousParamLabels = new Set<string>(
    Array.from(paramLabelCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([k]) => k)
  )

  const pickDynamicParamValue = (
    targetNorm: Record<string, unknown>,
    p: NonNullable<GrupoRepuesto['parametros']>[number]
  ): unknown => {
    const aliases: string[] = [p.clave]
    const keyNoMm = p.clave.replace(/_mm$/i, '')
    if (keyNoMm && keyNoMm !== p.clave) aliases.push(keyNoMm)

    if (p.columna_padre && p.columna_padre.trim()) {
      const padre = p.columna_padre.trim()
      aliases.push(`${padre}_${p.etiqueta}`, `${padre} ${p.etiqueta}`)
      if (p.etiqueta_corta && p.etiqueta_corta.trim()) {
        aliases.push(`${padre}_${p.etiqueta_corta}`, `${padre} ${p.etiqueta_corta}`)
      }
    }

    const normEtiqueta = normalizeKey(p.etiqueta)
    if (!p.columna_padre || !ambiguousParamLabels.has(normEtiqueta)) {
      aliases.push(p.etiqueta)
      if (p.etiqueta_corta) aliases.push(p.etiqueta_corta)
    }

    const val = pickField(targetNorm, aliases)
    if (val === undefined) return undefined
    if (p.tipo_dato === 'numero') {
      const n = parseNumberValue(val)
      return n !== null ? n : undefined
    }
    if (p.tipo_dato === 'booleano') {
      const s = String(val).trim().toLowerCase()
      return s === 'si' || s === 'sí' || s === 'true' || s === '1'
    }
    return String(val).trim()
  }

  if (resolvedGrupo?.parametros) {
    for (const p of resolvedGrupo.parametros) {
      const mappedVal = pickDynamicParamValue(norm, p)
      if (mappedVal !== undefined) {
        dimensiones[p.clave] = mappedVal
      }
    }
  }

  // Cotas estándar (válvulas, sellos, pernos, casquetería, anillos)
  const diametro_cabeza_mm =
    parseNumberValue(pickField(norm, ['diametro_cabeza_mm', 'hongo', 'hongo_mm', 'diametro_cabeza'])) ??
    parseNumberValue(dimensiones.diametro_cabeza_mm)
  const diametro_vastago_mm =
    parseNumberValue(pickField(norm, ['diametro_vastago_mm', 'vastago', 'vastago_mm', 'diametro_vastago'])) ??
    parseNumberValue(dimensiones.diametro_vastago_mm)
  const longitud_total_mm =
    parseNumberValue(pickField(norm, ['longitud_total_mm', 'largo', 'largo_mm', 'longitud_total'])) ??
    parseNumberValue(dimensiones.longitud_total_mm)
  const angulo_asiento_grados =
    parseNumberValue(pickField(norm, ['angulo_asiento_grados', 'angulo', 'asiento_grados'])) ??
    parseNumberValue(dimensiones.angulo_asiento_grados)

  const diametro_interior_mm =
    parseNumberValue(pickField(norm, ['diametro_interior_mm', 'diam_int', 'interior_mm', 'diametro_interior'])) ??
    parseNumberValue(dimensiones.diametro_interior_mm)
  const diametro_exterior_mm =
    parseNumberValue(pickField(norm, ['diametro_exterior_mm', 'diam_ext', 'exterior_mm', 'diametro_exterior'])) ??
    parseNumberValue(dimensiones.diametro_exterior_mm)
  const altura_mm =
    parseNumberValue(pickField(norm, ['altura_mm', 'altura'])) ?? parseNumberValue(dimensiones.altura_mm)

  const medida_rosca =
    String(pickField(norm, ['medida_rosca', 'rosca']) || dimensiones.medida_rosca || '').trim() || null
  const paso_rosca_mm =
    parseNumberValue(pickField(norm, ['paso_rosca_mm', 'paso_rosca'])) ??
    parseNumberValue(dimensiones.paso_rosca_mm)
  const longitud_perno_mm =
    parseNumberValue(pickField(norm, ['longitud_perno_mm', 'longitud_perno'])) ??
    parseNumberValue(dimensiones.longitud_perno_mm)
  const cantidad_piezas =
    parseNumberValue(pickField(norm, ['cantidad_piezas', 'piezas'])) ??
    parseNumberValue(dimensiones.cantidad_piezas)

  // Anillos: soportar array JSON `anillos` O columnas planas anillo1..anilloN + anillo_aceite (siempre al final)
  let diametro_cilindro_mm =
    parseNumberValue(pickField(norm, ['diametro_cilindro_mm', 'diametro_cilindro', 'diametro_piston', 'diametro'])) ??
    parseNumberValue(dimensiones.diametro_cilindro_mm)
  let espesor_anillo1_mm =
    parseNumberValue(pickField(norm, ['espesor_anillo1_mm', 'anillo1_grosor', 'anillo_1_grosor', 'anillo1_h1'])) ??
    parseNumberValue(dimensiones.espesor_anillo1_mm)
  let espesor_anillo2_mm =
    parseNumberValue(pickField(norm, ['espesor_anillo2_mm', 'anillo2_grosor', 'anillo_2_grosor', 'anillo2_h1'])) ??
    parseNumberValue(dimensiones.espesor_anillo2_mm)
  let espesor_anillo3_mm =
    parseNumberValue(pickField(norm, ['espesor_anillo3_mm', 'anillo3_grosor', 'anillo_3_grosor', 'anillo3_h1'])) ??
    parseNumberValue(dimensiones.espesor_anillo3_mm)
  let espesor_aceite_mm =
    parseNumberValue(
      pickField(norm, ['espesor_aceite_mm', 'anillo_aceite_grosor', 'aceite_grosor', 'aceite_h1', 'ultimo_anillo_grosor'])
    ) ?? parseNumberValue(dimensiones.espesor_aceite_mm)

  const disenosSet = new Set<string>(splitTokens(pickField(norm, ['disenos_anillo', 'disenos', 'diseno'])))
  if (Array.isArray(rawObj.disenos_anillo)) {
    for (const d of rawObj.disenos_anillo) {
      if (String(d || '').trim()) disenosSet.add(String(d).trim())
    }
  }

  let rawRingsList: Array<Record<string, unknown>> = []
  const rawAnillosVal = rawObj.anillos ?? dimensiones.anillos ?? pickField(norm, ['anillos_json', 'anillos'])
  if (Array.isArray(rawAnillosVal)) {
    rawRingsList = rawAnillosVal.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
  } else if (typeof rawAnillosVal === 'string' && rawAnillosVal.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(rawAnillosVal.trim())
      if (Array.isArray(arr)) rawRingsList = arr
    } catch {
      // ignorar
    }
  }

  let parsedRings: Array<Record<string, unknown>> = []

  if (rawRingsList.length === 0) {
    // Reconstruir arreglo anillos[] a partir de columnas planas de Excel/JSON.
    // Soporta cualquier cantidad de anillos de compresión (1°, 2°, 3°, 4°, 5°, ...) y el anillo de aceite SIEMPRE al final.
    const discoveredCompIndices = new Set<number>([1, 2, 3, 4])
    for (const key of Object.keys(norm)) {
      const m = key.match(/^anillo_?(\d+)_(?:grosor|altura|diseno|perfil|forma|h1|a1|espesor|tipo_diseno)$/)
      if (m) {
        const idx = Number(m[1])
        if (idx >= 1 && idx <= 20) discoveredCompIndices.add(idx)
      }
      const mEsp = key.match(/^(?:espesor_anillo|altura_radial)(\d+)_mm$/)
      if (mEsp) {
        const idx = Number(mEsp[1])
        if (idx >= 1 && idx <= 20) discoveredCompIndices.add(idx)
      }
    }

    const sortedCompIndices = Array.from(discoveredCompIndices).sort((a, b) => a - b)
    for (const idx of sortedCompIndices) {
      const hVal =
        parseNumberValue(
          pickField(norm, [
            `espesor_anillo${idx}_mm`,
            `anillo${idx}_grosor`,
            `anillo_${idx}_grosor`,
            `anillo${idx}_h1`,
            `anillo${idx}_espesor`
          ])
        ) ??
        (idx === 1 ? espesor_anillo1_mm : idx === 2 ? espesor_anillo2_mm : idx === 3 ? espesor_anillo3_mm : parseNumberValue(dimensiones[`espesor_anillo${idx}_mm`]))
      const aVal =
        parseNumberValue(
          pickField(norm, [
            `anillo${idx}_altura`,
            `anillo_${idx}_altura`,
            `anillo${idx}_a1`,
            `altura_radial${idx}_mm`,
            `espesor_radial${idx}_mm`
          ])
        ) ?? parseNumberValue(dimensiones[`altura_radial${idx}_mm`] ?? dimensiones[`espesor_radial${idx}_mm`])
      const dVal = String(
        pickField(norm, [`anillo${idx}_diseno`, `anillo_${idx}_diseno`, `anillo${idx}_perfil`, `anillo${idx}_tipo_diseno`]) || ''
      ).trim()

      if (hVal != null || aVal != null || dVal !== '') {
        parsedRings.push({
          posicion: `${idx}° Anillo`,
          tipo_aro: idx === 1 ? 'fuego' : 'compresion',
          d1: diametro_cilindro_mm,
          h1: hVal,
          a1: aVal,
          perfil: dVal || 'Plano',
          forma: dVal || 'Plano'
        })
        if (dVal) disenosSet.add(dVal)
      }
    }

    const rOilH = espesor_aceite_mm
    const rOilA = parseNumberValue(
      pickField(norm, ['anillo_aceite_altura', 'aceite_altura', 'aceite_a1', 'altura_radial_aceite_mm', 'ultimo_anillo_altura'])
    )
    const rOilD = String(
      pickField(norm, ['anillo_aceite_diseno', 'aceite_diseno', 'aceite_perfil', 'anillo_aceite_tipo_diseno', 'ultimo_anillo_diseno']) || ''
    ).trim()

    // Anillo de aceite siempre al FINAL de la lista
    if (rOilH != null || rOilA != null || rOilD !== '') {
      parsedRings.push({
        posicion: 'Anillo de aceite',
        tipo_aro: 'aceite',
        d1: diametro_cilindro_mm,
        h1: rOilH,
        a1: rOilA,
        perfil: rOilD || 'Estándar',
        forma: rOilD || 'Estándar'
      })
      if (rOilD) disenosSet.add(rOilD)
    }
  } else {
    // Normalizar array JSON `anillos` (soporta 3, 4, 5 o más anillos) asegurando que el último SIEMPRE sea el de aceite
    const normalizedEntries = rawRingsList.map((r, idx) => {
      const rNorm: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(r)) {
        rNorm[normalizeKey(k)] = v
      }
      const d1 =
        parseNumberValue(r.d1 ?? rNorm.diametro_cilindro_mm ?? rNorm.diametro ?? diametro_cilindro_mm) ??
        diametro_cilindro_mm
      const h1 = parseNumberValue(r.h1 ?? rNorm.grosor_mm ?? rNorm.grosor ?? rNorm.espesor ?? rNorm.h1)
      const a1 = parseNumberValue(r.a1 ?? rNorm.altura_mm ?? rNorm.altura ?? rNorm.radial ?? rNorm.a1)
      const disenoStr = String(r.tipo_diseno ?? r.perfil ?? r.forma ?? rNorm.diseno ?? '').trim()
      const posStr = String(r.posicion ?? r.nombre ?? '').trim()
      const tipoAroStr = String(r.tipo_aro ?? '').trim().toLowerCase()
      const explicitOil =
        tipoAroStr === 'aceite' ||
        posStr.toLowerCase().includes('aceite') ||
        posStr.toLowerCase().includes('oil')

      if (diametro_cilindro_mm == null && d1 != null) {
        diametro_cilindro_mm = d1
      }
      if (disenoStr) disenosSet.add(disenoStr)

      return {
        raw: r,
        origIdx: idx,
        d1,
        h1,
        a1,
        disenoStr,
        posStr,
        explicitOil
      }
    })

    let oilEntryIdx = normalizedEntries.findIndex(e => e.explicitOil)
    if (oilEntryIdx < 0 && normalizedEntries.length >= 2) {
      // Regla de taller: cuando hay 2 o más anillos sin marcador explícito, el último siempre es el de aceite
      oilEntryIdx = normalizedEntries.length - 1
    }

    const compressionEntries = normalizedEntries.filter((_, i) => i !== oilEntryIdx)
    const oilEntry = oilEntryIdx >= 0 ? normalizedEntries[oilEntryIdx] : null

    parsedRings = compressionEntries.map((entry, idx) => ({
      ...entry.raw,
      posicion: entry.posStr && !/aceite|oil/i.test(entry.posStr) ? entry.posStr : `${idx + 1}° Anillo`,
      tipo_aro: idx === 0 ? 'fuego' : 'compresion',
      d1: entry.d1 ?? diametro_cilindro_mm,
      h1: entry.h1,
      a1: entry.a1,
      perfil: entry.disenoStr || String(entry.raw.perfil || 'Plano'),
      forma: entry.disenoStr || String(entry.raw.forma || 'Plano')
    }))

    if (oilEntry) {
      parsedRings.push({
        ...oilEntry.raw,
        posicion: 'Anillo de aceite',
        tipo_aro: 'aceite',
        d1: oilEntry.d1 ?? diametro_cilindro_mm,
        h1: oilEntry.h1,
        a1: oilEntry.a1,
        perfil: oilEntry.disenoStr || String(oilEntry.raw.perfil || 'Estándar'),
        forma: oilEntry.disenoStr || String(oilEntry.raw.forma || 'Estándar')
      })
    }

    // Sincronizar cotas planas desde la estructura normalizada
    const compH = (idx: number) => {
      const val = parsedRings[idx]?.tipo_aro !== 'aceite' ? parsedRings[idx]?.h1 : null
      return val != null ? parseNumberValue(val) : null
    }
    if (espesor_anillo1_mm == null) espesor_anillo1_mm = compH(0)
    if (espesor_anillo2_mm == null) espesor_anillo2_mm = compH(1)
    if (espesor_anillo3_mm == null) espesor_anillo3_mm = compH(2)
    const lastOilRing = parsedRings[parsedRings.length - 1]
    if (espesor_aceite_mm == null && lastOilRing?.tipo_aro === 'aceite' && lastOilRing?.h1 != null) {
      espesor_aceite_mm = parseNumberValue(lastOilRing.h1)
    }
  }

  if (parsedRings.length > 0) {
    dimensiones.anillos = parsedRings
  }
  if (diametro_cilindro_mm != null) dimensiones.diametro_cilindro_mm = diametro_cilindro_mm
  if (espesor_anillo1_mm != null) dimensiones.espesor_anillo1_mm = espesor_anillo1_mm
  if (espesor_anillo2_mm != null) dimensiones.espesor_anillo2_mm = espesor_anillo2_mm
  if (espesor_anillo3_mm != null) dimensiones.espesor_anillo3_mm = espesor_anillo3_mm
  if (espesor_aceite_mm != null) dimensiones.espesor_aceite_mm = espesor_aceite_mm

  if (diametro_cabeza_mm != null) dimensiones.diametro_cabeza_mm = diametro_cabeza_mm
  if (diametro_vastago_mm != null) dimensiones.diametro_vastago_mm = diametro_vastago_mm
  if (longitud_total_mm != null) dimensiones.longitud_total_mm = longitud_total_mm
  if (angulo_asiento_grados != null) dimensiones.angulo_asiento_grados = angulo_asiento_grados
  if (diametro_interior_mm != null) dimensiones.diametro_interior_mm = diametro_interior_mm
  if (diametro_exterior_mm != null) dimensiones.diametro_exterior_mm = diametro_exterior_mm
  if (altura_mm != null) dimensiones.altura_mm = altura_mm
  if (medida_rosca) dimensiones.medida_rosca = medida_rosca
  if (paso_rosca_mm != null) dimensiones.paso_rosca_mm = paso_rosca_mm
  if (longitud_perno_mm != null) dimensiones.longitud_perno_mm = longitud_perno_mm
  if (cantidad_piezas != null) dimensiones.cantidad_piezas = cantidad_piezas

  // Hidratar subfilas para familias tipo tabla (no anillos): soporta arreglo opcional `filas`/`subfilas` o cotas planas en la raíz
  const isRingsLikeGroup = Boolean(
    resolvedGrupo &&
      (resolvedGrupo.codigo === 'anillos_motor' ||
        resolvedGrupo.categoria.toLowerCase().includes('anillo') ||
        resolvedGrupo.nombre.toLowerCase().includes('anillo'))
  )
  const rawFilasSource =
    rawObj.filas ?? rawObj.subfilas ?? dimensiones.subfilas ?? pickField(norm, ['filas_json', 'subfilas_json'])
  let rawFilasList: Array<Record<string, unknown>> = []
  if (Array.isArray(rawFilasSource)) {
    rawFilasList = rawFilasSource.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
  } else if (typeof rawFilasSource === 'string' && rawFilasSource.trim().startsWith('[')) {
    try {
      const parsedArr = JSON.parse(rawFilasSource.trim())
      if (Array.isArray(parsedArr)) {
        rawFilasList = parsedArr.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
      }
    } catch {
      // ignorar JSON inválido en filas
    }
  }

  const configuredSubfilas = resolvedGrupo?.tabla_config?.subfilas || []
  const configuredPadres = resolvedGrupo?.tabla_config?.subfila_padres || []
  const configuredTipos = resolvedGrupo?.tabla_config?.subfila_tipos || []
  const ROW_META_KEYS = new Set([
    'id',
    'fila',
    'nombre',
    'componente',
    'etiqueta',
    'posicion',
    'codigo',
    'codigo_fila',
    'subcodigo',
    'grupo',
    'grupo_central',
    'tipo',
    'tipo_fila',
    'es_fila_central',
    'medidas'
  ])

  if (!isRingsLikeGroup && parsedRings.length === 0) {
    if (rawFilasList.length > 0) {
      const hydratedSubfilas = rawFilasList.map((entry, idx) => {
        const entryNorm = buildRowNormalizedMap(entry)
        const esCentral =
          Boolean(entry.es_fila_central) ||
          normalizeKey(String(entry.tipo_fila || entry.tipo || '')) === 'central' ||
          configuredTipos[idx] === 'central'
        const rowNombre = String(
          pickField(entryNorm, ['fila', 'nombre', 'componente', 'etiqueta', 'posicion']) ||
            configuredSubfilas[idx] ||
            (esCentral ? 'Fila Central' : `Componente ${idx + 1}`)
        ).trim()
        const rowCodigo = esCentral
          ? ''
          : String(pickField(entryNorm, ['codigo', 'codigo_fila', 'subcodigo']) || '').trim()
        const rowGrupo = esCentral
          ? ''
          : String(pickField(entryNorm, ['grupo', 'grupo_central']) || configuredPadres[idx] || '').trim()

        const medidas: Record<string, unknown> = {}
        if (!esCentral) {
          if (entry.medidas && typeof entry.medidas === 'object') {
            Object.assign(medidas, entry.medidas as Record<string, unknown>)
          }
          for (const [k, v] of Object.entries(entry)) {
            if (!ROW_META_KEYS.has(normalizeKey(k)) && v !== undefined && v !== null && v !== '') {
              medidas[k] = v
            }
          }
          for (const p of resolvedGrupo?.parametros || []) {
            const valFromRow = pickDynamicParamValue(entryNorm, p)
            if (valFromRow !== undefined) {
              medidas[p.clave] = valFromRow
            } else if (medidas[p.clave] === undefined && dimensiones[p.clave] !== undefined) {
              medidas[p.clave] = dimensiones[p.clave]
            }
            if (dimensiones[p.clave] === undefined && medidas[p.clave] !== undefined) {
              dimensiones[p.clave] = medidas[p.clave]
            }
          }
        }

        return {
          id: String(entry.id || `sf-${idx + 1}`),
          tipo: esCentral ? 'central' : `fila_${idx + 1}`,
          nombre: rowNombre,
          codigo: rowCodigo,
          grupo: rowGrupo,
          ...(esCentral ? { es_fila_central: true } : {}),
          medidas
        }
      })
      dimensiones.subfilas = hydratedSubfilas
    } else if (resolvedGrupo?.tipo_vista === 'tabla' && configuredSubfilas.length > 0) {
      const rootParamMeasures: Record<string, unknown> = {}
      for (const p of resolvedGrupo.parametros || []) {
        if (dimensiones[p.clave] !== undefined && dimensiones[p.clave] !== null && dimensiones[p.clave] !== '') {
          rootParamMeasures[p.clave] = dimensiones[p.clave]
        }
      }
      dimensiones.subfilas = configuredSubfilas.map((sfName, idx) => {
        const esCentral = configuredTipos[idx] === 'central'
        return {
          id: `sf-${idx + 1}`,
          tipo: esCentral ? 'central' : `fila_${idx + 1}`,
          nombre: sfName,
          codigo: '',
          grupo: esCentral ? '' : (configuredPadres[idx] || ''),
          ...(esCentral ? { es_fila_central: true } : {}),
          medidas: esCentral ? {} : { ...rootParamMeasures }
        }
      })
    }
  }

  if (fabricante) dimensiones.marca = fabricante.toUpperCase()
  if (modelos.length > 0) {
    dimensiones.modelo = modelos.map(m => m.toUpperCase()).join(' / ')
    dimensiones.modelos = modelos.map(m => m.toUpperCase())
  }
  if (anio) dimensiones.ano = anio

  const messages: string[] = []
  let status: ParsedPartRow['status'] = 'valid'

  if (action === 'delete') {
    if (!sourceId && !codigo_oem) {
      status = 'error'
      messages.push('Falta id o codigo_oem para eliminar el repuesto')
    }
  } else {
    if (!codigo_oem) {
      status = 'error'
      messages.push('Falta codigo_oem')
    }
    if (!nombre) {
      status = 'error'
      messages.push('Falta nombre del repuesto')
    }
    if (!resolvedGrupo && familiaRaw) {
      if (status === 'valid') status = 'warning'
      messages.push(`Familia "${familiaRaw}" no coincide exactamente; se usará categoría "${categoria}"`)
    }
    if (motorCodigo && !fabricante) {
      if (status === 'valid') status = 'warning'
      messages.push('Motor indicado sin fabricante')
    }
  }

  return {
    rowIndex,
    sheetName,
    sourceId,
    action,
    codigo_oem,
    codigos_oem_adicionales,
    nombre,
    familiaRaw,
    resolvedGrupoCodigo: resolvedGrupo?.codigo,
    resolvedGrupoNombre: resolvedGrupo?.nombre,
    subsistema,
    categoria,
    fabricante,
    motorCodigo,
    modelos: modelos.map(m => m.toUpperCase()),
    anio,
    catalogo_origen,
    precio,
    stock,
    estado,
    descripcion_tecnica,
    imagen_url,
    imagenes,
    equivalencias,
    dimensiones,
    disenos_anillo: Array.from(disenosSet),
    diametro_cabeza_mm,
    diametro_vastago_mm,
    longitud_total_mm,
    angulo_asiento_grados,
    diametro_interior_mm,
    diametro_exterior_mm,
    altura_mm,
    diametro_cilindro_mm,
    espesor_anillo1_mm,
    espesor_anillo2_mm,
    espesor_anillo3_mm,
    espesor_aceite_mm,
    medida_rosca,
    paso_rosca_mm,
    longitud_perno_mm,
    cantidad_piezas,
    status,
    messages
  }
}

// =============================================================================
// PARSEO DE FAMILIAS NUEVAS (ESTRUCTURA EQUIVALENTE A CREAR/EDITAR FAMILIA)
// =============================================================================

const parseColumnDataType = (raw: unknown): 'numero' | 'booleano' | 'seleccion' | 'texto' => {
  const s = normalizeKey(String(raw || ''))
  if (s === 'booleano' || s === 'bool' || s === 'si_no' || s === 'sino' || s === 'estado') {
    return 'booleano'
  }
  if (s === 'seleccion' || s === 'opc' || s === 'opcion' || s === 'opciones' || s === 'lista' || s === 'select') {
    return 'seleccion'
  }
  if (s === 'texto' || s === 'text' || s === 'string') {
    return 'texto'
  }
  return 'numero'
}

const parseYesNo = (raw: unknown, defaultVal: boolean): boolean => {
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultVal
  if (typeof raw === 'boolean') return raw
  const s = normalizeKey(String(raw))
  if (['si', 'true', '1', 'yes', 'activo', 'y'].includes(s)) return true
  if (['no', 'false', '0', 'n'].includes(s)) return false
  return defaultVal
}

const normalizeSubsistemaValue = (raw: unknown): string => {
  const s = normalizeText(String(raw || ''))
  if (s.includes('culat') || s.includes('tapa')) return 'Culata'
  if (s.includes('ciguenal') || s.includes('bancad') || s.includes('biela')) return 'Cigüeñal'
  if (s.includes('general') || s.includes('accesor') || s.includes('sello')) return 'General'
  return 'Block'
}

const parseFilasTablaInput = (
  raw: unknown
): Array<{ nombre: string; tipo_fila: 'normal' | 'central'; grupo_central?: string }> => {
  if (!raw) return []

  if (Array.isArray(raw)) {
    const out: Array<{ nombre: string; tipo_fila: 'normal' | 'central'; grupo_central?: string }> = []
    for (const item of raw) {
      if (typeof item === 'string') {
        out.push(...parseFilasTablaInput(item))
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const nombre = String(obj.nombre ?? obj.label ?? obj.etiqueta ?? '').trim()
        const rawTipo = normalizeKey(String(obj.tipo_fila ?? obj.tipo ?? ''))
        const esCentral = Boolean(obj.es_fila_central) || rawTipo === 'central'
        const grupo = String(obj.grupo_central ?? obj.grupo ?? obj.bloque ?? '').trim() || undefined
        if (nombre || esCentral) {
          out.push({
            nombre: nombre || 'Fila Central',
            tipo_fila: esCentral ? 'central' : 'normal',
            ...(esCentral ? {} : grupo ? { grupo_central: grupo } : {})
          })
        }
      }
    }
    return out
  }

  const text = String(raw).trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      return parseFilasTablaInput(JSON.parse(text))
    } catch {
      // Continuar como texto plano
    }
  }

  return text
    .split(/[;\n|,]+/)
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => {
      const centralMatch = token.match(/^\[?\s*central\s*\]?\s*[:\-]?\s*(.+)$/i)
      if (centralMatch) {
        return {
          nombre: centralMatch[1]!.trim() || 'Encabezado Central',
          tipo_fila: 'central' as const
        }
      }
      const groupMatch = token.match(/^([^:=]+)\s*:\s*(.+)$/)
      if (groupMatch) {
        return {
          nombre: groupMatch[2]!.trim(),
          tipo_fila: 'normal' as const,
          grupo_central: groupMatch[1]!.trim()
        }
      }
      return {
        nombre: token,
        tipo_fila: 'normal' as const
      }
    })
}

const parseColumnDefFromObject = (raw: Record<string, unknown>): TemplateColumnDef | null => {
  const norm = buildRowNormalizedMap(raw)
  const etiqueta = String(
    pickField(norm, ['etiqueta', 'nombre_columna', 'columna', 'medida', 'nombre', 'label', 'etiqueta_corta']) || ''
  ).trim()
  if (!etiqueta) return null

  const tipoDato = parseColumnDataType(
    pickField(norm, ['tipo_dato', 'tipo', 'datatype', 'formato'])
  )
  const rawUnidad = pickField(norm, ['unidad', 'unit'])
  const unidad =
    tipoDato === 'booleano'
      ? ''
      : rawUnidad !== undefined
        ? String(rawUnidad).trim()
        : tipoDato === 'numero'
          ? 'mm'
          : ''

  const columnaPadre = String(
    pickField(norm, ['columna_padre', 'grupo_columna', 'columna_central', 'grupo']) || ''
  ).trim() || undefined

  const rawOpciones = raw.opciones ?? pickField(norm, ['opciones', 'opciones_str', 'lista_opciones'])
  const opciones = Array.isArray(rawOpciones)
    ? rawOpciones.map(o => String(o || '').trim()).filter(Boolean)
    : splitTokens(rawOpciones)

  const clave = String(pickField(norm, ['clave', 'key']) || '').trim() || undefined
  const descripcion = String(pickField(norm, ['descripcion', 'ayuda']) || '').trim() || undefined

  return {
    ...(clave ? { clave } : {}),
    etiqueta,
    ...(columnaPadre ? { columna_padre: columnaPadre } : {}),
    ...(parseYesNo(pickField(norm, ['compartido_filas', 'compartida', 'compartido']), false)
      ? { compartido_filas: true }
      : {}),
    unidad,
    tipo_dato: tipoDato,
    requerido: parseYesNo(pickField(norm, ['requerido', 'obligatorio']), true),
    filtrable: parseYesNo(pickField(norm, ['filtrable', 'filtro']), true),
    ...(descripcion ? { descripcion } : {}),
    ...(opciones.length > 0 ? { opciones, opcionesStr: opciones.join(', ') } : {})
  }
}

const parseInlineColumnsInput = (raw: unknown): TemplateColumnDef[] => {
  if (!raw) return []

  if (Array.isArray(raw)) {
    const out: TemplateColumnDef[] = []
    for (const item of raw) {
      if (typeof item === 'string') {
        out.push(...parseInlineColumnsInput(item))
      } else if (item && typeof item === 'object') {
        const col = parseColumnDefFromObject(item as Record<string, unknown>)
        if (col) out.push(col)
      }
    }
    return out
  }

  const text = String(raw).trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      return parseInlineColumnsInput(JSON.parse(text))
    } catch {
      // Continuar como texto plano
    }
  }

  return text
    .split(/[;\n|]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      // Formato opcional: "Grupo > Etiqueta (mm)" o "Tipo (opc: A, B)" o "Con Pestaña (si/no)"
      let columnaPadre: string | undefined
      let rest = part
      const parentSep = part.match(/^([^>]+)>\s*(.+)$/)
      if (parentSep) {
        columnaPadre = parentSep[1]!.trim()
        rest = parentSep[2]!.trim()
      }

      let tipo_dato: TemplateColumnDef['tipo_dato'] = 'numero'
      let unidad = 'mm'
      let opciones: string[] | undefined

      const parenMatch = rest.match(/^(.+?)\(([^)]+)\)\s*$/)
      if (parenMatch) {
        rest = parenMatch[1]!.trim()
        const meta = parenMatch[2]!.trim()
        const metaLow = meta.toLowerCase()
        if (metaLow === 'si/no' || metaLow === 'sí/no' || metaLow === 'booleano' || metaLow === 'bool') {
          tipo_dato = 'booleano'
          unidad = ''
        } else if (metaLow === 'texto' || metaLow === 'text') {
          tipo_dato = 'texto'
          unidad = ''
        } else if (/^(opc|opciones|select|lista)\s*:/i.test(meta)) {
          tipo_dato = 'seleccion'
          unidad = ''
          opciones = splitTokens(meta.replace(/^[^:]+:\s*/, ''))
        } else if (meta.includes(',')) {
          tipo_dato = 'seleccion'
          unidad = ''
          opciones = splitTokens(meta)
        } else if (metaLow === 'numero' || metaLow === 'número' || metaLow === 'num') {
          tipo_dato = 'numero'
          unidad = 'mm'
        } else {
          tipo_dato = 'numero'
          unidad = meta
        }
      }

      return {
        etiqueta: rest || part,
        ...(columnaPadre ? { columna_padre: columnaPadre } : {}),
        unidad,
        tipo_dato,
        requerido: true,
        filtrable: true,
        ...(opciones && opciones.length > 0 ? { opciones, opcionesStr: opciones.join(', ') } : {})
      }
    })
}

const buildParsedFamilyRow = (
  rawObj: Record<string, unknown>,
  rowIndex: number,
  sheetName: string,
  extraColumns: TemplateColumnDef[] = []
): ParsedFamilyRow | null => {
  const nonEmptyValues = Object.values(rawObj).filter(v => v !== undefined && v !== null && String(v).trim() !== '')
  if (nonEmptyValues.length === 0) return null

  const norm = buildRowNormalizedMap(rawObj)
  const sourceId =
    String(pickField(norm, ['id', 'familia_id', 'grupo_id']) || '').trim() || undefined
  const action = parseRowAction(pickField(norm, ['accion', 'operacion', 'action']))
  const nombre = String(pickField(norm, ['nombre', 'familia', 'nombre_familia', 'titulo']) || '').trim()
  const codigoRaw = String(pickField(norm, ['codigo', 'slug']) || '').trim()
  const codigo =
    codigoRaw ||
    nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  const categoria = String(pickField(norm, ['categoria']) || nombre).trim()
  const subsistema = normalizeSubsistemaValue(pickField(norm, ['subsistema', 'parte_motor', 'sistema']))
  const descripcion = String(pickField(norm, ['descripcion', 'notas']) || '').trim() || undefined
  const icono = String(pickField(norm, ['icono', 'icon']) || 'Layers').trim() || 'Layers'

  let tablaCfg: Record<string, unknown> | null =
    rawObj.tabla_config && typeof rawObj.tabla_config === 'object'
      ? (rawObj.tabla_config as Record<string, unknown>)
      : null
  if (!tablaCfg) {
    const rawTablaCfgStr = pickField(norm, ['tabla_config_json', 'tabla_config'])
    if (typeof rawTablaCfgStr === 'string' && rawTablaCfgStr.trim().startsWith('{')) {
      try {
        const parsedCfg = JSON.parse(rawTablaCfgStr.trim())
        if (parsedCfg && typeof parsedCfg === 'object') {
          tablaCfg = parsedCfg as Record<string, unknown>
        }
      } catch {
        // Ignorar JSON inválido en celda tabla_config_json
      }
    }
  }
  const rawTablaConfig = tablaCfg ? ({ ...tablaCfg } as Partial<TablaConfiguracion>) : undefined

  const rawTipoVista = normalizeKey(
    String(pickField(norm, ['tipo_vista', 'vista', 'formato_visualizacion']) || '')
  )
  const filas = parseFilasTablaInput(
    rawObj.filas ??
      rawObj.filas_tabla ??
      pickField(norm, ['filas_tabla', 'filas', 'subfilas']) ??
      tablaCfg?.subfilas
  )
  const tipo_vista: 'normal' | 'tabla' =
    rawTipoVista.includes('tabla') || (!rawTipoVista && filas.length > 0) ? 'tabla' : 'normal'

  const titulo_primera_columna =
    String(
      pickField(norm, ['titulo_primera_columna', 'primera_columna', 'titulo_fila']) ||
        tablaCfg?.titulo_primera_columna ||
        ''
    ).trim() || (tipo_vista === 'tabla' ? 'Componente' : undefined)

  const titulo_grupo_filas =
    String(
      pickField(norm, ['titulo_grupo_filas', 'columna_central_filas', 'titulo_bloque_filas']) ||
        tablaCfg?.titulo_grupo_filas ||
        ''
    ).trim() || undefined

  const inlineCols = parseInlineColumnsInput(
    rawObj.columnas ?? rawObj.parametros ?? pickField(norm, ['columnas', 'parametros', 'medidas'])
  )
  const singleRowCol = parseColumnDefFromObject(rawObj)
  // Evitar usar la propia columna `nombre` de la familia como etiqueta de columna cuando no viene `etiqueta`
  const hasExplicitColHeader =
    pickField(norm, ['etiqueta', 'nombre_columna', 'columna', 'medida', 'label', 'etiqueta_corta']) !== undefined

  const rawCols: TemplateColumnDef[] = [...inlineCols, ...extraColumns]
  if (hasExplicitColHeader && singleRowCol) {
    rawCols.push(singleRowCol)
  }
  const combinedCols = dedupeColumnDefs(rawCols)

  const messages: string[] = []
  let status: ParsedFamilyRow['status'] = 'valid'

  if (action === 'delete') {
    if (!sourceId && !codigo && !nombre) {
      status = 'error'
      messages.push('Falta id, codigo o nombre para identificar la familia a eliminar')
    }
  } else {
    if (!nombre) {
      status = 'error'
      messages.push('Falta el nombre de la familia')
    }

    if (combinedCols.length === 0) {
      status = status === 'error' ? 'error' : 'warning'
      messages.push('Sin columnas definidas; se creará columna por defecto "Medida 1 (mm)"')
      combinedCols.push({
        etiqueta: 'Medida 1',
        unidad: 'mm',
        tipo_dato: 'numero',
        requerido: true,
        filtrable: true
      })
    }
  }

  return {
    rowIndex,
    sheetName,
    sourceId,
    action,
    codigo,
    nombre,
    categoria,
    subsistema,
    descripcion,
    icono,
    tipo_vista,
    titulo_primera_columna,
    titulo_grupo_filas,
    rawTablaConfig,
    filas,
    columnas: combinedCols,
    status,
    messages
  }
}

// =============================================================================
// LECTURA DE ARCHIVOS EXCEL / CSV / JSON
// =============================================================================

/**
 * Extrae uno o varios bloques JSON válidos desde texto libre, bloques Markdown ```json```
 * o múltiples objetos concatenados ({...}{...}) devueltos por asistentes de IA.
 */
const extractJsonPayloads = (rawText: string): unknown[] => {
  const cleaned = String(rawText || '').replace(/^\uFEFF/, '').trim()
  if (!cleaned) {
    throw new Error('El contenido JSON está vacío.')
  }

  const candidateChunks: string[] = []
  const fenceRegex = /```(?:json|JSON)?\s*\r?\n?([\s\S]*?)```/g
  let fenceMatch: RegExpExecArray | null
  while ((fenceMatch = fenceRegex.exec(cleaned)) !== null) {
    const inner = (fenceMatch[1] || '').trim()
    if (inner) candidateChunks.push(inner)
  }

  if (candidateChunks.length === 0) {
    // Eliminar marcadores de bloque sueltos al inicio/fin si la IA dejó una valla sin cerrar
    const unfenced = cleaned
      .replace(/^```(?:json|JSON)?\s*\r?\n?/i, '')
      .replace(/\r?\n?```\s*$/, '')
      .trim()
    candidateChunks.push(unfenced)
  }

  const payloads: unknown[] = []

  const sliceBalancedTopLevelJson = (text: string): unknown[] => {
    const out: unknown[] = []
    let i = 0
    const len = text.length

    while (i < len) {
      const ch = text[i]
      if (ch !== '{' && ch !== '[') {
        i++
        continue
      }

      const start = i
      let depth = 0
      let inString = false
      let escaped = false
      let closedAt = -1

      for (let j = start; j < len; j++) {
        const c = text[j]!
        if (inString) {
          if (escaped) {
            escaped = false
          } else if (c === '\\') {
            escaped = true
          } else if (c === '"') {
            inString = false
          }
          continue
        }

        if (c === '"') {
          inString = true
          continue
        }
        if (c === '{' || c === '[') {
          depth++
        } else if (c === '}' || c === ']') {
          depth--
          if (depth === 0) {
            closedAt = j
            break
          }
        }
      }

      if (closedAt < 0) break

      const block = text.slice(start, closedAt + 1)
      try {
        out.push(JSON.parse(block))
      } catch {
        // Bloque inválido; continuar buscando siguientes bloques
      }
      i = closedAt + 1
    }

    return out
  }

  for (const chunk of candidateChunks) {
    try {
      payloads.push(JSON.parse(chunk))
    } catch {
      const multi = sliceBalancedTopLevelJson(chunk)
      payloads.push(...multi)
    }
  }

  if (payloads.length === 0) {
    throw new Error(
      'El texto JSON no es válido. Asegúrate de pegar JSON válido o la plantilla sin texto roto.'
    )
  }

  return payloads
}

const filterPlaceholderSampleParts = (parts: ParsedPartRow[]): ParsedPartRow[] => {
  const hasRealParts = parts.some(p => p.codigo_oem.toUpperCase() !== 'OEM-EJEMPLO-001')
  return hasRealParts
    ? parts.filter(p => p.codigo_oem.toUpperCase() !== 'OEM-EJEMPLO-001')
    : parts
}

export const parseCatalogJsonText = (
  jsonText: string,
  fileName: string,
  grupos: GrupoRepuesto[],
  defaultGrupo?: GrupoRepuesto | null
): CatalogImportParseResult => {
  const payloads = extractJsonPayloads(jsonText)
  const families: ParsedFamilyRow[] = []
  const motors: ParsedMotorRow[] = []
  const pendingPartObjs: Array<{ obj: Record<string, unknown>; rowIndex: number; sheetName: string }> = []
  const warnings: string[] = []
  let exportMeta: FamilyExportMeta | null = null

  for (const parsed of payloads) {
    if (Array.isArray(parsed)) {
      parsed.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return
        const obj = item as Record<string, unknown>
        const hasOem = obj.codigo_oem !== undefined || obj.oem !== undefined
        const looksLikeFamily =
          !hasOem &&
          (Array.isArray(obj.columnas) || Array.isArray(obj.parametros) || obj.tipo_vista !== undefined)
        const looksLikeMotor =
          !hasOem &&
          !looksLikeFamily &&
          (obj.cilindros !== undefined || obj.cilindrada_cc !== undefined || obj.codigo !== undefined)
        if (looksLikeFamily) {
          const f = buildParsedFamilyRow(obj, idx + 1, 'JSON')
          if (f) families.push(f)
        } else if (looksLikeMotor) {
          const m = parseMotorRowObject(obj, idx + 1, 'JSON')
          if (m) motors.push(m)
        } else {
          pendingPartObjs.push({ obj, rowIndex: idx + 1, sheetName: 'JSON' })
        }
      })
    } else if (parsed && typeof parsed === 'object') {
      const root = parsed as Record<string, unknown>
      if (
        !exportMeta &&
        root._export_meta &&
        typeof root._export_meta === 'object' &&
        (root._export_meta as Record<string, unknown>).tipo === 'exportacion_familia'
      ) {
        const metaObj = root._export_meta as Record<string, unknown>
        exportMeta = {
          tipo: 'exportacion_familia',
          version: 1,
          familia_id: String(metaObj.familia_id || '').trim(),
          familia_codigo: String(metaObj.familia_codigo || '').trim(),
          familia_nombre: String(metaObj.familia_nombre || '').trim(),
          familia_categoria: String(metaObj.familia_categoria || '').trim(),
          exportado_en: String(metaObj.exportado_en || '').trim(),
          total_repuestos: Number(metaObj.total_repuestos || 0)
        }
      }

      const rawFamilies = Array.isArray(root.familias)
        ? root.familias
        : Array.isArray(root.grupos)
          ? root.grupos
          : []
      const rawMotors = Array.isArray(root.motores) ? root.motores : []
      const rawParts = Array.isArray(root.repuestos)
        ? root.repuestos
        : Array.isArray(root.partes)
          ? root.partes
          : Array.isArray(root.productos)
            ? root.productos
            : []

      rawFamilies.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          const f = buildParsedFamilyRow(item as Record<string, unknown>, idx + 1, 'JSON.familias')
          if (f) families.push(f)
        }
      })
      rawMotors.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          const m = parseMotorRowObject(item as Record<string, unknown>, idx + 1, 'JSON.motores')
          if (m) motors.push(m)
        }
      })
      rawParts.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          pendingPartObjs.push({
            obj: item as Record<string, unknown>,
            rowIndex: idx + 1,
            sheetName: 'JSON.repuestos'
          })
        }
      })

      if (payloads.length === 1 && rawFamilies.length === 0 && rawMotors.length === 0 && rawParts.length === 0) {
        warnings.push('El objeto JSON no contiene arreglos "familias", "repuestos" ni "motores".')
      }
    }
  }

  const effectiveGrupos = buildSyntheticGruposForParsing(grupos, families)
  const metaDefaultGrupo =
    defaultGrupo ||
    (exportMeta
      ? effectiveGrupos.find(
          g =>
            (exportMeta!.familia_id && g.id === exportMeta!.familia_id) ||
            (exportMeta!.familia_codigo && normalizeText(g.codigo) === normalizeText(exportMeta!.familia_codigo)) ||
            (exportMeta!.familia_nombre && normalizeText(g.nombre) === normalizeText(exportMeta!.familia_nombre))
        )
      : undefined) ||
    (families.length === 1 && families[0]!.action !== 'delete'
      ? effectiveGrupos.find(
          g =>
            normalizeText(g.codigo) === normalizeText(families[0]!.codigo) ||
            normalizeText(g.nombre) === normalizeText(families[0]!.nombre)
        )
      : undefined)

  const rawPartsCollected: ParsedPartRow[] = []
  for (const item of pendingPartObjs) {
    const p = parsePartRowObject(item.obj, item.rowIndex, item.sheetName, effectiveGrupos, metaDefaultGrupo)
    if (p) rawPartsCollected.push(p)
  }

  const parts = filterPlaceholderSampleParts(rawPartsCollected)
  const isFamilyExportPackage = Boolean(
    exportMeta ||
      families.some(f => Boolean(f.sourceId) || f.action === 'delete') ||
      parts.some(p => Boolean(p.sourceId) || p.action === 'delete')
  )

  if (families.length === 0 && motors.length === 0 && parts.length === 0 && warnings.length === 0) {
    warnings.push('No se encontraron registros válidos en el JSON proporcionado.')
  }

  return {
    fileName,
    format: 'json',
    families,
    motors,
    parts,
    warnings,
    exportMeta,
    isFamilyExportPackage
  }
}

export const parseCatalogImportFile = async (
  file: File,
  grupos: GrupoRepuesto[],
  defaultGrupo?: GrupoRepuesto | null
): Promise<CatalogImportParseResult> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  if (ext === 'json') {
    const text = await file.text()
    return parseCatalogJsonText(text, file.name, grupos, defaultGrupo)
  }

  if (!['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
    throw new Error('Formato no soportado. Usa archivos .xlsx, .xls, .csv o .json.')
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const families: ParsedFamilyRow[] = []
  const motors: ParsedMotorRow[] = []
  const parts: ParsedPartRow[] = []
  const warnings: string[] = []

  // 1. Pre-recolectar hojas de columnas de familias (Columnas_Familia / Medida_Familia / Parametros)
  const columnsByFamilyKey = new Map<string, TemplateColumnDef[]>()
  const familySheetNames: string[] = []
  const dataSheetNames: string[] = []
  const columnSheetNames = new Set<string>()

  for (const sheetName of workbook.SheetNames) {
    const normSheet = normalizeKey(sheetName)
    if (normSheet.includes('instruccion') || normSheet.includes('guia') || normSheet.includes('ayuda')) {
      continue
    }
    if (normSheet.includes('columna') || normSheet.includes('medida_familia') || normSheet.includes('parametro')) {
      columnSheetNames.add(sheetName)
      const ws = workbook.Sheets[sheetName]
      if (!ws) continue
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      for (const row of rows) {
        const norm = buildRowNormalizedMap(row)
        const famKeyName = normalizeText(String(pickField(norm, ['familia', 'nombre_familia', 'grupo']) || ''))
        const famKeyCode = normalizeText(String(pickField(norm, ['familia_codigo', 'codigo_familia']) || ''))
        const colDef = parseColumnDefFromObject(row)
        if (!colDef) continue
        for (const fk of Array.from(new Set([famKeyName, famKeyCode].filter(Boolean)))) {
          const arr = columnsByFamilyKey.get(fk) || []
          arr.push(colDef)
          columnsByFamilyKey.set(fk, arr)
        }
      }
    } else if (normSheet.includes('familia') || normSheet.includes('grupo')) {
      familySheetNames.push(sheetName)
    } else {
      dataSheetNames.push(sheetName)
    }
  }

  // 2. Procesar PRIMERO las hojas de Familias para resolver columnas dinámicas antes de leer Repuestos
  for (const sheetName of familySheetNames) {
    const ws = workbook.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    if (rows.length === 0) continue

    const groupedByNombre = new Map<string, ParsedFamilyRow>()
    rows.forEach((row: Record<string, unknown>, idx: number) => {
      const parsedRow = buildParsedFamilyRow(row, idx + 2, sheetName)
      if (!parsedRow) return
      const famKey = normalizeText(parsedRow.nombre || parsedRow.codigo || `row_${idx}`)
      const famCodeKey = normalizeText(parsedRow.codigo || '')
      const existing = groupedByNombre.get(famKey)
      if (existing) {
        const newCols = parsedRow.columnas.filter(
          c => !(parsedRow.messages.some(m => m.includes('Sin columnas')) && c.etiqueta === 'Medida 1')
        )
        existing.columnas = dedupeColumnDefs([...existing.columnas, ...newCols])
        if (existing.filas.length === 0 && parsedRow.filas.length > 0) {
          existing.filas = parsedRow.filas
          existing.tipo_vista = parsedRow.tipo_vista
        }
      } else {
        const extraFromName = famKey ? columnsByFamilyKey.get(famKey) || [] : []
        const extraFromCode = famCodeKey && famCodeKey !== famKey ? columnsByFamilyKey.get(famCodeKey) || [] : []
        const extraCols = dedupeColumnDefs([...extraFromName, ...extraFromCode])
        if (extraCols.length > 0 && parsedRow.action !== 'delete') {
          const hasPlaceholder = parsedRow.messages.some(m => m.includes('Sin columnas'))
          const existingColsWithoutPlaceholder = hasPlaceholder ? [] : parsedRow.columnas
          parsedRow.columnas = dedupeColumnDefs([...extraCols, ...existingColsWithoutPlaceholder])
          if (hasPlaceholder) {
            parsedRow.messages = parsedRow.messages.filter(m => !m.includes('Sin columnas'))
            if (parsedRow.messages.length === 0 && parsedRow.nombre) {
              parsedRow.status = 'valid'
            }
          }
        }
        groupedByNombre.set(famKey, parsedRow)
      }
    })
    families.push(...groupedByNombre.values())
  }

  // 3. Procesar Motores y Repuestos usando el esquema de familias resuelto
  const effectiveGrupos = buildSyntheticGruposForParsing(grupos, families)
  const resolvedDefaultGrupo =
    defaultGrupo ||
    (families.length === 1 && families[0]!.action !== 'delete'
      ? effectiveGrupos.find(
          g =>
            normalizeText(g.codigo) === normalizeText(families[0]!.codigo) ||
            normalizeText(g.nombre) === normalizeText(families[0]!.nombre)
        )
      : undefined)

  for (const sheetName of dataSheetNames) {
    const normSheet = normalizeKey(sheetName)
    const ws = workbook.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    if (rows.length === 0) continue

    const isMotorsSheet =
      normSheet.includes('motor') && !normSheet.includes('anillo') && !normSheet.includes('repuesto')

    rows.forEach((row: Record<string, unknown>, idx: number) => {
      if (isMotorsSheet) {
        const m = parseMotorRowObject(row, idx + 2, sheetName)
        if (m) motors.push(m)
      } else {
        const p = parsePartRowObject(row, idx + 2, sheetName, effectiveGrupos, resolvedDefaultGrupo)
        if (p) parts.push(p)
      }
    })
  }

  const filteredParts = filterPlaceholderSampleParts(parts)
  const exportMeta: FamilyExportMeta | null =
    families.length === 1 &&
    (Boolean(families[0]!.sourceId) || filteredParts.some(p => Boolean(p.sourceId)))
      ? {
          tipo: 'exportacion_familia',
          version: 1,
          familia_id: families[0]!.sourceId || '',
          familia_codigo: families[0]!.codigo,
          familia_nombre: families[0]!.nombre,
          familia_categoria: families[0]!.categoria,
          exportado_en: '',
          total_repuestos: filteredParts.length
        }
      : null

  const isFamilyExportPackage = Boolean(
    exportMeta ||
      families.some(f => Boolean(f.sourceId) || f.action === 'delete') ||
      filteredParts.some(p => Boolean(p.sourceId) || p.action === 'delete')
  )

  if (families.length === 0 && motors.length === 0 && filteredParts.length === 0) {
    warnings.push('No se encontraron filas con datos en el archivo Excel.')
  }

  return {
    fileName: file.name,
    format: 'excel',
    families,
    motors,
    parts: filteredParts,
    warnings,
    exportMeta,
    isFamilyExportPackage
  }
}

// =============================================================================
// GENERACIÓN DE PLANTILLAS (EXCEL .xlsx Y JSON .json)
// =============================================================================

const getSampleValueForParam = (
  p: NonNullable<GrupoRepuesto['parametros']>[number],
  idx: number
): unknown => {
  if (p.tipo_dato === 'booleano') return 'No'
  if (p.tipo_dato === 'seleccion') return p.opciones?.[0] || 'Estándar'
  if (p.tipo_dato !== 'numero') return 'Estándar'

  const k = p.clave.toLowerCase()
  if (k.includes('vastago')) return 8.0
  if (k.includes('cabeza')) return 45.0
  if (k.includes('angulo')) return 45
  if (k.includes('cantidad') || k.includes('piezas') || k.includes('cilindros')) return 10
  if (k.includes('min') || k.includes('dmin')) return Number((45.0 + idx * 0.02).toFixed(2))
  if (k.includes('max') || k.includes('dmax')) return Number((45.02 + idx * 0.02).toFixed(2))
  if (k.includes('interior') || k.includes('_a')) return 92.0
  if (k.includes('exterior') || k.includes('_b')) return 96.0
  if (k.includes('largo') || k.includes('longitud') || k.includes('_c')) return 150.0
  if (k.includes('torque')) return 85
  return 10.5
}

const buildSampleRowsForTemplate = (
  selectedGrupo?: GrupoRepuesto | null
): { partColumns: string[]; sampleParts: Array<Record<string, unknown>> } => {
  const isRings = Boolean(
    selectedGrupo &&
      (selectedGrupo.codigo === 'anillos_motor' ||
        selectedGrupo.categoria.toLowerCase().includes('anillo') ||
        selectedGrupo.nombre.toLowerCase().includes('anillo'))
  )

  const dynamicKeys = (selectedGrupo?.parametros || []).map(p => p.clave).filter(Boolean)

  if (isRings) {
    const partColumns = [
      'codigo_oem',
      'nombre',
      'fabricante',
      'motor',
      'modelos',
      'anio',
      'familia',
      'equivalencias',
      'diametro_cilindro_mm',
      'anillo1_grosor',
      'anillo1_altura',
      'anillo1_diseno',
      'anillo2_grosor',
      'anillo2_altura',
      'anillo2_diseno',
      'anillo_aceite_grosor',
      'anillo_aceite_altura',
      'anillo_aceite_diseno',
      'descripcion_tecnica'
    ]
    const sampleParts = [
      {
        codigo_oem: '13011-35041',
        nombre: 'Juego Anillos Toyota 22R STD',
        fabricante: 'Toyota',
        motor: '22R',
        modelos: 'Hilux, 4Runner',
        anio: '1985-1995',
        familia: selectedGrupo?.codigo || 'anillos_motor',
        equivalencias: 'RIK: 34245; NPR: SWT-10150',
        diametro_cilindro_mm: 92.0,
        anillo1_grosor: 1.5,
        anillo1_altura: 3.6,
        anillo1_diseno: 'Cromado',
        anillo2_grosor: 1.5,
        anillo2_altura: 3.8,
        anillo2_diseno: 'Raspador',
        anillo_aceite_grosor: 4.0,
        anillo_aceite_altura: 3.5,
        anillo_aceite_diseno: 'Plano',
        descripcion_tecnica: 'Juego estándar 4 cilindros'
      }
    ]
    return { partColumns, sampleParts }
  }

  if (selectedGrupo) {
    const partColumns = [
      'codigo_oem',
      'nombre',
      'fabricante',
      'motor',
      'modelos',
      'anio',
      'familia',
      'equivalencias',
      ...dynamicKeys,
      'descripcion_tecnica'
    ]
    const sampleObj: Record<string, unknown> = {
      codigo_oem: 'OEM-EJEMPLO-001',
      nombre: `${selectedGrupo.nombre} Ejemplo Toyota 22R`,
      fabricante: 'Toyota',
      motor: '22R',
      modelos: 'Hilux, Dyna',
      anio: '1988-1998',
      familia: selectedGrupo.codigo,
      equivalencias: 'DOKURO: DOK-101; AJUSA: AJ-202'
    }
    ;(selectedGrupo.parametros || []).forEach((p, idx) => {
      sampleObj[p.clave] = getSampleValueForParam(p, idx)
    })
    sampleObj.descripcion_tecnica = 'Registro de ejemplo (reemplazar o eliminar al importar)'
    return { partColumns, sampleParts: [sampleObj] }
  }

  // Plantilla general universal (campos esenciales)
  const partColumns = [
    'codigo_oem',
    'nombre',
    'fabricante',
    'motor',
    'modelos',
    'anio',
    'familia',
    'equivalencias',
    'diametro_cabeza_mm',
    'diametro_vastago_mm',
    'longitud_total_mm',
    'diametro_interior_mm',
    'diametro_exterior_mm',
    'altura_mm',
    'diametro_cilindro_mm',
    'anillo1_grosor',
    'anillo1_altura',
    'anillo2_grosor',
    'anillo2_altura',
    'anillo_aceite_grosor',
    'anillo_aceite_altura',
    'medida_rosca',
    'paso_rosca_mm',
    'longitud_perno_mm',
    'cantidad_piezas',
    'descripcion_tecnica'
  ]

  const sampleParts: Array<Record<string, unknown>> = [
    {
      codigo_oem: '13711-35050',
      nombre: 'Válvula de Admisión Toyota 22R',
      fabricante: 'Toyota',
      motor: '22R',
      modelos: 'Hilux, 4Runner',
      anio: '1985-1995',
      familia: 'valvula',
      equivalencias: 'DOKURO: DI-0118; NPR: 95-3011',
      diametro_cabeza_mm: 45.0,
      diametro_vastago_mm: 8.0,
      longitud_total_mm: 112.5,
      diametro_interior_mm: '',
      diametro_exterior_mm: '',
      altura_mm: '',
      diametro_cilindro_mm: '',
      anillo1_grosor: '',
      anillo1_altura: '',
      anillo2_grosor: '',
      anillo2_altura: '',
      anillo_aceite_grosor: '',
      anillo_aceite_altura: '',
      medida_rosca: '',
      paso_rosca_mm: '',
      longitud_perno_mm: '',
      cantidad_piezas: '',
      descripcion_tecnica: 'Acero templado 1 ranura'
    },
    {
      codigo_oem: '13011-35041',
      nombre: 'Juego Anillos Toyota 22R STD',
      fabricante: 'Toyota',
      motor: '22R',
      modelos: 'Hilux, 4Runner',
      anio: '1985-1995',
      familia: 'anillos_motor',
      equivalencias: 'RIK: 34245; NPR: SWT-10150',
      diametro_cabeza_mm: '',
      diametro_vastago_mm: '',
      longitud_total_mm: '',
      diametro_interior_mm: '',
      diametro_exterior_mm: '',
      altura_mm: '',
      diametro_cilindro_mm: 92.0,
      anillo1_grosor: 1.5,
      anillo1_altura: 3.6,
      anillo2_grosor: 1.5,
      anillo2_altura: 3.8,
      anillo_aceite_grosor: 4.0,
      anillo_aceite_altura: 3.5,
      medida_rosca: '',
      paso_rosca_mm: '',
      longitud_perno_mm: '',
      cantidad_piezas: '',
      descripcion_tecnica: 'Anillo 1° cromado'
    }
  ]

  return { partColumns, sampleParts }
}

const triggerDownloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Orden estricto: primero campos OBLIGATORIOS, luego OPCIONALES.
// `numero_id` no se incluye porque lo asigna/gestiona el sistema automáticamente.
const MOTOR_TEMPLATE_COLUMNS = [
  'fabricante',
  'codigo',
  'modelos',
  'denominacion_venta',
  'anios',
  'combustible',
  'cilindros',
  'cilindrada_cc',
  'valvulas',
  'diametro_cilindro_std_mm',
  'aspiracion',
  'kw',
  'cv'
]

const SAMPLE_MOTOR_ROW = {
  fabricante: 'Toyota',
  codigo: '22R',
  modelos: 'Hilux, 4Runner',
  denominacion_venta: 'Serie Pick Up / Comercial',
  anios: '1985-1995',
  combustible: 'Gasolina',
  cilindros: 4,
  cilindrada_cc: 2366,
  valvulas: 8,
  diametro_cilindro_std_mm: 92.0,
  aspiracion: 'Natural',
  kw: 84,
  cv: 114
}

const FAMILY_TEMPLATE_COLUMNS = [
  'nombre',
  'subsistema',
  'tipo_vista',
  'columnas',
  'filas_tabla',
  'titulo_primera_columna',
  'descripcion'
]

const SAMPLE_FAMILY_EXCEL_ROWS = [
  {
    nombre: 'Camisas de Cilindro',
    subsistema: 'Block',
    tipo_vista: 'normal',
    columnas:
      'Diámetro Interior (mm); Diámetro Exterior (mm); Largo Total (mm); Tipo de Camisa (opc: Seca, Húmeda); Con Pestaña (si/no)',
    filas_tabla: '',
    titulo_primera_columna: '',
    descripcion: 'Camisas húmedas y secas'
  },
  {
    nombre: 'Cojinetes Especiales',
    subsistema: 'Cigüeñal',
    tipo_vista: 'tabla',
    columnas: 'STD > D. Mín (mm); STD > D. Máx (mm); 0.25 > D. Mín (mm); 0.25 > D. Máx (mm)',
    filas_tabla: 'Biela; Bancada',
    titulo_primera_columna: 'Componente',
    descripcion: 'Cojinetes en vista de tabla por medida STD y sobremedida'
  }
]

export const downloadCatalogExcelTemplate = (
  grupos: GrupoRepuesto[],
  scope: TemplateScope = 'general',
  selectedGrupo?: GrupoRepuesto | null
) => {
  const wb = XLSX.utils.book_new()

  if (scope === 'families_only') {
    const wsFam = XLSX.utils.json_to_sheet(SAMPLE_FAMILY_EXCEL_ROWS, { header: FAMILY_TEMPLATE_COLUMNS })
    wsFam['!cols'] = FAMILY_TEMPLATE_COLUMNS.map(col =>
      col === 'columnas'
        ? { wch: 70 }
        : col === 'filas_tabla' || col === 'descripcion'
          ? { wch: 32 }
          : { wch: Math.max(18, col.length + 5) }
    )
    XLSX.utils.book_append_sheet(wb, wsFam, 'Familias')

    const familyGuide = [
      {
        Campo_o_Regla: '=== PLANTILLA SIMPLIFICADA DE FAMILIAS (1 SOLA HOJA) ===',
        Descripcion: 'Cada fila de la hoja Familias crea o actualiza una familia completa con todas sus medidas.'
      },
      {
        Campo_o_Regla: 'nombre [Obligatorio]',
        Descripcion: 'Nombre exacto de la familia (ej: Camisas de Cilindro, Guías de Válvula).'
      },
      {
        Campo_o_Regla: 'columnas [Obligatorio]',
        Descripcion:
          'Medidas separadas por ";". Formato: "Medida (mm)", "Grupo > Submedida (mm)", "Tipo (opc: A, B)" o "Estado (si/no)".'
      },
      {
        Campo_o_Regla: 'subsistema [Opcional]',
        Descripcion: 'Block, Culata, Cigüeñal o General (por defecto Block).'
      },
      {
        Campo_o_Regla: 'tipo_vista [Opcional]',
        Descripcion: 'normal (medidas en ficha) o tabla (tabla con sub-filas como Biela; Bancada).'
      },
      {
        Campo_o_Regla: 'filas_tabla / titulo_primera_columna [Solo tabla]',
        Descripcion:
          'Solo para tipo_vista = tabla: filas separadas por ";" (ej: Biela; Bancada) y título de 1ra columna (ej: Componente).'
      }
    ]
    const wsGuide = XLSX.utils.json_to_sheet(familyGuide)
    wsGuide['!cols'] = [{ wch: 46 }, { wch: 95 }]
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Instrucciones')
    XLSX.writeFile(wb, 'plantilla_solo_familias_swgora.xlsx')
    return
  }

  if (scope !== 'motors_only') {
    const { partColumns, sampleParts } = buildSampleRowsForTemplate(
      scope === 'parts_only' ? selectedGrupo : null
    )
    const wsParts = XLSX.utils.json_to_sheet(sampleParts, { header: partColumns })
    wsParts['!cols'] = partColumns.map(col => ({ wch: Math.max(16, col.length + 4) }))
    XLSX.utils.book_append_sheet(wb, wsParts, 'Repuestos')
  }

  if (scope !== 'parts_only') {
    const wsMotors = XLSX.utils.json_to_sheet([SAMPLE_MOTOR_ROW], { header: MOTOR_TEMPLATE_COLUMNS })
    wsMotors['!cols'] = MOTOR_TEMPLATE_COLUMNS.map(col => ({ wch: Math.max(15, col.length + 3) }))
    XLSX.utils.book_append_sheet(wb, wsMotors, 'Motores')
  }

  // Hoja de Instrucciones concisa (Obligatorios primero, luego Opcionales)
  const motorInstructions: Array<{ Campo_o_Regla: string; Descripcion: string }> = [
    {
      Campo_o_Regla: '=== HOJA MOTORES: CAMPOS OBLIGATORIOS ===',
      Descripcion: 'El sistema asigna automáticamente el id interno (numero_id); no debe ingresarlo en la plantilla.'
    },
    {
      Campo_o_Regla: 'fabricante [Obligatorio]',
      Descripcion: 'Nombre de la marca automotriz (ej: Toyota, Nissan).'
    },
    {
      Campo_o_Regla: 'codigo [Obligatorio]',
      Descripcion: 'Código técnico del motor (ej: 22R, 1KD-FTV, Z24).'
    },
    {
      Campo_o_Regla: 'modelos / anios / cilindros / cilindrada_cc [Opcional]',
      Descripcion: 'Modelos separados por coma (ej: Hilux, 4Runner), combustible y datos técnicos del bloque.'
    }
  ]

  const partInstructions: Array<{ Campo_o_Regla: string; Descripcion: string }> = [
    {
      Campo_o_Regla: '=== HOJA REPUESTOS ===',
      Descripcion: 'El único campo obligatorio es codigo_oem; las demás columnas ayudan a identificar motor y medidas.'
    },
    {
      Campo_o_Regla: 'codigo_oem [Obligatorio]',
      Descripcion: 'Código OEM principal. Si hay varios alternos, puedes agregarlos separados por coma.'
    },
    {
      Campo_o_Regla: 'nombre / fabricante / motor / modelos / anio [Opcional]',
      Descripcion: 'Nombre del repuesto y aplicación vehicular (si se deja nombre vacío, se genera automáticamente).'
    },
    {
      Campo_o_Regla: 'equivalencias [Opcional]',
      Descripcion: 'Códigos alternos en formato "MARCA: CODIGO; MARCA2: CODIGO2" (ej: RIK: 34245; NPR: SWT-10150).'
    }
  ]

  const instructionsRows: Array<{ Campo_o_Regla: string; Descripcion: string }> = []
  if (scope !== 'parts_only') instructionsRows.push(...motorInstructions)
  if (scope !== 'motors_only') {
    instructionsRows.push(...partInstructions)
    if (scope === 'parts_only' && selectedGrupo) {
      instructionsRows.push({
        Campo_o_Regla: `Familia fija: ${selectedGrupo.codigo} (${selectedGrupo.nombre})`,
        Descripcion: `Medidas: ${(selectedGrupo.parametros || []).map(p => `${p.clave}${p.unidad ? ` [${p.unidad}]` : ''}`).join(', ') || 'Estándar'}`
      })
    } else {
      instructionsRows.push(
        { Campo_o_Regla: '--- FAMILIAS DISPONIBLES EN SWGORA ---', Descripcion: '' },
        ...grupos.map(g => ({
          Campo_o_Regla: `${g.codigo} (${g.nombre})`,
          Descripcion: `Medidas: ${(g.parametros || []).map(p => `${p.clave}${p.unidad ? ` [${p.unidad}]` : ''}`).join(', ') || 'Estándar'}`
        }))
      )
    }
  }

  const wsGuide = XLSX.utils.json_to_sheet(instructionsRows)
  wsGuide['!cols'] = [{ wch: 46 }, { wch: 100 }]
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Instrucciones')

  const filename =
    scope === 'motors_only'
      ? 'plantilla_solo_motores_swgora.xlsx'
      : scope === 'parts_only'
        ? selectedGrupo
          ? `plantilla_repuestos_${selectedGrupo.codigo}.xlsx`
          : 'plantilla_solo_repuestos_swgora.xlsx'
        : 'plantilla_catalogo_general_swgora.xlsx'

  XLSX.writeFile(wb, filename)
}

export const downloadCatalogJsonTemplate = (
  grupos: GrupoRepuesto[],
  scope: TemplateScope = 'general',
  selectedGrupo?: GrupoRepuesto | null
) => {
  const motorSampleObj = {
    ...SAMPLE_MOTOR_ROW,
    modelos: 'Hilux, 4Runner'
  }

  let payload: Record<string, unknown>
  let filename: string

  if (scope === 'families_only') {
    payload = {
      _instrucciones: {
        instruccion_para_ia:
          'Devuelve un ÚNICO objeto JSON válido con { "familias": [...] }. Usa tipo_vista "normal" para fichas simples o "tabla" cuando tenga filas fijas (filas_tabla).',
        campos_obligatorios: ['nombre', 'columnas'],
        campos_opcionales: ['subsistema', 'tipo_vista', 'filas_tabla', 'titulo_primera_columna', 'descripcion'],
        subsistemas_validos: ['Block', 'Culata', 'Cigüeñal', 'General'],
        tipos_vista: ['normal', 'tabla'],
        tipos_dato_columna: ['numero', 'booleano', 'seleccion', 'texto']
      },
      familias: [
        {
          nombre: 'Camisas de Cilindro',
          subsistema: 'Block',
          tipo_vista: 'normal',
          descripcion: 'Camisas húmedas y secas',
          columnas: [
            { etiqueta: 'Diámetro Interior', tipo_dato: 'numero', unidad: 'mm' },
            { etiqueta: 'Diámetro Exterior', tipo_dato: 'numero', unidad: 'mm' },
            { etiqueta: 'Largo Total', tipo_dato: 'numero', unidad: 'mm' },
            { etiqueta: 'Tipo de Camisa', tipo_dato: 'seleccion', opciones: ['Seca', 'Húmeda'] },
            { etiqueta: 'Con Pestaña', tipo_dato: 'booleano' }
          ]
        },
        {
          nombre: 'Cojinetes Especiales',
          subsistema: 'Cigüeñal',
          tipo_vista: 'tabla',
          titulo_primera_columna: 'Componente',
          filas_tabla: ['Biela', 'Bancada'],
          descripcion: 'Cojinetes en vista de tabla por medida STD y sobremedida',
          columnas: [
            { etiqueta: 'D. Mín', columna_padre: 'STD', tipo_dato: 'numero', unidad: 'mm' },
            { etiqueta: 'D. Máx', columna_padre: 'STD', tipo_dato: 'numero', unidad: 'mm' },
            { etiqueta: 'D. Mín', columna_padre: '0.25', tipo_dato: 'numero', unidad: 'mm' },
            { etiqueta: 'D. Máx', columna_padre: '0.25', tipo_dato: 'numero', unidad: 'mm' }
          ]
        }
      ]
    }
    filename = 'plantilla_solo_familias_swgora.json'
  } else if (scope === 'motors_only') {
    payload = {
      _instrucciones: {
        instruccion_para_ia:
          'Devuelve un ÚNICO objeto JSON válido con { "motores": [...] } respetando los nombres de campo del ejemplo.',
        campos_obligatorios: ['fabricante', 'codigo'],
        campos_opcionales: MOTOR_TEMPLATE_COLUMNS.slice(2)
      },
      motores: [motorSampleObj]
    }
    filename = 'plantilla_solo_motores_swgora.json'
  } else {
    const { partColumns, sampleParts } = buildSampleRowsForTemplate(
      scope === 'parts_only' ? selectedGrupo : null
    )
    const formattedParts = sampleParts.map(p => ({ ...p }))

    if (scope === 'parts_only') {
      if (selectedGrupo) {
        const isRingsFamily =
          selectedGrupo.codigo === 'anillos_motor' ||
          selectedGrupo.categoria.toLowerCase().includes('anillo') ||
          selectedGrupo.nombre.toLowerCase().includes('anillo')
        const normalSubfilas =
          selectedGrupo.tipo_vista === 'tabla' && !isRingsFamily
            ? (selectedGrupo.tabla_config?.subfilas || []).filter(
                (_, idx) => selectedGrupo.tabla_config?.subfila_tipos?.[idx] !== 'central'
              )
            : []

        payload = {
          _instrucciones: {
            instruccion_para_ia: `Devuelve un ÚNICO objeto JSON válido con { "repuestos": [...] }. Mantén siempre "familia": "${selectedGrupo.codigo}" y usa únicamente los campos de medida definidos en medidas_de_esta_familia.`,
            campos_obligatorios: ['codigo_oem'],
            campos_opcionales: partColumns.slice(1),
            familia_fija: {
              codigo: selectedGrupo.codigo,
              nombre: selectedGrupo.nombre,
              subsistema: selectedGrupo.subsistema || 'General',
              tipo_vista: selectedGrupo.tipo_vista || 'normal'
            },
            medidas_de_esta_familia: (selectedGrupo.parametros || []).map(p => ({
              clave: p.clave,
              nombre: p.columna_padre ? `${p.columna_padre} - ${p.etiqueta}` : p.etiqueta,
              tipo: p.tipo_dato,
              ...(p.unidad ? { unidad: p.unidad } : {}),
              ...(p.opciones?.length ? { opciones: p.opciones } : {})
            })),
            ...(normalSubfilas.length > 0
              ? {
                  filas_de_tabla: normalSubfilas,
                  nota_filas:
                    'Si las medidas son las mismas o se aplican planas, déjalas en la raíz del repuesto. Si varían por fila, agrega opcionalmente "filas": [{ "fila": "Nombre", ... }].'
                }
              : {})
          },
          repuestos: formattedParts
        }
      } else {
        payload = {
          _instrucciones: {
            instruccion_para_ia:
              'Devuelve un ÚNICO objeto JSON válido con { "repuestos": [...] } indicando el código de familia correcto en cada repuesto.',
            campos_obligatorios: ['codigo_oem'],
            campos_opcionales: partColumns.slice(1),
            familias_disponibles: grupos.map(g => ({
              codigo: g.codigo,
              nombre: g.nombre,
              medidas: (g.parametros || []).map(p => p.clave)
            }))
          },
          repuestos: formattedParts
        }
      }
      filename = selectedGrupo
        ? `plantilla_repuestos_${selectedGrupo.codigo}.json`
        : 'plantilla_solo_repuestos_swgora.json'
    } else {
      payload = {
        _instrucciones: {
          instruccion_para_ia:
            'Devuelve un ÚNICO objeto JSON válido con { "motores": [...], "repuestos": [...] }.',
          motores_obligatorios: ['fabricante', 'codigo'],
          motores_opcionales: MOTOR_TEMPLATE_COLUMNS.slice(2),
          repuestos_obligatorios: ['codigo_oem'],
          repuestos_opcionales: partColumns.slice(1),
          familias_disponibles: grupos.map(g => ({
            codigo: g.codigo,
            nombre: g.nombre,
            medidas: (g.parametros || []).map(p => p.clave)
          }))
        },
        motores: [motorSampleObj],
        repuestos: formattedParts
      }
      filename = 'plantilla_catalogo_general_swgora.json'
    }
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  triggerDownloadBlob(blob, filename)
}

// =============================================================================
// EXPORTACIÓN COMPLETA DE UNA FAMILIA (ESQUEMA + REPUESTOS + MOTORES)
// =============================================================================

const isRingsGrupo = (grupo: GrupoRepuesto): boolean => {
  const cod = (grupo.codigo || '').toLowerCase()
  const cat = (grupo.categoria || '').toLowerCase()
  const nom = (grupo.nombre || '').toLowerCase()
  return cod === 'anillos_motor' || cat.includes('anillo') || nom.includes('anillo')
}

const serializeFilasTablaForExcel = (grupo: GrupoRepuesto): string => {
  if (grupo.tipo_vista !== 'tabla' || !grupo.tabla_config?.subfilas?.length) {
    return ''
  }
  const subfilas = grupo.tabla_config.subfilas
  const padres = grupo.tabla_config.subfila_padres || []
  const tipos = grupo.tabla_config.subfila_tipos || []
  return subfilas
    .map((name, idx) => {
      if (tipos[idx] === 'central') return `[central] ${name}`
      const padre = (padres[idx] || '').trim()
      return padre ? `${padre}: ${name}` : name
    })
    .filter(Boolean)
    .join('; ')
}

const sanitizeExportFilenamePart = (raw: string): string => {
  return (
    String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'familia'
  )
}

const formatExportDateStamp = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

const STANDARD_SQL_EXPORT_KEYS: Array<keyof RepuestoTecnico> = [
  'diametro_cabeza_mm',
  'diametro_vastago_mm',
  'longitud_total_mm',
  'angulo_asiento_grados',
  'diametro_interior_mm',
  'diametro_exterior_mm',
  'altura_mm',
  'medida_rosca',
  'paso_rosca_mm',
  'longitud_perno_mm',
  'cantidad_piezas'
]

interface ResolvedExportContextData {
  usedMotors: Motor[]
  motorById: Map<string, Motor>
  fabById: Map<string, Fabricante>
  modeloById: Map<string, Modelo>
}

const buildResolvedExportContext = (
  repuestos: RepuestoTecnico[],
  context: {
    motores: Motor[]
    fabricantes: Fabricante[]
    modelos: Modelo[]
  }
): ResolvedExportContextData => {
  const motorById = new Map<string, Motor>()
  for (const m of context.motores) motorById.set(m.id, m)
  const fabById = new Map<string, Fabricante>()
  for (const f of context.fabricantes) fabById.set(f.id, f)
  const modeloById = new Map<string, Modelo>()
  for (const mod of context.modelos) modeloById.set(mod.id, mod)

  const usedMotorsMap = new Map<string, Motor>()
  for (const part of repuestos) {
    const mot = part.motor || (part.motor_id ? motorById.get(part.motor_id) : undefined)
    if (mot && mot.id && !usedMotorsMap.has(mot.id)) {
      usedMotorsMap.set(mot.id, mot)
    }
  }

  return {
    usedMotors: Array.from(usedMotorsMap.values()),
    motorById,
    fabById,
    modeloById
  }
}

const resolvePartExportMeta = (
  part: RepuestoTecnico,
  ctx: ResolvedExportContextData
) => {
  const mot = part.motor || (part.motor_id ? ctx.motorById.get(part.motor_id) : undefined)
  const fabName =
    mot?.fabricante?.nombre ||
    (mot?.fabricante_id ? ctx.fabById.get(mot.fabricante_id)?.nombre : undefined) ||
    String(part.especificaciones_tecnicas?.marca || part.dimensiones?.marca || '')

  const rawModelTokens: string[] = []
  const specModels = part.especificaciones_tecnicas?.modelos
  const dimModels = part.dimensiones?.modelos
  if (Array.isArray(specModels)) {
    rawModelTokens.push(...specModels.map(m => String(m || '').trim()))
  } else if (Array.isArray(dimModels)) {
    rawModelTokens.push(...dimModels.map(m => String(m || '').trim()))
  } else {
    const singleMod = String(
      part.especificaciones_tecnicas?.modelo || part.dimensiones?.modelo || ''
    ).trim()
    if (singleMod) {
      rawModelTokens.push(...singleMod.split(/[,/;|]+/).map(s => s.trim()))
    }
  }
  if (rawModelTokens.length === 0 && mot) {
    if (Array.isArray(mot.modelos_nombres) && mot.modelos_nombres.length > 0) {
      rawModelTokens.push(...mot.modelos_nombres)
    } else if (Array.isArray(mot.modelo_ids) && mot.modelo_ids.length > 0) {
      for (const mid of mot.modelo_ids) {
        const modObj = ctx.modeloById.get(mid)
        if (modObj?.nombre) rawModelTokens.push(modObj.nombre)
      }
    } else if (mot.modelo?.nombre) {
      rawModelTokens.push(mot.modelo.nombre)
    }
  }

  const modelos = Array.from(new Set(rawModelTokens.map(m => m.trim()).filter(Boolean)))
  const anio = String(part.especificaciones_tecnicas?.ano || part.dimensiones?.ano || '').trim()
  const imagenes = Array.from(
    new Set([
      ...(Array.isArray(part.imagenes) ? part.imagenes.map(u => String(u || '').trim()) : []),
      part.imagen_url ? String(part.imagen_url).trim() : ''
    ].filter(Boolean))
  )

  const equivalenciasList = (part.equivalencias || []).map(eq => ({
    marca_alterna: eq.marca_alterna,
    codigo_alterno: eq.codigo_alterno,
    ...(eq.notas ? { notas: eq.notas } : {})
  }))
  const equivalenciasText = equivalenciasList
    .map(eq => `${eq.marca_alterna}: ${eq.codigo_alterno}`)
    .join('; ')

  return {
    mot,
    fabricante: fabName,
    motorCodigo: mot?.codigo || '',
    modelos,
    anio,
    imagenes,
    imagen_url: imagenes[0] || part.imagen_url || '',
    equivalenciasList,
    equivalenciasText
  }
}

const serializeMotorForExport = (
  mot: Motor,
  ctx: ResolvedExportContextData
): Record<string, unknown> => {
  const fabName =
    mot.fabricante?.nombre ||
    (mot.fabricante_id ? ctx.fabById.get(mot.fabricante_id)?.nombre : '') ||
    ''
  const modNames: string[] = []
  if (Array.isArray(mot.modelos_nombres) && mot.modelos_nombres.length > 0) {
    modNames.push(...mot.modelos_nombres)
  } else if (Array.isArray(mot.modelo_ids) && mot.modelo_ids.length > 0) {
    for (const mid of mot.modelo_ids) {
      const m = ctx.modeloById.get(mid)
      if (m?.nombre) modNames.push(m.nombre)
    }
  } else if (mot.modelo?.nombre) {
    modNames.push(mot.modelo.nombre)
  }

  return {
    fabricante: fabName,
    codigo: mot.codigo,
    modelos: Array.from(new Set(modNames.map(s => s.trim()).filter(Boolean))).join(', '),
    denominacion_venta: mot.denominacion_venta || mot.nombre_comercial || '',
    anios: mot.anios || '',
    combustible: mot.combustible || 'Diésel',
    cilindros: mot.cilindros ?? '',
    cilindrada_cc: mot.cilindrada_cc ?? '',
    valvulas: mot.valvulas ?? '',
    diametro_cilindro_std_mm: mot.diametro_cilindro_std_mm ?? '',
    aspiracion: mot.aspiracion || '',
    kw: mot.kw ?? '',
    cv: mot.cv ?? ''
  }
}

const splitPartRingsForExport = (part: RepuestoTecnico) => {
  const dims = (part.dimensiones || {}) as Record<string, unknown>
  const rawAnillos = Array.isArray(dims.anillos)
    ? (dims.anillos as Array<Record<string, unknown>>)
    : []

  const compRings: Array<Record<string, unknown>> = []
  let oilRing: Record<string, unknown> | null = null

  if (rawAnillos.length > 0) {
    let oilIdx = rawAnillos.findIndex(r => {
      const t = String(r.tipo_aro || '').toLowerCase()
      const pos = String(r.posicion || r.nombre || '').toLowerCase()
      return t === 'aceite' || pos.includes('aceite') || pos.includes('oil')
    })
    if (oilIdx < 0 && rawAnillos.length >= 2) {
      oilIdx = rawAnillos.length - 1
    }
    rawAnillos.forEach((r, idx) => {
      if (idx === oilIdx) oilRing = r
      else compRings.push(r)
    })
  } else {
    const pushIfAny = (hVal: unknown) => {
      if (hVal !== undefined && hVal !== null && hVal !== '') {
        compRings.push({ h1: hVal })
      }
    }
    pushIfAny(part.espesor_anillo1_mm ?? dims.espesor_anillo1_mm)
    pushIfAny(part.espesor_anillo2_mm ?? dims.espesor_anillo2_mm)
    pushIfAny(part.espesor_anillo3_mm ?? dims.espesor_anillo3_mm)
    const oilH = part.espesor_aceite_mm ?? dims.espesor_aceite_mm
    if (oilH !== undefined && oilH !== null && oilH !== '') {
      oilRing = { h1: oilH }
    }
  }

  return { compRings, oilRing }
}

const sanitizeParamForExport = (p: GrupoRepuesto['parametros'][number]) => ({
  clave: p.clave,
  etiqueta: p.etiqueta,
  ...(p.columna_padre ? { columna_padre: p.columna_padre } : {}),
  tipo_dato: p.tipo_dato || 'numero',
  unidad: p.unidad || '',
  ...(Array.isArray(p.opciones) && p.opciones.length > 0 ? { opciones: p.opciones } : {}),
  ...(p.compartido_filas ? { compartido_filas: true } : {}),
  requerido: p.requerido !== false,
  filtrable: p.filtrable !== false,
  ...(p.descripcion ? { descripcion: p.descripcion } : {})
})

export const exportFamilyToExcel = (
  grupo: GrupoRepuesto,
  repuestos: RepuestoTecnico[],
  context: {
    motores: Motor[]
    fabricantes: Fabricante[]
    modelos: Modelo[]
  }
): { fileName: string; exportedPartsCount: number } => {
  const wb = XLSX.utils.book_new()
  const ctx = buildResolvedExportContext(repuestos, context)
  const ringsMode = isRingsGrupo(grupo)
  const cleanParams = (grupo.parametros || []).map(sanitizeParamForExport)
  const filasTablaTexto = serializeFilasTablaForExcel(grupo)

  // 1. Hoja Familias
  const hasTablaConfigExport = Boolean(grupo.tipo_vista === 'tabla' && grupo.tabla_config)
  const familyHeaders = [
    'accion',
    'id',
    'codigo',
    'nombre',
    'categoria',
    'subsistema',
    'tipo_vista',
    'filas_tabla',
    'titulo_primera_columna',
    'titulo_grupo_filas',
    'icono',
    'descripcion',
    ...(hasTablaConfigExport ? ['tabla_config_json'] : [])
  ]
  const familyRow: Record<string, unknown> = {
    accion: '',
    id: grupo.id,
    codigo: grupo.codigo,
    nombre: grupo.nombre,
    categoria: grupo.categoria,
    subsistema: grupo.subsistema || 'Block',
    tipo_vista: grupo.tipo_vista || 'normal',
    filas_tabla: filasTablaTexto,
    titulo_primera_columna:
      grupo.tipo_vista === 'tabla' ? grupo.tabla_config?.titulo_primera_columna || 'Componente' : '',
    titulo_grupo_filas:
      grupo.tipo_vista === 'tabla' ? grupo.tabla_config?.titulo_grupo_filas || '' : '',
    icono: grupo.icono || 'Layers',
    descripcion: grupo.descripcion || '',
    ...(hasTablaConfigExport ? { tabla_config_json: JSON.stringify(grupo.tabla_config) } : {})
  }
  const wsFam = XLSX.utils.json_to_sheet([familyRow], { header: familyHeaders })
  wsFam['!cols'] = familyHeaders.map(col =>
    col === 'filas_tabla' || col === 'descripcion' || col === 'tabla_config_json'
      ? { wch: 36 }
      : col === 'id'
        ? { wch: 38 }
        : { wch: Math.max(16, col.length + 4) }
  )
  XLSX.utils.book_append_sheet(wb, wsFam, 'Familias')

  // 2. Hoja Columnas_Familia
  const colHeaders = [
    'familia',
    'familia_codigo',
    'clave',
    'etiqueta',
    'columna_padre',
    'tipo_dato',
    'unidad',
    'opciones',
    'compartido_filas',
    'requerido',
    'filtrable',
    'descripcion'
  ]
  const colRows = cleanParams.map(p => ({
    familia: grupo.nombre,
    familia_codigo: grupo.codigo,
    clave: p.clave,
    etiqueta: p.etiqueta,
    columna_padre: p.columna_padre || '',
    tipo_dato: p.tipo_dato,
    unidad: p.unidad || '',
    opciones: p.opciones ? p.opciones.join(', ') : '',
    compartido_filas: p.compartido_filas ? 'Si' : 'No',
    requerido: p.requerido ? 'Si' : 'No',
    filtrable: p.filtrable ? 'Si' : 'No',
    descripcion: p.descripcion || ''
  }))
  const wsCols =
    colRows.length > 0
      ? XLSX.utils.json_to_sheet(colRows, { header: colHeaders })
      : XLSX.utils.aoa_to_sheet([colHeaders])
  wsCols['!cols'] = colHeaders.map(c =>
    c === 'descripcion' || c === 'opciones' ? { wch: 30 } : { wch: Math.max(16, c.length + 4) }
  )
  XLSX.utils.book_append_sheet(wb, wsCols, 'Columnas_Familia')

  // 3. Hoja Repuestos
  const partMetaByIdx = repuestos.map(p => resolvePartExportMeta(p, ctx))
  const hasMultiImages = partMetaByIdx.some(m => m.imagenes.length > 1)
  const paramKeysSet = new Set(cleanParams.map(p => p.clave))

  const measureColumns: string[] = []
  let maxCompRings = 2
  const ringDataByIdx = ringsMode ? repuestos.map(splitPartRingsForExport) : []

  if (ringsMode) {
    maxCompRings = Math.max(2, ...ringDataByIdx.map(r => r.compRings.length))
    measureColumns.push('diametro_cilindro_mm')
    for (let i = 1; i <= maxCompRings; i++) {
      measureColumns.push(`anillo${i}_grosor`, `anillo${i}_altura`, `anillo${i}_diseno`)
    }
    measureColumns.push('anillo_aceite_grosor', `anillo_aceite_altura`, `anillo_aceite_diseno`, 'disenos_anillo')
  } else {
    for (const p of cleanParams) {
      if (p.clave && !measureColumns.includes(p.clave)) {
        measureColumns.push(p.clave)
      }
    }
    if (
      grupo.tipo_vista === 'tabla' ||
      repuestos.some(p => Array.isArray((p.dimensiones as Record<string, unknown> | undefined)?.subfilas))
    ) {
      measureColumns.push('subfilas_json')
    }
    for (const sqlKey of STANDARD_SQL_EXPORT_KEYS) {
      const kStr = String(sqlKey)
      if (paramKeysSet.has(kStr)) continue
      const hasValue = repuestos.some(r => {
        const v = (r as unknown as Record<string, unknown>)[kStr] ?? r.dimensiones?.[kStr]
        return v !== undefined && v !== null && v !== ''
      })
      if (hasValue) measureColumns.push(kStr)
    }
  }

  const partHeaders = [
    'accion',
    'id',
    'codigo_oem',
    'codigos_oem_adicionales',
    'nombre',
    'familia',
    'categoria',
    'subsistema',
    'fabricante',
    'motor',
    'modelos',
    'anio',
    'catalogo_origen',
    'precio',
    'stock',
    'estado',
    'equivalencias',
    ...measureColumns,
    'descripcion_tecnica',
    'imagen_url',
    ...(hasMultiImages ? ['imagenes_json'] : [])
  ]

  const partRows = repuestos.map((part, idx) => {
    const meta = partMetaByIdx[idx]!
    const dims = (part.dimensiones || {}) as Record<string, unknown>
    const rowObj: Record<string, unknown> = {
      accion: '',
      id: part.id,
      codigo_oem: part.codigo_oem,
      codigos_oem_adicionales: (part.codigos_oem_adicionales || []).join(', '),
      nombre: part.nombre,
      familia: grupo.codigo,
      categoria: part.categoria || grupo.categoria,
      subsistema: part.subsistema || grupo.subsistema || 'Block',
      fabricante: meta.fabricante,
      motor: meta.motorCodigo,
      modelos: meta.modelos.join(', '),
      anio: meta.anio,
      catalogo_origen: part.catalogo_origen || 'OEM',
      precio: Number(part.precio || 0),
      stock: Number(part.stock || 0),
      estado: part.estado || 'Disponible',
      equivalencias: meta.equivalenciasText
    }

    if (ringsMode) {
      const ringInfo = ringDataByIdx[idx]!
      rowObj.diametro_cilindro_mm = part.diametro_cilindro_mm ?? dims.diametro_cilindro_mm ?? ''
      for (let i = 1; i <= maxCompRings; i++) {
        const ring = ringInfo.compRings[i - 1]
        rowObj[`anillo${i}_grosor`] = ring?.h1 ?? ''
        rowObj[`anillo${i}_altura`] = ring?.a1 ?? ''
        rowObj[`anillo${i}_diseno`] = ring?.tipo_diseno ?? ring?.perfil ?? ring?.forma ?? ''
      }
      rowObj.anillo_aceite_grosor = ringInfo.oilRing?.h1 ?? part.espesor_aceite_mm ?? ''
      rowObj.anillo_aceite_altura = ringInfo.oilRing?.a1 ?? ''
      rowObj.anillo_aceite_diseno =
        ringInfo.oilRing?.tipo_diseno ?? ringInfo.oilRing?.perfil ?? ringInfo.oilRing?.forma ?? ''
      rowObj.disenos_anillo = Array.isArray(part.disenos_anillo) ? part.disenos_anillo.join(', ') : ''
    } else {
      for (const param of cleanParams) {
        let rawVal = dims[param.clave] ?? (part as unknown as Record<string, unknown>)[param.clave]
        if (typeof rawVal === 'boolean') rawVal = rawVal ? 'Si' : 'No'
        else if (Array.isArray(rawVal)) rawVal = rawVal.map(v => String(v || '').trim()).filter(Boolean).join(', ')
        rowObj[param.clave] = rawVal ?? ''
      }
      if (measureColumns.includes('subfilas_json')) {
        rowObj.subfilas_json = Array.isArray(dims.subfilas) ? JSON.stringify(dims.subfilas) : ''
      }
      for (const sqlKey of STANDARD_SQL_EXPORT_KEYS) {
        const kStr = String(sqlKey)
        if (!paramKeysSet.has(kStr) && measureColumns.includes(kStr)) {
          rowObj[kStr] = (part as unknown as Record<string, unknown>)[kStr] ?? dims[kStr] ?? ''
        }
      }
    }

    rowObj.descripcion_tecnica =
      part.descripcion_tecnica || String(part.especificaciones_tecnicas?.descripcion_tecnica || '') || ''
    rowObj.imagen_url = meta.imagen_url
    if (hasMultiImages) {
      rowObj.imagenes_json = meta.imagenes.length > 0 ? JSON.stringify(meta.imagenes) : ''
    }

    return rowObj
  })

  const wsParts =
    partRows.length > 0
      ? XLSX.utils.json_to_sheet(partRows, { header: partHeaders })
      : XLSX.utils.aoa_to_sheet([partHeaders])
  wsParts['!cols'] = partHeaders.map(col => {
    if (col === 'id') return { wch: 38 }
    if (col === 'nombre' || col === 'equivalencias' || col === 'descripcion_tecnica') return { wch: 32 }
    if (col === 'subfilas_json' || col === 'imagenes_json' || col === 'imagen_url') return { wch: 36 }
    return { wch: Math.max(15, col.length + 4) }
  })
  XLSX.utils.book_append_sheet(wb, wsParts, 'Repuestos')

  // 4. Hoja Motores relacionados
  if (ctx.usedMotors.length > 0) {
    const motorRows = ctx.usedMotors.map(m => serializeMotorForExport(m, ctx))
    const wsMotors = XLSX.utils.json_to_sheet(motorRows, { header: MOTOR_TEMPLATE_COLUMNS })
    wsMotors['!cols'] = MOTOR_TEMPLATE_COLUMNS.map(col => ({ wch: Math.max(15, col.length + 3) }))
    XLSX.utils.book_append_sheet(wb, wsMotors, 'Motores')
  }

  // 5. Hoja Instrucciones
  const guideRows = [
    {
      Campo_o_Accion: '=== EXPORTACIÓN COMPLETA DE FAMILIA SWGORA ===',
      Detalle: `Familia "${grupo.nombre}" (${grupo.codigo}) con ${repuestos.length} repuesto(s) exportado(s).`
    },
    {
      Campo_o_Accion: 'EDITAR REPUESTOS O ESQUEMA',
      Detalle:
        'Modifica cualquier dato en Familias, Columnas_Familia o Repuestos conservando la columna "id". Incluso puedes cambiar el "codigo_oem" sin duplicar el registro.'
    },
    {
      Campo_o_Accion: 'AGREGAR NUEVOS REPUESTOS',
      Detalle:
        'Agrega nuevas filas en la hoja Repuestos dejando las columnas "id" y "accion" vacías.'
    },
    {
      Campo_o_Accion: 'ELIMINAR REPUESTOS MARCADOS',
      Detalle:
        'Escribe la palabra "eliminar" en la columna "accion" de los repuestos que desees borrar del catálogo, o elimínalos de la hoja y activa "Sincronizar familia" al re-importar.'
    },
    {
      Campo_o_Accion: 'ELIMINAR LA FAMILIA COMPLETA',
      Detalle:
        'Escribe "eliminar" en la columna "accion" de la hoja Familias si deseas borrar toda la familia junto con sus repuestos.'
    }
  ]
  const wsGuide = XLSX.utils.json_to_sheet(guideRows)
  wsGuide['!cols'] = [{ wch: 40 }, { wch: 105 }]
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Instrucciones')

  // Asegurar que "Repuestos" sea siempre la primera hoja visible al abrir en Excel
  wb.SheetNames = [
    'Repuestos',
    ...wb.SheetNames.filter(name => name !== 'Repuestos')
  ]

  const safeCode = sanitizeExportFilenamePart(grupo.codigo || grupo.nombre)
  const fileName = `familia_${safeCode}_${formatExportDateStamp()}.xlsx`
  XLSX.writeFile(wb, fileName)
  return { fileName, exportedPartsCount: repuestos.length }
}

/**
 * Exporta todas las familias y todos los repuestos del catálogo en un solo archivo Excel.
 */
export const exportAllCatalogToExcel = (
  grupos: GrupoRepuesto[],
  repuestos: RepuestoTecnico[],
  context: {
    motores: Motor[]
    fabricantes: Fabricante[]
    modelos: Modelo[]
  }
): { fileName: string; exportedPartsCount: number } => {
  const wb = XLSX.utils.book_new()
  const ctx = buildResolvedExportContext(repuestos, context)

  const extraParamKeys: string[] = []
  for (const g of grupos) {
    for (const p of g.parametros || []) {
      if (p.clave && !extraParamKeys.includes(p.clave)) {
        extraParamKeys.push(p.clave)
      }
    }
  }
  const hasMultiImages = repuestos.some(p => resolvePartExportMeta(p, ctx).imagenes.length > 1)
  const partHeaders = [
    'accion',
    'id',
    'codigo_oem',
    'nombre',
    'familia',
    'categoria',
    'fabricante',
    'motor',
    'modelos',
    'ano',
    'catalogo_origen',
    'equivalencias',
    'precio',
    'stock',
    'estado',
    ...extraParamKeys,
    'subfilas_json',
    'descripcion_tecnica',
    'imagen_url',
    ...(hasMultiImages ? ['imagenes_json'] : [])
  ]

  const partRows = repuestos.map(part => {
    const meta = resolvePartExportMeta(part, ctx)
    const dims = (part.dimensiones || {}) as Record<string, unknown>
    const rowObj: Record<string, unknown> = {
      accion: '',
      id: part.id,
      codigo_oem: part.codigo_oem || '',
      nombre: part.nombre || '',
      familia: part.categoria || '',
      categoria: part.categoria || '',
      fabricante: meta.fabricante,
      motor: meta.motorCodigo,
      modelos: meta.modelos.join(', '),
      ano: meta.anio,
      catalogo_origen: part.catalogo_origen || 'OEM',
      equivalencias: meta.equivalenciasText,
      precio: Number(part.precio ?? 0),
      stock: Number(part.stock ?? 0),
      estado: part.estado || 'Disponible'
    }
    for (const key of extraParamKeys) {
      const rawVal = dims[key] ?? (part as unknown as Record<string, unknown>)[key]
      rowObj[key] = Array.isArray(rawVal)
        ? rawVal.map(v => String(v || '').trim()).filter(Boolean).join(', ')
        : rawVal ?? ''
    }
    rowObj.subfilas_json = Array.isArray(dims.subfilas) ? JSON.stringify(dims.subfilas) : ''
    rowObj.descripcion_tecnica =
      part.descripcion_tecnica || String(part.especificaciones_tecnicas?.descripcion_tecnica || '') || ''
    rowObj.imagen_url = meta.imagen_url
    if (hasMultiImages) {
      rowObj.imagenes_json = meta.imagenes.length > 0 ? JSON.stringify(meta.imagenes) : ''
    }
    return rowObj
  })

  const wsParts =
    partRows.length > 0
      ? XLSX.utils.json_to_sheet(partRows, { header: partHeaders })
      : XLSX.utils.aoa_to_sheet([partHeaders])
  wsParts['!cols'] = partHeaders.map(col => {
    if (col === 'id') return { wch: 38 }
    if (col === 'nombre' || col === 'equivalencias' || col === 'descripcion_tecnica') return { wch: 32 }
    if (col === 'subfilas_json' || col === 'imagenes_json' || col === 'imagen_url') return { wch: 36 }
    return { wch: Math.max(15, col.length + 4) }
  })
  XLSX.utils.book_append_sheet(wb, wsParts, 'Repuestos')

  const familyHeaders = [
    'accion',
    'id',
    'codigo',
    'nombre',
    'categoria',
    'subsistema',
    'tipo_vista',
    'filas_tabla',
    'icono',
    'descripcion'
  ]
  const familyRows = grupos.map(g => ({
    accion: '',
    id: g.id,
    codigo: g.codigo,
    nombre: g.nombre,
    categoria: g.categoria,
    subsistema: g.subsistema || 'Block',
    tipo_vista: g.tipo_vista || 'normal',
    filas_tabla: serializeFilasTablaForExcel(g),
    icono: g.icono || 'Layers',
    descripcion: g.descripcion || ''
  }))
  const wsFam =
    familyRows.length > 0
      ? XLSX.utils.json_to_sheet(familyRows, { header: familyHeaders })
      : XLSX.utils.aoa_to_sheet([familyHeaders])
  XLSX.utils.book_append_sheet(wb, wsFam, 'Familias')

  if (ctx.usedMotors.length > 0) {
    const motorRows = ctx.usedMotors.map(m => serializeMotorForExport(m, ctx))
    const wsMotors = XLSX.utils.json_to_sheet(motorRows, { header: MOTOR_TEMPLATE_COLUMNS })
    wsMotors['!cols'] = MOTOR_TEMPLATE_COLUMNS.map(col => ({ wch: Math.max(15, col.length + 3) }))
    XLSX.utils.book_append_sheet(wb, wsMotors, 'Motores')
  }

  const fileName = `catalogo_completo_swgora_${formatExportDateStamp()}.xlsx`
  XLSX.writeFile(wb, fileName)
  return { fileName, exportedPartsCount: repuestos.length }
}

export const exportFamilyToJson = (
  grupo: GrupoRepuesto,
  repuestos: RepuestoTecnico[],
  context: {
    motores: Motor[]
    fabricantes: Fabricante[]
    modelos: Modelo[]
  }
): { fileName: string; exportedPartsCount: number } => {
  const ctx = buildResolvedExportContext(repuestos, context)
  const ringsMode = isRingsGrupo(grupo)
  const cleanParams = (grupo.parametros || []).map(sanitizeParamForExport)
  const cleanTablaConfig =
    grupo.tipo_vista === 'tabla' && grupo.tabla_config
      ? { ...grupo.tabla_config }
      : undefined

  const meta: FamilyExportMeta = {
    tipo: 'exportacion_familia',
    version: 1,
    familia_id: grupo.id,
    familia_codigo: grupo.codigo,
    familia_nombre: grupo.nombre,
    familia_categoria: grupo.categoria,
    exportado_en: new Date().toISOString(),
    total_repuestos: repuestos.length
  }

  const familiaObj = {
    accion: '',
    id: grupo.id,
    codigo: grupo.codigo,
    nombre: grupo.nombre,
    categoria: grupo.categoria,
    subsistema: grupo.subsistema || 'Block',
    descripcion: grupo.descripcion || '',
    icono: grupo.icono || 'Layers',
    tipo_vista: grupo.tipo_vista || 'normal',
    ...(cleanTablaConfig ? { tabla_config: cleanTablaConfig } : {}),
    ...(grupo.tipo_vista === 'tabla' && grupo.tabla_config?.subfilas?.length
      ? { filas_tabla: serializeFilasTablaForExcel(grupo) }
      : {}),
    columnas: cleanParams
  }

  const partsPayload = repuestos.map(part => {
    const metaPart = resolvePartExportMeta(part, ctx)
    const dims = (part.dimensiones || {}) as Record<string, unknown>
    const obj: Record<string, unknown> = {
      accion: '',
      id: part.id,
      codigo_oem: part.codigo_oem,
      ...(part.codigos_oem_adicionales?.length
        ? { codigos_oem_adicionales: part.codigos_oem_adicionales }
        : {}),
      nombre: part.nombre,
      familia: grupo.codigo,
      categoria: part.categoria || grupo.categoria,
      subsistema: part.subsistema || grupo.subsistema || 'Block',
      fabricante: metaPart.fabricante,
      motor: metaPart.motorCodigo,
      modelos: metaPart.modelos,
      anio: metaPart.anio,
      catalogo_origen: part.catalogo_origen || 'OEM',
      precio: Number(part.precio || 0),
      stock: Number(part.stock || 0),
      estado: part.estado || 'Disponible',
      equivalencias: metaPart.equivalenciasList
    }

    if (ringsMode) {
      if (part.diametro_cilindro_mm != null || dims.diametro_cilindro_mm != null) {
        obj.diametro_cilindro_mm = part.diametro_cilindro_mm ?? dims.diametro_cilindro_mm
      }
      if (part.espesor_anillo1_mm != null) obj.espesor_anillo1_mm = part.espesor_anillo1_mm
      if (part.espesor_anillo2_mm != null) obj.espesor_anillo2_mm = part.espesor_anillo2_mm
      if (part.espesor_anillo3_mm != null) obj.espesor_anillo3_mm = part.espesor_anillo3_mm
      if (part.espesor_aceite_mm != null) obj.espesor_aceite_mm = part.espesor_aceite_mm
      if (Array.isArray(dims.anillos)) obj.anillos = dims.anillos
      if (Array.isArray(part.disenos_anillo) && part.disenos_anillo.length > 0) {
        obj.disenos_anillo = part.disenos_anillo
      }
    } else {
      for (const param of cleanParams) {
        const val = dims[param.clave] ?? (part as unknown as Record<string, unknown>)[param.clave]
        if (val !== undefined && val !== null && val !== '') {
          obj[param.clave] = val
        }
      }
      if (Array.isArray(dims.subfilas)) {
        obj.filas = dims.subfilas
      }
      for (const sqlKey of STANDARD_SQL_EXPORT_KEYS) {
        const kStr = String(sqlKey)
        const val = (part as unknown as Record<string, unknown>)[kStr] ?? dims[kStr]
        if (obj[kStr] === undefined && val !== undefined && val !== null && val !== '') {
          obj[kStr] = val
        }
      }
    }

    const desc = part.descripcion_tecnica || String(part.especificaciones_tecnicas?.descripcion_tecnica || '')
    if (desc) obj.descripcion_tecnica = desc
    if (metaPart.imagen_url) obj.imagen_url = metaPart.imagen_url
    if (metaPart.imagenes.length > 1) obj.imagenes = metaPart.imagenes

    return obj
  })

  const payload = {
    _export_meta: meta,
    _instrucciones: {
      editar: 'Modifica cualquier dato manteniendo "id" para actualizar (puedes cambiar codigo_oem sin duplicar).',
      agregar: 'Agrega elementos en "repuestos" sin "id" y con "accion": "".',
      eliminar_registros: 'Cambia "accion": "eliminar" en el repuesto o familia que desees eliminar.',
      sincronizar: 'También puedes quitar repuestos del arreglo y activar "Sincronizar familia" al importar.'
    },
    familias: [familiaObj],
    motores: ctx.usedMotors.map(m => serializeMotorForExport(m, ctx)),
    repuestos: partsPayload
  }

  const safeCode = sanitizeExportFilenamePart(grupo.codigo || grupo.nombre)
  const fileName = `familia_${safeCode}_${formatExportDateStamp()}.json`
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  triggerDownloadBlob(blob, fileName)
  return { fileName, exportedPartsCount: repuestos.length }
}

// =============================================================================
// EJECUCIÓN DE IMPORTACIÓN MASIVA EN SUPABASE + STORE LOCAL
// =============================================================================

interface ExistingPartIndexEntry {
  id: string
  codigo_oem: string
  categoria: string
  owner: RepuestoOwnerMeta
}

const INDEX_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function fetchPartIndexChunk(
  filterField: 'id' | 'codigo_oem',
  values: string[]
): Promise<Array<Record<string, unknown>>> {
  if (values.length === 0) return []
  const aliasSelect =
    'id, codigo_oem, categoria, created_by_user_id:especificaciones_tecnicas->>created_by_user_id, created_by_email:especificaciones_tecnicas->>created_by_email, created_by_name:especificaciones_tecnicas->>created_by_name, created_by_role:especificaciones_tecnicas->>created_by_role'

  try {
    const { data, error } = await supabase
      .from('repuestos_tecnicos')
      .select(aliasSelect)
      .in(filterField, values)
    if (!error && Array.isArray(data)) {
      return data as Array<Record<string, unknown>>
    }
  } catch {
    // fallback abajo
  }

  try {
    const { data: fbData, error: fbError } = await supabase
      .from('repuestos_tecnicos')
      .select('id, codigo_oem, categoria, especificaciones_tecnicas')
      .in(filterField, values)
    if (!fbError && Array.isArray(fbData)) {
      return fbData as Array<Record<string, unknown>>
    }
  } catch (err) {
    console.warn(`[ImportService] Error consultando índice por ${filterField}:`, err)
  }

  return []
}

async function loadExistingPartIndices(
  inMemoryParts: RepuestoTecnico[],
  candidateParts: ParsedPartRow[]
): Promise<{
  oemIndex: Map<string, string>
  idIndex: Map<string, ExistingPartIndexEntry>
}> {
  const oemIndex = new Map<string, string>()
  const idIndex = new Map<string, ExistingPartIndexEntry>()

  for (const p of inMemoryParts) {
    const cleanOem = String(p.codigo_oem || '').trim().toUpperCase()
    const cleanId = String(p.id || '').trim()
    const owner = extractRepuestoOwner(p)
    if (cleanId) {
      idIndex.set(cleanId, {
        id: cleanId,
        codigo_oem: cleanOem,
        categoria: p.categoria || '',
        owner
      })
    }
    if (cleanOem && cleanId) {
      oemIndex.set(cleanOem, cleanId)
    }
  }

  const candidateIds = Array.from(
    new Set(
      candidateParts
        .map(p => String(p.sourceId || '').trim())
        .filter(id => id && INDEX_UUID_RE.test(id))
    )
  )
  const candidateOems = Array.from(
    new Set(
      candidateParts
        .flatMap(p => {
          const raw = String(p.codigo_oem || '').trim()
          const upper = raw.toUpperCase()
          return raw && raw !== upper ? [upper, raw] : upper ? [upper] : []
        })
        .filter(Boolean)
    )
  )

  try {
    const fetchedRows: Array<Record<string, unknown>> = []
    const idChunks = chunkArray(candidateIds, 200)
    const oemChunks = chunkArray(candidateOems, 150)

    await Promise.all([
      runWithConcurrency(idChunks, 6, async chunk => {
        const rows = await fetchPartIndexChunk('id', chunk)
        fetchedRows.push(...rows)
      }),
      runWithConcurrency(oemChunks, 6, async chunk => {
        const rows = await fetchPartIndexChunk('codigo_oem', chunk)
        fetchedRows.push(...rows)
      })
    ])

    for (const row of fetchedRows) {
      const cleanId = String(row.id || '').trim()
      const cleanOem = String(row.codigo_oem || '').trim().toUpperCase()
      const cleanCat = String(row.categoria || '').trim()
      const owner = extractRepuestoOwner(row)
      if (cleanId) {
        const existingMem = idIndex.get(cleanId)
        const hasRemoteOwner = Boolean(owner.userId || owner.email)
        idIndex.set(cleanId, {
          id: cleanId,
          codigo_oem: cleanOem,
          categoria: cleanCat || existingMem?.categoria || '',
          owner: hasRemoteOwner ? owner : existingMem?.owner || owner
        })
      }
      if (cleanOem && cleanId && !oemIndex.has(cleanOem)) {
        oemIndex.set(cleanOem, cleanId)
      }
    }
  } catch (err) {
    console.warn('[ImportService] No se pudo consultar índice OEM remoto, usando caché local:', err)
  }

  return { oemIndex, idIndex }
}

export const executeCatalogImport = async (
  parsed: CatalogImportParseResult,
  options: CatalogImportOptions,
  context: {
    grupos?: GrupoRepuesto[]
    fabricantes: Fabricante[]
    modelos: Modelo[]
    motores: Motor[]
    repuestos: RepuestoTecnico[]
  }
): Promise<CatalogImportReport> => {
  const report: CatalogImportReport = {
    createdFamilies: 0,
    updatedFamilies: 0,
    deletedFamilies: 0,
    skippedFamilies: 0,
    createdMotors: 0,
    skippedMotors: 0,
    createdParts: 0,
    updatedParts: 0,
    deletedParts: 0,
    skippedParts: 0,
    skippedUnauthorizedParts: 0,
    createdBrands: 0,
    createdModels: 0,
    deletedPartIds: [],
    deletedFamilyIds: [],
    errors: []
  }

  const actor = options.actor ?? null
  const isPrimaryAdmin = Boolean(actor?.isAdmin)

  const validFamilies = (parsed.families || []).filter(f => f.status !== 'error')
  const validMotors = parsed.motors.filter(m => m.status !== 'error')
  const validParts = parsed.parts.filter(p => p.status !== 'error')
  const partsToDelete = validParts.filter(p => p.action === 'delete')
  const partsToUpsert = validParts.filter(p => p.action !== 'delete')

  const totalSteps = validFamilies.length + validMotors.length + partsToDelete.length + partsToUpsert.length
  let currentStep = 0

  options.onProgress?.(0, Math.max(totalSteps, 1), 'Consultando coincidencias existentes en catálogo...')

  const gruposList = [...(context.grupos || [])]
  const fabList = [...context.fabricantes]
  const modList = [...context.modelos]
  const motList = [...context.motores]
  const { oemIndex, idIndex } = await loadExistingPartIndices(context.repuestos, validParts)

  const deletedFamilyKeys = new Set<string>()
  const retainedPartIds = new Set<string>()

  // 0. Procesar Familias Técnicas (eliminaciones, actualizaciones o altas)
  for (const fRow of validFamilies) {
    currentStep++
    options.onProgress?.(currentStep, Math.max(totalSteps, 1), `Familia ${fRow.nombre || fRow.codigo}`)
    try {
      const normName = normalizeText(fRow.nombre)
      const normCode = normalizeText(fRow.codigo)
      const existingIdx = gruposList.findIndex(
        g =>
          (fRow.sourceId && g.id === fRow.sourceId) ||
          (normCode && normalizeText(g.codigo) === normCode) ||
          (normName && normalizeText(g.nombre) === normName)
      )
      const existing = existingIdx >= 0 ? gruposList[existingIdx] : undefined

      if (fRow.action === 'delete') {
        if (!isPrimaryAdmin) {
          report.skippedFamilies++
          report.errors.push({
            rowLabel: `${fRow.sheetName} fila ${fRow.rowIndex} (${fRow.nombre || fRow.codigo || fRow.sourceId || 'Familia'})`,
            message: 'Solo el administrador principal puede eliminar familias del catálogo.'
          })
          continue
        }

        if (!existing) {
          report.skippedFamilies++
          report.errors.push({
            rowLabel: `${fRow.sheetName} fila ${fRow.rowIndex} (${fRow.nombre || fRow.codigo || fRow.sourceId || 'Familia'})`,
            message: 'Familia no encontrada para eliminar (puede que ya haya sido eliminada)'
          })
          continue
        }

        if (options.deletePartsWithDeletedFamily !== false) {
          const familyParts = await catalogService.getAllRepuestosForGrupoExport(existing)
          const familyPartIds = familyParts.map(p => p.id)
          if (familyPartIds.length > 0) {
            const delRes = await catalogService.deleteRepuestosBulk(familyPartIds)
            report.deletedParts += delRes.deletedIds.length
            report.deletedPartIds.push(...delRes.deletedIds)
            for (const did of delRes.deletedIds) {
              const entry = idIndex.get(did)
              if (entry?.codigo_oem) oemIndex.delete(entry.codigo_oem.toUpperCase())
              idIndex.delete(did)
            }
            if (delRes.failedIds.length > 0) {
              report.errors.push({
                rowLabel: `${fRow.sheetName} fila ${fRow.rowIndex} (${existing.nombre})`,
                message: `${delRes.failedIds.length} repuesto(s) no pudieron eliminarse${delRes.errorMessage ? `: ${delRes.errorMessage}` : ''}`
              })
            }
          }
        }

        await catalogService.deleteGrupo(existing.id, existing.codigo)
        clearCatalogPartsCache()
        report.deletedFamilies++
        report.deletedFamilyIds.push(existing.id)
        gruposList.splice(existingIdx, 1)
        ;[existing.id, normalizeText(existing.codigo), normalizeText(existing.nombre), normalizeText(existing.categoria)]
          .filter(Boolean)
          .forEach(k => deletedFamilyKeys.add(k))
        continue
      }

      const baseTablaCfg: Partial<TablaConfiguracion> = {
        ...(existing?.tabla_config || {}),
        ...(fRow.rawTablaConfig || {})
      }
      const fallbackSubfilas = Array.isArray(baseTablaCfg.subfilas) && baseTablaCfg.subfilas.length > 0
        ? baseTablaCfg.subfilas
        : ['Componente 1']
      const fallbackPadres = Array.isArray(baseTablaCfg.subfila_padres) && baseTablaCfg.subfila_padres.length > 0
        ? baseTablaCfg.subfila_padres
        : fallbackSubfilas.map(() => '')
      const fallbackTipos: Array<'normal' | 'central'> =
        Array.isArray(baseTablaCfg.subfila_tipos) && baseTablaCfg.subfila_tipos.length > 0
          ? baseTablaCfg.subfila_tipos
          : fallbackSubfilas.map(() => 'normal')

      const tpl: FamilyTemplate = {
        id: fRow.codigo || `imp_${Date.now()}`,
        nombre: fRow.nombre,
        categoria: fRow.categoria || fRow.nombre,
        subsistema: fRow.subsistema || 'Block',
        descripcion: fRow.descripcion || `Familia ${fRow.nombre}`,
        icono: fRow.icono || 'Layers',
        tipo_vista: fRow.tipo_vista,
        ...(fRow.tipo_vista === 'tabla'
          ? {
              tabla_config: {
                ...(baseTablaCfg.tiene_cabecera_marca !== undefined
                  ? { tiene_cabecera_marca: baseTablaCfg.tiene_cabecera_marca }
                  : {}),
                ...(baseTablaCfg.usar_prefijo_titulo !== undefined
                  ? { usar_prefijo_titulo: baseTablaCfg.usar_prefijo_titulo }
                  : {}),
                ...(baseTablaCfg.etiqueta_ultima_fila !== undefined
                  ? { etiqueta_ultima_fila: baseTablaCfg.etiqueta_ultima_fila }
                  : {}),
                ...(baseTablaCfg.habilitar_identificador !== undefined
                  ? { habilitar_identificador: baseTablaCfg.habilitar_identificador }
                  : {}),
                ...(baseTablaCfg.etiqueta_identificador !== undefined
                  ? { etiqueta_identificador: baseTablaCfg.etiqueta_identificador }
                  : {}),
                ...(baseTablaCfg.opciones_identificador !== undefined
                  ? { opciones_identificador: baseTablaCfg.opciones_identificador }
                  : {}),
                titulo_primera_columna:
                  fRow.titulo_primera_columna || baseTablaCfg.titulo_primera_columna || 'Componente',
                ...(fRow.titulo_grupo_filas || baseTablaCfg.titulo_grupo_filas
                  ? { titulo_grupo_filas: fRow.titulo_grupo_filas || baseTablaCfg.titulo_grupo_filas }
                  : {}),
                modo_filas: baseTablaCfg.modo_filas || ('subfilas' as const),
                subfilas_activas: true,
                subfilas:
                  fRow.filas.length > 0 ? fRow.filas.map(r => r.nombre) : fallbackSubfilas,
                subfila_padres:
                  fRow.filas.length > 0 ? fRow.filas.map(r => r.grupo_central || '') : fallbackPadres,
                subfila_tipos:
                  fRow.filas.length > 0 ? fRow.filas.map(r => r.tipo_fila) : fallbackTipos
              }
            }
          : {}),
        columnas: fRow.columnas
      }

      const insertPayload = convertTemplateToGrupoInsert(
        tpl,
        fRow.nombre,
        fRow.categoria || fRow.nombre,
        fRow.subsistema
      )

      if (existing) {
        if (options.duplicateStrategy === 'skip') {
          report.skippedFamilies++
          continue
        }
        if (options.duplicateStrategy === 'update') {
          if (!isPrimaryAdmin) {
            report.skippedFamilies++
            report.errors.push({
              rowLabel: `${fRow.sheetName} fila ${fRow.rowIndex} (${fRow.nombre || existing.nombre})`,
              message: 'Configuración de familia existente omitida: solo el administrador puede modificar familias existentes.'
            })
            continue
          }
          const prevCategoria = existing.categoria
          const updated = await catalogService.updateGrupo(existing.id, insertPayload)
          gruposList[existingIdx] = updated
          report.updatedFamilies++
          if (prevCategoria && updated.categoria && prevCategoria !== updated.categoria) {
            await supabase
              .from('repuestos_tecnicos')
              .update({ categoria: updated.categoria, updated_at: new Date().toISOString() })
              .eq('categoria', prevCategoria)
            clearCatalogPartsCache()
          }
          continue
        }
        // Estrategia 'create': asegurar código único para no chocar con restricción UNIQUE de codigo
        const baseSlug = insertPayload.codigo || fRow.codigo || `familia_${Date.now()}`
        let uniqueSlug = `${baseSlug}_${Date.now().toString(36).slice(-4)}`
        while (gruposList.some(g => normalizeText(g.codigo) === normalizeText(uniqueSlug))) {
          uniqueSlug = `${baseSlug}_${Math.random().toString(36).slice(2, 6)}`
        }
        insertPayload.codigo = uniqueSlug
      }

      const createdGroup = await catalogService.createGrupo(insertPayload)
      gruposList.push(createdGroup)
      report.createdFamilies++
    } catch (err) {
      report.errors.push({
        rowLabel: `${fRow.sheetName} fila ${fRow.rowIndex} (${fRow.nombre})`,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  // Índices en memoria O(1) para resolución rápida de marcas, modelos y motores
  const fabByNorm = new Map<string, Fabricante>()
  for (const f of fabList) {
    const k = normalizeText(f.nombre)
    if (k && !fabByNorm.has(k)) fabByNorm.set(k, f)
  }

  const modByFabAndNorm = new Map<string, Modelo>()
  for (const m of modList) {
    const k = `${m.fabricante_id}::${normalizeText(m.nombre)}`
    if (!modByFabAndNorm.has(k)) modByFabAndNorm.set(k, m)
  }

  const motorByFabAndNorm = new Map<string, Motor>()
  const motorByNormFallback = new Map<string, Motor>()
  for (const mot of motList) {
    const normC = normalizeText(mot.codigo)
    if (!normC) continue
    if (mot.fabricante_id) {
      const fk = `${mot.fabricante_id}::${normC}`
      if (!motorByFabAndNorm.has(fk)) motorByFabAndNorm.set(fk, mot)
    }
    if (!motorByNormFallback.has(normC)) motorByNormFallback.set(normC, mot)
  }

  const findExistingMotor = (codigo: string, fabId?: string): Motor | undefined => {
    const normCode = normalizeText(codigo)
    if (!normCode) return undefined
    if (fabId) return motorByFabAndNorm.get(`${fabId}::${normCode}`)
    return motorByNormFallback.get(normCode)
  }

  const registerCreatedMotor = (mot: Motor) => {
    motList.unshift(mot)
    const normC = normalizeText(mot.codigo)
    if (normC) {
      if (mot.fabricante_id) motorByFabAndNorm.set(`${mot.fabricante_id}::${normC}`, mot)
      if (!motorByNormFallback.has(normC)) motorByNormFallback.set(normC, mot)
    }
  }

  // Filtrar previamente partes que pertenecen a una familia recién eliminada
  const activePartsToUpsert = partsToUpsert.filter(pRow => {
    const famCheckTokens = [
      normalizeText(pRow.familiaRaw),
      normalizeText(pRow.resolvedGrupoCodigo || ''),
      normalizeText(pRow.resolvedGrupoNombre || ''),
      normalizeText(pRow.categoria)
    ].filter(Boolean)
    if (famCheckTokens.some(t => deletedFamilyKeys.has(t))) {
      report.skippedParts++
      return false
    }
    return true
  })

  // 1A. Pre-crear en paralelo todas las marcas faltantes (motores + repuestos)
  if (options.autoCreateEntities) {
    const missingBrandsMap = new Map<string, string>()
    const registerCandidateBrand = (rawBrand: string | undefined) => {
      const clean = String(rawBrand || '').trim()
      if (!clean) return
      const norm = normalizeText(clean)
      if (!norm || fabByNorm.has(norm) || missingBrandsMap.has(norm)) return
      missingBrandsMap.set(norm, clean)
    }
    for (const mRow of validMotors) registerCandidateBrand(mRow.fabricante)
    for (const pRow of activePartsToUpsert) {
      if (pRow.motorCodigo && pRow.fabricante) registerCandidateBrand(pRow.fabricante)
    }

    const brandsToCreate = Array.from(missingBrandsMap.values())
    if (brandsToCreate.length > 0) {
      options.onProgress?.(currentStep, Math.max(totalSteps, 1), `Registrando ${brandsToCreate.length} marca(s)...`)
      await runWithConcurrency(brandsToCreate, 6, async brandName => {
        try {
          const norm = normalizeText(brandName)
          if (fabByNorm.has(norm)) return
          const created = await catalogService.createFabricante({ nombre: brandName })
          fabList.push(created)
          fabByNorm.set(norm, created)
          report.createdBrands++
        } catch (err) {
          console.warn(`[ImportService] No se pudo crear marca ${brandName}:`, err)
        }
      })
    }

    // 1B. Pre-crear en paralelo todos los modelos faltantes
    const missingModelsMap = new Map<string, { fabId: string; name: string }>()
    const registerCandidateModels = (fabId: string | undefined, modelNames: string[]) => {
      if (!fabId) return
      for (const rawName of modelNames) {
        const clean = rawName.replace(/\s+/g, ' ').trim()
        if (!clean) continue
        const key = `${fabId}::${normalizeText(clean)}`
        if (!modByFabAndNorm.has(key) && !missingModelsMap.has(key)) {
          missingModelsMap.set(key, { fabId, name: clean })
        }
      }
    }
    for (const mRow of validMotors) {
      const fab = fabByNorm.get(normalizeText(mRow.fabricante))
      registerCandidateModels(fab?.id, mRow.modelos)
    }
    for (const pRow of activePartsToUpsert) {
      if (pRow.motorCodigo && pRow.fabricante && pRow.modelos.length > 0) {
        const fab = fabByNorm.get(normalizeText(pRow.fabricante))
        registerCandidateModels(fab?.id, pRow.modelos)
      }
    }

    const modelsToCreate = Array.from(missingModelsMap.values())
    if (modelsToCreate.length > 0) {
      options.onProgress?.(currentStep, Math.max(totalSteps, 1), `Registrando ${modelsToCreate.length} modelo(s)...`)
      await runWithConcurrency(modelsToCreate, 8, async item => {
        try {
          const key = `${item.fabId}::${normalizeText(item.name)}`
          if (modByFabAndNorm.has(key)) return
          const created = await catalogService.createModelo(item.fabId, item.name)
          modList.push(created)
          modByFabAndNorm.set(key, created)
          report.createdModels++
        } catch (err) {
          console.warn(`[ImportService] No se pudo crear modelo ${item.name}:`, err)
        }
      })
    }
  }

  const resolveModelIdsSync = (fabId: string, modelNames: string[]): string[] => {
    const ids: string[] = []
    for (const rawName of modelNames) {
      const clean = rawName.replace(/\s+/g, ' ').trim()
      if (!clean) continue
      const found = modByFabAndNorm.get(`${fabId}::${normalizeText(clean)}`)
      if (found) ids.push(found.id)
    }
    return Array.from(new Set(ids))
  }

  // 1C. Procesar Motores explícitos en paralelo (deduplicados)
  if (validMotors.length > 0) {
    const queuedMotorKeys = new Set<string>()
    const explicitMotorsToCreate: Array<{ row: ParsedMotorRow; fab: Fabricante; modeloIds: string[] }> = []

    for (const mRow of validMotors) {
      currentStep++
      const fab = fabByNorm.get(normalizeText(mRow.fabricante))
      if (!fab) {
        report.skippedMotors++
        report.errors.push({
          rowLabel: `${mRow.sheetName} fila ${mRow.rowIndex}`,
          message: `Fabricante "${mRow.fabricante}" no encontrado (active creación automática para registrarlo)`
        })
        continue
      }

      const key = `${fab.id}::${normalizeText(mRow.codigo)}`
      if (findExistingMotor(mRow.codigo, fab.id) || queuedMotorKeys.has(key)) {
        report.skippedMotors++
        continue
      }
      queuedMotorKeys.add(key)
      explicitMotorsToCreate.push({
        row: mRow,
        fab,
        modeloIds: resolveModelIdsSync(fab.id, mRow.modelos)
      })
    }

    if (explicitMotorsToCreate.length > 0) {
      options.onProgress?.(
        currentStep,
        Math.max(totalSteps, 1),
        `Creando ${explicitMotorsToCreate.length} motor(es) en paralelo...`
      )
      await runWithConcurrency(explicitMotorsToCreate, 6, async item => {
        try {
          const { row: mRow, fab, modeloIds } = item
          const createdMotor = await catalogService.createMotor({
            fabricante_id: fab.id,
            codigo: mRow.codigo,
            numero_id: mRow.numero_id,
            denominacion_venta: mRow.denominacion_venta,
            modelo_id: modeloIds[0],
            modelo_ids: modeloIds,
            modelos_nombres: mRow.modelos,
            cilindros: mRow.cilindros,
            valvulas: mRow.valvulas,
            cilindrada_cc: mRow.cilindrada_cc,
            kw: mRow.kw,
            cv: mRow.cv,
            combustible: mRow.combustible,
            diametro_cilindro_std_mm: mRow.diametro_cilindro_std_mm,
            aspiracion: mRow.aspiracion,
            anios: mRow.anios
          })
          registerCreatedMotor(createdMotor)
          report.createdMotors++
        } catch (err) {
          report.errors.push({
            rowLabel: `${item.row.sheetName} fila ${item.row.rowIndex} (${item.row.codigo})`,
            message: err instanceof Error ? err.message : String(err)
          })
        }
      })
    }
  }

  // 1D. Pre-crear en paralelo motores implícitos referenciados en la hoja de Repuestos
  if (options.autoCreateEntities && activePartsToUpsert.length > 0) {
    const implicitMotorQueue = new Map<
      string,
      { fab: Fabricante; codigo: string; modelosSet: Set<string> }
    >()
    for (const pRow of activePartsToUpsert) {
      if (!pRow.motorCodigo || !pRow.fabricante) continue
      const fab = fabByNorm.get(normalizeText(pRow.fabricante))
      if (!fab) continue
      if (findExistingMotor(pRow.motorCodigo, fab.id)) continue
      const key = `${fab.id}::${normalizeText(pRow.motorCodigo)}`
      if (!implicitMotorQueue.has(key)) {
        implicitMotorQueue.set(key, {
          fab,
          codigo: pRow.motorCodigo,
          modelosSet: new Set<string>()
        })
      }
      const bucket = implicitMotorQueue.get(key)!
      pRow.modelos.forEach(m => {
        const clean = m.trim()
        if (clean) bucket.modelosSet.add(clean)
      })
    }

    const implicitMotorsList = Array.from(implicitMotorQueue.values())
    if (implicitMotorsList.length > 0) {
      options.onProgress?.(
        currentStep,
        Math.max(totalSteps, 1),
        `Creando ${implicitMotorsList.length} motor(es) nuevos detectados en repuestos...`
      )
      await runWithConcurrency(implicitMotorsList, 6, async spec => {
        try {
          const modelosNombres = Array.from(spec.modelosSet)
          const modeloIds = resolveModelIdsSync(spec.fab.id, modelosNombres)
          const createdMotor = await catalogService.createMotor({
            fabricante_id: spec.fab.id,
            codigo: spec.codigo,
            modelo_id: modeloIds[0],
            modelo_ids: modeloIds,
            modelos_nombres: modelosNombres,
            combustible: 'Diésel',
            cilindros: 4,
            valvulas: 8
          })
          registerCreatedMotor(createdMotor)
          report.createdMotors++
        } catch (err) {
          console.warn(`[ImportService] No se pudo crear motor implícito ${spec.codigo}:`, err)
        }
      })
    }
  }

  // 2. Ejecutar eliminaciones explícitas de repuestos (accion = "eliminar") en lotes con validación de propietario
  if (partsToDelete.length > 0) {
    const deleteIdsSet = new Set<string>()
    for (const pRow of partsToDelete) {
      currentStep++
      const bySourceId = pRow.sourceId && idIndex.has(pRow.sourceId) ? pRow.sourceId : undefined
      const byOem = pRow.codigo_oem ? oemIndex.get(pRow.codigo_oem.toUpperCase()) : undefined
      const resolvedId = bySourceId || byOem
      if (!resolvedId) {
        report.skippedParts++
        report.errors.push({
          rowLabel: `${pRow.sheetName} fila ${pRow.rowIndex} (${pRow.codigo_oem || pRow.sourceId || 'Repuesto'})`,
          message: 'Repuesto no encontrado para eliminar (puede que ya haya sido eliminado)'
        })
        continue
      }

      const existingEntry = idIndex.get(resolvedId)
      if (!canActorModifyRepuesto(existingEntry?.owner || null, actor)) {
        report.skippedUnauthorizedParts++
        report.skippedParts++
        report.errors.push({
          rowLabel: `${pRow.sheetName} fila ${pRow.rowIndex} (${pRow.codigo_oem || existingEntry?.codigo_oem || resolvedId})`,
          message: 'Sin permiso para eliminar: solo el administrador o quien subió este repuesto puede eliminarlo.'
        })
        continue
      }

      deleteIdsSet.add(resolvedId)
    }

    const explicitDeleteIds = Array.from(deleteIdsSet)
    if (explicitDeleteIds.length > 0) {
      options.onProgress?.(
        currentStep,
        Math.max(totalSteps, 1),
        `Eliminando ${explicitDeleteIds.length} repuesto(s) marcados...`
      )
      const delRes = await catalogService.deleteRepuestosBulk(explicitDeleteIds)
      report.deletedParts += delRes.deletedIds.length
      report.deletedPartIds.push(...delRes.deletedIds)
      for (const did of delRes.deletedIds) {
        const entry = idIndex.get(did)
        if (entry?.codigo_oem) oemIndex.delete(entry.codigo_oem.toUpperCase())
        idIndex.delete(did)
      }
      if (delRes.failedIds.length > 0) {
        report.errors.push({
          rowLabel: 'Eliminación de repuestos',
          message: `${delRes.failedIds.length} repuesto(s) no pudieron eliminarse${delRes.errorMessage ? `: ${delRes.errorMessage}` : ''}`
        })
      }
    }
  }

  // 3. Clasificar y procesar altas y actualizaciones de Repuestos en lote
  interface QueuedCreateEntry {
    row: ParsedPartRow
    part: Partial<RepuestoTecnico>
    equivalencias: ParsedPartRow['equivalencias']
    resolvedCategoria: string
    motorId?: string
    modelos: string[]
  }
  interface QueuedUpdateEntry {
    id: string
    row: ParsedPartRow
    part: Partial<RepuestoTecnico>
    equivalencias: ParsedPartRow['equivalencias']
    existingEntry: ExistingPartIndexEntry
    resolvedCategoria: string
    motorId?: string
    modelos: string[]
  }

  const updateMap = new Map<string, QueuedUpdateEntry>()
  const createQueue: QueuedCreateEntry[] = []
  const queuedCreateByOem = new Map<string, number>()

  for (const pRow of activePartsToUpsert) {
    currentStep++
    try {
      const bySourceId = pRow.sourceId && idIndex.has(pRow.sourceId) ? pRow.sourceId : undefined
      const byOem = pRow.codigo_oem ? oemIndex.get(pRow.codigo_oem.toUpperCase()) : undefined
      const existingPartId = bySourceId || byOem
      const existingEntry = existingPartId ? idIndex.get(existingPartId) : undefined

      if (existingPartId && options.duplicateStrategy === 'skip') {
        retainedPartIds.add(existingPartId)
        report.skippedParts++
        continue
      }

      if (existingPartId && existingEntry && options.duplicateStrategy === 'update') {
        if (!canActorModifyRepuesto(existingEntry.owner, actor)) {
          report.skippedUnauthorizedParts++
          report.skippedParts++
          retainedPartIds.add(existingPartId)
          report.errors.push({
            rowLabel: `${pRow.sheetName} fila ${pRow.rowIndex} (${pRow.codigo_oem})`,
            message: 'Sin permiso para modificar repuesto existente: solo el administrador o quien lo subió puede editarlo.'
          })
          continue
        }
      }

      let resolvedMotor: Motor | undefined
      if (pRow.motorCodigo) {
        const fab = pRow.fabricante ? fabByNorm.get(normalizeText(pRow.fabricante)) : undefined
        resolvedMotor = findExistingMotor(pRow.motorCodigo, fab?.id)
      }

      const matchedRuntimeGroup = pRow.familiaRaw
        ? resolveGrupoMatch(pRow.familiaRaw, gruposList, options.defaultGrupo)
        : resolveGrupoMatch(pRow.categoria, gruposList, options.defaultGrupo)
      const resolvedPartCategoria = matchedRuntimeGroup?.categoria || pRow.categoria
      const resolvedPartSubsistema = pRow.subsistema && pRow.subsistema !== 'Motor'
        ? pRow.subsistema
        : (matchedRuntimeGroup?.subsistema || pRow.subsistema)

      const resolvedImagenes =
        pRow.imagenes && pRow.imagenes.length > 0
          ? pRow.imagenes
          : pRow.imagen_url
            ? [pRow.imagen_url]
            : []

      const baseSpecs: Record<string, unknown> = {
        codigos_oem_adicionales: pRow.codigos_oem_adicionales,
        marca: pRow.fabricante ? pRow.fabricante.toUpperCase() : undefined,
        modelos: pRow.modelos,
        modelo: pRow.modelos.join(' / ') || undefined,
        ano: pRow.anio,
        catalogo_origen: pRow.catalogo_origen,
        disenos_anillo: pRow.disenos_anillo,
        descripcion_tecnica: pRow.descripcion_tecnica
      }
      const baseDims: Record<string, unknown> = {
        ...pRow.dimensiones,
        codigos_oem_adicionales: pRow.codigos_oem_adicionales
      }

      const isUpdatingExisting = Boolean(existingPartId && existingEntry && options.duplicateStrategy === 'update')
      const finalSpecs = isUpdatingExisting
        ? preserveOwnerOnSpecs(existingEntry!.owner, baseSpecs)
        : stampOwnerOnSpecs(baseSpecs, actor)

      const partPayload: Partial<RepuestoTecnico> = {
        motor_id: resolvedMotor?.id,
        codigo_oem: pRow.codigo_oem,
        codigos_oem_adicionales: pRow.codigos_oem_adicionales,
        nombre: pRow.nombre,
        subsistema: resolvedPartSubsistema,
        categoria: resolvedPartCategoria,
        precio: pRow.precio,
        stock: pRow.stock,
        estado: pRow.estado,
        catalogo_origen: pRow.catalogo_origen,
        imagen_url: pRow.imagen_url || resolvedImagenes[0],
        imagenes: resolvedImagenes,
        disenos_anillo: pRow.disenos_anillo,
        descripcion_tecnica: pRow.descripcion_tecnica,
        diametro_cabeza_mm: pRow.diametro_cabeza_mm,
        diametro_vastago_mm: pRow.diametro_vastago_mm,
        longitud_total_mm: pRow.longitud_total_mm,
        angulo_asiento_grados: pRow.angulo_asiento_grados,
        diametro_interior_mm: pRow.diametro_interior_mm,
        diametro_exterior_mm: pRow.diametro_exterior_mm,
        altura_mm: pRow.altura_mm,
        diametro_cilindro_mm: pRow.diametro_cilindro_mm,
        espesor_anillo1_mm: pRow.espesor_anillo1_mm,
        espesor_anillo2_mm: pRow.espesor_anillo2_mm,
        espesor_anillo3_mm: pRow.espesor_anillo3_mm,
        espesor_aceite_mm: pRow.espesor_aceite_mm,
        medida_rosca: pRow.medida_rosca,
        paso_rosca_mm: pRow.paso_rosca_mm,
        longitud_perno_mm: pRow.longitud_perno_mm,
        cantidad_piezas: pRow.cantidad_piezas,
        dimensiones: baseDims,
        especificaciones_tecnicas: finalSpecs
      }

      if (isUpdatingExisting && existingPartId && existingEntry) {
        retainedPartIds.add(existingPartId)
        updateMap.set(existingPartId, {
          id: existingPartId,
          row: pRow,
          part: partPayload,
          equivalencias: pRow.equivalencias,
          existingEntry,
          resolvedCategoria: resolvedPartCategoria,
          motorId: resolvedMotor?.id,
          modelos: pRow.modelos
        })
      } else {
        const oemUpper = (pRow.codigo_oem || '').trim().toUpperCase()
        if (!existingPartId && oemUpper && options.duplicateStrategy !== 'create' && queuedCreateByOem.has(oemUpper)) {
          if (options.duplicateStrategy === 'skip') {
            report.skippedParts++
            continue
          }
          const qIdx = queuedCreateByOem.get(oemUpper)!
          createQueue[qIdx] = {
            row: pRow,
            part: partPayload,
            equivalencias: pRow.equivalencias,
            resolvedCategoria: resolvedPartCategoria,
            motorId: resolvedMotor?.id,
            modelos: pRow.modelos
          }
          continue
        }
        const nextIdx = createQueue.length
        createQueue.push({
          row: pRow,
          part: partPayload,
          equivalencias: pRow.equivalencias,
          resolvedCategoria: resolvedPartCategoria,
          motorId: resolvedMotor?.id,
          modelos: pRow.modelos
        })
        if (oemUpper) queuedCreateByOem.set(oemUpper, nextIdx)
      }
    } catch (err) {
      report.errors.push({
        rowLabel: `${pRow.sheetName} fila ${pRow.rowIndex} (${pRow.codigo_oem})`,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const motorModelsToSync = new Map<string, Set<string>>()
  const collectMotorModels = (motorId: string | undefined, modelos: string[]) => {
    if (!motorId || modelos.length === 0) return
    if (!motorModelsToSync.has(motorId)) motorModelsToSync.set(motorId, new Set())
    const target = motorModelsToSync.get(motorId)!
    for (const m of modelos) {
      const clean = m.trim()
      if (clean) target.add(clean)
    }
  }

  const updatesList = Array.from(updateMap.values())
  if (updatesList.length > 0) {
    options.onProgress?.(
      currentStep,
      Math.max(totalSteps, 1),
      `Actualizando ${updatesList.length} repuesto(s) en lote...`
    )
    const updRes = await catalogService.updateRepuestosBulk(
      updatesList.map(u => ({
        id: u.id,
        part: u.part,
        equivalencias: u.equivalencias
      })),
      { skipMotorModelSync: true, concurrency: 10 }
    )
    report.updatedParts += updRes.updated.length
    const failedIds = new Set(updRes.failed.map(f => f.id))
    for (const item of updatesList) {
      if (!failedIds.has(item.id)) {
        collectMotorModels(item.motorId, item.modelos)
      }
    }
    for (const upd of updRes.updated) {
      const prevEntry = idIndex.get(upd.id)
      if (prevEntry?.codigo_oem && oemIndex.get(prevEntry.codigo_oem) === upd.id) {
        oemIndex.delete(prevEntry.codigo_oem)
      }
      const newOem = upd.codigo_oem.toUpperCase()
      oemIndex.set(newOem, upd.id)
      idIndex.set(upd.id, {
        id: upd.id,
        codigo_oem: newOem,
        categoria: upd.categoria || prevEntry?.categoria || '',
        owner: extractRepuestoOwner(upd)
      })
    }
    for (const fail of updRes.failed) {
      const item = updateMap.get(fail.id)
      report.errors.push({
        rowLabel: item ? `${item.row.sheetName} fila ${item.row.rowIndex} (${item.row.codigo_oem})` : fail.id,
        message: fail.error
      })
    }
  }

  if (createQueue.length > 0) {
    options.onProgress?.(
      currentStep,
      Math.max(totalSteps, 1),
      `Creando ${createQueue.length} repuesto(s) en lote...`
    )
    const crtRes = await catalogService.createRepuestosBulk(
      createQueue.map(c => ({
        part: c.part,
        equivalencias: c.equivalencias
      })),
      { skipMotorModelSync: true, chunkSize: 80 }
    )
    report.createdParts += crtRes.created.length
    const failedIndexes = new Set(crtRes.failed.map(f => f.index))
    createQueue.forEach((item, idx) => {
      if (!failedIndexes.has(idx)) {
        collectMotorModels(item.motorId, item.modelos)
      }
    })
    for (const created of crtRes.created) {
      const createdOem = created.codigo_oem.toUpperCase()
      oemIndex.set(createdOem, created.id)
      idIndex.set(created.id, {
        id: created.id,
        codigo_oem: createdOem,
        categoria: created.categoria || '',
        owner: extractRepuestoOwner(created)
      })
      retainedPartIds.add(created.id)
    }
    for (const fail of crtRes.failed) {
      const item = createQueue[fail.index]
      report.errors.push({
        rowLabel: item ? `${item.row.sheetName} fila ${item.row.rowIndex} (${item.row.codigo_oem})` : `Fila ${fail.index + 1}`,
        message: fail.error
      })
    }
  }

  if (motorModelsToSync.size > 0) {
    options.onProgress?.(
      Math.max(currentStep, 1),
      Math.max(totalSteps, 1),
      `Sincronizando modelos en ${motorModelsToSync.size} motor(es)...`
    )
    await catalogService.syncPartModelsWithMotorBulk(motorModelsToSync, false)
  }

  // 4. Sincronización opcional de familia: eliminar repuestos de la familia ausentes en el archivo (con validación de propietario)
  if (
    options.syncFamilyDeleteMissing &&
    options.syncTargetGrupo &&
    !report.deletedFamilyIds.includes(options.syncTargetGrupo.id)
  ) {
    try {
      const runtimeSyncGrupo =
        gruposList.find(
          g =>
            g.id === options.syncTargetGrupo!.id ||
            normalizeText(g.codigo) === normalizeText(options.syncTargetGrupo!.codigo)
        ) || options.syncTargetGrupo

      const existingFamilyParts = await catalogService.getAllRepuestosForGrupoExport(runtimeSyncGrupo)
      const alreadyDeletedSet = new Set(report.deletedPartIds)
      const missingParts = existingFamilyParts.filter(
        p => !retainedPartIds.has(p.id) && !alreadyDeletedSet.has(p.id)
      )
      const authorizedMissingIds = missingParts
        .filter(p => canActorModifyRepuesto(p, actor))
        .map(p => p.id)
      const unauthorizedMissingCount = missingParts.length - authorizedMissingIds.length

      if (unauthorizedMissingCount > 0) {
        report.skippedUnauthorizedParts += unauthorizedMissingCount
        report.errors.push({
          rowLabel: `Sincronización de familia (${runtimeSyncGrupo.nombre})`,
          message: `${unauthorizedMissingCount} repuesto(s) ausentes de otros usuarios o del administrador se conservaron por falta de permisos para eliminarlos.`
        })
      }

      if (authorizedMissingIds.length > 0) {
        options.onProgress?.(
          Math.max(totalSteps, 1),
          Math.max(totalSteps, 1),
          `Sincronizando familia: eliminando ${authorizedMissingIds.length} repuesto(s)...`
        )
        const syncRes = await catalogService.deleteRepuestosBulk(authorizedMissingIds)
        report.deletedParts += syncRes.deletedIds.length
        report.deletedPartIds.push(...syncRes.deletedIds)
        if (syncRes.failedIds.length > 0) {
          report.errors.push({
            rowLabel: `Sincronización de familia (${runtimeSyncGrupo.nombre})`,
            message: `${syncRes.failedIds.length} repuesto(s) no pudieron eliminarse${syncRes.errorMessage ? `: ${syncRes.errorMessage}` : ''}`
          })
        }
      }
    } catch (err) {
      report.errors.push({
        rowLabel: `Sincronización de familia (${options.syncTargetGrupo.nombre})`,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return report
}
