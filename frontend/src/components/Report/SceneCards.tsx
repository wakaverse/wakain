import { useRef, useEffect, useMemo, useState } from 'react';
import { Play, ChevronDown } from 'lucide-react';
import type { RecipeJSON, VisualScene, ProductClaim, ScriptBlock, AttentionPoint } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, CLAIM_TYPE_INFO, getDynamicsInterpretation, getDynamicsLevel } from '../../lib/recipe-utils';

/* ── 역할 태그 색상 ─────────────────────── */

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  hook: { label: '첫 장면', color: '#EF4444', bg: 'bg-red-50' },
  pain_point: { label: '문제/공감', color: '#F97316', bg: 'bg-orange-50' },
  differentiation: { label: '차별점', color: '#3B82F6', bg: 'bg-blue-50' },
  proof: { label: '증거/근거', color: '#10B981', bg: 'bg-emerald-50' },
  benefit: { label: '장점 소개', color: '#8B5CF6', bg: 'bg-violet-50' },
  social_proof: { label: '후기/반응', color: '#EAB308', bg: 'bg-yellow-50' },
  cta: { label: '행동 유도', color: '#EC4899', bg: 'bg-pink-50' },
  authority: { label: '전문가/신뢰', color: '#6366F1', bg: 'bg-indigo-50' },
  demo: { label: '시연/사용법', color: '#059669', bg: 'bg-emerald-50' },
  promotion: { label: '할인/혜택', color: '#F97316', bg: 'bg-orange-50' },
};

/* ── 씬 데이터 조합 ─────────────────────── */

interface SceneData {
  sceneId: number;
  timeRange: [number, number];
  role: string;
  roleConfig: { label: string; color: string; bg: string };
  thumbnailUrl: string | null;
  scriptTexts: string[];
  claims: Array<{ type: string; claim: string; strategy?: string }>;
  dynamicsAvg: number;
  overallAvg: number;
  changeLabel: string;
  isHighlight: boolean;
  style?: string;
  colorTone?: string;
}

function buildSceneDataList(data: RecipeJSON, thumbnails: Record<string, string>): SceneData[] {
  const scenes: VisualScene[] = data.visual?.scenes || [];
  const blocks: ScriptBlock[] = data.script?.blocks || [];
  const claims: ProductClaim[] = data.product?.claims || [];
  const points: AttentionPoint[] = data.visual?.rhythm?.attention_curve?.points || [];
  const overallAvg = data.visual?.rhythm?.attention_curve?.avg ?? 0;

  return scenes.map((scene) => {
    const [start, end] = scene.time_range;

    // 역할: scene.role 또는 해당 블록의 block type으로 폴백
    const matchedBlock = blocks.find(
      (b) => b.time_range[0] < end && b.time_range[1] > start,
    );
    const role = scene.role?.toLowerCase() || matchedBlock?.block || 'hook';
    const rc = ROLE_CONFIG[role] || { label: BLOCK_LABELS[role] || role, color: '#6B7280', bg: 'bg-gray-50' };

    // 스크립트: 시간 겹치는 블록의 text
    const scriptTexts = blocks
      .filter((b) => b.time_range[0] < end && b.time_range[1] > start)
      .map((b) => b.text)
      .filter(Boolean);

    // 소구: 시간 겹치는 claims
    const matchedClaims = claims
      .filter((c) => c.time_range[0] < end && c.time_range[1] > start)
      .map((c) => ({ type: c.type, claim: c.claim, strategy: c.strategy }));

    // 변화량: 해당 구간 평균
    const scenePoints = points.filter((p) => p.t >= start && p.t <= end);
    const dynamicsAvg = scenePoints.length > 0
      ? Math.round(scenePoints.reduce((sum, p) => sum + p.score, 0) / scenePoints.length)
      : 0;
    const diff = dynamicsAvg - overallAvg;
    const isHighlight = diff > 10;
    const changeLabel = dynamicsAvg === 0
      ? '-'
      : diff > 5
        ? `${dynamicsAvg} (평균 ${overallAvg} 대비 높음)`
        : diff < -5
          ? `${dynamicsAvg} (평균 ${overallAvg} 대비 낮음)`
          : `${dynamicsAvg} (평균 ${overallAvg} 수준)`;

    return {
      sceneId: scene.scene_id,
      timeRange: scene.time_range,
      role,
      roleConfig: rc,
      thumbnailUrl: thumbnails[String(scene.scene_id)] || null,
      scriptTexts,
      claims: matchedClaims,
      dynamicsAvg,
      overallAvg,
      changeLabel,
      isHighlight,
      style: scene.production?.dominant_shot_type,
      colorTone: scene.production?.dominant_color_tone,
    };
  });
}

/* ── 씬 카드 컴포넌트 ─────────────────────── */

/* ── 한줄 평가 생성 (프론트 로직) ─────────────── */

function generateSceneEval(scene: SceneData): string {
  const roleName = scene.roleConfig.label;
  const claimCount = scene.claims.length;
  const dynamics = scene.dynamicsAvg;

  const parts: string[] = [];

  // 역할 설명
  parts.push(`${roleName} 구간`);

  // 소구 밀도
  if (claimCount > 5) parts.push(`소구 ${claimCount}개로 밀도 높음`);
  else if (claimCount > 0) parts.push(`소구 ${claimCount}개`);

  // 변화량 특징
  if (dynamics >= 50) parts.push('시각적으로 역동적');
  else if (dynamics > 0 && dynamics < 30) parts.push(`변화량 ${dynamics}로 시각적 단조로움`);

  return parts.join(', ') + '.';
}

