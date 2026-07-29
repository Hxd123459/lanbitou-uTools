<template>
  <motion.div
    class="profile-panel-card"
    :class="{ 'profile-panel-card--embedded': embedded }"
    :initial="cardMotion.initial"
    :animate="cardMotion.animate"
    :transition="cardMotion.transition"
  >
    <div class="profile-panel-head">
      <SettingsSectionHeading title="我的画像与文风" />
      <div
        class="profile-tip"
        :class="{ 'is-open': disclaimerOpen }"
        @mouseenter="disclaimerHover = true"
        @mouseleave="disclaimerHover = false"
      >
        <button
          type="button"
          class="profile-tip-btn"
          aria-label="深层人格说明"
          :aria-expanded="disclaimerVisible"
          @click.stop="disclaimerOpen = !disclaimerOpen"
        >
          <svg class="profile-tip-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M8 4.6v5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
          </svg>
        </button>
        <div
          v-show="disclaimerVisible"
          class="profile-tip-bubble"
          role="tooltip"
        >
          深层人格是根据记录形成的概率性观察，不是心理诊断。每条洞察均需多条原文证据，并允许你纠正。
        </div>
      </div>
    </div>

    <p v-if="!utoolsMode" class="profile-hint">仅 uTools 环境下可用。</p>

    <template v-else>
      <label class="auto-analyze-row">
        <span>
          <span class="auto-analyze-label">自动分析画像与文风</span>
          <span class="auto-analyze-hint">关闭后仅「立即重新分析」会调用模型，启动和记笔记不再后台烧 token</span>
        </span>
        <span class="profile-switch" :class="{ 'is-on': autoAnalyze }">
          <input
            v-model="autoAnalyze"
            type="checkbox"
            class="profile-switch-input"
            aria-label="自动分析画像与文风"
            @change="handleAutoAnalyzeToggle"
          />
          <span class="profile-switch-track" aria-hidden="true">
            <span class="profile-switch-thumb" />
          </span>
        </span>
      </label>

      <div class="profile-meta">
        <p class="profile-meta-text">
          <template v-if="lastAnalyzedAt">
            上次分析：{{ lastAnalyzedAt }}<template v-if="sampleCount">
              · 采样 {{ sampleCount }} 条</template>
          </template>
          <template v-else>
            尚未生成。可手动分析，或开启上方自动分析。
          </template>
        </p>
        <motion.button
          type="button"
          class="profile-analyze-btn"
          :disabled="running"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="handleAnalyze"
        >
          {{ running ? '分析中…' : '立即重新分析' }}
        </motion.button>
      </div>

      <div
        v-if="progress.stage !== 'idle'"
        class="analysis-progress"
        :class="{
          'is-complete': progress.stage === 'complete',
          'is-error': progress.stage === 'error',
        }"
      >
        <div class="analysis-progress-head">
          <span>{{ progress.message }}</span>
          <span>{{ progress.percent }}%</span>
        </div>
        <div
          class="analysis-progress-track"
          role="progressbar"
          :aria-valuenow="progress.percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span
            class="analysis-progress-bar"
            :style="{ width: `${progress.percent}%` }"
          />
        </div>
        <p v-if="progress.totalSamples" class="analysis-progress-detail">
          已处理 {{ progress.processedSamples }}/{{ progress.totalSamples }} 个采样片段
          <template v-if="progress.totalBatches">
            · 批次 {{ progress.processedBatches }}/{{ progress.totalBatches }}
          </template>
          · 来自 {{ progress.fragmentSamples }} 条碎片、{{ progress.structNotes }} 篇沉淀
        </p>
      </div>

      <p v-if="inlineError" class="profile-inline-error">{{ inlineError }}</p>

      <div class="profile-list">
        <article
          v-for="section in sections"
          :key="section.type"
          class="profile-card"
        >
          <div class="profile-card-head">
            <h4 class="profile-card-title">{{ section.title }}</h4>
            <span v-if="section.profile?.manualLocked" class="profile-lock-badge">已锁定</span>
          </div>

          <template v-if="editingType === section.type">
            <textarea
              v-model="editingText"
              class="profile-edit-textarea"
              rows="6"
              :placeholder="`输入${section.title}的描述，将原样注入 AI 提示词`"
            />
            <div class="profile-card-actions">
              <button
                type="button"
                class="profile-text-btn profile-text-btn--primary"
                :disabled="editSaving"
                @click="saveEdit(section.type)"
              >
                {{ editSaving ? '保存中…' : '保存并锁定' }}
              </button>
              <button
                type="button"
                class="profile-text-btn"
                :disabled="editSaving"
                @click="cancelEdit"
              >
                取消
              </button>
            </div>
          </template>

          <template v-else-if="section.summary || section.rows.length">
            <p class="profile-summary">{{ section.summary || '已生成，展开可查看详情' }}</p>

            <dl v-if="isExpanded(section.type)" class="profile-fields">
              <div
                v-for="row in section.rows"
                :key="row.label"
                class="profile-field"
              >
                <dt class="profile-field-label">{{ row.label }}</dt>
                <dd class="profile-field-value">{{ row.value }}</dd>
              </div>
            </dl>

            <div class="profile-card-actions">
              <button
                v-if="section.rows.length"
                type="button"
                class="profile-text-btn"
                @click="toggleExpand(section.type)"
              >
                {{ isExpanded(section.type) ? '收起' : '展开详情' }}
              </button>
              <button
                v-if="section.type === PROFILE_TYPES.writingStyle"
                type="button"
                class="profile-text-btn"
                @click="startEdit(section)"
              >
                编辑
              </button>
              <button
                v-if="section.profile?.manualLocked"
                type="button"
                class="profile-text-btn"
                @click="unlock(section.type)"
              >
                解锁并恢复自动更新
              </button>
            </div>
          </template>

          <p v-else class="profile-card-empty">暂无数据，点击上方「立即重新分析」生成。</p>
        </article>
      </div>

      <div v-if="deepSections.length" class="deep-personality">
        <h4 class="deep-personality-title">深层人格洞察</h4>
        <PersonalityInsightCard
          v-for="section in deepSections"
          :key="section.key"
          :title="section.title"
          :items="section.items"
          :feedback="personaProfile?.card?.feedback || {}"
          @feedback="handleInsightFeedback"
        />
      </div>
    </template>
  </motion.div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { isUtoolsMode } from '../../storage/env'
