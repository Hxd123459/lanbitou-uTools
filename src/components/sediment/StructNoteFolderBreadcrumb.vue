<template>
  <nav class="struct-note-breadcrumb" aria-label="保存位置">
    <ol class="breadcrumb-list">
      <li
        v-for="(crumb, index) in breadcrumbs"
        :key="`${crumb.label}-${index}`"
        class="breadcrumb-item"
      >
        <motion.button
          v-if="index < breadcrumbs.length - 1"
          type="button"
          class="breadcrumb-link"
          :disabled="disabled"
          :while-hover="disabled ? undefined : presets.button.hover"
          :while-tap="disabled ? undefined : presets.button.tap"
          :transition="presets.button.transition"
          @click="navigateToCrumb(index)"
        >
          <svg
            v-if="index === 0"
            class="breadcrumb-folder-icon"
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
          </svg>
          {{ crumb.label }}
        </motion.button>
        <div
          v-else
          ref="currentCrumbRef"
          class="breadcrumb-current-wrap"
        >
          <span class="breadcrumb-current" aria-current="page">
            <svg
              v-if="index === 0"
              class="breadcrumb-folder-icon"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
            </svg>
            {{ crumb.label }}
          </span>
          <div class="breadcrumb-toggle-anchor">
            <button
              type="button"
              class="breadcrumb-folder-toggle"
              :class="{ 'is-open': folderMenuOpen }"
              :disabled="disabled"
              :aria-expanded="folderMenuOpen"
              aria-label="选择文件夹"
              @mousedown.prevent
              @click.stop="toggleFolderMenu"
            >
              <motion.svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
                :animate="{ rotate: folderMenuOpen ? 180 : 0 }"
                :transition="{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }"
              >
                <path d="M6 9l6 6 6-6" />
              </motion.svg>
            </button>

            <AnimatePresence>
              <motion.div
                v-if="folderMenuOpen"
                key="folder-menu"
                class="breadcrumb-folder-menu"
                role="listbox"
                aria-label="子文件夹"
                :initial="{ opacity: 0, y: -8, scale: 0.96 }"
                :animate="{ opacity: 1, y: 0, scale: 1 }"
                :exit="{ opacity: 0, y: -8, scale: 0.96 }"
                :transition="{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }"
                @mousedown.stop
              >
                <p v-if="folderMenuLoading" class="breadcrumb-folder-state">加载中…</p>
                <template v-else>
                  <p v-if="!folderMenuItems.length" class="breadcrumb-folder-state">暂无子文件夹</p>
                  <button
                    v-for="folder in folderMenuItems"
                    :key="folder.id"
                    type="button"
                    class="breadcrumb-folder-option"
                    :class="{ 'is-disabled': !canEnterSubfolder }"
                    :disabled="!canEnterSubfolder"
                    :title="canEnterSubfolder ? undefined : '最多支持两级文件夹'"
                    role="option"
                    @click="enterFolderFromMenu(folder)"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                    </svg>
                    <span>{{ folder.name }}</span>
                  </button>

                  <div v-if="creatingFolder && canCreateFolder" class="breadcrumb-folder-create">
                    <input
                      ref="folderNameInputRef"
                      v-model="draftFolderName"
                      class="breadcrumb-folder-input"
                      type="text"
                      maxlength="40"
                      placeholder="文件夹名称"
                      :disabled="folderCreating"
                      @keydown.enter.prevent="confirmCreateFolder"
                      @keydown.esc.prevent="cancelCreateFolder"
                      @blur="onFolderInputBlur"
                    />
                  </div>
                  <button
                    v-else
                    type="button"
                    class="breadcrumb-folder-create-btn"
                    :class="{ 'is-disabled': !canCreateFolder }"
                    :disabled="!canCreateFolder"
                    :title="canCreateFolder ? '新建文件夹' : '最多支持两级文件夹嵌套'"
                    @click="startCreateFolder"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
                      <line x1="12" y1="11" x2="12" y2="17" />
                      <line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                    <span>新建文件夹</span>
                  </button>
                </template>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <span
          v-if="index < breadcrumbs.length - 1"
          class="breadcrumb-sep"
          aria-hidden="true"
        >
          /
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { createStructFolder, fetchFolderList } from '../../api/structFolder'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  pathStack: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:pathStack'])

const { presets } = useMotionPresets()

const folderMenuOpen = ref(false)
const folderMenuLoading = ref(false)
const folderMenuItems = ref([])
const currentCrumbRef = ref(null)
const creatingFolder = ref(false)
const draftFolderName = ref('')
const folderCreating = ref(false)
const folderNameInputRef = ref(null)

const currentParentId = computed(() => {
  const last = props.pathStack[props.pathStack.length - 1]
  return last?.id ?? 0
})

/** 根=0；最多两级嵌套，pathStack.length >= 2 时不可再建 */
const MAX_FOLDER_DEPTH = 2
const canCreateFolder = computed(() => props.pathStack.length < MAX_FOLDER_DEPTH)
const canEnterSubfolder = computed(() => props.pathStack.length < MAX_FOLDER_DEPTH)

const breadcrumbs = computed(() => [
  { id: null, label: '沉淀' },
  ...props.pathStack.map((item) => ({ id: item.id, label: item.name })),
])

const closeFolderMenu = () => {
  folderMenuOpen.value = false
  creatingFolder.value = false
  draftFolderName.value = ''
}

