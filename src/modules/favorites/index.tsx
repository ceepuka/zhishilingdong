import { useState, forwardRef, useCallback } from 'react';
import { FavoriteItem, GeneratedKnowledge, WordResult as WordResultType, SentenceResult as SentenceResultType } from '../../types';
import { useFavorites } from '../../hooks/useFavorites';
import { useStrings, fmt } from '../../hooks/useStrings';
import { FavoriteContent } from './FavoriteContent';
import { KnowledgeContentView, isGeneratedKnowledge } from '../../components/knowledge/KnowledgeContentView';
import { LatexText } from '../../components/ui/LatexText';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { GenerationNotice, type GenerationNoticeData } from '../../components/ui/GenerationNotice';
import { TermList } from '../../components/ui/TermList';
import { CopyButton, ActionFeedbackToast, useActionFeedback } from '../../components/ui/ActionBar';
import { ExportMenu } from '../../components/ui/ExportMenu';
import { downloadText, safeFilename, triggerDownload } from '../../utils/clipboard';
import { serializeWordResult, serializeSentenceResult, serializeDocumentResult } from '../../utils/serialize';
import { exportDocx } from '../../utils/exportDocx';
import { generateKnowledgeNote } from '../../utils/export';
import { buildMarkdownPdf } from '../../utils/exportPdf';

interface FavoritesModuleRef {
  showFavorite?: (item: FavoriteItem) => void;
}

/** 详情页返回按钮（各分支共用，避免四份重复实现各自漂移） */
function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
    >
      {label}
    </button>
  );
}

/**
 * 详情页工具条：复制 + 导出。
 *
 * **收藏详情此前完全没有复制/导出入口** —— 用户在别处收藏了一份知识笔记，
 * 进详情页只能读，取不出来。这个缺口和"内容不全"是同一类问题：
 * 功能存在但没有出口。
 *
 * 文案与序列化全部走共用出口（serialize* / exportKnowledgeNote / exportDocx），
 * **不另写一份拼接**：收藏详情与搜索页展示的是同一份数据，两个出口口径
 * 必须一致（"同一份内容两个出口不一致是 bug，不是风格差异"）。
 */
