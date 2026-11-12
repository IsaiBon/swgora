import type {
  GrupoRepuesto,
  GrupoRepuestoInsert,
  ParametroTecnicoDefinicion,
  TablaConfiguracion
} from '@/services/catalogService'

export interface TemplateColumnDef {
  etiqueta: string
  columna_padre?: string
  unidad?: string
  tipo_dato?: 'numero' | 'texto' | 'seleccion' | 'booleano'
  requerido?: boolean
  filtrable?: boolean
  descripcion?: string
  opciones?: string[]
  opcionesStr?: string
}

export interface FamilyTemplate {
  id: string
  nombre: string
  categoria: string
  subsistema: 'Block' | 'Culata' | 'Cigüeñal' | 'General' | string
  descripcion: string
  icono: string
  tipo_vista: 'tabla' | 'normal'
  badge?: string
  colorTag?: string
  tabla_config?: {
    titulo_primera_columna: string
    modo_filas: 'cojinetes' | 'subfilas' | 'incremental' | 'libre'
    subfilas?: string[]
    tiene_cabecera_marca?: boolean
    usar_prefijo_titulo?: boolean
    etiqueta_ultima_fila?: string
    habilitar_identificador?: boolean
    etiqueta_identificador?: string
    opciones_identificador?: string[]
  }
  columnas: TemplateColumnDef[]
}

/**
 * Plantilla en Blanco por defecto para máxima libertad
 */
