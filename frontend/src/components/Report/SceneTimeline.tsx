import { useState } from 'react';
import type { SceneCard } from '../../types';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  hook:       { label: '훅',       color: 'text-red-300',    bg: 'bg-red-500',    border: 'border-red-500' },
  solution:   { label: '솔루션',   color: 'text-blue-300',   bg: 'bg-blue-400',   border: 'border-blue-400' },
  demo:       { label: '데모',     color: 'text-blue-300',   bg: 'bg-blue-500',   border: 'border-blue-500' },
  proof:      { label: '증거',     color: 'text-green-300',  bg: 'bg-green-500',  border: 'border-green-500' },
  cta:        { label: 'CTA',      color: 'text-orange-300', bg: 'bg-orange-500', border: 'border-orange-500' },
  recap:      { label: '리캡',     color: 'text-purple-300', bg: 'bg-purple-500', border: 'border-purple-500' },
  transition: { label: '전환',     color: 'text-gray-300',   bg: 'bg-gray-500',   border: 'border-gray-500' },
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, color: 'text-gray-300', bg: 'bg-gray-600', border: 'border-gray-600' };
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
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="text-blue-400">🎬</span> 씬 타임라인
      </h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {roles.map((role) => {
            const cfg = getRoleConfig(role);
            return (
              <div key={role} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className={`w-2.5 h-2.5 rounded-sm ${cfg.bg}`} />
                {cfg.label}
              </div>
            );
          })}
        </div>

        {/* Timeline bar */}
        <div className="flex h-12 rounded-lg overflow-hidden gap-px mb-4">
          {scenes.map((scene) => {
            const cfg = getRoleConfig(scene.role);
            const widthPct = (scene.duration / totalDuration) * 100;
            return (
              <button
                key={scene.scene_id}
                onClick={() => setActiveScene(activeScene?.scene_id === scene.scene_id ? null : scene)}
                className={`h-full flex-shrink-0 transition-opacity ${cfg.bg} ${
                  activeScene?.scene_id === scene.scene_id ? 'opacity-100 ring-2 ring-white/50' : 'opacity-70 hover:opacity-90'
                }`}
                style={{ width: `${widthPct}%` }}
                title={`${cfg.label} · ${scene.time_range[0]}s–${scene.time_range[1]}s`}
              />
            );
          })}
        </div>

        {/* Time axis */}
        <div className="flex justify-between text-xs text-gray-600 mb-5">
          <span>0s</span>
          <span>{Math.round(totalDuration / 4)}s</span>
          <span>{Math.round(totalDuration / 2)}s</span>
          <span>{Math.round((totalDuration * 3) / 4)}s</span>
          <span>{Math.round(totalDuration)}s</span>
        </div>

        {/* Scene detail card */}
        {activeScene && (() => {
          const cfg = getRoleConfig(activeScene.role);
          return (
            <div className={`border rounded-xl p-5 transition-all ${cfg.border} bg-gray-950`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg}/20 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {activeScene.time_range[0].toFixed(1)}s – {activeScene.time_range[1].toFixed(1)}s
                    ({activeScene.duration.toFixed(1)}s)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">집중도</span>
                  <div className="text-lg font-bold text-white">{activeScene.attention?.attention_score ?? '–'}</div>
                </div>
              </div>

              {activeScene.description && (
                <p className="text-sm text-gray-300 mb-3 leading-relaxed">{activeScene.description}</p>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-900 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">주 샷</p>
                  <p className="text-gray-300">{activeScene.visual_summary.dominant_shot}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">무드</p>
                  <p className="text-gray-300">{activeScene.visual_summary.color_mood}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-2.5">
                  <p className="text-gray-500 mb-1">모션</p>
                  <p className="text-gray-300">{activeScene.visual_summary.motion_level}</p>
                </div>
              </div>

              {activeScene.visual_summary.color_palette?.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-500">컬러 팔레트</span>
                  <div className="flex gap-1.5">
                    {activeScene.visual_summary.color_palette.map((c, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full border border-gray-700"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {!activeScene && (
          <p className="text-xs text-gray-600 text-center">타임라인 바를 클릭하면 씬 상세 정보를 볼 수 있습니다</p>
        )}
      </div>
    </section>
  );
}
