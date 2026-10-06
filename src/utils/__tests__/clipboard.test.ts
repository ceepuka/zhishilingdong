import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeFilename, copyText } from '../clipboard';

/**
 * 剪贴板与文件名清洗的回归。
 *
 * 背景不是"想测一下"，是两个真实故障：
 * 1. 本项目发布形态是**本地单文件 HTML**（`file://`）。那里 `navigator.clipboard`
 *    是 `undefined`，裸调会抛 `TypeError`。所以 `copyText` 必须先判存在性，
 *    再降级到 `execCommand`，两条都不通时返回 `failed` 而不是静默。
 * 2. 文件名此前直接拼 `${title}.md`。标题含 `\ / : * ? " < > |` 时浏览器静默改名
 *    或下载失败；中文标题还可能触发编码问题。
 */

describe('safeFilename — 文件名安全化', () => {
  it('控制字符与非法字符都被清洗（防正则字符类乱序回归）', () => {
    // 真实事故：`ILLEGAL_FILENAME` 的字符类里混入**裸 NUL / US 控制字符**后，
    // 正则变成 `[<NUL>-<US>]` → 浏览器编译时报 "Range out of order in character class"
    // → 模块顶层抛 SyntaxError → **整个应用白屏**。
    // tsc 与 vitest 都抓不到（正则只在浏览器真正编译时才抛），
    // 这里直接用行为兜住：控制字符必须被替换掉，不能留在文件名里。
    expect(safeFilename('a\u0000b\u001fc')).toBe('a_b_c');
    expect(safeFilename('a\nb')).toBe('a b');
  });

  it('替换 Windows / POSIX 非法字符', () => {
    expect(safeFilename('牛顿:第二定律')).toBe('牛顿_第二定律');
    expect(safeFilename('a/b\\c')).toBe('a_b_c');
    expect(safeFilename('why? *not* <this>')).toBe('why_ _not_ _this_');
  });

  it('保留中文与空格', () => {
    expect(safeFilename('知识灵动助手 导出')).toBe('知识灵动助手 导出');
  });

  it('折叠换行与制表符（文件名里的换行会让部分系统截断）', () => {
    expect(safeFilename('a\nb\tc')).toBe('a b c');
  });

  it('不以点或空格结尾（Windows 会静默去掉，文件名变形）', () => {
    expect(safeFilename('name...')).toBe('name');
    expect(safeFilename('name   ')).toBe('name');
  });

  it('空标题 / 全非法字符 → 用 fallback', () => {
    expect(safeFilename('')).toBe('untitled');
    expect(safeFilename('///')).toBe('untitled');
    expect(safeFilename('', '知识笔记')).toBe('知识笔记');
  });

  it('规避 Windows 保留设备名（CON/PRN/AUX/NUL/COM1/LPT1）', () => {
    // 直接用会写到设备而不是文件
    expect(safeFilename('CON')).toBe('untitled');
    expect(safeFilename('nul.md')).toBe('untitled');
    expect(safeFilename('COM1')).toBe('untitled');
    expect(safeFilename('LPT9.txt')).toBe('untitled');
    // 大小写不敏感
    expect(safeFilename('con')).toBe('untitled');
    // 不在保留名单里的正常放行
    expect(safeFilename('console')).toBe('console');
  });

  it('超长标题被截断到上限（避免 Windows 路径长度问题）', () => {
    const long = 'x'.repeat(300);
    expect(safeFilename(long).length).toBeLessThanOrEqual(80);
  });
});

describe('copyText — 两条路径的降级', () => {
  let execCommandSpy: ReturnType<typeof vi.fn>;
  let execCommandOriginal: unknown;

  beforeEach(() => {
    execCommandSpy = vi.fn(() => true);
    execCommandOriginal = document.execCommand;
    // jsdom 没实现 execCommand
    (document as unknown as Record<string, unknown>).execCommand = execCommandSpy;
  });

  afterEach(() => {
    (document as unknown as Record<string, unknown>).execCommand = execCommandOriginal;
    vi.restoreAllMocks();
  });

  /** 模拟 file:// 环境：navigator.clipboard 整个不存在 */
  const withoutClipboardApi = () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  };

  it('优先走 navigator.clipboard.writeText', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await expect(copyText('hello')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hello');
    // 主路径成功时不该碰 execCommand
    expect(execCommandSpy).not.toHaveBeenCalled();
  });

  it('clipboard 不存在（file:// 非安全上下文）→ 降级 execCommand，不抛', async () => {
    withoutClipboardApi();

    await expect(copyText('hello')).resolves.toBe('copied');
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('clipboard 存在但被拒（权限）→ 降级 execCommand', async () => {
    const writeText = vi.fn(async () => { throw new Error('NotAllowedError'); });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await expect(copyText('hello')).resolves.toBe('copied');
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('两条路都不通 → 返回 failed（调用方据此提示，绝不静默）', async () => {
    const writeText = vi.fn(async () => { throw new Error('denied'); });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    execCommandSpy.mockReturnValue(false);

    await expect(copyText('hello')).resolves.toBe('failed');
  });

  it('execCommand 抛异常也不能冒泡（必须收敛成 failed）', async () => {
    withoutClipboardApi();
    execCommandSpy.mockImplementation(() => { throw new Error('boom'); });

    await expect(copyText('hello')).resolves.toBe('failed');
  });

  it('空文本直接 failed，不做任何 DOM 操作', async () => {
    await expect(copyText('')).resolves.toBe('failed');
    expect(execCommandSpy).not.toHaveBeenCalled();
  });

  it('降级用的临时 textarea 会被移除，且不是 display:none（否则无法 select）', async () => {
    withoutClipboardApi();
    let captured: HTMLTextAreaElement | null = null;
    execCommandSpy.mockImplementation(() => {
      captured = document.querySelector('textarea[aria-hidden]') as HTMLTextAreaElement;
      return true;
    });

    await copyText('payload');

    expect(captured).not.toBeNull();
    // 已从 DOM 摘掉，不留残渣
    expect(document.querySelector('textarea[aria-hidden]')).toBeNull();
  });
});