const navigateToCrumb = (index) => {
  if (props.disabled) return
  closeFolderMenu()
  emit('update:pathStack', props.pathStack.slice(0, index))
}

const loadFolderMenuItems = async (parentId = currentParentId.value) => {
  folderMenuLoading.value = true
  try {
    const list = await fetchFolderList(parentId)
    folderMenuItems.value = list.filter((item) => item.type === 'folder')
  } catch {
    folderMenuItems.value = []
  } finally {
    folderMenuLoading.value = false
  }
}

const toggleFolderMenu = async () => {
  if (props.disabled) return
  if (folderMenuOpen.value) {
    closeFolderMenu()
    return
  }
  folderMenuOpen.value = true
  await loadFolderMenuItems()
}

const enterFolderFromMenu = async (folder) => {
  if (folder.type !== 'folder') return
  if (!canEnterSubfolder.value) return
  emit('update:pathStack', [...props.pathStack, { id: folder.id, name: folder.name }])
  creatingFolder.value = false
  draftFolderName.value = ''
  // props.pathStack 异步更新，直接用目标文件夹 id 加载子目录
  await loadFolderMenuItems(folder.id)
}

const startCreateFolder = async () => {
  if (!canCreateFolder.value) return
  creatingFolder.value = true
  draftFolderName.value = ''
  await nextTick()
  folderNameInputRef.value?.focus()
}

const cancelCreateFolder = () => {
  if (folderCreating.value) return
  creatingFolder.value = false
  draftFolderName.value = ''
}

const onFolderInputBlur = () => {
  if (folderCreating.value) return
  cancelCreateFolder()
}

const confirmCreateFolder = async () => {
  const name = draftFolderName.value.trim()
  if (!name || folderCreating.value || !canCreateFolder.value) {
    cancelCreateFolder()
    return
  }

  folderCreating.value = true
  try {
    await createStructFolder({
      parentId: currentParentId.value,
      name,
    })
    creatingFolder.value = false
    draftFolderName.value = ''
    await loadFolderMenuItems()
  } catch {
    cancelCreateFolder()
  } finally {
    folderCreating.value = false
  }
}

const onDocumentPointerdown = (event) => {
  if (!folderMenuOpen.value) return
  const anchor = Array.isArray(currentCrumbRef.value)
    ? currentCrumbRef.value[0]
    : currentCrumbRef.value
  if (anchor?.contains(event.target)) return
  closeFolderMenu()
}

const handleEscape = () => {
  if (creatingFolder.value) {
    cancelCreateFolder()
    return true
  }
  if (folderMenuOpen.value) {
    closeFolderMenu()
    return true
  }
  return false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerdown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerdown)
})

defineExpose({
  closeFolderMenu,
  handleEscape,
  currentParentId,
})
</script>

<style scoped>
.struct-note-breadcrumb {
  min-width: 0;
  justify-self: center;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.breadcrumb-link,
.breadcrumb-current {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.breadcrumb-link {
  border: 0;
  background: transparent;
  padding: 2px 4px;
  border-radius: 6px;
  color: var(--color-secondary-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.breadcrumb-link:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-primary);
}

.breadcrumb-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.breadcrumb-folder-icon {
  flex: 0 0 auto;
  color: var(--color-secondary-text);
}

.breadcrumb-current-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.breadcrumb-current {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.breadcrumb-toggle-anchor {
  position: relative;
  flex: 0 0 auto;
}

.breadcrumb-folder-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
  outline: none;
  box-shadow: none;
  -webkit-tap-highlight-color: transparent;
}

.breadcrumb-folder-toggle:hover:not(:disabled),
.breadcrumb-folder-toggle.is-open {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
}

.breadcrumb-folder-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.breadcrumb-folder-toggle:focus,
.breadcrumb-folder-toggle:focus-visible,
.breadcrumb-folder-toggle:active {
  outline: none !important;
  box-shadow: none !important;
  border: 0;
}

.breadcrumb-folder-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 5;
  min-width: 196px;
  max-width: min(280px, 70vw);
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  transform-origin: top left;
}

.breadcrumb-folder-state {
  margin: 0;
  padding: 8px 10px;
  color: var(--color-secondary-text);
  font-size: 13px;
}

.breadcrumb-folder-option,
.breadcrumb-folder-create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.breadcrumb-folder-option:hover,
.breadcrumb-folder-create-btn:hover {
  background: rgba(24, 24, 27, 0.05);
}

.breadcrumb-folder-option.is-disabled,
.breadcrumb-folder-option:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.breadcrumb-folder-option.is-disabled:hover,
.breadcrumb-folder-option:disabled:hover {
  background: transparent;
}

.breadcrumb-folder-option span,
.breadcrumb-folder-create-btn span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-folder-create {
  padding: 4px 6px 2px;
}

.breadcrumb-folder-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-primary);
  background: #fff;
  outline: none;
}

.breadcrumb-folder-input:focus {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.breadcrumb-folder-create-btn {
  margin-top: 2px;
  color: var(--color-accent);
}

.breadcrumb-folder-create-btn.is-disabled,
.breadcrumb-folder-create-btn:disabled {
  color: #a1a1aa;
  cursor: not-allowed;
  opacity: 0.55;
}

.breadcrumb-folder-create-btn.is-disabled:hover,
.breadcrumb-folder-create-btn:disabled:hover {
  background: transparent;
}

.breadcrumb-sep {
  color: #a1a1aa;
  font-size: 12px;
  user-select: none;
}
</style>
