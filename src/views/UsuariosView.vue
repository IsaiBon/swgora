<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import {
  Search,
  ShieldCheck,
  UserPlus,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check,
  Mail,
} from 'lucide-vue-next'
import {
  crearUsuario,
  desactivarUsuario,
  eliminarUsuario,
  cambiarRolUsuario,
  obtenerCredencialUsuario,
  registrarCredencialUsuario,
  type NuevoUsuario,
} from '@/services/usuariosService'

import { perfilesService, type Perfil } from '@/services/perfilesService'
import { parseSubAdminRole } from '@/services/rutasService'
import { useAuthStore, normalizeRole } from '@/stores/auth'

const modalAbierto = ref(false)
const guardando = ref(false)
const mostrarPasswordNuevo = ref(false)
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
  mostrarPasswordNuevo.value = false
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
  if (!datos.email.trim()) {
    error.value = 'Escribe el correo electrónico del usuario.'
    return
  }
  if (datos.password.length < 8) {
    error.value = 'La contraseña inicial debe tener al menos 8 caracteres.'
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

    versionCredenciales.value++

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
    case 'Administrador':
      return 'bg-[#0D0D0D] text-[#05F2F2] ring-[#0D0D0D] font-semibold'
    case 'Sub-Administrador':
      return 'bg-[#05F2F2]/25 text-[#0D0D0D] ring-[#04C4D9] font-semibold'
    case 'Operador':
      return 'bg-[#05C7F2]/15 text-[#0D0D0D] ring-[#04C4D9]/50 font-semibold'
    default:
      return 'bg-[#F2F2F2] text-[#0D0D0D]/80 ring-[#0D0D0D]/15 font-semibold'
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
  const subAdmin = parseSubAdminRole(rol)
  if (subAdmin.isSubAdmin) {
    if (subAdmin.rutaCodigo && subAdmin.rutaNombre) {
      return `Sub-Admin (${subAdmin.rutaCodigo} · ${subAdmin.rutaNombre})`
    }
    if (subAdmin.rutaNombre) {
      return `Sub-Admin (${subAdmin.rutaNombre})`
    }
    return 'Sub-Administrador de Ruta'
  }
  const normalizado = normalizeRole(rol)
  return normalizado === 'Operador' ? 'Tallerista' : normalizado
}

