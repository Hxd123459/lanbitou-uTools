<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="visible"
        key="todo-sync-preview-modal"
        class="todo-sync-modal"
        role="dialog"
        aria-modal="true"
        aria-label="同步待办预览"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.18 }"
      >
        <motion.div
          class="todo-sync-modal-backdrop"
          aria-hidden="true"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          @click="!confirming && emit('close')"
        />

        <motion.div
          class="todo-sync-modal-card"
          :initial="{ opacity: 0, y: 16, scale: 0.98 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: 12, scale: 0.98 }"
          :transition="{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }"
        >
          <header class="todo-sync-modal-header">
            <h3 class="todo-sync-modal-title">同步待办预览</h3>
            <p class="todo-sync-modal-desc">勾选要写入的待办，已存在项不会重复创建</p>
          </header>

          <p v-if="!candidates.length" class="todo-sync-modal-empty">没有可新增的待办</p>

          <ul v-else class="todo-sync-list" role="list">
            <li
              v-for="item in candidates"
              :key="item.sourceHash"
              class="todo-sync-item"
              :class="{ 'is-exists': item.exists }"
            >
              <label class="todo-sync-item-label">
                <input
                  type="checkbox"
                  :checked="item.selected"
                  :disabled="item.exists || confirming"
                  @change="toggleItem(item)"
                />
                <span class="todo-sync-item-body">
                  <span class="todo-sync-item-title">{{ item.title }}</span>
                  <span class="todo-sync-item-meta">
                    <span v-if="item.exists" class="todo-sync-badge">已存在</span>
                    <span v-if="item.noteTitle">来自「{{ item.noteTitle }}」</span>
                  </span>
                </span>
              </label>
            </li>
          </ul>

          <div class="todo-sync-modal-actions">
            <AppButton class="btn btn-icon-text" type="button" :disabled="confirming" @click="emit('close')">
              取消
            </AppButton>
            <AppButton
              class="btn btn-primary"
              type="button"
              :disabled="confirming || !selectedCount"
              @click="emit('confirm', selectedItems)"
            >
              {{ confirming ? '写入中…' : `写入 ${selectedCount} 条` }}
            </AppButton>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import AppButton from '../motion/AppButton.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  confirming: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'confirm'])

const candidates = ref([])

watch(
  () => [props.visible, props.items],
  () => {
    if (!props.visible) return
    candidates.value = (props.items || []).map((item) => ({
      ...item,
      selected: item.exists ? false : item.selected !== false,
    }))
  },
  { immediate: true, deep: true },
)

const selectedItems = computed(() => candidates.value.filter((item) => item.selected && !item.exists))
const selectedCount = computed(() => selectedItems.value.length)

const toggleItem = (item) => {
  if (item.exists) return
  item.selected = !item.selected
}
</script>

<style scoped>
.todo-sync-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.todo-sync-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(24, 24, 27, 0.28);
}

.todo-sync-modal-card {
  position: relative;
  z-index: 1;
  width: min(480px, 100%);
  max-height: min(72vh, 640px);
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.todo-sync-modal-header {
  margin-bottom: 12px;
}

.todo-sync-modal-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.todo-sync-modal-desc {
  margin: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.todo-sync-modal-empty {
  margin: 12px 0;
  font-size: 13px;
  color: var(--color-secondary-text);
}

.todo-sync-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
}

.todo-sync-item {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fff;
}

.todo-sync-item.is-exists {
  opacity: 0.7;
}

.todo-sync-item-label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  cursor: pointer;
}

.todo-sync-item-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.todo-sync-item-title {
  font-size: 13px;
  color: var(--color-text);
  word-break: break-word;
}

.todo-sync-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: var(--color-secondary-text);
}

.todo-sync-badge {
  color: var(--color-warning);
  font-weight: 500;
}

.todo-sync-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
