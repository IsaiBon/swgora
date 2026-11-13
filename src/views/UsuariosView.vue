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
  Smartphone,
  MonitorSmartphone,
  Unlock,
  Wrench,
  Building2,
  Sparkles,
  Pencil,
} from 'lucide-vue-next'
import {
  crearUsuario,
  desactivarUsuario,
  eliminarUsuario,
  cambiarRolUsuario,
  obtenerCredencialUsuario,
  cambiarPasswordUsuario,
  type NuevoUsuario,
} from '@/services/usuariosService'

import { perfilesService, type Perfil } from '@/services/perfilesService'
import {
  encodeSubAdminRole,
  parseSubAdminRole,
  encodeIndependentRole,
  parseIndependentRole,
  encodeTenantMemberRole,
  getUserTenantMembership,
  registerIndependentTenantUser,
  rutasService,
  type RutaSucursal,
} from '@/services/rutasService'
import { tallerService } from '@/services/tallerService'
import { useAuthStore, normalizeRole } from '@/stores/auth'

const auth = useAuthStore()
const esTallerIndependiente = computed(() => Boolean(auth.user?.isIndependent))

const modalAbierto = ref(false)
const guardando = ref(false)
const mostrarPasswordNuevo = ref(false)
const error = ref('')
const mensajeExito = ref('')
const campoNombre = ref<HTMLInputElement | null>(null)
const botonNuevo = ref<HTMLButtonElement | null>(null)
const formulario = ref<HTMLFormElement | null>(null)

const rolesBase = [
  { valor: 'operador', nombre: 'Tallerista' },
  { valor: 'consultor', nombre: 'Consultor' },
  { valor: 'admin', nombre: 'Administrador' },
  { valor: 'subadmin', nombre: 'Sub-Administrador de Ruta' },
  { valor: 'independiente', nombre: 'Taller Independiente · Sistema Propio' },
] as const

const rutas = ref<RutaSucursal[]>([])
const rutaNuevoUsuarioId = ref('')
const nombreTallerIndependiente = ref('')
const filtroTipoCuenta = ref<'todos' | 'internos' | 'independientes'>('todos')

const roles = computed(() => {
  let list = [...rolesBase]
  if (rutas.value.length === 0) {
    list = list.filter((opcion) => opcion.valor !== 'subadmin')
  }
  if (esTallerIndependiente.value) {
    list = list.filter((opcion) => opcion.valor !== 'independiente')
  }
  return list
})

