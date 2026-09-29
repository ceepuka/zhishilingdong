/**
 * GenericAIProvider —— 通用 AI 厂商 Provider
 * ------------------------------------------------------------------
 * 替代原来的 3 个子类（zhipu/dashscope/siliconflow），
 * 通过 overlay 配置注入差异逻辑，实现"一个类覆盖所有厂商"。
 *
 * 自定义厂商直接 new GenericAIProvider(id) 即可（无 overlay）。
 */

import { BaseAIProvider } from '../baseAIProvider';
import type { AIError } from '../../types';

export interface ProviderOverlay {
  /** 错误响应归一化（DashScope 老格式根 code/message 等） */
  mapErrorResponse?: (raw: any, statusCode: number, superFn: (raw: any, statusCode: number) => AIError) => AIError;
  /** system prompt 前缀（SiliconFlow 中文助手前缀等） */
  systemPromptPrefix?: string;
}

/** DashScope 错误映射纯函数 */
function dashScopeMapErrorResponse(
  raw: any,
  statusCode: number,
  superFn: (raw: any, statusCode: number) => AIError
): AIError {
  const standardErr = superFn(raw, statusCode);
  if (standardErr.message.startsWith('HTTP ') || standardErr.code === String(statusCode)) {
    const rootMsg: string | undefined = raw?.message;
    const rootCode: string | undefined = raw?.code ? String(raw.code) : undefined;
    if (rootMsg) {
      const lower = rootMsg.toLowerCase();
      if (lower.includes('invalid') || lower.includes('token') || lower.includes('auth') || statusCode === 401) {
        return { code: 'INVALID_API_KEY', message: '密钥可能失效，请重新配置', retryable: false };
      }
      if (lower.includes('quota') || lower.includes('余额') || lower.includes('额度')) {
        return { code: 'QUOTA_EXCEEDED', message: '密钥余额不足，请充值后重试', retryable: false };
      }
      if (lower.includes('rate limit') || lower.includes('限流') || statusCode === 429) {
        return { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试', retryable: true };
      }
      return {
        code: rootCode || standardErr.code,
        message: rootMsg,
        retryable: statusCode >= 500 || statusCode === 429,
      };
    }
  }
  return standardErr;
}

/** SiliconFlow 助手前缀（语言由 buildLanguageDirective 统一绑定，这里不再写死中文） */
const SILICONFLOW_PREFIX = '你是一个严谨可靠的知识助手。输出必须是标准 JSON。\n';

/** Anthropic 错误映射（其 OpenAI 兼容层可能保留原生 error.type 结构） */
function anthropicMapErrorResponse(
  raw: any,
  statusCode: number,
  superFn: (raw: any, statusCode: number) => AIError
): AIError {
  const standardErr = superFn(raw, statusCode);
  // Anthropic 原生格式：{ type: "error", error: { type: "...", message: "..." } }
  const anthropicErr = raw?.error;
  if (anthropicErr && typeof anthropicErr === 'object' && anthropicErr.message) {
    const msg: string = String(anthropicErr.message);
    const type: string = String(anthropicErr.type || '');
    if (type.includes('authentication') || statusCode === 401) {
      return { code: 'INVALID_API_KEY', message: '密钥可能失效，请重新配置', retryable: false };
    }
    if (type.includes('rate_limit') || statusCode === 429) {
      return { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试', retryable: true };
    }
    if (type.includes('overloaded') || statusCode >= 500) {
      return { code: 'SERVER_ERROR', message: msg, retryable: true };
    }
    return { code: type || standardErr.code, message: msg, retryable: false };
  }
  return standardErr;
}

/** 预设厂商 overlay 配置 */
export const PRESET_OVERLAYS: Record<string, ProviderOverlay> = {
  dashscope: { mapErrorResponse: dashScopeMapErrorResponse },
  siliconflow: { systemPromptPrefix: SILICONFLOW_PREFIX },
  anthropic: { mapErrorResponse: anthropicMapErrorResponse },
  // zhipu / deepseek / moonshot / openai / gemini 无 overlay，使用基类默认实现
};

export class GenericAIProvider extends BaseAIProvider {
  constructor(
    private readonly _providerId: string,
    private readonly overlay: ProviderOverlay = {},
  ) { super(); }

  protected getProviderId(): string { return this._providerId; }

  protected mapErrorResponse(raw: any, statusCode: number): AIError {
    if (this.overlay.mapErrorResponse) {
      return this.overlay.mapErrorResponse(raw, statusCode, (r, s) => super.mapErrorResponse(r, s));
    }
    return super.mapErrorResponse(raw, statusCode);
  }

  protected getSystemPromptPrefix(): string {
    return this.overlay.systemPromptPrefix ?? '';
  }
}
