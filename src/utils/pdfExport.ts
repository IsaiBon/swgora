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
  const clientPart = order.customer
    ? `_${order.customer.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24)}`
    : ''
  return `${prefix}_${sanitizedNum}${clientPart}_JR_Blanco.pdf`
}

/**
 * Renderiza el elemento HTML del documento en una instancia jsPDF tamaño Carta (Letter).
 */
async function createOrderPdfDocument(
  element: HTMLElement,
  order: Order
): Promise<{ pdf: jsPDF; filename: string }> {
  // 1. Esperar a que las fuentes web del navegador estén listas
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready
    } catch {
      // Ignorar fallback
    }
  }

  // 2. Breve espera para estabilizar el layout y renderizado de imágenes
  await new Promise((resolve) => setTimeout(resolve, 150))

  // 3. Captura mediante html2canvas con clonación limpia (sin bordes de modal ni sombras)
  const canvas = await html2canvas(element, {
    scale: 2, // Nitidez ~200-300 DPI
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 800,
    onclone: (clonedDoc: Document) => {
      clonedDoc.documentElement.style.backgroundColor = '#ffffff'
      clonedDoc.documentElement.style.color = '#0f172a'
      clonedDoc.body.style.backgroundColor = '#ffffff'
      clonedDoc.body.style.color = '#0f172a'
      const clonedEl = clonedDoc.getElementById('printable-work-order')
      if (clonedEl) {
        clonedEl.style.boxShadow = 'none'
        clonedEl.style.border = 'none'
        clonedEl.style.borderRadius = '0'
        clonedEl.style.margin = '0'
        clonedEl.style.padding = '14px 18px'
        clonedEl.style.width = '760px'
        clonedEl.style.maxWidth = '760px'
        clonedEl.style.boxSizing = 'border-box'
        clonedEl.style.fontFamily = 'Arial, Helvetica, sans-serif'
        clonedEl.style.backgroundColor = '#ffffff'
        clonedEl.style.overflow = 'visible'
      }
    }
  })

  const imgData = canvas.toDataURL('image/png')

  // 4. Configurar PDF tamaño Carta (Letter: 215.9 x 279.4 mm)
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

  // - Si cabe en 1 hoja (con tolerancia del 5% para ajuste suave), se coloca en 1 sola página.
  // - Si la orden es más extensa, pasa a otra página automáticamente.
  if (printHeight <= maxPageHeight * 1.05) {
    const scaleFactor = printHeight > maxPageHeight ? maxPageHeight / printHeight : 1
    const fittedWidth = printWidth * scaleFactor
    const fittedHeight = printHeight * scaleFactor
    const xOffset = marginX + (printWidth - fittedWidth) / 2
    pdf.addImage(imgData, 'PNG', xOffset, marginY, fittedWidth, fittedHeight)
  } else {
    let heightLeft = printHeight
    let pageCount = 0

    while (heightLeft > 0) {
      if (pageCount > 0) {
        pdf.addPage()
      }
      const positionY = marginY - (pageCount * maxPageHeight)
      pdf.addImage(imgData, 'PNG', marginX, positionY, printWidth, printHeight)
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
