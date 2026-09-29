/**
 * WanxKeyInput —— 生图服务（通义万相）密钥输入项
 * ------------------------------------------------------------------
 * 生图服务独立于 chat 厂商体系（独立端点 + 独立计费），
 * 作为「查词/知识概念配图兜底」的可选能力。
 *
 * 密钥存 localStorage `ai-office-assistant-wanx`，
 * 未配置时生图链路静默跳过，绝不阻塞主链路。
 */
import { useEffect, useState } from 'react';
import {
  getWanxConfig,
  saveWanxConfig,
  isWanxConfigured,
} from '../../services/wanxImage';
import { useStrings } from '../../hooks/useStrings';

export function WanxKeyInput() {
  const s = useStrings();
  const [keyInput, setKeyInput] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saved, setSaved] = useState(false);

  // 挂载时读回已保存的密钥
  useEffect(() => {
    const cfg = getWanxConfig();
    setKeyInput(cfg?.apiKey ?? '');
    setSaved(isWanxConfigured());
  }, []);

  const handleSave = () => {
    const key = keyInput.trim();
    if (!key) {
      // 清空配置
      saveWanxConfig(null);
      setSaved(false);
      return;
    }
    saveWanxConfig({ apiKey: key });
    setSaved(true);
  };

  const handleClear = () => {
    setKeyInput('');
    saveWanxConfig(null);
    setSaved(false);
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-zinc-700 p-3 bg-slate-50/60 dark:bg-zinc-800/40">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{s.wanx.title}</span>
        {saved && (
          <span className="text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded-full">
            {s.wanx.configured}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">{s.wanx.desc}</p>

      <div className="flex items-center gap-2">
        <input
          type={showPwd ? 'text' : 'password'}
          value={keyInput}
          onChange={(e) => { setKeyInput(e.target.value); setSaved(false); }}
          placeholder={s.wanx.placeholder}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setShowPwd((v) => !v)}
          className="px-2 py-2 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          aria-label={showPwd ? s.wanx.hideKey : s.wanx.showKey}
        >
          {showPwd ? s.wanx.hideKey : s.wanx.showKey}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-2 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors"
        >
          {s.common.save}
        </button>
        {saved && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 text-sm rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            {s.wanx.clear}
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2">{s.wanx.note}</p>
    </div>
  );
}
