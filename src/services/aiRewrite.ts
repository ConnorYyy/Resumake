/**
 * AI 文案优化的前端调用。
 *
 * 只发送用户点按钮时的那一段文字（加上语言和字段名），
 * 不发送简历的其它内容、照片或任何身份信息。
 */

export type AiErrorCode =
  | 'not_configured'
  | 'rate_limited'
  | 'too_short'
  | 'too_long'
  | 'timeout'
  | 'upstream_error'
  | 'upstream_busy'
  | 'upstream_unreachable'
  | 'empty_output'
  | 'output_too_long'
  | 'no_change'
  | 'network'
  | 'bad_request';

export interface AiRewriteResult {
  ok: boolean;
  text?: string;
  error?: AiErrorCode;
}

/**
 * 运行时探测 AI 是否可用（Worker 是否真的配了 key）。
 *
 * 用探测代替构建期常量：按钮是否存在与后端能力永远一致，
 * 换 key 或临时关闭 AI 都不需要重新构建前端。
 * 同一页面只请求一次，结果缓存在模块作用域里。
 */
let statusPromise: Promise<boolean> | null = null;

export function aiEnabled(): Promise<boolean> {
  if (!statusPromise) {
    statusPromise = fetch('/api/ai/status', { signal: AbortSignal.timeout(5_000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean } | null) => Boolean(data?.enabled))
      .catch(() => false);
  }
  return statusPromise;
}

/** 与服务端 worker/ai.ts 的 MAX_INPUT_CHARS 保持一致 */
export const AI_MAX_INPUT = 600;

/**
 * 改写强度：
 * - strong（默认）：允许重组句子结构，追求更短更有力
 * - light：保留原句结构，只收紧措辞
 */
export type AiStrength = 'light' | 'strong';

export const AI_STRENGTH: AiStrength = 'strong';

export async function rewriteText(input: {
  text: string;
  locale: string;
  field?: string;
}): Promise<AiRewriteResult> {
  try {
    const res = await fetch('/api/ai/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        locale: input.locale.startsWith('zh') ? 'zh' : 'en',
        field: input.field,
        strength: AI_STRENGTH,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await res.json().catch(() => null)) as { text?: string; error?: AiErrorCode } | null;

    if (!res.ok) {
      return { ok: false, error: data?.error ?? 'upstream_error' };
    }
    // 200 也可能带 error，例如 no_change（原文已经够好）
    if (data?.error) {
      return { ok: false, error: data.error };
    }
    if (!data?.text) {
      return { ok: false, error: 'empty_output' };
    }
    return { ok: true, text: data.text };
  } catch {
    return { ok: false, error: 'network' };
  }
}
