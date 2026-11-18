import type { Order } from '@/services/ordersService'
import type { TallerInfo } from '@/services/tallerService'

export type WhatsAppMessagePreset = 'detailed' | 'executive' | 'pdf_companion'

export interface WhatsAppMessageOptions {
  preset: WhatsAppMessagePreset
  includeItemPrices: boolean
  includeBlockSubtotals: boolean
  includeStatus: boolean
  includeObservations: boolean
  includeTallerContact: boolean
  customNote?: string
  pdfUrl?: string
}

/**
 * Verifica si el navegador/dispositivo actual soporta envío nativo de archivos PDF (Web Share API Level 2).
 */
export function canNativeSharePdfFiles(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false
  }
  try {
    const dummy = new File(['%PDF-1.4'], 'documento.pdf', { type: 'application/pdf' })
    return navigator.canShare({ files: [dummy] })
  } catch {
    return false
  }
}

export interface CountryDialOption {
  code: string
  label: string
  expectedLocalDigits: number
}

export interface ParsedPhoneResult {
  countryCode: string
  localNumber: string
  fullDigits: string
}

export interface ShareOrderItem {
  id: string
  quantity: number
  description: string
  detail?: string
  unitPrice: number
  subtotal: number
}

export interface ShareOrderSection {
  title: string
  items: ShareOrderItem[]
  subtotal: number
}

export interface OrderShareBreakdown {
  sections: ShareOrderSection[]
  materials: string[]
  totalItemsCount: number
  hasIva: boolean
  ivaPct: number
  subtotal: number
  iva: number
  grandTotal: number
}

/** Límite seguro de longitud total de URL para redirecciones wa.me en navegadores y móviles */
export const WA_ME_SAFE_URL_LIMIT = 3500

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { code: '503', label: '+503 · El Salvador', expectedLocalDigits: 8 },
  { code: '502', label: '+502 · Guatemala', expectedLocalDigits: 8 },
  { code: '504', label: '+504 · Honduras', expectedLocalDigits: 8 },
  { code: '505', label: '+505 · Nicaragua', expectedLocalDigits: 8 },
  { code: '506', label: '+506 · Costa Rica', expectedLocalDigits: 8 },
  { code: '507', label: '+507 · Panamá', expectedLocalDigits: 8 },
  { code: '52', label: '+52 · México', expectedLocalDigits: 10 },
  { code: '1', label: '+1 · EE.UU. / Canadá', expectedLocalDigits: 10 },
  { code: '34', label: '+34 · España', expectedLocalDigits: 9 },
  { code: '57', label: '+57 · Colombia', expectedLocalDigits: 10 },
  { code: '', label: 'Otro / Código completo', expectedLocalDigits: 8 },
]

const SECTION_ORDER_MAP: Record<string, number> = {
  BIELAS: 1,
  BANCADA: 2,
  BANCADAS: 2,
  'CIGÜEÑAL': 3,
  CULATA: 4,
  BLOCKS: 5,
  BLOCK: 5,
  REPUESTOS: 6,
}

const KNOWN_CODES_DESC = COUNTRY_DIAL_OPTIONS
  .filter((c) => c.code.length > 0)
  .sort((a, b) => b.code.length - a.code.length)

/** Extrae únicamente los dígitos numéricos de una cadena telefónica. */
export function extractPhoneDigits(raw?: string | null): string {
  return (raw || '').replace(/\D/g, '')
}

/**
 * Resuelve los dígitos internacionales finales (formato E.164 sin '+')
 * combinando el código de país seleccionado y el número ingresado.
 */
export function resolveWaPhoneDigits(countryCode: string, localInput: string): string {
  const trimmed = (localInput || '').trim()
  if (!trimmed) return ''

  // Si el usuario escribió explícitamente '+' o '00', respetar el código internacional completo
  if (trimmed.startsWith('+')) {
    return extractPhoneDigits(trimmed)
  }
  if (trimmed.startsWith('00')) {
    return extractPhoneDigits(trimmed.slice(2))
  }

  const digits = extractPhoneDigits(trimmed)
  if (!digits) return ''
  if (!countryCode) return digits

  const matchedOpt = COUNTRY_DIAL_OPTIONS.find((c) => c.code === countryCode)
  const expectedTotalWithCode = countryCode.length + (matchedOpt?.expectedLocalDigits ?? 8)

  if (digits.startsWith(countryCode) && digits.length >= expectedTotalWithCode) {
    return digits
  }

  return `${countryCode}${digits}`
}

