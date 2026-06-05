<template>
  <section class="tag-cloud-panel" aria-label="标签云" @click="onPanelClick">
    <p v-if="loading" class="tag-cloud-status">加载标签中…</p>
    <p v-else-if="error" class="tag-cloud-status tag-cloud-status--error">
      {{ error }}
    </p>

    <div v-else class="tag-cloud" role="list">
      <p v-if="!tags.length && !adding" class="tag-cloud-empty">暂无标签，点击 + 添加</p>

      <div
        v-for="(tag, index) in tags"
        :key="tag.tagId"
        class="tag-cloud-item-wrap"
        role="listitem"
        :class="{
          'is-action-open': actionTagId === tag.tagId,
          'is-editing': editingTagId === tag.tagId,
          'is-deleting': deletingTagId === tag.tagId,
        }"
        @contextmenu.prevent="openActionMenu(tag)"
      >
        <div
          v-if="deletingTagId === tag.tagId"
          class="tag-delete-confirm"
          @click.stop
        >
          <span class="tag-delete-text">删除「{{ tag.tagName }}」？</span>
          <div class="tag-delete-actions">
            <motion.button
              type="button"
              class="tag-delete-btn tag-delete-btn--yes"
              :disabled="deleteSaving"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="confirmDelete(tag)"
            >
              {{ deleteSaving ? '删除中…' : '删除' }}
            </motion.button>
            <motion.button
              type="button"
              class="tag-delete-btn tag-delete-btn--no"
              :disabled="deleteSaving"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="cancelDelete"
            >
              取消
            </motion.button>
          </div>
        </div>

        <div
          v-else-if="editingTagId === tag.tagId"
          class="tag-cloud-edit-chip"
          @click.stop
        >
          <input
            :ref="(el) => bindEditInput(el, tag.tagId)"
            v-model="draftEdit"
            type="text"
            class="tag-cloud-edit-input"
            maxlength="5"
            aria-label="编辑标签名称"
            :disabled="editSaving"
            @keydown.enter.prevent="confirmEdit"
            @keydown.esc.prevent="cancelEdit"
            @blur="onEditBlur"
          />
        </div>

        <motion.button
          v-else
          type="button"
          class="tag-cloud-item"
          :class="{ 'is-action-open': actionTagId === tag.tagId }"
          :title="`${tag.tagName} · ${tag.noteCount} 条笔记`"
          :initial="presets.reveal.initial"
          :animate="presets.reveal.animate"
          :transition="{ ...presets.reveal.transition, delay: Math.min(index * 0.02, 0.24) }"
          @click="onTagClick(tag)"
        >
          <span class="tag-cloud-name">{{ tag.tagName }}</span>
          <span class="tag-cloud-count">{{ tag.noteCount }}</span>

          <AnimatePresence>
            <motion.div
              v-if="actionTagId === tag.tagId"
              key="actions"
              class="tag-item-actions"
              role="toolbar"
              aria-label="标签操作"
              :initial="actionToolbarMotion.initial"
              :animate="actionToolbarMotion.animate"
              :exit="actionToolbarMotion.exit"
              :transition="actionToolbarMotion.transition"
              @click.stop
              @mousedown.stop
              @contextmenu.stop
            >
              <motion.button
                type="button"
                class="tag-action-btn"
                title="修改"
                aria-label="修改标签"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="startEdit(tag)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </motion.button>
              <motion.button
                type="button"
                class="tag-action-btn tag-action-btn--danger"
                title="删除"
                aria-label="删除标签"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="startDelete(tag)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      <div v-if="adding" class="tag-cloud-add-chip" role="listitem">
        <input
          ref="addInputRef"
          v-model="draftTag"
          type="text"
          class="tag-cloud-add-input"
          maxlength="5"
          placeholder="标签"
          aria-label="新标签名称"
          :disabled="creating"
          @keydown.enter.prevent="submitTag"
          @keydown.esc.prevent="cancelAdd"
          @blur="onAddBlur"
        />
      </div>

      <AppButton
        v-else-if="canAddTag"
        type="button"
        class="btn btn-primary tag-cloud-add-btn"
        aria-label="添加标签"
        @click="startAdd"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </AppButton>
    </div>

    <p v-if="inlineError" class="tag-cloud-inline-error">{{ inlineError }}</p>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { ApiError } from '../../api/http'
import { createTag, deleteTag, fetchAllTags, updateTag } from '../../api/note'
import { isUtoolsMode } from '../../storage/env'
import { invalidateTagList } from '../../composables/tagListSync'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'deleted', 'updated'])

const { presets } = useMotionPresets()

