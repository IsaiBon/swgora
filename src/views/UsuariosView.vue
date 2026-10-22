<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { Search, ShieldCheck, UserPlus, X } from 'lucide-vue-next'
import { crearUsuario, desactivarUsuario, eliminarUsuario, cambiarRolUsuario, type NuevoUsuario } from '@/services/usuariosService'

import { perfilesService, type Perfil } from '@/services/perfilesService'
import { useAuthStore, normalizeRole } from '@/stores/auth'

const modalAbierto = ref(false)
const guardando = ref(false)
const error = ref('')
const mensajeExito = ref('')
const campoNombre = ref<HTMLInputElement | null>(null)
const botonNuevo = ref<HTMLButtonElement | null>(null)
const formulario = ref<HTMLFormElement | null>(null)

const roles = [
  { valor: 'operador', nombre: 'Tallerista' },
  { valor: 'consultor', nombre: 'Consultor' },
  { valor: 'admin', nombre: 'Administrador' },
] as const

const datos = reactive<NuevoUsuario>({
  nombre: '',
  email: '',
  password: '',
  rol: 'operador',
})

async function abrirModal() {
  datos.nombre = ''
  datos.email = ''
  datos.password = ''
  datos.rol = 'operador'
  error.value = ''
  mensajeExito.value = ''
  modalAbierto.value = true

  await nextTick()
  campoNombre.value?.focus()
}

async function cerrarModal() {
  if (guardando.value) return

  modalAbierto.value = false
  datos.password = ''
  error.value = ''

  await nextTick()
  botonNuevo.value?.focus()
}

function manejarTeclado(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    void cerrarModal()
    return
  }

  if (evento.key !== 'Tab') return

  const elementos = formulario.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled)'
  )

  if (!elementos?.length) return

  const primero = elementos[0]!
  const ultimo = elementos[elementos.length - 1]!

  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault()
    primero.focus()
  }
}

async function guardarUsuario() {
  if (guardando.value) return

  error.value = ''

  if (!datos.nombre.trim()) {
    error.value = 'Escribe el nombre del usuario.'
    return
  }

  guardando.value = true

  try {
    await crearUsuario({
      nombre: datos.nombre,
      email: datos.email,
      password: datos.password,
      rol: datos.rol,
    })

    const nombreRol = roles.find(
      (opcion) => opcion.valor === datos.rol
    )?.nombre

    mensajeExito.value =
      `La cuenta de ${datos.nombre.trim()} fue creada con rol ${nombreRol}.`

    guardando.value = false
    await cerrarModal()
    await cargarUsuarios()
  } catch (err: unknown) {
    error.value = err instanceof Error
      ? err.message
      : 'Ocurrió un error al crear el usuario.'
  } finally {
    guardando.value = false
  }
}

const auth = useAuthStore()
const usuarios = ref<Perfil[]>([])
const busqueda = ref('')

function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const usuariosFiltrados = computed(() => {
  const palabras = normalizarBusqueda(busqueda.value).trim().split(/\s+/).filter(Boolean)
  if (!palabras.length) return usuarios.value
  return usuarios.value.filter((usuario) => {
    const texto = normalizarBusqueda(`${usuario.nombre ?? ''} ${usuario.email ?? ''}`)
    return palabras.every((palabra) => texto.includes(palabra))
  })
})

const formatoFecha = new Intl.DateTimeFormat('es-SV', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/El_Salvador',
})

function fechaCreacion(valor?: string | null): string {
  if (!valor) return 'Sin fecha'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? 'Sin fecha' : formatoFecha.format(fecha)
}

function claseRol(rol: string): string {
  switch (normalizeRole(rol)) {
    case 'Administrador': return 'bg-violet-50 text-violet-700 ring-violet-200'
    case 'Operador': return 'bg-cyan-50 text-cyan-700 ring-cyan-200'
    default: return 'bg-amber-50 text-amber-800 ring-amber-200'
  }
}

