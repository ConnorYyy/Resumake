<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

type Editor = import('monaco-editor').editor.IStandaloneCodeEditor;

const props = defineProps<{ modelValue: string; language: 'html' | 'css' }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const container = ref<HTMLDivElement>();
let editor: Editor | null = null;

onMounted(async () => {
  const { monaco } = await import('../editor/monaco');
  if (!container.value) return;
  editor = monaco.editor.create(container.value, {
    value: props.modelValue,
    language: props.language,
    theme: 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    tabSize: 2,
  });
  editor.onDidChangeModelContent(() => {
    if (editor) emit('update:modelValue', editor.getValue());
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (editor && editor.getValue() !== value) editor.setValue(value);
  },
);

function insertText(text: string) {
  if (!editor) return;
  const selection = editor.getSelection();
  if (!selection) return;
  editor.executeEdits('insert-text', [{ range: selection, text, forceMoveMarkers: true }]);
  editor.focus();
}

defineExpose({ insertText });

onBeforeUnmount(() => {
  editor?.dispose();
  editor = null;
});
</script>

<template>
  <div ref="container" class="code-editor"></div>
</template>

<style scoped>
.code-editor {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
