<template>
  <div class="main-frame">
    <header class="brand-wrapper">
      <BrandArea />
    </header>

    <main class="content-wrapper">
      <slot name="content" />
    </main>

    <footer class="input-wrapper">
      <slot name="input" />
    </footer>
  </div>
</template>

<script setup>
import BrandArea from '../brand/BrandArea.vue'
</script>

<style scoped>
.main-frame {
  min-height: 100vh;
  background: var(--color-bg);
  font-family: var(--font-base);
}

.brand-wrapper {
  position: fixed;
  top: 20px;
  left: 24px;
  z-index: 20;
}

.content-wrapper {
  width: min(760px, 92vw);
  margin: 0 auto;
  padding: 100px 0 130px;
}

.input-wrapper {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  width: min(680px, 90vw);
  z-index: 30;
}
</style>
