import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Order } from '@/services/ordersService'

export interface GeneratedOrderPdf {
  blob: Blob
  file: File
  filename: string
}

/**
 * Construye el nombre de archivo estandarizado para el PDF de la orden o cotización.
 */
export function buildOrderPdfFilename(order: Order): string {
  const prefix = order.type === 'cotizacion' ? 'COTIZACION' : 'ORDEN'
  const sanitizedNum = (order.orderNumber || '0000').replace(/[^a-zA-Z0-9_-]/g, '_')
  const nameOrWorkshop = (order.customer || order.workshop || '').trim()
  const clientPart = nameOrWorkshop
    ? `_${nameOrWorkshop.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24)}`
    : ''
  return `${prefix}_${sanitizedNum}${clientPart}_JR_Blanco.pdf`
}

/**
 * Recolecta en memoria todas las reglas CSS de hojas del mismo origen (Tailwind + estilos globales)
 * para inyectarlas síncronamente dentro del iframe clonado de html2canvas.
 */
function collectSameOriginStyles(): string {
  if (typeof document === 'undefined') return ''
  const chunks: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules
      if (!rules) continue
      let sheetCss = ''
      for (const rule of Array.from(rules)) {
        sheetCss += `${rule.cssText}\n`
      }
      if (sheetCss) chunks.push(sheetCss)
    } catch {
      // Ignorar hojas externas cross-origin (ej. Google Fonts)
    }
  }
  return chunks.join('\n')
}

async function waitForElementImages(element: HTMLElement): Promise<void> {
  const imgs = Array.from(element.querySelectorAll('img'))
  if (imgs.length === 0) return
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          const timer = setTimeout(() => {
            cleanup()
            resolve()
          }, 2000)
          const onDone = () => {
            cleanup()
            resolve()
          }
          const cleanup = () => {
            clearTimeout(timer)
            img.removeEventListener('load', onDone)
            img.removeEventListener('error', onDone)
          }
          img.addEventListener('load', onDone)
          img.addEventListener('error', onDone)
        })
    )
  )
}

