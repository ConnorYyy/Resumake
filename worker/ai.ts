/**
 * AI 文案优化。
 *
 * 前端只发送「用户点按钮时选中的那段文字」，Worker 转发给 OpenCode Go，
 * 再把结果原样返回。API Key 只存在于 Worker 的 Secret 里，不会出现在任何响应中。
 *
 * 这份实现同时被两处调用：
 *   - worker/index.ts（生产，Cloudflare Workers）
 *   - vite.config.ts 的本地中间件（开发，Node）
 * 所以本地验证走的是和生产完全相同的逻辑。
 */

const DEFAULT_BASE_URL = 'https://opencode.ai/inference/go/openai/v1/chat/completions';
/** DeepSeek V4.1 Flash：非「只能思考」的模型，短文本改写 2–3 秒，数据 0 天留存 */
const DEFAULT_MODEL = 'deepseek-v4.1-flash';
/** 主模型连续失败时的一次性兜底：更便宜、更快，同样 0 天留存 */
const DEFAULT_FALLBACK_MODEL = 'mimo-v2.6-flash';

/** 输入上限：够写一段摘要或一条经历，同时限制单次成本 */
const MAX_INPUT_CHARS = 600;
/** 输出上限：超过视为模型跑偏，直接报错而不是截断 */
const MAX_OUTPUT_CHARS = 1200;
/** 太短的内容没有优化价值（例如只有一个职位名） */
const MIN_INPUT_CHARS = 12;

/** 单次请求超时。两次尝试 + 间隔 ≈ 25 秒，小于前端的 30 秒，避免前端先放弃。 */
const ATTEMPT_TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 700;
const MAX_ATTEMPTS = 2;

export type RewriteStrength = 'light' | 'strong';

/** 默认强力模式：允许重组句子结构，但不允许编造事实 */
const DEFAULT_STRENGTH: RewriteStrength = 'strong';

function parseStrength(value: unknown): RewriteStrength {
  return value === 'light' ? 'light' : DEFAULT_STRENGTH;
}

const FIELD_HINTS: Record<string, { zh: string; en: string }> = {
  summary: { zh: '个人简介', en: 'professional summary' },
  profile: { zh: '个人信息', en: 'personal details' },
  description: { zh: '工作或项目描述', en: 'work or project description' },
  highlight: { zh: '经历要点', en: 'experience highlight' },
  skills: { zh: '技能描述', en: 'skills section' },
  items: {
    zh: '技能清单（保持逗号分隔的列表形式，不要改写成句子）',
    en: 'skills list (keep the comma-separated list form, do not turn it into sentences)',
  },
  content: { zh: '自定义分节内容', en: 'custom section content' },
  other: { zh: '简历内容', en: 'resume content' },
};

export interface AiEnv {
  OPENCODE_GO_API_KEY?: string;
  AI_MODEL?: string;
  AI_FALLBACK_MODEL?: string;
  AI_BASE_URL?: string;
  /** Cloudflare Rate Limiting 绑定；本地开发没有，走内存兜底 */
  AI_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

type ErrorCode =
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
  | 'bad_request';

/* ---------- 限流 ---------- */

const buckets = new Map<string, { count: number; resetAt: number }>();
const MEMORY_LIMIT = 12;
const MEMORY_WINDOW_MS = 60_000;

function memoryAllowed(key: string): boolean {
  const now = Date.now();
  if (buckets.size > 2_000) buckets.clear();

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return true;
  }
  if (bucket.count >= MEMORY_LIMIT) return false;
  bucket.count += 1;
  return true;
}

async function allowed(request: Request, env: AiEnv): Promise<boolean> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  if (env.AI_RATE_LIMITER) {
    try {
      const result = await env.AI_RATE_LIMITER.limit({ key: ip });
      return result.success;
    } catch {
      return memoryAllowed(ip);
    }
  }
  return memoryAllowed(ip);
}

/* ---------- 工具 ---------- */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function statusFor(code: ErrorCode | undefined): number {
  switch (code) {
    case 'not_configured':
      return 503;
    case 'rate_limited':
    case 'upstream_busy':
      return 429;
    case 'too_short':
      return 400;
    case 'too_long':
      return 413;
    case 'timeout':
      return 504;
    default:
      return 502;
  }
}

/** 只保留换行，去掉模型可能带出来的 markdown、列表符号和包裹引号 */
function cleanOutput(raw: string): string {
  let text = raw.trim();

  text = text.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '');
  text = text.trim();

  const pairs: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['「', '」'],
    ['『', '』'],
  ];
  for (const [open, close] of pairs) {
    if (text.length > 1 && text.startsWith(open) && text.endsWith(close)) {
      text = text.slice(open.length, -close.length).trim();
      break;
    }
  }

  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '');
}

