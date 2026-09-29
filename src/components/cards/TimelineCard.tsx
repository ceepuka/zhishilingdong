import { TimelineCardData } from '../../types';
import { Card } from '../ui/Card';

export function TimelineCard({ data }: { data: TimelineCardData }) {
  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-6">
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
          时间序列
        </span>
        <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
      </div>
      <div className="relative pl-6 border-l-2 border-teal-200">
        {data.events.map((event, index) => (
          <div
            key={index}
            className={`relative ${index === data.events.length - 1 ? '' : 'mb-4'}`}
          >
            <div className="absolute -left-[27px] w-3 h-3 bg-teal-500 rounded-full" />
            <span className="font-medium text-teal-600">{event.time}</span>
            <p className="text-slate-600 mt-1">{event.event}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
