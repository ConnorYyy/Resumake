import { acceptHMRUpdate, defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { composeResume } from '../engine/compose';
import { validateResumeFile } from '../engine/validate';
import { defaultDateFormat, isDateFormatFor } from '../engine/date';
import { createItem, createEmptyDoc } from '../data/factory';
import { snapFontScale } from '../data/schema';
import { createSample } from '../data/sample';
import { resolveInitialLocale } from '../i18n/locale';
import { reportIssue } from '../services/telemetry';
import { dbGet, dbSet } from '../storage/db';
import type {
  DateFormat,
  ListItem,
  ListKey,
  Locale,
  MarginPreset,
  PaperSize,
  PhotoAlign,
  ProfileKey,
  ResumeDoc,
  ResumeMeta,
  SectionKey,
  SectionTitleKey,
} from '../types';

const STORAGE_KEY = 'current-resume';
const SAVE_DELAY = 500;
/** 连续输入合并成一步撤销 */
const HISTORY_DELAY = 400;
const HISTORY_LIMIT = 100;

export type EditorMode = 'form' | 'code';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 只保留“展示相关”的设置，用于填入示例/清空内容时延续用户的偏好 */
/**
 * 保存的文档是否仍是内置示例（用户从未改过内容）。
 *
 * 忽略条目 id、照片、空字符串字段与时间戳：
 * 校验器会把缺省字段补成空字符串，直接比较 JSON 会误判为「已修改」。
 */
export function isUntouchedSample(doc: ResumeDoc): boolean {
  const pick = (value: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const field = value[key];
      if (field === '' || field === undefined || field === null) continue;
      if (key === 'id' || key === 'avatar' || key === 'avatarAlign') continue;
      out[key] = field;
    }
    return out;
  };

  const sections = (value: ResumeDoc) => ({
    profile: pick(value.profile),
    education: value.education.map(pick),
    experience: value.experience.map(pick),
    projects: value.projects.map(pick),
    skills: value.skills.map(pick),
    certificates: value.certificates.map(pick),
    customSections: value.customSections.map(pick),
  });

  return JSON.stringify(sections(doc)) === JSON.stringify(sections(createSample(doc.meta.locale)));
}

function presentationMeta(meta: ResumeMeta): Partial<ResumeMeta> {  return {
    templateId: meta.templateId,
    paperSize: meta.paperSize,
    margin: meta.margin,
    locale: meta.locale,
    themeColor: meta.themeColor,
    dateFormat: meta.dateFormat,
    sectionTitles: JSON.parse(JSON.stringify(meta.sectionTitles)),
    sectionOrder: [...meta.sectionOrder],
    fontScale: meta.fontScale,
  };
}

