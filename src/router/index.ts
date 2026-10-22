import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import OrdenesView from '@/views/OrdenesView.vue'
import CatalogoView from '@/views/CatalogoView.vue'
import ClientesView from '@/views/ClientesView.vue'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore, isRouteAllowedForRole, getDefaultRouteForRole } from '@/stores/auth'

const routes = [
  {
    path: '/usuarios',
    name: 'Usuarios',
    component: () => import('@/views/UsuariosView.vue'),
    meta: {
      layout: 'main',
      title: 'Administración de usuarios - JR Blanco',
      allowedRoles: ['Administrador'],
    },
  },


  {
    path: '/',
    name: 'Root',
    redirect: () => {
      const authStore = useAuthStore()
      return getDefaultRouteForRole(authStore.user?.role || 'Consultor')
    },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { 
      layout: 'main', 
      title: 'Dashboard - JR Blanco',
      allowedRoles: ['Administrador']
    },
  },
  {
    path: '/clientes',
    name: 'Clientes',
    component: ClientesView,
    meta: { 
      layout: 'main', 
      title: 'Clientes y Flotillas - JR Blanco',
      allowedRoles: ['Administrador']
    },
  },
  {
    path: '/ordenes',
    name: 'Ordenes',
    component: OrdenesView,
    meta: { 
      layout: 'main', 
      title: 'Órdenes - JR Blanco',
      allowedRoles: ['Administrador', 'Operador']
    },
  },
  {
    path: '/catalogo',
    name: 'Catalogo',
    component: CatalogoView,
    meta: { 
      layout: 'main', 
      title: 'Catálogo - JR Blanco',
      allowedRoles: ['Administrador', 'Operador', 'Consultor']
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { layout: 'auth', title: 'Iniciar Sesión - SWGORA' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: () => {
      const authStore = useAuthStore()
      return getDefaultRouteForRole(authStore.user?.role || 'Consultor')
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * Guardián de navegación global:
 * Valida de forma estricta los permisos de cada rol antes de permitir la carga de cualquier vista.
 * - Administrador: Acceso total
 * - Operador: Solo Órdenes y Catálogo
 * - Consultor: Solo Catálogo
 */
router.beforeEach(async (to, _from) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }

  // Permitir siempre la vista de login
  if (to.path === '/login') {
    return true
  }

   const authStore = useAuthStore()

  await authStore.init()

  if (!authStore.isAuthenticated) {
    return '/login'
  }

  const userRole = authStore.user?.role || 'Consultor'

  // Si la ruta solicitada no está permitida para el rol activo
  if (!isRouteAllowedForRole(to.path, userRole)) {
    const targetRoute = getDefaultRouteForRole(userRole)
    console.warn(
      `[Guardián de Rutas] Acceso restringido a '${to.path}' para el rol '${userRole}'. Redirigiendo a '${targetRoute}'.`
    )
    if (to.path !== targetRoute) {
      return targetRoute
    }
    return '/catalogo'
  }

  return true
})

export default router
