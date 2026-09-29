import { HierarchyCardData, TreeNode } from '../../types';
import { Card } from '../ui/Card';

function TreeNodeComponent({ node, level = 0 }: { node: TreeNode; level?: number }) {
  return (
    <li className="mt-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-teal-100 rounded flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <span className="text-slate-700">{node.name}</span>
      </div>
      {node.children.length > 0 && (
        <ul className="ml-6">
          {node.children.map((child, index) => (
            <TreeNodeComponent key={index} node={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function HierarchyCard({ data }: { data: HierarchyCardData }) {
  return (
    <Card className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
          层级结构
        </span>
        <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
      </div>
      <div className="py-4">
        <ul>
          {data.tree.map((node, index) => (
            <TreeNodeComponent key={index} node={node} />
          ))}
        </ul>
      </div>
    </Card>
  );
}
