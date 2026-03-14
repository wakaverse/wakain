import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RecipeJSON } from '../../types/recipe';

interface Props {
  data: RecipeJSON;
}

const TYPE_LABELS: Record<string, string> = {
  function: '기능',
  experience: '경험',
  composition: '구성',
  trust: '신뢰',
  value: '가치',
};

const TYPE_COLORS: Record<string, string> = {
  function: '#3B82F6',
  experience: '#10B981',
  composition: '#8B5CF6',
  trust: '#F59E0B',
  value: '#EC4899',
};

const STRATEGY_LABELS: Record<string, string> = {
  experience_shift: '경험 전환',
  loss_aversion: '손실 회피',
  info_preempt: '정보 선점',
  social_evidence: '사회적 증거',
  price_anchor: '가격 앵커링',
};

export default function ProductClaimsCard({ data }: Props) {
  const claims = data.product.claims;
  const { product_exposure_pct, product_first_appear } = data.meta;

  if (!claims?.length) return null;

  // Group by type
  const grouped = claims.reduce<Record<string, typeof claims>>((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {});

  const total = claims.length;

  // Sort by count descending
  const sortedTypes = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

  // One-line interpretation
  const topType = sortedTypes[0];
  const topLabel = TYPE_LABELS[topType[0]] || topType[0];
  const topPct = Math.round((topType[1].length / total) * 100);
  const topCount = topType[1].length;
  const weakTypes = sortedTypes
    .filter(([, items]) => items.length <= 1)
    .map(([type]) => TYPE_LABELS[type] || type);
  const interpretation = `${topLabel} 소구 ${topPct}% (${topCount}건) — ${topLabel} 중심 구성.${
    weakTypes.length > 0 ? ` ${weakTypes.join('/')} 소구는 상대적으로 부족.` : ''
  }`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">제품 소구 분석</p>

      {/* Exposure stats */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">제품 노출률</span>
          <span className="font-medium text-gray-700">{product_exposure_pct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">제품 첫 등장</span>
          <span className="font-medium text-gray-700">{product_first_appear}초</span>
        </div>
      </div>

      {/* Ratio chart — horizontal bars */}
      <div className="space-y-2 mb-3">
        {sortedTypes.map(([type, items]) => {
          const color = TYPE_COLORS[type] || '#6B7280';
          const label = TYPE_LABELS[type] || type;
          const pct = Math.round((items.length / total) * 100);
          return (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 w-8 text-right">{label}</span>
              <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end px-2"
                  style={{ width: `${Math.max(pct, 12)}%`, backgroundColor: color }}
                >
                  <span className="text-[10px] font-bold text-white">{pct}%</span>
                </div>
              </div>
              <span className="text-[11px] text-gray-400 w-6">{items.length}건</span>
            </div>
          );
        })}
      </div>

      {/* One-line interpretation */}
      <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-4 leading-relaxed">
        {interpretation}
      </p>

      {/* 대표 소구 — claim_groups 우선 */}
      <div className="mb-4 space-y-1">
        <p className="text-xs font-medium text-gray-500 mb-1.5">대표 소구:</p>
        {data.product.claim_groups?.length ? (
          data.product.claim_groups.map((g) => (
            <div key={g.group_id} className="flex items-start gap-1.5 text-sm text-gray-600">
              <span className="shrink-0">•</span>
              <span>
                <span className="font-medium text-gray-700">{TYPE_LABELS[g.type] || g.type}</span>
                <span className="mx-1">—</span>
                "{g.core_message}"
                <span className="text-xs text-gray-400 ml-1">({g.mention_count}회)</span>
              </span>
            </div>
          ))
        ) : (
          sortedTypes.map(([type, items]) => {
            const label = TYPE_LABELS[type] || type;
            const representative = items[0];
            return (
              <div key={type} className="flex items-start gap-1.5 text-sm text-gray-600">
                <span className="shrink-0">•</span>
                <span>
                  <span className="font-medium text-gray-700">{label}</span>
                  <span className="mx-1">—</span>
                  "{representative.claim}"
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Grouped claims — 접기 */}
      <ClaimDetailToggle sortedTypes={sortedTypes} />
    </div>
  );
}

function ClaimDetailToggle({ sortedTypes }: { sortedTypes: [string, Array<{ claim: string; translation?: string; strategy?: string }>][] }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{open ? '전체 소구 상세 접기 ▲' : '전체 소구 상세 보기 ▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sortedTypes.map(([type, items]) => (
            <ClaimGroup key={type} type={type} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClaimGroup({ type, items }: { type: string; items: Array<{ claim: string; translation?: string; strategy?: string }> }) {
  const [open, setOpen] = useState(true);
  const color = TYPE_COLORS[type] || '#6B7280';
  const label = TYPE_LABELS[type] || type;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-xs text-gray-400">{items.length}건</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {items.map((c, i) => (
            <div key={i}>
              <p className="text-sm text-gray-600 leading-relaxed">{c.claim}</p>
              {c.translation && (
                <div className="flex items-start gap-1.5 mt-0.5 ml-2">
                  <span className="text-xs text-gray-400 shrink-0">→</span>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.translation}</p>
                  {c.strategy && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                      {STRATEGY_LABELS[c.strategy] || c.strategy}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
