<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useResumeStore } from '../stores/resume';
import { parseColor } from '../engine/color';
import { useI18n } from '../i18n';

const PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'theme.default' },
  { value: '#1e3a5f', label: 'theme.navy' },
  { value: '#0f766e', label: 'theme.green' },
  { value: '#9f1239', label: 'theme.wine' },
  { value: '#c2410c', label: 'theme.orange' },
  { value: '#111827', label: 'theme.graphite' },
];

const store = useResumeStore();
const { t } = useI18n();
const root = ref<HTMLElement>();
const menuOpen = ref(false);
const dialogOpen = ref(false);
/** 取色器的值（始终为 #rrggbb） */
const picked = ref('#0f766e');
/** 数字输入框内容，例如 15, 118, 110 */
const numbers = ref('');
const error = ref('');

const current = computed(() => store.doc.meta.themeColor);
const currentLabel = computed(() => {
  if (!current.value) return t('theme.default');
  const preset = PRESETS.find((p) => p.value === current.value);
  return preset ? t(preset.label) : t('theme.customTitle');
});

function swatchStyle(color: string) {
  return color ? { background: color } : {};
}

function pick(value: string) {
  store.setThemeColor(value);
  menuOpen.value = false;
}

function openCustom() {
  menuOpen.value = false;
  picked.value = current.value || '#0f766e';
  numbers.value = '';
  error.value = '';
  dialogOpen.value = true;
}

/** 取色器变化时同步数字输入框 */
watch(picked, (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  numbers.value = `${r}, ${g}, ${b}`;
  error.value = '';
});

/** 数字输入变化时同步取色器 */
function onNumbersInput() {
  const hex = parseColor(numbers.value);
  if (hex) {
    picked.value = hex;
    error.value = '';
  } else {
    error.value = t('theme.invalidFormat');
  }
}

function confirmCustom() {
  const hex = parseColor(numbers.value) ?? picked.value;
  store.setThemeColor(hex);
  dialogOpen.value = false;
}

function onDocumentMouseDown(event: MouseEvent) {
  if (menuOpen.value && root.value && !root.value.contains(event.target as Node)) {
    menuOpen.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  menuOpen.value = false;
  dialogOpen.value = false;
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="theme-picker">
    <button class="trigger" type="button" @click="menuOpen = !menuOpen">
      <span class="swatch" :class="{ empty: !current }" :style="swatchStyle(current)" />
      <span>{{ currentLabel }}</span>
      <span class="caret">▾</span>
    </button>

    <ul v-if="menuOpen" class="menu">
      <li
        v-for="p in PRESETS"
        :key="p.value"
        :class="{ active: p.value === current }"
        @click="pick(p.value)"
      >
        <span class="swatch" :class="{ empty: !p.value }" :style="swatchStyle(p.value)" />
        <span>{{ t(p.label) }}</span>
      </li>
      <li class="custom" @click="openCustom">
        <span class="swatch custom-icon">+</span>
        <span>{{ t('theme.custom') }}</span>
      </li>
    </ul>

    <Teleport to="body">
    <div v-if="dialogOpen" class="mask" @click.self="dialogOpen = false">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="theme-title">
        <h2 id="theme-title">{{ t('theme.customTitle') }}</h2>
        <div class="picker-row">
          <input v-model="picked" type="color" class="color-input" aria-label="color" autofocus />
          <span class="swatch big" :style="swatchStyle(picked)" />
        </div>
        <label class="numbers">
          <span>{{ t('theme.tip') }}</span>
          <input v-model="numbers" placeholder="15, 118, 110" @input="onNumbersInput" @keydown.enter="confirmCustom" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="actions">
          <button type="button" @click="dialogOpen = false">{{ t('theme.cancel') }}</button>
          <button type="button" class="primary" @click="confirmCustom">{{ t('theme.confirm') }}</button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.theme-picker {
  position: relative;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.caret {
  color: #6e6e73;
  font-size: 11px;
}

.swatch {
  display: inline-block;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: 1px solid #d2d2d7;
  border-radius: 4px;
}

.swatch.empty {
  background: repeating-linear-gradient(45deg, #ffffff 0 4px, #e5e7eb 4px 8px);
}

.menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 190px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.menu li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.menu li:hover {
  background: #f5f5f7;
}

.menu li.active {
  background: #e8f1fb;
  color: #0066cc;
}

.menu li.custom {
  border-top: 1px solid #f3f4f6;
  margin-top: 4px;
  border-radius: 0 0 6px 6px;
}

.custom-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
  color: #6e6e73;
  font-weight: 700;
  line-height: 1;
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
}

.dialog {
  width: min(400px, 92vw);
  padding: 20px 22px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.dialog h2 {
  margin: 0 0 14px;
  font-size: 17px;
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input {
  width: 64px;
  height: 44px;
  padding: 0;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.swatch.big {
  width: 44px;
  height: 44px;
  border-radius: 10px;
}

.numbers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
  font-size: 13px;
  color: #6e6e73;
}

.numbers input {
  padding: 8px 10px;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  font: inherit;
  color: #1d1d1f;
}

.numbers input:focus {
  outline: 2px solid rgba(0, 113, 227, 0.35);
  border-color: #0071e3;
}

.error {
  margin: 8px 0 0;
  color: #d70015;
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.actions button {
  padding: 6px 14px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 980px;
  cursor: pointer;
}

.actions .primary {
  background: #0071e3;
  border-color: #0071e3;
  color: #fff;
}
</style>
