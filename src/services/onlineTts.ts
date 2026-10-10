/**
 * 在线语音合成（TTS）
 * ==================================================================
 * 为什么要有这一层
 * ------------------------------------------------------------------
 * 本机 Web Speech 的可用语音**完全取决于操作系统装了哪些语音包**。
 * 实测（Windows + Chromium 走 OneCore）：`getVoices()` 只返回 3 个 zh-CN
 * 语音，**一个英文语音都没有** —— 读英文原文只能拿中文语音硬念，发音必然不准。
 * 想让读音准，只能把发音交给云端 TTS 模型。
 *
 * 端点从哪来（关键设计）
 * ------------------------------------------------------------------
 * **不新增一套厂商配置**。各家 TTS 端点都是「对话端点把
 * `/chat/completions` 换成 `/audio/speech`」——
 *   智谱      https://open.bigmodel.cn/api/paas/v4/chat/completions
 *          → https://open.bigmodel.cn/api/paas/v4/audio/speech
 *   硅基流动  https://api.siliconflow.cn/v1/chat/completions
 *          → https://api.siliconflow.cn/v1/audio/speech
 * 所以直接从用户已经配好的厂商 `baseUrl` 派生：**一份 Key，对话与朗读共用**，
 * 用户不需要再学一套配置。自定义 baseUrl（含公司网关 / 第三方代理）自动跟随。
 *
 * CORS 事实（2026-10-10 实测，file:// 页面 = 发布形态）
 * ------------------------------------------------------------------
 *   智谱 /audio/speech、硅基 /v1/audio/speech  → 放行（res.type === 'cors'）
 *   OpenAI 官方 /v1/audio/speech、Anthropic    → 被拦（TypeError: Failed to fetch）
 * 即：发布成单文件 HTML 直接双击打开，智谱/硅基的在线朗读可用；OpenAI 官方
 * 端点不行，除非用户自配代理 baseUrl。
 */

export type TtsErrorKind = 'http' | 'network' | 'aborted' | 'format';

export class TtsError extends Error {
  constructor(
    public readonly kind: TtsErrorKind,
    message: string,
    public readonly status?: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'TtsError';
  }
}

export interface TtsVoiceOption {
  id: string;
  label: string;
}

/** 单个厂商的语音合成预置 */
export interface TtsProviderPreset {
  /** 默认模型 ID */
  model: string;
  /** 默认音色 ID */
  voice: string;
  /** 预置音色（空数组表示该厂商音色由用户自填） */
  voices: TtsVoiceOption[];
  /** 请求的 response_format（各厂商取值不同：智谱只有 wav/pcm，OpenAI 系有 mp3） */
  responseFormat: string;
  /** 单次请求 input 的字符上限（超长要分块，否则厂商直接 400） */
  inputLimit: number;
  /** UI 展示的备注 */
  note?: string;
}

/**
 * 厂商预置表。**只收录已核对过文档的厂商** —— 宁可让用户手填，
 * 也不塞一个猜的模型名进去（写错模型/音色 ID 会直接 400）。
 * 未收录的厂商（含自定义厂商）走「用户自填模型 + 音色」路径。
 */
