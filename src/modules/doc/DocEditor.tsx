import { useState } from 'react';
import { DocType, EmailTone } from '../../types';
import { TextArea, Input } from '../../components/ui/Input';
import { EMAIL_TONE_IDS } from './templates';
import { useStrings } from '../../hooks/useStrings';
import { DocTypeSelector } from './DocTypeSelector';

interface DocEditorProps {
  docType: DocType;
  onDocTypeChange: (type: DocType) => void;
  onGenerate: (options: { topic: string; tone?: EmailTone; from?: string; to?: string }) => void;
}

export function DocEditor({ docType, onDocTypeChange, onGenerate }: DocEditorProps) {
  const s = useStrings();
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<EmailTone>('formal');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleGenerate = () => {
    if (topic.trim()) {
      onGenerate({ topic: topic.trim(), tone, from, to });
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl card-shadow p-6 mb-6">
      {docType === 'email' && (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Input
            label={s.doc.sender}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder={s.doc.senderPlaceholder}
          />
          <Input
            label={s.doc.receiver}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={s.doc.receiverPlaceholder}
          />
        </div>
      )}

      {docType === 'email' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-200 mb-2">{s.doc.tone}</label>
          <div className="flex gap-2">
            {EMAIL_TONE_IDS.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  tone === t
                    ? 'bg-teal-100 text-teal-700 dark:text-teal-400 font-medium'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                {t === 'formal' ? s.doc.toneFormal : t === 'friendly' ? s.doc.toneFriendly : s.doc.toneConcise}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <TextArea
          label={s.doc.topic}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={s.doc.topicPlaceholder}
          rows={4}
          className="pr-28"
        />
        <button
          onClick={handleGenerate}
          disabled={!topic.trim()}
          className="absolute right-2 bottom-2 px-4 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {s.doc.generate}
        </button>
      </div>

      <div className="mt-4">
        <DocTypeSelector selectedType={docType} onSelect={onDocTypeChange} />
      </div>
    </div>
  );
}
