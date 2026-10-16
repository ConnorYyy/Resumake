/** 允许的像素误差，避免取整误差被算作新的一页 */
const TOLERANCE_PX = 1;

/** 排版中的一个流式单元：要么整块不可切断，要么可以被分页切断 */
export interface FlowUnit {
  /** 相对内容区顶边（第一行文字起点）的文档坐标 */
  topPx: number;
  /** 相对内容区顶边的底边文档坐标 */
  bottomPx: number;
  /** 是否整块不可分页切断（对应 break-inside: avoid） */
  avoidBreak: boolean;
  /** 该单元之前是否有强制分页符 */
  forceBreakBefore: boolean;
}

export interface PageMetrics {
  pageCount: number;
  /** 第 2 页起每页首个内容单元在文档中的位置（相对内容区顶边），用于画分页线 */
  breakOffsetsPx: number[];
  /** 被分页线切断的内容单元数量 */
  splitCount: number;
}

/**
 * 按“可打印高度”计算页数与分页位置。
 *
 * 打印时页边距由 @page 提供，因此每页实际能容纳的内容高度是
 * 页高减去上下边距，而不是整页高度。
 *
 * 带有 break-inside: avoid 的整块内容若放不下，会整体移到下一页，
 * 其后的内容也跟着下移，所以这里用累积位移模拟浏览器行为。
 */
export function computePageMetrics(
  units: FlowUnit[],
  printableHeightPx: number,
  tolerancePx = TOLERANCE_PX,
): PageMetrics {
  const pageHeight = printableHeightPx;
  let page = 0;
  /** 因整块下移而累积到后续内容上的位移 */
  let shift = 0;
  let recordedPage = 0;
  let splitCount = 0;
  const breakOffsetsPx: number[] = [];

  for (const unit of units) {
    let top = unit.topPx + shift;
    let bottom = unit.bottomPx + shift;

    if (unit.forceBreakBefore) {
      const target = page + 1;
      const newTop = target * pageHeight;
      if (newTop > top) {
        shift += newTop - top;
        top = newTop;
        bottom = unit.bottomPx + shift;
      }
      page = target;
    }

    // 整块内容不得跨界：放不下就整体推到下一页
    const fitsOnOnePage = bottom - top <= pageHeight + tolerancePx;
    if (unit.avoidBreak && fitsOnOnePage) {
      const start = Math.floor((top + tolerancePx) / pageHeight);
      if (bottom > (start + 1) * pageHeight + tolerancePx) {
        const newTop = (start + 1) * pageHeight;
        shift += newTop - top;
        top = newTop;
        bottom = unit.bottomPx + shift;
        page = Math.max(page, start + 1);
      }
    }

    // 该内容块至少要占用到它所在的那一页
    const lastPage = Math.max(0, Math.ceil((bottom - tolerancePx) / pageHeight) - 1);
    if (lastPage > page) page = lastPage;

    // 一个单元跨越了分页线，说明它会被切断（不可切断的整块已经在上方下移）
    const startPage = Math.floor((top + tolerancePx) / pageHeight);
    const endPage = Math.floor((bottom - tolerancePx) / pageHeight);
    if (endPage > startPage) splitCount += 1;

    // 记录新页是从哪个内容块开始的，用于在预览中画分页线
    while (recordedPage < page) {
      breakOffsetsPx.push(unit.topPx);
      recordedPage += 1;
    }
  }

  return { pageCount: page + 1, breakOffsetsPx, splitCount };
}
