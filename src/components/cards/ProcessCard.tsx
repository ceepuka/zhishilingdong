import { ProcessCardData } from '../../types';
import { Card } from '../ui/Card';

export function ProcessCard({ data }: { data: ProcessCardData }) {
  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-6">
        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
          流程过程
        </span>
        <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
      </div>
      <div className="relative">
        {data.steps.map((step, index) => (
          <div
            key={index}
            className={`flex gap-4 ${index < data.steps.length - 1 ? 'mb-6' : ''}`}
          >
            <div className="relative">
              <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold">
                {index + 1}
              </div>
              {index < data.steps.length - 1 && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-teal-300" />
              )}
            </div>
            <div className="flex-1 pt-1">
              <h4 className="font-medium text-slate-800">{step.name}</h4>
              <p className="text-slate-600">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
