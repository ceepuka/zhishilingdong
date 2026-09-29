import { CompareCardData } from '../../types';
import { Card } from '../ui/Card';

export function CompareCard({ data }: { data: CompareCardData }) {
  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-medium rounded">
          对比关系
        </span>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50">{data.title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-950">
              {data.columns.map((col, index) => (
                <th
                  key={index}
                  className={`px-4 py-2 text-left font-medium text-slate-600 dark:text-zinc-300 ${
                    index === 0 ? 'rounded-tl-lg' : ''
                  } ${index === data.columns.length - 1 ? 'rounded-tr-lg' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50 dark:bg-zinc-950'}>
                {data.columns.map((col, colIndex) => (
                  <td key={colIndex} className="px-4 py-3 text-slate-700 dark:text-zinc-200">
                    {item[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
