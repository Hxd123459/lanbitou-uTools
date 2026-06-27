<template>
  <motion.div
    class="ai-settings-card sediment-templates-card"
    :initial="cardMotion.initial"
    :animate="cardMotion.animate"
    :transition="cardMotion.transition"
  >
    <SettingsSectionHeading title="整理模板" />

    <div class="sediment-templates-grid">
      <button
        :id="SETTINGS_NAV_TARGETS.sedimentTemplateAdd"
        type="button"
        class="sediment-template-card sediment-template-card--add"
        :class="{ 'is-highlight': highlightAddCard }"
        @click="openCreate"
      >
        <span class="sediment-template-card-add-icon" aria-hidden="true">+</span>
        <span class="sediment-template-card-add-text">新增模板</span>
      </button>

      <article
        v-for="item in templates"
        :key="item.id"
        class="sediment-template-card"
        :class="{ 'is-deleting': deletingId === item.id }"
      >
        <div
          v-if="deletingId === item.id"
          class="sediment-template-delete-confirm"
          @click.stop
        >
          <span class="sediment-template-delete-text">删除「{{ item.title }}」？</span>
          <div class="sediment-template-delete-actions">
            <motion.button
              type="button"
              class="sediment-template-delete-btn sediment-template-delete-btn--yes"
              :disabled="deleteSaving"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="confirmDelete(item)"
            >
              {{ deleteSaving ? '删除中…' : '删除' }}
            </motion.button>
            <motion.button
              type="button"
              class="sediment-template-delete-btn sediment-template-delete-btn--no"
              :disabled="deleteSaving"
              :while-hover="presets.button.hover"
              :while-tap="presets.button.tap"
              :transition="presets.button.transition"
              @click="cancelDelete"
            >
              取消
            </motion.button>
          </div>
        </div>

        <template v-else>
          <div class="sediment-template-card-head">
            <h4 class="sediment-template-card-title">{{ item.title }}</h4>
            <div class="sediment-template-card-actions">
              <motion.button
                type="button"
                class="icon-btn"
                title="编辑"
                aria-label="编辑模板"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="openEdit(item)"
              >
                <svg
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
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </motion.button>
              <motion.button
                type="button"
                class="icon-btn icon-btn-danger"
                title="删除"
                aria-label="删除模板"
                :while-hover="presets.button.hover"
                :while-tap="presets.button.tap"
                :transition="presets.button.transition"
                @click="startDelete(item)"
              >
                <svg
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
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </motion.button>
            </div>
          </div>
          <p class="sediment-template-card-instruction">{{ item.instruction }}</p>
        </template>
      </article>
    </div>

    <p v-if="inlineError" class="sediment-templates-inline-error">{{ inlineError }}</p>

    <SedimentTemplateEditModal
      :visible="modalOpen"
      :initial="editing"
      :saving="saving"
      @close="closeModal"
      @submit="handleSubmit"
    />
  </motion.div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { useSedimentTemplates } from '../../composables/useSedimentTemplates'
import { SETTINGS_NAV_TARGETS } from '../../composables/useSettingsNavigation'
import SedimentTemplateEditModal from './SedimentTemplateEditModal.vue'
import SettingsSectionHeading from './SettingsSectionHeading.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  highlightAddCard: {
    type: Boolean,
    default: false,
  },
})

const { presets } = useMotionPresets()
const {
  templates,
  createSedimentTemplate,
  updateSedimentTemplate,
  deleteSedimentTemplate,
} = useSedimentTemplates()

const modalOpen = ref(false)
const editing = ref({ title: '', instruction: '' })
const saving = ref(false)
const deletingId = ref(null)
const deleteSaving = ref(false)
const inlineError = ref('')

const cardMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.16 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const openCreate = () => {
  cancelDelete()
  editing.value = { title: '', instruction: '' }
  modalOpen.value = true
}

const openEdit = (item) => {
  cancelDelete()
  editing.value = { ...item }
  modalOpen.value = true
}

const closeModal = () => {
  if (saving.value) return
  modalOpen.value = false
}

const handleSubmit = async ({ title, instruction }) => {
  saving.value = true
  inlineError.value = ''
  try {
    if (editing.value?.id) {
      updateSedimentTemplate(editing.value.id, { title, instruction })
    } else {
      createSedimentTemplate({ title, instruction })
    }
    modalOpen.value = false
  } catch (error) {
    inlineError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    saving.value = false
  }
}

const startDelete = (item) => {
  inlineError.value = ''
  deletingId.value = item.id
}

const cancelDelete = () => {
  deletingId.value = null
}

const confirmDelete = async (item) => {
  if (deleteSaving.value) return
  deleteSaving.value = true
  inlineError.value = ''
  try {
    deleteSedimentTemplate(item.id)
    cancelDelete()
  } catch (error) {
    inlineError.value = error instanceof Error ? error.message : '删除失败'
  } finally {
    deleteSaving.value = false
  }
}
</script>

<style scoped>
.sediment-templates-card {
  margin-top: 14px;
  max-width: none;
}

.sediment-templates-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.sediment-template-card {
  position: relative;
  min-height: 132px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  text-align: left;
}

.sediment-template-card.is-deleting {
  display: flex;
  align-items: center;
  justify-content: center;
  border-color: rgba(239, 68, 68, 0.28);
  background: #fef2f2;
}

.sediment-template-card--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-style: dashed;
  border-color: rgba(24, 24, 27, 0.18);
  background: rgba(24, 24, 27, 0.02);
  color: var(--color-secondary-text);
  cursor: pointer;
  transition: border-color 0.14s ease, color 0.14s ease, background-color 0.14s ease;
}

.sediment-template-card--add:hover {
  border-color: rgba(37, 99, 235, 0.35);
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.04);
}

.sediment-template-card--add.is-highlight {
  border-color: rgba(37, 99, 235, 0.55);
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.1);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.sediment-template-card-add-icon {
  font-size: 24px;
  line-height: 1;
  font-weight: 300;
}

.sediment-template-card-add-text {
  font-size: 13px;
}

.sediment-template-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.sediment-template-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transform: translateY(-1px);
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.sediment-template-card:hover .sediment-template-card-actions,
.sediment-template-card:focus-within .sediment-template-card-actions {
  opacity: 1;
  transform: translateY(0);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-secondary-text);
  cursor: pointer;
}

.icon-btn:hover {
  background: rgba(24, 24, 27, 0.06);
  color: var(--color-text);
}

.icon-btn-danger:hover {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

.sediment-template-card-title {
  margin: 0;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.sediment-template-card-instruction {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-secondary-text);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}

.sediment-template-delete-confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  text-align: center;
}

.sediment-template-delete-text {
  font-size: 12px;
  font-weight: 500;
  color: #b91c1c;
}

.sediment-template-delete-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sediment-template-delete-btn {
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.sediment-template-delete-btn--yes {
  background: #ef4444;
  color: #fff;
}

.sediment-template-delete-btn--yes:hover:not(:disabled) {
  background: #dc2626;
}

.sediment-template-delete-btn--no {
  background: #fff;
  color: var(--color-secondary-text);
}

.sediment-template-delete-btn--no:hover:not(:disabled) {
  color: var(--color-primary);
}

.sediment-templates-inline-error {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--color-error);
}
</style>
