/**
 * Buy Me a Coffee 赞助配置。
 * 在 .env.local 中设置 VITE_BMC_URL（例如 https://www.buymeacoffee.com/your-username），
 * 未设置时赞助入口全部隐藏。
 */
export const SUPPORT_URL: string = (import.meta.env.VITE_BMC_URL as string | undefined)?.trim() ?? '';

export const SUPPORT_ENABLED = SUPPORT_URL !== '';

/** 打印完成后的感谢提示两次之间的最短间隔（3 天） */
export const SUPPORT_PROMPT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
