<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { clientesService, type Cliente, type ClientType, type ClientStatus } from '@/services/clientesService'
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
const taller = ref('')
const telefono = ref('')
const direccion = ref('')
const tipo = ref<ClientType>('Cliente')
const estado = ref<ClientStatus>('Activo')
const notas = ref('')

const previewCode = computed(() => {
  if (props.clientToEdit?.codigo) return props.clientToEdit.codigo
  return clientesService.getNextClientCode(tipo.value)
})

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
      taller.value = edit.especificaciones_tecnicas?.taller || edit.especificaciones_tecnicas?.empresa || ''
      telefono.value = edit.telefono || ''
      direccion.value = edit.direccion || ''
      tipo.value = edit.tipo || 'Cliente'
      estado.value = edit.estado || 'Activo'
      notas.value = edit.especificaciones_tecnicas?.notas || edit.especificaciones_tecnicas?.servicios || ''
    } else {
      nombre.value = ''
      taller.value = ''
      telefono.value = ''
      direccion.value = ''
      tipo.value = 'Cliente'
      estado.value = 'Activo' // Siempre Activo al crear
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
      codigo: props.clientToEdit ? props.clientToEdit.codigo : undefined,
      nombre: nombre.value.trim(),
      telefono: telefono.value.trim(),
      direccion: direccion.value.trim() || undefined,
      tipo: tipo.value,
      estado: props.clientToEdit ? estado.value : 'Activo',
      especificaciones_tecnicas: {
        ...(props.clientToEdit?.especificaciones_tecnicas || {}),
        taller: taller.value.trim() || undefined,
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
  const actionText = newStatus === 'Inactivo' ? 'inactivar' : 'reactivar'
  if (confirm(`¿Estás seguro de que deseas ${actionText} a ${props.clientToEdit.nombre}?`)) {
    emit('toggleStatus', props.clientToEdit.id, newStatus)
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#09132B]/65 backdrop-blur-sm overflow-y-auto"
    @click.self="$emit('close')"
  >
    <div
      class="studio-card bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col popover-pop-in"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 sm:py-5 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 text-[#BFEBF2] flex items-center justify-center shadow-inner">
            <User v-if="!clientToEdit" class="w-6 h-6" />
            <Wrench v-else class="w-6 h-6 text-[#BFEBF2]" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold font-display text-white leading-tight">
                {{ clientToEdit ? 'Editar Información del Cliente' : 'Nuevo Cliente / Tallerista' }}
              </h3>
              <span
                v-if="clientToEdit?.codigo"
                class="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-white/15 text-[#BFEBF2] border border-white/25"
              >
                {{ clientToEdit.codigo }}
              </span>
            </div>
            <p class="text-xs text-sky-100/80 mt-0.5">
              {{ clientToEdit ? 'Edición de datos y estado operativo' : 'Código generado automáticamente • Estado Activo' }}
            </p>
          </div>
        </div>

        <!-- Big Touch Close Button -->
        <button
          type="button"
          @click="$emit('close')"
          class="min-w-[44px] min-h-[44px] rounded-xl text-white/75 hover:text-white hover:bg-white/15 flex items-center justify-center transition active:scale-95 cursor-pointer"
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
                'min-h-[48px] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 border active:scale-95 cursor-pointer',
                tipo === t
                  ? 'bg-[#1E446E] text-white border-[#1E446E] shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
              ]"
            >
              <User v-if="t === 'Cliente'" :class="['w-4 h-4', tipo === t ? 'text-[#BFEBF2]' : 'text-[#1B4978]']" />
              <Wrench v-else :class="['w-4 h-4', tipo === t ? 'text-[#F6EBD8]' : 'text-[#6E5835]']" />
              <span>{{ t }}</span>
            </button>
          </div>
        </div>

        <!-- Código Único del Cliente (Automático) -->
        <div class="p-3.5 bg-[#F4F8FC] border border-[#CFE1F4] rounded-2xl flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-[#0D1B3E]">Código Único:</span>
            <span class="font-mono font-bold text-[#004B97] bg-white px-2.5 py-1 rounded-lg border border-[#004B97]/20 shadow-xs">
              {{ previewCode }}
            </span>
          </div>
          <span class="text-[11px] text-slate-600 font-medium">
            {{ clientToEdit ? 'Identificador en sistema' : 'Asignado automáticamente según el tipo' }}
          </span>
        </div>

        <!-- Nombre Completo o Razón Social -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 pl-1">
            Nombre Completo o Titular *
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <User class="w-5 h-5" />
            </div>
            <input
              v-model="nombre"
              type="text"
              required
              placeholder="Ej. Roberto Sánchez o Carlos Mendoza"
              :class="[
                'w-full min-h-[48px] pl-11 pr-4 bg-slate-50 border rounded-2xl text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:ring-2',
                errors.nombre
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-[#04C4D9] focus:ring-[#04C4D9]/30'
              ]"
            />
          </div>
          <p v-if="errors.nombre" class="mt-1 pl-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
            <AlertCircle class="w-3.5 h-3.5" />
            <span>{{ errors.nombre }}</span>
          </p>
        </div>

        <!-- Taller o Empresa -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 pl-1">
            Nombre del Taller o Empresa {{ tipo === 'Tallerista' ? '*' : '(Opcional)' }}
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Wrench class="w-5 h-5" />
            </div>
            <input
              v-model="taller"
              type="text"
              :placeholder="tipo === 'Tallerista' ? 'Ej. Taller Mecánico Especializado Ramos' : 'Ej. Transportes del Norte (si aplica)'"
              class="w-full min-h-[48px] pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/30"
            />
          </div>
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
                placeholder="Ej. 81 1234 5678"
                :class="[
                  'w-full min-h-[48px] pl-11 pr-4 bg-slate-50 border rounded-2xl text-sm font-mono text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:ring-2',
                  errors.telefono
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-200 focus:border-[#04C4D9] focus:ring-[#04C4D9]/30'
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
                placeholder="Ej. Av. Hidalgo 123, Col. Centro"
                class="w-full min-h-[48px] pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/30"
              />
            </div>
          </div>
        </div>

        <!-- Estado del Cliente - Solo al editar -->
        <div v-if="clientToEdit">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Estado del Cliente
          </label>
          <div class="flex gap-3">
            <button
              v-for="s in statusList"
              :key="s"
              type="button"
              @click="estado = s"
              :class="[
                'flex-1 min-h-[44px] py-2 px-3 rounded-2xl text-xs font-bold transition border active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer',
                estado === s
                  ? s === 'Activo'
                    ? 'bg-[#038391] text-white border-[#038391] shadow-sm'
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

        <!-- Notas Técnicas / Equipos Habituales -->
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 pl-1">
            Notas Técnicas / Equipos y Motores Habituales
          </label>
          <textarea
            v-model="notas"
            rows="2"
            placeholder="Ej. Motores diésel Cummins, rectificación de culatas, especificaciones de apriete..."
            class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:bg-white focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/30"
          ></textarea>
        </div>

        <!-- Modal Actions (Botones Táctiles para Taller) -->
        <div class="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div v-if="clientToEdit">
            <button
              type="button"
              @click="handleToggleStatus"
              :class="[
                'w-full sm:w-auto min-h-[48px] px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border cursor-pointer',
                clientToEdit.estado === 'Activo'
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300'
                  : 'text-[#038391] bg-cyan-50 hover:bg-cyan-100 border-cyan-300',
              ]"
            >
              <Ban v-if="clientToEdit.estado === 'Activo'" class="w-4 h-4 text-amber-600" />
              <RotateCcw v-else class="w-4 h-4 text-[#038391]" />
              <span>{{ clientToEdit.estado === 'Activo' ? 'Inactivar Cliente' : 'Reactivar Cliente' }}</span>
            </button>
          </div>
          <div v-else></div>

          <div class="w-full sm:w-auto flex items-center gap-3">
            <button
              type="button"
              @click="$emit('close')"
              class="flex-1 sm:flex-initial min-h-[48px] px-6 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold transition active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="flex-1 sm:flex-initial min-h-[48px] px-8 py-3 rounded-xl studio-cta-primary text-white text-xs sm:text-sm font-bold shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <CheckCircle2 class="w-4 h-4 text-white" />
              <span>{{ isSubmitting ? 'Guardando...' : clientToEdit ? 'Guardar Cambios' : 'Registrar' }}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
