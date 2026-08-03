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
          >事情</button><span class="project-detail-crumb-sep">/</span><span class="project-detail-title-text">{{ project?.name || '详情' }}</span><button
            v-if="primaryTag"
            type="button"
            class="project-detail-title-tag"
            :title="`查看标签「${primaryTag.name}」下的碎片`"
            @click="emit('open-tag', primaryTag)"
          >#{{ primaryTag.name }}</button>
          <button
            v-else-if="!hasTag"
            type="button"
            class="project-detail-title-tag-add"
            title="关联同步标签"
            :disabled="busy"
            @click="emit('edit', project)"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </h2>
        <p class="project-detail-meta">
          <span class="project-detail-meta-item">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
            {{ dateRangeText }}
          </span>
        </p>
      </div>
      <div class="project-detail-header-actions">
        <span
          v-if="hasTag && syncing"
          class="project-detail-last-sync is-visible"
        >
          {{ syncPhase || '同步中…' }}
        </span>
        <span
          v-else-if="hasTag"
          class="project-detail-last-sync"
          aria-hidden="true"
        >
          上一次同步时间：{{ lastSyncedText || '尚未同步' }}
        </span>
        <AppButton type="button" class="btn btn-icon-text" :disabled="busy" @click="emit('edit', project)">
          编辑
        </AppButton>
        <AppButton
          type="button"
          class="btn btn-primary project-detail-add-icon-btn"
          aria-label="新增待办"
          title="新增待办"
          :disabled="busy"
          @click="emit('open-add')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </AppButton>
        <AppButton
          v-if="hasTag"
          type="button"
          class="btn btn-primary project-detail-sync-btn"
          :disabled="busy || syncing || pendingSyncCount > 0"
          :title="
            pendingSyncCount > 0
              ? '请先确认上次提取结果'
              : undefined
          "
          @click="emit('sync')"
        >
          {{ syncing ? '提取中…' : pendingSyncCount > 0 ? '待确认' : '同步待办' }}
        </AppButton>
      </div>
    </header>

    <div
      v-if="pendingSyncCount > 0 && !syncing"
      class="project-detail-pending-banner"
      role="status"
    >
      <span>有 {{ pendingSyncCount }} 条同步结果待确认，确认或放弃后才能再次同步</span>
      <AppButton
        type="button"
        class="btn btn-primary project-detail-pending-btn"
        :disabled="busy"
        @click="emit('open-pending-sync')"
      >
        去确认
      </AppButton>
    </div>

    <div class="project-detail-toolbar">
      <div class="project-detail-links">
        <button
          v-if="project?.sedimentFolderId"
          type="button"
          class="project-detail-folder-chip"
          :title="sedimentFolderName || '沉淀文件夹'"
          aria-label="打开沉淀文件夹"
          @click="emit('open-sediment-folder')"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </svg>
          <span>文件夹</span>
        </button>
        <span
          v-else
          class="project-detail-folder-chip is-muted"
          title="保存事情后自动创建"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </svg>
          <span>文件夹</span>
        </span>
      </div>

      <div class="project-detail-toolbar-right">
        <div class="project-detail-status-area">
          <button
            v-if="!syncing && pendingSyncCount > 0"
            type="button"
            class="project-detail-status-badge is-pending-sync"
            @click="emit('open-pending-sync')"
          >
            待确认 {{ pendingSyncCount }} 条
          </button>
        </div>

        <div class="project-detail-scope" role="tablist" aria-label="按状态筛选">
          <button
            v-for="opt in statusFilterOptions"
            :key="opt.key"
            type="button"
            class="project-detail-scope-btn"
            :class="{ 'is-active': statusFilter === opt.key }"
            role="tab"
            :aria-selected="statusFilter === opt.key"
            @click="setStatusFilter(opt.key)"
          >
            <motion.span
              v-if="statusFilter === opt.key"
              layout-id="todoStatusScope"
              class="project-detail-scope-active-bg"
              :transition="presets.layoutSpring"
            />
            <span class="project-detail-scope-label">{{ opt.label }}</span>
            <span class="project-detail-scope-count">{{ statusCounts[opt.key] || 0 }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="project-detail-pane">
      <div class="project-detail-todos">
        <div
          v-if="loading && !todos.length"
          class="project-detail-empty"
        >
          <p class="project-detail-state">加载中…</p>
        </div>
        <div
          v-else-if="!todos.length"
          class="project-detail-empty"
        >
          <p class="project-detail-state">{{ emptyTodosHint }}</p>
        </div>
        <p
          v-else-if="!filteredTodos.length"
          class="project-detail-state project-detail-state--inline"
        >
          该状态下暂无待办
        </p>

        <VueDraggable
          v-else
          ref="todoListRef"
          v-model="sortableTodos"
          item-key="id"
          tag="ul"
          class="project-detail-list"
          :class="{ 'has-bottom-bar': hasBottomBar }"
          role="list"
          :animation="180"
          :disabled="busy || sortSaving || statusFilter !== 'all' || selectedCount > 0"
          handle=".todo-sort-handle"
          filter=".todo-item-check, .todo-item-actions, .todo-item-corner-actions, input, textarea"
          :prevent-on-filter="false"
          ghost-class="todo-sort-ghost"
          chosen-class="todo-sort-chosen"
          @end="onTodoSortEnd"
        >
          <TodoItemRow
            v-for="todo in sortableTodos"
            :key="todo.id"
            :todo="todo"
            :busy="busy"
            :selected="selectedIds.has(String(todo.id))"
            :highlighted="highlightedTodoId === String(todo.id)"
            :sortable="statusFilter === 'all' && selectedCount === 0"
            @delete="emit('delete-todo', $event)"
            @open-source="emit('open-source', $event)"
            @update-title="emit('update-todo-title', $event)"
            @select-change="onSelectChange"
            @toggle-done="emit('toggle-todo', $event)"
          />
        </VueDraggable>
      </div>

      <AnimatePresence :initial="false">
        <div
          v-if="selectedCount > 0"
          key="todo-bulk-bar-wrap"
          class="project-detail-bottom-bar-wrap"
        >
          <motion.div
            class="project-detail-bulk-bar"
            role="toolbar"
            aria-label="已选待办操作"
            :initial="presets.reveal.initial"
            :animate="presets.reveal.animate"
            :exit="presets.reveal.exit"
            :transition="presets.reveal.transition"
          >
            <div class="project-detail-bulk-group">
              <motion.button
                type="button"
                class="project-detail-bulk-btn"
                :disabled="busy"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="emit('bulk-complete')"
              >
                <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span class="project-detail-bulk-btn-label">批量完成</span>
              </motion.button>
              <motion.button
                type="button"
                class="project-detail-bulk-btn"
                :disabled="busy || !sortableTodos.length"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="selectAllCurrent"
              >
                <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="m8 12 2.5 2.5L16 9" />
                  </svg>
                </span>
                <span class="project-detail-bulk-btn-label">全选</span>
              </motion.button>
            </div>

            <div v-if="todoTemplates.length" class="project-detail-bulk-group">
              <motion.button
                v-for="tpl in todoTemplates"
                :key="tpl.id"
                type="button"
                class="project-detail-bulk-btn"
                :disabled="busy"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="emit('generate-selected', tpl.id)"
              >
                <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                </span>
                <span class="project-detail-bulk-btn-label">{{ tpl.title }}</span>
              </motion.button>
            </div>

            <div class="project-detail-bulk-group">
              <motion.button
                type="button"
                class="project-detail-bulk-btn project-detail-bulk-btn--clear"
                :disabled="busy"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="clearSelection"
              >
                <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 1024 1024"
                    width="18"
                    height="18"
                    fill="currentColor"
                    style="stroke: currentColor; stroke-width: 2.5;"
                  >
                    <path
                      d="M274.56 798.997333l19.434667-25.130666-33.792 68.565333a18.133333 18.133333 0 0 0 11.562666 25.536l59.733334 16a18.133333 18.133333 0 0 0 17.28-4.48c20.522667-19.818667 35.626667-35.989333 45.290666-48.469333l19.456-25.130667-33.813333 68.565333a18.133333 18.133333 0 0 0 11.562667 25.536l84.48 22.634667a18.133333 18.133333 0 0 0 17.28-4.48c20.522667-19.84 35.626667-35.989333 45.269333-48.469333l19.456-25.130667-33.813333 68.565333A18.133333 18.133333 0 0 0 535.530667 938.666667l72.106666 19.328a18.133333 18.133333 0 0 0 17.28-4.48c20.522667-19.84 35.626667-36.010667 45.269334-48.490667l19.456-25.130667-33.813334 68.586667a18.133333 18.133333 0 0 0 11.584 25.514667l86.421334 23.338666 3.84-0.213333c13.269333-0.704 29.056-5.034667 43.84-12.8 29.781333-15.701333 48.170667-43.2 52.181333-78.250667 2.133333-18.517333 4.778667-38.549333 8.405333-63.530666 1.642667-11.221333 2.944-20.010667 6.229334-41.834667 11.050667-73.322667 14.634667-101.034667 17.130666-133.674667l0.938667-12.373333 2.837333-2.922667 12.330667-1.344a41.813333 41.813333 0 0 0 24.810667-11.221333c10.730667-10.24 14.805333-25.386667 11.093333-42.197333l-37.546667-171.584c-3.029333-13.696-11.264-27.946667-23.146666-39.829334-11.648-11.626667-25.92-20.138667-39.893334-23.893333L723.626667 331.306667l-2.261334-3.925334L774.250667 130.133333c8.32-31.061333-11.754667-63.744-44.970667-72.64l-79.509333-21.312c-33.194667-8.896-66.922667 9.365333-75.264 40.426667l-52.842667 197.269333-3.925333 2.261334-118.101334-31.637334c-13.994667-3.754667-30.634667-3.498667-46.506666 0.746667-16.256 4.352-30.506667 12.586667-39.957334 22.933333l-118.314666 129.792c-11.605333 12.714667-15.658667 27.84-11.52 42.090667 4.16 14.229333 15.850667 25.194667 32.896 30.528l13.610666 4.266667 2.133334 3.882666-3.626667 13.802667c-21.12 79.850667-52.885333 136.917333-85.717333 150.890667-47.530667 20.202667-72.938667 49.429333-78.421334 85.034666-5.034667 32.682667 9.28 67.114667 37.589334 91.541334l22.037333 8.341333 74.666667 20.010667a42.666667 42.666667 0 0 0 41.216-11.050667c15.274667-15.274667 26.88-28.032 34.837333-38.293333zm551.381333-396.565333c14.144 3.797333 29.952 19.2 32.768 32l34.56 157.781333a10.666667 10.666667 0 0 1-13.184 12.586667L240.64 433.493333a10.666667 10.666667 0 0 1-5.12-17.493333l108.8-119.36c8.832-9.685333 30.229333-15.146667 44.373333-11.349333l141.333334 37.866666a21.333333 21.333333 0 0 0 26.133333-15.082666l58.304-217.642667a21.333333 21.333333 0 0 1 26.133333-15.082667l77.056 20.650667a21.333333 21.333333 0 0 1 15.082667 26.133333l-58.325333 217.642667a21.333333 21.333333 0 0 0 15.082666 26.112l136.448 36.565333zM315.456 701.568c-33.664 45.141333-64.597333 79.082667-92.8 101.802667l-5.909333 4.778666-2.837334 0.597334-88.106666-24.106667-2.922667-3.2c-13.034667-14.165333-19.370667-31.04-16.981333-46.592 3.285333-21.333333 22.058667-39.338667 53.205333-52.586667 31.722667-13.482667 59.818667-47.104 82.922667-99.904 10.026667-22.954667 18.88-48.725333 26.389333-76.586666l3.882667-14.4 3.904-2.261334 566.165333 151.701334 2.346667 3.306666-0.789334 12.224c-1.984 30.592-30.336 229.397333-32.128 244.906667-2.346667 20.416-11.306667 34.986667-27.605333 44.394667a73.237333 73.237333 0 0 1-21.397333 8.106666l-5.013334 0.725334-60.373333-16.170667 11.242667-20.288c8.277333-14.976 22.656-43.84 43.093333-86.613333a21.12 21.12 0 0 0-9.962667-28.16l-3.136-1.493334a21.333333 21.333333 0 0 0-26.261333 6.485334c-33.642667 45.056-64.533333 78.912-92.672 101.546666l-5.909333 4.757334-2.837334 0.597333-52.544-14.08 11.114667-20.266667c3.562667-6.485333 7.04-13.013333 10.453333-19.626666 7.04-13.504 17.898667-35.797333 32.597334-66.816a21.290667 21.290667 0 0 0-9.984-28.309334l-3.029334-1.450666a21.333333 21.333333 0 0 0-26.368 6.442666c-33.6 45.013333-64.469333 78.826667-92.608 101.482667l-5.909333 4.757333-2.837333 0.597334-52.138667-13.973334 11.114667-20.266666c3.242667-5.888 6.72-12.416 10.453333-19.626667 6.997333-13.461333 17.962667-35.946667 32.896-67.434667a20.970667 20.970667 0 0 0-10.112-28.010666l-3.328-1.536a21.333333 21.333333 0 0 0-26.069333 6.613333c-33.642667 45.056-64.554667 78.976-92.778667 101.696l-5.909333 4.757333-2.837334 0.597334-32.64-8.746667 11.093334-20.245333c3.541333-6.506667 7.04-13.034667 10.453333-19.626667 6.976-13.482667 17.941333-35.968 32.874667-67.456a21.056 21.056 0 0 0-10.069334-28.074667l-3.242666-1.514666a21.333333 21.333333 0 0 0-26.154667 6.549333z"
                    />
                  </svg>
                </span>
                <span class="project-detail-bulk-btn-label">清空已选</span>
              </motion.button>
              <motion.button
                type="button"
                class="project-detail-bulk-btn project-detail-bulk-btn--danger"
                :disabled="busy"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="emit('bulk-delete')"
              >
                <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </span>
                <span class="project-detail-bulk-btn-label">删除</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { VueDraggable } from 'vue-draggable-plus'
import AppButton from '../motion/AppButton.vue'
import TodoItemRow from './TodoItemRow.vue'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useSedimentTemplates } from '../../composables/useSedimentTemplates'
import { TEMPLATE_KIND_TODO } from '../../storage/utools/sedimentTemplates'
import { fetchStructFolder } from '../../api/structFolder'

