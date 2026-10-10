import { useState, useCallback, useEffect, useRef } from 'react';
import { TabType } from '../../types';
import { TabNav } from './TabNav';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { useStrings } from '../../hooks/useStrings';
import { LANGUAGES, type LanguageCode } from '../../i18n/languages';
import { useAIConfig } from '../../hooks/useAIConfig';
import { ModelSelector } from '../settings/ModelSelector';
import { ProviderKeyInput } from '../settings/ProviderKeyInput';
import { AddProviderForm } from '../settings/AddProviderForm';
import { WanxKeyInput } from '../settings/WanxKeyInput';
import { SpeechSettings } from '../settings/SpeechSettings';
import { PROVIDER_META, getProviderInfo, getModelInfo } from '../../types/aiProviders';
import { localizedProviderName } from '../../i18n/strings/aiProviderTexts';

type AITab = 'model' | 'keys' | 'addProvider' | 'speech';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onClearAllHistory: () => void;
}

export function Header({ activeTab, onTabChange, onClearAllHistory }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setThemeLight, setThemeDark } = useTheme();
  const { language, setLanguage } = useLanguage();
  const s = useStrings();
  const { anyConfigured, activeProviderValid, activeProviderId, activeModelId, providers, customProviders } = useAIConfig();

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [activeAITab, setActiveAITab] = useState<AITab>('model');
  const [keyTabProviderId, setKeyTabProviderId] = useState<string>('zhipu');
  const aiPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiPanelRef.current && !aiPanelRef.current.contains(e.target as Node)) {
        setAiPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const overallStatus = (() => {
    const activeStatus = providers[activeProviderId]?.status ?? 'unconfigured';
    if (anyConfigured && activeProviderValid) return 'configured';
    if (activeStatus === 'invalid') return 'invalid';
    if (Object.values(providers).some(p => p.status === 'invalid')) return 'invalid-orange';
    return 'unconfigured';
  })();

  const activeProviderInfo = getProviderInfo(activeProviderId, customProviders);
  const activeProviderName = activeProviderInfo
    ? localizedProviderName(activeProviderId, activeProviderInfo, language).shortName
    : s.common.unknown;
  const activeModelInfo = getModelInfo(activeProviderId, activeModelId, customProviders);
  const activeModelName = activeModelInfo?.name || activeModelId;

  const toggleAiPanel = useCallback(() => {
    setAiPanelOpen((o) => !o);
  }, []);

  const buttonClass = (() => {
    switch (overallStatus) {
      case 'configured':
        return 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10';
      case 'invalid':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20';
      default:
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20';
    }
  })();

  const buttonLabel = (() => {
    if (overallStatus === 'configured') return `${activeProviderName}·${activeModelName}`;
    if (overallStatus === 'invalid') return s.aiPanel.statusInvalid;
    return s.aiPanel.statusUnconfigured;
  })();

  return (
    <nav className="bg-white border-b border-slate-200 dark:bg-zinc-950 dark:border-zinc-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-xl font-bold text-teal-700 dark:text-teal-400">{s.app.brand}</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-14 w-56 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-800 z-50 py-2">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase">{s.app.menuTheme}</span>
                  </div>
                  <div className="px-2 py-1">
                    <button
                      onClick={() => { setThemeLight(); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400' : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span className="text-sm">{s.app.themeLight}</span>
                    </button>
                    <button
                      onClick={() => { setThemeDark(); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400' : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      <span className="text-sm">{s.app.themeDark}</span>
                    </button>
                  </div>
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase">{s.app.menuLanguage}</span>
                  </div>
                  <div className="px-3 py-2">
                    <select
                      value={language}
                      onChange={(e) => { setLanguage(e.target.value as LanguageCode); setMenuOpen(false); }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {language === 'zh'
                            ? `${l.native}${l.code !== 'zh' && l.code !== 'en' ? ` · ${l.zhName}` : ''}`
                            : l.english}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] leading-snug text-slate-400 dark:text-zinc-500">
                      {s.app.languageHint}
                    </p>
                  </div>
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase">{s.app.menuSettings}</span>
                  </div>
                  <div className="px-2 py-1">
                    <button
                      onClick={() => { onClearAllHistory(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="text-sm">{s.app.clearHistory}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex-1 flex justify-center" ref={aiPanelRef}>
            <div className="relative">
              <button
                onClick={toggleAiPanel}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${buttonClass}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-key" viewBox="0 0 16 16">
                  <path d="M0 8a4 4 0 0 1 7.465-2H14a.5.5 0 0 1 .354.146l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0L13 9.207l-.646.647a.5.5 0 0 1-.708 0L11 9.207l-.646.647a.5.5 0 0 1-.708 0L9 9.207l-.646.647A.5.5 0 0 1 8 10h-.535A4 4 0 0 1 0 8zm4-3a3 3 0 1 0 2.712 4.285A.5.5 0 0 1 7.163 9h.63l.853-.854a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.793-.793-1-1h-6.63a.5.5 0 0 1-.451-.285A3 3 0 0 0 4 5z"/>
                  <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
                <span className="text-sm font-medium">{buttonLabel}</span>
                {aiPanelOpen && (
                  <svg className="w-4 h-4 transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {aiPanelOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[480px] max-w-[90vw] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-800 z-50 overflow-hidden">
                  {/* 3 个固定 Tab */}
                  <div className="flex items-stretch border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40">
                    {([
                      ['model', s.aiPanel.tabModel],
                      ['keys', s.aiPanel.tabKeys],
                      ['addProvider', s.aiPanel.tabAddVendor],
                      ['speech', s.aiPanel.tabSpeech],
                    ] as const).map(([key, label]) => {
                      const active = activeAITab === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveAITab(key)}
                          className={`flex-1 px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            active
                              ? 'text-teal-700 dark:text-teal-400 bg-white dark:bg-zinc-900 border-b-2 border-teal-500'
                              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab 内容 */}
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {activeAITab === 'model' && <ModelSelector />}

                    {activeAITab === 'keys' && (
                      <div className="space-y-3">
                        {/* 厂商选择下拉 */}
                        <div>
                          <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{s.aiPanel.selectVendor}</label>
                          <select
                            value={keyTabProviderId}
                            onChange={(e) => setKeyTabProviderId(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          >
                            <optgroup label={s.aiPanel.presetVendors}>
                              {Object.keys(PROVIDER_META).map(id => (
                                <option key={id} value={id}>
                                  {localizedProviderName(id, PROVIDER_META[id], language).name}
                                  {providers[id]?.status === 'valid' ? ' ✓' : ''}
                                </option>
                              ))}
                            </optgroup>
                            {Object.keys(customProviders).length > 0 && (
                              <optgroup label={s.aiPanel.customVendors}>
                                {Object.keys(customProviders).map(id => (
                                  <option key={id} value={id}>
                                    {customProviders[id].name}
                                    {providers[id]?.status === 'valid' ? ' ✓' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>

                        <ProviderKeyInput key={keyTabProviderId} providerId={keyTabProviderId} />

                        {/* 生图服务（通义万相）—— 可选，独立于 chat 厂商 */}
                        <WanxKeyInput />
                      </div>
                    )}

                    {activeAITab === 'addProvider' && <AddProviderForm />}
                    {activeAITab === 'speech' && <SpeechSettings />}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <TabNav activeTab={activeTab} onTabChange={onTabChange} />
          </div>
        </div>
      </div>
    </nav>
  );
}
