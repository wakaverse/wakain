import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getResult, addLibraryItem } from '../lib/api';
import type { AnalysisResult, AppealPoint, Stt, TemporalData, ScriptElement } from '../types';
import ScriptTimeline from '../components/Report/ScriptTimeline';
import VideoStructure from '../components/Report/VideoStructure';
import RecipeCard from '../components/Report/RecipeCard';

/* ── Helpers ──────────────────────────────── */

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getCutTranscript(range: [number, number], stt: Stt | null): string {
  if (!stt?.segments) return '';
  const [start, end] = range;
  const words: string[] = [];
  for (const seg of stt.segments) {
    if (seg.end <= start || seg.start >= end) continue;
    if (seg.words?.length) {
      for (const w of seg.words) {
        const mid = (w.start + w.end) / 2;
        if (mid >= start && mid < end) words.push(w.word);
      }
    } else {
      const mid = (seg.start + seg.end) / 2;
      if (mid >= start && mid < end) words.push(seg.text);
    }
  }
  return words.join(' ').trim();
}

/* ── Cut builder ──────────────────────────── */

interface CutData {
  id: number;
  sceneId: number;
  timeRange: [number, number];
  role: string;
  transcript: string;
  appeals: AppealPoint[];
  thumbnailUrl?: string;
  persuasionIntent?: string;
}

const ROLE_LABELS: Record<string, string> = {
  hook: '훅', hoo: '훅', demo: '시연', dem: '시연',
  problem: '문제', pro: '문제', solution: '해결', sol: '해결',
  proof: '증거', cta: 'CTA', benefit: '혜택', transition: '전환',
  emotional: '감성', authority: '권위', brand_intro: '브랜드',
  brand: '브랜드', intro: '인트로', outro: '아웃트로',
  testimonial: '후기', feature: '기능', comparison: '비교',
};

const APPEAL_LABELS: Record<string, string> = {
  emotional: '감성 소구', feature_demo: '기능 시연', design_aesthetic: '디자인/미학',
  social_proof: '사회적 증거', lifestyle: '라이프스타일', authority: '권위/전문성',
  urgency: '긴급성', price_value: '가격/가치', myth_bust: '신화 깨기',
  authenticity: '진정성', track_record: '실적', guarantee: '보증',
  process: '공정', ingredient: '성분', manufacturing: '제조', comparison: '비교',
};

function roleLabel(key: string): string { return ROLE_LABELS[key.toLowerCase()] || key; }
function appealLabel(key: string): string { return APPEAL_LABELS[key] || key; }

function buildCuts(result: AnalysisResult): CutData[] {
  const appealStructure = result.appeal_structure;
  const stt = result.stt;
  const recipeScenes = result.video_recipe?.video_recipe?.scenes || [];
  const thumbnails = result.thumbnails || {};

  if (!appealStructure?.scenes?.length) {
    return recipeScenes.map((s, i) => ({
      id: i + 1, sceneId: s.scene_id, timeRange: s.time_range, role: s.role,
      transcript: getCutTranscript(s.time_range, stt),
      appeals: s.appeal_points || [],
      thumbnailUrl: thumbnails[`${s.scene_id}-${s.scene_id}`] || thumbnails[`scene_${s.scene_id}`] || thumbnails[String(s.scene_id)],
    }));
  }

  const cuts: CutData[] = [];
  for (const scene of appealStructure.scenes) {
    if (scene.cuts?.length) {
      for (const cut of scene.cuts) {
        let role = '';
        for (const rs of recipeScenes) {
          const [s1, e1] = cut.time_range;
          const [s2, e2] = rs.time_range || [0, 0];
          if (Math.max(0, Math.min(e1, e2) - Math.max(s1, s2)) > 0) { role = rs.role; break; }
        }
        cuts.push({
          id: cut.cut_id, sceneId: scene.scene_id, timeRange: cut.time_range, role,
          transcript: getCutTranscript(cut.time_range, stt),
          appeals: scene.appeals?.filter(a => {
            const ts = a.visual_proof?.timestamp;
            if (ts == null) return true;
            return ts >= cut.time_range[0] && ts < cut.time_range[1];
          }) || [],
          thumbnailUrl: thumbnails[`${scene.scene_id}-${cut.cut_id}`] || thumbnails[`scene_${scene.scene_id}_cut_${cut.cut_id}`] || thumbnails[`scene_${scene.scene_id}`] || thumbnails[String(scene.scene_id)],
          persuasionIntent: scene.persuasion_intent,
        });
      }
    } else {
      cuts.push({
        id: scene.scene_id, sceneId: scene.scene_id, timeRange: scene.time_range, role: '',
        transcript: getCutTranscript(scene.time_range, stt),
        appeals: scene.appeals || [],
        persuasionIntent: scene.persuasion_intent,
      });
    }
  }
  return cuts;
}

