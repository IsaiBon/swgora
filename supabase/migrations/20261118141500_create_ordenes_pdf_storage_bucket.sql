-- ==============================================================================
-- Migración: Crear bucket de almacenamiento 'ordenes-pdf' y políticas RLS
-- Bucket destinado a compartir PDFs de órdenes de trabajo y cotizaciones vía wa.me
-- ==============================================================================

-- 1. Crear el bucket 'ordenes-pdf' si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ordenes-pdf',
    'ordenes-pdf',
    true,
    10485760, -- Límite de 10 MB por documento PDF
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

-- 2. Limpiar políticas previas para evitar duplicados
DROP POLICY IF EXISTS "Acceso publico de lectura en bucket ordenes-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de PDFs en bucket ordenes-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualizacion en bucket ordenes-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminacion en bucket ordenes-pdf" ON storage.objects;

-- 3. Política de lectura pública para que el cliente pueda abrir el PDF desde el enlace wa.me
CREATE POLICY "Acceso publico de lectura en bucket ordenes-pdf"
ON storage.objects FOR SELECT
USING (bucket_id = 'ordenes-pdf');

-- 4. Política de inserción (Upload)
CREATE POLICY "Permitir subida de PDFs en bucket ordenes-pdf"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ordenes-pdf');

-- 5. Política de actualización (Upsert)
CREATE POLICY "Permitir actualizacion en bucket ordenes-pdf"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ordenes-pdf')
WITH CHECK (bucket_id = 'ordenes-pdf');

-- 6. Política de eliminación
CREATE POLICY "Permitir eliminacion en bucket ordenes-pdf"
ON storage.objects FOR DELETE
USING (bucket_id = 'ordenes-pdf');
