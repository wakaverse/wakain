import type { RecipeJSON } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS } from '../../lib/recipe-utils';
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

export default function TimelineCard({ data }: Props) {
  const rhythm = data.visual.rhythm;
  const { dropoff_analysis } = data.engagement;
  const blocks = data.script.blocks;
  const scenes = data.visual.scenes;

  const hasChart = rhythm?.attention_curve?.points?.length > 0;
  if (!hasChart) return null;

  const chartData = rhythm.attention_curve.points.map((p) => ({
    time: p.t,
    score: p.score,
  }));
  const avg = rhythm.attention_curve.avg ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">타임라인</p>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
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
            formatter={(value: unknown) => [`${value}`, '에너지']}
            labelFormatter={(label: unknown) => formatTime(Number(label))}
          />

          {/* Layer 2: Block color bands */}
          {blocks.map((block, i) => {
            const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
            return (
              <ReferenceArea
                key={`block-${i}`}
                x1={block.time_range[0]}
                x2={block.time_range[1]}
                fill={color}
                fillOpacity={0.08}
              />
            );
          })}

          {/* Layer 3: Dropoff risk zones */}
          {dropoff_analysis.risk_zones.map((zone, i) => (
            <ReferenceArea
              key={`risk-${i}`}
              x1={zone.time_range[0]}
              x2={zone.time_range[1]}
              fill={zone.risk_level === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.08)'}
              fillOpacity={1}
            />
          ))}

          {/* Layer 4: Scene boundary dotted lines */}
          {scenes.map((scene) => (
            <ReferenceLine
              key={`scene-${scene.scene_id}`}
              x={scene.time_range[0]}
              stroke="#d1d5db"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          ))}

          {/* Avg line */}
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

          {/* Layer 1: Energy curve */}
          <Area
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            fill="url(#timelineGrad)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[...new Set(blocks.map((b) => b.block))].map((type) => (
          <span key={type} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: BLOCK_EVAL_COLORS[type] || '#6B7280' }}
            />
            {BLOCK_LABELS[type] || type}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-3 h-2 rounded-sm bg-red-100 border border-red-200" />
          이탈 위험
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-3 h-0 border-t border-dashed border-gray-300" />
          씬 경계
        </span>
      </div>
    </div>
  );
}
