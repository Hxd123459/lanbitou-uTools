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
  --frame-width: min(760px, 92vw);
  --frame-gutter: 14px;
  --frame-inner-width: calc(var(--frame-width) - var(--frame-gutter));
  height: 100vh;
  background: var(--color-bg);
  font-family: var(--font-base);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  flex: 0 0 auto;
  padding: 14px 24px 12px;
  background: rgba(250, 250, 250, 0.92);
  backdrop-filter: saturate(160%) blur(12px);
  -webkit-backdrop-filter: saturate(160%) blur(12px);
  border-bottom: 1px solid rgba(228, 228, 231, 0.6);
  z-index: 5;
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
  width: var(--frame-width);
  padding-right: var(--frame-gutter);
  box-sizing: border-box;
  min-width: 0;
}

.page-content {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.content-inner {
  width: var(--frame-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (max-width: 720px) {
  .top-bar {
    padding: 12px 16px 10px;
  }

  .top-bar-brand {
    left: 16px;
    max-width: 32%;
  }
}
</style>
