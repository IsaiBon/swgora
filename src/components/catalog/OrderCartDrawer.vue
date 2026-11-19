<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useOrderCartStore } from '@/stores/orderCart'
import { useAuthStore } from '@/stores/auth'
import {
  ClipboardList,
  X,
  Package,
  Plus,
  Minus,
  Trash2,
  Wrench,
  Clock,
  ArrowRight,
  AlertCircle,
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-order', docType: 'orden' | 'cotizacion'): void
}>()

const orderCartStore = useOrderCartStore()
const authStore = useAuthStore()

const selectedDocType = ref<'orden' | 'cotizacion'>('orden')

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (typeof window === 'undefined') return
    if (open) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})

const handleCreateOrder = () => {
  if (!orderCartStore.hasItems || !authStore.canAccess('/ordenes')) return
  emit('create-order', selectedDocType.value)
}

const formatMoney = (val: number) => {
  return `$${Number(val || 0).toFixed(2)}`
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen && authStore.isAuthenticated"
        class="fixed inset-0 z-50 flex justify-end bg-[#09132B]/60 backdrop-blur-sm"
        @click.self="emit('close')"
        role="dialog"
        aria-modal="true"
        aria-label="Listado de orden"
      >
        <div class="w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
          <!-- Encabezado -->
          <div class="px-5 py-4 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-white/15 border border-white/20 text-[#BFEBF2] flex items-center justify-center shrink-0">
                <ClipboardList class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <h3 class="font-display text-base font-extrabold text-white tracking-tight truncate">
                  Listado de orden
                </h3>
                <p class="text-[11px] text-sky-100/90 font-medium">
                  {{ orderCartStore.uniqueCount }} repuesto(s) · {{ orderCartStore.totalUnits }} unidad(es)
                </p>
              </div>
            </div>

            <button
              type="button"
              @click="emit('close')"
              class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/85 hover:text-white transition cursor-pointer shrink-0"
              aria-label="Cerrar listado de orden"
              title="Cerrar (Esc)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Cuerpo desplazable -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70">
            <!-- Estado vacío -->
            <div
              v-if="!orderCartStore.hasItems"
              class="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-6 py-10 bg-white rounded-2xl border border-dashed border-slate-200"
            >
              <div class="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 text-[#004B97] flex items-center justify-center mb-3">
                <ClipboardList class="w-7 h-7" />
              </div>
              <h4 class="text-sm font-extrabold text-[#0D1B3E]">
                Tu listado de orden está vacío
              </h4>
              <p class="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xs">
                Presiona el botón <strong class="text-[#147488]">Añadir a la orden</strong> en cualquier repuesto del catálogo para acumular varios y crear tu orden juntos.
              </p>
            </div>

            <!-- Lista de repuestos seleccionados -->
            <div
              v-for="item in orderCartStore.items"
              :key="item.id"
              class="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-sm hover:border-[#04C4D9]/50 transition"
            >
              <div class="flex items-start gap-3">
                <!-- Miniatura o ícono -->
                <div class="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    v-if="item.imageUrl"
                    :src="item.imageUrl"
                    :alt="item.name"
                    class="w-full h-full object-cover"
                  />
                  <Package v-else class="w-5 h-5 text-slate-400" />
                </div>

                <!-- Datos principales -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <h4 class="text-xs font-extrabold text-[#0D1B3E] leading-snug line-clamp-2">
                        {{ item.name }}
                      </h4>
                      <span
                        v-if="item.code"
                        class="inline-block mt-0.5 text-[11px] font-mono font-bold text-[#004B97] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded"
                      >
                        {{ item.code }}
                      </span>
                    </div>

                    <button
                      type="button"
                      @click="orderCartStore.removePart(item.id)"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                      title="Quitar del listado"
                      aria-label="Quitar del listado"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <!-- Chips de contexto -->
                  <div class="flex flex-wrap items-center gap-1 mt-1.5">
                    <span
                      v-if="item.category"
                      class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold"
                    >
                      {{ item.category }}
                    </span>
                    <span
                      v-if="item.brand || item.motor"
                      class="px-1.5 py-0.5 rounded bg-cyan-50 text-[#038391] border border-cyan-200 text-[10px] font-bold"
                    >
                      {{ [item.brand, item.motor].filter(Boolean).join(' · ') }}
                    </span>
                    <span
                      v-if="item.catalogOrigin"
                      class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold"
                    >
                      {{ item.catalogOrigin }}
                    </span>
                  </div>

                  <!-- Cantidad y precio -->
                  <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <!-- Control de cantidad -->
                    <div class="inline-flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        @click="orderCartStore.decrement(item.id)"
                        class="w-6 h-6 rounded-md bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center shadow-sm transition cursor-pointer"
                        title="Disminuir cantidad"
                        aria-label="Disminuir cantidad"
                      >
                        <Minus class="w-3 h-3" />
                      </button>
                      <span class="px-2.5 text-xs font-mono font-extrabold text-[#0D1B3E] min-w-[28px] text-center">
                        {{ item.quantity }}
                      </span>
                      <button
                        type="button"
                        @click="orderCartStore.increment(item.id)"
                        class="w-6 h-6 rounded-md bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center shadow-sm transition cursor-pointer"
                        title="Aumentar cantidad"
                        aria-label="Aumentar cantidad"
                      >
                        <Plus class="w-3 h-3" />
                      </button>
                    </div>

                    <!-- Precio unitario + subtotal o aviso manual -->
                    <div class="text-right">
                      <template v-if="item.price > 0">
                        <div class="text-xs font-mono font-extrabold text-[#0D1B3E]">
                          {{ formatMoney(item.price * item.quantity) }}
                        </div>
                        <div class="text-[10px] text-slate-400 font-mono">
                          {{ formatMoney(item.price) }} c/u
                        </div>
                      </template>
                      <span
                        v-else
                        class="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold"
                      >
                        Precio manual en orden
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pie fijo con acciones -->
          <div
            v-if="orderCartStore.hasItems"
            class="p-4 bg-white border-t border-slate-200 space-y-3 shrink-0 shadow-sm"
          >
            <!-- Resumen de unidades y subtotal referencial -->
            <div class="space-y-1.5 text-xs">
              <div class="flex items-center justify-between text-slate-600">
                <span>Repuestos seleccionados:</span>
                <span class="font-bold text-[#0D1B3E]">
                  {{ orderCartStore.uniqueCount }} repuesto(s) · {{ orderCartStore.totalUnits }} u.
                </span>
              </div>
              <div
                v-if="orderCartStore.estimatedTotal > 0"
                class="flex items-center justify-between"
              >
                <span class="text-slate-600">Subtotal referencial:</span>
                <span class="text-sm font-mono font-extrabold text-[#004B97]">
                  {{ formatMoney(orderCartStore.estimatedTotal) }}
                </span>
              </div>
              <p
                v-if="orderCartStore.itemsWithoutPriceCount > 0"
                class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 font-medium"
              >
                {{ orderCartStore.itemsWithoutPriceCount }} repuesto(s) sin precio de catálogo: podrás ingresar el precio manualmente al crear la orden.
              </p>
            </div>

            <!-- Selector compacto de tipo de documento -->
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Documento a generar:
              </label>
              <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  @click="selectedDocType = 'orden'"
                  :class="[
                    'flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer',
                    selectedDocType === 'orden'
                      ? 'bg-[#004B97] text-white shadow-sm'
                      : 'text-slate-700 hover:text-[#0D1B3E]'
                  ]"
                >
                  <Wrench class="w-3.5 h-3.5" />
                  <span>Orden de Taller</span>
                </button>
                <button
                  type="button"
                  @click="selectedDocType = 'cotizacion'"
                  :class="[
                    'flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer',
                    selectedDocType === 'cotizacion'
                      ? 'bg-[#0D1B3E] text-white shadow-sm'
                      : 'text-slate-700 hover:text-[#0D1B3E]'
                  ]"
                >
                  <Clock class="w-3.5 h-3.5" />
                  <span>Cotización (B/N)</span>
                </button>
              </div>
            </div>

            <!-- Nota RBAC si es Consultor -->
            <div
              v-if="!authStore.canAccess('/ordenes')"
              class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-start gap-2"
            >
              <AlertCircle class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>Tu rol actual (Consultor) es de solo consulta y no tiene acceso al módulo de Órdenes.</span>
            </div>

            <!-- Botón principal Crear orden / Crear cotización -->
            <button
              type="button"
              @click="handleCreateOrder"
              :disabled="!authStore.canAccess('/ordenes')"
              class="studio-cta-primary w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>
                {{ selectedDocType === 'cotizacion' ? 'Crear cotización' : 'Crear orden' }}
                ({{ orderCartStore.totalUnits }} {{ orderCartStore.totalUnits === 1 ? 'unidad' : 'unidades' }})
              </span>
              <ArrowRight class="w-4 h-4" />
            </button>

            <!-- Fila secundaria -->
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="emit('close')"
                class="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Seguir buscando
              </button>
              <button
                type="button"
                @click="orderCartStore.clearCart()"
                class="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span>Vaciar listado</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
