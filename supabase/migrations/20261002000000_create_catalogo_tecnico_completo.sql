-- Migración: Catálogo Técnico Automotriz Completo y Motor de Adaptaciones
-- Proyecto: SWGORA - Taller JR Blanco
-- Timestamp: 20261002000000

-- 1. Tabla de Fabricantes / Marcas Vehiculares
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

-- 2. Tabla de Modelos de Vehículos
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

-- 3. Tabla de Motores Automotrices
CREATE TABLE IF NOT EXISTS public.motores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fabricante_id UUID NOT NULL REFERENCES public.fabricantes(id) ON DELETE CASCADE,
    modelo_id UUID REFERENCES public.modelos(id) ON DELETE SET NULL,
    codigo TEXT NOT NULL,
    nombre_comercial TEXT,
    cilindrada_cc INTEGER,
    combustible TEXT NOT NULL DEFAULT 'Diésel',
    cilindros INTEGER NOT NULL DEFAULT 4,
    valvulas INTEGER NOT NULL DEFAULT 8,
    diametro_cilindro_std_mm NUMERIC(10,3),
    carrera_piston_mm NUMERIC(10,3),
    configuracion TEXT,
    aspiracion TEXT,
    anios TEXT,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Tabla de Repuestos Técnicos y Cotas Dimensionales
CREATE TABLE IF NOT EXISTS public.repuestos_tecnicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motor_id UUID REFERENCES public.motores(id) ON DELETE SET NULL,
    codigo_oem TEXT NOT NULL,
    nombre TEXT NOT NULL,
    subsistema TEXT NOT NULL, -- 'Culata', 'Cigüeñal', 'Block', 'Bielas', 'Sellos y Juntas'
    categoria TEXT NOT NULL,  -- 'Válvulas', 'Anillos', 'Casquetería', 'Sellos', 'Pernos', 'Empaques'
    precio NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'Disponible',
    imagen_url TEXT,
    catalogo_origen TEXT DEFAULT 'OEM', -- Dokuro, Rik, NPR, NDC, Ajusa, Pioneer
    
    -- Cotas Dimensionales - Válvulas
    diametro_cabeza_mm NUMERIC(10,3),
    diametro_vastago_mm NUMERIC(10,3),
    longitud_total_mm NUMERIC(10,3),
    angulo_asiento_grados NUMERIC(6,2),
    tipo_valvula TEXT, -- 'Admisión', 'Escape'
    
    -- Cotas Dimensionales - Sellos / Ajuste de Válvula
    diametro_interior_mm NUMERIC(10,3),
    diametro_exterior_mm NUMERIC(10,3),
    altura_mm NUMERIC(10,3),

    -- Cotas Dimensionales - Anillos de Pistón
    diametro_cilindro_mm NUMERIC(10,3),
    espesor_anillo1_mm NUMERIC(10,3),
    espesor_anillo2_mm NUMERIC(10,3),
    espesor_aceite_mm NUMERIC(10,3),
    
    -- Cotas Dimensionales - Cojinetes / Casquetes NDC
    tipo_cojinete TEXT, -- 'MS' (Bancada), 'CB' (Biela), 'TW' (Axial), 'SH' (Leva), 'PB' (Bocina)
    diametro_munon_mm NUMERIC(10,3),
    diametro_alojamiento_mm NUMERIC(10,3),
    ancho_casquete_mm NUMERIC(10,3),
    
    -- Cotas Dimensionales - Pernos / Tornillos de Culata
    medida_rosca TEXT, -- 'M10', 'M11', 'M12'
    paso_rosca_mm NUMERIC(10,3),
    longitud_perno_mm NUMERIC(10,3),
    cantidad_piezas INTEGER,
    paso_rosca1_mm NUMERIC(10,3),
    longitud1_mm NUMERIC(10,3),
    longitud2_mm NUMERIC(10,3),
    
    -- Atributos dimensionales complementarios (JSONB indexable)
    dimensiones JSONB NOT NULL DEFAULT '{}'::jsonb,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Tabla de Matriz de Equivalencias Multimarca
CREATE TABLE IF NOT EXISTS public.equivalencias_repuestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repuesto_id UUID NOT NULL REFERENCES public.repuestos_tecnicos(id) ON DELETE CASCADE,
    marca_alterna TEXT NOT NULL, -- 'Dokuro', 'Rik', 'NPR', 'NDC', 'Ajusa', 'Pioneer', 'Taiho'
    codigo_alterno TEXT NOT NULL,
    tipo_referencia TEXT NOT NULL DEFAULT 'Cruce Directo', -- 'Cruce Directo', 'Adaptación', 'Sobremedida'
    notas TEXT,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_repuesto_marca_codigo UNIQUE (repuesto_id, marca_alterna, codigo_alterno)
);

-- Índices de Rendimiento y Búsqueda Dimensional Rápida
CREATE INDEX IF NOT EXISTS idx_repuestos_oem ON public.repuestos_tecnicos(codigo_oem);
CREATE INDEX IF NOT EXISTS idx_repuestos_categoria ON public.repuestos_tecnicos(categoria);
CREATE INDEX IF NOT EXISTS idx_repuestos_subsistema ON public.repuestos_tecnicos(subsistema);
CREATE INDEX IF NOT EXISTS idx_repuestos_sellos ON public.repuestos_tecnicos(diametro_interior_mm, diametro_exterior_mm, altura_mm);
CREATE INDEX IF NOT EXISTS idx_repuestos_valvulas ON public.repuestos_tecnicos(diametro_cabeza_mm, diametro_vastago_mm, longitud_total_mm);
CREATE INDEX IF NOT EXISTS idx_repuestos_anillos ON public.repuestos_tecnicos(diametro_cilindro_mm, espesor_anillo1_mm, espesor_anillo2_mm, espesor_aceite_mm);
CREATE INDEX IF NOT EXISTS idx_repuestos_pernos ON public.repuestos_tecnicos(medida_rosca, paso_rosca_mm, longitud_perno_mm);
CREATE INDEX IF NOT EXISTS idx_repuestos_dimensiones_gin ON public.repuestos_tecnicos USING GIN(dimensiones);
CREATE INDEX IF NOT EXISTS idx_repuestos_specs_gin ON public.repuestos_tecnicos USING GIN(especificaciones_tecnicas);
CREATE INDEX IF NOT EXISTS idx_equiv_codigo_alterno ON public.equivalencias_repuestos(codigo_alterno);
CREATE INDEX IF NOT EXISTS idx_equiv_marca_alterna ON public.equivalencias_repuestos(marca_alterna);

-- Políticas RLS
ALTER TABLE public.fabricantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repuestos_tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equivalencias_repuestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública fabricantes" ON public.fabricantes FOR SELECT USING (true);
CREATE POLICY "Lectura pública modelos" ON public.modelos FOR SELECT USING (true);
CREATE POLICY "Lectura pública motores" ON public.motores FOR SELECT USING (true);
CREATE POLICY "Lectura pública repuestos" ON public.repuestos_tecnicos FOR SELECT USING (true);
CREATE POLICY "Lectura pública equivalencias" ON public.equivalencias_repuestos FOR SELECT USING (true);
