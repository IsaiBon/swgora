<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Eye,
  EyeOff,
  Copy,
  Check,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  KeyRound,
  Sparkles,
  ArrowRight,
  Building2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next'
import {
  normalizarNombreRuta,
  encodeTenantMemberRole,
  getUserTenantMembership,
  rutasService,
  type RutaSucursal,
} from '@/services/rutasService'
import { ordersService, type Order } from '@/services/ordersService'
import { perfilesService, type Perfil } from '@/services/perfilesService'
import { useAuthStore, normalizeRole } from '@/stores/auth'
import {
  obtenerCredencialUsuario,
  cambiarPasswordUsuario,
} from '@/services/usuariosService'

const router = useRouter()
const authStore = useAuthStore()

const rutas = ref<RutaSucursal[]>([])
const orders = ref<Order[]>([])
const perfiles = ref<Perfil[]>([])
const loading = ref(true)
const searchQuery = ref('')

// Mensajes y alertas
const bannerExito = ref('')
const credencialesRecienCreadas = ref<{
  rutaNombre: string
  rutaCodigo: string
  nombre: string
  email: string
  password: string
} | null>(null)

// Visibilidad de contraseñas en tarjetas
const passwordVisibleMap = reactive<Record<string, boolean>>({})
const copiadoId = ref<string | null>(null)

// Modal de Crear / Editar Ruta + Sub-Admin
const modalAbierto = ref(false)
const modoEdicion = ref(false)
const rutaEditandoId = ref<string | null>(null)
const guardando = ref(false)
const errorFormulario = ref('')
const mostrarPasswordForm = ref(true)
const inputNombreRuta = ref<HTMLInputElement | null>(null)

const form = reactive({
  codigo: '',
  nombre: '',
  zona: '',
  descripcion: '',
  modoSubAdmin: 'nuevo' as 'nuevo' | 'existente' | 'sin_asignar',
  subAdminNombre: '',
  subAdminEmail: '',
  subAdminPassword: '',
  existingUserId: '',
})

const usuariosDisponiblesParaRuta = computed(() => {
  const esInd = Boolean(authStore.user?.isIndependent)
  const tenantActivo = authStore.activeTenantId
  return perfiles.value.filter((u) => {
    if (u.estado === 'Inactivo' || u.id === authStore.user?.id) return false
    if (normalizeRole(u.rol) === 'Administrador') return false
    const membership = getUserTenantMembership({
      id: u.id,
      email: u.email,
      rawRole: u.rol,
    })
    if (esInd) {
      return (
        membership.isIndependent &&
        membership.tenantId === tenantActivo &&
        !membership.isTenantOwner
      )
    }
    return !membership.isIndependent
  })
})

const rutaNombreDuplicado = computed<RutaSucursal | null>(() => {
  const nombreNorm = normalizarNombreRuta(form.nombre)
  if (!nombreNorm) return null
  const excluirId = modoEdicion.value ? rutaEditandoId.value : null
  return (
    rutas.value.find(
      (r) => r.id !== excluirId && normalizarNombreRuta(r.nombre) === nombreNorm
    ) ?? null
  )
})

const rutaCodigoDuplicado = computed<RutaSucursal | null>(() => {
  const codigoNorm = form.codigo.trim().toUpperCase()
  if (!codigoNorm) return null
  const excluirId = modoEdicion.value ? rutaEditandoId.value : null
  return (
    rutas.value.find(
      (r) => r.id !== excluirId && r.codigo.trim().toUpperCase() === codigoNorm
    ) ?? null
  )
})

const emailDuplicadoSubAdmin = computed<string | null>(() => {
  if (form.modoSubAdmin !== 'nuevo') return null
  const emailNorm = form.subAdminEmail.trim().toLowerCase()
  if (!emailNorm) return null

  const perfilExistente = perfiles.value.find(
    (u) => (u.email || '').trim().toLowerCase() === emailNorm
  )
  if (perfilExistente) {
    return `usuario ${perfilExistente.nombre || perfilExistente.email}`
  }

  const rutaExistente = rutas.value.find(
    (r) => (r.subAdminEmail || '').trim().toLowerCase() === emailNorm
  )
  if (rutaExistente) {
    return `encargado de "${rutaExistente.nombre}"`
  }

  return null
})

// Modal de confirmación de eliminación
const rutaAEliminar = ref<RutaSucursal | null>(null)
const eliminando = ref(false)

// Modal de credenciales de un Sub-Admin
const rutaCredencialModal = ref<RutaSucursal | null>(null)
const passwordEditableModal = ref('')
const mostrarPasswordCredModal = ref(false)
const esAdminPasswordVisible = ref(true)
const mensajeCredencialModal = ref('')
const tipoMensajeCredencialModal = ref<'ok' | 'error'>('ok')
const guardandoCredencialModal = ref(false)

async function cargarTodo() {
  loading.value = true
  try {
    const [rutasData, ordersData, perfilesData] = await Promise.all([
      rutasService.getRutas(),
      ordersService.getOrders(),
      perfilesService.getPerfiles().catch(() => [] as Perfil[]),
    ])
    rutas.value = rutasData
    orders.value = ordersData
    perfiles.value = perfilesData
  } finally {
    loading.value = false
  }
}

function manejarEscapeModal(e: KeyboardEvent) {
  if (e.key === 'Escape' && modalAbierto.value) {
    cerrarModal()
  }
}

onMounted(() => {
  void cargarTodo()
  window.addEventListener('keydown', manejarEscapeModal)
})

onUnmounted(() => {
  window.removeEventListener('keydown', manejarEscapeModal)
})

// Filtrado de rutas
const rutasFiltradas = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return rutas.value
  return rutas.value.filter(
    (r) =>
      r.nombre.toLowerCase().includes(q) ||
      r.codigo.toLowerCase().includes(q) ||
      (r.zona || '').toLowerCase().includes(q) ||
      (r.subAdminNombre || '').toLowerCase().includes(q) ||
      (r.subAdminEmail || '').toLowerCase().includes(q)
  )
})

// Estadísticas de órdenes por ruta
function ordenesDeRuta(ruta: RutaSucursal): Order[] {
  return orders.value.filter(
    (o) =>
      o.rutaId === ruta.id ||
      (o.rutaCodigo &&
        o.rutaCodigo.toLowerCase() === ruta.codigo.toLowerCase()) ||
      (o.rutaNombre &&
        o.rutaNombre.toLowerCase() === ruta.nombre.toLowerCase())
  )
}

function metricasDeRuta(ruta: RutaSucursal) {
  const lista = ordenesDeRuta(ruta)
  const totalOrdenes = lista.length
  const pendientes = lista.filter((o) => o.status === 'Pendiente').length
  const enProceso = lista.filter((o) => o.status === 'En Proceso').length
  const facturacion = lista.reduce((acc, o) => acc + (Number(o.total) || 0), 0)
  return {
    totalOrdenes,
    pendientes,
    enProceso,
    facturacion,
  }
}