/**
 * Analiza un teléfono guardado (local o internacional) para prellenar el selector de país y número.
 */
export function parsePhoneForWhatsApp(
  rawPhone?: string | null,
  defaultCountryCode = '503'
): ParsedPhoneResult {
  const trimmed = (rawPhone || '').trim()
  if (!trimmed) {
    return {
      countryCode: defaultCountryCode,
      localNumber: '',
      fullDigits: '',
    }
  }

  const hasExplicitIntlPrefix = trimmed.startsWith('+') || trimmed.startsWith('00')
  const rawDigits = hasExplicitIntlPrefix && trimmed.startsWith('00')
    ? extractPhoneDigits(trimmed.slice(2))
    : extractPhoneDigits(trimmed)

  if (!rawDigits) {
    return {
      countryCode: defaultCountryCode,
      localNumber: '',
      fullDigits: '',
    }
  }

  if (hasExplicitIntlPrefix) {
    for (const opt of KNOWN_CODES_DESC) {
      if (rawDigits.startsWith(opt.code) && rawDigits.length >= opt.code.length + 7) {
        return {
          countryCode: opt.code,
          localNumber: rawDigits.slice(opt.code.length),
          fullDigits: rawDigits,
        }
      }
    }
    return {
      countryCode: '',
      localNumber: rawDigits,
      fullDigits: rawDigits,
    }
  }

  // Número sin prefijo '+' pero ya incluye código de país (ej. 50378312641)
  const defaultOpt = COUNTRY_DIAL_OPTIONS.find((c) => c.code === defaultCountryCode)
  const expectedLen = defaultCountryCode.length + (defaultOpt?.expectedLocalDigits ?? 8)
  if (
    defaultCountryCode &&
    rawDigits.startsWith(defaultCountryCode) &&
    rawDigits.length === expectedLen
  ) {
    return {
      countryCode: defaultCountryCode,
      localNumber: rawDigits.slice(defaultCountryCode.length),
      fullDigits: rawDigits,
    }
  }

  return {
    countryCode: defaultCountryCode,
    localNumber: trimmed,
    fullDigits: resolveWaPhoneDigits(defaultCountryCode, trimmed),
  }
}

/** Verifica si un número en dígitos es válido para wa.me (E.164: 8 a 15 dígitos). */
export function isValidWaPhoneDigits(digits: string): boolean {
  const clean = extractPhoneDigits(digits)
  return clean.length >= 8 && clean.length <= 15
}

/** Formatea dígitos internacionales para mostrar al operador en vista previa (ej. +503 7831 2641). */
export function formatWaPhonePreview(digits: string): string {
  const clean = extractPhoneDigits(digits)
  if (!clean) return ''
  for (const opt of KNOWN_CODES_DESC) {
    if (clean.startsWith(opt.code) && clean.length > opt.code.length) {
      const rest = clean.slice(opt.code.length)
      if (rest.length === 8) {
        return `+${opt.code} ${rest.slice(0, 4)}-${rest.slice(4)}`
      }
      return `+${opt.code} ${rest}`
    }
  }
  return `+${clean}`
}

/** Construye la URL oficial de wa.me con teléfono opcional y texto codificado. */
export function buildWaMeUrl(phoneDigits: string, message: string): string {
  const cleanDigits = extractPhoneDigits(phoneDigits)
  const base = cleanDigits ? `https://wa.me/${cleanDigits}` : 'https://wa.me/'
  const trimmedMsg = (message || '').trim()
  if (!trimmedMsg) return base
  return `${base}?text=${encodeURIComponent(trimmedMsg)}`
}

function escapeWaInline(text: string): string {
  return (text || '').replace(/\*/g, '·').trim()
}

function normalizeSectionTitle(cat: string): string {
  const upper = (cat || '').trim().toUpperCase()
  if (upper.includes('BIELA')) return 'BIELAS'
  if (upper.includes('BANCADA')) return 'BANCADA'
  if (upper.includes('CIGÜEÑAL') || upper.includes('CIGUENAL')) return 'CIGÜEÑAL'
  if (upper.includes('CULATA')) return 'CULATA'
  if (upper.includes('BLOCK')) return 'BLOCKS'
  if (upper.includes('REPUESTO')) return 'REPUESTOS'
  return upper || 'OPERACIONES'
}

