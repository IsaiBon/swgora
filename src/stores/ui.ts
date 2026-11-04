import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const isMobileSidebarOpen = ref(false)
  const isSidebarCollapsed = ref(false)
  const newOrderTrigger = ref(0)

  function requestNewOrder() {
    newOrderTrigger.value++
  }

  function toggleMobileSidebar() {
    isMobileSidebarOpen.value = !isMobileSidebarOpen.value
  }

  function closeMobileSidebar() {
    isMobileSidebarOpen.value = false
  }

  function toggleSidebarCollapse() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  return {
    isMobileSidebarOpen,
    isSidebarCollapsed,
    newOrderTrigger,
    requestNewOrder,
    toggleMobileSidebar,
    closeMobileSidebar,
    toggleSidebarCollapse,
  }
})
