<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useResumeStore } from '../stores/resume';
import { MARGIN, PAPER } from '../engine/document';
import { computePageMetrics, type FlowUnit } from '../engine/pagination';
import { checkup } from '../engine/checkup';
import { useI18n } from '../i18n';
import { showToast } from '../composables/useToast';

const emit = defineEmits<{ printClosed: [] }>();
const store = useResumeStore();
const { t } = useI18n();
const frame = ref<HTMLIFrameElement | null>(null);
const srcdoc = ref('');
const zoom = ref(100);
const frameHeight = ref(0);
/** 分页线位置（相对整张纸的顶边） */
const breakLines = ref<number[]>([]);
const splitCount = ref(0);
const showCheck = ref(false);
const fitting = ref(false);

const paper = computed(() => PAPER[store.doc.meta.paperSize]);
const pageHeightPx = computed(() => paper.value.heightPx);
/** 页边距（px），打印时由 @page 提供，因此每页都要扣掉上下边距 */
const marginPx = computed(() => {
  const mm = Number.parseFloat(MARGIN[store.doc.meta.margin]);
  return (mm * 96) / 25.4;
});
/** 每页真正能容纳的内容高度 */
const printableHeightPx = computed(() => pageHeightPx.value - marginPx.value * 2);

const issues = computed(() => checkup(store.doc, store.pageCount, splitCount.value));

let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => store.composed.srcdoc,
  (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      srcdoc.value = value;
    }, 200);
  },
  { immediate: true },
);

/**
 * 把页面内容拆成“流式单元”：
 * - 带 break-inside: avoid 的整块内容不可切断；
 * - 其余容器继续下钻，让其中的条目成为独立单元；
 * - 强制分页符（.page-break）标记在它后面的那个单元上。
 */
function collectUnits(root: HTMLElement, win: Window): FlowUnit[] {
  const style = win.getComputedStyle(root);
  const originTop = root.getBoundingClientRect().top + (Number.parseFloat(style.paddingTop) || 0);
  const units: FlowUnit[] = [];
  let pendingBreak = false;

  const walk = (el: Element) => {
    const cs = win.getComputedStyle(el);
    if (cs.display === 'none') return;
    if (cs.breakBefore === 'page' || cs.pageBreakBefore === 'always') {
      pendingBreak = true;
      return;
    }
    const avoidBreak = cs.breakInside === 'avoid' || cs.pageBreakInside === 'avoid';
    const children = Array.from(el.children);
    if (!avoidBreak && children.length > 0) {
      children.forEach(walk);
      return;
    }
    const rect = el.getBoundingClientRect();
    units.push({
      topPx: rect.top - originTop,
      bottomPx: rect.bottom - originTop,
      avoidBreak,
      forceBreakBefore: pendingBreak,
    });
    pendingBreak = false;
  };

  Array.from(root.children).forEach(walk);
  return units;
}

let pendingResolve: (() => void) | undefined;

function onLoad() {
  const doc = frame.value?.contentDocument;
  const page = doc?.querySelector('.resume-page') as HTMLElement | null;
  if (!doc || !page) return;

  const metrics = computePageMetrics(collectUnits(page, doc.defaultView!), printableHeightPx.value);
  store.pageCount = metrics.pageCount;
  splitCount.value = metrics.splitCount;
  breakLines.value = metrics.breakOffsetsPx.map((offset) => offset + marginPx.value);

  const contentHeight = Math.ceil(Math.max(doc.documentElement.scrollHeight, pageHeightPx.value));
  frameHeight.value = contentHeight;

  pendingResolve?.();
  pendingResolve = undefined;
}

/** 等下一次预览重新测量完成（最多 2 秒，避免卡住） */
function waitForLoad(): Promise<void> {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    setTimeout(() => {
      if (pendingResolve === resolve) {
        pendingResolve = undefined;
        resolve();
      }
    }, 2000);
  });
}

