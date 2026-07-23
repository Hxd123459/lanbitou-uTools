<template>
  <motion.aside
    :initial="sidebarMotion.initial"
    :animate="sidebarMotion.animate"
    :transition="sidebarMotion.transition"
    class="app-sidebar"
    :class="{ 'is-compact': isCompactSidebar }"
    aria-label="主导航"
  >
    <div class="sidebar-brand">
      <BrandArea variant="sidebar" :compact="isCompactSidebar" />
    </div>

    <div class="sidebar-search">
      <label class="sidebar-search-field" @click.prevent="openGlobalSearch">
        <span class="sidebar-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          type="search"
          class="sidebar-search-input"
          placeholder="全局搜索"
          autocomplete="off"
          spellcheck="false"
          aria-label="全局搜索"
          readonly
          @focus="openGlobalSearch"
        />
      </label>
    </div>

    <GlobalSearchModal
      ref="globalSearchModalRef"
      :visible="globalSearchVisible"
      @close="globalSearchVisible = false"
    />

    <nav class="sidebar-nav" aria-label="菜单">
      <motion.button
        v-for="item in navItems"
        :key="item.id"
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeTab === item.id }"
        :aria-current="activeTab === item.id ? 'page' : undefined"
        :title="isCompactSidebar ? item.label : undefined"
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
            <path d="M4 5.5h7v7H4z" />
            <path d="M15 4h5v5.5L16.5 14H13V8.5L15 4z" />
            <path d="M8 15.5h7v5.5H8z" />
          </svg>
          <svg
            v-else-if="item.id === 'todo'"
            viewBox="0 0 1024 1024"
            width="18"
            height="18"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M825.65 146.34c64.288 0 110.35 70.671 110.35 153.37v507.92l-0.014 2.478C935.076 891.736 889.296 961 825.65 961H154.351l-1.924-0.021C89.145 959.585 44 889.503 44 807.63V299.71l0.014-2.477c0.91-81.628 46.69-150.892 110.337-150.892 16.505 0 29.886 13.394 29.886 29.917 0 16.522-13.38 29.916-29.886 29.916l-0.739 0.012c-24.368 0.787-49.839 40.398-49.839 93.524v507.92l0.008 1.606c0.512 52.85 26.226 91.93 50.57 91.93h671.298l0.739-0.012c24.368-0.787 49.839-40.397 49.839-93.524V299.71l-0.008-1.605c-0.512-52.851-26.226-91.93-50.57-91.93l-0.705-0.009c-16.18-0.375-29.181-13.622-29.181-29.908 0-16.523 13.38-29.917 29.886-29.917z m-71.27 492.479c16.506 0 29.887 13.395 29.887 29.917 0 16.287-13.001 29.534-29.181 29.909l-0.706 0.008H225.62c-16.506 0-29.887-13.394-29.887-29.917 0-16.286 13.001-29.533 29.181-29.908l0.706-0.009h528.76z m0-231.28c16.506 0 29.887 13.394 29.887 29.917 0 16.286-13.001 29.533-29.181 29.909l-0.706 0.008H225.62c-16.506 0-29.887-13.395-29.887-29.917 0-16.287 13.001-29.534 29.181-29.909l0.706-0.008h528.76zM281.387 75c16.27-0.089 29.575 12.852 30.04 29.046l0.011 0.706 0.783 141.806c0.09 16.523-13.216 29.99-29.721 30.083-16.27 0.09-29.575-12.852-30.04-29.046l-0.012-0.706-0.783-141.806c-0.09-16.523 13.216-29.99 29.722-30.083z m400.02 0c16.27-0.089 29.576 12.852 30.04 29.046l0.012 0.706 0.783 141.806c0.09 16.523-13.216 29.99-29.722 30.083-16.27 0.09-29.575-12.852-30.039-29.046l-0.012-0.706-0.783-141.806c-0.09-16.523 13.216-29.99 29.722-30.083z m-78 71.34c16.505 0 29.886 13.395 29.886 29.918 0 16.286-13.001 29.533-29.181 29.908l-0.706 0.008H377.351c-16.506 0-29.887-13.394-29.887-29.916 0-16.287 13.001-29.534 29.181-29.91l0.706-0.007h226.055z" />
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
            <rect x="3" y="3" width="5" height="5" rx="1" />
            <rect x="10" y="3" width="5" height="5" rx="1" />
            <rect x="17" y="3" width="4" height="5" rx="1" />
            <rect x="3" y="10" width="5" height="5" rx="1" />
            <rect x="10" y="10" width="5" height="5" rx="1" />
            <rect x="17" y="10" width="4" height="5" rx="1" />
            <rect x="3" y="17" width="5" height="4" rx="1" />
            <rect x="10" y="17" width="5" height="4" rx="1" />
            <rect x="17" y="17" width="4" height="4" rx="1" />
          </svg>
          <svg
            v-else-if="item.id === 'ai'"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3c5 0 9 3.6 9 8s-4 8-9 8c-.9 0-1.8-.1-2.6-.3L3 21l1.8-4.2A7.7 7.7 0 0 1 3 11c0-4.4 4-8 9-8z" />
            <path d="M9.5 11h.01M14.5 11h.01" />
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
      </motion.button>
    </nav>

    <nav v-if="showSettingsNav" class="sidebar-nav sidebar-nav--footer" aria-label="设置">
      <motion.button
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeTab === 'settings' }"
        :aria-current="activeTab === 'settings' ? 'page' : undefined"
        :title="isCompactSidebar ? '设置' : undefined"
        :while-hover="navMotion.hover"
        :while-tap="navMotion.tap"
        @click="$emit('tab-change', 'settings')"
      >
        <motion.div
          v-if="activeTab === 'settings'"
          layout-id="sidebarActiveNav"
          class="nav-item-active-bg"
          :transition="navMotion.layout"
        />

        <span class="nav-item-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        <span class="nav-item-label">设置</span>
      </motion.button>
    </nav>
  </motion.aside>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { isUtoolsMode } from '../../storage/env'
