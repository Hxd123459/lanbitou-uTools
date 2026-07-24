<template>
  <section class="project-detail-view">
    <header class="project-detail-header">
      <div class="project-detail-heading">
        <h2 class="project-detail-title">
          <button
            type="button"
            class="project-detail-crumb"
            title="返回事情列表"
            @click="emit('back')"
          >事情</button><span class="project-detail-crumb-sep">/</span><span class="project-detail-title-text">{{ project?.name || '详情' }}</span>
        </h2>
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
        </p>
        <p class="project-detail-summary" aria-label="任务统计">
          <strong>{{ stats.total }}</strong> 项
          <span class="project-detail-summary-sep">·</span>
          完成 <strong class="is-done">{{ stats.done }}</strong>
          <span class="project-detail-summary-sep">·</span>
          未完成 <strong class="is-pending">{{ stats.pending }}</strong>
        </p>
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

    <p v-if="loading && !todos.length" class="project-detail-state">加载中…</p>
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
import AppButton from '../motion/AppButton.vue'
import TodoItemRow from './TodoItemRow.vue'

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

.project-detail-heading {
  min-width: 0;
  flex: 1 1 auto;
}

.project-detail-title {
  margin: 0 0 8px;
  display: flex;
  align-items: baseline;
  min-width: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--color-primary);
  line-height: 1.3;
}

.project-detail-crumb {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #a1a1aa;
  font-family: inherit;
  font-size: inherit;
  font-weight: 500;
  line-height: inherit;
  cursor: pointer;
}

.project-detail-crumb:hover {
  color: var(--color-secondary-text);
}

.project-detail-crumb-sep {
  flex: 0 0 auto;
  margin: 0 0.35em;
  color: #a1a1aa;
  font-weight: 500;
}

.project-detail-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-detail-meta {
  margin: 0 0 6px;
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

.project-detail-summary {
  margin: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
  font-variant-numeric: tabular-nums;
}

.project-detail-summary strong {
  font-weight: 650;
  color: var(--color-primary);
}

.project-detail-summary strong.is-done {
  color: var(--color-success);
}

.project-detail-summary strong.is-pending {
  color: var(--color-accent);
}

.project-detail-summary-sep {
  margin: 0 4px;
  color: rgba(24, 24, 27, 0.28);
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
