import type { ListKey, ProfileKey, SectionKey } from '../types';

/** label 与 title 均为文案键，由 i18n 翻译 */
export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'tel' | 'email' | 'url' | 'date' | 'date-range';
}

/** 正文字号缩放：范围 0.8–1.2，步长 5%，保证下拉框始终能匹配到当前值 */
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.2;
export const FONT_SCALE_STEP = 0.05;
export const FONT_SCALE_OPTIONS = Array.from(
  { length: Math.round((FONT_SCALE_MAX - FONT_SCALE_MIN) / FONT_SCALE_STEP) + 1 },
  (_, index) => Math.round((FONT_SCALE_MIN + index * FONT_SCALE_STEP) * 100),
);

/** 把任意字号缩放夹到范围内并对齐到 5% 档位 */
export function snapFontScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value));
  const steps = Math.round((clamped - FONT_SCALE_MIN) / FONT_SCALE_STEP);
  return Math.round((FONT_SCALE_MIN + steps * FONT_SCALE_STEP) * 100) / 100;
}

export const PROFILE_FIELDS: { key: ProfileKey; label: string; type?: FieldDef['type'] }[] = [
  { key: 'name', label: 'field.name' },
  { key: 'title', label: 'field.jobTitle' },
  { key: 'phone', label: 'field.phone', type: 'tel' },
  { key: 'email', label: 'field.email', type: 'email' },
  { key: 'website', label: 'field.website', type: 'url' },
  { key: 'linkedin', label: 'field.linkedin', type: 'url' },
  { key: 'location', label: 'field.location' },
  { key: 'workAuth', label: 'field.workAuth' },
  { key: 'summary', label: 'field.summary', type: 'textarea' },
];

/**
 * date-range 字段在表单中渲染为「开始 / 结束 + 至今」三个控件，
 * 实际写入 item 的 periodStart / periodEnd / present 三个键；
 * 保留 period 键只为兼容旧数据的自由文本时间。
 */
export const LIST_SCHEMA: Record<ListKey, { title: string; fields: FieldDef[]; defaults: Record<string, string> }> = {
  education: {
    title: 'list.education',
    fields: [
      { key: 'school', label: 'field.school' },
      { key: 'major', label: 'field.major' },
      { key: 'degree', label: 'field.degree' },
      { key: 'period', label: 'field.period', type: 'date-range' },
      { key: 'description', label: 'field.eduDesc', type: 'textarea' },
    ],
    defaults: {
      school: '',
      major: '',
      degree: '',
      period: '',
      periodStart: '',
      periodEnd: '',
      present: '',
      description: '',
    },
  },
  experience: {
    title: 'list.experience',
    fields: [
      { key: 'company', label: 'field.company' },
      { key: 'role', label: 'field.role' },
      { key: 'period', label: 'field.period', type: 'date-range' },
      { key: 'location', label: 'field.workLocation' },
      { key: 'description', label: 'field.workDesc', type: 'textarea' },
    ],
    defaults: {
      company: '',
      role: '',
      period: '',
      periodStart: '',
      periodEnd: '',
      present: '',
      location: '',
      description: '',
    },
  },
  projects: {
    title: 'list.projects',
    fields: [
      { key: 'name', label: 'field.projectName' },
      { key: 'role', label: 'field.projectRole' },
      { key: 'period', label: 'field.period', type: 'date-range' },
      { key: 'link', label: 'field.projectLink', type: 'url' },
      { key: 'description', label: 'field.projectDesc', type: 'textarea' },
    ],
    defaults: {
      name: '',
      role: '',
      period: '',
      periodStart: '',
      periodEnd: '',
      present: '',
      link: '',
      description: '',
    },
  },
  skills: {
    title: 'list.skills',
    fields: [
      { key: 'category', label: 'field.skillCategory' },
      { key: 'items', label: 'field.skillItems', type: 'textarea' },
    ],
    defaults: { category: '', items: '' },
  },
  certificates: {
    title: 'list.certificates',
    fields: [
      { key: 'name', label: 'field.certName' },
      { key: 'issuer', label: 'field.certIssuer' },
      { key: 'date', label: 'field.certDate', type: 'date' },
    ],
    defaults: { name: '', issuer: '', date: '' },
  },
  customSections: {
    title: 'list.customSections',
    fields: [
      { key: 'title', label: 'field.sectionTitle' },
      { key: 'content', label: 'field.content', type: 'textarea' },
    ],
    defaults: { title: '', content: '' },
  },
};

/** 默认分区顺序，与模板中的书写顺序一致 */
export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'certificates',
  'customSections',
];

/** 可以自定义标题的分区（customSections 的标题写在每个条目里） */
export const SECTION_TITLE_KEYS = [
  'summary',
  'education',
  'experience',
  'projects',
  'skills',
  'certificates',
] as const;

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === 'string' && (DEFAULT_SECTION_ORDER as string[]).includes(value);
}

export function isSectionTitleKey(value: unknown): boolean {
  return typeof value === 'string' && (SECTION_TITLE_KEYS as readonly string[]).includes(value);
}