const props = defineProps({
  project: { type: Object, default: null },
  todos: { type: Array, default: () => [] },
  tagNameById: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  syncing: { type: Boolean, default: false },
  syncPhase: { type: String, default: '' },
  pendingSyncCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'back',
  'edit',
  'sync',
  'open-pending-sync',
  'open-add',
  'delete-todo',
  'open-source',
  'open-tag',
  'open-sediment-folder',
  'update-todo-title',
  'toggle-todo',
  'generate-selected',
  'bulk-complete',
  'bulk-delete',
  'reorder-todos',
])

const { presets } = useMotionPresets()
const { templates: allTemplates } = useSedimentTemplates()
const todoTemplates = computed(() =>
  (allTemplates.value || []).filter((item) => item.kind === TEMPLATE_KIND_TODO),
)

const selectedIds = ref(new Set())
const statusFilter = ref('all')
const sedimentFolderName = ref('')
const sortSaving = ref(false)
const sortableTodos = ref([])
const todoListRef = ref(null)
const highlightedTodoId = ref('')
let highlightTimer = null

const selectedCount = computed(() => selectedIds.value.size)
const hasBottomBar = computed(() => selectedCount.value > 0)

const hasTag = computed(() => {
  const ids = Array.isArray(props.project?.tagIds) ? props.project.tagIds : []
  return ids.some((id) => String(id || '').trim())
})