import {
  PROFILE_TYPES,
  loadProfile,
  saveProfile,
} from '../../storage/utools/profileRepository'
import {
  loadAiSettings,
  saveAutoProfileAnalysis,
} from '../../storage/utools/aiSettings'
import {
  profileAnalysisRunning,
  profileAnalysisProgress,
  profileRevision,
  buildPersonaPromptText,
  runProfileAnalysis,
} from '../../ai/profileExtractionService'
import PersonalityInsightCard from './PersonalityInsightCard.vue'
import SettingsSectionHeading from './SettingsSectionHeading.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  embedded: {
    type: Boolean,
    default: false,
  },
})

const { presets } = useMotionPresets()

const utoolsMode = isUtoolsMode()
const styleProfile = ref(null)
const personaProfile = ref(null)
const autoAnalyze = ref(false)
const running = profileAnalysisRunning
const progress = profileAnalysisProgress
const inlineError = ref('')
const editingType = ref('')
const editingText = ref('')
const editSaving = ref(false)
const expandedTypes = ref(new Set())
const disclaimerHover = ref(false)
const disclaimerOpen = ref(false)

const disclaimerVisible = computed(
  () => disclaimerHover.value || disclaimerOpen.value,
)

const closeDisclaimerOnOutside = (event) => {
  if (!disclaimerOpen.value) return
  const tip = event.target?.closest?.('.profile-tip')
  if (!tip) disclaimerOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeDisclaimerOnOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDisclaimerOnOutside)
})

const isExpanded = (type) => expandedTypes.value.has(type)

