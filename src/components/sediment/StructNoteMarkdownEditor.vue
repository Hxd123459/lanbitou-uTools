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
      mode="split"
      :preview-debounce="80"
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
  lineNumbers: false,
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
.struct-note-md-editor :deep(.bytemd-sidebar) {
  display: none !important;
}

.struct-note-md-editor :deep(.bytemd-body) {
  position: relative;
  height: 100%;
  min-height: var(--struct-note-md-min-height);
  overflow: hidden;
}

/* 底层：ByteMD 实时预览（与 ByteMdPreview 同源渲染） */
.struct-note-md-editor :deep(.bytemd-preview) {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-height: var(--struct-note-md-min-height);
  overflow: auto;
  border: none !important;
  background: transparent;
}

.struct-note-md-editor :deep(.bytemd-preview .markdown-body) {
  max-width: none;
  margin: 0;
  padding: 0;
  font-size: 15px;
  line-height: 1.75;
  color: var(--color-text);
  word-break: break-word;
  background: transparent;
}

.struct-note-md-editor :deep(.bytemd-preview .markdown-body > :first-child) {
  margin-top: 0;
}

.struct-note-md-editor :deep(.bytemd-preview .markdown-body > :last-child) {
  margin-bottom: 0;
}

.struct-note-md-editor :deep(.bytemd-preview .markdown-body pre) {
  margin: 0 0 0.75em;
  background: #fafafa;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
  overflow: auto;
}

.struct-note-md-editor :deep(.bytemd-preview .markdown-body pre code) {
  background: transparent;
  padding: 0;
  font-size: inherit;
}

/* 顶层：透明输入层，实现所见即所得 */
.struct-note-md-editor :deep(.bytemd-editor) {
  position: absolute !important;
  inset: 0;
  z-index: 2;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden;
  border: none !important;
  background: transparent !important;
}

.struct-note-md-editor :deep(.CodeMirror) {
  height: 100%;
  min-height: var(--struct-note-md-min-height);
  background: transparent !important;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.75;
  color: transparent;
  caret-color: var(--color-accent);
}

.struct-note-md-editor :deep(.CodeMirror-scroll) {
  min-height: var(--struct-note-md-min-height);
}

.struct-note-md-editor :deep(.CodeMirror .CodeMirror-lines) {
  max-width: none;
  margin: 0;
  padding: 0;
}

.struct-note-md-editor :deep(.CodeMirror pre.CodeMirror-line),
.struct-note-md-editor :deep(.CodeMirror pre.CodeMirror-line-like) {
  padding: 0;
}

.struct-note-md-editor :deep(.CodeMirror-line) {
  color: transparent !important;
  -webkit-text-fill-color: transparent;
}

.struct-note-md-editor :deep(.CodeMirror-selected) {
  background: rgba(37, 99, 235, 0.12) !important;
}

.struct-note-md-editor :deep(.CodeMirror-cursor) {
  border-left-color: var(--color-accent);
}

.struct-note-md-editor :deep(.CodeMirror-placeholder) {
  color: #d1d5db;
  -webkit-text-fill-color: #d1d5db;
}

.struct-note-md-editor.is-disabled :deep(.CodeMirror) {
  opacity: 0.72;
}
</style>
