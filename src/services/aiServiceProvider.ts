/**
 * AI 服务路由层（v2 — 工厂模式，无限扩展）
 * ------------------------------------------------------------------
 * 调用流程：
 *   业务模块 → aiService.search.xxx()
 *           → getAIService() 路由
 *              → 读取 activeProviderId
 *              → 如果该 provider 的 key 状态 valid → 返回 GenericAIProvider.buildService()
 *              → 否则回退 mockAIService
 *
 * 对业务模块完全透明，调用签名不变。
 */

import { AIService } from '../types';
import type { ModelInfo, ProviderInfo } from '../types/aiProviders';
import {
  PROVIDER_META,
  ALL_PROVIDER_IDS,
  getDefaultModelId,
  getProviderInfo,
} from '../types/aiProviders';
import { mockAIService } from './mockAIService';
import { GenericAIProvider, PRESET_OVERLAYS } from './providers/genericProvider';
import { getStoredAIConfig } from '../hooks/useAIConfigStore';

// ---------- Provider 工厂 + 缓存 ----------

const providerCache = new Map<string, GenericAIProvider>();

function getProviderInstance(providerId: string): GenericAIProvider {
  let instance = providerCache.get(providerId);
  if (!instance) {
    const overlay = PRESET_OVERLAYS[providerId] ?? {};
    instance = new GenericAIProvider(providerId, overlay);
    providerCache.set(providerId, instance);
  }
  return instance;
}

// ---------- 路由函数 ----------

export function getActiveProviderId(): string {
  try { return getStoredAIConfig().activeProviderId; } catch { return 'zhipu'; }
}

export function getActiveModelId(): string {
  try {
    const cfg = getStoredAIConfig();
    const id = cfg.activeModelId;
    const info = getProviderInfo(cfg.activeProviderId, cfg.customProviders);
    const known = info?.models.some(m => m.id === id);
    return known ? id : getDefaultModelId(cfg.activeProviderId, cfg.customProviders);
  } catch { return getDefaultModelId('zhipu'); }
}

/** 获取 UI 层可用的厂商清单（预设 + 自定义） */
export function getAvailableProviders(): ProviderInfo[] {
  const root = getStoredAIConfig();
  return [
    ...ALL_PROVIDER_IDS.map(id => PROVIDER_META[id]),
    ...Object.values(root.customProviders),
  ];
}

/** 获取指定厂商的模型清单（预设 + 自定义） */
export function getModelsForProvider(providerId: string): ModelInfo[] {
  const root = getStoredAIConfig();
  return getProviderInfo(providerId, root.customProviders)?.models ?? [];
}

/** 当前 activeProvider 是否有可用的真实 AI（key 为 valid） */
export function shouldUseRealAI(): boolean {
  try {
    const cfg = getStoredAIConfig();
    return cfg.providers[cfg.activeProviderId]?.status === 'valid';
  } catch {
    return false;
  }
}

/** 根据 activeProvider + key 状态，返回真实服务或 Mock */
export function getAIService(): AIService {
  if (shouldUseRealAI()) {
    const id = getActiveProviderId();
    const provider = getProviderInstance(id);
    try { return provider.buildService(); }
    catch (e) { console.warn('Provider buildService failed, fallback to Mock.', e); }
  }
  return mockAIService;
}

/** 兼容导出 */
export function isUsingRealAI(): boolean { return shouldUseRealAI(); }

/**
 * 顶层代理对象（业务模块直接 import { aiService } 即可）
 * 每调用一次 getAIService()，可根据最新 key 状态动态切换真实/Mock
 */
export const aiService = {
  search: {
    validate: (...args: any[]) => (getAIService().search.validate as any)(...args),
    analyze: (...args: any[]) => (getAIService().search.analyze as any)(...args),
    generate: (...args: any[]) => (getAIService().search.generate as any)(...args),
    generateStream: (...args: any[]) => {
      const svc = getAIService().search as any;
      // Mock 或旧实现未提供 generateStream → 自动退化为"一次性生成后回调一次"
      if (typeof svc.generateStream !== 'function') {
        const [topic, onPartial] = args as [string, (s: any) => void];
        return (svc.generate as any)(topic).then((res: any) => {
          if (res?.success && res.data) onPartial?.({ data: res.data, complete: true, completedKeys: Object.keys(res.data) });
          return res;
        });
      }
      return svc.generateStream(...args);
    },
    followup: (...args: any[]) => (getAIService().search.followup as any)(...args),
    followupStream: (...args: any[]) => {
      const svc = getAIService().search as any;
      if (typeof svc.followupStream !== 'function') {
        const [topic, question, history, mode, onDelta] = args as [string, string, any[], any, (d: any) => void];
        return (svc.followup as any)(topic, question, history, mode).then((res: any) => {
          if (res?.success && res.data) onDelta?.({ reply: res.data.reply, complete: true });
          return res;
        });
      }
      return svc.followupStream(...args);
    },
  },
  translate: {
    detect: (...args: any[]) => (getAIService().translate.detect as any)(...args),
    queryWord: (...args: any[]) => (getAIService().translate.queryWord as any)(...args),
    queryTranslate: (...args: any[]) => (getAIService().translate.queryTranslate as any)(...args),
  },
  document: {
    generate: (...args: any[]) => (getAIService().document.generate as any)(...args),
    generateStream: (...args: any[]) => {
      const svc = getAIService().document as any;
      if (typeof svc.generateStream !== 'function') {
        const [type, topic, requirements, tone, onPartial] = args as [any, string, string | undefined, any, (p: any) => void];
        return (svc.generate as any)(type, topic, requirements, tone).then((res: any) => {
          if (res?.success && res.data) onPartial?.({ ...res.data, complete: true });
          return res;
        });
      }
      return svc.generateStream(...args);
    },
    export: (...args: any[]) => (getAIService().document.export as any)(...args),
  },
} as unknown as AIService;