const rolesEquipo = computed(() =>
  roles.value.filter((opcion) => opcion.valor !== 'independiente')
)

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
  nombreTallerIndependiente.value = ''
  rutaNuevoUsuarioId.value =
    rutas.value.find((r) => !r.subAdminId && !r.subAdminEmail)?.id ||
    rutas.value[0]?.id ||
    ''
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

  if (esTallerIndependiente.value && datos.rol === 'independiente') {
    datos.rol = 'operador'
  }

  const esCreacionIndependienteOwner =
    !esTallerIndependiente.value && datos.rol === 'independiente'
  const tenantIdActivo = esTallerIndependiente.value ? auth.activeTenantId : null

  let rolParaCrear = datos.rol
  let rutaObjetivo: RutaSucursal | undefined
  let tenantIdIndependiente = ''
  let tallerNombreIndependiente = ''
  if (datos.rol === 'subadmin') {
    rutaObjetivo = rutas.value.find((r) => r.id === rutaNuevoUsuarioId.value)
    if (!rutaObjetivo) {
      error.value = 'Selecciona la ruta que administrará este usuario.'
      return
    }
    rolParaCrear = encodeSubAdminRole(rutaObjetivo)
  } else if (esCreacionIndependienteOwner) {
    tenantIdIndependiente = `ind-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
    tallerNombreIndependiente =
      nombreTallerIndependiente.value.trim() ||
      `Taller de ${datos.nombre.trim()}`
    rolParaCrear = encodeIndependentRole({
      tenantId: tenantIdIndependiente,
      tallerNombre: tallerNombreIndependiente,
    })
  }

  const baseRolParaCrear = rolParaCrear
  if (tenantIdActivo) {
    rolParaCrear = encodeTenantMemberRole(
      baseRolParaCrear,
      tenantIdActivo,
      auth.activeTenantWorkshopName || undefined
    )
  }

  guardando.value = true

  try {
    const creado = await crearUsuario({
      nombre: datos.nombre,
      email: datos.email,
      password: datos.password,
      rol: rolParaCrear,
    })

    if (rutaObjetivo) {
      await rutasService.updateRuta(rutaObjetivo.id, {
        assignSubAdmin: {
          id: creado.id,
          nombre: datos.nombre.trim(),
          email: datos.email.trim().toLowerCase(),
        },
      })
    } else if (esCreacionIndependienteOwner && tenantIdIndependiente) {
      registerIndependentTenantUser({
        userId: creado.id,
        email: datos.email.trim().toLowerCase(),
        tenantId: tenantIdIndependiente,
        tallerNombre: tallerNombreIndependiente,
      })
      await tallerService
        .initIndependentTaller({
          tenantId: tenantIdIndependiente,
          nombreTaller: tallerNombreIndependiente,
        })
        .catch(() => undefined)
    } else if (tenantIdActivo) {
      registerIndependentTenantUser({
        userId: creado.id,
        email: datos.email.trim().toLowerCase(),
        tenantId: tenantIdActivo,
        tallerNombre: auth.activeTenantWorkshopName || undefined,
        isMember: true,
        baseRole: baseRolParaCrear,
      })
    }

    versionCredenciales.value++

    const nombreRolSeleccionado = rutaObjetivo
      ? `Sub-Admin (${rutaObjetivo.codigo} · ${rutaObjetivo.nombre})`
      : esCreacionIndependienteOwner
        ? `Sistema Independiente (${tallerNombreIndependiente})`
        : roles.value.find((opcion) => opcion.valor === datos.rol)?.nombre

    mensajeExito.value =
      `La cuenta de ${datos.nombre.trim()} fue creada con rol ${nombreRolSeleccionado}.`

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

const usuarios = ref<Perfil[]>([])
const busqueda = ref('')

function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const totalCuentasIndependientes = computed(
  () =>
    usuarios.value.filter((u) => parseIndependentRole(u.rol).isIndependent)
      .length
)

const totalCuentasInternas = computed(
  () => usuarios.value.length - totalCuentasIndependientes.value
)

const usuariosFiltrados = computed(() => {
  const baseList = usuarios.value.filter((usuario) => {
    const esInd = parseIndependentRole(usuario.rol).isIndependent
    if (filtroTipoCuenta.value === 'independientes') return esInd
    if (filtroTipoCuenta.value === 'internos') return !esInd
    return true
  })

  const palabras = normalizarBusqueda(busqueda.value).trim().split(/\s+/).filter(Boolean)
  if (!palabras.length) return baseList
  return baseList.filter((usuario) => {
    const texto = normalizarBusqueda(
      `${usuario.nombre ?? ''} ${usuario.email ?? ''} ${nombreRol(usuario.rol)}`
    )
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
    case 'Taller Independiente':
      return 'bg-[#05C7F2]/20 text-[#0D0D0D] ring-[#04C4D9] font-bold'
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
  const ind = parseIndependentRole(rol)
  if (ind.isIndependent) {
    return `Sistema Propio (${ind.tallerNombre || 'Taller Independiente'})`
  }
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

function esUsuarioSoloRuta(perfil: Perfil): boolean {
  return perfil.id.startsWith('ruta-user-')
}

function rutaIdDeUsuarioSoloRuta(perfil: Perfil): string {
  return perfil.id.replace(/^ruta-user-/, '')
}

function puedeEliminar(perfil: Perfil): boolean {
  const norm = normalizeRole(perfil.rol)
  const membership = getUserTenantMembership({
    id: perfil.id,
    email: perfil.email,
    rawRole: perfil.rol,
  })
  return (
    esAdministrador.value &&
    perfil.id !== auth.user?.id &&
    norm !== 'Administrador' &&
    !(esTallerIndependiente.value && membership.isTenantOwner)
  )
}

function puedeDesactivar(perfil: Perfil): boolean {
  return (
    !esUsuarioSoloRuta(perfil) &&
    perfil.estado !== 'Inactivo' &&
    puedeEliminar(perfil)
  )
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
    const [perfilesData, rutasData] = await Promise.all([
      perfilesService.getPerfiles(),
      rutasService.getRutas().catch(() => [] as RutaSucursal[]),
    ])
    rutas.value = rutasData

    const perfilesDelTenant = perfilesData.filter((perfil) => {
      const membership = getUserTenantMembership({
        id: perfil.id,
        email: perfil.email,
        rawRole: perfil.rol,
      })
      if (esTallerIndependiente.value) {
        return (
          membership.isIndependent &&
          membership.tenantId === auth.activeTenantId
        )
      }
      return !membership.isIndependent || membership.isTenantOwner
    })

    const combinados: Perfil[] = perfilesDelTenant.map((perfil) => {
      const rutaAsociada = rutasData.find(
        (r) =>
          r.subAdminId === perfil.id ||
          (!!r.subAdminEmail &&
            !!perfil.email &&
            r.subAdminEmail.trim().toLowerCase() ===
              perfil.email.trim().toLowerCase())
      )
      if (rutaAsociada && !parseSubAdminRole(perfil.rol).isSubAdmin) {
        return {
          ...perfil,
          rol: encodeSubAdminRole(rutaAsociada),
        }
      }
      return { ...perfil }
    })

    for (const ruta of rutasData) {
      const tieneEncargado = !!(
        ruta.subAdminId ||
        ruta.subAdminEmail?.trim() ||
        ruta.subAdminNombre?.trim()
      )
      if (!tieneEncargado) continue

      const emailRuta = ruta.subAdminEmail?.trim().toLowerCase() || ''
      const yaExiste = combinados.some(
        (p) =>
          (!!ruta.subAdminId && p.id === ruta.subAdminId) ||
          (!!emailRuta && p.email?.trim().toLowerCase() === emailRuta)
      )

      if (!yaExiste) {
        combinados.push({
          id: ruta.subAdminId || `ruta-user-${ruta.id}`,
          nombre: ruta.subAdminNombre?.trim() || `Encargado ${ruta.nombre}`,
          email:
            emailRuta ||
            `encargado.${(ruta.codigo || 'ruta').toLowerCase()}@jrblanco.com`,
          rol: encodeSubAdminRole(ruta),
          estado: ruta.estado === 'Inactiva' ? 'Inactivo' : 'Activo',
          created_at: ruta.createdAt,
          updated_at: ruta.createdAt,
        })
      }
    }

    combinados.sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '', 'es', {
        sensitivity: 'base',
      })
    )
    usuarios.value = combinados
    perfilesService.cachePerfilesList(combinados)
  } catch {
    errorLista.value = 'No se pudo actualizar la lista. Pulsa Actualizar para reintentar.'
  } finally {
    cargandoUsuarios.value = false
  }
}

const actualizandoSesionId = ref<string | null>(null)

async function alternarSesionUnica(perfil: Perfil) {
  if (!esAdministrador.value || actualizandoSesionId.value) return
  actualizandoSesionId.value = perfil.id
  errorLista.value = ''
  mensajeExito.value = ''
  const nuevoValor = !perfil.sesion_unica
  try {
    const actualizado = await perfilesService.setSesionUnica(perfil.id, nuevoValor)
    const idx = usuarios.value.findIndex((u) => u.id === perfil.id)
    if (idx !== -1 && usuarios.value[idx]) {
      usuarios.value[idx] = { ...usuarios.value[idx]!, ...actualizado }
    }
    mensajeExito.value = nuevoValor
      ? `Sesión restringida a 1 dispositivo para ${perfil.nombre}.`
      : `Acceso multi-dispositivo habilitado para ${perfil.nombre}.`
  } catch (err: unknown) {
    errorLista.value =
      err instanceof Error ? err.message : 'No se pudo actualizar la política de sesión.'
  } finally {
    actualizandoSesionId.value = null
  }
}

async function liberarDispositivoUsuario(perfil: Perfil) {
  if (!esAdministrador.value || actualizandoSesionId.value) return
  actualizandoSesionId.value = perfil.id
  errorLista.value = ''
  mensajeExito.value = ''
  try {
    const actualizado = await perfilesService.updatePerfil(perfil.id, {
      active_session_token: null,
    })
    const idx = usuarios.value.findIndex((u) => u.id === perfil.id)
    if (idx !== -1 && usuarios.value[idx]) {
      usuarios.value[idx] = { ...usuarios.value[idx]!, ...actualizado }
    }
    mensajeExito.value = `Bloqueo de dispositivo liberado para ${perfil.nombre}. Ya puede iniciar sesión en otro equipo.`
  } catch (err: unknown) {
    errorLista.value =
      err instanceof Error ? err.message : 'No se pudo liberar la sesión del dispositivo.'
  } finally {
    actualizandoSesionId.value = null
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
      if (esUsuarioSoloRuta(perfil)) {
        await rutasService.updateRuta(rutaIdDeUsuarioSoloRuta(perfil), {
          assignSubAdmin: null,
        })
      } else {
        await eliminarUsuario(perfil.id)
        const rutasVinculadas = rutas.value.filter(
          (r) =>
            r.subAdminId === perfil.id ||
            (!!r.subAdminEmail &&
              !!perfil.email &&
              r.subAdminEmail.trim().toLowerCase() ===
                perfil.email.trim().toLowerCase())
        )
        for (const r of rutasVinculadas) {
          await rutasService
            .updateRuta(r.id, { assignSubAdmin: null })
            .catch(() => undefined)
        }
      }
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
const rutaCambioRolId = ref('')
const nombreTallerCambioRol = ref('')
const guardandoRol = ref(false)
const errorRol = ref('')
const formularioRol = ref<HTMLFormElement | null>(null)
const selectorRol = ref<HTMLSelectElement | null>(null)
let botonOrigenRol: HTMLElement | null = null

function valorRol(rol: string): NuevoUsuario['rol'] {
  const normalizado = normalizeRole(rol)
  if (normalizado === 'Administrador') return 'admin'
  if (normalizado === 'Taller Independiente') return 'independiente'
  if (normalizado === 'Sub-Administrador') return 'subadmin'
  if (normalizado === 'Consultor') return 'consultor'
  return 'operador'
}

function rutaIdActualDePerfil(perfil: Perfil | null): string {
  if (!perfil) return ''
  const parsed = parseSubAdminRole(perfil.rol)
  if (parsed.rutaId && rutas.value.some((r) => r.id === parsed.rutaId)) {
    return parsed.rutaId
  }
  const emailLower = (perfil.email || '').trim().toLowerCase()
  const match = rutas.value.find(
    (r) =>
      r.subAdminId === perfil.id ||
      (!!emailLower && r.subAdminEmail?.trim().toLowerCase() === emailLower)
  )
  return match?.id || ''
}

const sinCambiosRol = computed(() => {
  if (!usuarioRol.value) return true
  const rolActual = valorRol(usuarioRol.value.rol)
  if (rolElegido.value !== rolActual) return false
  if (rolElegido.value === 'subadmin') {
    return rutaCambioRolId.value === rutaIdActualDePerfil(usuarioRol.value)
  }
  if (rolElegido.value === 'independiente') {
    const actualTaller =
      parseIndependentRole(usuarioRol.value.rol).tallerNombre || ''
    return nombreTallerCambioRol.value.trim() === actualTaller
  }
  return true
})

function puedeCambiarRol(perfil: Perfil): boolean {
  const membership = getUserTenantMembership({
    id: perfil.id,
    email: perfil.email,
    rawRole: perfil.rol,
  })
  return (
    !esUsuarioSoloRuta(perfil) &&
    esAdministrador.value &&
    perfil.id !== auth.user?.id &&
    !(esTallerIndependiente.value && membership.isTenantOwner)
  )
}

async function abrirCambioRol(perfil: Perfil, evento: MouseEvent) {
  if (!puedeCambiarRol(perfil) || guardandoRol.value) return
  botonOrigenRol = evento.currentTarget as HTMLElement
  usuarioRol.value = perfil
  rolElegido.value = valorRol(perfil.rol)
  nombreTallerCambioRol.value =
    parseIndependentRole(perfil.rol).tallerNombre || ''
  rutaCambioRolId.value =
    rutaIdActualDePerfil(perfil) ||
    rutas.value.find((r) => !r.subAdminId && !r.subAdminEmail)?.id ||
    rutas.value[0]?.id ||
    ''
  errorRol.value = ''
  mensajeExito.value = ''
  await nextTick()
  selectorRol.value?.focus()
}

async function cerrarCambioRol() {
  if (guardandoRol.value) return
  usuarioRol.value = null
  rutaCambioRolId.value = ''
  nombreTallerCambioRol.value = ''
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
  if (sinCambiosRol.value) return
  if (!roles.value.some((opcion) => opcion.valor === nuevoRol)) {
    errorRol.value = 'Selecciona un rol válido.'
    return
  }

  let rutaDestino: RutaSucursal | undefined
  if (nuevoRol === 'subadmin') {
    rutaDestino = rutas.value.find((r) => r.id === rutaCambioRolId.value)
    if (!rutaDestino) {
      errorRol.value = 'Selecciona la ruta asignada para este Sub-Administrador.'
      return
    }
  }

  errorRol.value = ''
  formularioRol.value?.focus()
  guardandoRol.value = true
  try {
    const emailLower = (perfil.email || '').trim().toLowerCase()
    const rutasPrevias = rutas.value.filter(
      (r) =>
        r.subAdminId === perfil.id ||
        (!!emailLower && r.subAdminEmail?.trim().toLowerCase() === emailLower)
    )

    const tenantIdActivo = esTallerIndependiente.value
      ? auth.activeTenantId
      : null

    if (nuevoRol === 'subadmin' && rutaDestino) {
      for (const r of rutasPrevias) {
        if (r.id !== rutaDestino.id) {
          await rutasService
            .updateRuta(r.id, { assignSubAdmin: null })
            .catch(() => undefined)
        }
      }
      const rolCodificado = tenantIdActivo
        ? encodeTenantMemberRole(
            encodeSubAdminRole(rutaDestino),
            tenantIdActivo,
            auth.activeTenantWorkshopName || undefined
          )
        : encodeSubAdminRole(rutaDestino)
      await rutasService.updateRuta(rutaDestino.id, {
        assignSubAdmin: {
          id: perfil.id,
          nombre: perfil.nombre,
          email: perfil.email,
        },
      })
      const fila = usuarios.value.find((usuario) => usuario.id === perfil.id)
      if (fila) fila.rol = rolCodificado
      mensajeExito.value = `El rol de ${perfil.nombre} fue actualizado a ${nombreRol(rolCodificado)}.`
    } else if (!esTallerIndependiente.value && nuevoRol === 'independiente') {
      for (const r of rutasPrevias) {
        await rutasService
          .updateRuta(r.id, { assignSubAdmin: null })
          .catch(() => undefined)
      }
      const existingInd = parseIndependentRole(perfil.rol)
      const tenantId =
        existingInd.tenantId ||
        `ind-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      const tallerNombreFinal =
        nombreTallerCambioRol.value.trim() ||
        existingInd.tallerNombre ||
        `Taller de ${perfil.nombre}`
      const rolCodificado = encodeIndependentRole({
        tenantId,
        tallerNombre: tallerNombreFinal,
      })
      await cambiarRolUsuario(perfil.id, rolCodificado, perfil.email)
      registerIndependentTenantUser({
        userId: perfil.id,
        email: perfil.email,
        tenantId,
        tallerNombre: tallerNombreFinal,
      })
      await tallerService
        .initIndependentTaller({
          tenantId,
          nombreTaller: tallerNombreFinal,
        })
        .catch(() => undefined)
      const fila = usuarios.value.find((usuario) => usuario.id === perfil.id)
      if (fila) fila.rol = rolCodificado
      mensajeExito.value = `El rol de ${perfil.nombre} fue actualizado a ${nombreRol(rolCodificado)}.`
    } else {
      for (const r of rutasPrevias) {
        await rutasService
          .updateRuta(r.id, { assignSubAdmin: null })
          .catch(() => undefined)
      }
      const rolFinal = tenantIdActivo
        ? encodeTenantMemberRole(
            nuevoRol,
            tenantIdActivo,
            auth.activeTenantWorkshopName || undefined
          )
        : nuevoRol
      await cambiarRolUsuario(perfil.id, rolFinal, perfil.email)
      if (tenantIdActivo) {
        registerIndependentTenantUser({
          userId: perfil.id,
          email: perfil.email,
          tenantId: tenantIdActivo,
          tallerNombre: auth.activeTenantWorkshopName || undefined,
          isMember: true,
          baseRole: nuevoRol,
        })
      }
      const fila = usuarios.value.find((usuario) => usuario.id === perfil.id)
      if (fila) fila.rol = rolFinal
      mensajeExito.value = `El rol de ${perfil.nombre} fue actualizado a ${nombreRol(rolFinal)}.`
    }

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
const nombreEditableFicha = ref('')
const guardandoNombreFicha = ref(false)
const credencialEditable = ref('')
const mostrarPasswordEnModal = ref(true)
const esNuevaPasswordVisible = ref(true)
const mensajeModalCredencial = ref('')
const tipoMensajeModalCredencial = ref<'ok' | 'error'>('ok')
const guardandoCredencial = ref(false)
const dialogoCredenciales = ref<HTMLDivElement | null>(null)
let botonOrigenCredencial: HTMLElement | null = null

