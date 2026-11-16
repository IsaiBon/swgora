-- Migración: Preservar restricción de cuenta activa y evitar escalamiento de rol sin recursión RLS en public.perfiles

CREATE OR REPLACE FUNCTION public.mi_rol_perfil()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol
  FROM public.perfiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "perfiles_own_or_admin_update" ON public.perfiles;
CREATE POLICY "perfiles_own_or_admin_update"
  ON public.perfiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.es_admin_perfiles())
  WITH CHECK (
    public.es_admin_perfiles()
    OR (
      auth.uid() = id
      AND rol IS NOT DISTINCT FROM public.mi_rol_perfil()
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'swgora_cuenta_activa'
  ) THEN
    DROP POLICY IF EXISTS "swgora_exigir_cuenta_activa" ON public.perfiles;
    CREATE POLICY "swgora_exigir_cuenta_activa"
      ON public.perfiles
      AS RESTRICTIVE
      FOR ALL
      TO authenticated
      USING ((SELECT public.swgora_cuenta_activa()))
      WITH CHECK ((SELECT public.swgora_cuenta_activa()));
  END IF;
END;
$$;
