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
        :style="tagStyle(tag, index)"
        role="listitem"
        :title="`${tag.tagName} · ${tag.noteCount} 条笔记`"
        :initial="presets.reveal.initial"
        :animate="presets.reveal.animate"
        :transition="{ ...presets.reveal.transition, delay: Math.min(index * 0.02, 0.24) }"
      >
        <span class="tag-cloud-name">{{ tag.tagName }}</span>
        <span class="tag-cloud-count">{{ tag.noteCount }}</span>
      </motion.button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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

const { presets } = useMotionPresets()

const loading = ref(false)
const error = ref('')
const tags = ref([])
let loadToken = 0

const countRange = computed(() => {
  const counts = tags.value.map((t) => Number(t.noteCount) || 0)
  const max = Math.max(...counts, 1)
  const min = Math.min(...counts, 0)
  return { min, max }
})

const tagStyle = (tag, index) => {
  const count = Number(tag.noteCount) || 0
  const { min, max } = countRange.value
  const ratio = max === min ? 0.55 : (count - min) / (max - min)
  const fontSize = 12 + ratio * 10
  const opacity = 0.72 + ratio * 0.28
  const rotate = ((index % 5) - 2) * 1.2
  return {
    fontSize: `${fontSize}px`,
    opacity: String(opacity),
    transform: `rotate(${rotate}deg)`,
  }
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
  justify-content: center;
  gap: 10px 14px;
  padding: 16px 8px 8px;
  min-height: 120px;
}

.tag-cloud-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 500;
  line-height: 1.35;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  font-family: inherit;
}

.tag-cloud-item:hover {
  border-color: rgba(37, 99, 235, 0.35);
  color: var(--color-accent);
  box-shadow: var(--shadow-card-hover);
}

.tag-cloud-count {
  font-size: 0.72em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-secondary-text);
}

.tag-cloud-item:hover .tag-cloud-count {
  color: var(--color-accent);
}
</style>
