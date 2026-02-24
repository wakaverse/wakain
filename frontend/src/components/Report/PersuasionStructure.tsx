import { useState, useMemo } from 'react';
import type { AppealStructure, AppealGroup, AppealScene, SceneCard, Stt } from '../../types';

interface Props {
  appealStructure: AppealStructure;
  sceneCards: SceneCard[];
  stt: Stt | null;
  onSeek: (time: number) => void;
  currentTime: number;
}

function formatTime(t: number): string {
  return t.toFixed(1) + 's';
}

function formatRange(r: [number, number]): string {
  return `${formatTime(r[0])}-${formatTime(r[1])}`;
}

export default function PersuasionStructure({ appealStructure, sceneCards, onSeek, currentTime }: Props) {
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [openScenes, setOpenScenes] = useState<Set<number>>(new Set());

  const sceneMap = useMemo(() => {
    const m = new Map<number, AppealScene>();
    appealStructure.scenes.forEach(s => m.set(s.scene_id, s));
    return m;
  }, [appealStructure.scenes]);

  // sceneCards available for future cut-level detail enrichment
  void sceneCards;

  const toggleGroup = (gid: number) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid); else next.add(gid);
      return next;
    });
  };

  const toggleScene = (sid: number) => {
    setOpenScenes(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const getGroupTimeRange = (group: AppealGroup): [number, number] => {
    const scenes = group.scene_ids.map(id => sceneMap.get(id)).filter(Boolean) as AppealScene[];
    if (!scenes.length) return [0, 0];
    const start = Math.min(...scenes.map(s => s.time_range[0]));
    const end = Math.max(...scenes.map(s => s.time_range[1]));
    return [start, end];
  };

  const getGroupStats = (group: AppealGroup) => {
    const scenes = group.scene_ids.map(id => sceneMap.get(id)).filter(Boolean) as AppealScene[];
    const appealCount = scenes.reduce((sum, s) => sum + s.appeals.length, 0);
    const range = getGroupTimeRange(group);
    const duration = range[1] - range[0];
    return { sceneCount: scenes.length, appealCount, duration };
  };

  const isCurrentCut = (range: [number, number]) =>
    currentTime >= range[0] && currentTime < range[1];

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-gray-900 mb-4">🎯 설득 구조</h3>

      {appealStructure.groups.map(group => {
        const isOpen = openGroups.has(group.group_id);
        const stats = getGroupStats(group);
        const range = getGroupTimeRange(group);

        return (
          <div key={group.group_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Level 1: Group */}
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 transition-all duration-200"
              onClick={() => { toggleGroup(group.group_id); onSeek(range[0]); }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <span className="font-bold text-gray-900">{group.name}</span>
                    <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      씬 {stats.sceneCount}개 · 소구 {stats.appealCount}개 · {stats.duration.toFixed(1)}s
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">{formatRange(range)}</span>
                  <span className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </div>
              </div>
            </div>

            {/* Level 2: Scenes */}
            <div className={`transition-all duration-200 ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
              <div className="px-4 pb-4 space-y-2">
                {group.scene_ids.map(sid => {
                  const scene = sceneMap.get(sid);
                  if (!scene) return null;
                  const sceneOpen = openScenes.has(sid);
                  return (
                    <div key={sid} className="ml-4 bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <div
                        className="p-3 cursor-pointer hover:bg-gray-50 transition-all duration-200"
                        onClick={() => { toggleScene(sid); onSeek(scene.time_range[0]); }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-semibold text-sm text-gray-900">
                              {scene.persuasion_intent || `씬 ${sid}`}
                            </span>
                            {scene.stt_text && (
                              <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">
                                🎤 "{scene.stt_text}"
                              </p>
                            )}
                            {(() => {
                              const scriptAppeals = scene.appeals.filter(a => a.source === 'script');
                              const visualAppeals = scene.appeals.filter(a => a.source === 'visual');
                              const otherAppeals = scene.appeals.filter(a => a.source !== 'script' && a.source !== 'visual');
                              return (
                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                  {scriptAppeals.length > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                      🎤 대본 ×{scriptAppeals.length}
                                    </span>
                                  )}
                                  {visualAppeals.length > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                      🎬 비주얼 ×{visualAppeals.length}
                                    </span>
                                  )}
                                  {otherAppeals.length > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                      🔗 복합 ×{otherAppeals.length}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-400">{formatRange(scene.time_range)}</span>
                            <span className={`text-gray-400 text-sm transition-transform duration-200 ${sceneOpen ? 'rotate-180' : ''}`}>▾</span>
                          </div>
                        </div>
                      </div>

                      {/* Level 3: Cuts */}
                      <div className={`transition-all duration-200 ${sceneOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                        <div className="px-3 pb-3 space-y-2">
                          {scene.cuts.map(cut => {
                            const isCurrent = isCurrentCut(cut.time_range);
                            // Find matching appeals for this cut's time range
                            const cutAppeals = scene.appeals.filter(a =>
                              a.visual_proof.timestamp >= cut.time_range[0] &&
                              a.visual_proof.timestamp < cut.time_range[1]
                            );
                            // Find matching scene card cut info
                            return (
                              <div
                                key={cut.cut_id}
                                className={`ml-4 p-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                                  isCurrent ? 'ring-2 ring-gray-900 bg-gray-50' : 'bg-white border border-gray-50'
                                }`}
                                onClick={() => onSeek(cut.time_range[0])}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs shrink-0">
                                    🖼
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">컷{cut.cut_id}</span>
                                      <span className="text-xs text-gray-400">{formatRange(cut.time_range)}</span>
                                    </div>
                                    {/* Script appeals */}
                                    {cutAppeals.filter(a => a.source === 'script').map((appeal, i) => (
                                      <p key={`s${i}`} className="text-xs text-gray-600 mt-1">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-amber-600">🎤</span>
                                          <span className="text-amber-700 font-medium">{appeal.type}</span>
                                          <span className="text-gray-500">: {appeal.claim}</span>
                                        </span>
                                      </p>
                                    ))}
                                    {/* Visual appeals */}
                                    {cutAppeals.filter(a => a.source === 'visual').map((appeal, i) => (
                                      <p key={`v${i}`} className="text-xs text-gray-600 mt-1">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-blue-600">🎬</span>
                                          <span className="text-blue-700 font-medium">{appeal.type}</span>
                                          <span className="text-gray-500">: {appeal.claim}</span>
                                        </span>
                                      </p>
                                    ))}
                                    {/* Legacy "both" fallback */}
                                    {cutAppeals.filter(a => a.source === 'both' || !a.source).map((appeal, i) => (
                                      <p key={`b${i}`} className="text-xs text-gray-600 mt-1">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-purple-600">🔗</span>
                                          <span className="text-purple-700 font-medium">{appeal.type}</span>
                                          <span className="text-gray-500">: {appeal.claim}</span>
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