export const useResumeStore = defineStore('resume', () => {
  /** 本地没有保存内容时，按落地页语言（其次浏览器语言）给出示例内容 */
  const initialLocale = resolveInitialLocale();
  const doc = ref<ResumeDoc>(createSample(initialLocale));
  const mode = ref<EditorMode>('form');
  const saveStatus = ref<SaveStatus>('idle');
  const savedAt = ref<string | null>(null);
  const pageCount = ref(1);
  const loaded = ref(false);
  /** 当前脱离状态下是否已向用户提示过“表单修改不生效”，每次进入脱离状态只提示一次 */
  const detachPrompted = ref(false);

  const composed = computed(() => composeResume(doc.value));
  const isDetached = computed(() => doc.value.meta.customHtml !== null);
  const cssWarnings = computed(() => composed.value.cssWarnings);

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  async function persist() {
    saveStatus.value = 'saving';
    try {
      const now = new Date().toISOString();
      const snapshot: ResumeDoc = JSON.parse(JSON.stringify(doc.value));
      snapshot.meta.updatedAt = now;
      await dbSet(STORAGE_KEY, snapshot);
      savedAt.value = now;
      saveStatus.value = 'saved';
    } catch (err) {
      saveStatus.value = 'error';
      reportIssue('storage-write', err);
    }
  }

  function scheduleSave() {
    if (!loaded.value) return;
    clearTimeout(saveTimer);
    saveStatus.value = 'saving';
    saveTimer = setTimeout(persist, SAVE_DELAY);
  }

  watch(doc, scheduleSave, { deep: true });

  /* ---------- 撤销 / 重做 ---------- */

  const past = ref<string[]>([]);
  const future = ref<string[]>([]);
  let lastSnapshot = JSON.stringify(doc.value);
  let historyTimer: ReturnType<typeof setTimeout> | undefined;

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  function snapshot(): string {
    return JSON.stringify(doc.value);
  }

  /** 把当前状态记入历史（与上一步相同则忽略） */
  function commitHistory() {
    const now = snapshot();
    if (now === lastSnapshot) return;
    past.value.push(lastSnapshot);
    if (past.value.length > HISTORY_LIMIT) past.value.shift();
    future.value = [];
    lastSnapshot = now;
  }

  function scheduleHistory() {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(commitHistory, HISTORY_DELAY);
  }

  watch(doc, scheduleHistory, { deep: true });

  function resetHistory() {
    clearTimeout(historyTimer);
    past.value = [];
    future.value = [];
    lastSnapshot = snapshot();
  }

  function undo() {
    clearTimeout(historyTimer);
    // 把还在合并中的改动先落定，保证撤销的是“上一处”而不是当前这次输入
    commitHistory();
    if (past.value.length === 0) return;
    future.value.push(snapshot());
    const previous = past.value.pop() as string;
    doc.value = JSON.parse(previous) as ResumeDoc;
    lastSnapshot = previous;
  }

  function redo() {
    clearTimeout(historyTimer);
    if (future.value.length === 0) return;
    past.value.push(snapshot());
    const next = future.value.pop() as string;
    doc.value = JSON.parse(next) as ResumeDoc;
    lastSnapshot = next;
  }

  /* ---------- 初始化与整体操作 ---------- */

  async function init() {
    try {
      const saved = await dbGet<unknown>(STORAGE_KEY);
      if (saved) {
        const result = validateResumeFile(saved);
        if (result.ok) {
          // 用户从未改动过内容（还是内置示例）时，按当前入口语言换成对应示例，
          // 避免「从英文站进来却看到中文示例」。改过内容则原样保留。
          if (result.doc.meta.locale !== initialLocale && isUntouchedSample(result.doc)) {
            const { locale: _ignored, ...presentation } = presentationMeta(result.doc.meta);
            const sample = createSample(initialLocale);
            sample.meta = { ...sample.meta, ...presentation };
            doc.value = sample;
          } else {
            doc.value = result.doc;
          }
        }
      }
    } catch (err) {
      /* 读取失败时使用示例数据 */
      reportIssue('storage-read', err);
    }
    loaded.value = true;
    saveStatus.value = 'idle';
    resetHistory();
  }

  function setTemplate(id: string) {
    doc.value.meta.templateId = id;
    doc.value.meta.customHtml = null;
  }

  function setLocale(locale: Locale) {
    doc.value.meta.locale = locale;
    if (!isDateFormatFor(doc.value.meta.dateFormat, locale)) {
      doc.value.meta.dateFormat = defaultDateFormat(locale);
    }
  }

  function setDateFormat(format: DateFormat) {
    doc.value.meta.dateFormat = format;
  }

  function setFontScale(scale: number) {
    doc.value.meta.fontScale = snapFontScale(scale);
  }

  function setThemeColor(color: string) {
    doc.value.meta.themeColor = color;
  }

  function setPaper(paper: PaperSize) {
    doc.value.meta.paperSize = paper;
  }

  function setMargin(margin: MarginPreset) {
    doc.value.meta.margin = margin;
  }

  function setProfileField(key: ProfileKey, value: string) {
    doc.value.profile[key] = value;
  }

  function setAvatar(dataUrl: string | null) {
    if (dataUrl) {
      doc.value.profile.avatar = dataUrl;
    } else {
      delete doc.value.profile.avatar;
    }
  }

  function setAvatarAlign(align: PhotoAlign) {
    doc.value.profile.avatarAlign = align;
  }

  function setSectionTitle(key: SectionTitleKey, value: string) {
    const locale = doc.value.meta.locale;
    const titles = { ...(doc.value.meta.sectionTitles[locale] ?? {}) };
    const text = value.trim();
    if (text) titles[key] = text;
    else delete titles[key];
    doc.value.meta.sectionTitles = { ...doc.value.meta.sectionTitles, [locale]: titles };
  }

  function moveSection(key: SectionKey, delta: -1 | 1) {
    const order = doc.value.meta.sectionOrder;
    const index = order.indexOf(key);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
  }

  function addItem(list: ListKey) {
    doc.value[list].push(createItem(list));
  }

  function removeItem(list: ListKey, id: string) {
    doc.value[list] = doc.value[list].filter((item) => item.id !== id);
  }

  function moveItem(list: ListKey, id: string, delta: -1 | 1) {
    const items = doc.value[list];
    const index = items.findIndex((item) => item.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
  }

  function setItemField(list: ListKey, id: string, key: string, value: string) {
    const item = doc.value[list].find((entry: ListItem) => entry.id === id);
    if (item) item[key] = value;
  }

  function setCustomCss(css: string) {
    doc.value.meta.customCss = css;
  }

  function setCustomHtml(html: string) {
    doc.value.meta.customHtml = html;
  }

  /** 进入代码模式时冻结当前 HTML，之后表单修改不再影响预览 */
  function detach() {
    if (doc.value.meta.customHtml === null) {
      doc.value.meta.customHtml = composed.value.editableHtml;
      detachPrompted.value = false;
    }
  }

  function markDetachPrompted() {
    detachPrompted.value = true;
  }

  function setMode(next: EditorMode) {
    if (next === 'code') detach();
    mode.value = next;
  }

  /** 重新从模板与表单数据生成 HTML，丢弃手动编辑 */
  function regenerateHtml() {
    doc.value.meta.customHtml = null;
    detachPrompted.value = false;
    mode.value = 'form';
  }

  function resetCss() {
    doc.value.meta.customCss = '';
  }

  function loadSample() {
    const sample = createSample(doc.value.meta.locale);
    sample.meta = { ...sample.meta, ...presentationMeta(doc.value.meta) };
    doc.value = sample;
    resetHistory();
  }

  function clearAll() {
    const empty = createEmptyDoc(doc.value.meta.locale, doc.value.meta.templateId);
    empty.meta = { ...empty.meta, ...presentationMeta(doc.value.meta) };
    doc.value = empty;
    resetHistory();
  }

  function replaceDoc(next: ResumeDoc) {
    doc.value = next;
    mode.value = 'form';
    resetHistory();
  }

  return {
    doc,
    mode,
    saveStatus,
    savedAt,
    pageCount,
    loaded,
    composed,
    isDetached,
    cssWarnings,
    canUndo,
    canRedo,
    init,
    setTemplate,
    setLocale,
    setDateFormat,
    setFontScale,
    setPaper,
    setThemeColor,
    setMargin,
    setProfileField,
    setAvatar,
    setAvatarAlign,
    setSectionTitle,
    moveSection,
    addItem,
    removeItem,
    moveItem,
    setItemField,
    setCustomCss,
    setCustomHtml,
    detach,
    setMode,
    detachPrompted,
    markDetachPrompted,
    regenerateHtml,
    resetCss,
    loadSample,
    clearAll,
    replaceDoc,
    undo,
    redo,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useResumeStore, import.meta.hot));
}
