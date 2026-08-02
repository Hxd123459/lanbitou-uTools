<template>
  <section class="todo-panel">
    <ProjectListView
      v-if="view === 'list'"
      :projects="projects"
      :tag-name-by-id="tagNameById"
      :todo-counts="todoCounts"
      :loading="loadingProjects"
      :busy="actionBusy"
      @create="openCreateModal"
      @open="openProject"
      @edit="openEditModal"
      @delete="handleDeleteProject"
      @toggle-archive="handleToggleArchive"
      @open-tag="handleOpenTag"
      @reorder="handleReorderProjects"
      @toast="notifyToast"
    />

    <ProjectDetailView
      v-else-if="view === 'detail' && currentProject"
      ref="detailViewRef"
      :project="currentProject"
      :todos="todos"
      :tag-name-by-id="tagNameById"
      :loading="loadingTodos"
      :busy="actionBusy"
      :syncing="syncing"
      :sync-phase="syncPhase"
      :pending-sync-count="pendingSyncCount"
      :queue-length="queueLength"
      :running-title="runningTitle"
      :run-control-active="runControlActive"
      :run-details="runByTodoId"
      :continue-queued-todo-ids="continueQueuedTodoIds"
      :load-diff="loadDiffForTodo"
      @back="backToList"
      @edit="openEditModal"
      @sync="handleSync"
      @open-pending-sync="openPendingSyncPreview"
      @open-add="openAddModal"
      @delete-todo="handleDeleteTodo"
      @open-source="handleOpenSource"
      @open-tag="handleOpenTag"
      @open-sediment-folder="handleOpenSedimentFolder"
      @update-todo-title="handleUpdateTodoTitle"
      @enqueue-selected="handleEnqueueSelected"
      @run-todo="handleRunTodo"
      @generate-selected="openGenerateModal"
      @cancel-run="cancelActive"
      @cancel-all="cancelAll"
      @accept-todo="handleAcceptTodo"
      @reject-todo="(todo) => rejectTodo(todo, { requeue: false })"
      @retry-todo="(todo) => continueTodo(todo, '')"
      @dismiss-failed="dismissFailed"
      @cancel-queued-todo="cancelQueuedTodo"
      @stop-todo="handleStopTodo"
      @load-run="loadRunForTodo"
      @continue-todo="handleContinueTodo"
      @checklist-change="handleChecklistChange"
      @reorder-todos="handleReorderTodos"
      @toast="notifyToast"
    />

    <ProjectFormModal
      :visible="formVisible"
      :project="editingProject"
      :saving="formSaving"
      @close="closeFormModal"
      @submit="handleFormSubmit"
    />

    <TodoAddModal
      :visible="addVisible"
      :saving="addSaving"
      @close="closeAddModal"
      @submit="handleAddTodo"
    />

    <TodoGenerateModal
      :visible="generateVisible"
      :project="currentProject"
      :todos="generateTodos"
      :runs-by-id="runByTodoId"
      @close="generateVisible = false"
      @toast="notifyToast"
      @save-archive="handleSaveGenerateArchive"
    />

    <TodoSyncPreviewModal
      :visible="syncPreviewVisible"
      :items="syncCandidates"
      :confirming="syncConfirming"
      @close="closeSyncPreview"
      @discard="discardPendingSync"
      @confirm="handleSyncConfirm"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import {
  createProject,
  deleteProject,
  fetchProjects,
  reorderProjects,
  updateProject,
} from '../../api/project'
import {
  createTodo,
  deleteTodo,
  fetchNotesForTodoSync,
  fetchSourceHashesByProject,
  fetchTodoCountsByProject,
  fetchTodosByProject,
  reorderTodos,
  softDeleteTodosByProject,
  toggleTodoDone,
  updateTodo,
} from '../../api/todo'
import { fetchAllTags, fetchNotesByIds } from '../../api/note'
import {
  agentExtract,
  ensureAgentBridge,
  isAgentBridgeAvailable,
} from '../../api/agentBridge'
import {
  createNoteInFolder,
  createStructFolder,
  fetchStructFolder,
  renameStructItem,
} from '../../api/structFolder'
import { extractTodosFromNotes, isTodoExtractAiAvailable } from '../../ai/todoExtractService'
import { useTodoRunQueue } from '../../composables/useTodoRunQueue'
import { buildTodoSourceHash, normalizeTodoTitle } from '../../storage/utools/todoRepository'
import { formatDateTime } from '../../storage/utools/utils'
import { loadAiSettings } from '../../storage/utools/aiSettings'
import { MAX_PROJECTS } from '../../constants/todoLimits'
import {
  clearPendingTodoSync,
  getPendingTodoSync,
  setPendingTodoSync,
} from '../../storage/utools/todoSyncCache'
import ProjectListView from './ProjectListView.vue'
import ProjectDetailView from './ProjectDetailView.vue'
import ProjectFormModal from './ProjectFormModal.vue'
import TodoAddModal from './TodoAddModal.vue'
import TodoGenerateModal from './TodoGenerateModal.vue'
import TodoSyncPreviewModal from './TodoSyncPreviewModal.vue'

