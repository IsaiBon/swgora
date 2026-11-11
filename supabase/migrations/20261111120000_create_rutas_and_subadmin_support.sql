-- ==========================================================================
-- MIGRACIÓN: RUTAS / SUCURSALES Y SUB-ADMINISTRADORES POR RUTA
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.rutas (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  zona TEXT DEFAULT '',
  descripcion TEXT DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Inactiva')),
  sub_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sub_admin_nombre TEXT,
  sub_admin_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de rutas a usuarios autenticados" ON public.rutas;
CREATE POLICY "Permitir lectura de rutas a usuarios autenticados"
  ON public.rutas
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Permitir escritura de rutas a administradores" ON public.rutas;
CREATE POLICY "Permitir escritura de rutas a administradores"
  ON public.rutas
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Columnas opcionales de ruta en ordenes_trabajo
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS ruta_id TEXT,
  ADD COLUMN IF NOT EXISTS ruta_codigo TEXT,
  ADD COLUMN IF NOT EXISTS ruta_nombre TEXT;

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_ruta_id ON public.ordenes_trabajo(ruta_id);