/* ── 소구 유형별 요약 ────────────────────── */

function groupClaimsByType(claims: SceneData['claims']): Record<string, number> {
  return claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
}

function SceneCard({
  scene,
  isActive,
  onTimeClick,
  onPlay,
  llmEval,
}: {
  scene: SceneData;
  isActive: boolean;
  onTimeClick: (start: number, end: number) => void;
  onPlay: (sec: number) => void;
  llmEval?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [claimsOpen, setClaimsOpen] = useState(false);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  const { roleConfig, timeRange } = scene;
  const claimInfo = (type: string) => CLAIM_TYPE_INFO[type] || { label: type, icon: '📌' };
  const claimGroups = useMemo(() => groupClaimsByType(scene.claims), [scene.claims]);
  const sceneEval = llmEval || generateSceneEval(scene);

  return (
    <div
      ref={ref}
      data-scene-id={scene.sceneId}
      className={`bg-white rounded-xl border p-4 transition-all ${
        isActive
          ? 'border-indigo-300 ring-2 ring-indigo-100'
          : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      {/* Header: 역할 태그 + 시간 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${roleConfig.color}15`, color: roleConfig.color }}
          >
            {roleConfig.label}
          </span>
          <button
            onClick={() => onTimeClick(timeRange[0], timeRange[1])}
            className="text-[11px] font-mono text-gray-400 hover:text-indigo-500 transition-colors"
          >
            {formatTime(timeRange[0])}~{formatTime(timeRange[1])}
          </button>
          {scene.isHighlight && (
            <span className="text-[10px] text-amber-500">★</span>
          )}
        </div>
        <button
          onClick={() => onPlay(timeRange[0])}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <Play className="w-3 h-3" />
          재생
        </button>
      </div>

      {/* Body: 썸네일 + 내용 */}
      <div className="flex gap-3">
        {/* 썸네일 */}
        {scene.thumbnailUrl && (
          <button
            onClick={() => onPlay(timeRange[0])}
            className="shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-indigo-200 transition-all"
          >
            <img src={scene.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          </button>
        )}

        {/* 텍스트 내용 */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* 스크립트 */}
          {scene.scriptTexts.length > 0 && (
            <p className="text-sm text-gray-700 leading-relaxed">
              {scene.scriptTexts.join(' ')}
            </p>
          )}

          {/* 💡 한줄 평가 */}
          <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-2.5 py-1.5">
            💡 {sceneEval}
          </p>

          {/* 소구 유형별 개수 + 펼치기 */}
          {scene.claims.length > 0 && (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-gray-400">소구:</span>
                {Object.entries(claimGroups).map(([type, count]) => {
                  const info = claimInfo(type);
                  return (
                    <span key={type} className="text-[11px] text-gray-500">
                      {info.label} {count}건
                    </span>
                  );
                })}
                <button
                  onClick={() => setClaimsOpen(!claimsOpen)}
                  className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-0.5"
                >
                  {claimsOpen ? '접기' : '펼치기'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${claimsOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {claimsOpen && (
                <div className="mt-1.5 space-y-1">
                  {scene.claims.map((c, ci) => {
                    const info = claimInfo(c.type);
                    return (
                      <div key={ci} className="text-xs text-gray-600">
                        <span className="font-medium text-gray-500">
                          {info.icon} {info.label}
                        </span>
                        <span className="mx-1">—</span>
                        <span>{c.claim}</span>
                        {c.strategy && (
                          <span className="ml-1.5 text-[10px] text-gray-400">
                            전략: {c.strategy.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: 변화량 + 한줄 해석 + 스타일 */}
      <div className="mt-3 pt-2 border-t border-gray-50 text-[11px] text-gray-400 space-y-1">
        <div className="flex items-center gap-3">
          {scene.changeLabel !== '-' && (
            <span>
              변화량: <span className={scene.isHighlight ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                {scene.changeLabel}
              </span>
            </span>
          )}
          {(scene.style || scene.colorTone) && (
            <span>
              {[scene.style, scene.colorTone].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        {scene.dynamicsAvg > 0 && (
          <p className={`text-[11px] ${getDynamicsLevel(scene.dynamicsAvg).color}`}>
            → {getDynamicsInterpretation(scene.dynamicsAvg)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── SceneCards 리스트 ─────────────────────── */

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  thumbnails: Record<string, string>;
  activeSceneId: number | null;
  onSceneTimeClick: (start: number, end: number) => void;
}

export default function SceneCards({ data, seekTo, thumbnails, activeSceneId, onSceneTimeClick }: Props) {
  const sceneDataList = useMemo(() => buildSceneDataList(data, thumbnails), [data, thumbnails]);
  const sceneEvals = data.evaluation?.scene_evaluations || {};

  if (sceneDataList.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">씬별 상세</p>
      <div className="space-y-2">
        {sceneDataList.map((scene) => (
          <SceneCard
            key={scene.sceneId}
            scene={scene}
            isActive={activeSceneId === scene.sceneId}
            onTimeClick={onSceneTimeClick}
            onPlay={seekTo}
            llmEval={sceneEvals[String(scene.sceneId)]}
          />
        ))}
      </div>
    </div>
  );
}
