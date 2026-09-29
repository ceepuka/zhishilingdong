import { useState, useEffect, useCallback } from 'react';
import { getCurrentStrings } from '../i18n/strings';

export interface SpeechOptions {
  lang?: string;
  volume?: number;
  rate?: number;
  pitch?: number;
}

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      setIsLoading(false);
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const getVoiceForLang = useCallback((lang: string): SpeechSynthesisVoice | null => {
    const langPrefix = lang.split('-')[0];
    
    const exactMatch = voices.find(v => v.lang === lang);
    if (exactMatch) return exactMatch;

    const prefixMatch = voices.find(v => v.lang.startsWith(lang));
    if (prefixMatch) return prefixMatch;

    const baseLangMatch = voices.find(v => v.lang.startsWith(langPrefix));
    if (baseLangMatch) return baseLangMatch;

    const anyMatch = voices.find(v => v.lang.includes(langPrefix));
    if (anyMatch) return anyMatch;

    return null;
  }, [voices]);

  const speak = useCallback((text: string, options: SpeechOptions = {}) => {
    const s = getCurrentStrings();
    if (!('speechSynthesis' in window)) {
      setError(s.speech.unsupported);
      return;
    }

    if (!text.trim()) {
      setError(s.speech.nothingToRead);
      return;
    }

    window.speechSynthesis.cancel();
    setError(null);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'zh-CN';
    utterance.volume = options.volume !== undefined ? options.volume : 1;
    utterance.rate = options.rate !== undefined ? options.rate : 0.9;
    utterance.pitch = options.pitch !== undefined ? options.pitch : 1;

    const voice = getVoiceForLang(options.lang || 'zh-CN');
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      const errorMessages: Record<string, string> = {
        'canceled': '朗读已取消',
        'interrupted': '朗读被中断',
        'not-allowed': '浏览器不允许语音播放',
        'language-unavailable': '不支持该语言',
        'voice-unavailable': '语音不可用',
      };
      setError(errorMessages[event.error] || `语音错误: ${event.error}`);
      console.error('Speech synthesis error:', event);
    };

    window.speechSynthesis.speak(utterance);
  }, [getVoiceForLang]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setError(null);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    voices,
    error,
    getVoiceForLang,
  };
}