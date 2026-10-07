-- Migración: Habilitar políticas de escritura y poblar repuestos para todos los motores de Supabase
-- Timestamp: 20261007000000

-- 1. Políticas de inserción y actualización para usuarios anon y authenticated
DROP POLICY IF EXISTS "Permitir insert/update fabricantes autenticados" ON public.fabricantes;
DROP POLICY IF EXISTS "Permitir insert/update modelos autenticados" ON public.modelos;
DROP POLICY IF EXISTS "Permitir insert/update motores autenticados" ON public.motores;
DROP POLICY IF EXISTS "Permitir insert/update repuestos_tecnicos autenticados" ON public.repuestos_tecnicos;
DROP POLICY IF EXISTS "Permitir insert/update equivalencias autenticados" ON public.equivalencias_repuestos;

DROP POLICY IF EXISTS "Permitir escritura de fabricantes" ON public.fabricantes;
CREATE POLICY "Permitir escritura de fabricantes" ON public.fabricantes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir escritura de modelos" ON public.modelos;
CREATE POLICY "Permitir escritura de modelos" ON public.modelos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir escritura de motores" ON public.motores;
CREATE POLICY "Permitir escritura de motores" ON public.motores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir escritura de repuestos_tecnicos" ON public.repuestos_tecnicos;
CREATE POLICY "Permitir escritura de repuestos_tecnicos" ON public.repuestos_tecnicos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir escritura de equivalencias_repuestos" ON public.equivalencias_repuestos;
CREATE POLICY "Permitir escritura de equivalencias_repuestos" ON public.equivalencias_repuestos FOR ALL USING (true) WITH CHECK (true);