export const BLANK_FAMILY_TEMPLATE: FamilyTemplate = {
  id: 'plantilla_en_blanco',
  nombre: '',
  categoria: '',
  subsistema: 'Block',
  descripcion: 'Plantilla en blanco: personaliza columnas, sub-columnas, estados (Sí/No) y medidas libremente',
  icono: 'Table',
  tipo_vista: 'tabla',
  badge: 'En Blanco',
  colorTag: 'cyan',
  tabla_config: {
    titulo_primera_columna: 'Componente / Medida',
    modo_filas: 'libre',
    tiene_cabecera_marca: false,
    subfilas: ['Componente 1']
  },
  columnas: [
    { etiqueta: 'Diámetro', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
    { etiqueta: 'Longitud', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true }
  ]
}

/**
 * Plantillas estándar de rectificadora automotriz listas para 1 clic
 */
export const WORKSHOP_FAMILY_TEMPLATES: FamilyTemplate[] = [
  {
    id: 'cojinetes_metales',
    nombre: 'Cojinetes / Metales de Motor',
    categoria: 'Cojinetes',
    subsistema: 'Cigüeñal',
    descripcion: 'Biela, Bancada y Axial con medidas STD, 0.25, 0.50, 0.75, 1.00',
    icono: 'Layers',
    tipo_vista: 'tabla',
    badge: 'Más Popular',
    colorTag: 'blue',
    tabla_config: {
      titulo_primera_columna: 'Componente',
      modo_filas: 'subfilas',
      subfilas: ['Biela', 'Bancada'],
      tiene_cabecera_marca: true,
      habilitar_identificador: false,
      etiqueta_identificador: ''
    },
    columnas: [
      { etiqueta: 'D. Mín', columna_padre: 'STD', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'D. Máx', columna_padre: 'STD', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'D. Mín', columna_padre: '1ERT (0.25)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'D. Máx', columna_padre: '1ERT (0.25)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'D. Mín', columna_padre: '2DA (0.50)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'D. Máx', columna_padre: '2DA (0.50)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'D. Mín', columna_padre: '3ER (0.75)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: false },
      { etiqueta: 'D. Máx', columna_padre: '3ER (0.75)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: false },
      { etiqueta: 'D. Mín', columna_padre: '4TA (1.00)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: false },
      { etiqueta: 'D. Máx', columna_padre: '4TA (1.00)', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: false }
    ]
  },
  {
    id: 'anillos_motor',
    nombre: 'Anillos de Motor (Matriz Ranuras)',
    categoria: 'Anillos',
    subsistema: 'Block',
    descripcion: 'Matriz dinámica: 1° Fuego, 2° Compresión, Aceite y ranuras adicionales (hasta 10+)',
    icono: 'CircleDot',
    tipo_vista: 'tabla',
    badge: 'Dinámica',
    colorTag: 'emerald',
    tabla_config: {
      titulo_primera_columna: 'Anillo',
      modo_filas: 'incremental',
      usar_prefijo_titulo: true,
      etiqueta_ultima_fila: 'Anillo de aceite',
      habilitar_identificador: true,
      etiqueta_identificador: 'Cónico',
      opciones_identificador: ['Cónico', 'Semi-cónico', 'Escalonado', '1 Espiral', 'Doble Espiral']
    },
    columnas: [
      { etiqueta: 'Diámetro de cilindro', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Diámetro estándar del cilindro' },
      { etiqueta: 'Grosor', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Espesor axial de cada ranura' },
      { etiqueta: 'Altura', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Ancho radial de cada ranura' },
      { etiqueta: 'Cónico', tipo_dato: 'booleano', requerido: false, filtrable: true, descripcion: 'Perfil cónico de ranura' }
    ]
  },
  {
    id: 'valvulas_motor',
    nombre: 'Válvulas (Admisión / Escape)',
    categoria: 'Válvulas',
    subsistema: 'Culata',
    descripcion: 'Diámetro de Cabeza (hongo), Diámetro Vástago, Longitud Total, Ángulo y Nitrurado (Sí/No)',
    icono: 'SlidersHorizontal',
    tipo_vista: 'normal',
    badge: 'Culata',
    colorTag: 'amber',
    columnas: [
      { etiqueta: 'Tipo de Válvula', tipo_dato: 'seleccion', opciones: ['Admisión', 'Escape'], requerido: true, filtrable: true },
      { etiqueta: 'Diámetro Cabeza', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Diámetro Vástago', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Longitud Total', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Ángulo Asiento', unidad: '°', tipo_dato: 'numero', requerido: false, filtrable: false },
      { etiqueta: 'Nitrurada', tipo_dato: 'booleano', requerido: false, filtrable: true, descripcion: 'Tratamiento térmico nitrurado' }
    ]
  },
  {
    id: 'pernos_culata',
    nombre: 'Juegos de Pernos de Culata',
    categoria: 'Pernos de culata',
    subsistema: 'Culata',
    descripcion: 'Medida de rosca (M10, M12), paso, longitud de perno y piezas por juego',
    icono: 'Wrench',
    tipo_vista: 'normal',
    badge: 'Apriete',
    colorTag: 'purple',
    columnas: [
      { etiqueta: 'Medida de Rosca', unidad: '', tipo_dato: 'texto', requerido: true, filtrable: true, descripcion: 'Ej. M10, M11, M12' },
      { etiqueta: 'Paso de Rosca', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Longitud de Perno', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Cantidad de Piezas', unidad: 'pzs', tipo_dato: 'numero', requerido: true, filtrable: false }
    ]
  },
  {
    id: 'pistones_camisas',
    nombre: 'Pistones y Camisas de Cilindro',
    categoria: 'Pistones',
    subsistema: 'Block',
    descripcion: 'Diámetro estándar, altura de compresión, largo total y diámetro de bulón',
    icono: 'Columns',
    tipo_vista: 'normal',
    badge: 'Block',
    colorTag: 'slate',
    columnas: [
      { etiqueta: 'Diámetro Cilindro', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Altura Compresión', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Largo Total', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true },
      { etiqueta: 'Diámetro Bulón', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true }
    ]
  },
  {
    id: 'medidas_culata',
    nombre: 'Medidas de Culata',
    categoria: 'Medidas de Culata',
    subsistema: 'Culata',
    descripcion: 'Altura estándar, altura mínima de rectificación, tolerancia de planitud y referencia',
    icono: 'Ruler',
    tipo_vista: 'normal',
    badge: 'Culata',
    colorTag: 'cyan',
    columnas: [
      { etiqueta: 'Altura Estándar', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Altura original de fábrica' },
      { etiqueta: 'Altura Mínima', unidad: 'mm', tipo_dato: 'numero', requerido: true, filtrable: true, descripcion: 'Límite mínimo permitido al cepillar' },
      { etiqueta: 'Alabeo Máximo', unidad: 'mm', tipo_dato: 'numero', requerido: false, filtrable: false, descripcion: 'Tolerancia máxima de deformación' },
      { etiqueta: 'Aluminio', tipo_dato: 'booleano', requerido: false, filtrable: true, descripcion: 'Indica si la culata es de aluminio' }
    ]
  },
  {
    id: 'torques_motor',
    nombre: 'Torques de Motor',
    categoria: 'Torques de Motor',
    subsistema: 'General',
    descripcion: 'Pares de apriete agrupados por Culata, Bancada y Biela con pasos y ángulos',
    icono: 'Wrench',
    tipo_vista: 'tabla',
    badge: 'Especificaciones',
    colorTag: 'blue',
    tabla_config: {
      titulo_primera_columna: 'Sección',
      modo_filas: 'subfilas',
      subfilas: ['Culata', 'Bancada', 'Biela'],
      tiene_cabecera_marca: false
    },
    columnas: [
      { etiqueta: '1er Paso', columna_padre: 'Torque', unidad: 'lb-ft', tipo_dato: 'texto', requerido: true, filtrable: false },
      { etiqueta: '2do Paso / Final', columna_padre: 'Torque', unidad: 'lb-ft', tipo_dato: 'texto', requerido: true, filtrable: false },
      { etiqueta: 'Giro Angular', unidad: '°', tipo_dato: 'texto', requerido: false, filtrable: false },
      { etiqueta: 'Reapriete', tipo_dato: 'booleano', requerido: false, filtrable: false }
    ]
  }
]

/**
 * Convierte un grupo existente de la BD en una plantilla para clonar o editar
 */
export function cloneExistingGrupoToTemplate(grupo: GrupoRepuesto): FamilyTemplate {
  return {
    id: `clone_${grupo.codigo}`,
    nombre: `${grupo.nombre} (Copia)`,
    categoria: grupo.categoria,
    subsistema: grupo.subsistema,
    descripcion: grupo.descripcion || `Basado en la estructura de ${grupo.nombre}`,
    icono: grupo.icono || 'Layers',
    tipo_vista: grupo.tipo_vista || 'normal',
    badge: 'Existente',
    colorTag: 'cyan',
    tabla_config: grupo.tabla_config
      ? {
          titulo_primera_columna: grupo.tabla_config.titulo_primera_columna || 'Componente',
          modo_filas: grupo.tabla_config.modo_filas || 'libre',
          subfilas: Array.isArray(grupo.tabla_config.subfilas) ? [...grupo.tabla_config.subfilas] : undefined,
          tiene_cabecera_marca: grupo.tabla_config.tiene_cabecera_marca,
          usar_prefijo_titulo: grupo.tabla_config.usar_prefijo_titulo,
          etiqueta_ultima_fila: grupo.tabla_config.etiqueta_ultima_fila,
          habilitar_identificador: grupo.tabla_config.habilitar_identificador,
          etiqueta_identificador: grupo.tabla_config.etiqueta_identificador,
          opciones_identificador: grupo.tabla_config.opciones_identificador
        }
      : undefined,
    columnas: (grupo.parametros || []).map(p => ({
      etiqueta: p.etiqueta,
      columna_padre: (p as any).columna_padre || undefined,
      unidad: p.unidad || (p.tipo_dato === 'numero' ? 'mm' : ''),
      tipo_dato: p.tipo_dato || 'numero',
      requerido: p.requerido !== false,
      filtrable: p.filtrable !== false,
      descripcion: p.descripcion,
      opciones: p.opciones,
      opcionesStr: (p.opciones || []).join(', ')
    }))
  }
}

/**
 * Convierte una plantilla en un objeto de inserción para Supabase y el store
 */
export function convertTemplateToGrupoInsert(
  template: FamilyTemplate,
  customNombre?: string,
  customCategoria?: string,
  customSubsistema?: string
): GrupoRepuestoInsert {
  const nombreFinal = (customNombre || template.nombre || 'Nueva Familia').trim()
  const categoriaFinal = (customCategoria || template.categoria || nombreFinal).trim()
  const subsistemaFinal = customSubsistema || template.subsistema || 'General'

  // Generar slug seguro
  const slug = nombreFinal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `familia_${Date.now()}`

  // Generar parámetros técnicos con claves únicas y limpias sin intervención del usuario
  const seenKeys = new Map<string, number>()
  const parametros: ParametroTecnicoDefinicion[] = template.columnas.map((col, idx) => {
    let rawSlug = col.etiqueta
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `col_${idx + 1}`

    if (col.columna_padre && col.columna_padre.trim()) {
      const parentSlug = col.columna_padre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      if (parentSlug && !rawSlug.startsWith(parentSlug)) {
        rawSlug = `${parentSlug}_${rawSlug}`
      }
    }

    const count = seenKeys.get(rawSlug) || 0
    let key = rawSlug
    if (count > 0) {
      key = `${rawSlug}_${count + 1}`
    }
    seenKeys.set(rawSlug, count + 1)

    // Opciones parseadas si es tipo selección
    let parsedOpciones = col.opciones
    if (col.tipo_dato === 'seleccion' && col.opcionesStr) {
      parsedOpciones = col.opcionesStr.split(',').map(s => s.trim()).filter(Boolean)
    }

    const paramObj: ParametroTecnicoDefinicion = {
      id: `p_${idx + 1}_${Date.now().toString(36)}`,
      clave: key,
      etiqueta: col.etiqueta.trim(),
      etiqueta_corta: col.etiqueta.trim(),
      unidad: col.tipo_dato === 'booleano' ? '' : (col.unidad ?? 'mm'),
      tipo_dato: col.tipo_dato || 'numero',
      requerido: col.requerido !== false,
      filtrable: col.filtrable !== false,
      descripcion: col.descripcion || `Medida de ${col.etiqueta}`,
      opciones: parsedOpciones
    }

    if (col.columna_padre && col.columna_padre.trim()) {
      ;(paramObj as any).columna_padre = col.columna_padre.trim()
    }

    return paramObj
  })

  let tablaConfig: TablaConfiguracion | undefined
  if (template.tipo_vista === 'tabla') {
    tablaConfig = {
      titulo_primera_columna: template.tabla_config?.titulo_primera_columna || 'Componente',
      modo_filas: template.tabla_config?.modo_filas || 'libre',
      subfilas: template.tabla_config?.subfilas ? [...template.tabla_config.subfilas] : undefined,
      tiene_cabecera_marca: template.tabla_config?.tiene_cabecera_marca ?? false,
      usar_prefijo_titulo: template.tabla_config?.usar_prefijo_titulo,
      etiqueta_ultima_fila: template.tabla_config?.etiqueta_ultima_fila,
      habilitar_identificador: Boolean(template.tabla_config?.habilitar_identificador),
      etiqueta_identificador: template.tabla_config?.etiqueta_identificador || '',
      opciones_identificador: template.tabla_config?.opciones_identificador
    }
  }

  return {
    codigo: slug,
    nombre: nombreFinal,
    categoria: categoriaFinal,
    subsistema: subsistemaFinal,
    descripcion: template.descripcion,
    icono: template.icono || 'Layers',
    tipo_vista: template.tipo_vista,
    tabla_config: tablaConfig,
    parametros,
    activo: true
  }
}
