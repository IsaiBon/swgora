<script setup lang="ts">
import { onMounted } from 'vue'
import MainLayout from '@/layouts/MainLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useTallerStore } from '@/stores/taller'

const tallerStore = useTallerStore()

onMounted(() => {
  void tallerStore.loadTallerInfo()
})
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <component :is="route.meta?.layout === 'auth' ? AuthLayout : MainLayout">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </component>
  </router-view>
</template>
