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
  // Modelos que comparten el motor seleccionado (relación N:M)
  const modeloIdsDelMotor = ref<string[]>([])
  const selectedMotorId = ref<string | null>(null)
  const selectedComponentId = ref<string | null>(null) // 'ajuste_valvula' | 'valvula' | 'anillos_motor' | 'tornillos_culata' | null
  const onlyMotorsWithParts = ref<boolean>(true) // Por defecto: omitir motores sin repuestos asociados en catálogo

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

  // Paginación por cursor y streaming eficiente de repuestos
  const hasMoreRepuestos = ref<boolean>(false)
  const repuestosCursor = ref<string | null>(null)
  const totalRepuestosCount = ref<number>(0)
  const isLoadingMore = ref<boolean>(false)

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

  // Modelos filtrados reactivamente por el fabricante seleccionado y/o motor seleccionado
  const availableModelos = computed<Modelo[]>(() => {
    let list = modelos.value
    if (selectedFabricanteId.value) {
      list = list.filter(m => m.fabricante_id === selectedFabricanteId.value)
    }
    // Si hay un motor seleccionado, mostrar estrictamente solo los modelos compatibles con ese motor
    if (selectedMotorId.value) {
      const mot = motores.value.find(m => m.id === selectedMotorId.value)
      if (mot) {
        const denom = (mot.denominacion_venta || '').toLowerCase()
        const comm = (mot.nombre_comercial || '').toLowerCase()
        return list.filter(m =>
          m.id === mot.modelo_id ||
          m.id === mot.modelo?.id ||
          mot.modelo_ids?.includes(m.id) ||
          modeloIdsDelMotor.value.includes(m.id) ||
          (denom.length > 0 && denom.includes(m.nombre.toLowerCase())) ||
          (comm.length > 0 && comm.includes(m.nombre.toLowerCase()))
        )
      }
    }
    return list
  })

  // Motores filtrados reactivamente por el fabricante y/o modelo seleccionado
  const availableMotores = computed<Motor[]>(() => {
    let list = motores.value
    if (selectedFabricanteId.value) {
      list = list.filter(m => m.fabricante_id === selectedFabricanteId.value)
    }
    // El filtro por modelo ya lo aplica catalogService.getMotores (relación N:M modelo_motor)
    if (onlyMotorsWithParts.value) {
      list = list.filter(m => m.parts_count === undefined || m.parts_count > 0)
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
   * Crea (o recupera) un modelo para el fabricante y lo agrega a la lista sin recargar
   */
  async function createModelo(fabricanteId: string, nombre: string, anioInicio?: number, anioFin?: number): Promise<Modelo> {
    const nuevo = await catalogService.createModelo(fabricanteId, nombre, anioInicio, anioFin)
    if (!modelos.value.some(m => m.id === nuevo.id)) {
      modelos.value = [...modelos.value, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre))
    }
    return nuevo
  }

  async function updateModelo(
    id: string,
    modData: { nombre: string; fabricante_id?: string; anio_inicio?: number | null; anio_fin?: number | null }
  ): Promise<Modelo> {
    const updated = await catalogService.updateModelo(id, modData)
    modelos.value = modelos.value.map(m => (m.id === id ? { ...m, ...updated } : m))
    return updated
  }

  async function deleteModelo(id: string): Promise<void> {
    await catalogService.deleteModelo(id)
    modelos.value = modelos.value.filter(m => m.id !== id)
    motores.value = motores.value.map(m => (m.modelo_id === id ? { ...m, modelo_id: undefined } : m))
    modeloIdsDelMotor.value = modeloIdsDelMotor.value.filter(mid => mid !== id)
    if (selectedModeloId.value === id) {
      selectedModeloId.value = null
    }
  }

  async function getMotorIdsByModelo(modeloId: string): Promise<string[]> {
    return await catalogService.getMotorIdsByModelo(modeloId)
  }

  async function getMotoresForBrand(fabricanteId: string): Promise<Motor[]> {
    return await catalogService.getMotores(fabricanteId, undefined, false)
  }

  async function syncModeloMotores(
    modeloId: string,
    selectedMotors: Array<{ id: string; codigo: string }>
  ): Promise<void> {
    await catalogService.syncModeloMotores(modeloId, selectedMotors)
    if (selectedMotorId.value) {
      modeloIdsDelMotor.value = await catalogService.getModeloIdsByMotor(selectedMotorId.value).catch(() => [])
    }
  }

  /**
   * Carga motores desde Supabase filtrados por fabricante o modelo
   */
  async function fetchMotores(fabricanteId?: string, modeloId?: string, onlyWithParts?: boolean) {
    loadingMotores.value = true
    error.value = null
    try {
      const shouldFilter = onlyWithParts !== undefined ? onlyWithParts : onlyMotorsWithParts.value
      motores.value = await catalogService.getMotores(fabricanteId, modeloId, shouldFilter)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar motores'
      error.value = msg
    } finally {
      loadingMotores.value = false
    }
  }

  /**
   * Alternar o configurar la exclusión de motores sin repuestos
   */
  async function toggleOnlyMotorsWithParts() {
    onlyMotorsWithParts.value = !onlyMotorsWithParts.value
    await fetchMotores(selectedFabricanteId.value || undefined, selectedModeloId.value || undefined)
  }

  async function setOnlyMotorsWithParts(val: boolean) {
    onlyMotorsWithParts.value = val
    await fetchMotores(selectedFabricanteId.value || undefined, selectedModeloId.value || undefined)
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
   * Carga repuestos pertenecientes a un grupo/categoría técnica directamente desde Supabase
   * Soporta selección estricta de columnas, paginación por cursor y streaming reactivo
   */
  async function fetchRepuestosByGrupo(
    categoria: string, 
    subsistema?: string, 
    fabricanteId?: string, 
    modeloId?: string,
    options?: { append?: boolean; cursor?: string; limit?: number }
  ) {
    if (!categoria) {
      repuestos.value = []
      hasMoreRepuestos.value = false
      repuestosCursor.value = null
      totalRepuestosCount.value = 0
      return
    }

    if (options?.append) {
      isLoadingMore.value = true
    } else {
      loadingRepuestos.value = true
      repuestosCursor.value = null
    }
    repuestosError.value = null

    try {
      const res = await catalogService.getRepuestosByGrupo(
        categoria, 
        subsistema, 
        fabricanteId, 
        modeloId,
        { cursor: options?.cursor, limit: options?.limit ?? 150 }
      )

      if (options?.append) {
        const existingIds = new Set(repuestos.value.map(r => r.id))
        const newItems = res.filter(r => !existingIds.has(r.id))
        repuestos.value = [...repuestos.value, ...newItems]
      } else {
        repuestos.value = res
      }

      hasMoreRepuestos.value = Boolean(res.hasMore)
      repuestosCursor.value = res.nextCursor || null
      totalRepuestosCount.value = res.totalCount ?? repuestos.value.length
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar repuestos del grupo'
      repuestosError.value = msg
    } finally {
      loadingRepuestos.value = false
      isLoadingMore.value = false
    }
  }

  /**
   * Carga el siguiente lote de repuestos técnicos desde Supabase mediante cursor
   */
  async function loadMoreRepuestos() {
    if (!hasMoreRepuestos.value || !repuestosCursor.value || isLoadingMore.value) return
    if (!selectedComponentId.value) return
    const currentGrupo = grupos.value.find(g => g.codigo === selectedComponentId.value)
    const categoria = currentGrupo?.categoria || selectedComponentId.value

    await fetchRepuestosByGrupo(
      categoria,
      undefined,
      selectedFabricanteId.value || undefined,
      selectedModeloId.value || undefined,
      { append: true, cursor: repuestosCursor.value, limit: 150 }
    )
  }

  /**
   * Carga todos los lotes restantes sucesivamente
   */
  async function loadAllRepuestos() {
    while (hasMoreRepuestos.value && repuestosCursor.value && !isLoadingMore.value) {
      await loadMoreRepuestos()
    }
  }

  /**
   * Búsqueda por código OEM, descripción o equivalencia (cruce Dokuro, Rik, Taiho, NDC, etc.)
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
    modeloIdsDelMotor.value = []
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
    modeloIdsDelMotor.value = []
    repuestos.value = []

    if (modeloId) {
      const mod = modelos.value.find(m => m.id === modeloId)
      if (mod && mod.fabricante_id && selectedFabricanteId.value !== mod.fabricante_id) {
        selectedFabricanteId.value = mod.fabricante_id
        await fetchModelos(mod.fabricante_id)
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
    modeloIdsDelMotor.value = []
    if (!motorId) {
      repuestos.value = []
      return
    }
    modeloIdsDelMotor.value = await catalogService.getModeloIdsByMotor(motorId).catch(() => [])

    const mot = motores.value.find(m => m.id === motorId)
    if (mot) {
      // Sincronizar fabricante acorde al motor seleccionado
      if (mot.fabricante_id && selectedFabricanteId.value !== mot.fabricante_id) {
        selectedFabricanteId.value = mot.fabricante_id
        await fetchModelos(mot.fabricante_id)
      }
      // Si el motor ya trae modelo asignado (o único compatible), auto-seleccionarlo
      const matchingMods = availableModelos.value
      const explicitModelId = mot.modelo_id || mot.modelo?.id || null
      if (explicitModelId && matchingMods.some(m => m.id === explicitModelId)) {
        selectedModeloId.value = explicitModelId
      } else if (selectedModeloId.value && matchingMods.some(m => m.id === selectedModeloId.value)) {
        // Mantener el modelo actual si es compatible con el motor
      } else if (modeloIdsDelMotor.value.length === 1 && matchingMods.some(m => m.id === modeloIdsDelMotor.value[0])) {
        selectedModeloId.value = modeloIdsDelMotor.value[0]
      } else if (matchingMods.length === 1) {
        selectedModeloId.value = matchingMods[0].id
      } else {
        selectedModeloId.value = explicitModelId
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
    modeloIdsDelMotor.value = []
    selectedComponentId.value = null
    searchQuery.value = ''
    activeBrandFilter.value = 'Todas las marcas'
    repuestos.value = []
    hasMoreRepuestos.value = false
    repuestosCursor.value = null
    totalRepuestosCount.value = 0
    isLoadingMore.value = false
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
      if (created.motor_id) {
        await Promise.all([
          fetchModelos(selectedFabricanteId.value || undefined),
          fetchMotores(selectedFabricanteId.value || undefined, selectedModeloId.value || undefined)
        ])
      }
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
   * Modifica un repuesto técnico existente y actualiza la lista reactiva
   */
  async function updateRepuesto(
    partId: string,
    partData: Partial<RepuestoTecnico>,
    equivalencias?: Array<{ marca_alterna: string; codigo_alterno: string; notas?: string }>
  ) {
    isSaving.value = true
    error.value = null
    try {
      const updated = await catalogService.updateRepuesto(partId, partData, equivalencias)
      const idx = repuestos.value.findIndex(r => r.id === partId)
      if (idx >= 0) {
        repuestos.value[idx] = updated
      } else {
        repuestos.value.unshift(updated)
      }
      if (updated.motor_id) {
        await Promise.all([
          fetchModelos(selectedFabricanteId.value || undefined),
          fetchMotores(selectedFabricanteId.value || undefined, selectedModeloId.value || undefined)
        ])
      }
      return updated
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el repuesto en Supabase'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Elimina un repuesto técnico de Supabase y de la lista reactiva
   */
  async function deleteRepuesto(partId: string) {
    isSaving.value = true
    error.value = null
    try {
      await catalogService.deleteRepuesto(partId)
      repuestos.value = repuestos.value.filter(r => r.id !== partId && r.codigo_oem !== partId)
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el repuesto'
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
   * Modifica una familia / grupo de repuestos existente y sus parámetros dinámicos
   */
  async function updateGrupo(idOrCode: string, grupoData: Partial<GrupoRepuestoInsert>) {
    isSaving.value = true
    error.value = null
    try {
      const updated = await catalogService.updateGrupo(idOrCode, grupoData)
      const idx = grupos.value.findIndex(g => g.id === updated.id || g.codigo === updated.codigo || g.id === idOrCode || g.codigo === idOrCode)
      if (idx >= 0) {
        const next = [...grupos.value]
        next[idx] = updated
        grupos.value = next
      } else {
        grupos.value = [...grupos.value, updated]
      }
      return updated
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el grupo en Supabase'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Elimina una familia / grupo de repuestos de Supabase y la retira de la lista reactiva
   */
  async function deleteGrupo(idOrCode: string) {
    isSaving.value = true
    error.value = null
    try {
      const target = grupos.value.find(g => g.id === idOrCode || g.codigo === idOrCode)
      await catalogService.deleteGrupo(target?.id || idOrCode, target?.codigo)
      grupos.value = grupos.value.filter(g => g.id !== idOrCode && g.codigo !== idOrCode)
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar la familia'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Registra un nuevo fabricante/marca y lo selecciona reactivamente
   */
  async function createFabricante(fabData: { nombre: string; pais_origen?: string }) {
    isSaving.value = true
    error.value = null
    try {
      const created = await catalogService.createFabricante(fabData)
      if (!fabricantes.value.some(f => f.id === created.id || f.nombre.toLowerCase() === created.nombre.toLowerCase())) {
        fabricantes.value = [...fabricantes.value, created]
      }
      return created
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el fabricante'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function updateFabricante(id: string, fabData: { nombre: string; pais_origen?: string }) {
    isSaving.value = true
    error.value = null
    try {
      const updated = await catalogService.updateFabricante(id, fabData)
      fabricantes.value = fabricantes.value.map(f => (f.id === id ? { ...f, ...updated } : f))
      return updated
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el fabricante'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function deleteFabricante(id: string) {
    isSaving.value = true
    error.value = null
    try {
      await catalogService.deleteFabricante(id)
      const deletedMotorIds = new Set(motores.value.filter(m => m.fabricante_id === id).map(m => m.id))
      const deletedModelIds = new Set(modelos.value.filter(m => m.fabricante_id === id).map(m => m.id))
      fabricantes.value = fabricantes.value.filter(f => f.id !== id)
      modelos.value = modelos.value.filter(m => m.fabricante_id !== id)
      motores.value = motores.value.filter(m => m.fabricante_id !== id)
      if (selectedFabricanteId.value === id) {
        selectedFabricanteId.value = null
      }
      if (selectedModeloId.value && deletedModelIds.has(selectedModeloId.value)) {
        selectedModeloId.value = null
      }
      if (selectedMotorId.value && deletedMotorIds.has(selectedMotorId.value)) {
        selectedMotorId.value = null
        modeloIdsDelMotor.value = []
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el fabricante'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Registra un nuevo motor y lo incorpora reactivamente al catálogo
   */
  async function createMotor(motorData: Partial<Motor>) {
    isSaving.value = true
    error.value = null
    try {
      const created = await catalogService.createMotor(motorData)
      if (!motores.value.some(m => m.id === created.id)) {
        motores.value = [created, ...motores.value]
      }
      return created
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el motor'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function updateMotor(id: string, motorData: Partial<Motor>) {
    isSaving.value = true
    error.value = null
    try {
      const updated = await catalogService.updateMotor(id, motorData)
      motores.value = motores.value.map(m =>
        m.id === id
          ? {
              ...m,
              ...updated,
              parts_count: m.parts_count ?? updated.parts_count
            }
          : m
      )
      if (selectedMotorId.value === id) {
        modeloIdsDelMotor.value = updated.modelo_ids || []
      }
      return updated
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el motor'
      error.value = msg
      throw err
    } finally {
      isSaving.value = false
    }
  }

  async function deleteMotor(id: string) {
    isSaving.value = true
    error.value = null
    try {
      await catalogService.deleteMotor(id)
      motores.value = motores.value.filter(m => m.id !== id)
      if (selectedMotorId.value === id) {
        selectedMotorId.value = null
        modeloIdsDelMotor.value = []
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el motor'
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
    modeloIdsDelMotor,
    selectedMotorId,
    selectedComponentId,
    onlyMotorsWithParts,
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
    hasMoreRepuestos,
    repuestosCursor,
    totalRepuestosCount,
    isLoadingMore,

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
    loadMoreRepuestos,
    loadAllRepuestos,
    createModelo,
    updateModelo,
    deleteModelo,
    getMotorIdsByModelo,
    getMotoresForBrand,
    syncModeloMotores,
    fetchGrupos,
    createGrupo,
    updateGrupo,
    deleteGrupo,
    createFabricante,
    updateFabricante,
    deleteFabricante,
    createMotor,
    updateMotor,
    deleteMotor,
    searchParts,
    selectFabricante,
    selectModelo,
    selectMotor,
    resetFilters,
    createRepuesto,
    updateRepuesto,
    deleteRepuesto,
    toggleOnlyMotorsWithParts,
    setOnlyMotorsWithParts,
    initCatalog
  }
})
