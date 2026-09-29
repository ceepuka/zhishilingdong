/**
 * 自定义厂商模板
 * ------------------------------------------------------------------
 * 为什么需要：
 *   "自定义厂商"要求用户自己填名称 / Base URL / API Key / 模型 ID —— 门槛不低。
 *   而现实中绝大多数人是在复刻某个已知服务（OpenAI 官方、OpenRouter 聚合、
 *   硅基流动、智谱，或公司内部网关）。把最常见的几种做成模板，一键带入即可。
 *
 * 设计要点：
 *   - 模板只提供**预填值**，用户仍可自由修改（不是锁定）
 *   - 模型 ID 给的是"当前可用的典型值"，用户可按需删改
 *   - 不预置 Key —— 密钥永远要用户自己填
 *
 * 多语言：本文件只放**与语言无关**的结构数据（端点、模型 ID），
 * 展示用的 label / hint 全部走 i18n（`localizedTemplates(s)`）。
 */

import type { Strings } from '../../i18n/strings';

export interface ProviderTemplate {
  /** 模板唯一 id（同时是 i18n key） */
  id: string;
  /** 预填厂商名称 */
  name: string;
  /** 预填 Base URL（OpenAI 兼容的 chat/completions 端点） */
  baseUrl: string;
  /** 预填模型 ID 列表（第一个为默认） */
  models: string[];
  /** Base URL 是否可/需要修改（官方服务一般固定，自建网关才需要改） */
  editableBaseUrl: boolean;
}

export interface LocalizedProviderTemplate extends ProviderTemplate {
  /** 模板展示名 */
  label: string;
  /** 一句话说明这个模板适合什么场景 */
  hint: string;
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-5.2', 'gpt-5.1', 'gpt-5-mini'],
    editableBaseUrl: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'anthropic/claude-sonnet-5',
      'openai/gpt-5.2',
      'google/gemini-3.5-flash',
      'deepseek/deepseek-v4-flash',
    ],
    editableBaseUrl: false,
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    models: [
      'deepseek-ai/DeepSeek-V4-Flash',
      'Qwen/Qwen2.5-72B-Instruct',
      'deepseek-ai/DeepSeek-R1',
    ],
    editableBaseUrl: false,
  },
  {
    id: 'dashscope',
    name: '阿里百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['qwen3.8-max', 'qwen3.7-plus', 'qwen3.7-flash'],
    editableBaseUrl: false,
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: ['glm-5.2', 'glm-4.7', 'glm-4.7-flash'],
    editableBaseUrl: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    editableBaseUrl: false,
  },
  {
    id: 'ollama',
    name: '本地 Ollama',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    models: ['qwen2.5:14b', 'llama3.1:8b'],
    editableBaseUrl: true,
  },
  {
    id: 'custom',
    name: '',
    baseUrl: '',
    models: [],
    editableBaseUrl: true,
  },
];

/** 模板 id → 文案映射（i18n） */
type TemplateText = { name: string; label: string; hint: string };

export function localizedTemplates(s: Strings): LocalizedProviderTemplate[] {
  const text = s.templates as unknown as Record<string, TemplateText>;
  return PROVIDER_TEMPLATES.map((t) => ({
    ...t,
    name: text[t.id]?.name ?? t.name,
    label: text[t.id]?.label ?? t.id,
    hint: text[t.id]?.hint ?? '',
  }));
}
