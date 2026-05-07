<template>
  <div class="main-frame">
    <header class="top-bar">
      <div class="top-bar-inner">
        <div class="top-bar-brand">
          <BrandArea />
        </div>
        <div class="top-bar-input">
          <slot name="input" />
        </div>
      </div>
    </header>

    <main class="page-content">
      <div class="content-inner">
        <slot name="content" />
      </div>
    </main>
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

.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  padding: 14px 24px 12px;
  background: rgba(250, 250, 250, 0.85);
  backdrop-filter: saturate(160%) blur(12px);
  -webkit-backdrop-filter: saturate(160%) blur(12px);
  border-bottom: 1px solid rgba(228, 228, 231, 0.6);
}

.top-bar-inner {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.top-bar-brand {
  position: absolute;
  top: 4px;
  left: 24px;
  max-width: 28%;
}

.top-bar-input {
  width: min(760px, 92vw);
  min-width: 0;
}

.page-content {
  padding: 132px 0 80px;
}

.content-inner {
  width: min(760px, 92vw);
  margin: 0 auto;
}

@media (max-width: 720px) {
  .top-bar {
    padding: 12px 16px 10px;
  }

  .top-bar-brand {
    left: 16px;
    max-width: 32%;
  }

  .page-content {
    padding-top: 124px;
  }
}
</style>