export const TTS_PRESETS: Record<string, TtsProviderPreset> = {
  // 智谱 GLM-TTS。文档：https://docs.bigmodel.cn/api-reference/模型-api/文本转语音
  // 注意 input 上限 1024 字符、response_format 只有 wav/pcm（**没有 mp3**）。
  zhipu: {
    model: 'glm-tts',
    voice: 'tongtong',
    responseFormat: 'wav',
    inputLimit: 1024,
    voices: [
      { id: 'tongtong', label: '彤彤（默认·女声）' },
      { id: 'chuichui', label: '锤锤' },
      { id: 'xiaochen', label: '小陈' },
      { id: 'jam', label: 'Jam' },
      { id: 'kazi', label: 'Kazi' },
      { id: 'douji', label: '豆几' },
      { id: 'luodo', label: '罗多' },
    ],
    note: '跨中英日韩，支持情感与方言',
  },
  // 硅基流动：OpenAI 兼容端点 /v1/audio/speech
  siliconflow: {
    model: 'FunAudioLLM/CosyVoice2-0.5B',
    voice: 'anna',
    responseFormat: 'mp3',
    inputLimit: 3000,
    voices: [
      { id: 'alex', label: 'Alex' },
      { id: 'benjamin', label: 'Benjamin' },
      { id: 'charles', label: 'Charles' },
      { id: 'david', label: 'David' },
      { id: 'anna', label: 'Anna' },
      { id: 'bella', label: 'Bella' },
      { id: 'claire', label: 'Claire' },
      { id: 'diana', label: 'Diana' },
    ],
    note: 'CosyVoice2 预置 8 音色，中英日韩+方言',
  },
  // OpenAI 官方端点。从浏览器直连会被 CORS 拦（实测），
  // 要用得自配代理 baseUrl —— 预置留着，方便用户接代理后直接选。
  openai: {
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
    responseFormat: 'mp3',
    inputLimit: 4096,
    voices: [
      { id: 'alloy', label: 'Alloy' },
      { id: 'echo', label: 'Echo' },
      { id: 'fable', label: 'Fable' },
      { id: 'onyx', label: 'Onyx' },
      { id: 'nova', label: 'Nova' },
      { id: 'shimmer', label: 'Shimmer' },
    ],
    note: '官方端点浏览器直连被 CORS 拦，需自配代理 baseUrl',
  },
};

/** response_format → MIME（JSON base64 回包时要用） */
const FORMAT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pcm: 'audio/wav',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
};

export function mimeForFormat(format: string): string {
  return FORMAT_MIME[(format || '').toLowerCase()] || 'audio/mpeg';
}

/**
 * 对话端点 → 语音合成端点。
 *
 * 派生规则（按优先级）：
 *   1. 已经是 /audio/speech         → 原样返回
 *   2. 以 /chat/completions 结尾    → 换成 /audio/speech
 *   3. 以 /completions 结尾         → 换成 /audio/speech
 *   4. 其它（如只填了 https://host/v1）→ 追加 /audio/speech
 *
 * 空串返回空串（调用方据此判定"没得用"）。
 */
export function deriveSpeechEndpoint(baseUrl: string): string {
  const base = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  if (/\/audio\/speech$/i.test(base)) return base;
  if (/\/chat\/completions$/i.test(base)) return base.replace(/\/chat\/completions$/i, '/audio/speech');
  if (/\/completions$/i.test(base)) return base.replace(/\/completions$/i, '/audio/speech');
  return `${base}/audio/speech`;
}

/**
 * 按上限把长文本切成多段。策略：**先按句读边界切，再贪心装箱**，
 * 尽量不把一句话拦腰截断（TTS 在句中断开会明显改变语调）。
 * 单句本身就超限时只能硬切 —— 这是厂商 input 上限决定的，无法回避。
 */
export function splitForTts(text: string, limit: number): string[] {
  const t = (text || '').trim();
  if (!t) return [];
  const max = limit > 0 ? limit : t.length;
  if (t.length <= max) return [t];

  // 保留分隔符：句末标点与换行都算边界
  const pieces = t.match(/[^。！？!?；;…\n]*[。！？!?；;…\n]+|[^。！？!?；;…\n]+$/g) ?? [t];
  const out: string[] = [];
  let buf = '';
  const flush = () => {
    if (buf.trim()) out.push(buf);
    buf = '';
  };

  for (const piece of pieces) {
    if (buf && buf.length + piece.length > max) flush();
    if (piece.length <= max) {
      buf += piece;
      continue;
    }
    // 单句超限：先冲掉已积累的，再硬切
    flush();
    let rest = piece;
    while (rest.length > max) {
      out.push(rest.slice(0, max));
      rest = rest.slice(max);
    }
    buf = rest;
  }
  flush();
  return out;
}

export interface TtsTarget {
  providerId: string;
  endpoint: string;
  apiKey: string;
  model: string;
  voice: string;
  responseFormat: string;
  inputLimit: number;
}

