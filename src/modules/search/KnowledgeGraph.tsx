import { useState } from 'react';
import { KnowledgeGraphNode, KnowledgeType } from '../../types';
import { useStrings, fmt } from '../../hooks/useStrings';

interface KnowledgeGraphProps {
  nodes: KnowledgeGraphNode[];
  onNodeClick: (node: KnowledgeGraphNode) => void;
}

const typeColors: Record<KnowledgeType, string> = {
  concept: '#3B82F6',
  process: '#22C55E',
  formula: '#A855F7',
  timeline: '#F97316',
  compare: '#EC4899',
  hierarchy: '#06B6D4',
  theorem: '#8B5CF6',
};

const levelStyles = [
  { bgGradient: 'bg-gradient-to-r from-teal-500 to-teal-600', borderColor: '#0D9488', textColor: 'text-white' },
  { bgGradient: 'bg-white dark:bg-zinc-900 border-2', borderColor: '#3B82F6', textColor: 'text-slate-800 dark:text-zinc-50' },
  { bgGradient: 'bg-white dark:bg-zinc-900 border', borderColor: '#6366F1', textColor: 'text-slate-700 dark:text-zinc-200' },
  { bgGradient: 'bg-slate-50 dark:bg-zinc-950 border', borderColor: '#94A3B8', textColor: 'text-slate-600 dark:text-zinc-400' },
];

function TreeNode({ 
  node, 
  depth, 
  expanded, 
  onToggle, 
  onNodeClick,
  expandedNodes,
}: { 
  node: KnowledgeGraphNode; 
  depth: number; 
  expanded: boolean; 
  onToggle: (id: string) => void; 
  onNodeClick: (node: KnowledgeGraphNode) => void;
  expandedNodes: Set<string>;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const levelStyle = levelStyles[Math.min(depth, levelStyles.length - 1)];
  const color = typeColors[node.type];
  const s = useStrings();

  return (
    <div className="relative">
      <div
        onClick={() => hasChildren ? onToggle(node.id) : onNodeClick(node)}
        className={`flex items-center gap-3 py-3 px-4 rounded-xl cursor-pointer transition-all duration-200 ${levelStyle.bgGradient} border ${depth > 0 ? '' : 'shadow-md'} ${
          depth > 0 ? `hover:shadow-sm` : ''
        }`}
        style={{ 
          borderColor: depth > 0 ? color : 'transparent',
          marginLeft: `${depth * 16}px`,
        }}
      >
        {hasChildren && (
          <svg
            className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${depth === 0 ? 'text-teal-200' : 'text-slate-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5l7 7-7 7"
              className={expanded ? 'rotate-90' : ''}
            />
          </svg>
        )}
        {!hasChildren && (
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        
        <div 
          className={`w-1 h-6 rounded-full flex-shrink-0 ${depth === 0 ? 'bg-teal-300' : ''}`}
          style={{ backgroundColor: depth > 0 ? `${color}40` : undefined }}
        />
        
        <span 
          className={`font-medium flex-1 ${levelStyle.textColor}`}
          style={{ fontSize: depth === 0 ? '16px' : depth === 1 ? '14px' : '13px' }}
        >
          {node.title}
        </span>

        {hasChildren && node.children && (
          <span className={`text-xs flex-shrink-0 ${depth === 0 ? 'text-teal-200' : 'text-slate-400 dark:text-zinc-500'}`}>
            {fmt(s.search.graph.childCount, { n: node.children.length })}
          </span>
        )}

        {depth === 0 && (
          <span className="px-2 py-1 bg-white/20 rounded-lg text-xs text-teal-100">
            {s.search.graph.directory}
          </span>
        )}
      </div>

      {hasChildren && expanded && node.children && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expandedNodes.has(child.id)}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
              expandedNodes={expandedNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgeGraph({ nodes, onNodeClick }: KnowledgeGraphProps) {
  const s = useStrings();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    nodes.length > 0 ? new Set(nodes.map(n => n.id)) : new Set()
  );

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const rootNode = nodes[0];

  if (!rootNode) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 p-8 flex items-center justify-center">
        <p className="text-slate-500 dark:text-zinc-400">{s.search.graph.noData}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{rootNode.title} - {s.search.graph.directory}</h3>
          <p className="text-teal-100 text-sm">{s.search.graph.expandHint}</p>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          <TreeNode
            node={rootNode}
            depth={0}
            expanded={expandedNodes.has(rootNode.id)}
            onToggle={toggleNode}
            onNodeClick={onNodeClick}
            expandedNodes={expandedNodes}
          />
        </div>
      </div>

      <div className="mt-4 px-6 pb-4 border-t border-slate-100 dark:border-zinc-800">
        <div className="flex flex-wrap gap-4 text-sm">
          {Object.entries(typeColors).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1.5">
              <span 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: color }}
              />
              <span className="text-slate-500 dark:text-zinc-400">
                {type === 'concept' ? s.search.graph.nodeConcept :
                 type === 'process' ? s.search.graph.nodeProcess :
                 type === 'formula' ? s.search.graph.nodeFormula :
                 type === 'timeline' ? s.search.graph.nodeTimeline :
                 type === 'compare' ? s.search.graph.nodeCompare : s.search.graph.nodeHierarchy}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
