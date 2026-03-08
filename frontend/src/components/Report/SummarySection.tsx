import type { RecipeJSON } from '../../types/recipe';
import { formatTime, STYLE_BAR_COLORS, BLOCK_LABELS, BLOCK_HEX } from '../../lib/recipe-utils';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data: RecipeJSON;
}

export default function SummarySection({ data }: Props) {
  const { summary, product, script, visual } = data;
  const duration = data.meta.duration;
  const rhythm = visual.rhythm;

  // Style distribution bar
  const dist = visual.style_distribution;
  const totalStylePct = Object.values(dist).reduce((a, b) => a + b, 0);
  const styleSegments = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([style, pct]) => ({
      label: style,
      pct: totalStylePct > 0 ? (pct / totalStylePct) * 100 : 0,
      color: STYLE_BAR_COLORS[style] || '#71717A',
    }));

  // Energy chart data
  const energyData = rhythm.attention_curve.points.map((p) => ({
    time: p.t,
    score: p.score,
  }));

  return (
    <div className="space-y-4">
      {/* Strategy card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="text-sm text-gray-800 leading-relaxed mb-3">
          {summary.strategy}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600">
            {product.category_ko || product.category}
          </span>
          {visual.style_primary && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-600">
              {visual.style_primary}
            </span>
          )}
          <HookBadge strength={data.engagement.retention_analysis.hook_strength} />
          <span className="text-xs text-gray-400 ml-auto">
            {product.name} · {data.meta.platform} · {duration}초
          </span>
        </div>
      </div>

      {/* Video structure + Style distribution */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Video structure + energy chart */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 mb-2">영상 구조</div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xl font-semibold">{duration}초</span>
            <span className="text-sm text-gray-500">
              {rhythm.total_cuts}컷 · 평균 {rhythm.avg_cut_duration.toFixed(1)}초/컷 · {rhythm.cut_rhythm}
            </span>
          </div>

          {energyData.length > 1 && (
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-gray-400">시각 에너지</span>
                <span className="text-[11px] text-gray-400">
                  평균 {rhythm.attention_curve.avg} · {rhythm.attention_arc}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={energyData}>
                  <defs>
                    <linearGradient id="energyGradSmall" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D9730D" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#D9730D" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                    formatter={(value: unknown) => [`${value}`, '에너지']}
                    labelFormatter={(label: unknown) => formatTime(Number(label))}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#D9730D"
                    fill="url(#energyGradSmall)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Style distribution */}
        {styleSegments.length > 0 && (
          <div className="w-full md:w-72 shrink-0 bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-2">스타일</div>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {styleSegments.map((s) => (
                <div
                  key={s.label}
                  className="h-full"
                  style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                />
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {styleSegments.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-gray-600">{s.label}</span>
                  <span className="text-gray-400">{Math.round(s.pct)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recipe flow order */}
      {script.flow_order.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 mb-2">레시피</div>
          <div className="flex items-center gap-1 flex-wrap">
            {script.flow_order.map((block, i) => (
              <span key={i} className="flex items-center gap-1">
                <FlowTag block={block} />
                {i < script.flow_order.length - 1 && (
                  <span className="text-gray-300 text-[10px]">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HookBadge({ strength }: { strength: string }) {
  const colors: Record<string, string> = {
    strong: 'bg-green-50 text-green-700',
    medium: 'bg-amber-50 text-amber-700',
    weak: 'bg-red-50 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[strength] || colors.medium}`}>
      hook: {strength}
    </span>
  );
}

function FlowTag({ block }: { block: string }) {
  const hex = BLOCK_HEX[block] || '#71717A';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        backgroundColor: `${hex}18`,
        color: hex,
      }}
    >
      {BLOCK_LABELS[block] || block}
    </span>
  );
}
