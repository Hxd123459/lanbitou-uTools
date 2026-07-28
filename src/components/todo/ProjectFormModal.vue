<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="project-form-modal"
        class="project-form-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="isEdit ? '编辑事情' : '新建事情'"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.18 }"
      >
        <motion.div
          class="project-form-modal-backdrop"
          aria-hidden="true"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          @click="emit('close')"
        />

        <motion.form
          class="project-form-modal-card"
          :initial="{ opacity: 0, y: 16, scale: 0.98 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: 12, scale: 0.98 }"
          :transition="{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }"
          @submit.prevent="handleSubmit"
        >
          <h3 class="project-form-modal-title">{{ isEdit ? '编辑事情' : '新建事情' }}</h3>

          <label class="project-form-modal-field">
            <span class="project-form-modal-label">名称</span>
            <input
              ref="nameInputRef"
              v-model="name"
              class="project-form-modal-input"
              type="text"
              maxlength="40"
              placeholder="例如：产品上线准备"
              :disabled="saving"
              @keydown.esc.prevent="emit('close')"
            />
          </label>

          <div class="project-form-modal-field">
            <span class="project-form-modal-label">起止时间</span>
            <DateRangePicker
              v-model:date-from="startAt"
              v-model:date-to="endAt"
              :panel-compact="true"
            />
          </div>

          <div class="project-form-modal-field">
            <span class="project-form-modal-label">本地项目路径</span>
            <p class="project-form-modal-hint">关联后可用 Cursor 结合代码提取/执行待办</p>
            <div class="project-form-path-row">
              <input
                v-model="localPath"
                class="project-form-modal-input"
                type="text"
                placeholder="例如：C:\workspace\codes\my-app"
                :disabled="saving"
              />
              <AppButton
                type="button"
                class="btn btn-icon-text project-form-path-btn"
                :disabled="saving"
                @click="pickLocalPath"
              >
                选择
              </AppButton>
              <AppButton
                v-if="localPath"
                type="button"
                class="btn btn-icon-text project-form-path-btn"
                :disabled="saving"
                @click="localPath = ''"
              >
                清除
              </AppButton>
            </div>
          </div>

          <div class="project-form-modal-field">
            <span class="project-form-modal-label">沉淀文件夹</span>
            <p class="project-form-modal-hint">
              {{
                sedimentFolderId
                  ? `已关联沉淀文件夹（保存后与事情同名同步）`
                  : '保存时会在沉淀根目录自动创建同名文件夹，专门收纳这件事的产出'
              }}
            </p>
          </div>

          <label class="project-form-modal-field">
            <span class="project-form-modal-label">为什么做 / 初衷</span>
            <textarea
              v-model="purpose"
              class="project-form-modal-textarea"
              rows="2"
              maxlength="2000"
              placeholder="这件事要解决什么问题？"
              :disabled="saving"
            />
          </label>

          <label class="project-form-modal-field">
            <span class="project-form-modal-label">怎样算值了</span>
            <textarea
              v-model="successLooksLike"
              class="project-form-modal-textarea"
              rows="2"
              maxlength="2000"
              placeholder="成功时用户能感知到什么？"
              :disabled="saving"
            />
          </label>

          <label class="project-form-modal-field">
            <span class="project-form-modal-label">明确不做</span>
            <textarea
              v-model="outOfScope"
              class="project-form-modal-textarea"
              rows="2"
              maxlength="2000"
              placeholder="本期刻意不做的范围"
              :disabled="saving"
            />
          </label>

          <div class="project-form-modal-field">
            <span class="project-form-modal-label">同步标签（最多 {{ MAX_TAGS_PER_PROJECT }} 个）</span>
            <p class="project-form-modal-hint">绑定标签后，可从对应碎片自动提取待办</p>
            <p v-if="loadingTags" class="project-form-modal-hint">加载标签中…</p>
            <div v-else-if="!tags.length" class="project-form-modal-hint">暂无标签，可先去碎片里打标</div>
            <div v-else class="project-form-tag-list" role="group" aria-label="选择同步标签">
              <button
                v-for="tag in tags"
                :key="tag.tagId"
                type="button"
                class="project-form-tag"
                :class="{ 'is-selected': selectedTagIds.includes(String(tag.tagId)) }"
                :disabled="saving || isTagDisabled(tag.tagId)"
                @click="toggleTag(tag.tagId)"
              >
                #{{ tag.tagName }}
              </button>
            </div>
          </div>

          <p v-if="errorText" class="project-form-modal-error">{{ errorText }}</p>

          <div class="project-form-modal-actions">
            <AppButton class="btn btn-icon-text project-form-modal-btn" type="button" :disabled="saving" @click="emit('close')">
              取消
            </AppButton>
            <AppButton class="btn btn-primary project-form-modal-btn" type="submit" :disabled="saving || !canSubmit">
              {{ saving ? '保存中…' : '保存' }}
            </AppButton>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import AppButton from '../motion/AppButton.vue'
