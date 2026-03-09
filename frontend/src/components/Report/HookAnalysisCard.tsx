import { useState } from 'react';
import { ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import type { RecipeJSON, ChecklistItem } from '../../types/recipe';

interface Props {
  data: RecipeJSON;
}

const STRENGTH_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  strong: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: '강력' },
  moderate: { bg: 'bg-amber-50', text: 'text-amber-700', label: '보통' },
  weak: { bg: 'bg-red-50', text: 'text-red-700', label: '약함' },
};

const CATEGORY_ORDER = ['hook', 'body', 'cta', 'overall'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  hook: 'Hook',
  body: 'Body',
  cta: 'CTA',
  overall: '전체',
};

export default function HookAnalysisCard({ data }: Props) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const hook = data.evaluation?.hook_analysis;
  const checklist = data.evaluation?.checklist;

  if (!hook) return null;

  const style = STRENGTH_STYLE[hook.strength] || STRENGTH_STYLE.moderate;

  // Group checklist by category
  const grouped = new Map<string, ChecklistItem[]>();
  if (checklist) {
    for (const item of checklist) {
      const list = grouped.get(item.category) || [];
      list.push(item);
      grouped.set(item.category, list);
    }
  }
  const passedCount = checklist?.filter((c) => c.passed).length ?? 0;
  const totalCount = checklist?.length ?? 0;

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
        <DetailRow label="처음 3초 에너지" value={hook.first_3s_energy} />
      </div>

      {/* Checklist accordion */}
      {checklist && checklist.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setChecklistOpen(!checklistOpen)}
          >
            <span className="text-sm font-medium text-gray-700">체크리스트</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {passedCount}/{totalCount} 충족
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${checklistOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {checklistOpen && (
            <div className="mt-3 space-y-4">
              {CATEGORY_ORDER.map((cat) => {
                const items = grouped.get(cat);
                if (!items?.length) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {CATEGORY_LABELS[cat] || cat}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          {item.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-base text-gray-800 leading-loose">{item.item}</span>
                            <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{item.evidence}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
