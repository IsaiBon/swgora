<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  MapPin,
  Plus,
  Search,
  UserPlus,
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
  rutasService,
  type RutaSucursal,
} from '@/services/rutasService'
import { ordersService, type Order } from '@/services/ordersService'
import { perfilesService, type Perfil } from '@/services/perfilesService'
import {
  obtenerCredencialUsuario,
  registrarCredencialUsuario,
} from '@/services/usuariosService'

const router = useRouter()

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

const form = reactive({
  codigo: '',
  nombre: '',
  zona: '',
  descripcion: '',
  estado: 'Activa' as 'Activa' | 'Inactiva',
  modoSubAdmin: 'nuevo' as 'nuevo' | 'existente' | 'sin_asignar',
  subAdminNombre: '',
  subAdminEmail: '',
  subAdminPassword: '',
  existingUserId: '',
})

// Modal de confirmación de eliminación
const rutaAEliminar = ref<RutaSucursal | null>(null)
const eliminando = ref(false)

// Modal de credenciales de un Sub-Admin
const rutaCredencialModal = ref<RutaSucursal | null>(null)
const passwordEditableModal = ref('')
const mensajeCredencialModal = ref('')

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

onMounted(() => {
  void cargarTodo()
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
  form.subAdminPassword = `${cap.slice(0, 10)}2026*`
}

function abrirModalCrear() {
  modoEdicion.value = false
  rutaEditandoId.value = null
  errorFormulario.value = ''
  form.codigo = rutasService.getNextRutaCode()
  form.nombre = ''
  form.zona = ''
  form.descripcion = ''
  form.estado = 'Activa'
  form.modoSubAdmin = 'nuevo'
  form.subAdminNombre = ''
  form.subAdminEmail = ''
  form.subAdminPassword = `Ruta${Math.floor(100 + Math.random() * 900)}*`
  form.existingUserId = ''
  mostrarPasswordForm.value = true
  modalAbierto.value = true
}

function abrirModalEditar(ruta: RutaSucursal) {
  modoEdicion.value = true
  rutaEditandoId.value = ruta.id
  errorFormulario.value = ''
  form.codigo = ruta.codigo
  form.nombre = ruta.nombre
  form.zona = ruta.zona || ''
  form.descripcion = ruta.descripcion || ''
  form.estado = ruta.estado
  form.modoSubAdmin = ruta.subAdminId ? 'existente' : 'sin_asignar'
  form.existingUserId = ruta.subAdminId || ''
  form.subAdminNombre = ruta.subAdminNombre || ''
  form.subAdminEmail = ruta.subAdminEmail || ''
  form.subAdminPassword = ''
  modalAbierto.value = true
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
          estado: form.estado,
        })

        // Crear usuario con el rol codificado de esta ruta
        const { encodeSubAdminRole } = await import('@/services/rutasService')
        const { crearUsuario } = await import('@/services/usuariosService')
        const roleStr = encodeSubAdminRole(tempRuta)
        await crearUsuario({
          nombre: form.subAdminNombre.trim() || `Admin ${tempRuta.nombre}`,
          email: form.subAdminEmail.trim().toLowerCase(),
          password: form.subAdminPassword,
          rol: roleStr,
        })
        await cargarTodo()
        const nuevoPerfil = perfiles.value.find(
          (p) =>
            p.email?.trim().toLowerCase() ===
            form.subAdminEmail.trim().toLowerCase()
        )
        if (nuevoPerfil) {
          await rutasService.updateRuta(rutaEditandoId.value, {
            assignUserId: nuevoPerfil.id,
          })
        }
        credencialesRecienCreadas.value = {
          rutaNombre: tempRuta.nombre,
          rutaCodigo: tempRuta.codigo,
          nombre: form.subAdminNombre.trim() || `Admin ${tempRuta.nombre}`,
          email: form.subAdminEmail.trim().toLowerCase(),
          password: form.subAdminPassword,
        }
      } else {
        await rutasService.updateRuta(rutaEditandoId.value, {
          codigo: form.codigo,
          nombre: form.nombre,
          zona: form.zona,
          descripcion: form.descripcion,
          estado: form.estado,
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

function abrirModalCredencialSubAdmin(ruta: RutaSucursal) {
  rutaCredencialModal.value = ruta
  passwordEditableModal.value = obtenerPasswordSubAdmin(ruta)
  mensajeCredencialModal.value = ''
}

function guardarCredencialSubAdminModal() {
  if (!rutaCredencialModal.value || !passwordEditableModal.value.trim()) return
  registrarCredencialUsuario({
    id: rutaCredencialModal.value.subAdminId,
    email: rutaCredencialModal.value.subAdminEmail,
    password: passwordEditableModal.value.trim(),
  })
  mensajeCredencialModal.value =
    'Contraseña actualizada en el registro de credenciales del Administrador.'
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
  <section class="min-h-screen bg-[#F2F2F2] text-[#0D0D0D] px-4 py-6 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- Encabezado Principal -->
      <header class="rounded-2xl bg-white border border-[#0D0D0D]/10 p-5 sm:p-6 shadow-xs">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="space-y-1.5">
            <div class="inline-flex items-center gap-2 rounded-full bg-[#05C7F2]/15 border border-[#04C4D9]/40 px-3 py-1 text-xs font-bold text-[#0D0D0D]">
              <MapPin class="w-3.5 h-3.5 text-[#04C4D9]" />
              <span>Control de Rutas, Sucursales y Sub-Administradores</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-[#0D0D0D]">
              Rutas de Trabajo y Sub-Administradores
            </h1>
            <p class="text-sm text-[#0D0D0D]/70 max-w-3xl">
              Crea rutas o sucursales y genera automáticamente la cuenta de su
              <strong class="text-[#0D0D0D]">Sub-Administrador de Ruta</strong>. Cada Sub-Administrador solo puede ver y crear órdenes de su propia ruta, mientras que tú como Administrador General puedes ver y filtrar todas las rutas.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              @click="cargarTodo"
              class="inline-flex items-center gap-2 rounded-xl border border-[#0D0D0D]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#0D0D0D] hover:border-[#04C4D9] hover:bg-[#05C7F2]/10 transition cursor-pointer"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              @click="router.push('/ordenes')"
              class="inline-flex items-center gap-2 rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2] px-4 py-2.5 text-xs font-bold text-[#0D0D0D] hover:bg-[#05C7F2]/15 hover:border-[#04C4D9] transition cursor-pointer"
            >
              <ShoppingCart class="w-4 h-4 text-[#04C4D9]" />
              <span>Ver todas las Órdenes</span>
            </button>

            <button
              type="button"
              @click="abrirModalCrear"
              class="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#05F2F2] shadow-sm hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer"
            >
              <Plus class="w-4 h-4 stroke-[2.5]" />
              <span>Nueva Ruta + Sub-Admin</span>
            </button>
          </div>
        </div>

        <!-- KPIs Resumen -->
        <div class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-5 border-t border-[#0D0D0D]/10">
          <div class="rounded-xl bg-[#F2F2F2]/70 border border-[#0D0D0D]/10 p-4">
            <div class="text-[11px] font-bold uppercase tracking-wider text-[#0D0D0D]/60">
              Rutas Activas
            </div>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="text-2xl font-black text-[#0D0D0D]">{{ kpisGlobales.rutasActivas }}</span>
              <span class="text-xs font-semibold text-[#0D0D0D]/60">de {{ kpisGlobales.totalRutas }} registradas</span>
            </div>
          </div>

          <div class="rounded-xl bg-[#05C7F2]/10 border border-[#04C4D9]/30 p-4">
            <div class="text-[11px] font-bold uppercase tracking-wider text-[#0D0D0D]/70">
              Sub-Administradores
            </div>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="text-2xl font-black text-[#0D0D0D]">{{ kpisGlobales.subAdminsActivos }}</span>
              <span class="text-xs font-semibold text-[#0D0D0D]/70">encargados con acceso</span>
            </div>
          </div>

          <div class="rounded-xl bg-[#F2F2F2]/70 border border-[#0D0D0D]/10 p-4">
            <div class="text-[11px] font-bold uppercase tracking-wider text-[#0D0D0D]/60">
              Órdenes en Rutas
            </div>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="text-2xl font-black text-[#0D0D0D]">{{ kpisGlobales.ordenesAsignadas }}</span>
              <span class="text-xs font-semibold text-[#0D0D0D]/60">de {{ orders.length }} totales</span>
            </div>
          </div>

          <div class="rounded-xl bg-[#0D0D0D] text-white p-4">
            <div class="text-[11px] font-bold uppercase tracking-wider text-[#05F2F2]">
              Facturación en Rutas
            </div>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="text-2xl font-black text-white">{{ formatMoney(kpisGlobales.facturacionRutas) }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Banner de Credenciales Recién Creadas -->
      <div
        v-if="credencialesRecienCreadas"
        class="rounded-2xl bg-[#0D0D0D] text-white border-2 border-[#05C7F2] p-5 shadow-md"
      >
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#05F2F2]">
              <CheckCircle2 class="w-4 h-4 text-[#05F2F2]" />
              <span>¡Ruta y Cuenta de Sub-Administrador creadas con éxito!</span>
            </div>
            <h3 class="text-lg font-extrabold text-white">
              {{ credencialesRecienCreadas.rutaCodigo }} · {{ credencialesRecienCreadas.rutaNombre }}
            </h3>
            <p class="text-xs text-[#F2F2F2]/80">
              Comparte estas credenciales con <strong class="text-white">{{ credencialesRecienCreadas.nombre }}</strong>. Al iniciar sesión solo verá y administrará las órdenes de trabajo de esta ruta:
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div class="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs">
              <div class="text-[#F2F2F2]/60 font-semibold">Usuario / Correo</div>
              <div class="font-mono font-bold text-[#05F2F2] mt-0.5 select-all">{{ credencialesRecienCreadas.email }}</div>
            </div>
            <div class="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs">
              <div class="text-[#F2F2F2]/60 font-semibold">Contraseña</div>
              <div class="font-mono font-bold text-[#05F2F2] mt-0.5 select-all">{{ credencialesRecienCreadas.password }}</div>
            </div>

            <button
              type="button"
              @click="copiarCredencialesBanner"
              class="inline-flex items-center gap-1.5 rounded-xl bg-[#05C7F2] px-4 py-2.5 text-xs font-bold text-[#0D0D0D] hover:bg-[#05F2F2] transition cursor-pointer"
            >
              <Check v-if="copiadoId === 'banner'" class="w-4 h-4" />
              <Copy v-else class="w-4 h-4" />
              <span>{{ copiadoId === 'banner' ? '¡Copiado!' : 'Copiar accesos' }}</span>
            </button>

            <button
              type="button"
              @click="credencialesRecienCreadas = null"
              class="p-2 rounded-lg text-[#F2F2F2]/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
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
        class="rounded-xl bg-[#05C7F2]/15 border border-[#04C4D9] px-4 py-3 flex items-center justify-between text-sm font-semibold text-[#0D0D0D]"
      >
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-[#04C4D9]" />
          <span>{{ bannerExito }}</span>
        </div>
        <button type="button" @click="bannerExito = ''" class="text-xs font-bold hover:opacity-75">✕</button>
      </div>

      <!-- Barra de búsqueda -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-[#0D0D0D]/10 p-4">
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 text-[#0D0D0D]/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Buscar ruta por código, nombre, zona o encargado..."
            class="w-full rounded-xl border border-[#0D0D0D]/15 bg-[#F2F2F2]/60 pl-10 pr-4 py-2 text-sm text-[#0D0D0D] placeholder:text-[#0D0D0D]/45 focus:bg-white focus:border-[#05C7F2] focus:outline-none focus:ring-2 focus:ring-[#05C7F2]/25"
          />
        </div>
        <div class="text-xs font-semibold text-[#0D0D0D]/60">
          Mostrando {{ rutasFiltradas.length }} de {{ rutas.length }} rutas configuradas
        </div>
      </div>

      <!-- Estado Vacío -->
      <div
        v-if="!loading && rutasFiltradas.length === 0"
        class="rounded-2xl bg-white border border-dashed border-[#0D0D0D]/20 p-12 text-center space-y-4"
      >
        <div class="mx-auto w-14 h-14 rounded-2xl bg-[#05C7F2]/15 border border-[#04C4D9]/40 flex items-center justify-center text-[#0D0D0D]">
          <MapPin class="w-7 h-7 text-[#04C4D9]" />
        </div>
        <div class="space-y-1 max-w-md mx-auto">
          <h2 class="text-lg font-extrabold text-[#0D0D0D]">
            {{ searchQuery ? 'No se encontraron rutas con ese filtro' : 'Aún no has creado ninguna Ruta o Sucursal' }}
          </h2>
          <p class="text-xs text-[#0D0D0D]/65">
            Crea tu primera ruta (ej. <strong>Ruta Norte</strong>, <strong>Ruta Oriente</strong>, <strong>Sucursal Central</strong>) y el sistema creará automáticamente el usuario y rol de <strong>Sub-Administrador</strong> exclusivo para esa ruta.
          </p>
        </div>
        <div>
          <button
            type="button"
            @click="abrirModalCrear"
            class="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-5 py-2.5 text-xs font-bold text-[#05F2F2] hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer"
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
          class="rounded-2xl bg-white border border-[#0D0D0D]/12 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden"
        >
          <!-- Franja Superior de Identidad -->
          <div class="h-1.5 w-full bg-gradient-to-r from-[#0D0D0D] via-[#04C4D9] to-[#05F2F2]"></div>

          <div class="p-5 space-y-4 flex-1">
            <!-- Cabecera de la Ruta -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 rounded-lg bg-[#0D0D0D] px-2.5 py-0.5 font-mono text-xs font-black text-[#05F2F2]">
                    {{ ruta.codigo }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border"
                    :class="
                      ruta.estado === 'Activa'
                        ? 'bg-[#05F2F2]/20 text-[#0D0D0D] border-[#04C4D9]/50'
                        : 'bg-[#F2F2F2] text-[#0D0D0D]/60 border-[#0D0D0D]/15'
                    "
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      :class="ruta.estado === 'Activa' ? 'bg-[#04C4D9]' : 'bg-[#0D0D0D]/40'"
                    ></span>
                    {{ ruta.estado }}
                  </span>
                </div>
                <h3 class="mt-2 text-lg font-black text-[#0D0D0D] leading-snug">
                  {{ ruta.nombre }}
                </h3>
                <p v-if="ruta.zona" class="text-xs font-semibold text-[#0D0D0D]/65 flex items-center gap-1 mt-0.5">
                  <Building2 class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                  <span>{{ ruta.zona }}</span>
                </p>
              </div>

              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="abrirModalEditar(ruta)"
                  class="p-2 rounded-lg border border-[#0D0D0D]/10 text-[#0D0D0D]/70 hover:text-[#0D0D0D] hover:bg-[#05C7F2]/15 hover:border-[#04C4D9] transition cursor-pointer"
                  title="Editar ruta o reasignar Sub-Administrador"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  @click="rutaAEliminar = ruta"
                  class="p-2 rounded-lg border border-[#0D0D0D]/10 text-[#0D0D0D]/70 hover:text-white hover:bg-[#0D0D0D] transition cursor-pointer"
                  title="Eliminar ruta"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Bloque del Sub-Administrador de la Ruta -->
            <div class="rounded-xl bg-[#F2F2F2]/80 border border-[#0D0D0D]/10 p-3.5 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-[#0D0D0D]/60 flex items-center gap-1.5">
                  <ShieldCheck class="w-3.5 h-3.5 text-[#04C4D9]" />
                  <span>Sub-Administrador de Ruta</span>
                </span>
                <span class="inline-flex items-center rounded-full bg-[#05C7F2]/20 border border-[#04C4D9]/40 px-2 py-0.5 text-[10px] font-bold text-[#0D0D0D]">
                  Solo ve {{ ruta.codigo }}
                </span>
              </div>

              <div v-if="ruta.subAdminEmail || ruta.subAdminNombre" class="space-y-2">
                <div>
                  <div class="text-sm font-bold text-[#0D0D0D]">
                    {{ ruta.subAdminNombre || 'Administrador de Ruta' }}
                  </div>
                  <div class="text-xs font-mono text-[#0D0D0D]/75 select-all">
                    {{ ruta.subAdminEmail }}
                  </div>
                </div>

                <!-- Contraseña visible / copiable para el Admin -->
                <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-[#0D0D0D]/10">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <KeyRound class="w-3.5 h-3.5 text-[#04C4D9] shrink-0" />
                    <span class="text-xs font-mono font-bold text-[#0D0D0D] truncate select-all">
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
                      class="p-1.5 rounded-lg bg-white border border-[#0D0D0D]/15 text-[#0D0D0D] hover:border-[#04C4D9] transition cursor-pointer"
                      :title="passwordVisibleMap[ruta.id] ? 'Ocultar contraseña' : 'Ver contraseña'"
                    >
                      <EyeOff v-if="passwordVisibleMap[ruta.id]" class="w-3.5 h-3.5" />
                      <Eye v-else class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      @click="copiarCredencialesRuta(ruta)"
                      class="p-1.5 rounded-lg bg-white border border-[#0D0D0D]/15 text-[#0D0D0D] hover:border-[#04C4D9] transition cursor-pointer"
                      title="Copiar usuario y contraseña de este Sub-Admin"
                    >
                      <Check v-if="copiadoId === ruta.id" class="w-3.5 h-3.5 text-[#04C4D9]" />
                      <Copy v-else class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      @click="abrirModalCredencialSubAdmin(ruta)"
                      class="px-2 py-1 rounded-lg bg-[#0D0D0D] text-[#05F2F2] text-[10px] font-bold hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer"
                      title="Editar contraseña registrada"
                    >
                      Clave
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="flex items-center justify-between py-1">
                <span class="text-xs text-[#0D0D0D]/60 italic">Sin Sub-Administrador asignado</span>
                <button
                  type="button"
                  @click="abrirModalEditar(ruta)"
                  class="text-xs font-bold text-[#0D0D0D] underline hover:text-[#04C4D9] cursor-pointer"
                >
                  Asignar ahora
                </button>
              </div>
            </div>

            <!-- Métricas de Órdenes de esta Ruta -->
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="rounded-xl bg-[#F2F2F2]/60 border border-[#0D0D0D]/10 p-2.5">
                <div class="text-[10px] font-bold uppercase text-[#0D0D0D]/60">Órdenes</div>
                <div class="text-base font-black text-[#0D0D0D] mt-0.5">
                  {{ metricasDeRuta(ruta).totalOrdenes }}
                </div>
              </div>
              <div class="rounded-xl bg-[#F2F2F2]/60 border border-[#0D0D0D]/10 p-2.5">
                <div class="text-[10px] font-bold uppercase text-[#0D0D0D]/60">En Proceso</div>
                <div class="text-base font-black text-[#04C4D9] mt-0.5">
                  {{ metricasDeRuta(ruta).enProceso }}
                </div>
              </div>
              <div class="rounded-xl bg-[#0D0D0D] text-white p-2.5">
                <div class="text-[10px] font-bold uppercase text-[#05F2F2]">Total Ruta</div>
                <div class="text-xs sm:text-sm font-black text-white mt-1 truncate">
                  {{ formatMoney(metricasDeRuta(ruta).facturacion) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Acciones Inferiores de la Tarjeta -->
          <div class="px-5 py-3.5 bg-[#F2F2F2]/50 border-t border-[#0D0D0D]/10 flex items-center justify-between gap-2">
            <button
              type="button"
              @click="crearOrdenEnRuta(ruta)"
              class="inline-flex items-center gap-1.5 rounded-xl border border-[#0D0D0D]/15 bg-white px-3 py-2 text-xs font-bold text-[#0D0D0D] hover:border-[#04C4D9] hover:bg-[#05C7F2]/10 transition cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Nueva Orden</span>
            </button>

            <button
              type="button"
              @click="irAOrdenesDeRuta(ruta)"
              class="inline-flex items-center gap-1.5 rounded-xl bg-[#0D0D0D] px-3.5 py-2 text-xs font-bold text-[#05F2F2] hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer"
            >
              <span>Filtrar órdenes ({{ metricasDeRuta(ruta).totalOrdenes }})</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </article>
      </div>
    </div>

    <!-- MODAL: CREAR / EDITAR RUTA + SUB-ADMINISTRADOR AUTOMÁTICO -->
    <div
      v-if="modalAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]/70 backdrop-blur-xs p-4 overflow-y-auto"
      @click.self="cerrarModal"
    >
      <div class="w-full max-w-xl rounded-2xl bg-white border border-[#0D0D0D]/15 shadow-2xl overflow-hidden my-8">
        <div class="h-1.5 w-full bg-gradient-to-r from-[#0D0D0D] via-[#05C7F2] to-[#05F2F2]"></div>

        <form @submit.prevent="guardarRuta" class="p-6 space-y-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-[#05C7F2]/15 border border-[#04C4D9]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#0D0D0D]">
                <MapPin class="w-3 h-3 text-[#04C4D9]" />
                <span>{{ modoEdicion ? 'Configuración de Ruta' : 'Creación Automática de Ruta + Rol' }}</span>
              </span>
              <h2 class="mt-1.5 text-xl font-black text-[#0D0D0D]">
                {{ modoEdicion ? 'Editar Ruta y Sub-Administrador' : 'Nueva Ruta y Sub-Administrador' }}
              </h2>
              <p class="text-xs text-[#0D0D0D]/65 mt-0.5">
                Al guardar la ruta, el sistema configura automáticamente el rol de
                <strong>Sub-Administrador</strong> restringido únicamente a las órdenes de esta ruta.
              </p>
            </div>
            <button
              type="button"
              @click="cerrarModal"
              class="p-1.5 rounded-lg text-[#0D0D0D]/50 hover:text-[#0D0D0D] hover:bg-[#F2F2F2] transition cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div
            v-if="errorFormulario"
            class="rounded-xl bg-[#0D0D0D] text-[#05F2F2] border border-[#05C7F2] px-4 py-3 text-xs font-bold flex items-center gap-2"
          >
            <AlertCircle class="w-4 h-4 shrink-0 text-[#05C7F2]" />
            <span>{{ errorFormulario }}</span>
          </div>

          <!-- 1. Datos de la Ruta / Sucursal -->
          <div class="space-y-3 rounded-xl bg-[#F2F2F2]/60 border border-[#0D0D0D]/10 p-4">
            <h3 class="text-xs font-black uppercase tracking-wider text-[#0D0D0D] flex items-center gap-1.5">
              <MapPin class="w-3.5 h-3.5 text-[#04C4D9]" />
              <span>1. Datos de la Ruta / Sucursal</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-[#0D0D0D] mb-1">Código</label>
                <input
                  v-model="form.codigo"
                  type="text"
                  required
                  placeholder="RUT-01"
                  class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2 text-sm font-mono font-bold text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none focus:ring-2 focus:ring-[#05C7F2]/25"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-[#0D0D0D] mb-1">
                  Nombre de la Ruta o Sucursal *
                </label>
                <input
                  v-model="form.nombre"
                  type="text"
                  required
                  placeholder="Ej. Ruta Norte / Sucursal San Miguel"
                  @blur="!modoEdicion && !form.subAdminEmail ? autocompletarDatosSubAdmin() : null"
                  class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2 text-sm font-semibold text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none focus:ring-2 focus:ring-[#05C7F2]/25"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-[#0D0D0D] mb-1">
                  Zona / Cobertura
                </label>
                <input
                  v-model="form.zona"
                  type="text"
                  placeholder="Ej. Zona Oriental / Talleres Afiliados"
                  class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2 text-sm text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none focus:ring-2 focus:ring-[#05C7F2]/25"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-[#0D0D0D] mb-1">Estado de la Ruta</label>
                <select
                  v-model="form.estado"
                  class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2 text-sm font-bold text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none"
                >
                  <option value="Activa">Activa</option>
                  <option value="Inactiva">Inactiva</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 2. Sub-Administrador de la Ruta -->
          <div class="space-y-3 rounded-xl bg-[#05C7F2]/10 border border-[#04C4D9]/40 p-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 class="text-xs font-black uppercase tracking-wider text-[#0D0D0D] flex items-center gap-1.5">
                <UserPlus class="w-3.5 h-3.5 text-[#04C4D9]" />
                <span>2. Sub-Administrador Exclusivo de esta Ruta</span>
              </h3>

              <button
                v-if="form.modoSubAdmin === 'nuevo'"
                type="button"
                @click="autocompletarDatosSubAdmin"
                class="inline-flex items-center gap-1 rounded-lg bg-[#0D0D0D] px-2.5 py-1 text-[11px] font-bold text-[#05F2F2] hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer self-start"
              >
                <Sparkles class="w-3 h-3" />
                <span>Autogenerar usuario y clave</span>
              </button>
            </div>

            <!-- Selector de modo de asignación -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                @click="form.modoSubAdmin = 'nuevo'"
                class="rounded-xl border px-3 py-2 text-xs font-bold text-left transition cursor-pointer"
                :class="
                  form.modoSubAdmin === 'nuevo'
                    ? 'bg-[#0D0D0D] text-[#05F2F2] border-[#0D0D0D]'
                    : 'bg-white text-[#0D0D0D] border-[#0D0D0D]/15 hover:border-[#04C4D9]'
                "
              >
                Crear nuevo Sub-Admin
              </button>
              <button
                type="button"
                @click="form.modoSubAdmin = 'existente'"
                class="rounded-xl border px-3 py-2 text-xs font-bold text-left transition cursor-pointer"
                :class="
                  form.modoSubAdmin === 'existente'
                    ? 'bg-[#0D0D0D] text-[#05F2F2] border-[#0D0D0D]'
                    : 'bg-white text-[#0D0D0D] border-[#0D0D0D]/15 hover:border-[#04C4D9]'
                "
              >
                Asignar usuario existente
              </button>
              <button
                type="button"
                @click="form.modoSubAdmin = 'sin_asignar'"
                class="rounded-xl border px-3 py-2 text-xs font-bold text-left transition cursor-pointer"
                :class="
                  form.modoSubAdmin === 'sin_asignar'
                    ? 'bg-[#0D0D0D] text-[#05F2F2] border-[#0D0D0D]'
                    : 'bg-white text-[#0D0D0D] border-[#0D0D0D]/15 hover:border-[#04C4D9]'
                "
              >
                Dejar sin encargar aún
              </button>
            </div>

            <!-- Opción A: Crear nuevo Sub-Administrador -->
            <div v-if="form.modoSubAdmin === 'nuevo'" class="space-y-3 pt-2">
              <div>
                <label class="block text-xs font-bold text-[#0D0D0D] mb-1">
                  Nombre del Sub-Administrador *
                </label>
                <input
                  v-model="form.subAdminNombre"
                  type="text"
                  placeholder="Ej. Carlos Encargado Ruta Norte"
                  class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2 text-sm text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-[#0D0D0D] mb-1">
                    Correo de acceso *
                  </label>
                  <input
                    v-model="form.subAdminEmail"
                    type="email"
                    required
                    placeholder="admin.rutanorte@jrblanco.com"
                    class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2 text-sm font-mono text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none"
                  />
                </div>

                <div>
                  <label class="block text-xs font-bold text-[#0D0D0D] mb-1">
                    Contraseña inicial (mín. 8 caracteres) *
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.subAdminPassword"
                      :type="mostrarPasswordForm ? 'text' : 'password'"
                      required
                      minlength="8"
                      placeholder="RutaNorte2026*"
                      class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white pl-3 pr-9 py-2 text-sm font-mono font-bold text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none"
                    />
                    <button
                      type="button"
                      @click="mostrarPasswordForm = !mostrarPasswordForm"
                      class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#0D0D0D]/60 hover:text-[#0D0D0D]"
                    >
                      <EyeOff v-if="mostrarPasswordForm" class="w-4 h-4" />
                      <Eye v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <p class="text-[11px] font-semibold text-[#0D0D0D]/75">
                ✓ Este usuario tendrá el rol <strong>Sub-Administrador ({{ form.nombre || 'Ruta' }})</strong> y únicamente podrá ver, crear, editar e imprimir órdenes de trabajo de esta ruta.
              </p>
            </div>

            <!-- Opción B: Seleccionar usuario existente -->
            <div v-else-if="form.modoSubAdmin === 'existente'" class="space-y-2 pt-2">
              <label class="block text-xs font-bold text-[#0D0D0D]">
                Selecciona el usuario que será Sub-Administrador de esta ruta
              </label>
              <select
                v-model="form.existingUserId"
                class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2.5 text-sm font-semibold text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none"
              >
                <option value="">-- Seleccionar usuario registrado --</option>
                <option
                  v-for="u in perfiles"
                  :key="u.id"
                  :value="u.id"
                >
                  {{ u.nombre }} ({{ u.email }})
                </option>
              </select>
              <p class="text-[11px] font-semibold text-[#0D0D0D]/75">
                Al guardar, su rol se actualizará automáticamente a <strong>Sub-Administrador de {{ form.nombre || 'esta ruta' }}</strong>.
              </p>
            </div>
          </div>

          <!-- Botones de Acción -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              @click="cerrarModal"
              :disabled="guardando"
              class="rounded-xl border border-[#0D0D0D]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#0D0D0D] hover:bg-[#F2F2F2] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="guardando"
              class="inline-flex items-center gap-2 rounded-xl bg-[#0D0D0D] px-5 py-2.5 text-xs font-bold text-[#05F2F2] hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer disabled:opacity-50"
            >
              <span>
                {{
                  guardando
                    ? 'Guardando y configurando rol...'
                    : modoEdicion
                      ? 'Guardar cambios de Ruta'
                      : 'Crear Ruta y Sub-Administrador'
                }}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: EDITAR / VER CREDENCIAL DE SUB-ADMIN -->
    <div
      v-if="rutaCredencialModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]/70 backdrop-blur-xs p-4"
      @click.self="rutaCredencialModal = null"
    >
      <div class="w-full max-w-md rounded-2xl bg-white border border-[#0D0D0D]/15 p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-black text-[#0D0D0D]">
            Credenciales de {{ rutaCredencialModal.codigo }}
          </h3>
          <button
            type="button"
            @click="rutaCredencialModal = null"
            class="p-1 rounded-lg text-[#0D0D0D]/50 hover:text-[#0D0D0D]"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="rounded-xl bg-[#F2F2F2] p-3.5 text-xs space-y-1">
          <div><span class="font-bold">Ruta:</span> {{ rutaCredencialModal.nombre }}</div>
          <div><span class="font-bold">Sub-Admin:</span> {{ rutaCredencialModal.subAdminNombre }}</div>
          <div><span class="font-bold">Correo:</span> <span class="font-mono">{{ rutaCredencialModal.subAdminEmail }}</span></div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#0D0D0D] mb-1">
            Contraseña visible en bóveda del Administrador
          </label>
          <input
            v-model="passwordEditableModal"
            type="text"
            class="w-full rounded-xl border border-[#0D0D0D]/20 bg-white px-3 py-2 text-sm font-mono font-bold text-[#0D0D0D] focus:border-[#05C7F2] focus:outline-none"
          />
        </div>

        <div
          v-if="mensajeCredencialModal"
          class="rounded-xl bg-[#05C7F2]/15 border border-[#04C4D9] px-3 py-2 text-xs font-bold text-[#0D0D0D]"
        >
          {{ mensajeCredencialModal }}
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="rutaCredencialModal = null"
            class="rounded-xl border border-[#0D0D0D]/15 px-4 py-2 text-xs font-bold text-[#0D0D0D]"
          >
            Cerrar
          </button>
          <button
            type="button"
            @click="guardarCredencialSubAdminModal"
            class="rounded-xl bg-[#0D0D0D] px-4 py-2 text-xs font-bold text-[#05F2F2] hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer"
          >
            Guardar registro
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: CONFIRMAR ELIMINACIÓN DE RUTA -->
    <div
      v-if="rutaAEliminar"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]/70 backdrop-blur-xs p-4"
      @click.self="rutaAEliminar = null"
    >
      <div class="w-full max-w-md rounded-2xl bg-white border border-[#0D0D0D]/15 p-6 space-y-4 shadow-xl">
        <h3 class="text-lg font-black text-[#0D0D0D]">
          ¿Eliminar la ruta "{{ rutaAEliminar.nombre }}"?
        </h3>
        <p class="text-xs text-[#0D0D0D]/70">
          Las órdenes de trabajo existentes no se borrarán, pero esta ruta dejará de aparecer en el listado activo.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="rutaAEliminar = null"
            class="rounded-xl border border-[#0D0D0D]/15 px-4 py-2 text-xs font-bold text-[#0D0D0D]"
          >
            Cancelar
          </button>
          <button
            type="button"
            :disabled="eliminando"
            @click="confirmarEliminarRuta"
            class="rounded-xl bg-[#0D0D0D] px-4 py-2 text-xs font-bold text-[#05F2F2] hover:bg-[#05C7F2] hover:text-[#0D0D0D] transition cursor-pointer"
          >
            {{ eliminando ? 'Eliminando...' : 'Sí, eliminar ruta' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