const props = defineProps({
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['error', 'toast', 'open-source-note', 'open-tag', 'open-sediment-folder'])

const view = ref('list')
const projects = ref([])
const todos = ref([])
const todoCounts = ref({})
const currentProjectId = ref(null)
const loadingProjects = ref(false)
const loadingTodos = ref(false)
const actionBusy = ref(false)
const tagNameById = ref({})

const formVisible = ref(false)
const formSaving = ref(false)
const editingProject = ref(null)
const addVisible = ref(false)
const addSaving = ref(false)

const syncing = ref(false)
const syncPhase = ref('')
const syncPreviewVisible = ref(false)
const syncCandidates = ref([])
const syncConfirming = ref(false)
const pendingSyncCount = ref(0)
const detailViewRef = ref(null)
const generateVisible = ref(false)
const generateTodos = ref([])

const currentProject = computed(() =>
  projects.value.find((item) => item.id === currentProjectId.value) || null,
)

const refreshPendingSyncCount = () => {
  const id = currentProject.value?.id
  const pending = id ? getPendingTodoSync(id) : null
  pendingSyncCount.value = pending?.candidates?.filter((item) => !item.exists).length
    || pending?.candidates?.length
    || 0
}

const notifyError = (error) => {
  emit('error', error instanceof Error ? error : new Error(String(error || '操作失败')))
}

const notifyToast = (text) => {
  emit('toast', text)
}

const patchTodoLocal = (updated) => {
  if (!updated?.id) return
  const list = todos.value
  const index = list.findIndex((item) => item.id === updated.id)
  if (index >= 0) {
    todos.value = list.map((item, i) => (i === index ? updated : item))
  } else {
    todos.value = [updated, ...list]
  }
}

const {
  queueLength,
  continueQueuedTodoIds,
  runControlActive,
  runningTitle,
  runByTodoId,
  enqueue,
  continueTodo,
  updateQueuedContinueFeedback,
  acceptTodo,
  updateRunChecklist,
  rejectTodo,
  dismissFailed,
  cancelQueuedTodo,
  stopTodo,
  cancelActive,
  cancelAll,
  cancelOnLeave,
  loadRunForTodo,
  loadDiffForTodo,
  preloadRunsForProject,
  ensureOrphanRunsReset,
} = useTodoRunQueue({
  getProject: () => currentProject.value,
  getTodos: () => todos.value,
  patchTodoLocal,
  onToast: notifyToast,
  onError: notifyError,
})

const handleAcceptTodo = async (payload) => {
  const todo = payload?.todo || payload
  try {
    await acceptTodo(todo, {
      reviewNote: payload?.reviewNote || '',
      checklist: payload?.checklist,
    })
  } catch (error) {
    notifyError(error)
  }
}

const handleStopTodo = async (todo) => {
  if (!todo) return
  try {
    await stopTodo(todo)
  } catch (error) {
    notifyError(error)
  }
}

const handleContinueTodo = async ({ todo, feedback }) => {
  if (!todo) return
  if (todo.runStatus === 'queued') {
    updateQueuedContinueFeedback(todo, feedback)
    return
  }
  try {
    await continueTodo(todo, feedback)
  } catch (error) {
    notifyError(error)
  }
}

const handleChecklistChange = async ({ todo, checklist }) => {
  try {
    await updateRunChecklist(todo, checklist)
  } catch {
    /* ignore */
  }
}

const openGenerateModal = () => {
  const selected = detailViewRef.value?.getSelectedTodos?.() || []
  if (!selected.length) {
    notifyToast('请先选择待办')
    return
  }
  generateTodos.value = selected
  generateVisible.value = true
}

const handleSaveGenerateArchive = async ({ template, text }) => {
  const project = currentProject.value
  if (!project?.sedimentFolderId) {
    notifyToast('请先保存事情以关联沉淀文件夹')
    return
  }
  try {
    const date = formatDateTime().slice(0, 10)
    const titleMap = {
      daily: `日报 · ${date}`,
      release: `版本说明 · ${date}`,
      retro: `复盘 · ${date}`,
    }
    await createNoteInFolder({
      parentId: project.sedimentFolderId,
      title: titleMap[template] || `产出 · ${date}`,
      content: String(text || '').trim(),
    })
    notifyToast('已写入沉淀文件夹')
    generateVisible.value = false
  } catch (error) {
    notifyError(error)
  }
}

const ensureSedimentFolder = async (project) => {
  if (!project?.id) return project
  const folderName = String(project.name || '').trim() || '未命名事情'
  let folderId = String(project.sedimentFolderId || '').trim()

  if (folderId) {
    const existing = await fetchStructFolder(folderId)
    if (existing?.type === 'folder') {
      if (existing.name !== folderName) {
        await renameStructItem({ id: folderId, name: folderName })
      }
      return project
    }
    folderId = ''
  }

  const createdId = await createStructFolder({ parentId: 0, name: folderName })
  const updated = await updateProject(project.id, { sedimentFolderId: createdId })
  const index = projects.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) projects.value[index] = updated
  return updated
}

