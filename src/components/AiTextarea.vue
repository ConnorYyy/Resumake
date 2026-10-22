<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from '../i18n';
import { AI_MAX_INPUT, rewriteText, type AiErrorCode } from '../services/aiRewrite';
import { useAiAvailability } from '../composables/useAiAvailability';
import { useResumeStore } from '../stores/resume';

const props = defineProps<{
  modelValue: string;
  rows?: number;
  /** 传给模型的上下文提示，例如 summary / description / items */
  field?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const store = useResumeStore();
const { t } = useI18n();

const { aiAvailable } = useAiAvailability();
/** 技能清单是逗号分隔的列表，改写没有意义，直接不显示按钮 */
const showAi = computed(() => aiAvailable.value && props.field !== 'items');
const busy = ref(false);
const asking = ref(false);
const suggestion = ref<string | null>(null);
const error = ref<AiErrorCode | null>(null);

const trimmed = computed(() => props.modelValue.trim());
const canRun = computed(() => trimmed.value.length >= 12 && trimmed.value.length <= AI_MAX_INPUT);

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

function readConsent(): boolean {
  try {
    return localStorage.getItem('resumake.ai-consent') === '1';
  } catch {
    return false;
  }
}

function ask() {
  error.value = null;
  suggestion.value = null;

  if (trimmed.value.length < 12) {
    error.value = 'too_short';
    return;
  }
  if (trimmed.value.length > AI_MAX_INPUT) {
    error.value = 'too_long';
    return;
  }

  // 首次使用先说明「这段文字会发出去」，同意一次后不再打扰
  if (!readConsent()) {
    asking.value = true;
    return;
  }

  void run();
}

function grantConsent() {
  try {
    localStorage.setItem('resumake.ai-consent', '1');
  } catch {
    /* 存不了就每次都问，不影响功能 */
  }
  asking.value = false;
  void run();
}

async function run() {
  busy.value = true;
  error.value = null;

  const result = await rewriteText({
    text: trimmed.value,
    locale: store.doc.meta.locale,
    field: props.field,
  });

  busy.value = false;

  if (result.ok && result.text) {
    suggestion.value = result.text;
  } else {
    error.value = result.error ?? 'network';
  }
}

function apply() {
  if (suggestion.value) emit('update:modelValue', suggestion.value);
  suggestion.value = null;
}

function discard() {
  suggestion.value = null;
}

function messageFor(code: AiErrorCode): string {
  switch (code) {
    case 'too_short':
      return t('ai.err.tooShort');
    case 'too_long':
      return t('ai.err.tooLong');
    case 'no_change':
      return t('ai.err.noChange');
    case 'rate_limited':
    case 'upstream_busy':
      return t('ai.err.busy');
    case 'not_configured':
      return t('ai.err.notConfigured');
    case 'timeout':
      return t('ai.err.timeout');
    case 'empty_output':
      return t('ai.err.empty');
    case 'network':
      return t('ai.err.network');
    default:
      return t('ai.err.generic');
  }
}
</script>

<template>
  <div class="ai-field" :class="{ 'no-ai': !showAi }">
    <textarea :value="modelValue" :rows="rows ?? 4" @input="onInput" />

    <button
      v-if="showAi"
      type="button"
      class="ai-trigger"
      :disabled="busy"
      :aria-busy="busy ? 'true' : undefined"
      :title="busy ? t('ai.working') : t('ai.button')"
      :aria-label="t('ai.button')"
      @click.prevent.stop="ask"
    >
      <span v-if="busy" class="ai-spin" aria-hidden="true" />
      <svg v-else class="ai-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M8 1.4l1.5 4.4 4.4 1.5-4.4 1.5L8 13.2 6.5 8.8 2.1 7.3l4.4-1.5z" fill="currentColor" />
      </svg>
      <span>{{ t('ai.short') }}</span>
    </button>

    <div v-if="asking" class="ai-panel ai-consent">
      <p>{{ t('ai.consentBody') }}</p>
      <div class="ai-actions">
        <button type="button" class="ai-primary" @click.prevent.stop="grantConsent">{{ t('ai.consentOk') }}</button>
        <button type="button" @click.prevent.stop="asking = false">{{ t('ai.cancel') }}</button>
      </div>
    </div>

    <p v-if="error" class="ai-note ai-error">{{ messageFor(error) }}</p>

    <div v-if="suggestion" class="ai-panel ai-suggest">
      <div class="ai-suggest-head">{{ t('ai.suggestion') }}</div>
      <p class="ai-suggest-text">{{ suggestion }}</p>
      <div class="ai-actions">
        <button type="button" class="ai-primary" @click.prevent.stop="apply">{{ t('ai.apply') }}</button>
        <button type="button" @click.prevent.stop="discard">{{ t('ai.discard') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-field {
  position: relative;
  display: block;
  box-sizing: border-box;
}

.ai-field textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  /* 给右下角的按钮留出空间，避免文字被压住 */
  padding-bottom: 34px;
  resize: none;
}

/* 没有 AI 按钮的字段恢复原始内边距 */
.ai-field.no-ai textarea {
  padding-bottom: 6px;
}

.ai-trigger {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 10px 0 8px;
  border: 1px solid rgba(0, 113, 227, 0.28);
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff 0%, #eef6ff 100%);
  color: #0071e3;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
}

.ai-trigger:hover:not(:disabled) {
  background: linear-gradient(180deg, #ffffff 0%, #e2f0ff 100%);
  box-shadow: 0 2px 7px rgba(0, 113, 227, 0.18);
}

.ai-trigger:active:not(:disabled) {
  transform: scale(0.97);
}

.ai-trigger:disabled {
  color: #8e8e93;
  border-color: #d8d8dd;
  background: #f5f5f7;
  box-shadow: none;
  cursor: default;
}

.ai-icon {
  display: block;
  flex: none;
}

.ai-spin {
  width: 10px;
  height: 10px;
  border: 2px solid #c7d7ea;
  border-top-color: #0071e3;
  border-radius: 50%;
  animation: ai-spin 0.7s linear infinite;
}

@keyframes ai-spin {
  to {
    transform: rotate(360deg);
  }
}

.ai-panel {
  margin-top: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  background: #fafafc;
  font-size: 13px;
  line-height: 1.5;
}

.ai-consent p {
  margin: 0;
  color: #3a3a3c;
}

.ai-suggest {
  border-color: #99c7fb;
  background: #f5faff;
}

.ai-suggest-head {
  font-weight: 600;
  color: #0071e3;
  font-size: 12px;
  margin-bottom: 4px;
}

.ai-suggest-text {
  margin: 0;
  white-space: pre-wrap;
  color: #1d1d1f;
}

.ai-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.ai-actions button {
  padding: 4px 12px;
  border: 1px solid #d2d2d7;
  border-radius: 999px;
  background: #fff;
  color: #1d1d1f;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.ai-actions .ai-primary {
  border-color: #0071e3;
  background: #0071e3;
  color: #fff;
}

.ai-note {
  margin: 6px 0 0;
  font-size: 12px;
}

.ai-error {
  color: #d70015;
}
</style>