function puedeEliminar(perfil: Perfil): boolean {
  const norm = normalizeRole(perfil.rol)
  return (
    normalizeRole(auth.user?.role) === 'Administrador' &&
    perfil.id !== auth.user?.id &&
    norm !== 'Administrador'
  )
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

// ==========================================
// GESTIÓN Y VISUALIZACIÓN DE CREDENCIALES (ADMIN)
// ==========================================
const mostrarTodasCredenciales = ref(false)
const credencialesVisibles = reactive<Record<string, boolean>>({})
const versionCredenciales = ref(0)
const copiadoId = ref<string | null>(null)
const usuarioCredencial = ref<Perfil | null>(null)
const credencialEditable = ref('')
const mostrarPasswordEnModal = ref(true)
const enviandoResetCredencial = ref(false)
const mensajeModalCredencial = ref('')
const dialogoCredenciales = ref<HTMLDivElement | null>(null)
let botonOrigenCredencial: HTMLElement | null = null

const esAdministrador = computed(() => {
  return normalizeRole(auth.user?.role) === 'Administrador'
})

function credencialDeUsuario(usuario: Perfil): string {
  // Depender de versionCredenciales para reactividad inmediata al guardar
  void versionCredenciales.value
  return obtenerCredencialUsuario(usuario)
}

function esCredencialVisible(usuarioId: string): boolean {
  return mostrarTodasCredenciales.value || !!credencialesVisibles[usuarioId]
}

function alternarVisibilidadCredencial(usuarioId: string) {
  credencialesVisibles[usuarioId] = !credencialesVisibles[usuarioId]
}

async function copiarTexto(texto: string, clave: string) {
  try {
    await navigator.clipboard.writeText(texto)
    copiadoId.value = clave
    setTimeout(() => {
      if (copiadoId.value === clave) {
        copiadoId.value = null
      }
    }, 1800)
  } catch {
    // Ignorar si clipboard no está disponible
  }
}

async function copiarFichaAcceso(usuario: Perfil) {
  const pwd = credencialDeUsuario(usuario) || 'No registrada (solicitar restablecimiento)'
  const ficha = `SWGORA - JR Blanco\nNombre: ${usuario.nombre}\nUsuario (Correo): ${usuario.email}\nContraseña: ${pwd}\nRol: ${nombreRol(usuario.rol)}`
  await copiarTexto(ficha, `ficha-${usuario.id}`)
}

async function abrirModalCredenciales(perfil: Perfil, evento?: MouseEvent) {
  if (!esAdministrador.value) return
  if (evento?.currentTarget instanceof HTMLElement) {
    botonOrigenCredencial = evento.currentTarget
  }
  usuarioCredencial.value = perfil
  credencialEditable.value = credencialDeUsuario(perfil) || ''
  mostrarPasswordEnModal.value = true
  mensajeModalCredencial.value = ''
  await nextTick()
  dialogoCredenciales.value?.focus()
}

async function cerrarModalCredenciales() {
  if (enviandoResetCredencial.value) return
  usuarioCredencial.value = null
  mensajeModalCredencial.value = ''
  await nextTick()
  if (botonOrigenCredencial?.isConnected) {
    botonOrigenCredencial.focus()
  }
}

function guardarCredencialVisible() {
  const perfil = usuarioCredencial.value
  if (!perfil) return
  const limpia = credencialEditable.value.trim()
  if (!limpia) {
    mensajeModalCredencial.value = 'Escribe la contraseña que deseas registrar para este usuario.'
    return
  }
  registrarCredencialUsuario({
    id: perfil.id,
    email: perfil.email,
    password: limpia,
  })
  versionCredenciales.value++
  credencialesVisibles[perfil.id] = true
  mensajeModalCredencial.value = 'Contraseña registrada en la bóveda del administrador.'
}

async function enviarResetDesdeAdmin() {
  const perfil = usuarioCredencial.value
  if (!perfil || enviandoResetCredencial.value) return
  enviandoResetCredencial.value = true
  mensajeModalCredencial.value = ''
  try {
    await auth.requestPasswordReset(perfil.email)
    mensajeModalCredencial.value = `Se envió un enlace de restablecimiento a ${perfil.email}.`
  } catch (err: unknown) {
    mensajeModalCredencial.value =
      err instanceof Error
        ? err.message
        : 'No se pudo enviar el enlace de restablecimiento.'
  } finally {
    enviandoResetCredencial.value = false
  }
}

onMounted(() => {
  void cargarUsuarios()
})

</script>

<template>
  <section class="space-y-6" :inert="modalAbierto || !!seleccionado || !!usuarioRol || !!usuarioCredencial">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[#0D0D0D] tracking-tight">
          Administración de usuarios
        </h1>

        <p class="mt-1 text-sm text-[#0D0D0D]/60">
          Gestiona los usuarios, credenciales y permisos de acceso.
        </p>
      </div>

      <button
        ref="botonNuevo"
        type="button"
        class="flex items-center gap-2 rounded-full bg-[#0D0D0D] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-black active:scale-95 cursor-pointer"
        @click="abrirModal"
      >
        <UserPlus class="h-4 w-4 text-[#05F2F2]" />
        Nuevo usuario
      </button>
    </div>

    <p
      v-if="mensajeExito"
      role="status"
      class="rounded-2xl border border-[#04C4D9]/50 bg-[#05C7F2]/10 p-4 text-sm font-medium text-[#0D0D0D]"
    >
      {{ mensajeExito }}
    </p>

    <div class="rounded-2xl border border-[#0D0D0D]/10 bg-white p-6 shadow-sm">
      <div class="flex items-center gap-3.5">
        <div class="rounded-xl bg-[#0D0D0D] p-3 text-[#05F2F2] ring-1 ring-[#05C7F2]/40">
          <ShieldCheck class="h-6 w-6 text-[#05F2F2]" />
        </div>

        <div>
          <h2 class="font-bold text-[#0D0D0D]">
            Acceso de administrador
          </h2>

          <p class="mt-1 text-sm text-[#0D0D0D]/60">
            Crea cuentas, consulta las credenciales registradas y administra los permisos de acceso a SWGORA.
          </p>
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[#0D0D0D]/10 bg-white shadow-sm">
      <div class="h-1.5 w-full bg-gradient-to-r from-[#05C7F2] via-[#04C4D9] to-[#05F2F2]"></div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2F2F2] p-5">
        <h2 class="font-bold text-[#0D0D0D]">Usuarios registrados</h2>
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            v-if="esAdministrador && usuariosFiltrados.length"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition cursor-pointer"
            :class="
              mostrarTodasCredenciales
                ? 'border-[#0D0D0D] bg-[#0D0D0D] text-[#05F2F2]'
                : 'border-[#04C4D9]/50 bg-[#05C7F2]/10 text-[#0D0D0D] hover:bg-[#04C4D9]'
            "
            @click="mostrarTodasCredenciales = !mostrarTodasCredenciales"
          >
            <EyeOff v-if="mostrarTodasCredenciales" class="h-3.5 w-3.5" />
            <Eye v-else class="h-3.5 w-3.5" />
            <span>
              {{
                mostrarTodasCredenciales
                  ? 'Ocultar todas las credenciales'
                  : 'Ver todas las credenciales'
              }}
            </span>
          </button>

          <button
            type="button"
            :disabled="cargandoUsuarios || desactivando"
            class="rounded-full border border-[#0D0D0D]/15 bg-[#F2F2F2] px-4 py-2 text-xs font-bold text-[#0D0D0D] transition hover:border-[#04C4D9] hover:bg-[#05C7F2]/15 disabled:opacity-50 cursor-pointer"
            @click="cargarUsuarios"
          >
            {{ cargandoUsuarios ? 'Cargando…' : 'Actualizar' }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-end justify-between gap-3 border-b border-[#F2F2F2] p-5">
        <div class="w-full sm:max-w-sm">
          <label for="buscar-usuarios" class="mb-1.5 block text-xs font-bold text-[#0D0D0D]">Buscar usuarios</label>
          <div class="relative group">
            <Search aria-hidden="true" class="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#0D0D0D]/40 transition-colors group-focus-within:text-[#04C4D9]" />
            <input
              id="buscar-usuarios"
              v-model="busqueda"
              type="search"
              autocomplete="off"
              placeholder="Nombre o correo electrónico"
              aria-controls="tabla-usuarios"
              class="w-full rounded-full border border-[#0D0D0D]/15 bg-[#F2F2F2] py-2.5 pl-10 pr-4 text-sm text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
            />
          </div>
        </div>
        <p v-if="!cargandoUsuarios && !errorLista" role="status" class="text-xs font-medium text-[#0D0D0D]/60 tabular-nums">
          {{ usuariosFiltrados.length }} de {{ usuarios.length }} usuarios cargados
        </p>
      </div>

      <p v-if="errorLista" role="alert" class="m-5 rounded-xl border border-[#0D0D0D]/20 bg-[#F2F2F2] p-3 text-sm font-medium text-[#0D0D0D]">
        {{ errorLista }}
      </p>
      <p v-if="cargandoUsuarios && !usuarios.length" role="status" class="p-5 text-sm text-[#0D0D0D]/60">
        Cargando usuarios…
      </p>
      <p v-else-if="!usuarios.length && !errorLista" class="p-5 text-sm text-[#0D0D0D]/60">
        No hay usuarios para mostrar.
      </p>

      <div v-if="!cargandoUsuarios && usuarios.length && !usuariosFiltrados.length && !errorLista" class="p-5 text-sm text-[#0D0D0D]/60">
        <p>No se encontraron usuarios con esa búsqueda.</p>
        <button type="button" class="mt-2 font-bold text-[#04C4D9] hover:text-[#05C7F2] hover:underline cursor-pointer" @click="busqueda = ''">Limpiar búsqueda</button>
      </div>

      <div v-if="usuariosFiltrados.length" class="overflow-x-auto" :aria-busy="cargandoUsuarios">
        <table id="tabla-usuarios" class="w-full text-left text-sm">
          <caption class="sr-only">Usuarios, credenciales, roles y acciones de administración</caption>
          <thead class="bg-[#F2F2F2] text-[#0D0D0D] border-b border-[#0D0D0D]/10">
            <tr>
              <th scope="col" class="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">Usuario</th>
              <th v-if="esAdministrador" scope="col" class="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">Credenciales</th>
              <th scope="col" class="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">Rol</th>
              <th scope="col" class="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">Estado</th>
              <th scope="col" class="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">Fecha de creación</th>
              <th scope="col" class="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#F2F2F2]">
            <tr v-for="usuario in usuariosFiltrados" :key="usuario.id" class="transition-colors hover:bg-[#F2F2F2]/50">
              <td class="px-5 py-4">
                <p class="font-bold text-[#0D0D0D]">{{ usuario.nombre }}</p>
                <p class="mt-0.5 text-xs text-[#0D0D0D]/60">{{ usuario.email }}</p>
              </td>

              <!-- Columna de Credenciales (Solo Administrador) -->
              <td v-if="esAdministrador" class="whitespace-nowrap px-5 py-4">
                <div class="inline-flex items-center gap-2 rounded-xl border border-[#0D0D0D]/10 bg-[#F2F2F2]/80 px-3 py-1.5">
                  <KeyRound class="h-3.5 w-3.5 shrink-0 text-[#04C4D9]" />
                  <div class="text-xs">
                    <span
                      v-if="esCredencialVisible(usuario.id)"
                      class="font-mono font-bold text-[#0D0D0D]"
                    >
                      {{ credencialDeUsuario(usuario) || 'Sin registrar' }}
                    </span>
                    <span
                      v-else
                      class="font-mono tracking-widest text-[#0D0D0D]/55"
                    >
                      ••••••••
                    </span>
                  </div>

                  <button
                    type="button"
                    class="rounded-lg p-1 text-[#0D0D0D]/55 transition hover:bg-white hover:text-[#0D0D0D] cursor-pointer"
                    :title="esCredencialVisible(usuario.id) ? 'Ocultar contraseña' : 'Ver contraseña'"
                    :aria-label="esCredencialVisible(usuario.id) ? `Ocultar contraseña de ${usuario.nombre}` : `Ver contraseña de ${usuario.nombre}`"
                    @click="alternarVisibilidadCredencial(usuario.id)"
                  >
                    <EyeOff v-if="esCredencialVisible(usuario.id)" class="h-3.5 w-3.5" />
                    <Eye v-else class="h-3.5 w-3.5" />
                  </button>

                  <button
                    v-if="credencialDeUsuario(usuario)"
                    type="button"
                    class="rounded-lg p-1 text-[#0D0D0D]/55 transition hover:bg-white hover:text-[#04C4D9] cursor-pointer"
                    title="Copiar contraseña"
                    :aria-label="`Copiar contraseña de ${usuario.nombre}`"
                    @click="copiarTexto(credencialDeUsuario(usuario)!, `pwd-${usuario.id}`)"
                  >
                    <Check v-if="copiadoId === `pwd-${usuario.id}`" class="h-3.5 w-3.5 text-[#04C4D9]" />
                    <Copy v-else class="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    class="rounded-lg bg-[#0D0D0D] px-2 py-0.5 text-[11px] font-bold text-[#05F2F2] transition hover:bg-black cursor-pointer"
                    :title="`Ver o gestionar credenciales de ${usuario.nombre}`"
                    @click="abrirModalCredenciales(usuario, $event)"
                  >
                    Ficha
                  </button>
                </div>
              </td>

              <td class="whitespace-nowrap px-5 py-4">
                <span class="inline-flex rounded-full px-3 py-1 text-xs ring-1 ring-inset" :class="claseRol(usuario.rol)">
                  {{ nombreRol(usuario.rol) }}
                </span>
              </td>
              <td class="px-5 py-4">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset"
                  :class="usuario.estado === 'Activo' ? 'bg-[#05F2F2]/20 text-[#0D0D0D] ring-[#04C4D9]/50' : 'bg-[#F2F2F2] text-[#0D0D0D]/55 ring-[#0D0D0D]/15'"
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="usuario.estado === 'Activo' ? 'bg-[#04C4D9]' : 'bg-[#0D0D0D]/40'"
                  ></span>
                  {{ usuario.estado }}
                </span>
              </td>
              <td class="whitespace-nowrap px-5 py-4 text-[#0D0D0D]/70 font-mono text-xs tabular-nums">{{ fechaCreacion(usuario.created_at) }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-right">
                <button
                  v-if="esAdministrador"
                  type="button"
                  :aria-label="`Ver credenciales de ${usuario.nombre}`"
                  class="mr-2 rounded-full border border-[#0D0D0D]/20 bg-[#F2F2F2] px-3.5 py-1.5 text-xs font-bold text-[#0D0D0D] transition hover:border-[#04C4D9] hover:bg-[#05C7F2]/15 cursor-pointer"
                  @click="abrirModalCredenciales(usuario, $event)"
                >
                  Credenciales
                </button>
                <button
                  v-if="puedeCambiarRol(usuario)"
                  type="button"
                  :disabled="cargandoUsuarios || guardandoRol || desactivando || !!errorLista"
                  :aria-label="`Cambiar rol de ${usuario.nombre}`"
                  class="mr-2 rounded-full border border-[#04C4D9]/50 bg-[#05C7F2]/10 px-3.5 py-1.5 text-xs font-bold text-[#0D0D0D] transition hover:bg-[#04C4D9] hover:text-[#0D0D0D] disabled:opacity-50 cursor-pointer"
                  @click="abrirCambioRol(usuario, $event)"
                >Cambiar rol</button>
                <button
                  v-if="puedeDesactivar(usuario)"
                  type="button"
                  :disabled="cargandoUsuarios || desactivando || !!errorLista"
                  :aria-label="`Desactivar a ${usuario.nombre}`"
                  class="rounded-full border border-[#0D0D0D]/20 bg-[#F2F2F2] px-3.5 py-1.5 text-xs font-bold text-[#0D0D0D] transition hover:bg-[#0D0D0D]/10 disabled:opacity-50 cursor-pointer"
                  @click="pedirDesactivacion(usuario, $event)"
                >Desactivar</button>
                <button
                  v-if="puedeEliminar(usuario)"
                  type="button"
                  :disabled="cargandoUsuarios || desactivando || !!errorLista"
                  :aria-label="`Eliminar a ${usuario.nombre}`"
                  class="ml-2 rounded-full bg-[#0D0D0D] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-black disabled:opacity-50 cursor-pointer"
                  @click="pedirEliminacion(usuario, $event)"
                >Eliminar</button>
                <span v-if="!puedeEliminar(usuario)" class="text-xs font-medium text-[#0D0D0D]/45">
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
        class="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D0D]/70 backdrop-blur-xs p-4"
        @click.self="cerrarModal"
        @keydown="manejarTeclado"
      >
        <form
          ref="formulario"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-nuevo-usuario"
          :aria-busy="guardando"
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#0D0D0D]/15 bg-white shadow-2xl overflow-hidden"
          @submit.prevent="guardarUsuario"
        >
          <div class="h-1.5 w-full bg-gradient-to-r from-[#05C7F2] via-[#04C4D9] to-[#05F2F2]"></div>
          <div class="p-6">
            <div class="mb-5 flex items-center justify-between gap-3">
              <h2
                id="titulo-nuevo-usuario"
                class="text-lg font-bold text-[#0D0D0D]"
              >
                Nuevo usuario
              </h2>

              <button
                type="button"
                aria-label="Cerrar formulario"
                :disabled="guardando"
                class="rounded-xl p-2 text-[#0D0D0D]/50 transition hover:bg-[#F2F2F2] hover:text-[#0D0D0D] disabled:opacity-50 cursor-pointer"
                @click="cerrarModal"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label
                  for="usuario-nombre"
                  class="mb-1.5 block text-xs font-bold text-[#0D0D0D]"
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
                  class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                  placeholder="Nombre completo"
                />
              </div>

              <div>
                <label
                  for="usuario-email"
                  class="mb-1.5 block text-xs font-bold text-[#0D0D0D]"
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
                  class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div>
                <label
                  for="usuario-password"
                  class="mb-1.5 block text-xs font-bold text-[#0D0D0D]"
                >
                  Contraseña inicial
                </label>

                <div class="relative">
                  <input
                    id="usuario-password"
                    v-model="datos.password"
                    :type="mostrarPasswordNuevo ? 'text' : 'password'"
                    required
                    minlength="8"
                    maxlength="72"
                    autocomplete="new-password"
                    aria-describedby="ayuda-password"
                    :disabled="guardando"
                    class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] pl-3.5 pr-10 py-2.5 text-sm text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    class="absolute inset-y-0 right-0 flex items-center pr-3 text-[#0D0D0D]/50 hover:text-[#0D0D0D] cursor-pointer"
                    :aria-label="mostrarPasswordNuevo ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    @click="mostrarPasswordNuevo = !mostrarPasswordNuevo"
                  >
                    <EyeOff v-if="mostrarPasswordNuevo" class="h-4 w-4" />
                    <Eye v-else class="h-4 w-4" />
                  </button>
                </div>

                <p id="ayuda-password" class="mt-1 text-xs text-[#0D0D0D]/60">
                  Mínimo 8 caracteres. Quedará visible en el panel de credenciales del administrador.
                </p>
              </div>

              <div>
                <label
                  for="usuario-rol"
                  class="mb-1.5 block text-xs font-bold text-[#0D0D0D]"
                >
                  Rol del usuario
                </label>

                <select
                  id="usuario-rol"
                  v-model="datos.rol"
                  required
                  :disabled="guardando"
                  class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                >
                  <option
                    v-for="opcion in roles"
                    :key="opcion.valor"
                    :value="opcion.valor"
                  >
                    {{ opcion.nombre }}
                  </option>
                </select>

                <p class="mt-1 text-xs text-[#0D0D0D]/60">
                  Tallerista utiliza los permisos del rol Operador.
                </p>
              </div>

              <p
                v-if="error"
                role="alert"
                class="rounded-xl border border-[#0D0D0D]/20 bg-[#F2F2F2] p-3 text-sm font-medium text-[#0D0D0D]"
              >
                {{ error }}
              </p>
            </div>

            <div class="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                :disabled="guardando"
                class="rounded-full border border-[#0D0D0D]/20 bg-[#F2F2F2] px-4 py-2.5 text-sm font-bold text-[#0D0D0D] transition hover:bg-[#0D0D0D]/10 disabled:opacity-50 cursor-pointer"
                @click="cerrarModal"
              >
                Cancelar
              </button>

              <button
                type="submit"
                :disabled="guardando"
                class="rounded-full bg-[#0D0D0D] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {{ guardando ? 'Creando…' : 'Crear usuario' }}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div
        v-if="seleccionado"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D0D]/70 backdrop-blur-xs p-4"
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
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#0D0D0D]/15 bg-white p-6 shadow-2xl outline-none"
        >
          <h2 id="titulo-desactivar" class="text-lg font-bold text-[#0D0D0D]">{{ accion === 'eliminar' ? 'Eliminar usuario definitivamente' : 'Desactivar usuario' }}</h2>
          <div id="descripcion-desactivar" class="mt-3 space-y-2 text-sm text-[#0D0D0D]/75">
            <p>¿Quieres {{ accion === 'eliminar' ? 'eliminar' : 'desactivar' }} la cuenta de <strong class="text-[#0D0D0D]">{{ seleccionado.nombre }}</strong>?</p>
            <p class="break-all">{{ seleccionado.email }}</p>
            <p v-if="accion === 'eliminar'" class="rounded-xl border border-[#0D0D0D]/20 bg-[#F2F2F2] p-3 font-medium text-[#0D0D0D]">
              Se eliminarán permanentemente la cuenta de acceso y su perfil. Esta acción no se puede deshacer.
            </p>
            <p v-else>Se bloquearán nuevos inicios de sesión. Sus datos se conservarán.</p>
          </div>
          <p v-if="errorDesactivar" role="alert" class="mt-4 rounded-xl border border-[#0D0D0D]/20 bg-[#F2F2F2] p-3 text-sm font-medium text-[#0D0D0D]">
            {{ errorDesactivar }}
          </p>
          <p v-if="desactivando" role="status" class="mt-4 text-sm text-[#0D0D0D]/60">{{ accion === 'eliminar' ? 'Eliminando cuenta…' : 'Desactivando cuenta…' }}</p>
          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <button
              ref="botonCancelar"
              type="button"
              :disabled="desactivando"
              class="rounded-full border border-[#0D0D0D]/20 bg-[#F2F2F2] px-4 py-2.5 text-sm font-bold text-[#0D0D0D] transition hover:bg-[#0D0D0D]/10 disabled:opacity-50 cursor-pointer"
              @click="cerrarConfirmacion"
            >Cancelar</button>
            <button
              type="button"
              :disabled="desactivando || !puedeConfirmar(seleccionado)"
              class="rounded-full bg-[#0D0D0D] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:opacity-50 cursor-pointer"
              @click="confirmarDesactivacion"
            >{{ desactivando ? (accion === 'eliminar' ? 'Eliminando…' : 'Desactivando…') : (accion === 'eliminar' ? 'Sí, eliminar definitivamente' : 'Sí, desactivar') }}</button>
          </div>
        </div>
      </div>
      <div
        v-if="usuarioRol"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D0D]/70 backdrop-blur-xs p-4"
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
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#0D0D0D]/15 bg-white shadow-2xl outline-none overflow-hidden"
          @submit.prevent="guardarCambioRol"
        >
          <div class="h-1.5 w-full bg-gradient-to-r from-[#05C7F2] via-[#04C4D9] to-[#05F2F2]"></div>
          <div class="p-6">
            <h2 id="titulo-cambiar-rol" class="text-lg font-bold text-[#0D0D0D]">Cambiar rol</h2>
            <div id="descripcion-cambiar-rol" class="mt-3 text-sm text-[#0D0D0D]/75">
              <p class="font-bold text-[#0D0D0D]">{{ usuarioRol.nombre }}</p>
              <p class="mt-0.5 break-all text-xs text-[#0D0D0D]/60">{{ usuarioRol.email }}</p>
              <p class="mt-3">Rol actual: <strong class="text-[#04C4D9]">{{ nombreRol(usuarioRol.rol) }}</strong></p>
            </div>
            <label for="nuevo-rol-usuario" class="mb-1.5 mt-4 block text-xs font-bold text-[#0D0D0D]">Nuevo rol</label>
            <select
              id="nuevo-rol-usuario"
              ref="selectorRol"
              v-model="rolElegido"
              required
              :disabled="guardandoRol"
              class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
            >
              <option v-for="opcion in roles" :key="opcion.valor" :value="opcion.valor">{{ opcion.nombre }}</option>
            </select>
            <p v-if="rolElegido === 'admin'" class="mt-3 rounded-xl border border-[#04C4D9]/40 bg-[#05C7F2]/10 p-3 text-sm font-medium text-[#0D0D0D]">
              Administrador permite gestionar usuarios y acceder a todas las secciones del sistema.
            </p>
            <p v-else-if="rolElegido === 'consultor'" class="mt-3 rounded-xl border border-[#0D0D0D]/10 bg-[#F2F2F2] p-3 text-sm text-[#0D0D0D]/75">
              Consultor tiene acceso a la sección Catálogo.
            </p>
            <p v-else class="mt-3 rounded-xl border border-[#04C4D9]/35 bg-[#05F2F2]/15 p-3 text-sm text-[#0D0D0D]">
              Tallerista tiene acceso a las secciones Órdenes y Catálogo.
            </p>
            <p v-if="usuarioRol.estado !== 'Activo'" class="mt-3 text-sm text-[#0D0D0D]/60">
              Cambiar el rol no reactiva esta cuenta.
            </p>
            <p v-if="errorRol" role="alert" class="mt-4 rounded-xl border border-[#0D0D0D]/20 bg-[#F2F2F2] p-3 text-sm font-medium text-[#0D0D0D]">{{ errorRol }}</p>
            <p v-if="guardandoRol" role="status" class="mt-3 text-sm text-[#0D0D0D]/60">Guardando cambio de rol…</p>
            <div class="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                :disabled="guardandoRol"
                class="rounded-full border border-[#0D0D0D]/20 bg-[#F2F2F2] px-4 py-2.5 text-sm font-bold text-[#0D0D0D] transition hover:bg-[#0D0D0D]/10 disabled:opacity-50 cursor-pointer"
                @click="cerrarCambioRol"
              >Cancelar</button>
              <button
                type="submit"
                :disabled="guardandoRol || !puedeCambiarRol(usuarioRol) || rolElegido === valorRol(usuarioRol.rol)"
                class="rounded-full bg-[#0D0D0D] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >{{ guardandoRol ? 'Guardando…' : 'Confirmar cambio' }}</button>
            </div>
          </div>
        </form>
      </div>

      <!-- Modal de Credenciales del Usuario (Solo Administrador) -->
      <div
        v-if="usuarioCredencial"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D0D]/70 backdrop-blur-xs p-4"
        @click.self="cerrarModalCredenciales"
        @keydown.esc="cerrarModalCredenciales"
      >
        <div
          ref="dialogoCredenciales"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-credenciales-usuario"
          tabindex="-1"
          class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#0D0D0D]/15 bg-white shadow-2xl outline-none overflow-hidden"
        >
          <div class="h-1.5 w-full bg-gradient-to-r from-[#05C7F2] via-[#04C4D9] to-[#05F2F2]"></div>
          <div class="p-6 space-y-5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D0D0D] text-[#05F2F2] ring-1 ring-[#05C7F2]/40">
                  <KeyRound class="h-5 w-5" />
                </div>
                <div>
                  <h2 id="titulo-credenciales-usuario" class="text-lg font-bold text-[#0D0D0D]">
                    Credenciales de acceso
                  </h2>
                  <p class="text-xs text-[#0D0D0D]/60">
                    {{ usuarioCredencial.nombre }} • {{ nombreRol(usuarioCredencial.rol) }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Cerrar credenciales"
                class="rounded-xl p-2 text-[#0D0D0D]/50 transition hover:bg-[#F2F2F2] hover:text-[#0D0D0D] cursor-pointer"
                @click="cerrarModalCredenciales"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            <!-- Tarjeta de Credenciales Actuales -->
            <div class="space-y-3 rounded-2xl border border-[#0D0D0D]/10 bg-[#F2F2F2]/70 p-4">
              <div>
                <span class="block text-[11px] font-bold uppercase tracking-wider text-[#0D0D0D]/55">
                  Usuario (Correo electrónico)
                </span>
                <div class="mt-1 flex items-center justify-between gap-2 rounded-xl border border-[#0D0D0D]/10 bg-white px-3 py-2">
                  <span class="break-all font-mono text-xs font-bold text-[#0D0D0D]">
                    {{ usuarioCredencial.email }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#F2F2F2] px-2.5 py-1 text-[11px] font-bold text-[#0D0D0D] transition hover:bg-[#05C7F2]/20 cursor-pointer"
                    @click="copiarTexto(usuarioCredencial.email, `modal-email-${usuarioCredencial.id}`)"
                  >
                    <Check v-if="copiadoId === `modal-email-${usuarioCredencial.id}`" class="h-3.5 w-3.5 text-[#04C4D9]" />
                    <Copy v-else class="h-3.5 w-3.5" />
                    <span>{{ copiadoId === `modal-email-${usuarioCredencial.id}` ? 'Copiado' : 'Copiar' }}</span>
                  </button>
                </div>
              </div>

              <div>
                <span class="block text-[11px] font-bold uppercase tracking-wider text-[#0D0D0D]/55">
                  Contraseña registrada
                </span>
                <div class="mt-1 flex items-center justify-between gap-2 rounded-xl border border-[#0D0D0D]/10 bg-white px-3 py-2">
                  <span class="font-mono text-xs font-bold text-[#0D0D0D]">
                    {{
                      mostrarPasswordEnModal
                        ? credencialDeUsuario(usuarioCredencial) || 'Sin registrar en bóveda'
                        : '••••••••••••'
                    }}
                  </span>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-[#0D0D0D]/60 transition hover:bg-[#F2F2F2] hover:text-[#0D0D0D] cursor-pointer"
                      :title="mostrarPasswordEnModal ? 'Ocultar' : 'Mostrar'"
                      @click="mostrarPasswordEnModal = !mostrarPasswordEnModal"
                    >
                      <EyeOff v-if="mostrarPasswordEnModal" class="h-3.5 w-3.5" />
                      <Eye v-else class="h-3.5 w-3.5" />
                    </button>
                    <button
                      v-if="credencialDeUsuario(usuarioCredencial)"
                      type="button"
                      class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#F2F2F2] px-2.5 py-1 text-[11px] font-bold text-[#0D0D0D] transition hover:bg-[#05C7F2]/20 cursor-pointer"
                      @click="copiarTexto(credencialDeUsuario(usuarioCredencial)!, `modal-pwd-${usuarioCredencial.id}`)"
                    >
                      <Check v-if="copiadoId === `modal-pwd-${usuarioCredencial.id}`" class="h-3.5 w-3.5 text-[#04C4D9]" />
                      <Copy v-else class="h-3.5 w-3.5" />
                      <span>{{ copiadoId === `modal-pwd-${usuarioCredencial.id}` ? 'Copiada' : 'Copiar' }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0D0D0D] py-2.5 px-4 text-xs font-bold text-[#05F2F2] transition hover:bg-black cursor-pointer"
                @click="copiarFichaAcceso(usuarioCredencial)"
              >
                <Check v-if="copiadoId === `ficha-${usuarioCredencial.id}`" class="h-4 w-4 text-[#05F2F2]" />
                <Copy v-else class="h-4 w-4 text-[#05F2F2]" />
                <span>
                  {{
                    copiadoId === `ficha-${usuarioCredencial.id}`
                      ? '¡Ficha de acceso copiada al portapapeles!'
                      : 'Copiar ficha completa (Usuario + Contraseña)'
                  }}
                </span>
              </button>
            </div>

            <!-- Registrar / Actualizar contraseña en la bóveda del administrador -->
            <form class="space-y-2.5" @submit.prevent="guardarCredencialVisible">
              <label for="input-credencial-visible" class="block text-xs font-bold text-[#0D0D0D]">
                Registrar o actualizar contraseña visible en bóveda
              </label>
              <p class="text-[11px] text-[#0D0D0D]/60">
                Las cuentas creadas desde este panel o que inicien sesión se registran automáticamente. También puedes anotarla o actualizarla manualmente aquí:
              </p>
              <div class="flex gap-2">
                <input
                  id="input-credencial-visible"
                  v-model="credencialEditable"
                  type="text"
                  placeholder="Escribe la contraseña del usuario"
                  class="flex-1 rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2 text-xs font-mono text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                />
                <button
                  type="submit"
                  class="rounded-xl border border-[#04C4D9]/50 bg-[#05C7F2]/15 px-3.5 py-2 text-xs font-bold text-[#0D0D0D] transition hover:bg-[#04C4D9] cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>

            <!-- Enviar enlace de restablecimiento por correo -->
            <div class="border-t border-[#F2F2F2] pt-3">
              <button
                type="button"
                :disabled="enviandoResetCredencial"
                class="w-full flex items-center justify-center gap-2 rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] py-2.5 px-4 text-xs font-bold text-[#0D0D0D] transition hover:border-[#04C4D9] hover:bg-[#05C7F2]/15 disabled:opacity-50 cursor-pointer"
                @click="enviarResetDesdeAdmin"
              >
                <Mail class="h-3.5 w-3.5 text-[#04C4D9]" />
                <span>
                  {{
                    enviandoResetCredencial
                      ? 'Enviando correo de restablecimiento…'
                      : 'Enviar correo para restablecer contraseña'
                  }}
                </span>
              </button>
            </div>

            <p
              v-if="mensajeModalCredencial"
              role="status"
              class="rounded-xl border border-[#04C4D9]/45 bg-[#05C7F2]/10 p-3 text-xs font-medium text-[#0D0D0D]"
            >
              {{ mensajeModalCredencial }}
            </p>

            <div class="flex justify-end pt-1">
              <button
                type="button"
                class="rounded-full bg-[#0D0D0D] px-5 py-2 text-xs font-bold text-white transition hover:bg-black cursor-pointer"
                @click="cerrarModalCredenciales"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>