const handleOpenSedimentFolder = () => {
  const project = currentProject.value
  if (!project?.sedimentFolderId) {
    notifyToast('尚未关联沉淀文件夹，请先编辑并保存事情')
    return
  }
  emit('open-sediment-folder', {
    folderId: project.sedimentFolderId,
    projectName: project.name || '',
  })
}

const handleFormSubmit = async (payload) => {
  formSaving.value = true
  try {
    let saved = null
    if (editingProject.value?.id) {
      saved = await updateProject(editingProject.value.id, payload)
      const index = projects.value.findIndex((item) => item.id === saved.id)
      if (index >= 0) projects.value[index] = saved
      else projects.value = [saved, ...projects.value]
      notifyToast('已更新事情')
    } else {
      saved = await createProject(payload)
      projects.value = [saved, ...projects.value]
      notifyToast('已创建事情')
    }
    try {
      saved = await ensureSedimentFolder(saved)
    } catch (error) {
      notifyToast(`事情已保存，但沉淀文件夹创建失败：${error?.message || '未知错误'}`)
    }
    formVisible.value = false
    editingProject.value = null
  } catch (error) {
    notifyError(error)
  } finally {
    formSaving.value = false
  }
}

const handleEnqueueSelected = async () => {
  try {
    const selected = detailViewRef.value?.getSelectedTodos?.() || []
    await enqueue(selected.filter((t) => !t.done))
    detailViewRef.value?.clearSelection?.()
  } catch (error) {
    notifyError(error)
  }
}

const handleRunTodo = async (todo) => {
  try {
    if (!todo || todo.done) return
    await enqueue([todo])
  } catch (error) {
    notifyError(error)
  }
}

const loadTags = async () => {
  try {
    const list = await fetchAllTags()
    const map = {}
    ;(Array.isArray(list) ? list : []).forEach((tag) => {
      if (tag?.tagId != null) map[String(tag.tagId)] = tag.tagName || ''
    })
    tagNameById.value = map
  } catch {
    tagNameById.value = {}
  }
}

const loadTodoCounts = async () => {
  try {
    todoCounts.value = await fetchTodoCountsByProject()
  } catch {
    todoCounts.value = {}
  }
}

const loadProjects = async () => {
  loadingProjects.value = true
  try {
    const [list] = await Promise.all([
      fetchProjects({ includeArchived: true }),
      loadTodoCounts(),
    ])
    projects.value = list
  } catch (error) {
    projects.value = []
    notifyError(error)
  } finally {
    loadingProjects.value = false
  }
}

