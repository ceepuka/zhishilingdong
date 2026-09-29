import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ai-office-assistant-theme';

// 模块级共享状态（所有 useTheme() 调用共享同一份数据）
let sharedTheme: Theme = readStorage();
const listeners = new Set<() => void>();

function readStorage(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function notify() {
  listeners.forEach((l) => l());
}

// 初始化：应用当前主题
applyTheme(sharedTheme);

// 监听系统主题变化（仅当用户未手动设置时生效）
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      sharedTheme = e.matches ? 'dark' : 'light';
      applyTheme(sharedTheme);
      notify();
    }
  });

  // 监听跨标签页修改
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      sharedTheme = readStorage();
      applyTheme(sharedTheme);
      notify();
    }
  });
}

export function useTheme() {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
  }, []);

  const getSnapshot = useCallback(() => sharedTheme, []);

  const theme = useSyncExternalStore(subscribe, getSnapshot);

  const toggleTheme = useCallback(() => {
    sharedTheme = sharedTheme === 'light' ? 'dark' : 'light';
    applyTheme(sharedTheme);
    notify();
  }, []);

  const setThemeLight = useCallback(() => {
    if (sharedTheme === 'light') return;
    sharedTheme = 'light';
    applyTheme(sharedTheme);
    notify();
  }, []);

  const setThemeDark = useCallback(() => {
    if (sharedTheme === 'dark') return;
    sharedTheme = 'dark';
    applyTheme(sharedTheme);
    notify();
  }, []);

  return {
    theme,
    toggleTheme,
    setThemeLight,
    setThemeDark,
  };
}
