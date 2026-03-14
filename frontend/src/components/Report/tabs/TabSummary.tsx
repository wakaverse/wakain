import type { RecipeJSON } from '../../../types/recipe';
import VideoSummaryCard from '../VideoSummaryCard';

interface Props {
  data: RecipeJSON;
}

export default function TabSummary({ data }: Props) {
  return (
    <div className="space-y-3">
      <VideoSummaryCard data={data} />
    </div>
  );
}
