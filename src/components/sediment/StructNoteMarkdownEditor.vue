<template>
  <div
    ref="rootRef"
    class="struct-note-md-editor"
    :class="{ 'is-disabled': disabled }"
    :style="rootStyle"
  >
    <Editor
      :value="modelValue"
      :plugins="editorPlugins"
      :locale="editorLocale"
      mode="tab"
      placeholder='输入 "/" 唤起快捷命令…'
      :editor-config="editorConfig"
      @change="onChange"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { Editor } from '@bytemd/vue-next'
import editorLocale from 'bytemd/locales/zh_Hans.json'
import { getByteMdEditorPlugins } from '../../composables/useByteMdPlugins'
import '../../assets/styles/bytemd-slash-menu.css'
import '../../assets/styles/bytemd-editor-live.css'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  minHeight: {
    type: [Number, String],
    default: 320,
  },
})

const emit = defineEmits(['update:modelValue'])

const rootRef = ref(null)
const editorPlugins = getByteMdEditorPlugins()

const editorConfig = computed(() => ({
  readOnly: props.disabled,
  lineWrapping: true,
  mode: 'gfm',
  theme: 'default',
}))

const rootStyle = computed(() => ({
  '--struct-note-md-min-height': `${Number(props.minHeight) || 320}px`,
}))

const onChange = (value) => {
  emit('update:modelValue', value)
}

const focus = async () => {
  await nextTick()
  rootRef.value?.querySelector('.CodeMirror textarea')?.focus()
}

defineExpose({ focus })
</script>

<style scoped>
.struct-note-md-editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.struct-note-md-editor :deep(.bytemd) {
  flex: 1;
  min-height: var(--struct-note-md-min-height);
  height: 100%;
  border: none;
  background: transparent;
  box-shadow: none;
}

.struct-note-md-editor :deep(.bytemd-toolbar),
.struct-note-md-editor :deep(.bytemd-status),
.struct-note-md-editor :deep(.bytemd-preview),
.struct-note-md-editor :deep(.bytemd-sidebar) {
  display: none !important;
}

.struct-note-md-editor :deep(.bytemd-body) {
  height: 100%;
}

.struct-note-md-editor :deep(.bytemd-editor) {
  width: 100% !important;
  border-right: none !important;
}

.struct-note-md-editor :deep(.CodeMirror) {
  height: 100%;
  min-height: var(--struct-note-md-min-height);
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
}

.struct-note-md-editor :deep(.CodeMirror-scroll) {
  min-height: var(--struct-note-md-min-height);
}

.struct-note-md-editor :deep(.CodeMirror-cursor) {
  border-left-color: var(--color-accent);
}

.struct-note-md-editor :deep(.CodeMirror-placeholder) {
  color: #d1d5db;
}

.struct-note-md-editor.is-disabled :deep(.CodeMirror) {
  opacity: 0.72;
}
</style>
