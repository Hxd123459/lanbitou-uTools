<template>
  <aside class="app-sidebar" aria-label="主导航">
    <div class="sidebar-brand">
      <BrandArea variant="sidebar" />
    </div>

    <nav class="sidebar-nav" aria-label="菜单">
      <button
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeTab === 'home' }"
        :aria-current="activeTab === 'home' ? 'page' : undefined"
        @click="$emit('tab-change', 'home')"
      >
        <span class="nav-item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
          </svg>
        </span>
        <span class="nav-item-label">主页</span>
      </button>

      <button
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeTab === 'sediment' }"
        :aria-current="activeTab === 'sediment' ? 'page' : undefined"
        @click="$emit('tab-change', 'sediment')"
      >
        <span class="nav-item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </span>
        <span class="nav-item-label">沉淀</span>
      </button>

      <button
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeTab === 'echo' }"
        :aria-current="activeTab === 'echo' ? 'page' : undefined"
        @click="$emit('tab-change', 'echo')"
      >
        <span class="nav-item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12a8 8 0 0 1 16 0" />
            <path d="M7 12a5 5 0 0 1 10 0" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span class="nav-item-label">回响</span>
      </button>

      <button
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeTab === 'trash' }"
        :aria-current="activeTab === 'trash' ? 'page' : undefined"
        @click="$emit('tab-change', 'trash')"
      >
        <span class="nav-item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </span>
        <span class="nav-item-label">回收站</span>
        <span v-if="trashCount > 0" class="nav-item-badge">
          {{ trashCount > 99 ? '99+' : trashCount }}
        </span>
      </button>
    </nav>
  </aside>
</template>

<script setup>
import BrandArea from '../brand/BrandArea.vue'

defineProps({
  activeTab: {
    type: String,
    default: 'home',
  },
  trashCount: {
    type: Number,
    default: 0,
  },
})

defineEmits(['tab-change'])
</script>

<style scoped>
.app-sidebar {
  position: relative;
  flex: 0 0 var(--sidebar-width);
  width: var(--sidebar-width);
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 18px 12px 24px 16px;
  overflow: hidden;
  background: var(--shell-sidebar-bg);
  backdrop-filter: saturate(140%) blur(10px);
  -webkit-backdrop-filter: saturate(140%) blur(10px);
  box-shadow: var(--shell-sidebar-shadow);
}

/* 渐变分隔线，替代硬边框 */
.app-sidebar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: var(--shell-sidebar-edge);
  pointer-events: none;
}

.sidebar-brand {
  flex: 0 0 auto;
  padding: 2px 4px 18px;
  margin-bottom: 14px;
  position: relative;
}

/* 品牌区底部分隔：淡出渐变，非实线 */
.sidebar-brand::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(228, 228, 231, 0) 0%,
    rgba(228, 228, 231, 0.55) 30%,
    rgba(228, 228, 231, 0.55) 70%,
    rgba(228, 228, 231, 0) 100%
  );
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
  padding-right: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background var(--motion-fast), color var(--motion-fast),
    box-shadow var(--motion-fast);
}

.nav-item:hover {
  background: rgba(24, 24, 27, 0.04);
  color: var(--color-primary);
}

.nav-item.is-active {
  background: rgba(255, 255, 255, 0.85);
  color: var(--color-accent);
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.06), 0 0 0 1px rgba(37, 99, 235, 0.08);
}

.nav-item.is-active .nav-item-icon {
  color: var(--color-accent);
}

.nav-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.nav-item-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-secondary-text);
  transition: color var(--motion-fast);
}

.nav-item-label {
  flex: 1;
  min-width: 0;
}

.nav-item-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 99px;
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-error);
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 720px) {
  .app-sidebar {
    flex: 0 0 72px;
    width: 72px;
    padding: 16px 8px 20px;
  }

  .sidebar-brand {
    padding: 0 4px 14px;
  }

  .nav-item-label,
  .nav-item-badge {
    display: none;
  }

  .nav-item {
    justify-content: center;
    padding: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-item {
    transition: none;
  }
}
</style>
