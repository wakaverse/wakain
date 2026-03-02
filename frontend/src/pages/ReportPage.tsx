import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2, Zap, Target, Film,
  FileText, Layers, ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import { getResult, addLibraryItem } from '../lib/api';
import type { AnalysisResult, AppealPoint, Stt, PersuasionStep, FrameworkMatch } from '../types';

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

/* ── Data extraction ──────────────────────── */

interface HookInfo {
  type: string;
  description: string;
  hookLine: string;
  timeRange: [number, number];
}

interface AppealInfo {
  type: string;
  claim: string;
  strength: string;
  source?: string;
}

interface EditInfo {
  avgCutSec: number;
  totalCuts: number;
  duration: number;
  transitionStyle: string;
}

interface RecipeStep {
  role: string;
  timeRange: [number, number];
  duration: number;
  technique?: string;
}

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

function extractHook(result: AnalysisResult): HookInfo | null {
  const recipe = result.video_recipe?.video_recipe;
  if (!recipe) return null;
  const hookScene = recipe.scenes?.find(s =>
    s.role?.toLowerCase().includes('hook') || s.role?.includes('훅')
  );
  return {
    type: hookScene?.role || recipe.persuasion_analysis?.appeal_points?.[0]?.type || '알 수 없음',
    description: hookScene?.description || '',
    hookLine: recipe.audio?.voice?.hook_line || '',
    timeRange: hookScene?.time_range || [0, recipe.structure?.hook_time || 3],
  };
}

function extractAppeals(result: AnalysisResult): AppealInfo[] {
  const appeals = result.video_recipe?.video_recipe?.persuasion_analysis?.appeal_points;
  if (!appeals?.length) return [];
  return appeals.map(a => ({
    type: a.type, claim: a.claim, strength: a.strength, source: a.source,
  }));
}

function extractEdit(result: AnalysisResult): EditInfo | null {
  const recipe = result.video_recipe?.video_recipe;
  if (!recipe) return null;
  const actualCuts = recipe.scenes?.length || recipe.visual_style?.total_cuts || 0;
  const duration = recipe.meta?.duration || 0;
  const avgCut = actualCuts > 0 ? duration / actualCuts : (recipe.visual_style?.avg_cut_interval || 0);
  return {
    avgCutSec: avgCut,
    totalCuts: actualCuts,
    duration,
    transitionStyle: recipe.visual_style?.transition_style || '',
  };
}

function extractRecipe(result: AnalysisResult): RecipeStep[] {
  const scenes = result.video_recipe?.video_recipe?.scenes;
  if (!scenes?.length) return [];
  return scenes.map(s => ({
    role: s.role, timeRange: s.time_range, duration: s.duration,
  }));
}


function extractSummary(result: AnalysisResult): string {
  return result.video_recipe?.video_recipe?.persuasion_analysis?.persuasion_summary || '';
}

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
      thumbnailUrl: thumbnails[`scene_${s.scene_id}`],
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
          thumbnailUrl: thumbnails[`scene_${scene.scene_id}_cut_${cut.cut_id}`] || thumbnails[`scene_${scene.scene_id}`],
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

/* ── UI Components ────────────────────────── */