function extractDuration(result: AnalysisResult): number {
  const recipe = result.video_recipe?.video_recipe;
  const appealScenes = result.appeal_structure?.scenes || [];
  return (
    recipe?.meta?.duration ||
    (appealScenes.length ? Math.max(...appealScenes.map((s: any) => s.time_range?.[1] || 0)) : 0)
  );
}

/* ── Element header data ──────────────────── */

const ELEMENT_META: Record<string, { num: string; name: string }> = {
  authority:           { num: '①', name: '권위' },
  hook:                { num: '②', name: '훅' },
  sensory_description: { num: '③', name: '묘사' },
  simplicity:          { num: '④', name: '간편' },
  process:             { num: '⑤', name: '과정' },
  social_proof:        { num: '⑥', name: '증거' },
  cta:                 { num: '⑦', name: 'CTA' },
};

/* ── Tab button ───────────────────────────── */

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

/* ── SVG: Visual Energy Chart ─────────────── */

const SECTION_COLORS: Record<string, string> = {
  '클라이막스': '#ef4444',
  '강': '#f97316',
  '중': '#6366f1',
  '정적': '#d1d5db',
};

function VisualEnergyChart({ temporal, duration }: { temporal: TemporalData; duration?: number }) {
  const pts = temporal.attention_curve.points;
  if (pts.length < 2) return null;
  const W = 320; const H = 72; const padY = 6;
  const maxTs = duration || pts[pts.length - 1].timestamp;
  const coords = pts.map(p => ({
    x: (p.timestamp / maxTs) * W,
    y: padY + ((100 - p.score) / 100) * (H - padY * 2),
    section: p.section,
  }));
  const linePath = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${H - padY} L${coords[0].x},${H - padY} Z`;
  const segments = coords.slice(0, -1).map((c, i) => ({
    path: `M${c.x},${c.y} L${coords[i + 1].x},${coords[i + 1].y}`,
    color: SECTION_COLORS[c.section] || '#6366f1',
  }));
  const avgY = padY + ((100 - temporal.attention_curve.attention_avg) / 100) * (H - padY * 2);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">👁 시각 에너지 <span className="text-gray-300">· 화면 변화량</span></p>
        <p className="text-xs text-gray-400">
          평균 <span className="font-medium text-gray-600">{temporal.attention_curve.attention_avg}</span>
          {' · '}<span className="text-gray-500">{temporal.attention_curve.attention_arc}</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full">
        <defs>
          <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#energyGrad)" />
        <line x1={0} y1={avgY} x2={W} y2={avgY} stroke="#d1d5db" strokeWidth={0.5} strokeDasharray="3,3" />
        {segments.map((seg, i) => (
          <path key={i} d={seg.path} fill="none" stroke={seg.color} strokeWidth={1.5} strokeLinecap="round" />
        ))}
        {temporal.attention_curve.peak_timestamps.map((ts, i) => {
          const pt = coords.find(c => Math.abs(c.x - (ts / maxTs) * W) < 2);
          return pt ? <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill="#ef4444" opacity={0.8} /> : null;
        })}
        <text x={0} y={H + 12} fontSize={8} fill="#999">0s</text>
        <text x={W} y={H + 12} fontSize={8} fill="#999" textAnchor="end">{Math.round(maxTs)}s</text>
      </svg>
      <div className="flex gap-3 mt-1.5">
        {Object.entries(SECTION_COLORS).map(([label, color]) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SVG: Edit Rhythm Chart ───────────────── */

function EditRhythmChart({ temporal, duration }: { temporal: TemporalData; duration?: number }) {
  const cr = temporal.cut_rhythm;
  if (cr.intervals.length < 2) return null;
  const W = 320; const H = 56; const padY = 4;
  const maxTs = duration || cr.cut_timestamps[cr.cut_timestamps.length - 1];
  const WINDOW = 3; const step = 0.5;
  const densityPts: { t: number; density: number }[] = [];
  let maxDensity = 0;
  for (let t = 0; t <= maxTs; t += step) {
    const count = cr.cut_timestamps.filter(ct => ct >= t && ct < t + WINDOW).length;
    const density = count / WINDOW;
    if (density > maxDensity) maxDensity = density;
    densityPts.push({ t, density });
  }
  if (maxDensity === 0) return null;
  const coords = densityPts.map(p => ({
    x: (p.t / maxTs) * W,
    y: padY + (1 - p.density / maxDensity) * (H - padY * 2),
  }));
  const linePath = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${H - padY} L${coords[0].x},${H - padY} Z`;
  const patternKo: Record<string, string> = {
    accelerating: '가속', decelerating: '감속', constant: '일정', irregular: '불규칙',
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">✂️ 편집 리듬 <span className="text-gray-300">· 컷 빈도</span></p>
        <p className="text-xs text-gray-400">
          패턴 <span className="font-medium text-gray-600">{patternKo[cr.pattern] || cr.pattern}</span>
          {' · '}평균 <span className="font-medium text-gray-600">{cr.avg_interval}초</span>/컷
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full">
        <defs>
          <linearGradient id="rhythmGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#rhythmGrad)" />
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {cr.cut_timestamps.map((ts, i) => (
          <line key={i} x1={(ts / maxTs) * W} y1={H - padY} x2={(ts / maxTs) * W} y2={H - padY + 4} stroke="#10b981" strokeWidth={1} opacity={0.4} />
        ))}
        <text x={0} y={H + 12} fontSize={8} fill="#999">0s</text>
        <text x={W} y={H + 12} fontSize={8} fill="#999" textAnchor="end">{Math.round(maxTs)}s</text>
      </svg>
    </div>
  );
}

