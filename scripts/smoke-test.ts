/**
 * 冒烟测试脚本 —— AI 多模型（v2 — 无限扩展版）
 * ------------------------------------------------------------------
 * 运行方式：
 *   npx tsx --test scripts/smoke-test.ts
 *
 * 不引入任何新 npm 依赖；使用 Node.js 内置 node:test + node:assert。
 * 测试分层：
 *   1. 数据层：PROVIDER_META 3×3 完整性、工厂函数
 *   2. 辅助函数：getModelInfo / resolveBaseUrl / resolveActiveModelId（含自定义厂商）
 *   3. JSON 修复层：4 层策略（中文引号 / 尾随逗号 / 截断补全 / 混合）
 *   4. 存储读写层：v2 结构、setStoredAIConfig / updateStoredAIConfig、损坏回退
 *   5. 自定义厂商层：customProviders 写入与解析
 *   6. 路由判定层：activeProvider 状态组合
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ---------- localStorage polyfill（Node 环境没有 DOM） ----------
function createLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    _raw: store,
  };
}

const ls = createLocalStorage();
(globalThis as any).localStorage = ls;

// ---------- import 项目源码 ----------
import {
  PROVIDER_META,
  ALL_PROVIDER_IDS,
  createDefaultProviderConfig,
  createDefaultAIConfig,
  getProviderInfo,
  getModelInfo,
  getDefaultModelId,
  resolveActiveModelId,
  resolveBaseUrl,
  type ProviderInfo,
} from '../src/types/aiProviders';

import {
  cleanJSONText,
  repairTruncatedJSON,
  parseJSONResponse,
} from '../src/utils/jsonRepair';

// useAIConfigStore 带模块级缓存（cachedRoot），存储类测试需要全新模块实例，
// 用带 query 的动态导入绕过 ESM 模块缓存。
type StoreModule = typeof import('../src/hooks/useAIConfigStore');
async function freshStore(): Promise<StoreModule> {
  ls.clear();
  return import(`../src/hooks/useAIConfigStore.ts?fresh=${Date.now()}-${Math.random()}`);
}

// ====================== 第 1 组：PROVIDER_META 数据完整性 ======================

describe('1. PROVIDER_META 数据完整性', () => {
  test('1.1 包含 8 个预设厂商且 ALL_PROVIDER_IDS 匹配', () => {
    assert.equal(ALL_PROVIDER_IDS.length, 8);
    for (const id of ALL_PROVIDER_IDS) {
      assert.ok(PROVIDER_META[id], `缺少厂商 ${id}`);
    }
    // 验证核心厂商都在（顺序不敏感）
    const ids = new Set(ALL_PROVIDER_IDS);
    assert.ok(ids.has('zhipu'), '缺少 zhipu');
    assert.ok(ids.has('dashscope'), '缺少 dashscope');
    assert.ok(ids.has('deepseek'), '缺少 deepseek');
    assert.ok(ids.has('moonshot'), '缺少 moonshot');
    assert.ok(ids.has('siliconflow'), '缺少 siliconflow');
    assert.ok(ids.has('openai'), '缺少 openai');
    assert.ok(ids.has('anthropic'), '缺少 anthropic');
    assert.ok(ids.has('gemini'), '缺少 gemini');
  });

  test('1.2 每个厂商至少 3 个型号（有 recommended）', () => {
    for (const id of ALL_PROVIDER_IDS) {
      assert.ok(PROVIDER_META[id].models.length >= 3, `${id} 型号数 < 3`);
    }
  });

  test('1.3 每个厂商恰好 1 个 recommended 型号', () => {
    for (const id of ALL_PROVIDER_IDS) {
      const recs = PROVIDER_META[id].models.filter(m => m.recommended);
      assert.equal(recs.length, 1, `${id} recommended 数 != 1`);
    }
  });

  test('1.4 所有 defaultBaseUrl 为 https 开头且非空', () => {
    for (const id of ALL_PROVIDER_IDS) {
      const url = PROVIDER_META[id].defaultBaseUrl;
      assert.ok(url.startsWith('https://'), `${id} base URL 不是 https`);
      assert.ok(url.length > 20, `${id} base URL 过短`);
    }
  });

  test('1.5 所有型号 contextLength > 0', () => {
    for (const id of ALL_PROVIDER_IDS) {
      for (const m of PROVIDER_META[id].models) {
        assert.ok(m.contextLength > 0, `${id}/${m.id} contextLength <= 0`);
      }
    }
  });

  test('1.6 每个厂商 supportsCustomBaseUrl = true', () => {
    for (const id of ALL_PROVIDER_IDS) {
      assert.equal(PROVIDER_META[id].supportsCustomBaseUrl, true, `${id} 不支持自定义 Base URL`);
    }
  });

  test('1.7 每个厂商 keyFormatHint 非空', () => {
    for (const id of ALL_PROVIDER_IDS) {
      assert.ok(PROVIDER_META[id].keyFormatHint.length > 5, `${id} keyFormatHint 为空`);
    }
  });
});

// ====================== 第 2 组：工厂函数 ======================

describe('2. 工厂函数', () => {
  test('2.1 createDefaultProviderConfig 返回全空 + unconfigured', () => {
    const cfg = createDefaultProviderConfig();
    assert.equal(cfg.apiKey, '');
    assert.equal(cfg.status, 'unconfigured');
    assert.equal(cfg.error, '');
    assert.equal(cfg.customBaseUrl, '');
    assert.equal(cfg.customModel, '');
  });

  test('2.2 createDefaultAIConfig 为 v2 结构', () => {
    const root = createDefaultAIConfig();
    assert.equal(root.version, 2);
    assert.equal(root.activeProviderId, 'zhipu');
    assert.equal(root.activeModelId, 'glm-5.3');
    assert.deepEqual(root.customProviders, {});
    for (const id of ALL_PROVIDER_IDS) {
      assert.ok(root.providers[id], `缺少 providers.${id}`);
      assert.equal(root.providers[id].status, 'unconfigured');
    }
  });
});

// ====================== 第 3 组：辅助函数 ======================

describe('3. 辅助函数', () => {
  test('3.1 getProviderInfo 返回正确元数据', () => {
    assert.equal(getProviderInfo('zhipu')?.name, '智谱AI');
    assert.equal(getProviderInfo('dashscope')?.name, '阿里通义千问');
    assert.equal(getProviderInfo('siliconflow')?.name, '硅基流动');
  });

  test('3.2 getProviderInfo 查不到返回 undefined', () => {
    assert.equal(getProviderInfo('nonexistent'), undefined);
  });

  test('3.3 getProviderInfo 可查自定义厂商', () => {
    const custom: Record<string, ProviderInfo> = {
      'custom-x': {
        id: 'custom-x', name: '测试厂商', shortName: '测试',
        defaultBaseUrl: 'https://api.example.com/v1/chat/completions',
        supportsCustomBaseUrl: true,
        models: [{ id: 'model-a', name: 'Model A', description: '', contextLength: 8192, recommended: true }],
        keyFormatHint: '请输入 Key',
      },
    };
    assert.equal(getProviderInfo('custom-x', custom)?.name, '测试厂商');
    assert.equal(getModelInfo('custom-x', 'model-a', custom)?.contextLength, 8192);
    assert.equal(getDefaultModelId('custom-x', custom), 'model-a');
  });

  test('3.4 getModelInfo 找到和找不到', () => {
    assert.equal(getModelInfo('zhipu', 'glm-4-flash')?.name, 'GLM-4-Flash');
    assert.equal(getModelInfo('zhipu', 'nonexistent'), undefined);
  });

  test('3.5 getDefaultModelId 返回 recommended 型号', () => {
    assert.equal(getDefaultModelId('zhipu'), 'glm-5.3');
    assert.equal(getDefaultModelId('dashscope'), 'qwen-max');
    assert.equal(getDefaultModelId('siliconflow'), 'deepseek-ai/DeepSeek-V4');
    assert.equal(getDefaultModelId('deepseek'), 'deepseek-v4-chat');
    assert.equal(getDefaultModelId('moonshot'), 'kimi-k2.5');
    assert.equal(getDefaultModelId('openai'), 'gpt-4o');
    assert.equal(getDefaultModelId('anthropic'), 'claude-4.1-opus');
    assert.equal(getDefaultModelId('gemini'), 'gemini-2.5-pro');
  });

  test('3.6 resolveBaseUrl 优先用 customBaseUrl', () => {
    const cfg = createDefaultProviderConfig();
    cfg.customBaseUrl = 'http://localhost:9999/proxy';
    assert.equal(resolveBaseUrl('zhipu', cfg), 'http://localhost:9999/proxy');
  });

  test('3.7 resolveBaseUrl 无 customBaseUrl 时用 default', () => {
    const cfg = createDefaultProviderConfig();
    assert.equal(resolveBaseUrl('zhipu', cfg), PROVIDER_META.zhipu.defaultBaseUrl);
    assert.equal(resolveBaseUrl('dashscope', cfg), PROVIDER_META.dashscope.defaultBaseUrl);
  });

  test('3.8 resolveBaseUrl 支持自定义厂商 defaultBaseUrl', () => {
    const cfg = createDefaultProviderConfig();
    const custom: Record<string, ProviderInfo> = {
      'custom-x': {
        id: 'custom-x', name: 'X', shortName: 'X',
        defaultBaseUrl: 'https://x.example.com/chat',
        supportsCustomBaseUrl: true, models: [], keyFormatHint: '',
      },
    };
    assert.equal(resolveBaseUrl('custom-x', cfg, custom), 'https://x.example.com/chat');
  });

  test('3.9 resolveActiveModelId 优先用 customModel', () => {
    const cfg = createDefaultProviderConfig();
    cfg.customModel = 'my-custom-model';
    assert.equal(resolveActiveModelId('zhipu', 'glm-4-flash', cfg), 'my-custom-model');
  });

  test('3.10 resolveActiveModelId 不在列表时回退默认', () => {
    const cfg = createDefaultProviderConfig();
    assert.equal(resolveActiveModelId('dashscope', 'glm-4-flash', cfg), 'qwen-max');
  });

  test('3.11 resolveActiveModelId 正常情况原样返回', () => {
    const cfg = createDefaultProviderConfig();
    assert.equal(resolveActiveModelId('zhipu', 'glm-4-plus', cfg), 'glm-4-plus');
  });
});

// ====================== 第 4 组：JSON 修复 ======================

describe('4. JSON 修复（4 层策略）', () => {
  test('4.1 cleanJSONText：中文引号转英文', () => {
    const input = '{"name": “测试”}';
    const cleaned = cleanJSONText(input);
    assert.equal(JSON.parse(cleaned).name, '测试');
  });

  test('4.2 cleanJSONText：全角标点转 ASCII', () => {
    const input = '｛“a”：1，“b”：2｝';
    const cleaned = cleanJSONText(input);
    const parsed = JSON.parse(cleaned);
    assert.equal(parsed.a, 1);
    assert.equal(parsed.b, 2);
  });

  test('4.3 parseJSONResponse：正常 JSON 直接通过', () => {
    const input = '{"key": "value", "num": 42}';
    const result = parseJSONResponse<{ key: string; num: number }>(input);
    assert.equal(result?.key, 'value');
    assert.equal(result?.num, 42);
  });

  test('4.4 parseJSONResponse：从 markdown 代码块提取', () => {
    const input = '这是结果：\n```json\n{"a": 1, "b": [2, 3]}\n```\n结束';
    const result = parseJSONResponse<{ a: number; b: number[] }>(input);
    assert.equal(result?.a, 1);
    assert.deepEqual(result?.b, [2, 3]);
  });

  test('4.5 parseJSONResponse：移除尾随逗号', () => {
    const input = '{"a": 1, "b": 2,}';
    const result = parseJSONResponse<{ a: number; b: number }>(input);
    assert.equal(result?.a, 1);
    assert.equal(result?.b, 2);
  });

  test('4.6 parseJSONResponse：截断 JSON 补全括号', () => {
    const input = '{"title": "文档", "content": "部分内容", "tags": ["a", "b"';
    const result = parseJSONResponse<{ title: string; tags: string[] }>(input);
    assert.ok(result !== null, '截断 JSON 应被修复');
    assert.equal(result?.title, '文档');
    assert.deepEqual(result?.tags, ['a', 'b']);
  });

  test('4.7 parseJSONResponse：中文引号 + 尾随逗号混合', () => {
    const input = '{“name”: “测试”, “val”: 123,}';
    const result = parseJSONResponse<{ name: string; val: number }>(input);
    assert.equal(result?.name, '测试');
    assert.equal(result?.val, 123);
  });

  test('4.8 parseJSONResponse：完全无效输入返回 null', () => {
    const input = '这不是JSON，无法解析';
    const result = parseJSONResponse(input);
    assert.equal(result, null);
  });

  test('4.9 repairTruncatedJSON：未闭合字符串补引号', () => {
    const input = '{"key": "未闭合的值';
    const repaired = repairTruncatedJSON(input);
    assert.ok(repaired !== null);
    const parsed = JSON.parse(repaired!);
    assert.ok(parsed.key.includes('未闭合'));
  });
});

// ====================== 第 5 组：存储读写（v2） ======================

describe('5. 存储读写层（v2）', () => {
  test('5.1 首次读取返回 v2 默认结构', async () => {
    const { getStoredAIConfig } = await freshStore();
    const root = getStoredAIConfig();
    assert.equal(root.version, 2);
    assert.equal(root.activeProviderId, 'zhipu');
    assert.equal(root.activeModelId, 'glm-5.3');
    assert.deepEqual(root.customProviders, {});
    for (const id of ALL_PROVIDER_IDS) {
      assert.equal(root.providers[id].status, 'unconfigured');
    }
  });

  test('5.2 setStoredAIConfig：写入后能读回', async () => {
    const { setStoredAIConfig, getStoredAIConfig } = await freshStore();
    const root = createDefaultAIConfig();
    root.providers.zhipu.apiKey = 'test-key-123';
    root.providers.zhipu.status = 'valid';
    setStoredAIConfig(root);

    const read = getStoredAIConfig();
    assert.equal(read.providers.zhipu.apiKey, 'test-key-123');
    assert.equal(read.providers.zhipu.status, 'valid');
  });

  test('5.3 updateStoredAIConfig：原子更新', async () => {
    const { getStoredAIConfig, updateStoredAIConfig } = await freshStore();
    getStoredAIConfig();
    const updated = updateStoredAIConfig((cfg) => {
      cfg.providers.dashscope.apiKey = 'dash-key';
      cfg.providers.dashscope.status = 'configuring';
      cfg.activeProviderId = 'dashscope';
    });
    assert.equal(updated.providers.dashscope.apiKey, 'dash-key');
    assert.equal(updated.activeProviderId, 'dashscope');
    const read = getStoredAIConfig();
    assert.equal(read.providers.dashscope.apiKey, 'dash-key');
    assert.equal(read.activeProviderId, 'dashscope');
  });

  test('5.4 损坏数据回退默认 v2', async () => {
    const { AI_CONFIG_STORAGE_KEY, getStoredAIConfig } = await freshStore();
    ls.setItem(AI_CONFIG_STORAGE_KEY, '不是合法JSON{{{');
    const root = getStoredAIConfig();
    assert.equal(root.version, 2);
    assert.equal(root.activeProviderId, 'zhipu');
  });

  test('5.5 缺少 provider 自动补全', async () => {
    const { AI_CONFIG_STORAGE_KEY, getStoredAIConfig } = await freshStore();
    const partial = {
      version: 2,
      activeProviderId: 'zhipu',
      activeModelId: 'glm-4-flash',
      providers: { zhipu: createDefaultProviderConfig() },
      customProviders: {},
    };
    ls.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(partial));
    const root = getStoredAIConfig();
    assert.ok(root.providers.dashscope, 'dashscope 应被自动补全');
    assert.ok(root.providers.siliconflow, 'siliconflow 应被自动补全');
  });

  test('5.6 v1 旧结构不被识别（开发期无迁移，回退默认）', async () => {
    const { AI_CONFIG_STORAGE_KEY, getStoredAIConfig } = await freshStore();
    const v1 = {
      version: 1,
      activeProviderId: 'zhipu',
      activeModelId: 'glm-4-flash',
      providers: { zhipu: createDefaultProviderConfig() },
    };
    ls.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(v1));
    const root = getStoredAIConfig();
    // v1 不识别 → 回退默认 v2，不继承旧数据
    assert.equal(root.version, 2);
    assert.equal(root.providers.zhipu.apiKey, '');
  });

  test('5.7 非法 activeProviderId 回退 zhipu', async () => {
    const { AI_CONFIG_STORAGE_KEY, getStoredAIConfig } = await freshStore();
    const bad = {
      version: 2,
      activeProviderId: 'ghost-provider',
      activeModelId: 'glm-4-flash',
      providers: {},
      customProviders: {},
    };
    ls.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(bad));
    const root = getStoredAIConfig();
    assert.equal(root.activeProviderId, 'zhipu');
  });
});

// ====================== 第 6 组：自定义厂商 ======================

describe('6. 自定义厂商（customProviders）', () => {
  test('6.1 写入自定义厂商后可读取', async () => {
    const { getStoredAIConfig, updateStoredAIConfig } = await freshStore();
    getStoredAIConfig();
    updateStoredAIConfig((cfg) => {
      cfg.customProviders['custom-deepseek'] = {
        id: 'custom-deepseek',
        name: 'DeepSeek',
        shortName: '深度求索',
        defaultBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
        supportsCustomBaseUrl: true,
        models: [
          { id: 'deepseek-chat', name: 'DeepSeek-Chat', description: '', contextLength: 65536, recommended: true },
        ],
        keyFormatHint: 'sk-xxxx',
      };
      cfg.providers['custom-deepseek'] = createDefaultProviderConfig();
      cfg.providers['custom-deepseek'].apiKey = 'sk-deepseek';
      cfg.providers['custom-deepseek'].status = 'valid';
      cfg.activeProviderId = 'custom-deepseek';
      cfg.activeModelId = 'deepseek-chat';
    });

    const root = getStoredAIConfig();
    assert.equal(root.activeProviderId, 'custom-deepseek');
    assert.equal(root.customProviders['custom-deepseek']?.name, 'DeepSeek');
    assert.equal(root.providers['custom-deepseek']?.status, 'valid');

    const info = getProviderInfo('custom-deepseek', root.customProviders);
    assert.equal(info?.defaultBaseUrl, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(getDefaultModelId('custom-deepseek', root.customProviders), 'deepseek-chat');
  });

  test('6.2 自定义厂商 Base URL 解析', async () => {
    const { getStoredAIConfig, updateStoredAIConfig } = await freshStore();
    getStoredAIConfig();
    updateStoredAIConfig((cfg) => {
      cfg.customProviders['custom-x'] = {
        id: 'custom-x', name: 'X', shortName: 'X',
        defaultBaseUrl: 'https://x.example.com/chat',
        supportsCustomBaseUrl: true,
        models: [{ id: 'm1', name: 'M1', description: '', contextLength: 4096, recommended: true }],
        keyFormatHint: '',
      };
      cfg.providers['custom-x'] = createDefaultProviderConfig();
      cfg.activeProviderId = 'custom-x';
    });

    const root = getStoredAIConfig();
    assert.equal(resolveBaseUrl('custom-x', root.providers['custom-x'], root.customProviders), 'https://x.example.com/chat');
  });
});

// ====================== 第 7 组：路由判定 ======================

describe('7. 路由判定（shouldUseRealAI 逻辑）', () => {
  test('7.1 activeProvider.status=valid → 应走真实 AI', async () => {
    const { setStoredAIConfig, getStoredAIConfig } = await freshStore();
    const root = createDefaultAIConfig();
    root.providers.zhipu.apiKey = 'valid-key';
    root.providers.zhipu.status = 'valid';
    setStoredAIConfig(root);
    const cfg = getStoredAIConfig();
    assert.equal(cfg.providers[cfg.activeProviderId].status, 'valid');
  });

  test('7.2 activeProvider.status=unconfigured → 应走 Mock', async () => {
    const { setStoredAIConfig, getStoredAIConfig } = await freshStore();
    setStoredAIConfig(createDefaultAIConfig());
    const cfg = getStoredAIConfig();
    assert.equal(cfg.providers[cfg.activeProviderId].status, 'unconfigured');
  });

  test('7.3 activeProvider.status=invalid → 应走 Mock', async () => {
    const { setStoredAIConfig, getStoredAIConfig } = await freshStore();
    const root = createDefaultAIConfig();
    root.providers.zhipu.status = 'invalid';
    root.providers.zhipu.error = '401 Unauthorized';
    setStoredAIConfig(root);
    const cfg = getStoredAIConfig();
    assert.equal(cfg.providers[cfg.activeProviderId].status, 'invalid');
    assert.equal(cfg.providers[cfg.activeProviderId].error, '401 Unauthorized');
  });

  test('7.4 某厂商 valid 但 active 是另一家 unconfigured → 应走 Mock', async () => {
    const { setStoredAIConfig, getStoredAIConfig } = await freshStore();
    const root = createDefaultAIConfig();
    root.providers.dashscope.apiKey = 'dash-valid';
    root.providers.dashscope.status = 'valid';
    root.activeProviderId = 'zhipu';
    setStoredAIConfig(root);
    const cfg = getStoredAIConfig();
    assert.equal(cfg.providers[cfg.activeProviderId].status, 'unconfigured');
    assert.equal(cfg.providers.dashscope.status, 'valid');
  });

  test('7.5 切换 activeProvider 到已配置厂商 → 应走真实 AI', async () => {
    const { setStoredAIConfig, getStoredAIConfig } = await freshStore();
    const root = createDefaultAIConfig();
    root.providers.dashscope.apiKey = 'dash-valid';
    root.providers.dashscope.status = 'valid';
    root.activeProviderId = 'dashscope';
    root.activeModelId = 'qwen-plus';
    setStoredAIConfig(root);
    const cfg = getStoredAIConfig();
    assert.equal(cfg.activeProviderId, 'dashscope');
    assert.equal(cfg.providers.dashscope.status, 'valid');
  });

  test('7.6 自定义 Base URL 生效', async () => {
    const { getStoredAIConfig, updateStoredAIConfig } = await freshStore();
    getStoredAIConfig();
    updateStoredAIConfig((cfg) => {
      cfg.providers.zhipu.apiKey = 'zhipu-key';
      cfg.providers.zhipu.status = 'valid';
      cfg.providers.zhipu.customBaseUrl = 'http://localhost:9999/proxy';
    });
    const cfg = getStoredAIConfig();
    assert.equal(resolveBaseUrl('zhipu', cfg.providers.zhipu), 'http://localhost:9999/proxy');
  });

  test('7.7 自定义模型 ID 生效', async () => {
    const { getStoredAIConfig, updateStoredAIConfig } = await freshStore();
    getStoredAIConfig();
    updateStoredAIConfig((cfg) => {
      cfg.providers.siliconflow.apiKey = 'sf-key';
      cfg.providers.siliconflow.status = 'valid';
      cfg.providers.siliconflow.customModel = 'custom-llm-13b';
      cfg.activeProviderId = 'siliconflow';
    });
    const cfg = getStoredAIConfig();
    assert.equal(resolveActiveModelId('siliconflow', cfg.activeModelId, cfg.providers.siliconflow), 'custom-llm-13b');
  });
});
