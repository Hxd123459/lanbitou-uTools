<template>
  <div class="struct-note-ai-draft-bar">
    <span class="struct-note-ai-draft-label">AI 整理</span>
    <div class="struct-note-ai-draft-presets" role="group" aria-label="AI 整理预设">
      <button
        v-for="preset in presetList"
        :key="preset.id"
        type="button"
        class="struct-note-ai-draft-chip"
        :class="{ 'is-active': activePreset === preset.id }"
        :disabled="disabled || generating"
        @click="emit('draft-request', { preset: preset.id })"
      >
        {{ preset.label }}
      </button>
      <button
        type="button"
        class="struct-note-ai-draft-chip struct-note-ai-draft-chip--custom"
        :class="{ 'is-expanded': customOpen }"
        :disabled="disabled || generating"
        @click="toggleCustom"
      >
        自定义…
      </button>
    </div>

    <div v-if="customOpen" class="struct-note-ai-draft-custom">
      <input
        v-model="customPrompt"
        class="struct-note-ai-draft-input"
        type="text"
        placeholder="补充整理要求，如：写成博客风格"
        :disabled="disabled || generating"
        @keydown.enter.prevent="submitCustom"
      />
      <button
        type="button"
        class="struct-note-ai-draft-submit"
        :disabled="disabled || generating || !customPrompt.trim()"
        @click="submitCustom"
      >
        生成
      </button>
    </div>

    <span v-if="generating" class="struct-note-ai-draft-status">整理中…</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { SEDIMENT_DRAFT_PRESETS } from '../../ai/sedimentDraftService'

defineProps({
  disabled: { type: Boolean, default: false },
  generating: { type: Boolean, default: false },
  activePreset: { type: String, default: '' },
})

const emit = defineEmits(['draft-request'])

const presetList = Object.values(SEDIMENT_DRAFT_PRESETS)
const customOpen = ref(false)
const customPrompt = ref('')

const toggleCustom = () => {
  customOpen.value = !customOpen.value
}

const submitCustom = () => {
  const prompt = customPrompt.value.trim()
  if (!prompt) return
  emit('draft-request', { preset: 'compose', customPrompt: prompt })
}
</script>

<style scoped>
.struct-note-ai-draft-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex: 0 0 auto;
}

.struct-note-ai-draft-label {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-secondary-text);
  white-space: nowrap;
}

.struct-note-ai-draft-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.struct-note-ai-draft-chip {
  flex: 0 0 auto;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.14s ease, background-color 0.14s ease;
}

.struct-note-ai-draft-chip:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.28);
  background: #fff;
}

.struct-note-ai-draft-chip.is-active {
  border-color: rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.06);
}

.struct-note-ai-draft-chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.struct-note-ai-draft-custom {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.struct-note-ai-draft-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fff;
  font-family: inherit;
  font-size: 13px;
  color: var(--color-primary);
}

.struct-note-ai-draft-input:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: var(--focus-ring);
}

.struct-note-ai-draft-submit {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.struct-note-ai-draft-submit:disabled {
  opacity: var(--btn-disabled-opacity);
  cursor: not-allowed;
}

.struct-note-ai-draft-status {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--color-accent);
}
</style>
