import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Order } from '@/services/ordersService'

/**
 * Exporta un elemento HTML correspondiente a una orden o cotización a formato PDF tamaño Carta (Letter).
 * @param element Elemento DOM contenedor del documento
 * @param order Datos de la orden para nomenclatura del archivo
 */
export async function exportOrderToPdf(element: HTMLElement, order: Order): Promise<void> {
  // Esperar a que las fuentes web estén completamente cargadas
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready
    } catch {
      // Ignorar si no está soportado
    }
  }

  // Pequeña pausa para permitir que el render reactivo e imágenes se estabilicen
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Captura en Canvas de alta resolución (scale: 2 ~ 192-300 DPI)
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  })

  const imgData = canvas.toDataURL('image/png')

  // Documento PDF tamaño Carta (Letter: 215.9 x 279.4 mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Márgenes de 8 mm en los cuatro bordes
  const margin = 8
  const printWidth = pageWidth - margin * 2
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const printHeight = (imgHeight * printWidth) / imgWidth

  if (printHeight <= pageHeight - margin * 2) {
    // Cabe en una única página (diseño clean print estándar de 1 página)
    pdf.addImage(imgData, 'PNG', margin, margin, printWidth, printHeight)
  } else {
    // Si la lista de operaciones es muy extensa y desborda 1 página, paginar respetando márgenes
    let heightLeft = printHeight
    let position = margin

    pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight)
    heightLeft -= pageHeight - margin * 2

    while (heightLeft > 0) {
      position = heightLeft - printHeight + margin
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight)
      heightLeft -= pageHeight - margin * 2
    }
  }

  // Construir nombre de archivo descriptivo y limpio
  const prefix = order.type === 'cotizacion' ? 'COTIZACION' : 'ORDEN'
  const sanitizedNum = (order.orderNumber || '0000').replace(/[^a-zA-Z0-9_-]/g, '_')
  const clientPart = order.customer
    ? `_${order.customer.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24)}`
    : ''
  const filename = `${prefix}_${sanitizedNum}${clientPart}_JR_Blanco.pdf`

  // Descarga automática en el navegador del usuario
  pdf.save(filename)
}
