import { useState } from 'react';
import type { RecipeJSON, SegmentEval } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS, ENERGY_LABELS, labelKo } from '../../lib/recipe-utils';
import { TrendingUp, Lightbulb, ChevronDown } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
}

const SEGMENT_LABELS: Record<string, string> = {
  hook: 'Hook',
  body: 'Body',
  cta: 'CTA',
};

export default function StructureSection({ data, seekTo }: Props) {
  const rhythm = data.visual.rhythm;
  const { dropoff_analysis } = data.engagement;
  const duration = data.meta.duration;
  const evaluation = data.evaluation;

  const hasChart = rhythm?.attention_curve?.points?.length > 0;

  const chartData = hasChart
    ? rhythm.attention_curve.points.map((p) => ({ time: p.t, score: p.score }))
    : [];
  const avg = rhythm?.attention_curve?.avg ?? 0;

  // Block bar segments from script.blocks
  const blocks = data.script.blocks;

  return (
    <div className="space-y-6">
      {/* Dynamics graph + block bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">영상 구조</p>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span>{duration}초</span>
            <span>{rhythm.total_cuts}컷</span>
            {rhythm.attention_arc && (
              <span>{labelKo(rhythm.attention_arc, ENERGY_LABELS)}</span>
            )}
          </div>
        </div>

        {/* Dynamics curve chart */}
        {hasChart && (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="structureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={(v: number) => formatTime(v)}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
                formatter={(value: unknown) => [`${value}`, '변화량']}
                labelFormatter={(label: unknown) => formatTime(Number(label))}
              />
              {dropoff_analysis.risk_zones.map((zone, i) => (
                <ReferenceArea
                  key={`risk-${i}`}
                  x1={zone.time_range[0]}
                  x2={zone.time_range[1]}
                  fill={zone.risk_level === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)'}
                  fillOpacity={1}
                />
              ))}
              <ReferenceLine
                y={avg}
                stroke="#d1d5db"
                strokeDasharray="4 4"
                label={{
                  value: `avg ${avg}`,
                  position: 'right',
                  fontSize: 10,
                  fill: '#9ca3af',
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                fill="url(#structureGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Block color bar */}
        {blocks.length > 0 && duration > 0 && (
          <div className="mt-3">
            <div className="flex h-6 rounded-lg overflow-hidden">
              {blocks.map((block, i) => {
                const blockDur = block.time_range[1] - block.time_range[0];
                const pct = (blockDur / duration) * 100;
                const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
                return (
                  <button
                    key={i}
                    className="h-full flex items-center justify-center text-white text-[9px] font-medium cursor-pointer hover:brightness-110 transition-all"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: color,
                    }}
                    onClick={() => seekTo(block.time_range[0])}
                    title={`${BLOCK_LABELS[block.block] || block.block} ${formatTime(block.time_range[0])}–${formatTime(block.time_range[1])}`}
                  >
                    {pct > 8 ? (BLOCK_LABELS[block.block] || block.block) : ''}
                  </button>
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
              <span className="flex items-center gap-1 text-[10px] text-gray-400 ml-auto">
                <span className="w-3 h-2 rounded-sm bg-red-100 border border-red-200" />
                이탈 위험
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hook / Body / CTA segment coaching */}
      {evaluation?.structure && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['hook', 'body', 'cta'] as const).map((seg) => {
            const segEval: SegmentEval = evaluation.structure[seg];
            if (!segEval) return null;
            return (
              <SegmentCard
                key={seg}
                label={SEGMENT_LABELS[seg]}
                segment={segEval}
                seekTo={seekTo}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SegmentCard({ label, segment, seekTo }: {
  label: string;
  segment: SegmentEval;
  seekTo: (sec: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasContent = segment.strengths.length > 0 || segment.improvements.length > 0;
  if (!hasContent) return null;

  const strengthCount = segment.strengths.length;
  const improvementCount = segment.improvements.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Accordion header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <span
            className="text-[10px] text-gray-400 font-mono cursor-pointer hover:text-gray-600"
            onClick={(e) => { e.stopPropagation(); seekTo(segment.time_range[0]); }}
          >
            {formatTime(segment.time_range[0])}–{formatTime(segment.time_range[1])}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {strengthCount > 0 && (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              강점 {strengthCount}
            </span>
          )}
          {improvementCount > 0 && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
              개선 {improvementCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Accordion body */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Block types */}
          {segment.block_types.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {segment.block_types.map((bt, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${BLOCK_EVAL_COLORS[bt] || '#6B7280'}18`,
                    color: BLOCK_EVAL_COLORS[bt] || '#6B7280',
                  }}
                >
                  {BLOCK_LABELS[bt] || bt}
                </span>
              ))}
            </div>
          )}

          {/* Strengths */}
          {segment.strengths.length > 0 && (
            <div className="space-y-1.5">
              {segment.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <TrendingUp className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{s.comment}</p>
                </div>
              ))}
            </div>
          )}

          {/* Improvements */}
          {segment.improvements.length > 0 && (
            <div className="space-y-1.5">
              {segment.improvements.map((imp, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Lightbulb className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700 leading-relaxed">{imp.comment}</p>
                    <p className="text-xs text-blue-600 mt-0.5">{imp.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
