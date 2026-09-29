/**
 * useAIConfig —— 多模型配置的 React Hook（v2 — 无限扩展版）
 * ------------------------------------------------------------------
 * 职责：
 *   - 通过 useSyncExternalStore 订阅全局 store，跨组件共享同一份状态
 *   - 提供切换 / 配 Key / 验证 / 重置 / 添加自定义厂商 / 删除自定义厂商
 *   - 监听 storage 事件，跨 tab 自动同步
 */

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  ProviderConfig,
  ProviderInfo,
  ApiKeyStatus,
  ALL_PROVIDER_IDS,
  getDefaultModelId,
  createDefaultAIConfig,
  createDefaultProviderConfig,
  getProviderInfo,
  resolveActiveModelId,
} from '../types/aiProviders';
import {
  AI_CONFIG_STORAGE_KEY,
  getStoredAIConfig,
  setStoredAIConfig,
  updateStoredAIConfig,
  subscribeAIConfig,
  getAIConfigSnapshot,
} from './useAIConfigStore';

// ---------- 格式校验 ----------
function validateKeyFormat(key: string): boolean {
  if (!key || key.length === 0) return false;
  const trimmed = key.trim();
  return trimmed.length >= 8 && /^[a-zA-Z0-9._\-]+$/.test(trimmed);
}

// ---------- Ping 验证 ----------
type ValidationResult =
  | { success: true }
  | { success: false; error: string; kind: 'invalid_key' | 'network_error' };

async function validateProviderKeyWithPing(
  providerId: string,
  apiKey: string,
  customBaseUrl?: string,
  customModel?: string
): Promise<ValidationResult> {
  const root = getStoredAIConfig();
  const info = getProviderInfo(providerId, root.customProviders);
  const baseUrl = (customBaseUrl && customBaseUrl.trim()) || info?.defaultBaseUrl || '';
  if (!baseUrl) return { success: false, error: '无法确定 API Base URL', kind: 'network_error' };

  const cfg = root.providers[providerId] ?? createDefaultProviderConfig();
  // 验证的是"真正会被用到"的那个模型：手填了自定义 ID 就用它，否则用下拉里选中的型号。
  // 旧实现一律用默认模型验证，会出现"验证通过、一生成就报模型不存在"的假阳性。
  const modelId =
    (customModel && customModel.trim()) ||
    resolveActiveModelId(providerId, root.activeModelId, cfg, root.customProviders) ||
    'gpt-3.5-turbo';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        max_tokens: 10,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (resp.ok || resp.status === 429) return { success: true };

    let raw: any = {};
    try { raw = await resp.json(); } catch { /* ignore */ }
    const msg: string =
      raw?.error?.message || raw?.message || raw?.msg || `HTTP ${resp.status}`;
    const lower = msg.toLowerCase();

    if (
      resp.status === 401 ||
      lower.includes('invalid api key') ||
      lower.includes('invalid token') ||
      lower.includes('unauthorized') ||
      lower.includes('未授权')
    ) {
      return { success: false, error: '密钥无效，请检查后重试', kind: 'invalid_key' };
    }
    if (lower.includes('quota') || lower.includes('balance') || lower.includes('额度') || lower.includes('余额')) {
      return { success: false, error: '密钥余额不足，请充值后重试', kind: 'invalid_key' };
    }
    // 模型不存在 / 账号无权访问该模型 —— 密钥本身没问题，但一生成就会失败，
    // 必须明确告诉用户换型号，而不是笼统报"网络错误"
    const modelIssue =
      resp.status === 404 ||
      lower.includes('model') && (
        lower.includes('not found') ||
        lower.includes('does not exist') ||
        lower.includes('unknown model') ||
        lower.includes('no such model') ||
        lower.includes('not exist')
      ) ||
      lower.includes('模型不存在') ||
      lower.includes('无权限') ||
      lower.includes('unauthorized model') ||
      lower.includes('does not have access');
    if (modelIssue) {
      return {
        success: false,
        error: `模型「${modelId}」不可用（ID 可能不存在或该账号无权限），请在下方换一个型号或填自定义模型 ID`,
        kind: 'invalid_key',
      };
    }
    return { success: false, error: msg, kind: 'network_error' };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return { success: false, error: '网络连接超时，请稍后重试', kind: 'network_error' };
    }
    return { success: false, error: '网络请求失败，请检查网络或自定义 Base URL', kind: 'network_error' };
  }
}

// ============== Hook ==============

