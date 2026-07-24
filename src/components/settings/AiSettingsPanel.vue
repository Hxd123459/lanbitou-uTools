<template>
  <component
    :is="embedded ? 'div' : motion.section"
    class="ai-settings"
    :class="{ 'ai-settings--embedded': embedded }"
    :aria-label="embedded ? undefined : 'AI 设置'"
    :initial="embedded ? undefined : panelMotion.initial"
    :animate="embedded ? undefined : panelMotion.animate"
    :transition="embedded ? undefined : panelMotion.transition"
  >
    <template v-if="!embedded">
      <motion.header
        class="ai-settings-header"
        :initial="headerMotion.initial"
        :animate="headerMotion.animate"
        :transition="headerMotion.transition"
      >
        <h2 class="ai-settings-title">AI 设置</h2>
      </motion.header>
    </template>
    <template v-else>
      <SettingsSectionHeading title="AI 设置" />
    </template>

    <motion.div
      class="ai-settings-card"
      :initial="providerCardMotion.initial"
      :animate="providerCardMotion.animate"
      :transition="providerCardMotion.transition"
    >
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

      <p v-if="providerStatusMessage" class="ai-settings-status" :class="providerStatusType">
        {{ providerStatusMessage }}
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
    </motion.div>

    <motion.div
      class="ai-settings-card ai-settings-card--auto-tag"
      :initial="autoTagCardMotion.initial"
      :animate="autoTagCardMotion.animate"
      :transition="autoTagCardMotion.transition"
    >
      <label class="ai-settings-toggle-row">
        <span class="ai-settings-label">AI 整理时模仿我的文风</span>
        <span class="ai-switch" :class="{ 'is-on': form.mimicWritingStyle }">
          <input
            v-model="form.mimicWritingStyle"
            type="checkbox"
            class="ai-switch-input"
            aria-label="AI 整理时模仿我的文风"
            @change="handleMimicStyleToggle"
          />
          <span class="ai-switch-track" aria-hidden="true">
            <span class="ai-switch-thumb" />
          </span>
        </span>
      </label>
      <p class="ai-settings-hint">
        从你的手写碎片中抽取样本，让 AI 整理初稿时更接近你的表达习惯。样本不足时自动跳过。
      </p>
    </motion.div>

    <motion.div
      class="ai-settings-card ai-settings-card--auto-tag"
      :initial="autoTagCardMotion.initial"
      :animate="autoTagCardMotion.animate"
      :transition="{ ...autoTagCardMotion.transition, delay: 0.02 }"
    >
      <label class="ai-settings-toggle-row">
        <span class="ai-settings-label">AI 整理后自动去 AI 味</span>
        <span class="ai-switch" :class="{ 'is-on': form.humanizeDraft }">
          <input
            v-model="form.humanizeDraft"
            type="checkbox"
            class="ai-switch-input"
            aria-label="AI 整理后自动去 AI 味"
            @change="handleHumanizeDraftToggle"
          />
          <span class="ai-switch-track" aria-hidden="true">
            <span class="ai-switch-thumb" />
          </span>
        </span>
      </label>
      <p class="ai-settings-hint">
        初稿生成后自动多做一轮改写：打散均匀的句子节奏、去掉排比和总结套路，降低被 AI 检测的概率。会增加一次模型调用，整理耗时略长。
      </p>
    </motion.div>

    <motion.div
      class="ai-settings-card ai-settings-card--auto-tag"
      :initial="autoTagCardMotion.initial"
      :animate="autoTagCardMotion.animate"
      :transition="{ ...autoTagCardMotion.transition, delay: 0.04 }"
    >
      <label class="ai-settings-toggle-row">
        <span class="ai-settings-label">AI 自动打标签</span>
        <span
          class="ai-switch"
          :class="{ 'is-on': form.autoTagEnabled, 'is-busy': autoTagChecking }"
        >
          <input
            v-model="form.autoTagEnabled"
            type="checkbox"
            class="ai-switch-input"
            aria-label="AI 自动打标签"
            :disabled="autoTagChecking"
            @change="handleAutoTagToggle"
          />
          <span class="ai-switch-track" aria-hidden="true">
            <span class="ai-switch-thumb" />
          </span>
        </span>
      </label>
      <p v-if="autoTagStatusMessage" class="ai-settings-auto-tag-status">
        {{ autoTagStatusMessage }}
      </p>
    </motion.div>
  </component>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { testAiConnection } from '../../ai/aiService'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'
