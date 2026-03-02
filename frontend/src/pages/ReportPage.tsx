import { useEffect, useState, useRef, useCallback, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ArrowLeft, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { getResult } from '../lib/api';
import type { AnalysisResult, AppealScene, AppealGroup, AppealPoint, Prescription, Stt, SceneCard as SceneCardType } from '../types';
import VideoPlayer, { type VideoPlayerHandle } from '../components/Report/VideoPlayer';
import AppealTimelineBar from '../components/Report/AppealTimelineBar';
import DimensionChart from '../components/Report/DimensionChart';
import FlowTimeline from '../components/Report/FlowTimeline';
import GroupHeader from '../components/Report/GroupHeader';
import CutCard from '../components/Report/CutCard';
import CutDetail from '../components/Report/CutDetail';

/* ── Helpers ──────────────────────────────────────────── */

/** Find best-matching recipe scene role by time overlap */
function getSceneRole(timeRange: [number, number], recipeScenes: SceneCardType[]): string {
  if (!recipeScenes?.length) return '';
  let bestRole = '';
  let bestOverlap = 0;
  for (const sc of recipeScenes) {
    const [s1, e1] = timeRange;
    const [s2, e2] = sc.time_range || [0, 0];
    const overlap = Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestRole = sc.role || '';
    }
  }
  return bestRole;
}

/** Extract transcript for a cut time range from STT segments */
function getCutTranscript(cutTimeRange: [number, number], stt: Stt | null): string {
  if (!stt?.segments) return '';
  const [start, end] = cutTimeRange;
  const words: string[] = [];
  for (const seg of stt.segments) {
    if (seg.end <= start || seg.start >= end) continue;
    if (seg.words && seg.words.length > 0) {
      for (const w of seg.words) {
        if (w.end <= start || w.start >= end) continue;
        // Assign word to the cut that contains its midpoint
        const wordMid = (w.start + w.end) / 2;
        if (wordMid >= start && wordMid < end) words.push(w.word);
      }
    } else {
      // No word-level timing: assign segment to cut containing its midpoint
      const segMid = (seg.start + seg.end) / 2;
      if (segMid >= start && segMid < end) words.push(seg.text);
    }
  }
  return words.join(' ').trim();
}

/** Get appeals from parent scene that overlap with the cut's time range */
function getCutAppeals(cutTimeRange: [number, number], sceneAppeals: AppealPoint[]): AppealPoint[] {
  const [start, end] = cutTimeRange;
  return sceneAppeals.filter(a => {
    const ts = a.visual_proof?.timestamp;
    if (ts != null) return ts >= start && ts < end;
    return true; // appeals without timestamp belong to the whole scene
  });
}

/** Parse prescriptions' time_range and match to a cut */
function matchCutPrescriptions(cutTimeRange: [number, number], allRx: Prescription[]): Prescription[] {
  const [cStart, cEnd] = cutTimeRange;
  return allRx.filter(rx => {
    if (!rx.time_range) return false;
    const match = rx.time_range.match(/([\d.]+)\s*[-–s]\s*([\d.]+)/);
    if (!match) return false;
    const rxStart = parseFloat(match[1]);
    const rxEnd = parseFloat(match[2]);
    return rxStart < cEnd && rxEnd > cStart;
  });
}

/** Flattened cut info used for rendering */
interface FlatCut {
  cutKey: string;
  cutId: number;
  sceneId: number;
  timeRange: [number, number];
  appeals: AppealPoint[];
  script: string;
  persuasionIntent?: string;
}

/* ── Verdict badge configs ────────────────────────────── */

const verdictConfig: Record<string, { bg: string; text: string; icon: string }> = {
  '집행 권장': { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '✅' },
  '조건부 집행': { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '⚠️' },
  '집행 불가': { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: '🛑' },
};