/**
 * 组装一次调用的全部参数。任何一项缺失都返回 null（调用方据此退本机朗读）。
 * 纯函数 —— 不读 localStorage，配置由调用方传入，方便单测。
 */
export function buildTtsTarget(input: {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  voice?: string;
}): TtsTarget | null {
  const preset = TTS_PRESETS[input.providerId];
  const model = (input.model || preset?.model || '').trim();
  const voice = (input.voice || preset?.voice || '').trim();
  const endpoint = deriveSpeechEndpoint(input.baseUrl);
  const apiKey = (input.apiKey || '').trim();
  if (!endpoint || !apiKey || !model || !voice) return null;
  return {
    providerId: input.providerId,
    endpoint,
    apiKey,
    model,
    voice,
    responseFormat: preset?.responseFormat || 'mp3',
    inputLimit: preset?.inputLimit || 2000,
  };
}

/** 从 JSON 回包里挖出音频载荷（base64 或 URL）。挖不到返回 null。 */
const AUDIO_KEYS = ['data', 'audio', 'audio_base64', 'audioContent', 'result', 'url', 'file'];

function extractAudioPayload(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // 判据分两档，别用"字符串够不够长"来猜：
  //   - 从**已知音频字段**（data/audio/...）取到的字符串 → 一律认（短 base64 也认）
  //   - 其它位置上的裸字符串 → 只有像 URL / data URI 才认，避免误捡无关长文本
  const looksLikeAudio = (s: string) => /^https?:\/\//i.test(s) || /^data:audio\//i.test(s);

  const queue: Array<{ node: unknown; trusted: boolean }> = [{ node: parsed, trusted: false }];
  let guard = 0;
  while (queue.length > 0 && guard++ < 50) {
    const { node, trusted } = queue.shift()!;
    if (typeof node === 'string') {
      if (node.length === 0) continue;
      if (trusted || looksLikeAudio(node)) return node;
      continue;
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const obj = node as Record<string, unknown>;
      for (const k of AUDIO_KEYS) {
        if (k in obj) queue.push({ node: obj[k], trusted: true });
      }
    }
  }
  return null;
}

function base64ToBlob(b64: string, mime: string): Blob {
  const clean = b64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * 合成一段文本 → 音频 Blob。
 *
 * 兼容两种回包形态（不确定也无所谓，两种都吃）：
 *   - `Content-Type: audio/*`（或 octet-stream）→ 直接当二进制音频
 *   - JSON（部分厂商把音频塞进 base64 / URL 字段）→ 挖出来再转 Blob
 * 两者都不是 → 抛 `format` 错，由上层降级到本机朗读。
 */
export async function synthesizeSpeech(
  text: string,
  target: TtsTarget,
  signal?: AbortSignal
): Promise<Blob> {
  const body: Record<string, unknown> = {
    model: target.model,
    input: text,
    voice: target.voice,
  };
  if (target.responseFormat) body.response_format = target.responseFormat;

  let res: Response;
  try {
    res = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') throw new TtsError('aborted', 'aborted');
    throw new TtsError('network', e?.message || 'network error');
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new TtsError('http', `HTTP ${res.status}`, res.status, detail);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.startsWith('audio/') || contentType.includes('octet-stream')) {
    return await res.blob();
  }

  // 非音频 MIME：可能是 JSON（base64 / URL）
  let raw = '';
  try {
    raw = await res.text();
  } catch {
    throw new TtsError('format', 'unreadable body');
  }
  const payload = extractAudioPayload(raw);
  if (payload) {
    if (/^https?:\/\//i.test(payload)) {
      const r = await fetch(payload, { signal });
      if (!r.ok) throw new TtsError('http', `HTTP ${r.status}`, r.status);
      return await r.blob();
    }
    try {
      return base64ToBlob(payload, mimeForFormat(target.responseFormat));
    } catch {
      throw new TtsError('format', 'bad base64', undefined, raw.slice(0, 200));
    }
  }
  throw new TtsError('format', 'no audio in response', undefined, raw.slice(0, 200));
}