/**
 * 改动太小就不值得展示。
 * 模型有时只把 building 换成 developing、或把句首改成大写，
 * 这种“看起来有 diff、其实没优化”的建议会让用户困惑，直接当作 no_change 处理。
 */
function looksSame(original: string, rewritten: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const a = normalize(original);
  const b = normalize(rewritten);
  if (!a || !b) return false;
  if (a === b) return true;

  const similarity = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return similarity >= 0.9;
}

function levenshtein(a: string, b: string): number {
  const n = b.length;
  let previous = Array.from({ length: n + 1 }, (_, index) => index);
  let current = new Array<number>(n + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }

  return previous[n];
}

function buildPrompt(
  text: string,
  locale: 'zh' | 'en',
  field: string | undefined,
  strength: RewriteStrength,
): string {
  const hint = FIELD_HINTS[field ?? 'other']?.[locale] ?? FIELD_HINTS.other[locale];
  const languageRule =
    locale === 'zh'
      ? 'Reply in Simplified Chinese, even if the original is in English.'
      : 'Reply in English, even if the original is in another language.';

  // 不同字段的写法要求不一样，套用同一条规则会出问题
  // （例如给「个人简介」强行加动词会变成 "Design design systems"）。
  const openingRule =
    field === 'items'
      ? 'This is a comma-separated skills list. Keep it as a list: no sentences, no action verbs, no added words.'
      : field === 'summary' || field === 'profile'
        ? 'This is a professional summary, not a bullet. A noun phrase such as "Frontend engineer with 4+ years of experience..." is fine; do not force an action-verb opening.'
        : 'This is a resume bullet or description. Open with a strong action verb: past tense for previous roles, present tense only for a current role.';

  const strengthRule =
    field === 'items'
      ? 'Keep the list items unchanged unless a word is clearly wrong.'
      : strength === 'strong'
        ? [
            'Rewrite strength: STRONG.',
            '- Do not preserve the original sentence structure. Rebuild the sentence when the result reads better.',
            '- Merge redundant clauses, split run-ons, and drop anything that restates the obvious.',
            '- Replace generic verbs and nouns with precise ones that keep the same meaning.',
            '- Aim for 10–20% shorter than the original when the meaning allows.',
          ].join('\n')
        : [
            'Rewrite strength: LIGHT.',
            '- Keep the original sentence structure. Only tighten wording and verb choice.',
          ].join('\n');

  return [
    'You rewrite resume wording. Make it specific, active and professional.',
    '',
    'Rules:',
    `1. ${openingRule}`,
    '2. Never use weak openers or filler verbs: "Responsible for", "Duties included", "Helped with", "Worked on", "Assisted with", "Involved in", "Participated in", "Tasked with".',
    '3. Drop vague quantifiers and filler that carry no information: various, many, several, some, a lot of, lots of, stuff, things, multiple, etc.',
    '4. Keep only facts present in the original. Never add numbers, metrics, employers, dates, tools, technologies or achievements.',
    '5. If the original already contains a number, tool or result, keep it exactly as written.',
    '6. No first person ("I", "my", "we") and do not address the reader.',
    '7. Output the rewritten text only: no markdown, no bullet symbols, no surrounding quotes, no preamble, no explanation.',
    strength === 'strong'
      ? '8. Always produce a rewritten version. If the original is already strong, make it tighter or more precise, but never invent facts. Never return an empty response.'
      : '8. If you cannot improve it without inventing facts, return it unchanged. Never return an empty response.',
    `9. ${languageRule}`,
    '',
    strengthRule,
    '',
    'Examples (English):',
    '"responsible for the frontend development of the company website" -> "Developed and maintained the company website frontend."',
    '"did a lot of stuff for the design system and also fixed bugs" -> "Built design system components and fixed bugs."',
    '"worked on the checkout page and made it faster" -> "Reworked the checkout page for faster loading."',
    '',
    'Examples (Chinese):',
    '"负责公司官网的前端开发" -> "主导公司官网前端开发与维护。"',
    '"参与了项目的测试工作" -> "独立完成项目测试并推动缺陷修复。"',
    '',
    `Context: this is the ${hint} part of a resume.`,
    '',
    'Text:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

/* ---------- 上游调用 ---------- */

interface Attempt {
  text?: string;
  error?: ErrorCode;
  /** 只有暂时性故障才值得重试（429、5xx、超时、空响应） */
  retryable: boolean;
}

async function callModel(input: {
  apiKey: string;
  endpoint: string;
  model: string;
  prompt: string;
  temperature: number;
}): Promise<Attempt> {
  let response: Response;

  try {
    response = await fetch(input.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
        // Go 的文档要求客户端自报身份并带会话 ID
        'User-Agent': 'resumake-online/1.0',
        'x-opencode-session': `resumake-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        // 推理型模型的思考过程也占用 max_tokens，留足余量避免「只有思考没有正文」
        max_tokens: 1200,
        messages: [{ role: 'user', content: input.prompt }],
      }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return { error: timedOut ? 'timeout' : 'upstream_unreachable', retryable: true };
  }

  if (!response.ok) {
    // 只记录状态码，不记录任何请求或响应内容（里面可能有用户文字）
    console.warn('[ai] upstream rejected', response.status);

    if (response.status === 429) return { error: 'upstream_busy', retryable: true };
    if (response.status >= 500) return { error: 'upstream_error', retryable: true };
    // 4xx 是请求本身的问题，重试没有意义
    return { error: 'upstream_error', retryable: false };
  }

  let data: { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    return { error: 'upstream_error', retryable: true };
  }

  const choice = data.choices?.[0];
  const text = cleanOutput(choice?.message?.content ?? '');

  if (!text) {
    // finish_reason = stop 且正文为空：模型认为无需改动，选择什么都不输出。
    // 这不是故障，按「已经不错」处理，免得用户看到报错。
    if (choice?.finish_reason === 'stop') return { error: 'no_change', retryable: false };
    // finish_reason = length：思考过程把 token 用完了，值得重试
    return { error: 'empty_output', retryable: true };
  }

  if (text.length > MAX_OUTPUT_CHARS) return { error: 'output_too_long', retryable: false };

  return { text, retryable: false };
}

/* ---------- 主处理 ---------- */

export async function handleAiRewrite(request: Request, env: AiEnv): Promise<Response> {
  const apiKey = env.OPENCODE_GO_API_KEY;
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  if (!(await allowed(request, env))) {
    return json({ error: 'rate_limited' }, 429);
  }

  let payload: { text?: unknown; locale?: unknown; field?: unknown; strength?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  const locale = payload.locale === 'zh' ? 'zh' : 'en';
  const field = typeof payload.field === 'string' ? payload.field : undefined;
  const strength = parseStrength(payload.strength);

  if (text.length < MIN_INPUT_CHARS) return json({ error: 'too_short' }, 400);
  if (text.length > MAX_INPUT_CHARS) return json({ error: 'too_long', limit: MAX_INPUT_CHARS }, 413);

  const endpoint = env.AI_BASE_URL || DEFAULT_BASE_URL;
  const primaryModel = env.AI_MODEL || DEFAULT_MODEL;
  const fallbackModel = env.AI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  const models = primaryModel === fallbackModel ? [primaryModel] : [primaryModel, fallbackModel];
  const prompt = buildPrompt(text, locale, field, strength);
  const temperature = strength === 'strong' ? 0.45 : 0.3;

  const startedAt = Date.now();
  let last: Attempt = { error: 'upstream_error', retryable: false };
  let usedModel = primaryModel;

  // 主模型最多试两次；仍然失败就换备用模型再试一次
  for (const model of models) {
    usedModel = model;
    const attempts = model === primaryModel ? MAX_ATTEMPTS : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

      last = await callModel({ apiKey, endpoint, model, prompt, temperature });
      if (last.text) break;
      if (!last.retryable) break;
    }

    if (last.text) break;
    if (last.error && !last.retryable) break;
  }

  // 只记录模型、耗时、结果与输入长度，不记录任何用户文字
  console.log(
    '[ai]',
    JSON.stringify({
      model: usedModel,
      ms: Date.now() - startedAt,
      ok: Boolean(last.text),
      error: last.error ?? null,
      chars: text.length,
    }),
  );

  if (!last.text) {
    if (last.error === 'no_change') return json({ error: 'no_change' }, 200);
    return json({ error: last.error ?? 'upstream_error' }, statusFor(last.error));
  }

  // 模型原样返回、或只改了大小写/近义词：不当作错误，前端会提示「已经不错了」
  if (looksSame(text, last.text)) return json({ error: 'no_change' }, 200);

  return json({ text: last.text, model: usedModel }, 200);
}

export const AI_LIMITS = { MAX_INPUT_CHARS, MIN_INPUT_CHARS, MAX_OUTPUT_CHARS };

/**
 * 前端用来判断「要不要显示 AI 按钮」。
 *
 * 用运行时探测代替构建期常量，好处是按钮的存在与 Worker 是否真的配了 key
 * 永远一致，换 key 或临时关闭 AI 都不需要重新构建前端。
 * 只返回布尔值，不泄露任何配置细节。
 */
export function handleAiStatus(env: AiEnv): Response {
  return json({ enabled: Boolean(env.OPENCODE_GO_API_KEY) }, 200);
}
