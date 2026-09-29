import { useState } from 'react';
import { WordResult as WordResultType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tag } from '../../components/ui/Tag';
import { ImageFigure } from '../../components/ui/ImageFigure';
import { useFavorites } from '../../hooks/useFavorites';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useStrings } from '../../hooks/useStrings';
import { useWanxImage } from '../../hooks/useWanxImage';

interface WordResultProps {
  result: WordResultType;
  /** 点击关键词（短语/多词查询时 AI 给出的最多 10 个词）再次查词 */
  onLookup?: (term: string) => void;
}

/**
 * 词条配图：优先 AI 给的可靠直链；拿不到时用通义万相按 imageQuery 兜底生图。
 * 生图是可选能力，未配置 wanx 时不发请求。
 */
function WordImage({ result }: { result: WordResultType }) {
  const s = useStrings();
  const caption = `${result.word} ${s.translate.wordFigure}`;
  // 只有既没直链、又给了 imageQuery 时才走生图兜底
  const needGenerate = !result.image && !!result.imageQuery?.trim();
  const generated = useWanxImage(needGenerate ? result.imageQuery : undefined, needGenerate);

  if (result.image) {
    return <ImageFigure image={result.image} caption={caption} maxHeight={200} />;
  }
  if (generated?.ok) {
    return <ImageFigure image={generated.url} caption={caption} maxHeight={200} />;
  }
  // 既没直链、也没能生图 → 不显示（不渲染占位，避免干扰纯文字词条）
  return null;
}

export function WordResult({ result, onLookup }: WordResultProps) {
  const s = useStrings();
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const fav = isFavorite(result, 'dictionary');
  const [audioPlayed, setAudioPlayed] = useState(false);
  const { speak, isSpeaking } = useSpeechSynthesis();

  const handlePlayAudio = () => {
    setAudioPlayed(true);
    speak(result.word, { lang: 'en-US', rate: 0.8 });
    setTimeout(() => setAudioPlayed(false), 3000);
  };

  const handleToggleFavorite = () => {
    if (fav) {
      const item = favorites.find(
        (f) => f.type === 'dictionary' && JSON.stringify(f.data) === JSON.stringify(result)
      );
      if (item) removeFavorite(item.id);
    } else {
      addFavorite(result, 'dictionary');
    }
  };

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded">
            {s.translate.dictModeBadge}
          </span>
          {result.isPhrase && (
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
              {s.translate.phraseBadge}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handlePlayAudio} disabled={isSpeaking}>
            <svg className={`w-4 h-4 ${audioPlayed || isSpeaking ? 'animate-pulse text-teal-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            {audioPlayed || isSpeaking ? s.translate.reading : s.translate.pronunciation}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleToggleFavorite}>
            {fav ? `❤️ ${s.common.favorited}` : `⭐ ${s.common.favorite}`}
          </Button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-800">{result.word}</h2>
          <p className="text-slate-500 mt-1">{result.phonetic}</p>
          <WordImage result={result} />
        </div>
        <div className="space-y-3">
          {result.definitions.map((def, index) => (
            <div key={index}>
              <span className="text-teal-600 font-medium">{def.pos} {def.meaning}</span>
              {def.example && (
                <div className="bg-slate-50 rounded-xl p-3 mt-2">
                  <p className="text-slate-800">{def.example.en}</p>
                  <p className="text-slate-600 text-sm mt-1">{def.example.zh}</p>
                </div>
              )}
            </div>
          ))}
          {result.keywords && result.keywords.length > 0 && (
            <div className="pt-1">
              <h4 className="text-sm font-medium text-slate-500 mb-2">
                {s.translate.keywordHint}
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.keywords.slice(0, 10).map((kw, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onLookup?.(kw)}
                    className="px-2.5 py-1 text-sm rounded-lg bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 transition-colors"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
          {result.synonyms && (
            <div>
              <span className="text-sm font-medium text-slate-600">{s.translate.synonyms}</span>
              <span className="text-sm text-teal-600 ml-2">{result.synonyms.join(', ')}</span>
            </div>
          )}
          {result.antonyms && (
            <div>
              <span className="text-sm font-medium text-slate-600">{s.translate.antonyms}</span>
              <span className="text-sm text-rose-600 ml-2">{result.antonyms.join(', ')}</span>
            </div>
          )}
          {result.relatedTerms && result.relatedTerms.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.relatedTerms}</h4>
              <div className="flex flex-wrap gap-2">
                {result.relatedTerms.map((term, index) => (
                  <Tag key={index} variant="primary">{term}</Tag>
                ))}
              </div>
            </div>
          )}
          {result.collocations && result.collocations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.collocations}</h4>
              <div className="flex flex-wrap gap-2">
                {result.collocations.map((collocation, index) => (
                  <Tag key={index} variant="default">{collocation}</Tag>
                ))}
              </div>
            </div>
          )}
          {result.register && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.register}</h4>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                {result.register}
              </span>
            </div>
          )}
          {result.etymology && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-medium text-slate-500 mb-2">{s.translate.etymology}</h4>
              <p className="text-sm text-slate-600">{result.etymology}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}