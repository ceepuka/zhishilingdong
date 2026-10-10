/**
 * 语音朗读配置的存储层 + React Hook
 * ------------------------------------------------------------------
 * 与 AI 厂商配置（useAIConfigStore）分开存：朗读是**独立于对话**的偏好，
 * 用户可能用 DeepSeek 对话、却要智谱的 GLM-TTS 发声，两者不该互相绑死。
 *
 * 结构：
 *   engine     在线优先 还是 强制本机
 *   providerId 用哪家做语音合成（'' = 跟随当前对话厂商）
 *   models/voices  按厂商分别记，切厂商不会互相覆盖
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { TTS_PRESETS } from '../services/onlineTts';

export const SPEECH_CONFIG_STORAGE_KEY = 'ai-office-assistant-speech-config';

export type SpeechEngine = 'online' | 'browser';

export interface SpeechConfig {
  version: 1;
  /** online：优先在线合成，失败自动退本机；browser：始终用本机语音 */
  engine: SpeechEngine;
  /** 语音合成的厂商 ID；'' = 跟随当前激活的对话厂商 */
  providerId: string;
  /** providerId → 模型 ID（空串 = 用预置默认） */
  models: Record<string, string>;
  /** providerId → 音色 ID（空串 = 用预置默认） */
  voices: Record<string, string>;
}

export function createDefaultSpeechConfig(): SpeechConfig {
  return {
    version: 1,
    // 默认就走在线：用户开这个功能的动机就是"本机读不准"
    engine: 'online',
    providerId: '',
    models: {},
    voices: {},
  };
}

// ---------- 全局 store（供 useSyncExternalStore 跨组件共享）----------

let cached: SpeechConfig | null = null;
let listeners: Array<() => void> = [];

export function subscribeSpeechConfig(cb: () => void): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function emit(): void {
  cached = null;
  for (const l of listeners) l();
}

function safeParse(raw: string | null): SpeechConfig | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || obj.version !== 1) return null;
    const cfg = obj as SpeechConfig;
    if (cfg.engine !== 'online' && cfg.engine !== 'browser') cfg.engine = 'online';
    if (typeof cfg.providerId !== 'string') cfg.providerId = '';
    if (!cfg.models || typeof cfg.models !== 'object') cfg.models = {};
    if (!cfg.voices || typeof cfg.voices !== 'object') cfg.voices = {};
    return cfg;
  } catch {
    return null;
  }
}

function readFromStorage(): SpeechConfig {
  try {
    const parsed = safeParse(localStorage.getItem(SPEECH_CONFIG_STORAGE_KEY));
    if (parsed) return parsed;
  } catch {
    /* ignore */
  }
  const def = createDefaultSpeechConfig();
  try {
    localStorage.setItem(SPEECH_CONFIG_STORAGE_KEY, JSON.stringify(def));
  } catch {
    /* ignore */
  }
  return def;
}

export function getStoredSpeechConfig(): SpeechConfig {
  if (!cached) cached = readFromStorage();
  return cached;
}

export function getSpeechConfigSnapshot(): SpeechConfig {
  return getStoredSpeechConfig();
}

export function setStoredSpeechConfig(cfg: SpeechConfig): void {
  try {
    localStorage.setItem(SPEECH_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
  cached = cfg;
  emit();
}

export function updateStoredSpeechConfig(
  mutator: (cfg: SpeechConfig) => SpeechConfig | void
): SpeechConfig {
  const current = getStoredSpeechConfig();
  const next: SpeechConfig = JSON.parse(JSON.stringify(current));
  const result = mutator(next);
  const final = result || next;
  setStoredSpeechConfig(final);
  return final;
}

/** 取某厂商实际生效的模型 / 音色（空则回落到预置默认） */
export function resolveSpeechModel(cfg: SpeechConfig, providerId: string): string {
  return (cfg.models[providerId] || '').trim() || TTS_PRESETS[providerId]?.model || '';
}

export function resolveSpeechVoice(cfg: SpeechConfig, providerId: string): string {
  return (cfg.voices[providerId] || '').trim() || TTS_PRESETS[providerId]?.voice || '';
}

// ---------- React Hook ----------

export function useSpeechConfig() {
  const cfg = useSyncExternalStore(subscribeSpeechConfig, getSpeechConfigSnapshot);

  // 跨 tab 同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SPEECH_CONFIG_STORAGE_KEY) setStoredSpeechConfig(getStoredSpeechConfig());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setEngine = useCallback((engine: SpeechEngine) => {
    updateStoredSpeechConfig((c) => {
      c.engine = engine;
    });
  }, []);

  const setProviderId = useCallback((providerId: string) => {
    updateStoredSpeechConfig((c) => {
      c.providerId = providerId;
    });
  }, []);

  const setModel = useCallback((providerId: string, model: string) => {
    updateStoredSpeechConfig((c) => {
      c.models[providerId] = model;
    });
  }, []);

  const setVoice = useCallback((providerId: string, voice: string) => {
    updateStoredSpeechConfig((c) => {
      c.voices[providerId] = voice;
    });
  }, []);

  return { config: cfg, setEngine, setProviderId, setModel, setVoice };
}
