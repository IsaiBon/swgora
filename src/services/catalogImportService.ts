import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import {
  catalogService,
  normalizeText,
  type Fabricante,
  type GrupoRepuesto,
  type Modelo,
  type Motor,
  type RepuestoTecnico
} from './catalogService'
import {
  convertTemplateToGrupoInsert,
  type FamilyTemplate,
  type TemplateColumnDef
} from '@/components/catalog/FamilyTemplates'

export type DuplicateStrategy = 'skip' | 'update' | 'create'
export type TemplateScope = 'general' | 'motors_only' | 'parts_only' | 'families_only'

export interface ParsedFamilyRow {
  rowIndex: number
  sheetName: string
  codigo: string
  nombre: string
  categoria: string
  subsistema: string
  descripcion?: string
  icono: string
  tipo_vista: 'normal' | 'tabla'
  titulo_primera_columna?: string
  titulo_grupo_filas?: string
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
}

export interface CatalogImportOptions {
  defaultGrupo?: GrupoRepuesto | null
  duplicateStrategy: DuplicateStrategy
  autoCreateEntities: boolean
  onProgress?: (current: number, total: number, label: string) => void
}

export interface CatalogImportReport {
  createdFamilies: number
  updatedFamilies: number
  skippedFamilies: number
  createdMotors: number
  skippedMotors: number
  createdParts: number
  updatedParts: number
  skippedParts: number
  createdBrands: number
  createdModels: number
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
  const imagen_url = String(pickField(norm, ['imagen_url', 'foto', 'imagen']) || '').trim() || undefined

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

