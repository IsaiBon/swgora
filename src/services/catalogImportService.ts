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

export type DuplicateStrategy = 'skip' | 'update' | 'create'
export type TemplateScope = 'general' | 'motors_only' | 'parts_only'

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

  // Mapear parámetros dinámicos definidos en la familia resuelta
  if (resolvedGrupo?.parametros) {
    for (const p of resolvedGrupo.parametros) {
      const val = pickField(norm, [p.clave, p.etiqueta, p.etiqueta_corta || ''])
      if (val !== undefined) {
        if (p.tipo_dato === 'numero') {
          const n = parseNumberValue(val)
          if (n !== null) dimensiones[p.clave] = n
        } else if (p.tipo_dato === 'booleano') {
          const s = String(val).trim().toLowerCase()
          dimensiones[p.clave] = s === 'si' || s === 'sí' || s === 'true' || s === '1'
        } else {
          dimensiones[p.clave] = String(val).trim()
        }
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

  // Anillos: soportar array JSON `anillos` O columnas planas anillo1_grosor..anillo_aceite_altura
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
      pickField(norm, ['espesor_aceite_mm', 'anillo_aceite_grosor', 'aceite_grosor', 'aceite_h1'])
    ) ?? parseNumberValue(dimensiones.espesor_aceite_mm)

  const disenosSet = new Set<string>(splitTokens(pickField(norm, ['disenos_anillo', 'disenos', 'diseno'])))
  if (Array.isArray(rawObj.disenos_anillo)) {
    for (const d of rawObj.disenos_anillo) {
      if (String(d || '').trim()) disenosSet.add(String(d).trim())
    }
  }

  let parsedRings: Array<Record<string, unknown>> = []
  const rawAnillosVal = rawObj.anillos ?? dimensiones.anillos ?? pickField(norm, ['anillos_json', 'anillos'])
  if (Array.isArray(rawAnillosVal)) {
    parsedRings = rawAnillosVal.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
  } else if (typeof rawAnillosVal === 'string' && rawAnillosVal.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(rawAnillosVal.trim())
      if (Array.isArray(arr)) parsedRings = arr
    } catch {
      // ignorar
    }
  }

  if (parsedRings.length === 0) {
    // Reconstruir arreglo anillos[] a partir de columnas planas de Excel/JSON si existen cotas
    const r1h = espesor_anillo1_mm
    const r1a = parseNumberValue(pickField(norm, ['anillo1_altura', 'anillo_1_altura', 'anillo1_a1', 'altura_radial1_mm']))
    const r1d = String(pickField(norm, ['anillo1_diseno', 'anillo_1_diseno', 'anillo1_perfil']) || '').trim()

    const r2h = espesor_anillo2_mm
    const r2a = parseNumberValue(pickField(norm, ['anillo2_altura', 'anillo_2_altura', 'anillo2_a1', 'altura_radial2_mm']))
    const r2d = String(pickField(norm, ['anillo2_diseno', 'anillo_2_diseno', 'anillo2_perfil']) || '').trim()

    const r3h = espesor_anillo3_mm
    const r3a = parseNumberValue(pickField(norm, ['anillo3_altura', 'anillo_3_altura', 'anillo3_a1', 'altura_radial3_mm']))
    const r3d = String(pickField(norm, ['anillo3_diseno', 'anillo_3_diseno', 'anillo3_perfil']) || '').trim()

    const rOilH = espesor_aceite_mm
    const rOilA = parseNumberValue(
      pickField(norm, ['anillo_aceite_altura', 'aceite_altura', 'aceite_a1', 'altura_radial_aceite_mm'])
    )
    const rOilD = String(pickField(norm, ['anillo_aceite_diseno', 'aceite_diseno', 'aceite_perfil']) || '').trim()

    if (r1h != null || r1a != null) {
      parsedRings.push({
        posicion: '1° Anillo',
        tipo_aro: 'fuego',
        d1: diametro_cilindro_mm,
        h1: r1h,
        a1: r1a,
        perfil: r1d || 'Plano',
        forma: r1d || 'Plano'
      })
      if (r1d) disenosSet.add(r1d)
    }
    if (r2h != null || r2a != null) {
      parsedRings.push({
        posicion: '2° Anillo',
        tipo_aro: 'compresion',
        d1: diametro_cilindro_mm,
        h1: r2h,
        a1: r2a,
        perfil: r2d || 'Plano',
        forma: r2d || 'Plano'
      })
      if (r2d) disenosSet.add(r2d)
    }
    if (r3h != null || r3a != null) {
      parsedRings.push({
        posicion: '3° Anillo',
        tipo_aro: 'compresion',
        d1: diametro_cilindro_mm,
        h1: r3h,
        a1: r3a,
        perfil: r3d || 'Plano',
        forma: r3d || 'Plano'
      })
      if (r3d) disenosSet.add(r3d)
    }
    if (rOilH != null || rOilA != null) {
      parsedRings.push({
        posicion: 'Anillo Aceite',
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
    // Asegurar sincronización de medidas planas desde el array anillos
    if (diametro_cilindro_mm == null && parsedRings[0]?.d1 != null) {
      diametro_cilindro_mm = parseNumberValue(parsedRings[0].d1)
    }
    if (espesor_anillo1_mm == null && parsedRings[0]?.h1 != null) {
      espesor_anillo1_mm = parseNumberValue(parsedRings[0].h1)
    }
    if (espesor_anillo2_mm == null && parsedRings.length >= 3 && parsedRings[1]?.h1 != null) {
      espesor_anillo2_mm = parseNumberValue(parsedRings[1].h1)
    }
    if (espesor_anillo3_mm == null && parsedRings.length >= 4 && parsedRings[2]?.h1 != null) {
      espesor_anillo3_mm = parseNumberValue(parsedRings[2].h1)
    }
    const lastRing = parsedRings[parsedRings.length - 1]
    if (espesor_aceite_mm == null && lastRing?.h1 != null) {
      espesor_aceite_mm = parseNumberValue(lastRing.h1)
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
// LECTURA DE ARCHIVOS EXCEL / CSV / JSON
// =============================================================================

export const parseCatalogJsonText = (
  jsonText: string,
  fileName: string,
  grupos: GrupoRepuesto[],
  defaultGrupo?: GrupoRepuesto | null
): CatalogImportParseResult => {
  const parsed = JSON.parse(jsonText) as unknown
  const motors: ParsedMotorRow[] = []
  const parts: ParsedPartRow[] = []
  const warnings: string[] = []

  if (Array.isArray(parsed)) {
    parsed.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return
      const obj = item as Record<string, unknown>
      const hasOem = obj.codigo_oem !== undefined || obj.oem !== undefined
      const looksLikeMotor =
        !hasOem &&
        (obj.cilindros !== undefined || obj.cilindrada_cc !== undefined || obj.codigo !== undefined)
      if (looksLikeMotor) {
        const m = parseMotorRowObject(obj, idx + 1, 'JSON')
        if (m) motors.push(m)
      } else {
        const p = parsePartRowObject(obj, idx + 1, 'JSON', grupos, defaultGrupo)
        if (p) parts.push(p)
      }
    })
  } else if (parsed && typeof parsed === 'object') {
    const root = parsed as Record<string, unknown>
    const rawMotors = Array.isArray(root.motores) ? root.motores : []
    const rawParts = Array.isArray(root.repuestos)
      ? root.repuestos
      : Array.isArray(root.partes)
        ? root.partes
        : Array.isArray(root.productos)
          ? root.productos
          : []

    rawMotors.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const m = parseMotorRowObject(item as Record<string, unknown>, idx + 1, 'JSON.motores')
        if (m) motors.push(m)
      }
    })
    rawParts.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const p = parsePartRowObject(item as Record<string, unknown>, idx + 1, 'JSON.repuestos', grupos, defaultGrupo)
        if (p) parts.push(p)
      }
    })

    if (rawMotors.length === 0 && rawParts.length === 0) {
      warnings.push('El objeto JSON no contiene arreglos "repuestos" ni "motores".')
    }
  } else {
    throw new Error('El JSON debe ser un arreglo [...] o un objeto con { "motores": [...], "repuestos": [...] }')
  }

  return { fileName, format: 'json', motors, parts, warnings }
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
  const motors: ParsedMotorRow[] = []
  const parts: ParsedPartRow[] = []
  const warnings: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const normSheet = normalizeKey(sheetName)
    // Ignorar la hoja informativa de instrucciones
    if (normSheet.includes('instruccion') || normSheet.includes('guia') || normSheet.includes('ayuda')) {
      continue
    }

    const ws = workbook.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    if (rows.length === 0) continue

    const isMotorsSheet =
      normSheet.includes('motor') && !normSheet.includes('anillo') && !normSheet.includes('repuesto')

    rows.forEach((row, idx) => {
      if (isMotorsSheet) {
        const m = parseMotorRowObject(row, idx + 2, sheetName)
        if (m) motors.push(m)
      } else {
        const p = parsePartRowObject(row, idx + 2, sheetName, grupos, defaultGrupo)
        if (p) parts.push(p)
      }
    })
  }

  if (motors.length === 0 && parts.length === 0) {
    warnings.push('No se encontraron filas con datos en el archivo Excel.')
  }

  return {
    fileName: file.name,
    format: 'excel',
    motors,
    parts,
    warnings
  }
}

