<script setup lang="ts">
import { ref, watch } from 'vue'
import { type Cliente, type ClientType, type ClientStatus } from '@/services/clientesService'
import {
  X,
  User,
  Phone,
  MapPin,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Ban,
  RotateCcw,
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  clientToEdit?: Cliente | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', client: Partial<Cliente>): void
  (e: 'toggleStatus', id: string, newStatus: ClientStatus): void
}>()

const clientTypes: ClientType[] = ['Cliente', 'Tallerista']
const statusList: ClientStatus[] = ['Activo', 'Inactivo']

// Form fields
const nombre = ref('')
const telefono = ref('')
const direccion = ref('')
const tipo = ref<ClientType>('Cliente')
const estado = ref<ClientStatus>('Activo')
const notas = ref('')

// Validation states
const errors = ref({
  nombre: '',
  telefono: '',
})
const isSubmitting = ref(false)

// Reset or populate fields
watch(
  () => props.clientToEdit,
  (edit) => {
    errors.value = { nombre: '', telefono: '' }
    if (edit) {
      nombre.value = edit.nombre || ''
      telefono.value = edit.telefono || ''
      direccion.value = edit.direccion || ''
      tipo.value = edit.tipo || 'Cliente'
      estado.value = edit.estado || 'Activo'
      notas.value = edit.especificaciones_tecnicas?.notas || edit.especificaciones_tecnicas?.servicios || ''
    } else {
      nombre.value = ''
      telefono.value = ''
      direccion.value = ''
      tipo.value = 'Cliente'
      estado.value = 'Activo'
      notas.value = ''
    }
  },
  { immediate: true }
)

// Reglas de validación de entrada
const validateForm = async (): Promise<boolean> => {
  errors.value = { nombre: '', telefono: '' }
  let isValid = true

  // 1. Nombre mínimo 3 caracteres
  const cleanNombre = nombre.value.trim()
  if (!cleanNombre || cleanNombre.length < 3) {
    errors.value.nombre = 'El nombre es obligatorio y debe tener al menos 3 caracteres.'
    isValid = false
  }

  // 2. Teléfono con formato válido (mínimo 8 dígitos)
  const cleanPhone = telefono.value.trim()
  const digitsOnly = cleanPhone.replace(/\D/g, '')
  if (!cleanPhone || digitsOnly.length < 8) {
    errors.value.telefono = 'Ingresa un número telefónico válido (mínimo 8 dígitos).'
    isValid = false
  }

  return isValid
}

