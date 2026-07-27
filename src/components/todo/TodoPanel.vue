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
      :queue-length="queueLength"
      :running-title="runningTitle"
      :run-details="runByTodoId"
      @back="backToList"
      @edit="openEditModal"
      @sync="handleSync"
      @add-todo="handleAddTodo"
      @toggle-todo="handleToggleTodo"
      @delete-todo="handleDeleteTodo"
      @open-source="handleOpenSource"
      @open-tag="handleOpenTag"
      @update-todo-title="handleUpdateTodoTitle"
      @enqueue-selected="handleEnqueueSelected"
      @cancel-run="cancelActive"
      @accept-todo="acceptTodo"
      @reject-todo="(todo) => rejectTodo(todo, { requeue: false })"
      @retry-todo="(todo) => continueTodo(todo, '')"
      @dismiss-failed="dismissFailed"
      @load-run="loadRunForTodo"
      @continue-todo="({ todo, feedback }) => continueTodo(todo, feedback)"
    />

    <ProjectFormModal
      :visible="formVisible"
      :project="editingProject"
      :saving="formSaving"
      @close="closeFormModal"
      @submit="handleFormSubmit"
    />

    <TodoSyncPreviewModal
      :visible="syncPreviewVisible"
      :items="syncCandidates"
      :confirming="syncConfirming"
      @close="closeSyncPreview"
      @confirm="handleSyncConfirm"
    />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from '../../api/project'
