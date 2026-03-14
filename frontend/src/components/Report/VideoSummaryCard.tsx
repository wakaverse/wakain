import { useState, useEffect, useMemo } from 'react';
import { Info } from 'lucide-react';
import type { RecipeJSON } from '../../types/recipe';
import { STYLE_LABELS, BLOCK_TYPE_KO, CLAIM_TYPE_INFO, getDynamicsLevel } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  onTabChange?: (tab: string) => void;
}

/* ── 변화량 ⓘ 툴팁 ─────────────────────── */

function DynamicsTooltip({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-gray-600 leading-relaxed">
      <p className="font-semibold text-gray-800 mb-1">시각 변화량 (Visual Dynamics)</p>
      <p className="text-[11px] text-gray-400 mb-2">WakaLab 독자 지표</p>
      <p className="mb-2">
        화면이 얼마나 역동적으로 변하는지를 측정한 수치입니다.
        컷 전환, 움직임, 색감 변화가 클수록 높아집니다.
      </p>
      <div className="space-y-1 mb-2">
        <p><span className="font-medium text-emerald-600">50 이상</span> 역동적 (시선 집중 높음)</p>
        <p><span className="font-medium text-gray-500">30~50</span> 보통</p>
        <p><span className="font-medium text-red-500">30 이하</span> 정적 (이탈 위험 가능)</p>
      </div>
      <p className="text-[10px] text-gray-400">※ 시연/데모 영상은 낮아도 정상일 수 있음</p>
      <button onClick={onClose} className="mt-2 text-indigo-500 hover:text-indigo-700 font-medium">닫기</button>
    </div>
  );
}

/* ── 핵심 수치 카드 ──────────────────────── */

