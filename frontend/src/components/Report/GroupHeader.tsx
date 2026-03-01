import type { AppealGroup } from '../../types';

interface Props {
  group: AppealGroup;
  timeRange: [number, number];
  sceneCount: number;
  appealCount: number;
}

export default function GroupHeader({ group, timeRange, sceneCount, appealCount }: Props) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-3">
      <div
        className="w-1 h-10 rounded-full shrink-0"
        style={{ backgroundColor: group.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3
            className="text-base font-bold text-gray-900"
            style={{ fontFamily: 'var(--font-display), sans-serif' }}
          >
            {group.name}
          </h3>
          <span className="text-xs text-gray-400 font-mono">
            {timeRange[0].toFixed(1)}s – {timeRange[1].toFixed(1)}s
          </span>
        </div>
        {group.description && (
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{group.description}</p>
        )}
      </div>
      <div className="text-[11px] text-gray-400 shrink-0">
        {sceneCount}씬 · {appealCount}소구
      </div>
    </div>
  );
}
