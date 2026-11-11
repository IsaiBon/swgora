import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tallerService, DEFAULT_TALLER_INFO, type TallerInfo } from '@/services/tallerService'

export const useTallerStore = defineStore('taller', () => {
  const tallerInfo = ref<TallerInfo>({ ...DEFAULT_TALLER_INFO })
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const loadTallerInfo = async (force = false) => {
    if (isLoaded.value && !force) return tallerInfo.value

    isLoading.value = true
    error.value = null
    try {
      const data = await tallerService.getTallerInfo()
      tallerInfo.value = data
      isLoaded.value = true
      return data
    } catch (err: any) {
      error.value = err.message || 'Error al cargar información del taller'
      return tallerInfo.value
    } finally {
      isLoading.value = false
    }
  }

  const updateTaller = async (data: Partial<TallerInfo>) => {
    isLoading.value = true
    error.value = null
    try {
      const updated = await tallerService.updateTallerInfo(data)
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

  return {
    tallerInfo,
    isLoaded,
    isLoading,
    error,
    loadTallerInfo,
    updateTaller,
    uploadLogo
  }
})
