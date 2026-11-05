<script setup lang="ts">
import MainLayout from '@/layouts/MainLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
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