/** 逐次缩小字号，直到内容能放进一页 */
async function fitToOnePage() {
  if (fitting.value) return;
  fitting.value = true;
  try {
    if (store.doc.meta.fontScale < 1) {
      store.setFontScale(1);
      await waitForLoad();
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (store.pageCount <= 1) break;
      const content = Math.max(1, frameHeight.value - marginPx.value * 2);
      // 先按比例估算，再夹到允许的最小字号；若已经到下限且不再变化就停下
      const target = Math.max(0.8, store.doc.meta.fontScale * (printableHeightPx.value / content) * 0.99);
      if (target >= store.doc.meta.fontScale - 0.005) break;
      store.setFontScale(target);
      await waitForLoad();
    }
  } finally {
    fitting.value = false;
  }

  showToast(
    t('toast.fitted', {
      percent: Math.round(store.doc.meta.fontScale * 100),
      pages: store.pageCount,
    }),
  );
}

function changeZoom(delta: number) {
  zoom.value = Math.min(150, Math.max(50, zoom.value + delta));
}

/** 仅打印预览 iframe 中的简历内容，不包含编辑界面 */
function print() {
  const win = frame.value?.contentWindow;
  if (!win) return;
  win.addEventListener('afterprint', () => emit('printClosed'), { once: true });
  win.focus();
  win.print();
}

defineExpose({ print, fitToOnePage });

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="preview">
    <div class="preview-toolbar">
      <span class="meta">{{ t('preview.meta', { template: t(store.composed.templateName), paper: store.doc.meta.paperSize, pages: store.pageCount }) }}</span>
      <div class="zoom">
        <button
          class="check-toggle"
          :class="{ active: showCheck, warn: issues.length > 0 }"
          @click="showCheck = !showCheck"
        >
          {{ t('check.title') }}<template v-if="issues.length"> · {{ issues.length }}</template>
        </button>
        <button :disabled="fitting || store.pageCount <= 1" @click="fitToOnePage">{{ t('preview.fitOnePage') }}</button>
        <button :disabled="zoom <= 50" @click="changeZoom(-10)">−</button>
        <span>{{ zoom }}%</span>
        <button :disabled="zoom >= 150" @click="changeZoom(10)">+</button>
        <button @click="zoom = 100">{{ t('preview.reset') }}</button>
      </div>
    </div>

    <div v-if="showCheck" class="checkup">
      <p v-if="issues.length === 0" class="ok">{{ t('check.ok') }}</p>
      <ul v-else>
        <li v-for="issue in issues" :key="issue.key" :class="issue.level">
          {{ t(issue.key, issue.params) }}
        </li>
      </ul>
    </div>

    <div class="stage">
      <div class="paper-zoom" :style="{ zoom: zoom / 100 }">
        <div class="paper" :style="{ width: paper.widthPx + 'px', height: frameHeight + 'px' }">
          <iframe
            id="resume-frame"
            ref="frame"
            class="frame"
            :title="t('preview.title')"
            sandbox="allow-same-origin allow-modals"
            :srcdoc="srcdoc"
            :style="{ width: paper.widthPx + 'px', height: frameHeight + 'px' }"
            @load="onLoad"
          />
          <div
            v-for="(line, index) in breakLines"
            :key="line"
            class="page-line"
            :style="{ top: line + 'px' }"
          >
            <span>{{ t('preview.pageEnd', { n: index + 1, next: index + 2 }) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  font-size: 13px;
  color: #6e6e73;
}

.meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zoom {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.zoom button {
  min-width: 28px;
  padding: 3px 8px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}

.zoom button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.zoom .check-toggle.active {
  background: #1d1d1f;
  border-color: #1d1d1f;
  color: #fff;
}

.zoom .check-toggle.warn::after {
  content: '•';
  margin-left: 4px;
  color: #f59e0b;
}

.checkup {
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #d2d2d7;
  font-size: 13px;
}

.checkup .ok {
  margin: 0;
  color: #047857;
}

.checkup ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 2px;
}

.checkup li.warn {
  color: #b45309;
}

.checkup li.error {
  color: #b91c1c;
}

.stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #d2d2d7;
  border-radius: 8px;
  padding: 24px;
}

.paper-zoom {
  margin: 0 auto;
  width: max-content;
}

.paper {
  position: relative;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.frame {
  display: block;
  border: 0;
  background: #fff;
}

.page-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed #f87171;
  pointer-events: none;
}

.page-line span {
  position: absolute;
  right: 4px;
  top: -18px;
  font-size: 11px;
  color: #d70015;
  background: rgba(255, 255, 255, 0.85);
  padding: 0 4px;
  border-radius: 3px;
}
</style>
