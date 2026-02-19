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
  // Deduplicate by time
  const seen = new Set<number>();
  return points.filter((p) => {
    if (seen.has(p.time)) return false;
    seen.add(p.time);
    return true;
  }).sort((a, b) => a.time - b.time);
}

const riskColors = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#eab308',
};

interface TooltipPayload {
  value: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400">{label}초</p>
      <p className="text-white font-semibold">집중도 {payload[0].value}</p>
    </div>
  );
}

export default function AttentionChart({ scenes, riskZones, overallRetentionScore }: Props) {
  const data = buildChartData(scenes);
  const maxTime = data.length > 0 ? data[data.length - 1].time : 30;

  const retentionColor = overallRetentionScore >= 80 ? '#22c55e' : overallRetentionScore >= 60 ? '#eab308' : '#ef4444';

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-blue-400">📈</span> 집중도 분석
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">전체 리텐션</span>
          <span className="text-lg font-bold" style={{ color: retentionColor }}>
            {overallRetentionScore}점
          </span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        {/* Legend */}
        <div className="flex items-center gap-6 mb-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-400" />
            집중도 커브
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 bg-red-500/30 rounded-sm" />
            이탈 위험 구간
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 bg-green-500/20 rounded-sm" />
            안전 구간
          </div>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="attentionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, maxTime]}
              tickFormatter={(v) => `${v}s`}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Risk zones */}
            {riskZones.map((zone, i) => (
              <ReferenceArea
                key={i}
                x1={zone.time_range[0]}
                x2={zone.time_range[1]}
                fill={riskColors[zone.risk_level] || '#ef4444'}
                fillOpacity={0.15}
                stroke={riskColors[zone.risk_level] || '#ef4444'}
                strokeOpacity={0.4}
                strokeDasharray="4 4"
              />
            ))}

            {/* Threshold line */}
            <ReferenceLine y={50} stroke="#4b5563" strokeDasharray="4 4" />

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

        {/* Risk zone annotations */}
        {riskZones.length > 0 && (
          <div className="mt-5 space-y-2">
            {riskZones.map((zone, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm"
              >
                <span className="text-red-400 mt-0.5">⚠️</span>
                <div>
                  <span className="text-red-400 font-medium">
                    {zone.time_range[0]}s – {zone.time_range[1]}s 이탈 위험
                  </span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-400">{zone.suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
