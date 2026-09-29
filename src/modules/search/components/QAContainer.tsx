import { useState, KeyboardEvent } from 'react';
import { QASection } from '../QASection';
import { ChatMessage } from '../../../types';
import { useStrings } from '../../../hooks/useStrings';

interface QAContainerProps {
  onSendMessage: (question: string) => void;
  onNewConversation: () => void;
  messages: ChatMessage[];
  isLoading?: boolean;
}

export const QAContainer = ({ onSendMessage, onNewConversation, messages, isLoading }: QAContainerProps) => {
  const s = useStrings();
  const exampleQuestions = s.search.qaExamples;
  const [value, setValue] = useState('');

  const handleSend = () => {
    if (value.trim()) {
      onSendMessage(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleExampleClick = (question: string) => {
    onSendMessage(question);
  };

  return (
    <>
      {messages.length === 0 && (
        <div className="mb-6">
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-3">{s.search.tryThese}</p>
          <div className="flex flex-wrap gap-2">
            {exampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(question)}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md text-sm text-slate-600 dark:text-zinc-300 hover:border-teal-400 hover:text-teal-600"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-end mb-3">
            <button
              onClick={onNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-teal-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {s.search.newConversation}
            </button>
          </div>
          <QASection
            messages={messages}
            onSend={onSendMessage}
            hasContext={false}
            hideInput={true}
            isLoading={isLoading}
          />
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl card-shadow p-6">
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={s.search.qa.defaultPlaceholder}
            className="w-full pl-4 pr-24 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-700 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all text-lg"
          />
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {s.search.send}
          </button>
          {value && (
            <button
              onClick={() => setValue('')}
              className="absolute right-24 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 flex items-center justify-center"
            >
              <svg className="w-3 h-3 text-slate-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
};