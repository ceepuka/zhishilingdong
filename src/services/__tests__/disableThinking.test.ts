/**
 * 「关闭思考模式」参数分派的契约测试。
 *
 * 背景（真实故障）：智谱 GLM-5.2 默认开启深度思考（thinking 默认 enabled、reasoning_effort 默认 max），
 * 会先输出大段 reasoning_content（思维链），思维链吃掉 max_tokens 预算后正文 JSON 被截断
 * （finish_reason=length）→ 续写也失败 → 最终"生成失败"。千问正常是因为它发了 enable_thinking:false。
 *
 * 契约：不同厂商用**各自的**关闭思考参数名（传错会 400）：
 *   - dashscope / siliconflow → enable_thinking: false
 *   - zhipu → thinking: { type: 'disabled' }（⚠️ 传 thinking:false 会 400）
 *   其他厂商（deepseek/openai 等）→ 不注入（走各自默认，避免未知字段被网关 400）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAIProvider } from '../baseAIProvider';
import type { AIConfigRoot, ProviderConfig } from '../../types/aiProviders';

// mock useAIConfigStore：getStoredAIConfig 返回可控的配置
const mockGetStoredAIConfig = vi.fn();
vi.mock('../../hooks/useAIConfigStore', () => ({
  getStoredAIConfig: (...args: unknown[]) => mockGetStoredAIConfig(...args),
}));

// mock useLanguageStore：getAIContentLanguage 返回 'zh'
vi.mock('../../hooks/useLanguageStore', () => ({
  getAIContentLanguage: () => 'zh',
}));

function makeConfig(providerId: string, modelId: string): AIConfigRoot {
  const providers: Record<string, ProviderConfig> = {};
  // 所有预设厂商都给一个 valid 的 key（prepareRequest 会 requireApiKey）
  for (const pid of ['zhipu', 'dashscope', 'siliconflow', 'deepseek', 'openai', 'anthropic', 'gemini', 'moonshot']) {
    providers[pid] = { apiKey: 'test-key', status: 'valid', error: '', customBaseUrl: '', customModel: '' };
  }
  return {
    version: 2,
    activeProviderId: providerId,
    activeModelId: modelId,
    providers,
    customProviders: {},
  };
}

/** 构造指定厂商的 provider 子类，暴露 prepareRequest */
function makeProvider(providerId: string) {
  return new (class extends BaseAIProvider {
    protected getProviderId(): string { return providerId; }
  })();
}

describe('关闭思考模式参数分派（智谱生成失败的根因修复）', () => {
  beforeEach(() => {
    mockGetStoredAIConfig.mockReset();
  });

  it('智谱 zhipu → 注入 thinking:{type:"disabled"}（不能用 enable_thinking，传 thinking:false 会 400）', () => {
    mockGetStoredAIConfig.mockReturnValue(makeConfig('zhipu', 'glm-5.2'));
    const p = makeProvider('zhipu');
    const req = (p as any).prepareRequest('测试', 'sys', 'high', true);
    expect(req.payload.thinking).toEqual({ type: 'disabled' });
    // 不应注入 enable_thinking（那是千问的参数名，智谱不认）
    expect(req.payload.enable_thinking).toBeUndefined();
    // 推理型模型不传 temperature（reasoning:true 声明）
    expect(req.payload.temperature).toBeUndefined();
  });

  it('千问 dashscope → 注入 enable_thinking:false（不注入 thinking）', () => {
    mockGetStoredAIConfig.mockReturnValue(makeConfig('dashscope', 'qwen3.8-max'));
    const p = makeProvider('dashscope');
    const req = (p as any).prepareRequest('测试', 'sys', 'high', true);
    expect(req.payload.enable_thinking).toBe(false);
    expect(req.payload.thinking).toBeUndefined();
  });

  it('硅基流动 siliconflow → 注入 enable_thinking:false', () => {
    mockGetStoredAIConfig.mockReturnValue(makeConfig('siliconflow', 'deepseek-ai/DeepSeek-V4-Flash'));
    const p = makeProvider('siliconflow');
    const req = (p as any).prepareRequest('测试', 'sys', 'high', true);
    expect(req.payload.enable_thinking).toBe(false);
  });

  it('未列入的厂商（deepseek/openai）→ 不注入任何关闭思考参数（避免未知字段 400）', () => {
    mockGetStoredAIConfig.mockReturnValue(makeConfig('deepseek', 'deepseek-v4-flash'));
    const p = makeProvider('deepseek');
    const req = (p as any).prepareRequest('测试', 'sys', 'high', true);
    expect(req.payload.thinking).toBeUndefined();
    expect(req.payload.enable_thinking).toBeUndefined();
  });

  it('智谱 reasoning 声明为 true → 不传 temperature（推理型模型会忽略/拒绝）', () => {
    mockGetStoredAIConfig.mockReturnValue(makeConfig('zhipu', 'glm-5.2'));
    const p = makeProvider('zhipu');
    const req = (p as any).prepareRequest('测试', 'sys', 'high', true);
    expect(req.payload.temperature).toBeUndefined();
    // max_tokens 仍按深度配置给足预算
    expect(typeof req.payload.max_tokens).toBe('number');
    expect((req.payload.max_tokens as number) >= 8192).toBe(true);
  });
});
