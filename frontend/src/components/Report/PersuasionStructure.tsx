import { useState, useMemo } from 'react';
import type { AppealStructure, AppealGroup, AppealScene, SceneCard, Stt } from '../../types';

interface Props {
  appealStructure: AppealStructure;
  sceneCards: SceneCard[];
  stt: Stt | null;
  onSeek: (time: number) => void;
  currentTime: number;
  recipe?: Record<string, unknown>;
}

const APPEAL_TYPE_KO: Record<string, string> = {
  myth_bust: '오해반박', ingredient: '원재료/성분', manufacturing: '제조공정',
  track_record: '실적/수상', price: '가격/혜택', comparison: '비교우위',
  guarantee: '보장/환불', origin: '원산지', feature_demo: '기능시연',
  spec_data: '스펙수치', design_aesthetic: '디자인감성', authenticity: '진정성/리얼',
  social_proof: '사회적증거', urgency: '긴급/한정', lifestyle: '라이프스타일',
  nostalgia: '향수/추억', authority: '권위/전문가', emotional: '감정호소',
};

function getAppealTypeKo(type: string): string {
  return APPEAL_TYPE_KO[type] || type;
}

type ViewMode = 'group' | 'timeline';

const ROLE_KO: Record<string, string> = {
  hook: '훅', problem: '문제제기', solution: '해결책', demo: '시연',
  proof: '증거', brand_intro: '브랜드', recap: '정리', cta: 'CTA',
  transition: '전환', body: '본문',
};

function getSceneRole(sceneTimeRange: [number, number], recipeSceneCards: any[]): string {
  if (!recipeSceneCards?.length) return '';
  let bestRole = '';
  let bestOverlap = 0;
  for (const sc of recipeSceneCards) {
    const [s1, e1] = sceneTimeRange;
    const [s2, e2] = sc.time_range || [0, 0];
    const overlap = Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestRole = sc.role || '';
    }
  }
  return bestRole;
}

const strengthStyle: Record<string, string> = {
  strong: 'bg-green-100 text-green-700',
  moderate: 'bg-amber-100 text-amber-700',
  weak: 'bg-red-100 text-red-700',
};
const strengthLabel: Record<string, string> = { strong: '강', moderate: '중', weak: '약' };

function formatTime(t: number): string {
  return t.toFixed(1) + 's';
}

function formatRange(r: [number, number]): string {
  return `${formatTime(r[0])}-${formatTime(r[1])}`;
}

function findRhythmProfile(sceneTimeRange: [number, number], recipeSceneCards: any[]): any | null {
  if (!recipeSceneCards) return null;
  const matching = recipeSceneCards.filter((sc: any) => {
    const [s1, e1] = sceneTimeRange;
    const [s2, e2] = sc.time_range || [0, 0];
    return s1 < e2 && s2 < e1;
  });
  if (!matching.length) return null;
  return {
    cut_count: matching.reduce((sum: number, sc: any) => sum + (sc.rhythm_profile?.cut_count || 0), 0),
    cut_density: matching.reduce((sum: number, sc: any) => sum + (sc.rhythm_profile?.cut_density || 0), 0) / matching.length,
    zoom_events: matching.reduce((sum: number, sc: any) => sum + (sc.rhythm_profile?.zoom_events || 0), 0),
    color_shifts: matching.reduce((sum: number, sc: any) => sum + (sc.rhythm_profile?.color_shifts || 0), 0),
    tempo_level: matching[0]?.rhythm_profile?.tempo_level || 'medium',
  };
}

function getCutTranscript(cutTimeRange: [number, number], stt: Stt | null): string {
  if (!stt?.segments) return '';
  const [start, end] = cutTimeRange;
  const matching = stt.segments.filter(seg => seg.start < end && seg.end > start);
  return matching.map(seg => seg.text).join(' ').trim();
}

