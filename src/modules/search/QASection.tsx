import { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LatexText } from '../../components/ui/LatexText';
import { CopyButton, ActionFeedbackToast, useActionFeedback } from '../../components/ui/ActionBar';
import { ExportMenu } from '../../components/ui/ExportMenu';
import { downloadFile } from '../../utils/export';
import { safeFilename } from '../../utils/clipboard';
import { serializeQA } from '../../utils/serialize';
import { getCurrentStrings } from '../../i18n/strings';
import { useStrings } from '../../hooks/useStrings';

interface QASectionProps {
  messages: ChatMessage[];
  onSend: (question: string) => void;
  hasContext: boolean;
  hideInput?: boolean;
  isLoading?: boolean;
}

export function QASection({ messages, onSend, hasContext, hideInput, isLoading }: QASectionProps) {
  const s = useStrings();
  const quickQuestions = s.search.followUpExamples;
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { feedback, notify } = useActionFeedback();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const question = input.trim();
    if (question) {
      onSend(question);
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const title = hasContext ? s.search.qa.followUpTitle : s.search.qa.title;
  const placeholder = hasContext ? s.search.qa.followUpPlaceholder : s.search.qa.defaultPlaceholder;

  /** 复制内容：纯文本 Q/A 串（`serializeQA` 与导出口径共用一份） */
  const copyTextValue = useMemo(() => serializeQA(messages), [messages]);

  const handleExport = (format: 'txt' | 'md') => {
    // 走 downloadFile 而不是自己拼 Blob + <a>：文件名清洗、charset、revoke
    // 延迟全在那一层。这里原来手写了一份，与 utils/export.ts 的实现重复。
    const s = getCurrentStrings();
    const filename = `${safeFilename(s.search.qa.title, 'qa-dialog')}.${format}`;
    const content = format === 'md' ? serializeQA(messages, true) : copyTextValue;
    downloadFile(content, filename, format === 'md' ? 'text/markdown' : 'text/plain');
  };

  return (
    <div className="mt-12">
      <Card>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>

        {messages.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <CopyButton
                text={copyTextValue}
                label={s.common.copy}
                strings={s.common.exportActions}
                notify={notify}
              />
              <ActionFeedbackToast feedback={feedback} />
            </div>
            <ExportMenu
              triggerLabel={s.doc.export}
              notify={notify}
              notifyStrings={s.common.exportActions}
              options={[
                { format: 'md', label: s.doc.exportMd, icon: '📝' },
                { format: 'txt', label: s.doc.exportTxt, icon: '🗒️' },
              ]}
              onSelect={(format) => handleExport(format as 'txt' | 'md')}
            />
          </div>
        )}

        {messages.length === 0 && !hasContext && (
          <div className="mb-4">
            <p className="text-sm text-slate-500 mb-4">{s.search.directAskHint}</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  className="px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-sm text-teal-600 hover:bg-teal-100 hover:border-teal-300 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? '' : 'justify-end'}`}
              >
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-2.5 max-w-[80%] leading-relaxed break-words whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-slate-100 text-slate-700 rounded-tl-none'
                      : 'bg-teal-500 text-white rounded-tr-none'
                  }`}
                >
                  <LatexText text={msg.content} />
                </div>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 00-14 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-end">
                <div className="rounded-xl px-4 py-2 max-w-[80%] bg-teal-500 text-white rounded-tr-none">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
                <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 00-14 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {!hideInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <Button onClick={handleSend}>{s.search.send}</Button>
        </div>
        )}
      </Card>
    </div>
  );
}