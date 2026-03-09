import type { RecipeJSON } from '../../types/recipe';
import { STYLE_LABELS } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
}

export default function VideoSummaryCard({ data }: Props) {
  const { identity, product, meta, visual, evaluation } = data;
  const stylePrimary = visual.style_primary;

  const specs = [
    { label: '길이', value: `${meta.duration}초` },
    { label: '플랫폼', value: meta.platform },
    { label: '주스타일', value: STYLE_LABELS[stylePrimary] || stylePrimary },
    { label: '컷수', value: `${visual.rhythm.total_cuts}컷` },
    { label: '제품노출률', value: `${meta.product_exposure_pct}%` },
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
      {evaluation?.summary && (
        <p className="text-base text-gray-700 leading-loose mb-3">
          {evaluation.summary}
        </p>
      )}

      {/* Basic specs */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {specs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="text-gray-400">{s.label}</span>
            <span className="font-medium text-gray-700">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
