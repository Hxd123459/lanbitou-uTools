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
      <p class="settings-panel-desc">管理 AI 服务与本地数据备份。</p>
    </motion.header>

    <AiSettingsPanel
      :active="active"
      :pending-auto-tag-setup="pendingAutoTagSetup"
      embedded
      @auto-tag-enabled="emit('auto-tag-enabled')"
    />
    <DataBackupPanel
      :active="active"
      @imported="emit('imported')"
      @error="emit('error', $event)"
    />
  </motion.section>
</template>

<script setup>
import { computed } from 'vue'
import { motion } from 'motion-v'
import { useMotionPresets } from '../../composables/useMotionPresets'
import AiSettingsPanel from './AiSettingsPanel.vue'
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
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
}

.settings-panel-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-secondary-text);
}
</style>
