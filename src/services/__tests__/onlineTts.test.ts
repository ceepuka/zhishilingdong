/**
 * onlineTts —— 在线语音合成的纯逻辑回归锁。
 *
 * 这里守的是三个"看起来不起眼、错了就整条链路废掉"的点：
 *   ① 端点派生：智谱/硅基/OpenAI 都是「对话端点换后缀」。派生错了 → 404。
 *   ② 文本分块：智谱 input 上限 1024，超长直接 400；分块还必须**不丢字**。
 *   ③ 回包解析：二进制音频与 JSON(base64) 两种形态都要吃，否则"生成了但播不出"。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deriveSpeechEndpoint,
  splitForTts,
  buildTtsTarget,
  synthesizeSpeech,
  mimeForFormat,
  TtsError,
  TTS_PRESETS,
} from '../onlineTts';

describe('deriveSpeechEndpoint — 对话端点 → 语音端点', () => {
  it('把 /chat/completions 换成 /audio/speech（智谱）', () => {
    expect(deriveSpeechEndpoint('https://open.bigmodel.cn/api/paas/v4/chat/completions')).toBe(
      'https://open.bigmodel.cn/api/paas/v4/audio/speech'
    );
  });

  it('把 /chat/completions 换成 /audio/speech（硅基流动）', () => {
    expect(deriveSpeechEndpoint('https://api.siliconflow.cn/v1/chat/completions')).toBe(
      'https://api.siliconflow.cn/v1/audio/speech'
    );
  });

  it('已经是 /audio/speech 时原样返回（幂等）', () => {
    const url = 'https://open.bigmodel.cn/api/paas/v4/audio/speech';
    expect(deriveSpeechEndpoint(url)).toBe(url);
  });

  it('只填到 /v1 的 baseUrl → 追加 /audio/speech', () => {
    expect(deriveSpeechEndpoint('https://proxy.example.com/v1')).toBe(
      'https://proxy.example.com/v1/audio/speech'
    );
  });

  it('末尾多余斜杠不产生双斜杠', () => {
    expect(deriveSpeechEndpoint('https://api.siliconflow.cn/v1/')).toBe(
      'https://api.siliconflow.cn/v1/audio/speech'
    );
  });

  it('空值返回空串（调用方据此判定"没得用"）', () => {
    expect(deriveSpeechEndpoint('')).toBe('');
    expect(deriveSpeechEndpoint('   ')).toBe('');
  });
});

describe('splitForTts — 按厂商 input 上限分块', () => {
  it('不超限时原样一段', () => {
    expect(splitForTts('你好，世界。', 1024)).toEqual(['你好，世界。']);
  });

  it('空文本 → 空数组', () => {
    expect(splitForTts('   ', 1024)).toEqual([]);
  });

  it('优先在句读边界切，每块都不超限', () => {
    const text = '第一句话。第二句话！第三句话？第四句话；第五句话。';
    const chunks = splitForTts(text, 12);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(12);
  });

  it('分块绝不丢字（拼回去等于原文）', () => {
    const text =
      '加速度是描述速度变化快慢的物理量。它的定义式是 a = Δv / Δt，单位是米每二次方秒。' +
      '在匀变速直线运动中，加速度保持不变，可以据此推导位移公式。';
    const chunks = splitForTts(text, 20);
    expect(chunks.join('')).toBe(text);
  });

  it('单句本身超限时硬切，仍不超限且不丢字', () => {
    const single = 'a'.repeat(100);
    const chunks = splitForTts(single, 30);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(30);
    expect(chunks.join('')).toBe(single);
  });
});

describe('buildTtsTarget — 组装调用参数', () => {
  it('未知厂商（无预置）也能用，但要显式给模型与音色', () => {
    const t = buildTtsTarget({
      providerId: 'custom-abc',
      baseUrl: 'https://gw.example.com/v1/chat/completions',
      apiKey: 'sk-x',
      model: 'my-tts',
      voice: 'v1',
    });
    expect(t?.endpoint).toBe('https://gw.example.com/v1/audio/speech');
    expect(t?.model).toBe('my-tts');
    expect(t?.voice).toBe('v1');
    expect(t?.responseFormat).toBe('mp3');
  });

  it('预置厂商省掉模型/音色时用预置默认', () => {
    const t = buildTtsTarget({
      providerId: 'zhipu',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: 'sk-x',
    });
    expect(t?.model).toBe(TTS_PRESETS.zhipu.model);
    expect(t?.voice).toBe(TTS_PRESETS.zhipu.voice);
    // 智谱只有 wav/pcm，不能给 mp3
    expect(t?.responseFormat).toBe('wav');
    expect(t?.inputLimit).toBe(1024);
  });

  it('缺 key / 缺 baseUrl / 缺模型 任一 → null（调用方退本机）', () => {
    const base = { providerId: 'zhipu', baseUrl: 'https://x/v1/chat/completions', apiKey: 'sk-x' };
    expect(buildTtsTarget({ ...base, apiKey: '' })).toBeNull();
    expect(buildTtsTarget({ ...base, baseUrl: '' })).toBeNull();
    expect(buildTtsTarget({ providerId: 'custom-abc', baseUrl: base.baseUrl, apiKey: 'sk-x' })).toBeNull();
  });
});

describe('synthesizeSpeech — 回包解析', () => {
  const target = buildTtsTarget({
    providerId: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: 'sk-x',
  })!;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Content-Type: audio/* → 直接当二进制音频', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'audio/wav' : null) },
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
        text: async () => '',
      }))
    );
    const blob = await synthesizeSpeech('你好', target);
    expect(blob.size).toBe(3);
  });

  it('JSON + base64 → 解出音频', async () => {
    // "AAAA" 是 3 个 0 字节
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        blob: async () => new Blob([]),
        text: async () => JSON.stringify({ code: 0, data: 'AAAA' }),
      }))
    );
    const blob = await synthesizeSpeech('你好', target);
    expect(blob.size).toBe(3);
  });

  it('HTTP 错误 → TtsError(kind=http, status)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        text: async () => '{"error":"bad key"}',
      }))
    );
    await expect(synthesizeSpeech('你好', target)).rejects.toMatchObject({
      name: 'TtsError',
      kind: 'http',
      status: 401,
    });
  });

  it('网络异常 → TtsError(kind=network)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    const err = await synthesizeSpeech('你好', target).catch((e) => e);
    expect(err).toBeInstanceOf(TtsError);
    expect((err as TtsError).kind).toBe('network');
  });

  it('回包里既没有二进制也没有音频字段 → TtsError(kind=format)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        blob: async () => new Blob([]),
        text: async () => '{"code":0,"message":"ok"}',
      }))
    );
    await expect(synthesizeSpeech('你好', target)).rejects.toMatchObject({ kind: 'format' });
  });
});

describe('mimeForFormat', () => {
  it('已知格式有专有 MIME，未知回落到 mp3', () => {
    expect(mimeForFormat('wav')).toBe('audio/wav');
    expect(mimeForFormat('mp3')).toBe('audio/mpeg');
    expect(mimeForFormat('weird')).toBe('audio/mpeg');
  });
});
