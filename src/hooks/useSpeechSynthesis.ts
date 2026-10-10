import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentStrings, fmt } from '../i18n/strings';
import { speechLanguageLabel } from '../i18n/languages';
import { getStoredLanguage } from './useLanguageStore';
import { getStoredAIConfig } from './useAIConfigStore';
import {
  getStoredSpeechConfig,
  resolveSpeechModel,
  resolveSpeechVoice,
  type SpeechEngine,
} from './useSpeechConfigStore';
import { resolveBaseUrl, getProviderInfo } from '../types/aiProviders';
import { localizedProviderName } from '../i18n/strings/aiProviderTexts';
import {
  buildTtsTarget,
  synthesizeSpeech,
  splitForTts,
  TtsError,
  type TtsTarget,
} from '../services/onlineTts';

export interface SpeechOptions {
  lang?: string;
  volume?: number;
  rate?: number;
  pitch?: number;
}

/**
 * 一次朗读的非致命提示（要说给用户听，但不打断朗读）。
 *
 * 为什么必须暴露：这两类情况**引擎都不会报错**，用户侧只看到"点了没反应"
 * 或"发音不对"，无从判断是坏了、缺语音包、还是在线服务没通。
 *   - voice-fallback：本机没装该语言的语音，拿别的语言代读
 *   - online-failed ：在线合成没成功，已退回本机
 */
export interface SpeechNotice {
  kind: 'voice-fallback' | 'online-failed';
  /** 已本地化、可直接上屏的文字 */
  message: string;
}

/**
 * 在候选语音里为某个 BCP-47 代码挑最合适的一个。
 * 匹配优先级：完全相等 → 同标签前缀（en-US 撞 en-US-*）→ 同主语言（en-US 撞 en-GB）
 * → 含主语言（兜底）。
 *
 * 抽成纯函数是为了让 `speakWithBrowser()` 能在"state 里的 voices 还没加载完"时
 * 用**当场重新取一次**的列表再匹配一次，两处用同一套规则。
 */
export function matchVoice(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | null {
  const langPrefix = lang.split('-')[0];
  return (
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith(lang)) ||
    voices.find((v) => v.lang.startsWith(langPrefix)) ||
    voices.find((v) => v.lang.includes(langPrefix)) ||
    null
  );
}

/** 厂商显示名（用于提示文案），拿不到就退回 providerId */
function providerDisplayName(providerId: string): string {
  try {
    const root = getStoredAIConfig();
    const info = getProviderInfo(providerId, root.customProviders);
    if (!info) return providerId;
    return localizedProviderName(providerId, info, getStoredLanguage()).name;
  } catch {
    return providerId;
  }
}

/**
 * 当前是否具备在线合成条件，具备则返回完整调用参数。
 *
 * 判定全部走**已落库的真实配置**（朗读配置 + 厂商配置），不做能力猜测：
 * 只要 ① 引擎选了 online ② 目标厂商 status === 'valid' ③ 端点/模型/音色都能推出来，
 * 就用在线；任何一项不满足就返回 null，由调用方直接走本机。
 */
export function currentOnlineTarget(): TtsTarget | null {
  let speech;
  let ai;
  try {
    speech = getStoredSpeechConfig();
    if (speech.engine !== 'online') return null;
    ai = getStoredAIConfig();
  } catch {
    return null;
  }
  const providerId = speech.providerId || ai.activeProviderId;
  const cfg = ai.providers[providerId];
  if (!cfg || cfg.status !== 'valid') return null;
  const baseUrl = resolveBaseUrl(providerId, cfg, ai.customProviders);
  return buildTtsTarget({
    providerId,
    baseUrl,
    apiKey: cfg.apiKey,
    model: resolveSpeechModel(speech, providerId),
    voice: resolveSpeechVoice(speech, providerId),
  });
}

