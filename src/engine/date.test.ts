import { describe, expect, it } from 'vitest';
import { formatDate, formatRange, parseDateValue, parsePeriodText, presentLabel } from './date';

describe('parseDateValue', () => {
  it('解析年份与年月，拒绝非法月份', () => {
    expect(parseDateValue('2020')).toEqual({ year: '2020', month: '' });
    expect(parseDateValue('2020-07')).toEqual({ year: '2020', month: '07' });
    expect(parseDateValue('2020-7')).toEqual({ year: '2020', month: '07' });
    expect(parseDateValue('2020-13')).toBeNull();
    expect(parseDateValue('Spring 2019')).toBeNull();
  });
});

describe('formatDate', () => {
  it('按语言与格式输出', () => {
    expect(formatDate('2020-07', 'zh-CN', 'ym')).toBe('2020.07');
    expect(formatDate('2020-07', 'zh-CN', 'cn')).toBe('2020年7月');
    expect(formatDate('2020-07', 'en-US', 'my')).toBe('07.2020');
    expect(formatDate('2020-07', 'en-US', 'mmy')).toBe('Jul 2020');
  });

  it('只有年份时只输出年份；无法解析的旧文本原样返回', () => {
    expect(formatDate('2016', 'en-US', 'mmy')).toBe('2016');
    expect(formatDate('Summer 2019', 'en-US', 'ym')).toBe('Summer 2019');
  });
});

describe('formatRange', () => {
  it('拼接起止时间与“至今”', () => {
    expect(formatRange('2016-09', '2020-06', false, 'zh-CN', 'ym')).toBe('2016.09 - 2020.06');
    expect(formatRange('2020-07', '', true, 'en-US', 'mmy')).toBe('Jul 2020 - Present');
    expect(formatRange('2020-07', '', true, 'zh-CN', 'ym')).toBe('2020.07 - 至今');
    expect(formatRange('2026', '', false, 'en-US', 'ym')).toBe('2026');
    expect(formatRange('', '', false, 'en-US', 'ym')).toBe('');
  });

  it('“至今”文案跟随语言', () => {
    expect(presentLabel('zh-CN')).toBe('至今');
    expect(presentLabel('en-US')).toBe('Present');
  });
});

describe('parsePeriodText', () => {
  it('解析常见的历史自由文本', () => {
    expect(parsePeriodText('2020.07 - 至今')).toEqual({ start: '2020-07', end: '', present: true, parsed: true });
    expect(parsePeriodText('2016 - 2020')).toEqual({ start: '2016', end: '2020', present: false, parsed: true });
    expect(parsePeriodText('Jul 2020 - Present')).toEqual({
      start: '2020-07',
      end: '',
      present: true,
      parsed: true,
    });
    expect(parsePeriodText('2026')).toEqual({ start: '2026', end: '', present: false, parsed: true });
    expect(parsePeriodText('2019年12月')).toEqual({ start: '2019-12', end: '', present: false, parsed: true });
  });

  it('连字符属于日期本身时不会被当成区间', () => {
    expect(parsePeriodText('2019-12')).toEqual({ start: '2019-12', end: '', present: false, parsed: true });
    expect(parsePeriodText('2020-07 - 2021-03')).toEqual({
      start: '2020-07',
      end: '2021-03',
      present: false,
      parsed: true,
    });
  });

  it('无法解析的文本标记为未解析', () => {
    expect(parsePeriodText('Summer 2019').parsed).toBe(false);
    expect(parsePeriodText('').parsed).toBe(false);
  });
});
