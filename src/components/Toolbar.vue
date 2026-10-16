<script setup lang="ts">
import { computed, ref } from 'vue';
import { useResumeStore } from '../stores/resume';
import { TEMPLATES } from '../templates';
import { FONT_SCALE_OPTIONS } from '../data/schema';
import { validateResumeFile } from '../engine/validate';
import { DATE_FORMATS, formatDate } from '../engine/date';
import { exportHtml, exportJson, readJsonFile } from '../services/io';
import { useI18n } from '../i18n';
import ThemePicker from './ThemePicker.vue';
import type { DateFormat, Locale, MarginPreset, PaperSize } from '../types';

const emit = defineEmits<{ print: [] }>();
const store = useResumeStore();
const { t } = useI18n();
const fileInput = ref<HTMLInputElement>();

const dateFormatOptions = computed(() =>
  DATE_FORMATS[store.doc.meta.locale].map((format) => ({
    value: format,
    label: formatDate('2020-07', store.doc.meta.locale, format),
  })),
);

const fontScaleOptions = FONT_SCALE_OPTIONS;

function onTemplate(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (store.isDetached && !confirm(t('confirm.switchTemplate'))) {
    (event.target as HTMLSelectElement).value = store.doc.meta.templateId;
    return;
  }
  store.setTemplate(id);
}

function onLocale(event: Event) {
  store.setLocale((event.target as HTMLSelectElement).value as Locale);
}

function onDateFormat(event: Event) {
  store.setDateFormat((event.target as HTMLSelectElement).value as DateFormat);
}

function onFontScale(event: Event) {
  store.setFontScale(Number((event.target as HTMLSelectElement).value) / 100);
}

function onPaper(event: Event) {
  store.setPaper((event.target as HTMLSelectElement).value as PaperSize);
}

function onMargin(event: Event) {
  store.setMargin((event.target as HTMLSelectElement).value as MarginPreset);
}

function loadSample() {
  if (confirm(t('confirm.loadSample'))) store.loadSample();
}

function clearAll() {
  if (confirm(t('confirm.clear'))) store.clearAll();
}

function openImport() {
  fileInput.value?.click();
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const raw = await readJsonFile(file);
    const result = validateResumeFile(raw, store.doc.meta.locale);
    if (!result.ok) {
      alert(t('alert.importFailed', { reason: result.error }));
      return;
    }
    if (confirm(t('confirm.import'))) store.replaceDoc(result.doc);
  } catch (err) {
    const reason = err instanceof SyntaxError ? t('error.invalidJson') : err instanceof Error ? err.message : t('error.unknown');
    alert(t('alert.importFailed', { reason }));
  }
}
</script>

<template>
  <header class="toolbar">
    <a class="brand" href="/" :title="t('toolbar.backHome')">
      <img class="logo" src="/logo.svg" :alt="t('toolbar.logoAlt')" width="28" height="28" />
      <span>Resumake</span>
    </a>

    <div class="settings">
      <label>
        {{ t('toolbar.template') }}
        <select :value="store.doc.meta.templateId" @change="onTemplate">
          <option v-for="tpl in TEMPLATES" :key="tpl.id" :value="tpl.id">{{ t(tpl.name) }}</option>
        </select>
      </label>
      <label>
        {{ t('toolbar.language') }}
        <select :value="store.doc.meta.locale" @change="onLocale">
          <option value="zh-CN">{{ t('lang.zh') }}</option>
          <option value="en-US">{{ t('lang.en') }}</option>
        </select>
      </label>
      <label>
        {{ t('toolbar.dateFormat') }}
        <select :value="store.doc.meta.dateFormat" @change="onDateFormat">
          <option v-for="opt in dateFormatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <label>
        {{ t('toolbar.paper') }}
        <select :value="store.doc.meta.paperSize" @change="onPaper">
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
      </label>
      <label>
        {{ t('toolbar.margin') }}
        <select :value="store.doc.meta.margin" @change="onMargin">
          <option value="narrow">{{ t('margin.narrow') }}</option>
          <option value="normal">{{ t('margin.normal') }}</option>
          <option value="wide">{{ t('margin.wide') }}</option>
        </select>
      </label>
      <label>
        {{ t('toolbar.fontSize') }}
        <select :value="String(Math.round(store.doc.meta.fontScale * 100))" @change="onFontScale">
          <option v-for="size in fontScaleOptions" :key="size" :value="String(size)">{{ size }}%</option>
        </select>
      </label>
      <div class="field">
        <span>{{ t('toolbar.themeColor') }}</span>
        <ThemePicker />
      </div>
    </div>

    <div class="actions">
      <button
        class="icon"
        :disabled="!store.canUndo"
        :title="t('toolbar.undo')"
        :aria-label="t('toolbar.undo')"
        @click="store.undo()"
      >
        ↶
      </button>
      <button
        class="icon"
        :disabled="!store.canRedo"
        :title="t('toolbar.redo')"
        :aria-label="t('toolbar.redo')"
        @click="store.redo()"
      >
        ↷
      </button>
      <button class="ghost" @click="loadSample">{{ t('toolbar.sample') }}</button>
      <button class="ghost" @click="clearAll">{{ t('toolbar.clear') }}</button>
      <button class="ghost" @click="openImport">{{ t('toolbar.importJson') }}</button>
      <button class="ghost" @click="exportJson(store.doc)">{{ t('toolbar.exportJson') }}</button>
      <button class="ghost" @click="exportHtml(store.doc, store.composed.srcdoc)">{{ t('toolbar.exportHtml') }}</button>
      <button class="primary" @click="emit('print')">{{ t('toolbar.exportPdf') }}</button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImportFile" />
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  position: relative;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px 16px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 18px;
  color: #1d1d1f;
  text-decoration: none;
}

.logo {
  display: block;
  width: 28px;
  height: 28px;
}

.settings {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.settings label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #424245;
}

.field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #424245;
}

select {
  padding: 4px 6px;
  border: 1px solid #d2d2d7;
  border-radius: 6px;
  font: inherit;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.actions button {
  padding: 6px 14px;
  border-radius: 980px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #d2d2d7;
  background: #fff;
}

.actions .icon {
  padding: 6px 10px;
  line-height: 1;
}

.actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.actions .primary {
  background: #0071e3;
  border-color: #0071e3;
  color: #fff;
  font-weight: 600;
}
</style>