function isValveTypeOperation(opName: string): boolean {
  const lower = (opName || '').toLowerCase()
  return (
    (lower.includes('guías') || lower.includes('guias')) &&
    (lower.includes('adapte') || lower.includes('válvula') || lower.includes('valvula'))
  )
}

/** Formatea fecha YYYY-MM-DD a DD/MM/YYYY para lectura amigable en chat. */
export function formatOrderDateForShare(dateStr?: string): string {
  if (!dateStr) return '--/--/----'
  const raw = dateStr.split('T')[0]
  const parts = raw.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return raw
}

/** Construye una etiqueta limpia de vehículo y motor sin duplicar la marca. */
export function formatVehicleEngineLabel(order: Order): string {
  const brand = (order.vehicleBrand || '').trim()
  const modelOrEngine = (order.vehicleModel || order.engine || order.engineType || '').trim()

  let combined = ''
  if (brand && modelOrEngine) {
    combined = modelOrEngine.toLowerCase().startsWith(brand.toLowerCase())
      ? modelOrEngine
      : `${brand} ${modelOrEngine}`
  } else {
    combined = brand || modelOrEngine
  }

  if (order.vehicleYear && combined && !combined.includes(order.vehicleYear)) {
    combined = `${combined} (${order.vehicleYear})`
  }

  return combined || 'Motor de banco'
}

/**
 * Agrupa operaciones, repuestos, materiales y totales usando las mismas reglas
 * del documento imprimible (Clean Print).
 */
export function buildOrderShareBreakdown(
  order: Order,
  tallerInfo?: Partial<TallerInfo> | null
): OrderShareBreakdown {
  const sectionsMap = new Map<string, ShareOrderItem[]>()

  for (const op of order.operations || []) {
    const qty = Number(op.quantity) || 0
    const price = Number(op.unitPrice) || 0
    const subtotal = Number(op.subtotal) || 0
    if (qty <= 0 || (price <= 0 && subtotal <= 0)) continue

    const title = normalizeSectionTitle(op.category)
    const items = sectionsMap.get(title) || []

    let detail: string | undefined
    if (op.measureBanco || op.measureBiela) {
      const parts: string[] = []
      if (op.measureBanco) parts.push(`Banco: ${op.measureBanco}`)
      if (op.measureBiela) parts.push(`Biela: ${op.measureBiela}`)
      detail = parts.join(' | ')
    } else if (op.measure) {
      detail = `${isValveTypeOperation(op.operation) ? 'Tipo: ' : 'Medida: '}${op.measure}`
    }

    items.push({
      id: op.id,
      quantity: qty,
      description: op.operation,
      detail,
      unitPrice: price,
      subtotal,
    })
    sectionsMap.set(title, items)
  }

  // Respaldo para órdenes que incluyan repuestos en order.parts (ej. datos iniciales o legados)
  for (const part of order.parts || []) {
    const qty = Number(part.quantity) || 0
    const price = Number(part.unitPrice) || 0
    const subtotal = Number(part.subtotal) || 0
    if (qty <= 0 || (price <= 0 && subtotal <= 0)) continue

    const items = sectionsMap.get('REPUESTOS') || []
    const detailParts: string[] = []
    if (part.code) detailParts.push(`Cód: ${part.code}`)
    if (part.measure) detailParts.push(`Medida: ${part.measure}`)

    items.push({
      id: part.id,
      quantity: qty,
      description: part.name,
      detail: detailParts.length > 0 ? detailParts.join(' | ') : undefined,
      unitPrice: price,
      subtotal,
    })
    sectionsMap.set('REPUESTOS', items)
  }

  const sections: ShareOrderSection[] = []
  for (const [title, items] of sectionsMap.entries()) {
    if (items.length > 0) {
      const subtotal = items.reduce((sum, it) => sum + (it.subtotal || 0), 0)
      sections.push({ title, items, subtotal })
    }
  }

  sections.sort((a, b) => {
    const orderA = SECTION_ORDER_MAP[a.title] ?? 99
    const orderB = SECTION_ORDER_MAP[b.title] ?? 99
    return orderA - orderB
  })

  const materials = (order.materials || [])
    .map((m) => (m.name || '').trim())
    .filter((name) => name.length > 0)

  const totalItemsCount = sections.reduce((sum, s) => sum + s.items.length, 0)
  const computedItemsTotal = sections.reduce((sum, s) => sum + s.subtotal, 0)
  const hasIva = Boolean(order.hasIva)
  const ivaPct = Number(tallerInfo?.iva_porcentaje ?? 13)
  const subtotal = order.subtotal !== undefined && order.subtotal > 0
    ? order.subtotal
    : computedItemsTotal
  const iva = order.iva !== undefined && order.iva > 0
    ? order.iva
    : Number((subtotal * (ivaPct / 100)).toFixed(2))
  const grandTotal = hasIva
    ? Number((subtotal + iva).toFixed(2))
    : (order.total || computedItemsTotal)

  return {
    sections,
    materials,
    totalItemsCount,
    hasIva,
    ivaPct,
    subtotal,
    iva,
    grandTotal,
  }
}