export default function PersuasionStructure({ appealStructure, sceneCards, stt, onSeek, currentTime, recipe }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('group');
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [openScenes, setOpenScenes] = useState<Set<number>>(new Set());

  const sceneMap = useMemo(() => {
    const m = new Map<number, AppealScene>();
    appealStructure.scenes.forEach(s => m.set(s.scene_id, s));
    return m;
  }, [appealStructure.scenes]);

  const recipeSceneCards = useMemo(() => {
    const vr = recipe?.video_recipe as any;
    return vr?.scene_cards || (recipe as any)?.scene_cards || [];
  }, [recipe]);

  // sceneCards available for future cut-level detail enrichment
  void sceneCards;

  // Reverse map: scene_id → group color
  const sceneGroupColor = useMemo(() => {
    const m = new Map<number, string>();
    appealStructure.groups.forEach(g => {
      g.scene_ids.forEach(sid => m.set(sid, g.color));
    });
    return m;
  }, [appealStructure.groups]);

  // Sorted scenes for timeline view
  const sortedScenes = useMemo(() =>
    [...appealStructure.scenes].sort((a, b) => a.time_range[0] - b.time_range[0]),
    [appealStructure.scenes]
  );

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

  // Render scene card content (shared between group view Level 2 and timeline view)
  const renderSceneContent = (scene: AppealScene, sid: number) => {
    const sceneOpen = openScenes.has(sid);
    const rhythmProfile = findRhythmProfile(scene.time_range, recipeSceneCards);
    return (
      <>
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
                  🎤 &ldquo;{scene.stt_text}&rdquo;
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
              {rhythmProfile && (
                <div className="flex gap-2 mt-1.5 text-[10px] text-gray-400">
                  <span>🎬 컷 {rhythmProfile.cut_count}개</span>
                  <span>⚡ 밀도 {rhythmProfile.cut_density.toFixed(1)}/s</span>
                  <span>🔍 줌 {rhythmProfile.zoom_events}</span>
                  <span>🎨 색변 {rhythmProfile.color_shifts}</span>
                  <span className={`font-medium ${
                    rhythmProfile.tempo_level === 'high' ? 'text-red-500' :
                    rhythmProfile.tempo_level === 'low' ? 'text-blue-500' : 'text-amber-500'
                  }`}>
                    템포 {rhythmProfile.tempo_level === 'high' ? '빠름' : rhythmProfile.tempo_level === 'low' ? '느림' : '보통'}
                  </span>
                </div>
              )}
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
              const cutAppeals = scene.appeals.filter(a =>
                a.visual_proof.timestamp >= cut.time_range[0] &&
                a.visual_proof.timestamp < cut.time_range[1]
              );
              const cutTranscript = getCutTranscript(cut.time_range, stt);
              return (
                <div
                  key={cut.cut_id}
                  className={`ml-4 p-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    isCurrent ? 'ring-2 ring-gray-900 bg-gray-50' : 'bg-white border border-gray-50'
                  }`}
                  onClick={() => onSeek(cut.time_range[0])}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {cut.cut_id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">컷{cut.cut_id}</span>
                        <span className="text-xs text-gray-400">{formatRange(cut.time_range)}</span>
                      </div>
                      {cutTranscript && (
                        <p className="text-xs text-gray-500 italic mt-0.5 line-clamp-2">
                          💬 &ldquo;{cutTranscript}&rdquo;
                        </p>
                      )}
                      {cutAppeals.filter(a => a.source === 'script').map((appeal, i) => (
                        <p key={`s${i}`} className="text-xs text-gray-600 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-amber-600">🎤</span>
                            <span className="text-amber-700 font-medium">{getAppealTypeKo(appeal.type)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${strengthStyle[appeal.strength] || ''}`}>
                              {strengthLabel[appeal.strength] || ''}
                            </span>
                            {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
                              <span className="text-[10px] text-gray-400">({appeal.visual_proof.technique})</span>
                            )}
                            <span className="text-gray-500">: {appeal.claim}</span>
                          </span>
                        </p>
                      ))}
                      {cutAppeals.filter(a => a.source === 'visual').map((appeal, i) => (
                        <p key={`v${i}`} className="text-xs text-gray-600 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-blue-600">🎬</span>
                            <span className="text-blue-700 font-medium">{getAppealTypeKo(appeal.type)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${strengthStyle[appeal.strength] || ''}`}>
                              {strengthLabel[appeal.strength] || ''}
                            </span>
                            {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
                              <span className="text-[10px] text-gray-400">({appeal.visual_proof.technique})</span>
                            )}
                            <span className="text-gray-500">: {appeal.claim}</span>
                          </span>
                        </p>
                      ))}
                      {cutAppeals.filter(a => a.source === 'both' || !a.source).map((appeal, i) => (
                        <p key={`b${i}`} className="text-xs text-gray-600 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-purple-600">🔗</span>
                            <span className="text-purple-700 font-medium">{getAppealTypeKo(appeal.type)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${strengthStyle[appeal.strength] || ''}`}>
                              {strengthLabel[appeal.strength] || ''}
                            </span>
                            {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
                              <span className="text-[10px] text-gray-400">({appeal.visual_proof.technique})</span>
                            )}
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
      </>
    );
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-gray-900 mb-4">🎯 설득 구조</h3>

      {/* View Mode Toggle */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-full p-1 w-fit">
        <button
          onClick={() => setViewMode('group')}
          className={`px-4 py-1.5 rounded-full text-sm transition-all ${
            viewMode === 'group' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500'
          }`}
        >
          🎯 그룹 뷰
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-4 py-1.5 rounded-full text-sm transition-all ${
            viewMode === 'timeline' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500'
          }`}
        >
          📋 타임라인 뷰
        </button>
      </div>

      {viewMode === 'timeline' ? (
        /* Timeline View */
        <div className="space-y-2">
          {sortedScenes.map(scene => {
            const sid = scene.scene_id;
            const groupColor = sceneGroupColor.get(sid) || '#888';
            const role = getSceneRole(scene.time_range, recipeSceneCards);
            return (
              <div key={sid} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: groupColor }}
                  />
                  <span className="text-sm font-bold text-gray-900">씬{sid}</span>
                  <span className="text-xs text-gray-400">{formatRange(scene.time_range)}</span>
                  <div className="flex-1" />
                  {role && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                      {ROLE_KO[role] || role}
                    </span>
                  )}
                </div>
                {renderSceneContent(scene, sid)}
              </div>
            );
          })}
        </div>
      ) : (
        /* Group View */
        <>

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
                  const rhythmProfile = findRhythmProfile(scene.time_range, recipeSceneCards);
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
                            {rhythmProfile && (
                              <div className="flex gap-2 mt-1.5 text-[10px] text-gray-400">
                                <span>🎬 컷 {rhythmProfile.cut_count}개</span>
                                <span>⚡ 밀도 {rhythmProfile.cut_density.toFixed(1)}/s</span>
                                <span>🔍 줌 {rhythmProfile.zoom_events}</span>
                                <span>🎨 색변 {rhythmProfile.color_shifts}</span>
                                <span className={`font-medium ${
                                  rhythmProfile.tempo_level === 'high' ? 'text-red-500' :
                                  rhythmProfile.tempo_level === 'low' ? 'text-blue-500' : 'text-amber-500'
                                }`}>
                                  템포 {rhythmProfile.tempo_level === 'high' ? '빠름' : rhythmProfile.tempo_level === 'low' ? '느림' : '보통'}
                                </span>
                              </div>
                            )}
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
                            const cutAppeals = scene.appeals.filter(a =>
                              a.visual_proof.timestamp >= cut.time_range[0] &&
                              a.visual_proof.timestamp < cut.time_range[1]
                            );
                            const cutTranscript = getCutTranscript(cut.time_range, stt);
                            return (
                              <div
                                key={cut.cut_id}
                                className={`ml-4 p-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                                  isCurrent ? 'ring-2 ring-gray-900 bg-gray-50' : 'bg-white border border-gray-50'
                                }`}
                                onClick={() => onSeek(cut.time_range[0])}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold shrink-0">
                                    {cut.cut_id}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">컷{cut.cut_id}</span>
                                      <span className="text-xs text-gray-400">{formatRange(cut.time_range)}</span>
                                    </div>
                                    {cutTranscript && (
                                      <p className="text-xs text-gray-500 italic mt-0.5 line-clamp-2">
                                        💬 &ldquo;{cutTranscript}&rdquo;
                                      </p>
                                    )}
                                    {/* Script appeals */}
                                    {cutAppeals.filter(a => a.source === 'script').map((appeal, i) => (
                                      <p key={`s${i}`} className="text-xs text-gray-600 mt-1">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-amber-600">🎤</span>
                                          <span className="text-amber-700 font-medium">{getAppealTypeKo(appeal.type)}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${strengthStyle[appeal.strength] || ''}`}>
                                            {strengthLabel[appeal.strength] || ''}
                                          </span>
                                          {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
                                            <span className="text-[10px] text-gray-400">({appeal.visual_proof.technique})</span>
                                          )}
                                          <span className="text-gray-500">: {appeal.claim}</span>
                                        </span>
                                      </p>
                                    ))}
                                    {/* Visual appeals */}
                                    {cutAppeals.filter(a => a.source === 'visual').map((appeal, i) => (
                                      <p key={`v${i}`} className="text-xs text-gray-600 mt-1">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-blue-600">🎬</span>
                                          <span className="text-blue-700 font-medium">{getAppealTypeKo(appeal.type)}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${strengthStyle[appeal.strength] || ''}`}>
                                            {strengthLabel[appeal.strength] || ''}
                                          </span>
                                          {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
                                            <span className="text-[10px] text-gray-400">({appeal.visual_proof.technique})</span>
                                          )}
                                          <span className="text-gray-500">: {appeal.claim}</span>
                                        </span>
                                      </p>
                                    ))}
                                    {/* Legacy "both" fallback */}
                                    {cutAppeals.filter(a => a.source === 'both' || !a.source).map((appeal, i) => (
                                      <p key={`b${i}`} className="text-xs text-gray-600 mt-1">
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-purple-600">🔗</span>
                                          <span className="text-purple-700 font-medium">{getAppealTypeKo(appeal.type)}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${strengthStyle[appeal.strength] || ''}`}>
                                            {strengthLabel[appeal.strength] || ''}
                                          </span>
                                          {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
                                            <span className="text-[10px] text-gray-400">({appeal.visual_proof.technique})</span>
                                          )}
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
