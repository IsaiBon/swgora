<script setup lang="ts">
import { computed } from 'vue'
import type { Cliente, ClientStatus } from '@/services/clientesService'
import {
  PhoneCall,
  MapPin,
  MessageCircle,
  Pencil,
  FileText,
  Wrench,
  User,
  ExternalLink,
  Ban,
  RotateCcw,
} from 'lucide-vue-next'

const props = defineProps<{
  client: Cliente
}>()

const emit = defineEmits<{
  (e: 'edit', client: Cliente): void
  (e: 'viewOrders', client: Cliente): void
  (e: 'toggleStatus', id: string, newStatus: ClientStatus): void
}>()

const isTallerista = computed(() => props.client.tipo === 'Tallerista')
const isActivo = computed(() => props.client.estado === 'Activo')

const statusBadge = computed(() => {
  return isActivo.value
    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
    : 'bg-amber-50 text-amber-700 border-amber-300'
})

const mapsUrl = computed(() => {
  if (!props.client.direccion) return '#'
  const query = encodeURIComponent(props.client.direccion)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
})

const cleanPhoneForWa = computed(() => {
  return props.client.telefono ? props.client.telefono.replace(/\D/g, '') : ''
})

const handleToggleStatus = () => {
  const nextStatus: ClientStatus = isActivo.value ? 'Inactivo' : 'Activo'
  emit('toggleStatus', props.client.id, nextStatus)
}
</script>

<template>
  <div
    :class="[
      'bg-white rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden group shadow-sm hover:shadow-xl',
      isActivo ? 'border-slate-200/90 hover:border-[#05C7F2]/60' : 'border-amber-200/70 bg-amber-50/20 opacity-90'
    ]"
  >
    <!-- Card Top Header -->
    <div class="p-5 sm:p-6 pb-4">
      <div class="flex items-start justify-between gap-2.5 mb-2">
        <!-- Client Avatar / Type Icon -->
        <div class="flex items-center gap-3">
          <div
            :class="[
              'w-12 h-12 rounded-2xl border flex items-center justify-center transition-all shadow-inner',
              isTallerista
                ? 'bg-amber-50 border-amber-200 text-amber-600'
                : 'bg-[#05C7F2]/10 border-[#05C7F2]/30 text-[#04C4D9]'
            ]"
          >
            <Wrench v-if="isTallerista" class="w-6 h-6" />
            <User v-else class="w-6 h-6" />
          </div>
          <div>
            <h4 class="text-base font-bold text-slate-900 leading-tight group-hover:text-[#04C4D9] transition-colors">
              {{ client.nombre }}
            </h4>
            <div class="flex items-center gap-1.5 mt-1">
              <!-- Tipo Badge -->
              <span
                :class="[
                  'text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border',
                  isTallerista
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
                ]"
              >
                {{ client.tipo }}
              </span>
            </div>
          </div>
        </div>

        <!-- Estado Badge (Activo / Inactivo) -->
        <span
          :class="[
            'text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1',
            statusBadge,
          ]"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="isActivo ? 'bg-emerald-500' : 'bg-amber-500'"></span>
          <span>{{ client.estado }}</span>
        </span>
      </div>

      <!-- Notas o Especificaciones Técnicas del Taller -->
      <div v-if="client.especificaciones_tecnicas?.notas || client.especificaciones_tecnicas?.servicios || client.especificaciones_tecnicas?.flotilla" class="mt-3 p-2.5 rounded-2xl bg-[#F2F2F2] border border-slate-200/60 text-xs">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
          Especialidad / Notas de Rectificación:
        </div>
        <p class="font-medium text-slate-800 line-clamp-2">
          {{ client.especificaciones_tecnicas?.notas || client.especificaciones_tecnicas?.servicios || client.especificaciones_tecnicas?.flotilla }}
        </p>
      </div>

      <!-- Dirección Snippet -->
      <div class="mt-3 flex items-start gap-2 text-xs text-slate-600">
        <MapPin class="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <span class="line-clamp-1">{{ client.direccion || 'Sin dirección registrada' }}</span>
      </div>
    </div>

    <!-- Middle: Big Touch Action Shortcuts (Táctil de Taller) -->
    <div class="px-5 sm:px-6 py-3 bg-slate-50/90 border-t border-b border-slate-100 flex items-center gap-2">
      <!-- Direct Call Button -->
      <a
        v-if="client.telefono"
        :href="'tel:' + client.telefono"
        class="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-[#0D0D0D] hover:bg-black text-white text-xs font-bold transition shadow-sm active:scale-95"
        title="Llamar al cliente"
      >
        <PhoneCall class="w-4 h-4 text-[#05F2F2]" />
        <span>Llamar</span>
      </a>
      <div v-else class="flex-1 text-center text-xs text-slate-400 py-2.5">
        Sin teléfono
      </div>

      <!-- Direct Map Button -->
      <a
        v-if="client.direccion"
        :href="mapsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex-1 min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white hover:bg-[#05C7F2]/10 border border-slate-200 hover:border-[#05C7F2] text-slate-800 hover:text-[#04C4D9] text-xs font-bold transition shadow-sm active:scale-95"
        title="Abrir ubicación en Google Maps"
      >
        <MapPin class="w-4 h-4 text-[#04C4D9]" />
        <span>Mapa</span>
        <ExternalLink class="w-3 h-3 opacity-60" />
      </a>

      <!-- Direct WhatsApp Button -->
      <a
        v-if="cleanPhoneForWa"
        :href="'https://wa.me/' + cleanPhoneForWa"
        target="_blank"
        rel="noopener noreferrer"
        class="min-h-[46px] min-w-[46px] inline-flex items-center justify-center rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-sm active:scale-95"
        title="Enviar mensaje de WhatsApp"
      >
        <MessageCircle class="w-5 h-5" />
      </a>

      <!-- Edit Button -->
      <button
        type="button"
        @click="$emit('edit', client)"
        class="min-h-[46px] min-w-[46px] inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition shadow-sm active:scale-95"
        title="Editar información del cliente"
      >
        <Pencil class="w-4 h-4" />
      </button>
    </div>

    <!-- Card Bottom Footer: Borrado Lógico, Órdenes & Fecha -->
    <div class="px-5 sm:px-6 py-3 flex items-center justify-between text-xs text-slate-500 bg-white border-t border-slate-100">
      <!-- Botón de Borrado Lógico Rápido (Inactivar / Reactivar) -->
      <button
        type="button"
        @click="handleToggleStatus"
        :class="[
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition border',
          isActivo
            ? 'text-amber-700 bg-amber-50/80 hover:bg-amber-100 border-amber-200'
            : 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200'
        ]"
        :title="isActivo ? 'Inactivar cliente (borrado lógico)' : 'Reactivar cliente'"
      >
        <Ban v-if="isActivo" class="w-3 h-3 text-amber-600" />
        <RotateCcw v-else class="w-3 h-3 text-emerald-600" />
        <span>{{ isActivo ? 'Inactivar' : 'Reactivar' }}</span>
      </button>

      <!-- Botón Ver Historial de Órdenes -->
      <button
        type="button"
        @click="$emit('viewOrders', client)"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 bg-slate-100 hover:bg-[#05C7F2]/15 hover:text-[#04C4D9] border border-slate-200 hover:border-[#05C7F2]/40 transition active:scale-95"
        title="Consultar historial de órdenes de este cliente"
      >
        <FileText class="w-3.5 h-3.5 text-[#04C4D9]" />
        <span>Ver Órdenes</span>
      </button>
    </div>
  </div>
</template>