const toggleExpand = (type) => {
  const next = new Set(expandedTypes.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  expandedTypes.value = next
}

const handleAutoAnalyzeToggle = () => {
  try {
    saveAutoProfileAnalysis(autoAnalyze.value)
  } catch (error) {
    autoAnalyze.value = !autoAnalyze.value
    inlineError.value = error instanceof Error ? error.message : '开关保存失败'
  }
}

const cardMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.12 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const joinList = (list, sep = '、') =>
  (Array.isArray(list) ? list : []).map((item) => String(item ?? '').trim()).filter(Boolean).join(sep)

function buildRows(type, profile) {
  const card = profile?.card
  if (!card) return []

  if (type === PROFILE_TYPES.writingStyle) {
    return [
      { label: '语气', value: card.tone },
      { label: '句式', value: card.sentence },
      { label: '表达习惯', value: joinList(card.habits, '；') },
      { label: '常用词', value: joinList(card.vocabulary) },
      { label: '避免', value: joinList(card.taboo, '；') },
    ].filter((row) => row.value)
  }

  const surface = card.surface || card
  return [
    { label: '兴趣主题', value: joinList(surface.interests) },
    { label: '关注领域', value: joinList(surface.domains) },
    { label: '观点立场', value: joinList(surface.stances, '；') },
    { label: '记录场景', value: joinList(surface.scenes) },
  ].filter((row) => row.value)
}

function getSummary(profile) {
  const summary = String(profile?.card?.summary || '').trim()
  if (summary) return summary
  const prompt = String(profile?.promptText || '').trim()
  if (!prompt) return ''
  return prompt.length > 72 ? `${prompt.slice(0, 72)}…` : prompt
}

const sections = computed(() => [
  {
    type: PROFILE_TYPES.writingStyle,
    title: '文风卡片',
    profile: styleProfile.value,
    summary: getSummary(styleProfile.value),
    rows: buildRows(PROFILE_TYPES.writingStyle, styleProfile.value),
  },
  {
    type: PROFILE_TYPES.persona,
    title: '表层画像',
    profile: personaProfile.value,
    summary: getSummary(personaProfile.value),
    rows: buildRows(PROFILE_TYPES.persona, personaProfile.value),
  },
])

const deepSections = computed(() => {
  const deep = personaProfile.value?.card?.deep
  if (!deep) return []
  return [
    { key: 'thinkingPatterns', title: '思维模式', items: deep.thinkingPatterns || [] },
    { key: 'decisionPreferences', title: '决策偏好', items: deep.decisionPreferences || [] },
    { key: 'emotionalPatterns', title: '情绪模式', items: deep.emotionalPatterns || [] },
    {
      key: 'unfinishedLifeThemes',
      title: '未完成的人生主题',
      items: deep.unfinishedLifeThemes || [],
    },
  ]
})

const lastAnalyzedAt = computed(
  () => styleProfile.value?.updatedAt || personaProfile.value?.updatedAt || '',
)
const sampleCount = computed(
  () =>
    styleProfile.value?.source?.sampleCount ||
    personaProfile.value?.source?.sampleCount ||
    0,
)

async function reload() {
  if (!utoolsMode) return
  autoAnalyze.value = loadAiSettings().autoProfileAnalysis === true
  const [style, persona] = await Promise.all([
    loadProfile(PROFILE_TYPES.writingStyle),
    loadProfile(PROFILE_TYPES.persona),
  ])
  styleProfile.value = style
  personaProfile.value = persona
}

onMounted(reload)
watch(profileRevision, reload)

const handleAnalyze = async () => {
  inlineError.value = ''
  try {
    const result = await runProfileAnalysis({ force: true })
    if (result?.ok === false && result.reason === 'no-samples') {
      inlineError.value = '没有可分析的笔记，先记录一些碎片吧'
    } else if (result?.ok && result.personaSaved === false) {
      inlineError.value = '分析跑完了，但没有提取到可保存的画像。请确认模型能返回 JSON，或换更强的模型再试。'
    }
    await reload()
  } catch (error) {
    inlineError.value = error instanceof Error ? error.message : '分析失败'
  }
}

const startEdit = (section) => {
  editingType.value = section.type
  editingText.value = String(section.profile?.promptText || '')
}

const cancelEdit = () => {
  editingType.value = ''
  editingText.value = ''
}

const saveEdit = async (type) => {
  const text = editingText.value.trim()
  if (!text) {
    inlineError.value = '内容不能为空'
    return
  }
  editSaving.value = true
  inlineError.value = ''
  try {
    await saveProfile(type, { promptText: text, manualLocked: true })
    cancelEdit()
    await reload()
  } catch (error) {
    inlineError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    editSaving.value = false
  }
}

const unlock = async (type) => {
  inlineError.value = ''
  try {
    await saveProfile(type, { manualLocked: false })
    await reload()
  } catch (error) {
    inlineError.value = error instanceof Error ? error.message : '操作失败'
  }
}

const handleInsightFeedback = async ({ item, status }) => {
  if (!item?.id || !personaProfile.value?.card) return
  inlineError.value = ''
  try {
    const card = {
      ...personaProfile.value.card,
      feedback: {
        ...(personaProfile.value.card.feedback || {}),
        [item.id]: { status, insight: item.insight, updatedAt: new Date().toISOString() },
      },
    }
    await saveProfile(PROFILE_TYPES.persona, {
      card,
      promptText: buildPersonaPromptText(card),
    })
    await reload()
  } catch (error) {
    inlineError.value = error instanceof Error ? error.message : '反馈保存失败'
  }
}
</script>

<style scoped>
.profile-panel-card {
  margin-top: 14px;
  max-width: 520px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  box-sizing: border-box;
}

.profile-panel-card--embedded {
  margin-top: 0;
  max-width: none;
  width: 100%;
}

.profile-panel-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.profile-panel-head :deep(.settings-section-heading) {
  margin-bottom: 0;
}

.profile-tip {
  position: relative;
  flex: 0 0 auto;
}

.profile-tip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.profile-tip-btn:hover,
.profile-tip.is-open .profile-tip-btn {
  color: var(--color-primary);
}

.profile-tip-icon {
  width: 15px;
  height: 15px;
  display: block;
}

.profile-tip-bubble {
  position: absolute;
  left: 50%;
  top: calc(100% + 8px);
  z-index: 20;
  width: max-content;
  max-width: 260px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #18181b;
  color: #fafafa;
  font-size: 12px;
  line-height: 1.55;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  transform: translateX(-50%);
  pointer-events: none;
}

.profile-tip-bubble::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 0;
  height: 0;
  border: 6px solid transparent;
  border-bottom-color: #18181b;
  transform: translateX(-50%);
}

