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

  const maxCount = Math.max(...Object.values(grouped).map((g) => g.length));

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

      {/* Grouped claims with horizontal bars */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([type, items]) => {
          const color = TYPE_COLORS[type] || '#6B7280';
          const label = TYPE_LABELS[type] || type;
          const pct = maxCount > 0 ? (items.length / maxCount) * 100 : 0;

          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium text-gray-700 w-10">{label}</span>
                <div className="flex-1 h-5 bg-gray-50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center px-2"
                    style={{ width: `${Math.max(pct, 12)}%`, backgroundColor: color }}
                  >
                    <span className="text-[10px] font-bold text-white">{items.length}</span>
                  </div>
                </div>
              </div>
              <div className="pl-12 space-y-1.5">
                {items.map((c, i) => (
                  <div key={i}>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {c.claim}
                    </p>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
