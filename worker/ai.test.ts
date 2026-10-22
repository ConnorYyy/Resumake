import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleAiRewrite, handleAiStatus } from './ai';

let ip = 0;
const makeRequest = (body: unknown) =>
  new Request('http://localhost/api/ai/rewrite', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': `test-${++ip}` },
    body: JSON.stringify(body),
  });

const upstream = (content: string, finishReason = 'stop') =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finishReason }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const KEY = { OPENCODE_GO_API_KEY: 'test-key' };

afterEach(() => vi.unstubAllGlobals());

describe('handleAiStatus', () => {
  it('配了 key 时返回 enabled: true', async () => {
    const res = handleAiStatus({ OPENCODE_GO_API_KEY: 'test-key' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: true });
  });

  it('没有 key 时返回 enabled: false', async () => {
    const res = handleAiStatus({});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });
  });
});

describe('handleAiRewrite', () => {
  it('没有配置 key 时返回 503', async () => {
    const res = await handleAiRewrite(makeRequest({ text: 'led the migration to vue three' }), {});
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('not_configured');
  });

  it('拒绝过短的输入', async () => {
    const res = await handleAiRewrite(makeRequest({ text: 'hi' }), KEY);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('too_short');
  });

  it('拒绝超过 600 字符的输入', async () => {
    const res = await handleAiRewrite(makeRequest({ text: 'a'.repeat(700) }), KEY);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('too_long');
  });

  it('拒绝非法 JSON', async () => {
    const req = new Request('http://localhost/api/ai/rewrite', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': `test-${++ip}` },
      body: 'not json',
    });
    const res = await handleAiRewrite(req, KEY);
    expect(res.status).toBe(400);
  });

  it('返回清洗后的文本（去掉代码围栏与包裹引号）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream('```\n"Reworked the migration to Vue 3."\n```')));
    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { text: string };
    expect(data.text).toBe('Reworked the migration to Vue 3.');
  });

  it('上游 500 映射为 502，且不透传上游错误体', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('internal-secret-detail', { status: 500 })));
    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('internal-secret-detail');
  });

  it('上游 429 映射为 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('upstream_busy');
  });

  it('上游第一次 429、第二次成功时自动重试', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1 ? new Response('{}', { status: 429 }) : upstream('Reworked the migration to Vue 3.');
      }),
    );

    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(((await res.json()) as { text: string }).text).toBe('Reworked the migration to Vue 3.');
  });

  it('第一次空响应、第二次成功时自动重试', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1 ? upstream('   ', 'length') : upstream('Reworked the migration to Vue 3.');
      }),
    );

    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('只换了一个词的输出视为 no_change', async () => {
    const original =
      'Frontend engineer with 4+ years of experience building design systems and data-heavy web applications using Vue and TypeScript.';
    const near =
      'Frontend engineer with 4+ years of experience developing design systems and data-heavy web applications using Vue and TypeScript.';

    vi.stubGlobal('fetch', vi.fn(async () => upstream(near)));
    const res = await handleAiRewrite(makeRequest({ text: original }), KEY);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { error: string }).error).toBe('no_change');
  });

  it('默认使用强力模式（prompt 与 temperature）', async () => {
    const spy = vi.fn(async (..._args: unknown[]) => upstream('Reworked the migration to Vue 3.'));
    vi.stubGlobal('fetch', spy);

    await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);

    const init = spy.mock.calls[0]?.[1] as { body: string } | undefined;
    const payload = JSON.parse(String(init?.body)) as { temperature: number; messages: { content: string }[] };
    expect(payload.temperature).toBe(0.45);
    expect(payload.messages[0].content).toContain('Rewrite strength: STRONG');
  });

  it('strength=light 时使用轻度改写与更低温度', async () => {
    const spy = vi.fn(async (..._args: unknown[]) => upstream('Reworked the migration to Vue 3.'));
    vi.stubGlobal('fetch', spy);

    await handleAiRewrite(makeRequest({ text: 'led migration to vue 3', strength: 'light' }), KEY);

    const init = spy.mock.calls[0]?.[1] as { body: string } | undefined;
    const payload = JSON.parse(String(init?.body)) as { temperature: number; messages: { content: string }[] };
    expect(payload.temperature).toBe(0.3);
    expect(payload.messages[0].content).toContain('Rewrite strength: LIGHT');
  });

  it('主模型连续失败后切换到兜底模型', async () => {
    const models: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const payload = JSON.parse(init.body) as { model: string };
        models.push(payload.model);
        if (payload.model === 'deepseek-v4.1-flash') return new Response('{}', { status: 500 });
        return upstream('Reworked the migration to Vue 3.');
      }),
    );

    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(200);
    expect(models).toEqual(['deepseek-v4.1-flash', 'deepseek-v4.1-flash', 'mimo-v2.6-flash']);
  });

  it('模型原样返回时给出 no_change', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream('led migration to vue 3')));
    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(200);
    expect((await res.json()).error).toBe('no_change');
  });

  it('模型返回空内容时报错', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream('   ', 'length')));
    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(502);
  });

  it('模型返回空正文且 finish_reason=stop 时视为 no_change', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => upstream('', 'stop')));
    const res = await handleAiRewrite(makeRequest({ text: 'led migration to vue 3' }), KEY);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { error: string }).error).toBe('no_change');
  });

  it('把语言和字段提示写进 prompt', async () => {
    const spy = vi.fn(async (..._args: unknown[]) => upstream('改写后的内容'));
    vi.stubGlobal('fetch', spy);
    await handleAiRewrite(makeRequest({ text: '负责前端开发与组件库建设', locale: 'zh', field: 'summary' }), KEY);

    const init = spy.mock.calls[0]?.[1] as { body: string } | undefined;
    const payload = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    const prompt = payload.messages[0].content;
    expect(prompt).toContain('个人简介');
    expect(prompt).toContain('Simplified Chinese');
    expect(prompt).toContain('负责前端开发与组件库建设');
  });
});
