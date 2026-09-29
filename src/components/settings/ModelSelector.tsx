import {
  PROVIDER_META,
  getProviderInfo,
  getModelCapabilities,
  getModelTier,
  describeCapabilities,
  type ModelCapabilities,
  type ModelTier,
} from '../../types/aiProviders';
import { useAIConfig } from '../../hooks/useAIConfig';
import { useStrings, fmt } from '../../hooks/useStrings';
import type { Strings } from '../../i18n/strings';
import { localizedProviderName, localizedModelDescription } from '../../i18n/strings/aiProviderTexts';
import { useLanguage } from '../../hooks/useLanguage';

function formatContextLength(n: number, unknownLabel: string): string {
  if (!n || n <= 0) return unknownLabel;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

const TIER_CLASS: Record<ModelTier, string> = {
  flagship: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  balanced: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  light: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300',
};

function tierLabel(s: Strings, tier: ModelTier): string {
  return tier === 'flagship' ? s.model.tierFlagship : tier === 'balanced' ? s.model.tierBalanced : s.model.tierLight;
}

function CapabilityBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[11px] ${
        on
          ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
          : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 line-through'
      }`}
    >
      {label}
    </span>
  );
}

/** 依据能力画像给出选型建议（知识生成是"长输出 + 强结构化"任务，对模型很挑） */
function advise(s: Strings, caps: ModelCapabilities, tier: ModelTier, isCustom: boolean): string | null {
  if (isCustom) return s.model.adviseCustom;
  if (caps.maxOutputTokens < 4096) return s.model.adviseLowOutput;
  if (tier === 'light') return s.model.adviseLight;
  if (caps.reasoning) return s.model.adviseReasoning;
  if (!caps.streaming) return s.model.adviseNoStreaming;
  return null;
}

export function ModelSelector() {
  const s = useStrings();
  const { language } = useLanguage();
  const {
    providers,
    customProviders,
    activeProviderId,
    activeModelId,
    setActiveProvider,
    setActiveModel,
    patchProviderConfig,
  } = useAIConfig();

  const allPresetIds = Object.keys(PROVIDER_META);
  const allCustomIds = Object.keys(customProviders);
  const activeInfo = getProviderInfo(activeProviderId, customProviders);
  const activeModels = activeInfo?.models ?? [];
  const activeCfg = providers[activeProviderId];
  const displayName = activeInfo ? localizedProviderName(activeProviderId, activeInfo, language) : undefined;
  const isCustomModelMode = !!(activeCfg?.customModel?.trim());

  const currentModelName = isCustomModelMode
    ? activeCfg.customModel
    : (activeInfo?.models.find(m => m.id === activeModelId)?.name || activeModelId);
  const currentCtxLen = activeInfo?.models.find(m => m.id === activeModelId)?.contextLength;

  // 能力画像：决定请求参数怎么裁剪，也决定这里给什么选型建议
  const caps = getModelCapabilities(activeProviderId, activeModelId, customProviders, activeCfg);
  const tier = getModelTier(activeProviderId, activeModelId, customProviders, activeCfg);
  const tierCls = TIER_CLASS[tier];
  const tip = advise(s, caps, tier, isCustomModelMode);

  const handleProviderChange = (id: string) => {
    setActiveProvider(id);
  };

  const handleModelChange = (val: string) => {
    if (val === '__custom__') {
      patchProviderConfig(activeProviderId, { customModel: activeModelId || '' });
    } else {
      setActiveModel(val);
    }
  };

  return (
    <div className="space-y-3">
      {/* 当前模型摘要 */}
      <div className="px-1 flex flex-wrap items-center gap-y-1">
        <span className="text-sm text-slate-500 dark:text-zinc-500">{s.model.currentModel}</span>
        <span className="text-base font-semibold text-teal-700 dark:text-teal-400 ml-1">
          {displayName?.shortName ?? s.common.unknown} · {currentModelName}
        </span>
        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[11px] ${tierCls}`}>{tierLabel(s, tier)}</span>
        {currentCtxLen && !isCustomModelMode ? (
          <span className="ml-1.5 text-sm text-slate-400 dark:text-zinc-500">
            {fmt(s.model.contextLength, { n: formatContextLength(currentCtxLen, s.common.unknown) })}
          </span>
        ) : null}
      </div>

      {/* 厂商下拉 */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{s.model.vendor}</label>
        <select
          value={activeProviderId}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        >
          <optgroup label={s.aiPanel.presetVendors}>
            {allPresetIds.map(id => (
              <option key={id} value={id}>
                {localizedProviderName(id, PROVIDER_META[id], language).name}
                {providers[id]?.status === 'valid' ? ' ✓' : ''}
              </option>
            ))}
          </optgroup>
          {allCustomIds.length > 0 && (
            <optgroup label={s.aiPanel.customVendors}>
              {allCustomIds.map(id => (
                <option key={id} value={id}>
                  {customProviders[id].name}
                  {providers[id]?.status === 'valid' ? ' ✓' : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* 型号下拉 */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{s.model.modelLabel}</label>
        <select
          value={isCustomModelMode ? '__custom__' : activeModelId}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        >
          {activeModels.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} {m.recommended ? s.model.recommended : ''} — {formatContextLength(m.contextLength, s.common.unknown)}
            </option>
          ))}
          <option value="__custom__">{s.model.customModelIdOption}</option>
        </select>
      </div>

      {/* 自定义模型输入 */}
      {isCustomModelMode && (
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">
            {s.model.customModelId}
          </label>
          <input
            type="text"
            value={activeCfg.customModel}
            onChange={(e) => patchProviderConfig(activeProviderId, { customModel: e.target.value })}
            placeholder={s.model.customModelPlaceholder}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            {s.model.customModelNote}
          </p>
        </div>
      )}

      {/* 型号简介 + 能力画像 */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 rounded-lg space-y-2">
        {(() => {
          const m = isCustomModelMode ? null : activeInfo?.models.find(x => x.id === activeModelId);
          if (!m) {
            return (
              <>
                <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">{s.model.capabilityUnknown}</div>
                <div className="text-xs text-slate-500 dark:text-zinc-500">
                  {fmt(s.model.conservativeFallback, { caps: describeCapabilities(caps) })}
                </div>
              </>
            );
          }
          return (
            <>
              <div>
                <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">{m.name}</div>
                <div className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">{localizedModelDescription(m.id, m.description, language)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <CapabilityBadge on={caps.streaming} label={s.model.capStreaming} />
                <CapabilityBadge on={caps.jsonMode} label={s.model.capJsonMode} />
                <CapabilityBadge on={caps.reasoning} label={s.model.capReasoning} />
                <CapabilityBadge on={!!caps.vision} label={s.model.capVision} />
                <span className="ml-1 text-[11px] text-slate-400 dark:text-zinc-500">
                  {fmt(s.model.outputLimit, { n: formatTokens(caps.maxOutputTokens) })}
                </span>
              </div>
            </>
          );
        })()}
        {tip && (
          <p className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">{tip}</p>
        )}
      </div>
    </div>
  );
}
