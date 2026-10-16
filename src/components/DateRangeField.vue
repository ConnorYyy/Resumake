<script setup lang="ts">
import DateField from './DateField.vue';
import { useI18n } from '../i18n';

defineProps<{ start: string; end: string; present: boolean }>();
const emit = defineEmits<{
  'update:start': [value: string];
  'update:end': [value: string];
  'update:present': [value: boolean];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="date-range">
    <DateField :model-value="start" @update:model-value="emit('update:start', $event)" />
    <span class="dash">–</span>
    <DateField :model-value="end" :disabled="present" @update:model-value="emit('update:end', $event)" />
    <label class="present">
      <input
        type="checkbox"
        :checked="present"
        @change="emit('update:present', ($event.target as HTMLInputElement).checked)"
      />
      {{ t('form.present') }}
    </label>
  </div>
</template>

<style scoped>
.date-range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.dash {
  color: #86868b;
}

.present {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #424245;
  cursor: pointer;
}
</style>
