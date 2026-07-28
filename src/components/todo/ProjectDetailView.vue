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
      </div>
      <div class="project-detail-header-actions">
        <AppButton type="button" class="btn btn-icon-text" :disabled="busy" @click="emit('edit', project)">
          编辑
        </AppButton>
        <AppButton
          type="button"
          class="btn btn-primary"
          :disabled="busy || syncing || pendingSyncCount > 0"
          :title="
            pendingSyncCount > 0
              ? '请先确认上次提取结果'
              : syncPhase || undefined
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

    <div class="project-detail-switcher">
      <div class="note-view-switcher">
        <div class="switcher-tabs" role="tablist" aria-label="事情视图">
          <motion.button
            type="button"
            class="switcher-btn"
            :class="{ 'is-active': isListTabActive }"
            role="tab"
            :aria-selected="isListTabActive"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            @click="setTab('todos')"
          >
            <span class="switcher-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </span>
            <span>列表</span>
          </motion.button>
          <div v-if="canRunAgents" class="switcher-select-slot">
            <AnimatePresence mode="wait" :initial="false">
              <motion.button
                v-if="selectMode && selectedCount > 0"
                key="selected"
                type="button"
                class="switcher-btn"
                :class="{ 'is-active': isSelectTabActive }"
                role="tab"
                :aria-selected="isSelectTabActive"
                :initial="selectSlotMotion.initial"
                :animate="selectSlotMotion.animate"
                :exit="selectSlotMotion.exit"
                :transition="selectSlotMotion.transition"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                @click="setTab('select')"
              >
                <span class="switcher-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span>已选 {{ selectedCount }}</span>
              </motion.button>
              <motion.button
                v-else
                key="select"
                type="button"
                class="switcher-btn"
                :class="{ 'is-active': isSelectTabActive }"
                role="tab"
                :aria-selected="isSelectTabActive"
                :initial="selectSlotMotion.initial"
                :animate="selectSlotMotion.animate"
                :exit="selectSlotMotion.exit"
                :transition="selectSlotMotion.transition"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                @click="setTab('select')"
              >
                <span class="switcher-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
                <span>多选</span>
              </motion.button>
            </AnimatePresence>
          </div>
          <motion.button
            type="button"
            class="switcher-btn"
            :class="{ 'is-active': activeTab === 'detail' }"
            role="tab"
            :aria-selected="activeTab === 'detail'"
            :while-hover="presets.button.hover"
            :while-tap="presets.button.tap"
            :transition="presets.button.transition"
            @click="setTab('detail')"
          >
            <span class="switcher-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            <span>详情</span>
          </motion.button>
        </div>

        <div class="switcher-status-area">
          <motion.span
            v-if="syncing"
            class="project-detail-status-badge is-running"
            :animate="runningPulse"
            :transition="runningTransition"
          >
            <span class="project-detail-status-dot" aria-hidden="true" />
            {{ syncPhase || '同步中…' }}
          </motion.span>
          <button
            v-else-if="pendingSyncCount > 0"
            type="button"
            class="project-detail-status-badge is-pending-sync"
            @click="emit('open-pending-sync')"
          >
            待确认 {{ pendingSyncCount }} 条
          </button>
          <motion.span
            v-else-if="canRunAgents && runningTitle"
            class="project-detail-status-badge is-running"
            :animate="runningPulse"
            :transition="runningTransition"
          >
            <span class="project-detail-status-dot" aria-hidden="true" />
            执行中 · {{ runningTitle }}
            <span v-if="queueLength" class="project-detail-status-queue">排队 {{ queueLength }}</span>
          </motion.span>
          <span v-else-if="canRunAgents && queueLength" class="project-detail-status-badge">
            排队 {{ queueLength }} 条
          </span>
        </div>
      </div>
    </div>

    <div v-show="activeTab === 'detail'" class="project-detail-pane project-detail-pane--profile">
      <div class="project-profile">
        <section class="project-profile-hero">
          <div class="project-profile-facts">
            <div class="project-profile-fact">
              <span class="project-profile-fact-label">起止</span>
              <span class="project-profile-fact-value">{{ dateRangeText }}</span>
            </div>
            <div class="project-profile-fact">
              <span class="project-profile-fact-label">最近同步</span>
              <span class="project-profile-fact-value" :class="{ 'is-muted': !lastSyncedText }">
                {{ lastSyncedText || '尚未同步' }}
              </span>
            </div>
            <div class="project-profile-fact">
              <span class="project-profile-fact-label">沉淀文件夹</span>
              <button
                v-if="project?.sedimentFolderId"
                type="button"
                class="project-profile-link"
                @click="emit('open-sediment-folder')"
              >
                {{ sedimentFolderName || '打开文件夹' }}
              </button>
              <span v-else class="project-profile-fact-value is-muted">保存事情后自动创建</span>
            </div>
            <div class="project-profile-fact">
              <span class="project-profile-fact-label">代码仓</span>
              <span
                class="project-profile-fact-value"
                :class="{ 'is-muted': !project?.localPath }"
                :title="project?.localPath || undefined"
              >
                {{ project?.localPath || '未关联' }}
              </span>
            </div>
          </div>

          <div v-if="projectTags.length" class="project-detail-info-tags">
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
          </div>
        </section>

        <section class="project-profile-block">
          <h3 class="project-profile-heading">为什么做</h3>
          <p class="project-profile-body" :class="{ 'is-muted': !project?.purpose }">
            {{ project?.purpose || '还没写初衷。点右上角编辑补上。' }}
          </p>
        </section>

        <section class="project-profile-block project-profile-block--pair">
          <div>
            <h3 class="project-profile-heading">怎样算值了</h3>
            <p class="project-profile-body" :class="{ 'is-muted': !project?.successLooksLike }">
              {{ project?.successLooksLike || '未填写' }}
            </p>
          </div>
          <div>
            <h3 class="project-profile-heading">明确不做</h3>
            <p class="project-profile-body" :class="{ 'is-muted': !project?.outOfScope }">
              {{ project?.outOfScope || '未填写' }}
            </p>
          </div>
        </section>
      </div>
    </div>

    <div v-show="activeTab === 'todos'" class="project-detail-pane project-detail-pane--todos">
      <p class="project-detail-summary" aria-label="任务统计">
        <strong>{{ stats.total }}</strong> 项
        <span class="project-detail-summary-sep">·</span>
        完成 <strong class="is-done">{{ stats.done }}</strong>
        <span class="project-detail-summary-sep">·</span>
        未完成 <strong class="is-pending">{{ stats.pending }}</strong>
      </p>

      <p v-if="!canRunAgents" class="project-detail-path-hint">
        编辑事情并关联本地项目路径后，可排队让 Cursor 执行待办
      </p>

      <form class="project-detail-composer" @submit.prevent="handleAdd">
        <input
          ref="inputRef"
          v-model="draftTitle"
          class="project-detail-input"
          type="text"
          maxlength="240"
          placeholder="添加待办，回车确认"
          :disabled="busy"
        />
        <AppButton class="btn btn-primary project-detail-add-btn" type="submit" :disabled="busy || !canAdd">
          添加
        </AppButton>
      </form>

      <p v-if="loading && !todos.length" class="project-detail-state">加载中…</p>
      <p v-else-if="!todos.length" class="project-detail-state">暂无待办，可手动添加或同步提取</p>

      <ul
        v-else
        class="project-detail-list"
        :class="{ 'is-selecting': selectMode && selectedCount > 0 }"
        role="list"
      >
        <TodoItemRow
          v-for="todo in todos"
          :key="todo.id"
          :todo="todo"
          :busy="busy"
          :select-mode="selectMode"
          :selected="selectedIds.has(String(todo.id))"
          :run-detail="runDetails?.[String(todo.id)] || null"
          :load-diff="loadDiff"
          @toggle="emit('toggle-todo', $event)"
          @delete="emit('delete-todo', $event)"
          @open-source="emit('open-source', $event)"
          @open-tag="emit('open-tag', $event)"
          @update-title="emit('update-todo-title', $event)"
          @select-change="onSelectChange"
          @accept="emit('accept-todo', $event)"
          @reject="emit('reject-todo', $event)"
          @retry="emit('retry-todo', $event)"
          @dismiss-failed="emit('dismiss-failed', $event)"
          @load-run="emit('load-run', $event)"
          @continue="emit('continue-todo', $event)"
          @checklist-change="emit('checklist-change', $event)"
        />
      </ul>

      <AnimatePresence :initial="false">
        <div
          v-if="selectMode && selectedCount > 0"
          key="todo-bulk-bar-wrap"
          class="project-detail-bulk-bar-wrap"
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
            <motion.button
              type="button"
              class="project-detail-bulk-btn"
              :disabled="busy"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emit('enqueue-selected')"
            >
              <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 3c5 0 9 3.6 9 8s-4 8-9 8c-.9 0-1.8-.1-2.6-.3L3 21l1.8-4.2A7.7 7.7 0 0 1 3 11c0-4.4 4-8 9-8z" />
                  <path d="M9.5 11h.01M14.5 11h.01" />
                </svg>
              </span>
              <span class="project-detail-bulk-btn-label">加入队列</span>
            </motion.button>
            <motion.button
              type="button"
              class="project-detail-bulk-btn"
              :disabled="busy"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="emit('generate-selected')"
            >
              <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              </span>
              <span class="project-detail-bulk-btn-label">生成说明</span>
            </motion.button>
            <div class="project-detail-bulk-actions">
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
                v-if="runningTitle"
                type="button"
                class="project-detail-bulk-btn project-detail-bulk-btn--clear"
                :disabled="busy"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="emit('cancel-run')"
              >
                <span class="project-detail-bulk-btn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </span>
                <span class="project-detail-bulk-btn-label">取消当前</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import AppButton from '../motion/AppButton.vue'