function Card({ icon: Icon, title, children, className = '' }: {
  icon?: React.ElementType; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 ${className}`}>
      {(Icon || title) && (
        <div className="flex items-center gap-2.5 mb-4">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Icon className="w-4 h-4 text-gray-900" strokeWidth={1.5} />
            </div>
          )}
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}


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

/* ── SVG: Cut Speed Chart ─────────────────── */

function CutSpeedChart({ result }: { result: AnalysisResult }) {
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
  const totalTime = Math.max(...cuts.map(c => c.start + c.duration));
  const W = 320;
  const H = 64;
  const barW = Math.max(2, (W / cuts.length) - 1);

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 mb-2">컷 속도 변화</p>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" preserveAspectRatio="none">
        {cuts.map((cut, i) => {
          const x = (cut.start / totalTime) * W;
          const h = (cut.duration / maxDur) * H;
          const shade = 180 - Math.round((cut.duration / maxDur) * 80);
          return (
            <rect
              key={i}
              x={x}
              y={H - h}
              width={Math.max(barW, 2)}
              height={h}
              rx={1}
              fill={`rgb(${shade},${shade},${shade})`}
            />
          );
        })}
        <text x={0} y={H + 12} fontSize={8} fill="#999">0s</text>
        <text x={W} y={H + 12} fontSize={8} fill="#999" textAnchor="end">{Math.round(totalTime)}s</text>
        <text x={W} y={8} fontSize={7} fill="#ccc" textAnchor="end">길게</text>
        <text x={W} y={H - 2} fontSize={7} fill="#ccc" textAnchor="end">짧게</text>
      </svg>
    </div>
  );
}


/* ── Persuasion Lens Components ───────────── */

function LensToggle({ lens, setLens }: { lens: 'formula' | 'framework'; setLens: (l: 'formula' | 'framework') => void }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-4">
      <button
        onClick={() => setLens('formula')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          lens === 'formula' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        7+α 설득 공식
      </button>
      <button
        onClick={() => setLens('framework')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
          lens === 'framework' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        전통 프레임
      </button>
    </div>
  );
}

const EXTENSION_LABELS: Record<string, string> = {
  price_anchoring: '가격앵커링',
  scarcity: '희소성',
  before_after: '비포애프터',
  data_evidence: '데이터증거',
  trend: '트렌드소구',
  risk_removal: '위험제거',
};

function StepCard({ step, seekTo }: { step: PersuasionStep; seekTo: (s: number) => void }) {
  const present = step.present;
  return (
    <div
      className={`rounded-2xl border p-4 ${
        present ? 'bg-white border-gray-100' : 'bg-gray-50 border-dashed border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg font-bold text-gray-300">{step.step}</span>
        <span className="text-sm font-semibold text-gray-900">{step.name_ko}</span>
        <span className="text-base">{present ? '✅' : '⬜'}</span>
        {step.sub_type_ko && (
          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
            {step.sub_type_ko}
          </span>
        )}
      </div>

      {present && step.time_range && (
        <button
          onClick={() => seekTo(step.time_range![0])}
          className="text-[11px] font-mono text-gray-400 hover:text-gray-600 transition-colors mb-2"
        >
          {fmtTime(step.time_range[0])} – {fmtTime(step.time_range[1])} ▶
        </button>
      )}

      {step.evidence && (
        <p className="text-sm text-gray-600 leading-relaxed mb-2">"{step.evidence}"</p>
      )}

      {step.extensions?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {step.extensions.map((ext) => (
            <span key={ext} className="text-[10px] px-2 py-0.5 bg-gray-900 text-white rounded-full">
              {EXTENSION_LABELS[ext] || ext}
            </span>
          ))}
        </div>
      )}

      {step.quality_checks && Object.keys(step.quality_checks).length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {Object.entries(step.quality_checks).map(([key, val]) => (
            <span key={key} className="text-[11px] text-gray-500">
              {val ? '✅' : '❌'} {key.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FormulaLens({ steps, seekTo }: { steps: PersuasionStep[]; seekTo: (s: number) => void }) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <StepCard key={step.step} step={step} seekTo={seekTo} />
      ))}
    </div>
  );
}

function FrameworkLens({ fw, seekTo }: { fw: FrameworkMatch; seekTo: (s: number) => void }) {
  const totalDuration = fw.mapping.length > 0
    ? Math.max(...fw.mapping.map(m => m.time_range[1])) - Math.min(...fw.mapping.map(m => m.time_range[0]))
    : 1;
  const minStart = fw.mapping.length > 0 ? Math.min(...fw.mapping.map(m => m.time_range[0])) : 0;
  const phaseColors = ['#1a1a1a', '#444', '#666', '#888', '#aaa', '#ccc'];

  const confidencePct = Math.round(fw.confidence * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold text-gray-900">{fw.primary_framework_ko}</span>
        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-mono">
          {fw.primary_framework}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          confidencePct >= 80 ? 'bg-green-50 text-green-700' :
          confidencePct >= 60 ? 'bg-yellow-50 text-yellow-700' :
          'bg-gray-50 text-gray-500'
        }`}>
          {confidencePct}%
        </span>
      </div>

      {/* Timeline bar */}
      {fw.mapping.length > 0 && totalDuration > 0 && (
        <div>
          <div className="flex rounded-lg overflow-hidden h-8">
            {fw.mapping.map((m, i) => {
              const dur = m.time_range[1] - m.time_range[0];
              const pct = (dur / totalDuration) * 100;
              return (
                <button
                  key={i}
                  onClick={() => seekTo(m.time_range[0])}
                  className="flex items-center justify-center text-[10px] font-medium transition-opacity hover:opacity-80 truncate px-1"
                  style={{
                    width: `${Math.max(pct, 8)}%`,
                    backgroundColor: phaseColors[i % phaseColors.length],
                    color: i < 3 ? '#fff' : '#333',
                  }}
                  title={`${m.phase_ko} (${fmtTime(m.time_range[0])}–${fmtTime(m.time_range[1])})`}
                >
                  {m.phase_ko}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
            <span>{fmtTime(minStart)}</span>
            <span>{fmtTime(minStart + totalDuration)}</span>
          </div>
        </div>
      )}

      {/* Phase details */}
      <div className="space-y-2">
        {fw.mapping.map((m, i) => (
          <div key={i} className="flex items-start gap-3 bg-[#fafafa] rounded-xl px-4 py-3">
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: phaseColors[i % phaseColors.length] }}
            />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-gray-900">{m.phase_ko}</span>
                <span className="text-[10px] font-mono text-gray-400">
                  {fmtTime(m.time_range[0])}–{fmtTime(m.time_range[1])}
                </span>
              </div>
              <p className="text-sm text-gray-600">{m.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary framework */}
      {fw.secondary_framework && (
        <p className="text-xs text-gray-400">
          2차 매칭: {fw.secondary_framework} ({Math.round(fw.secondary_confidence * 100)}%)
        </p>
      )}
    </div>
  );
}

/* ── Tab: 요약 ────────────────────────────── */

function SummaryTab({ result, seekTo, navigate }: {
  result: AnalysisResult; seekTo: (s: number) => void; navigate: (p: string) => void;
}) {
  const [persuasionLens, setPersuasionLens] = useState<'formula' | 'framework'>('formula');
  const hook = extractHook(result);
  const appeals = extractAppeals(result);
  const edit = extractEdit(result);
  const recipe = extractRecipe(result);
  const summary = extractSummary(result);

  // Appeal groups by type
  const appealGroups = (() => {
    if (!appeals.length) return [];
    const groupMap = new Map<string, { count: number; claims: string[] }>();
    for (const a of appeals) {
      const existing = groupMap.get(a.type);
      if (existing) {
        existing.count++;
        existing.claims.push(a.claim);
      } else {
        groupMap.set(a.type, { count: 1, claims: [a.claim] });
      }
    }
    return Array.from(groupMap.entries())
      .map(([type, { count, claims }]) => {
        const keywords = claims.slice(0, 3).map(c => {
          const words = c.split(/\s+/).slice(0, 3).join(' ');
          return words.length > 20 ? words.slice(0, 20) + '…' : words;
        });
        return { type, count, keywords };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  })();
  const maxGroupCount = Math.max(...appealGroups.map(g => g.count), 1);

  const totalDuration = recipe.reduce((sum, s) => sum + s.duration, 0);
  const sceneColors = ['#1a1a1a', '#444', '#666', '#888', '#aaa', '#ccc'];

  return (
    <div className="space-y-4">
      {/* 1. 한줄 요약 + 타임라인 바 */}
      {(summary || recipe.length > 0) && (
        <Card icon={Sparkles} title="한줄 요약">
          {summary && (
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{summary}</p>
          )}
          {recipe.length > 0 && totalDuration > 0 && (
            <div>
              <div className="flex rounded-lg overflow-hidden h-8">
                {recipe.map((step, i) => {
                  const pct = (step.duration / totalDuration) * 100;
                  return (
                    <button
                      key={i}
                      onClick={() => seekTo(step.timeRange[0])}
                      className="flex items-center justify-center text-[10px] font-medium transition-opacity hover:opacity-80 truncate px-1"
                      style={{
                        width: `${Math.max(pct, 4)}%`,
                        backgroundColor: sceneColors[i % sceneColors.length],
                        color: i < 3 ? '#fff' : '#333',
                      }}
                      title={`${step.role} (${step.duration.toFixed(1)}s)`}
                    >
                      {pct > 8 ? step.role : ''}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
                <span>0s</span>
                <span>{Math.round(totalDuration)}s</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 2. 훅 분석 (3초) */}
      {hook && (
        <Card icon={Zap} title="훅 분석 (3초)">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => seekTo(hook.timeRange[0])}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {fmtTime(hook.timeRange[0])} – {fmtTime(hook.timeRange[1])} ▶
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hook.hookLine && (
              <div className="bg-[#fafafa] rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1.5">🎙 음성 훅</p>
                <p className="text-sm text-gray-800 font-medium leading-relaxed">&ldquo;{hook.hookLine}&rdquo;</p>
              </div>
            )}
            {hook.description && (
              <div className="bg-[#fafafa] rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1.5">👁 시각 훅</p>
                <p className="text-sm text-gray-700 leading-relaxed">{hook.description}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 3. 영상 리듬감 */}
      {edit && (
        <Card icon={Film} title="영상 리듬감">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {edit.avgCutSec.toFixed(1)}<span className="text-sm font-normal text-gray-400">초</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">평균 컷</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {edit.totalCuts}<span className="text-sm font-normal text-gray-400">컷</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">총 컷 수</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(edit.duration)}<span className="text-sm font-normal text-gray-400">초</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">영상 길이</p>
            </div>
          </div>
          <CutSpeedChart result={result} />
        </Card>
      )}

      {/* 4. 설득 구조 (렌즈) */}
      {result.persuasion_lens ? (
        <Card icon={Target} title="설득 구조">
          <LensToggle lens={persuasionLens} setLens={setPersuasionLens} />
          {persuasionLens === 'formula' ? (
            <FormulaLens steps={result.persuasion_lens.lens_7step} seekTo={seekTo} />
          ) : (
            <FrameworkLens fw={result.persuasion_lens.lens_framework} seekTo={seekTo} />
          )}
        </Card>
      ) : appealGroups.length > 0 ? (
        <Card icon={Target} title="핵심 소구 포인트">
          <p className="text-[11px] text-gray-400 mb-3">이 영상은 이전 버전으로 분석되었습니다</p>
          <div className="space-y-3">
            {appealGroups.map((group) => (
              <div key={group.type}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">{group.type}</span>
                  <span className="text-xs text-gray-400">{group.count}회</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-gray-700 rounded-full transition-all"
                    style={{ width: `${(group.count / maxGroupCount) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.keywords.map((kw, j) => (
                    <span key={j} className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* 5. 내 제품에 적용 (유지) */}
      <Card icon={Sparkles} title="내 제품에 적용하기">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">이 영상의 구조를 활용해 내 제품 소재를 만들어보세요</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/app/script')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              <FileText className="w-4 h-4" />
              대본 생성
            </button>
            <button
              onClick={() => navigate('/app/expand')}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-300 transition-colors"
            >
              <Layers className="w-4 h-4" />
              소재 확장
            </button>
            <button
              onClick={() => navigate('/app/compare')}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-300 transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              비교에 추가
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
/* ── Tab: 컷 뷰 ───────────────────────────── */

function CutViewTab({ result, seekTo }: {
  result: AnalysisResult; seekTo: (s: number) => void;
}) {
  const edit = extractEdit(result);
  const cuts = buildCuts(result);

  return (
    <div className="space-y-3">
      {/* Timeline overview */}
      {edit && edit.duration > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-0.5 overflow-x-auto pb-2">
            {cuts.map((cut, i) => {
              const dur = cut.timeRange[1] - cut.timeRange[0];
              const pct = (dur / edit.duration) * 100;
              return (
                <button
                  key={cut.id}
                  onClick={() => seekTo(cut.timeRange[0])}
                  className="h-7 rounded bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-[9px] text-gray-500 font-mono shrink-0"
                  style={{ minWidth: '24px', width: `${Math.max(pct, 3)}%` }}
                  title={`${fmtTime(cut.timeRange[0])}–${fmtTime(cut.timeRange[1])}${cut.role ? ` (${cut.role})` : ''}`}
                >
                  {cut.role ? cut.role.slice(0, 3) : i + 1}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-gray-300 mt-1 px-0.5">
            <span>0:00</span>
            <span>{fmtTime(edit.duration)}</span>
          </div>
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
            {/* Thumbnail or index */}
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
                    {cut.role}
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
                      {a.type}
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

/* ── Tab: 상세 분석 ───────────────────────── */

function DetailTab({ result }: { result: AnalysisResult }) {
  const recipe = result.video_recipe?.video_recipe;
  const diagnosis = result.diagnosis;
  const style = result.style;

  return (
    <div className="space-y-4">
      {/* 분류 */}
      {(style || diagnosis?.classification) && (
        <Card title="영상 분류">
          <div className="grid grid-cols-2 gap-3">
            {style?.primary_format_ko && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-0.5">포맷</p>
                <p className="text-sm font-medium text-gray-900">{style.primary_format_ko}</p>
              </div>
            )}
            {style?.primary_intent_ko && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-0.5">의도</p>
                <p className="text-sm font-medium text-gray-900">{style.primary_intent_ko}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 9축 분석 */}
      {diagnosis?.dimensions && diagnosis.dimensions.length > 0 && (
        <Card title="9축 분석">
          <div className="space-y-2.5">
            {diagnosis.dimensions.map((dim) => (
              <div key={dim.name} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0 truncate">{dim.name_ko}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full transition-all"
                    style={{ width: `${Math.min(dim.value * 10, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-400 w-8 text-right">{dim.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 아트 디렉션 */}
      {recipe?.art_direction && (
        <Card title="아트 디렉션">
          <div className="space-y-2">
            {recipe.art_direction.tone_and_manner && (
              <p className="text-sm text-gray-600">{recipe.art_direction.tone_and_manner}</p>
            )}
            {recipe.art_direction.brand_colors?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">컬러:</span>
                {recipe.art_direction.brand_colors.map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: c }} title={c} />
                ))}
              </div>
            )}
            {recipe.art_direction.graphic_style && (
              <p className="text-xs text-gray-400">그래픽: {recipe.art_direction.graphic_style}</p>
            )}
          </div>
        </Card>
      )}

      {/* 오디오 */}
      {recipe?.audio && (
        <Card title="오디오">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400 mb-0.5">보이스</p>
              <p className="text-sm text-gray-700">{recipe.audio.voice?.type} · {recipe.audio.voice?.tone}</p>
            </div>
            {recipe.audio.music?.present && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-0.5">음악</p>
                <p className="text-sm text-gray-700">{recipe.audio.music.genre} · {recipe.audio.music.energy_profile}</p>
              </div>
            )}
          </div>
          {recipe.audio.voice?.script_summary && (
            <p className="mt-3 text-xs text-gray-500">{recipe.audio.voice.script_summary}</p>
          )}
        </Card>
      )}

      {/* 강점/약점 */}
      {(diagnosis?.strengths?.length || diagnosis?.weaknesses?.length) && (
        <Card title="강점 · 약점">
          <div className="grid sm:grid-cols-2 gap-4">
            {diagnosis?.strengths && diagnosis.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-2">강점</p>
                <ul className="space-y-1.5">
                  {diagnosis.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                      <span className="text-green-400 mt-0.5">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diagnosis?.weaknesses && diagnosis.weaknesses.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-600 mb-2">약점</p>
                <ul className="space-y-1.5">
                  {diagnosis.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 성과 지표 */}
      {recipe?.performance_metrics && (
        <Card title="성과 지표">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: '첫 소구까지', value: `${recipe.performance_metrics.time_to_first_appeal?.toFixed(1)}초` },
              { label: 'CTA까지', value: `${recipe.performance_metrics.time_to_cta?.toFixed(1)}초` },
              { label: '소구 수', value: `${recipe.performance_metrics.appeal_count}개` },
              { label: '소구 다양성', value: recipe.performance_metrics.appeal_diversity?.toFixed(2) },
              { label: '정보 밀도', value: recipe.performance_metrics.info_density?.toFixed(2) },
              { label: '제품 비중', value: `${(recipe.performance_metrics.product_focus_ratio * 100).toFixed(0)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────── */

type Tab = 'summary' | 'cuts' | 'detail';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getResult(id)
      .then((r) => {
        setResult(r);
        // Auto-save to library
        addLibraryItem({
          platform: 'instagram',
          source: 'analysis',
          original_url: r.video_url || '',
          video_url: r.video_url || '',
          title: r.product?.product_name || r.video_recipe?.video_recipe?.meta?.platform || 'Analysis' || 'Untitled',
          thumbnail_url: (r.thumbnails && Object.values(r.thumbnails)[0]) || '',
          job_id: id,
          tags: r.product?.category ? [r.product.category] : [],
        } as Partial<import('../types').LibraryItem>).catch(() => {});  // silently fail if duplicate
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
    <div className="max-w-4xl mx-auto">
      {/* Video */}
      {result.video_url && (
        <div className="mb-6 rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} src={result.video_url} controls className="w-full max-h-[400px] object-contain" />
        </div>
      )}

      {/* Product info */}
      {product?.product_name && (
        <div className="flex items-center gap-2 text-sm mb-4">
          <span className="font-medium text-gray-900">{product.product_name}</span>
          {product.category && <span className="text-gray-400">· {product.category}</span>}
          {product.brand && <span className="text-gray-400">· {product.brand}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>요약</TabButton>
        <TabButton active={tab === 'cuts'} onClick={() => setTab('cuts')}>컷 뷰</TabButton>
        <TabButton active={tab === 'detail'} onClick={() => setTab('detail')}>상세 분석</TabButton>
      </div>

      {/* Tab content */}
      {tab === 'summary' && <SummaryTab result={result} seekTo={seekTo} navigate={navigate} />}
      {tab === 'cuts' && <CutViewTab result={result} seekTo={seekTo} />}
      {tab === 'detail' && <DetailTab result={result} />}
    </div>
  );
}
