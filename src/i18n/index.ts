import { useResumeStore } from '../stores/resume';
import { translate } from './translate';

/** 界面语言跟随简历语言（工具栏“语言”选项） */
export function useI18n() {
  const store = useResumeStore();
  return {
    t: (key: string, params?: Record<string, string | number>) => translate(store.doc.meta.locale, key, params),
  };
}

export { translate };
export { detectLocale } from './locale';