import {
  createTodo,
  deleteTodo,
  fetchNotesForTodoSync,
  fetchSourceHashesByProject,
  fetchTodoCountsByProject,
  fetchTodosByProject,
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
import { extractTodosFromNotes, isTodoExtractAiAvailable } from '../../ai/todoExtractService'
import { useTodoRunQueue } from '../../composables/useTodoRunQueue'
import { buildTodoSourceHash, normalizeTodoTitle } from '../../storage/utools/todoRepository'
import { formatDateTime } from '../../storage/utools/utils'
import { loadAiSettings } from '../../storage/utools/aiSettings'
import { MAX_PROJECTS } from '../../constants/todoLimits'
import ProjectListView from './ProjectListView.vue'
import ProjectDetailView from './ProjectDetailView.vue'
import ProjectFormModal from './ProjectFormModal.vue'
import TodoSyncPreviewModal from './TodoSyncPreviewModal.vue'

const props = defineProps({
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['error', 'toast', 'open-source-note', 'open-tag'])

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

const syncing = ref(false)
const syncPreviewVisible = ref(false)
const syncCandidates = ref([])
const syncConfirming = ref(false)
const detailViewRef = ref(null)

const currentProject = computed(() =>
  projects.value.find((item) => item.id === currentProjectId.value) || null,
)

const notifyError = (error) => {
  emit('error', error instanceof Error ? error : new Error(String(error || '操作失败')))
}

const notifyToast = (text) => {
  emit('toast', text)
}

const patchTodoLocal = (updated) => {
  if (!updated?.id) return
  const index = todos.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) todos.value[index] = updated
  else todos.value = [updated, ...todos.value]
}

const {
  queueLength,
  runningTitle,
  runByTodoId,
  enqueue,
  continueTodo,
  acceptTodo,
  rejectTodo,
  dismissFailed,
  cancelActive,
  loadRunForTodo,
} = useTodoRunQueue({
  getProject: () => currentProject.value,
  getTodos: () => todos.value,
  patchTodoLocal,
  onToast: notifyToast,
  onError: notifyError,
})

const handleEnqueueSelected = async () => {
  try {
    const selected = detailViewRef.value?.getSelectedTodos?.() || []
    await enqueue(selected)
    detailViewRef.value?.clearSelection?.()
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

const handleFormSubmit = async (payload) => {
  formSaving.value = true
  try {
    if (editingProject.value?.id) {
      const updated = await updateProject(editingProject.value.id, payload)
      const index = projects.value.findIndex((item) => item.id === updated.id)
      if (index >= 0) projects.value[index] = updated
      else projects.value = [updated, ...projects.value]
      notifyToast('已更新事情')
    } else {
      const created = await createProject(payload)
      projects.value = [created, ...projects.value]
      notifyToast('已创建事情')
    }
    formVisible.value = false
    editingProject.value = null
  } catch (error) {
    notifyError(error)
  } finally {
    formSaving.value = false
  }
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

const handleAddTodo = async (title) => {
  if (!currentProjectId.value) return
  actionBusy.value = true
  try {
    const created = await createTodo({
      projectId: currentProjectId.value,
      title,
      createdBy: 'manual',
    })
    todos.value = [created, ...todos.value]
    await loadTodoCounts()
  } catch (error) {
    notifyError(error)
  } finally {
    actionBusy.value = false
    await detailViewRef.value?.focusInput?.()
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
  syncCandidates.value = []
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

const handleSync = async () => {
  const project = currentProject.value
  if (!project) return
  if (!Array.isArray(project.tagIds) || !project.tagIds.length) {
    notifyToast('请先编辑事情并绑定同步标签')
    return
  }

  const useCursorExtract =
    Boolean(project.localPath) && isAgentBridgeAvailable()

  if (!useCursorExtract && !isTodoExtractAiAvailable()) {
    notifyToast('请先在设置中配置 AI，或关联本地路径使用 Cursor 提取')
    return
  }
  if (useCursorExtract) {
    const settings = loadAiSettings()
    if (!String(settings.cursorApiKey || settings.apiKey || '').trim()) {
      notifyToast('请先在设置中填写 Cursor API Key')
      return
    }
  }

  syncing.value = true
  try {
    const notes = await fetchNotesForTodoSync({
      tagIds: project.tagIds,
      since: project.lastSyncedAt || null,
    })
    if (!notes.length) {
      notifyToast('暂无新碎片')
      return
    }

    const existingHashes = await fetchSourceHashesByProject(project.id)
    let enriched = []

    if (useCursorExtract) {
      await ensureAgentBridge()
      const extracted = await agentExtract({
        cwd: project.localPath,
        notes,
        provider: 'cursor',
      })
      enriched = mapCursorExtractCandidates(extracted?.items || [], notes, existingHashes).map(
        (item) => ({
          ...item,
          sourceTagName:
            item.sourceTagName ||
            (item.sourceTagId ? tagNameById.value[String(item.sourceTagId)] || '' : ''),
        }),
      )
    } else {
      const candidates = await extractTodosFromNotes({ notes, existingHashes })
      enriched = candidates.map((item) => ({
        ...item,
        sourceTagName:
          item.sourceTagName ||
          (item.sourceTagId ? tagNameById.value[String(item.sourceTagId)] || '' : ''),
      }))
    }

    if (!enriched.length) {
      const synced = await updateProject(project.id, { lastSyncedAt: formatDateTime() })
      const index = projects.value.findIndex((item) => item.id === synced.id)
      if (index >= 0) projects.value[index] = synced
      notifyToast('未提取到新待办，已更新同步时间')
      return
    }

    const creatable = enriched.filter((item) => !item.exists)
    if (!creatable.length) {
      const synced = await updateProject(project.id, { lastSyncedAt: formatDateTime() })
      const index = projects.value.findIndex((item) => item.id === synced.id)
      if (index >= 0) projects.value[index] = synced
      notifyToast('待办均已存在，已更新同步时间')
      return
    }

    syncCandidates.value = enriched
    syncPreviewVisible.value = true
  } catch (error) {
    notifyError(error)
  } finally {
    syncing.value = false
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

    syncPreviewVisible.value = false
    syncCandidates.value = []
    notifyToast(createdList.length ? `已写入 ${createdList.length} 条待办` : '未写入新待办')
  } catch (error) {
    notifyError(error)
  } finally {
    syncConfirming.value = false
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) refreshAll()
  },
  { immediate: true },
)

defineExpose({
  reload: refreshAll,
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
