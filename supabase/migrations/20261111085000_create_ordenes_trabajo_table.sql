-- Migración: Crear tabla public.ordenes_trabajo con soporte completo para SWGORA
CREATE TABLE IF NOT EXISTS public.ordenes_trabajo (
    id TEXT PRIMARY KEY,
    numero_orden TEXT NOT NULL,
    cliente TEXT NOT NULL,
    cliente_id TEXT,
    cliente_codigo TEXT,
    cliente_telefono TEXT,
    cliente_direccion TEXT,
    taller TEXT,
    taller_codigo TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega DATE,
    estado TEXT NOT NULL DEFAULT 'En Proceso',
    tipo TEXT NOT NULL DEFAULT 'orden',
    marca_vehiculo TEXT,
    modelo_vehiculo TEXT,
    anio_vehiculo TEXT,
    numero_motor TEXT,
    tipo_motor TEXT,
    observaciones TEXT,
    componente TEXT,
    motor TEXT,
    operaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    repuestos JSONB NOT NULL DEFAULT '[]'::jsonb,
    materiales JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_mano_obra NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_repuestos NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_materiales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tiene_iva BOOLEAN NOT NULL DEFAULT FALSE,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    iva NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cantidad_items INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_fecha ON public.ordenes_trabajo (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_estado ON public.ordenes_trabajo (estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_cliente ON public.ordenes_trabajo (cliente);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_taller ON public.ordenes_trabajo (taller);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_componente ON public.ordenes_trabajo (componente);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.ordenes_trabajo ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para lectura y escritura abierta a roles autorizados
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ordenes_trabajo' AND policyname = 'Permitir lectura para todos') THEN
    CREATE POLICY "Permitir lectura para todos" ON public.ordenes_trabajo FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ordenes_trabajo' AND policyname = 'Permitir insercion para todos') THEN
    CREATE POLICY "Permitir insercion para todos" ON public.ordenes_trabajo FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ordenes_trabajo' AND policyname = 'Permitir actualizacion para todos') THEN
    CREATE POLICY "Permitir actualizacion para todos" ON public.ordenes_trabajo FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ordenes_trabajo' AND policyname = 'Permitir eliminacion para todos') THEN
    CREATE POLICY "Permitir eliminacion para todos" ON public.ordenes_trabajo FOR DELETE USING (true);
  END IF;
END
$$;
