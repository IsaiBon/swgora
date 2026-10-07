



SELECT catalogo_origen, count(*) AS registros,
 count(*) FILTER (WHERE requiere_revision) AS pendientes_revision,
 count(*) FILTER (WHERE codigo_catalogo IS NULL) AS sin_codigo_fabricante
FROM public.repuestos_tecnicos
WHERE especificaciones_tecnicas->>'importacion'='MRK_PIONEER_20261007'
GROUP BY catalogo_origen ORDER BY catalogo_origen;


SELECT catalogo_origen, fuente_registro_id, count(*)
FROM public.repuestos_tecnicos WHERE fuente_registro_id IS NOT NULL
GROUP BY catalogo_origen,fuente_registro_id HAVING count(*)>1;

SELECT r.catalogo_origen,r.fuente_registro_id,r.codigo_catalogo,r.codigo_oem,
 r.nombre,r.diametro_interior_mm,r.diametro_exterior_mm,r.diametro_cabeza_mm,
 r.diametro_vastago_mm,r.longitud_total_mm,r.angulo_asiento_grados,
 r.especificaciones_tecnicas->'pendientes_revision' AS pendientes,
 (SELECT string_agg(m.codigo,', ' ORDER BY m.codigo) FROM public.repuestos_tecnicos_motores rm
 JOIN public.motores m ON m.id=rm.motor_id WHERE rm.repuesto_id=r.id) AS motores
FROM public.repuestos_tecnicos r
WHERE r.especificaciones_tecnicas->>'importacion'='MRK_PIONEER_20261007'
ORDER BY r.catalogo_origen,r.fuente_registro_id LIMIT 30;


SELECT catalogo_origen,estado_revision,count(*) AS entradas
FROM public.catalogo_referencias_fuente GROUP BY 1,2 ORDER BY 1,2;
