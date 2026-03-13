import { useState, useEffect } from 'react';
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getGradeBadge(score: number): { label: string; emoji: string; cls: string } {
  if (score <= 30) return { label: '낮음', emoji: '\u{1F535}', cls: 'bg-blue-50 text-blue-700' };
  if (score <= 60) return { label: '보통', emoji: '\u{1F7E1}', cls: 'bg-yellow-50 text-yellow-700' };
  return { label: '높음', emoji: '\u{1F534}', cls: 'bg-red-50 text-red-700' };
}

interface Props {
  data: RecipeJSON;
}

export default function AttentionCurveSection({ data }: Props) {
  const rhythm = data.visual.rhythm;
  const { dropoff_analysis } = data.engagement;
  const [globalAvg, setGlobalAvg] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/stats/dynamics-avg`)
      .then((r) => r.json())
      .then((d) => {
        if (d.global_avg > 0) setGlobalAvg(d.global_avg);
      })
      .catch(() => {});
  }, []);

  if (!rhythm?.attention_curve?.points?.length) return null;

  const chartData = rhythm.attention_curve.points.map((p) => ({
    time: p.t,
    score: p.score,
  }));

  const avg = rhythm.attention_curve.avg;
  const badge = getGradeBadge(avg);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">시각 변화량</p>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.emoji} {badge.label}
          </span>
        </div>
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
            formatter={(value: unknown) => [`${value}`, '변화량']}
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
          {/* This video average line */}
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
          {/* Global average line */}
          {globalAvg !== null && (
            <ReferenceLine
              y={globalAvg}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              label={{
                value: `전체 평균 ${globalAvg}`,
                position: 'right',
                fontSize: 10,
                fill: '#f59e0b',
              }}
            />
          )}
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
          평균 변화량
        </span>
        {globalAvg !== null && (
          <span className="flex items-center gap-1.5">
            <span className="w-6 border-t border-dashed border-amber-400" />
            전체 평균
          </span>
        )}
      </div>
    </div>
  );
}