const loadTodos = async () => {
  if (!currentProjectId.value) {
    todos.value = []
    return
  }
  await ensureOrphanRunsReset()
  const keepListVisible = todos.value.length > 0
  if (!keepListVisible) loadingTodos.value = true
  try {
    const list = await fetchTodosByProject(currentProjectId.value)
    todos.value = list.map((todo) => {
      if (todo.sourceTagId && todo.sourceTagName) return todo
      if (todo.sourceTagId && tagNameById.value[String(todo.sourceTagId)]) {
        return {
          ...todo,
          sourceTagName: tagNameById.value[String(todo.sourceTagId)],
        }
      }
      return todo
    })
    void preloadRunsForProject(currentProjectId.value)
  } catch (error) {
    todos.value = []
    notifyError(error)
  } finally {
    loadingTodos.value = false
  }
}

const handleOpenTag = (tag) => {
  const tagId = tag?.id || tag?.tagId
  const tagName = tag?.name || tag?.tagName
  if (!tagId || !tagName) return
  emit('open-tag', { tagId: String(tagId), tagName: String(tagName) })
}

const refreshAll = async () => {
  await Promise.all([loadTags(), loadProjects()])
  if (view.value === 'detail') await loadTodos()
}

const backToList = () => {
  view.value = 'list'
  currentProjectId.value = null
  todos.value = []
}

const openProject = async (project) => {
  currentProjectId.value = project.id
  view.value = 'detail'
  await loadTodos()
  try {
    await ensureSedimentFolder(project)
  } catch {
    /* ignore */
  }
  refreshPendingSyncCount()
  const pending = getPendingTodoSync(project.id)
  if (pending?.candidates?.length) {
    notifyToast(`有 ${pending.candidates.filter((i) => !i.exists).length || pending.candidates.length} 条待确认的同步结果`)
  }
}

const openTodoAt = async ({ projectId, todoId }) => {
  const pid = String(projectId || '').trim()
  const tid = String(todoId || '').trim()
  if (!pid || !tid) return false

  if (!projects.value.length) {
    await loadProjects()
  }
  const project = projects.value.find((item) => item.id === pid)
  if (!project) return false

  currentProjectId.value = pid
  view.value = 'detail'
  await loadTodos()

  const hasTodo = todos.value.some((item) => String(item.id) === tid)
  if (!hasTodo) return false

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await nextTick()
    if (await detailViewRef.value?.scrollToTodo?.(tid)) return true
    await new Promise((resolve) => window.setTimeout(resolve, 60))
  }
  return false
}

const openCreateModal = () => {
  if (projects.value.length >= MAX_PROJECTS) {
    notifyToast(`最多只能创建 ${MAX_PROJECTS} 件事情`)
    return
  }
  editingProject.value = null
  formVisible.value = true
}

const openEditModal = (project = currentProject.value) => {
  if (!project) return
  editingProject.value = { ...project }
  formVisible.value = true
}

const closeFormModal = () => {
  if (formSaving.value) return
  formVisible.value = false
  editingProject.value = null
}

const handleToggleArchive = async (project) => {
  actionBusy.value = true
  try {
    const nextStatus = project.status === 'archived' ? 'active' : 'archived'
    const updated = await updateProject(project.id, { status: nextStatus })
    const index = projects.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) projects.value[index] = updated
    notifyToast(nextStatus === 'archived' ? '已归档' : '已取消归档')
  } catch (error) {
    notifyError(error)
  } finally {
    actionBusy.value = false
  }
}

const handleReorderProjects = async (orderedIds) => {
  const ids = Array.isArray(orderedIds) ? orderedIds : []
  if (!ids.length) return

  const prev = [...projects.value]
  const visibleSet = new Set(ids)
  const queue = [...ids]
  const fullIds = []
  for (const item of prev) {
    if (visibleSet.has(item.id)) fullIds.push(queue.shift())
    else fullIds.push(item.id)
  }
  while (queue.length) fullIds.push(queue.shift())

  const map = new Map(prev.map((item) => [item.id, item]))
  projects.value = fullIds.map((id) => map.get(id)).filter(Boolean)

  try {
    await reorderProjects(fullIds)
    await loadProjects()
  } catch (error) {
    notifyError(error)
    await loadProjects()
  }
}

