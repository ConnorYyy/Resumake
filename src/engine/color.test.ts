import { describe, expect, it } from 'vitest';
import { parseColor } from './color';

describe('parseColor', () => {
  it('支持 #rrggbb 与 #rgb', () => {
    expect(parseColor('#0F766E')).toBe('#0f766e');
    expect(parseColor('#abc')).toBe('#aabbcc');
    expect(parseColor('0f766e')).toBe('#0f766e');
  });

  it('支持 rgb() 写法', () => {
    expect(parseColor('rgb(15, 118, 110)')).toBe('#0f766e');
    expect(parseColor('RGB(255,0,0)')).toBe('#ff0000');
  });

  it('支持纯数字的 r,g,b 写法', () => {
    expect(parseColor('15,118,110')).toBe('#0f766e');
    expect(parseColor('15 118 110')).toBe('#0f766e');
    expect(parseColor('15，118，110')).toBe('#0f766e');
  });

  it('拒绝非法输入', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor('red')).toBeNull();
    expect(parseColor('rgb(256, 0, 0)')).toBeNull();
    expect(parseColor('12,34')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });
});
