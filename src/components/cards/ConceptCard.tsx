import { ConceptCardData } from '../../types';
import { Card } from '../ui/Card';

export function ConceptCard({ data }: { data: ConceptCardData }) {
  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded">
          概念定义
        </span>
        <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
      </div>
      <p className="text-slate-600 mb-4">{data.definition}</p>
      <div className="mb-4">
        <h4 className="text-sm font-medium text-slate-700 mb-2">要点</h4>
        <ul className="list-disc list-inside text-slate-600 space-y-1">
          {data.points.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </div>
      <div className="bg-slate-50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-slate-700 mb-1">示例</h4>
        <p className="text-slate-600">{data.example}</p>
      </div>
    </Card>
  );
}