// KPIs globales de rutas
const kpisGlobales = computed(() => {
  const totalRutas = rutas.value.length
  const rutasActivas = rutas.value.filter((r) => r.estado === 'Activa').length
  const subAdminsActivos = rutas.value.filter(
    (r) => !!(r.subAdminEmail || r.subAdminId)
  ).length
  const ordenesAsignadas = orders.value.filter(
    (o) => !!(o.rutaId || o.rutaNombre)
  ).length
  const facturacionRutas = orders.value
    .filter((o) => !!(o.rutaId || o.rutaNombre))
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0)

  return {
    totalRutas,
    rutasActivas,
    subAdminsActivos,
    ordenesAsignadas,
    facturacionRutas,
  }
})

// Sugerir correo y contraseña automáticamente al escribir el nombre de la ruta
function normalizarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

function autocompletarDatosSubAdmin() {
  const baseNombre = form.nombre.trim() || 'Ruta'
  const slug = normalizarSlug(baseNombre) || 'ruta'
  if (!form.subAdminNombre.trim()) {
    form.subAdminNombre = `Encargado ${baseNombre}`
  }
  form.subAdminEmail = `admin.${slug}@jrblanco.com`
  const cap =
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/\./g, '')
  let generatedPwd = `${cap.slice(0, 10)}2026*`
  if (generatedPwd.length < 8) {
    generatedPwd = `Ruta${cap}2026*`
  }
  form.subAdminPassword = generatedPwd
}

function abrirModalCrear() {
  modoEdicion.value = false
  rutaEditandoId.value = null
  errorFormulario.value = ''
  form.codigo = rutasService.getNextRutaCode()
  form.nombre = ''
  form.zona = ''
  form.descripcion = ''
  form.modoSubAdmin = 'nuevo'
  form.subAdminNombre = ''
  form.subAdminEmail = ''
  form.subAdminPassword = `Ruta${Math.floor(1000 + Math.random() * 9000)}*`
  form.existingUserId = ''
  mostrarPasswordForm.value = true
  modalAbierto.value = true
  void nextTick(() => {
    inputNombreRuta.value?.focus()
  })
}

function abrirModalEditar(ruta: RutaSucursal) {
  modoEdicion.value = true
  rutaEditandoId.value = ruta.id
  errorFormulario.value = ''
  form.codigo = ruta.codigo
  form.nombre = ruta.nombre
  form.zona = ruta.zona || ''
  form.descripcion = ruta.descripcion || ''
  form.modoSubAdmin = ruta.subAdminId ? 'existente' : 'sin_asignar'
  form.existingUserId = ruta.subAdminId || ''
  form.subAdminNombre = ruta.subAdminNombre || ''
  form.subAdminEmail = ruta.subAdminEmail || ''
  form.subAdminPassword = ''
  modalAbierto.value = true
  void nextTick(() => {
    inputNombreRuta.value?.focus()
  })
}

function cerrarModal() {
  if (guardando.value) return
  modalAbierto.value = false
  errorFormulario.value = ''
}

async function guardarRuta() {
  if (guardando.value) return
  errorFormulario.value = ''

  if (!form.nombre.trim()) {
    errorFormulario.value = 'Escribe el nombre de la ruta o sucursal.'
    inputNombreRuta.value?.focus()
    return
  }

  if (rutaNombreDuplicado.value) {
    errorFormulario.value = `Ya existe una ruta registrada con ese nombre: "${rutaNombreDuplicado.value.nombre}" (${rutaNombreDuplicado.value.codigo}). Usa otro nombre.`
    inputNombreRuta.value?.focus()
    return
  }

  if (!form.codigo.trim()) {
    errorFormulario.value = 'Escribe el código de la ruta (ej. RUT-01).'
    return
  }

  if (rutaCodigoDuplicado.value) {
    errorFormulario.value = `El código "${form.codigo.trim().toUpperCase()}" ya pertenece a la ruta "${rutaCodigoDuplicado.value.nombre}".`
    return
  }

  if (emailDuplicadoSubAdmin.value) {
    errorFormulario.value = `El correo "${form.subAdminEmail.trim().toLowerCase()}" ya está registrado (${emailDuplicadoSubAdmin.value}). Usa otro correo o elige "Ya existe".`
    return
  }

  if (form.modoSubAdmin === 'existente' && !form.existingUserId) {
    errorFormulario.value =
      'Selecciona un usuario de la lista o elige "Crear usuario" / "Más tarde".'
    return
  }

  guardando.value = true
  try {
    if (!modoEdicion.value) {
      // Crear nueva ruta + Sub-Administrador automático
      if (form.modoSubAdmin === 'nuevo') {
        if (!form.subAdminNombre.trim()) {
          form.subAdminNombre = `Admin ${form.nombre.trim()}`
        }
        if (!form.subAdminEmail.trim()) {
          errorFormulario.value =
            'Escribe o genera el correo electrónico del Sub-Administrador.'
          guardando.value = false
          return
        }
        if (form.subAdminPassword.length < 8) {
          errorFormulario.value =
            'La contraseña del Sub-Administrador debe tener al menos 8 caracteres.'
          guardando.value = false
          return
        }
      }

      const resultado = await rutasService.createRutaWithSubAdmin({
        codigo: form.codigo,
        nombre: form.nombre,
        zona: form.zona,
        descripcion: form.descripcion,
        modoSubAdmin: form.modoSubAdmin,
        subAdminNombre: form.subAdminNombre,
        subAdminEmail: form.subAdminEmail,
        subAdminPassword: form.subAdminPassword,
        existingUserId: form.existingUserId || undefined,
      })

      bannerExito.value = `Ruta "${resultado.ruta.nombre}" (${resultado.ruta.codigo}) creada correctamente.`

      if (resultado.credenciales) {
        credencialesRecienCreadas.value = {
          rutaNombre: resultado.ruta.nombre,
          rutaCodigo: resultado.ruta.codigo,
          nombre: resultado.credenciales.nombre,
          email: resultado.credenciales.email,
          password: resultado.credenciales.password,
        }
      }
    } else if (rutaEditandoId.value) {
      // Si en edición eligieron crear un nuevo Sub-Admin para esta ruta
      if (form.modoSubAdmin === 'nuevo') {
        if (!form.subAdminEmail.trim() || form.subAdminPassword.length < 8) {
          errorFormulario.value =
            'Para crear un nuevo Sub-Administrador completa su correo y contraseña (mínimo 8 caracteres).'
          guardando.value = false
          return
        }
        // Actualizar datos base y luego vincular nuevo usuario
        const tempRuta = await rutasService.updateRuta(rutaEditandoId.value, {
          codigo: form.codigo,
          nombre: form.nombre,
          zona: form.zona,
          descripcion: form.descripcion,
          estado: 'Activa',
        })

        // Crear usuario con el rol codificado de esta ruta
        const { encodeSubAdminRole } = await import('@/services/rutasService')
        const { crearUsuario } = await import('@/services/usuariosService')
        const baseRoleStr = encodeSubAdminRole(tempRuta)
        const roleStr =
          authStore.user?.isIndependent && authStore.activeTenantId
            ? encodeTenantMemberRole(
                baseRoleStr,
                authStore.activeTenantId,
                authStore.activeTenantWorkshopName || undefined
              )
            : baseRoleStr
        const subNombre = form.subAdminNombre.trim() || `Admin ${tempRuta.nombre}`
        const subEmail = form.subAdminEmail.trim().toLowerCase()
        const creado = await crearUsuario({
          nombre: subNombre,
          email: subEmail,
          password: form.subAdminPassword,
          rol: roleStr,
        })
        await rutasService.updateRuta(rutaEditandoId.value, {
          assignSubAdmin: {
            id: creado.id,
            nombre: subNombre,
            email: subEmail,
          },
        })
        await cargarTodo()
        credencialesRecienCreadas.value = {
          rutaNombre: tempRuta.nombre,
          rutaCodigo: tempRuta.codigo,
          nombre: subNombre,
          email: subEmail,
          password: form.subAdminPassword,
        }
      } else {
        await rutasService.updateRuta(rutaEditandoId.value, {
          codigo: form.codigo,
          nombre: form.nombre,
          zona: form.zona,
          descripcion: form.descripcion,
          estado: 'Activa',
          assignUserId:
            form.modoSubAdmin === 'existente'
              ? form.existingUserId || null
              : null,
        })
      }

      bannerExito.value = `Ruta "${form.nombre.trim()}" actualizada correctamente.`
    }

    guardando.value = false
    cerrarModal()
    await cargarTodo()
  } catch (err: unknown) {
    errorFormulario.value =
      err instanceof Error
        ? err.message
        : 'No se pudo guardar la ruta. Verifica los datos.'
  } finally {
    guardando.value = false
  }
}

