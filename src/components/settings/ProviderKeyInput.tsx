import { useState, useCallback } from 'react';
import { PROVIDER_META, getProviderInfo } from '../../types/aiProviders';
import { useAIConfig } from '../../hooks/useAIConfig';
import { useStrings, fmt } from '../../hooks/useStrings';
import type { Strings } from '../../i18n/strings';
import { useLanguage } from '../../hooks/useLanguage';
import { localizedProviderName } from '../../i18n/strings/aiProviderTexts';

/**
 * ProviderKeyInput —— 单个厂商的 Key + 自定义 Base URL + 自定义模型 + 验证 组件
 * ------------------------------------------------------------------
 * 每个 Tab 一个实例，内嵌在 Header 配置面板。
 */

type Props = {
  providerId: string;
};

function statusColorClass(status: 'unconfigured' | 'configuring' | 'valid' | 'invalid'): string {
  switch (status) {
    case 'valid':       return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10';
    case 'invalid':     return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10';
    case 'configuring': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10';
    default:            return 'text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800';
  }
}

function statusLabel(s: Strings, status: 'unconfigured' | 'configuring' | 'valid' | 'invalid'): string {
  switch (status) {
    case 'valid':       return s.aiPanel.statusValid;
    case 'invalid':     return s.aiPanel.statusInvalid;
    case 'configuring': return s.aiPanel.statusConfiguring;
    default:            return s.aiPanel.statusUnconfigured;
  }
}

export function ProviderKeyInput({ providerId }: Props) {
  const s = useStrings();
  const { language } = useLanguage();
  const {
    providers,
    customProviders,
    validatingMap,
    validateAndSaveProviderKey,
    resetProvider,
    removeCustomProvider,
  } = useAIConfig();

  const info = getProviderInfo(providerId, customProviders);
  const isCustomProvider = !PROVIDER_META[providerId];
  const cfg = providers[providerId] ?? { apiKey: '', status: 'unconfigured', error: '', customBaseUrl: '', customModel: '' };
  const isValidating = validatingMap[providerId] ?? false;
  const supportsCustomBaseUrl = info?.supportsCustomBaseUrl ?? true;

  // UI 本地态（输入未保存前不进 store）
  const [keyInput, setKeyInput] = useState(cfg.apiKey);
  const [showPwd, setShowPwd] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState(cfg.customBaseUrl);
  const [customModel, setCustomModel] = useState(cfg.customModel);
  const [localError, setLocalError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const onKeyChange = useCallback((v: string) => {
    setKeyInput(v);
    if (localError) setLocalError('');
  }, [localError]);

  const handleSave = useCallback(async () => {
    setLocalError('');
    await validateAndSaveProviderKey(
      providerId,
      keyInput,
      supportsCustomBaseUrl ? customBaseUrl : undefined,
      customModel || undefined,
    );
  }, [providerId, keyInput, customBaseUrl, customModel, supportsCustomBaseUrl, validateAndSaveProviderKey]);

  const handleCancel = useCallback(() => {
    setKeyInput(cfg.apiKey);
    setCustomBaseUrl(cfg.customBaseUrl);
    setCustomModel(cfg.customModel);
    setLocalError('');
  }, [cfg.apiKey, cfg.customBaseUrl, cfg.customModel]);

  const handleReset = useCallback(() => {
    resetProvider(providerId);
    setKeyInput('');
    setCustomBaseUrl('');
    setCustomModel('');
    setLocalError('');
  }, [providerId, resetProvider]);

  const handleDelete = useCallback(() => {
    if (confirm(s.keyInput.deleteVendorConfirm)) {
      removeCustomProvider(providerId);
    }
  }, [providerId, removeCustomProvider, s.keyInput.deleteVendorConfirm]);

  const errMsg = cfg.error || localError;

  return (
    <div className="space-y-3">
      {/* 厂商头 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-slate-800 dark:text-zinc-100">{info ? localizedProviderName(providerId, info, language).name : s.aiPanel.unknownVendor}</div>
          {info?.docsUrl && (
            <a
              href={info!.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
            >
              {s.aiPanel.officialDocs} →
            </a>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColorClass(cfg.status)}`}>
          {statusLabel(s, cfg.status)}
        </span>
      </div>

      {/* Key 输入 */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">
          {s.keyInput.apiKey}
        </label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={language === 'zh' ? (info?.keyFormatHint ?? s.keyInput.keyPlaceholder) : s.keyInput.keyPlaceholder}
            className={`w-full px-3 py-2 pr-9 text-sm rounded-lg border bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
              errMsg
                ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                : 'border-slate-300 dark:border-zinc-700 focus:ring-teal-500'
            }`}
            disabled={isValidating}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-400 disabled:opacity-50"
            disabled={isValidating}
            aria-label={showPwd ? s.keyInput.hideKey : s.keyInput.showKey}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showPwd ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 高级展开 */}
      {supportsCustomBaseUrl && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 flex items-center gap-1"
          >
            <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {s.keyInput.advancedOptions}
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">
                  {s.keyInput.customBaseUrl}
                </label>
                <input
                  type="url"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder={fmt(s.keyInput.defaultPrefix, { url: info?.defaultBaseUrl ?? '' })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={isValidating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">
                  {s.keyInput.customModelId}
                </label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder={s.keyInput.customModelPlaceholder}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={isValidating}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {errMsg && (
        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errMsg}
        </p>
      )}

      {/* 说明 */}
      <p className="text-xs text-slate-500 dark:text-zinc-500">
        {s.keyInput.localNote}
      </p>

      {/* 按钮组 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isValidating}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {s.common.cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isValidating}
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {isValidating ? (
            <>
              <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {s.keyInput.validating}
            </>
          ) : s.common.save}
        </button>
      </div>

      {cfg.status === 'valid' && (
        <button
          type="button"
          onClick={handleReset}
          className="w-full px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          {s.keyInput.clearConfig}
        </button>
      )}

      {/* 自定义厂商删除按钮 */}
      {isCustomProvider && (
        <button
          type="button"
          onClick={handleDelete}
          className="w-full px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          {s.keyInput.deleteVendor}
        </button>
      )}
    </div>
  );
}