const emptyTodosHint = computed(() => {
  if (hasTag.value) return '暂无待办，可点右上角 + 添加或同步提取'
  return '暂无待办，可点右上角 + 添加'
})

const statusFilterOptions = [
  { key: 'all', label: '全部' },
  { key: 'idle', label: '未完成' },
  { key: 'done', label: '已完成' },
]

const todoStatusKey = (todo) => (todo?.done ? 'done' : 'idle')

const statusCounts = computed(() => {
  const list = Array.isArray(props.todos) ? props.todos : []
  const counts = { all: list.length, idle: 0, done: 0 }
  list.forEach((todo) => {
    const key = todoStatusKey(todo)
    counts[key] = (counts[key] || 0) + 1
  })
  return counts
})

const filteredTodos = computed(() => {
  const list = Array.isArray(props.todos) ? props.todos : []
  // 始终返回新数组，且读取 done，避免完成态原地更新后 sortable 不同步
  if (statusFilter.value === 'all') {
    return list.map((todo) => todo)
  }
  return list.filter((todo) => todoStatusKey(todo) === statusFilter.value)
})

watch(
  filteredTodos,
  (list) => {
    sortSaving.value = false
    sortableTodos.value = [...list]
  },
  { immediate: true },
)

const resolveTodoListEl = () => {
  const node = todoListRef.value
  if (!node) return null
  if (node instanceof HTMLElement) return node
  const el = node.$el
  return el instanceof HTMLElement ? el : null
}

