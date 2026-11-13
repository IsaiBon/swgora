import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Order } from '@/services/ordersService'

/**
 * Exporta el documento de la orden o cotización a PDF tamaño Carta (Letter),
 * garantizando cero sobremontaje de texto, líneas limpias y fidelidad tipográfica.
 */
export async function exportOrderToPdf(element: HTMLElement, order: Order): Promise<void> {
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

  // Ajuste inteligente: si cabe o excede hasta un 35%, aplicar ajuste de escala 'fit-to-page'
  // para que quepa en 1 sola página completa, garantizando que NUNCA se corte la firma, el total o el pie del documento.
  if (printHeight <= maxPageHeight) {
    pdf.addImage(imgData, 'PNG', marginX, marginY, printWidth, printHeight)
  } else if (printHeight <= maxPageHeight * 1.35) {
    const scaleFactor = maxPageHeight / printHeight
    const fittedWidth = printWidth * scaleFactor
    const xOffset = marginX + (printWidth - fittedWidth) / 2
    pdf.addImage(imgData, 'PNG', xOffset, marginY, fittedWidth, maxPageHeight)
  } else {
    // Si la orden es excepcionalmente kilométrica, paginar
    let heightLeft = printHeight
    let position = marginY

    pdf.addImage(imgData, 'PNG', marginX, position, printWidth, printHeight)
    heightLeft -= maxPageHeight

    while (heightLeft > 0) {
      position = heightLeft - printHeight + marginY
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', marginX, position, printWidth, printHeight)
      heightLeft -= maxPageHeight
    }
  }

  // 5. Nombre descriptivo de archivo
  const prefix = order.type === 'cotizacion' ? 'COTIZACION' : 'ORDEN'
  const sanitizedNum = (order.orderNumber || '0000').replace(/[^a-zA-Z0-9_-]/g, '_')
  const clientPart = order.customer
    ? `_${order.customer.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24)}`
    : ''
  const filename = `${prefix}_${sanitizedNum}${clientPart}_JR_Blanco.pdf`

  pdf.save(filename)
}
