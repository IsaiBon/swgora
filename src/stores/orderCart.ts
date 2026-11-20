import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from './auth'

export interface OrderCartItem {
  id: string
  code: string
  name: string
  price: number
  category: string
  brand: string
  motor: string
  catalogOrigin?: string
  imageUrl?: string
  quantity: number
  addedAt: number
}

export type OrderCartPartPayload = Omit<OrderCartItem, 'quantity' | 'addedAt'>

const LEGACY_STORAGE_KEY = 'swgora_cart_parts'

function normalizeMotorValue(motor?: unknown): string {
  if (typeof motor !== 'string') return ''
  const trimmed = motor.trim()
  if (!trimmed || trimmed.toLowerCase() === 'universal') return ''
  return trimmed
}

function sanitizeNumber(val: unknown, fallback = 0): number {
  const num = Number(val)
  return Number.isFinite(num) ? num : fallback
}

function purgeLegacyOrderCartStorage(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Silencioso en entornos con almacenamiento restringido
  }
}

export const useOrderCartStore = defineStore('orderCart', () => {
  purgeLegacyOrderCartStorage()

  const authStore = useAuthStore()

  // Alcance único por sesión autenticada: aísla el listado por empresa, ruta, usuario y rol.
  const activeAccountScope = computed<string | null>(() => {
    const u = authStore.user
    if (!u || !u.id) return null
    const tenantPart = (u.tenantId || 'global').trim()
    const rutaPart = (u.rutaId || 'all').trim()
    const rolePart = (u.role || '').trim()
    return `${tenantPart}::${rutaPart}::${u.id.trim()}::${rolePart}`
  })

  // Estado temporal estrictamente en memoria (sin caché global en localStorage).
  const rawItems = ref<OrderCartItem[]>([])
  const ownerScope = ref<string | null>(activeAccountScope.value)

  const items = computed<OrderCartItem[]>(() => {
    if (!activeAccountScope.value || ownerScope.value !== activeAccountScope.value) {
      return []
    }
    return rawItems.value
  })

  const resetSession = (): void => {
    rawItems.value = []
    ownerScope.value = activeAccountScope.value
    purgeLegacyOrderCartStorage()
  }

  // Limpieza síncrona inmediata al cerrar sesión o cambiar de cuenta/taller/ruta/rol.
  watch(
    activeAccountScope,
    (nextScope) => {
      rawItems.value = []
      ownerScope.value = nextScope
      purgeLegacyOrderCartStorage()
    },
    { flush: 'sync' }
  )

  const uniqueCount = computed(() => items.value.length)

  const totalUnits = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  const estimatedTotal = computed(() =>
    Number(
      items.value
        .reduce((sum, item) => sum + item.quantity * (item.price || 0), 0)
        .toFixed(2)
    )
  )

  const hasItems = computed(() => items.value.length > 0)

  const itemsWithoutPriceCount = computed(
    () => items.value.filter(item => !(item.price > 0)).length
  )

  const getItemQuantity = (partId: string): number => {
    const found = items.value.find(item => item.id === partId)
    return found ? found.quantity : 0
  }

  const isInCart = (partId: string): boolean => {
    return items.value.some(item => item.id === partId)
  }

  const addPart = (payload: OrderCartPartPayload, qty = 1): OrderCartItem | null => {
    const currentScope = activeAccountScope.value
    if (!currentScope) {
      resetSession()
      return null
    }
    if (ownerScope.value !== currentScope) {
      rawItems.value = []
      ownerScope.value = currentScope
    }

    const cleanQty = Math.max(1, Math.floor(sanitizeNumber(qty, 1)))
    const cleanPrice = sanitizeNumber(payload.price, 0)
    const normalizedPrice = cleanPrice > 0 ? Number(cleanPrice.toFixed(2)) : 0
    const normalizedBrand = (payload.brand || '').trim()
    const normalizedMotor = normalizeMotorValue(payload.motor)
    const normalizedCode = (payload.code || '').trim()
    const normalizedName = (payload.name || '').trim() || normalizedCode || 'Repuesto'
    const normalizedCategory = (payload.category || '').trim() || 'Repuestos'
    const normalizedOrigin = payload.catalogOrigin?.trim() || undefined
    const normalizedImage = payload.imageUrl?.trim() || undefined

    const existing = rawItems.value.find(item => item.id === payload.id)
    if (existing) {
      existing.quantity += cleanQty
      if (!existing.code && normalizedCode) existing.code = normalizedCode
      if (!existing.name && normalizedName) existing.name = normalizedName
      if (normalizedPrice > 0) existing.price = normalizedPrice
      if (!existing.brand && normalizedBrand) existing.brand = normalizedBrand
      if (!existing.motor && normalizedMotor) existing.motor = normalizedMotor
      if (!existing.catalogOrigin && normalizedOrigin) existing.catalogOrigin = normalizedOrigin
      if (!existing.imageUrl && normalizedImage) existing.imageUrl = normalizedImage
      return existing
    }

    const newItem: OrderCartItem = {
      id: payload.id,
      code: normalizedCode,
      name: normalizedName,
      price: normalizedPrice,
      category: normalizedCategory,
      brand: normalizedBrand,
      motor: normalizedMotor,
      ...(normalizedOrigin ? { catalogOrigin: normalizedOrigin } : {}),
      ...(normalizedImage ? { imageUrl: normalizedImage } : {}),
      quantity: cleanQty,
      addedAt: Date.now(),
    }

    rawItems.value.push(newItem)
    return newItem
  }

  const setQuantity = (partId: string, quantity: number): void => {
    if (!activeAccountScope.value || ownerScope.value !== activeAccountScope.value) return
    const cleanQty = Math.floor(sanitizeNumber(quantity, 0))
    if (cleanQty <= 0) {
      removePart(partId)
      return
    }
    const found = rawItems.value.find(item => item.id === partId)
    if (!found) return
    found.quantity = cleanQty
  }

  const updatePartPrice = (partId: string, price: number): void => {
    if (!activeAccountScope.value || ownerScope.value !== activeAccountScope.value) return
    const found = rawItems.value.find(item => item.id === partId)
    if (!found) return
    const cleanPrice = sanitizeNumber(price, 0)
    found.price = cleanPrice > 0 ? Number(cleanPrice.toFixed(2)) : 0
  }

  const increment = (partId: string): void => {
    if (!activeAccountScope.value || ownerScope.value !== activeAccountScope.value) return
    const found = rawItems.value.find(item => item.id === partId)
    if (!found) return
    found.quantity += 1
  }

  const decrement = (partId: string): void => {
    if (!activeAccountScope.value || ownerScope.value !== activeAccountScope.value) return
    const found = rawItems.value.find(item => item.id === partId)
    if (!found) return
    if (found.quantity <= 1) {
      removePart(partId)
      return
    }
    found.quantity -= 1
  }

  const removePart = (partId: string): void => {
    if (!activeAccountScope.value || ownerScope.value !== activeAccountScope.value) return
    rawItems.value = rawItems.value.filter(item => item.id !== partId)
  }

  const clearCart = (): void => {
    rawItems.value = []
    purgeLegacyOrderCartStorage()
  }

  const getSuggestedVehicle = (): { brand: string; motor: string } => {
    const uniqueBrands = new Map<string, string>()
    const uniqueMotors = new Map<string, string>()

    for (const item of items.value) {
      const b = item.brand.trim()
      if (b) {
        uniqueBrands.set(b.toLowerCase(), b)
      }
      const m = normalizeMotorValue(item.motor)
      if (m) {
        uniqueMotors.set(m.toLowerCase(), m)
      }
    }

    const brand = uniqueBrands.size === 1 ? Array.from(uniqueBrands.values())[0]! : ''
    const motor = uniqueMotors.size === 1 ? Array.from(uniqueMotors.values())[0]! : ''

    return { brand, motor }
  }

  return {
    items,
    uniqueCount,
    totalUnits,
    estimatedTotal,
    hasItems,
    itemsWithoutPriceCount,
    getItemQuantity,
    isInCart,
    addPart,
    setQuantity,
    updatePartPrice,
    increment,
    decrement,
    removePart,
    clearCart,
    resetSession,
    getSuggestedVehicle,
  }
})
