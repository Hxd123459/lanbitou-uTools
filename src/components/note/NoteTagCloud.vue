<template>
  <section class="tag-cloud-panel" aria-label="标签云">
    <p v-if="loading" class="tag-cloud-status">加载标签中…</p>
    <p v-else-if="error" class="tag-cloud-status tag-cloud-status--error">
      {{ error }}
    </p>

    <div v-else class="tag-cloud" role="list">
      <p v-if="!tags.length && !adding" class="tag-cloud-empty">暂无标签，点击 + 添加</p>

      <motion.button
        v-for="(tag, index) in tags"
        :key="tag.tagId"
        type="button"
        class="tag-cloud-item"
        role="listitem"
        :title="`${tag.tagName} · ${tag.noteCount} 条笔记`"
        :initial="presets.reveal.initial"
        :animate="presets.reveal.animate"
        :transition="{ ...presets.reveal.transition, delay: Math.min(index * 0.02, 0.24) }"
        @click="$emit('select', tag)"
      >
        <span class="tag-cloud-name">{{ tag.tagName }}</span>
        <span class="tag-cloud-count">{{ tag.noteCount }}</span>
      </motion.button>

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

    <p v-if="createError" class="tag-cloud-inline-error">{{ createError }}</p>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { ApiError } from '../../api/http'
import { createTag, fetchAllTags } from '../../api/note'
import { isUtoolsMode } from '../../storage/env'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['select'])

const { presets } = useMotionPresets()

const loading = ref(false)
const error = ref('')
const createError = ref('')
const creating = ref(false)
const adding = ref(false)
const draftTag = ref('')
const tags = ref([])
const addInputRef = ref(null)
let loadToken = 0
let blurTimer = 0

const canAddTag = computed(() => isUtoolsMode())

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
  createError.value = ''
  adding.value = true
  draftTag.value = ''
  await nextTick()
  addInputRef.value?.focus()
}

const cancelAdd = () => {
  window.clearTimeout(blurTimer)
  adding.value = false
  draftTag.value = ''
  createError.value = ''
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
  createError.value = ''
  try {
    await createTag(name)
    cancelAdd()
    await loadTags()
  } catch (err) {
    if (err instanceof ApiError) {
      createError.value = `[${err.code}] ${err.msg}`
    } else {
      createError.value = err?.message || '添加失败'
    }
    await nextTick()
    addInputRef.value?.focus()
  } finally {
    creating.value = false
  }
}

watch(
  () => props.active,
  (on) => {
    if (on) loadTags()
    else cancelAdd()
  },
)

onMounted(() => {
  if (props.active) loadTags()
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

.tag-cloud-item,
.tag-cloud-add-chip,
.tag-cloud-add-btn {
  flex: 0 0 auto;
}

.tag-cloud-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
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

.tag-cloud-add-btn {
  width: auto;
  min-width: 44px;
  height: 28px;
  padding: 0 14px;
  border-radius: 999px;
  border: 0;
}

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

.tag-cloud-add-chip:focus-within {
  border-color: var(--btn-dashed-border-focus);
  box-shadow: var(--focus-ring);
}

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

.tag-cloud-add-input::placeholder {
  color: #a1a1aa;
  font-weight: 400;
}

.tag-cloud-inline-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--color-error);
}
</style>
