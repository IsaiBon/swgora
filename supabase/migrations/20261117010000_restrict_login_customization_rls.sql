-- Migración: Restringir la personalización del Login y la configuración principal de `public.taller`
-- exclusivamente al Administrador del taller principal (excluyendo cuentas de talleres independientes/amigos y subcuentas).

CREATE OR REPLACE FUNCTION public.es_admin_principal_taller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.estado, 'Activo') = 'Activo'
      AND position('||tenant|' in lower(btrim(COALESCE(p.rol, '')))) = 0
      AND split_part(lower(btrim(COALESCE(p.rol, ''))), '|', 1) <> 'independiente'
      AND lower(btrim(COALESCE(p.rol, ''))) <> 'taller independiente'
      AND (
        lower(btrim(COALESCE(p.rol, ''))) IN ('administrador', 'admin')
        OR split_part(lower(btrim(COALESCE(p.rol, ''))), '|', 1) IN ('administrador', 'admin')
        OR lower(btrim(COALESCE(p.email, ''))) IN (
          'admin@jrblanco.com',
          'admin.swgora@gmail.com',
          'jrblanco@gmail.com',
          'jrblanco1@gmail.com',
          'luis1@gmail.com',
          'diegogranados1324@gmail.com'
        )
      )
  );
$$;

ALTER TABLE IF EXISTS public.taller ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taller_restrict_login_principal_insert" ON public.taller;
CREATE POLICY "taller_restrict_login_principal_insert"
  ON public.taller
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (
    id NOT IN ('__swgora_login_customization__', 'principal')
    OR public.es_admin_principal_taller()
  );

DROP POLICY IF EXISTS "taller_restrict_login_principal_update" ON public.taller;
CREATE POLICY "taller_restrict_login_principal_update"
  ON public.taller
  AS RESTRICTIVE
  FOR UPDATE
  TO public
  USING (
    id NOT IN ('__swgora_login_customization__', 'principal')
    OR public.es_admin_principal_taller()
  )
  WITH CHECK (
    id NOT IN ('__swgora_login_customization__', 'principal')
    OR public.es_admin_principal_taller()
  );

DROP POLICY IF EXISTS "taller_restrict_login_principal_delete" ON public.taller;
CREATE POLICY "taller_restrict_login_principal_delete"
  ON public.taller
  AS RESTRICTIVE
  FOR DELETE
  TO public
  USING (
    id NOT IN ('__swgora_login_customization__', 'principal')
    OR public.es_admin_principal_taller()
  );
