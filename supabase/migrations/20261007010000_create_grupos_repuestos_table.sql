-- Migración: Tabla de Grupos / Familias de Repuestos y Parámetros Técnicos Dinámicos (JSONB)
-- Proyecto: SWGORA - Taller JR Blanco
-- Timestamp: 20261007010000

-- 1. Tabla de Grupos o Familias de Piezas
CREATE TABLE IF NOT EXISTS public.grupos_repuestos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    subsistema TEXT NOT NULL DEFAULT 'Block', -- 'Culata', 'Cigüeñal', 'Block', 'Bielas', 'Sellos y Juntas', etc.
    descripcion TEXT,
    icono TEXT DEFAULT 'Layers',
    parametros JSONB NOT NULL DEFAULT '[]'::jsonb, -- Esquema dinámico de medidas requeridas
    activo BOOLEAN NOT NULL DEFAULT true,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices B-tree y GIN
CREATE INDEX IF NOT EXISTS idx_grupos_repuestos_codigo ON public.grupos_repuestos(codigo);
CREATE INDEX IF NOT EXISTS idx_grupos_repuestos_categoria ON public.grupos_repuestos(categoria);
CREATE INDEX IF NOT EXISTS idx_grupos_repuestos_parametros ON public.grupos_repuestos USING gin(parametros);

-- Habilitar RLS
ALTER TABLE public.grupos_repuestos ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
DROP POLICY IF EXISTS "Permitir lectura publica de grupos_repuestos" ON public.grupos_repuestos;
CREATE POLICY "Permitir lectura publica de grupos_repuestos" ON public.grupos_repuestos 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir escritura de grupos_repuestos" ON public.grupos_repuestos;
CREATE POLICY "Permitir escritura de grupos_repuestos" ON public.grupos_repuestos 
    FOR ALL USING (true) WITH CHECK (true);

-- 2. Poblar los 4 grupos base del catálogo con sus esquemas paramétricos iniciales
INSERT INTO public.grupos_repuestos (id, codigo, nombre, categoria, subsistema, descripcion, icono, orden_visual, parametros) VALUES
(
    'a0000001-0000-0000-0000-000000000001',
    'ajuste_valvula',
    'Ajuste de válvula',
    'Sellos',
    'Sellos y Juntas',
    'Sellos y retenes de guía de válvula (Vitón / Alta temperatura)',
    'CircleDot',
    1,
    '[
        {"id": "p_sello_1", "clave": "diametro_interior_mm", "etiqueta": "Diámetro Interior", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Medida interna del retén"},
        {"id": "p_sello_2", "clave": "diametro_exterior_mm", "etiqueta": "Diámetro Exterior", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Diámetro de alojamiento en la guía"},
        {"id": "p_sello_3", "clave": "altura_mm", "etiqueta": "Altura Total", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Altura de la falda del sello"}
    ]'::jsonb
),
(
    'a0000001-0000-0000-0000-000000000002',
    'valvula',
    'Válvula de motor',
    'Válvulas',
    'Culata',
    'Válvulas de admisión y escape estándar y sobremedida',
    'Wrench',
    2,
    '[
        {"id": "p_valv_1", "clave": "diametro_cabeza_mm", "etiqueta": "Diámetro de Cabeza (Hongo)", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Diámetro mayor del plato o hongo"},
        {"id": "p_valv_2", "clave": "diametro_vastago_mm", "etiqueta": "Diámetro de Vástago", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Grosor del vástago"},
        {"id": "p_valv_3", "clave": "longitud_total_mm", "etiqueta": "Longitud Total", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Largo de punta a cabeza"},
        {"id": "p_valv_4", "clave": "angulo_asiento_grados", "etiqueta": "Ángulo de Asiento", "unidad": "°", "tipo_dato": "numero", "requerido": false, "descripcion": "Ángulo de rectificación (ej. 45°)"},
        {"id": "p_valv_5", "clave": "tipo_valvula", "etiqueta": "Tipo de Válvula", "unidad": "", "tipo_dato": "seleccion", "requerido": true, "opciones": ["Admisión", "Escape"], "descripcion": "Función en la culata"}
    ]'::jsonb
),
(
    'a0000001-0000-0000-0000-000000000003',
    'anillos_motor',
    'Anillos de motor',
    'Anillos',
    'Block',
    'Juegos de aros de pistón (Desglose explícito 1°, 2° y aceite)',
    'Layers',
    3,
    '[
        {"id": "p_anil_1", "clave": "diametro_cilindro_mm", "etiqueta": "Diámetro de Cilindro", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Calibre del orificio del cilindro"},
        {"id": "p_anil_2", "clave": "espesor_anillo1_mm", "etiqueta": "Espesor 1° Anillo (Compresión)", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Grosor del aro superior"},
        {"id": "p_anil_3", "clave": "espesor_anillo2_mm", "etiqueta": "Espesor 2° Anillo (Raspador)", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Grosor del segundo aro"},
        {"id": "p_anil_4", "clave": "espesor_aceite_mm", "etiqueta": "Espesor Anillo de Aceite", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Grosor del aro rascador de aceite"}
    ]'::jsonb
),
(
    'a0000001-0000-0000-0000-000000000004',
    'tornillos_culata',
    'Juego de tornillos de culata',
    'Pernos',
    'Culata',
    'Tornillos y pernos de apriete para culata de cilindros',
    'FileText',
    4,
    '[
        {"id": "p_pern_1", "clave": "medida_rosca", "etiqueta": "Medida de Rosca", "unidad": "", "tipo_dato": "texto", "requerido": true, "descripcion": "Métrica de rosca (ej. M10, M11, M12)"},
        {"id": "p_pern_2", "clave": "paso_rosca_mm", "etiqueta": "Paso de Rosca", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Paso entre crestas (ej. 1.25, 1.50)"},
        {"id": "p_pern_3", "clave": "longitud_perno_mm", "etiqueta": "Longitud del Perno", "unidad": "mm", "tipo_dato": "numero", "requerido": true, "descripcion": "Largo del espárrago bajo cabeza"},
        {"id": "p_pern_4", "clave": "cantidad_piezas", "etiqueta": "Cantidad de Piezas", "unidad": "piezas", "tipo_dato": "numero", "requerido": true, "descripcion": "Tornillos por juego"}
    ]'::jsonb
)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    categoria = EXCLUDED.categoria,
    subsistema = EXCLUDED.subsistema,
    descripcion = EXCLUDED.descripcion,
    parametros = EXCLUDED.parametros;
