import { useEffect, useRef } from 'react';
import katex from 'katex';
import { FormulaCardData } from '../../types';
import { Card } from '../ui/Card';

export function FormulaCard({ data }: { data: FormulaCardData }) {
  const formulaRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (formulaRef.current) {
      katex.render(data.formula, formulaRef.current, {
        throwOnError: false,
      });
    }
  }, [data.formula]);

  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
          数学公式
        </span>
        <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
      </div>
      <div className="flex justify-center py-8 text-2xl">
        <span ref={formulaRef} />
      </div>
      <p className="text-slate-600 text-center">{data.description}</p>
    </Card>
  );
}
