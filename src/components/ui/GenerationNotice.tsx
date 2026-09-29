/**
 * GenerationNotice —— 生成中断/续写的统一提示横幅
 * ------------------------------------------------------------------
 * 为什么需要它：
 *   `truncated` 布尔只能说明"内容不完整"，说明不了**为什么**不完整。
 *   把网络中断、超时、被安全策略拦截都说成"模型输出上限被截断"是错误归因——
 *   用户会去换模型，而真正该做的是检查网络。
 *
 * 分档规则（由 `interruption.side` 决定配色，`kind` 决定文案）：
 *   - resolved=true（已被续写补全）           → teal「已自动续写并补全」
 *   - side='model'（length / content_filter）  → amber「模型侧」
 *   - side='content'（incomplete）             → amber「模型/网关提前结束」
 *   - side='link'（network / timeout / protocol）→ rose「链路侧」
 *   - 旧历史数据（只有 truncated/continued）    → 按原文案兼容渲染
 *
 * 搜索与文档模块共用（文档正文同样会被中断，以前完全没有提示）。
 */

import { fmt, useStrings } from '../../hooks/useStrings';
import type { GenerationInterruption } from '../../types';

export interface GenerationNoticeData {
  truncated?: boolean;
  continued?: boolean;
  interruption?: GenerationInterruption;
}

interface GenerationNoticeProps {
  data: GenerationNoticeData | null | undefined;
}

interface NoticeCopy {
  title: string;
  body: string;
}

function bannerClass(tone: 'warn' | 'danger' | 'ok'): string {
  if (tone === 'ok') {
    return 'border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200';
  }
  if (tone === 'danger') {
    return 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200';
  }
  return 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200';
}

/** 图标：ok=循环箭头，danger=断链，warn=三角警告 */
function NoticeIcon({ tone }: { tone: 'warn' | 'danger' | 'ok' }) {
  const path =
    tone === 'ok'
      ? 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
      : tone === 'danger'
      ? 'M13 3l0 11m0 4h0m1.6-14.4l-9.6 16a2 2 0 001.7 3h18.6a2 2 0 001.7-3l-9.6-16a2 2 0 00-3.4 0z'
      : 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z';
  return (
    <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

export function GenerationNotice({ data }: GenerationNoticeProps) {
  const s = useStrings();
  if (!data) return null;

  const info = data.interruption;

  // ---- 发生过中断：按原因分档 ----
  if (info) {
    if (info.resolved) {
      return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bannerClass('ok')}`}>
          <NoticeIcon tone="ok" />
          <div className="text-sm">{s.search.notices.continued}</div>
        </div>
      );
    }
    const copy = resolveCopy(info, s.search.notices);
    const tone: 'warn' | 'danger' = info.side === 'link' ? 'danger' : 'warn';
    const retried = info.attempts && info.attempts > 1
      ? fmt(s.search.notices.retriedSuffix, { n: info.attempts })
      : '';
    return (
      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${bannerClass(tone)}`}>
        <NoticeIcon tone={tone} />
        <div className="text-sm leading-relaxed">
          <div className="font-semibold">{copy.title}</div>
          <div className="mt-0.5 opacity-90">
            {copy.body}
            {retried ? ` ${retried}` : ''}
          </div>
        </div>
      </div>
    );
  }

  // ---- 兼容旧历史数据（只有布尔标记，没有归因） ----
  if (data.truncated) {
    return (
      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${bannerClass('warn')}`}>
        <NoticeIcon tone="warn" />
        <div className="text-sm leading-relaxed">
          <div className="font-semibold">{s.search.notices.truncatedTitle}</div>
          <div className="mt-0.5 opacity-90">{s.search.notices.truncatedBody}</div>
        </div>
      </div>
    );
  }
  if (data.continued) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bannerClass('ok')}`}>
        <NoticeIcon tone="ok" />
        <div className="text-sm">{s.search.notices.continued}</div>
      </div>
    );
  }
  return null;
}

/** 按中断种类取文案（模型侧/内容侧走 amber，链路侧走 rose） */
function resolveCopy(
  info: GenerationInterruption,
  notices: {
    incompleteTitle: string;
    incompleteBody: string;
    contentFilterTitle: string;
    contentFilterBody: string;
    networkTitle: string;
    networkBody: string;
    timeoutTitle: string;
    timeoutBody: string;
    protocolTitle: string;
    protocolBody: string;
  }
): NoticeCopy {
  switch (info.kind) {
    case 'content_filter':
      return { title: notices.contentFilterTitle, body: notices.contentFilterBody };
    case 'network':
      return { title: notices.networkTitle, body: notices.networkBody };
    case 'timeout':
      return { title: notices.timeoutTitle, body: notices.timeoutBody };
    case 'protocol':
      return { title: notices.protocolTitle, body: notices.protocolBody };
    case 'length':
    case 'incomplete':
    case 'parse':
    case 'http':
    case 'aborted':
    default:
      return { title: notices.incompleteTitle, body: notices.incompleteBody };
  }
}