function DetailActions({
  plainText,
  title,
  exportFormats,
  notify,
  feedback,
}: {
  /** 复制到剪贴板的内容 */
  plainText: string;
  /** 用作导出文件名（会被 safeFilename 清洗） */
  title: string;
  /** 额外导出项（如知识笔记的 docx / pdf） */
  exportFormats?: { format: string; label: string; icon?: string; hint?: string }[];
  notify: (kind: 'ok' | 'error', msg: string) => void;
  feedback: { kind: 'ok' | 'error'; text: string } | null;
}) {
  const s = useStrings();
  return (
    <div className="relative flex gap-2">
      <CopyButton
        text={plainText}
        label={s.common.copy}
        strings={s.common.exportActions}
        notify={notify}
      />
      <ExportMenu
        triggerLabel={s.doc.export}
        notify={notify}
        notifyStrings={s.common.exportActions}
        options={[
          { format: 'txt', label: s.doc.exportTxt, icon: '🗒️' },
          { format: 'md', label: s.doc.exportMd, icon: '📝' },
          ...(exportFormats ?? []),
        ]}
        onSelect={async (format) => {
          // docx 必须走 JSZip 单独生成，不能当纯文本写文件：
          // .docx 是 zip 包，内容写成 md 的话 Word 打不开
          if (format === 'docx') {
            await exportDocx(plainText, title, 'export');
            return;
          }
          // PDF 走 PDF 生成器（不是浏览器打印）：打印产出位图，文字不可复制。
          // 同理不能把 md 当 .pdf 存 —— 那是二进制格式，塞文本会被判损坏。
          if (format === 'pdf') {
            triggerDownload(
              new Blob([buildMarkdownPdf(plainText, title).slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
              `${safeFilename(title, 'export')}.pdf`
            );
            return;
          }
          downloadText(plainText, `${safeFilename(title, 'export')}.${format}`, mimeFor(format));
        }}
      />
      <ActionFeedbackToast feedback={feedback} />
    </div>
  );
}

/** 导出格式 → MIME。txt/md/html 都补 charset，否则 Windows 记事本打开中文乱码 */
function mimeFor(format: string): string {
  if (format === 'md') return 'text/markdown;charset=utf-8';
  if (format === 'html') return 'text/html;charset=utf-8';
  return 'text/plain;charset=utf-8';
}

export const FavoritesModule = forwardRef<FavoritesModuleRef>((_, __) => {
  const s = useStrings();
  const { favorites, removeFavorite, clearFavorites, storageWarning, dismissStorageWarning } = useFavorites();
  const [selectedItem, setSelectedItem] = useState<FavoriteItem | null>(null);
  const { feedback, notify } = useActionFeedback();

  const handleSelectItem = useCallback((item: FavoriteItem) => {
    setSelectedItem(item);
  }, []);

  const handleRemoveFavorite = useCallback((id: string) => {
    removeFavorite(id);
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  }, [removeFavorite, selectedItem]);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    setSelectedItem(null);
  }, [clearFavorites]);

  const handleBackToList = useCallback(() => {
    setSelectedItem(null);
  }, []);

  if (selectedItem) {
    const data = selectedItem.data as Record<string, unknown>;
    const back = s.favorites.backToList;

    const renderContent = () => {
      switch (selectedItem.type) {
        case 'knowledge': {
          /**
           * 判据说明（修掉一个真实边界 bug）：
           * 旧实现用 `typeof topic === 'string' && Array.isArray(concepts)` 判"新格式"，
           * 于是**有 topic 但 concepts 缺失或为空数组**的收藏会掉进旧分支，
           * 去渲染 title/definition/points 这些不存在的字段 → 详情页几乎空白。
           * 现在的判据只看"是否 GeneratedKnowledge"，缺什么字段由渲染层兜底。
           */
          if (isGeneratedKnowledge(data)) {
            const knowledge = data as unknown as GeneratedKnowledge;
            const title = selectedItem.label || (typeof data.topic === 'string' ? data.topic : '') || s.favorites.typeKnowledge;
            return (
              <div className="space-y-6">
                {/* 与搜索页共用同一实现：标题头（含概览 summary）、中断提示、思维导图、
                    公式、配图、知识脉络、试题、趣味知识全部一致。
                    以前收藏是手写的降级版 —— 公式裸露、思维导图退化成标签、概要整段丢失。
                    "返回列表"属于页面级操作，用插槽传进去，不污染共享实现。
                    复制/导出同样接在插槽旁：收藏详情此前完全取不出内容。 */}
                <KnowledgeContentView
                  data={knowledge}
                  fallbackTitle={title}
                  headerActions={<BackButton onClick={handleBackToList} label={back} />}
                />
                <div className="flex justify-end -mt-2 mb-4">
                  <DetailActions
                    title={title}
                    plainText={generateKnowledgeNote(knowledge).md}
                    notify={notify}
                    feedback={feedback}
                    exportFormats={[
                      { format: 'docx', label: s.common.exportActions.exportDocx, icon: '📄' },
                      { format: 'pdf', label: s.common.exportActions.exportPdf, icon: '📕', hint: s.common.exportActions.exportPdfHint },
                    ]}
                  />
                </div>
              </div>
            );
          }

          // 旧 KnowledgeCardData 格式（历史遗留收藏兜底）
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50">
                  <LatexText text={typeof data.title === 'string' ? data.title : s.favorites.typeKnowledge} />
                </h2>
                <BackButton onClick={handleBackToList} label={back} />
              </div>
              {typeof data.category === 'string' && (
                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                  {data.category}
                </span>
              )}
              {Array.isArray(data.tags) && (
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs rounded">
                      <LatexText text={String(tag)} />
                    </span>
                  ))}
                </div>
              )}
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <h3 className="text-lg font-semibold">{s.favorites.definition}</h3>
                <LatexText className="text-slate-600 dark:text-zinc-400 block" text={typeof data.definition === 'string' ? data.definition : ''} />
              </div>
              {Array.isArray(data.points) && (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <h3 className="text-lg font-semibold">{s.favorites.keyPoints}</h3>
                  <ul className="space-y-2">
                    {data.points.map((point, index) => (
                      <li key={index} className="text-slate-600 dark:text-zinc-400"><LatexText text={String(point)} /></li>
                    ))}
                  </ul>
                </div>
              )}
              {typeof data.example === 'string' && (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <h3 className="text-lg font-semibold">{s.favorites.examples}</h3>
                  <LatexText className="text-slate-600 dark:text-zinc-400 block" text={data.example} />
                </div>
              )}
              {typeof data.formula === 'string' && (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <h3 className="text-lg font-semibold">{s.favorites.formula}</h3>
                  <LatexText className="text-slate-600 dark:text-zinc-400 block" text={data.formula} />
                </div>
              )}
              {(() => {
                const explanation = data.explanation as Record<string, string> | null;
                if (!explanation) return null;
                return (
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <h3 className="text-lg font-semibold">{s.favorites.detailedExplanation}</h3>
                    <div className="space-y-4">
                      {typeof explanation.basic === 'string' && (
                        <div>
                          <h4 className="font-semibold text-teal-600 dark:text-teal-400">{s.favorites.basicExplanation}</h4>
                          <LatexText className="text-slate-600 dark:text-zinc-400 block" text={explanation.basic} />
                        </div>
                      )}
                      {typeof explanation.advanced === 'string' && (
                        <div>
                          <h4 className="font-semibold text-purple-600 dark:text-purple-400">{s.favorites.advancedExplanation}</h4>
                          <LatexText className="text-slate-600 dark:text-zinc-400 block" text={explanation.advanced} />
                        </div>
                      )}
                      {typeof explanation.difference === 'string' && (
                        <div>
                          <h4 className="font-semibold text-amber-600 dark:text-amber-400">{s.favorites.differences}</h4>
                          <LatexText className="text-slate-600 dark:text-zinc-400 block" text={explanation.difference} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        }

        case 'dictionary':
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-50">
                    <LatexText text={typeof data.word === 'string' ? data.word : s.favorites.defaultWord} />
                  </h2>
                  <p className="text-slate-500 dark:text-zinc-400">{typeof data.phonetic === 'string' ? data.phonetic : ''}</p>
                </div>
                <BackButton onClick={handleBackToList} label={back} />
              </div>
              {typeof data.register === 'string' && (
                <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-full">
                  {data.register}
                </span>
              )}
              {Array.isArray(data.definitions) && (
                <div className="space-y-4">
                  {data.definitions.map((def, index) => {
                    const defObj = def as Record<string, unknown>;
                    return (
                      <div key={index} className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-medium rounded">
                            {typeof defObj.pos === 'string' ? defObj.pos : (typeof defObj.partOfSpeech === 'string' ? defObj.partOfSpeech : '')}
                          </span>
                        </div>
                        <LatexText className="text-slate-700 dark:text-zinc-300 block" text={typeof defObj.meaning === 'string' ? defObj.meaning : ''} />
                        {!!defObj.example && typeof defObj.example === 'object' && !Array.isArray(defObj.example) && (
                          <div className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
                            <span className="italic">「{typeof (defObj.example as Record<string, string>).en === 'string' ? (defObj.example as Record<string, string>).en : ''}」</span>
                            <span className="ml-2">→</span>
                            <span className="ml-2 italic">「{typeof (defObj.example as Record<string, string>).zh === 'string' ? (defObj.example as Record<string, string>).zh : ''}」</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {Array.isArray(data.collocations) && data.collocations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-2">{s.favorites.commonCollocations}</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.collocations.map((col, index) => (
                      <span key={index} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm rounded-lg">
                        <LatexText text={String(col)} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(data.synonyms) && data.synonyms.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-2">{s.favorites.synonyms}</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.synonyms.map((syn, index) => (
                      <span key={index} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm rounded-lg">
                        <LatexText text={String(syn)} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {typeof data.etymology === 'string' && (
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-2">{s.favorites.etymology}</h3>
                  <LatexText className="text-sm text-slate-600 dark:text-zinc-400 block" text={data.etymology} />
                </div>
              )}
              {/* 序列化走 serializeWordResult：与查词页的复制/导出同一份内容 */}
              <div className="flex justify-end">
                <DetailActions
                  title={String(data.word ?? s.favorites.defaultWord)}
                  plainText={serializeWordResult(data as unknown as WordResultType)}
                  notify={notify}
                  feedback={feedback}
                />
              </div>
            </div>
          );

        case 'translation':
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50">{s.favorites.translationResult}</h2>
                  <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                    {typeof data.style === 'string' ? (data.style === 'academic' ? s.favorites.styleAcademic : data.style === 'business' ? s.favorites.styleBusiness : s.favorites.styleDaily) : ''}
                  </span>
                </div>
                <BackButton onClick={handleBackToList} label={back} />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">{s.favorites.original}</p>
                  <LatexText className="text-lg text-slate-800 dark:text-zinc-50 block" text={typeof data.original === 'string' ? data.original : ''} />
                </div>
                <div className="p-6 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
                  <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-2">{s.favorites.translated}</p>
                  <LatexText className="text-lg text-slate-800 dark:text-zinc-50 block" text={typeof data.translation === 'string' ? data.translation : ''} />
                </div>
              </div>
              {Array.isArray(data.keywords) && data.keywords.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-2">{s.favorites.keywords}</h3>
                  <TermList items={data.keywords as (string | { term: string; definition?: string })[]} />
                </div>
              )}
              {Array.isArray(data.relatedTerms) && data.relatedTerms.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-2">{s.favorites.relatedTerms}</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.relatedTerms.map((term, index) => (
                      <span key={index} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm rounded-lg">
                        <LatexText text={String(term)} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(data.grammarNotes) && data.grammarNotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-3">{s.favorites.grammarNote}</h3>
                  <div className="space-y-2">
                    {data.grammarNotes.map((note, index) => (
                      <div key={index} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                        <span className="text-amber-500 text-sm font-medium mt-0.5 shrink-0">{index + 1}.</span>
                        <LatexText className="text-sm text-slate-700 dark:text-zinc-300" text={String(note)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 与查句页共用 serializeSentenceResult：两个出口内容一致 */}
              <div className="flex justify-end">
                <DetailActions
                  title={String(data.original ?? s.favorites.typeTranslation).slice(0, 30)}
                  plainText={serializeSentenceResult(data as unknown as SentenceResultType, false)}
                  notify={notify}
                  feedback={feedback}
                />
              </div>
            </div>
          );

        case 'document':
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50">
                  <LatexText text={typeof data.title === 'string' ? data.title : s.favorites.typeDocument} />
                </h2>
                <BackButton onClick={handleBackToList} label={back} />
              </div>
              {typeof data.category === 'string' && (
                <span className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-full">
                  {data.category}
                </span>
              )}
              <div className="prose prose-slate dark:prose-invert max-w-none">
                {/* 以前这里用 whitespace-pre-wrap 直接输出原文：Markdown 标记（# / ** / 表格）
                    和公式源码全部裸露。改用与文档模块同一个 Markdown+公式渲染器。 */}
                <MarkdownContent content={typeof data.content === 'string' ? data.content : ''} />
              </div>
              {/* 中断提示衔接在正文最后（与文档模块同一口径） */}
              <GenerationNotice data={data as GenerationNoticeData} />
              <div className="flex justify-end">
                <DetailActions
                  title={String(data.title ?? s.favorites.typeDocument)}
                  plainText={serializeDocumentResult({ title: String(data.title ?? ''), content: String(data.content ?? '') })}
                  notify={notify}
                  feedback={feedback}
                  exportFormats={[
                    { format: 'docx', label: s.common.exportActions.exportDocx, icon: '📄' },
                  ]}
                />
              </div>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 p-8">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full mb-4">
          <svg className="w-8 h-8 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-50 mb-2">{s.favorites.pageTitle}</h1>
        <p className="text-slate-500 dark:text-zinc-400">{s.favorites.pageSubtitle}</p>
        <p className="text-sm text-slate-400 dark:text-zinc-500 mt-2">{fmt(s.favorites.count, { n: favorites.length })}</p>
      </div>

      {/* 存储降级提示：写不进 localStorage 时旧实现只打 console，用户会看到
          "界面显示已收藏、刷新后消失"。这里必须把原因摆到台面上。 */}
      {storageWarning && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
            storageWarning === 'failed'
              ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200'
              : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
          }`}
        >
          <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
          <p className="text-sm leading-relaxed flex-1">
            {storageWarning === 'failed' ? s.favorites.storageFailed : s.favorites.storageSlimmed}
          </p>
          <button
            onClick={dismissStorageWarning}
            className="text-xs opacity-70 hover:opacity-100 shrink-0"
            title={s.common.close}
          >
            {s.common.close}
          </button>
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 p-12 flex flex-col items-center justify-center">
          <svg className="w-16 h-16 text-slate-300 dark:text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-slate-500 dark:text-zinc-400 font-medium">{s.favorites.emptyTitle}</p>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-1">{s.favorites.emptyHint}</p>
        </div>
      ) : (
        <FavoriteContent
          favorites={favorites}
          onRemove={handleRemoveFavorite}
          onClear={handleClearFavorites}
          onSelectItem={handleSelectItem}
        />
      )}
    </div>
  );
});

FavoritesModule.displayName = 'FavoritesModule';
