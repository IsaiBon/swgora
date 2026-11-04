-- ==============================================================================
-- Migración: Crear bucket de almacenamiento 'repuestos' y políticas RLS
-- Bucket destinado a diagramas de explosión, planos técnicos y fotos de repuestos
-- ==============================================================================

-- 1. Crear el bucket 'repuestos' si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'repuestos',
    'repuestos',
    true,
    5242880, -- Límite de 5MB por archivo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Asegurar que las políticas RLS previas se limpien para evitar duplicados
DROP POLICY IF EXISTS "Acceso publico de lectura en bucket repuestos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de imagenes en bucket repuestos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualizacion en bucket repuestos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminacion en bucket repuestos" ON storage.objects;

-- 3. Política de lectura pública: cualquier usuario (taller, mostrador, cliente) puede ver los diagramas y fotos
CREATE POLICY "Acceso publico de lectura en bucket repuestos"
ON storage.objects FOR SELECT
USING (bucket_id = 'repuestos');

-- 4. Política de inserción (Upload): permite subir imágenes al bucket 'repuestos'
CREATE POLICY "Permitir subida de imagenes en bucket repuestos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'repuestos');

-- 5. Política de actualización (Update / Upsert)
CREATE POLICY "Permitir actualizacion en bucket repuestos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'repuestos')
WITH CHECK (bucket_id = 'repuestos');

-- 6. Política de eliminación (Delete)
CREATE POLICY "Permitir eliminacion en bucket repuestos"
ON storage.objects FOR DELETE
USING (bucket_id = 'repuestos');
