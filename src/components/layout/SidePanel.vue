<template>
  <motion.aside
    :initial="sidebarMotion.initial"
    :animate="sidebarMotion.animate"
    :transition="sidebarMotion.transition"
    class="app-sidebar"
    aria-label="主导航"
  >
    <div class="sidebar-brand">
      <BrandArea variant="sidebar" />
    </div>

    <div class="sidebar-search">
      <label class="sidebar-search-field">
        <span class="sidebar-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          type="search"
          class="sidebar-search-input"
          placeholder="搜索笔记…"
          autocomplete="off"
          spellcheck="false"
          aria-label="搜索笔记"
        />
      </label>
    </div>

    <nav class="sidebar-nav" aria-label="菜单">
      <motion.button
        v-for="item in navItems"
        :key="item.id"
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeTab === item.id }"
        :aria-current="activeTab === item.id ? 'page' : undefined"
        :while-hover="navMotion.hover"
        :while-tap="navMotion.tap"
        @click="$emit('tab-change', item.id)"
      >
        <motion.div
          v-if="activeTab === item.id"
          layout-id="sidebarActiveNav"
          class="nav-item-active-bg"
          :transition="navMotion.layout"
        />

        <span class="nav-item-icon" aria-hidden="true">
          <svg
            v-if="item.id === 'home'"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
          </svg>
          <svg
            v-else-if="item.id === 'sediment'"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2 2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <svg
            v-else-if="item.id === 'echo'"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 12a8 8 0 0 1 16 0" />
            <path d="M7 12a5 5 0 0 1 10 0" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <svg
            v-else-if="item.id === 'trash'"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </span>

        <span class="nav-item-label">{{ item.label }}</span>

        <span
          v-if="item.id === 'trash' && trashCount > 0"
          class="nav-item-badge"
        >
          {{ trashCount > 99 ? '99+' : trashCount }}
        </span>
      </motion.button>
    </nav>
  </motion.aside>
</template>

<script setup>
import { computed } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
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

const navItems = [
  { id: 'home', label: '主页' },
  { id: 'sediment', label: '沉淀' },
  { id: 'echo', label: '回响' },
  { id: 'trash', label: '回收站' },
]

const { presets } = useMotionPresets()

const sidebarMotion = computed(() => ({
  initial: presets.value.sidebar.initial,
  animate: presets.value.sidebar.animate,
  transition: presets.value.sidebar.transition,
}))

const navMotion = computed(() => ({
  hover: presets.value.button.hover,
  tap: presets.value.button.tap,
  layout: presets.value.layoutSpring,
}))
</script>

<style scoped>
.app-sidebar {
  flex: 0 0 var(--sidebar-width);
  width: var(--sidebar-width);
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px 12px 24px 16px;
  overflow: hidden;
  background: var(--shell-sidebar-bg);
}

.sidebar-search {
  flex: 0 0 auto;
  padding: 0 2px 20px;
}

.sidebar-search-field {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.06);
  cursor: text;
}

.sidebar-search-field:focus-within {
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.08);
}

.sidebar-search-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-secondary-text);
}

.sidebar-search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  outline: none;
}

.sidebar-search-input::placeholder {
  color: #a1a1aa;
  font-weight: 400;
}

.sidebar-search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.sidebar-brand {
  flex: 0 0 auto;
  padding: 0 4px 20px;
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
  position: relative;
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
}

.nav-item:hover {
  color: var(--color-primary);
}

.nav-item.is-active {
  color: var(--color-accent);
}

.nav-item.is-active .nav-item-icon {
  color: var(--color-accent);
}

.nav-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.nav-item-active-bg {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.06);
  z-index: 0;
}

.nav-item-icon {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-secondary-text);
}

.nav-item-label {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
}

.nav-item-badge {
  position: relative;
  z-index: 1;
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

  .sidebar-search {
    padding: 0 0 14px;
  }

  .sidebar-search-field {
    justify-content: center;
    padding: 10px;
  }

  .sidebar-search-input {
    display: none;
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
</style>