function MetricCard({ label, value, sub, color, children }: {
  label: string;
  value: string;
  sub?: string;
  color: 'green' | 'red' | 'gray';
  children?: React.ReactNode;
}) {
  const colorMap = {
    green: 'bg-emerald-50 border-emerald-200',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200',
  };
  const textMap = {
    green: 'text-emerald-700',
    red: 'text-red-700',
    gray: 'text-gray-700',
  };

  return (
    <div className={`relative flex-1 min-w-[90px] rounded-xl border px-3 py-2 ${colorMap[color]}`}>
      <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">{label}{children}</p>
      <p className={`text-sm font-bold ${textMap[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

/* ── Main ────────────────────────────────── */

export default function VideoSummaryCard({ data, onTabChange }: Props) {
  const { identity, product, meta, visual, summary, evaluation } = data;
  const stylePrimary = visual.style_primary;

  // ── 변화량 ⓘ 툴팁 상태
  const [showDynamicsTooltip, setShowDynamicsTooltip] = useState(false);

  // 첫 방문 시 자동 툴팁
  useEffect(() => {
    const key = 'wakain_dynamics_tooltip_shown';
    if (!localStorage.getItem(key)) {
      setShowDynamicsTooltip(true);
      localStorage.setItem(key, '1');
    }
  }, []);

  // ── 핵심 수치 계산
  const hookStrength = data.engagement?.retention_analysis?.hook_strength || 'unknown';
  const hookLabel = hookStrength === 'strong' ? '강력' : hookStrength === 'medium' || hookStrength === 'moderate' ? '보통' : hookStrength === 'weak' ? '약함' : hookStrength;
  const hookColor = hookStrength === 'strong' ? 'green' as const : hookStrength === 'weak' ? 'red' as const : 'gray' as const;

  const dynamicsAvg = visual.rhythm?.attention_curve?.avg ?? 0;
  const dynamicsInfo = getDynamicsLevel(dynamicsAvg);
  const dynamicsColor = dynamicsAvg >= 50 ? 'green' as const : dynamicsAvg < 30 ? 'red' as const : 'gray' as const;

  // 소구 Top
  const claims = product.claims || [];
  const claimTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of claims) {
      counts[c.type] = (counts[c.type] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [claims]);
  const topClaimType = claimTypeCounts[0];
  const topClaimLabel = topClaimType ? (CLAIM_TYPE_INFO[topClaimType[0]]?.label || topClaimType[0]) : '-';
  const topClaimPct = topClaimType && claims.length > 0 ? Math.round((topClaimType[1] / claims.length) * 100) : 0;

  const blockCount = data.script?.blocks?.length || 0;
  const exposurePct = meta.product_exposure_pct;
  const exposureColor = exposurePct >= 80 ? 'green' as const : exposurePct < 50 ? 'red' as const : 'gray' as const;

  // ── 인물 등장
  const humanPresence = meta.human_presence;
  const humanLabel = humanPresence ? '있음' : '없음 (제품만)';

  // ── 포지셔닝 요약
  const positioning = evaluation?.positioning;
  const positioningSummary = positioning
    ? [positioning.unique_angle, positioning.contrast?.contrarian_reality].filter(Boolean).join(' ')
    : null;

  // ── 제품 구매이유: 유형별 대표 1개
  const purchaseReasons = useMemo(() => {
    if (!claims.length) return [];
    const grouped: Record<string, string> = {};
    for (const c of claims) {
      if (!grouped[c.type]) grouped[c.type] = c.claim;
    }
    return Object.entries(grouped).map(([type, claim]) => ({
      type,
      label: CLAIM_TYPE_INFO[type]?.label || type,
      claim,
    }));
  }, [claims]);

  // ── 구조 흐름 (한국어)
  const flowOrder = data.script?.flow_order || [];
  const structureFlow = flowOrder
    .map((block) => {
      const key = typeof block === 'string' ? block : String(block);
      return BLOCK_TYPE_KO[key] || key;
    })
    .join(' → ');

  // ── 기본 스펙
  const specs = [
    { label: '인물', value: humanLabel },
    { label: '길이', value: `${meta.duration}초` },
    { label: '플랫폼', value: meta.platform },
    { label: '주스타일', value: STYLE_LABELS[stylePrimary] || stylePrimary },
    { label: '컷수', value: `${visual.rhythm.total_cuts}컷` },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">영상 요약</p>

      {/* Identity */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-base font-medium text-gray-900">{product.name}</span>
        {product.brand && (
          <span className="text-sm text-gray-400">{product.brand}</span>
        )}
        {product.category_ko && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
            {product.category_ko}
          </span>
        )}
        {identity.target_audience && (
          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
            {identity.target_audience}
          </span>
        )}
      </div>

      {/* Strategy summary */}
      {summary?.strategy && (
        <p className="text-base text-gray-700 leading-loose mb-3">
          {summary.strategy}
        </p>
      )}

      {/* ── 핵심 수치 카드 5개 */}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        <MetricCard label="훅 강도" value={hookLabel} color={hookColor} />
        <MetricCard label="변화량" value={String(dynamicsAvg)} sub={dynamicsInfo.label} color={dynamicsColor}>
          <button
            onClick={() => setShowDynamicsTooltip(!showDynamicsTooltip)}
            className="text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <Info className="w-3 h-3" />
          </button>
          {showDynamicsTooltip && (
            <DynamicsTooltip onClose={() => setShowDynamicsTooltip(false)} />
          )}
        </MetricCard>
        <MetricCard
          label="소구 Top"
          value={topClaimType ? `${topClaimLabel} ${topClaimPct}%` : '-'}
          color="gray"
        />
        <MetricCard label="블록 수" value={`${blockCount}개`} color="gray" />
        <MetricCard label="노출률" value={`${exposurePct}%`} color={exposureColor} />
      </div>

      {/* Basic specs */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {specs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="text-gray-400">{s.label}</span>
            <span className="font-medium text-gray-700">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── 콘텐츠 포지셔닝 */}
      {positioningSummary && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1">콘텐츠 포지셔닝</p>
          <p className="text-sm text-gray-700 leading-relaxed">{positioningSummary}</p>
        </div>
      )}

      {/* ── 제품을 사야 하는 이유 */}
      {purchaseReasons.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1">제품을 사야 하는 이유</p>
          <div className="space-y-0.5">
            {purchaseReasons.map(({ type, label, claim }) => (
              <p key={type} className="text-sm text-gray-600">
                • {claim} <span className="text-gray-400">({label})</span>
              </p>
            ))}
          </div>
          {evaluation?.core_persuasion && (
            <p className="text-sm text-indigo-600 font-medium mt-1">
              → 핵심 설득: "{evaluation.core_persuasion}"
            </p>
          )}
        </div>
      )}

      {/* ── 구조 흐름 */}
      {structureFlow && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1">구조 흐름</p>
          <p className="text-sm text-gray-600">{structureFlow}</p>
        </div>
      )}

      {/* 핵심 코칭 */}
      {evaluation?.summary && (
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-xs font-medium text-gray-500 mb-1">💡 핵심 코칭</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {evaluation.summary}
          </p>
          {onTabChange && (
            <button
              onClick={() => onTabChange('coaching')}
              className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
            >
              → 코칭 탭에서 상세 확인
            </button>
          )}
        </div>
      )}
    </div>
  );
}