import TodoItemRow from './TodoItemRow.vue'
import { useMotionPresets } from '../../composables/useMotionPresets'
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
  queueLength: { type: Number, default: 0 },
  runningTitle: { type: String, default: '' },
  runDetails: { type: Object, default: () => ({}) },
  loadDiff: { type: Function, default: null },
})

const emit = defineEmits([
  'back',
  'edit',
  'sync',
  'open-pending-sync',
  'add-todo',
  'toggle-todo',
  'delete-todo',
  'open-source',
  'open-tag',
  'open-sediment-folder',
  'update-todo-title',
  'enqueue-selected',
  'generate-selected',
  'cancel-run',
  'accept-todo',
  'reject-todo',
  'retry-todo',
  'dismiss-failed',
  'load-run',
  'continue-todo',
  'checklist-change',
])

const { presets } = useMotionPresets()

const draftTitle = ref('')
const inputRef = ref(null)
const selectedIds = ref(new Set())
const selectMode = ref(false)
const activeTab = ref('todos')
const sedimentFolderName = ref('')

const canAdd = computed(() => String(draftTitle.value || '').trim().length > 0)
const canRunAgents = computed(() => Boolean(props.project?.localPath))
const selectedCount = computed(() => selectedIds.value.size)
const isSelectTabActive = computed(() => selectMode.value && activeTab.value === 'todos')
const isListTabActive = computed(() => !selectMode.value && activeTab.value === 'todos')

