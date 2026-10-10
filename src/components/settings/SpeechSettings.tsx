import { useMemo, useState } from 'react';
import { useSpeechConfig } from '../../hooks/useSpeechConfigStore';
import { useAIConfig } from '../../hooks/useAIConfig';
import { useStrings, fmt } from '../../hooks/useStrings';
import { useLanguage } from '../../hooks/useLanguage';
import {
  PROVIDER_META,
  getProviderInfo,
  resolveBaseUrl,
} from '../../types/aiProviders';
import { localizedProviderName } from '../../i18n/strings/aiProviderTexts';
import { TTS_PRESETS, deriveSpeechEndpoint } from '../../services/onlineTts';

/**
 * SpeechSettings —— 「语音朗读」配置面板
 * ------------------------------------------------------------------
 * 就一个目的：让**发音准**。本机语音取决于操作系统装了什么语音包，
 * 缺语言时只能拿别的语言硬念；在线合成把文本交给云端模型，任何语种都读得准。
 *
 * 在线合成不新增密钥：直接复用「密钥管理」里已配好的厂商 Key，
 * 端点由对话端点派生出 /audio/speech（见 services/onlineTts.ts）。
 */
const INPUT_CLASS =
  'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent';
const LABEL_CLASS = 'block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1';

const CUSTOM_VOICE = '__custom_voice__';

export function SpeechSettings() {
  const s = useStrings();
  const { language } = useLanguage();
  const { config, setEngine, setProviderId, setModel, setVoice } = useSpeechConfig();
  const { providers, customProviders, activeProviderId } = useAIConfig();

  const [customVoice, setCustomVoice] = useState(false);

  const effectivePid = config.providerId || activeProviderId;
  const preset = TTS_PRESETS[effectivePid];
  const presetVoices = preset?.voices ?? [];
  const presetVoiceIds = useMemo(() => presetVoices.map((v) => v.id), [presetVoices]);

  const modelValue = config.models[effectivePid] ?? '';
  const voiceValue = config.voices[effectivePid] ?? '';
  // 已经存了一个不在预置列表里的音色 ID → 直接进"自定义"模式，别把它藏起来
  const useCustomVoice =
    presetVoices.length === 0 ||
    customVoice ||
    (voiceValue !== '' && !presetVoiceIds.includes(voiceValue));

  const info = getProviderInfo(effectivePid, customProviders);
  const providerCfg = providers[effectivePid];
  const providerStatus = providerCfg?.status ?? 'unconfigured';
  const baseUrl = providerCfg ? resolveBaseUrl(effectivePid, providerCfg, customProviders) : '';
  const endpoint = deriveSpeechEndpoint(baseUrl);

  const displayName = info
    ? localizedProviderName(effectivePid, info, language).name
    : effectivePid;

  const selectClass = INPUT_CLASS;

  return (
    <div className="space-y-4">
      {/* 引擎 */}
      <div>
        <label className={LABEL_CLASS}>{s.speechSettings.engine}</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['online', s.speechSettings.engineOnline],
              ['browser', s.speechSettings.engineBrowser],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setEngine(value)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                config.engine === value
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 font-medium'
                  : 'border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-400 dark:text-zinc-500">
          {config.engine === 'online' ? s.speechSettings.engineHint : s.speechSettings.systemNote}
        </p>
      </div>

      {config.engine === 'online' && (
        <>
          {/* 服务商 */}
          <div>
            <label className={LABEL_CLASS}>{s.speechSettings.provider}</label>
            <select
              value={config.providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setCustomVoice(false);
              }}
              className={selectClass}
            >
              <option value="">{s.speechSettings.providerFollow}</option>
              <optgroup label={s.aiPanel.presetVendors}>
                {Object.keys(PROVIDER_META).map((id) => (
                  <option key={id} value={id}>
                    {localizedProviderName(id, PROVIDER_META[id], language).name}
                    {providers[id]?.status === 'valid' ? ' ✓' : ''}
                  </option>
                ))}
              </optgroup>
              {Object.keys(customProviders).length > 0 && (
                <optgroup label={s.aiPanel.customVendors}>
                  {Object.keys(customProviders).map((id) => (
                    <option key={id} value={id}>
                      {customProviders[id].name}
                      {providers[id]?.status === 'valid' ? ' ✓' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-400 dark:text-zinc-500">
              {fmt(s.speechSettings.currentProvider, { name: displayName })}
            </p>
          </div>

          {/* 模型 */}
          <div>
            <label className={LABEL_CLASS}>{s.speechSettings.model}</label>
            <input
              type="text"
              value={modelValue}
              onChange={(e) => setModel(effectivePid, e.target.value)}
              placeholder={preset?.model || s.speechSettings.modelPlaceholder}
              className={INPUT_CLASS}
              autoComplete="off"
            />
            {!preset?.model && (
              <p className="mt-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                {s.speechSettings.noPresetModel}
              </p>
            )}
          </div>

          {/* 音色 */}
          <div>
            <label className={LABEL_CLASS}>{s.speechSettings.voice}</label>
            {presetVoices.length > 0 && !useCustomVoice ? (
              <select
                value={presetVoiceIds.includes(voiceValue) ? voiceValue : preset?.voice ?? presetVoiceIds[0]}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_VOICE) {
                    setCustomVoice(true);
                    return;
                  }
                  setVoice(effectivePid, e.target.value);
                }}
                className={selectClass}
              >
                {presetVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
                <option value={CUSTOM_VOICE}>{s.speechSettings.voiceCustomOption}</option>
              </select>
            ) : (
              <input
                type="text"
                value={voiceValue}
                onChange={(e) => setVoice(effectivePid, e.target.value)}
                placeholder={preset?.voice || s.speechSettings.voicePlaceholder}
                className={INPUT_CLASS}
                autoComplete="off"
              />
            )}
            {preset?.note && (
              <p className="mt-1.5 text-[11px] leading-snug text-slate-400 dark:text-zinc-500">
                {preset.note}
              </p>
            )}
          </div>

          {/* 可用性 */}
          {providerStatus !== 'valid' ? (
            <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">
              {fmt(s.speechSettings.providerNotConfigured, { tab: s.aiPanel.tabKeys })}
            </p>
          ) : (
            <p className="text-[11px] leading-snug text-slate-400 dark:text-zinc-500 break-all">
              {endpoint ? `${s.speechSettings.endpointLabel} ${endpoint}` : s.speechSettings.endpointNote}
            </p>
          )}
        </>
      )}
    </div>
  );
}
