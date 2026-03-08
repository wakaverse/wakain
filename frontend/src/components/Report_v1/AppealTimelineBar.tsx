import { useMemo, useRef } from 'react';
import type { AppealGroup, AppealScene } from '../../types';

interface Props {
  groups: AppealGroup[];
  scenes: AppealScene[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export default function AppealTimelineBar({ groups, scenes, duration, currentTime, onSeek }: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  // Build scene-to-group color map
  const sceneColorMap = useMemo(() => {
    const m = new Map<number, string>();
    groups.forEach(g => g.scene_ids.forEach(sid => m.set(sid, g.color)));
    return m;
  }, [groups]);

  // Build segments covering full duration
  const segments = useMemo(() => {
    const sorted = [...scenes].sort((a, b) => a.time_range[0] - b.time_range[0]);
    const result: Array<{ start: number; end: number; color: string }> = [];
    let cursor = 0;

    for (const scene of sorted) {
      const [start, end] = scene.time_range;
      if (start > cursor) {
        result.push({ start: cursor, end: start, color: '#e5e7eb' });
      }
      result.push({ start, end, color: sceneColorMap.get(scene.scene_id) || '#e5e7eb' });
      cursor = end;
    }
    if (cursor < duration) {
      result.push({ start: cursor, end: duration, color: '#e5e7eb' });
    }
    return result;
  }, [scenes, sceneColorMap, duration]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, ratio * duration)));
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-2 mb-1">
      <div
        ref={barRef}
        className="relative w-full h-3 rounded-full overflow-hidden cursor-pointer flex"
        onClick={handleClick}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full"
            style={{
              width: `${((seg.end - seg.start) / duration) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-black pointer-events-none"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {groups.map(g => (
          <div key={g.group_id} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
            {g.name}
          </div>
        ))}
      </div>
    </div>
  );
}
