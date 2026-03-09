import type { RecipeJSON, ChecklistItem } from '../../types/recipe';
import { CheckCircle2, XCircle, Lightbulb, TrendingUp } from 'lucide-react';

interface Props {
  data: RecipeJSON;
}

const CATEGORY_ORDER = ['hook', 'body', 'cta', 'overall'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  hook: 'Hook',
  body: 'Body',
  cta: 'CTA',
  overall: '전체',
};

export default function EvaluationSection({ data }: Props) {
  const evaluation = data.evaluation;
  if (!evaluation) return null;

  // Group checklist by category
  const grouped = new Map<string, ChecklistItem[]>();
  for (const item of evaluation.checklist) {
    const list = grouped.get(item.category) || [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const passedCount = evaluation.checklist.filter((c) => c.passed).length;
  const totalCount = evaluation.checklist.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-base font-semibold text-gray-900 leading-relaxed">
          {evaluation.summary}
        </p>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">체크리스트</p>
          <span className="text-xs text-gray-400">
            {passedCount}/{totalCount} 충족
          </span>
        </div>
        <div className="space-y-4">
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
                        <span className="text-sm text-gray-800">{item.item}</span>
                        <p className="text-xs text-gray-400 mt-0.5">{item.evidence}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        {evaluation.strengths.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-sm font-semibold text-gray-900">강점</p>
            </div>
            <div className="space-y-3">
              {evaluation.strengths.map((s, i) => (
                <div key={i}>
                  <p className="text-sm text-gray-800">{s.fact}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvements */}
        {evaluation.improvements.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold text-gray-900">개선 포인트</p>
            </div>
            <div className="space-y-3">
              {evaluation.improvements.map((imp, i) => (
                <div key={i}>
                  <p className="text-sm text-gray-800">{imp.fact}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{imp.comment}</p>
                  <p className="text-xs text-blue-600 mt-1">💡 {imp.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
