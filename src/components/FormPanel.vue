<script setup lang="ts">
import { computed, ref } from 'vue';
import { useResumeStore } from '../stores/resume';
import { LIST_SCHEMA, PROFILE_FIELDS } from '../data/schema';
import { isValidEmail, isValidPhone, isValidUrl } from '../engine/validate';
import { fileToAvatar } from '../services/image';
import { useI18n } from '../i18n';
import DateField from './DateField.vue';
import DateRangeField from './DateRangeField.vue';
import AiTextarea from './AiTextarea.vue';
import type { ListItem, ListKey, PhotoAlign, ProfileKey, SectionKey, SectionTitleKey } from '../types';

const store = useResumeStore();
const { t } = useI18n();
const photoError = ref('');

const basicFields = PROFILE_FIELDS.filter((field) => field.key !== 'summary');

interface SectionCard {
  key: SectionKey;
  listKey: ListKey;
  isList: boolean;
  editableTitle: boolean;
  titleKey: SectionTitleKey | null;
  defaultTitle: string;
  items: ListItem[];
}

const cards = computed<SectionCard[]>(() =>
  store.doc.meta.sectionOrder.map((key) => {
    const isList = key !== 'summary';
    const listKey = (isList ? key : 'customSections') as ListKey;
    return {
      key,
      listKey,
      isList,
      editableTitle: key !== 'customSections',
      titleKey: key === 'customSections' ? null : (key as SectionTitleKey),
      defaultTitle: isList ? t(LIST_SCHEMA[listKey].title) : t('list.summary'),
      items: isList ? store.doc[listKey] : [],
    };
  }),
);

function titleValue(key: SectionTitleKey | null): string {
  if (!key) return '';
  return store.doc.meta.sectionTitles[store.doc.meta.locale]?.[key] ?? '';
}

function onSectionTitle(key: SectionTitleKey | null, event: Event) {
  if (!key) return;
  store.setSectionTitle(key, (event.target as HTMLInputElement).value);
}

function resetSectionTitle(key: SectionTitleKey | null) {
  if (!key) return;
  store.setSectionTitle(key, '');
}

function onDatePart(list: ListKey, id: string, key: string, value: string) {
  store.setItemField(list, id, key, value);
}

async function onPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    photoError.value = '';
    store.setAvatar(await fileToAvatar(file, t));
  } catch (err) {
    photoError.value = err instanceof Error ? err.message : t('photo.failed');
  }
}

function removePhoto() {
  store.setAvatar(null);
}

const ALIGN_OPTIONS: { value: PhotoAlign; label: string }[] = [
  { value: 'left', label: 'form.alignLeft' },
  { value: 'center', label: 'form.alignCenter' },
  { value: 'right', label: 'form.alignRight' },
];

const currentAlign = computed(() => store.doc.profile.avatarAlign ?? 'left');

const profileErrors = computed(() => {
  const p = store.doc.profile;
  const errors: Partial<Record<ProfileKey, string>> = {};
  if (p.email && !isValidEmail(p.email)) errors.email = t('field.error.email');
  if (p.phone && !isValidPhone(p.phone)) errors.phone = t('field.error.phone');
  if (p.website && !isValidUrl(p.website)) errors.website = t('field.error.url');
  if (p.linkedin && !isValidUrl(p.linkedin)) errors.linkedin = t('field.error.url');
  return errors;
});

function fieldError(type: string | undefined, value: string): string {
  if (!value) return '';
  if (type === 'email' && !isValidEmail(value)) return t('field.error.email');
  if (type === 'tel' && !isValidPhone(value)) return t('field.error.phone');
  if (type === 'url' && !isValidUrl(value)) return t('field.error.url');
  return '';
}

