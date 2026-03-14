import type { RecipeJSON } from '../../../types/recipe';
import UnifiedTimeline from '../UnifiedTimeline';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  thumbnails: Record<string, string>;
}

export default function TabTimeline({ data, seekTo, thumbnails }: Props) {
  return (
    <div className="space-y-3">
      <UnifiedTimeline data={data} seekTo={seekTo} thumbnails={thumbnails} />
    </div>
  );
}
