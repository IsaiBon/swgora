---
name: SWGORA / JR Blanco Rectificadora
description: Sistema web de gestión operativa y catálogo técnico de rectificación automotriz
colors:
  primary: "#004B97"
  primary-hover: "#003A75"
  accent-cyan: "#04C4D9"
  accent-cyan-hover: "#03A8BC"
  surface-dark: "#1A2234"
  surface-dark-active: "#243048"
  surface-light: "#F8FAFC"
  surface-card: "#FFFFFF"
  border-subtle: "#E2E8F0"
  text-primary: "#0F172A"
  text-secondary: "#64748B"
  text-inverse: "#FFFFFF"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-cyan:
    backgroundColor: "{colors.accent-cyan}"
    textColor: "{colors.surface-dark}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
---

# Design System: SWGORA / JR Blanco Rectificadora

## Overview
Sistema de diseño técnico automotriz e industrial para SWGORA. Enfocado en la alta densidad de información, contraste nítido para entornos de taller y legibilidad instantánea en tablas técnicas de ingeniería motriz y cotizaciones.

## Colors
- **Azul Corporativo Primario (`#004B97`)**: Utilizado en cabeceras de tablas técnicas, botones principales de acción y elementos clave de identidad.
- **Cian Eléctrico (`#04C4D9`)**: Acento dinámico utilizado para insignias interactivas, estados activos y micro-interacciones de búsqueda.
- **Pizarra Oscuro (`#1A2234`)**: Fondo del menú lateral (Sidebar), proveyendo una separación nítida entre la navegación y el área de trabajo.
- **Blanco y Pizarra Claro (`#FFFFFF`, `#F8FAFC`)**: Superficie limpia de trabajo para tarjetas, formularios y tablas.
- **Bordes y Divisores (`#E2E8F0`)**: Delimitación clara sin sobrecargar la vista.

## Typography
Tipografía técnica y limpia basada en `Inter` (sans-serif) para interfaz general y fuentes monoespaciadas para códigos OEM, números de parte y medidas micrométricas (`d1`, `h1`, `a1`, mm).
- Títulos: Inter Bold / SemiBold.
- Datos de tablas y medidas: Monospace / Inter Tabular Numbers (`tabular-nums font-mono`).

## Layout
- Disposición en panel con barra lateral fija oscura a la izquierda (260px) y cabecera superior compacta con acciones rápidas.
- Área principal con contenedores redondeados (`rounded-2xl` o `rounded-3xl`) sobre fondo pizarra neutro claro (`#F1F5F9`).
- Despliegue técnico en cuadrículas y tablas compactas con encabezados fijos (`sticky thead`) y scroll vertical interno optimizado (`max-h-[540px] overflow-y-auto`).

## Elevation & Depth
- Capas limpias con sombras suaves (`shadow-sm`, `shadow-md`, `shadow-xl` para modales).
- Bordes definidos de 1px (`border border-slate-200`) para separar bloques funcionales.
- Ausencia de gradientes pesados o efectos borrosos innecesarios en áreas operativas para garantizar velocidad y nitidez.

## Shapes
- Tarjetas y contenedores con esquinas suavemente redondeadas (`rounded-xl` y `rounded-2xl`).
- Botones y campos de formulario con radio medio (`rounded-lg` a `rounded-xl`).
- Badges e insignias de estado con radio completo tipo cápsula (`rounded-full`).

## Components
- **Tablas Técnicas**: Cabecera corporativa azul (`#004B97`), filas alternadas sutilmente o con efecto hover en `#F8FAFC`, texto de medidas en fuente monoespaciada para alineación decimal perfecta.
- **Filtros y Búsqueda**: Barra unificada compacta con selectores sin etiquetas innecesarias y paneles desplegables de cotas micrométricas.
- **Modales de Gestión**: Vistas compactas split-view (2 columnas en pantallas grandes), con edición ágil de especificaciones técnicas y equivalencias.
- **Documentos de Salida (Órdenes / Cotizaciones)**: Impresión limpia (Clean Print) donde solo se imprimen los conceptos con valores efectivamente facturados.

## Do's and Don'ts
- **DO**: Mantener los números y medidas en fuentes monoespaciadas (`font-mono tabular-nums`) con sus unidades técnicas explícitas (`mm`, `cc`, `kW`).
- **DO**: Respetar el contraste entre el azul institucional `#004B97` y el cian `#04C4D9`.
- **DO**: Optimizar el espacio vertical evitando espaciados gigantescos o scrolls infinitos en tablas.
- **DON'T**: No usar degradados de colores discordantes ni tipografías decorativas que dificulten la lectura en taller.
- **DON'T**: No romper la regla de impresión limpia ocultando campos vacíos en cotizaciones e informes finales.