function obtenerPasswordSubAdmin(ruta: RutaSucursal): string {
  if (!ruta.subAdminEmail && !ruta.subAdminId) return 'Sin asignar'
  return obtenerCredencialUsuario({
    id: ruta.subAdminId,
    email: ruta.subAdminEmail,
  })
}

async function copiarCredencialesRuta(ruta: RutaSucursal) {
  const pwd = obtenerPasswordSubAdmin(ruta)
  const texto = `Ruta: ${ruta.codigo} - ${ruta.nombre}\nRol: Sub-Administrador de Ruta\nUsuario: ${ruta.subAdminEmail || ''}\nContraseña: ${pwd}`
  try {
    await navigator.clipboard.writeText(texto)
    copiadoId.value = ruta.id
    setTimeout(() => {
      if (copiadoId.value === ruta.id) copiadoId.value = null
    }, 2000)
  } catch {
    // Ignore clipboard error
  }
}

async function copiarCredencialesBanner() {
  if (!credencialesRecienCreadas.value) return
  const c = credencialesRecienCreadas.value
  const texto = `Ruta: ${c.rutaCodigo} - ${c.rutaNombre}\nEncargado: ${c.nombre}\nCorreo: ${c.email}\nContraseña: ${c.password}`
  try {
    await navigator.clipboard.writeText(texto)
    copiadoId.value = 'banner'
    setTimeout(() => {
      if (copiadoId.value === 'banner') copiadoId.value = null
    }, 2000)
  } catch {
    // Ignore
  }
}

function generarPasswordRutaModal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digitos = '23456789'
  const pick = (pool: string, len: number) =>
    Array.from({ length: len }, () => pool[Math.floor(Math.random() * pool.length)]).join('')
  passwordEditableModal.value = `${pick(letras, 4)}-${pick(digitos, 4)}`
  esAdminPasswordVisible.value = true
}

async function copiarTextoModal(texto: string, clave: string) {
  try {
    await navigator.clipboard.writeText(texto)
    copiadoId.value = clave
    setTimeout(() => {
      if (copiadoId.value === clave) copiadoId.value = null
    }, 1800)
  } catch {
    // Ignore clipboard error
  }
}

function abrirModalCredencialSubAdmin(ruta: RutaSucursal) {
  rutaCredencialModal.value = ruta
  const pwd = obtenerPasswordSubAdmin(ruta)
  passwordEditableModal.value = pwd === 'Sin asignar' ? '' : pwd
  mostrarPasswordCredModal.value = false
  esAdminPasswordVisible.value = true
  mensajeCredencialModal.value = ''
  tipoMensajeCredencialModal.value = 'ok'
}

async function guardarCredencialSubAdminModal() {
  if (!rutaCredencialModal.value || guardandoCredencialModal.value) return
  const limpia = passwordEditableModal.value.trim()
  if (!limpia) {
    tipoMensajeCredencialModal.value = 'error'
    mensajeCredencialModal.value =
      'Escribe una contraseña válida para este Sub-Administrador.'
    return
  }
  if (limpia.length < 6) {
    tipoMensajeCredencialModal.value = 'error'
    mensajeCredencialModal.value =
      'La contraseña debe tener al menos 6 caracteres.'
    return
  }

  guardandoCredencialModal.value = true
  mensajeCredencialModal.value = ''
  try {
    const res = await cambiarPasswordUsuario({
      id: rutaCredencialModal.value.subAdminId,
      email: rutaCredencialModal.value.subAdminEmail,
      password: limpia,
    })
    mostrarPasswordCredModal.value = true
    tipoMensajeCredencialModal.value = res.updatedInAuth ? 'ok' : 'error'
    mensajeCredencialModal.value = res.updatedInAuth
      ? 'Contraseña actualizada en Supabase Auth y guardada en la bóveda.'
      : 'Solo se guardó en la bóveda local de este navegador, NO se pudo actualizar en Supabase Auth (la Edge Function no está disponible o no coincide la contraseña previa).'
  } catch (err: unknown) {
    tipoMensajeCredencialModal.value = 'error'
    mensajeCredencialModal.value =
      err instanceof Error
        ? err.message
        : 'No se pudo actualizar la contraseña.'
  } finally {
    guardandoCredencialModal.value = false
  }
}

async function confirmarEliminarRuta() {
  if (!rutaAEliminar.value || eliminando.value) return
  eliminando.value = true
  try {
    const nombre = rutaAEliminar.value.nombre
    await rutasService.deleteRuta(rutaAEliminar.value.id)
    rutaAEliminar.value = null
    bannerExito.value = `La ruta "${nombre}" fue eliminada.`
    await cargarTodo()
  } finally {
    eliminando.value = false
  }
}

function irAOrdenesDeRuta(ruta: RutaSucursal) {
  router.push({
    path: '/ordenes',
    query: { ruta: ruta.id },
  })
}

function crearOrdenEnRuta(ruta: RutaSucursal) {
  router.push({
    path: '/ordenes',
    query: { ruta: ruta.id, nueva: '1' },
  })
}

