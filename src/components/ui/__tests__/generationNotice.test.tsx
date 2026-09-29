import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GenerationNotice } from '../GenerationNotice';
import { getCurrentStrings } from '../../../i18n/strings';
import { createInterruption } from '../../../services/streaming/interruption';

afterEach(cleanup);

/**
 * 中断提示分档契约。
 *
 * 核心不变量：**不能把非模型原因说成"模型输出上限"**。
 * 旧实现只有 `truncated: boolean`，于是网络中断也会显示"内容因模型输出上限被截断"——
 * 用户被误导去换模型，而真正该做的是检查网络。这里把"按原因分档"钉死。
 */
describe('GenerationNotice — 按中断原因分档', () => {
  const notices = getCurrentStrings().search.notices;

  it('没有任何中断标记 → 不渲染', () => {
    const { container } = render(<GenerationNotice data={{}} />);
    expect(container.textContent).toBe('');
  });

  it('data 为 null → 不渲染（历史数据缺字段时的安全性）', () => {
    const { container } = render(<GenerationNotice data={null} />);
    expect(container.textContent).toBe('');
  });

  it('网络中断（link 侧）→ 用网络文案，且绝不出现"输出上限"归因', () => {
    const info = createInterruption('network', { attempts: 3, resolved: false });
    const { container } = render(<GenerationNotice data={{ truncated: true, interruption: info }} />);
    expect(container.textContent).toContain(notices.networkTitle);
    expect(container.textContent).toContain(notices.networkBody);
    expect(container.textContent).not.toContain(notices.truncatedTitle);
  });

  it('超时 → 用超时文案', () => {
    const info = createInterruption('timeout', { attempts: 2, resolved: false });
    const { container } = render(<GenerationNotice data={{ truncated: true, interruption: info }} />);
    expect(container.textContent).toContain(notices.timeoutTitle);
  });

  it('流式协议中断 → 用协议文案', () => {
    const info = createInterruption('protocol', { resolved: false });
    const { container } = render(<GenerationNotice data={{ truncated: true, interruption: info }} />);
    expect(container.textContent).toContain(notices.protocolTitle);
  });

  it('被安全策略拦截 → 用安全策略文案（不是网络、也不是输出上限）', () => {
    const info = createInterruption('content_filter', { resolved: false });
    const { container } = render(<GenerationNotice data={{ truncated: true, interruption: info }} />);
    expect(container.textContent).toContain(notices.contentFilterTitle);
    expect(container.textContent).not.toContain(notices.networkTitle);
  });

  it('模型输出上限 / 网关静默截断 → 用"提前结束"文案', () => {
    for (const kind of ['length', 'incomplete'] as const) {
      const info = createInterruption(kind, { resolved: false });
      const { container, unmount } = render(<GenerationNotice data={{ truncated: true, interruption: info }} />);
      expect(container.textContent).toContain(notices.incompleteTitle);
      unmount();
    }
  });

  it('已被续写补全（resolved）→ 显示"已自动续写并补全"，不再报不完整', () => {
    const info = createInterruption('network', { attempts: 2, resolved: true });
    const { container } = render(<GenerationNotice data={{ continued: true, interruption: info }} />);
    expect(container.textContent).toContain(notices.continued);
    expect(container.textContent).not.toContain(notices.networkTitle);
  });

  it('尝试多次仍未补全 → 附上尝试次数（透明告知自动续写做过什么）', () => {
    const info = createInterruption('length', { attempts: 3, resolved: false });
    const { container } = render(<GenerationNotice data={{ truncated: true, interruption: info }} />);
    expect(container.textContent).toContain('3');
  });

  it('旧历史数据（只有 truncated 布尔，无归因）→ 兼容旧文案', () => {
    const { container } = render(<GenerationNotice data={{ truncated: true }} />);
    expect(container.textContent).toContain(notices.truncatedTitle);
  });

  it('旧历史数据（只有 continued 布尔）→ 兼容"已续写并补全"提示', () => {
    const { container } = render(<GenerationNotice data={{ continued: true }} />);
    expect(container.textContent).toContain(notices.continued);
  });
});
