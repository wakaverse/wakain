import type { RecipeJSON } from '../../types/recipe';

interface Props {
  data: RecipeJSON;
}

const STRENGTH_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  strong: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: '강력' },
  moderate: { bg: 'bg-amber-50', text: 'text-amber-700', label: '보통' },
  weak: { bg: 'bg-red-50', text: 'text-red-700', label: '약함' },
};

export default function HookAnalysisCard({ data }: Props) {
  const hook = data.evaluation?.hook_analysis;

  if (!hook) return null;

  const style = STRENGTH_STYLE[hook.strength] || STRENGTH_STYLE.moderate;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">훅 분석</p>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      {/* Reason */}
      <p className="text-base text-gray-700 leading-loose mb-3">{hook.reason}</p>

      {/* Detail items */}
      <div className="space-y-2 mb-3">
        <DetailRow label="제목-훅 정합성" value={hook.title_hook_alignment} />
        <DetailRow label="제품 첫 등장" value={`${hook.product_appear_sec}초`} />
        <DetailRow label="처음 3초 시각 변화량" value={hook.first_3s_energy} />
      </div>

    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}
