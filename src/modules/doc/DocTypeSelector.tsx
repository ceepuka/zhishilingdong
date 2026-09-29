import { useState } from 'react';
import { DocType } from '../../types';
import { DOC_TYPE_META } from './templates';
import { useStrings } from '../../hooks/useStrings';

interface DocTypeSelectorProps {
  selectedType: DocType;
  onSelect: (type: DocType) => void;
}

export function DocTypeSelector({ selectedType, onSelect }: DocTypeSelectorProps) {
  const s = useStrings();
  const [isExpanded, setIsExpanded] = useState(false);
  const typeLabel = (id: DocType) => s.doc.types[id];
  const selectedLabel = DOC_TYPE_META.find((t) => t.id === selectedType);

  const handleTypeSelect = (type: DocType) => {
    onSelect(type);
    setIsExpanded(false);
  };

  return (
    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
      <span className="block px-4 py-2 text-sm font-medium text-slate-500 dark:text-zinc-500">{s.doc.docType}</span>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{selectedLabel?.icon}</span>
          <span className={`text-sm font-medium ${
            selectedType === selectedLabel?.id
              ? 'text-teal-700 dark:text-teal-400'
              : 'text-slate-700 dark:text-zinc-200'
          }`}>
            {selectedLabel ? typeLabel(selectedLabel.id) : ''}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 dark:text-zinc-400 transition-transform duration-300 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'opacity-100 max-h-80' : 'opacity-0 max-h-0'
        }`}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 border-t border-slate-100 dark:border-zinc-800">
          {DOC_TYPE_META.map((type) => (
            <button
              key={type.id}
              onClick={() => handleTypeSelect(type.id)}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                selectedType === type.id
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-slate-100 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:border-teal-300'
              }`}
            >
              <div className="text-xl mb-1">{type.icon}</div>
              <div
                className={`text-xs font-medium ${
                  selectedType === type.id
                    ? 'text-teal-700 dark:text-teal-400'
                    : 'text-slate-600 dark:text-zinc-300'
                }`}
              >
                {typeLabel(type.id)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
