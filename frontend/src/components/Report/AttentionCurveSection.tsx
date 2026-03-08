import type { RecipeJSON } from '../../types/recipe';
import { formatTime } from '../../lib/recipe-utils';
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
}

export default function AttentionCurveSection({ data }: Props) {
  const rhythm = data.visual.rhythm;
  const { dropoff_analysis } = data.engagement;

  if (!rhythm?.attention_curve?.points?.length) return null;

  const chartData = rhythm.attention_curve.points.map((p) => ({
    time: p.t,
    score: p.score,
  }));

  const avg = rhythm.attention_curve.avg;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-900">어텐션 커브</p>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>평균 {avg}</span>
          <span>아크: {rhythm.attention_arc}</span>
          <span>피크: {rhythm.attention_curve.peak_timestamps.map((t) => formatTime(t)).join(', ')}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="attentionGrad" x1="0" y1="0" x2="0" y2="1">
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
            formatter={(value: unknown) => [`${value}`, '어텐션']}
            labelFormatter={(label: unknown) => formatTime(Number(label))}
          />
          {/* Risk zones */}
          {dropoff_analysis.risk_zones.map((zone, i) => (
            <ReferenceArea
              key={`risk-${i}`}
              x1={zone.time_range[0]}
              x2={zone.time_range[1]}
              fill={zone.risk_level === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)'}
              fillOpacity={1}
            />
          ))}
          {/* Average line */}
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
            fill="url(#attentionGrad)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: '#6366f1',
              stroke: '#fff',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-red-100 border border-red-200" />
          이탈 위험 구간
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t border-dashed border-gray-400" />
          평균 어텐션
        </span>
      </div>
    </div>
  );
}
