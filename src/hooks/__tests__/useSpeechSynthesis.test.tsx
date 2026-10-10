/**
 * useSpeechSynthesis —— 朗读调度 / 语音选择 / 降级提示的回归锁。
 *
 * 两条真实缺陷链：
 *   ① 本机缺该语言语音时，旧实现只是"不设 utterance.voice"就发出去，
 *      多数引擎会**静默不播** —— 用户看到的是"点了没反应"。
 *   ② 本机语音来自操作系统语音包，装不到英文就只能拿中文硬念（**发音不准**）。
 *      所以新增了在线合成优先，失败再退本机。
 *
 * 这里锁死：
 *   1. 有匹配语音 → 用匹配语音，且不产生提示；
 *   2. 无匹配语音但有别的语音 → 退到可用语音（保证有声）+ voice-fallback 提示；
 *   3. 一个语音都没有 → 不抛异常，退到请求的 lang 由引擎自理；
 *   4. 在线可用 → 走在线合成（打 /audio/speech），不碰本机；
 *   5. 在线失败 → 自动退本机并给出 online-failed 提示（说清楚为什么听到本机音）；
 *   6. 没有 Web Speech 时，在线仍然可用（在线不依赖本机语音）。
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSpeechSynthesis } from '../useSpeechSynthesis';
import { createDefaultAIConfig, createDefaultProviderConfig } from '../../types/aiProviders';
import { setStoredAIConfig } from '../useAIConfigStore';
import { createDefaultSpeechConfig, setStoredSpeechConfig } from '../useSpeechConfigStore';

interface UtteranceLike {
  text: string;
  lang: string;
  voice: { name: string; lang: string } | null;
  rate: number;
  volume: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

let spoken: UtteranceLike[] = [];
let voiceList: { name: string; lang: string; default?: boolean }[] = [];
let cancelCount = 0;

function installSpeechStub() {
  spoken = [];
  cancelCount = 0;
  (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class implements UtteranceLike {
    text: string;
    lang = '';
    voice: UtteranceLike['voice'] = null;
    rate = 1;
    volume = 1;
    pitch = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voiceList,
      speak: (u: UtteranceLike) => spoken.push(u),
      cancel: () => {
        cancelCount++;
      },
      onvoiceschanged: undefined,
    },
  });
}

function removeSpeechStub() {
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
}

/** 让 Audio 立即"播完"，并把 object URL 相关 API 补上（jsdom 没有） */
function installAudioStub() {
  (URL as unknown as Record<string, unknown>).createObjectURL = () => 'blob:mock';
  (URL as unknown as Record<string, unknown>).revokeObjectURL = () => {};
  (window as unknown as Record<string, unknown>).Audio = class {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
    pause() {
      /* noop */
    }
    play() {
      setTimeout(() => this.onended?.(), 0);
      return Promise.resolve();
    }
  };
}

/** 给 zhipu 一个"已验证"的 key，读配置链路会把在线合成打开 */
function grantZhipuKey() {
  const cfg = createDefaultAIConfig();
  cfg.activeProviderId = 'zhipu';
  cfg.providers.zhipu = { ...createDefaultProviderConfig(), apiKey: 'sk-test-key', status: 'valid' };
  setStoredAIConfig(cfg);
}

function enableOnlineSpeech(providerId = 'zhipu') {
  setStoredSpeechConfig({ ...createDefaultSpeechConfig(), engine: 'online', providerId });
}

/** 只实现 hook 会读到的字段，避免依赖真实的 Response 类 */
function audioResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'audio/wav' : null) },
    blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
    text: async () => '',
  } as unknown as Response;
}

const ZH_VOICE = { name: 'Microsoft Huihui', lang: 'zh-CN', default: true };
const EN_VOICE = { name: 'Microsoft Zira', lang: 'en-US', default: false };

beforeEach(() => {
  installSpeechStub();
  installAudioStub();
  // 每个用例都从"没有任何可用厂商 + 默认朗读配置"起步，避免用例互相串味
  setStoredAIConfig(createDefaultAIConfig());
  setStoredSpeechConfig(createDefaultSpeechConfig());
  voiceList = [];
  vi.restoreAllMocks();
});

afterEach(() => {
  spoken = [];
  vi.unstubAllGlobals();
});

