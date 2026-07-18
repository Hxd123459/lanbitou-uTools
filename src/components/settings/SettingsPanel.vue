<template>
  <motion.section
    class="settings-panel"
    aria-label="设置"
    :initial="panelMotion.initial"
    :animate="panelMotion.animate"
    :transition="panelMotion.transition"
  >
    <motion.header
      class="settings-panel-header"
      :initial="headerMotion.initial"
      :animate="headerMotion.animate"
      :transition="headerMotion.transition"
    >
      <h2 class="settings-panel-title">设置</h2>
    </motion.header>

    <AiSettingsPanel
      :active="active"
      :pending-auto-tag-setup="pendingAutoTagSetup"
      embedded
      @auto-tag-enabled="emit('auto-tag-enabled')"
    />
    <ProfilePanel :active="active" />
    <DataBackupPanel
      :active="active"
      @imported="emit('imported')"
      @error="emit('error', $event)"
    />
    <SedimentTemplatesPanel
      :active="active"
      :highlight-add-card="highlightTemplateAdd"
    />
  </motion.section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import { SETTINGS_NAV_TARGETS } from '../../composables/useSettingsNavigation'
import AiSettingsPanel from './AiSettingsPanel.vue'
import ProfilePanel from './ProfilePanel.vue'
import SedimentTemplatesPanel from './SedimentTemplatesPanel.vue'
import DataBackupPanel from './DataBackupPanel.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  pendingAutoTagSetup: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['auto-tag-enabled', 'imported', 'error'])

const { presets } = useMotionPresets()
const highlightTemplateAdd = ref(false)
let highlightTimer = null

const scrollToTarget = (targetId) => {
  if (!targetId) return false

  const el = document.getElementById(targetId)
  if (!el) return false

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (targetId === SETTINGS_NAV_TARGETS.sedimentTemplateAdd) {
    highlightTemplateAdd.value = true
    if (highlightTimer) window.clearTimeout(highlightTimer)
    highlightTimer = window.setTimeout(() => {
      highlightTemplateAdd.value = false
      highlightTimer = null
    }, 1800)
  }

  return true
}

defineExpose({ scrollToTarget })

const panelMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: reveal.transition }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})

const headerMotion = computed(() => {
  const reveal = presets.value.reveal
  return props.active
    ? { initial: reveal.initial, animate: reveal.animate, transition: { ...reveal.transition, delay: 0.04 } }
    : { initial: reveal.initial, animate: reveal.initial, transition: reveal.transition }
})
</script>

<style scoped>
.settings-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 4px 28px;
}

.settings-panel-header {
  margin-bottom: 16px;
}

.settings-panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
}
</style>
