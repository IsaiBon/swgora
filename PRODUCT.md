# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Operarios de taller rectificador, jefes de taller, mecánicos automotrices, cotizadores y administradores de la empresa rectificadora JR Blanco.

## Product Purpose
Gestionar de manera integral las operaciones de rectificación de motores automotrices (bielas, bancadas, cigüeñal, culata, block), emitir cotizaciones y órdenes de trabajo formales con cálculo de mano de obra y repuestos, y consultar catálogos técnicos de componentes con búsqueda dimensional avanzada para adaptaciones cuando no hay código legible de motor.

## Positioning
Software vertical especializado de rectificación automotriz con catálogo de ingeniería inverso integrado (Dokuro, Rik, NPR, NDC, Ajusa) y cálculo modular de mano de obra por componente de motor, frente a CRMs genéricos o ERPs tradicionales sin cotas dimensionales ni desglose de rectificadora.

## Operating Context
Mostrador de taller mecánico, área de maquinado y rectificado de motores, computadoras de escritorio y tablets en ambiente industrial automotriz. Interacción ágil de selección técnica, registro de medidas micrométricas y generación de órdenes de trabajo imprimibles limpias.

## Capabilities and Constraints
- Catálogo técnico con 4 familias de rectificación: Sellos/Ajuste de válvula, Válvulas, Anillos de motor, Juego de tornillos de culata.
- Búsqueda dimensional por cotas (diámetros, alturas, espesores de ranuras 1°, 2°, aceite).
- Equivalencias multimarca cruzadas y mapeo con cotas reales de rectificación.
- Órdenes de trabajo y cotizaciones en formato institucional con impresión limpia (clean print).
- Matriz RBAC estricta (Administrador, Operador, Consultor).
- No hacer push automático a GitHub (los commits se mantienen locales hasta que el usuario lo solicite).

## Brand Commitments
- Nombre comercial: JR Blanco Rectificadora / SWGORA.
- Colores institucionales: Azul Marino Corporativo (`#004B97`), Cian Eléctrico (`#04C4D9`), Gris Pizarra Oscuro (`#1A2234`) para navegación y Blanco/Pizarra Claro (`#F8FAFC`, `#FFFFFF`) para áreas operativas.
- Voz y tono: Técnico, confiable, riguroso, automotriz, industrial.

## Evidence on Hand
- Base de datos operativa en Supabase (PostgreSQL 17) con tablas `productos`, `clientes`, `perfiles`, `ordenes_trabajo`.
- Catálogos de fabricantes automotrices (Toyota, Nissan, Mitsubishi, Isuzu, etc.) y marcas de partes (Dokuro, Rik, NPR, NDC, Ajusa, Pioneer).

## Product Principles
1. Precisión dimensional ante todo: un milímetro define si una pieza rectificada funciona o destruye un motor.
2. Agilidad de mostrador: menos clics y sin campos vacíos en documentos finales.
3. Consistencia visual de taller: contraste alto, tipografía legible y controles táctiles o de teclado eficientes.

## Accessibility & Inclusion
Contraste alto adecuado para iluminación de taller, soporte completo de teclado y foco visible en formularios técnicos y tablas de datos.