async function waitTwoAnimationFrames(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Renderiza el elemento HTML del documento en una instancia jsPDF tamaño Carta (Letter).
 */
async function createOrderPdfDocument(
  element: HTMLElement,
  order: Order
): Promise<{ pdf: jsPDF; filename: string }> {
  // 1. Esperar fuentes web e imágenes reales dentro del documento
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready
    } catch {
      // Ignorar fallback
    }
  }
  await waitForElementImages(element)
  await waitTwoAnimationFrames()

  const inlineStylesCss = collectSameOriginStyles()
  const baseWindowHeight = Math.max(1200, element.scrollHeight + 160)

  // 2. Captura mediante html2canvas inyectando CSS síncrono y limpiando modal/ancestros
  const canvas = await html2canvas(element, {
    scale: 2, // Nitidez ~200-300 DPI
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: 760,
    windowWidth: 1024,
    windowHeight: baseWindowHeight,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      // Eliminar <link rel="stylesheet"> del mismo origen para evitar fallos/demoras dentro del iframe
      clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        const href = link.getAttribute('href') || ''
        if (href.startsWith('/') || (origin && href.startsWith(origin))) {
          link.remove()
        }
      })

      // Inyectar estilos compilados (Tailwind + style.css) + reset seguro
      const styleEl = clonedDoc.createElement('style')
      styleEl.id = 'swgora-pdf-inline-styles'
      styleEl.textContent =
        `${inlineStylesCss}\n` +
        `*, *::before, *::after { box-sizing: border-box; }\n` +
        `html, body { background-color: #ffffff; color: #0f172a; margin: 0; padding: 0; }\n`
      clonedDoc.head.appendChild(styleEl)

      clonedDoc.documentElement.style.backgroundColor = '#ffffff'
      clonedDoc.documentElement.style.color = '#0f172a'
      clonedDoc.documentElement.style.margin = '0'
      clonedDoc.documentElement.style.padding = '0'
      clonedDoc.documentElement.style.width = '1024px'

      clonedDoc.body.classList.remove('printing-modal-active')
      clonedDoc.body.style.backgroundColor = '#ffffff'
      clonedDoc.body.style.color = '#0f172a'
      clonedDoc.body.style.margin = '0'
      clonedDoc.body.style.padding = '0'
      clonedDoc.body.style.width = '1024px'

      const targetEl =
        clonedElement ||
        (clonedDoc.getElementById('printable-work-order') as HTMLElement | null)

      if (targetEl) {
        let ancestor = targetEl.parentElement
        while (
          ancestor &&
          ancestor !== clonedDoc.body &&
          ancestor !== clonedDoc.documentElement
        ) {
          ancestor.style.overflow = 'visible'
          ancestor.style.maxHeight = 'none'
          ancestor.style.height = 'auto'
          ancestor.style.transform = 'none'
          ;(ancestor.style as any).zoom = '1'
          ancestor.style.width = 'auto'
          ancestor = ancestor.parentElement
        }

        ;(targetEl.style as any).zoom = '1'
        targetEl.style.boxShadow = 'none'
        targetEl.style.border = 'none'
        targetEl.style.borderRadius = '0'
        targetEl.style.margin = '0'
        targetEl.style.padding = '14px 18px'
        targetEl.style.width = '760px'
        targetEl.style.minWidth = '760px'
        targetEl.style.maxWidth = '760px'
        targetEl.style.boxSizing = 'border-box'
        targetEl.style.fontFamily = 'Arial, Helvetica, sans-serif'
        targetEl.style.backgroundColor = '#ffffff'
        targetEl.style.overflow = 'visible'
      }
    }
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.94)

  // 3. Configurar PDF tamaño Carta (Letter: 215.9 x 279.4 mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()   // 215.9 mm
  const pageHeight = pdf.internal.pageSize.getHeight() // 279.4 mm

  // Márgenes seguros
  const marginX = 7
  const marginY = 7
  const printWidth = pageWidth - marginX * 2           // 201.9 mm
  const maxPageHeight = pageHeight - marginY * 2       // 265.4 mm
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const printHeight = (imgHeight * printWidth) / imgWidth

  // - Si cabe en 1 hoja (con tolerancia del 4% para ajuste suave), se coloca en 1 sola página.
  // - Si aún en 2 columnas la orden es extremadamente larga, se divide limpiamente por páginas.
  if (printHeight <= maxPageHeight * 1.04) {
    const scaleFactor = printHeight > maxPageHeight ? maxPageHeight / printHeight : 1
    const fittedWidth = printWidth * scaleFactor
    const fittedHeight = printHeight * scaleFactor
    const xOffset = marginX + (printWidth - fittedWidth) / 2
    pdf.addImage(imgData, 'JPEG', xOffset, marginY, fittedWidth, fittedHeight, undefined, 'FAST')
  } else {
    let heightLeft = printHeight
    let pageCount = 0

    while (heightLeft > 0) {
      if (pageCount > 0) {
        pdf.addPage()
      }
      const positionY = marginY - pageCount * maxPageHeight
      pdf.addImage(imgData, 'JPEG', marginX, positionY, printWidth, printHeight, undefined, 'FAST')
      // Limpiar franjas de margen superior e inferior para corte limpio entre páginas
      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, 0, pageWidth, marginY, 'F')
      pdf.rect(0, pageHeight - marginY, pageWidth, marginY, 'F')
      heightLeft -= maxPageHeight
      pageCount++
    }
  }

  return {
    pdf,
    filename: buildOrderPdfFilename(order)
  }
}

/**
 * Genera el documento PDF en memoria (Blob y File) para compartir o subir a la nube.
 */
export async function generateOrderPdfFile(
  element: HTMLElement,
  order: Order
): Promise<GeneratedOrderPdf> {
  const { pdf, filename } = await createOrderPdfDocument(element, order)
  const blob = pdf.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })
  return { blob, file, filename }
}

/**
 * Descarga un Blob PDF ya generado en el navegador sin volver a renderizar el documento.
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Exporta el documento de la orden o cotización a PDF tamaño Carta (Letter),
 * garantizando cero sobremontaje de texto, líneas limpias y fidelidad tipográfica.
 */
export async function exportOrderToPdf(element: HTMLElement, order: Order): Promise<void> {
  const { pdf, filename } = await createOrderPdfDocument(element, order)
  pdf.save(filename)
}
