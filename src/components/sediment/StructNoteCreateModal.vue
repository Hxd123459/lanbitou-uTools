<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="struct-note-modal"
        class="struct-note-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="struct-note-modal-title"
        :initial="presets.fade.initial"
        :animate="presets.fade.animate"
        :exit="presets.fade.exit"
        :transition="presets.fade.transition"
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

        <div class="struct-note-modal-body">
          <h2 id="struct-note-modal-title" class="struct-note-modal-title">新建文件</h2>

          <label class="struct-note-field">
            <span class="struct-note-label">标题</span>
            <input
              ref="titleInputRef"
              v-model="draftTitle"
              class="struct-note-input"
              type="text"
              maxlength="80"
              placeholder="输入标题"
              spellcheck="false"
              :disabled="saving"
            />
          </label>

          <label class="struct-note-field struct-note-field--grow">
            <span class="struct-note-label">内容</span>
            <textarea
              v-model="draftContent"
              class="struct-note-textarea"
              placeholder="输入内容…"
              spellcheck="false"
              :disabled="saving"
            />
          </label>

          <div class="struct-note-modal-actions">
            <AppButton
              class="btn btn-icon-text"
              :disabled="saving"
              @click="emitClose"
            >
              取消
            </AppButton>
            <AppButton
              class="btn btn-primary"
              :disabled="saving || !canSave"
              @click="handleSave"
            >
              {{ saving ? '保存中…' : '保存' }}
            </AppButton>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'

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

const canSave = computed(
  () => draftTitle.value.trim().length > 0 && draftContent.value.trim().length > 0,
)

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

.struct-note-modal-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 72px 24px 32px;
  box-sizing: border-box;
}

.struct-note-modal-title {
  margin: 0 0 24px;
  font-size: 22px;
  font-weight: 600;
  color: var(--color-primary);
  letter-spacing: 0.2px;
}

.struct-note-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.struct-note-field--grow {
  flex: 1;
  min-height: 0;
  margin-bottom: 24px;
}

.struct-note-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-secondary-text);
}

.struct-note-input {
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--color-text);
  font-family: inherit;
  font-size: 15px;
  outline: none;
}

.struct-note-input:focus {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.struct-note-textarea {
  flex: 1;
  min-height: 280px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #ffffff;
  color: var(--color-text);
  font-family: inherit;
  font-size: 15px;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.struct-note-textarea:focus {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.struct-note-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
