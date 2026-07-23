<template>
  <section class="project-detail-view">
    <header class="project-detail-header">
      <div class="project-detail-header-main">
        <motion.button
          type="button"
          class="icon-btn project-detail-back"
          title="返回"
          :while-hover="presets.button.hover"
          :while-tap="presets.button.tap"
          :transition="presets.button.transition"
          @click="emit('back')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </motion.button>
        <div class="project-detail-heading">
          <h2 class="project-detail-title">{{ project?.name || '事情' }}</h2>
          <p class="project-detail-meta">
            <span class="project-detail-meta-item">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4M16 3v4M3 10h18" />
              </svg>
              {{ dateRangeText }}
            </span>
            <button
              v-for="tag in projectTags"
              :key="tag.id"
              type="button"
              class="note-tag"
              :title="`查看标签「${tag.name}」下的碎片`"
              @click="emit('open-tag', tag)"
            >
              #{{ tag.name }}
            </button>
            <span v-if="!projectTags.length">未绑定同步标签</span>
          </p>
        </div>
      </div>
      <div class="project-detail-header-actions">
        <AppButton type="button" class="btn btn-icon-text" :disabled="busy" @click="emit('edit', project)">
          编辑
        </AppButton>
        <AppButton
          type="button"
          class="btn btn-primary"
          :disabled="busy || syncing"
          @click="emit('sync')"
        >
          {{ syncing ? '提取中…' : '同步待办' }}
        </AppButton>
      </div>
    </header>

    <div class="project-detail-stats" aria-label="任务统计">
      <div class="project-detail-stat">
        <span class="project-detail-stat-label">总数</span>
        <strong>{{ stats.total }}</strong>
      </div>
      <div class="project-detail-stat is-done">
        <span class="project-detail-stat-label">已完成</span>
        <strong>{{ stats.done }}</strong>
      </div>
      <div class="project-detail-stat is-pending">
        <span class="project-detail-stat-label">未完成</span>
        <strong>{{ stats.pending }}</strong>
      </div>
    </div>

    <form class="project-detail-composer" @submit.prevent="handleAdd">
      <input
        ref="inputRef"
        v-model="draftTitle"
        class="project-detail-input"
        type="text"
        maxlength="120"
        placeholder="添加待办，回车确认"
        :disabled="busy"
      />
      <AppButton class="btn btn-primary project-detail-add-btn" type="submit" :disabled="busy || !canAdd">
        添加
      </AppButton>
    </form>

    <p v-if="loading" class="project-detail-state">加载中…</p>
    <p v-else-if="!todos.length" class="project-detail-state">暂无待办，可手动添加或同步提取</p>

    <ul v-else class="project-detail-list" role="list">
      <TodoItemRow
        v-for="todo in todos"
        :key="todo.id"
        :todo="todo"
        :busy="busy"
        @toggle="emit('toggle-todo', $event)"
        @delete="emit('delete-todo', $event)"
        @open-source="emit('open-source', $event)"
        @open-tag="emit('open-tag', $event)"
        @update-title="emit('update-todo-title', $event)"
      />
    </ul>
  </section>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { motion } from 'motion-v'
import AppButton from '../motion/AppButton.vue'
import TodoItemRow from './TodoItemRow.vue'
import { useMotionPresets } from '../../composables/useMotionPresets'

const props = defineProps({
  project: { type: Object, default: null },
  todos: { type: Array, default: () => [] },
  tagNameById: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  syncing: { type: Boolean, default: false },
})

const emit = defineEmits([
  'back',
  'edit',
  'sync',
  'add-todo',
  'toggle-todo',
  'delete-todo',
  'open-source',
  'open-tag',
  'update-todo-title',
])

const { presets } = useMotionPresets()
const draftTitle = ref('')
const inputRef = ref(null)
const canAdd = computed(() => String(draftTitle.value || '').trim().length > 0)

const stats = computed(() => {
  const list = Array.isArray(props.todos) ? props.todos : []
  const done = list.filter((item) => item.done).length
  return {
    total: list.length,
    done,
    pending: list.length - done,
  }
})

const dateRangeText = computed(() => {
  const start = String(props.project?.startAt || '').slice(0, 10)
  const end = String(props.project?.endAt || '').slice(0, 10)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} 起`
  if (end) return `至 ${end}`
  return '未设置起止时间'
})

const projectTags = computed(() => {
  const ids = Array.isArray(props.project?.tagIds) ? props.project.tagIds : []
  return ids
    .map((id) => {
      const name = props.tagNameById[String(id)]
      if (!name) return null
      return { id: String(id), name }
    })
    .filter(Boolean)
})

const focusInput = async () => {
  await nextTick()
  inputRef.value?.focus?.()
}

const handleAdd = async () => {
  const title = String(draftTitle.value || '').trim()
  if (!title) return
  emit('add-todo', title)
  draftTitle.value = ''
  await focusInput()
}

defineExpose({ focusInput })
</script>

<style scoped>
.project-detail-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  height: 100%;
}

.project-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.project-detail-header-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.project-detail-back {
  flex: 0 0 auto;
  margin-top: 2px;
}

.project-detail-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 650;
  color: var(--color-primary);
}

.project-detail-meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.project-detail-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.project-detail-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-detail-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.project-detail-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(24, 24, 27, 0.03);
  border: 1px solid rgba(24, 24, 27, 0.04);
}

.project-detail-stat strong {
  font-size: 18px;
  font-weight: 650;
  color: var(--color-primary);
  line-height: 1.2;
}

.project-detail-stat-label {
  font-size: 11px;
  color: var(--color-secondary-text);
}

.project-detail-stat.is-done strong {
  color: var(--color-success);
}

.project-detail-stat.is-pending strong {
  color: var(--color-accent);
}

.project-detail-composer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-detail-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
}

.project-detail-input:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.project-detail-add-btn {
  height: 36px;
  flex: 0 0 auto;
}

.project-detail-state {
  margin: 20px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.project-detail-list {
  list-style: none;
  margin: 0;
  padding: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
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

@media (max-width: 720px) {
  .project-detail-header {
    flex-direction: column;
  }
}
</style>
