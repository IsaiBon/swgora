--Hecho por Diego  implementación de la estructura de tablas para el catálogo de repuestos y motores






BEGIN;

SELECT pg_advisory_xact_lock(20261007, 961);

CREATE TABLE IF NOT EXISTS public.fabricantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    pais_origen TEXT,
    logo_url TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS nombre TEXT UNIQUE NOT NULL;

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS pais_origen TEXT;

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS orden_visual INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.modelos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fabricante_id UUID NOT NULL REFERENCES public.fabricantes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    anio_inicio INTEGER,
    anio_fin INTEGER,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_modelo_fabricante UNIQUE (fabricante_id, nombre)
);

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS fabricante_id UUID NOT NULL REFERENCES public.fabricantes(id) ON DELETE CASCADE;

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS nombre TEXT NOT NULL;

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS anio_inicio INTEGER;

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS anio_fin INTEGER;

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.motores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fabricante_id UUID NOT NULL REFERENCES public.fabricantes(id) ON DELETE CASCADE,
    modelo_id UUID REFERENCES public.modelos(id) ON DELETE SET NULL,
    codigo TEXT NOT NULL,
    nombre_comercial TEXT,
    cilindrada_cc INTEGER,
    combustible TEXT,
    cilindros INTEGER,
    valvulas INTEGER,
    diametro_cilindro_std_mm NUMERIC(10,3),
    carrera_piston_mm NUMERIC(10,3),
    configuracion TEXT,
    aspiracion TEXT,
    anios TEXT,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS fabricante_id UUID NOT NULL REFERENCES public.fabricantes(id) ON DELETE CASCADE;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS modelo_id UUID REFERENCES public.modelos(id) ON DELETE SET NULL;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS codigo TEXT NOT NULL;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS nombre_comercial TEXT;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS cilindrada_cc INTEGER;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS combustible TEXT;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS cilindros INTEGER;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS valvulas INTEGER;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS diametro_cilindro_std_mm NUMERIC(10,3);

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS carrera_piston_mm NUMERIC(10,3);

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS configuracion TEXT;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS aspiracion TEXT;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS anios TEXT;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.motores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.repuestos_tecnicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motor_id UUID REFERENCES public.motores(id) ON DELETE SET NULL,
    codigo_oem TEXT NOT NULL,
    nombre TEXT NOT NULL,
    subsistema TEXT NOT NULL, 
    categoria TEXT NOT NULL,  
    precio NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'Disponible',
    imagen_url TEXT,
    catalogo_origen TEXT DEFAULT 'OEM', 
    
    
    diametro_cabeza_mm NUMERIC(10,3),
    diametro_vastago_mm NUMERIC(10,3),
    longitud_total_mm NUMERIC(10,3),
    angulo_asiento_grados NUMERIC(6,2),
    tipo_valvula TEXT, 
    
    
    diametro_interior_mm NUMERIC(10,3),
    diametro_exterior_mm NUMERIC(10,3),
    altura_mm NUMERIC(10,3),

    
    diametro_cilindro_mm NUMERIC(10,3),
    espesor_anillo1_mm NUMERIC(10,3),
    espesor_anillo2_mm NUMERIC(10,3),
    espesor_aceite_mm NUMERIC(10,3),
    
    
    tipo_cojinete TEXT, 
    diametro_munon_mm NUMERIC(10,3),
    diametro_alojamiento_mm NUMERIC(10,3),
    ancho_casquete_mm NUMERIC(10,3),
    
    
    medida_rosca TEXT, 
    paso_rosca_mm NUMERIC(10,3),
    longitud_perno_mm NUMERIC(10,3),
    cantidad_piezas INTEGER,
    paso_rosca1_mm NUMERIC(10,3),
    longitud1_mm NUMERIC(10,3),
    longitud2_mm NUMERIC(10,3),
    
    
    dimensiones JSONB NOT NULL DEFAULT '{}'::jsonb,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS motor_id UUID REFERENCES public.motores(id) ON DELETE SET NULL;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS codigo_oem TEXT NOT NULL;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS nombre TEXT NOT NULL;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS subsistema TEXT NOT NULL;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS precio NUMERIC(12,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'Disponible';

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS imagen_url TEXT;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS catalogo_origen TEXT DEFAULT 'OEM';

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS diametro_cabeza_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS diametro_vastago_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS longitud_total_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS angulo_asiento_grados NUMERIC(6,2);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS tipo_valvula TEXT;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS diametro_interior_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS diametro_exterior_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS altura_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS diametro_cilindro_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS espesor_anillo1_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS espesor_anillo2_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS espesor_aceite_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS tipo_cojinete TEXT;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS diametro_munon_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS diametro_alojamiento_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS ancho_casquete_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS medida_rosca TEXT;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS paso_rosca_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS longitud_perno_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS cantidad_piezas INTEGER;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS paso_rosca1_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS longitud1_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS longitud2_mm NUMERIC(10,3);

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS dimensiones JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.equivalencias_repuestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repuesto_id UUID NOT NULL REFERENCES public.repuestos_tecnicos(id) ON DELETE CASCADE,
    marca_alterna TEXT NOT NULL, 
    codigo_alterno TEXT NOT NULL,
    tipo_referencia TEXT NOT NULL DEFAULT 'Cruce Directo', 
    notas TEXT,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_repuesto_marca_codigo UNIQUE (repuesto_id, marca_alterna, codigo_alterno)
);

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS repuesto_id UUID NOT NULL REFERENCES public.repuestos_tecnicos(id) ON DELETE CASCADE;

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS marca_alterna TEXT NOT NULL;

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS codigo_alterno TEXT NOT NULL;

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS tipo_referencia TEXT NOT NULL DEFAULT 'Cruce Directo';

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS notas TEXT;

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.equivalencias_repuestos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.fabricantes ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'OEM';

