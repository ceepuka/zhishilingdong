import { useState } from 'react';
import { DocResult as DocResultType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { exportDocument, type DocumentExportFormat } from '../../utils/export';
import { CopyButton, ActionFeedbackToast, useActionFeedback } from '../../components/ui/ActionBar';
import { ExportMenu } from '../../components/ui/ExportMenu';
import { useFavorites } from '../../hooks/useFavorites';
import { useStrings } from '../../hooks/useStrings';
import { GenerationNotice } from '../../components/ui/GenerationNotice';
import { MarkdownContent } from '../../components/ui/MarkdownContent';

interface DocResultProps {
  result: DocResultType;
  onRegenerate?: () => void;
}

export function DocResult({ result, onRegenerate }: DocResultProps) {
  const s = useStrings();
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const fav = isFavorite(result, 'document');
  const { feedback, notify } = useActionFeedback();
  // docx 走 JSZip 是异步的（生成 zip 里有 await），导出期间必须占住按钮，
  // 否则用户连点两次会拿到两个并发 zip 生成
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: DocumentExportFormat) => {
    setExporting(true);
    try {
      await exportDocument(result.content, result.title, format);
    } finally {
      setExporting(false);
    }
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
          <div className="relative">
            {/* 之前是裸调 navigator.clipboard.writeText：本项目发布形态是本地
                单文件 HTML（file://，非安全上下文），那里 clipboard 是 undefined，
                点击直接抛 TypeError 且无任何提示 */}
            <CopyButton
              text={result.content}
              label={s.common.copy}
              strings={s.common.exportActions}
              notify={notify}
            />
            <ActionFeedbackToast feedback={feedback} />
          </div>
          <Button variant="secondary" size="sm" onClick={handleToggleFavorite}>
            {fav ? `❤️ ${s.common.favorited}` : `⭐ ${s.common.favorite}`}
          </Button>
          <ExportMenu
            triggerLabel={s.doc.export}
            exporting={exporting}
            exportingLabel={s.doc.exporting}
            notify={notify}
            notifyStrings={s.common.exportActions}
            options={[
              { format: 'docx', label: s.common.exportActions.exportDocx, icon: '📄' },
              { format: 'pdf', label: s.common.exportActions.exportPdf, icon: '📕', hint: s.common.exportActions.exportPdfHint },
              { format: 'md', label: s.doc.exportMd, icon: '📝' },
              { format: 'html', label: s.doc.exportHtml, icon: '🌐' },
              { format: 'txt', label: s.doc.exportTxt, icon: '🗒️' },
            ]}
            onSelect={(format) => handleExport(format as DocumentExportFormat)}
          />
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