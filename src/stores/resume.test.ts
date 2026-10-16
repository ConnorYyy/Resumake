import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useResumeStore } from './resume';

function stubBrowserLanguages(languages: string[]) {
  vi.stubGlobal('navigator', { languages, language: languages[0] });
}

afterEach(() => vi.unstubAllGlobals());

describe('首次访问的默认内容', () => {
  it('英文浏览器得到英文示例与 Letter', () => {
    stubBrowserLanguages(['en-US', 'en']);
    setActivePinia(createPinia());
    const store = useResumeStore();
    expect(store.doc.meta.locale).toBe('en-US');
    expect(store.doc.meta.paperSize).toBe('Letter');
  });

  it('中文浏览器得到中文示例与 A4', () => {
    stubBrowserLanguages(['zh-CN', 'zh']);
    setActivePinia(createPinia());
    const store = useResumeStore();
    expect(store.doc.meta.locale).toBe('zh-CN');
    expect(store.doc.meta.paperSize).toBe('A4');
  });
});

describe('编辑器设置', () => {
  it('切换语言时把不适用的日期格式回落到默认值', () => {
    stubBrowserLanguages(['en-US']);
    setActivePinia(createPinia());
    const store = useResumeStore();
    store.setLocale('en-US');
    store.setDateFormat('mmy');
    store.setLocale('zh-CN');
    expect(store.doc.meta.dateFormat).toBe('ym');
  });

  it('分区标题按语言分别保存，清空后回到默认', () => {
    stubBrowserLanguages(['zh-CN']);
    setActivePinia(createPinia());
    const store = useResumeStore();
    store.setSectionTitle('experience', '工作履历');
    expect(store.doc.meta.sectionTitles['zh-CN']?.experience).toBe('工作履历');
    expect(store.doc.meta.sectionTitles['en-US']).toBeUndefined();
    store.setSectionTitle('experience', '');
    expect(store.doc.meta.sectionTitles['zh-CN']?.experience).toBeUndefined();
  });

  it('分区排序可上移下移', () => {
    stubBrowserLanguages(['zh-CN']);
    setActivePinia(createPinia());
    const store = useResumeStore();
    expect(store.doc.meta.sectionOrder[0]).toBe('summary');
    store.moveSection('experience', -1);
    expect(store.doc.meta.sectionOrder[0]).toBe('experience');
    expect(store.doc.meta.sectionOrder[1]).toBe('summary');
  });

  it('字号缩放被限制在 0.8 ~ 1.2，并对齐到 5% 档位', () => {
    stubBrowserLanguages(['zh-CN']);
    setActivePinia(createPinia());
    const store = useResumeStore();
    store.setFontScale(3);
    expect(store.doc.meta.fontScale).toBe(1.2);
    store.setFontScale(0.1);
    expect(store.doc.meta.fontScale).toBe(0.8);
    store.setFontScale(0.87);
    expect(store.doc.meta.fontScale).toBe(0.85);
  });

  it('撤销与重做恢复到上一步内容', async () => {
    stubBrowserLanguages(['zh-CN']);
    vi.useFakeTimers();
    try {
      setActivePinia(createPinia());
      const store = useResumeStore();
      store.doc.profile.name = 'A';
      await nextTick();
      vi.advanceTimersByTime(500);
      store.doc.profile.name = 'B';
      await nextTick();
      vi.advanceTimersByTime(500);

      expect(store.canUndo).toBe(true);
      store.undo();
      expect(store.doc.profile.name).toBe('A');
      store.redo();
      expect(store.doc.profile.name).toBe('B');
    } finally {
      vi.useRealTimers();
    }
  });
});
