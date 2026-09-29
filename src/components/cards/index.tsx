import { KnowledgeCardData } from '../../types';
import { ConceptCard } from './ConceptCard';
import { ProcessCard } from './ProcessCard';
import { FormulaCard } from './FormulaCard';
import { TimelineCard } from './TimelineCard';
import { CompareCard } from './CompareCard';
import { HierarchyCard } from './HierarchyCard';

export function KnowledgeCard({ data }: { data: KnowledgeCardData }) {
  switch (data.type) {
    case 'concept':
      return <ConceptCard data={data} />;
    case 'process':
      return <ProcessCard data={data} />;
    case 'formula':
      return <FormulaCard data={data} />;
    case 'timeline':
      return <TimelineCard data={data} />;
    case 'compare':
      return <CompareCard data={data} />;
    case 'hierarchy':
      return <HierarchyCard data={data} />;
    default:
      return null;
  }
}
