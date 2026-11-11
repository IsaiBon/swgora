-- ==============================================================================
-- Migración: Crear bucket de almacenamiento 'taller' y políticas RLS
-- Bucket destinado a logos corporativos y activos institucionales del taller
-- ==============================================================================

-- 1. Crear el bucket 'taller' si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'taller',
    'taller',
    true,
    5242880, -- Límite de 5MB por archivo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Asegurar que las políticas RLS previas se limpien para evitar duplicados
DROP POLICY IF EXISTS "Acceso publico de lectura en bucket taller" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de logo en bucket taller" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualizacion en bucket taller" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminacion en bucket taller" ON storage.objects;

-- 3. Política de lectura pública: cualquier usuario o documento puede ver el logo
CREATE POLICY "Acceso publico de lectura en bucket taller"
ON storage.objects FOR SELECT
USING (bucket_id = 'taller');

-- 4. Política de inserción (Upload)
CREATE POLICY "Permitir subida de logo en bucket taller"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'taller');

-- 5. Política de actualización (Update / Upsert)
CREATE POLICY "Permitir actualizacion en bucket taller"
ON storage.objects FOR UPDATE
USING (bucket_id = 'taller')
WITH CHECK (bucket_id = 'taller');

-- 6. Política de eliminación (Delete)
CREATE POLICY "Permitir eliminacion en bucket taller"
ON storage.objects FOR DELETE
USING (bucket_id = 'taller');
