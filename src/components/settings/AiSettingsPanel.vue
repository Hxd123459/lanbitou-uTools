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

    <div class="ai-settings-layout" :class="{ 'ai-settings-layout--split': embedded }">
      <div class="ai-settings-col">
        <motion.div
          class="ai-settings-card ai-settings-card--provider"
          :initial="providerCardMotion.initial"
          :animate="providerCardMotion.animate"
          :transition="providerCardMotion.transition"
        >
          <fieldset class="ai-settings-group">
            <legend class="ai-settings-label">服务来源</legend>
            <p class="ai-settings-lead">点选运营商，只需填写 Key 和模型。接口地址已自动配置。</p>
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
                <span class="ai-provider-icon-wrap">
                  <img
                    v-if="getProviderIcon(item.id)"
                    :src="getProviderIcon(item.id)"
                    class="ai-provider-icon"
                    alt=""
                    width="20"
                    height="20"
                  />
                </span>
                <span class="ai-provider-name">{{ item.label }}</span>
              </label>
            </div>
            <p v-if="currentProvider.hint" class="ai-settings-hint">{{ currentProvider.hint }}</p>
          </fieldset>

          <template v-if="form.provider !== 'utools'">
            <label class="ai-settings-field">
              <span class="ai-settings-label-row">
                <span class="ai-settings-label">API Key</span>
                <button
                  v-if="currentProvider.keyUrl"
                  type="button"
                  class="ai-settings-link"
                  @click="openKeyUrl"
                >
                  去获取
                </button>
              </span>
              <input
                v-model="form.apiKey"
                type="password"
                class="ai-settings-input"
                :placeholder="currentProvider.keyPlaceholder || 'sk-...'"
                autocomplete="off"
                spellcheck="false"
              />
            </label>

            <label v-if="currentProvider.requiresBaseUrl" class="ai-settings-field">
              <span class="ai-settings-label">接口地址</span>
              <input
                v-model="form.baseUrl"
                type="url"
                class="ai-settings-input"
                placeholder="https://api.example.com/v1"
                spellcheck="false"
              />
            </label>

            <div class="ai-settings-field">
              <span class="ai-settings-label">模型</span>
              <div ref="modelSelectRef" class="ai-model-select">
                <div
                  class="ai-model-combobox"
                  :class="{ 'is-open': modelMenuOpen }"
                >
                  <input
                    v-model="form.model"
                    type="text"
                    class="ai-model-input"
                    :placeholder="modelPlaceholder"
                    autocomplete="off"
                    spellcheck="false"
                    :aria-expanded="modelMenuOpen"
                    aria-haspopup="listbox"
                    @focus="openModelMenu"
                    @input="openModelMenu"
                  />
                  <button
                    v-if="modelOptions.length"
                    type="button"
                    class="ai-model-chevron-btn"
                    tabindex="-1"
                    aria-label="展开模型列表"
                    @mousedown.prevent
                    @click="toggleModelMenu"
                  >
                    <svg
                      class="ai-model-trigger-chevron"
                      :class="{ 'is-open': modelMenuOpen }"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
                <div
                  v-if="modelMenuOpen && filteredModelOptions.length"
                  class="ai-model-menu"
                  role="listbox"
                  aria-label="选择模型"
                >
                  <button
                    v-for="option in filteredModelOptions"
                    :key="option.id"
                    type="button"
                    class="ai-model-option"
                    :class="{ 'is-selected': form.model === option.id }"
                    role="option"
                    :aria-selected="form.model === option.id"
                    @mousedown.prevent
                    @click="selectPresetModel(option.id)"
                  >
                    <span class="ai-model-option-main">
                      <span class="ai-model-option-label">{{ option.label }}</span>
                      <span class="ai-model-option-id">{{ option.id }}</span>
                    </span>
                    <span
                      v-if="form.model === option.id"
                      class="ai-model-option-check"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </button>
                </div>
              </div>
            </div>
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
          <p v-else class="ai-settings-hint">
            记录碎片时自动推荐标签。文风模仿与去 AI 味请在「整理模板」中按模板开启。
          </p>
        </motion.div>
      </div>

      <div class="ai-settings-side">
        <slot name="side" />
      </div>
    </div>
  </component>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { getProviderIcon } from '../../ai/providerIcons'
