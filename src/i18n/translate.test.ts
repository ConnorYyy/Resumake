import { describe, expect, it } from 'vitest';
import { translate } from './translate';
import { enUS, zhCN } from './messages';

describe('translate', () => {
  it('按语言返回文案', () => {
    expect(translate('zh-CN', 'toolbar.exportPdf')).toBe('导出 PDF');
    expect(translate('en-US', 'toolbar.exportPdf')).toBe('Export PDF');
  });

  it('替换参数', () => {
    expect(translate('en-US', 'status.pages', { n: 3 })).toBe('Pages: 3');
    expect(translate('zh-CN', 'preview.pageEnd', { n: 2 })).toBe('第 2 页结束');
  });

  it('缺失的 key 回退为 key 本身', () => {
    expect(translate('en-US', 'no.such.key')).toBe('no.such.key');
  });
});

describe('文案完整性', () => {
  it('中英文文案的键完全一致', () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(zhCN).sort());
  });

  it('英文文案不为空', () => {
    for (const [key, value] of Object.entries(enUS)) {
      expect(value.trim(), key).not.toBe('');
    }
  });
});