  return {
    rowIndex,
    sheetName,
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

  const tablaCfg = (rawObj.tabla_config && typeof rawObj.tabla_config === 'object'
    ? (rawObj.tabla_config as Record<string, unknown>)
    : null)

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

  const combinedCols: TemplateColumnDef[] = [...inlineCols, ...extraColumns]
  if (hasExplicitColHeader && singleRowCol) {
    combinedCols.push(singleRowCol)
  }

  const messages: string[] = []
  let status: ParsedFamilyRow['status'] = 'valid'

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

  return {
    rowIndex,
    sheetName,
    codigo,
    nombre,
    categoria,
    subsistema,
    descripcion,
    icono,
    tipo_vista,
    titulo_primera_columna,
    titulo_grupo_filas,
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
  const rawPartsCollected: ParsedPartRow[] = []
  const warnings: string[] = []

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
          const p = parsePartRowObject(obj, idx + 1, 'JSON', grupos, defaultGrupo)
          if (p) rawPartsCollected.push(p)
        }
      })
    } else if (parsed && typeof parsed === 'object') {
      const root = parsed as Record<string, unknown>
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
          const p = parsePartRowObject(item as Record<string, unknown>, idx + 1, 'JSON.repuestos', grupos, defaultGrupo)
          if (p) rawPartsCollected.push(p)
        }
      })

      if (payloads.length === 1 && rawFamilies.length === 0 && rawMotors.length === 0 && rawParts.length === 0) {
        warnings.push('El objeto JSON no contiene arreglos "familias", "repuestos" ni "motores".')
      }
    }
  }

  const parts = filterPlaceholderSampleParts(rawPartsCollected)
  if (families.length === 0 && motors.length === 0 && parts.length === 0 && warnings.length === 0) {
    warnings.push('No se encontraron registros válidos en el JSON proporcionado.')
  }

  return { fileName, format: 'json', families, motors, parts, warnings }
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
  const familySheetNames = new Set<string>()
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
        const famKey = normalizeText(String(pickField(norm, ['familia', 'nombre_familia', 'grupo']) || ''))
        const colDef = parseColumnDefFromObject(row)
        if (famKey && colDef) {
          const arr = columnsByFamilyKey.get(famKey) || []
          arr.push(colDef)
          columnsByFamilyKey.set(famKey, arr)
        }
      }
    } else if (normSheet.includes('familia') || normSheet.includes('grupo')) {
      familySheetNames.add(sheetName)
    }
  }

  // 2. Procesar todas las hojas del libro
  for (const sheetName of workbook.SheetNames) {
    const normSheet = normalizeKey(sheetName)
    // Ignorar hojas de instrucciones o hojas auxiliares de columnas ya procesadas
    if (
      normSheet.includes('instruccion') ||
      normSheet.includes('guia') ||
      normSheet.includes('ayuda') ||
      columnSheetNames.has(sheetName)
    ) {
      continue
    }

    const ws = workbook.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    if (rows.length === 0) continue

    if (familySheetNames.has(sheetName)) {
      const groupedByNombre = new Map<string, ParsedFamilyRow>()
      rows.forEach((row: Record<string, unknown>, idx: number) => {
        const parsedRow = buildParsedFamilyRow(row, idx + 2, sheetName)
        if (!parsedRow) return
        const famKey = normalizeText(parsedRow.nombre || `row_${idx}`)
        const existing = groupedByNombre.get(famKey)
        if (existing) {
          const newCols = parsedRow.columnas.filter(
            c => !(parsedRow.messages.some(m => m.includes('Sin columnas')) && c.etiqueta === 'Medida 1')
          )
          existing.columnas.push(...newCols)
          if (existing.filas.length === 0 && parsedRow.filas.length > 0) {
            existing.filas = parsedRow.filas
            existing.tipo_vista = parsedRow.tipo_vista
          }
        } else {
          const extraCols = famKey ? columnsByFamilyKey.get(famKey) || [] : []
          if (extraCols.length > 0) {
            // Reemplazar columna placeholder si las columnas venían en hoja Columnas_Familia
            const hasPlaceholder = parsedRow.messages.some(m => m.includes('Sin columnas'))
            if (hasPlaceholder) {
              parsedRow.columnas = [...extraCols]
              parsedRow.messages = parsedRow.messages.filter(m => !m.includes('Sin columnas'))
              if (parsedRow.messages.length === 0 && parsedRow.nombre) {
                parsedRow.status = 'valid'
              }
            } else {
              parsedRow.columnas.push(...extraCols)
            }
          }
          groupedByNombre.set(famKey, parsedRow)
        }
      })
      families.push(...groupedByNombre.values())
      continue
    }

    const isMotorsSheet =
      normSheet.includes('motor') && !normSheet.includes('anillo') && !normSheet.includes('repuesto')

    rows.forEach((row: Record<string, unknown>, idx: number) => {
      if (isMotorsSheet) {
        const m = parseMotorRowObject(row, idx + 2, sheetName)
        if (m) motors.push(m)
      } else {
        const p = parsePartRowObject(row, idx + 2, sheetName, grupos, defaultGrupo)
        if (p) parts.push(p)
      }
    })
  }

  const filteredParts = filterPlaceholderSampleParts(parts)

  if (families.length === 0 && motors.length === 0 && filteredParts.length === 0) {
    warnings.push('No se encontraron filas con datos en el archivo Excel.')
  }

  return {
    fileName: file.name,
    format: 'excel',
    families,
    motors,
    parts: filteredParts,
    warnings
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
// EJECUCIÓN DE IMPORTACIÓN MASIVA EN SUPABASE + STORE LOCAL
// =============================================================================

async function loadExistingOemIndex(inMemoryParts: RepuestoTecnico[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const p of inMemoryParts) {
    if (p.codigo_oem) {
      map.set(p.codigo_oem.trim().toUpperCase(), p.id)
    }
  }
  try {
    const { data, error } = await supabase.from('repuestos_tecnicos').select('id, codigo_oem')
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const oem = String(row.codigo_oem || '').trim().toUpperCase()
        if (oem && !map.has(oem)) {
          map.set(oem, String(row.id))
        }
      }
    }
  } catch (err) {
    console.warn('[ImportService] No se pudo consultar índice OEM remoto, usando caché local:', err)
  }
  return map
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
    skippedFamilies: 0,
    createdMotors: 0,
    skippedMotors: 0,
    createdParts: 0,
    updatedParts: 0,
    skippedParts: 0,
    createdBrands: 0,
    createdModels: 0,
    errors: []
  }

  const validFamilies = (parsed.families || []).filter(f => f.status !== 'error')
  const validMotors = parsed.motors.filter(m => m.status !== 'error')
  const validParts = parsed.parts.filter(p => p.status !== 'error')
  const totalSteps = validFamilies.length + validMotors.length + validParts.length
  let currentStep = 0

  const gruposList = [...(context.grupos || [])]
  const fabList = [...context.fabricantes]
  const modList = [...context.modelos]
  const motList = [...context.motores]
  const oemIndex = await loadExistingOemIndex(context.repuestos)

  // 0. Procesar Familias Técnicas nuevas o por actualizar
  for (const fRow of validFamilies) {
    currentStep++
    options.onProgress?.(currentStep, totalSteps, `Familia ${fRow.nombre}`)
    try {
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
                titulo_primera_columna: fRow.titulo_primera_columna || 'Componente',
                ...(fRow.titulo_grupo_filas ? { titulo_grupo_filas: fRow.titulo_grupo_filas } : {}),
                modo_filas: 'subfilas' as const,
                subfilas_activas: true,
                subfilas:
                  fRow.filas.length > 0 ? fRow.filas.map(r => r.nombre) : ['Componente 1'],
                subfila_padres:
                  fRow.filas.length > 0 ? fRow.filas.map(r => r.grupo_central || '') : [''],
                subfila_tipos:
                  fRow.filas.length > 0 ? fRow.filas.map(r => r.tipo_fila) : ['normal']
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

      const normName = normalizeText(fRow.nombre)
      const normCode = normalizeText(insertPayload.codigo || fRow.codigo)
      const existingIdx = gruposList.findIndex(
        g => normalizeText(g.codigo) === normCode || normalizeText(g.nombre) === normName
      )
      const existing = existingIdx >= 0 ? gruposList[existingIdx] : undefined

      if (existing) {
        if (options.duplicateStrategy === 'skip') {
          report.skippedFamilies++
          continue
        }
        if (options.duplicateStrategy === 'update') {
          const updated = await catalogService.updateGrupo(existing.id, insertPayload)
          gruposList[existingIdx] = updated
          report.updatedFamilies++
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

  const resolveOrCreateFabricante = async (name: string): Promise<Fabricante | undefined> => {
    const clean = name.trim()
    if (!clean) return undefined
    const normTarget = normalizeText(clean)
    const found = fabList.find(f => normalizeText(f.nombre) === normTarget)
    if (found) return found
    if (!options.autoCreateEntities) return undefined
    const created = await catalogService.createFabricante({ nombre: clean })
    fabList.push(created)
    report.createdBrands++
    return created
  }

  const resolveOrCreateModelIds = async (fabId: string, modelNames: string[]): Promise<string[]> => {
    const ids: string[] = []
    for (const rawName of modelNames) {
      const clean = rawName.replace(/\s+/g, ' ').trim()
      if (!clean) continue
      const normTarget = normalizeText(clean)
      let found = modList.find(m => m.fabricante_id === fabId && normalizeText(m.nombre) === normTarget)
      if (!found && options.autoCreateEntities) {
        found = await catalogService.createModelo(fabId, clean)
        modList.push(found)
        report.createdModels++
      }
      if (found) ids.push(found.id)
    }
    return Array.from(new Set(ids))
  }

  const findExistingMotor = (codigo: string, fabId?: string): Motor | undefined => {
    const normCode = normalizeText(codigo)
    return motList.find(
      m => normalizeText(m.codigo) === normCode && (!fabId || m.fabricante_id === fabId)
    )
  }

  // 1. Procesar Motores
  for (const mRow of validMotors) {
    currentStep++
    options.onProgress?.(currentStep, totalSteps, `Motor ${mRow.fabricante} ${mRow.codigo}`)
    try {
      const fab = await resolveOrCreateFabricante(mRow.fabricante)
      if (!fab) {
        report.skippedMotors++
        report.errors.push({
          rowLabel: `${mRow.sheetName} fila ${mRow.rowIndex}`,
          message: `Fabricante "${mRow.fabricante}" no encontrado (active creación automática para registrarlo)`
        })
        continue
      }

      const existing = findExistingMotor(mRow.codigo, fab.id)
      if (existing) {
        report.skippedMotors++
        continue
      }

      const modeloIds = await resolveOrCreateModelIds(fab.id, mRow.modelos)
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
      motList.unshift(createdMotor)
      report.createdMotors++
    } catch (err) {
      report.errors.push({
        rowLabel: `${mRow.sheetName} fila ${mRow.rowIndex} (${mRow.codigo})`,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  // 2. Procesar Repuestos
  for (const pRow of validParts) {
    currentStep++
    options.onProgress?.(currentStep, totalSteps, `Repuesto ${pRow.codigo_oem}`)
    try {
      const existingPartId = oemIndex.get(pRow.codigo_oem.toUpperCase())
      if (existingPartId && options.duplicateStrategy === 'skip') {
        report.skippedParts++
        continue
      }

      // Resolver fabricante / motor / modelos si vienen en la fila
      let resolvedMotor: Motor | undefined
      if (pRow.motorCodigo) {
        const fab = pRow.fabricante ? await resolveOrCreateFabricante(pRow.fabricante) : undefined
        resolvedMotor = findExistingMotor(pRow.motorCodigo, fab?.id)
        if (!resolvedMotor && fab && options.autoCreateEntities) {
          const modeloIds = await resolveOrCreateModelIds(fab.id, pRow.modelos)
          resolvedMotor = await catalogService.createMotor({
            fabricante_id: fab.id,
            codigo: pRow.motorCodigo,
            modelo_id: modeloIds[0],
            modelo_ids: modeloIds,
            modelos_nombres: pRow.modelos,
            combustible: 'Diésel',
            cilindros: 4,
            valvulas: 8
          })
          motList.unshift(resolvedMotor)
          report.createdMotors++
        } else if (resolvedMotor && fab && pRow.modelos.length > 0 && options.autoCreateEntities) {
          await resolveOrCreateModelIds(fab.id, pRow.modelos)
        }
      }

      // Re-enlazar categoría/subsistema si corresponde a una familia recién importada en el mismo archivo
      const matchedRuntimeGroup = pRow.familiaRaw
        ? resolveGrupoMatch(pRow.familiaRaw, gruposList, options.defaultGrupo)
        : resolveGrupoMatch(pRow.categoria, gruposList, options.defaultGrupo)
      const resolvedPartCategoria = matchedRuntimeGroup?.categoria || pRow.categoria
      const resolvedPartSubsistema = pRow.subsistema && pRow.subsistema !== 'Motor'
        ? pRow.subsistema
        : (matchedRuntimeGroup?.subsistema || pRow.subsistema)

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
        imagen_url: pRow.imagen_url,
        imagenes: pRow.imagen_url ? [pRow.imagen_url] : [],
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
        dimensiones: {
          ...pRow.dimensiones,
          codigos_oem_adicionales: pRow.codigos_oem_adicionales
        },
        especificaciones_tecnicas: {
          codigos_oem_adicionales: pRow.codigos_oem_adicionales,
          marca: pRow.fabricante ? pRow.fabricante.toUpperCase() : undefined,
          modelos: pRow.modelos,
          modelo: pRow.modelos.join(' / ') || undefined,
          ano: pRow.anio,
          catalogo_origen: pRow.catalogo_origen,
          disenos_anillo: pRow.disenos_anillo,
          descripcion_tecnica: pRow.descripcion_tecnica
        }
      }

      if (existingPartId && options.duplicateStrategy === 'update') {
        await catalogService.updateRepuesto(existingPartId, partPayload, pRow.equivalencias)
        report.updatedParts++
      } else {
        const created = await catalogService.createRepuesto(partPayload, pRow.equivalencias)
        oemIndex.set(created.codigo_oem.toUpperCase(), created.id)
        report.createdParts++
      }
    } catch (err) {
      report.errors.push({
        rowLabel: `${pRow.sheetName} fila ${pRow.rowIndex} (${pRow.codigo_oem})`,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return report
}
