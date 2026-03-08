import { useState } from 'react';
import type { SceneCard } from '../../types';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  hook:       { label: '훅',    color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500'    },
  solution:   { label: '솔루션', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-400'   },
  demo:       { label: '데모',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  proof:      { label: '증거',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500'  },
  cta:        { label: 'CTA',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  recap:      { label: '리캡',  color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500' },
  transition: { label: '전환',  color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400'   },
};

const ROLE_BAR_COLORS: Record<string, string> = {
  hook: '#ef4444', solution: '#60a5fa', demo: '#3b82f6',
  proof: '#22c55e', cta: '#f59e0b', recap: '#a855f7', transition: '#d1d5db',
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' };
}

interface Props {
  scenes: SceneCard[];
  totalDuration: number;
}

export default function SceneTimeline({ scenes, totalDuration }: Props) {
  const [activeScene, setActiveScene] = useState<SceneCard | null>(null);
  const roles = [...new Set(scenes.map((s) => s.role))];

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-4">씬 상세</h2>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {roles.map((role) => {
            const cfg = getRoleConfig(role);
            return (
              <div key={role} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className={`w-2 h-2 rounded-sm ${cfg.dot}`} />
                {cfg.label}
              </div>
            );
          })}
        </div>

        {/* Timeline bar */}
        <div className="flex h-10 rounded-lg overflow-hidden gap-px mb-3">
          {scenes.map((scene) => {
            const widthPct = (scene.duration / totalDuration) * 100;
            const barColor = ROLE_BAR_COLORS[scene.role] ?? '#d1d5db';
            return (
              <button
                key={scene.scene_id}
                onClick={() => setActiveScene(activeScene?.scene_id === scene.scene_id ? null : scene)}
                className={`h-full flex-shrink-0 transition-opacity ${
                  activeScene?.scene_id === scene.scene_id
                    ? 'opacity-100 ring-2 ring-gray-400 ring-inset'
                    : 'opacity-60 hover:opacity-85'
                }`}
                style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                title={`${getRoleConfig(scene.role).label} · ${scene.time_range[0]}s–${scene.time_range[1]}s`}
              />
            );
          })}
        </div>

        {/* Time axis */}
        <div className="flex justify-between text-xs text-gray-400 mb-4">
          <span>0s</span>
          <span>{Math.round(totalDuration / 4)}s</span>
          <span>{Math.round(totalDuration / 2)}s</span>
          <span>{Math.round((totalDuration * 3) / 4)}s</span>
          <span>{Math.round(totalDuration)}s</span>
        </div>

        {/* Scene detail */}
        {activeScene ? (() => {
          const cfg = getRoleConfig(activeScene.role);
          return (
            <div className={`border ${cfg.border} ${cfg.bg} rounded-xl p-4 transition-all`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {cfg.label}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {activeScene.time_range[0].toFixed(1)}s – {activeScene.time_range[1].toFixed(1)}s
                    ({activeScene.duration.toFixed(1)}s)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400">집중도</span>
                  <div className="text-lg font-bold text-gray-900">{activeScene.attention?.attention_score ?? '–'}</div>
                </div>
              </div>

              {activeScene.description && (
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">{activeScene.description}</p>
              )}

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white border border-gray-100 rounded-lg p-2.5">
                  <p className="text-gray-400 mb-1">주 샷</p>
                  <p className="text-gray-700">{activeScene.visual_summary.dominant_shot}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-2.5">
                  <p className="text-gray-400 mb-1">무드</p>
                  <p className="text-gray-700">{activeScene.visual_summary.color_mood}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-2.5">
                  <p className="text-gray-400 mb-1">모션</p>
                  <p className="text-gray-700">{activeScene.visual_summary.motion_level}</p>
                </div>
              </div>

              {activeScene.visual_summary.color_palette?.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-400">컬러</span>
                  <div className="flex gap-1.5">
                    {activeScene.visual_summary.color_palette.map((c, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full border border-gray-200"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <p className="text-xs text-gray-400 text-center">타임라인 바를 클릭하면 씬 상세 정보를 볼 수 있습니다</p>
        )}
      </div>
    </section>
  );
}
