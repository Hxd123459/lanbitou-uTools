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
      @back="backToList"
      @edit="openEditModal"
      @sync="handleSync"
      @open-pending-sync="openPendingSyncPreview"
      @open-add="openAddModal"
      @delete-todo="handleDeleteTodo"
      @toggle-todo="handleToggleTodo"
      @open-source="handleOpenSource"
      @open-tag="handleOpenTag"
      @open-sediment-folder="handleOpenSedimentFolder"
      @update-todo-title="handleUpdateTodoTitle"
      @generate-selected="openGenerateModal"
      @bulk-complete="handleBulkComplete"
      @bulk-delete="handleBulkDelete"
      @reorder-todos="handleReorderTodos"
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
      :initial-template="generateTemplateId"
      @close="closeGenerateModal"
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
  createNoteInFolder,
  createStructFolder,
  fetchStructFolder,
  renameStructItem,
} from '../../api/structFolder'
import { extractTodosFromNotes, isTodoExtractAiAvailable } from '../../ai/todoExtractService'
import { formatDateTime } from '../../storage/utools/utils'
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
const generateTemplateId = ref('')

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

const openGenerateModal = (templateId = '') => {
  const selected = detailViewRef.value?.getSelectedTodos?.() || []
  if (!selected.length) {
    notifyToast('请先选择待办')
    return
  }
  generateTodos.value = selected
  generateTemplateId.value = String(templateId || '').trim()
  generateVisible.value = true
}

const closeGenerateModal = () => {
  generateVisible.value = false
  generateTemplateId.value = ''
}

const handleBulkComplete = async () => {
  const selected = detailViewRef.value?.getSelectedTodos?.() || []
  const targets = selected.filter((item) => item?.id && !item.done)
  if (!targets.length) {
    notifyToast('所选待办均已完成')
    return
  }
  actionBusy.value = true
  try {
    for (const todo of targets) {
      const updated = await toggleTodoDone(todo.id)
      const index = todos.value.findIndex((item) => item.id === updated.id)
      if (index >= 0) todos.value[index] = { ...todos.value[index], ...updated }
    }
    detailViewRef.value?.clearSelection?.()
    await loadTodoCounts()
    notifyToast(`已完成 ${targets.length} 条`)
  } catch (error) {
    notifyError(error)
    await loadTodos()
  } finally {
    actionBusy.value = false
  }
}

const handleBulkDelete = async () => {
  const selected = detailViewRef.value?.getSelectedTodos?.() || []
  if (!selected.length) {
    notifyToast('请先选择待办')
    return
  }
  actionBusy.value = true
  try {
    const ids = new Set(selected.map((item) => String(item.id)))
    for (const todo of selected) {
      await deleteTodo(todo.id)
    }
    todos.value = todos.value.filter((item) => !ids.has(String(item.id)))
    detailViewRef.value?.clearSelection?.()
    await loadTodoCounts()
    notifyToast(`已删除 ${selected.length} 条`)
  } catch (error) {
    notifyError(error)
    await loadTodos()
  } finally {
    actionBusy.value = false
  }
}

const handleSaveGenerateArchive = async ({ template, text, label }) => {
  const project = currentProject.value
  if (!project?.sedimentFolderId) {
    notifyToast('请先保存事情以关联沉淀文件夹')
    return
  }
  try {
    const date = formatDateTime().slice(0, 10)
    const title = `${label || '产出'} · ${date}`
    await createNoteInFolder({
      parentId: project.sedimentFolderId,
      title,
      content: String(text || '').trim(),
    })
    notifyToast('已写入沉淀文件夹')
    closeGenerateModal()
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

  // 追加到当前层末尾，避免新待办文件夹插到最前打乱浏览习惯
  const createdId = await createStructFolder({
    parentId: 0,
    name: folderName,
    sort: 'append',
  })
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

const handleAddTodo = async (titlesInput) => {
  if (!currentProjectId.value) return
  const titles = (Array.isArray(titlesInput) ? titlesInput : [titlesInput])
    .map((title) => String(title ?? '').trim())
    .filter(Boolean)
  if (!titles.length) return

  addSaving.value = true
  actionBusy.value = true
  try {
    const createdList = []
    // 倒序创建，保证列表中按录入顺序从上到下
    for (let i = titles.length - 1; i >= 0; i -= 1) {
      const created = await createTodo({
        projectId: currentProjectId.value,
        title: titles[i],
        createdBy: 'manual',
      })
      createdList.unshift(created)
    }
    todos.value = [...createdList, ...todos.value]
    await loadTodoCounts()
    addVisible.value = false
    notifyToast(createdList.length > 1 ? `已加入 ${createdList.length} 条待办` : '已加入待办')
  } catch (error) {
    notifyError(error)
    await loadTodos()
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
  todos.value = todos.value.map((item, i) => (i === index ? optimistic : item))

  try {
    const updated = await toggleTodoDone(todo.id)
    todos.value = todos.value.map((item) =>
      item.id === updated.id ? { ...item, ...updated } : item,
    )
    await loadTodoCounts()
  } catch (error) {
    todos.value = todos.value.map((item) => (item.id === prev.id ? prev : item))
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

  if (!isTodoExtractAiAvailable()) {
    notifyToast('请先在设置中配置 AI')
    return
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
      // 没有新增碎片也推进同步时间，避免反复空扫同一区间
      const synced = await updateProject(projectIdAtStart, { lastSyncedAt: formatDateTime() })
      const emptyIndex = projects.value.findIndex((item) => item.id === synced.id)
      if (emptyIndex >= 0) projects.value[emptyIndex] = synced
      notifyToast(
        project.lastSyncedAt
          ? '暂无新增碎片，已更新同步时间'
          : '暂无碎片可同步，已记录同步时间',
      )
      return
    }

    const existingHashes = await fetchSourceHashesByProject(projectIdAtStart)
    const enriched = await extractWithLocalAi(notes, existingHashes)

    const targetProject =
      projects.value.find((item) => item.id === projectIdAtStart) || project

    if (!enriched.length) {
      // 已扫描内容但无待办，仍记录同步时间，后续从该时间点往后扫
      const synced = await updateProject(projectIdAtStart, { lastSyncedAt: formatDateTime() })
      const scannedIndex = projects.value.findIndex((item) => item.id === synced.id)
      if (scannedIndex >= 0) projects.value[scannedIndex] = synced
      notifyToast(`已扫描 ${notes.length} 条碎片，未识别到可执行待办，已更新同步时间`)
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

    cacheSyncResult(targetProject, enriched, 'local')

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
  (isActive) => {
    if (isActive) refreshAll()
  },
  { immediate: true },
)

defineExpose({
  reload: refreshAll,
  openTodoAt,
  openProjectById: async (projectId) => {
    const pid = String(projectId || '').trim()
    if (!pid) return false
    if (!projects.value.length) await loadProjects()
    const project = projects.value.find((item) => String(item.id) === pid)
    if (!project) return false
    await openProject(project)
    return true
  },
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
