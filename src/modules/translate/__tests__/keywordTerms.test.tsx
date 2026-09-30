import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { WordResult as WordResultType, SentenceResult as SentenceResultType, TranslateStyle } from '../../../types';
import { getCurrentStrings } from '../../../i18n/strings';

/**
 * 关键词 / 关联术语 / 常用搭配 的交互契约。
 *
 * 三件事必须钉住：
 * ① **关键词带释义**：只有词也算能渲染（缺释义是少一行字，不是少一条），
 *    旧数据里的裸字符串数组不能被渲染成 `[object Object]` 或空行；
 * ② **查词模式**：关键词、关联术语、常用搭配点下去都回到"查词"，带着的是词本身；
 * ③ **翻译模式**：关键词跳查词，关联术语跳知识搜索 —— 两条出口不能串。
 */

const s = getCurrentStrings();

const stubsSpeech = () => {
  // jsdom 没有 Web Speech API，useSpeechSynthesis 的 effect 会直接抛
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => [], speak: () => {}, cancel: () => {}, onvoiceschanged: undefined },
  });
  (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class {
    constructor(public text: string) {}
  };
};

let WordResult: ComponentType<{ result: WordResultType; onLookup?: (t: string) => void }>;
let SentenceResult: ComponentType<{
  result: SentenceResultType;
  onLookup?: (t: string) => void;
  onSearchTopic?: (t: string) => void;
}>;
let TranslateInput: ComponentType<{
  onTranslate: (text: string) => void;
  mode: 'dictionary' | 'translate';
  onModeChange: (m: 'dictionary' | 'translate') => void;
  sourceLang: 'auto';
  targetLang: 'zh';
  onSourceChange: () => void;
  onTargetChange: () => void;
  style: TranslateStyle;
  onStyleChange: (st: TranslateStyle) => void;
}>;
let TermList: ComponentType<{
  items: ReadonlyArray<{ term: string; definition?: string } | string>;
  onSelect?: (t: string) => void;
}>;

beforeAll(async () => {
  stubsSpeech();
  TermList = (await import('../../../components/ui/TermList')).TermList as typeof TermList;
  WordResult = (await import('../WordResult')).WordResult as typeof WordResult;
  SentenceResult = (await import('../SentenceResult')).SentenceResult as typeof SentenceResult;
  TranslateInput = (await import('../TranslateInput')).TranslateInput as typeof TranslateInput;
}, 60000);

afterEach(cleanup);

const wordFixture = (over: Partial<WordResultType>): WordResultType => ({
  word: 'take into account',
  isPhrase: true,
  phonetic: '',
  definitions: [{ pos: '', meaning: '考虑到' }],
  ...over,
});

