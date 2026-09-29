/**
 * AI 多模型 / 多厂商 类型定义（v3 — 能力感知版）
 * ------------------------------------------------------------------
 * 内置预设厂商（8 家）：
 *   国内：智谱AI(zhipu)、阿里通义千问(dashscope)、硅基流动(siliconflow)、
 *         DeepSeek(deepseek)、Moonshot Kimi(moonshot)
 *   国际：OpenAI(openai)、Anthropic(anthropic)、Google Gemini(gemini)
 * 用户可添加自定义厂商（任何 OpenAI 兼容 API），存储在 customProviders 中
 *
 * v3 相对 v2 的关键变化：型号元数据带上"能力画像"（capabilities）。
 * 生成质量不只取决于提示词，更取决于模型能力边界：
 *   - 输出预算给超过模型上限 → 厂商直接 400，整段内容丢失
 *   - 给不支持流式的模型发 stream:true → 白等一轮再降级
 *   - 给推理型模型传 temperature → 部分厂商直接报错
 *   - 支持 JSON 强约束的模型不开 response_format → 白白多一层格式风险
 * 因此这些能力由配置层声明，请求层按能力裁剪参数，UI 层给出选型提示。
 */

export type ProviderId = string;

export type ApiKeyStatus = 'unconfigured' | 'configuring' | 'valid' | 'invalid';

export type AIDepth = 'max' | 'high' | 'medium';

/** 型号档位：影响 UI 选型建议与默认输出预算 */
export type ModelTier = 'flagship' | 'balanced' | 'light';

/** 单次请求里 max_tokens 用哪个字段名（OpenAI o 系列只认 max_completion_tokens） */
export type MaxTokensParam = 'max_tokens' | 'max_completion_tokens';

/**
 * 型号能力画像。
 * 未知型号（自定义模型 ID / 自定义厂商）一律走 DEFAULT_MODEL_CAPABILITIES 的保守值。
 */
export interface ModelCapabilities {
  /** 支持 SSE 流式输出 */
  streaming: boolean;
  /** 支持 response_format:{type:'json_object'} 强约束 */
  jsonMode: boolean;
  /** 推理/思考型模型：temperature 通常被忽略甚至报错，且需要更大输出预算 */
  reasoning: boolean;
  /** 单次输出 token 上限（保守值，宁小勿大 —— 超限会被厂商 400 拒绝） */
  maxOutputTokens: number;
  /** 多模态（能理解图片输入），本项目当前仅作展示 */
  vision?: boolean;
  /** 输出预算字段名，默认 max_tokens */
  maxTokensParam?: MaxTokensParam;
}

/** 单个型号元数据 */
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  recommended: boolean;
  /** 档位：旗舰 / 均衡 / 轻量（省略时按 balanced 处理） */
  tier?: ModelTier;
  /** 能力画像（缺省时回落到保守默认值） */
  capabilities?: Partial<ModelCapabilities>;
}

/** 单个厂商元数据 */
export interface ProviderInfo {
  id: string;
  name: string;
  shortName: string;
  defaultBaseUrl: string;
  supportsCustomBaseUrl: boolean;
  models: ModelInfo[];
  keyFormatHint: string;
  docsUrl?: string;
}

/** 单个厂商的持久化配置 */
export interface ProviderConfig {
  apiKey: string;
  status: ApiKeyStatus;
  error: string;
  customBaseUrl: string;
  customModel: string;
}

/** 多模型配置根结构（v2 — 存入 LocalStorage） */
export interface AIConfigRoot {
  version: 2;
  activeProviderId: string;
  activeModelId: string;
  providers: Record<string, ProviderConfig>;
  customProviders: Record<string, ProviderInfo>;
}

// ============== 能力默认值 ==============

/**
 * 未知型号（用户手填的自定义模型 ID、自定义厂商里的型号）的保守能力画像。
 * 保守原则：不假设流式一定可用（但允许尝试一次）、不开 JSON 强约束、
 * 输出预算压到 4096（绝大多数模型都吃得下）。
 */
export const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  streaming: true,
  jsonMode: false,
  reasoning: false,
  // 由 4096 提升到 16384：兜底防止未知/自定义模型把 max_tokens 压得太狠，撞上限后被截断
  // （具体厂商的旗舰能力画像会进一步放宽，详见各 provider 的 models 列表）
  maxOutputTokens: 16384,
  vision: false,
  maxTokensParam: 'max_tokens',
};

