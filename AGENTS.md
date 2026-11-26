# SWGORA - Contexto del Proyecto y Reglas para Agentes (AGENTS.md)

Este documento proporciona el contexto arquitectónico, funcional, técnico y operativo del proyecto **SWGORA** para agentes de IA (Antigravity / Gemini) y desarrolladores.

---

## 1. Visión General del Proyecto
- **Nombre**: SWGORA
- **Repositorio**: [https://github.com/IsaiBon/SWGORA](https://github.com/IsaiBon/SWGORA)
- **Rama principal**: `main`
- **Despliegue Producción (Vercel)**: [https://swgora.vercel.app](https://swgora.vercel.app)
- **Giro de Negocio**: Sistema web de gestión operativa y técnica para una **empresa rectificadora de motores automotrices**.
- **Objetivo Principal**:
  1. Centralizar y digitalizar catálogos de repuestos multimarca (Dokuro, Rik, NPR, Pioneer, NDC, etc.), permitiendo búsquedas por vehículo/motor y **búsquedas dimensionales avanzadas para adaptaciones** cuando no se cuenta con código legible de motor.
  2. Gestionar **órdenes de rectificación de taller** y **cotizaciones** con operaciones segmentadas por componentes del motor y cálculo automático.
  3. Controlar clientes, talleres, perfiles y estadísticas de volumen de trabajo.

---

## 2. Requerimientos Funcionales y Módulos de Negocio

### 2.1. Módulo de Catálogos de Repuestos y Búsqueda Dimensional (Adaptadores)
El sistema reemplaza la consulta manual en múltiples catálogos en PDF y resuelve el desafío de identificar repuestos originales o adaptables:

- **Barra Superior Unificada de Selección (3 Selectores Integrados):**
  - Ubicada en cabecera interactiva fija (`sticky top-0 z-30`) sin etiquetas invasivas de "obligatorio" u "opcional":
    1. **Marca / Fabricante**: Autocompletado reactivo (*search-as-you-type*) sobre marcas automotrices (Toyota, Nissan, Mitsubishi, Isuzu, etc.).
    2. **Código de Motor**: Búsqueda asistida por código o denominación (ej. *11B*, *12HT*, *3L*, *Z24*, *1KD-FTV*).
    3. **Tipo de Componente**: Selección directa entre las 4 familias técnicas de rectificación.

- **Tabla Técnica de Motores por Marca (Despliegue Inmediato - Estilo TecDoc / Ajusa):**
  - Al ingresar o seleccionar una Marca, se despliega de inmediato la matriz técnica de motores con cabecera corporativa azul (`#004b97`) con contador dinámico (`Resultado X - Y desde Z ›`).
  - Columnas técnicas estandarizadas:
    - `(i)`: Botón informativo que abre la ficha modal con cotas y especificaciones de rectificación del motor.
    - `Número/ID ...`: Identificador numérico de referencia técnica de taller (ej. *3703*, *4931*, *9068*).
    - `Código de motor`: Denominación formal del motor (ej. *TOYOTA - 11B*, *TOYOTA - 12HT*).
    - `Denominación de venta`: Línea comercial o serie (ej. *B Series*, *Hilux / Hiace*).
    - `Cilindros`: Cantidad de cilindros (ej. *4*, *6*).
    - `Cilindrada`: Formato técnico mixto (ej. *2977 cc / 3 l*, *3980 cc / 4 l*).
    - `kW`: Potencia métrica en kilovatios.
    - `CV`: Potencia en caballos de vapor.
  - Selección rápida: El operario hace clic en cualquier fila para seleccionar el motor y pasar directamente a la matriz de piezas.
  - Paginación técnica compacta en pie de tabla: `|< < Página desde Total > >|`.

- **4 Familias de Componentes Exclusivas y Filtros Dimensionales de Taller:**
  Se eliminaron grupos de relleno, estandarizando estrictamente las 4 categorías con sus cotas de maquinado:
  1. **Ajuste de válvula** (Sellos y retenes de guía de válvula):
     - Diám. int. (mm) *(ej. 4,8 mm)*, Diámetro exterior (mm) *(ej. 10,8 mm)*, Altura (mm) *(ej. 10 mm)*.
  2. **Válvula** (Válvulas de admisión y escape estándar y sobremedida):
     - Hongo (Ø cabeza mm), Vástago (Ø vástago mm), Altura (Longitud total mm).
  3. **Anillos de motor** (Juegos de aros de pistón STD y sobremedida):
     - Diámetro de cilindro (mm), Grosor 1er anillo (mm), Altura/grosor (mm).
     - **Desglose visible obligatorio en resultados**: Cada fila presenta explícitamente los badges con las medidas de `1° Anillo (Fuego)`, `2° Anillo (Compresión)` y `Anillo de Aceite (Rascador)`.
  4. **Juego de tornillos de culata** (Pernos de apriete angular para culata):
     - Medida de rosca (M10, M11, M12, M14), Paso de rosca (mm), Longitud (mm), Cantidad (pzs), Paso rosca 1 (mm), Longitud 1 (mm), Longitud 2 (mm).

- **Ergonomía de Consulta y Scrolling Optimizado:**
  - Barra de búsqueda y panel de cotas dimensionales acoplados arriba de la tabla con botón "*Limpiar filtros de medida*".
  - Contenedores de tabla con scroll vertical interno (`max-h-[540px] overflow-y-auto`) y encabezados fijos (`thead sticky top-0`), eliminando el scroll vertical excesivo de la página completa.
  - Cruce de marcas alternas en tiempo real: códigos homologados para **Dokuro, Rik, NPR, NDC, Ajusa, Pioneer**.
  - Botón de acción directa **Añadir a la orden / Quitar de la orden** que agrega o deselecciona repuestos en el **Listado de orden** en memoria, estrictamente aislado por sesión autenticada (sin caché compartido en `localStorage` y con limpieza automática al cerrar sesión o cambiar de cuenta), para crear órdenes o cotizaciones con los ítems acumulados.

### 2.2. Módulo de Órdenes de Trabajo y Cotizaciones de Rectificación
Diseñado para agilizar el registro en el mostrador del taller y la emisión formal de documentos:

- **Cabecera de Orden:**
  - Correlativo numérico automático, fecha (día/mes/año), estado (*Pendiente*, *En proceso*, *Terminado*, *Entregado*).
  - Datos de cliente / tallerista: autocompletado y búsqueda rápida por nombre o taller, teléfono, dirección.
  - Datos vehiculares: marca del vehículo, modelo/código de motor, eslogan comercial de la empresa rectificadora.
- **Operaciones de Rectificación (Mano de Obra):**
  - Organizadas en bloques específicos por componentes mecánicos del motor:
    1. **Bielas** (alineación, cambio de bocinas, rectificación de ojo, etc.)
    2. **Bancadas** (alineación de túnel, alesado, etc.)
    3. **Cigüeñal** (rectificado de muñones, nitrurado, pulido, etc.)
    4. **Culata** (cepillado, prueba hidráulica, cambio de guías/asientos, regulación, etc.)
    5. **Block** (rectificado de cilindros, encamisado, plano superior, etc.)
  - **Precios de mano de obra:** Ingreso manual flexible (varían según cliente, procedencia o complejidad técnica del trabajo).
- **Repuestos Facturados:**
  - Selección de repuestos desde el catálogo con cantidad, precio unitario y total.
  - **Cálculo de Totales:** Suma automática de mano de obra y repuestos.
- **Generación de Documentos, PDF, WhatsApp y Salida de Impresión:**
  - **Cotización:** Formato económico en blanco y negro con marca de agua destacada `"COTIZACIÓN"`.
  - **Orden de Trabajo / Taller:** Formato formal con diseño, logotipo e identidad visual corporativa (azul).
  - **Auto-adaptación Carta (1 o 2 columnas):** `WorkOrderDocument.vue` evalúa dinámicamente la altura (`evaluateAutoLayout`) para mantener 1 columna cuando cabe en 1 página Carta o pasar a 2 columnas balanceadas cuando la excede.
  - **Impresión limpia (Clean Print) y Exportación PDF:** En la impresión y exportación (`src/utils/pdfExport.ts`) únicamente figuran las operaciones y repuestos efectivamente facturados; los campos sin valor (ej. `Marca`, `Motor`, `Tel`) se muestran vacíos sin textos de relleno (`N/A`) y los componentes vacíos se ocultan.
  - **Compartir por WhatsApp:** Generación de mensajes y envío directo de PDF (`src/utils/whatsappShare.ts`, `DirectOrderPdfShare.vue`).
- **Historial, Dashboard y Estadísticas:**
  - Reportes y filtros globales por rango de fechas, ruta/sucursal y tallerista.
  - En la tabla del Dashboard (`DashboardView.vue`), filtros por estado (`Global` por defecto, `Pendientes`, `En Proceso`, `Terminados`) y selector desplegable `Tipos de orden` (`Todas`, `Órdenes de trabajo`, `Cotizaciones`).

---

## 3. Stack Tecnológico

### Frontend
- **Framework**: [Vue 3](https://vuejs.org/) con Composition API y `<script setup lang="ts">`
- **Herramienta de compilación**: [Vite](https://vitejs.dev/)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) (con verificación estricta mediante `vue-tsc`)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/) + PostCSS + Autoprefixer
- **Enrutamiento**: [Vue Router 4](https://router.vuejs.org/)
- **Estado global**: [Pinia](https://pinia.vuejs.org/)
- **Iconografía**: [lucide-vue-next](https://lucide.dev/)

### Backend & Base de Datos
- **Proveedor**: [Supabase](https://supabase.com/) (PostgreSQL 17)
- **Cliente SDK**: `@supabase/supabase-js`
- **Proyecto Supabase**: `SWGORA` (`ahfnuegsdmnjelcypitk`)
- **Control de versiones de BD**: Migraciones SQL versionadas en `supabase/migrations/`

---

## 4. Estructura de Directorios

```text
SWGORA/
├── .agents/                    # Configuraciones y reglas del agente
├── docs/                       # Manual de usuario (manual-usuario-swgora.html)
├── public/                     # Recursos estáticos
├── src/
│   ├── assets/                 # Imágenes, estilos globales
│   ├── components/             # Componentes Vue reutilizables (Navbar, Sidebar, WorkOrderForm, WorkOrderDocument, Modales, etc.)
│   ├── composables/            # Lógica reactiva reutilizable (useOrders, useCatalog, usePrint, etc.)
│   ├── layouts/                # Layouts de vistas (DashboardLayout, etc.)
│   ├── router/                 # Configuración de rutas (Vue Router)
│   ├── services/               # Servicios de datos y conexión a Supabase
│   │   ├── supabase.ts         # Cliente Supabase inicializado
│   │   ├── authService.ts      # Autenticación y gestión de sesiones
│   │   ├── catalogImportService.ts # Importación y exportación masiva de catálogo
│   │   ├── catalogService.ts   # Catálogo, repuestos, equivalencias y búsqueda dimensional
│   │   ├── clientesService.ts  # CRUD de clientes y talleres
│   │   ├── ordersService.ts    # Gestión de órdenes de rectificación y cotizaciones
│   │   ├── perfilesService.ts  # Perfiles de usuario y roles
│   │   ├── rutasService.ts     # Gestión de rutas / sucursales
│   │   ├── storageService.ts   # Almacenamiento de archivos/imágenes
│   │   ├── tallerService.ts    # Configuración del taller
│   │   └── usuariosService.ts  # Gestión de usuarios
│   ├── stores/                 # Stores de Pinia (auth, catalog, etc.)
│   ├── utils/                  # Utilidades (pdfExport.ts, whatsappShare.ts, catalogPermissions.ts)
│   ├── views/                  # Vistas principales (Dashboard, Catalogo, Ordenes, Clientes, Rutas, Taller, Usuarios, Login)
│   ├── App.vue                 # Componente raíz
│   ├── main.ts                 # Punto de entrada de la aplicación
│   └── style.css               # Estilos globales y utilidades de Tailwind
├── supabase/
│   └── migrations/             # Scripts SQL de migraciones versionadas
├── .env                        # Variables de entorno locales (VITE_SUPABASE_URL, etc.)
├── .env.example                # Plantilla de variables de entorno
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Esquema de Base de Datos (Supabase)

### 5.1. Tablas Existentes

#### Tabla `public.clientes`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `nombre`: `TEXT NOT NULL`
- `telefono`: `TEXT` (nullable)
- `direccion`: `TEXT` (nullable)
- `taller`: `TEXT` (nullable)
- `especificaciones_tecnicas`: `JSONB NOT NULL DEFAULT '{}'::jsonb` (detalles y notas técnicas del cliente/taller)
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Seguridad**: RLS habilitado con políticas para `anon` y `authenticated`.
- **Índices**: `idx_clientes_nombre`, `idx_clientes_taller`, y GIN `idx_clientes_especificaciones_tecnicas`.
- **Triggers**: `set_clientes_updated_at` (`BEFORE UPDATE`).

#### Tabla `public.perfiles`
- `id`: `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `nombre`: `TEXT NOT NULL`
- `email`: `TEXT NOT NULL`
- `rol`: `TEXT NOT NULL DEFAULT 'operador'` (roles: `admin`, `supervisor`, `tecnico`, `operador`, `cliente`)
- `avatar_url`: `TEXT` (nullable)
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Seguridad**: RLS habilitado con políticas para usuarios autenticados.
- **Triggers**: `on_auth_user_created` en `auth.users` y `set_perfiles_updated_at` (`BEFORE UPDATE`).

#### Tabla `public.productos` (Repuestos y Componentes)
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `codigo`: `TEXT UNIQUE NOT NULL` (código principal de parte)
- `nombre`: `TEXT NOT NULL`
- `categoria`: `TEXT NOT NULL` (ej. 'Sellos', 'Válvulas', 'Anillos', 'Pernos', 'Casquetería', 'Camisas')
- `precio`: `NUMERIC(12, 2) NOT NULL DEFAULT 0.00`
- `stock`: `INTEGER NOT NULL DEFAULT 0`
- `estado`: `TEXT NOT NULL DEFAULT 'Disponible'`
- `imagen_url`: `TEXT` (nullable)
- `especificaciones_tecnicas`: `JSONB NOT NULL DEFAULT '{}'::jsonb` (dimensiones físicas indexables para búsqueda dimensional: diámetro interior/exterior, largo, grosor de anillos, códigos NDC `MS`/`CB`/`TW`/`SH`/`PB`, marcas y números OEM alternos)
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- **Seguridad**: RLS habilitado (lectura pública/autenticada, escritura para usuarios autorizados).
- **Índices**: B-tree sobre `codigo`, `categoria`; y GIN `idx_productos_especificaciones_tecnicas`.
- **Triggers**: `set_productos_updated_at` (`BEFORE UPDATE`).

### 5.2. Estructura de Entidades del Catálogo Técnico (`src/services/catalogService.ts`)
- **Motores (`Motor`):**
  - Identificación: `id`, `fabricante_id`, `modelo_id`, `numero_id` (ID técnico de catálogo).
  - Códigos y marcas: `codigo` (ej. *11B*, *12HT*, *3L*), `nombre_comercial`, `denominacion_venta` (ej. *B Series*).
  - Parámetros motrices: `cilindros`, `valvulas`, `cilindrada_cc`, `cilindrada_texto` (ej. *2977 cc / 3 l*), `kw`, `cv`, `combustible`, `diametro_cilindro_std_mm`, `aspiracion`.
- **Repuestos Técnicos (`RepuestoTecnico`):**
  - Datos base: `id`, `motor_id`, `codigo_oem`, `nombre`, `subsistema`, `categoria`, `precio`, `stock`, `estado`, `catalogo_origen`.
  - Cotas físicas indexables:
    - *Ajuste de válvula*: `diametro_interior_mm`, `diametro_exterior_mm`, `altura_mm`.
    - *Válvulas*: `diametro_cabeza_mm`, `diametro_vastago_mm`, `longitud_total_mm`, `angulo_asiento_grados`.
    - *Anillos*: `diametro_cilindro_mm`, `espesor_anillo1_mm`, `espesor_anillo2_mm`, `espesor_aceite_mm`.
    - *Pernos de culata*: `medida_rosca`, `paso_rosca_mm`, `longitud_perno_mm`, `cantidad_piezas`, `paso_rosca1_mm`, `longitud1_mm`, `longitud2_mm`.
- **Equivalencias de Repuestos (`Equivalencia`):** Mapeo cruzado entre número de parte OEM y referencias alternas (*Dokuro, Rik, NPR, NDC, Ajusa, Pioneer*).
- **Órdenes de Trabajo (`ordenes_trabajo`):** Correlativo, cliente_id, datos de motor, tipo_documento (`orden` | `cotizacion`), estado, total_mano_obra, total_repuestos, total_general.
- **Detalle de Operaciones de Rectificación (`orden_operaciones`):** Sección del motor (`bielas`, `bancadas`, `cigueñal`, `culata`, `block`), descripción del trabajo, costo de mano de obra.
- **Detalle de Repuestos de Orden (`orden_repuestos`):** producto_id, cantidad, precio_unitario, subtotal.

---

## 6. Roles del Sistema y Matriz de Permisos (RBAC)

El sistema SWGORA implementa control de acceso basado en roles tanto en el enrutamiento frontend (`vue-router` guards) como en el menú lateral de navegación (`Sidebar.vue`) y en la sesión reactiva de Pinia (`useAuthStore`):

| Rol | Vistas Permitidas | Restricciones / Comportamiento |
| :--- | :--- | :--- |
| **`Administrador`** | **Todas las vistas**: Dashboard (`/dashboard`), Clientes (`/clientes`), Órdenes (`/ordenes`), Catálogo (`/catalogo`). | Acceso total al sistema, supervisión operativa y administrativa. |
| **`Operador`** | **Solo Órdenes y Catálogo**: Órdenes (`/ordenes`), Catálogo (`/catalogo`). | No tiene acceso a Dashboard ni a Clientes. Si intenta acceder a una ruta restringida, el Router Guard lo redirige automáticamente a `/ordenes`. El menú lateral filtra y oculta los módulos no autorizados. |
| **`Consultor`** | **Solo Catálogo**: Catálogo (`/catalogo`). | Acceso restringido exclusivamente a la consulta del catálogo de productos y refacciones. Si intenta acceder a otra ruta, el Router Guard lo redirige automáticamente a `/catalogo`. El menú lateral solo muestra el Catálogo. |

### Reglas de Implementación en Frontend:
- **Guards de Navegación**: Configurados en `src/router/index.ts` mediante `router.beforeEach`, validando mediante `isRouteAllowedForRole()`.
- **Rutas de Aterrizaje por Defecto**:
  - `Administrador`: `/dashboard`
  - `Operador`: `/ordenes`
  - `Consultor`: `/catalogo`
- **Componentes de Roles**:
  - `src/components/RoleBadge.vue`: Insignia visual con iconos (`ShieldCheck` para Admin, `Wrench` para Operador, `Eye` para Consultor) y estilos dedicados.
  - `src/components/Navbar.vue`: Botón interactivo para alternar rol en vivo (`toggleRole`) y probar permisos inmediatamente.
  - `src/views/LoginView.vue`: Botones de demostración rápida para iniciar sesión como `Administrador`, `Operador` o `Consultor`.

---

## 7. Convenciones y Reglas de Desarrollo

1. **Gestión de Git / GitHub**:
   - **Regla mandatoria**: **NO hacer push a GitHub de forma automática**. Únicamente realizar `git push` cuando el usuario lo solicite explícitamente en su mensaje (ej. *"sube mis cambios al repositorio"*, *"haz push"*). En cualquier otro caso, los commits deben mantenerse a nivel local.
2. **Sistema Operativo y Terminal**:
   - En entornos Windows PowerShell, usar `npm.cmd` en lugar de `npm` si aplican políticas de ejecución de scripts de PowerShell.
   - Usar `;` como separador de comandos en PowerShell en lugar de `&&`.
3. **TypeScript**:
   - Mantener tipado estricto. No usar `any` implícito ni importar archivos `.js` sin tipos si pueden ser `.ts`.
   - Validar la compilación con `npm.cmd run build` antes de realizar commits.
4. **Base de Datos y Migraciones**:
   - Cualquier cambio DDL (tablas, columnas, políticas RLS) debe registrarse en `supabase/migrations/<timestamp>_<nombre>.sql` y aplicarse en Supabase.
   - Nombres de tablas y columnas en minúsculas y snake_case sin acentos (`telefono`, `direccion`, `ordenes_trabajo`).
5. **Criterios de Impresión y UI**:
   - Cumplir la regla de **impresión limpia**: al imprimir órdenes o cotizaciones, omitir componentes o líneas sin valores facturados.
   - Respetar los estilos corporativos para órdenes (azul/institucional) y cotizaciones (blanco y negro con marca de agua).
6. **Mentalidad de Producción, Aislamiento Multi-Cuenta y Cero Caché Estático Global**:
   - **Diseñar siempre para producción real**: Todo desarrollo debe asumir uso simultáneo en producción por múltiples cuentas, roles, rutas y talleres independientes (`tenantId`), sin mezclar estados ni datos entre sesiones.
   - **Prohibido usar caché estático o `localStorage` global compartido para datos de trabajo**: Nunca persistir borradores, listados de selección, filtros sensibles ni información operativa de una cuenta en claves globales sin aislamiento ni dejar datos residuales tras cerrar sesión (`logout`).
   - **Estado temporal estrictamente ligado a la sesión activa**: Todo estado temporal de interfaz (como el *Listado de orden* del catálogo) debe mantenerse en memoria vinculado al alcance único de la cuenta activa (`tenantId + rutaId + userId + rol`), limpiarse síncronamente al cerrar sesión o cambiar de cuenta/rol/taller, y jamás mostrarse sin sesión autenticada.
   - **Fuente de verdad en la nube**: Cualquier dato que requiera persistencia entre sesiones o dispositivos debe almacenarse en **Supabase (PostgreSQL)** con RLS y aislamiento por usuario/taller/ruta, nunca en cachés locales estáticos ni datos quemados.

---

## 8. Herramientas, Servidores MCP y Skills Desactivadas
1. **Desactivación de Blender**:
   - **Regla Mandatoria**: El servidor MCP `blender` y todas las skills asociadas a Blender, modelado 3D, animación, rigging, shaders, volumetría y dirección de arte CGI están **estrictamente desactivados** para este proyecto.
   - Ningún agente debe invocar herramientas de Blender (`execute_blender_code`, `get_scene_info`, etc.) ni cargar skills de Blender para las tareas de SWGORA.
2. **Desactivación del Plugin de Ciencias y Bioinformática (`science`)**:
   - **Regla Mandatoria**: El plugin `science` y todos sus servidores MCP asociados (`science_biomolecular_structure_viewer_mcp`, etc.) y sus 48 skills (AlphaFold, ChEMBL, PubChem, PDB, UniProt, BLAST, cheminformatics, genómica, literatura científica, etc.) quedan **estrictamente desactivados** para este proyecto.
   - No invocar ninguna herramienta científica ni cargar skills biológicas/químicas para tareas de SWGORA.


