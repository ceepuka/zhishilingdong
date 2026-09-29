import type { Strings } from '../i18n/strings';
import { fmt } from '../hooks/useStrings';

/**
 * 统一的"多久之前"格式化，全站唯一实现（历史侧栏 / 收藏列表共用）。
 *
 * 分档：< 1分钟 刚刚；< 1小时 n分钟前；< 1天 n小时前；其余显示日期。
 *
 * timestamp 的语义由调用方决定：
 * - 历史记录传 `lastViewedAt`（最后浏览时刻，见 HistoryItem 注释）；
 * - 收藏等只读列表传条目创建时刻。
 */
export const formatRelativeTime = (s: Strings, timestamp: number, language: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return s.common.justNow;
  if (diff < 3600000) return fmt(s.common.minutesAgo, { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return fmt(s.common.hoursAgo, { n: Math.floor(diff / 3600000) });
  return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : undefined);
};
