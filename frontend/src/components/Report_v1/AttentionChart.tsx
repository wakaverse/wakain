import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import type { SceneCard, RiskZone } from '../../types';

interface Props {
  scenes: SceneCard[];
  riskZones: RiskZone[];
  safeZones: [number, number][];
  overallRetentionScore: number;
}

interface ChartPoint {
  time: number;
  score: number;
}

function buildChartData(scenes: SceneCard[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const scene of scenes) {
    const [start, end] = scene.time_range;
    const score = scene.attention?.attention_score ?? 50;
    points.push({ time: parseFloat(start.toFixed(1)), score });
    points.push({ time: parseFloat(end.toFixed(1)), score });
  }
  const seen = new Set<number>();
  return points
    .filter((p) => {
      if (seen.has(p.time)) return false;
      seen.add(p.time);
      return true;
    })
    .sort((a, b) => a.time - b.time);
}

const riskColors = {
  high:   '#ef4444',
  medium: '#f97316',
  low:    '#eab308',
};

const ROLE_BAR: Record<string, { color: string; label: string }> = {
  hook:       { color: '#ef4444', label: '훅'   },
  solution:   { color: '#60a5fa', label: '솔루션' },
  demo:       { color: '#3b82f6', label: '데모'  },
  proof:      { color: '#22c55e', label: '증거'  },
  cta:        { color: '#f59e0b', label: 'CTA'  },
  recap:      { color: '#a855f7', label: '리캡'  },
  transition: { color: '#d1d5db', label: '전환'  },
};

interface TooltipPayload { value: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-gray-500 text-xs">{label}초</p>
      <p className="text-gray-900 font-semibold">집중도 {payload[0].value}</p>
    </div>
  );
}

export default function AttentionChart({ scenes, riskZones, overallRetentionScore }: Props) {
  const data = buildChartData(scenes);
  const maxTime = data.length > 0 ? data[data.length - 1].time : 30;
  const totalDuration = scenes.length > 0 ? Math.max(...scenes.map((s) => s.time_range[1])) : maxTime;

  const retentionColor =
    overallRetentionScore >= 80 ? '#16a34a' : overallRetentionScore >= 60 ? '#d97706' : '#dc2626';

  const roles = [...new Set(scenes.map((s) => s.role))].filter((r) => ROLE_BAR[r]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">집중도 타임라인</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">전체 유지율</span>
          <span className="text-base font-bold" style={{ color: retentionColor }}>
            {overallRetentionScore}점
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        {/* Legend */}
        <div className="flex items-center gap-5 mb-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-blue-500 rounded" />
            집중도 커브
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2.5 bg-red-100 border border-red-200 rounded-sm" />
            이탈 위험
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="attentionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, maxTime]}
              tickFormatter={(v) => `${v}s`}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {riskZones.map((zone, i) => (
              <ReferenceArea
                key={i}
                x1={zone.time_range[0]}
                x2={zone.time_range[1]}
                fill={riskColors[zone.risk_level] || '#ef4444'}
                fillOpacity={0.08}
                stroke={riskColors[zone.risk_level] || '#ef4444'}
                strokeOpacity={0.25}
                strokeDasharray="4 4"
              />
            ))}

            <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="4 4" />

            <Area
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#attentionGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Scene role bar */}
        <div className="mt-4">
          <div className="flex h-4 rounded overflow-hidden gap-px">
            {scenes.map((scene) => {
              const roleCfg = ROLE_BAR[scene.role];
              const widthPct = (scene.duration / totalDuration) * 100;
              return (
                <div
                  key={scene.scene_id}
                  className="h-full flex-shrink-0"
                  style={{ width: `${widthPct}%`, backgroundColor: roleCfg?.color ?? '#e5e7eb' }}
                  title={`${roleCfg?.label ?? scene.role} · ${scene.time_range[0]}s–${scene.time_range[1]}s`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {roles.map((role) => {
              const cfg = ROLE_BAR[role];
              return (
                <div key={role} className="flex items-center gap-1 text-xs text-gray-400">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.color }} />
                  {cfg.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk zone annotations */}
        {riskZones.length > 0 && (
          <div className="mt-4 space-y-2">
            {riskZones.map((zone, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg"
              >
                <span className="text-red-400 flex-shrink-0 text-xs mt-0.5">⚠</span>
                <div>
                  <span className="text-red-600 font-medium text-xs">
                    {zone.time_range[0]}s – {zone.time_range[1]}s 이탈 위험
                  </span>
                  <p className="text-gray-500 text-xs mt-0.5">{zone.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
