import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from './auth'

export interface SelectedCatalogPart {
  id: string
  codigo_oem: string
  nombre: string
  categoria: string
}

/**
 * Store en memoria para selección múltiple y eliminación masiva de repuestos del catálogo.
 * Estrictamente restringido a administradores principales y aislado al alcance de la sesión activa;
 * nunca persiste en localStorage ni sessionStorage y se reinicia al cerrar sesión o cambiar de cuenta/rol.
 */
export const useCatalogSelectionStore = defineStore('catalogSelection', () => {
  const authStore = useAuthStore()

  const activeAdminScope = computed<string | null>(() => {
    if (!authStore.isAuthenticated || !authStore.isAdmin) return null
    const u = authStore.user
    if (!u || !u.id) return null
    const tenantPart = (u.tenantId || 'global').trim()
    const rutaPart = (u.rutaId || 'all').trim()
    const rolePart = (u.role || '').trim()
    return `${tenantPart}::${rutaPart}::${u.id.trim()}::${rolePart}`
  })

  const rawItems = ref<SelectedCatalogPart[]>([])
  const ownerScope = ref<string | null>(activeAdminScope.value)

  const items = computed<SelectedCatalogPart[]>(() => {
    if (!activeAdminScope.value || ownerScope.value !== activeAdminScope.value) {
      return []
    }
    return rawItems.value
  })

  const clear = (): void => {
    rawItems.value = []
    ownerScope.value = activeAdminScope.value
  }

  // Reinicio síncrono inmediato ante cierre de sesión, cambio de usuario, taller, ruta o rol.
  watch(
    activeAdminScope,
    (nextScope) => {
      rawItems.value = []
      ownerScope.value = nextScope
    },
    { flush: 'sync' }
  )

  const selectedIds = computed<Set<string>>(() => {
    return new Set(items.value.map((item) => item.id))
  })

  const count = computed<number>(() => items.value.length)

  const hasSelection = computed<boolean>(() => items.value.length > 0)

  const isSelected = (partId: string): boolean => {
    return selectedIds.value.has(partId)
  }

  const ensureActiveWritableScope = (): boolean => {
    const scope = activeAdminScope.value
    if (!scope) {
      clear()
      return false
    }
    if (ownerScope.value !== scope) {
      rawItems.value = []
      ownerScope.value = scope
    }
    return true
  }

  const normalizePartPayload = (part: SelectedCatalogPart): SelectedCatalogPart => ({
    id: part.id,
    codigo_oem: (part.codigo_oem || '').trim() || '—',
    nombre: (part.nombre || '').trim() || 'Repuesto',
    categoria: (part.categoria || '').trim() || 'General',
  })

  const toggle = (part: SelectedCatalogPart): void => {
    if (!ensureActiveWritableScope()) return
    if (rawItems.value.some((item) => item.id === part.id)) {
      rawItems.value = rawItems.value.filter((item) => item.id !== part.id)
      return
    }
    rawItems.value.push(normalizePartPayload(part))
  }

  const selectMany = (parts: SelectedCatalogPart[]): void => {
    if (!ensureActiveWritableScope() || parts.length === 0) return
    const existingIds = new Set(rawItems.value.map((item) => item.id))
    const toAdd: SelectedCatalogPart[] = []
    for (const part of parts) {
      if (!part.id || existingIds.has(part.id)) continue
      existingIds.add(part.id)
      toAdd.push(normalizePartPayload(part))
    }
    if (toAdd.length > 0) {
      rawItems.value.push(...toAdd)
    }
  }

  const deselectMany = (partIds: string[]): void => {
    if (!activeAdminScope.value || ownerScope.value !== activeAdminScope.value) return
    if (partIds.length === 0) return
    const removeSet = new Set(partIds)
    rawItems.value = rawItems.value.filter((item) => !removeSet.has(item.id))
  }

  const deselect = (partId: string): void => {
    if (!activeAdminScope.value || ownerScope.value !== activeAdminScope.value) return
    rawItems.value = rawItems.value.filter((item) => item.id !== partId)
  }

  return {
    items,
    selectedIds,
    count,
    hasSelection,
    isSelected,
    toggle,
    selectMany,
    deselectMany,
    deselect,
    clear,
  }
})