const cargandoUsuarios = ref(false)
const errorLista = ref('')
const seleccionado = ref<Perfil | null>(null)
const accion = ref<'desactivar' | 'eliminar'>('desactivar')
const desactivando = ref(false)
const errorDesactivar = ref('')
const dialogoDesactivar = ref<HTMLDivElement | null>(null)
const botonCancelar = ref<HTMLButtonElement | null>(null)
let botonOrigen: HTMLElement | null = null

function nombreRol(rol: string): string {
  const normalizado = normalizeRole(rol)
  return normalizado === 'Operador' ? 'Tallerista' : normalizado
}

function puedeEliminar(perfil: Perfil): boolean {
  return normalizeRole(auth.user?.role) === 'Administrador' &&
    perfil.id !== auth.user?.id &&
    ['operador', 'consultor'].includes(perfil.rol.trim().toLowerCase())
}

function puedeDesactivar(perfil: Perfil): boolean {
  return perfil.estado === 'Activo' && puedeEliminar(perfil)
}

function puedeConfirmar(perfil: Perfil): boolean {
  return usuarios.value.some((usuario) => usuario.id === perfil.id) &&
    (accion.value === 'eliminar' ? puedeEliminar(perfil) : puedeDesactivar(perfil))
}

async function cargarUsuarios() {
  if (cargandoUsuarios.value) return
  cargandoUsuarios.value = true
  errorLista.value = ''
  try {
    usuarios.value = await perfilesService.getPerfiles()
  } catch {
    errorLista.value = 'No se pudo actualizar la lista. Pulsa Actualizar para reintentar.'
  } finally {
    cargandoUsuarios.value = false
  }
}

async function pedirDesactivacion(perfil: Perfil, evento: MouseEvent) {
  if (!puedeDesactivar(perfil)) return
  accion.value = 'desactivar'
  botonOrigen = evento.currentTarget as HTMLElement
  seleccionado.value = perfil
  errorDesactivar.value = ''
  mensajeExito.value = ''
  await nextTick()
  botonCancelar.value?.focus()
}

async function pedirEliminacion(perfil: Perfil, evento: MouseEvent) {
  if (!puedeEliminar(perfil) || desactivando.value) return
  accion.value = 'eliminar'
  botonOrigen = evento.currentTarget as HTMLElement
  seleccionado.value = perfil
  errorDesactivar.value = ''
  mensajeExito.value = ''
  await nextTick()
  botonCancelar.value?.focus()
}

async function cerrarConfirmacion() {
  if (desactivando.value) return
  seleccionado.value = null
  errorDesactivar.value = ''
  await nextTick()
  if (botonOrigen?.isConnected && !botonOrigen.hasAttribute('disabled')) {
    botonOrigen.focus()
  } else {
    botonNuevo.value?.focus()
  }
}

function tecladoConfirmacion(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    evento.preventDefault()
    void cerrarConfirmacion()
    return
  }
  if (evento.key !== 'Tab') return
  const botones = dialogoDesactivar.value?.querySelectorAll<HTMLButtonElement>(
    'button:not(:disabled)'
  )
  if (!botones?.length) {
    evento.preventDefault()
    return
  }
  const primero = botones[0]!
  const ultimo = botones[botones.length - 1]!
  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault()
    primero.focus()
  }
}

async function confirmarDesactivacion() {
  const perfil = seleccionado.value
  if (!perfil || desactivando.value || !puedeConfirmar(perfil)) return
  errorDesactivar.value = ''
  dialogoDesactivar.value?.focus()
  desactivando.value = true
  try {
    if (accion.value === 'eliminar') {
      await eliminarUsuario(perfil.id)
      usuarios.value = usuarios.value.filter((usuario) => usuario.id !== perfil.id)
      mensajeExito.value = `La cuenta de ${perfil.nombre} fue eliminada.`
    } else {
      await desactivarUsuario(perfil.id)
      const fila = usuarios.value.find((usuario) => usuario.id === perfil.id)
      if (fila) fila.estado = 'Inactivo'
      mensajeExito.value = `La cuenta de ${perfil.nombre} fue desactivada.`
    }
    desactivando.value = false
    await cerrarConfirmacion()
    await cargarUsuarios()
  } catch (err: unknown) {
    errorDesactivar.value = err instanceof Error
      ? err.message
      : 'No se pudo completar la operación.'
    await cargarUsuarios()
  } finally {
    desactivando.value = false
    if (seleccionado.value) {
      await nextTick()
      botonCancelar.value?.focus()
    }
  }
}

