-- ==============================================================================
-- MIGRACIÓN SPRINT 4: Limpieza de Clientes y Estructura del Catálogo en Supabase
-- Archivo: 20260930000000_cleanup_clientes_and_create_catalog_schema.sql
-- ==============================================================================

-- 1. LIMPIEZA DE TABLA CLIENTES
-- Quitar columna cédula e índices asociados
DROP INDEX IF EXISTS public.idx_clientes_cedula;
DROP INDEX IF EXISTS public.idx_clientes_cedula_unique;

ALTER TABLE public.clientes
DROP COLUMN IF EXISTS cedula CASCADE;

-- ==============================================================================
-- 2. TABLA FABRICANTES (Marcas de Vehículos y Fabricantes Alternos de Repuestos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fabricantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    pais_origen TEXT,
    tipo TEXT NOT NULL DEFAULT 'OEM' CHECK (tipo IN ('OEM', 'Aftermarket', 'Alterno')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fabricantes_nombre ON public.fabricantes (nombre);
CREATE INDEX IF NOT EXISTS idx_fabricantes_tipo ON public.fabricantes (tipo);

-- ==============================================================================
-- 3. TABLA MOTORES (Familias y Códigos de Motores Automotrices)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.motores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fabricante_id UUID REFERENCES public.fabricantes(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL, -- ej. 3L, 2L, 5L, Z24, TD27, 4D56, 1HZ
    cilindrada TEXT, -- ej. 2.8L, 2.4L, 2.5L
    configuracion TEXT, -- ej. 'L4 8V DIESEL', 'L4 12V GASOLINA'
    anio_inicio INTEGER,
    anio_fin INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_motores_codigo ON public.motores (codigo);
CREATE INDEX IF NOT EXISTS idx_motores_fabricante_id ON public.motores (fabricante_id);

-- ==============================================================================
-- 4. TABLA REPUESTOS (Piezas, Componentes y Medidas Dimensionales)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.repuestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL, -- Código de parte principal
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN (
        'Válvulas',
        'Guías de Válvula',
        'Sellos de Válvula',
        'Anillos',
        'Casquetería',
        'Pistones',
        'Camisas',
        'Empaques',
        'Pernos'
    )),
    fabricante_id UUID REFERENCES public.fabricantes(id) ON DELETE SET NULL,
    precio NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible', 'Bajo Stock', 'Agotado')),
    imagen_url TEXT,
    -- JSONB para medidas dimensionales indexables (búsqueda dimensional / adaptaciones)
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_repuestos_codigo ON public.repuestos (codigo);
CREATE INDEX IF NOT EXISTS idx_repuestos_categoria ON public.repuestos (categoria);
CREATE INDEX IF NOT EXISTS idx_repuestos_estado ON public.repuestos (estado);
-- Índice GIN para búsquedas dimensionales sobre especificaciones_tecnicas
CREATE INDEX IF NOT EXISTS idx_repuestos_especificaciones_tecnicas 
ON public.repuestos USING gin (especificaciones_tecnicas jsonb_path_ops);

-- ==============================================================================
-- 5. TABLA RELACIONAL REPUESTOS - MOTORES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.repuestos_motores (
    repuesto_id UUID REFERENCES public.repuestos(id) ON DELETE CASCADE,
    motor_id UUID REFERENCES public.motores(id) ON DELETE CASCADE,
    notas TEXT,
    PRIMARY KEY (repuesto_id, motor_id)
);

CREATE INDEX IF NOT EXISTS idx_repuestos_motores_motor ON public.repuestos_motores (motor_id);

-- ==============================================================================
-- 6. TABLA EQUIVALENCIAS TÉCNICAS (Mapeo OEM con Dokuro, Rik, NPR, NDC, Ajusa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.equivalencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repuesto_id UUID REFERENCES public.repuestos(id) ON DELETE CASCADE,
    marca TEXT NOT NULL, -- Dokuro, Rik, NPR, NDC, Ajusa, Taiho, Pioneer, OEM, etc.
    codigo_equivalente TEXT NOT NULL,
    tipo_equivalencia TEXT NOT NULL DEFAULT 'Directa' CHECK (tipo_equivalencia IN ('Directa', 'Adaptable con Maquinado', 'Sobremedida')),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_equivalencias_repuesto_id ON public.equivalencias (repuesto_id);
CREATE INDEX IF NOT EXISTS idx_equivalencias_marca ON public.equivalencias (marca);
CREATE INDEX IF NOT EXISTS idx_equivalencias_codigo ON public.equivalencias (codigo_equivalente);
CREATE INDEX IF NOT EXISTS idx_equivalencias_marca_codigo ON public.equivalencias (marca, codigo_equivalente);

-- ==============================================================================
-- 7. TRIGGERS UPDATED_AT AUTOMÁTICOS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_fabricantes_updated_at ON public.fabricantes;
CREATE TRIGGER tr_fabricantes_updated_at
BEFORE UPDATE ON public.fabricantes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_motores_updated_at ON public.motores;
CREATE TRIGGER tr_motores_updated_at
BEFORE UPDATE ON public.motores
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS tr_repuestos_updated_at ON public.repuestos;
CREATE TRIGGER tr_repuestos_updated_at
BEFORE UPDATE ON public.repuestos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

-- ==============================================================================
-- 8. DATOS SEMILLA BÁSICOS (Fabricantes Clave de Rectificación)
-- ==============================================================================
INSERT INTO public.fabricantes (nombre, tipo, pais_origen) VALUES
('Toyota', 'OEM', 'Japón'),
('Nissan', 'OEM', 'Japón'),
('Isuzu', 'OEM', 'Japón'),
('Mitsubishi', 'OEM', 'Japón'),
('Dokuro', 'Aftermarket', 'Japón'),
('Rik', 'Aftermarket', 'Japón'),
('NPR', 'Aftermarket', 'Japón'),
('NDC', 'Aftermarket', 'Japón'),
('Ajusa', 'Aftermarket', 'España'),
('Taiho', 'Aftermarket', 'Japón'),
('Pioneer', 'Aftermarket', 'Estados Unidos')
ON CONFLICT (nombre) DO NOTHING;