import DateRangePicker from '../common/DateRangePicker.vue'
import { fetchAllTags } from '../../api/note'
import { pickDirectory } from '../../api/agentBridge'
import { formatDateTime } from '../../storage/utools/utils'
import { MAX_TAGS_PER_PROJECT } from '../../constants/todoLimits'

const props = defineProps({
  visible: { type: Boolean, default: false },
  project: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'submit'])

const name = ref('')
const startAt = ref('')
const endAt = ref('')
const localPath = ref('')
const sedimentFolderId = ref('')
const purpose = ref('')
const successLooksLike = ref('')
const outOfScope = ref('')
const selectedTagIds = ref([])
const tags = ref([])
const loadingTags = ref(false)
const errorText = ref('')
const nameInputRef = ref(null)

const isEdit = computed(() => Boolean(props.project?.id))
const canSubmit = computed(() => String(name.value || '').trim().length > 0)

const pickLocalPath = async () => {
  try {
    const dir = await pickDirectory()
    if (dir) localPath.value = dir
  } catch (error) {
    errorText.value = error?.message || '选择目录失败'
  }
}

const isTagDisabled = (tagId) => {
  const id = String(tagId)
  if (selectedTagIds.value.includes(id)) return false
  return selectedTagIds.value.length >= MAX_TAGS_PER_PROJECT
}

const toggleTag = (tagId) => {
  const id = String(tagId)
  const set = new Set(selectedTagIds.value)
  if (set.has(id)) {
    set.delete(id)
  } else {
    if (set.size >= MAX_TAGS_PER_PROJECT) {
      errorText.value = `一件事情最多绑定 ${MAX_TAGS_PER_PROJECT} 个标签`
      return
    }
    set.add(id)
  }
  selectedTagIds.value = [...set]
  errorText.value = ''
}

const loadTags = async () => {
  loadingTags.value = true
  try {
    const list = await fetchAllTags()
    tags.value = Array.isArray(list) ? list : []
  } catch {
    tags.value = []
  } finally {
    loadingTags.value = false
  }
}

const resetForm = () => {
  name.value = props.project?.name || ''
  startAt.value = props.project?.startAt || formatDateTime().slice(0, 10)
  endAt.value = props.project?.endAt || ''
  localPath.value = props.project?.localPath || ''
  sedimentFolderId.value = props.project?.sedimentFolderId || ''
  purpose.value = props.project?.purpose || ''
  successLooksLike.value = props.project?.successLooksLike || ''
  outOfScope.value = props.project?.outOfScope || ''
  selectedTagIds.value = Array.isArray(props.project?.tagIds)
    ? props.project.tagIds.map(String)
    : []
  errorText.value = ''
}

const handleSubmit = () => {
  const trimmed = String(name.value || '').trim()
  if (!trimmed) {
    errorText.value = '请填写事情名称'
    return
  }
  if (startAt.value && endAt.value && endAt.value < startAt.value) {
    errorText.value = '结束时间不能早于开始时间'
    return
  }
  if (selectedTagIds.value.length > MAX_TAGS_PER_PROJECT) {
    errorText.value = `一件事情最多绑定 ${MAX_TAGS_PER_PROJECT} 个标签`
    return
  }
  emit('submit', {
    name: trimmed,
    tagIds: [...selectedTagIds.value],
    startAt: startAt.value || null,
    endAt: endAt.value || null,
    localPath: String(localPath.value || '').trim() || null,
    purpose: String(purpose.value || '').trim(),
    successLooksLike: String(successLooksLike.value || '').trim(),
    outOfScope: String(outOfScope.value || '').trim(),
  })
}

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    resetForm()
    await loadTags()
    await nextTick()
    nameInputRef.value?.focus?.()
  },
)
</script>

<style scoped>
.project-form-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.project-form-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(24, 24, 27, 0.28);
}

.project-form-modal-card {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  max-height: min(90vh, 840px);
  overflow: auto;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.project-form-modal-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.project-form-modal-field {
  display: block;
  margin-bottom: 14px;
}

.project-form-modal-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.project-form-modal-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.project-form-modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
}

.project-form-modal-textarea {
  width: 100%;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
  box-sizing: border-box;
  resize: vertical;
}

.project-form-modal-input:focus,
.project-form-modal-textarea:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.project-form-path-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-form-path-row .project-form-modal-input {
  flex: 1 1 auto;
  min-width: 0;
}

.project-form-path-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.project-form-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 160px;
  overflow: auto;
}

.project-form-tag {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.project-form-tag.is-selected {
  border-color: rgba(37, 99, 235, 0.4);
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
}

.project-form-modal-error {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--color-error);
}

.project-form-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.project-form-modal-btn {
  min-width: 72px;
}
</style>
