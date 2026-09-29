import { useState } from 'react';
import { sanitizeInlineSvg } from '../../utils/inlineSvg';

/**
 * ImageFigure —— 知识/词条配图的统一承载组件
 * ------------------------------------------------------------------
 * 背景：知识类示意图大多是富文本混排，拿不到独立图片直链；而能"识图画图"
 * 的多模态模型可以把图片**数据本身**（base64 data URL）塞进结果字段。
 * 本组件就是程序的"图片数据组件"，统一承载三种图片来源，并优雅降级：
 *
 *   1. imageData —— base64 data URL（`data:image/png;base64,...`），多模态模型直出
 *   2. image     —— 可靠来源的图片直链（URL）
 *   3. svg       —— 模型手绘的内联 SVG 示意图（清洗后渲染）
 *
 * 加载失败一律静默降级到下一层，最终落到占位图，绝不显示裂图。
 */

interface ImageFigureProps {
  /** base64 图片数据（`data:image/...;base64,...`） */
  imageData?: string;
  /** 图片直链 URL */
  image?: string;
  /** 内联 SVG 源码 */
  svg?: string;
  /** 图题 / alt 文本 */
  caption?: string;
  /** 最大高度（px） */
  maxHeight?: number;
  /** 图源署名（如"图源：Wikimedia Commons"） */
  sourceNote?: string;
  className?: string;
}

/** 占位图：优雅的空状态，替代裂图 */
function Placeholder({ caption }: { caption?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 flex items-center justify-center text-slate-400 dark:text-zinc-500 select-none">
      <div className="flex flex-col items-center gap-2 py-8">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
        </svg>
        <span className="text-xs">{caption || ''}</span>
      </div>
    </div>
  );
}

export function ImageFigure({
  imageData,
  image,
  svg,
  caption,
  maxHeight = 240,
  sourceNote,
  className = '',
}: ImageFigureProps) {
  const [dataFailed, setDataFailed] = useState(false);
  const [urlFailed, setUrlFailed] = useState(false);

  // 1. 图片数据（多模态模型直出的 base64）
  if (imageData && !dataFailed) {
    return (
      <figure className={`my-3 ${className}`}>
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <img
            src={imageData}
            alt={caption || ''}
            className="w-full object-contain"
            style={{ maxHeight }}
            loading="lazy"
            onError={() => setDataFailed(true)}
          />
          {sourceNote && (
            <div className="px-2 py-1 text-[11px] text-slate-400 dark:text-zinc-500 border-t border-slate-100 dark:border-zinc-700">
              {sourceNote}
            </div>
          )}
        </div>
        {caption && (
          <figcaption className="mt-1 text-center text-xs text-slate-500 dark:text-zinc-400">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // 2. 图片直链
  if (image && !urlFailed) {
    return (
      <figure className={`my-3 ${className}`}>
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <img
            src={image}
            alt={caption || ''}
            className="w-full object-contain"
            style={{ maxHeight }}
            loading="lazy"
            onError={() => setUrlFailed(true)}
          />
          {sourceNote && (
            <div className="px-2 py-1 text-[11px] text-slate-400 dark:text-zinc-500 border-t border-slate-100 dark:border-zinc-700">
              {sourceNote}
            </div>
          )}
        </div>
        {caption && (
          <figcaption className="mt-1 text-center text-xs text-slate-500 dark:text-zinc-400">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // 3. 内联 SVG（清洗后渲染）
  const safe = sanitizeInlineSvg(svg);
  if (safe) {
    return (
      <figure className={`my-3 ${className}`}>
        <div
          className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-50/95 px-3 py-2 overflow-hidden flex items-center justify-center"
          style={{ maxHeight }}
        >
          <div
            className="svg-figure w-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: safe }}
          />
        </div>
        {caption && (
          <figcaption className="mt-1 text-center text-xs text-slate-500 dark:text-zinc-400">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // 4. 都没有 → 占位（仅当显式要求展示配图时才渲染占位，避免无谓占位）
  if (imageData !== undefined || image !== undefined || svg !== undefined) {
    return (
      <figure className={`my-3 ${className}`}>
        <div style={{ maxHeight: 120 }}>
          <Placeholder caption={caption} />
        </div>
      </figure>
    );
  }

  return null;
}