/* ── Main Component ───────────────────────────────────── */

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [expandedCut, setExpandedCut] = useState<string | null>(null);
  const [showVerdict, setShowVerdict] = useState(false);
  const [showGroups, setShowGroups] = useState(true);
  const playerRef = useRef<VideoPlayerHandle>(null);
  const groupRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const { t } = useTranslation();

  /* ── Data fetch ──────────────────────────────────────── */

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getResult(id)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Callbacks ───────────────────────────────────────── */

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleCutClick = useCallback((cutKey: string, startTime: number) => {
    setExpandedCut(prev => prev === cutKey ? null : cutKey);
    handleSeek(startTime);
  }, [handleSeek]);

  const handleGroupClick = useCallback((groupId: number) => {
    const ref = groupRefs.current.get(groupId);
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  /* ── Thumbnail capture (cut midpoints) ──────────────── */





  /* ── Loading / Error ─────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-3 text-sm text-gray-500">{t('report.loading')}</span>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa]">
        <p className="text-red-600 text-sm mb-4">{error || t('report.not_found')}</p>
        <Link to="/" className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t('report.go_back')}
        </Link>
      </div>
    );
  }

  /* ── Data extraction ─────────────────────────────────── */

  const recipeData = (result.video_recipe as any)?.video_recipe || result.video_recipe || {};
  const meta = (recipeData as any).meta || {};
  const duration = meta.duration || 30;
  const videoUrl = result.video_url || null;

  const diagnosis = result.diagnosis || ({} as any);
  const dimensions = diagnosis.dimensions || [];
  const engagementScore = diagnosis.overall_score || diagnosis.engagement_score || 0;

  const narrationLabel =
    result.stt && result.stt.segments && result.stt.segments.length > 0
      ? t('report.narration_voice')
      : result.caption_map && result.caption_map.events && result.caption_map.events.length > 0
        ? t('report.narration_caption')
        : t('report.narration_silent');

  const artDirection = (recipeData as any).art_direction || {};

  const productName = result.product?.product_name || result.verdict?.product_name || '';
  const productBrand = result.product?.brand || '';
  const productCategory = result.product?.category || result.verdict?.product_category || '';

  const appealStructure = result.appeal_structure;
  const allRx = result.prescriptions?.prescriptions || [];
  const recipeScenes: SceneCardType[] = (recipeData as any).scenes || [];

  /* ── Computed maps ───────────────────────────────────── */

  const sceneMap = new Map<number, AppealScene>();
  appealStructure?.scenes.forEach(s => sceneMap.set(s.scene_id, s));

  const sceneGroupColorMap = new Map<number, string>();
  appealStructure?.groups.forEach(g =>
    g.scene_ids.forEach(sid => sceneGroupColorMap.set(sid, g.color))
  );

  const sortedGroups = appealStructure
    ? [...appealStructure.groups].sort((a, b) => {
        const aStart = getGroupStart(a, sceneMap);
        const bStart = getGroupStart(b, sceneMap);
        return aStart - bStart;
      })
    : [];

  const verdict = result.verdict;
  const vc = verdict ? verdictConfig[verdict.verdict] || verdictConfig['조건부 집행'] : null;

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {productName || meta.category || t('report.video')} {t('report.analysis')}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
              {productCategory && <span>{productCategory}</span>}
              {productBrand && <span>· {productBrand}</span>}
              <span>· {narrationLabel}</span>
              <span>· {duration}{t('report.seconds')}</span>
            </div>
          </div>

          {/* Score badge */}
          {engagementScore > 0 && (
            <div className="text-center shrink-0">
              <div
                className="text-xl font-bold"
                style={{
                  color: engagementScore >= 80 ? '#22c55e' : engagementScore >= 60 ? '#f59e0b' : '#ef4444',
                  fontFamily: 'var(--font-display), sans-serif',
                }}
              >
                {Math.round(engagementScore)}
              </div>
              <div className="text-[9px] text-gray-400">{t('report.overall')}</div>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

          {/* ── Left: Video Sidebar (sticky on desktop) ── */}
          <div className="lg:w-[380px] lg:shrink-0 space-y-3 lg:sticky lg:top-20 lg:self-start">
            <VideoPlayer ref={playerRef} src={videoUrl} onTimeUpdate={handleTimeUpdate} />
            {appealStructure && (
              <AppealTimelineBar
                groups={appealStructure.groups}
                scenes={appealStructure.scenes}
                duration={duration}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            )}
            {dimensions.length > 0 && (
              <DimensionChart dimensions={dimensions} engagementScore={engagementScore} />
            )}
          </div>

          {/* ── Right: Content ──────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Flow Timeline (sticky on desktop) */}
            {appealStructure && (
              <div className="sticky top-16 z-20 bg-[#fafafa] py-2 -mx-1 px-1">
                <FlowTimeline
                  groups={appealStructure.groups}
                  scenes={appealStructure.scenes}
                  duration={duration}
                  onGroupClick={handleGroupClick}
                />
              </div>
            )}

            {/* Verdict summary (compact) */}
            {verdict && vc && (
              <div className={`rounded-2xl border ${vc.bg} overflow-hidden`}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => setShowVerdict(!showVerdict)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center gap-1 text-sm font-bold ${vc.text}`}>
                      {vc.icon} {t(`verdict.${verdict.verdict}`, { defaultValue: verdict.verdict })}
                    </span>
                    {!showVerdict && verdict.verdict_summary && (
                      <span className="text-xs text-gray-500 truncate">
                        — {verdict.verdict_summary.slice(0, 60)}
                      </span>
                    )}
                  </div>
                  {showVerdict
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                </div>
                {showVerdict && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-200/50">
                    {verdict.verdict_summary && (
                      <p className="text-sm text-gray-700 leading-relaxed pt-3 whitespace-pre-line">
                        {verdict.verdict_summary}
                      </p>
                    )}
                    {verdict.hook_analysis && (
                      <div className="bg-white/60 rounded-lg p-3">
                        <h5 className="text-[11px] font-semibold text-gray-500 mb-1">{t('report.hook_analysis')}</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line">{verdict.hook_analysis}</p>
                      </div>
                    )}
                    {verdict.keyword_analysis && (
                      <div className="bg-white/60 rounded-lg p-3">
                        <h5 className="text-[11px] font-semibold text-gray-500 mb-1">{t('report.keyword_analysis')}</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line">{verdict.keyword_analysis}</p>
                      </div>
                    )}
                    {verdict.action_plan && (
                      <div className="bg-white/60 rounded-lg p-3">
                        <h5 className="text-[11px] font-semibold text-gray-500 mb-1">{t('report.action_plan')}</h5>
                        <p className="text-xs text-gray-700 whitespace-pre-line">{verdict.action_plan}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Top 3 actions */}
            {result.prescriptions && result.prescriptions.top_3_actions.length > 0 && (
              <div className="rounded-xl bg-gray-900 text-white p-4">
                <h3 className="text-xs font-bold mb-2 text-gray-400 uppercase tracking-wider">{t('report.top3')}</h3>
                <div className="space-y-1.5">
                  {result.prescriptions.top_3_actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="bg-white/15 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-gray-200 leading-relaxed">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Group toggle ──────────────────────── */}
            {appealStructure && sortedGroups.length > 0 && (
              <div className="flex items-center justify-end mb-1">
                <button
                  onClick={() => setShowGroups(g => !g)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    showGroups
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {showGroups ? t('report.group_on') : t('report.group_off')}
                </button>
              </div>
            )}

            {/* ── Group → Cut flow ────────────────────── */}
            {appealStructure && sortedGroups.length > 0 ? (
              showGroups ? (
              <div className="space-y-2">
                {sortedGroups.map(group => {
                  const scenes = group.scene_ids
                    .map(sid => sceneMap.get(sid))
                    .filter(Boolean) as AppealScene[];
                  const range = getGroupRange(group, sceneMap);

                  // Flatten all cuts from scenes in this group
                  const flatCuts: FlatCut[] = [];
                  for (const scene of scenes) {
                    for (const cut of scene.cuts) {
                      const cutKey = `${scene.scene_id}-${cut.cut_id}`;
                      flatCuts.push({
                        cutKey,
                        cutId: cut.cut_id,
                        sceneId: scene.scene_id,
                        timeRange: cut.time_range,
                        appeals: getCutAppeals(cut.time_range, scene.appeals),
                        script: getCutTranscript(cut.time_range, result.stt),
                        persuasionIntent: scene.persuasion_intent,
                      });
                    }
                  }
                  flatCuts.sort((a, b) => a.timeRange[0] - b.timeRange[0]);

                  const appealCount = flatCuts.reduce((sum, c) => sum + c.appeals.length, 0);

                  return (
                    <div
                      key={group.group_id}
                      ref={el => { if (el) groupRefs.current.set(group.group_id, el); }}
                      className="scroll-mt-28"
                    >
                      <GroupHeader
                        group={group}
                        timeRange={range}
                        cutCount={flatCuts.length}
                        appealCount={appealCount}
                      />

                      {/* Cut cards grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {flatCuts.map(fc => {
                          const isActive = currentTime >= fc.timeRange[0] && currentTime < fc.timeRange[1];
                          const isExpanded = expandedCut === fc.cutKey;
                          const role = getSceneRole(fc.timeRange, recipeScenes);
                          const groupColor = sceneGroupColorMap.get(fc.sceneId) || group.color;

                          return (
                            <Fragment key={fc.cutKey}>
                              <CutCard
                                cutKey={fc.cutKey}
                                cutId={fc.cutId}
                                timeRange={fc.timeRange}
                                appeals={fc.appeals}
                                script={fc.script}
                                groupColor={groupColor}
                                role={role}
                                isActive={isActive}
                                isExpanded={isExpanded}
                                thumbnailUrl={result.thumbnails?.[fc.cutKey]}
                                onClick={() => handleCutClick(fc.cutKey, fc.timeRange[0])}
                              />
                              {isExpanded && (
                                <div className="col-span-full">
                                  <CutDetail
                                    cutId={fc.cutId}
                                    timeRange={fc.timeRange}
                                    script={fc.script}
                                    appeals={fc.appeals}
                                    prescriptions={matchCutPrescriptions(fc.timeRange, allRx)}
                                    persuasionIntent={fc.persuasionIntent}
                                    onSeek={handleSeek}
                                    onClose={() => setExpandedCut(null)}
                                  />
                                </div>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
              /* ── Flat mode (no groups) ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {(() => {
                  const allCuts: FlatCut[] = [];
                  for (const scene of appealStructure.scenes) {
                    for (const cut of scene.cuts) {
                      const cutKey = `${scene.scene_id}-${cut.cut_id}`;
                      allCuts.push({
                        cutKey,
                        cutId: cut.cut_id,
                        sceneId: scene.scene_id,
                        timeRange: cut.time_range,
                        appeals: getCutAppeals(cut.time_range, scene.appeals),
                        script: getCutTranscript(cut.time_range, result.stt),
                        persuasionIntent: scene.persuasion_intent,
                      });
                    }
                  }
                  allCuts.sort((a, b) => a.timeRange[0] - b.timeRange[0]);
                  return allCuts.map(fc => {
                    const isActive = currentTime >= fc.timeRange[0] && currentTime < fc.timeRange[1];
                    const isExpanded = expandedCut === fc.cutKey;
                    const role = getSceneRole(fc.timeRange, recipeScenes);
                    const groupColor = sceneGroupColorMap.get(fc.sceneId) || '#6B7280';
                    return (
                      <Fragment key={fc.cutKey}>
                        <CutCard
                          cutKey={fc.cutKey}
                          cutId={fc.cutId}
                          timeRange={fc.timeRange}
                          appeals={fc.appeals}
                          script={fc.script}
                          groupColor={groupColor}
                          role={role}
                          isActive={isActive}
                          isExpanded={isExpanded}
                          thumbnailUrl={result.thumbnails?.[fc.cutKey]}
                          onClick={() => handleCutClick(fc.cutKey, fc.timeRange[0])}
                        />
                        {isExpanded && (
                          <div className="col-span-full">
                            <CutDetail
                              cutId={fc.cutId}
                              timeRange={fc.timeRange}
                              script={fc.script}
                              appeals={fc.appeals}
                              prescriptions={matchCutPrescriptions(fc.timeRange, allRx)}
                              persuasionIntent={fc.persuasionIntent}
                              onSeek={handleSeek}
                              onClose={() => setExpandedCut(null)}
                            />
                          </div>
                        )}
                      </Fragment>
                    );
                  });
                })()}
              </div>
              )
            ) : (
              <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-2xl border">
                {t('report.no_appeal_data')}
              </div>
            )}

            {/* ── Art Direction (collapsible) ──────────── */}
            {hasArtDirection(artDirection) && (
              <ArtDirectionCollapsible art={artDirection} />
            )}

            {/* ── 3-Axis Diagnosis Summary ─────────────── */}
            {(diagnosis as any)?.axes && (diagnosis as any).axes.length > 0 && (
              <DiagnosisSummary axes={(diagnosis as any).axes} />
            )}

            {/* ── Unmatched prescriptions ──────────────── */}
            {allRx.length > 0 && (
              <UnmatchedPrescriptions
                allRx={allRx}
                appealStructure={appealStructure}
                onSeek={handleSeek}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Utility functions ────────────────────────────────── */

function getGroupStart(group: AppealGroup, sceneMap: Map<number, AppealScene>): number {
  const scenes = group.scene_ids.map(id => sceneMap.get(id)).filter(Boolean) as AppealScene[];
  return scenes.length ? Math.min(...scenes.map(s => s.time_range[0])) : 0;
}

function getGroupRange(group: AppealGroup, sceneMap: Map<number, AppealScene>): [number, number] {
  const scenes = group.scene_ids.map(id => sceneMap.get(id)).filter(Boolean) as AppealScene[];
  if (!scenes.length) return [0, 0];
  return [
    Math.min(...scenes.map(s => s.time_range[0])),
    Math.max(...scenes.map(s => s.time_range[1])),
  ];
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function hasArtDirection(art: any): boolean {
  return art && (art.tone_and_manner || art.graphic_style || art.style_reference ||
    (art.brand_colors && art.brand_colors.length > 0));
}

/* ── Inline sub-components ────────────────────────────── */

function ArtDirectionCollapsible({ art }: { art: any }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>{'🎨 '}{t('report.art_direction')}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-3 border-t border-gray-100">
          {art.tone_and_manner && (
            <div className="pt-3">
              <h5 className="text-[11px] font-semibold text-gray-500 mb-1">{t('report.tone_manner')}</h5>
              <p className="text-sm text-gray-700">{art.tone_and_manner}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {art.graphic_style && <ArtField label={t('report.graphic')} value={art.graphic_style} />}
            {art.background_style && <ArtField label={t('report.background')} value={art.background_style} />}
            {art.highlight_method && <ArtField label={t('report.emphasis')} value={art.highlight_method} />}
            {art.style_reference && <ArtField label={t('report.reference')} value={art.style_reference} />}
            {art.heading_font && <ArtField label={t('report.heading_font')} value={art.heading_font} />}
            {art.body_font && <ArtField label={t('report.body_font')} value={art.body_font} />}
          </div>
          {art.brand_colors && art.brand_colors.length > 0 && (
            <div>
              <h5 className="text-[11px] font-semibold text-gray-500 mb-1.5">{t('report.brand_colors')}</h5>
              <div className="flex gap-2 flex-wrap">
                {art.brand_colors.map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md border border-gray-200" style={{ backgroundColor: c }} />
                    <span className="text-[10px] font-mono text-gray-500">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-gray-400">{label}</dt>
      <dd className="text-xs text-gray-700 mt-0.5">{value}</dd>
    </div>
  );
}

function DiagnosisSummary({ axes }: { axes: Array<{ id: string; name: string; score: number; diagnoses: Array<{ severity: string }> }> }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>{'📊 '}{t('report.diagnosis_summary')}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {!open && (
        <div className="flex gap-2 px-5 pb-3">
          {axes.map(axis => {
            const color = axis.score >= 80 ? 'text-green-600' : axis.score >= 60 ? 'text-amber-500' : 'text-red-500';
            return (
              <div key={axis.id} className="flex items-center gap-1.5 text-xs">
                <span className={`font-bold ${color}`}>{axis.score}</span>
                <span className="text-gray-400">{axis.name}</span>
              </div>
            );
          })}
        </div>
      )}
      {open && (
        <div className="px-5 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {axes.map(axis => {
            const color = axis.score >= 80 ? 'text-green-600' : axis.score >= 60 ? 'text-amber-500' : 'text-red-500';
            const bg = axis.score >= 80 ? 'bg-green-50' : axis.score >= 60 ? 'bg-amber-50' : 'bg-red-50';
            const dangerCount = axis.diagnoses.filter(d => d.severity === 'danger').length;
            const warningCount = axis.diagnoses.filter(d => d.severity === 'warning').length;
            return (
              <div key={axis.id} className={`rounded-xl ${bg} p-3 flex items-center justify-between`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{axis.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                    {dangerCount > 0 && <span className="text-red-600">🔴 {dangerCount}</span>}
                    {warningCount > 0 && <span className="text-amber-600">⚠️ {warningCount}</span>}
                    {dangerCount === 0 && warningCount === 0 && <span className="text-green-600">✅ {t('report.good')}</span>}
                  </div>
                </div>
                <span className={`text-2xl font-bold ${color}`} style={{ fontFamily: 'var(--font-display), sans-serif' }}>{axis.score}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Show prescriptions that didn't match any scene time range */
function UnmatchedPrescriptions({
  allRx,
  appealStructure,
  onSeek,
}: {
  allRx: Prescription[];
  appealStructure: { scenes: AppealScene[]; groups: AppealGroup[] } | null;
  onSeek: (time: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  // Find prescriptions without a time_range (global) or that don't overlap any scene
  const unmatched = allRx.filter(rx => {
    if (!rx.time_range) return true;
    if (!appealStructure) return true;
    const match = rx.time_range.match(/([\d.]+)\s*[-–s]\s*([\d.]+)/);
    if (!match) return true;
    const rxStart = parseFloat(match[1]);
    const rxEnd = parseFloat(match[2]);
    return !appealStructure.scenes.some(s =>
      rxStart < s.time_range[1] && rxEnd > s.time_range[0]
    );
  });

  if (unmatched.length === 0) return null;

  const severityIcon: Record<string, string> = { danger: '🔴', warning: '⚠️', info: '💡' };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>{'📋 '}{t('report.extra_rx')} ({unmatched.length})</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {unmatched.map((rx, i) => {
            const icon = severityIcon[rx.severity] || '💡';
            const handleClick = () => {
              if (!rx.time_range) return;
              const m = rx.time_range.match(/([\d.]+)/);
              if (m) onSeek(parseFloat(m[1]));
            };
            return (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <span className="text-sm">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{rx.symptom}</p>
                  <p className="text-xs text-gray-600 mt-0.5">→ {rx.recommendation}</p>
                  {rx.time_range && (
                    <button onClick={handleClick} className="text-[10px] text-blue-600 hover:underline mt-0.5">
                      ⏱ {rx.time_range}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
