import { useState, useCallback } from 'react';
import type { RecipeJSON } from '../../../types/recipe';
import UnifiedTimeline from '../UnifiedTimeline';
import SceneCards from '../SceneCards';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  thumbnails: Record<string, string>;
}

export default function TabTimeline({ data, seekTo, thumbnails }: Props) {
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const [highlightRange, setHighlightRange] = useState<[number, number] | null>(null);

  const scenes = data.visual?.scenes || [];

  /** 타임라인 구간 클릭 → 해당 씬 카드로 스크롤 */
  const handleTimelineSceneClick = useCallback(
    (sceneId: number) => {
      setActiveSceneId(sceneId);
    },
    [],
  );

  /** 씬 카드 시간 클릭 → 타임라인 하이라이트 */
  const handleSceneTimeClick = useCallback(
    (start: number, end: number) => {
      setHighlightRange([start, end]);
      seekTo(start);
      // 해당 씬 찾아서 active
      const scene = scenes.find(
        (s) => s.time_range[0] <= start && s.time_range[1] >= end,
      );
      if (scene) setActiveSceneId(scene.scene_id);
    },
    [scenes, seekTo],
  );

  return (
    <div className="space-y-3">
      <UnifiedTimeline
        data={data}
        seekTo={seekTo}
        thumbnails={thumbnails}
        highlightRange={highlightRange}
        onSceneClick={handleTimelineSceneClick}
      />
      <SceneCards
        data={data}
        seekTo={seekTo}
        thumbnails={thumbnails}
        activeSceneId={activeSceneId}
        onSceneTimeClick={handleSceneTimeClick}
      />
    </div>
  );
}