const handleReorderTodos = async (orderedIds) => {
  const ids = Array.isArray(orderedIds) ? orderedIds : []
  if (!ids.length) return

  const map = new Map(todos.value.map((item) => [item.id, item]))
  todos.value = ids.map((id) => map.get(id)).filter(Boolean)

  try {
    await reorderTodos(ids)
    await loadTodos()
  } catch (error) {
    notifyError(error)
    await loadTodos()
  }
}

const handleDeleteProject = async (project) => {
  actionBusy.value = true
  try {
    await softDeleteTodosByProject(project.id)
    await deleteProject(project.id)
    projects.value = projects.value.filter((item) => item.id !== project.id)
    await loadTodoCounts()
    if (currentProjectId.value === project.id) backToList()
    notifyToast('已删除事情')
  } catch (error) {
    notifyError(error)
  } finally {
    actionBusy.value = false
  }
}

const openAddModal = () => {
  if (!currentProjectId.value) return
  addVisible.value = true
}

const closeAddModal = () => {
  if (addSaving.value) return
  addVisible.value = false
}

const handleAddTodo = async (title) => {
  if (!currentProjectId.value) return
  addSaving.value = true
  actionBusy.value = true
  try {
    const created = await createTodo({
      projectId: currentProjectId.value,
      title,
      createdBy: 'manual',
    })
    todos.value = [created, ...todos.value]
    await loadTodoCounts()
    addVisible.value = false
  } catch (error) {
    notifyError(error)
  } finally {
    addSaving.value = false
    actionBusy.value = false
  }
}

const handleUpdateTodoTitle = async ({ todo, title }) => {
  if (!todo?.id) return
  actionBusy.value = true
  try {
    const updated = await updateTodo(todo.id, { title })
    const index = todos.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) todos.value[index] = updated
  } catch (error) {
    notifyError(error)
    await loadTodos()
  } finally {
    actionBusy.value = false
  }
}

const handleToggleTodo = async (todo) => {
  if (!todo?.id) return
  const index = todos.value.findIndex((item) => item.id === todo.id)
  if (index < 0) return

  const prev = todos.value[index]
  const optimistic = { ...prev, done: !prev.done }
  todos.value[index] = optimistic

  try {
    const updated = await toggleTodoDone(todo.id)
    const i = todos.value.findIndex((item) => item.id === updated.id)
    if (i >= 0) todos.value[i] = { ...todos.value[i], ...updated }
    await loadTodoCounts()
  } catch (error) {
    const i = todos.value.findIndex((item) => item.id === prev.id)
    if (i >= 0) todos.value[i] = prev
    notifyError(error)
  }
}

const handleDeleteTodo = async (todo) => {
  actionBusy.value = true
  try {
    await deleteTodo(todo.id)
    todos.value = todos.value.filter((item) => item.id !== todo.id)
    await loadTodoCounts()
  } catch (error) {
    notifyError(error)
  } finally {
    actionBusy.value = false
  }
}

const handleOpenSource = async (todo) => {
  if (!todo?.sourceNoteId) return
  try {
    const notes = await fetchNotesByIds([todo.sourceNoteId])
    const note = notes?.[0]
    if (!note) {
      notifyToast('来源碎片不存在或已删除')
      return
    }
    emit('open-source-note', {
      note,
      projectName: currentProject.value?.name || '未命名',
      projectId: currentProject.value?.id || '',
    })
  } catch (error) {
    notifyError(error)
  }
}

const closeSyncPreview = () => {
  if (syncConfirming.value) return
  syncPreviewVisible.value = false
  refreshPendingSyncCount()
}

const discardPendingSync = () => {
  if (syncConfirming.value) return
  const projectId = currentProject.value?.id
  if (projectId) clearPendingTodoSync(projectId)
  syncPreviewVisible.value = false
  syncCandidates.value = []
  refreshPendingSyncCount()
  notifyToast('已放弃本次提取，可重新同步')
}

const openPendingSyncPreview = () => {
  const project = currentProject.value
  if (!project?.id) return
  const pending = getPendingTodoSync(project.id)
  if (!pending?.candidates?.length) {
    refreshPendingSyncCount()
    notifyToast('没有待确认的同步结果')
    return
  }
  syncCandidates.value = pending.candidates
  syncPreviewVisible.value = true
}