const usuarioRol = ref<Perfil | null>(null)
const rolElegido = ref<NuevoUsuario['rol']>('operador')
const guardandoRol = ref(false)
const errorRol = ref('')
const formularioRol = ref<HTMLFormElement | null>(null)
const selectorRol = ref<HTMLSelectElement | null>(null)
let botonOrigenRol: HTMLElement | null = null

function valorRol(rol: string): NuevoUsuario['rol'] {
  const normalizado = normalizeRole(rol)
  if (normalizado === 'Administrador') return 'admin'
  if (normalizado === 'Consultor') return 'consultor'
  return 'operador'
}

function puedeCambiarRol(perfil: Perfil): boolean {
  return normalizeRole(auth.user?.role) === 'Administrador' &&
    perfil.id !== auth.user?.id
}

async function abrirCambioRol(perfil: Perfil, evento: MouseEvent) {
  if (!puedeCambiarRol(perfil) || guardandoRol.value) return
  botonOrigenRol = evento.currentTarget as HTMLElement
  usuarioRol.value = perfil
  rolElegido.value = valorRol(perfil.rol)
  errorRol.value = ''
  mensajeExito.value = ''
  await nextTick()
  selectorRol.value?.focus()
}

async function cerrarCambioRol() {
  if (guardandoRol.value) return
  usuarioRol.value = null
  errorRol.value = ''
  await nextTick()
  if (botonOrigenRol?.isConnected && !botonOrigenRol.hasAttribute('disabled')) {
    botonOrigenRol.focus()
  } else {
    botonNuevo.value?.focus()
  }
}

function tecladoCambioRol(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    evento.preventDefault()
    void cerrarCambioRol()
    return
  }
  if (evento.key !== 'Tab') return
  const elementos = formularioRol.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), select:not(:disabled)'
  )
  if (!elementos?.length) {
    evento.preventDefault()
    return
  }
  const primero = elementos[0]!
  const ultimo = elementos[elementos.length - 1]!
  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault()
    primero.focus()
  }
}

async function guardarCambioRol() {
  const perfil = usuarioRol.value
  if (!perfil || guardandoRol.value || !puedeCambiarRol(perfil)) return
  const nuevoRol = rolElegido.value
  if (nuevoRol === valorRol(perfil.rol)) return
  if (!roles.some((opcion) => opcion.valor === nuevoRol)) {
    errorRol.value = 'Selecciona un rol válido.'
    return
  }
  errorRol.value = ''
  formularioRol.value?.focus()
  guardandoRol.value = true
  try {
    await cambiarRolUsuario(perfil.id, nuevoRol)
    const fila = usuarios.value.find((usuario) => usuario.id === perfil.id)
    if (fila) fila.rol = nuevoRol
    mensajeExito.value = `El rol de ${perfil.nombre} fue actualizado a ${nombreRol(nuevoRol)}.`
    guardandoRol.value = false
    await cerrarCambioRol()
    await cargarUsuarios()
  } catch (err: unknown) {
    errorRol.value = err instanceof Error
      ? err.message
      : 'No se pudo cambiar el rol.'
    await cargarUsuarios()
  } finally {
    guardandoRol.value = false
    if (usuarioRol.value) {
      await nextTick()
      selectorRol.value?.focus()
    }
  }
}

onMounted(() => {
  void cargarUsuarios()
})

</script>

