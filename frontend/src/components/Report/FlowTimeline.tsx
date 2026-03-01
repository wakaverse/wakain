import { useMemo } from 'react';
import type { AppealGroup, AppealScene } from '../../types';

interface Props {
  groups: AppealGroup[];
  scenes: AppealScene[];
  duration: number;
  onGroupClick: (groupId: number) => void;
}

export default function FlowTimeline({ groups, scenes, duration, onGroupClick }: Props) {
  const sceneMap = useMemo(() => {
    const m = new Map<number, AppealScene>();
    scenes.forEach(s => m.set(s.scene_id, s));
    return m;
  }, [scenes]);

  const segments = useMemo(() => {
    const sorted = [...groups].sort((a, b) => {
      const aScenes = a.scene_ids.map(id => sceneMap.get(id)).filter(Boolean) as AppealScene[];
      const bScenes = b.scene_ids.map(id => sceneMap.get(id)).filter(Boolean) as AppealScene[];
      const aStart = aScenes.length ? Math.min(...aScenes.map(s => s.time_range[0])) : 0;
      const bStart = bScenes.length ? Math.min(...bScenes.map(s => s.time_range[0])) : 0;
      return aStart - bStart;
    });

    return sorted.map(g => {
      const gScenes = g.scene_ids.map(id => sceneMap.get(id)).filter(Boolean) as AppealScene[];
      const start = gScenes.length ? Math.min(...gScenes.map(s => s.time_range[0])) : 0;
      const end = gScenes.length ? Math.max(...gScenes.map(s => s.time_range[1])) : 0;
      const widthPercent = duration > 0 ? ((end - start) / duration) * 100 : 0;
      return { group: g, start, end, widthPercent };
    });
  }, [groups, sceneMap, duration]);

  if (segments.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex rounded-lg overflow-hidden h-9">
        {segments.map(seg => (
          <button
            key={seg.group.group_id}
            className="h-full flex items-center justify-center text-[11px] font-medium text-white/90 hover:brightness-110 transition-all cursor-pointer truncate px-2"
            style={{
              width: `${Math.max(seg.widthPercent, 4)}%`,
              backgroundColor: seg.group.color,
            }}
            onClick={() => onGroupClick(seg.group.group_id)}
            title={`${seg.group.name} (${Math.floor(seg.start)}-${Math.floor(seg.end)}s)`}
          >
            {seg.group.name}
          </button>
        ))}
      </div>
    </div>
  );
}
