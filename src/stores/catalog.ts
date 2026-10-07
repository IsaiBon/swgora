import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  catalogService, 
  type Fabricante, 
  type Modelo, 
  type Motor, 
  type RepuestoTecnico,
  type GrupoRepuesto,
  type GrupoRepuestoInsert
} from '@/services/catalogService'

export const useCatalogStore = defineStore('catalog', () => {
  // Estado base sincronizado con Supabase
  const fabricantes = ref<Fabricante[]>([])
  const modelos = ref<Modelo[]>([])
  const motores = ref<Motor[]>([])
  const repuestos = ref<RepuestoTecnico[]>([])
  const grupos = ref<GrupoRepuesto[]>([])

  // Filtros reactivos en cascada (Fabricante -> Modelo -> Motor)
  const selectedFabricanteId = ref<string | null>(null)
  const selectedModeloId = ref<string | null>(null)
  const selectedMotorId = ref<string | null>(null)
  const selectedComponentId = ref<string | null>(null) // 'ajuste_valvula' | 'valvula' | 'anillos_motor' | 'tornillos_culata' | null

  // Filtros de búsqueda y catálogo alterno
  const searchQuery = ref<string>('')
  const activeBrandFilter = ref<string>('Todas las marcas')

  // Estados de carga (Spinners / Skeletons)
  const loadingFabricantes = ref<boolean>(false)
  const loadingModelos = ref<boolean>(false)
  const loadingMotores = ref<boolean>(false)
  const loadingRepuestos = ref<boolean>(false)
  const loadingGrupos = ref<boolean>(false)
  const isSearching = ref<boolean>(false)
  const isSaving = ref<boolean>(false)

  // Manejo de errores
  const error = ref<string | null>(null)
  const repuestosError = ref<string | null>(null)

  // ===========================================================================
  // GETTERS COMPUTADOS
  // ===========================================================================
  const selectedFabricante = computed<Fabricante | null>(() => {
    if (!selectedFabricanteId.value) return null
    return fabricantes.value.find(f => f.id === selectedFabricanteId.value) || null
  })

  const selectedModelo = computed<Modelo | null>(() => {
    if (!selectedModeloId.value) return null
    return modelos.value.find(m => m.id === selectedModeloId.value) || null
  })

  const selectedMotor = computed<Motor | null>(() => {
    if (!selectedMotorId.value) return null
    return motores.value.find(m => m.id === selectedMotorId.value) || null
  })

  // Modelos filtrados reactivamente por el fabricante seleccionado
  const availableModelos = computed<Modelo[]>(() => {
    if (!selectedFabricanteId.value) return modelos.value
    return modelos.value.filter(m => m.fabricante_id === selectedFabricanteId.value)
  })

  // Motores filtrados reactivamente por el fabricante y/o modelo seleccionado
  const availableMotores = computed<Motor[]>(() => {
    let list = motores.value
    if (selectedFabricanteId.value) {
      list = list.filter(m => m.fabricante_id === selectedFabricanteId.value)
    }
    if (selectedModeloId.value) {
      list = list.filter(m => m.modelo_id === selectedModeloId.value)
    }
    return list
  })

  // ===========================================================================
  // ACCIONES CONECTADAS DIRECTAMENTE A SUPABASE
  // ===========================================================================

  /**
   * Carga fabricantes desde Supabase con recuento reactivo
   */
  async function fetchFabricantes() {
    loadingFabricantes.value = true
    error.value = null
    try {
      fabricantes.value = await catalogService.getFabricantes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar fabricantes'
      error.value = msg
    } finally {
      loadingFabricantes.value = false
    }
  }

  /**
   * Carga modelos desde Supabase opcionalmente filtrados por fabricante
   */
  async function fetchModelos(fabricanteId?: string) {
    loadingModelos.value = true
    error.value = null
    try {
      modelos.value = await catalogService.getModelos(fabricanteId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar modelos'
      error.value = msg
    } finally {
      loadingModelos.value = false
    }
  }

  /**
   * Carga motores desde Supabase filtrados por fabricante o modelo
   */
  async function fetchMotores(fabricanteId?: string, modeloId?: string) {
    loadingMotores.value = true
    error.value = null
    try {
      motores.value = await catalogService.getMotores(fabricanteId, modeloId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar motores'
      error.value = msg
    } finally {
      loadingMotores.value = false
    }
  }

  /**
   * Carga repuestos técnicos para un motor específico desde Supabase
   */
  async function fetchRepuestosByMotor(motorId: string, subsistema?: string) {
    if (!motorId) {
      repuestos.value = []
      return
    }

    loadingRepuestos.value = true
    repuestosError.value = null
    try {
      repuestos.value = await catalogService.getRepuestosByMotor(motorId, subsistema)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar repuestos del motor'
      repuestosError.value = msg
    } finally {
      loadingRepuestos.value = false
    }
  }

  /**
   * Carga todos los repuestos pertenecientes a un grupo/categoría técnica directamente desde Supabase
   */
  async function fetchRepuestosByGrupo(categoria: string, subsistema?: string, fabricanteId?: string) {
    if (!categoria) {
      repuestos.value = []
      return
    }

    loadingRepuestos.value = true
    repuestosError.value = null
    try {
      repuestos.value = await catalogService.getRepuestosByGrupo(categoria, subsistema, fabricanteId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar repuestos del grupo'
      repuestosError.value = msg
    } finally {
      loadingRepuestos.value = false
    }
  }

  /**
   * Búsqueda por código OEM, descripción o equivalencia (cruce Dokuro, Rik, NPR, etc.)
   */
  async function searchParts(query: string) {
    const q = query.trim()
    if (!q) {
      if (selectedMotorId.value) {
        await fetchRepuestosByMotor(selectedMotorId.value)
      } else {
        repuestos.value = []
      }
      return
    }

    isSearching.value = true
    repuestosError.value = null
    try {
      repuestos.value = await catalogService.searchGlobalParts(q)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en la búsqueda de repuestos'
      repuestosError.value = msg
    } finally {
      isSearching.value = false
    }
  }

  // ===========================================================================
  // CASCADA REACTIVA: FABRICANTE -> MODELO -> CÓDIGO DE MOTOR
  // ===========================================================================

  /**
   * Selección en cascada: Paso 1 - Fabricante
   */
  async function selectFabricante(fabricanteId: string | null) {
    selectedFabricanteId.value = fabricanteId
    selectedModeloId.value = null
    selectedMotorId.value = null
    repuestos.value = []

    if (fabricanteId) {
      await Promise.all([
        fetchModelos(fabricanteId),
        fetchMotores(fabricanteId)
      ])
    } else {
      await Promise.all([
        fetchModelos(),
        fetchMotores()
      ])
    }
  }

  /**
   * Selección en cascada: Paso 2 - Modelo
   */
  async function selectModelo(modeloId: string | null) {
    selectedModeloId.value = modeloId
    selectedMotorId.value = null
    repuestos.value = []

    if (modeloId) {
      const mod = modelos.value.find(m => m.id === modeloId)
      if (mod && mod.fabricante_id && selectedFabricanteId.value !== mod.fabricante_id) {
        selectedFabricanteId.value = mod.fabricante_id
      }
      await fetchMotores(selectedFabricanteId.value || undefined, modeloId)
    } else if (selectedFabricanteId.value) {
      await fetchMotores(selectedFabricanteId.value)
    } else {
      await fetchMotores()
    }
  }

  /**
   * Selección en cascada: Paso 3 - Código de Motor
   */
  async function selectMotor(motorId: string | null) {
    selectedMotorId.value = motorId
    if (!motorId) {
      repuestos.value = []
      return
    }

    const mot = motores.value.find(m => m.id === motorId)
    if (mot) {
      // Auto-completar fabricante si estaba vacío
      if (!selectedFabricanteId.value && mot.fabricante_id) {
        selectedFabricanteId.value = mot.fabricante_id
        await fetchModelos(mot.fabricante_id)
      }
      // Auto-completar modelo si estaba vacío
      if (!selectedModeloId.value && mot.modelo_id) {
        selectedModeloId.value = mot.modelo_id
      }
    }

    await fetchRepuestosByMotor(motorId)
  }

  /**
   * Limpiar todos los filtros en cascada y reiniciar estado
   */
  async function resetFilters() {
    selectedFabricanteId.value = null
    selectedModeloId.value = null
    selectedMotorId.value = null
    selectedComponentId.value = null
    searchQuery.value = ''
    activeBrandFilter.value = 'Todas las marcas'
    repuestos.value = []
    error.value = null
    repuestosError.value = null
    await Promise.all([
      fetchFabricantes(),
      fetchModelos(),
      fetchMotores()
    ])
  }

  // ===========================================================================
  // AÑADIR ELEMENTO DIRECTAMENTE A SUPABASE
  // ===========================================================================
  async function createRepuesto(
    partData: Partial<RepuestoTecnico>,
    equivalencias?: Array<{ marca_alterna: string; codigo_alterno: string; notas?: string }>
  ) {
    isSaving.value = true
    error.value = null
    try {
      const created = await catalogService.createRepuesto(partData, equivalencias)
      // Añadir inmediatamente al inicio de la lista reactiva
      repuestos.value.unshift(created)
      return created
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el nuevo repuesto en Supabase'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Carga los grupos o familias de piezas y sus esquemas paramétricos desde Supabase/local
   */
  async function fetchGrupos() {
    loadingGrupos.value = true
    try {
      grupos.value = await catalogService.getGrupos()
    } catch (err: unknown) {
      console.warn('Error al cargar grupos:', err)
    } finally {
      loadingGrupos.value = false
    }
  }

  /**
   * Crea una nueva familia / grupo de repuestos con sus parámetros dinámicos requeridos
   */
  async function createGrupo(grupoData: GrupoRepuestoInsert) {
    isSaving.value = true
    error.value = null
    try {
      const created = await catalogService.createGrupo(grupoData)
      const idx = grupos.value.findIndex(g => g.id === created.id || g.codigo === created.codigo)
      if (idx >= 0) {
        grupos.value[idx] = created
      } else {
        grupos.value.push(created)
      }
      return created
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el nuevo grupo en Supabase'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Inicialización del catálogo
   */
  async function initCatalog() {
    await Promise.all([
      fetchFabricantes(),
      fetchModelos(),
      fetchMotores(),
      fetchGrupos()
    ])
  }

  return {
    // Estado
    fabricantes,
    modelos,
    motores,
    repuestos,
    grupos,
    selectedFabricanteId,
    selectedModeloId,
    selectedMotorId,
    selectedComponentId,
    searchQuery,
    activeBrandFilter,
    loadingFabricantes,
    loadingModelos,
    loadingMotores,
    loadingRepuestos,
    loadingGrupos,
    isSearching,
    isSaving,
    error,
    repuestosError,

    // Computados
    selectedFabricante,
    selectedModelo,
    selectedMotor,
    availableModelos,
    availableMotores,

    // Acciones
    fetchFabricantes,
    fetchModelos,
    fetchMotores,
    fetchRepuestosByMotor,
    fetchRepuestosByGrupo,
    fetchGrupos,
    createGrupo,
    searchParts,
    selectFabricante,
    selectModelo,
    selectMotor,
    resetFilters,
    createRepuesto,
    initCatalog
  }
})
