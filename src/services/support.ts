import { SUPPORT_PROMPT_COOLDOWN_MS } from '../config/support';

const STORAGE_KEY = 'resumake:support-prompt-at';

/** 冷却期已过（或从未提示过）时返回 true */
export function shouldPromptSupport(
  lastPromptAt: number | null,
  now: number,
  cooldownMs: number = SUPPORT_PROMPT_COOLDOWN_MS,
): boolean {
  return lastPromptAt === null || now - lastPromptAt >= cooldownMs;
}

export function readLastPromptAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastPromptAt(now: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    /* 存储不可用时忽略，最多导致提示更频繁 */
  }
}