const runningPulse = { opacity: [1, 0.72, 1] }
const runningTransition = { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }

const selectSlotMotion = computed(() => ({
  initial: { opacity: 0, x: 10, filter: 'blur(3px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, x: -10, filter: 'blur(3px)' },
  transition: presets.value.fast,
}))

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

const lastSyncedText = computed(() => {
  const raw = String(props.project?.lastSyncedAt || '').trim()
  if (!raw) return ''
  return raw.length > 16 ? raw.slice(0, 16) : raw
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

const exitSelectMode = () => {
  selectMode.value = false
  clearSelection()
}

const setTab = (tab) => {
  if (tab === 'select') {
    activeTab.value = 'todos'
    selectMode.value = true
    return
  }
  if (tab === 'todos') {
    activeTab.value = 'todos'
    exitSelectMode()
    return
  }
  if (tab === 'detail') {
    activeTab.value = 'detail'
    exitSelectMode()
  }
}

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

watch(
  () => props.project?.id,
  () => {
    selectedIds.value = new Set()
    selectMode.value = false
    activeTab.value = 'todos'
  },
)

defineExpose({ focusInput, getSelectedTodos, clearSelection })
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

.project-detail-switcher {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  min-height: 36px;
  width: 100%;
  margin-bottom: 0;
  box-sizing: border-box;
}

.note-view-switcher {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  box-sizing: border-box;
}

.switcher-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 1 auto;
  min-width: 0;
  align-self: center;
}

.switcher-select-slot {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
}

.switcher-status-area {
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  align-self: center;
  margin-left: auto;
  min-width: 0;
  min-height: 28px;
  overflow: hidden;
}

.switcher-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--color-secondary-text);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
}