const handleSubmit = async () => {
  isSubmitting.value = true
  try {
    const isValid = await validateForm()
    if (!isValid) return

    emit('save', {
      id: props.clientToEdit ? props.clientToEdit.id : undefined,
      nombre: nombre.value.trim(),
      telefono: telefono.value.trim(),
      direccion: direccion.value.trim() || 'Dirección de taller pendiente',
      tipo: tipo.value,
      estado: estado.value,
      especificaciones_tecnicas: {
        ...(props.clientToEdit?.especificaciones_tecnicas || {}),
        notas: notas.value.trim() || undefined,
      },
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleToggleStatus = () => {
  if (!props.clientToEdit) return
  const newStatus: ClientStatus = props.clientToEdit.estado === 'Activo' ? 'Inactivo' : 'Activo'
  const actionText = newStatus === 'Inactivo' ? 'inactivar (borrado lógico)' : 'reactivar'
  if (confirm(`¿Estás seguro de que deseas ${actionText} a ${props.clientToEdit.nombre}?`)) {
    emit('toggleStatus', props.clientToEdit.id, newStatus)
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
    @click.self="$emit('close')"
  >
    <div
      class="bg-white w-full max-w-2xl rounded-[2rem] sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 sm:py-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-[#05C7F2]/15 text-[#04C4D9] flex items-center justify-center shadow-inner">
            <User v-if="!clientToEdit" class="w-6 h-6" />
            <Wrench v-else class="w-6 h-6 text-slate-800" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900 leading-tight">
              {{ clientToEdit ? 'Editar Información del Cliente' : 'Nuevo Cliente / Tallerista' }}
            </h3>
            <p class="text-xs text-slate-500">
              Persistencia Supabase • Borrado lógico e historial de órdenes
            </p>
          </div>
        </div>

        <!-- Big Touch Close Button -->
        <button
          type="button"
          @click="$emit('close')"
          class="min-w-[44px] min-h-[44px] rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 flex items-center justify-center transition active:scale-95"
          aria-label="Cerrar modal"
        >
          <X class="w-6 h-6" />
        </button>
      </div>

      <!-- Modal Body (Formulario Táctil con Validaciones) -->
      <form @submit.prevent="handleSubmit" class="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1">
        <!-- Selector de Tipo de Cliente (Chips Táctiles Grandes) -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Tipo de Registro *
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="t in clientTypes"
              :key="t"
              type="button"
              @click="tipo = t"
              :class="[
                'min-h-[48px] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 border active:scale-95',
                tipo === t
                  ? 'bg-[#0D0D0D] text-white border-[#0D0D0D] shadow-md shadow-slate-300'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
              ]"
            >
              <User v-if="t === 'Cliente'" class="w-4 h-4 text-[#05F2F2]" />
              <Wrench v-else class="w-4 h-4 text-amber-400" />
              <span>{{ t }}</span>
            </button>
          </div>
        </div>

        <!-- Nombre Completo o Razón Social -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 pl-1">
            Nombre Completo o Razón Social *
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <User class="w-5 h-5" />
            </div>
            <input
              v-model="nombre"
              type="text"
              required
              placeholder="Ej. Ing. Carlos Mendoza o Taller Mecánico Especializado"
              :class="[
                'w-full min-h-[48px] pl-11 pr-4 bg-slate-50 border rounded-2xl text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:ring-2',
                errors.nombre
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-[#05C7F2] focus:ring-[#05C7F2]/30'
              ]"
            />
          </div>
          <p v-if="errors.nombre" class="mt-1 pl-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            <span>{{ errors.nombre }}</span>
          </p>
        </div>

        <!-- Teléfono y Dirección -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Teléfono -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 pl-1">
              Teléfono Directo (Llamadas / WhatsApp) *
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Phone class="w-5 h-5" />
              </div>
              <input
                v-model="telefono"
                type="tel"
                required
                placeholder="+52 81 1234 5678"
                :class="[
                  'w-full min-h-[48px] pl-11 pr-4 bg-slate-50 border rounded-2xl text-sm font-mono text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:ring-2',
                  errors.telefono
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-200 focus:border-[#05C7F2] focus:ring-[#05C7F2]/30'
                ]"
              />
            </div>
            <p v-if="errors.telefono" class="mt-1 pl-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
              <AlertCircle class="w-3.5 h-3.5" />
              <span>{{ errors.telefono }}</span>
            </p>
          </div>

          <!-- Dirección -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 pl-1">
              Dirección de Taller / Empresa
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <MapPin class="w-5 h-5" />
              </div>
              <input
                v-model="direccion"
                type="text"
                placeholder="Av. Industrial 1420, Nave 5"
                class="w-full min-h-[48px] pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/30"
              />
            </div>
          </div>
        </div>

        <!-- Estado (Borrado Lógico) -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Estado del Cliente (Borrado Lógico)
          </label>
          <div class="flex gap-3">
            <button
              v-for="s in statusList"
              :key="s"
              type="button"
              @click="estado = s"
              :class="[
                'flex-1 min-h-[44px] py-2 px-3 rounded-2xl text-xs font-bold transition border active:scale-95 flex items-center justify-center gap-1.5',
                estado === s
                  ? s === 'Activo'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
              ]"
            >
              <CheckCircle2 v-if="s === 'Activo'" class="w-4 h-4" />
              <Ban v-else class="w-4 h-4" />
              <span>{{ s }}</span>
            </button>
          </div>
        </div>

        <!-- Notas o Especificaciones Técnicas de Rectificación -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 pl-1">
            Notas Técnicas / Equipos y Motores Habituales
          </label>
          <textarea
            v-model="notas"
            rows="2"
            placeholder="Ej. Motores diesel Cummins, tractocamiones, rectificación de culatas frecuente..."
            class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/30"
          ></textarea>
        </div>

        <!-- Modal Actions (Botones Táctiles para Taller) -->
        <div class="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <!-- Acción de Borrado Lógico (Inactivar/Reactivar) -->
          <div v-if="clientToEdit">
            <button
              type="button"
              @click="handleToggleStatus"
              :class="[
                'w-full sm:w-auto min-h-[48px] px-4 py-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border',
                clientToEdit.estado === 'Activo'
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300',
              ]"
            >
              <Ban v-if="clientToEdit.estado === 'Activo'" class="w-4 h-4 text-amber-600" />
              <RotateCcw v-else class="w-4 h-4 text-emerald-600" />
              <span>{{ clientToEdit.estado === 'Activo' ? 'Inactivar (Borrado Lógico)' : 'Reactivar Cliente' }}</span>
            </button>
          </div>
          <div v-else></div>

          <div class="w-full sm:w-auto flex items-center gap-3">
            <button
              type="button"
              @click="$emit('close')"
              class="flex-1 sm:flex-initial min-h-[48px] px-6 py-3 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold transition active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="flex-1 sm:flex-initial min-h-[48px] px-8 py-3 rounded-full bg-[#0D0D0D] hover:bg-black text-white text-xs sm:text-sm font-bold shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 class="w-4 h-4 text-[#05F2F2]" />
              <span>{{ isSubmitting ? 'Guardando...' : clientToEdit ? 'Guardar Cambios' : 'Registrar' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