const clearTodoHighlight = () => {
  highlightedTodoId.value = ''
  if (highlightTimer) {
    window.clearTimeout(highlightTimer)
    highlightTimer = null
  }
}

const scrollToTodo = async (todoId) => {
  const id = String(todoId || '').trim()
  if (!id) return false

  const todo = (props.todos || []).find((item) => String(item.id) === id)
  if (!todo) return false

  const key = todoStatusKey(todo)
  if (statusFilter.value !== 'all' && key !== statusFilter.value) {
    statusFilter.value = 'all'
    await nextTick()
  }

  const listEl = resolveTodoListEl()
  const row = listEl?.querySelector?.(`[data-todo-id="${id}"]`)
  if (!row) return false

  row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  clearTodoHighlight()
  highlightedTodoId.value = id
  highlightTimer = window.setTimeout(clearTodoHighlight, 2400)
  return true
}

const dateRangeText = computed(() => {
  const start = String(props.project?.startAt || '').slice(0, 10)
  const end = String(props.project?.endAt || '').slice(0, 10)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} 起`
  if (end) return `至 ${end}`
  return '未设置起止'
})

const lastSyncedText = computed(() => {
  const raw = String(props.project?.lastSyncedAt || '').trim()
  if (!raw) return ''
  return raw.length > 16 ? raw.slice(0, 16) : raw
})

const primaryTag = computed(() => {
  const ids = Array.isArray(props.project?.tagIds) ? props.project.tagIds : []
  const id = ids.length ? String(ids[0]) : ''
  if (!id) return null
  const name = props.tagNameById[id]
  if (!name) return null
  return { id, name }
})

watch(
  () => props.project?.sedimentFolderId,
  async (folderId) => {
    const id = String(folderId || '').trim()
    if (!id) {
      sedimentFolderName.value = ''
      return
    }
    try {
      const folder = await fetchStructFolder(id)
      sedimentFolderName.value = folder?.name || props.project?.name || '沉淀文件夹'
    } catch {
      sedimentFolderName.value = props.project?.name || '沉淀文件夹'
    }
  },
  { immediate: true },
)

const onSelectChange = ({ todo, selected }) => {
  const next = new Set(selectedIds.value)
  const id = String(todo.id)
  if (selected) next.add(id)
  else next.delete(id)
  selectedIds.value = next
}

const getSelectedTodos = () => {
  const idSet = selectedIds.value
  return (props.todos || []).filter((todo) => idSet.has(String(todo.id)))
}

const clearSelection = () => {
  selectedIds.value = new Set()
}

const selectAllCurrent = () => {
  selectedIds.value = new Set(
    sortableTodos.value.map((todo) => String(todo?.id ?? '')).filter(Boolean),
  )
}

const setStatusFilter = (key) => {
  if (statusFilter.value === key) return
  statusFilter.value = key
  clearSelection()
}

onBeforeUnmount(() => {
  clearTodoHighlight()
})

const onTodoSortEnd = (evt) => {
  if (evt.oldIndex === evt.newIndex || evt.oldIndex == null || evt.newIndex == null) return
  if (statusFilter.value !== 'all') return
  const orderedIds = sortableTodos.value.map((item) => item.id)
  sortSaving.value = true
  emit('reorder-todos', orderedIds)
}

watch(
  () => props.project?.id,
  () => {
    selectedIds.value = new Set()
    statusFilter.value = 'all'
    clearTodoHighlight()
  },
)

defineExpose({ getSelectedTodos, clearSelection, scrollToTodo })
</script>

<style scoped>
.project-detail-view {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  margin: 0;
  display: flex;
  align-items: center;
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

.project-detail-title-tag {
  flex: 0 0 auto;
  margin-left: 8px;
  padding: 2px 8px;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-secondary-text);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.2px;
  white-space: nowrap;
  cursor: pointer;
}

.project-detail-title-tag:hover {
  background: rgba(37, 99, 235, 0.12);
  color: var(--color-accent);
}

.project-detail-title-tag-add {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  margin-left: 8px;
  padding: 0;
  border: 1px dashed rgba(24, 24, 27, 0.28);
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.project-detail-title-tag-add:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.45);
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.06);
}

.project-detail-title-tag-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.project-detail-meta {
  margin: 6px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  font-size: 12px;
  color: var(--color-secondary-text);
  line-height: 1.4;
}

.project-detail-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.project-detail-meta-item svg {
  flex: 0 0 auto;
  color: #a1a1aa;
}

.project-detail-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.project-detail-header-actions:has(.project-detail-sync-btn:hover) .project-detail-last-sync:not(.is-visible),
.project-detail-header-actions:has(.project-detail-sync-btn:focus-visible) .project-detail-last-sync:not(.is-visible),
.project-detail-last-sync.is-visible {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.project-detail-last-sync {
  margin-right: 2px;
  max-width: min(280px, 42vw);
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--color-secondary-text);
  white-space: nowrap;
  opacity: 0;
  transform: translateX(4px);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.project-detail-last-sync.is-visible {
  color: var(--color-accent);
  font-weight: 500;
}

.project-detail-add-icon-btn {
  width: 30px;
  min-width: 30px;
  padding: 0;
}

.project-detail-pending-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.06);
  color: var(--color-primary);
  font-size: 13px;
  line-height: 1.4;
}

.project-detail-pending-btn {
  flex: 0 0 auto;
}

.project-detail-toolbar {
  display: flex;
  align-items: center;
  gap: 10px 14px;
  min-height: 36px;
  flex-wrap: wrap;
}

.project-detail-links {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 0 0 auto;
}

.project-detail-folder-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.05);
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
}

.project-detail-folder-chip:hover {
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.08);
}

.project-detail-folder-chip.is-muted {
  cursor: default;
  color: rgba(24, 24, 27, 0.38);
}

.project-detail-folder-chip.is-muted:hover {
  color: rgba(24, 24, 27, 0.38);
  background: rgba(24, 24, 27, 0.05);
}

.project-detail-scope {
  display: inline-flex;
  flex-wrap: wrap;
  padding: 3px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.05);
  gap: 2px;
}

.project-detail-scope-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-secondary-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  z-index: 0;
}

.project-detail-scope-btn.is-active {
  color: var(--color-primary);
  font-weight: 600;
}

.project-detail-scope-active-bg {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgba(24, 24, 27, 0.08);
  z-index: -1;
}

.project-detail-scope-label,
.project-detail-scope-count {
  position: relative;
  z-index: 1;
}

.project-detail-scope-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.72;
}

.project-detail-toolbar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-left: auto;
  min-width: 0;
  flex: 1 1 auto;
}

.project-detail-status-area {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.project-detail-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-align: left;
}

.project-detail-todos {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.project-detail-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 0;
  padding: 24px 16px;
  text-align: center;
}

.project-detail-state {
  margin: 0;
  font-size: 13px;
  color: var(--color-secondary-text);
  line-height: 1.5;
}

.project-detail-state--inline {
  margin: 12px 0;
  text-align: left;
}

.project-detail-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(37, 99, 235, 0.08);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-detail-status-badge.is-pending-sync {
  border: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(180, 83, 9, 0.1);
  color: #b45309;
}

.project-detail-status-badge.is-pending-sync:hover {
  background: rgba(180, 83, 9, 0.16);
}

.project-detail-bottom-bar-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 16px;
  z-index: 4;
  display: flex;
  justify-content: center;
  padding: 0 4px;
  box-sizing: border-box;
  pointer-events: none;
}

.project-detail-bottom-bar-wrap > * {
  pointer-events: auto;
}

.project-detail-bulk-bar {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  width: fit-content;
  max-width: calc(100vw - 48px);
  padding: 6px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  box-sizing: border-box;
}

.project-detail-bulk-group {
  display: inline-flex;
  align-items: stretch;
  gap: 2px;
  padding: 0 4px;
}

.project-detail-bulk-group + .project-detail-bulk-group {
  border-left: 1px solid var(--color-border);
}

.project-detail-bulk-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  min-height: 56px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.project-detail-bulk-btn:hover:not(:disabled) {
  background: rgba(24, 24, 27, 0.08);
}

.project-detail-bulk-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.project-detail-bulk-btn--clear {
  color: var(--color-secondary-text);
}

.project-detail-bulk-btn--clear:hover:not(:disabled) {
  color: var(--color-text);
  background: rgba(24, 24, 27, 0.08);
}

.project-detail-bulk-btn--danger {
  color: var(--color-error);
}

.project-detail-bulk-btn--danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
}

.project-detail-bulk-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.project-detail-bulk-btn-label {
  line-height: 1.2;
  white-space: nowrap;
}

.project-detail-list {
  list-style: none;
  margin: 0;
  padding: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.project-detail-list.has-bottom-bar {
  padding-bottom: 92px;
}

.todo-sort-ghost {
  opacity: 0.4;
}

.todo-sort-chosen {
  box-shadow: var(--shadow-float);
}

@media (max-width: 720px) {
  .project-detail-header {
    flex-direction: column;
  }

  .project-detail-toolbar-right {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .project-detail-pending-banner {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
