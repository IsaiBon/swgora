import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { tallerService, DEFAULT_TALLER_INFO, type TallerInfo } from '@/services/tallerService'
import { useAuthStore } from '@/stores/auth'

const syncBrowserFavicon = (logoUrl?: string) => {
  if (typeof document === 'undefined') return
  const href = logoUrl?.trim() || '/logo-taller.png'
  const favicon = document.getElementById('app-favicon') as HTMLLinkElement | null
  if (favicon && favicon.getAttribute('href') !== href) {
    favicon.setAttribute('href', href)
  }
  const appleIcon = document.getElementById('app-apple-touch-icon') as HTMLLinkElement | null
  if (appleIcon && appleIcon.getAttribute('href') !== href) {
    appleIcon.setAttribute('href', href)
  }
}

export const useTallerStore = defineStore('taller', () => {
  const tallerInfo = ref<TallerInfo>({ ...DEFAULT_TALLER_INFO })
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  watch(
    () => tallerInfo.value.logo_url,
    (nextUrl) => {
      syncBrowserFavicon(nextUrl)
    },
    { immediate: true }
  )

  const loadTallerInfo = async (force = false, options?: { forLoginScreen?: boolean }) => {
    if (isLoaded.value && !force && !options?.forLoginScreen) return tallerInfo.value

    isLoading.value = true
    error.value = null
    try {
      const data = await tallerService.getTallerInfo(options)
      tallerInfo.value = data
      isLoaded.value = !options?.forLoginScreen
      return data
    } catch (err: any) {
      error.value = err.message || 'Error al cargar información del taller'
      return tallerInfo.value
    } finally {
      isLoading.value = false
    }
  }

  const resetTallerInfo = () => {
    tallerInfo.value = { ...DEFAULT_TALLER_INFO }
    isLoaded.value = false
    error.value = null
  }

  const updateTaller = async (data: Partial<TallerInfo>) => {
    isLoading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const payload: Partial<TallerInfo> = authStore.canCustomizeLogin
        ? data
        : {
            ...(data.id !== undefined ? { id: data.id } : {}),
            ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
            ...(data.direccion !== undefined ? { direccion: data.direccion } : {}),
            ...(data.celular1 !== undefined ? { celular1: data.celular1 } : {}),
            ...(data.celular2 !== undefined ? { celular2: data.celular2 } : {}),
            ...(data.eslogan !== undefined ? { eslogan: data.eslogan } : {}),
            ...(data.logo_url !== undefined ? { logo_url: data.logo_url } : {}),
            ...(data.iva_porcentaje !== undefined ? { iva_porcentaje: data.iva_porcentaje } : {}),
          }
      const updated = await tallerService.updateTallerInfo(payload)
      tallerInfo.value = updated
      isLoaded.value = true
      return updated
    } catch (err: any) {
      error.value = err.message || 'Error al actualizar información del taller'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const uploadLogo = async (file: File) => {
    return await tallerService.uploadLogo(file)
  }

  const uploadLoginBg = async (file: File) => {
    const authStore = useAuthStore()
    if (!authStore.canCustomizeLogin) {
      throw new Error('No tienes permisos para modificar el fondo del inicio de sesión.')
    }
    return await tallerService.uploadLoginBg(file)
  }

  const uploadLoginLogo = async (file: File) => {
    const authStore = useAuthStore()
    if (!authStore.canCustomizeLogin) {
      throw new Error('No tienes permisos para modificar el logotipo del inicio de sesión.')
    }
    return await tallerService.uploadLoginLogo(file)
  }

  return {
    tallerInfo,
    isLoaded,
    isLoading,
    error,
    loadTallerInfo,
    resetTallerInfo,
    updateTaller,
    uploadLogo,
    uploadLoginBg,
    uploadLoginLogo
  }
})