describe('TermList — 「词 + 一句话释义」', () => {
  it('词与释义都渲染出来', () => {
    render(<TermList items={[{ term: 'good', definition: '好的；令人愉快的' }]} />);
    expect(screen.getByText('good')).toBeTruthy();
    expect(screen.getByText('好的；令人愉快的')).toBeTruthy();
  });

  it('缺释义的条目照样渲染（只显示词），不丢条目', () => {
    const { container } = render(
      <TermList items={[{ term: 'good', definition: '好的；令人愉快的' }, { term: 'morning' }]} />,
    );
    expect(screen.getByText('morning')).toBeTruthy();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('裸字符串（AI 偷懒 / 旧数据）不会被渲染成 [object Object] 或空行', () => {
    const { container } = render(<TermList items={['give', 'hope'] as unknown as string[]} />);
    expect(screen.getByText('give')).toBeTruthy();
    expect(screen.getByText('hope')).toBeTruthy();
    expect(container.textContent).not.toContain('[object Object]');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('点击回调拿到的是词本身', () => {
    const onSelect = vi.fn();
    render(<TermList items={[{ term: 'give up', definition: '放弃' }]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('give up'));
    expect(onSelect).toHaveBeenCalledWith('give up');
  });

  it('不传 onSelect 时没有可点元素（收藏夹等只读场景）', () => {
    const { container } = render(<TermList items={[{ term: 'give up', definition: '放弃' }]} />);
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('WordResult — 查词模式的三个入口都回到查词', () => {
  it('点关键词：带头查词', () => {
    const onLookup = vi.fn();
    render(
      <WordResult
        result={wordFixture({ keywords: [{ term: 'account', definition: '账户；解释' }] })}
        onLookup={onLookup}
      />,
    );
    fireEvent.click(screen.getByText('account'));
    expect(onLookup).toHaveBeenCalledWith('account');
  });

  it('点关联术语 / 常用搭配：同样带头查词', () => {
    const onLookup = vi.fn();
    render(
      <WordResult
        result={wordFixture({ relatedTerms: ['factor'], collocations: ['take account of'] })}
        onLookup={onLookup}
      />,
    );
    fireEvent.click(screen.getByText('factor'));
    fireEvent.click(screen.getByText('take account of'));
    expect(onLookup).toHaveBeenNthCalledWith(1, 'factor');
    expect(onLookup).toHaveBeenNthCalledWith(2, 'take account of');
  });

  it('关键词区块标题带"点击可查词"的提示', () => {
    render(<WordResult result={wordFixture({ keywords: [{ term: 'account' }] })} onLookup={() => {}} />);
    expect(screen.getByText(s.translate.keywordHint)).toBeTruthy();
  });
});

describe('SentenceResult — 关键词跳查词，关联术语跳知识搜索', () => {
  const sentence = (over: Partial<SentenceResultType>): SentenceResultType =>
    ({
      original: 'Good morning',
      translation: '早上好',
      style: 'casual',
      sourceLang: 'en',
      targetLang: 'zh',
      ...over,
    }) as SentenceResultType;

  it('关键词走 onLookup', () => {
    const onLookup = vi.fn();
    const onSearchTopic = vi.fn();
    render(
      <SentenceResult
        result={sentence({ keywords: [{ term: 'morning', definition: '早晨' }] })}
        onLookup={onLookup}
        onSearchTopic={onSearchTopic}
      />,
    );
    fireEvent.click(screen.getByText('morning'));
    expect(onLookup).toHaveBeenCalledWith('morning');
    expect(onSearchTopic).not.toHaveBeenCalled();
  });

  it('关联术语走 onSearchTopic', () => {
    const onLookup = vi.fn();
    const onSearchTopic = vi.fn();
    render(
      <SentenceResult
        result={sentence({ relatedTerms: ['greeting'] })}
        onLookup={onLookup}
        onSearchTopic={onSearchTopic}
      />,
    );
    fireEvent.click(screen.getByText('greeting'));
    expect(onSearchTopic).toHaveBeenCalledWith('greeting');
    expect(onLookup).not.toHaveBeenCalled();
  });

  it('结果卡上不再有可切换的风格按钮（风格已前移到输入区）', () => {
    render(
      <SentenceResult
        result={sentence({ relatedTerms: ['greeting'] })}
        onLookup={() => {}}
        onSearchTopic={() => {}}
      />,
    );
    // 只展示"这次用了哪种风格"，不提供 select 语义
    expect(screen.getByText(`${s.translate.styleCasual}${s.translate.styleSuffix}`)).toBeTruthy();
  });
});

describe('TranslateInput — 风格在翻译前选', () => {
  const academic = `${s.translate.styleAcademic}${s.translate.styleSuffix}`;
  const business = `${s.translate.styleBusiness}${s.translate.styleSuffix}`;

  const renderInput = (mode: 'dictionary' | 'translate', onStyleChange = vi.fn()) => {
    render(
      <TranslateInput
        onTranslate={() => {}}
        mode={mode}
        onModeChange={() => {}}
        sourceLang="auto"
        targetLang="zh"
        onSourceChange={() => {}}
        onTargetChange={() => {}}
        style="business"
        onStyleChange={onStyleChange}
      />,
    );
    return onStyleChange;
  };

  it('查词模式不显示风格选择器', () => {
    renderInput('dictionary');
    expect(screen.queryByText(s.translate.styleLabel)).toBeNull();
    expect(screen.queryByText(academic)).toBeNull();
  });

  it('翻译模式显示风格选择器，点击回调对应风格', () => {
    const onStyleChange = renderInput('translate');
    expect(screen.getByText(s.translate.styleLabel)).toBeTruthy();
    fireEvent.click(screen.getByText(academic));
    expect(onStyleChange).toHaveBeenCalledWith('academic');
    expect(screen.getByText(business)).toBeTruthy();
  });
});
