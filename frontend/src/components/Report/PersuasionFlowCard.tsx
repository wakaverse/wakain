import type { RecipeJSON } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
}

const RISK_COLORS: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
};

const RISK_LABELS: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
};

const BENEFIT_SUB_LABELS: Record<string, string> = {
  functional: '기능적',
  emotional: '감성적',
};

export default function PersuasionFlowCard({ data, seekTo }: Props) {
  const { blocks, flow_order } = data.script;
  const duration = data.meta.duration;

  if (!blocks.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">설득 흐름</p>

      {/* Color bar (no text, colors only) */}
      {flow_order?.length > 0 && duration > 0 && (
        <div className="mb-2">
          <div className="flex h-5 rounded-lg overflow-hidden">
            {blocks.map((block, i) => {
              const blockDur = block.time_range[1] - block.time_range[0];
              const pct = (blockDur / duration) * 100;
              const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
              return (
                <button
                  key={i}
                  className="h-full cursor-pointer hover:brightness-110 transition-all"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: color,
                  }}
                  onClick={() => seekTo(block.time_range[0])}
                  title={`${BLOCK_LABELS[block.block] || block.block} ${formatTime(block.time_range[0])}–${formatTime(block.time_range[1])}`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {[...new Set(blocks.map((b) => b.block))].map((type) => (
              <span key={type} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: BLOCK_EVAL_COLORS[type] || '#6B7280' }}
                />
                {BLOCK_LABELS[type] || type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Block detail cards */}
      <div className="space-y-2 mt-4">
        {blocks.map((block, i) => {
          const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
          const riskColor = RISK_COLORS[block.dropoff_risk || 'low'] || '#10B981';

          return (
            <div
              key={i}
              className="rounded-xl border border-gray-100 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderLeft: `3px solid ${color}` }}
              onClick={() => seekTo(block.time_range[0])}
            >
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${color}18`, color }}
                >
                  {BLOCK_LABELS[block.block] || block.block}
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  {formatTime(block.time_range[0])}–{formatTime(block.time_range[1])}
                </span>
                {block.dropoff_risk && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${riskColor}18`, color: riskColor }}
                  >
                    이탈 {RISK_LABELS[block.dropoff_risk] || block.dropoff_risk}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-700 leading-relaxed">{block.text}</p>

              {/* Product claim ref */}
              {block.product_claim_ref && (
                <p className="text-xs text-blue-600 mt-1">
                  📦 소구: {block.product_claim_ref}
                </p>
              )}

              {/* Benefit sub */}
              {block.benefit_sub && (
                <p className="text-xs text-gray-500 mt-0.5">
                  유형: {BENEFIT_SUB_LABELS[block.benefit_sub] || block.benefit_sub}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
