/**
 * 通义万相（wanx）文本生图服务
 * ------------------------------------------------------------------
 * 用途：查词/知识概念的配图兜底 —— 当 AI 拿不到可靠真实图时，
 * 用生图模型按 AI 给出的 imageQuery 关键词生成一张示意图。
 *
 * 端点：阿里云百炼 DashScope 的多模态生图接口（wanx2.1-t2i-turbo），
 * 返回临时图片 URL（约 24 小时有效），前端直接用 <img> 承载。
 *
 * 设计：作为**可选能力**独立于 chat provider 体系（生图是独立端点 + 独立计费），
 * 不配置密钥时静默跳过，绝不阻塞主链路。
 */

export interface WanxImageConfig {
  /** 通义万相 API Key（DashScope sk-xxxx） */
  apiKey: string;
}

/** 生图结果：临时可访问的图片 URL */
export interface GeneratedImage {
  url: string;
  /** 是否成功 */
  ok: boolean;
  /** 失败原因（ok=false 时） */
  error?: string;
}

const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const DEFAULT_MODEL = 'wanx2.1-t2i-turbo';
const TIMEOUT_MS = 30000;

let cachedConfig: WanxImageConfig | null = null;

/** 从 localStorage 读取 wanx 配置（无则返回 null） */
function readConfig(): WanxImageConfig | null {
  try {
    const raw = localStorage.getItem('ai-office-assistant-wanx');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WanxImageConfig>;
    return parsed?.apiKey ? { apiKey: parsed.apiKey } : null;
  } catch {
    return null;
  }
}

/** 保存 wanx 配置（供设置面板调用） */
export function saveWanxConfig(config: WanxImageConfig | null): void {
  cachedConfig = config;
  try {
    if (config) {
      localStorage.setItem('ai-office-assistant-wanx', JSON.stringify(config));
    } else {
      localStorage.removeItem('ai-office-assistant-wanx');
    }
  } catch {
    /* ignore */
  }
}

/** 是否已配置 wanx 生图 */
export function isWanxConfigured(): boolean {
  if (cachedConfig) return true;
  cachedConfig = readConfig();
  return cachedConfig !== null;
}

/** 获取当前配置 */
export function getWanxConfig(): WanxImageConfig | null {
  if (cachedConfig) return cachedConfig;
  cachedConfig = readConfig();
  return cachedConfig;
}

/**
 * 提交生图任务（同步返回图片 URL）。
 * DashScope 的 wanx2.1-t2i-turbo 支持同步模式（header `X-DashScope-Async: enable` 关闭异步），
 * 直接返回 results[].url；失败时降级到异步轮询。
 */
export async function generateImageByWanx(prompt: string, size = '1024*1024'): Promise<GeneratedImage> {
  const config = getWanxConfig();
  if (!config) {
    return { url: '', ok: false, error: 'wanx-not-configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        input: { prompt },
        parameters: { size, n: 1 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { url: '', ok: false, error: `http-${res.status}` };
    }

    const data = await res.json();
    const url = data?.output?.results?.[0]?.url as string | undefined;
    if (url) {
      return { url, ok: true };
    }

    // 同步模式未直接返回 url（可能走了异步），尝试轮询 task_id
    const taskId = data?.output?.task_id as string | undefined;
    if (taskId) {
      return await pollWanxTask(config.apiKey, taskId);
    }

    return { url: '', ok: false, error: 'no-result' };
  } catch (e: any) {
    return { url: '', ok: false, error: e?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** 异步任务轮询 */
async function pollWanxTask(apiKey: string, taskId: string): Promise<GeneratedImage> {
  const pollUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      return { url: '', ok: false, error: `poll-http-${res.status}` };
    }
    const data = await res.json();
    const status = data?.output?.task_status as string;
    if (status === 'SUCCEEDED') {
      const url = data?.output?.results?.[0]?.url as string | undefined;
      return url ? { url, ok: true } : { url: '', ok: false, error: 'no-result' };
    }
    if (status === 'FAILED') {
      return { url: '', ok: false, error: 'task-failed' };
    }
    // 排队/处理中，等待后继续
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { url: '', ok: false, error: 'timeout' };
}