import SettingsSectionHeading from './SettingsSectionHeading.vue'
import {
  AI_PROVIDERS,
  loadAiSettings,
  saveAiSettings,
  saveAutoTagEnabled,
  saveHumanizeDraft,
  saveMimicWritingStyle,
  saveProviderAndAutoTagEnabled,
} from '../../storage/utools/aiSettings'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  pendingAutoTagSetup: {
    type: Boolean,
    default: false,
  },
  embedded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['auto-tag-enabled'])

const { presets } = useMotionPresets()

const panelMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: reveal.transition }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const headerMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.04 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const providerCardMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.08 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const autoTagCardMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.12 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
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
  autoTagEnabled: false,
  mimicWritingStyle: true,
  humanizeDraft: true,
})

const saving = ref(false)
const testing = ref(false)
const providerStatusMessage = ref('')
const providerStatusType = ref('')
const autoTagStatusMessage = ref('')
const autoTagChecking = ref(false)

const currentProvider = computed(
  () => AI_PROVIDERS[form.provider] || AI_PROVIDERS.utools,
)

const hydrate = () => {
  const saved = loadAiSettings()
  form.provider = saved.provider
  form.model = saved.model
  form.baseUrl = saved.baseUrl
  form.apiKey = saved.apiKey
  form.autoTagEnabled = saved.autoTagEnabled
  form.mimicWritingStyle = saved.mimicWritingStyle !== false
  form.humanizeDraft = saved.humanizeDraft !== false
}

const setProviderStatus = (message, type = 'info') => {
  providerStatusMessage.value = message
  providerStatusType.value = type
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
    setProviderStatus('服务来源已保存', 'success')
  } catch (error) {
    setProviderStatus(error?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

const handleTest = async () => {
  testing.value = true
  setProviderStatus('')
  try {
    await testAiConnection(getConnectionParams())
    if (props.pendingAutoTagSetup) {
      form.autoTagEnabled = true
      saveProviderAndAutoTagEnabled(getConnectionParams())
      emit('auto-tag-enabled')
      setProviderStatus('连接成功，已自动开启 AI 自动打标签', 'success')
    } else {
      setProviderStatus('连接成功，可以正常使用', 'success')
    }
  } catch (error) {
    setProviderStatus(error?.message || '连接失败', 'error')
  } finally {
    testing.value = false
  }
}

const getConnectionParams = () => ({
  provider: form.provider,
  model: form.model,
  baseUrl: form.baseUrl,
  apiKey: form.apiKey,
})

const handleMimicStyleToggle = () => {
  try {
    saveMimicWritingStyle(form.mimicWritingStyle)
  } catch (error) {
    form.mimicWritingStyle = !form.mimicWritingStyle
    console.warn('[烂笔头] 文风模仿设置保存失败', error)
  }
}

const handleHumanizeDraftToggle = () => {
  try {
    saveHumanizeDraft(form.humanizeDraft)
  } catch (error) {
    form.humanizeDraft = !form.humanizeDraft
    console.warn('[烂笔头] 去AI味设置保存失败', error)
  }
}

const handleAutoTagToggle = async () => {
  const next = form.autoTagEnabled

  if (!next) {
    autoTagStatusMessage.value = ''
    try {
      saveAutoTagEnabled(false)
    } catch (error) {
      form.autoTagEnabled = true
      console.warn('[烂笔头] 自动打标签设置保存失败', error)
    }
    return
  }

  autoTagChecking.value = true
  autoTagStatusMessage.value = ''
  try {
    await testAiConnection(getConnectionParams())
    saveProviderAndAutoTagEnabled(getConnectionParams())
  } catch (error) {
    form.autoTagEnabled = false
    saveAutoTagEnabled(false)
    autoTagStatusMessage.value = '请先设置可用的 AI 服务来源'
    console.warn('[烂笔头] AI 服务不可用，无法开启自动打标签', error)
  } finally {
    autoTagChecking.value = false
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

.ai-settings--embedded {
  flex: none;
  overflow: visible;
  padding: 0;
}

.ai-settings-subtitle {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.ai-settings-desc--embedded {
  margin: 0 0 16px;
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

.ai-settings-card--auto-tag {
  margin-top: 14px;
}

.ai-settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.ai-settings-toggle-row .ai-settings-label {
  margin-bottom: 0;
}

.ai-settings-auto-tag-status {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-error);
}

.ai-settings-hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-secondary-text);
}

.ai-switch.is-busy {
  opacity: 0.6;
  pointer-events: none;
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

.ai-switch {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.ai-switch-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ai-switch-track {
  position: relative;
  display: block;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: #d4d4d8;
  cursor: pointer;
  transition: background 0.2s ease;
}

.ai-switch.is-on .ai-switch-track {
  background: #18181b;
}

.ai-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease;
}

.ai-switch.is-on .ai-switch-thumb {
  transform: translateX(18px);
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