function appendWorkshopFooter(
  lines: string[],
  tallerInfo?: Partial<TallerInfo> | null,
  includeTallerContact = true
): void {
  const eslogan = (tallerInfo?.eslogan || 'APOYARTE ES NUESTRO COMPROMISO').trim()
  if (eslogan) {
    lines.push(`_"${escapeWaInline(eslogan)}"_`)
  }
  if (includeTallerContact) {
    const phones = [tallerInfo?.celular1, tallerInfo?.celular2]
      .map((p) => (p || '').trim())
      .filter(Boolean)
    if (phones.length > 0) {
      lines.push(`Tel: ${phones.join(' / ')}`)
    }
  }
}

/**
 * Genera el mensaje formateado para WhatsApp Business de una orden de trabajo o cotización.
 */
export function buildOrderWhatsAppMessage(
  order: Order,
  tallerInfo: Partial<TallerInfo> | null | undefined,
  options: WhatsAppMessageOptions
): string {
  const isCotizacion = order.type === 'cotizacion'
  const docTitle = isCotizacion ? 'COTIZACIÓN' : 'ORDEN DE TRABAJO'
  const workshopName = escapeWaInline(
    (tallerInfo?.nombre || 'TALLER INDUSTRIAL Y RECTIFICADO DE MOTORES').trim()
  )
  const customerName = escapeWaInline(order.customer || '')
  const workshopClient = escapeWaInline(order.workshop || '')
  const vehicleLabel = escapeWaInline(formatVehicleEngineLabel(order))
  const formattedDate = formatOrderDateForShare(order.date)
  const breakdown = buildOrderShareBreakdown(order, tallerInfo)

  const lines: string[] = []

  if (options.preset === 'pdf_companion') {
    const greetingTarget = customerName && customerName !== 'Cliente General' && customerName !== '— Sin Asignar —'
      ? `*${customerName}*`
      : 'estimado cliente'
    lines.push(`Hola ${greetingTarget}, le saludamos de *${workshopName}*.`)
    lines.push('')
    lines.push(`Le compartimos su *${docTitle} N° ${order.orderNumber}* (${formattedDate}):`)
    if (workshopClient && workshopClient !== customerName) {
      lines.push(`• *Taller:* ${workshopClient}`)
    }
    lines.push(`• *Vehículo / Motor:* ${vehicleLabel}`)
    if (options.includeStatus && order.status) {
      lines.push(`• *Estado:* ${escapeWaInline(order.status)}`)
    }
    lines.push(`• *Trabajos / Ítems:* ${breakdown.totalItemsCount}`)
    if (breakdown.hasIva) {
      lines.push(`• *Sub-total:* $${breakdown.subtotal.toFixed(2)}`)
      lines.push(`• *IVA (${breakdown.ivaPct}%):* $${breakdown.iva.toFixed(2)}`)
    }
    lines.push(`• *Total:* *$${breakdown.grandTotal.toFixed(2)}*`)
    lines.push('')
    if (options.pdfUrl?.trim()) {
      lines.push('📄 *Ver / Descargar documento PDF:*')
      lines.push(options.pdfUrl.trim())
    } else {
      lines.push('_(Adjuntamos el documento PDF con el desglose completo.)_')
    }
  } else if (options.preset === 'executive') {
    lines.push(`*${workshopName}*`)
    lines.push(`*${docTitle} N° ${order.orderNumber}*`)
    lines.push(
      options.includeStatus && order.status
        ? `Fecha: ${formattedDate} | Estado: *${escapeWaInline(order.status)}*`
        : `Fecha: ${formattedDate}`
    )
    lines.push('')
    if (customerName) {
      lines.push(`*Cliente:* ${customerName}`)
    }
    if (workshopClient && workshopClient !== customerName) {
      lines.push(`*Taller:* ${workshopClient}`)
    }
    lines.push(`*Vehículo / Motor:* ${vehicleLabel}`)

    if (breakdown.sections.length > 0) {
      const blocksSummary = breakdown.sections
        .map((s) => `${s.title} (${s.items.length})`)
        .join(', ')
      lines.push(`*Áreas trabajadas:* ${blocksSummary}`)
    }

    if (options.includeObservations && order.observations?.trim()) {
      lines.push(`*Obs:* ${escapeWaInline(order.observations)}`)
    }

    lines.push('')
    if (breakdown.hasIva) {
      lines.push(`Sub-total: $${breakdown.subtotal.toFixed(2)}`)
      lines.push(`IVA (${breakdown.ivaPct}%): $${breakdown.iva.toFixed(2)}`)
    }
    lines.push(`*TOTAL: $${breakdown.grandTotal.toFixed(2)}*`)
  } else {
    // 'detailed'
    lines.push(`*${workshopName}*`)
    lines.push(`*${docTitle} N° ${order.orderNumber}*`)
    lines.push(
      options.includeStatus && order.status
        ? `Fecha: ${formattedDate} | Estado: *${escapeWaInline(order.status)}*`
        : `Fecha: ${formattedDate}`
    )
    lines.push('')
    if (customerName) {
      lines.push(`*Cliente:* ${customerName}`)
    }
    if (workshopClient && workshopClient !== customerName) {
      lines.push(`*Taller:* ${workshopClient}`)
    }
    lines.push(`*Vehículo / Motor:* ${vehicleLabel}`)
    if (order.engineNumber?.trim()) {
      lines.push(`*N° Motor:* ${escapeWaInline(order.engineNumber)}`)
    }

    if (breakdown.sections.length > 0) {
      lines.push('')
      lines.push('*DETALLE DE SERVICIOS Y REPUESTOS:*')
      for (const section of breakdown.sections) {
        lines.push('')
        const blockHeader =
          options.includeItemPrices && options.includeBlockSubtotals
            ? `*${section.title}* — _Subtotal: $${section.subtotal.toFixed(2)}_`
            : `*${section.title}*`
        lines.push(blockHeader)

        for (const item of section.items) {
          const detailTag = item.detail ? ` [${escapeWaInline(item.detail)}]` : ''
          const desc = `${item.quantity}x ${escapeWaInline(item.description)}${detailTag}`
          if (options.includeItemPrices) {
            const unitInfo =
              item.quantity > 1 && item.unitPrice > 0
                ? ` ($${item.unitPrice.toFixed(2)} c/u)`
                : ''
            lines.push(`• ${desc}${unitInfo} — *$${item.subtotal.toFixed(2)}*`)
          } else {
            lines.push(`• ${desc}`)
          }
        }
      }
    }

    if (breakdown.materials.length > 0) {
      lines.push('')
      lines.push(`*Materiales:* ${escapeWaInline(breakdown.materials.join(', '))}`)
    }

    if (options.includeObservations && order.observations?.trim()) {
      lines.push(`*Obs:* ${escapeWaInline(order.observations)}`)
    }

    lines.push('')
    if (breakdown.hasIva) {
      lines.push(`Sub-total: $${breakdown.subtotal.toFixed(2)}`)
      lines.push(`IVA (${breakdown.ivaPct}%): $${breakdown.iva.toFixed(2)}`)
    }
    lines.push(`*TOTAL: $${breakdown.grandTotal.toFixed(2)}*`)
  }

  if (options.preset !== 'pdf_companion' && options.pdfUrl?.trim()) {
    lines.push('')
    lines.push('📄 *Ver / Descargar documento PDF:*')
    lines.push(options.pdfUrl.trim())
  }

  if (options.customNote?.trim()) {
    lines.push('')
    lines.push(escapeWaInline(options.customNote))
  }

  lines.push('')
  appendWorkshopFooter(lines, tallerInfo, options.includeTallerContact)

  return lines.join('\n')
}
