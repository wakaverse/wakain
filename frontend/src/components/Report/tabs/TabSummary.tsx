import type { RecipeJSON } from '../../../types/recipe';
import VideoSummaryCard from '../VideoSummaryCard';

interface Props {
  data: RecipeJSON;
  onTabChange?: (tab: string) => void;
}

export default function TabSummary({ data, onTabChange }: Props) {
  return (
    <div className="space-y-3">
      <VideoSummaryCard data={data} onTabChange={onTabChange} />
    </div>
  );
}
