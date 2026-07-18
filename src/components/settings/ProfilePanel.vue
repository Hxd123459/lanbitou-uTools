<template>
  <motion.div
    class="profile-panel-card"
    :initial="cardMotion.initial"
    :animate="cardMotion.animate"
    :transition="cardMotion.transition"
  >
    <SettingsSectionHeading title="我的画像与文风" />

    <p v-if="!utoolsMode" class="profile-hint">仅 uTools 环境下可用。</p>

    <template v-else>
      <div class="profile-meta">
        <p class="profile-meta-text">
          <template v-if="lastAnalyzedAt">
            上次分析：{{ lastAnalyzedAt }}<template v-if="sampleCount">
              · 采样 {{ sampleCount }} 条</template>
          </template>
          <template v-else>
            尚未生成。积累一些碎片后会自动分析，也可以立即手动分析。
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
              <button type="button" class="profile-text-btn" @click="startEdit(section)">
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
    </template>
  </motion.div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { isUtoolsMode } from '../../storage/env'
import {
  PROFILE_TYPES,
  loadProfile,
  saveProfile,
} from '../../storage/utools/profileRepository'
import {
  profileAnalysisRunning,
  profileRevision,
  runProfileAnalysis,
} from '../../ai/profileExtractionService'
import SettingsSectionHeading from './SettingsSectionHeading.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const { presets } = useMotionPresets()

const utoolsMode = isUtoolsMode()
const styleProfile = ref(null)
const personaProfile = ref(null)
const running = profileAnalysisRunning
const inlineError = ref('')
const editingType = ref('')
const editingText = ref('')
const editSaving = ref(false)
const expandedTypes = ref(new Set())

const isExpanded = (type) => expandedTypes.value.has(type)

const toggleExpand = (type) => {
  const next = new Set(expandedTypes.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  expandedTypes.value = next
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

  return [
    { label: '兴趣主题', value: joinList(card.interests) },
    { label: '关注领域', value: joinList(card.domains) },
    { label: '观点立场', value: joinList(card.stances, '；') },
    { label: '记录场景', value: joinList(card.scenes) },
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
    title: '用户画像',
    profile: personaProfile.value,
    summary: getSummary(personaProfile.value),
    rows: buildRows(PROFILE_TYPES.persona, personaProfile.value),
  },
])

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
}

.profile-hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
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

</style>
