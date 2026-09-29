import type { CSSProperties } from 'react';
import { sanitizeInlineSvg } from '../../utils/inlineSvg';

/**
 * SvgFigure —— 渲染模型给出的内联 SVG 示意图
 * ------------------------------------------------------------------
 * - 入口只接受 sanitizeInlineSvg 通过的源码，未通过直接不渲染
 * - 统一放在浅色底卡片内：模型画出的图多为深色线条，
 *   浅底可保证在深色主题下同样清晰可读
 */

interface SvgFigureProps {
  /** 原始 SVG 源码（未经清洗，组件内部会再洗一遍） */
  svg?: string;
  /** 图题，如"图1 受力分析" */
  caption?: string;
  /** 最大高度（px） */
  maxHeight?: number;
  className?: string;
}

export function SvgFigure({ svg, caption, maxHeight = 260, className = '' }: SvgFigureProps) {
  const safe = sanitizeInlineSvg(svg);
  if (!safe) return null;

  return (
    <figure className={`my-3 ${className}`}>
      <div
        className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-50/95 px-3 py-2 overflow-hidden flex items-center justify-center"
        style={{ maxHeight }}
      >
        {/* maxHeight 经 CSS 变量传给内部 svg：图形整体等比缩放到容器内，绝不裁剪 */}
        <div
          className="svg-figure w-full flex items-center justify-center"
          style={{ '--svg-figure-max-h': `${maxHeight}px` } as CSSProperties}
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
