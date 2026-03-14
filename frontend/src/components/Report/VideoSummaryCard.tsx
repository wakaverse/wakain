import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { Info } from 'lucide-react';
import type { RecipeJSON } from '../../types/recipe';
import { STYLE_LABELS, BLOCK_TYPE_KO, CLAIM_TYPE_INFO, getDynamicsLevel } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  onTabChange?: (tab: string) => void;
}

/* ── ⓘ 툴팁 (바깥 클릭 시 닫힘) ─────────── */

interface TooltipDef {
  title: string;
  subtitle?: string;
  description: string;
  ranges?: { label: string; color: string; text: string }[];
  note?: string;
}

const METRIC_TOOLTIPS: Record<string, TooltipDef> = {
  hook: {
    title: '훅 강도 (Hook Strength)',
    subtitle: 'WakaLab 독자 지표',
    description: '첫 3초 안에 시청자를 붙잡는 힘입니다. 강력한 훅은 스크롤을 멈추게 합니다.',
    ranges: [
      { label: '강력', color: 'text-emerald-600', text: '시청자 이탈률 낮음' },
      { label: '보통', color: 'text-gray-500', text: '평균 수준' },
      { label: '약함', color: 'text-red-500', text: '초반 이탈 위험' },
    ],
    note: '※ 제품 특성에 따라 부드러운 도입이 효과적일 수 있음',
  },
  dynamics: {
    title: '시각 변화량 (Visual Dynamics)',
    subtitle: 'WakaLab 독자 지표',
    description: '화면이 얼마나 역동적으로 변하는지를 측정한 수치입니다. 컷 전환, 움직임, 색감 변화가 클수록 높아집니다.',
    ranges: [
      { label: '50 이상', color: 'text-emerald-600', text: '역동적 (시선 집중 높음)' },
      { label: '30~50', color: 'text-gray-500', text: '보통' },
      { label: '30 이하', color: 'text-red-500', text: '정적 (이탈 위험 가능)' },
    ],
    note: '※ 시연/데모 영상은 낮아도 정상일 수 있음',
  },
  claims: {
    title: '소구 분포 (Claim Distribution)',
    subtitle: 'WakaLab 독자 지표',
    description: '영상에서 사용된 설득 전략의 유형별 비율입니다. 다양한 소구를 균형 있게 사용할수록 설득력이 높아집니다.',
    ranges: [
      { label: '가격/가치', color: 'text-emerald-600', text: '가격, 양, 혜택 관련' },
      { label: '체험/후기', color: 'text-blue-600', text: '사용 경험, 감각 전달' },
      { label: '기능/효과', color: 'text-orange-600', text: '제품 성능, 효능' },
    ],
  },
  blocks: {
    title: '블록 수 (Block Count)',
    subtitle: 'WakaLab 독자 지표',
    description: '영상의 구조적 단위(블록) 수입니다. 각 블록은 훅, 장점, 시연, 행동유도 등 하나의 역할을 합니다.',
    ranges: [
      { label: '5개 이하', color: 'text-emerald-600', text: '간결한 구조' },
      { label: '5~8개', color: 'text-gray-500', text: '적정 (숏폼 평균)' },
      { label: '8개 이상', color: 'text-red-500', text: '복잡 (집중력 분산 가능)' },
    ],
  },
  exposure: {
    title: '제품 노출률 (Exposure Rate)',
    subtitle: 'WakaLab 독자 지표',
    description: '전체 영상에서 제품이 화면에 노출된 시간의 비율입니다.',
    ranges: [
      { label: '70% 이상', color: 'text-emerald-600', text: '높은 노출 (커머스 적합)' },
      { label: '40~70%', color: 'text-gray-500', text: '보통' },
      { label: '40% 미만', color: 'text-red-500', text: '낮은 노출 (인지도 약화 가능)' },
    ],
    note: '※ 스토리텔링형 영상은 낮아도 효과적일 수 있음',
  },
};

function MetricTooltip({ def, onClose }: { def: TooltipDef; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-gray-600 leading-relaxed">
      <p className="font-semibold text-gray-800 mb-1">{def.title}</p>
      {def.subtitle && <p className="text-[11px] text-gray-400 mb-2">{def.subtitle}</p>}
      <p className="mb-2">{def.description}</p>
      {def.ranges && (
        <div className="space-y-1 mb-2">
          {def.ranges.map((r) => (
            <p key={r.label}><span className={`font-medium ${r.color}`}>{r.label}</span> {r.text}</p>
          ))}
        </div>
      )}
      {def.note && <p className="text-[10px] text-gray-400">{def.note}</p>}
    </div>
  );
}

/* ── 핵심 수치 카드 ──────────────────────── */

