<template>
  <RouterView />
  <!-- 吉祥物可插拔：改 mascot/index.js 里 LANBITOU_MASCOT_MOUNTED = true 即可恢复 -->
  <LanbitouMascotHost v-if="mascotMounted" />
</template>

<script setup>
import { LANBITOU_MASCOT_MOUNTED } from './mascot'
import LanbitouMascotHost from './components/mascot/LanbitouMascotHost.vue'

const mascotMounted = LANBITOU_MASCOT_MOUNTED
</script>
