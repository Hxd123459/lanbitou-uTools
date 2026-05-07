<template>
  <div class="brand-area">
    <div class="logo-wrap" aria-hidden="true">
      <img class="logo-img" src="/logo.png" alt="烂笔头" />
    </div>

    <div class="brand-text">
      <div class="brand-title-row">
        <h1 class="brand-title">烂笔头</h1>
        <span class="env-tag">{{ envLabel }}</span>
      </div>
      <div class="brand-slogan">好记性不如烂笔头</div>
    </div>
  </div>
</template>

<script setup>
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

@media (max-width: 720px) {
  .logo-wrap {
    width: 48px;
    height: 48px;
  }

  .brand-title {
    font-size: 24px;
  }

  .brand-slogan {
    display: none;
  }

  .env-tag {
    display: none;
  }
}
</style>
