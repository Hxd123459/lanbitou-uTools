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
        @click="openCreateNoteModal"
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

    <p v-if="loading" class="sediment-state">加载中…</p>

    <motion.div v-else class="folder-grid-wrap">
      <ul class="folder-grid" role="list">
        <li
          v-for="item in folderItems"
          :key="`folder-${item.id}`"
          class="folder-grid-item"
        >
          <motion.button
            type="button"
            class="folder-card"
            :title="item.name"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            @click="enterFolder(item)"
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
            <span class="folder-name">{{ item.name }}</span>
          </motion.button>
        </li>

        <li
          v-for="item in noteItems"
          :key="`note-${item.id}`"
          class="folder-grid-item"
        >
          <div class="folder-card folder-card--note" :title="item.name">
            <span class="folder-icon-wrap folder-icon-wrap--note" aria-hidden="true">
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <span class="folder-name">{{ item.name }}</span>
          </div>
        </li>

        <li class="folder-grid-item">
          <motion.div
            v-if="creatingFolder"
            class="folder-create-form"
            role="group"
            aria-label="新建文件夹"
            :initial="presets.thumbPop.initial"
            :animate="presets.thumbPop.animate"
            :transition="presets.thumbPop.transition"
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
              :disabled="folderSaving"
              @keydown.esc.prevent="cancelCreateFolder"
              @keydown.enter.prevent="confirmCreateFolder"
              @blur="onFolderInputBlur"
            />
          </motion.div>

          <motion.button
            v-else
            type="button"
            class="folder-create"
            title="新建文件夹"
            :disabled="folderSaving"
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
    </motion.div>

    <StructNoteCreateModal
      :visible="createNoteVisible"
      :saving="noteSaving"
      @close="closeCreateNoteModal"
      @save="handleCreateNote"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { motion } from 'motion-v'
import {
  createNoteInFolder,
  createStructFolder,
  fetchFolderList,
} from '../../api/structFolder'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'
import StructNoteCreateModal from './StructNoteCreateModal.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['error'])

const { presets } = useMotionPresets()

const items = ref([])
const pathStack = ref([])
const loading = ref(false)
const folderSaving = ref(false)
const creatingFolder = ref(false)
const draftFolderName = ref('')
const folderNameInputRef = ref(null)

const createNoteVisible = ref(false)
const noteSaving = ref(false)

let loadToken = 0

const currentParentId = computed(() =>
  pathStack.value.length
    ? pathStack.value[pathStack.value.length - 1].id
    : 0,
)

const breadcrumbs = computed(() => [
  { id: null, label: '沉淀' },
  ...pathStack.value.map((item) => ({ id: item.id, label: item.name })),
])

const folderItems = computed(() =>
  items.value.filter((item) => item.type === 'folder'),
)

const noteItems = computed(() =>
  items.value.filter((item) => item.type === 'note'),
)

const loadCurrentList = async () => {
  const token = ++loadToken
  loading.value = true
  try {
    const list = await fetchFolderList(currentParentId.value)
    if (token !== loadToken) return
    items.value = list
  } catch (error) {
    if (token !== loadToken) return
    items.value = []
    emit('error', error)
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

const enterFolder = (folder) => {
  if (folder.type !== 'folder') return
  pathStack.value.push({ id: folder.id, name: folder.name })
  loadCurrentList()
}

const navigateToCrumb = (index) => {
  pathStack.value = pathStack.value.slice(0, index)
  loadCurrentList()
}

const startCreateFolder = async () => {
  creatingFolder.value = true
  draftFolderName.value = ''
  await nextTick()
  folderNameInputRef.value?.focus()
}

const cancelCreateFolder = () => {
  if (folderSaving.value) return
  creatingFolder.value = false
  draftFolderName.value = ''
}

const confirmCreateFolder = async () => {
  const name = draftFolderName.value.trim()
  if (!name || folderSaving.value) {
    cancelCreateFolder()
    return
  }

  folderSaving.value = true
  try {
    await createStructFolder({
      parentId: currentParentId.value,
      name,
    })
    cancelCreateFolder()
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  } finally {
    folderSaving.value = false
  }
}

const onFolderInputBlur = () => {
  if (draftFolderName.value.trim()) {
    confirmCreateFolder()
  } else {
    cancelCreateFolder()
  }
}

const openCreateNoteModal = () => {
  createNoteVisible.value = true
}

const closeCreateNoteModal = () => {
  if (noteSaving.value) return
  createNoteVisible.value = false
}

const handleCreateNote = async ({ title, content }) => {
  if (noteSaving.value) return
  noteSaving.value = true
  try {
    await createNoteInFolder({
      parentId: currentParentId.value,
      title,
      content,
    })
    createNoteVisible.value = false
    await loadCurrentList()
  } catch (error) {
    emit('error', error)
  } finally {
    noteSaving.value = false
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) loadCurrentList()
  },
  { immediate: true },
)
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

.sediment-state {
  margin: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
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

.folder-card--note {
  cursor: default;
}

.folder-card:hover .folder-icon-wrap {
  box-shadow: 0 6px 18px rgba(24, 24, 27, 0.1);
  border-color: rgba(37, 99, 235, 0.12);
}

.folder-card--note:hover .folder-icon-wrap {
  box-shadow: var(--shadow-card);
  border-color: rgba(24, 24, 27, 0.06);
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

.folder-icon-wrap--note {
  color: var(--color-accent);
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
