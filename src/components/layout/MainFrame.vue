<script setup>
defineProps({
  showInputArea: {
    type: Boolean,
    default: true,
  },
})
</script>

<template>
  <div class="app-shell">
    <slot name="sidebar" />

    <div class="main-area">
      <div class="content-column">
        <div v-show="showInputArea && $slots.input" class="content-input">
          <slot name="input" />
        </div>

        <main class="page-content">
          <slot name="content" />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  background: var(--color-bg);
  font-family: var(--font-base);
  overflow: hidden;
}

.main-area {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
  overflow: hidden;
  background: var(--color-bg);
}

/* 与侧栏衔接的柔和光晕，消除「硬切」感 */
.main-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 28px;
  background: linear-gradient(
    90deg,
    rgba(24, 24, 27, 0.03) 0%,
    rgba(24, 24, 27, 0) 100%
  );
  pointer-events: none;
  z-index: 0;
}

.main-area > .content-column {
  position: relative;
  z-index: 1;
}

.content-column {
  width: var(--frame-width);
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 var(--frame-gutter);
  box-sizing: border-box;
}

.content-input {
  flex: 0 0 auto;
  width: 100%;
  max-width: var(--frame-inner-width);
  padding: 18px 0 12px;
  box-sizing: border-box;
}

.page-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 720px) {
  .content-column {
    padding: 0 12px;
  }

  .content-input {
    padding: 14px 0 10px;
  }
}
</style>