const esAdministrador = computed(() => {
  const norm = normalizeRole(auth.user?.role)
  return norm === 'Administrador' || norm === 'Taller Independiente'
})

function inicialesFicha(nombre?: string | null): string {
  const parts = (nombre || 'US').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'US'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] || ''}${parts[1]![0] || ''}`.toUpperCase()
}

function generarPasswordSeguraModal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digitos = '23456789'
  const pick = (pool: string, len: number) =>
    Array.from({ length: len }, () => pool[Math.floor(Math.random() * pool.length)]).join('')
  credencialEditable.value = `${pick(letras, 4)}-${pick(digitos, 4)}`
  esNuevaPasswordVisible.value = true
}

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
  const pwd = credencialDeUsuario(usuario) || 'No registrada'
  const ind = parseIndependentRole(usuario.rol)
  const lineaExtra = ind.isIndependent
    ? `\nModalidad: Sistema Independiente (${ind.tallerNombre || 'Taller Propio'}) · Catálogo Compartido`
    : ''
  const ficha = `SWGORA\nNombre: ${usuario.nombre}\nUsuario (Correo): ${usuario.email}\nContraseña: ${pwd}\nRol: ${nombreRol(usuario.rol)}${lineaExtra}`
  await copiarTexto(ficha, `ficha-${usuario.id}`)
}

async function abrirModalCredenciales(perfil: Perfil, evento?: MouseEvent) {
  if (!esAdministrador.value) return
  if (evento?.currentTarget instanceof HTMLElement) {
    botonOrigenCredencial = evento.currentTarget
  }
  usuarioCredencial.value = perfil
  nombreEditableFicha.value = perfil.nombre || ''
  credencialEditable.value = credencialDeUsuario(perfil) || ''
  mostrarPasswordEnModal.value = false
  esNuevaPasswordVisible.value = true
  mensajeModalCredencial.value = ''
  tipoMensajeModalCredencial.value = 'ok'
  await nextTick()
  dialogoCredenciales.value?.focus()
}

async function cerrarModalCredenciales() {
  usuarioCredencial.value = null
  mensajeModalCredencial.value = ''
  await nextTick()
  if (botonOrigenCredencial?.isConnected) {
    botonOrigenCredencial.focus()
  }
}

async function guardarNombreFichaUsuario() {
  const perfil = usuarioCredencial.value
  if (!perfil || guardandoNombreFicha.value) return
  const nuevoNombre = nombreEditableFicha.value.trim().replace(/\s+/g, ' ')
  if (nuevoNombre.length < 2) {
    tipoMensajeModalCredencial.value = 'error'
    mensajeModalCredencial.value = 'Escribe un nombre válido de al menos 2 caracteres.'
    return
  }
  if (nuevoNombre === perfil.nombre) {
    tipoMensajeModalCredencial.value = 'ok'
    mensajeModalCredencial.value = 'El nombre de la ficha ya está actualizado.'
    return
  }

  guardandoNombreFicha.value = true
  mensajeModalCredencial.value = ''
  try {
    if (esUsuarioSoloRuta(perfil)) {
      const rutaId = rutaIdDeUsuarioSoloRuta(perfil)
      await rutasService.updateRuta(rutaId, {
        assignSubAdmin: {
          nombre: nuevoNombre,
          email: perfil.email,
        },
      })
    } else {
      await perfilesService.updatePerfil(perfil.id, { nombre: nuevoNombre })
    }

    perfil.nombre = nuevoNombre
    const fila = usuarios.value.find((u) => u.id === perfil.id)
    if (fila) {
      fila.nombre = nuevoNombre
    }
    perfilesService.cachePerfilesList(usuarios.value)
    tipoMensajeModalCredencial.value = 'ok'
    mensajeModalCredencial.value = 'Nombre de la ficha de usuario actualizado correctamente.'
  } catch (err: unknown) {
    tipoMensajeModalCredencial.value = 'error'
    mensajeModalCredencial.value =
      err instanceof Error
        ? err.message
        : 'No se pudo actualizar el nombre del usuario.'
  } finally {
    guardandoNombreFicha.value = false
  }
}

async function guardarCredencialVisible() {
  const perfil = usuarioCredencial.value
  if (!perfil || guardandoCredencial.value) return
  const limpia = credencialEditable.value.trim()
  if (!limpia) {
    tipoMensajeModalCredencial.value = 'error'
    mensajeModalCredencial.value = 'Escribe la contraseña que deseas registrar para este usuario.'
    return
  }
  if (limpia.length < 6) {
    tipoMensajeModalCredencial.value = 'error'
    mensajeModalCredencial.value = 'La contraseña debe tener al menos 6 caracteres.'
    return
  }

  guardandoCredencial.value = true
  mensajeModalCredencial.value = ''
  try {
    const res = await cambiarPasswordUsuario({
      id: perfil.id,
      email: perfil.email,
      password: limpia,
    })
    versionCredenciales.value++
    credencialesVisibles[perfil.id] = true
    mostrarPasswordEnModal.value = true
    tipoMensajeModalCredencial.value = 'ok'
    mensajeModalCredencial.value = res.updatedInAuth
      ? 'Contraseña actualizada en el acceso del usuario y guardada en la bóveda.'
      : 'Contraseña actualizada para iniciar sesión y guardada en la bóveda.'
  } catch (err: unknown) {
    tipoMensajeModalCredencial.value = 'error'
    mensajeModalCredencial.value =
      err instanceof Error
        ? err.message
        : 'No se pudo actualizar la contraseña.'
  } finally {
    guardandoCredencial.value = false
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

      <div class="space-y-4 border-b border-[#F2F2F2] p-5">
        <div
          v-if="!esTallerIndependiente"
          class="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer"
            :class="
              filtroTipoCuenta === 'todos'
                ? 'bg-[#0D0D0D] text-[#05F2F2]'
                : 'bg-[#F2F2F2] text-[#0D0D0D]/75 hover:bg-[#05C7F2]/15'
            "
            @click="filtroTipoCuenta = 'todos'"
          >
            Todos ({{ usuarios.length }})
          </button>
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer"
            :class="
              filtroTipoCuenta === 'internos'
                ? 'bg-[#0D0D0D] text-[#05F2F2]'
                : 'bg-[#F2F2F2] text-[#0D0D0D]/75 hover:bg-[#05C7F2]/15'
            "
            @click="filtroTipoCuenta = 'internos'"
          >
            Equipo interno y rutas ({{ totalCuentasInternas }})
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer"
            :class="
              filtroTipoCuenta === 'independientes'
                ? 'bg-[#0D0D0D] text-[#05F2F2]'
                : 'border border-[#04C4D9]/45 bg-[#05C7F2]/10 text-[#0D0D0D] hover:bg-[#05C7F2]/25'
            "
            @click="filtroTipoCuenta = 'independientes'"
          >
            <Wrench class="h-3.5 w-3.5" />
            <span>Talleres independientes ({{ totalCuentasIndependientes }})</span>
          </button>
        </div>

        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="w-full sm:max-w-sm">
            <label for="buscar-usuarios" class="mb-1.5 block text-xs font-bold text-[#0D0D0D]">Buscar usuarios</label>
            <div class="relative group">
              <Search aria-hidden="true" class="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#0D0D0D]/40 transition-colors group-focus-within:text-[#04C4D9]" />
              <input
                id="buscar-usuarios"
                v-model="busqueda"
                type="search"
                autocomplete="off"
                placeholder="Nombre, correo, ruta o taller"
                aria-controls="tabla-usuarios"
                class="w-full rounded-full border border-[#0D0D0D]/15 bg-[#F2F2F2] py-2.5 pl-10 pr-4 text-sm text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
              />
            </div>
          </div>
          <p v-if="!cargandoUsuarios && !errorLista" role="status" class="text-xs font-medium text-[#0D0D0D]/60 tabular-nums">
            {{ usuariosFiltrados.length }} de {{ usuarios.length }} usuarios cargados
          </p>
        </div>
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
              <th v-if="esAdministrador" scope="col" class="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">Sesión</th>
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
              <td v-if="esAdministrador" class="whitespace-nowrap px-5 py-4">
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    :disabled="actualizandoSesionId === usuario.id"
                    :title="usuario.sesion_unica ? 'Solo 1 dispositivo activo a la vez (clic para permitir multi-dispositivo)' : 'Múltiples dispositivos permitidos (clic para restringir a 1 dispositivo)'"
                    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset transition cursor-pointer disabled:opacity-50"
                    :class="usuario.sesion_unica
                      ? 'bg-[#0D0D0D] text-[#05F2F2] ring-[#0D0D0D] hover:bg-black'
                      : 'bg-[#F2F2F2] text-[#0D0D0D]/75 ring-[#0D0D0D]/15 hover:bg-[#05C7F2]/15 hover:text-[#0D0D0D]'"
                    @click="alternarSesionUnica(usuario)"
                  >
                    <Smartphone v-if="usuario.sesion_unica" class="h-3.5 w-3.5 shrink-0" />
                    <MonitorSmartphone v-else class="h-3.5 w-3.5 shrink-0" />
                    <span>{{ usuario.sesion_unica ? '1 Dispositivo' : 'Multi-dispositivo' }}</span>
                  </button>
                  <button
                    v-if="usuario.sesion_unica && usuario.active_session_token"
                    type="button"
                    :disabled="actualizandoSesionId === usuario.id"
                    title="Liberar sesión activa para permitir acceso desde otro dispositivo"
                    class="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100 cursor-pointer disabled:opacity-50"
                    @click="liberarDispositivoUsuario(usuario)"
                  >
                    <Unlock class="h-3 w-3 shrink-0" />
                    <span>Liberar</span>
                  </button>
                </div>
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
                {{
                  datos.rol === 'independiente'
                    ? 'Compartir sistema independiente'
                    : 'Nuevo usuario'
                }}
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
              <div
                v-if="!esTallerIndependiente"
                class="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F2F2F2] p-1"
              >
                <button
                  type="button"
                  :disabled="guardando"
                  class="rounded-lg px-2.5 py-2 text-xs font-bold transition cursor-pointer"
                  :class="
                    datos.rol !== 'independiente'
                      ? 'bg-[#0D0D0D] text-[#05F2F2] shadow-sm'
                      : 'text-[#0D0D0D]/70 hover:text-[#0D0D0D]'
                  "
                  @click="datos.rol = datos.rol === 'independiente' ? 'operador' : datos.rol"
                >
                  Equipo de mi taller
                </button>
                <button
                  type="button"
                  :disabled="guardando"
                  class="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold transition cursor-pointer"
                  :class="
                    datos.rol === 'independiente'
                      ? 'bg-[#0D0D0D] text-[#05F2F2] shadow-sm'
                      : 'text-[#0D0D0D]/70 hover:text-[#0D0D0D]'
                  "
                  @click="datos.rol = 'independiente'"
                >
                  <Wrench class="h-3.5 w-3.5 shrink-0" />
                  <span>Sistema Independiente</span>
                </button>
              </div>
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

              <div v-if="datos.rol !== 'independiente'">
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
                    v-for="opcion in rolesEquipo"
                    :key="opcion.valor"
                    :value="opcion.valor"
                  >
                    {{ opcion.nombre }}
                  </option>
                </select>

                <div v-if="datos.rol === 'subadmin'" class="mt-3">
                  <label
                    for="usuario-ruta-asignada"
                    class="mb-1.5 block text-xs font-bold text-[#0D0D0D]"
                  >
                    Ruta asignada
                  </label>
                  <select
                    id="usuario-ruta-asignada"
                    v-model="rutaNuevoUsuarioId"
                    required
                    :disabled="guardando"
                    class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                  >
                    <option
                      v-for="ruta in rutas"
                      :key="ruta.id"
                      :value="ruta.id"
                    >
                      {{ ruta.codigo }} · {{ ruta.nombre }}{{ ruta.subAdminNombre ? ` (Actual: ${ruta.subAdminNombre})` : '' }}
                    </option>
                  </select>
                </div>

                <p class="mt-1 text-xs text-[#0D0D0D]/60">
                  {{
                    datos.rol === 'subadmin'
                      ? 'Solo podrá ver y gestionar órdenes de la ruta seleccionada.'
                      : 'Tallerista utiliza los permisos del rol Operador.'
                  }}
                </p>
              </div>

              <div v-else class="space-y-3">
                <div>
                  <label
                    for="usuario-taller-independiente"
                    class="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[#0D0D0D]"
                  >
                    <Building2 class="h-3.5 w-3.5 text-[#04C4D9]" />
                    <span>Nombre del taller independiente</span>
                  </label>
                  <input
                    id="usuario-taller-independiente"
                    v-model="nombreTallerIndependiente"
                    type="text"
                    maxlength="120"
                    :disabled="guardando"
                    class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                    placeholder="Ej. Taller Mecánico El Rayo (opcional)"
                  />
                </div>

                <div class="rounded-xl border border-[#04C4D9]/45 bg-[#05C7F2]/10 p-3 text-xs text-[#0D0D0D] space-y-1.5">
                  <div class="flex items-center gap-1.5 font-bold">
                    <Sparkles class="h-3.5 w-3.5 text-[#04C4D9] shrink-0" />
                    <span>Sistema independiente desde cero + Catálogo compartido</span>
                  </div>
                  <ul class="list-disc pl-4 space-y-0.5 text-[#0D0D0D]/80">
                    <li>Iniciará vacío: 0 órdenes, 0 clientes y configuración de su propio taller para PDFs.</li>
                    <li>Solo compartirá el <strong>Catálogo técnico</strong>.</li>
                    <li>Aislamiento total: él no verá tus datos y tú tampoco verás los suyos.</li>
                  </ul>
                </div>
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
            <div v-if="rolElegido === 'subadmin'" class="mt-3">
              <label for="cambiar-ruta-usuario" class="mb-1.5 block text-xs font-bold text-[#0D0D0D]">Ruta asignada</label>
              <select
                id="cambiar-ruta-usuario"
                v-model="rutaCambioRolId"
                required
                :disabled="guardandoRol"
                class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
              >
                <option v-for="ruta in rutas" :key="ruta.id" :value="ruta.id">
                  {{ ruta.codigo }} · {{ ruta.nombre }}{{ ruta.subAdminNombre && ruta.subAdminId !== usuarioRol?.id ? ` (Actual: ${ruta.subAdminNombre})` : '' }}
                </option>
              </select>
            </div>
            <div v-else-if="rolElegido === 'independiente'" class="mt-3">
              <label for="cambiar-taller-independiente" class="mb-1.5 block text-xs font-bold text-[#0D0D0D]">Nombre del taller independiente</label>
              <input
                id="cambiar-taller-independiente"
                v-model="nombreTallerCambioRol"
                type="text"
                maxlength="120"
                :disabled="guardandoRol"
                placeholder="Ej. Taller Mecánico El Rayo"
                class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-3.5 py-2.5 text-sm text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:bg-white focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
              />
            </div>
            <p v-if="rolElegido === 'admin'" class="mt-3 rounded-xl border border-[#04C4D9]/40 bg-[#05C7F2]/10 p-3 text-sm font-medium text-[#0D0D0D]">
              Administrador permite gestionar usuarios y acceder a todas las secciones del sistema.
            </p>
            <p v-else-if="rolElegido === 'independiente'" class="mt-3 rounded-xl border border-[#04C4D9]/45 bg-[#05C7F2]/15 p-3 text-sm font-medium text-[#0D0D0D]">
              Sistema propio vacío (0 órdenes y 0 clientes propios) compartiendo únicamente el Catálogo técnico.
            </p>
            <p v-else-if="rolElegido === 'subadmin'" class="mt-3 rounded-xl border border-[#04C4D9]/40 bg-[#05F2F2]/15 p-3 text-sm font-medium text-[#0D0D0D]">
              Sub-Administrador de Ruta administra únicamente las órdenes y clientes de su ruta asignada.
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
                :disabled="guardandoRol || !puedeCambiarRol(usuarioRol) || sinCambiosRol"
                class="rounded-full bg-[#0D0D0D] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >{{ guardandoRol ? 'Guardando…' : 'Confirmar cambio' }}</button>
            </div>
          </div>
        </form>
      </div>

      <!-- Modal Mejorado de Ficha de Usuario y Cambio de Contraseña -->
      <div
        v-if="usuarioCredencial"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D0D]/75 backdrop-blur-xs p-4"
        @click.self="cerrarModalCredenciales"
        @keydown.esc="cerrarModalCredenciales"
      >
        <div
          ref="dialogoCredenciales"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-credenciales-usuario"
          tabindex="-1"
          class="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#0D0D0D]/15 bg-white shadow-2xl outline-none overflow-hidden"
        >
          <!-- Cabecera oscura de Ficha de Usuario -->
          <div class="relative bg-[#0D0D0D] px-6 py-5 text-white">
            <div class="h-1 w-full bg-gradient-to-r from-[#05C7F2] via-[#04C4D9] to-[#05F2F2] absolute top-0 left-0"></div>
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3.5 min-w-0">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#05C7F2] to-[#04C4D9] text-sm font-black text-[#0D0D0D] shadow-lg shadow-[#05C7F2]/20">
                  {{ inicialesFicha(usuarioCredencial.nombre) }}
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 id="titulo-credenciales-usuario" class="truncate text-base font-bold text-white">
                      {{ usuarioCredencial.nombre }}
                    </h2>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      :class="
                        usuarioCredencial.estado === 'Inactivo'
                          ? 'bg-white/10 text-white/60'
                          : 'bg-[#05F2F2]/20 text-[#05F2F2] ring-1 ring-[#05F2F2]/40'
                      "
                    >
                      {{ usuarioCredencial.estado || 'Activo' }}
                    </span>
                  </div>
                  <p class="mt-0.5 truncate font-mono text-xs text-white/65">
                    {{ usuarioCredencial.email }}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#05C7F2]">
                      <ShieldCheck class="h-3 w-3" />
                      {{ nombreRol(usuarioCredencial.rol) }}
                    </span>
                    <span class="text-[11px] text-white/45">
                      Alta: {{ fechaCreacion(usuarioCredencial.created_at) }}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-label="Cerrar ficha de usuario"
                class="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white cursor-pointer"
                @click="cerrarModalCredenciales"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="p-6 space-y-5">
            <!-- 1. Editar nombre y configuración rápida de ficha -->
            <div class="rounded-2xl border border-[#0D0D0D]/10 bg-[#F2F2F2]/60 p-4 space-y-3.5">
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">
                  <Pencil class="h-3.5 w-3.5 text-[#04C4D9]" />
                  <span>Ficha del usuario</span>
                </span>
                <div class="flex items-center gap-1.5">
                  <button
                    v-if="!esUsuarioSoloRuta(usuarioCredencial)"
                    type="button"
                    :disabled="actualizandoSesionId === usuarioCredencial.id"
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                    :class="
                      usuarioCredencial.sesion_unica
                        ? 'bg-[#0D0D0D] text-[#05F2F2]'
                        : 'border border-[#0D0D0D]/15 bg-white text-[#0D0D0D]/75 hover:border-[#04C4D9]'
                    "
                    @click="alternarSesionUnica(usuarioCredencial)"
                  >
                    <Smartphone v-if="usuarioCredencial.sesion_unica" class="h-3 w-3" />
                    <MonitorSmartphone v-else class="h-3 w-3" />
                    <span>
                      {{
                        usuarioCredencial.sesion_unica
                          ? '1 Dispositivo'
                          : 'Multi-dispositivo'
                      }}
                    </span>
                  </button>
                  <button
                    v-if="puedeCambiarRol(usuarioCredencial)"
                    type="button"
                    class="rounded-full border border-[#04C4D9]/45 bg-white px-2.5 py-1 text-[11px] font-bold text-[#0D0D0D] transition hover:bg-[#05C7F2]/15 cursor-pointer"
                    @click="(e) => { const target = usuarioCredencial!; void cerrarModalCredenciales().then(() => abrirCambioRol(target, e)) }"
                  >
                    Cambiar rol
                  </button>
                </div>
              </div>

              <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="guardarNombreFichaUsuario">
                <input
                  id="input-nombre-ficha"
                  v-model="nombreEditableFicha"
                  type="text"
                  maxlength="120"
                  :disabled="guardandoNombreFicha"
                  placeholder="Nombre completo del usuario"
                  class="flex-1 rounded-xl border border-[#0D0D0D]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                />
                <button
                  type="submit"
                  :disabled="guardandoNombreFicha || nombreEditableFicha.trim() === usuarioCredencial.nombre"
                  class="rounded-xl bg-[#0D0D0D] px-4 py-2 text-xs font-bold text-[#05F2F2] transition hover:bg-black disabled:opacity-40 cursor-pointer"
                >
                  {{ guardandoNombreFicha ? 'Guardando…' : 'Guardar nombre' }}
                </button>
              </form>
            </div>

            <!-- 2. Credenciales actuales y copiar ficha -->
            <div class="space-y-3 rounded-2xl border border-[#0D0D0D]/10 bg-white p-4 shadow-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0D0D0D]/70">
                  <KeyRound class="h-3.5 w-3.5 text-[#04C4D9]" />
                  <span>Credenciales actuales</span>
                </span>
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-full bg-[#0D0D0D] px-3 py-1.5 text-[11px] font-bold text-[#05F2F2] transition hover:bg-black cursor-pointer"
                  @click="copiarFichaAcceso(usuarioCredencial)"
                >
                  <Check v-if="copiadoId === `ficha-${usuarioCredencial.id}`" class="h-3.5 w-3.5" />
                  <Copy v-else class="h-3.5 w-3.5" />
                  <span>
                    {{
                      copiadoId === `ficha-${usuarioCredencial.id}`
                        ? 'Ficha copiada'
                        : 'Copiar ficha'
                    }}
                  </span>
                </button>
              </div>

              <div class="grid gap-2.5 sm:grid-cols-2">
                <div class="rounded-xl border border-[#0D0D0D]/10 bg-[#F2F2F2]/70 px-3 py-2">
                  <span class="block text-[10px] font-bold uppercase tracking-wider text-[#0D0D0D]/50">
                    Correo de acceso
                  </span>
                  <div class="mt-1 flex items-center justify-between gap-1.5">
                    <span class="truncate font-mono text-xs font-bold text-[#0D0D0D]" :title="usuarioCredencial.email">
                      {{ usuarioCredencial.email }}
                    </span>
                    <button
                      type="button"
                      class="shrink-0 rounded-lg bg-white p-1.5 text-[#0D0D0D] shadow-xs transition hover:bg-[#05C7F2]/20 cursor-pointer"
                      title="Copiar correo"
                      @click="copiarTexto(usuarioCredencial.email, `modal-email-${usuarioCredencial.id}`)"
                    >
                      <Check v-if="copiadoId === `modal-email-${usuarioCredencial.id}`" class="h-3.5 w-3.5 text-[#04C4D9]" />
                      <Copy v-else class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div class="rounded-xl border border-[#0D0D0D]/10 bg-[#F2F2F2]/70 px-3 py-2">
                  <span class="block text-[10px] font-bold uppercase tracking-wider text-[#0D0D0D]/50">
                    Contraseña actual
                  </span>
                  <div class="mt-1 flex items-center justify-between gap-1.5">
                    <span class="truncate font-mono text-xs font-bold text-[#0D0D0D]">
                      {{
                        mostrarPasswordEnModal
                          ? credencialDeUsuario(usuarioCredencial) || 'No guardada'
                          : '••••••••••'
                      }}
                    </span>
                    <div class="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        class="rounded-lg bg-white p-1.5 text-[#0D0D0D]/70 shadow-xs transition hover:text-[#0D0D0D] cursor-pointer"
                        :title="mostrarPasswordEnModal ? 'Ocultar' : 'Mostrar'"
                        @click="mostrarPasswordEnModal = !mostrarPasswordEnModal"
                      >
                        <EyeOff v-if="mostrarPasswordEnModal" class="h-3.5 w-3.5" />
                        <Eye v-else class="h-3.5 w-3.5" />
                      </button>
                      <button
                        v-if="credencialDeUsuario(usuarioCredencial)"
                        type="button"
                        class="rounded-lg bg-white p-1.5 text-[#0D0D0D] shadow-xs transition hover:bg-[#05C7F2]/20 cursor-pointer"
                        title="Copiar contraseña"
                        @click="copiarTexto(credencialDeUsuario(usuarioCredencial)!, `modal-pwd-${usuarioCredencial.id}`)"
                      >
                        <Check v-if="copiadoId === `modal-pwd-${usuarioCredencial.id}`" class="h-3.5 w-3.5 text-[#04C4D9]" />
                        <Copy v-else class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Cambiar contraseña -->
            <form
              class="rounded-2xl border border-[#04C4D9]/35 bg-[#05C7F2]/[0.06] p-4 space-y-3"
              @submit.prevent="guardarCredencialVisible"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label for="input-credencial-visible" class="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
                  Cambiar contraseña de acceso
                </label>
                <button
                  type="button"
                  :disabled="guardandoCredencial"
                  class="inline-flex items-center gap-1 rounded-full border border-[#04C4D9]/50 bg-white px-2.5 py-1 text-[11px] font-bold text-[#0D0D0D] transition hover:bg-[#05C7F2]/20 cursor-pointer disabled:opacity-50"
                  @click="generarPasswordSeguraModal"
                >
                  <Sparkles class="h-3 w-3 text-[#04C4D9]" />
                  <span>Generar clave</span>
                </button>
              </div>

              <div class="relative">
                <input
                  id="input-credencial-visible"
                  v-model="credencialEditable"
                  :type="esNuevaPasswordVisible ? 'text' : 'password'"
                  :disabled="guardandoCredencial"
                  placeholder="Nueva contraseña (mínimo 6 caracteres)"
                  class="w-full rounded-xl border border-[#0D0D0D]/15 bg-white pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold text-[#0D0D0D] placeholder-[#0D0D0D]/40 outline-none transition focus:border-[#05C7F2] focus:ring-2 focus:ring-[#05C7F2]/25"
                />
                <button
                  type="button"
                  class="absolute right-2.5 top-2 rounded-lg p-1 text-[#0D0D0D]/55 transition hover:bg-[#F2F2F2] hover:text-[#0D0D0D] cursor-pointer"
                  :title="esNuevaPasswordVisible ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'"
                  @click="esNuevaPasswordVisible = !esNuevaPasswordVisible"
                >
                  <EyeOff v-if="esNuevaPasswordVisible" class="h-4 w-4" />
                  <Eye v-else class="h-4 w-4" />
                </button>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <span class="text-[11px] font-medium text-[#0D0D0D]/60">
                  Mínimo 6 caracteres · Aplica de inmediato al iniciar sesión
                </span>
                <button
                  type="submit"
                  :disabled="guardandoCredencial || credencialEditable.trim().length < 6"
                  class="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#05C7F2] to-[#04C4D9] px-4 py-2 text-xs font-bold text-[#0D0D0D] shadow-sm transition hover:brightness-95 disabled:opacity-45 cursor-pointer"
                >
                  <KeyRound class="h-3.5 w-3.5" />
                  <span>{{ guardandoCredencial ? 'Actualizando…' : 'Actualizar contraseña' }}</span>
                </button>
              </div>
            </form>

            <p
              v-if="mensajeModalCredencial"
              role="status"
              class="rounded-xl border p-3 text-xs font-semibold"
              :class="
                tipoMensajeModalCredencial === 'error'
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-[#04C4D9]/50 bg-[#05C7F2]/15 text-[#0D0D0D]'
              "
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