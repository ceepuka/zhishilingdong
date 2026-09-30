import { getCurrentStrings } from '../../i18n/strings';

/**
 * 把底层错误码映射为查词/翻译用户能看懂、**能据以行动**的文案。
 *
 * 为什么不能直接把 `error.message` 显示出来：服务层透传的消息是给排查用的技术描述，
 * 用户实测撞到过整条 `Failed to parse JSON response (length=1339, preview: {"word":…)`——
 * 既泄漏实现细节，又没有告诉他该做什么。技术细节留在 `interruption.detail` / 控制台日志里。
 *
 * 与搜索模块的 `toFriendlyError` 是**同一套 code → 语义**的映射，只是文案分属各自模块：
 * 搜索那套假设"已展示已收到内容"（搜索是流式边出边渲染），查词/翻译没有部分渲染，
 * 措辞必须不同，硬套会给出与屏幕不符的提示。
 */
export function friendlyTranslateError(code: string | undefined, rawMessage?: string): string {
  const e = getCurrentStrings().translate.errors;
  switch (code) {
    case 'STREAM_TIMEOUT':
      return e.timeout;
    case 'STREAM_NETWORK':
      return e.network;
    case 'STREAM_PROTOCOL':
      return e.protocol;
    case 'STREAM_INCOMPLETE':
    case 'OUTPUT_TRUNCATED':
    case 'GENERATE_FAILED':
      return e.incomplete;
    case 'CONTENT_FILTERED':
      return e.contentFiltered;
    case 'INVALID_API_KEY':
      return e.invalidApiKey;
    case 'QUOTA_EXCEEDED':
    case 'RATE_LIMITED':
    case 'SERVER_ERROR':
      return e.serviceUnavailable;
    case 'STREAM_ABORTED':
      return e.generateFailed;
    case 'NO_API_KEY':
      return getCurrentStrings().common.aiKeyRequired;
    default:
      // 认不出的 code 才退回原始消息（此时它是唯一线索）；
      // 都为空就给通用文案，绝不把空串摆到界面上
      return rawMessage || e.generateFailed;
  }
}
