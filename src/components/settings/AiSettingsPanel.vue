<template>
  <section class="ai-settings" aria-label="AI 设置">
    <header class="ai-settings-header">
      <h2 class="ai-settings-title">AI 设置</h2>
      <p class="ai-settings-desc">选择标题生成使用的 AI 服务。第三方 Key 将加密保存在本机。</p>
    </header>

    <div class="ai-settings-card">
      <fieldset class="ai-settings-group">
        <legend class="ai-settings-label">服务来源</legend>
        <div class="ai-provider-list">
          <label
            v-for="item in providerOptions"
            :key="item.id"
            class="ai-provider-option"
            :class="{ 'is-active': form.provider === item.id }"
          >
            <input
              v-model="form.provider"
              type="radio"
              class="ai-provider-input"
              name="ai-provider"
              :value="item.id"
            />
            <span class="ai-provider-name">{{ item.label }}</span>
            <span v-if="item.id === 'utools'" class="ai-provider-hint">使用 uTools 平台额度</span>
          </label>
        </div>
      </fieldset>

      <template v-if="form.provider !== 'utools'">
        <label class="ai-settings-field">
          <span class="ai-settings-label">API Key</span>
          <input
            v-model="form.apiKey"
            type="password"
            class="ai-settings-input"
            placeholder="sk-..."
            autocomplete="off"
            spellcheck="false"
          />
        </label>

        <label class="ai-settings-field">
          <span class="ai-settings-label">Base URL</span>
          <input
            v-model="form.baseUrl"
            type="url"
            class="ai-settings-input"
            :placeholder="currentProvider.defaultBaseUrl"
            spellcheck="false"
          />
        </label>

        <label class="ai-settings-field">
          <span class="ai-settings-label">模型</span>
          <input
            v-model="form.model"
            type="text"
            class="ai-settings-input"
            :placeholder="currentProvider.defaultModel"
            spellcheck="false"
          />
        </label>
      </template>

      <label v-else class="ai-settings-field">
        <span class="ai-settings-label">模型（可选）</span>
        <input
          v-model="form.model"
          type="text"
          class="ai-settings-input"
          placeholder="留空则使用 uTools 默认模型"
          spellcheck="false"
        />
      </label>

      <p v-if="statusMessage" class="ai-settings-status" :class="statusType">
        {{ statusMessage }}
      </p>

      <div class="ai-settings-actions">
        <AppButton
          class="btn btn-dashed-tile ai-settings-btn"
          :disabled="testing"
          @click="handleTest"
        >
          {{ testing ? '测试中…' : '测试连接' }}
        </AppButton>
        <AppButton
          class="btn btn-primary ai-settings-btn"
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? '保存中…' : '保存设置' }}
        </AppButton>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { testAiConnection } from '../../ai/aiService'
import AppButton from '../motion/AppButton.vue'
import { AI_PROVIDERS, loadAiSettings, saveAiSettings } from '../../storage/utools/aiSettings'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const providerOptions = [
  AI_PROVIDERS.utools,
  AI_PROVIDERS.openai,
  AI_PROVIDERS.anthropic,
]

const form = reactive({
  provider: 'utools',
  model: '',
  baseUrl: '',
  apiKey: '',
})

const saving = ref(false)
const testing = ref(false)
const statusMessage = ref('')
const statusType = ref('')

const currentProvider = computed(
  () => AI_PROVIDERS[form.provider] || AI_PROVIDERS.utools,
)

const hydrate = () => {
  const saved = loadAiSettings()
  form.provider = saved.provider
  form.model = saved.model
  form.baseUrl = saved.baseUrl
  form.apiKey = saved.apiKey
}

const setStatus = (message, type = 'info') => {
  statusMessage.value = message
  statusType.value = type
}

const handleSave = async () => {
  saving.value = true
  try {
    saveAiSettings({
      provider: form.provider,
      model: form.model,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
    })
    setStatus('设置已保存', 'success')
  } catch (error) {
    setStatus(error?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

const handleTest = async () => {
  testing.value = true
  setStatus('')
  try {
    await testAiConnection({
      provider: form.provider,
      model: form.model,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
    })
    setStatus('连接成功，可以正常使用', 'success')
  } catch (error) {
    setStatus(error?.message || '连接失败', 'error')
  } finally {
    testing.value = false
  }
}

watch(
  () => props.active,
  (active) => {
    if (active) hydrate()
  },
)

onMounted(hydrate)
</script>

<style scoped>
.ai-settings {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 4px 28px;
}

.ai-settings-header {
  margin-bottom: 16px;
}

.ai-settings-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
}

.ai-settings-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-secondary-text);
}

.ai-settings-card {
  max-width: 520px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.ai-settings-group {
  margin: 0 0 16px;
  padding: 0;
  border: 0;
}

.ai-settings-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.ai-provider-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-provider-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  cursor: pointer;
}

.ai-provider-option.is-active {
  border-color: rgba(24, 24, 27, 0.28);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.ai-provider-input {
  flex: 0 0 auto;
  accent-color: var(--color-primary);
}

.ai-provider-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.ai-provider-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.ai-settings-field {
  display: block;
  margin-bottom: 14px;
}

.ai-settings-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--btn-radius);
  background: var(--color-bg);
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.ai-settings-input:focus {
  border-color: rgba(24, 24, 27, 0.35);
  box-shadow: var(--focus-ring);
}

.ai-settings-status {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
}

.ai-settings-status.success {
  color: var(--color-success);
}

.ai-settings-status.error {
  color: var(--color-error);
}

.ai-settings-status.info {
  color: var(--color-secondary-text);
}

.ai-settings-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.ai-settings-btn {
  min-width: 96px;
}
</style>