const cacheSyncResult = (project, candidates, source) => {
  setPendingTodoSync(project.id, {
    candidates,
    projectName: project.name || '',
    source,
  })
  syncCandidates.value = candidates
  refreshPendingSyncCount()
}

const mapCursorExtractCandidates = (items, notes, existingHashes) => {
  const noteMap = new Map((notes || []).map((note) => [String(note.id), note]))
  const hashSet = existingHashes instanceof Set ? existingHashes : new Set(existingHashes || [])
  const seen = new Set()
  const result = []

  for (const item of items || []) {
    const title = normalizeTodoTitle(item?.title)
    if (!title) continue
    const sourceNoteId = item?.sourceNoteId ? String(item.sourceNoteId).trim() : ''
    const note = sourceNoteId ? noteMap.get(sourceNoteId) : null
    const sourceHash = sourceNoteId
      ? buildTodoSourceHash(sourceNoteId, title)
      : `manual::${title.toLowerCase()}`
    if (seen.has(sourceHash)) continue
    seen.add(sourceHash)

    result.push({
      title,
      doneWhen: String(item?.doneWhen || '').trim().slice(0, 120),
      sourceNoteId: sourceNoteId || null,
      noteTitle: note?.title || '',
      sourceTagId: note?.tagId || null,
      sourceTagName: '',
      sourceExcerpt: String(item?.excerpt || item?.reason || '').trim().slice(0, 60),
      sourceHash,
      exists: hashSet.has(sourceHash),
      selected: !hashSet.has(sourceHash),
    })
  }
  return result
}

const enrichCandidates = (list) =>
  (list || []).map((item) => ({
    ...item,
    sourceTagName:
      item.sourceTagName ||
      (item.sourceTagId ? tagNameById.value[String(item.sourceTagId)] || '' : ''),
  }))

const extractWithLocalAi = async (notes, existingHashes) => {
  syncPhase.value = '正在用本地 AI 提取待办…'
  const candidates = await extractTodosFromNotes({ notes, existingHashes })
  return enrichCandidates(candidates)
}

const extractWithCursor = async (project, notes, existingHashes) => {
  syncPhase.value = '正在启动 Agent 桥…'
  await ensureAgentBridge()
  syncPhase.value = 'Cursor 结合仓库提取中（可能较久，请稍候）…'
  notifyToast('正在用 Cursor 结合代码仓库提取…')
  const extracted = await agentExtract({
    cwd: project.localPath,
    notes,
    provider: 'cursor',
  })
  return enrichCandidates(
    mapCursorExtractCandidates(extracted?.items || [], notes, existingHashes),
  )
}

