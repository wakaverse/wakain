import { useState } from 'react';
import { ChevronDown, TrendingUp } from 'lucide-react';
import type { RecipeJSON, SegmentEval } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS, BLOCK_TYPE_KO, translateFieldNames } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
}

const SEGMENT_LABELS: Record<string, string> = {
  hook: 'Hook',
  body: 'Body',
  cta: 'CTA',
};

export default function CoachingCard({ data }: Props) {
  const evaluation = data.evaluation;
  if (!evaluation) return null;

  const { strengths, improvements, recipe_eval, structure } = evaluation;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-4">코칭</p>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">✅ 잘 된 점</p>
          <div className="space-y-2">
            {strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-base text-gray-800 leading-loose">{translateFieldNames(s.fact)}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{translateFieldNames(s.comment)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvements — 배경색 카드 */}
      {improvements.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">🔧 핵심 개선 포인트</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
            {improvements.map((imp, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-gray-800">
                  {i + 1}. {translateFieldNames(imp.fact)}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{translateFieldNames(imp.comment)}</p>
                <p className="text-sm text-blue-700 mt-0.5 leading-relaxed">{translateFieldNames(imp.suggestion)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recipe eval — 구조 개선안 */}
      {recipe_eval && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">📐 구조 개선안</p>

          {/* ❌ 현재 구조 — 연한 빨강 */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
            <p className="text-[10px] text-red-500 mb-1">❌ 현재 구조</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {recipe_eval.current.map((block, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${BLOCK_EVAL_COLORS[block] || '#6B7280'}18`,
                      color: BLOCK_EVAL_COLORS[block] || '#6B7280',
                    }}
                  >
                    {BLOCK_TYPE_KO[block] || BLOCK_LABELS[block] || block}
                  </span>
                  {i < recipe_eval.current.length - 1 && (
                    <span className="text-gray-300 text-xs">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* ✅ 개선안 — 연한 초록 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-[10px] text-emerald-600 mb-1">✅ 개선안</p>
            <p className="text-sm text-emerald-800 leading-relaxed">{translateFieldNames(recipe_eval.suggestion)}</p>
            <p className="text-xs text-emerald-600 mt-1">{translateFieldNames(recipe_eval.reason)}</p>
          </div>
        </div>
      )}

      {/* Structure segment coaching (accordion, default collapsed) */}
      {structure && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-500 mb-1">구간별 코칭</p>
          {(['hook', 'body', 'cta'] as const).map((seg) => {
            const segEval = structure[seg];
            if (!segEval) return null;
            return (
              <SegmentAccordion
                key={seg}
                label={SEGMENT_LABELS[seg]}
                segment={segEval}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SegmentAccordion({ label, segment }: {
  label: string;
  segment: SegmentEval;
}) {
  const [open, setOpen] = useState(true);
  const hasContent = segment.strengths.length > 0 || segment.improvements.length > 0;
  if (!hasContent) return null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className="text-[10px] font-mono text-gray-400">
            {formatTime(segment.time_range[0])}–{formatTime(segment.time_range[1])}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {segment.block_types.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {segment.block_types.map((bt, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${BLOCK_EVAL_COLORS[bt] || '#6B7280'}15`,
                    color: BLOCK_EVAL_COLORS[bt] || '#6B7280',
                  }}
                >
                  {BLOCK_TYPE_KO[bt] || BLOCK_LABELS[bt] || bt}
                </span>
              ))}
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {segment.strengths.map((s, i) => (
            <div key={`s-${i}`} className="flex items-start gap-1.5">
              <TrendingUp className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-700 leading-relaxed">{translateFieldNames(s.comment)}</p>
            </div>
          ))}
          {segment.improvements.map((imp, i) => (
            <div key={`i-${i}`} className="bg-amber-50 rounded-lg px-2.5 py-2">
              <p className="text-sm font-medium text-gray-700">{translateFieldNames(imp.comment)}</p>
              <p className="text-xs text-blue-600 mt-0.5">{translateFieldNames(imp.suggestion)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