import { testAiConnection } from '../../ai/aiService'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AppButton from '../motion/AppButton.vue'
import SettingsSectionHeading from './SettingsSectionHeading.vue'
import {
  AI_PROVIDERS,
  getProviderModelIds,
  getProviderModelOptions,
  getResolvedBaseUrl,
  getResolvedModel,
  listAiProviders,
  loadAiSettings,
  saveAiSettings,
  saveAutoTagEnabled,
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

const providerOptions = listAiProviders()

const form = reactive({
  provider: 'utools',
  model: '',
  baseUrl: '',
  apiKey: '',
  autoTagEnabled: false,
})

const saving = ref(false)
const testing = ref(false)
const providerStatusMessage = ref('')
const providerStatusType = ref('')
const autoTagStatusMessage = ref('')
const autoTagChecking = ref(false)
const modelMenuOpen = ref(false)
const modelSelectRef = ref(null)
let hydrating = false

const currentProvider = computed(
  () => AI_PROVIDERS[form.provider] || AI_PROVIDERS.utools,
)

const modelOptions = computed(() => getProviderModelOptions(form.provider))

const modelPlaceholder = computed(() => {
  if (form.provider === 'utools') return '留空则使用 uTools 默认模型'
  return currentProvider.value.defaultModel || '选择或输入模型名称'
})

const filteredModelOptions = computed(() => {
  const query = String(form.model || '').trim().toLowerCase()
  if (!query) return modelOptions.value
  const matched = modelOptions.value.filter(
    (item) =>
      item.id.toLowerCase().includes(query) || item.label.toLowerCase().includes(query),
  )
  return matched.length ? matched : modelOptions.value
})

const hydrate = () => {
  hydrating = true
  const saved = loadAiSettings()
  form.provider = saved.provider
  form.model = saved.model
  form.baseUrl = saved.baseUrl
  form.apiKey = saved.apiKey
  form.autoTagEnabled = saved.autoTagEnabled
  nextTick(() => {
    hydrating = false
  })
}

const applyProviderDefaults = (nextId, prevId) => {
  const next = AI_PROVIDERS[nextId]
  const prev = AI_PROVIDERS[prevId]
  if (!next) return

  if (next.requiresBaseUrl) {
    const prevOfficial = String(prev?.defaultBaseUrl || '')
    if (!form.baseUrl || form.baseUrl === prevOfficial) {
      form.baseUrl = prevOfficial || form.baseUrl
    }
  } else {
    form.baseUrl = next.defaultBaseUrl || ''
  }

  const nextModels = new Set(getProviderModelIds(nextId))
  if (nextModels.size) {
    if (!nextModels.has(form.model)) form.model = next.defaultModel || ''
  } else if (!next.requiresBaseUrl) {
    form.model = next.defaultModel || ''
  }
  modelMenuOpen.value = false
}

const closeModelMenu = () => {
  modelMenuOpen.value = false
}

const openModelMenu = () => {
  if (modelOptions.value.length) modelMenuOpen.value = true
}

const toggleModelMenu = () => {
  if (!modelOptions.value.length) return
  modelMenuOpen.value = !modelMenuOpen.value
}

const selectPresetModel = (name) => {
  form.model = name
  closeModelMenu()
}

const handleDocumentPointerDown = (event) => {
  if (!modelMenuOpen.value) return
  const root = modelSelectRef.value
  if (root && event.target instanceof Node && root.contains(event.target)) return
  closeModelMenu()
}

const openKeyUrl = () => {
  const url = currentProvider.value.keyUrl
  if (!url) return
  if (typeof window.utools?.shellOpenExternal === 'function') {
    window.utools.shellOpenExternal(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const setProviderStatus = (message, type = 'info') => {
  providerStatusMessage.value = message
  providerStatusType.value = type
}

const getConnectionParams = () => ({
  provider: form.provider,
  model: getResolvedModel(form),
  baseUrl: getResolvedBaseUrl(form),
  apiKey: form.apiKey,
})

const validateForm = () => {
  if (form.provider !== 'utools' && !String(form.apiKey || '').trim()) {
    setProviderStatus('请填写 API Key', 'error')
    return false
  }
  if (currentProvider.value.requiresBaseUrl && !String(form.baseUrl || '').trim()) {
    setProviderStatus('请填写接口地址', 'error')
    return false
  }
  if (form.provider !== 'utools' && !getResolvedModel(form)) {
    setProviderStatus('请选择或填写模型', 'error')
    return false
  }
  return true
}

const handleSave = async () => {
  if (!validateForm()) return
  saving.value = true
  try {
    saveAiSettings(getConnectionParams())
    setProviderStatus('服务来源已保存', 'success')
  } catch (error) {
    setProviderStatus(error?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

const handleTest = async () => {
  if (!validateForm()) return
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
  () => form.provider,
  (next, prev) => {
    if (hydrating || !prev || next === prev) return
    applyProviderDefaults(next, prev)
    setProviderStatus('')
  },
)

watch(
  () => props.active,
  (active) => {
    if (active) hydrate()
  },
)

onMounted(() => {
  hydrate()
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
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

.ai-settings-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ai-settings-layout--split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.ai-settings-col,
.ai-settings-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* 画像变高时只撑右列，左列控制区不被连带挤开 */
.ai-settings-layout--split .ai-settings-side {
  align-self: stretch;
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
  box-sizing: border-box;
}

.ai-settings-layout--split .ai-settings-card {
  max-width: none;
  width: 100%;
}

@media (max-width: 900px) {
  .ai-settings-layout--split {
    grid-template-columns: 1fr;
  }
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

.ai-settings-lead {
  margin: 0 0 10px;
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

.ai-settings-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.ai-settings-label-row .ai-settings-label {
  margin-bottom: 0;
}

.ai-settings-link {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 12px;
  color: var(--color-accent);
  cursor: pointer;
}

.ai-settings-link:hover {
  text-decoration: underline;
}

.ai-provider-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ai-provider-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--btn-radius);
  background: var(--color-surface);
  cursor: pointer;
}

.ai-provider-option:hover {
  background: rgba(24, 24, 27, 0.04);
}

.ai-provider-option.is-active {
  border-color: rgba(24, 24, 27, 0.4);
  background: rgba(24, 24, 27, 0.05);
}

.ai-provider-option:focus-within {
  box-shadow: var(--focus-ring);
}

.ai-provider-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ai-provider-icon-wrap {
  display: block;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  overflow: hidden;
  background: #fff;
}

.ai-provider-icon {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: cover;
  object-position: center;
}

.ai-provider-name {
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.ai-provider-option.is-active .ai-provider-name {
  font-weight: 600;
}

.ai-model-select {
  position: relative;
}

.ai-model-combobox {
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--btn-radius);
  background: var(--color-bg);
  box-sizing: border-box;
}

.ai-model-combobox.is-open,
.ai-model-combobox:focus-within {
  border-color: rgba(24, 24, 27, 0.35);
  box-shadow: var(--focus-ring);
}

.ai-model-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px 0 12px;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.ai-model-chevron-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.ai-model-trigger-chevron {
  display: block;
}

.ai-model-trigger-chevron.is-open {
  transform: rotate(180deg);
}

.ai-model-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 12;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-float, 0 16px 40px rgba(24, 24, 27, 0.12));
}

.ai-model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.ai-model-option:hover,
.ai-model-option.is-selected {
  background: rgba(24, 24, 27, 0.06);
}

.ai-model-option-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ai-model-option-label {
  font-weight: 500;
}

.ai-model-option-id {
  font-size: 11px;
  color: var(--color-secondary-text);
}

.ai-model-option-check {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--color-accent);
}

.ai-settings-field {
  display: block;
  margin-bottom: 14px;
}

.ai-settings-field-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-secondary-text);
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
  box-shadow: 0 1px 3px rgba(24, 24, 27, 0.18);
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