.profile-hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.auto-analyze-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: rgba(24, 24, 27, 0.02);
  cursor: pointer;
}

.auto-analyze-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.auto-analyze-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--color-secondary-text);
}

.profile-switch {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.profile-switch-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.profile-switch-track {
  position: relative;
  display: block;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: #d4d4d8;
  cursor: pointer;
  transition: background 0.2s ease;
}

.profile-switch.is-on .profile-switch-track {
  background: #18181b;
}

.profile-switch-thumb {
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

.profile-switch.is-on .profile-switch-thumb {
  transform: translateX(18px);
}

.profile-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.profile-meta-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.profile-analyze-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-fg);
  box-shadow: var(--btn-primary-shadow);
  font-size: 13px;
  cursor: pointer;
}

.profile-analyze-btn:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
  box-shadow: var(--btn-primary-shadow-hover);
}

.profile-analyze-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.profile-inline-error {
  margin: 0 0 10px;
  font-size: 12px;
  color: #dc2626;
}

.analysis-progress {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: rgba(37, 99, 235, 0.035);
}

.analysis-progress.is-complete {
  background: rgba(22, 163, 74, 0.04);
}

.analysis-progress.is-error {
  background: rgba(220, 38, 38, 0.04);
}

.analysis-progress-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 7px;
  font-size: 12px;
  color: var(--color-primary);
}

.analysis-progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.09);
}

.analysis-progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent);
  transition: width 0.25s ease;
}

.analysis-progress.is-complete .analysis-progress-bar {
  background: #16a34a;
}

.analysis-progress.is-error .analysis-progress-bar {
  background: #dc2626;
}

.analysis-progress-detail {
  margin: 7px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-secondary-text);
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-card {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.profile-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.profile-card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.profile-lock-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.06);
  font-size: 11px;
  color: var(--color-secondary-text);
}

.profile-summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.profile-fields {
  flex: 1;
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-field {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.profile-field-label {
  flex-shrink: 0;
  min-width: 56px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.profile-field-value {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-primary);
  word-break: break-word;
}

.profile-card-empty {
  flex: 1;
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.profile-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}

.profile-text-btn {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.profile-text-btn:hover {
  color: var(--color-accent);
}

.profile-text-btn--primary {
  color: var(--color-accent);
}

.profile-text-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.profile-edit-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-primary);
  resize: vertical;
  box-sizing: border-box;
}

.profile-edit-textarea:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.45);
}

.deep-personality {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.deep-personality-title {
  margin: 0 0 1px;
  font-size: 14px;
  color: var(--color-primary);
}

</style>