// =============================================================================
// GENERACIÓN DE PLANTILLAS (EXCEL .xlsx Y JSON .json)
// =============================================================================

const buildSampleRowsForTemplate = (
  selectedGrupo?: GrupoRepuesto | null
): { partColumns: string[]; sampleParts: Array<Record<string, unknown>> } => {
  const isRings =
    selectedGrupo &&
    (selectedGrupo.codigo === 'anillos_motor' ||
      selectedGrupo.categoria.toLowerCase().includes('anillo') ||
      selectedGrupo.tipo_vista === 'tabla')

  const dynamicKeys = (selectedGrupo?.parametros || []).map(p => p.clave).filter(Boolean)

  if (isRings) {
    const partColumns = [
      'codigo_oem',
      'nombre',
      'familia',
      'subsistema',
      'fabricante',
      'motor',
      'modelos',
      'anio',
      'catalogo_origen',
      'equivalencias',
      'diametro_cilindro_mm',
      'anillo1_grosor',
      'anillo1_altura',
      'anillo1_diseno',
      'anillo2_grosor',
      'anillo2_altura',
      'anillo2_diseno',
      'anillo3_grosor',
      'anillo3_altura',
      'anillo_aceite_grosor',
      'anillo_aceite_altura',
      'anillo_aceite_diseno',
      'precio',
      'stock',
      'estado',
      'descripcion_tecnica'
    ]
    const sampleParts = [
      {
        codigo_oem: '13011-35041, 13011-35042',
        nombre: 'Juego Anillos Toyota 22R STD',
        familia: selectedGrupo?.codigo || 'anillos_motor',
        subsistema: selectedGrupo?.subsistema || 'Block',
        fabricante: 'Toyota',
        motor: '22R',
        modelos: 'Hilux, 4Runner',
        anio: '1985-1995',
        catalogo_origen: 'OEM',
        equivalencias: 'RIK: 34245; NPR: SWT-10150',
        diametro_cilindro_mm: 92.0,
        anillo1_grosor: 1.5,
        anillo1_altura: 3.6,
        anillo1_diseno: 'Cromado',
        anillo2_grosor: 1.5,
        anillo2_altura: 3.8,
        anillo2_diseno: 'Raspador',
        anillo3_grosor: '',
        anillo3_altura: '',
        anillo_aceite_grosor: 4.0,
        anillo_aceite_altura: 3.5,
        anillo_aceite_diseno: 'Plano',
        precio: 45.0,
        stock: 12,
        estado: 'Disponible',
        descripcion_tecnica: 'Juego estándar 4 cilindros'
      }
    ]
    return { partColumns, sampleParts }
  }

  if (selectedGrupo && dynamicKeys.length > 0) {
    const partColumns = [
      'codigo_oem',
      'nombre',
      'familia',
      'subsistema',
      'fabricante',
      'motor',
      'modelos',
      'anio',
      'catalogo_origen',
      'equivalencias',
      ...dynamicKeys,
      'precio',
      'stock',
      'estado',
      'descripcion_tecnica'
    ]
    const sampleObj: Record<string, unknown> = {
      codigo_oem: 'OEM-EJEMPLO-001',
      nombre: `${selectedGrupo.nombre} Ejemplo Toyota 22R`,
      familia: selectedGrupo.codigo,
      subsistema: selectedGrupo.subsistema || 'Culata',
      fabricante: 'Toyota',
      motor: '22R',
      modelos: 'Hilux, Dyna',
      anio: '1988-1998',
      catalogo_origen: 'OEM',
      equivalencias: 'DOKURO: DOK-101; AJUSA: AJ-202'
    }
    for (const p of selectedGrupo.parametros) {
      if (p.tipo_dato === 'numero') {
        sampleObj[p.clave] = p.clave.includes('vastago') ? 8.0 : p.clave.includes('cabeza') ? 45.0 : 10.5
      } else if (p.tipo_dato === 'booleano') {
        sampleObj[p.clave] = 'No'
      } else if (p.opciones && p.opciones.length > 0) {
        sampleObj[p.clave] = p.opciones[0]
      } else {
        sampleObj[p.clave] = 'Estándar'
      }
    }
    sampleObj.precio = 18.5
    sampleObj.stock = 8
    sampleObj.estado = 'Disponible'
    sampleObj.descripcion_tecnica = 'Registro de ejemplo generado por SWGORA'
    return { partColumns, sampleParts: [sampleObj] }
  }

  // Plantilla general universal
  const partColumns = [
    'codigo_oem',
    'nombre',
    'familia',
    'subsistema',
    'fabricante',
    'motor',
    'modelos',
    'anio',
    'catalogo_origen',
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
    'precio',
    'stock',
    'estado',
    'descripcion_tecnica'
  ]

  const sampleParts: Array<Record<string, unknown>> = [
    {
      codigo_oem: '13711-35050',
      nombre: 'Válvula de Admisión Toyota 22R',
      familia: 'valvula',
      subsistema: 'Culata',
      fabricante: 'Toyota',
      motor: '22R',
      modelos: 'Hilux, 4Runner',
      anio: '1985-1995',
      catalogo_origen: 'DOKURO',
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
      precio: 14.5,
      stock: 16,
      estado: 'Disponible',
      descripcion_tecnica: 'Acero templado 1 ranura'
    },
    {
      codigo_oem: '13011-35041',
      nombre: 'Juego Anillos Toyota 22R STD',
      familia: 'anillos_motor',
      subsistema: 'Block',
      fabricante: 'Toyota',
      motor: '22R',
      modelos: 'Hilux, 4Runner',
      anio: '1985-1995',
      catalogo_origen: 'OEM',
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
      precio: 45.0,
      stock: 10,
      estado: 'Disponible',
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

export const downloadCatalogExcelTemplate = (
  grupos: GrupoRepuesto[],
  scope: TemplateScope = 'general',
  selectedGrupo?: GrupoRepuesto | null
) => {
  const wb = XLSX.utils.book_new()

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

  // Hoja de Instrucciones adaptada al tipo de plantilla (Obligatorios primero, luego Opcionales)
  const motorInstructions: Array<{ Campo_o_Regla: string; Descripcion: string }> = [
    {
      Campo_o_Regla: '=== HOJA MOTORES: CAMPOS OBLIGATORIOS ===',
      Descripcion: 'El sistema asigna automáticamente el id interno (numero_id); no debe ingresarlo en la plantilla.'
    },
    {
      Campo_o_Regla: 'fabricante [Obligatorio]',
      Descripcion: 'Nombre de la marca automotriz (ej: Toyota, Nissan). Si no existe, puede crearse automáticamente al importar.'
    },
    {
      Campo_o_Regla: 'codigo [Obligatorio]',
      Descripcion: 'Código técnico del motor (ej: 22R, 1KD-FTV, Z24).'
    },
    {
      Campo_o_Regla: '=== HOJA MOTORES: CAMPOS OPCIONALES ===',
      Descripcion: 'Complete solo los datos técnicos disponibles; las columnas están ordenadas después de los obligatorios.'
    },
    {
      Campo_o_Regla: 'modelos [Opcional]',
      Descripcion: 'Lista real de modelos de vehículo separados por coma (ej: Hilux, 4Runner). Alimenta el selector/filtro desplegable "Modelo" y enlaza el motor con cada vehículo.'
    },
    {
      Campo_o_Regla: 'denominacion_venta [Opcional]',
      Descripcion: 'Texto comercial descriptivo o línea/serie (ej: "Serie Pick Up / Comercial", "B Series") que se muestra en la columna "Denominación de venta" de la tabla. Si se deja vacío, toma los modelos.'
    },
    {
      Campo_o_Regla: 'anios / combustible / cilindros / cilindrada_cc [Opcional]',
      Descripcion: 'Años (ej: 1985-1995), combustible (Gasolina/Diésel) y valores numéricos del bloque (4 cilindros, 2366 cc, etc.).'
    }
  ]

  const partInstructions: Array<{ Campo_o_Regla: string; Descripcion: string }> = [
    {
      Campo_o_Regla: '=== HOJA REPUESTOS: CAMPOS OBLIGATORIOS ===',
      Descripcion: 'Las columnas obligatorias van al inicio de la hoja.'
    },
    {
      Campo_o_Regla: 'codigo_oem [Obligatorio]',
      Descripcion: 'Código OEM principal. Si hay varios, sepárelos por coma (ej: 13011-35041, 13011-35042).'
    },
    {
      Campo_o_Regla: '=== HOJA REPUESTOS: CAMPOS OPCIONALES ===',
      Descripcion: 'Si se omiten, el sistema aplica valores por defecto o deja la medida en blanco.'
    },
    {
      Campo_o_Regla: 'nombre [Opcional]',
      Descripcion: 'Nombre del repuesto. Si se deja vacío, SWGORA lo genera automáticamente con marca, modelo, familia y OEM.'
    },
    {
      Campo_o_Regla: 'familia / subsistema [Opcional]',
      Descripcion: 'Código o nombre exacto de la familia (ver lista abajo). Si se omite, usará la familia elegida al importar.'
    },
    {
      Campo_o_Regla: 'fabricante / motor / modelos / anio [Opcional]',
      Descripcion: 'Marca, código de motor y modelos separados por coma. Si activa "Crear faltantes", el sistema los registrará y enlazará.'
    },
    {
      Campo_o_Regla: 'equivalencias [Opcional]',
      Descripcion: 'Códigos alternos en formato "MARCA: CODIGO; MARCA2: CODIGO2" (ej: RIK: 34245; NPR: SWT-10150) o en columnas codigo_rik, codigo_dokuro, etc.'
    },
    {
      Campo_o_Regla: 'Medidas técnicas [Opcional]',
      Descripcion: 'En Anillos use diametro_cilindro_mm, anillo1_grosor, anillo1_altura, anillo2_grosor, anillo2_altura, anillo3_grosor, anillo_aceite_grosor, anillo_aceite_altura.'
    }
  ]

  const instructionsRows: Array<{ Campo_o_Regla: string; Descripcion: string }> = []
  if (scope !== 'parts_only') instructionsRows.push(...motorInstructions)
  if (scope !== 'motors_only') {
    instructionsRows.push(
      ...partInstructions,
      { Campo_o_Regla: '--- FAMILIAS DISPONIBLES EN SWGORA ---', Descripcion: '' },
      ...grupos.map(g => ({
        Campo_o_Regla: `${g.codigo} (${g.nombre})`,
        Descripcion: `Categoría: ${g.categoria} | Parámetros: ${(g.parametros || []).map(p => `${p.clave}${p.unidad ? ` [${p.unidad}]` : ''}`).join(', ') || 'Estándar'}`
      }))
    )
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
    modelos: ['Hilux', '4Runner']
  }

  let payload: Record<string, unknown>
  let filename: string

  if (scope === 'motors_only') {
    payload = {
      _instrucciones: {
        nota: 'Plantilla específica SOLO para importar Motores (numero_id lo gestiona el sistema). Orden: primero campos obligatorios y luego opcionales.',
        campos_obligatorios: ['fabricante', 'codigo'],
        campos_opcionales: MOTOR_TEMPLATE_COLUMNS.slice(2),
        diferencia_modelos_vs_denominacion: {
          modelos: 'Arreglo de modelos reales enlazados al filtro desplegable "Modelo" (ej: ["Hilux", "4Runner"]).',
          denominacion_venta: 'Texto comercial/serie mostrado en la tabla de motores (ej: "Serie Pick Up / Comercial").'
        }
      },
      motores: [motorSampleObj]
    }
    filename = 'plantilla_solo_motores_swgora.json'
  } else {
    const { partColumns, sampleParts } = buildSampleRowsForTemplate(
      scope === 'parts_only' ? selectedGrupo : null
    )
    const formattedParts = sampleParts.map(p => ({
      ...p,
      modelos: ['Hilux', '4Runner'],
      equivalencias: [
        { marca_alterna: 'RIK', codigo_alterno: '34245' },
        { marca_alterna: 'NPR', codigo_alterno: 'SWT-10150' }
      ]
    }))

    if (scope === 'parts_only') {
      payload = {
        _instrucciones: {
          nota: selectedGrupo
            ? `Plantilla específica para repuestos de la familia "${selectedGrupo.nombre}". Orden: primero campos obligatorios y luego opcionales.`
            : 'Plantilla específica SOLO para repuestos (todas las medidas estándar). Orden: primero campos obligatorios y luego opcionales.',
          campos_obligatorios: ['codigo_oem'],
          campos_opcionales: partColumns.slice(1),
          familia_seleccionada: selectedGrupo ? selectedGrupo.codigo : 'todas',
          familias_disponibles: grupos.map(g => ({
            codigo: g.codigo,
            nombre: g.nombre,
            categoria: g.categoria,
            parametros: (g.parametros || []).map(p => p.clave)
          }))
        },
        repuestos: formattedParts
      }
      filename = selectedGrupo
        ? `plantilla_repuestos_${selectedGrupo.codigo}.json`
        : 'plantilla_solo_repuestos_swgora.json'
    } else {
      payload = {
        _instrucciones: {
          nota: 'Plantilla general completa: incluye motores y repuestos en un mismo archivo. Orden: primero campos obligatorios y luego opcionales.',
          motores_obligatorios: ['fabricante', 'codigo'],
          motores_opcionales: MOTOR_TEMPLATE_COLUMNS.slice(2),
          repuestos_obligatorios: ['codigo_oem'],
          repuestos_opcionales: partColumns.slice(1),
          familias_disponibles: grupos.map(g => ({
            codigo: g.codigo,
            nombre: g.nombre,
            categoria: g.categoria,
            parametros: (g.parametros || []).map(p => p.clave)
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
    fabricantes: Fabricante[]
    modelos: Modelo[]
    motores: Motor[]
    repuestos: RepuestoTecnico[]
  }
): Promise<CatalogImportReport> => {
  const report: CatalogImportReport = {
    createdMotors: 0,
    skippedMotors: 0,
    createdParts: 0,
    updatedParts: 0,
    skippedParts: 0,
    createdBrands: 0,
    createdModels: 0,
    errors: []
  }

  const validMotors = parsed.motors.filter(m => m.status !== 'error')
  const validParts = parsed.parts.filter(p => p.status !== 'error')
  const totalSteps = validMotors.length + validParts.length
  let currentStep = 0

  const fabList = [...context.fabricantes]
  const modList = [...context.modelos]
  const motList = [...context.motores]
  const oemIndex = await loadExistingOemIndex(context.repuestos)

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

      const partPayload: Partial<RepuestoTecnico> = {
        motor_id: resolvedMotor?.id,
        codigo_oem: pRow.codigo_oem,
        codigos_oem_adicionales: pRow.codigos_oem_adicionales,
        nombre: pRow.nombre,
        subsistema: pRow.subsistema,
        categoria: pRow.categoria,
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
