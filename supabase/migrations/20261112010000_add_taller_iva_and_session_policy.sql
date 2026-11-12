-- ==========================================================================
-- MIGRACIÓN: IVA configurable en taller + Control de sesión única en perfiles
-- ==========================================================================

-- 1. IVA configurable para el taller (default 13.00%)
ALTER TABLE IF EXISTS public.taller
  ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 13.00;

-- 2. Control de sesión única por usuario (1 dispositivo vs multi-dispositivo)
ALTER TABLE IF EXISTS public.perfiles
  ADD COLUMN IF NOT EXISTS sesion_unica BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active_session_token TEXT;

-- 3. Permitir a administradores actualizar configuración de perfiles (ej. sesion_unica / liberar sesión)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'perfiles' AND policyname = 'Permitir a administradores actualizar perfiles'
  ) THEN
    CREATE POLICY "Permitir a administradores actualizar perfiles"
      ON public.perfiles
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.perfiles p
          WHERE p.id = auth.uid()
            AND lower(p.rol) IN ('administrador', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.perfiles p
          WHERE p.id = auth.uid()
            AND lower(p.rol) IN ('administrador', 'admin')
        )
      );
  END IF;
END
$$;
