<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';

const props = defineProps<{ modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const { t } = useI18n();

const currentYear = new Date().getFullYear();
const latestYear = currentYear + 3;
const earliestYear = Math.min(1950, currentYear - 60);
const years = Array.from({ length: latestYear - earliestYear + 1 }, (_, i) => latestYear - i);
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

const parts = computed(() => {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(props.modelValue ?? '');
  return { year: match?.[1] ?? '', month: match?.[2] ?? '' };
});

function change(year: string, month: string) {
  if (!year) {
    emit('update:modelValue', '');
    return;
  }
  emit('update:modelValue', month ? `${year}-${month}` : year);
}

function onYear(event: Event) {
  change((event.target as HTMLSelectElement).value, parts.value.month);
}

function onMonth(event: Event) {
  const month = (event.target as HTMLSelectElement).value;
  if (!parts.value.year) return;
  change(parts.value.year, month);
}
</script>

<template>
  <span class="date-field">
    <select class="year" :value="parts.year" :disabled="disabled" :aria-label="t('date.yearLabel')" @change="onYear">
      <option value="">{{ t('date.yearPlaceholder') }}</option>
      <option v-for="year in years" :key="year" :value="String(year)">{{ year }}</option>
    </select>
    <select
      class="month"
      :value="parts.month"
      :disabled="disabled || !parts.year"
      :aria-label="t('date.monthLabel')"
      @change="onMonth"
    >
      <option value="">{{ t('date.monthPlaceholder') }}</option>
      <option v-for="month in months" :key="month" :value="month">{{ month }}</option>
    </select>
  </span>
</template>

<style scoped>
.date-field {
  display: inline-flex;
  gap: 4px;
}

select {
  font: inherit;
  padding: 6px 6px;
  border: 1px solid #d2d2d7;
  border-radius: 6px;
  background: #fff;
}

select:disabled {
  background: #f5f5f7;
  color: #86868b;
}

.year {
  width: 82px;
}

.month {
  width: 62px;
}
</style>
