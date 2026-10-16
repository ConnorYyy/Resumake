import { isBlankItem } from './context';
import type { ListKey, ResumeDoc } from '../types';

export interface CheckupIssue {
  /** i18n 文案键 */
  key: string;
  params?: Record<string, string | number>;
  level: 'warn' | 'error';
}

const LIST_KEYS: ListKey[] = ['education', 'experience', 'projects', 'skills', 'certificates', 'customSections'];

/** 导出前的“格式体检”：把容易踩坑的问题一次列清楚 */
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

  return issues;
}
