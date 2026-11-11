-- Migración: Crear tabla public.taller para configuración de la empresa rectificadora
CREATE TABLE IF NOT EXISTS public.taller (
    id TEXT PRIMARY KEY DEFAULT 'principal',
    nombre TEXT NOT NULL DEFAULT 'TALLER INDUSTRIAL Y RECTIFICADO DE MOTORES',
    direccion TEXT NOT NULL DEFAULT 'Col. Milagro de la Paz, Av. San Luis y Calle Oriente #12 San Miguel, El Salvador',
    celular1 TEXT NOT NULL DEFAULT '7831-2641',
    celular2 TEXT DEFAULT '7142-0401',
    eslogan TEXT DEFAULT 'APOYARTE ES NUESTRO COMPROMISO',
    logo_url TEXT DEFAULT '/logo-taller.png',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.taller ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para lectura pública y actualización
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'taller' AND policyname = 'Permitir lectura de taller a todos') THEN
    CREATE POLICY "Permitir lectura de taller a todos" ON public.taller FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'taller' AND policyname = 'Permitir insercion de taller a todos') THEN
    CREATE POLICY "Permitir insercion de taller a todos" ON public.taller FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'taller' AND policyname = 'Permitir actualizacion de taller a todos') THEN
    CREATE POLICY "Permitir actualizacion de taller a todos" ON public.taller FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Fila inicial predeterminada
INSERT INTO public.taller (id, nombre, direccion, celular1, celular2, eslogan, logo_url)
VALUES (
    'principal',
    'TALLER INDUSTRIAL Y RECTIFICADO DE MOTORES',
    'Col. Milagro de la Paz, Av. San Luis y Calle Oriente #12 San Miguel, El Salvador',
    '7831-2641',
    '7142-0401',
    'APOYARTE ES NUESTRO COMPROMISO',
    '/logo-taller.png'
)
ON CONFLICT (id) DO UPDATE SET
    nombre = COALESCE(NULLIF(public.taller.nombre, ''), EXCLUDED.nombre),
    direccion = COALESCE(NULLIF(public.taller.direccion, ''), EXCLUDED.direccion),
    celular1 = COALESCE(NULLIF(public.taller.celular1, ''), EXCLUDED.celular1),
    celular2 = COALESCE(NULLIF(public.taller.celular2, ''), EXCLUDED.celular2);
