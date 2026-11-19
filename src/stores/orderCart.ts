import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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

const STORAGE_KEY = 'swgora_cart_parts'

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

function sanitizeCartItems(rawList: unknown): OrderCartItem[] {
  if (!Array.isArray(rawList)) return []

  const deduped = new Map<string, OrderCartItem>()

  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>

    const id = typeof raw.id === 'string' ? raw.id.trim() : String(raw.id ?? '').trim()
    if (!id) continue

    const code = typeof raw.code === 'string' ? raw.code.trim() : ''
    const name = typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : (code || 'Repuesto')
    if (!code && !name) continue

    const rawPrice = sanitizeNumber(raw.price, 0)
    const price = rawPrice > 0 ? Number(rawPrice.toFixed(2)) : 0
    const rawQty = Math.floor(sanitizeNumber(raw.quantity, 1))
    const quantity = Math.max(1, rawQty)
    const category = typeof raw.category === 'string' && raw.category.trim()
      ? raw.category.trim()
      : 'Repuestos'
    const brand = typeof raw.brand === 'string' ? raw.brand.trim() : ''
    const motor = normalizeMotorValue(raw.motor)
    const catalogOrigin = typeof raw.catalogOrigin === 'string' && raw.catalogOrigin.trim()
      ? raw.catalogOrigin.trim()
      : undefined
    const imageUrl = typeof raw.imageUrl === 'string' && raw.imageUrl.trim()
      ? raw.imageUrl.trim()
      : undefined
    const addedAt = Number.isFinite(Number(raw.addedAt))
      ? Number(raw.addedAt)
      : (Number.isFinite(Number(raw.timestamp)) ? Number(raw.timestamp) : Date.now())

    const existing = deduped.get(id)
    if (existing) {
      existing.quantity += quantity
      if (!existing.code && code) existing.code = code
      if (!existing.name && name) existing.name = name
      if (!(existing.price > 0) && price > 0) existing.price = price
      if (!existing.brand && brand) existing.brand = brand
      if (!existing.motor && motor) existing.motor = motor
      if (!existing.catalogOrigin && catalogOrigin) existing.catalogOrigin = catalogOrigin
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl
    } else {
      deduped.set(id, {
        id,
        code,
        name,
        price,
        category,
        brand,
        motor,
        ...(catalogOrigin ? { catalogOrigin } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        quantity,
        addedAt,
      })
    }
  }

  return Array.from(deduped.values())
}

function loadFromStorage(): OrderCartItem[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return []
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return sanitizeCartItems(parsed)
  } catch {
    return []
  }
}

export const useOrderCartStore = defineStore('orderCart', () => {
  const items = ref<OrderCartItem[]>(loadFromStorage())

  const persistToStorage = () => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch {
      // Silencioso en caso de cuota llena o navegación privada estricta
    }
  }

  // Asegurar que cualquier migración de formato antiguo quede guardada limpiamente
  if (items.value.length > 0) {
    persistToStorage()
  }

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

  const addPart = (payload: OrderCartPartPayload, qty = 1): OrderCartItem => {
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

    const existing = items.value.find(item => item.id === payload.id)
    if (existing) {
      existing.quantity += cleanQty
      if (!existing.code && normalizedCode) existing.code = normalizedCode
      if (!existing.name && normalizedName) existing.name = normalizedName
      if (!(existing.price > 0) && normalizedPrice > 0) existing.price = normalizedPrice
      if (!existing.brand && normalizedBrand) existing.brand = normalizedBrand
      if (!existing.motor && normalizedMotor) existing.motor = normalizedMotor
      if (!existing.catalogOrigin && normalizedOrigin) existing.catalogOrigin = normalizedOrigin
      if (!existing.imageUrl && normalizedImage) existing.imageUrl = normalizedImage
      persistToStorage()
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

    items.value.push(newItem)
    persistToStorage()
    return newItem
  }

  const setQuantity = (partId: string, quantity: number): void => {
    const cleanQty = Math.floor(sanitizeNumber(quantity, 0))
    if (cleanQty <= 0) {
      removePart(partId)
      return
    }
    const found = items.value.find(item => item.id === partId)
    if (!found) return
    found.quantity = cleanQty
    persistToStorage()
  }

  const increment = (partId: string): void => {
    const found = items.value.find(item => item.id === partId)
    if (!found) return
    found.quantity += 1
    persistToStorage()
  }

  const decrement = (partId: string): void => {
    const found = items.value.find(item => item.id === partId)
    if (!found) return
    if (found.quantity <= 1) {
      removePart(partId)
      return
    }
    found.quantity -= 1
    persistToStorage()
  }

  const removePart = (partId: string): void => {
    const prevLength = items.value.length
    items.value = items.value.filter(item => item.id !== partId)
    if (items.value.length !== prevLength) {
      persistToStorage()
    }
  }

  const clearCart = (): void => {
    if (items.value.length === 0) return
    items.value = []
    persistToStorage()
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
    increment,
    decrement,
    removePart,
    clearCart,
    getSuggestedVehicle,
  }
})