import { useUtoolsCompactSidebar } from '../../composables/useUtoolsWindow'
import BrandArea from '../brand/BrandArea.vue'
import GlobalSearchModal from '../search/GlobalSearchModal.vue'

defineProps({
  activeTab: {
    type: String,
    default: 'home',
  },
})

const emit = defineEmits(['tab-change'])

const globalSearchVisible = ref(false)
const globalSearchModalRef = ref(null)

const openGlobalSearch = async (options = {}) => {
  const keyword =
    typeof options === 'string'
      ? options
      : options && typeof options.keyword === 'string'
        ? options.keyword
        : ''
  globalSearchVisible.value = true
  const text = String(keyword ?? '').trim()
  if (!text) return
  await nextTick()
  await nextTick()
  await globalSearchModalRef.value?.applySearchText?.(text)
}

defineExpose({ openGlobalSearch })

const showSettingsNav = isUtoolsMode()
const isCompactSidebar = useUtoolsCompactSidebar()

const navItems = [
  { id: 'home', label: '碎片' },
  { id: 'todo', label: '待办' },
  { id: 'ai', label: '问AI' },
  { id: 'sediment', label: '沉淀' },
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
  color: var(--color-primary);
}

.nav-item.is-active .nav-item-icon {
  color: var(--color-primary);
}

.nav-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.nav-item-active-bg {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.06);
  z-index: 0;
}

.sidebar-nav--footer {
  flex: 0 0 auto;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
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

  .nav-item-label {
    display: none;
  }

  .nav-item {
    justify-content: center;
    padding: 10px;
  }
}

/* uTools 主窗口：与窄屏相同的图标侧栏 */
.app-sidebar.is-compact {
  flex: 0 0 72px;
  width: 72px;
  padding: 16px 8px 20px;
}

.app-sidebar.is-compact .sidebar-search {
  padding: 0 0 14px;
}

.app-sidebar.is-compact .sidebar-search-field {
  justify-content: center;
  padding: 10px;
}

.app-sidebar.is-compact .sidebar-search-input {
  display: none;
}

.app-sidebar.is-compact .sidebar-brand {
  padding: 0 4px 14px;
}

.app-sidebar.is-compact .nav-item-label {
  display: none;
}

.app-sidebar.is-compact .nav-item {
  justify-content: center;
  padding: 10px;
}
</style>
