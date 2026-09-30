-- Migración: Catálogo Técnico Automotriz Multimarca, Matrices de Equivalencia y Búsqueda Dimensional
-- Proyecto: SWGORA - Taller JR Blanco
-- Timestamp: 20260930000000

-- 1. Tabla de Fabricantes de Motores y Vehículos
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

-- 4. Tabla de Repuestos Técnicos Especializados de Motor
CREATE TABLE IF NOT EXISTS public.repuestos_tecnicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motor_id UUID REFERENCES public.motores(id) ON DELETE SET NULL,
    codigo_oem TEXT NOT NULL,
    nombre TEXT NOT NULL,
    subsistema TEXT NOT NULL, -- 'Culata', 'Cigüeñal', 'Block', 'Bielas', 'Sellos y Juntas'
    categoria TEXT NOT NULL,  -- 'Válvulas', 'Anillos', 'Casquetería', 'Sellos', 'Empaques', 'Pernos'
    precio NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'Disponible',
    imagen_url TEXT,
    
    -- Cotas Dimensionales Principales (Tratadas como números exactos en mm)
    diametro_cabeza_mm NUMERIC(10,3),
    diametro_vastago_mm NUMERIC(10,3),
    longitud_total_mm NUMERIC(10,3),
    angulo_asiento_grados NUMERIC(6,2),
    
    diametro_cilindro_mm NUMERIC(10,3),
    espesor_anillo1_mm NUMERIC(10,3),
    espesor_anillo2_mm NUMERIC(10,3),
    espesor_aceite_mm NUMERIC(10,3),
    
    tipo_cojinete TEXT, -- 'MS' (Bancada), 'CB' (Biela), 'TW' (Axial), 'SH' (Leva), 'PB' (Bocina)
    diametro_munon_mm NUMERIC(10,3),
    diametro_alojamiento_mm NUMERIC(10,3),
    ancho_casquete_mm NUMERIC(10,3),
    
    -- Atributos dimensionales dinámicos complementarios
    dimensiones JSONB NOT NULL DEFAULT '{}'::jsonb,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Tabla de Matriz de Equivalencias Multimarca (Dokuro, Rik, NPR, NDC, Ajusa, Pioneer, Taiho)
CREATE TABLE IF NOT EXISTS public.equivalencias_repuestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repuesto_id UUID NOT NULL REFERENCES public.repuestos_tecnicos(id) ON DELETE CASCADE,
    marca_alterna TEXT NOT NULL, -- 'Dokuro', 'Rik', 'NPR', 'NDC', 'Ajusa', 'Pioneer', 'Taiho', 'Toto', 'TIK'
    codigo_alterno TEXT NOT NULL,
    tipo_referencia TEXT NOT NULL DEFAULT 'Cruce Directo', -- 'Cruce Directo', 'Adaptación', 'Sobremedida 0.25', 'Sobremedida 0.50'
    notas TEXT,
    especificaciones_tecnicas JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_repuesto_marca_codigo UNIQUE (repuesto_id, marca_alterna, codigo_alterno)
);

-- 6. Triggers para actualizar updated_at automáticamente
CREATE TRIGGER set_fabricantes_updated_at
    BEFORE UPDATE ON public.fabricantes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_modelos_updated_at
    BEFORE UPDATE ON public.modelos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_motores_updated_at
    BEFORE UPDATE ON public.motores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_repuestos_tecnicos_updated_at
    BEFORE UPDATE ON public.repuestos_tecnicos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_equivalencias_repuestos_updated_at
    BEFORE UPDATE ON public.equivalencias_repuestos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Índices de Búsqueda Rápida y GIN para cotas dimensionales
CREATE INDEX IF NOT EXISTS idx_fabricantes_nombre ON public.fabricantes (nombre);
CREATE INDEX IF NOT EXISTS idx_motores_codigo ON public.motores (codigo);
CREATE INDEX IF NOT EXISTS idx_motores_fabricante_id ON public.motores (fabricante_id);
CREATE INDEX IF NOT EXISTS idx_repuestos_tecnicos_oem ON public.repuestos_tecnicos (codigo_oem);
CREATE INDEX IF NOT EXISTS idx_repuestos_tecnicos_motor ON public.repuestos_tecnicos (motor_id);
CREATE INDEX IF NOT EXISTS idx_repuestos_tecnicos_subsistema ON public.repuestos_tecnicos (subsistema);
CREATE INDEX IF NOT EXISTS idx_repuestos_tecnicos_categoria ON public.repuestos_tecnicos (categoria);
CREATE INDEX IF NOT EXISTS idx_equivalencias_codigo_alterno ON public.equivalencias_repuestos (codigo_alterno);
CREATE INDEX IF NOT EXISTS idx_equivalencias_marca_alterna ON public.equivalencias_repuestos (marca_alterna);

-- Índices GIN para especificaciones y dimensiones
CREATE INDEX IF NOT EXISTS idx_motores_specs_gin ON public.motores USING gin (especificaciones_tecnicas);
CREATE INDEX IF NOT EXISTS idx_repuestos_dimensiones_gin ON public.repuestos_tecnicos USING gin (dimensiones);
CREATE INDEX IF NOT EXISTS idx_repuestos_specs_gin ON public.repuestos_tecnicos USING gin (especificaciones_tecnicas);

-- 8. Seguridad: Row Level Security (RLS)
ALTER TABLE public.fabricantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repuestos_tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equivalencias_repuestos ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública/autenticada
CREATE POLICY "Permitir lectura de fabricantes" ON public.fabricantes FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de modelos" ON public.modelos FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de motores" ON public.motores FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de repuestos_tecnicos" ON public.repuestos_tecnicos FOR SELECT USING (true);
CREATE POLICY "Permitir lectura de equivalencias_repuestos" ON public.equivalencias_repuestos FOR SELECT USING (true);

-- Políticas de escritura para usuarios autenticados
CREATE POLICY "Permitir insert/update fabricantes autenticados" ON public.fabricantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insert/update modelos autenticados" ON public.modelos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insert/update motores autenticados" ON public.motores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insert/update repuestos_tecnicos autenticados" ON public.repuestos_tecnicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insert/update equivalencias autenticados" ON public.equivalencias_repuestos FOR ALL TO authenticated USING (true) WITH CHECK (true);