export function useAIConfig() {
  const root = useSyncExternalStore(subscribeAIConfig, getAIConfigSnapshot);
  const [validatingMap, setValidatingMap] = useState<Record<string, boolean>>({});

  // 跨 tab 同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AI_CONFIG_STORAGE_KEY) {
        setStoredAIConfig(getStoredAIConfig());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 切换激活厂商
  const setActiveProvider = useCallback((providerId: string) => {
    updateStoredAIConfig((cfg) => {
      cfg.activeProviderId = providerId;
      // 切换厂商时清空 customModel，防止旧厂商的自定义模型串到新厂商
      cfg.providers[providerId].customModel = '';
      // 校验 activeModelId 是否属于新厂商
      const info = getProviderInfo(providerId, cfg.customProviders);
      const known = info?.models.some(m => m.id === cfg.activeModelId);
      if (!known) cfg.activeModelId = getDefaultModelId(providerId, cfg.customProviders);
    });
  }, []);

  // 切换激活型号
  const setActiveModel = useCallback((modelId: string) => {
    updateStoredAIConfig((cfg) => {
      const info = getProviderInfo(cfg.activeProviderId, cfg.customProviders);
      const known = info?.models.some(m => m.id === modelId);
      if (known) {
        cfg.activeModelId = modelId;
        // 切换到内置型号时清空 customModel
        cfg.providers[cfg.activeProviderId].customModel = '';
      }
    });
  }, []);

  // 更新单个 provider 的配置字段
  const patchProviderConfig = useCallback((id: string, patch: Partial<ProviderConfig>) => {
    updateStoredAIConfig((cfg) => {
      if (!cfg.providers[id]) cfg.providers[id] = createDefaultProviderConfig();
      cfg.providers[id] = { ...cfg.providers[id], ...patch };
    });
  }, []);

  // 保存并验证
  const validateAndSaveProviderKey = useCallback(async (
    id: string,
    apiKey: string,
    customBaseUrl?: string,
    customModel?: string
  ): Promise<{ success: boolean; status: ApiKeyStatus }> => {
    const trimmedKey = apiKey.trim();
    const trimmedBase = (customBaseUrl ?? '').trim();
    const trimmedModel = (customModel ?? '').trim();

    if (!trimmedKey) {
      updateStoredAIConfig((cfg) => {
        cfg.providers[id] = {
          ...createDefaultProviderConfig(),
          customBaseUrl: trimmedBase,
          customModel: trimmedModel,
        };
      });
      return { success: true, status: 'unconfigured' };
    }

    if (!validateKeyFormat(trimmedKey)) {
      updateStoredAIConfig((cfg) => {
        cfg.providers[id] = {
          ...cfg.providers[id],
          apiKey: trimmedKey,
          status: 'invalid',
          error: '密钥格式不正确，请检查后重试',
          customBaseUrl: trimmedBase,
          customModel: trimmedModel,
        };
      });
      return { success: false, status: 'invalid' };
    }

    const prevStatus = getStoredAIConfig().providers[id]?.status ?? 'unconfigured';

    setValidatingMap((m) => ({ ...m, [id]: true }));
    updateStoredAIConfig((cfg) => {
      cfg.providers[id] = {
        ...cfg.providers[id],
        apiKey: trimmedKey,
        status: 'configuring',
        error: '',
        customBaseUrl: trimmedBase,
        customModel: trimmedModel,
      };
    });

    const result = await validateProviderKeyWithPing(id, trimmedKey, trimmedBase, trimmedModel);

    let status: ApiKeyStatus;
    if (result.success) {
      status = 'valid';
    } else if (result.kind === 'invalid_key') {
      status = 'invalid';
    } else {
      // 网络错误：回退到合法终态，不让 configuring 持久化
      status = (prevStatus === 'valid') ? 'valid' : 'unconfigured';
    }

    updateStoredAIConfig((cfg) => {
      cfg.providers[id] = {
        ...cfg.providers[id],
        status,
        error: result.success ? '' : result.error,
      };
    });
    setValidatingMap((m) => ({ ...m, [id]: false }));
    return { success: result.success, status };
  }, []);

  // 重置某厂商配置
  const resetProvider = useCallback((id: string) => {
    updateStoredAIConfig((cfg) => {
      cfg.providers[id] = createDefaultProviderConfig();
    });
  }, []);

  // 添加自定义厂商
  const addCustomProvider = useCallback((info: Omit<ProviderInfo, 'id'>, apiKey: string): string => {
    const id = `custom-${Date.now().toString(36)}`;
    updateStoredAIConfig((cfg) => {
      cfg.customProviders[id] = { ...info, id };
      cfg.providers[id] = {
        ...createDefaultProviderConfig(),
        apiKey: apiKey.trim(),
        status: apiKey.trim() ? 'configuring' : 'unconfigured',
      };
      cfg.activeProviderId = id;
      cfg.activeModelId = info.models[0]?.id ?? '';
    });
    return id;
  }, []);

  // 删除自定义厂商
  const removeCustomProvider = useCallback((id: string) => {
    updateStoredAIConfig((cfg) => {
      delete cfg.customProviders[id];
      delete cfg.providers[id];
      if (cfg.activeProviderId === id) {
        cfg.activeProviderId = 'zhipu';
        cfg.activeModelId = getDefaultModelId('zhipu');
      }
    });
  }, []);

  // 便捷字段
  const anyConfigured = ALL_PROVIDER_IDS.some(id => root.providers[id]?.status === 'valid')
    || Object.values(root.customProviders).some(p => root.providers[p.id]?.status === 'valid');
  const activeProviderValid = root.providers[root.activeProviderId]?.status === 'valid';

  return {
    root,
    providers: root.providers,
    customProviders: root.customProviders,
    activeProviderId: root.activeProviderId,
    activeModelId: root.activeModelId,
    anyConfigured,
    activeProviderValid,
    validatingMap,
    setActiveProvider,
    setActiveModel,
    patchProviderConfig,
    validateAndSaveProviderKey,
    resetProvider,
    addCustomProvider,
    removeCustomProvider,
  };
}

// 模块加载时初始化
try {
  const existing = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (!existing) {
    setStoredAIConfig(createDefaultAIConfig());
  } else {
    getStoredAIConfig();
  }
} catch { /* ignore */ }