/** 兜底：即便 capabilities 只填了一部分，也补全成完整画像 */
export function fillCapabilities(partial?: Partial<ModelCapabilities>): ModelCapabilities {
  return { ...DEFAULT_MODEL_CAPABILITIES, ...(partial ?? {}) };
}

// ============== 厂商与型号元数据（单一真实来源 — 预设层） ==============

export const PROVIDER_META: Record<string, ProviderInfo> = {
  zhipu: {
    id: 'zhipu',
    name: '智谱AI',
    shortName: '智谱',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入智谱 API Key（通常以 2024xxxx 或一串字母数字开头）',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
    models: [
      {
        // 2026-09 核对：智谱当前旗舰是 GLM-5.x 系列（glm-5.2 最新、glm-5.1 上一代），
        // 通用/均衡用 glm-4.7；旧名 glm-4-plus / glm-z1-air 已失效，勿再使用。
        // 思考能力：GLM-5.2/5.1 默认"自动判断是否思考"（reasoning=true），GLM-4.7 强制思考。
        // 本项目在 prepareRequest 里对 zhipu 发 thinking:{type:'disabled'} 显式关闭，
        // 避免思维链吃掉 max_tokens 预算导致正文 JSON 截断（"生成失败"的隐蔽来源）。
        id: 'glm-5.2',
        name: 'GLM-5.2',
        description: '智谱最新旗舰，1M 上下文，复杂推理与长文档首选',
        contextLength: 1_000_000,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384 },
      },
      {
        id: 'glm-5.1',
        name: 'GLM-5.1',
        description: '智谱上一代旗舰，能力与成本均衡',
        contextLength: 1_000_000,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384 },
      },
      {
        id: 'glm-4.7',
        name: 'GLM-4.7',
        description: '智谱通用均衡版，200K 上下文，日常生成稳定',
        contextLength: 200_000,
        recommended: false,
        tier: 'balanced',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384 },
      },
      {
        id: 'glm-4.7-flash',
        name: 'GLM-4.7-Flash',
        description: '智谱免费档，速度快，适合高频轻量任务',
        contextLength: 200_000,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384 },
      },
    ],
  },
  dashscope: {
    id: 'dashscope',
    name: '阿里通义千问',
    shortName: '千问',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入 DashScope API Key（sk-xxxx 格式）',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/',
    models: [
      {
        // 2026-09 核对：qwen3.8-max（2026-08 发布）是当前千问能力天花板。
        // 这里把"安全预算"设为 32K（已经足够装下系统 JSON 且不撞限）。
        // Qwen3 系列默认开启深度思考——本项目 prepareRequest 对 dashscope 发
        // enable_thinking:false 关闭（避免思维链吃掉正文 JSON 预算导致截断）。
        // reasoning:true 用于让 getDepthConfig 不传 temperature（推理模型会忽略/拒绝）。
        id: 'qwen3.8-max',
        name: 'Qwen3.8-Max',
        description: '千问 Qwen3.8 旗舰，2.4T 总参/950B 激活，1M 上下文，复杂任务首选',
        contextLength: 1_048_576,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 32_768, vision: true },
      },
      {
        id: 'qwen3.7-max',
        name: 'Qwen3.7-Max',
        description: '千问 Qwen3.7 纯文本旗舰，1.2T 总参，深度推理/长文档',
        contextLength: 1_048_576,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 32_768 },
      },
      {
        id: 'qwen3.7-plus',
        name: 'Qwen3.7-Plus',
        description: '千问 Qwen3.7 均衡版，多模态全能，性价比最高',
        contextLength: 1_048_576,
        recommended: false,
        tier: 'balanced',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 32_768, vision: true },
      },
      {
        id: 'qwen3.8-flash',
        name: 'Qwen3.8-Flash',
        description: '千问新一代极速版，速度快、成本低',
        contextLength: 1_048_576,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'qwen3.7-flash',
        name: 'Qwen3.7-Flash',
        description: '千问 Qwen3.7 轻量版，速度快、成本低',
        contextLength: 1_048_576,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384, vision: true },
      },
    ],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: '深度求索',
    defaultBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入 DeepSeek API Key（sk-xxxx 格式）',
    docsUrl: 'https://api-docs.deepseek.com/',
    models: [
      {
        // 2026-07-24 起 `deepseek-chat` / `deepseek-reasoner` 已退役，
        // 正确名称是 deepseek-v4-flash（默认/非思考）和 deepseek-v4-pro（更强推理/编码），
        // 真实最大输出 384K。这里把"安全预算"压到 32K（已经能完整装下系统 JSON）。
        id: 'deepseek-v4-flash',
        name: 'DeepSeek-V4-Flash',
        description: 'DeepSeek V4 高速版，1M 上下文，默认非思考模式，性价比首选',
        contextLength: 1_048_576,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 32_768 },
      },
      {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek-V4-Pro',
        description: 'DeepSeek V4 旗舰，复杂推理/长上下文首选',
        contextLength: 1_048_576,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 32_768 },
      },
      {
        id: 'deepseek-v4-flash-vision-exp',
        name: 'DeepSeek-V4-Flash-Vision-Exp',
        description: 'V4 Flash 视觉实验版，支持图片理解',
        contextLength: 1_048_576,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 32_768, vision: true },
      },
    ],
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot Kimi',
    shortName: 'Kimi',
    // 2026 起 API 域名从 api.moonshot.cn 迁到 api.moonshot.ai；旧域名仍可访问但官方推荐新域名
    defaultBaseUrl: 'https://api.moonshot.ai/v1/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入 Moonshot API Key（sk-xxxx 格式）',
    docsUrl: 'https://platform.kimi.com/docs',
    models: [
      {
        // 2026-08-31 起 kimi-k2.5 与整个 moonshot-v1 系列已下线（404）。
        // 当前代：kimi-k3（2.8T 总参 / 原生视觉 / 思考模式默认开）。
        id: 'kimi-k3',
        name: 'Kimi K3',
        description: 'Moonshot 旗舰，2.8T 总参、1M 上下文、原生视觉，长文档/深度推理首选',
        contextLength: 1_048_576,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'kimi-k2.6',
        name: 'Kimi K2.6',
        description: '通用均衡版，256K 上下文，中文综合任务稳定',
        contextLength: 262_144,
        recommended: false,
        tier: 'balanced',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'kimi-k2.7-code',
        name: 'Kimi K2.7-Code',
        description: 'K2.7 代码专用版，长上下文编码更可靠',
        contextLength: 262_144,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384 },
      },
      {
        id: 'kimi-k2.7-code-highspeed',
        name: 'Kimi K2.7-Code-Highspeed',
        description: 'K2.7 代码高速版，输出约 180 tokens/s，适合交互式编程',
        contextLength: 262_144,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384 },
      },
    ],
  },
  siliconflow: {
    id: 'siliconflow',
    name: '硅基流动',
    shortName: '硅基',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入 SiliconFlow API Key（sk-xxxx 格式）',
    docsUrl: 'https://docs.siliconflow.cn/',
    models: [
      {
        // 2026-08 后硅基流动也上线了 DeepSeek V4 Flash，这里补上
        id: 'deepseek-ai/DeepSeek-V4-Flash',
        name: 'DeepSeek-V4-Flash（硅基）',
        description: '硅基流动托管的 DeepSeek V4 Flash，免代理、价格低',
        contextLength: 1_048_576,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384 },
      },
      {
        id: 'deepseek-ai/DeepSeek-V3',
        name: 'DeepSeek-V3',
        description: '开源旗舰 MoE，推理与代码能力强',
        contextLength: 64_000,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384 },
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen2.5-72B-Instruct',
        description: '通义千问开源 72B，中文与综合任务稳定',
        contextLength: 32_768,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384 },
      },
      {
        id: 'Qwen/Qwen2.5-7B-Instruct',
        name: 'Qwen2.5-7B-Instruct',
        description: '通义千问轻量开源，速度快、延迟低',
        contextLength: 32_768,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: false, reasoning: false, maxOutputTokens: 8_192 },
      },
      {
        id: 'deepseek-ai/DeepSeek-R1',
        name: 'DeepSeek-R1',
        description: '强化推理开源版，含思维链，数学/代码/逻辑首选',
        contextLength: 64_000,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384 },
      },
      {
        id: 'meta-llama/Llama-3.1-8B-Instruct',
        name: 'Llama-3.1-8B-Instruct',
        description: 'Meta 官方开源，多语言通用',
        contextLength: 131_072,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: false, reasoning: false, maxOutputTokens: 8_192 },
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入 OpenAI API Key（sk-xxxx 格式）',
    docsUrl: 'https://platform.openai.com/docs/',
    models: [
      {
        // 2026-09 核对：OpenAI 当前旗舰是 gpt-5.2（gpt-5.1 / gpt-5 / gpt-5-mini 仍可用）。
        // gpt-4.1-mini、o3-mini 等已 deprecated，不再收录。
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        description: 'OpenAI 当前旗舰，综合能力最强（科学/编程/写作）',
        contextLength: 256_000,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'gpt-5.1',
        name: 'GPT-5.1',
        description: 'GPT-5 系列上一档，能力与成本平衡',
        contextLength: 256_000,
        recommended: false,
        tier: 'balanced',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5-Mini',
        description: 'GPT-5 轻量版，速度快、成本低',
        contextLength: 256_000,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'gpt-5-nano',
        name: 'GPT-5-Nano',
        description: 'GPT-5 最轻量版，极速响应、最低成本',
        contextLength: 256_000,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    shortName: 'Claude',
    // Anthropic 的 OpenAI 兼容端点。官方 SDK 兼容层支持 /v1/chat/completions；
    // 若你的账号/区域走不通，可把 baseUrl 改成官方原生端点 https://api.anthropic.com/v1/messages，
    // 并在请求层换 x-api-key + anthropic-version 头（需要扩展 ProviderOverlay）。
    defaultBaseUrl: 'https://api.anthropic.com/v1/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入 Anthropic API Key（sk-ant-xxxx 格式）',
    docsUrl: 'https://docs.anthropic.com/',
    models: [
      {
        // 2026-09 核对：Claude 当前主力为 Fable 5（长程 Agent）、Opus 5（2026-07-24 发布）、
        // Sonnet 5、Haiku 4.5；3.x / 4.x 早代已退役。官方模型页把 Opus 5 列为"不确定选哪个时的起点"。
        id: 'claude-opus-5',
        name: 'Claude Opus 5',
        description: 'Anthropic 顶级旗舰，最强综合能力',
        contextLength: 1_000_000,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: false, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'claude-sonnet-5',
        name: 'Claude Sonnet 5',
        description: '主力均衡版，深度推理与长文档分析首选',
        contextLength: 1_000_000,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: false, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        description: '轻量版，极速响应、低成本',
        contextLength: 200_000,
        recommended: false,
        tier: 'light',
        capabilities: { streaming: true, jsonMode: false, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    supportsCustomBaseUrl: true,
    keyFormatHint: '请输入 Google AI API Key（AIzaxxxx 格式）',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    models: [
      {
        // 2026-09 核对：Gemini 2.5 Pro/Flash 将于 2026-10-20 退役，
        // 当前稳定款为 Gemini 3.5 Flash / 3.5 Flash-Lite（3.6/3.7 Flash 为短周期更新）。
        // 这里收录稳定档，避免 preview/短周期型号导致不稳定。
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        description: 'Google 当前稳定旗舰，多模态理解与长上下文领先',
        contextLength: 1_000_000,
        recommended: true,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'gemini-3.5-flash-lite',
        name: 'Gemini 3.5 Flash-Lite',
        description: '快速轻量版，低延迟、高性价比，日常任务首选',
        contextLength: 1_000_000,
        recommended: false,
        tier: 'balanced',
        capabilities: { streaming: true, jsonMode: true, reasoning: false, maxOutputTokens: 16_384, vision: true },
      },
      {
        id: 'gemini-3.7-flash',
        name: 'Gemini 3.7 Flash',
        description: '短周期增强版，复杂多步推理与代码更强',
        contextLength: 1_000_000,
        recommended: false,
        tier: 'flagship',
        capabilities: { streaming: true, jsonMode: true, reasoning: true, maxOutputTokens: 16_384, vision: true },
      },
    ],
  },
};

/** 预设厂商 ID 列表（动态派生） */
export const ALL_PROVIDER_IDS: string[] = Object.keys(PROVIDER_META);

// ============== 默认值工厂 ==============

export function createDefaultProviderConfig(): ProviderConfig {
  return {
    apiKey: '',
    status: 'unconfigured',
    error: '',
    customBaseUrl: '',
    customModel: '',
  };
}

export function createDefaultAIConfig(): AIConfigRoot {
  return {
    version: 2,
    activeProviderId: 'zhipu',
    activeModelId: getDefaultModelId('zhipu'),
    // 从 PROVIDER_META 动态生成，未来新增预设厂商自动出现在这里
    providers: Object.fromEntries(
      Object.keys(PROVIDER_META).map(id => [id, createDefaultProviderConfig()])
    ),
    customProviders: {},
  };
}

// ============== 辅助函数（预设 + 自定义合并查询） ==============

/** 根据 id 取其元数据（先查预设，再查自定义） */
export function getProviderInfo(
  id: string,
  customProviders?: Record<string, ProviderInfo>
): ProviderInfo | undefined {
  return PROVIDER_META[id] ?? customProviders?.[id];
}

/** 根据 providerId + modelId 取型号元数据 */
export function getModelInfo(
  providerId: string,
  modelId: string,
  customProviders?: Record<string, ProviderInfo>
): ModelInfo | undefined {
  return getProviderInfo(providerId, customProviders)?.models.find(m => m.id === modelId);
}

/** 取 provider 的默认模型（第一个 recommended 或第一个） */
export function getDefaultModelId(
  providerId: string,
  customProviders?: Record<string, ProviderInfo>
): string {
  const info = getProviderInfo(providerId, customProviders);
  if (!info || !info.models.length) return '';
  const rec = info.models.find(m => m.recommended);
  return rec ? rec.id : info.models[0].id;
}

/** 解析出实际使用的 model id（考虑 customModel 覆盖） */
export function resolveActiveModelId(
  providerId: string,
  activeModelId: string,
  cfg: ProviderConfig,
  customProviders?: Record<string, ProviderInfo>
): string {
  if (cfg.customModel && cfg.customModel.trim()) {
    return cfg.customModel.trim();
  }
  const known = getModelInfo(providerId, activeModelId, customProviders);
  return known ? activeModelId : getDefaultModelId(providerId, customProviders);
}

/** 解析实际使用的 API base URL */
export function resolveBaseUrl(
  providerId: string,
  cfg: ProviderConfig,
  customProviders?: Record<string, ProviderInfo>
): string {
  if (cfg.customBaseUrl && cfg.customBaseUrl.trim()) {
    return cfg.customBaseUrl.trim();
  }
  return getProviderInfo(providerId, customProviders)?.defaultBaseUrl ?? '';
}

// ============== 能力查询 ==============

/**
 * 取某个型号的能力画像。
 * 查不到（自定义模型 ID / 未收录型号）时返回保守默认值，
 * 保证请求参数永远落在"大多数模型都吃得下"的安全区。
 */
export function getModelCapabilities(
  providerId: string,
  modelId: string,
  customProviders?: Record<string, ProviderInfo>,
  cfg?: ProviderConfig
): ModelCapabilities {
  const resolved = cfg
    ? resolveActiveModelId(providerId, modelId, cfg, customProviders)
    : modelId;
  const info = getModelInfo(providerId, resolved, customProviders);
  return fillCapabilities(info?.capabilities);
}

/** 型号档位（未知型号按 balanced 处理） */
export function getModelTier(
  providerId: string,
  modelId: string,
  customProviders?: Record<string, ProviderInfo>,
  cfg?: ProviderConfig
): ModelTier {
  const resolved = cfg
    ? resolveActiveModelId(providerId, modelId, cfg, customProviders)
    : modelId;
  return getModelInfo(providerId, resolved, customProviders)?.tier ?? 'balanced';
}

/**
 * 生成一段人类可读的能力提示，供 UI 展示 / 选型建议。
 * 例："流式 · JSON强约束 · 推理型 · 视觉 · 输出上限 8K"
 *
 * 注意：
 *   - jsonMode:false 不代表"不能返回 JSON"，而是"不强制 response_format"——
 *     小模型实际可能偶发不闭合 JSON，因此保守关闭，靠提示词约束
 *   - 推理型（reasoning）通常需要更大输出预算，UI 选型建议会优先旗舰
 */
export function describeCapabilities(caps: ModelCapabilities): string {
  const parts: string[] = [];
  parts.push(caps.streaming ? '流式' : '非流式');
  if (caps.jsonMode) parts.push('JSON强约束');
  if (caps.reasoning) parts.push('推理型');
  if (caps.vision) parts.push('视觉');
  parts.push(`输出上限 ${caps.maxOutputTokens >= 1000 ? `${Math.round(caps.maxOutputTokens / 1000)}K` : caps.maxOutputTokens}`);
  return parts.join(' · ');
}
