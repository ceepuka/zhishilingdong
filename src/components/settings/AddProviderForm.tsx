import { useState, useCallback, useMemo } from 'react';
import { useAIConfig } from '../../hooks/useAIConfig';
import type { ProviderInfo, ModelInfo } from '../../types/aiProviders';
import { localizedTemplates, type LocalizedProviderTemplate } from './providerTemplates';
import { useStrings, fmt } from '../../hooks/useStrings';

/**
 * AddProviderForm —— 添加自定义厂商的表单
 * ------------------------------------------------------------------
 * 用户可添加任何 OpenAI 兼容 API 作为自定义厂商。
 *
 * v2：加入**模板**。手填 名称/BaseURL/模型ID 门槛不低，而大多数人其实是在复刻
 * 某个已知服务（OpenAI 官方、OpenRouter、硅基流动、本地 Ollama…）。
 * 选个模板即预填全部字段，仍可自由修改。
 */

export function AddProviderForm() {
  const s = useStrings();
  const { addCustomProvider, validateAndSaveProviderKey } = useAIConfig();

  const templates = useMemo(() => localizedTemplates(s), [s]);

  const [templateId, setTemplateId] = useState<string>('custom');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelsText, setModelsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeTemplate = templates.find(t => t.id === templateId) ?? templates[templates.length - 1];

  /** 套用模板：把预填值写进各字段（Key 永远不预填） */
  const applyTemplate = useCallback((t: LocalizedProviderTemplate) => {
    setTemplateId(t.id);
    setName(t.name);
    setBaseUrl(t.baseUrl);
    setModelsText(t.models.join(', '));
    setError('');
  }, []);

  const handleSubmit = useCallback(async () => {
    setError('');

    if (!name.trim()) { setError(s.addProvider.errorName); return; }
    if (!baseUrl.trim()) { setError(s.addProvider.errorBaseUrl); return; }
    if (!apiKey.trim()) { setError(s.addProvider.errorKey); return; }

    // 解析模型列表
    const modelIds = modelsText
      .split(/[,，\n]/)
      .map(item => item.trim())
      .filter(Boolean);

    if (modelIds.length === 0) { setError(s.addProvider.errorModels); return; }

    const models: ModelInfo[] = modelIds.map((id, i) => ({
      id,
      name: id,
      description: '',
      contextLength: 0,
      recommended: i === 0,
    }));

    const info: Omit<ProviderInfo, 'id'> = {
      name: name.trim(),
      shortName: name.trim(),
      defaultBaseUrl: baseUrl.trim(),
      supportsCustomBaseUrl: true,
      keyFormatHint: fmt(s.keyInput.keyPlaceholderFor, { name: name.trim() }),
      models,
    };

    setSubmitting(true);
    const id = addCustomProvider(info, apiKey.trim());
    // 自动触发验证
    await validateAndSaveProviderKey(id, apiKey.trim(), baseUrl.trim());
    setSubmitting(false);

    // 清空表单（回到空白模板）
    applyTemplate(templates[templates.length - 1]);
    setApiKey('');
  }, [name, baseUrl, apiKey, modelsText, templates, s, addCustomProvider, validateAndSaveProviderKey, applyTemplate]);

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs text-slate-500 dark:text-zinc-500">
          {s.addProvider.intro}
        </p>
      </div>

      {/* 模板快选 */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{s.addProvider.quickTemplate}</label>
        <div className="flex flex-wrap gap-1.5">
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              disabled={submitting}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                templateId === t.id
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:border-teal-400 hover:text-teal-700 dark:hover:text-teal-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeTemplate.hint && (
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed">
            {activeTemplate.hint}
          </p>
        )}
      </div>

      {/* 厂商名称 */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{s.addProvider.vendorName}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={s.addProvider.vendorNamePlaceholder}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          disabled={submitting}
        />
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">
          API Base URL
          {!activeTemplate.editableBaseUrl && activeTemplate.baseUrl && (
            <span className="ml-1.5 text-[11px] font-normal text-slate-400 dark:text-zinc-500">{s.addProvider.baseUrlFixed}</span>
          )}
        </label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={s.addProvider.baseUrlPlaceholder}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          disabled={submitting}
        />
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">{s.keyInput.apiKey}</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-xxxxxxxxxxxx"
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          disabled={submitting}
          autoComplete="off"
        />
      </div>

      {/* 模型列表 */}
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1">
          {s.addProvider.modelIds}
        </label>
        <input
          type="text"
          value={modelsText}
          onChange={(e) => setModelsText(e.target.value)}
          placeholder={s.addProvider.modelIdsPlaceholder}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          disabled={submitting}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* 提交按钮 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full px-3 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
      >
        {submitting ? (
          <>
            <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {s.addProvider.adding}
          </>
        ) : s.addProvider.submit}
      </button>
    </div>
  );
}
