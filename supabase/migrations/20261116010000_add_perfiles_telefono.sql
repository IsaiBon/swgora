-- Campo opcional de teléfono de contacto en `public.perfiles` (visible en la ficha de usuario)
ALTER TABLE IF EXISTS public.perfiles
  ADD COLUMN IF NOT EXISTS telefono TEXT;
