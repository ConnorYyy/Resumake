import { describe, expect, it } from 'vitest';
import worker, { type Env } from './index';

const makeEnv = () => {
  const calls: string[] = [];
  const env = {
    ASSETS: {
      async fetch(request: Request) {
        calls.push(new URL(request.url).pathname);
        return new Response('asset', { status: 200 });
      },
    },
  } as unknown as Env;
  return { env, calls };
};

const get = (path: string) => new Request(`https://resumake.online${path}`);

describe('worker 路由', () => {
  it('已合并的旧页面 301 到保留页', async () => {
    const { env, calls } = makeEnv();
    const res = await worker.fetch(get('/resume-builder-without-email/'), env);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://resumake.online/resume-builder-no-sign-up/');
    expect(calls).toEqual([]);
  });

  it('没有尾斜杠的旧地址也重定向', async () => {
    const { env } = makeEnv();
    const res = await worker.fetch(get('/resume-builder-without-email'), env);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://resumake.online/resume-builder-no-sign-up/');
  });

  it('重定向保留查询串', async () => {
    const { env } = makeEnv();
    const res = await worker.fetch(get('/resume-builder-without-email/?from=old'), env);
    expect(res.headers.get('location')).toBe('https://resumake.online/resume-builder-no-sign-up/?from=old');
  });

  it('末尾带点或大写的旧地址也重定向', async () => {
    const { env } = makeEnv();
    const dotted = await worker.fetch(get('/resume-builder-without-email.'), env);
    expect(dotted.status).toBe(301);
    const upper = await worker.fetch(get('/RESUME-BUILDER-WITHOUT-EMAIL'), env);
    expect(upper.status).toBe(301);
  });

  it('保留页本身不重定向', async () => {
    const { env, calls } = makeEnv();
    const res = await worker.fetch(get('/resume-builder-no-sign-up/'), env);
    expect(res.status).toBe(200);
    expect(calls).toEqual(['/resume-builder-no-sign-up/']);
  });

  it('未知事件名落回静态资源', async () => {
    const { env, calls } = makeEnv();
    const res = await worker.fetch(new Request('https://resumake.online/api/event/whatever', { method: 'POST' }), env);
    expect(res.status).toBe(200);
    expect(calls).toEqual(['/api/event/whatever']);
  });

  it('白名单事件返回 204 且不计入静态资源', async () => {
    const { env, calls } = makeEnv();
    const res = await worker.fetch(new Request('https://resumake.online/api/event/export', { method: 'POST' }), env);
    expect(res.status).toBe(204);
    expect(calls).toEqual([]);
  });
});
