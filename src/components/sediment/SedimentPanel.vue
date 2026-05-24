<template>
  <section class="sediment-panel">
    <header class="sediment-header">
      <nav class="sediment-breadcrumb" aria-label="面包屑">
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
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="navigateToCrumb(index)"
            >
              {{ crumb.label }}
            </motion.button>
            <span v-else class="breadcrumb-current" aria-current="page">
              {{ crumb.label }}
            </span>
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

      <AppButton
        class="btn btn-icon-text sediment-create-file"
        title="新建文件"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <span>新建文件</span>
      </AppButton>
    </header>

    <div class="folder-grid-wrap">
      <ul class="folder-grid" role="list">
        <li
          v-for="folder in currentFolders"
          :key="folder.id"
          class="folder-grid-item"
        >
          <motion.button
            type="button"
            class="folder-card"
            :title="folder.name"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            @click="enterFolder(folder)"
          >
            <span class="folder-icon-wrap" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="34"
                height="34"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
                />
              </svg>
            </span>
            <span class="folder-name">{{ folder.name }}</span>
          </motion.button>
        </li>

        <li class="folder-grid-item">
          <div
            v-if="creatingFolder"
            class="folder-create-form"
            role="group"
            aria-label="新建文件夹"
          >
            <span class="folder-icon-wrap folder-icon-wrap--draft" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="34"
                height="34"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
                />
              </svg>
            </span>
            <input
              ref="folderNameInputRef"
              v-model="draftFolderName"
              class="folder-name-input"
              type="text"
              maxlength="20"
              placeholder="文件夹名称"
              spellcheck="false"
              @keydown.esc.prevent="cancelCreateFolder"
              @keydown.enter.prevent="confirmCreateFolder"
              @blur="onFolderInputBlur"
            />
          </div>

          <motion.button
            v-else
            type="button"
            class="folder-create"
            title="新建文件夹"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            @click="startCreateFolder"
          >
            <span class="folder-create-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
                />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </span>
            <span class="folder-create-label">新建文件夹</span>
          </motion.button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'

const { presets } = useMotionPresets()

const MOCK_TREE = [
  {
    id: 'mock-work',
    name: '工作笔记',
    children: [
      { id: 'mock-work-a', name: '项目 A', children: [] },
      { id: 'mock-work-meeting', name: '会议记录', children: [] },
    ],
  },
  {
    id: 'mock-ideas',
    name: '个人灵感',
    children: [],
  },
  {
    id: 'mock-read',
    name: '读书笔记',
    children: [
      { id: 'mock-read-2025', name: '2025', children: [] },
    ],
  },
]

function cloneTree(nodes) {
  return nodes.map((node) => ({
    ...node,
    children: cloneTree(node.children || []),
  }))
}

// 模块级缓存：切换 tab 保留，刷新页面消失
const folderTree = ref(cloneTree(MOCK_TREE))
const pathStack = ref([])

const creatingFolder = ref(false)
const draftFolderName = ref('')
const folderNameInputRef = ref(null)

const breadcrumbs = computed(() => [
  { id: null, label: '沉淀' },
  ...pathStack.value.map((item) => ({ id: item.id, label: item.name })),
])

const currentFolders = computed(() => {
  let nodes = folderTree.value
  for (const segment of pathStack.value) {
    const matched = nodes.find((folder) => folder.id === segment.id)
    if (!matched) return []
    nodes = matched.children
  }
  return nodes
})

const getCurrentContainer = () => {
  let nodes = folderTree.value
  for (const segment of pathStack.value) {
    const matched = nodes.find((folder) => folder.id === segment.id)
    if (!matched) return nodes
    nodes = matched.children
  }
  return nodes
}

const enterFolder = (folder) => {
  pathStack.value.push({ id: folder.id, name: folder.name })
}

const navigateToCrumb = (index) => {
  pathStack.value = pathStack.value.slice(0, index)
}

const startCreateFolder = async () => {
  creatingFolder.value = true
  draftFolderName.value = ''
  await nextTick()
  folderNameInputRef.value?.focus()
}

const cancelCreateFolder = () => {
  creatingFolder.value = false
  draftFolderName.value = ''
}

const confirmCreateFolder = () => {
  const name = draftFolderName.value.trim()
  if (!name) {
    cancelCreateFolder()
    return
  }

  getCurrentContainer().push({
    id: `session-${Date.now()}`,
    name,
    children: [],
  })

  cancelCreateFolder()
}

const onFolderInputBlur = () => {
  if (draftFolderName.value.trim()) {
    confirmCreateFolder()
  } else {
    cancelCreateFolder()
  }
}
</script>

<style scoped>
.sediment-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: var(--frame-inner-width);
  padding-top: 22px;
}

.sediment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 24px;
  flex: 0 0 auto;
}

.sediment-breadcrumb {
  min-width: 0;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.breadcrumb-link:hover {
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-primary);
}

.breadcrumb-current {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.breadcrumb-sep {
  color: #a1a1aa;
  font-size: 12px;
  user-select: none;
}

.sediment-create-file {
  flex: 0 0 auto;
}

.folder-grid-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 28px;
  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.18) transparent;
}

.folder-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 18px 22px;
  margin: 0;
  padding: 8px 0 0;
  list-style: none;
}

.folder-grid-item {
  flex: 0 0 auto;
}

.folder-card,
.folder-create,
.folder-create-form {
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.folder-card {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: center;
}

.folder-card:hover .folder-icon-wrap {
  box-shadow: 0 6px 18px rgba(24, 24, 27, 0.1);
  border-color: rgba(37, 99, 235, 0.12);
}

.folder-card:focus-visible {
  outline: none;
}

.folder-card:focus-visible .folder-icon-wrap {
  box-shadow: var(--focus-ring), var(--shadow-card);
}

.folder-icon-wrap {
  width: 72px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: 1px solid rgba(24, 24, 27, 0.06);
  background: #ffffff;
  color: #ca8a04;
  box-shadow: var(--shadow-card);
}

.folder-icon-wrap--draft {
  color: #a1a1aa;
  border-style: dashed;
  border-color: var(--btn-dashed-border);
  box-shadow: none;
}

.folder-name {
  width: 100%;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-create {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.folder-create-icon {
  width: 72px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  border: 1.5px dashed var(--btn-dashed-border);
  background: rgba(255, 255, 255, 0.55);
  color: var(--color-secondary-text);
}

.folder-create:hover .folder-create-icon {
  border-color: var(--btn-dashed-border-hover);
  background: var(--btn-dashed-bg-hover);
  color: var(--color-primary);
}

.folder-create:focus-visible {
  outline: none;
}

.folder-create:focus-visible .folder-create-icon {
  border-color: var(--btn-dashed-border-focus);
  box-shadow: var(--focus-ring);
}

.folder-create-label {
  width: 100%;
  color: var(--color-secondary-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.folder-create-form {
  align-items: stretch;
}

.folder-name-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-text);
  font-family: inherit;
  font-size: 12px;
  text-align: center;
  outline: none;
}

.folder-name-input:focus {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.folder-name-input::placeholder {
  color: #a1a1aa;
}

@media (max-width: 720px) {
  .sediment-panel {
    padding-top: 16px;
  }

  .sediment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 18px;
  }

  .sediment-create-file {
    align-self: flex-end;
  }

  .folder-grid {
    gap: 14px 16px;
  }
}
</style>
