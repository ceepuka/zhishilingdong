/**
 * 剪贴板与文件下载的统一出口。
 *
 * **为什么要有这一层**（不是"抽个函数好看"，是三个真实故障的共同根因）：
 *
 * 1. 本项目的正式发布形态是**单文件本地 HTML**（`release/知识灵动助手.html`，
 *    见 `docs/versions.md`）。用 `file://` 打开时页面处在**非安全上下文**，
 *    `navigator.clipboard` 整个是 `undefined` —— 裸调它会抛
 *    `TypeError: Cannot read properties of undefined (reading 'writeText')`。
 *    之前 `SentenceResult` / `DocResult` 就是裸调，用户点了没反应也没提示。
 *    `copyText` 先判存在性再降级到 `execCommand`，两条路都不通时**返回 false**，
 *    由调用方决定怎么告诉用户（静默失败是最糟的一种）。
 *
 * 2. 复制逻辑此前散在 4 个组件里，2 个有降级 2 个没有，且降级实现各写一遍。
 *    一处修好别处不修好，所以统一。
 *
 * 3. 文件名此前直接用标题（`${title}.md`）。标题里出现 `\ / : * ? " < > |`
 *    时浏览器会静默改名或下载失败，中文标题还可能触发编码问题。这里统一清洗。
 */

/** 复制结果：区分"成功"和"两条路都不通"，让调用方能给出反馈 */
export type CopyResult = 'copied' | 'failed';

/**
 * Windows / macOS 文件名非法字符，外加控制字符与首尾空白点。
 *
 * 反斜杠必须一并处理：`a\b.txt` 在 Win32 上是**目录分隔符**，不洗掉会被写成子目录。
 * 另外预留 Windows 保留设备名（CON / PRN / AUX / NUL / COM1..9 / LPT1..9）。
 */
const ILLEGAL_FILENAME = /[\\/:*?"<>|\u0000-\u001f]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * 把任意文本变成安全的文件名（不含扩展名）。
 *
 * @param raw 原始标题
 * @param fallback 清洗后为空时使用（例如整段都是表情符号）
 * @param maxLen 保留长度上限；过长的标题在 Windows 上会触发路径长度问题
 */
export function safeFilename(raw: string, fallback = 'untitled', maxLen = 80): string {
  let name = (raw ?? '')
    // 先压掉换行/制表符：文件名里的换行会让部分系统截断
    .replace(/[\r\n\t]+/g, ' ')
    .replace(ILLEGAL_FILENAME, '_')
    // 句点不能结尾（Windows 会静默去掉，文件名变成 `foo`）
    .replace(/[. ]+$/g, '')
    .trim();

  if (name.length > maxLen) name = name.slice(0, maxLen).trim();
  if (!name || WINDOWS_RESERVED.test(name)) return fallback;
  // 整串都是非法字符（`///` → `___`）时不该产出 `___` 这种无意义文件名，
  // 它对用户毫无辨识度，还不如用 fallback
  if (!/[^\s_]/.test(name)) return fallback;
  return name;
}

/**
 * 老式复制：隐藏 textarea + execCommand。
 *
 * 两个容易踩的点：
 * - textarea 必须挂在 DOM 上，且要 `position:fixed; left:-9999px` —— 用
 *   `display:none` 或 `visibility:hidden` 的元素在部分浏览器里**无法被 select**，
 *   于是 `execCommand` 静默返回 false，代码继续往下走，用户什么都没复制到。
 * - `readonly` 而非 `disabled`：disabled 的 textarea 不会被作为选区目标。
 */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  let ok = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
    // 还原用户原本的选区：复制不该顺手把页面上正在选的东西清掉
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
  }
  return ok;
}

/**
 * 复制文本到剪贴板，**永不抛异常**。
 *
 * 优先级：`navigator.clipboard.writeText`（需安全上下文 + 权限）
 * → `execCommand('copy')`（老路径，本地 file:// 下唯一可用的）
 * → 失败。
 *
 * 返回 `CopyResult` 而不是 void，理由很实际：这两个降级都可能静默失败
 * （权限被拒、浏览器策略、execCommand 返回 false）。调用方拿到 `failed`
 * 才可以提示用户，**否则用户点了复制什么都没发生，也没有任何提示**。
 */
export async function copyText(text: string): Promise<CopyResult> {
  if (!text) return 'failed';

  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return 'copied';
    } catch {
      // 落到下面 —— 权限被拒时仍可能用老路径成功
    }
  }
  return legacyCopy(text) ? 'copied' : 'failed';
}

/**
 * 触发浏览器下载。
 *
 * @param content 文件内容（字符串）
 * @param filename 建议文件名，内部会经 `safeFilename` 清洗
 * @param type MIME 类型
 */
export function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  triggerDownload(blob, filename);
}

/**
 * 触发浏览器下载（二进制内容）。
 *
 * URL 的 revoke 延后到下一帧：`a.click()` 之后的下载是异步启动的，
 * 同步 revoke 在部分浏览器（尤其 file:// 环境）会导致下载被取消。
 */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename(filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 下载图片。
 *
 * 跨源直链（AI 配图的 CDN URL）不能直接 `a.download` —— 浏览器的
 * download 属性对跨源链接无效，会变成在新标签页**打开**图片而不是下载。
 * 这里先 fetch 成 blob 兜底；拿不到（CORS 拒绝）再退回"打开原图"，
 * 总比让用户点一下什么也没发生要好。
 */
export async function downloadImage(source: string, filename: string): Promise<'downloaded' | 'opened' | 'failed'> {
  const clean = safeFilename(filename, 'image');

  // data: URL 直接转 blob，无需网络
  if (source.startsWith('data:')) {
    try {
      const res = await fetch(source);
      triggerDownload(await res.blob(), clean);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }

  try {
    const res = await fetch(source, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    triggerDownload(await res.blob(), clean);
    return 'downloaded';
  } catch {
    // 跨域失败：退为打开原图（用户再自行另存）
    const link = document.createElement('a');
    link.href = source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return 'opened';
  }
}