import { describe, expect, it } from 'vitest';
import { createEmptyDoc } from './factory';

describe('createEmptyDoc', () => {
  it('英文默认使用 Letter，中文默认使用 A4', () => {
    expect(createEmptyDoc('en-US').meta.paperSize).toBe('Letter');
    expect(createEmptyDoc('zh-CN').meta.paperSize).toBe('A4');
  });

  it('默认模板为经典', () => {
    expect(createEmptyDoc('en-US').meta.templateId).toBe('classic');
  });
});
