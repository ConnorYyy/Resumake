import { describe, expect, it } from 'vitest';
import { computePageMetrics, type FlowUnit } from './pagination';

const H = 100;

function unit(topPx: number, bottomPx: number, avoidBreak = true, forceBreakBefore = false): FlowUnit {
  return { topPx, bottomPx, avoidBreak, forceBreakBefore };
}

describe('computePageMetrics', () => {
  it('无内容时为 1 页', () => {
    expect(computePageMetrics([], H).pageCount).toBe(1);
  });

  it('内容未超过一页时为 1 页（不因取整误差变成 2 页）', () => {
    expect(computePageMetrics([unit(0, 95)], H).pageCount).toBe(1);
    expect(computePageMetrics([unit(0, 100)], H).pageCount).toBe(1);
  });

  it('超过一页时按可打印高度递增', () => {
    expect(computePageMetrics([unit(0, 250)], H).pageCount).toBe(3);
  });

  it('可切断的内容只按底边位置计算', () => {
    expect(computePageMetrics([unit(0, 100, false)], H).pageCount).toBe(1);
    expect(computePageMetrics([unit(0, 105, false)], H).pageCount).toBe(2);
  });

  it('整块放不下时整体下移，其后的内容跟着下移', () => {
    const metrics = computePageMetrics([unit(0, 60), unit(60, 105)], H);
    expect(metrics.pageCount).toBe(2);
    expect(metrics.breakOffsetsPx).toEqual([60]);
  });

  it('多次整体下移会累积，可能比按底边除以页高多出一页', () => {
    const metrics = computePageMetrics([unit(0, 50), unit(50, 95), unit(95, 150), unit(150, 200)], H);
    expect(metrics.pageCount).toBe(3);
    expect(metrics.breakOffsetsPx.length).toBe(2);
  });

  it('强制分页符会另起一页', () => {
    const metrics = computePageMetrics([unit(0, 50), unit(50, 80, true, true)], H);
    expect(metrics.pageCount).toBe(2);
    expect(metrics.breakOffsetsPx).toEqual([50]);
  });
});
