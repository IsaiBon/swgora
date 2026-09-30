-- ==============================================================================
-- MIGRACIÓN: Agregar columna codigo único a la tabla clientes
-- Archivo: 20260930010000_add_codigo_to_clientes.sql
-- ==============================================================================

ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON public.clientes (codigo);

-- Asignar códigos automáticos a los clientes existentes que no tengan código asignado
UPDATE public.clientes
SET codigo = CASE 
    WHEN tipo = 'Tallerista' THEN 'TAL-' || LPAD(SUBSTRING(id::text from 1 for 4), 3, '0')
    ELSE 'CLI-' || LPAD(SUBSTRING(id::text from 1 for 4), 3, '0')
END
WHERE codigo IS NULL;
