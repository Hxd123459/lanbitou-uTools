<template>
  <section class="tag-cloud-panel" aria-label="标签云">
    <p v-if="loading" class="tag-cloud-status">加载标签中…</p>
    <p v-else-if="error" class="tag-cloud-status tag-cloud-status--error">
      {{ error }}
    </p>
    <p v-else-if="!tags.length" class="tag-cloud-status">暂无标签</p>

    <div v-else class="tag-cloud" role="list">
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
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { ApiError } from '../../api/http'
import { fetchAllTags } from '../../api/note'
import { useMotionPresets } from '../../composables/useMotionPresets'

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
const tags = ref([])
let loadToken = 0

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

watch(
  () => props.active,
  (on) => {
    if (on) loadTags()
  },
)

onMounted(() => {
  if (props.active) loadTags()
})
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
  border-color: rgba(37, 99, 235, 0.35);
  color: var(--color-accent);
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
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.12);
}
</style>
