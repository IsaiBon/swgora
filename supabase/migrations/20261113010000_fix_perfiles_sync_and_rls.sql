-- Migración idempotente para corregir la sincronización de `auth.users` <-> `public.perfiles`
-- y habilitar permisos RLS completos para administradores autenticados.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'Activo';

UPDATE public.perfiles
SET estado = 'Activo'
WHERE estado IS NULL OR btrim(estado) = '';

-- Helper SECURITY DEFINER para consultar si el usuario autenticado es administrador
-- sin provocar recursión infinita (42P17) en las políticas RLS de `public.perfiles`.
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
        OR split_part(lower(btrim(p.rol)), '|', 1) IN ('administrador', 'admin')
      )
  );
$$;

-- Trigger de creación automática de perfil al registrar usuarios en `auth.users`.
-- Si algún constraint previo rechaza un rol codificado (`subadmin|...`, `independiente|...`),
-- inserta con `'operador'` en vez de abortar el alta en Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_email text;
  v_rol text;
BEGIN
  v_email := COALESCE(lower(btrim(NEW.email)), '');
  v_nombre := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(v_email, '@', 1), ''),
    'Usuario'
  );
  v_rol := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'role'), ''),
    'operador'
  );

  BEGIN
    INSERT INTO public.perfiles (id, nombre, email, rol, estado, created_at, updated_at)
    VALUES (NEW.id, v_nombre, v_email, v_rol, 'Activo', now(), now())
    ON CONFLICT (id) DO UPDATE
      SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.perfiles.email),
          nombre = COALESCE(NULLIF(public.perfiles.nombre, ''), EXCLUDED.nombre),
          rol = CASE
            WHEN NULLIF(btrim(public.perfiles.rol), '') IS NULL THEN EXCLUDED.rol
            ELSE public.perfiles.rol
          END,
          updated_at = now();
  EXCEPTION
    WHEN check_violation THEN
      BEGIN
        INSERT INTO public.perfiles (id, nombre, email, rol, estado, created_at, updated_at)
        VALUES (
          NEW.id,
          v_nombre,
          v_email,
          CASE WHEN lower(btrim(v_rol)) = 'admin' THEN 'administrador' ELSE 'operador' END,
          'Activo',
          now(),
          now()
        )
        ON CONFLICT (id) DO UPDATE
          SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.perfiles.email),
              nombre = COALESCE(NULLIF(public.perfiles.nombre, ''), EXCLUDED.nombre),
              updated_at = now();
      EXCEPTION
        WHEN check_violation THEN
          INSERT INTO public.perfiles (id, nombre, email, rol, estado, created_at, updated_at)
          VALUES (NEW.id, v_nombre, v_email, 'operador', 'Activo', now(), now())
          ON CONFLICT (id) DO UPDATE
            SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.perfiles.email),
                nombre = COALESCE(NULLIF(public.perfiles.nombre, ''), EXCLUDED.nombre),
                updated_at = now();
      END;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Eliminar constraints CHECK restrictivos sobre `rol` que bloqueen 'admin', 'subadmin|...' o 'independiente|...'
DO $$
DECLARE
  c_rec RECORD;
BEGIN
  FOR c_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.perfiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%rol%'
  LOOP
    EXECUTE format('ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS %I', c_rec.conname);
  END LOOP;
END;
$$;

-- Backfill: restaurar filas faltantes o con `rol` vacío desde `auth.users`
DO $$
DECLARE
  u_rec RECORD;
  v_nombre text;
  v_email text;
  v_rol text;
BEGIN
  FOR u_rec IN
    SELECT u.id, u.email, u.raw_user_meta_data, u.created_at, p.id AS perfil_id, p.rol AS perfil_rol
    FROM auth.users u
    LEFT JOIN public.perfiles p ON p.id = u.id
    WHERE p.id IS NULL OR NULLIF(btrim(p.rol), '') IS NULL
  LOOP
    v_email := COALESCE(lower(btrim(u_rec.email)), '');
    v_nombre := COALESCE(
      NULLIF(btrim(u_rec.raw_user_meta_data->>'name'), ''),
      NULLIF(split_part(v_email, '@', 1), ''),
      'Usuario'
    );
    v_rol := COALESCE(
      NULLIF(btrim(u_rec.raw_user_meta_data->>'role'), ''),
      'operador'
    );

    BEGIN
      INSERT INTO public.perfiles (id, nombre, email, rol, estado, created_at, updated_at)
      VALUES (u_rec.id, v_nombre, v_email, v_rol, 'Activo', COALESCE(u_rec.created_at, now()), now())
      ON CONFLICT (id) DO UPDATE
        SET rol = CASE
          WHEN NULLIF(btrim(public.perfiles.rol), '') IS NULL THEN EXCLUDED.rol
          ELSE public.perfiles.rol
        END,
        updated_at = now();
    EXCEPTION
      WHEN check_violation THEN
        INSERT INTO public.perfiles (id, nombre, email, rol, estado, created_at, updated_at)
        VALUES (
          u_rec.id,
          v_nombre,
          v_email,
          CASE WHEN lower(btrim(v_rol)) = 'admin' THEN 'administrador' ELSE 'operador' END,
          'Activo',
          COALESCE(u_rec.created_at, now()),
          now()
        )
        ON CONFLICT (id) DO NOTHING;
    END;
  END LOOP;
END;
$$;

-- Políticas RLS idempotentes sobre `public.perfiles` (elimina cualquier política heredada recursiva 42P17)
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de perfiles a usuarios autenticados" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir actualizar propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir insercion de propio perfil" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir a administradores actualizar perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.perfiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.perfiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.perfiles;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'perfiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.perfiles', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "perfiles_admin_select"
  ON public.perfiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "perfiles_own_or_admin_insert"
  ON public.perfiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id OR public.es_admin_perfiles());

CREATE POLICY "perfiles_own_or_admin_update"
  ON public.perfiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.es_admin_perfiles())
  WITH CHECK (auth.uid() = id OR public.es_admin_perfiles());

CREATE POLICY "perfiles_admin_delete"
  ON public.perfiles
  FOR DELETE
  TO authenticated
  USING (public.es_admin_perfiles() AND id <> auth.uid());
