import { useState, useEffect, useRef } from 'react';
import { DocResult as DocResultType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { exportDocument } from '../../utils/export';
import { useFavorites } from '../../hooks/useFavorites';
import { useStrings } from '../../hooks/useStrings';
import { GenerationNotice } from '../../components/ui/GenerationNotice';
import { MarkdownContent } from '../../components/ui/MarkdownContent';

interface DocResultProps {
  result: DocResultType;
  onRegenerate?: () => void;
}

type ExportFormat = 'txt' | 'md' | 'html' | 'pdf';

export function DocResult({ result, onRegenerate }: DocResultProps) {
  const s = useStrings();
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const fav = isFavorite(result, 'document');
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.content);
  };

  const handleExport = (format: ExportFormat) => {
    setExporting(true);
    setTimeout(() => {
      exportDocument(result.content, result.title, format);
      setExporting(false);
      setShowExportMenu(false);
    }, 100);
  };

  const handleToggleFavorite = () => {
    if (fav) {
      const item = favorites.find(
        (f) => f.type === 'document' && JSON.stringify(f.data) === JSON.stringify(result)
      );
      if (item) removeFavorite(item.id);
    } else {
      addFavorite(result, 'document');
    }
  };

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded">
            {result.title}
          </span>
          {result.tone && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
              {result.tone === 'formal' ? s.doc.toneFormal : result.tone === 'friendly' ? s.doc.toneFriendly : s.doc.toneConcise}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            📋 {s.common.copy}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleToggleFavorite}>
            {fav ? `❤️ ${s.common.favorited}` : `⭐ ${s.common.favorite}`}
          </Button>
          <div className="relative" ref={exportMenuRef}>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                setShowExportMenu(!showExportMenu);
              }}
              disabled={exporting}
            >
              {exporting ? s.doc.exporting : `📥 ${s.doc.export}`}
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-slate-200 dark:border-zinc-800 z-10">
                <button
                  onClick={() => handleExport('txt')}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  📄 {s.doc.exportTxt}
                </button>
                <button
                  onClick={() => handleExport('md')}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  📝 {s.doc.exportMd}
                </button>
                <button
                  onClick={() => handleExport('html')}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  🌐 {s.doc.exportHtml}
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  📕 {s.doc.exportPdf}
                </button>
              </div>
            )}
          </div>
          {onRegenerate && (
            <Button variant="secondary" size="sm" onClick={onRegenerate}>
              🔄 {s.doc.regenerate}
            </Button>
          )}
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-zinc-900 rounded-xl p-6">
        {/* 文档正文是 Markdown，可能夹着 AI 写的 $...$ 公式 —— 统一走支持公式的渲染器，
            否则公式会原样露出 LaTeX 源码 */}
        <MarkdownContent content={result.content} className="prose prose-sm dark:prose-invert max-w-none" />
      </div>
      {/* 生成中断提示：文档正文同样可能被中断（网络/超时/输出上限）。
          **衔接在正文最后** —— 它说的是"末尾没写完"，位置就该在正文尾部；
          放在正文上方会变成"先报错再看内容"，流式过程中还会不断把正文往下挤。 */}
      <div className="mt-4">
        <GenerationNotice data={result} />
      </div>
    </Card>
  );
}