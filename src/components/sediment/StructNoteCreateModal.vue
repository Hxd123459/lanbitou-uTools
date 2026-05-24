<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="struct-note-modal"
        class="struct-note-modal"
        role="dialog"
        aria-modal="true"
        aria-label="新建文件"
        :initial="{ opacity: 0, y: 28 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: 28 }"
        :transition="{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }"
      >
        <motion.button
          type="button"
          class="struct-note-modal-close"
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

        <motion.button
          type="button"
          class="btn btn-primary struct-note-modal-save"
          :disabled="saving || !canSave"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="handleSave"
        >
          {{ saving ? '保存中…' : '保存' }}
        </motion.button>

        <div class="struct-note-modal-body">
          <input
            ref="titleInputRef"
            v-model="draftTitle"
            class="struct-note-title-input"
            type="text"
            maxlength="80"
            placeholder="请输入标题"
            spellcheck="false"
            :disabled="saving"
          />
          <textarea
            v-model="draftContent"
            class="struct-note-content-textarea"
            placeholder="开始写作…"
            spellcheck="false"
            :disabled="saving"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'save'])

const { presets } = useMotionPresets()

const draftTitle = ref('')
const draftContent = ref('')
const titleInputRef = ref(null)

const canSave = computed(() => draftTitle.value.trim().length > 0)

const resetDraft = () => {
  draftTitle.value = ''
  draftContent.value = ''
}

const emitClose = () => {
  if (props.saving) return
  emit('close')
}

const handleSave = () => {
  if (!canSave.value || props.saving) return
  emit('save', {
    title: draftTitle.value.trim(),
    content: draftContent.value.trim(),
  })
}

const onKeydown = (event) => {
  if (!props.visible || props.saving) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emitClose()
  }
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      resetDraft()
      await nextTick()
      titleInputRef.value?.focus()
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({ resetDraft })
</script>

<style scoped>
.struct-note-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: #fbfaf9;
}

.struct-note-modal-close {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 2;
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
}

.struct-note-modal-close:hover {
  background: rgba(24, 24, 27, 0.1);
}

.struct-note-modal-save {
  position: absolute;
  top: 21px;
  right: 18px;
  z-index: 2;
}

.struct-note-modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 80px 24px 32px;
  box-sizing: border-box;
}

.struct-note-title-input {
  flex: 0 0 auto;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: inherit;
  padding: 0;
  margin-bottom: 20px;
  caret-color: var(--color-accent);
}

.struct-note-title-input::placeholder {
  color: #d1d5db;
}

.struct-note-title-input:focus {
  outline: none;
  box-shadow: none;
}

.struct-note-content-textarea {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
  resize: none;
  padding: 0;
  caret-color: var(--color-accent);
}

.struct-note-content-textarea::placeholder {
  color: #d1d5db;
}

.struct-note-content-textarea:focus {
  outline: none;
  box-shadow: none;
}
</style>