const actionToolbarMotion = {
  initial: { opacity: 0, x: -6, scale: 0.94 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -4, scale: 0.97 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

const loading = ref(false)
const error = ref('')
const inlineError = ref('')
const creating = ref(false)
const adding = ref(false)
const draftTag = ref('')
const tags = ref([])
const addInputRef = ref(null)
const editInputRef = ref(null)

const resolveInputEl = (el) => {
  if (!el) return null
  if (Array.isArray(el)) return el.find((item) => item instanceof HTMLInputElement) ?? el[0] ?? null
  return el
}

const bindEditInput = (el, tagId) => {
  if (editingTagId.value === tagId) {
    editInputRef.value = el
  }
}

const focusEditInput = async () => {
  await nextTick()
  const input = resolveInputEl(editInputRef.value)
  if (!input || typeof input.focus !== 'function') return
  input.focus()
  if (typeof input.select === 'function') input.select()
}
const actionTagId = ref(null)
const editingTagId = ref(null)
const deletingTagId = ref(null)
const draftEdit = ref('')
const editSaving = ref(false)
const deleteSaving = ref(false)
let loadToken = 0
let blurTimer = 0
let editBlurTimer = 0

const canAddTag = computed(() => isUtoolsMode())

const resetTransientState = () => {
  window.clearTimeout(blurTimer)
  window.clearTimeout(editBlurTimer)
  actionTagId.value = null
  editingTagId.value = null
  deletingTagId.value = null
  draftEdit.value = ''
  inlineError.value = ''
  cancelAdd()
}

const closeActionMenu = () => {
  actionTagId.value = null
}

const openActionMenu = (tag) => {
  if (!canAddTag.value) return
  if (editingTagId.value != null || deletingTagId.value != null) return
  inlineError.value = ''
  actionTagId.value = tag.tagId
}

const onPanelClick = (event) => {
  if (actionTagId.value == null) return
  if (event.target.closest('.tag-cloud-item.is-action-open')) return
  closeActionMenu()
}

const onTagClick = (tag) => {
  if (actionTagId.value === tag.tagId) {
    closeActionMenu()
    return
  }
  if (actionTagId.value != null) {
    closeActionMenu()
    return
  }
  emit('select', tag)
}

const loadTags = async () => {
  const token = ++loadToken
  loading.value = true
  error.value = ''
  try {
    const data = await fetchAllTags()
    if (token !== loadToken) return
    tags.value = data.map((item) => ({
      tagId: String(item.tagId ?? ''),
      tagName: item.tagName || '未命名',
      noteCount: String(item.noteCount ?? '0'),
    }))
  } catch (err) {
    if (token !== loadToken) return
    tags.value = []
    if (err instanceof ApiError) {
      error.value = `[${err.code}] ${err.msg}`
    } else {
      error.value = err?.message || '加载失败'
    }
  } finally {
    if (token === loadToken) loading.value = false
  }
}

const startAdd = async () => {
  inlineError.value = ''
  closeActionMenu()
  adding.value = true
  draftTag.value = ''
  await nextTick()
  addInputRef.value?.focus()
}

const cancelAdd = () => {
  window.clearTimeout(blurTimer)
  adding.value = false
  draftTag.value = ''
}

const onAddBlur = () => {
  window.clearTimeout(blurTimer)
  blurTimer = window.setTimeout(() => {
    if (!draftTag.value.trim()) cancelAdd()
  }, 120)
}

const submitTag = async () => {
  const name = draftTag.value.trim()
  if (!name || creating.value) {
    if (!name) cancelAdd()
    return
  }

  creating.value = true
  inlineError.value = ''
  try {
    await createTag(name)
    cancelAdd()
    await loadTags()
    invalidateTagList()
  } catch (err) {
    if (err instanceof ApiError) {
      inlineError.value = `[${err.code}] ${err.msg}`
    } else {
      inlineError.value = err?.message || '添加失败'
    }
    await nextTick()
    addInputRef.value?.focus()
  } finally {
    creating.value = false
  }
}

const startEdit = async (tag) => {
  closeActionMenu()
  deletingTagId.value = null
  editingTagId.value = tag.tagId
  draftEdit.value = tag.tagName
  inlineError.value = ''
  await focusEditInput()
}

const cancelEdit = () => {
  window.clearTimeout(editBlurTimer)
  editingTagId.value = null
  draftEdit.value = ''
  editInputRef.value = null
}

const onEditBlur = () => {
  window.clearTimeout(editBlurTimer)
  editBlurTimer = window.setTimeout(() => {
    if (!draftEdit.value.trim()) cancelEdit()
  }, 120)
}

const confirmEdit = async () => {
  const tagId = editingTagId.value
  const name = draftEdit.value.trim()
  if (!tagId || editSaving.value) return

  const current = tags.value.find((item) => item.tagId === tagId)
  if (!name) {
    cancelEdit()
    return
  }
  if (current && current.tagName === name) {
    cancelEdit()
    return
  }

  editSaving.value = true
  inlineError.value = ''
  try {
    const result = await updateTag(tagId, name)
    cancelEdit()
    await loadTags()
    invalidateTagList()
    emit('updated', result)
  } catch (err) {
    if (err instanceof ApiError) {
      inlineError.value = `[${err.code}] ${err.msg}`
    } else {
      inlineError.value = err?.message || '修改失败'
    }
    await focusEditInput()
  } finally {
    editSaving.value = false
  }
}

const startDelete = (tag) => {
  closeActionMenu()
  editingTagId.value = null
  deletingTagId.value = tag.tagId
  inlineError.value = ''
}

const cancelDelete = () => {
  deletingTagId.value = null
}

const confirmDelete = async (tag) => {
  if (deleteSaving.value) return
  deleteSaving.value = true
  inlineError.value = ''
  try {
    await deleteTag(tag.tagId)
    cancelDelete()
    await loadTags()
    invalidateTagList()
    emit('deleted', tag)
  } catch (err) {
    if (err instanceof ApiError) {
      inlineError.value = `[${err.code}] ${err.msg}`
    } else {
      inlineError.value = err?.message || '删除失败'
    }
  } finally {
    deleteSaving.value = false
  }
}

watch(
  () => props.active,
  (on) => {
    if (on) loadTags()
    else resetTransientState()
  },
)

onMounted(() => {
  if (props.active) loadTags()
})

onBeforeUnmount(() => {
  window.clearTimeout(blurTimer)
  window.clearTimeout(editBlurTimer)
})

defineExpose({ reload: loadTags })
</script>

<style scoped>
.tag-cloud-panel {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  padding: 8px 4px 28px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: rgba(24, 24, 27, 0.18) transparent;
}

.tag-cloud-status {
  margin: 48px 0;
  text-align: center;
  color: var(--color-secondary-text);
  font-size: 14px;
}

.tag-cloud-status--error {
  color: var(--color-error);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px 10px;
  padding: 12px 0 8px;
  min-height: 120px;
}

.tag-cloud-empty {
  width: 100%;
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.tag-cloud-item-wrap {
  flex: 0 0 auto;
}

.tag-cloud-item-wrap.is-action-open .tag-cloud-item {
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.tag-cloud-item,
.tag-cloud-add-chip,
.tag-cloud-add-btn,
.tag-cloud-edit-chip,
.tag-delete-confirm {
  flex: 0 0 auto;
}

.tag-cloud-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  cursor: pointer;
  font-family: inherit;
}

.tag-cloud-item:hover {
  border-color: rgba(24, 24, 27, 0.22);
  color: var(--color-primary);
}

.tag-cloud-count {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
}

.tag-cloud-item:hover .tag-cloud-count {
  color: var(--color-primary);
  background: rgba(24, 24, 27, 0.1);
}

.tag-item-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
  padding-left: 4px;
  border-left: 1px solid var(--color-border);
}

.tag-action-btn {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 7px;
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-secondary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.tag-action-btn:hover {
  background: #fff;
  color: var(--color-primary);
}

.tag-action-btn--danger:hover {
  color: #ef4444;
}

.tag-cloud-edit-chip,
.tag-cloud-add-chip {
  display: inline-flex;
  align-items: center;
  min-width: 72px;
  height: 32px;
  padding: 0 10px;
  border: 1px dashed var(--btn-dashed-border);
  border-radius: 999px;
  background: var(--color-surface);
}

.tag-cloud-edit-chip:focus-within,
.tag-cloud-add-chip:focus-within {
  border-color: var(--btn-dashed-border-focus);
  box-shadow: var(--focus-ring);
}

.tag-cloud-edit-input,
.tag-cloud-add-input {
  width: 64px;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  outline: none;
}

.tag-cloud-edit-input::placeholder,
.tag-cloud-add-input::placeholder {
  color: #a1a1aa;
  font-weight: 400;
}

.tag-delete-confirm {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 4px 8px 4px 12px;
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: 999px;
  background: #fef2f2;
}

.tag-delete-text {
  font-size: 12px;
  font-weight: 500;
  color: #b91c1c;
  white-space: nowrap;
}

.tag-delete-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-delete-btn {
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.tag-delete-btn--yes {
  background: #ef4444;
  color: #fff;
}

.tag-delete-btn--yes:hover:not(:disabled) {
  background: #dc2626;
}

.tag-delete-btn--no {
  background: #fff;
  color: var(--color-secondary-text);
}

.tag-delete-btn--no:hover:not(:disabled) {
  color: var(--color-primary);
}

.tag-cloud-add-btn {
  width: auto;
  min-width: 44px;
  height: 28px;
  padding: 0 14px;
  border-radius: 999px;
  border: 0;
}

.tag-cloud-inline-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--color-error);
}
</style>
