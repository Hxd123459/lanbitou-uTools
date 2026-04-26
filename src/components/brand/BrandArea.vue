<template>
  <div class="brand-area">
    <div class="brand-title">
      AI Note
      <span class="env-tag">{{ envLabel }}</span>
    </div>
    <div class="brand-subtitle">xxxx</div>
  </div>
</template>

<script setup>
const envLabel = (import.meta.env.VITE_APP_ENV || 'dev').toUpperCase()
</script>

<style scoped>
.brand-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-title {
  color: var(--color-primary);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}

.env-tag {
  margin-left: 8px;
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-secondary-text);
  font-size: 11px;
  font-weight: 500;
  vertical-align: middle;
}

.brand-subtitle {
  color: var(--color-secondary-text);
  font-size: 13px;
  line-height: 1.4;
}
</style>
