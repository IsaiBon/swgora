-- Migración: Restaurar rol 'admin' para admin@jrblanco.com y robustecer public.es_admin_perfiles()

UPDATE public.perfiles
SET rol = 'admin',
    estado = 'Activo',
    updated_at = now()
WHERE lower(btrim(email)) = 'admin@jrblanco.com'
  AND lower(btrim(rol)) NOT IN ('admin', 'administrador');

CREATE OR REPLACE FUNCTION public.es_admin_perfiles()
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
      AND (
        lower(btrim(p.rol)) IN ('administrador', 'admin')
        OR split_part(lower(btrim(p.rol)), '|', 1) IN ('administrador', 'admin', 'independiente')
        OR lower(btrim(p.email)) IN (
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
