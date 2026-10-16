import { describe, expect, it } from 'vitest';
import { shouldPromptSupport } from './support';

const DAY = 24 * 60 * 60 * 1000;

describe('shouldPromptSupport', () => {
  it('从未提示过时提示', () => {
    expect(shouldPromptSupport(null, 1000)).toBe(true);
  });

  it('冷却期内不提示', () => {
    expect(shouldPromptSupport(0, 2 * DAY, 3 * DAY)).toBe(false);
  });

  it('冷却期结束后再次提示', () => {
    expect(shouldPromptSupport(0, 3 * DAY, 3 * DAY)).toBe(true);
    expect(shouldPromptSupport(0, 5 * DAY, 3 * DAY)).toBe(true);
  });
});