ALTER TABLE public.repuestos_tecnicos ALTER COLUMN codigo_oem DROP NOT NULL;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS fuente_registro_id TEXT;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS codigo_catalogo TEXT;

ALTER TABLE public.repuestos_tecnicos ADD COLUMN IF NOT EXISTS requiere_revision BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalogo_fuente_20261007 ON public.repuestos_tecnicos(catalogo_origen,fuente_registro_id);

ALTER TABLE public.motores ALTER COLUMN combustible DROP NOT NULL;

ALTER TABLE public.motores ALTER COLUMN combustible DROP DEFAULT;

ALTER TABLE public.motores ALTER COLUMN cilindros DROP NOT NULL;

ALTER TABLE public.motores ALTER COLUMN cilindros DROP DEFAULT;

ALTER TABLE public.motores ALTER COLUMN valvulas DROP NOT NULL;

ALTER TABLE public.motores ALTER COLUMN valvulas DROP DEFAULT;

CREATE TABLE IF NOT EXISTS public.repuestos_tecnicos_motores (
 repuesto_id UUID NOT NULL REFERENCES public.repuestos_tecnicos(id) ON DELETE CASCADE,
 motor_id UUID NOT NULL REFERENCES public.motores(id) ON DELETE CASCADE,
 PRIMARY KEY(repuesto_id,motor_id)
);
INSERT INTO public.repuestos_tecnicos_motores(repuesto_id,motor_id)
SELECT id,motor_id FROM public.repuestos_tecnicos WHERE motor_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_rtm_motor_20261007 ON public.repuestos_tecnicos_motores(motor_id);
CREATE INDEX IF NOT EXISTS idx_rt_origen_20261007 ON public.repuestos_tecnicos(catalogo_origen);
CREATE INDEX IF NOT EXISTS idx_rt_codigo_catalogo_20261007 ON public.repuestos_tecnicos(codigo_catalogo);
CREATE INDEX IF NOT EXISTS idx_rt_guia_20261007 ON public.repuestos_tecnicos(diametro_interior_mm,diametro_exterior_mm,longitud_total_mm);
CREATE INDEX IF NOT EXISTS idx_rt_valvula_20261007 ON public.repuestos_tecnicos(diametro_cabeza_mm,diametro_vastago_mm,longitud_total_mm);


ALTER TABLE public.fabricantes ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fabricantes' AND policyname='catalogos_20261007_lectura') THEN
  CREATE POLICY catalogos_20261007_lectura ON public.fabricantes FOR SELECT TO authenticated USING (true);
 END IF;
END $policy$;
DO $grant$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN GRANT SELECT ON public.fabricantes TO authenticated; END IF; END $grant$;

ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='modelos' AND policyname='catalogos_20261007_lectura') THEN
  CREATE POLICY catalogos_20261007_lectura ON public.modelos FOR SELECT TO authenticated USING (true);
 END IF;
END $policy$;
DO $grant$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN GRANT SELECT ON public.modelos TO authenticated; END IF; END $grant$;

ALTER TABLE public.motores ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='motores' AND policyname='catalogos_20261007_lectura') THEN
  CREATE POLICY catalogos_20261007_lectura ON public.motores FOR SELECT TO authenticated USING (true);
 END IF;
END $policy$;
DO $grant$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN GRANT SELECT ON public.motores TO authenticated; END IF; END $grant$;

ALTER TABLE public.repuestos_tecnicos ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='repuestos_tecnicos' AND policyname='catalogos_20261007_lectura') THEN
  CREATE POLICY catalogos_20261007_lectura ON public.repuestos_tecnicos FOR SELECT TO authenticated USING (true);
 END IF;
END $policy$;
DO $grant$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN GRANT SELECT ON public.repuestos_tecnicos TO authenticated; END IF; END $grant$;

ALTER TABLE public.equivalencias_repuestos ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='equivalencias_repuestos' AND policyname='catalogos_20261007_lectura') THEN
  CREATE POLICY catalogos_20261007_lectura ON public.equivalencias_repuestos FOR SELECT TO authenticated USING (true);
 END IF;
END $policy$;
DO $grant$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN GRANT SELECT ON public.equivalencias_repuestos TO authenticated; END IF; END $grant$;

ALTER TABLE public.repuestos_tecnicos_motores ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='repuestos_tecnicos_motores' AND policyname='catalogos_20261007_lectura') THEN
  CREATE POLICY catalogos_20261007_lectura ON public.repuestos_tecnicos_motores FOR SELECT TO authenticated USING (true);
 END IF;
END $policy$;
DO $grant$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN GRANT SELECT ON public.repuestos_tecnicos_motores TO authenticated; END IF; END $grant$;


CREATE TABLE IF NOT EXISTS public.catalogo_referencias_fuente (
 catalogo_origen text NOT NULL,
 fuente_registro_id text NOT NULL,
 referencia_original text NOT NULL,
 codigo_catalogo text,
 repuesto_candidato_id uuid REFERENCES public.repuestos_tecnicos(id) ON DELETE SET NULL,
 estado_revision text NOT NULL,
 fuente jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (catalogo_origen,fuente_registro_id)
);
ALTER TABLE public.catalogo_referencias_fuente ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_catalogo_ref_codigo ON public.catalogo_referencias_fuente(codigo_catalogo);


NOTIFY pgrst, 'reload schema';

COMMIT;