const handleSync = async () => {
  const project = currentProject.value
  if (!project) return

  if (syncing.value) {
    notifyToast(syncPhase.value || '同步进行中，可先去别处，完成后会缓存待确认')
    return
  }

  const pending = getPendingTodoSync(project.id)
  if (pending?.candidates?.length) {
    syncCandidates.value = pending.candidates
    syncPreviewVisible.value = true
    refreshPendingSyncCount()
    notifyToast('请先确认上次提取结果，确认或放弃后才能再次同步')
    return
  }

  if (!Array.isArray(project.tagIds) || !project.tagIds.length) {
    notifyToast('请先编辑事情并绑定同步标签')
    return
  }

  const preferCursor =
    Boolean(project.localPath) && isAgentBridgeAvailable()
  const canLocalAi = isTodoExtractAiAvailable()

  if (!preferCursor && !canLocalAi) {
    notifyToast('请先在设置中配置 AI，或关联本地路径使用 Cursor 提取')
    return
  }
  if (preferCursor) {
    const settings = loadAiSettings()
    if (!String(settings.cursorApiKey || settings.apiKey || '').trim()) {
      if (!canLocalAi) {
        notifyToast('请先在设置中填写 Cursor API Key')
        return
      }
    }
  }

  const projectIdAtStart = project.id
  syncing.value = true
  syncPhase.value = '正在拉取碎片…'
  try {
    const notes = await fetchNotesForTodoSync({
      tagIds: project.tagIds,
      since: project.lastSyncedAt || null,
    })
    if (!notes.length) {
      notifyToast(
        project.lastSyncedAt
          ? '暂无新增碎片，没有待同步待办'
          : '暂无碎片可同步',
      )
      return
    }

    const existingHashes = await fetchSourceHashesByProject(projectIdAtStart)
    let enriched = []
    let usedCursor = false

    const settings = loadAiSettings()
    const hasCursorKey = Boolean(
      String(settings.cursorApiKey || settings.apiKey || '').trim(),
    )
    const tryCursor = preferCursor && hasCursorKey

    if (tryCursor) {
      try {
        enriched = await extractWithCursor(project, notes, existingHashes)
        usedCursor = true
      } catch (error) {
        if (!canLocalAi) throw error
        notifyToast(
          `Cursor 提取失败，改用本地 AI：${error?.message || '未知错误'}`,
        )
        enriched = await extractWithLocalAi(notes, existingHashes)
      }
    } else {
      enriched = await extractWithLocalAi(notes, existingHashes)
    }

    // 仍以启动时的事情为准缓存，避免用户已切到别的事情
    const targetProject =
      projects.value.find((item) => item.id === projectIdAtStart) || project

    if (!enriched.length) {
      notifyToast(
        `已扫描 ${notes.length} 条碎片，未识别到可执行待办（不会更新同步时间，可改写后再试）`,
      )
      return
    }

    const creatable = enriched.filter((item) => !item.exists)
    if (!creatable.length) {
      const synced = await updateProject(projectIdAtStart, { lastSyncedAt: formatDateTime() })
      const index = projects.value.findIndex((item) => item.id === synced.id)
      if (index >= 0) projects.value[index] = synced
      notifyToast('待办均已存在，已更新同步时间')
      return
    }

    cacheSyncResult(
      targetProject,
      enriched,
      usedCursor ? 'cursor' : 'local',
    )

    const stillOnSameProject = currentProjectId.value === projectIdAtStart
    if (stillOnSameProject) {
      syncPreviewVisible.value = true
    }
    notifyToast(
      stillOnSameProject
        ? `已提取 ${creatable.length} 条，请确认写入`
        : `「${targetProject.name || '事情'}」已提取 ${creatable.length} 条，返回后确认即可`,
    )
  } catch (error) {
    notifyError(error)
  } finally {
    syncing.value = false
    syncPhase.value = ''
  }
}

const handleSyncConfirm = async (selectedItems) => {
  const project = currentProject.value
  if (!project) return

  syncConfirming.value = true
  try {
    const createdList = []
    for (const item of selectedItems) {
      if (item.exists) continue
      const hasSource = Boolean(item.sourceNoteId)
      const created = await createTodo({
        projectId: project.id,
        title: item.title,
        createdBy: hasSource ? 'sync' : 'manual',
        sourceNoteId: item.sourceNoteId || null,
        sourceNoteTitle: item.noteTitle || '',
        sourceTagId: item.sourceTagId || null,
        sourceTagName: item.sourceTagName || '',
        sourceExcerpt: item.sourceExcerpt,
        doneWhen: item.doneWhen || '',
        sourceHash: item.sourceHash,
      })
      createdList.push(created)
    }

    const synced = await updateProject(project.id, { lastSyncedAt: formatDateTime() })
    const index = projects.value.findIndex((item) => item.id === synced.id)
    if (index >= 0) projects.value[index] = synced

    if (createdList.length) {
      todos.value = [...createdList, ...todos.value]
    }
    await loadTodoCounts()

    clearPendingTodoSync(project.id)
    syncPreviewVisible.value = false
    syncCandidates.value = []
    refreshPendingSyncCount()
    notifyToast(createdList.length ? `已写入 ${createdList.length} 条待办` : '未写入新待办')
  } catch (error) {
    notifyError(error)
  } finally {
    syncConfirming.value = false
  }
}

watch(
  () => props.active,
  (isActive, wasActive) => {
    if (isActive) {
      refreshAll()
    } else if (wasActive) {
      void cancelOnLeave()
    }
  },
  { immediate: true },
)

defineExpose({
  reload: refreshAll,
  openTodoAt,
})
</script>

<style scoped>
.todo-panel {
  height: 100%;
  min-height: 0;
  padding: 8px 4px 0;
  box-sizing: border-box;
}
</style>