function MetricCard({ label, value, sub, color, tooltipKey, activeTooltip, onTooltipToggle }: {
  label: string;
  value: string;
  sub?: string;
  color: 'green' | 'red' | 'gray';
  tooltipKey: string;
  activeTooltip: string | null;
  onTooltipToggle: (key: string) => void;
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
  const def = METRIC_TOOLTIPS[tooltipKey];

  return (
    <div className={`relative flex-1 min-w-[90px] rounded-xl border px-3 py-2 ${colorMap[color]}`}>
      <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
        {label}
        {def && (
          <button
            onClick={() => onTooltipToggle(tooltipKey)}
            className="text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <Info className="w-3 h-3" />
          </button>
        )}
      </p>
      <p className={`text-sm font-bold ${textMap[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      {activeTooltip === tooltipKey && def && (
        <MetricTooltip def={def} onClose={() => onTooltipToggle('')} />
      )}
    </div>
  );
}

/* ── Main ────────────────────────────────── */

export default function VideoSummaryCard({ data, onTabChange }: Props) {
  const { identity, product, meta, visual, evaluation } = data;
  const stylePrimary = visual.style_primary;

  // ── ⓘ 툴팁 상태 (한 번에 하나만)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const handleTooltipToggle = useCallback((key: string) => {
    setActiveTooltip(prev => prev === key ? null : key);
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

  // ── 제품 구매이유: claim_groups 우선, 없으면 유형별 대표
  const purchaseReasons = useMemo(() => {
    // P7.5 그룹핑 결과가 있으면 우선 사용
    if (product.purchase_reasons?.length) {
      return product.purchase_reasons.map((reason, i) => {
        const rawType = product.claim_groups?.[i]?.type || '';
        return {
          type: rawType,
          label: CLAIM_TYPE_INFO[rawType]?.label || '',
          claim: reason,
        };
      });
    }
    // Fallback: 유형별 대표
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
  }, [claims, product]);

  // ── 구조 흐름 (한국어) — flow_order 또는 blocks에서 추출
  const flowOrder = data.script?.flow_order || [];
  const blockRoles = flowOrder.length > 0
    ? flowOrder
    : (data.script?.blocks || []).map((b) => b.block || '').filter(Boolean);
  const structureFlowItems = blockRoles
    .map((block: string) => BLOCK_TYPE_KO[block] || block);

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

      {/* ── 핵심 수치 카드 5개 */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <MetricCard label="훅 강도" value={hookLabel} color={hookColor} tooltipKey="hook" activeTooltip={activeTooltip} onTooltipToggle={handleTooltipToggle} />
        <MetricCard label="변화량" value={String(dynamicsAvg)} sub={dynamicsInfo.label} color={dynamicsColor} tooltipKey="dynamics" activeTooltip={activeTooltip} onTooltipToggle={handleTooltipToggle} />
        <MetricCard
          label="소구 분포"
          value={claimTypeCounts.length > 0
            ? (() => {
                const top = claimTypeCounts.slice(0, 3).map(([t, c]) => `${CLAIM_TYPE_INFO[t]?.label || t} ${Math.round((c / claims.length) * 100)}%`);
                const rest = claimTypeCounts.length - 3;
                return rest > 0 ? `${top.join(' / ')} 외 ${rest}개` : top.join(' / ');
              })()
            : '-'}
          color="gray"
          tooltipKey="claims" activeTooltip={activeTooltip} onTooltipToggle={handleTooltipToggle}
        />
        <MetricCard label="블록 수" value={`${blockCount}개`} color="gray" tooltipKey="blocks" activeTooltip={activeTooltip} onTooltipToggle={handleTooltipToggle} />
        <MetricCard label="노출률" value={`${exposurePct}%`} color={exposureColor} tooltipKey="exposure" activeTooltip={activeTooltip} onTooltipToggle={handleTooltipToggle} />
      </div>

      {/* Basic specs */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {specs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">{s.label}</span>
            <span className="text-sm font-medium text-gray-700">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── 콘텐츠 포지셔닝 */}
      {positioningSummary && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-700 mb-1.5 pb-1 border-b border-gray-100">📌 콘텐츠 포지셔닝</p>
          <p className="text-sm text-gray-700 leading-relaxed">{positioningSummary}</p>
        </div>
      )}

      {/* ── 제품을 사야 하는 이유 */}
      {purchaseReasons.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-700 mb-1.5 pb-1 border-b border-gray-100">🛒 제품을 사야 하는 이유</p>
          <div className="space-y-0.5">
            {purchaseReasons.map(({ type, label, claim }) => (
              <p key={type} className="text-sm text-gray-600 leading-relaxed">
                • {claim}{label && <span className="text-gray-400"> ({label})</span>}
              </p>
            ))}
          </div>
          {(product.core_selling_point || evaluation?.core_persuasion) && (
            <p className="text-sm text-indigo-600 font-medium mt-1">
              → 핵심 설득: "{product.core_selling_point || evaluation?.core_persuasion}"
            </p>
          )}
        </div>
      )}

      {/* ── 구조 흐름 */}
      {structureFlowItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-700 mb-1.5 pb-1 border-b border-gray-100">🔗 구조 흐름</p>
          <div className="flex flex-wrap items-center gap-y-1 text-sm text-gray-600">
            {structureFlowItems.map((item, i) => (
              <span key={i} className="flex items-center">
                {i > 0 && <span className="mx-1 text-gray-300">→</span>}
                <span>{item}</span>
              </span>
            ))}
          </div>
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