-- 2. Poblar repuestos para Toyota 5L / 5L-E (id: baaa0001-0000-0000-0000-000000000003)
INSERT INTO public.repuestos_tecnicos (
    id, motor_id, codigo_oem, nombre, subsistema, categoria, precio, stock, estado,
    diametro_cabeza_mm, diametro_vastago_mm, longitud_total_mm, angulo_asiento_grados, tipo_valvula,
    diametro_cilindro_mm, espesor_anillo1_mm, espesor_anillo2_mm, espesor_aceite_mm,
    tipo_cojinete, diametro_munon_mm, diametro_alojamiento_mm, ancho_casquete_mm
) VALUES
('c0000003-0000-0000-0000-000000000001', 'baaa0001-0000-0000-0000-000000000003', '13711-54020', 'Válvula de Admisión (STD) 5L', 'Culata', 'Válvulas', 175.00, 24, 'Disponible', 42.500, 8.000, 103.500, 45.00, 'Admisión', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000003-0000-0000-0000-000000000002', 'baaa0001-0000-0000-0000-000000000003', '13715-54020', 'Válvula de Escape (STD) 5L', 'Culata', 'Válvulas', 195.00, 24, 'Disponible', 36.000, 8.000, 103.500, 45.00, 'Escape', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000003-0000-0000-0000-000000000003', 'baaa0001-0000-0000-0000-000000000003', '13011-54130', 'Juego de Anillos STD (99.5mm) 5L', 'Block', 'Anillos', 950.00, 12, 'Disponible', NULL, NULL, NULL, NULL, NULL, 99.500, 2.000, 1.500, 4.000, NULL, NULL, NULL, NULL),
('c0000003-0000-0000-0000-000000000004', 'baaa0001-0000-0000-0000-000000000003', '11701-54030', 'Juego de Cojinetes de Bancada STD 5L', 'Cigüeñal', 'Casquetería', 690.00, 8, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MS', 62.000, 67.000, 23.000),
('c0000003-0000-0000-0000-000000000005', 'baaa0001-0000-0000-0000-000000000003', '13041-54030', 'Juego de Cojinetes de Biela STD 5L', 'Bielas', 'Casquetería', 510.00, 10, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CB', 53.000, 56.000, 24.000),
('c0000003-0000-0000-0000-000000000006', 'baaa0001-0000-0000-0000-000000000003', '11115-54130', 'Empaque de Culata Grafito 5L', 'Culata', 'Empaques', 780.00, 7, 'Disponible', NULL, NULL, NULL, NULL, NULL, 100.500, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    precio = EXCLUDED.precio,
    stock = EXCLUDED.stock;

-- Equivalencias para 5L
INSERT INTO public.equivalencias_repuestos (id, repuesto_id, marca_alterna, codigo_alterno, tipo_referencia, notas) VALUES
('e0000003-0000-0000-0000-000000000001', 'c0000003-0000-0000-0000-000000000001', 'Dokuro', '21-2856', 'Cruce Directo', 'Japón STD Cabeza 42.5mm'),
('e0000003-0000-0000-0000-000000000002', 'c0000003-0000-0000-0000-000000000002', 'Dokuro', '22-2856', 'Cruce Directo', 'Japón STD Stellite'),
('e0000003-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', 'Rik', '28020', 'Cruce Directo', 'Riken Japón 99.5mm STD'),
('e0000003-0000-0000-0000-000000000004', 'c0000003-0000-0000-0000-000000000003', 'NPR', 'SDT10167ZZ', 'Cruce Directo', 'NPR Japón OEM 2.0/1.5/4.0mm'),
('e0000003-0000-0000-0000-000000000005', 'c0000003-0000-0000-0000-000000000004', 'NDC', 'MS-1140A', 'Cruce Directo', 'NDC Main Bearing STD'),
('e0000003-0000-0000-0000-000000000006', 'c0000003-0000-0000-0000-000000000005', 'NDC', 'CB-1140A', 'Cruce Directo', 'NDC Con-rod Bearing STD'),
('e0000003-0000-0000-0000-000000000007', 'c0000003-0000-0000-0000-000000000006', 'Ajusa', '10111400', 'Cruce Directo', 'Junta culata 5L grafito')
ON CONFLICT (id) DO NOTHING;

-- 3. Poblar repuestos para Mitsubishi 4D56 (id: baaa0003-0000-0000-0000-000000000001)
INSERT INTO public.repuestos_tecnicos (
    id, motor_id, codigo_oem, nombre, subsistema, categoria, precio, stock, estado,
    diametro_cabeza_mm, diametro_vastago_mm, longitud_total_mm, angulo_asiento_grados, tipo_valvula,
    diametro_cilindro_mm, espesor_anillo1_mm, espesor_anillo2_mm, espesor_aceite_mm,
    tipo_cojinete, diametro_munon_mm, diametro_alojamiento_mm, ancho_casquete_mm
) VALUES
('c0000004-0000-0000-0000-000000000001', 'baaa0003-0000-0000-0000-000000000001', 'MD016301', 'Válvula de Admisión 4D56 (STD)', 'Culata', 'Válvulas', 155.00, 20, 'Disponible', 40.000, 8.000, 136.500, 45.00, 'Admisión', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000004-0000-0000-0000-000000000002', 'baaa0003-0000-0000-0000-000000000001', 'MD016302', 'Válvula de Escape 4D56 (STD)', 'Culata', 'Válvulas', 175.00, 20, 'Disponible', 34.000, 8.000, 136.500, 45.00, 'Escape', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000004-0000-0000-0000-000000000003', 'baaa0003-0000-0000-0000-000000000001', 'MD050390', 'Juego de Anillos STD (91.1mm) 4D56', 'Block', 'Anillos', 860.00, 14, 'Disponible', NULL, NULL, NULL, NULL, NULL, 91.100, 2.500, 2.000, 4.000, NULL, NULL, NULL, NULL),
('c0000004-0000-0000-0000-000000000004', 'baaa0003-0000-0000-0000-000000000001', 'MD100021', 'Juego Cojinetes Bancada 4D56 STD', 'Cigüeñal', 'Casquetería', 650.00, 9, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MS', 66.000, 70.000, 23.000),
('c0000004-0000-0000-0000-000000000005', 'baaa0003-0000-0000-0000-000000000001', 'MD100023', 'Juego Cojinetes Biela 4D56 STD', 'Bielas', 'Casquetería', 470.00, 12, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CB', 53.000, 56.000, 21.000),
('c0000004-0000-0000-0000-000000000006', 'baaa0003-0000-0000-0000-000000000001', 'MD302889', 'Empaque de Culata Grafito 4D56', 'Culata', 'Empaques', 720.00, 7, 'Disponible', NULL, NULL, NULL, NULL, NULL, 92.000, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    precio = EXCLUDED.precio,
    stock = EXCLUDED.stock;

-- Equivalencias para 4D56
INSERT INTO public.equivalencias_repuestos (id, repuesto_id, marca_alterna, codigo_alterno, tipo_referencia, notas) VALUES
('e0000004-0000-0000-0000-000000000001', 'c0000004-0000-0000-0000-000000000001', 'Dokuro', '31-2311', 'Cruce Directo', 'Admisión 40.0x8.0x136.5mm'),
('e0000004-0000-0000-0000-000000000002', 'c0000004-0000-0000-0000-000000000002', 'Dokuro', '32-2311', 'Cruce Directo', 'Escape 34.0x8.0x136.5mm'),
('e0000004-0000-0000-0000-000000000003', 'c0000004-0000-0000-0000-000000000003', 'NPR', 'SDM31038ZX', 'Cruce Directo', 'NPR Japón OEM 2.5/2.0/4.0mm'),
('e0000004-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000003', 'Rik', '28410', 'Cruce Directo', '91.1mm STD'),
('e0000004-0000-0000-0000-000000000005', 'c0000004-0000-0000-0000-000000000004', 'NDC', 'MS-1804A', 'Cruce Directo', 'Bancada MS 4D56 STD'),
('e0000004-0000-0000-0000-000000000006', 'c0000004-0000-0000-0000-000000000005', 'NDC', 'CB-1804A', 'Cruce Directo', 'Biela CB 4D56 STD'),
('e0000004-0000-0000-0000-000000000007', 'c0000004-0000-0000-0000-000000000006', 'Ajusa', '10070500', 'Cruce Directo', 'Junta culata 4D56T')
ON CONFLICT (id) DO NOTHING;

-- 4. Poblar repuestos para Isuzu 4JB1 (id: baaa0004-0000-0000-0000-000000000001)
INSERT INTO public.repuestos_tecnicos (
    id, motor_id, codigo_oem, nombre, subsistema, categoria, precio, stock, estado,
    diametro_cabeza_mm, diametro_vastago_mm, longitud_total_mm, angulo_asiento_grados, tipo_valvula,
    diametro_cilindro_mm, espesor_anillo1_mm, espesor_anillo2_mm, espesor_aceite_mm,
    tipo_cojinete, diametro_munon_mm, diametro_alojamiento_mm, ancho_casquete_mm
) VALUES
('c0000005-0000-0000-0000-000000000001', 'baaa0004-0000-0000-0000-000000000001', '8-94133221-0', 'Válvula Admisión 4JB1 (STD)', 'Culata', 'Válvulas', 170.00, 24, 'Disponible', 43.500, 8.000, 109.500, 45.00, 'Admisión', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000005-0000-0000-0000-000000000002', 'baaa0004-0000-0000-0000-000000000001', '8-94133222-0', 'Válvula Escape 4JB1 (STD)', 'Culata', 'Válvulas', 190.00, 24, 'Disponible', 37.000, 8.000, 109.500, 45.00, 'Escape', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000005-0000-0000-0000-000000000003', 'baaa0004-0000-0000-0000-000000000001', '8-94247-867-0', 'Juego de Anillos STD (93mm) 4JB1', 'Block', 'Anillos', 920.00, 12, 'Disponible', NULL, NULL, NULL, NULL, NULL, 93.000, 2.000, 2.000, 4.000, NULL, NULL, NULL, NULL),
('c0000005-0000-0000-0000-000000000004', 'baaa0004-0000-0000-0000-000000000001', '8-97176-683-0', 'Camisa de Cilindro Semiterminada 4JB1', 'Block', 'Camisas', 460.00, 16, 'Disponible', NULL, NULL, NULL, NULL, NULL, 93.000, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000005-0000-0000-0000-000000000005', 'baaa0004-0000-0000-0000-000000000001', '8-94453520-0', 'Juego Cojinetes Bancada 4JB1 STD', 'Cigüeñal', 'Casquetería', 710.00, 8, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MS', 70.000, 75.000, 25.000),
('c0000005-0000-0000-0000-000000000006', 'baaa0004-0000-0000-0000-000000000001', '8-94453518-0', 'Juego Cojinetes Biela 4JB1 STD', 'Bielas', 'Casquetería', 520.00, 10, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CB', 53.000, 56.000, 22.000),
('c0000005-0000-0000-0000-000000000007', 'baaa0004-0000-0000-0000-000000000001', '8-94332326-0', 'Empaque de Culata Grafito 4JB1', 'Culata', 'Empaques', 740.00, 6, 'Disponible', NULL, NULL, NULL, NULL, NULL, 94.000, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    precio = EXCLUDED.precio,
    stock = EXCLUDED.stock;

-- Equivalencias para 4JB1
INSERT INTO public.equivalencias_repuestos (id, repuesto_id, marca_alterna, codigo_alterno, tipo_referencia, notas) VALUES
('e0000005-0000-0000-0000-000000000001', 'c0000005-0000-0000-0000-000000000001', 'Dokuro', '41-2401', 'Cruce Directo', 'Admisión 43.5x8.0x109.5mm'),
('e0000005-0000-0000-0000-000000000002', 'c0000005-0000-0000-0000-000000000002', 'Dokuro', '42-2401', 'Cruce Directo', 'Escape 37.0x8.0x109.5mm'),
('e0000005-0000-0000-0000-000000000003', 'c0000005-0000-0000-0000-000000000003', 'NPR', 'SDI10110ZX', 'Cruce Directo', 'NPR Japón OEM 2.0/2.0/4.0mm'),
('e0000005-0000-0000-0000-000000000004', 'c0000005-0000-0000-0000-000000000004', 'NPR', 'L65005-DA', 'Cruce Directo', 'Camisa NPR Ø93 x 95 x 165mm'),
('e0000005-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', 'NDC', 'MS-1402A', 'Cruce Directo', 'Bancada MS 4JB1 STD'),
('e0000005-0000-0000-0000-000000000006', 'c0000005-0000-0000-0000-000000000006', 'NDC', 'CB-1402A', 'Cruce Directo', 'Biela CB 4JB1 STD'),
('e0000005-0000-0000-0000-000000000007', 'c0000005-0000-0000-0000-000000000007', 'Ajusa', '10091000', 'Cruce Directo', 'Junta culata 4JB1 Isuzu')
ON CONFLICT (id) DO NOTHING;

-- 5. Poblar repuestos para Nissan YD25DDTi (id: baaa0002-0000-0000-0000-000000000002)
INSERT INTO public.repuestos_tecnicos (
    id, motor_id, codigo_oem, nombre, subsistema, categoria, precio, stock, estado,
    diametro_cabeza_mm, diametro_vastago_mm, longitud_total_mm, angulo_asiento_grados, tipo_valvula,
    diametro_cilindro_mm, espesor_anillo1_mm, espesor_anillo2_mm, espesor_aceite_mm,
    tipo_cojinete, diametro_munon_mm, diametro_alojamiento_mm, ancho_casquete_mm
) VALUES
('c0000006-0000-0000-0000-000000000001', 'baaa0002-0000-0000-0000-000000000002', '13201-EB300', 'Válvula Admisión YD25 Common Rail (STD)', 'Culata', 'Válvulas', 185.00, 32, 'Disponible', 28.000, 6.000, 98.600, 45.00, 'Admisión', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000006-0000-0000-0000-000000000002', 'baaa0002-0000-0000-0000-000000000002', '13202-EB300', 'Válvula Escape YD25 Common Rail (STD)', 'Culata', 'Válvulas', 205.00, 32, 'Disponible', 26.000, 6.000, 98.600, 45.00, 'Escape', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000006-0000-0000-0000-000000000003', 'baaa0002-0000-0000-0000-000000000002', '12033-VK520', 'Juego de Anillos STD (89mm) YD25DDTi', 'Block', 'Anillos', 1180.00, 10, 'Disponible', NULL, NULL, NULL, NULL, NULL, 89.000, 2.000, 2.000, 3.000, NULL, NULL, NULL, NULL),
('c0000006-0000-0000-0000-000000000004', 'baaa0002-0000-0000-0000-000000000002', '12207-AD200', 'Juego Cojinetes Bancada STD YD25', 'Cigüeñal', 'Casquetería', 720.00, 8, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MS', 63.000, 67.000, 22.000),
('c0000006-0000-0000-0000-000000000005', 'baaa0002-0000-0000-0000-000000000002', '12111-AD200', 'Juego Cojinetes Biela STD YD25', 'Bielas', 'Casquetería', 540.00, 10, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CB', 50.000, 53.000, 19.500),
('c0000006-0000-0000-0000-000000000006', 'baaa0002-0000-0000-0000-000000000002', '11044-VK505', 'Empaque de Culata Multilámina MLS YD25', 'Culata', 'Empaques', 1220.00, 6, 'Disponible', NULL, NULL, NULL, NULL, NULL, 90.000, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    precio = EXCLUDED.precio,
    stock = EXCLUDED.stock;

-- Equivalencias para YD25
INSERT INTO public.equivalencias_repuestos (id, repuesto_id, marca_alterna, codigo_alterno, tipo_referencia, notas) VALUES
('e0000006-0000-0000-0000-000000000001', 'c0000006-0000-0000-0000-000000000001', 'Dokuro', '21-4112', 'Cruce Directo', 'Admisión YD25 16V'),
('e0000006-0000-0000-0000-000000000002', 'c0000006-0000-0000-0000-000000000002', 'Dokuro', '22-4112', 'Cruce Directo', 'Escape YD25 16V Stellite'),
('e0000006-0000-0000-0000-000000000003', 'c0000006-0000-0000-0000-000000000003', 'NPR', 'SDN30182ZZ', 'Cruce Directo', 'NPR Japón OEM 2.0/2.0/3.0mm'),
('e0000006-0000-0000-0000-000000000004', 'c0000006-0000-0000-0000-000000000003', 'Rik', '20185', 'Cruce Directo', 'Riken Japón 89mm STD'),
('e0000006-0000-0000-0000-000000000005', 'c0000006-0000-0000-0000-000000000004', 'NDC', 'MS-1125A', 'Cruce Directo', 'NDC Bancada MS YD25'),
('e0000006-0000-0000-0000-000000000006', 'c0000006-0000-0000-0000-000000000005', 'NDC', 'CB-1125A', 'Cruce Directo', 'NDC Biela CB YD25'),
('e0000006-0000-0000-0000-000000000007', 'c0000006-0000-0000-0000-000000000006', 'Ajusa', '10160800', 'Cruce Directo', 'Junta culata MLS YD25DDTi')
ON CONFLICT (id) DO NOTHING;

-- 6. Añadir un nuevo elemento (Motor Honda K20A y sus repuestos técnicos)
-- Para demostrar creación dinámica y enriquecimiento de base de datos
INSERT INTO public.modelos (id, fabricante_id, nombre, anio_inicio, anio_fin, activo)
VALUES ('a0000005-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', 'Civic / CR-V', 2001, 2015, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.motores (
    id, fabricante_id, modelo_id, codigo, nombre_comercial, denominacion_venta,
    cilindrada_cc, combustible, cilindros, valvulas, diametro_cilindro_std_mm, carrera_piston_mm,
    configuracion, aspiracion, anios, especificaciones_tecnicas
) VALUES (
    'baaa0005-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000005',
    'a0000005-0000-0000-0000-000000000001',
    'K20A / K24A',
    '2.0L / 2.4L i-VTEC DOHC 16V',
    'K-Series',
    1998,
    'Gasolina',
    4,
    16,
    86.000,
    86.000,
    'L4 DOHC i-VTEC',
    'Atmosférico',
    '2001 - 2015',
    '{"torque_biela_nm": 42, "torque_bancada_nm": 65, "luz_aceite_std_mm": 0.035}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    nombre_comercial = EXCLUDED.nombre_comercial;

-- Repuestos para Honda K20A
INSERT INTO public.repuestos_tecnicos (
    id, motor_id, codigo_oem, nombre, subsistema, categoria, precio, stock, estado,
    diametro_cabeza_mm, diametro_vastago_mm, longitud_total_mm, angulo_asiento_grados, tipo_valvula,
    diametro_cilindro_mm, espesor_anillo1_mm, espesor_anillo2_mm, espesor_aceite_mm,
    tipo_cojinete, diametro_munon_mm, diametro_alojamiento_mm, ancho_casquete_mm
) VALUES
('c0000007-0000-0000-0000-000000000001', 'baaa0005-0000-0000-0000-000000000001', '14711-PRB-A00', 'Válvula de Admisión STD K20A', 'Culata', 'Válvulas', 195.00, 24, 'Disponible', 35.000, 5.500, 109.000, 45.00, 'Admisión', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000007-0000-0000-0000-000000000002', 'baaa0005-0000-0000-0000-000000000001', '14721-PRB-A00', 'Válvula de Escape STD K20A', 'Culata', 'Válvulas', 215.00, 24, 'Disponible', 30.000, 5.500, 108.800, 45.00, 'Escape', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('c0000007-0000-0000-0000-000000000003', 'baaa0005-0000-0000-0000-000000000001', '13011-PNA-004', 'Juego de Anillos STD (86mm) K20A', 'Block', 'Anillos', 980.00, 10, 'Disponible', NULL, NULL, NULL, NULL, NULL, 86.000, 1.200, 1.200, 2.000, NULL, NULL, NULL, NULL),
('c0000007-0000-0000-0000-000000000004', 'baaa0005-0000-0000-0000-000000000001', '13321-PRB-A01', 'Juego Cojinetes Bancada STD K20A', 'Cigüeñal', 'Casquetería', 740.00, 8, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MS', 55.000, 59.000, 19.000),
('c0000007-0000-0000-0000-000000000005', 'baaa0005-0000-0000-0000-000000000001', '13211-PRB-A01', 'Juego Cojinetes Biela STD K20A', 'Bielas', 'Casquetería', 560.00, 10, 'Disponible', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CB', 45.000, 48.000, 16.000),
('c0000007-0000-0000-0000-000000000006', 'baaa0005-0000-0000-0000-000000000001', '12251-RBB-004', 'Empaque de Culata MLS K20A/K24A', 'Culata', 'Empaques', 1150.00, 8, 'Disponible', NULL, NULL, NULL, NULL, NULL, 87.000, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    precio = EXCLUDED.precio,
    stock = EXCLUDED.stock;

-- Equivalencias para Honda K20A
INSERT INTO public.equivalencias_repuestos (id, repuesto_id, marca_alterna, codigo_alterno, tipo_referencia, notas) VALUES
('e0000007-0000-0000-0000-000000000001', 'c0000007-0000-0000-0000-000000000001', 'Dokuro', '51-1201', 'Cruce Directo', 'Admisión K20A 35x5.5x109mm'),
('e0000007-0000-0000-0000-000000000002', 'c0000007-0000-0000-0000-000000000002', 'Dokuro', '52-1201', 'Cruce Directo', 'Escape K20A 30x5.5x108.8mm Stellite'),
('e0000007-0000-0000-0000-000000000003', 'c0000007-0000-0000-0000-000000000003', 'NPR', 'SWH30037ZZ', 'Cruce Directo', 'NPR Japón 86mm STD 1.2/1.2/2.0mm'),
('e0000007-0000-0000-0000-000000000004', 'c0000007-0000-0000-0000-000000000003', 'Rik', '24050', 'Cruce Directo', 'Riken Japón 86mm STD'),
('e0000007-0000-0000-0000-000000000005', 'c0000007-0000-0000-0000-000000000004', 'Taiho', 'M461A', 'Cruce Directo', 'Taiho Japón Bancada K20 STD'),
('e0000007-0000-0000-0000-000000000006', 'c0000007-0000-0000-0000-000000000005', 'Taiho', 'R461A', 'Cruce Directo', 'Taiho Japón Biela K20 STD'),
('e0000007-0000-0000-0000-000000000007', 'c0000007-0000-0000-0000-000000000006', 'Ajusa', '10178400', 'Cruce Directo', 'Junta culata MLS Honda K20A')
ON CONFLICT (id) DO NOTHING;
