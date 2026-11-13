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
  RotateCcw
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  client: Cliente
  totalBilled?: number
  ordersCount?: number
}>(), {
  totalBilled: 0,
  ordersCount: 0
})

const emit = defineEmits<{
  (e: 'edit', client: Cliente): void
  (e: 'viewOrders', client: Cliente): void
  (e: 'toggleStatus', id: string, newStatus: ClientStatus): void
}>()

const isTallerista = computed(() => props.client.tipo === 'Tallerista')
const isActivo = computed(() => props.client.estado === 'Activo')

const mapsUrl = computed(() => {
  if (!props.client.direccion) return '#'
  const query = encodeURIComponent(props.client.direccion)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
})

const cleanPhoneForWa = computed(() => {
  return props.client.telefono ? props.client.telefono.replace(/\D/g, '') : ''
})

const workshopName = computed(() => {
  return props.client.especificaciones_tecnicas?.taller || props.client.especificaciones_tecnicas?.empresa || ''
})

const technicalNotes = computed(() => {
  return props.client.especificaciones_tecnicas?.notas || props.client.especificaciones_tecnicas?.servicios || props.client.especificaciones_tecnicas?.flotilla || ''
})

const handleToggleStatus = () => {
  const nextStatus: ClientStatus = isActivo.value ? 'Inactivo' : 'Activo'
  emit('toggleStatus', props.client.id, nextStatus)
}
</script>

