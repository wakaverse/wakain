import type { PerformanceMetrics } from '../../types';

interface MetricDef {
  key: keyof PerformanceMetrics;
  label: string;
  unit: string;
  format: (v: number) => string;
  evaluate: (v: number) => 'good' | 'warning' | 'bad';
}

// Only the 6 most important metrics for marketers
const METRICS: MetricDef[] = [
  {
    key: 'attention_avg',
    label: '평균 집중도',
    unit: '점',
    format: (v) => v.toFixed(0),
    evaluate: (v) => (v >= 65 ? 'good' : v >= 45 ? 'warning' : 'bad'),
  },
  {
    key: 'time_to_first_appeal',
    label: '첫 소구 시간',
    unit: '초',
    format: (v) => v.toFixed(1),
    evaluate: (v) => (v <= 1 ? 'good' : v <= 3 ? 'warning' : 'bad'),
  },
  {
    key: 'appeal_count',
    label: '소구 수',
    unit: '개',
    format: (v) => v.toFixed(0),
    evaluate: (v) => (v >= 8 ? 'good' : v >= 4 ? 'warning' : 'bad'),
  },
  {
    key: 'cut_density',
    label: '컷 밀도',
    unit: '컷/초',
    format: (v) => v.toFixed(2),
    evaluate: (v) => (v >= 0.3 && v <= 1.5 ? 'good' : v >= 0.15 ? 'warning' : 'bad'),
  },
  {
    key: 'appeal_diversity',
    label: '소구 다양성',
    unit: '종',
    format: (v) => v.toFixed(0),
    evaluate: (v) => (v >= 5 ? 'good' : v >= 3 ? 'warning' : 'bad'),
  },
  {
    key: 'info_density',
    label: '정보 밀도',
    unit: '/초',
    format: (v) => v.toFixed(2),
    evaluate: (v) => (v >= 0.3 ? 'good' : v >= 0.15 ? 'warning' : 'bad'),
  },
];

const statusStyle = {
  good:    { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-100', label: '양호' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-100', label: '주의' },
  bad:     { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-100',   label: '개선' },
};

interface Props {
  metrics: PerformanceMetrics;
}

export default function Metrics({ metrics }: Props) {
  const counts = { good: 0, warning: 0, bad: 0 };
  METRICS.forEach((m) => {
    counts[m.evaluate(metrics[m.key] as number)]++;
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">핵심 지표</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-600">양호 {counts.good}</span>
          <span className="text-amber-600">주의 {counts.warning}</span>
          <span className="text-red-600">개선 {counts.bad}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {METRICS.map((m) => {
          const val = metrics[m.key] as number;
          const status = m.evaluate(val);
          const s = statusStyle[status];
          return (
            <div key={m.key} className={`p-4 bg-white border ${s.border} rounded-xl`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">{m.label}</p>
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${s.bg}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${s.text}`}>{m.format(val)}</span>
                <span className="text-xs text-gray-400">{m.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