.switcher-btn:hover:not(.is-active) {
  color: var(--color-text);
}

.switcher-btn.is-active {
  color: var(--color-accent);
  font-weight: 600;
}

.switcher-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.project-detail-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  flex: 1 1 auto;
}

.project-detail-pane--todos {
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.project-detail-pane--profile {
  overflow: auto;
  padding-bottom: 8px;
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

.project-profile {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 680px;
}

.project-profile-hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.04), transparent);
}

.project-profile-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
}

.project-profile-fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.project-profile-fact-label {
  font-size: 12px;
  color: var(--color-secondary-text);
}

.project-profile-fact-value {
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-primary);
  overflow-wrap: anywhere;
}

.project-profile-fact-value.is-muted {
  color: rgba(24, 24, 27, 0.42);
}

.project-profile-link {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.project-profile-link:hover {
  text-decoration: underline;
}

.project-profile-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-profile-block--pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
}

@media (max-width: 640px) {
  .project-profile-facts,
  .project-profile-block--pair {
    grid-template-columns: 1fr;
  }

  .project-detail-pending-banner {
    flex-direction: column;
    align-items: stretch;
  }
}

.project-profile-heading {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: var(--color-secondary-text);
}

.project-profile-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.project-profile-body.is-muted {
  color: rgba(24, 24, 27, 0.42);
}

.project-detail-info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.project-detail-path-hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
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

.project-detail-status-badge.is-running {
  font-weight: 600;
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

.project-detail-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: 0 0 auto;
}

.project-detail-status-queue {
  color: rgba(37, 99, 235, 0.75);
  font-weight: 500;
}

.project-detail-bulk-bar-wrap {
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

.project-detail-bulk-bar-wrap > * {
  pointer-events: auto;
}

.project-detail-bulk-bar {
  display: inline-flex;
  align-items: stretch;
  gap: 8px;
  width: fit-content;
  max-width: calc(100vw - 48px);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  box-sizing: border-box;
}

.project-detail-bulk-actions {
  display: inline-flex;
  align-items: stretch;
  gap: 8px;
  padding-left: 8px;
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

.project-detail-bulk-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.project-detail-bulk-btn-label {
  line-height: 1.2;
  white-space: nowrap;
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
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.project-detail-list.is-selecting {
  padding-bottom: 92px;
}

@media (max-width: 720px) {
  .project-detail-header {
    flex-direction: column;
  }

  .project-detail-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