<template>
  <div
    :class="[
      'studio-card studio-card-hover flex flex-col justify-between overflow-hidden group',
      isActivo ? '' : 'border-amber-300 bg-amber-50/30 opacity-90'
    ]"
  >
    <!-- Top Dossier Strip -->
    <div
      :class="[
        'px-4 py-2.5 flex items-center justify-between gap-2 border-b',
        isActivo
          ? 'bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white border-white/10'
          : 'bg-[#F6F0E4] text-[#6E5835] border-[#E6DAC2]'
      ]"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span
          v-if="client.codigo"
          class="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-lg shrink-0"
          :class="isActivo ? 'bg-[#D5F2F6] text-[#133B5E]' : 'bg-[#EADEC6] text-[#6E5835]'"
          title="Código único de cliente"
        >
          {{ client.codigo }}
        </span>
        <span
          :class="[
            'font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0',
            isActivo
              ? isTallerista
                ? 'bg-[#F6F0E4]/20 text-[#F4E6CE] border-[#F6F0E4]/35'
                : 'bg-[#D5F2F6]/20 text-[#D5F2F6] border-[#BFEBF2]/35'
              : 'bg-white/80 text-[#6E5835] border-[#DFD2B8]'
          ]"
        >
          {{ client.tipo }}
        </span>
      </div>

      <!-- Estado Badge (Activo / Inactivo) -->
      <span
        :class="[
          'font-mono text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0',
          isActivo
            ? 'bg-[#04C4D9]/20 text-[#BFEBF2]'
            : 'bg-[#EADEC6] text-[#6E5835]'
        ]"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="isActivo ? 'bg-[#04C4D9] animate-pulse' : 'bg-[#8B7147]'"></span>
        <span>{{ client.estado }}</span>
      </span>
    </div>

    <!-- Card Body -->
    <div class="p-4 sm:p-5 flex-1">
      <div class="flex items-start gap-3">
        <div
          :class="[
            'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-105',
            isTallerista
              ? 'bg-[#E3F5F8] border-[#C1E8EF] text-[#12697A]'
              : 'bg-[#E8F1FA] border-[#CFE1F4] text-[#1B4978]'
          ]"
        >
          <Wrench v-if="isTallerista" class="w-4 h-4" />
          <User v-else class="w-4 h-4" />
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="font-display text-base font-extrabold text-[#162436] leading-tight group-hover:text-[#1B4978] transition-colors truncate">
            {{ client.nombre }}
          </h4>
          <div v-if="workshopName" class="text-xs font-semibold text-slate-600 flex items-center gap-1 mt-0.5">
            <Wrench class="w-3 h-3 text-[#147488] shrink-0" />
            <span class="truncate">{{ workshopName }}</span>
          </div>
        </div>
      </div>

      <!-- Notas o Especificaciones Técnicas del Taller -->
      <div v-if="technicalNotes" class="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
        <div class="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
          Especialidad / Notas Técnicas
        </div>
        <p class="font-medium text-[#162436] line-clamp-2">
          {{ technicalNotes }}
        </p>
      </div>

      <!-- Dirección Snippet -->
      <div class="mt-3 flex items-start gap-2 text-xs text-slate-600">
        <MapPin class="w-3.5 h-3.5 text-[#147488] mt-0.5 shrink-0" />
        <span class="line-clamp-1">{{ client.direccion || 'Sin dirección registrada' }}</span>
      </div>

      <!-- Facturación Acumulada del Cliente -->
      <div class="mt-3.5 px-3.5 py-2.5 rounded-xl bg-[#EDF5FA] border border-[#CFE2F0] flex items-center justify-between gap-2">
        <div class="min-w-0">
          <span class="font-mono text-[9px] font-bold uppercase tracking-wider text-[#1B4978] block">
            Facturación Acumulada
          </span>
          <span class="font-mono text-[10px] text-slate-600 font-semibold block truncate">
            {{ (ordersCount || 0) === 0 ? 'Sin órdenes aún' : `${ordersCount} ${ordersCount === 1 ? 'orden registrada' : 'órdenes registradas'}` }}
          </span>
        </div>
        <div class="text-right shrink-0">
          <span class="font-display tabular-nums text-base sm:text-lg font-extrabold text-[#038391] block tracking-tight">
            ${{ (totalBilled || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Middle: Touch Action Shortcuts (Táctil de Taller) -->
    <div class="px-4 py-2.5 bg-slate-50/80 border-t border-b border-slate-100 flex items-center gap-2">
      <!-- Direct Call Button -->
      <a
        v-if="client.telefono"
        :href="'tel:' + client.telefono"
        class="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E446E] hover:bg-[#19314D] text-white text-xs font-bold transition-all duration-150 active:scale-[0.97] shadow-sm"
        title="Llamar al cliente"
      >
        <PhoneCall class="w-3.5 h-3.5 text-[#BFEBF2]" />
        <span>Llamar</span>
      </a>
      <div v-else class="flex-1 text-center font-mono text-[11px] text-slate-400 py-1.5">
        Sin teléfono
      </div>

      <!-- Direct Map Button -->
      <a
        v-if="client.direccion"
        :href="mapsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-[#04C4D9] text-[#0D1B3E] hover:text-[#004B97] text-xs font-bold transition-all duration-150 active:scale-[0.97]"
        title="Abrir ubicación en Google Maps"
      >
        <MapPin class="w-3.5 h-3.5 text-[#04C4D9]" />
        <span>Mapa</span>
        <ExternalLink class="w-3 h-3 opacity-60" />
      </a>

      <!-- Direct WhatsApp Button -->
      <a
        v-if="cleanPhoneForWa"
        :href="'https://wa.me/' + cleanPhoneForWa"
        target="_blank"
        rel="noopener noreferrer"
        class="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white transition-all duration-150 active:scale-[0.97] shadow-sm"
        title="Enviar mensaje de WhatsApp"
      >
        <MessageCircle class="w-4 h-4" />
      </a>

      <!-- Edit Button -->
      <button
        type="button"
        @click="$emit('edit', client)"
        class="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-600 hover:text-[#004B97] transition-all duration-150 active:scale-[0.97] cursor-pointer"
        title="Editar información del cliente"
      >
        <Pencil class="w-4 h-4" />
      </button>
    </div>

    <!-- Card Bottom Footer: Borrado Lógico, Órdenes & Fecha -->
    <div class="px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 bg-white">
      <!-- Botón de Borrado Lógico Rápido (Inactivar / Reactivar) -->
      <button
        type="button"
        @click="handleToggleStatus"
        :class="[
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors border cursor-pointer active:scale-[0.97]',
          isActivo
            ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
            : 'text-[#038391] bg-cyan-50 hover:bg-cyan-100 border-cyan-200'
        ]"
        :title="isActivo ? 'Inactivar cliente' : 'Reactivar cliente'"
      >
        <Ban v-if="isActivo" class="w-3 h-3 text-amber-600" />
        <RotateCcw v-else class="w-3 h-3 text-[#038391]" />
        <span>{{ isActivo ? 'Inactivar' : 'Reactivar' }}</span>
      </button>

      <!-- Botón Ver Historial de Órdenes -->
      <button
        type="button"
        @click="$emit('viewOrders', client)"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#004B97] bg-blue-50 hover:bg-[#004B97] hover:text-white border border-blue-200/70 transition-all duration-150 active:scale-[0.97] cursor-pointer"
        title="Consultar historial de órdenes de este cliente"
      >
        <FileText class="w-3.5 h-3.5" />
        <span>Ver Órdenes</span>
      </button>
    </div>
  </div>
</template>