/** 把在线失败的原因翻成人话（"已改用本机语音"由外层拼） */
export function onlineFailureDetail(err: unknown): string {
  const s = getCurrentStrings();
  if (err instanceof TtsError) {
    if (err.kind === 'http' && (err.status === 401 || err.status === 403)) {
      return s.speech.onlineFailUnauthorized;
    }
    if (err.kind === 'http' && err.status === 404) return s.speech.onlineFailNoEndpoint;
    if (err.kind === 'network') return s.speech.onlineFailNetwork;
    if (err.kind === 'format') return s.speech.onlineFailPlayback;
    return err.status ? `HTTP ${err.status}` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 非致命提示（降级/在线失败），null 表示无话可说 */
  const [notice, setNotice] = useState<SpeechNotice | null>(null);
  /** 上一次实际用的引擎，供 UI 区分（null = 还没读过） */
  const [engineUsed, setEngineUsed] = useState<SpeechEngine | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 停掉在线音频、释放 object URL —— 不碰 Web Speech 的状态 */
  const stopAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      audio.src = '';
    }
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) {
      setIsLoading(false);
      return;
    }

    const loadVoices = () => {
      setVoices(synth.getVoices());
      setIsLoading(false);
    };

    loadVoices();

    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    return () => {
      synth.cancel();
      synth.onvoiceschanged = null;
      stopAudio();
    };
  }, [stopAudio]);

  const getVoiceForLang = useCallback(
    (lang: string): SpeechSynthesisVoice | null => matchVoice(voices, lang),
    [voices]
  );

  /**
   * 逐块播放：取音频 → object URL → `Audio` 播放 → 等这一块放完再取下一块。
   * 分块是因为厂商对 `input` 有字符上限（智谱 1024），超长会直接 400。
   */
  const playOnline = useCallback(
    async (text: string, target: TtsTarget, signal: AbortSignal) => {
      const chunks = splitForTts(text, target.inputLimit);
      for (const chunk of chunks) {
        if (signal.aborted) return;
        const blob = await synthesizeSpeech(chunk, target, signal);
        if (signal.aborted) return;

        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        try {
          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(url);
            audioRef.current = audio;
            const onAbort = () => {
              try {
                audio.pause();
              } catch {
                /* ignore */
              }
              resolve();
            };
            signal.addEventListener('abort', onAbort, { once: true });
            audio.onended = () => resolve();
            audio.onerror = () => reject(new TtsError('format', 'audio element failed to play'));
            audio.play().then(undefined, (e: unknown) =>
              reject(e instanceof Error ? e : new Error('play rejected'))
            );
          });
        } finally {
          if (urlRef.current === url) urlRef.current = null;
          if (audioRef.current) {
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current = null;
          }
          URL.revokeObjectURL(url);
        }
      }
    },
    []
  );

  /**
   * 本机 Web Speech 朗读。**不设 voice 就发出去 = 多数引擎静默不播**，
   * 所以没有匹配语音时显式退到"引擎默认 → 第一个可用"，并把降级事实返回给调用方。
   * 返回本次的降级提示（没降级则 null）。
   */
  const speakWithBrowser = useCallback(
    (text: string, options: SpeechOptions): SpeechNotice | null => {
      const s = getCurrentStrings();
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setError(s.speech.unsupported);
        return null;
      }

      const synth = window.speechSynthesis;
      const requested = options.lang || 'zh-CN';
      // voices 可能因为 `onvoiceschanged` 迟到而暂时为空 —— 朗读前再取一次。
      const available = voices.length > 0 ? voices : synth.getVoices();
      const matched = matchVoice(available, requested);
      const usable = matched ?? available.find((v) => v.default) ?? available[0] ?? null;

      synth.cancel();
      setEngineUsed('browser');

      const fallbackNotice: SpeechNotice | null =
        usable && !matched
          ? {
              kind: 'voice-fallback',
              message: fmt(s.speech.voiceFallback, {
                lang: speechLanguageLabel(requested),
                used: speechLanguageLabel(usable.lang),
              }),
            }
          : null;

      const utterance = new SpeechSynthesisUtterance(text);
      // voice 与 lang 冲突时部分引擎会拒读，因此以实际选中的 voice.lang 为准
      utterance.lang = usable ? usable.lang : requested;
      utterance.volume = options.volume !== undefined ? options.volume : 1;
      utterance.rate = options.rate !== undefined ? options.rate : 0.9;
      utterance.pitch = options.pitch !== undefined ? options.pitch : 1;

      if (usable) utterance.voice = usable;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        const errorMessages: Record<string, string> = {
          canceled: s.speech.canceled,
          interrupted: s.speech.interrupted,
          'not-allowed': s.speech.notAllowed,
          'language-unavailable': s.speech.languageUnsupported,
          'voice-unavailable': s.speech.voiceUnavailable,
        };
        setError(errorMessages[event.error] || s.speech.error.replace('{msg}', String(event.error)));
        console.error('Speech synthesis error:', event);
      };

      synth.speak(utterance);
      return fallbackNotice;
    },
    [voices]
  );

  const speak = useCallback(
    (text: string, options: SpeechOptions = {}) => {
      const s = getCurrentStrings();
      const trimmed = (text || '').trim();
      if (!trimmed) {
        setError(s.speech.nothingToRead);
        return;
      }

      // 每次朗读先清掉上一次的残留（在线音频 + 本机队列 + 提示）
      stopAudio();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setError(null);
      setNotice(null);

      const target = currentOnlineTarget();
      if (target) {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setEngineUsed('online');
        setIsSpeaking(true);

        playOnline(trimmed, target, ctrl.signal)
          .then(() => {
            if (!ctrl.signal.aborted && mountedRef.current) setIsSpeaking(false);
          })
          .catch((err: unknown) => {
            if (ctrl.signal.aborted || !mountedRef.current) return;
            setIsSpeaking(false);
            const detail = onlineFailureDetail(err);
            const onlineMsg = fmt(s.speech.onlineFailed, {
              provider: providerDisplayName(target.providerId),
              detail,
            });
            // 在线挂了才退回本机；若本机还发生了"语言不对口"的降级，一并说清楚
            const voiceNotice = speakWithBrowser(trimmed, options);
            setNotice({
              kind: 'online-failed',
              message: voiceNotice ? `${onlineMsg}（${voiceNotice.message}）` : onlineMsg,
            });
          });
        return;
      }

      const voiceNotice = speakWithBrowser(trimmed, options);
      setNotice(voiceNotice);
    },
    [playOnline, speakWithBrowser, stopAudio]
  );

  const stop = useCallback(() => {
    stopAudio();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setError(null);
    setNotice(null);
  }, [stopAudio]);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    voices,
    error,
    /** 非致命提示（本机语音降级 / 在线失败退本机），供 UI 提示 */
    notice,
    /** 上一次实际使用的引擎 */
    engineUsed,
    getVoiceForLang,
  };
}
