import { supabase } from '@/services/supabase'

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: string
}

export interface CompressionResult {
  file: File
  blob: Blob
  originalSize: number
  compressedSize: number
  reductionPercent: number
  previewUrl: string
}

export interface UploadResult {
  url: string
  path: string
  size: number
  compression?: CompressionResult
}

export const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'repuestos'

/**
 * Optimiza y comprime una imagen en el navegador del cliente mediante Canvas API.
 * Especialmente diseñado para talleres mecánicos con conexiones lentas o fotos móviles pesadas.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1400,
    maxHeight = 1400,
    quality = 0.82,
    mimeType = 'image/webp'
  } = options

  const originalSize = file.size

  // Si es un SVG, GIF animado o archivo muy pequeño (< 60 KB), no recomprimir para preservar vector/animación
  if (file.type === 'image/svg+xml' || file.type === 'image/gif' || originalSize < 60 * 1024) {
    const previewUrl = URL.createObjectURL(file)
    return {
      file,
      blob: file,
      originalSize,
      compressedSize: originalSize,
      reductionPercent: 0,
      previewUrl
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calcular escalado proporcional conservando relación de aspecto
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            maxHeight ? (height = maxHeight) : height
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          const previewUrl = URL.createObjectURL(file)
          return resolve({
            file,
            blob: file,
            originalSize,
            compressedSize: originalSize,
            reductionPercent: 0,
            previewUrl
          })
        }

        // Suavizado de imagen de alta calidad
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Determinar formato de salida: preferir webp, fallback a jpeg
        const targetType = mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg'
        const extension = targetType === 'image/webp' ? 'webp' : 'jpg'

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              const previewUrl = URL.createObjectURL(file)
              return resolve({
                file,
                blob: file,
                originalSize,
                compressedSize: originalSize,
                reductionPercent: 0,
                previewUrl
              })
            }

            // Si la compresión resultó más pesada que el original, usar el original
            if (blob.size >= originalSize && file.type.startsWith('image/')) {
              const previewUrl = URL.createObjectURL(file)
              return resolve({
                file,
                blob: file,
                originalSize,
                compressedSize: originalSize,
                reductionPercent: 0,
                previewUrl
              })
            }

            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'repuesto'
            const compressedFile = new File([blob], `${baseName}.${extension}`, {
              type: targetType,
              lastModified: Date.now()
            })

            const reduction = Math.max(0, Math.round(((originalSize - blob.size) / originalSize) * 100))
            const previewUrl = URL.createObjectURL(blob)

            resolve({
              file: compressedFile,
              blob,
              originalSize,
              compressedSize: blob.size,
              reductionPercent: reduction,
              previewUrl
            })
          },
          targetType,
          quality
        )
      }

      img.src = e.target?.result as string
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Sube una imagen técnica o diagrama de repuesto a Supabase Storage (bucket 'repuestos').
 * Aplica compresión ligera antes de la subida para velocidad máxima en taller.
 */
export async function uploadRepuestoImage(
  file: File,
  prefix: string = 'piezas'
): Promise<UploadResult> {
  // 1. Optimizar en el cliente
  const compression = await compressImage(file)
  const fileToUpload = compression.file

  // 2. Generar nombre de archivo único y seguro
  const cleanPrefix = (prefix || 'pieza').toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 30)
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 7)
  const ext = fileToUpload.name.split('.').pop() || 'webp'
  const filePath = `${cleanPrefix}/${timestamp}_${randomSuffix}.${ext}`

  try {
    // 3. Subir a Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileToUpload, {
        cacheControl: '31536000', // 1 año de caché en CDN
        upsert: true,
        contentType: fileToUpload.type
      })

    if (error) {
      console.warn(`[StorageService] Subida a Supabase falló (${error.message}). Utilizando vista previa local temporal.`)
      // Fallback a DataURL en memoria para no bloquear al usuario si el bucket en Supabase no ha sido activado
      return {
        url: compression.previewUrl,
        path: filePath,
        size: compression.compressedSize,
        compression
      }
    }

    // 4. Obtener URL pública directa
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path)

    return {
      url: urlData.publicUrl,
      path: data.path,
      size: compression.compressedSize,
      compression
    }
  } catch (err: unknown) {
    console.warn('[StorageService] Excepción durante subida a Storage:', err)
    return {
      url: compression.previewUrl,
      path: filePath,
      size: compression.compressedSize,
      compression
    }
  }
}

/**
 * Elimina una imagen de repuesto en Supabase Storage
 */
export async function deleteRepuestoImage(pathOrUrl: string): Promise<boolean> {
  if (!pathOrUrl) return false

  try {
    let filePath = pathOrUrl

    // Si viene la URL pública completa, extraer la ruta relativa dentro del bucket
    if (pathOrUrl.includes(STORAGE_BUCKET)) {
      const parts = pathOrUrl.split(`${STORAGE_BUCKET}/`)
      if (parts.length > 1) {
        filePath = decodeURIComponent(parts[1].split('?')[0])
      }
    }

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath])

    if (error) {
      console.warn('[StorageService] Error al eliminar imagen de Storage:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[StorageService] Excepción al eliminar imagen:', err)
    return false
  }
}

/**
 * Formatea bytes en cadena legible (KB / MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
