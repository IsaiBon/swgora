-- ==========================================================================
-- MIGRACIÓN: Personalización de Pantalla de Login en tabla public.taller
-- Permite al usuario Administrador personalizar título, subtítulo, mensaje
-- y fondo de pantalla de inicio de sesión desde el Módulo de Taller.
-- ==========================================================================

ALTER TABLE IF EXISTS public.taller
  ADD COLUMN IF NOT EXISTS login_titulo TEXT DEFAULT 'JR Blanco',
  ADD COLUMN IF NOT EXISTS login_subtitulo TEXT DEFAULT 'Taller Industrial y Rectificado de Motores',
  ADD COLUMN IF NOT EXISTS login_mensaje TEXT DEFAULT 'Ingresa tus credenciales para acceder al sistema',
  ADD COLUMN IF NOT EXISTS login_bg_url TEXT DEFAULT '/images/workshop-bg.jpg';

COMMENT ON COLUMN public.taller.login_titulo IS 'Título comercial destacado en la tarjeta de login';
COMMENT ON COLUMN public.taller.login_subtitulo IS 'Subtítulo o descripción de giro en la tarjeta de login';
COMMENT ON COLUMN public.taller.login_mensaje IS 'Mensaje de bienvenida o instrucciones de acceso';
COMMENT ON COLUMN public.taller.login_bg_url IS 'URL de la imagen de fondo (wallpaper) de la pantalla de login';
