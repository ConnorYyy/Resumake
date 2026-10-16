<script setup lang="ts">
import { computed, ref } from 'vue';
import CodeEditor from './CodeEditor.vue';
import { useResumeStore } from '../stores/resume';
import { useI18n } from '../i18n';
import { avatarToken } from '../engine/compose';

const store = useResumeStore();
const { t } = useI18n();
const photoToken = computed(() => avatarToken(store.doc.meta.locale));
const tab = ref<'html' | 'css'>('html');
const htmlEditor = ref<InstanceType<typeof CodeEditor>>();

const htmlValue = computed({
  get: () => store.doc.meta.customHtml ?? store.composed.editableHtml,
  set: (value: string) => store.setCustomHtml(value),
});

const cssValue = computed({
  get: () => store.doc.meta.customCss,
  set: (value: string) => store.setCustomCss(value),
});

function insertPageBreak() {
  htmlEditor.value?.insertText('\n<div class="page-break"></div>\n');
}

function regenerate() {
  if (confirm(t('code.confirmRegenerate'))) store.regenerateHtml();
}

function resetCss() {
  if (confirm(t('code.confirmClearCss'))) store.resetCss();
}
</script>

<template>
  <div class="code-panel">
    <div class="code-toolbar">
      <div class="tabs">
        <button :class="{ active: tab === 'html' }" @click="tab = 'html'">{{ t('code.html') }}</button>
        <button :class="{ active: tab === 'css' }" @click="tab = 'css'">{{ t('code.css') }}</button>
      </div>
      <div class="actions">
        <template v-if="tab === 'html'">
          <button class="ghost" @click="insertPageBreak">{{ t('code.insertBreak') }}</button>
          <button v-if="store.isDetached" class="ghost" @click="regenerate">{{ t('code.regenerate') }}</button>
        </template>
        <button v-else class="ghost" @click="resetCss">{{ t('code.clearCss') }}</button>
      </div>
    </div>

    <p v-if="store.isDetached && tab === 'html'" class="notice">
      {{ t('code.detached') }}
    </p>
    <p v-if="tab === 'html'" class="hint">
      {{ t('code.photoHint', { photo: photoToken }) }}
    </p>
    <p v-if="tab === 'css'" class="hint">
      {{ t('code.cssHint') }}
    </p>
    <ul v-if="tab === 'css' && store.cssWarnings.length" class="warnings">
      <li v-for="warning in store.cssWarnings" :key="warning.key">{{ t(warning.key, warning.params) }}</li>
    </ul>

    <div class="editor-wrap">
      <div v-show="tab === 'html'" class="editor-pane">
        <CodeEditor ref="htmlEditor" v-model="htmlValue" language="html" />
      </div>
      <div v-show="tab === 'css'" class="editor-pane">
        <CodeEditor v-model="cssValue" language="css" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.code-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}

.tabs {
  display: flex;
  gap: 4px;
}

.tabs button {
  padding: 6px 12px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}

.tabs button.active {
  background: #0071e3;
  border-color: #0071e3;
  color: #fff;
}

.actions {
  display: flex;
  gap: 6px;
}

.ghost {
  padding: 6px 10px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.notice {
  margin: 0 0 8px;
  padding: 8px 10px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 6px;
  font-size: 13px;
}

.hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: #6e6e73;
}

.warnings {
  margin: 0 0 8px;
  padding: 8px 10px 8px 26px;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 6px;
  font-size: 13px;
}

.editor-wrap {
  flex: 1;
  min-height: 0;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  overflow: hidden;
}

.editor-pane {
  height: 100%;
}
</style>
