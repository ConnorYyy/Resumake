import { describe, expect, it } from 'vitest';
import { checkup } from './checkup';
import { createEmptyDoc } from '../data/factory';
import { createSample } from '../data/sample';

describe('checkup', () => {
  it('空简历会提示缺姓名与联系方式', () => {
    const issues = checkup(createEmptyDoc('zh-CN'), 1, 0);
    const keys = issues.map((issue) => issue.key);
    expect(keys).toContain('check.noName');
    expect(keys).toContain('check.noContact');
    expect(issues.every((issue) => issue.level === 'error')).toBe(true);
  });

  it('完整简历且只有一页时没有问题', () => {
    expect(checkup(createSample('en-US'), 1, 0)).toEqual([]);
  });

  it('超过一页与被切断的内容会提示，空白条目计数', () => {
    const doc = createSample('en-US');
    doc.skills.push({ id: 'blank', category: '', items: '' });
    const issues = checkup(doc, 2, 3);
    const multi = issues.find((issue) => issue.key === 'check.multiPage');
    const split = issues.find((issue) => issue.key === 'check.split');
    const blank = issues.find((issue) => issue.key === 'check.blankItems');
    expect(multi?.params?.n).toBe(2);
    expect(split?.params?.n).toBe(3);
    expect(blank?.params?.n).toBe(1);
    expect(multi?.level).toBe('warn');
  });
});
