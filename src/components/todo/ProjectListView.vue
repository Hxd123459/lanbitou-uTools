<template>
  <section class="project-list-view">
    <header class="project-list-header">
      <div class="project-list-header-text">
        <h2 class="project-list-title">事情</h2>
        <p class="project-list-desc">围绕一件事收集待办，可绑定标签自动同步</p>
      </div>
      <div class="project-list-header-actions">
        <AppButton
          type="button"
          class="btn btn-icon-text project-list-filter"
          :class="{ 'is-active': showArchived }"
          @click="showArchived = !showArchived"
        >
          {{ showArchived ? '隐藏已归档' : '显示已归档' }}
        </AppButton>
        <AppButton type="button" class="btn btn-primary" @click="emit('create')">
          新建事情
        </AppButton>
      </div>
    </header>

    <p v-if="loading" class="project-list-state">加载中…</p>
    <p v-else-if="!visibleProjects.length" class="project-list-state">
      {{ showArchived ? '暂无事情' : '还没有进行中的事情，点右上角新建' }}
    </p>

    <ul v-else class="project-list" role="list">
      <motion.li
        v-for="project in visibleProjects"
        :key="project.id"
        class="project-card"
        :class="{ 'is-archived': project.status === 'archived' }"
        layout
        :initial="presets.reveal.initial"
        :animate="presets.reveal.animate"
      >
        <div class="project-card-meta">
          <div class="project-card-meta-left">
            <button type="button" class="project-card-name" @click="emit('open', project)">
              {{ project.name }}
            </button>
            <span v-if="project.status === 'archived'" class="project-card-badge">已归档</span>
            <button
              v-for="tag in tagsOf(project)"
              :key="`${project.id}-${tag.id}`"
              type="button"
              class="note-tag"
              :title="`查看标签「${tag.name}」下的碎片`"
              @click.stop="emit('open-tag', tag)"
            >
              #{{ tag.name }}
            </button>
            <span v-if="!tagsOf(project).length" class="project-card-tag-empty">未绑定标签</span>
          </div>
          <div class="project-card-actions">
            <motion.button
              type="button"
              class="icon-btn"
              title="编辑"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emit('edit', project)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </motion.button>
            <motion.button
              type="button"
              class="icon-btn"
              :title="project.status === 'archived' ? '取消归档' : '归档'"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emit('toggle-archive', project)"
            >
              <svg
                v-if="project.status === 'archived'"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M21 8v13H3V8" />
                <path d="M23 3H1v5h22V3z" />
                <path d="M10 12h4" />
              </svg>
            </motion.button>
            <motion.button
              type="button"
              class="icon-btn icon-btn-danger"
              title="删除"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emit('delete', project)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </motion.button>
          </div>
        </div>

        <button type="button" class="project-card-body" @click="emit('open', project)">
          <div class="project-card-stats" aria-label="任务统计">
            <span class="project-stat">
              <span class="project-stat-label">总数</span>
              <strong>{{ statsOf(project).total }}</strong>
            </span>
            <span class="project-stat is-done">
              <span class="project-stat-label">已完成</span>
              <strong>{{ statsOf(project).done }}</strong>
            </span>
            <span class="project-stat is-pending">
              <span class="project-stat-label">未完成</span>
              <strong>{{ statsOf(project).pending }}</strong>
            </span>
          </div>

          <div class="project-card-dates">
            <span class="project-card-date-item" title="起止时间">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4M16 3v4M3 10h18" />
              </svg>
              {{ dateRangeOf(project) }}
            </span>
          </div>
        </button>
      </motion.li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import AppButton from '../motion/AppButton.vue'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  projects: { type: Array, default: () => [] },
  tagNameById: { type: Object, default: () => ({}) },
  todoCounts: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['create', 'open', 'edit', 'delete', 'toggle-archive', 'open-tag'])

const { presets } = useMotionPresets()
const showArchived = ref(false)

const visibleProjects = computed(() => {
  const list = Array.isArray(props.projects) ? props.projects : []
  if (showArchived.value) return list
  return list.filter((item) => item.status !== 'archived')
})

const emptyStats = { total: 0, done: 0, pending: 0 }

const statsOf = (project) => {
  const raw = props.todoCounts?.[String(project.id)]
  if (!raw) return emptyStats
  return {
    total: Number(raw.total) || 0,
    done: Number(raw.done) || 0,
    pending: Number(raw.pending) || 0,
  }
}

const formatDate = (value) => {
  const text = String(value || '').trim()
  return text ? text.slice(0, 10) : ''
}

const dateRangeOf = (project) => {
  const start = formatDate(project.startAt)
  const end = formatDate(project.endAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} 起`
  if (end) return `至 ${end}`
  return '未设置起止时间'
}

const tagsOf = (project) => {
  const ids = Array.isArray(project.tagIds) ? project.tagIds : []
  return ids
    .map((id) => {
      const name = props.tagNameById[String(id)]
      if (!name) return null
      return { id: String(id), name }
    })
    .filter(Boolean)
}
</script>

<style scoped>
.project-list-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  height: 100%;
}

.project-list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.project-list-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 650;
  color: var(--color-primary);
}

.project-list-desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.project-list-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.project-list-filter.is-active {
  color: var(--color-accent);
}

.project-list-state {
  margin: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.project-list {
  list-style: none;
  margin: 0;
  padding: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.project-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.project-card.is-archived {
  opacity: 0.72;
}

.project-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.project-card-meta-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.project-card-name {
  padding: 0;
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card-name:hover {
  color: var(--color-accent);
}

.project-card-badge {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-warning);
}

.note-tag {
  display: inline-block;
  padding: 2px 8px;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.2px;
  white-space: nowrap;
  cursor: pointer;
}

button.note-tag:hover {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-accent);
}

.project-card-tag-empty {
  font-size: 12px;
  color: var(--color-secondary-text);
}

.project-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.project-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.project-card-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.project-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.03);
  border: 1px solid rgba(24, 24, 27, 0.04);
}

.project-stat strong {
  font-size: 16px;
  font-weight: 650;
  color: var(--color-primary);
  line-height: 1.2;
}

.project-stat-label {
  font-size: 11px;
  color: var(--color-secondary-text);
}

.project-stat.is-done strong {
  color: var(--color-success);
}

.project-stat.is-pending strong {
  color: var(--color-accent);
}

.project-card-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.project-card-date-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-secondary-text);
  cursor: pointer;
  padding: 0;
}

.icon-btn:hover {
  border-color: var(--btn-icon-border-hover);
  background: var(--btn-icon-bg-hover);
  color: var(--btn-icon-color-hover);
}

.icon-btn-danger:hover {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.06);
  color: var(--color-error);
}

@media (max-width: 720px) {
  .project-list-header {
    flex-direction: column;
  }
}
</style>
