<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="semantic-search-modal"
        class="semantic-modal"
        role="dialog"
        aria-modal="true"
        aria-label="语义搜索"
        :initial="modalMotion.initial"
        :animate="modalMotion.animate"
        :exit="modalMotion.exit"
        :transition="modalMotion.transition"
      >
        <motion.button
          type="button"
          class="semantic-modal-close"
          aria-label="关闭"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="emitClose"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </motion.button>

        <div class="semantic-stage">
          <AnimatePresence mode="popLayout">
            <motion.div
              v-for="(note, index) in results"
              :key="note.id"
              class="semantic-fragment-slot"
              :style="fragmentStyle(index)"
              :initial="fragmentMotion.initial"
              :animate="fragmentMotion.animate"
              :exit="fragmentMotion.exit"
              :transition="fragmentTransition(index)"
            >
              <article
                class="semantic-fragment"
                role="button"
                tabindex="0"
                @click="emitSelect(note)"
                @keydown.enter.prevent="emitSelect(note)"
              >
                <p class="semantic-fragment-title">{{ note.title || '无标题' }}</p>
                <p v-if="note.summary" class="semantic-fragment-summary">{{ note.summary }}</p>
                <span v-if="note.similarity != null" class="semantic-fragment-match">
                  {{ formatSimilarity(note.similarity) }}
                </span>
              </article>
            </motion.div>
          </AnimatePresence>

          <motion.div
            class="semantic-hub"
            :initial="{ opacity: 0, scale: 0.96 }"
            :animate="{ opacity: 1, scale: 1 }"
            :transition="{ duration: 0.28, delay: 0.06, ease: [0.22, 1, 0.36, 1] }"
          >
            <textarea
              ref="queryInputRef"
              v-model="query"
              class="semantic-query"
              rows="3"
              :placeholder="placeholder"
              spellcheck="false"
              :disabled="searching"
              @keydown.enter.exact.prevent="runSearch"
            />
            <p class="semantic-hint">
              <template v-if="searching">思绪正在联结记忆碎片…</template>
              <template v-else-if="searchError">{{ searchError }}</template>
              <template v-else-if="hasSearched && results.length === 0">暂未找到相关碎片，试试更具体的想法</template>
              <template v-else>按 Enter 开始检索</template>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { semanticTextSearch } from '../../api/semantic'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'select-note'])

const placeholder = '根据你的想法来搜索你的碎片笔记，想法越是详细，越精准'

const ORBIT_SLOTS = [
  { left: '6%', top: '14%', rot: -2.5 },
  { left: '74%', top: '10%', rot: 2 },
  { left: '80%', top: '38%', rot: -1.5 },
  { left: '4%', top: '44%', rot: 2.5 },
  { left: '12%', top: '70%', rot: -2 },
  { left: '70%', top: '66%', rot: 1.5 },
  { left: '40%', top: '6%', rot: 0.5 },
  { left: '36%', top: '80%', rot: -1 },
  { left: '84%', top: '24%', rot: 2.2 },
  { left: '2%', top: '28%', rot: -1.8 },
  { left: '48%', top: '4%', rot: 1 },
  { left: '50%', top: '84%', rot: -0.8 },
]

const { presets, reduced } = useMotionPresets()

const query = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const hasSearched = ref(false)
const queryInputRef = ref(null)

const modalEase = [0.22, 1, 0.36, 1]

const modalMotion = computed(() => {
  if (reduced.value) {
    return {
      initial: {},
      animate: {},
      exit: {},
      transition: { duration: 0 },
    }
  }
  return {
    initial: { opacity: 0, y: 24, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 20, scale: 0.99 },
    transition: { duration: 0.28, ease: modalEase },
  }
})

const fragmentMotion = computed(() => {
  if (reduced.value) {
    return { initial: {}, animate: {}, exit: {} }
  }
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  }
})

const fragmentTransition = (index) => ({
  duration: reduced.value ? 0 : 0.32,
  delay: reduced.value ? 0 : 0.04 + index * 0.05,
  ease: modalEase,
})

const fragmentStyle = (index) => {
  const slot = ORBIT_SLOTS[index % ORBIT_SLOTS.length]
  return {
    left: slot.left,
    top: slot.top,
    '--frag-rot': `${slot.rot}deg`,
  }
}

const formatSimilarity = (value) => `${Math.round(value * 100)}% 契合`

const emitClose = () => {
  if (searching.value) return
  emit('close')
}

const emitSelect = (note) => {
  emit('select-note', note)
}

const resetState = () => {
  query.value = ''
  results.value = []
  searching.value = false
  searchError.value = ''
  hasSearched.value = false
}

const runSearch = async () => {
  const text = query.value.trim()
  if (!text || searching.value) return

  searching.value = true
  searchError.value = ''
  hasSearched.value = true
  results.value = []

  try {
    results.value = await semanticTextSearch({ query: text })
  } catch (err) {
    searchError.value = err?.msg || '检索失败，请稍后重试'
    results.value = []
  } finally {
    searching.value = false
  }
}

const onKeydown = (e) => {
  if (!props.visible || searching.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emitClose()
  }
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      resetState()
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      queryInputRef.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.semantic-modal {
  position: fixed;
  inset: 0;
  z-index: 210;
  background: var(--color-bg);
  overflow: hidden;
}

.semantic-modal-close {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-primary);
  cursor: pointer;
  transition: background 0.2s ease;
}

.semantic-modal-close:hover {
  background: rgba(24, 24, 27, 0.1);
}

.semantic-modal-close:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.semantic-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.semantic-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  width: min(560px, calc(100% - 48px));
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: auto;
}

.semantic-query {
  width: 100%;
  min-height: 96px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font-family: inherit;
  font-size: clamp(20px, 3.2vw, 28px);
  font-weight: 500;
  line-height: 1.45;
  color: var(--color-primary);
  text-align: center;
  caret-color: var(--color-accent);
  padding: 0 8px;
}

.semantic-query::placeholder {
  color: #a1a1aa;
  font-weight: 400;
}

.semantic-query:disabled {
  opacity: 0.65;
}

.semantic-hint {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--color-secondary-text);
  min-height: 1.25em;
}

.semantic-fragment-slot {
  position: absolute;
  z-index: 1;
  transform: rotate(var(--frag-rot, 0deg));
  transition: transform 0.2s ease;
}

.semantic-fragment {
  width: min(220px, 28vw);
  max-width: 240px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(24, 24, 27, 0.08);
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    0 4px 24px rgba(24, 24, 27, 0.06),
    0 1px 3px rgba(24, 24, 27, 0.04);
  cursor: pointer;
  text-align: left;
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.semantic-fragment-slot:hover {
  transform: rotate(var(--frag-rot, 0deg)) translateY(-3px);
}

.semantic-fragment:hover {
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow:
    0 8px 28px rgba(37, 99, 235, 0.08),
    0 2px 6px rgba(24, 24, 27, 0.05);
}

.semantic-fragment:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.semantic-fragment-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.semantic-fragment-summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.semantic-fragment-match {
  display: inline-block;
  margin-top: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.08);
}

@media (max-width: 720px) {
  .semantic-hub {
    width: calc(100% - 32px);
  }

  .semantic-query {
    font-size: 18px;
  }

  .semantic-fragment {
    width: min(160px, 42vw);
    padding: 10px 12px;
  }

  .semantic-fragment-title {
    font-size: 13px;
  }

  .semantic-fragment-summary {
    -webkit-line-clamp: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .semantic-fragment {
    transition: none;
  }
}
</style>
