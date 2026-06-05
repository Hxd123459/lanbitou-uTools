<template>
  <div
    class="brand-area"
    :class="{
      'brand-area--sidebar': variant === 'sidebar',
      'is-compact': compact,
    }"
  >
    <div class="logo-wrap" aria-hidden="true">
      <img class="logo-img" src="/logo.png" alt="烂笔头" />
    </div>

    <div class="brand-text">
      <div class="brand-title-row">
        <h1 class="brand-title">烂笔头</h1>
        <span class="env-tag">{{ envLabel }}</span>
      </div>
      <div class="brand-slogan">好记性，不如烂笔头</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'sidebar'].includes(v),
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const envLabel = (import.meta.env.VITE_APP_ENV || 'dev').toUpperCase()
</script>

<style scoped>
.brand-area {
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}

.logo-wrap {
  flex: 0 0 auto;
  width: 60px;
  height: 60px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px rgba(24, 24, 27, 0.06);
  overflow: hidden;
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 4px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.05;
}

.brand-title {
  margin: 0;
  font-family: 'ZCOOL KuaiLe', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', var(--font-base);
  font-size: 30px;
  font-weight: 400;
  letter-spacing: 2px;
  color: #000;
  white-space: nowrap;
}

.env-tag {
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-secondary-text);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.4px;
  line-height: 1.4;
  font-family: var(--font-base);
}

.brand-slogan {
  margin-top: 2px;
  color: var(--color-secondary-text);
  font-family: 'ZCOOL KuaiLe', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', var(--font-base);
  font-size: 13px;
  line-height: 1.3;
  letter-spacing: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-area--sidebar {
  --sidebar-brand-block: 44px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.brand-area--sidebar .logo-wrap {
  width: var(--sidebar-brand-block);
  height: var(--sidebar-brand-block);
  border-radius: 10px;
  flex-shrink: 0;
}

.brand-area--sidebar .brand-text {
  flex: 1;
  min-width: 0;
  height: var(--sidebar-brand-block);
  justify-content: center;
  gap: 1px;
}

.brand-area--sidebar .brand-title-row {
  flex-shrink: 0;
  line-height: 1;
}

.brand-area--sidebar .brand-title {
  font-size: 17px;
  letter-spacing: 1px;
  line-height: 1.1;
}

.brand-area--sidebar .brand-slogan {
  margin-top: 0;
  font-size: 10px;
  letter-spacing: 0.8px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-area--sidebar .env-tag {
  font-size: 9px;
  flex-shrink: 0;
  padding: 0 5px;
  line-height: 1.3;
}

@media (max-width: 720px) {
  .logo-wrap {
    width: 48px;
    height: 48px;
  }

  .brand-title {
    font-size: 24px;
  }

  .brand-area--sidebar .brand-text {
    display: none;
  }

  .brand-area--sidebar {
    --sidebar-brand-block: 40px;
  }
}

.brand-area--sidebar.is-compact .brand-text {
  display: none;
}

.brand-area--sidebar.is-compact {
  --sidebar-brand-block: 40px;
}

@media (max-width: 720px) {
  .brand-area:not(.brand-area--sidebar) .brand-slogan {
    display: none;
  }

  .brand-area:not(.brand-area--sidebar) .env-tag {
    display: none;
  }
}
</style>