function formatMoney(amount: number): string {
  return `$${(Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
</script>

<template>
  <section class="text-[#0D1B3E]">
    <div class="space-y-6 pb-12">
      <!-- Encabezado Principal -->
      <header class="space-y-5">
        <div class="studio-hero-banner p-6 sm:p-7 text-white relative overflow-hidden">
          <div class="pointer-events-none absolute -top-16 -right-12 w-60 h-60 rounded-full bg-[#04C4D9]/25 blur-3xl"></div>
          <div class="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="space-y-1.5">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
                <MapPin class="w-3.5 h-3.5 text-[#BFEBF2]" />
                <span class="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#BFEBF2]">
                  RUTAS · SUCURSALES Y SUB-ADMINISTRADORES
                </span>
              </div>
              <h1 class="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Rutas de Trabajo y Sub-Administradores
              </h1>
              <p class="text-xs sm:text-sm text-blue-100/90 max-w-3xl">
                Crea rutas o sucursales y genera automáticamente la cuenta de su
                <strong class="text-white">Sub-Administrador de Ruta</strong>. Cada Sub-Administrador opera su propia ruta, mientras el Administrador General supervisa todas.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                @click="cargarTodo"
                class="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/15 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/25 active:scale-[0.97] transition cursor-pointer"
              >
                <RefreshCw class="w-3.5 h-3.5 text-[#BFEBF2]" :class="{ 'animate-spin': loading }" />
                <span>Actualizar</span>
              </button>

              <button
                type="button"
                @click="router.push('/ordenes')"
                class="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/15 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/25 active:scale-[0.97] transition cursor-pointer"
              >
                <ShoppingCart class="w-3.5 h-3.5 text-[#BFEBF2]" />
                <span>Ver todas las Órdenes</span>
              </button>

              <button
                type="button"
                @click="abrirModalCrear"
                class="studio-cta-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold cursor-pointer"
              >
                <Plus class="w-4 h-4 stroke-[2.5]" />
                <span>Nueva Ruta + Sub-Admin</span>
              </button>
            </div>
          </div>
        </div>

        <!-- KPIs Resumen Studio -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div class="studio-kpi-card workshop-stagger-1 p-5 flex flex-col justify-between">
            <div class="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#004B97]/12"></div>
            <div class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Rutas Activas
            </div>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#0D1B3E]">{{ kpisGlobales.rutasActivas }}</span>
              <span class="font-mono text-[11px] font-semibold text-[#004B97]">de {{ kpisGlobales.totalRutas }} reg.</span>
            </div>
          </div>

          <div class="studio-kpi-card workshop-stagger-2 p-5 flex flex-col justify-between">
            <div class="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#04C4D9]/15"></div>
            <div class="font-mono text-[10px] font-bold uppercase tracking-wider text-[#004B97]">
              Sub-Administradores
            </div>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#004B97]">{{ kpisGlobales.subAdminsActivos }}</span>
              <span class="font-mono text-[11px] font-semibold text-slate-500">encargados activos</span>
            </div>
          </div>

          <div class="studio-kpi-card workshop-stagger-3 p-5 flex flex-col justify-between">
            <div class="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#04C4D9]/12"></div>
            <div class="font-mono text-[10px] font-bold uppercase tracking-wider text-[#038391]">
              Órdenes en Rutas
            </div>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#038391]">{{ kpisGlobales.ordenesAsignadas }}</span>
              <span class="font-mono text-[11px] font-semibold text-slate-500">de {{ orders.length }} totales</span>
            </div>
          </div>

          <div class="studio-kpi-card workshop-stagger-4 p-5 flex flex-col justify-between">
            <div class="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#F6F0E4]"></div>
            <div class="font-mono text-[10px] font-bold uppercase tracking-wider text-[#6E5835]">
              Facturación en Rutas
            </div>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="font-display tabular-nums text-2xl sm:text-3xl font-extrabold text-[#0D1B3E]">{{ formatMoney(kpisGlobales.facturacionRutas) }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Banner de Credenciales Recién Creadas -->
      <div
        v-if="credencialesRecienCreadas"
        class="studio-hero-banner text-white p-5"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div class="space-y-1">
            <div class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#BFEBF2]">
              <CheckCircle2 class="w-4 h-4 text-[#BFEBF2]" />
              <span>¡Ruta y Cuenta de Sub-Administrador creadas con éxito!</span>
            </div>
            <h3 class="text-lg font-extrabold font-display text-white">
              {{ credencialesRecienCreadas.rutaCodigo }} · {{ credencialesRecienCreadas.rutaNombre }}
            </h3>
            <p class="text-xs text-sky-100/85">
              Comparte estas credenciales con <strong class="text-white">{{ credencialesRecienCreadas.nombre }}</strong>. Al iniciar sesión solo verá y administrará las órdenes de trabajo de esta ruta:
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div class="rounded-xl bg-white/10 border border-white/20 px-3.5 py-2 text-xs backdrop-blur-sm">
              <div class="text-sky-100/75 font-semibold">Usuario / Correo</div>
              <div class="font-mono font-bold text-[#BFEBF2] mt-0.5 select-all">{{ credencialesRecienCreadas.email }}</div>
            </div>
            <div class="rounded-xl bg-white/10 border border-white/20 px-3.5 py-2 text-xs backdrop-blur-sm">
              <div class="text-sky-100/75 font-semibold">Contraseña</div>
              <div class="font-mono font-bold text-[#BFEBF2] mt-0.5 select-all">{{ credencialesRecienCreadas.password }}</div>
            </div>

            <button
              type="button"
              @click="copiarCredencialesBanner"
              class="inline-flex items-center gap-1.5 rounded-xl studio-cta-primary px-4 py-2.5 text-xs font-bold text-white transition cursor-pointer"
            >
              <Check v-if="copiadoId === 'banner'" class="w-4 h-4" />
              <Copy v-else class="w-4 h-4" />
              <span>{{ copiadoId === 'banner' ? '¡Copiado!' : 'Copiar accesos' }}</span>
            </button>

            <button
              type="button"
              @click="credencialesRecienCreadas = null"
              class="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition cursor-pointer"
              title="Cerrar aviso"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Notificación de éxito simple -->
      <div
        v-if="bannerExito && !credencialesRecienCreadas"
        class="rounded-2xl bg-sky-50 border border-[#04C4D9]/45 px-4 py-3 flex items-center justify-between text-sm font-semibold text-[#0D1B3E] shadow-xs"
      >
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-[#004B97]" />
          <span>{{ bannerExito }}</span>
        </div>
        <button type="button" @click="bannerExito = ''" class="text-xs font-bold text-slate-500 hover:text-[#0D1B3E] cursor-pointer">✕</button>
      </div>

      <!-- Barra de búsqueda -->
      <div class="studio-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Buscar ruta por código, nombre, zona o encargado..."
            class="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2 text-sm text-[#0D1B3E] placeholder:text-slate-400 focus:bg-white focus:border-[#04C4D9] focus:outline-none focus:ring-2 focus:ring-[#04C4D9]/25 transition"
          />
        </div>
        <div class="text-xs font-semibold text-slate-500">
          Mostrando {{ rutasFiltradas.length }} de {{ rutas.length }} rutas configuradas
        </div>
      </div>

      <!-- Estado de Carga (Skeleton estable para evitar saltos de altura) -->
      <div
        v-if="loading && rutas.length === 0"
        class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        aria-hidden="true"
      >
        <div
          v-for="n in 3"
          :key="n"
          class="studio-card overflow-hidden animate-pulse"
        >
          <div class="h-1.5 w-full bg-gradient-to-r from-[#0D1B3E]/40 via-[#004B97]/40 to-[#04C4D9]/40"></div>
          <div class="p-5 space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-2 flex-1">
                <div class="h-4 w-28 rounded-full bg-slate-200/80"></div>
                <div class="h-5 w-44 rounded-lg bg-slate-200/90"></div>
                <div class="h-3.5 w-32 rounded bg-slate-100"></div>
              </div>
              <div class="h-7 w-16 rounded-lg bg-slate-100"></div>
            </div>
            <div class="h-16 rounded-xl bg-slate-100/90"></div>
            <div class="grid grid-cols-3 gap-2">
              <div class="h-14 rounded-xl bg-slate-100"></div>
              <div class="h-14 rounded-xl bg-slate-100"></div>
              <div class="h-14 rounded-xl bg-slate-200/70"></div>
            </div>
          </div>
          <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
            <div class="h-8 w-28 rounded-xl bg-slate-200/70"></div>
            <div class="h-8 w-36 rounded-xl bg-slate-200/80"></div>
          </div>
        </div>
      </div>

      <!-- Estado Vacío -->
      <div
        v-else-if="rutasFiltradas.length === 0"
        class="studio-card rounded-2xl border border-dashed border-[#004B97]/25 p-12 text-center space-y-4"
      >
        <div class="mx-auto w-14 h-14 rounded-2xl bg-[#04C4D9]/15 border border-[#04C4D9]/40 flex items-center justify-center text-[#004B97]">
          <MapPin class="w-7 h-7 text-[#004B97]" />
        </div>
        <div class="space-y-1 max-w-md mx-auto">
          <h2 class="text-lg font-extrabold font-display text-[#0D1B3E]">
            {{ searchQuery ? 'No se encontraron rutas con ese filtro' : 'Aún no has creado ninguna Ruta o Sucursal' }}
          </h2>
          <p class="text-xs text-slate-600">
            Crea tu primera ruta (ej. <strong>Ruta Norte</strong>, <strong>Ruta Oriente</strong>, <strong>Sucursal Central</strong>) y el sistema creará automáticamente el usuario y rol de <strong>Sub-Administrador</strong> exclusivo para esa ruta.
          </p>
        </div>
        <div>
          <button
            type="button"
            @click="abrirModalCrear"
            class="inline-flex items-center gap-2 rounded-xl studio-cta-primary px-5 py-2.5 text-xs font-bold text-white transition cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>Crear Primera Ruta + Sub-Administrador</span>
          </button>
        </div>
      </div>

      <!-- Grid de Tarjetas de Rutas -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <article
          v-for="ruta in rutasFiltradas"
          :key="ruta.id"
          class="studio-card flex flex-col justify-between overflow-hidden"
        >
          <!-- Franja Superior de Identidad -->
          <div class="h-1.5 w-full bg-gradient-to-r from-[#0D1B3E] via-[#004B97] to-[#04C4D9]"></div>

          <div class="p-5 space-y-4 flex-1">
            <!-- Cabecera de la Ruta -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 rounded-lg bg-[#004B97] px-2.5 py-0.5 font-mono text-xs font-black text-white shadow-2xs">
                    {{ ruta.codigo }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border"
                    :class="
                      ruta.estado === 'Activa'
                        ? 'bg-cyan-50 text-[#038391] border-cyan-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    "
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      :class="ruta.estado === 'Activa' ? 'bg-[#04C4D9]' : 'bg-slate-400'"
                    ></span>
                    {{ ruta.estado }}
                  </span>
                </div>
                <h3 class="mt-2 text-lg font-black font-display text-[#0D1B3E] leading-snug">
                  {{ ruta.nombre }}
                </h3>
                <p v-if="ruta.zona" class="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                  <Building2 class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                  <span>{{ ruta.zona }}</span>
                </p>
              </div>

              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="abrirModalEditar(ruta)"
                  class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-[#004B97] hover:bg-sky-50 hover:border-[#04C4D9] transition cursor-pointer"
                  title="Editar ruta o reasignar Sub-Administrador"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  @click="rutaAEliminar = ruta"
                  class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition cursor-pointer"
                  title="Eliminar ruta"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Bloque del Sub-Administrador de la Ruta -->
            <div class="rounded-xl bg-sky-50/55 border border-[#004B97]/12 p-3.5 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck class="w-3.5 h-3.5 text-[#004B97]" />
                  <span>Sub-Administrador de Ruta</span>
                </span>
                <span class="inline-flex items-center rounded-full bg-[#04C4D9]/15 border border-[#04C4D9]/40 px-2 py-0.5 text-[10px] font-bold text-[#004B97]">
                  Solo ve {{ ruta.codigo }}
                </span>
              </div>

              <div v-if="ruta.subAdminEmail || ruta.subAdminNombre" class="space-y-2">
                <div>
                  <div class="text-sm font-bold text-[#0D1B3E]">
                    {{ ruta.subAdminNombre || 'Administrador de Ruta' }}
                  </div>
                  <div class="text-xs font-mono text-slate-600 select-all">
                    {{ ruta.subAdminEmail }}
                  </div>
                </div>

                <!-- Contraseña visible / copiable para el Admin -->
                <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <KeyRound class="w-3.5 h-3.5 text-[#004B97] shrink-0" />
                    <span class="text-xs font-mono font-bold text-[#0D1B3E] truncate select-all">
                      {{
                        passwordVisibleMap[ruta.id]
                          ? obtenerPasswordSubAdmin(ruta)
                          : '••••••••••'
                      }}
                    </span>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      @click="passwordVisibleMap[ruta.id] = !passwordVisibleMap[ruta.id]"
                      class="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-[#04C4D9] hover:text-[#004B97] transition cursor-pointer"
                      :title="passwordVisibleMap[ruta.id] ? 'Ocultar contraseña' : 'Ver contraseña'"
                    >
                      <EyeOff v-if="passwordVisibleMap[ruta.id]" class="w-3.5 h-3.5" />
                      <Eye v-else class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      @click="copiarCredencialesRuta(ruta)"
                      class="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-[#04C4D9] hover:text-[#004B97] transition cursor-pointer"
                      title="Copiar usuario y contraseña de este Sub-Admin"
                    >
                      <Check v-if="copiadoId === ruta.id" class="w-3.5 h-3.5 text-[#038391]" />
                      <Copy v-else class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      @click="abrirModalCredencialSubAdmin(ruta)"
                      class="px-2.5 py-1 rounded-lg bg-[#004B97] text-white text-[10px] font-bold hover:bg-[#0D1B3E] transition cursor-pointer"
                      title="Editar contraseña registrada"
                    >
                      Clave
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="flex items-center justify-between py-1">
                <span class="text-xs text-slate-500 italic">Sin Sub-Administrador asignado</span>
                <button
                  type="button"
                  @click="abrirModalEditar(ruta)"
                  class="text-xs font-bold text-[#004B97] underline hover:text-[#04C4D9] cursor-pointer"
                >
                  Asignar ahora
                </button>
              </div>
            </div>

            <!-- Métricas de Órdenes de esta Ruta -->
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
                <div class="text-[10px] font-bold uppercase text-slate-500">Órdenes</div>
                <div class="text-base font-black text-[#0D1B3E] mt-0.5 tabular-nums">
                  {{ metricasDeRuta(ruta).totalOrdenes }}
                </div>
              </div>
              <div class="rounded-xl bg-sky-50/70 border border-[#04C4D9]/30 p-2.5">
                <div class="text-[10px] font-bold uppercase text-slate-500">En Proceso</div>
                <div class="text-base font-black text-[#004B97] mt-0.5 tabular-nums">
                  {{ metricasDeRuta(ruta).enProceso }}
                </div>
              </div>
              <div class="rounded-xl bg-gradient-to-br from-[#0D1B3E] to-[#004B97] text-white p-2.5 shadow-xs">
                <div class="text-[10px] font-bold uppercase text-[#BFEBF2]">Total Ruta</div>
                <div class="text-xs sm:text-sm font-black text-white mt-1 truncate tabular-nums">
                  {{ formatMoney(metricasDeRuta(ruta).facturacion) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Acciones Inferiores de la Tarjeta -->
          <div class="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              @click="crearOrdenEnRuta(ruta)"
              class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0D1B3E] hover:border-[#04C4D9] hover:bg-sky-50 transition cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5 text-[#004B97]" />
              <span>Nueva Orden</span>
            </button>

            <button
              type="button"
              @click="irAOrdenesDeRuta(ruta)"
              class="inline-flex items-center gap-1.5 rounded-xl bg-[#1E446E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#19314D] transition cursor-pointer"
            >
              <span>Filtrar órdenes ({{ metricasDeRuta(ruta).totalOrdenes }})</span>
              <ArrowRight class="w-3.5 h-3.5 text-[#BFEBF2]" />
            </button>
          </div>
        </article>
      </div>
    </div>

    <!-- MODAL: CREAR / EDITAR RUTA + SUB-ADMINISTRADOR -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modalAbierto"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[#09132B]/65 backdrop-blur-sm p-4 overflow-y-auto"
        @click.self="cerrarModal"
      >
        <div class="studio-card w-full max-w-[540px] rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-6 popover-pop-in">
          <form @submit.prevent="guardarRuta">
            <!-- Cabecera limpia y directa -->
            <div class="px-6 py-5 bg-gradient-to-r from-[#0D1B3E] to-[#004B97] text-white flex items-start justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin class="w-5 h-5 text-[#BFEBF2]" />
                </div>
                <div>
                  <h2 class="text-lg font-extrabold font-display tracking-tight text-white">
                    {{ modoEdicion ? 'Editar ruta' : 'Nueva ruta' }}
                  </h2>
                  <p class="text-xs text-sky-100/80 mt-0.5">
                    {{
                      modoEdicion
                        ? 'Actualiza los datos de la sucursal y su encargado.'
                        : 'Se crea activa de inmediato y lista para asignar órdenes.'
                    }}
                  </p>
                </div>
              </div>
              <button
                type="button"
                @click="cerrarModal"
                class="p-1.5 rounded-xl text-white/75 hover:text-white hover:bg-white/15 transition cursor-pointer"
                aria-label="Cerrar"
              >
                <X class="w-4.5 h-4.5" />
              </button>
            </div>

            <!-- Cuerpo del formulario -->
            <div class="p-6 space-y-5">
              <!-- Alerta de validación -->
              <div
                v-if="errorFormulario"
                class="rounded-xl bg-rose-50 text-rose-800 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2"
              >
                <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
                <span>{{ errorFormulario }}</span>
              </div>

              <!-- 1. Datos de la Ruta -->
              <div class="space-y-3.5">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    1. Datos de la ruta
                  </span>
                  <span class="text-[11px] font-semibold text-[#004B97]">
                    Activa por defecto
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div class="sm:col-span-8">
                    <label class="block text-xs font-bold text-[#0D1B3E] mb-1.5">
                      Nombre de la ruta o sucursal *
                    </label>
                    <input
                      ref="inputNombreRuta"
                      v-model="form.nombre"
                      type="text"
                      required
                      placeholder="Ej. Ruta Norte / Sucursal Centro"
                      @blur="!modoEdicion && form.modoSubAdmin === 'nuevo' && !form.subAdminEmail && !rutaNombreDuplicado ? autocompletarDatosSubAdmin() : null"
                      :aria-invalid="Boolean(rutaNombreDuplicado)"
                      :class="[
                        'w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium text-[#0D1B3E] placeholder:text-slate-400 focus:outline-none focus:ring-2 transition',
                        rutaNombreDuplicado
                          ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-300 bg-white focus:border-[#04C4D9] focus:ring-[#04C4D9]/25',
                      ]"
                    />
                    <p
                      v-if="rutaNombreDuplicado"
                      class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700"
                    >
                      Ya existe "{{ rutaNombreDuplicado.nombre }}" ({{ rutaNombreDuplicado.codigo }}). Elige otro nombre.
                    </p>
                  </div>

                  <div class="sm:col-span-4">
                    <label class="block text-xs font-bold text-[#0D1B3E] mb-1.5">
                      Código
                    </label>
                    <input
                      v-model="form.codigo"
                      type="text"
                      required
                      placeholder="RUT-01"
                      :aria-invalid="Boolean(rutaCodigoDuplicado)"
                      :class="[
                        'w-full rounded-xl border px-3 py-2.5 text-sm font-mono font-bold uppercase text-[#0D1B3E] focus:outline-none focus:ring-2 transition',
                        rutaCodigoDuplicado
                          ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-[#04C4D9] focus:ring-[#04C4D9]/25',
                      ]"
                    />
                    <p
                      v-if="rutaCodigoDuplicado"
                      class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700"
                    >
                      Código en uso por "{{ rutaCodigoDuplicado.nombre }}".
                    </p>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-[#0D1B3E] mb-1.5">
                    Zona o cobertura <span class="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <input
                    v-model="form.zona"
                    type="text"
                    placeholder="Ej. Zona Oriental, talleres afiliados"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0D1B3E] placeholder:text-slate-400 focus:border-[#04C4D9] focus:outline-none focus:ring-2 focus:ring-[#04C4D9]/25 transition"
                  />
                </div>
              </div>

              <div class="border-t border-slate-100"></div>

              <!-- 2. Encargado / Sub-Administrador -->
              <div class="space-y-3.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    2. Encargado de ruta (Sub-Admin)
                  </span>

                  <button
                    v-if="form.modoSubAdmin === 'nuevo'"
                    type="button"
                    @click="autocompletarDatosSubAdmin"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-[#04C4D9]/45 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-[#004B97] hover:bg-[#04C4D9]/15 transition cursor-pointer"
                    title="Genera nombre, correo y contraseña desde el nombre de la ruta"
                  >
                    <Sparkles class="w-3 h-3 text-[#04C4D9]" />
                    <span>Autocompletar accesos</span>
                  </button>
                </div>

                <!-- Control segmentado limpio -->
                <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    @click="form.modoSubAdmin = 'nuevo'"
                    class="rounded-lg px-3 py-2 text-xs transition cursor-pointer text-center"
                    :class="
                      form.modoSubAdmin === 'nuevo'
                        ? 'bg-[#004B97] text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-[#0D1B3E] font-semibold'
                    "
                  >
                    Crear usuario
                  </button>
                  <button
                    type="button"
                    @click="form.modoSubAdmin = 'existente'"
                    class="rounded-lg px-3 py-2 text-xs transition cursor-pointer text-center"
                    :class="
                      form.modoSubAdmin === 'existente'
                        ? 'bg-[#004B97] text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-[#0D1B3E] font-semibold'
                    "
                  >
                    Ya existe
                  </button>
                  <button
                    type="button"
                    @click="form.modoSubAdmin = 'sin_asignar'"
                    class="rounded-lg px-3 py-2 text-xs transition cursor-pointer text-center"
                    :class="
                      form.modoSubAdmin === 'sin_asignar'
                        ? 'bg-[#004B97] text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-[#0D1B3E] font-semibold'
                    "
                  >
                    Más tarde
                  </button>
                </div>

                <!-- Opción A: Crear usuario nuevo -->
                <div v-if="form.modoSubAdmin === 'nuevo'" class="space-y-3 pt-0.5">
                  <div>
                    <label class="block text-xs font-bold text-[#0D1B3E] mb-1.5">
                      Nombre del encargado
                    </label>
                    <input
                      v-model="form.subAdminNombre"
                      type="text"
                      placeholder="Ej. Carlos Méndez"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0D1B3E] placeholder:text-slate-400 focus:border-[#04C4D9] focus:outline-none focus:ring-2 focus:ring-[#04C4D9]/25 transition"
                    />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-[#0D1B3E] mb-1.5">
                        Correo de acceso *
                      </label>
                      <input
                        v-model="form.subAdminEmail"
                        type="email"
                        required
                        placeholder="admin.ruta@jrblanco.com"
                        :aria-invalid="Boolean(emailDuplicadoSubAdmin)"
                        :class="[
                          'w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono text-[#0D1B3E] placeholder:text-slate-400 focus:outline-none focus:ring-2 transition',
                          emailDuplicadoSubAdmin
                            ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-200'
                            : 'border-slate-300 bg-white focus:border-[#04C4D9] focus:ring-[#04C4D9]/25',
                        ]"
                      />
                      <p
                        v-if="emailDuplicadoSubAdmin"
                        class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700"
                      >
                        Correo ya registrado ({{ emailDuplicadoSubAdmin }}). Usa otro o elige "Ya existe".
                      </p>
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-[#0D1B3E] mb-1.5">
                        Contraseña *
                      </label>
                      <div class="relative">
                        <input
                          v-model="form.subAdminPassword"
                          :type="mostrarPasswordForm ? 'text' : 'password'"
                          required
                          minlength="8"
                          placeholder="Mín. 8 caracteres"
                          class="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm font-mono font-bold text-[#0D1B3E] placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-[#04C4D9] focus:outline-none focus:ring-2 focus:ring-[#04C4D9]/25 transition"
                        />
                        <button
                          type="button"
                          @click="mostrarPasswordForm = !mostrarPasswordForm"
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-[#0D1B3E] cursor-pointer"
                          :aria-label="mostrarPasswordForm ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                        >
                          <EyeOff v-if="mostrarPasswordForm" class="w-4 h-4" />
                          <Eye v-else class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <p class="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <ShieldCheck class="w-3.5 h-3.5 text-[#004B97] shrink-0" />
                    <span>Este usuario solo verá y gestionará las órdenes de <strong>{{ form.nombre || 'esta ruta' }}</strong>.</span>
                  </p>
                </div>

                <!-- Opción B: Asignar usuario existente -->
                <div v-else-if="form.modoSubAdmin === 'existente'" class="space-y-2 pt-0.5">
                  <label class="block text-xs font-bold text-[#0D1B3E]">
                    Selecciona un usuario registrado
                  </label>
                  <select
                    v-model="form.existingUserId"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-[#0D1B3E] focus:border-[#04C4D9] focus:outline-none focus:ring-2 focus:ring-[#04C4D9]/25 transition"
                  >
                    <option value="">-- Elegir usuario --</option>
                    <option
                      v-for="u in usuariosDisponiblesParaRuta"
                      :key="u.id"
                      :value="u.id"
                    >
                      {{ u.nombre }} — {{ u.email }}
                    </option>
                  </select>
                  <p v-if="usuariosDisponiblesParaRuta.length === 0" class="text-[11px] font-medium text-slate-500">
                    No hay usuarios disponibles para asignar. Usa la pestaña <strong>Crear usuario</strong>.
                  </p>
                  <p v-else class="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <ShieldCheck class="w-3.5 h-3.5 text-[#004B97] shrink-0" />
                    <span>Su perfil pasará a ser Sub-Administrador exclusivo de esta ruta.</span>
                  </p>
                </div>

                <!-- Opción C: Asignar más tarde -->
                <div
                  v-else
                  class="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs text-slate-600"
                >
                  La ruta se creará activa desde ya. Podrás crearle o asignarle un encargado cuando quieras editando esta tarjeta.
                </div>
              </div>
            </div>

            <!-- Pie con acciones -->
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                @click="cerrarModal"
                :disabled="guardando"
                class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="guardando"
                class="inline-flex items-center gap-2 rounded-xl studio-cta-primary px-5 py-2.5 text-xs font-bold text-white active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
              >
                <span>
                  {{
                    guardando
                      ? 'Guardando...'
                      : modoEdicion
                        ? 'Guardar cambios'
                        : 'Crear ruta'
                  }}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- MODAL MEJORADO: CREDENCIALES Y CONTRASEÑA DE SUB-ADMIN -->
    <div
      v-if="rutaCredencialModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[#09132B]/70 backdrop-blur-sm p-4"
      @click.self="rutaCredencialModal = null"
    >
      <div class="studio-card w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden popover-pop-in">
        <!-- Cabecera oscura -->
        <div class="relative bg-gradient-to-r from-[#0D1B3E] to-[#004B97] px-6 py-5 text-white">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-[#BFEBF2] font-black shadow-inner">
                <KeyRound class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <span class="inline-flex items-center rounded-full bg-white/10 border border-white/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#BFEBF2]">
                  {{ rutaCredencialModal.codigo }}
                </span>
                <h3 class="mt-1 truncate text-base font-black font-display text-white">
                  {{ rutaCredencialModal.nombre }}
                </h3>
                <p class="truncate text-xs text-sky-100/80">
                  Sub-Administrador: {{ rutaCredencialModal.subAdminNombre || 'Sin nombre' }}
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="rutaCredencialModal = null"
              class="rounded-xl p-2 text-white/75 transition hover:bg-white/15 hover:text-white cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="p-6 space-y-5">
          <!-- Ficha de acceso actual -->
          <div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Ficha de acceso de ruta
              </span>
              <button
                type="button"
                @click="copiarCredencialesRuta(rutaCredencialModal)"
                class="inline-flex items-center gap-1.5 rounded-full bg-[#1E446E] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#19314D] cursor-pointer"
              >
                <Check v-if="copiadoId === rutaCredencialModal.id" class="h-3.5 w-3.5 text-[#BFEBF2]" />
                <Copy v-else class="h-3.5 w-3.5 text-[#BFEBF2]" />
                <span>
                  {{
                    copiadoId === rutaCredencialModal.id
                      ? 'Ficha copiada'
                      : 'Copiar ficha de acceso'
                  }}
                </span>
              </button>
            </div>

            <div class="grid gap-2.5 sm:grid-cols-2">
              <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Correo de acceso
                </span>
                <div class="mt-1 flex items-center justify-between gap-1.5">
                  <span class="truncate font-mono text-xs font-bold text-[#0D1B3E]" :title="rutaCredencialModal.subAdminEmail">
                    {{ rutaCredencialModal.subAdminEmail || 'Sin correo' }}
                  </span>
                  <button
                    v-if="rutaCredencialModal.subAdminEmail"
                    type="button"
                    @click="copiarTextoModal(rutaCredencialModal.subAdminEmail, 'modal-ruta-email')"
                    class="shrink-0 rounded-lg bg-slate-100 p-1.5 text-[#0D1B3E] transition hover:bg-sky-100 hover:text-[#004B97] cursor-pointer"
                    title="Copiar correo"
                  >
                    <Check v-if="copiadoId === 'modal-ruta-email'" class="h-3.5 w-3.5 text-[#038391]" />
                    <Copy v-else class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Contraseña actual
                </span>
                <div class="mt-1 flex items-center justify-between gap-1.5">
                  <span class="truncate font-mono text-xs font-bold text-[#0D1B3E]">
                    {{
                      mostrarPasswordCredModal
                        ? obtenerPasswordSubAdmin(rutaCredencialModal) || 'Sin asignar'
                        : '••••••••••'
                    }}
                  </span>
                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      @click="mostrarPasswordCredModal = !mostrarPasswordCredModal"
                      class="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition hover:text-[#0D1B3E] cursor-pointer"
                      :title="mostrarPasswordCredModal ? 'Ocultar' : 'Mostrar'"
                    >
                      <EyeOff v-if="mostrarPasswordCredModal" class="h-3.5 w-3.5" />
                      <Eye v-else class="h-3.5 w-3.5" />
                    </button>
                    <button
                      v-if="obtenerPasswordSubAdmin(rutaCredencialModal) && obtenerPasswordSubAdmin(rutaCredencialModal) !== 'Sin asignar'"
                      type="button"
                      @click="copiarTextoModal(obtenerPasswordSubAdmin(rutaCredencialModal), 'modal-ruta-pwd')"
                      class="rounded-lg bg-slate-100 p-1.5 text-[#0D1B3E] transition hover:bg-sky-100 hover:text-[#004B97] cursor-pointer"
                      title="Copiar contraseña"
                    >
                      <Check v-if="copiadoId === 'modal-ruta-pwd'" class="h-3.5 w-3.5 text-[#038391]" />
                      <Copy v-else class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cambiar contraseña -->
          <form
            class="rounded-2xl border border-[#04C4D9]/35 bg-sky-50/55 p-4 space-y-3"
            @submit.prevent="guardarCredencialSubAdminModal"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <label for="input-ruta-cred-pwd" class="text-xs font-bold uppercase tracking-wider text-[#0D1B3E]">
                Cambiar contraseña del encargado
              </label>
              <button
                type="button"
                :disabled="guardandoCredencialModal"
                @click="generarPasswordRutaModal"
                class="inline-flex items-center gap-1 rounded-full border border-[#04C4D9]/50 bg-white px-2.5 py-1 text-[11px] font-bold text-[#004B97] transition hover:bg-sky-100 cursor-pointer disabled:opacity-50"
              >
                <Sparkles class="h-3 w-3 text-[#04C4D9]" />
                <span>Generar clave</span>
              </button>
            </div>

            <div class="relative">
              <input
                id="input-ruta-cred-pwd"
                v-model="passwordEditableModal"
                :type="esAdminPasswordVisible ? 'text' : 'password'"
                :disabled="guardandoCredencialModal"
                placeholder="Nueva contraseña (mínimo 6 caracteres)"
                class="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold text-[#0D1B3E] placeholder-slate-400 outline-none transition focus:border-[#04C4D9] focus:ring-2 focus:ring-[#04C4D9]/25"
              />
              <button
                type="button"
                @click="esAdminPasswordVisible = !esAdminPasswordVisible"
                class="absolute right-2.5 top-2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[#0D1B3E] cursor-pointer"
                :title="esAdminPasswordVisible ? 'Ocultar' : 'Mostrar'"
              >
                <EyeOff v-if="esAdminPasswordVisible" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </button>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <span class="text-[11px] font-medium text-slate-500">
                Mínimo 6 caracteres · Aplica de inmediato en login
              </span>
              <button
                type="submit"
                :disabled="guardandoCredencialModal || passwordEditableModal.trim().length < 6"
                class="inline-flex items-center gap-1.5 rounded-xl studio-cta-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-45 cursor-pointer"
              >
                <KeyRound class="h-3.5 w-3.5" />
                <span>{{ guardandoCredencialModal ? 'Actualizando…' : 'Actualizar contraseña' }}</span>
              </button>
            </div>
          </form>

          <div
            v-if="mensajeCredencialModal"
            class="rounded-xl border px-3 py-2.5 text-xs font-bold"
            :class="
              tipoMensajeCredencialModal === 'error'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-[#04C4D9] bg-sky-50 text-[#0D1B3E]'
            "
          >
            {{ mensajeCredencialModal }}
          </div>

          <div class="flex justify-end pt-1">
            <button
              type="button"
              :disabled="guardandoCredencialModal"
              @click="rutaCredencialModal = null"
              class="rounded-xl bg-[#004B97] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#0D1B3E] disabled:opacity-50 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: CONFIRMAR ELIMINACIÓN DE RUTA -->
    <div
      v-if="rutaAEliminar"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[#09132B]/70 backdrop-blur-sm p-4"
      @click.self="rutaAEliminar = null"
    >
      <div class="studio-card w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl popover-pop-in">
        <h3 class="text-lg font-black font-display text-[#0D1B3E]">
          ¿Eliminar la ruta "{{ rutaAEliminar.nombre }}"?
        </h3>
        <p class="text-xs text-slate-600">
          Las órdenes de trabajo existentes no se borrarán, pero esta ruta dejará de aparecer en el listado activo.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="rutaAEliminar = null"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            :disabled="eliminando"
            @click="confirmarEliminarRuta"
            class="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50"
          >
            {{ eliminando ? 'Eliminando...' : 'Sí, eliminar ruta' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