/* ── Cut speed fallback ───────────────────── */

function CutSpeedChartFallback({ result }: { result: AnalysisResult }) {
  const scenes = result.appeal_structure?.scenes;
  if (!scenes?.length) return null;
  const cuts: { start: number; duration: number }[] = [];
  for (const scene of scenes) {
    if (scene.cuts?.length) {
      for (const cut of scene.cuts) {
        const dur = cut.time_range[1] - cut.time_range[0];
        if (dur > 0) cuts.push({ start: cut.time_range[0], duration: dur });
      }
    } else {
      const dur = scene.time_range[1] - scene.time_range[0];
      if (dur > 0) cuts.push({ start: scene.time_range[0], duration: dur });
    }
  }
  if (cuts.length < 2) return null;
  const maxDur = Math.max(...cuts.map(c => c.duration));
  const minDur = Math.min(...cuts.map(c => c.duration));
  const totalTime = Math.max(...cuts.map(c => c.start + c.duration));
  const W = 320; const H = 64; const padY = 4;
  const points = cuts.map(cut => {
    const midX = ((cut.start + cut.duration / 2) / totalTime) * W;
    const speed = maxDur === minDur ? 0.5 : 1 - (cut.duration - minDur) / (maxDur - minDur);
    return { x: midX, y: padY + (1 - speed) * (H - padY * 2) };
  });
  const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z`;

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 mb-2">컷 속도 변화</p>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full">
        <defs>
          <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#speedGrad)" />
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2} fill="#6366f1" />)}
        <text x={0} y={H + 12} fontSize={8} fill="#999">0s</text>
        <text x={W} y={H + 12} fontSize={8} fill="#999" textAnchor="end">{Math.round(totalTime)}s</text>
      </svg>
    </div>
  );
}

/* ── Appeal type Korean labels ──────────── */

const APPEAL_TYPE_KO: Record<string, string> = {
  myth_bust: '통념 깨기',
  ingredient: '성분/원재료',
  manufacturing: '제조 공법',
  track_record: '실적/수상',
  price: '가격 어필',
  comparison: '비교',
  guarantee: '보증/자신감',
  origin: '원산지',
  feature_demo: '기능 시연',
  spec_data: '스펙/수치',
  design_aesthetic: '디자인',
  authenticity: '진정성',
  social_proof: '사회적 증거',
  urgency: '긴급/한정',
  lifestyle: '라이프스타일',
  nostalgia: '향수/추억',
  authority: '전문성/권위',
  emotional: '공감',
};

const STRENGTH_LABEL: Record<string, { text: string; color: string }> = {
  strong: { text: '강', color: 'text-emerald-600 bg-emerald-50' },
  moderate: { text: '중', color: 'text-amber-600 bg-amber-50' },
  weak: { text: '약', color: 'text-gray-400 bg-gray-50' },
};

/* ── 제품 소구 포인트 섹션 (유형별 그룹핑) ── */

interface AppealGroup {
  type: string;
  label: string;
  items: AppealPoint[];
}

function groupAppeals(points: AppealPoint[]): AppealGroup[] {
  const map = new Map<string, AppealPoint[]>();
  for (const ap of points) {
    const list = map.get(ap.type) || [];
    list.push(ap);
    map.set(ap.type, list);
  }
  // Sort by count desc
  return Array.from(map.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([type, items]) => ({
      type,
      label: APPEAL_TYPE_KO[type] || type,
      items,
    }));
}

function AppealPointsSection({ appealPoints, seekTo }: { appealPoints?: AppealPoint[]; seekTo: (s: number) => void }) {
  const [expandedType, setExpandedType] = useState<string | null>(null);

  if (!appealPoints?.length) return null;

  const groups = groupAppeals(appealPoints);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">
        🎯 제품 소구 포인트 <span className="text-xs font-normal text-gray-400">({appealPoints.length}개)</span>
      </p>
      <div className="space-y-1.5">
        {groups.map((group) => {
          const isExpanded = expandedType === group.type;
          return (
            <div key={group.type}>
              <button
                onClick={() => setExpandedType(isExpanded ? null : group.type)}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">{group.label}</span>
                <span className="text-xs text-gray-400">×{group.items.length}</span>
                <span className="ml-auto text-[11px] text-gray-500 leading-none truncate max-w-[60%] text-right">
                  {group.items.map(a => a.claim).join(' · ').slice(0, 60)}{group.items.map(a => a.claim).join(' · ').length > 60 ? '...' : ''}
                </span>
                <span className="shrink-0 text-gray-300 text-xs">{isExpanded ? '▾' : '▸'}</span>
              </button>
              {isExpanded && (
                <div className="ml-3 pl-3 border-l-2 border-gray-100 space-y-1 pb-2">
                  {group.items.map((ap, i) => {
                    const strength = STRENGTH_LABEL[ap.strength] || STRENGTH_LABEL.moderate;
                    const ts = ap.visual_proof?.timestamp;
                    return (
                      <div key={i} className="flex items-start gap-2 py-1.5">
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${strength.color}`}>{strength.text}</span>
                        <p className="flex-1 text-sm text-gray-700 leading-snug">{ap.claim}</p>
                        {ts != null && ts > 0 && (
                          <button onClick={() => seekTo(ts)} className="shrink-0 text-[10px] font-mono text-gray-300 hover:text-gray-500">
                            {fmtTime(ts)} ▶
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Tab: 분석 결과 ───────────────────────── */

function HackingResultTab({ result, seekTo, navigate }: {
  result: AnalysisResult; seekTo: (s: number) => void; navigate: (p: string) => void;
}) {
  const vr = result.video_recipe?.video_recipe;
  const pa = vr?.persuasion_analysis;
  const scriptAnalysis = vr?.script_analysis ?? (pa as any)?.script_analysis;
  const scriptAlpha = vr?.script_alpha;
  const appealPoints = pa?.appeal_points;
  const duration = vr?.meta?.duration ?? 30;

  return (
    <div className="space-y-4">
      {/* 1) 제품 소구 포인트 */}
      <AppealPointsSection appealPoints={appealPoints} seekTo={seekTo} />
      {/* 2) 대본 해부 — 새 타임라인 뷰 (α 데이터 있을 때) + 기존 뷰 폴백 */}
      <ScriptTimeline
        scriptAnalysis={scriptAnalysis}
        scriptAlpha={scriptAlpha}
        duration={duration}
        seekTo={seekTo}
      />
      {/* 3) 영상 해부 */}
      <VideoStructure result={result} />
      {/* 4) 레시피 */}
      <RecipeCard
        scriptAnalysis={scriptAnalysis}
        appealPoints={appealPoints}
        onNavigate={navigate}
      />
    </div>
  );
}

/* ── Tab: 컷 뷰 ───────────────────────────── */

function CutViewTab({ result, seekTo }: {
  result: AnalysisResult; seekTo: (s: number) => void;
}) {
  const cuts = buildCuts(result);
  const duration = extractDuration(result);
  const avgCut = result.temporal?.cut_rhythm?.avg_interval
    ?? result.video_recipe?.video_recipe?.visual_style?.avg_cut_interval;

  return (
    <div className="space-y-4">
      {/* Charts */}
      {result.temporal ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <VisualEnergyChart temporal={result.temporal} duration={duration || undefined} />
          <EditRhythmChart temporal={result.temporal} duration={duration || undefined} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <CutSpeedChartFallback result={result} />
        </div>
      )}

      {/* Timeline overview */}
      {duration > 0 && cuts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-0.5 overflow-x-auto pb-2">
            {cuts.map((cut, i) => {
              const dur = cut.timeRange[1] - cut.timeRange[0];
              const pct = (dur / duration) * 100;
              return (
                <button
                  key={cut.id}
                  onClick={() => seekTo(cut.timeRange[0])}
                  className="h-7 rounded bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-[9px] text-gray-500 font-mono shrink-0"
                  style={{ minWidth: '24px', width: `${Math.max(pct, 3)}%` }}
                  title={`${fmtTime(cut.timeRange[0])}–${fmtTime(cut.timeRange[1])}${cut.role ? ` (${cut.role})` : ''}`}
                >
                  {cut.role ? roleLabel(cut.role.slice(0, 3)) : i + 1}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-gray-300 mt-1 px-0.5">
            <span>0:00</span>
            <span>{fmtTime(duration)}</span>
          </div>
          {avgCut != null && (
            <p className="text-xs text-gray-400 mt-1">
              평균 {Number(avgCut).toFixed(1)}초/컷 · {cuts.length}컷
            </p>
          )}
        </div>
      )}

      {/* Cut cards */}
      {cuts.map((cut, i) => (
        <div
          key={cut.id}
          className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 transition-colors cursor-pointer group"
          onClick={() => seekTo(cut.timeRange[0])}
        >
          <div className="flex items-start gap-3">
            {cut.thumbnailUrl ? (
              <img src={cut.thumbnailUrl} className="w-24 h-16 object-cover rounded-lg shrink-0 bg-gray-100" alt="" />
            ) : (
              <div className="w-24 h-16 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-gray-200">{String(i + 1).padStart(2, '0')}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono text-gray-400">
                  {fmtTime(cut.timeRange[0])}–{fmtTime(cut.timeRange[1])}
                </span>
                {cut.role && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-900 text-white rounded-full">
                    {roleLabel(cut.role)}
                  </span>
                )}
              </div>
              {cut.transcript && (
                <p className="text-sm text-gray-700 leading-relaxed mb-1.5">"{cut.transcript}"</p>
              )}
              {cut.appeals.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cut.appeals.slice(0, 3).map((a, j) => (
                    <span key={j} className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full">
                      {appealLabel(a.type)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <span className="text-xs text-gray-400">▶</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Element header summary ───────────────── */

function ElementSummaryHeader({ result }: { result: AnalysisResult }) {
  const vr = result.video_recipe?.video_recipe;
  const pa = vr?.persuasion_analysis;
  const scriptAnalysis = vr?.script_analysis ?? (pa as any)?.script_analysis;

  if (!scriptAnalysis && !pa?.appeal_points?.length) return null;

  // Build used elements list and flow
  let usedElements: string[] = [];
  let flowOrder: string[] = [];

  if (scriptAnalysis) {
    usedElements = scriptAnalysis.appeals.filter((a: any) => a.used).map((a: any) => a.element);
    flowOrder = scriptAnalysis.flow_order;
  } else {
    // Fallback: derive from appeal_points types
    const typeToEl: Record<string, string> = {
      authority: 'authority', social_proof: 'social_proof',
      feature_demo: 'sensory_description', track_record: 'social_proof',
      guarantee: 'cta', price: 'simplicity', manufacturing: 'process',
    };
    const seen = new Set<string>();
    for (const ap of (pa?.appeal_points || [])) {
      const el = typeToEl[ap.type];
      if (el && !seen.has(el)) { seen.add(el); usedElements.push(el); }
    }
    flowOrder = usedElements;
  }

  if (!usedElements.length) return null;

  const total = 7;
  const count = usedElements.length;

  return (
    <div className="mb-4 space-y-2">
      {/* Used elements pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-400">사용 요소</span>
        {usedElements.map(el => {
          const meta = ELEMENT_META[el as ScriptElement];
          if (!meta) return null;
          return (
            <span key={el} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
              {meta.num}{meta.name}
            </span>
          );
        })}
        <span className="text-xs text-gray-400 ml-1">({count}/{total})</span>
      </div>
      {/* Flow order */}
      {flowOrder.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-400">배치</span>
          {flowOrder.map((el, i) => {
            const meta = ELEMENT_META[el as ScriptElement];
            return (
              <span key={i} className="flex items-center gap-1">
                <span className="text-xs text-gray-600">{meta?.name || el}</span>
                {i < flowOrder.length - 1 && <span className="text-gray-300 text-[10px]">→</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────── */

type Tab = 'hacking' | 'cuts';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('hacking');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getResult(id)
      .then((r) => {
        setResult(r);
        addLibraryItem({
          platform: 'instagram',
          source: 'analysis',
          original_url: r.video_url || '',
          video_url: r.video_url || '',
          title: r.product?.product_name || r.video_recipe?.video_recipe?.meta?.platform || 'Analysis' || 'Untitled',
          thumbnail_url: (r.thumbnails && Object.values(r.thumbnails)[0]) || '',
          job_id: id,
          tags: r.product?.category ? [r.product.category] : [],
        } as Partial<import('../types').LibraryItem>).catch(() => {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const seekTo = useCallback((sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play();
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{error || '결과를 찾을 수 없습니다'}</p>
      </div>
    );
  }

  const product = result.product;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Desktop: 2-column (video sticky left + results right) / Mobile: stacked */}
      <div className="lg:flex lg:gap-6">
        {/* Left column: Video + Product info (sticky on desktop) */}
        <div className="lg:w-[340px] lg:shrink-0">
          <div className="lg:sticky lg:top-4">
            {result.video_url && (
              <div className="mb-4 rounded-2xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  src={result.video_url}
                  controls
                  className="w-full lg:max-h-[600px] max-h-[400px] object-contain"
                />
              </div>
            )}
            {product?.product_name && (
              <div className="flex items-center gap-2 text-sm mb-3">
                <span className="font-medium text-gray-900">{product.product_name}</span>
                {product.category && <span className="text-gray-400">· {product.category}</span>}
                {product.brand && <span className="text-gray-400">· {product.brand}</span>}
              </div>
            )}
            <div className="hidden lg:block">
              <ElementSummaryHeader result={result} />
            </div>
          </div>
        </div>

        {/* Right column: Analysis results */}
        <div className="flex-1 min-w-0">
          {/* Mobile only: element summary */}
          <div className="lg:hidden">
            <ElementSummaryHeader result={result} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <TabButton active={tab === 'hacking'} onClick={() => setTab('hacking')}>분석 결과</TabButton>
            <TabButton active={tab === 'cuts'} onClick={() => setTab('cuts')}>컷 뷰</TabButton>
          </div>

          {/* Tab content */}
          {tab === 'hacking' && (
            <HackingResultTab result={result} seekTo={seekTo} navigate={navigate} />
          )}
          {tab === 'cuts' && (
            <CutViewTab result={result} seekTo={seekTo} />
          )}
        </div>
      </div>
    </div>
  );
}