<template>
  <section class="space-y-6" :inert="modalAbierto || !!seleccionado || !!usuarioRol">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">
          Administración de usuarios
        </h1>

        <p class="mt-1 text-sm text-slate-500">
          Gestiona los usuarios y sus permisos de acceso.
        </p>
      </div>

      <button
        ref="botonNuevo"
        type="button"
        class="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        @click="abrirModal"
      >
        <UserPlus class="h-4 w-4" />
        Nuevo usuario
      </button>
    </div>

    <p
      v-if="mensajeExito"
      role="status"
      class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
    >
      {{ mensajeExito }}
    </p>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="rounded-xl bg-cyan-50 p-3 text-cyan-600">
          <ShieldCheck class="h-6 w-6" />
        </div>

        <div>
          <h2 class="font-semibold text-slate-900">
            Acceso de administrador
          </h2>

          <p class="mt-1 text-sm text-slate-500">
            Crea cuentas para que tu equipo pueda acceder a SWGORA.
          </p>
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
        <h2 class="font-semibold text-slate-900">Usuarios registrados</h2>
        <button
          type="button"
          :disabled="cargandoUsuarios || desactivando"
          class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          @click="cargarUsuarios"
        >
          {{ cargandoUsuarios ? 'Cargando…' : 'Actualizar' }}
        </button>
      </div>

      <div class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5">
        <div class="w-full sm:max-w-sm">
          <label for="buscar-usuarios" class="mb-1 block text-sm font-medium text-slate-700">Buscar usuarios</label>
          <div class="relative">
            <Search aria-hidden="true" class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              id="buscar-usuarios"
              v-model="busqueda"
              type="search"
              autocomplete="off"
              placeholder="Nombre o correo electrónico"
              aria-controls="tabla-usuarios"
              class="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>
        <p v-if="!cargandoUsuarios && !errorLista" role="status" class="text-xs text-slate-500">
          {{ usuariosFiltrados.length }} de {{ usuarios.length }} usuarios cargados
        </p>
      </div>

      <p v-if="errorLista" role="alert" class="m-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
        {{ errorLista }}
      </p>
      <p v-if="cargandoUsuarios && !usuarios.length" role="status" class="p-5 text-sm text-slate-500">
        Cargando usuarios…
      </p>
      <p v-else-if="!usuarios.length && !errorLista" class="p-5 text-sm text-slate-500">
        No hay usuarios para mostrar.
      </p>

      <div v-if="!cargandoUsuarios && usuarios.length && !usuariosFiltrados.length && !errorLista" class="p-5 text-sm text-slate-500">
        <p>No se encontraron usuarios con esa búsqueda.</p>
        <button type="button" class="mt-2 font-medium text-cyan-700 hover:underline" @click="busqueda = ''">Limpiar búsqueda</button>
      </div>

      <div v-if="usuariosFiltrados.length" class="overflow-x-auto" :aria-busy="cargandoUsuarios">
        <table id="tabla-usuarios" class="w-full text-left text-sm">
          <caption class="sr-only">Usuarios, roles y acciones de administración</caption>
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" class="px-5 py-3 font-medium">Usuario</th>
              <th scope="col" class="px-5 py-3 font-medium">Rol</th>
              <th scope="col" class="px-5 py-3 font-medium">Estado</th>
              <th scope="col" class="px-5 py-3 font-medium">Fecha de creación</th>
              <th scope="col" class="px-5 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="usuario in usuariosFiltrados" :key="usuario.id">
              <td class="px-5 py-4">
                <p class="font-medium text-slate-900">{{ usuario.nombre }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ usuario.email }}</p>
              </td>
              <td class="whitespace-nowrap px-5 py-4">
                <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset" :class="claseRol(usuario.rol)">
                  {{ nombreRol(usuario.rol) }}
                </span>
              </td>
              <td class="px-5 py-4">
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="usuario.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'"
                >{{ usuario.estado }}</span>
              </td>
              <td class="whitespace-nowrap px-5 py-4 text-slate-600">{{ fechaCreacion(usuario.created_at) }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-right">
                <button
                  v-if="puedeCambiarRol(usuario)"
                  type="button"
                  :disabled="cargandoUsuarios || guardandoRol || desactivando || !!errorLista"
                  :aria-label="`Cambiar rol de ${usuario.nombre}`"
                  class="mr-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  @click="abrirCambioRol(usuario, $event)"
                >Cambiar rol</button>
                <button
                  v-if="puedeDesactivar(usuario)"
                  type="button"
                  :disabled="cargandoUsuarios || desactivando || !!errorLista"
                  :aria-label="`Desactivar a ${usuario.nombre}`"
                  class="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  @click="pedirDesactivacion(usuario, $event)"
                >Desactivar</button>
                <button
                  v-if="puedeEliminar(usuario)"
                  type="button"
                  :disabled="cargandoUsuarios || desactivando || !!errorLista"
                  :aria-label="`Eliminar a ${usuario.nombre}`"
                  class="ml-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  @click="pedirEliminacion(usuario, $event)"
                >Eliminar</button>
                <span v-if="!puedeEliminar(usuario)" class="text-xs text-slate-400">
                  {{ usuario.id === auth.user?.id ? 'Tu cuenta' : usuario.estado === 'Inactivo' ? 'Desactivado' : 'Cuenta protegida' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="modalAbierto"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
        @click.self="cerrarModal"
        @keydown="manejarTeclado"
      >
        <form
          ref="formulario"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-nuevo-usuario"
          :aria-busy="guardando"
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          @submit.prevent="guardarUsuario"
        >
          <div class="mb-5 flex items-center justify-between gap-3">
            <h2
              id="titulo-nuevo-usuario"
              class="text-lg font-bold text-slate-900"
            >
              Nuevo usuario
            </h2>

            <button
              type="button"
              aria-label="Cerrar formulario"
              :disabled="guardando"
              class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              @click="cerrarModal"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label
                for="usuario-nombre"
                class="mb-1 block text-sm font-medium text-slate-700"
              >
                Nombre
              </label>

              <input
                id="usuario-nombre"
                ref="campoNombre"
                v-model="datos.nombre"
                type="text"
                required
                maxlength="120"
                autocomplete="name"
                :disabled="guardando"
                class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Nombre completo"
              />
            </div>

            <div>
              <label
                for="usuario-email"
                class="mb-1 block text-sm font-medium text-slate-700"
              >
                Correo electrónico
              </label>

              <input
                id="usuario-email"
                v-model="datos.email"
                type="email"
                required
                maxlength="254"
                autocomplete="email"
                :disabled="guardando"
                class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div>
              <label
                for="usuario-password"
                class="mb-1 block text-sm font-medium text-slate-700"
              >
                Contraseña inicial
              </label>

              <input
                id="usuario-password"
                v-model="datos.password"
                type="password"
                required
                minlength="8"
                maxlength="12"
                autocomplete="new-password"
                aria-describedby="ayuda-password"
                :disabled="guardando"
                class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Mínimo 8 caracteres"
              />

              <p id="ayuda-password" class="mt-1 text-xs text-slate-500">
                Debe tener entre 8 y 12 caracteres.
              </p>
            </div>

            <div>
              <label
                for="usuario-rol"
                class="mb-1 block text-sm font-medium text-slate-700"
              >
                Rol del usuario
              </label>

              <select
                id="usuario-rol"
                v-model="datos.rol"
                required
                :disabled="guardando"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option
                  v-for="opcion in roles"
                  :key="opcion.valor"
                  :value="opcion.valor"
                >
                  {{ opcion.nombre }}
                </option>
              </select>

              <p class="mt-1 text-xs text-slate-500">
                Tallerista utiliza los permisos del rol Operador.
              </p>
            </div>

            <p
              v-if="error"
              role="alert"
              class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              {{ error }}
            </p>
          </div>

          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              :disabled="guardando"
              class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              @click="cerrarModal"
            >
              Cancelar
            </button>

            <button
              type="submit"
              :disabled="guardando"
              class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ guardando ? 'Creando…' : 'Crear usuario' }}
            </button>
          </div>
        </form>
      </div>
      <div
        v-if="seleccionado"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
        @click.self="cerrarConfirmacion"
        @keydown="tecladoConfirmacion"
      >
        <div
          ref="dialogoDesactivar"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titulo-desactivar"
          aria-describedby="descripcion-desactivar"
          :aria-busy="desactivando"
          tabindex="-1"
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none"
        >
          <h2 id="titulo-desactivar" class="text-lg font-bold text-slate-900">{{ accion === 'eliminar' ? 'Eliminar usuario definitivamente' : 'Desactivar usuario' }}</h2>
          <div id="descripcion-desactivar" class="mt-3 space-y-2 text-sm text-slate-600">
            <p>¿Quieres {{ accion === 'eliminar' ? 'eliminar' : 'desactivar' }} la cuenta de <strong class="text-slate-900">{{ seleccionado.nombre }}</strong>?</p>
            <p class="break-all">{{ seleccionado.email }}</p>
            <p v-if="accion === 'eliminar'" class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
              Se eliminarán permanentemente la cuenta de acceso y su perfil. Esta acción no se puede deshacer.
            </p>
            <p v-else>Se bloquearán nuevos inicios de sesión. Sus datos se conservarán.</p>
          </div>
          <p v-if="errorDesactivar" role="alert" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {{ errorDesactivar }}
          </p>
          <p v-if="desactivando" role="status" class="mt-4 text-sm text-slate-500">{{ accion === 'eliminar' ? 'Eliminando cuenta…' : 'Desactivando cuenta…' }}</p>
          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <button
              ref="botonCancelar"
              type="button"
              :disabled="desactivando"
              class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              @click="cerrarConfirmacion"
            >Cancelar</button>
            <button
              type="button"
              :disabled="desactivando || !puedeConfirmar(seleccionado)"
              class="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              @click="confirmarDesactivacion"
            >{{ desactivando ? (accion === 'eliminar' ? 'Eliminando…' : 'Desactivando…') : (accion === 'eliminar' ? 'Sí, eliminar definitivamente' : 'Sí, desactivar') }}</button>
          </div>
        </div>
      </div>
      <div
        v-if="usuarioRol"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
        @click.self="cerrarCambioRol"
        @keydown="tecladoCambioRol"
      >
        <form
          ref="formularioRol"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-cambiar-rol"
          aria-describedby="descripcion-cambiar-rol"
          :aria-busy="guardandoRol"
          tabindex="-1"
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none"
          @submit.prevent="guardarCambioRol"
        >
          <h2 id="titulo-cambiar-rol" class="text-lg font-bold text-slate-900">Cambiar rol</h2>
          <div id="descripcion-cambiar-rol" class="mt-3 text-sm text-slate-600">
            <p class="font-medium text-slate-900">{{ usuarioRol.nombre }}</p>
            <p class="mt-1 break-all">{{ usuarioRol.email }}</p>
            <p class="mt-3">Rol actual: <strong>{{ nombreRol(usuarioRol.rol) }}</strong></p>
          </div>
          <label for="nuevo-rol-usuario" class="mb-1 mt-4 block text-sm font-medium text-slate-700">Nuevo rol</label>
          <select
            id="nuevo-rol-usuario"
            ref="selectorRol"
            v-model="rolElegido"
            required
            :disabled="guardandoRol"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          >
            <option v-for="opcion in roles" :key="opcion.valor" :value="opcion.valor">{{ opcion.nombre }}</option>
          </select>
          <p v-if="rolElegido === 'admin'" class="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Administrador permite gestionar usuarios y acceder a todas las secciones del sistema.
          </p>
          <p v-else-if="rolElegido === 'consultor'" class="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Consultor tiene acceso a la sección Catálogo.
          </p>
          <p v-else class="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Tallerista tiene acceso a las secciones Órdenes y Catálogo.
          </p>
          <p v-if="usuarioRol.estado !== 'Activo'" class="mt-3 text-sm text-slate-500">
            Cambiar el rol no reactiva esta cuenta.
          </p>
          <p v-if="errorRol" role="alert" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{{ errorRol }}</p>
          <p v-if="guardandoRol" role="status" class="mt-3 text-sm text-slate-500">Guardando cambio de rol…</p>
          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              :disabled="guardandoRol"
              class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              @click="cerrarCambioRol"
            >Cancelar</button>
            <button
              type="submit"
              :disabled="guardandoRol || !puedeCambiarRol(usuarioRol) || rolElegido === valorRol(usuarioRol.rol)"
              class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >{{ guardandoRol ? 'Guardando…' : 'Confirmar cambio' }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>