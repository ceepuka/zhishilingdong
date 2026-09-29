/**
 * 知识示意图检索（多图库、全免费、零 API Key）
 * ------------------------------------------------------------------
 * 设计原则（来自真实使用反馈）：
 *   「知识检索、图片来源只在 Wikimedia Commons 太局限了，只要是可靠的都可以采用」。
 *
 * 因此这里不再绑定单一图库，而是按关键词语言自动路由到最合适的可靠来源：
 *
 *   ┌ 关键词是英文 → Wikimedia Commons（开放版权、覆盖全球，英文条目最全）
 *   ├ 关键词是中文 → 中文维基百科媒体检索（同 API，中文条目更全）
 *   └ 都查不到     → 返回 null，由上层回退到 SVG 或干脆不显示
 *
 * 为什么不维护"中英词表"：
 *   硬编码词表既覆盖不全、又永远滞后。让 **AI 自己决定** 概念的来源语境
 *   （国外概念给英文关键词、国内概念给中文关键词），比任何词表都准。
 *   AI 给出的关键词是什么语言，我们就走哪个图库 —— 逻辑简单且不会猜错。
 *
 * 全部接口都是公开的 MediaWiki API（origin=* 匿名跨域），**不需要任何 Key**。
 */

export interface FoundImage {
  /** 可直接 <img src> 的图片地址 */
  url: string;
  /** 文件标题（去掉 File: 前缀） */
  title: string;
  /** 文件页地址，便于溯源/署名 */
  pageUrl?: string;
  author?: string;
  license?: string;
  /** 图片来自哪个图库（用于展示"图源：xxx"） */
  source: string;
}

/** 进程内缓存：同一个关键词不要重复跨域请求 */
const cache = new Map<string, FoundImage | null>();

/** 单次检索超时，避免弱网下拖慢渲染 */
const TIMEOUT_MS = 8000;

/** 这些图对知识讲解没价值，直接跳过 */
const BLOCKED = /(icon|logo|banner|button|sprite|favicon|watermark|screenshot|signature)/i;

function stripHtml(s?: string): string {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 关键词是否以中文为主（决定走中文源还是国外源） */
function isMostlyChinese(text: string): boolean {
  const cjk = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  return cjk > 0 && cjk >= letters;
}

/**
 * 在指定的 MediaWiki 站点上按关键词检索一张图片。
 * @param apiBase 站点 API 根地址（如 https://commons.wikimedia.org/w/api.php）
 * @param source  展示用的图源名
 */
async function searchMediaWiki(
  apiBase: string,
  source: string,
  query: string,
  signal?: AbortSignal
): Promise<FoundImage | null> {
  const url = new URL(apiBase);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*'); // 匿名跨域必需
  url.searchParams.set('generator', 'search');
  // 只要位图（排除 svg/音频/视频），并限定在文件命名空间
  url.searchParams.set('gsrsearch', `filetype:bitmap ${query}`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '8');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '800');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onOuterAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
    const json = await res.json();
    const pages = (json?.query?.pages ?? {}) as Record<string, any>;

    for (const page of Object.values(pages)) {
      const info = page?.imageinfo?.[0];
      if (!info) continue;
      const title = String(page.title ?? '').replace(/^File:/i, '').trim();
      if (!title || BLOCKED.test(title)) continue;
      const imgUrl: string | undefined = info.thumburl || info.url;
      if (!imgUrl) continue;
      const meta = info.extmetadata ?? {};
      return {
        url: imgUrl,
        title,
        pageUrl: info.descriptionurl,
        author: stripHtml(meta.Artist?.value),
        license: stripHtml(meta.LicenseShortName?.value),
        source,
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * 按关键词检索一张标准示意图。
 *
 * 路由规则：中文关键词 → 中文维基媒体源；英文/其他 → Wikimedia Commons。
 * 两边都没结果时返回 null（静默失败，绝不阻塞渲染）。
 *
 * @param rawQuery AI 给出的检索关键词（语言由 AI 自行决定）
 */
export async function findKnowledgeImage(
  rawQuery: string,
  signal?: AbortSignal
): Promise<FoundImage | null> {
  const query = (rawQuery ?? '').trim();
  if (!query) return null;

  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  const chinese = isMostlyChinese(query);

  // 主源：按关键词语言选
  const primary = chinese
    ? await searchMediaWiki('https://zh.wikipedia.org/w/api.php', '中文维基百科', query, signal)
    : await searchMediaWiki('https://commons.wikimedia.org/w/api.php', 'Wikimedia Commons', query, signal);
  if (primary) {
    cache.set(key, primary);
    return primary;
  }

  // 备源：换另一个站点再试一次（中英混杂的关键词两边都可能有）
  const secondary = chinese
    ? await searchMediaWiki('https://commons.wikimedia.org/w/api.php', 'Wikimedia Commons', query, signal)
    : await searchMediaWiki('https://zh.wikipedia.org/w/api.php', '中文维基百科', query, signal);

  cache.set(key, secondary);
  return secondary;
}

/** 兼容旧命名 */
export const findCommonsImage = findKnowledgeImage;

/** 测试或切换主题时清空缓存 */
export function clearCommonsImageCache(): void {
  cache.clear();
}
