<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import Toolbar from './components/Toolbar.vue';
import FormPanel from './components/FormPanel.vue';
import Preview from './components/Preview.vue';

/** Monaco 体积较大，只有切到“高级编辑”时才加载 */
const CodePanel = defineAsyncComponent(() => import('./components/CodePanel.vue'));
import { useResumeStore, type EditorMode } from './stores/resume';
import { useI18n } from './i18n';
import { SUPPORT_ENABLED, SUPPORT_URL } from './config/support';
import { readLastPromptAt, shouldPromptSupport, writeLastPromptAt } from './services/support';

const store = useResumeStore();
const { t } = useI18n();
const preview = ref<InstanceType<typeof Preview>>();
const showPrintDialog = ref(false);
const showThanks = ref(false);

const modes: { value: EditorMode; label: string }[] = [
  { value: 'form', label: 'mode.form' },
  { value: 'code', label: 'mode.code' },
];

const saveText = computed(() => {
  switch (store.saveStatus) {
    case 'saving':
      return t('save.saving');
    case 'saved':
      return t('save.saved', { time: new Date(store.savedAt ?? Date.now()).toLocaleTimeString(store.doc.meta.locale) });
    case 'error':
      return t('save.error');
    default:
      return t('save.idle');
  }
});

watchEffect(() => {
  document.documentElement.lang = store.doc.meta.locale;
  document.title = t('app.title');
});

function openPrint() {
  showPrintDialog.value = true;
}

function confirmPrint() {
  showPrintDialog.value = false;
  preview.value?.print();
}

/** 打印对话框关闭后，按冷却期提示一次赞助（不阻塞导出） */
function onPrintClosed() {
  if (!SUPPORT_ENABLED) return;
  const now = Date.now();
  if (!shouldPromptSupport(readLastPromptAt(), now)) return;
  writeLastPromptAt(now);
  showThanks.value = true;
}

/** 在输入框和代码编辑器里让浏览器自己的撤销生效，其余位置用简历级的撤销/重做 */
function isEditable(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (typeof el?.closest !== 'function') return false;
  return el.closest('input, textarea, select, [contenteditable="true"], .monaco-editor') !== null;
}

function onKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  if (isEditable(event.target)) return;
  event.preventDefault();
  if (key === 'y' || event.shiftKey) store.redo();
  else store.undo();
}

onMounted(() => {
  store.init();
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="app">
    <div v-if="!store.loaded" class="app-splash">
      <img src="/logo.svg" alt="Resumake logo" />
      <span>{{ t('app.loading') }}</span>
    </div>

    <Toolbar @print="openPrint" />

    <main class="workspace">
      <section class="editor">
        <div class="mode-tabs">
          <button
            v-for="m in modes"
            :key="m.value"
            :class="{ active: store.mode === m.value }"
            @click="store.setMode(m.value)"
          >
            {{ t(m.label) }}
          </button>
        </div>
        <div class="editor-body">
          <FormPanel v-if="store.mode === 'form'" />
          <CodePanel v-else />
        </div>
      </section>

      <section class="preview-wrap">
        <Preview ref="preview" @print-closed="onPrintClosed" />
      </section>
    </main>

    <footer class="statusbar">
      <span class="foot-brand">
        <img src="/logo.svg" alt="" width="16" height="16" />
        Resumake
      </span>
      <span>{{ saveText }}</span>
      <span>{{ t('status.pages', { n: store.pageCount }) }}</span>
      <span v-if="store.cssWarnings.length" class="warn">{{ t('status.cssWarnings', { n: store.cssWarnings.length }) }}</span>
    </footer>

    <div v-if="showPrintDialog" class="modal-mask" @click.self="showPrintDialog = false">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="print-title">
        <h2 id="print-title">{{ t('print.title') }}</h2>
        <ul>
          <li>{{ t('print.paper', { paper: store.doc.meta.paperSize }) }}</li>
          <li>{{ t('print.margin') }}</li>
          <li>{{ t('print.target') }}</li>
          <li>{{ t('print.background') }}</li>
          <li>{{ t('print.header') }}</li>
          <li>{{ t('print.links') }}</li>
          <li>{{ t('print.pages') }}</li>
        </ul>
        <div v-if="SUPPORT_ENABLED" class="support-note">
          <span>{{ t('support.preNote') }}</span>
          <a class="bmc" :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer">☕ {{ t('support.button') }}</a>
        </div>
        <div class="modal-actions">
          <button class="ghost" @click="showPrintDialog = false">{{ t('print.cancel') }}</button>
          <button class="primary" @click="confirmPrint">{{ t('print.open') }}</button>
        </div>
      </div>
    </div>

    <div v-if="showThanks" class="modal-mask" @click.self="showThanks = false">
      <div class="modal thanks" role="dialog" aria-modal="true" aria-labelledby="thanks-title">
        <h2 id="thanks-title">{{ t('support.thanksTitle') }}</h2>
        <p>{{ t('support.thanksBody') }}</p>
        <div class="modal-actions">
          <button class="ghost" @click="showThanks = false">{{ t('support.later') }}</button>
          <a class="bmc" :href="SUPPORT_URL" target="_blank" rel="noopener noreferrer" @click="showThanks = false">
            ☕ {{ t('support.button') }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 42%) 1fr;
  gap: 12px;
  padding: 12px;
}

.editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mode-tabs {
  display: flex;
  gap: 4px;
  padding-bottom: 8px;
}

.mode-tabs button {
  padding: 6px 16px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}

.mode-tabs button.active {
  background: #1d1d1f;
  border-color: #1d1d1f;
  color: #fff;
}

.editor-body {
  flex: 1;
  min-height: 0;
}

.preview-wrap {
  min-height: 0;
  min-width: 0;
}

.statusbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 8px 20px;
  font-size: 12px;
  color: #6e6e73;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.foot-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #1d1d1f;
}

.foot-brand img {
  display: block;
  border-radius: 4px;
}

.statusbar .warn {
  color: #b45309;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.modal {
  width: min(480px, 92vw);
  background: #fff;
  border-radius: 10px;
  padding: 20px 22px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal h2 {
  margin: 0 0 10px;
  font-size: 18px;
}

.modal ul {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  color: #424245;
  line-height: 1.8;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.modal-actions button {
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #d2d2d7;
  background: #fff;
}

.modal-actions .primary {
  background: #0071e3;
  border-color: #0071e3;
  color: #fff;
}

.support-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 12px;
  background: #f5f5f7;
  border-radius: 10px;
  font-size: 13px;
  color: #6e6e73;
}

.thanks p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #424245;
}

.bmc {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 980px;
  background: #ffdd00;
  color: #000000;
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.bmc:hover {
  background: #ffea4d;
}

@media (max-width: 900px) {
  .workspace {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .app {
    height: auto;
    min-height: 100vh;
  }

  .editor-body {
    min-height: 60vh;
  }

  .preview-wrap {
    height: 70vh;
  }
}
</style>