function onProfile(key: ProfileKey, event: Event) {
  store.setProfileField(key, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function onItem(list: ListKey, id: string, key: string, event: Event) {
  store.setItemField(list, id, key, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
}

const detachDialog = ref(false);

/** 脱离状态下，用户第一次修改表单时提示：修改不会更新预览，询问是否重新生成 */
function checkDetached(event: Event) {
  if (!store.isDetached || store.detachPrompted) return;
  if (event.type === 'click' && !(event.target as HTMLElement).closest('button')) return;
  detachDialog.value = true;
}

function keepManualHtml() {
  store.markDetachPrompted();
  detachDialog.value = false;
}

function regenerateFromForm() {
  detachDialog.value = false;
  store.regenerateHtml();
}

function removeItem(list: ListKey, id: string) {
  if (confirm(t('form.confirmDelete'))) store.removeItem(list, id);
}
</script>

<template>
  <div class="form-panel" @input="checkDetached" @change="checkDetached" @click="checkDetached">
    <p v-if="store.isDetached" class="notice">
      {{ t('form.detached') }}
    </p>

    <section class="card">
      <h3>{{ t('form.basicInfo') }}</h3>
      <div class="photo-row">
        <img v-if="store.doc.profile.avatar" class="photo-preview" :src="store.doc.profile.avatar" :alt="t('form.photoPreviewAlt')" />
        <div v-else class="photo-placeholder">{{ t('form.noPhoto') }}</div>
        <div class="photo-actions">
          <label class="upload">
            {{ store.doc.profile.avatar ? t('form.changePhoto') : t('form.uploadPhoto') }}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onPhoto" />
          </label>
          <div v-if="store.doc.profile.avatar" class="align">
            <span>{{ t('form.photoAlign') }}</span>
            <div class="align-group">
              <button
                v-for="opt in ALIGN_OPTIONS"
                :key="opt.value"
                :class="{ active: currentAlign === opt.value }"
                @click="store.setAvatarAlign(opt.value)"
              >
                {{ t(opt.label) }}
              </button>
            </div>
          </div>
          <button v-if="store.doc.profile.avatar" class="link" @click="removePhoto">{{ t('form.removePhoto') }}</button>
          <small class="hint">{{ t('form.photoHint') }}</small>
          <small v-if="photoError" class="error">{{ photoError }}</small>
        </div>
      </div>
      <div class="grid">
        <label v-for="field in basicFields" :key="field.key" :class="{ wide: field.type === 'textarea' }">
          <span>{{ t(field.label) }}</span>
          <AiTextarea
            v-if="field.type === 'textarea'"
            :model-value="store.doc.profile[field.key] ?? ''"
            :field="field.key"
            :rows="4"
            @update:model-value="store.setProfileField(field.key, $event)"
          />
          <input
            v-else
            :type="field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'"
            :value="store.doc.profile[field.key]"
            @input="onProfile(field.key, $event)"
          />
          <small v-if="profileErrors[field.key]" class="error">{{ profileErrors[field.key] }}</small>
        </label>
      </div>
    </section>

    <section v-for="(card, cardIndex) in cards" :key="card.key" class="card">
      <div class="card-head">
        <div class="title-edit">
          <input
            v-if="card.editableTitle"
            class="section-title"
            :value="titleValue(card.titleKey)"
            :placeholder="card.defaultTitle"
            :aria-label="t('form.sectionName')"
            @input="onSectionTitle(card.titleKey, $event)"
          />
          <h3 v-else>{{ card.defaultTitle }}</h3>
          <button
            v-if="card.editableTitle && titleValue(card.titleKey)"
            class="icon"
            :title="t('form.resetSectionName')"
            :aria-label="t('form.resetSectionName')"
            @click="resetSectionTitle(card.titleKey)"
          >
            ↺
          </button>
        </div>
        <div class="card-tools">
          <button
            class="icon"
            :disabled="cardIndex === 0"
            :title="t('form.moveSectionUp')"
            :aria-label="t('form.moveSectionUp')"
            @click="store.moveSection(card.key, -1)"
          >
            ↑
          </button>
          <button
            class="icon"
            :disabled="cardIndex === cards.length - 1"
            :title="t('form.moveSectionDown')"
            :aria-label="t('form.moveSectionDown')"
            @click="store.moveSection(card.key, 1)"
          >
            ↓
          </button>
          <button v-if="card.isList" class="add" @click="store.addItem(card.listKey)">{{ t('form.add') }}</button>
        </div>
      </div>

      <template v-if="!card.isList">
        <label class="wide">
          <span>{{ t('field.summary') }}</span>
          <AiTextarea
            :model-value="store.doc.profile.summary"
            field="summary"
            :rows="4"
            @update:model-value="store.setProfileField('summary', $event)"
          />
        </label>
      </template>

      <template v-else>
        <p v-if="card.items.length === 0" class="empty">{{ t('form.empty') }}</p>

        <div v-for="(item, index) in card.items" :key="item.id" class="item">
          <div class="item-head">
            <span>{{ t('form.itemIndex', { n: index + 1 }) }}</span>
            <div class="item-actions">
              <button
                :disabled="index === 0"
                :title="t('form.moveUp')"
                :aria-label="t('form.moveUp')"
                @click="store.moveItem(card.listKey, item.id, -1)"
              >
                ↑
              </button>
              <button
                :disabled="index === card.items.length - 1"
                :title="t('form.moveDown')"
                :aria-label="t('form.moveDown')"
                @click="store.moveItem(card.listKey, item.id, 1)"
              >
                ↓
              </button>
              <button
                class="danger"
                :title="t('form.delete')"
                :aria-label="t('form.delete')"
                @click="removeItem(card.listKey, item.id)"
              >
                {{ t('form.delete') }}
              </button>
            </div>
          </div>
          <div class="grid">
            <label
              v-for="field in LIST_SCHEMA[card.listKey].fields"
              :key="field.key"
              :class="{ wide: field.type === 'textarea' || field.type === 'date-range' }"
            >
              <span>{{ t(field.label) }}</span>
              <DateRangeField
                v-if="field.type === 'date-range'"
                :start="item.periodStart ?? ''"
                :end="item.periodEnd ?? ''"
                :present="item.present === '1'"
                @update:start="onDatePart(card.listKey, item.id, 'periodStart', $event)"
                @update:end="onDatePart(card.listKey, item.id, 'periodEnd', $event)"
                @update:present="onDatePart(card.listKey, item.id, 'present', $event ? '1' : '')"
              />
              <DateField
                v-else-if="field.type === 'date'"
                :model-value="item[field.key] ?? ''"
                @update:model-value="onDatePart(card.listKey, item.id, field.key, $event)"
              />
              <AiTextarea
                v-else-if="field.type === 'textarea'"
                :model-value="item[field.key] ?? ''"
                :field="field.key"
                :rows="3"
                @update:model-value="store.setItemField(card.listKey, item.id, field.key, $event)"
              />
              <input
                v-else
                :type="field.type === 'url' ? 'url' : 'text'"
                :value="item[field.key]"
                @input="onItem(card.listKey, item.id, field.key, $event)"
              />
              <small v-if="fieldError(field.type, item[field.key])" class="error">
                {{ fieldError(field.type, item[field.key]) }}
              </small>
            </label>
          </div>
        </div>
      </template>
    </section>

    <div v-if="detachDialog" class="modal-mask" @click.self="keepManualHtml">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="detach-title">
        <h2 id="detach-title">{{ t('form.detachTitle') }}</h2>
        <p>{{ t('form.detachBody') }}</p>
        <div class="modal-actions">
          <button class="ghost" @click="keepManualHtml">{{ t('form.detachKeep') }}</button>
          <button class="primary" @click="regenerateFromForm">{{ t('form.detachRegenerate') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-panel {
  height: 100%;
  overflow-y: auto;
  padding-right: 6px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
}

.modal {
  width: min(460px, 92vw);
  background: #fff;
  border-radius: 14px;
  padding: 22px 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.modal p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #424245;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.modal-actions button {
  padding: 6px 14px;
  border-radius: 980px;
  border: 1px solid #d2d2d7;
  background: #fff;
  cursor: pointer;
}

.modal-actions .primary {
  background: #0071e3;
  border-color: #0071e3;
  color: #fff;
}

.notice {
  margin: 0 0 10px;
  padding: 8px 10px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 6px;
  font-size: 13px;
}

.card {
  background: #fff;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.card h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.card-head h3 {
  margin: 0;
}

.title-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.section-title {
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  width: 100%;
  min-width: 0;
}

.section-title:hover {
  border-color: #d2d2d7;
}

.section-title:focus {
  border-color: #0071e3;
  outline: 2px solid #99c7fb;
  background: #fff;
}

.card-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.icon {
  padding: 3px 8px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  line-height: 1.2;
}

.icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.photo-row {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.photo-preview,
.photo-placeholder {
  width: 78px;
  height: 104px;
  flex-shrink: 0;
  object-fit: cover;
  border: 1px solid #d2d2d7;
  border-radius: 6px;
  background: #f9fafb;
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86868b;
  font-size: 12px;
}

.photo-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.upload {
  padding: 5px 12px;
  border: 1px solid #0071e3;
  background: #e8f1fb;
  color: #0066cc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.align {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #424245;
}

.align-group {
  display: flex;
  gap: 4px;
}

.align-group button {
  padding: 3px 10px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.align-group button.active {
  background: #0071e3;
  border-color: #0071e3;
  color: #fff;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: #d70015;
  cursor: pointer;
  font-size: 13px;
}

.hint {
  color: #6e6e73;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #424245;
}

label.wide {
  grid-column: 1 / -1;
}

input,
textarea {
  font: inherit;
  padding: 6px 8px;
  border: 1px solid #d2d2d7;
  border-radius: 6px;
  resize: vertical;
}

input:focus,
textarea:focus {
  outline: 2px solid #99c7fb;
  border-color: #0071e3;
}

.error {
  color: #d70015;
  font-size: 12px;
}

.empty {
  margin: 4px 0 0;
  color: #86868b;
  font-size: 13px;
}

.add {
  padding: 4px 10px;
  border: 1px solid #0071e3;
  background: #e8f1fb;
  color: #0066cc;
  border-radius: 6px;
  cursor: pointer;
}

.item {
  border: 1px dashed #d2d2d7;
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 8px;
}

.item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
  color: #6e6e73;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.item-actions button {
  padding: 2px 8px;
  border: 1px solid #d2d2d7;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}

.item-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.item-actions .danger {
  color: #d70015;
  border-color: #fecaca;
}

@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
