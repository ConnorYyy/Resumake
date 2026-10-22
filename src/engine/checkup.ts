import { isBlankItem } from './context';
import type { ListKey, ResumeDoc } from '../types';

export interface CheckupIssue {
  /** i18n 文案键 */
  key: string;
  params?: Record<string, string | number>;
  level: 'warn' | 'error';
}

const LIST_KEYS: ListKey[] = ['education', 'experience', 'projects', 'skills', 'certificates', 'customSections'];

/** 这三类条目带起止时间 */
const PERIOD_KEYS: ListKey[] = ['education', 'experience', 'projects'];

/** 单行超过这个长度，排版上会显得拥挤 */
const LONG_LINE = 140;

/** 把 "2020" / "2020-07" 换算成月序号，便于比较先后 */
function monthIndex(value: string): number | null {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 12 + (match[2] ? Number(match[2]) - 1 : 0);
}

export function checkup(doc: ResumeDoc, pageCount: number, splitCount: number): CheckupIssue[] {
  const issues: CheckupIssue[] = [];
  const { profile } = doc;

  if (!profile.name.trim()) {
    issues.push({ key: 'check.noName', level: 'error' });
  }
  if (!profile.email.trim() && !profile.phone.trim()) {
    issues.push({ key: 'check.noContact', level: 'error' });
  }
  if (pageCount > 1) {
    issues.push({ key: 'check.multiPage', params: { n: pageCount }, level: 'warn' });
  }
  if (splitCount > 0) {
    issues.push({ key: 'check.split', params: { n: splitCount }, level: 'warn' });
  }

  const blank = LIST_KEYS.reduce((count, key) => count + doc[key].filter(isBlankItem).length, 0);
  if (blank > 0) {
    issues.push({ key: 'check.blankItems', params: { n: blank }, level: 'warn' });
  }

  /* ---------- 日期 ---------- */

  let reversed = 0;
  let missingPeriod = 0;

  for (const key of PERIOD_KEYS) {
    for (const item of doc[key]) {
      if (isBlankItem(item)) continue;

      const start = (item.periodStart ?? '').trim();
      const end = (item.periodEnd ?? '').trim();
      const present = item.present === '1';

      // 有内容却没有起始时间
      if (!start && !present) missingPeriod += 1;

      // 结束早于开始
      const from = monthIndex(start);
      const to = monthIndex(end);
      if (!present && from !== null && to !== null && to < from) reversed += 1;
    }
  }

  if (reversed > 0) {
    issues.push({ key: 'check.reversedDate', params: { n: reversed }, level: 'error' });
  }
  if (missingPeriod > 0) {
    issues.push({ key: 'check.missingPeriod', params: { n: missingPeriod }, level: 'warn' });
  }

  /* ---------- 过长的单行 ---------- */

  const blocks = [
    profile.summary,
    ...doc.experience.map((item) => item.description),
    ...doc.projects.map((item) => item.description),
    ...doc.education.map((item) => item.description),
    ...doc.customSections.map((item) => item.content),
  ];

  let longLines = 0;
  for (const block of blocks) {
    for (const line of (block ?? '').split(/\r?\n/)) {
      if (line.trim().length > LONG_LINE) longLines += 1;
    }
  }
  if (longLines > 0) {
    issues.push({ key: 'check.longLine', params: { n: longLines }, level: 'warn' });
  }

  return issues;
}
