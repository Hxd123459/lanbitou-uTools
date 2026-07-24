<template>
  <article class="insight-card">
    <button type="button" class="insight-head" @click="expanded = !expanded">
      <span>
        <strong class="insight-title">{{ title }}</strong>
        <span class="insight-count">{{ visibleItems.length }} 项洞察</span>
      </span>
      <span class="insight-toggle">{{ expanded ? '收起' : '展开' }}</span>
    </button>

    <p v-if="!visibleItems.length" class="insight-empty">
      暂无满足多重证据要求的洞察
    </p>

    <div v-else-if="expanded" class="insight-list">
      <section v-for="item in visibleItems" :key="item.id" class="insight-item">
        <div class="insight-claim-row">
          <p class="insight-claim">{{ item.insight }}</p>
          <span class="confidence" :class="`confidence--${item.confidence}`">
            {{ confidenceLabel(item.confidence) }}
          </span>
        </div>
        <p v-if="item.scope" class="insight-scope">适用边界：{{ item.scope }}</p>

        <details v-if="item.evidence?.length" class="evidence-details">
          <summary>查看 {{ item.evidence.length }} 条依据</summary>
          <blockquote
            v-for="evidence in item.evidence"
            :key="evidence.sampleKey"
            class="evidence"
          >
            <p>“{{ evidence.quote || evidence.excerpt }}”</p>
            <cite>
              {{ sourceLabel(evidence) }}<template v-if="evidence.time">
                · {{ evidence.time }}</template>
            </cite>
          </blockquote>
        </details>

        <details v-if="item.counterEvidence?.length" class="evidence-details">
          <summary>查看反证</summary>
          <blockquote
            v-for="evidence in item.counterEvidence"
            :key="evidence.sampleKey"
            class="evidence evidence--counter"
          >
            <p>“{{ evidence.quote || evidence.excerpt }}”</p>
            <cite>{{ sourceLabel(evidence) }}</cite>
          </blockquote>
        </details>

        <div class="feedback-actions">
          <span class="feedback-label">{{ feedbackLabel(item.id) }}</span>
          <button type="button" @click="emitFeedback(item, 'confirmed')">准确</button>
          <button type="button" @click="emitFeedback(item, 'rejected')">不准确</button>
          <button type="button" @click="emitFeedback(item, 'hidden')">隐藏</button>
        </div>
      </section>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  feedback: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['feedback'])
const expanded = ref(false)

const feedbackStatus = (id) => {
  const value = props.feedback?.[id]
  return typeof value === 'string' ? value : value?.status
}

const visibleItems = computed(() =>
  props.items.filter((item) => feedbackStatus(item.id) !== 'hidden'),
)

const confidenceLabel = (value) => {
  if (value === 'high') return '高置信'
  if (value === 'medium') return '中置信'
  return '待验证'
}

const sourceLabel = (evidence) => {
  if (evidence.title) return evidence.title
  return evidence.sourceType === 'structNote' ? '沉淀长文' : '碎片记录'
}

const feedbackLabel = (id) => {
  const status = feedbackStatus(id)
  if (status === 'confirmed') return '你已确认'
  if (status === 'rejected') return '你认为不准确'
  return '这项洞察准确吗？'
}

const emitFeedback = (item, status) => {
  emit('feedback', { item, status })
}
</script>

<style scoped>
.insight-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  overflow: hidden;
}

.insight-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  text-align: left;
  cursor: pointer;
}

.insight-title {
  font-size: 14px;
}

.insight-count,
.insight-toggle,
.insight-empty,
.insight-scope,
.feedback-label {
  font-size: 12px;
  color: var(--color-secondary-text);
}

.insight-count {
  margin-left: 8px;
  font-weight: 400;
}

.insight-empty {
  margin: -2px 14px 12px;
}

.insight-list {
  padding: 0 14px 12px;
}

.insight-item {
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
}

.insight-claim-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.insight-claim {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-primary);
}

.confidence {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
}

.confidence--high {
  color: #166534;
  background: #dcfce7;
}

.confidence--medium {
  color: #92400e;
  background: #fef3c7;
}

.confidence--low {
  color: var(--color-secondary-text);
  background: rgba(24, 24, 27, 0.06);
}

.insight-scope {
  margin: 6px 0 0;
  line-height: 1.5;
}

.evidence-details {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.evidence-details summary {
  cursor: pointer;
}

.evidence {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-left: 2px solid var(--color-accent);
  background: rgba(37, 99, 235, 0.04);
}

.evidence--counter {
  border-left-color: #d97706;
  background: rgba(217, 119, 6, 0.04);
}

.evidence p {
  margin: 0 0 4px;
  color: var(--color-primary);
  line-height: 1.5;
}

.evidence cite {
  font-style: normal;
}

.feedback-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.feedback-actions button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-accent);
  font-size: 12px;
  cursor: pointer;
}
</style>
