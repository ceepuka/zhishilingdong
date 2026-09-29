/**
 * i18n · 厂商 / 型号的展示文案
 * ------------------------------------------------------------------
 * 为什么单独放这里：
 *   厂商名与型号描述属于"数据层"文案（在 types/aiProviders.ts 里），
 *   但它们会直接显示在配置面板。中文基准继续留在数据层（单一真实来源），
 *   英文只做**覆盖映射** —— 这样改中文不用动两份，漏翻则回落到原文。
 */

export interface ProviderDisplayName {
  name: string;
  shortName: string;
}

/** provider id → 英文展示名（zh 直接用数据层的中文） */
export const PROVIDER_NAME_EN: Record<string, ProviderDisplayName> = {
  zhipu: { name: 'Zhipu AI', shortName: 'Zhipu' },
  dashscope: { name: 'Alibaba Qwen', shortName: 'Qwen' },
  deepseek: { name: 'DeepSeek', shortName: 'DeepSeek' },
  moonshot: { name: 'Moonshot Kimi', shortName: 'Kimi' },
  siliconflow: { name: 'SiliconFlow', shortName: 'SiliconFlow' },
  openai: { name: 'OpenAI', shortName: 'OpenAI' },
  anthropic: { name: 'Anthropic', shortName: 'Claude' },
  gemini: { name: 'Google Gemini', shortName: 'Gemini' },
};

/** model id → 英文描述 */
export const MODEL_DESC_EN: Record<string, string> = {
  'glm-5.2': 'Zhipu latest flagship — 1M context, best for complex reasoning and long documents',
  'glm-5.1': 'Zhipu previous flagship — balanced capability and cost',
  'glm-4.7': 'Zhipu balanced general model — 200K context, stable for daily generation',
  'glm-4.7-flash': 'Zhipu free tier — very fast, good for high-frequency lightweight tasks',
  'qwen3.8-max': 'Qwen 3.8 flagship — 2.4T total / 950B active params, 1M context; best for complex tasks',
  'qwen3.7-max': 'Qwen 3.7 text-only flagship — 1.2T params, deep reasoning and long documents',
  'qwen3.7-plus': 'Qwen 3.7 balanced — versatile multimodal model, best value',
  'qwen3.8-flash': 'Qwen new-generation fast — high speed and low cost',
  'qwen3.7-flash': 'Qwen 3.7 lightweight — fast and low cost',
  'deepseek-v4-flash': 'DeepSeek V4 high-speed — 1M context, non-thinking by default, excellent value',
  'deepseek-v4-pro': 'DeepSeek V4 flagship — best for complex reasoning and long context',
  'deepseek-v4-flash-vision-exp': 'V4 Flash vision experiment — supports image understanding',
  'kimi-k3': 'Moonshot flagship — 2.8T params, 1M context, native vision; great for long docs and deep reasoning',
  'kimi-k2.6': 'Balanced general model — 256K context, stable on mixed tasks',
  'kimi-k2.7-code': 'K2.7 code-specialized — more reliable long-context coding',
  'kimi-k2.7-code-highspeed': 'K2.7 high-speed code — ~180 tokens/s, good for interactive programming',
  'deepseek-ai/DeepSeek-V4-Flash': 'DeepSeek V4 Flash hosted by SiliconFlow — no proxy needed, low price',
  'deepseek-ai/DeepSeek-V3': 'Open-source flagship MoE — strong reasoning and coding',
  'Qwen/Qwen2.5-72B-Instruct': 'Open-source Qwen 72B — stable on general tasks',
  'Qwen/Qwen2.5-7B-Instruct': 'Lightweight open-source Qwen — fast with low latency',
  'deepseek-ai/DeepSeek-R1': 'Open-source reinforced reasoning with chain-of-thought — best for math / code / logic',
  'meta-llama/Llama-3.1-8B-Instruct': 'Meta open-source model — general multilingual use',
  'gpt-5.2': 'OpenAI current flagship — strongest overall (science / coding / writing)',
  'gpt-5.1': 'Previous GPT-5 tier — balanced capability and cost',
  'gpt-5-mini': 'GPT-5 lightweight — fast and low cost',
  'gpt-5-nano': 'GPT-5 lightest — extremely fast response at the lowest cost',
  'claude-opus-5': 'Anthropic top-tier flagship — strongest overall capability',
  'claude-sonnet-5': 'Anthropic flagship — best for deep reasoning and long-document analysis',
  'claude-haiku-4-5': 'Lightweight — extremely fast response at low cost',
  'gemini-3.5-flash': 'Google current stable flagship — leading multimodal understanding and long context',
  'gemini-3.5-flash-lite': 'Fast light edition — low latency and high value; a good default for daily tasks',
  'gemini-3.7-flash': 'Short-cycle enhanced — stronger multi-step reasoning and coding',
};

/** 取厂商展示名：中文用数据层的，其他语言用英文覆盖映射 */
export function localizedProviderName(
  providerId: string,
  base: ProviderDisplayName,
  language: string,
): ProviderDisplayName {
  if (language === 'zh') return base;
  return PROVIDER_NAME_EN[providerId] ?? base;
}

/** 取型号描述：中文用数据层的，其他语言用英文覆盖映射 */
export function localizedModelDescription(modelId: string, base: string, language: string): string {
  if (language === 'zh') return base;
  return MODEL_DESC_EN[modelId] ?? base;
}