describe('useSpeechSynthesis — 本机语音选择与降级', () => {
  it('有同语言语音 → 用该语音，且不产生提示', async () => {
    voiceList = [ZH_VOICE, EN_VOICE];
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Good morning', { lang: 'en-US' });
    });

    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice?.name).toBe('Microsoft Zira');
    expect(spoken[0].lang).toBe('en-US');
    expect(result.current.notice).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.engineUsed).toBe('browser');
  });

  it('没有该语言语音但有别的语音 → 退到可用语音（保证有声）+ 降级提示', async () => {
    // 机器只装了中文语音 —— 正是"英文原文点朗读没反应/发音不对"的真实环境
    voiceList = [ZH_VOICE];
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Good morning', { lang: 'en-US' });
    });

    // 关键：不能留空 voice（那会让引擎静默不播）
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice?.name).toBe('Microsoft Huihui');
    expect(spoken[0].lang).toBe('zh-CN');
    expect(result.current.notice?.kind).toBe('voice-fallback');
    expect(result.current.notice?.message).toBeTruthy();
  });

  it('一个语音都没有 → 不抛异常，按请求的 lang 交给引擎', async () => {
    voiceList = [];
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(() => {
      act(() => {
        result.current.speak('Good morning', { lang: 'en-US' });
      });
    }).not.toThrow();

    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBeNull();
    expect(spoken[0].lang).toBe('en-US');
    // 没有任何语音可选时无法判定降级，不编造提示
    expect(result.current.notice).toBeNull();
  });

  it('空文本不朗读并报错（不静默）', async () => {
    voiceList = [ZH_VOICE];
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('   ', { lang: 'zh-CN' });
    });

    expect(spoken).toHaveLength(0);
    expect(result.current.error).toBeTruthy();
  });

  it('stop() 清掉提示', async () => {
    voiceList = [ZH_VOICE];
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Good morning', { lang: 'en-US' });
    });
    expect(result.current.notice).not.toBeNull();

    act(() => {
      result.current.stop();
    });
    expect(result.current.notice).toBeNull();
    expect(cancelCount).toBeGreaterThan(0);
  });
});

describe('useSpeechSynthesis — 在线优先', () => {
  it('在线可用 → 打派生出的 /audio/speech，不碰本机语音', async () => {
    voiceList = [ZH_VOICE];
    grantZhipuKey();
    enableOnlineSpeech('zhipu');
    const fetchMock = vi.fn(async () => audioResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSpeechSynthesis());
    await act(async () => {
      result.current.speak('Good morning', { lang: 'en-US' });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/audio/speech');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('glm-tts');
    expect(body.voice).toBe('tongtong');
    // 在线成功时**不该**再走本机
    expect(spoken).toHaveLength(0);
    expect(result.current.notice).toBeNull();
    expect(result.current.engineUsed).toBe('online');
  });

  it('引擎设为本机时，即使有 key 也不发在线请求', async () => {
    voiceList = [ZH_VOICE];
    grantZhipuKey();
    setStoredSpeechConfig({ ...createDefaultSpeechConfig(), engine: 'browser' });
    const fetchMock = vi.fn(async () => audioResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => {
      result.current.speak('Good morning', { lang: 'en-US' });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(spoken).toHaveLength(1);
    expect(result.current.engineUsed).toBe('browser');
  });

  it('在线失败 → 自动退本机 + online-failed 提示（说清原因）', async () => {
    voiceList = [ZH_VOICE];
    grantZhipuKey();
    enableOnlineSpeech('zhipu');
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: async () => 'boom',
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() => useSpeechSynthesis());
    await act(async () => {
      result.current.speak('Good morning', { lang: 'en-US' });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.notice?.kind).toBe('online-failed');
    // 原因要能落到具体状态码（语言无关，避免依赖 navigator.language）
    expect(result.current.notice?.message).toContain('HTTP 500');
    // 退本机后必须真的出声（不能两边都没声音）
    expect(spoken).toHaveLength(1);
    expect(result.current.engineUsed).toBe('browser');
  });

  it('没有 Web Speech 时在线仍可用（在线不依赖本机语音）', async () => {
    removeSpeechStub();
    grantZhipuKey();
    enableOnlineSpeech('zhipu');
    const fetchMock = vi.fn(async () => audioResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSpeechSynthesis());
    await act(async () => {
      result.current.speak('Good morning', { lang: 'en-US' });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.engineUsed).toBe('online');
  });
});
