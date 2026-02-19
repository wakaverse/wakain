import type { PerformanceMetrics } from '../../types';

interface MetricDef {
  key: keyof PerformanceMetrics;
  label: string;
  unit: string;
  description: string;
  format: (v: number) => string;
  evaluate: (v: number) => 'good' | 'warning' | 'bad';
}

const METRICS: MetricDef[] = [
  {
    key: 'brand_exposure_sec',
    label: '브랜드 노출 시간',
    unit: '초',
    description: '영상 내 브랜드가 노출된 총 시간',
    format: (v) => v.toFixed(1),
    evaluate: (v) => v >= 20 ? 'good' : v >= 10 ? 'warning' : 'bad',
  },
  {
    key: 'product_focus_ratio',
    label: '제품 집중도',
    unit: '%',
    description: '화면에서 제품이 차지하는 비율',
    format: (v) => v.toFixed(0),
    evaluate: (v) => v >= 70 ? 'good' : v >= 40 ? 'warning' : 'bad',
  },
  {
    key: 'text_readability_score',
    label: '텍스트 가독성',
    unit: '점',
    description: '화면 텍스트의 가독성 점수',
    format: (v) => v.toFixed(0),
    evaluate: (v) => v >= 80 ? 'good' : v >= 60 ? 'warning' : 'bad',
  },
  {
    key: 'time_to_first_appeal',
    label: '첫 소구까지 시간',
    unit: '초',
    description: '영상 시작 후 첫 번째 소구 포인트까지의 시간',
    format: (v) => v.toFixed(1),
    evaluate: (v) => v <= 1 ? 'good' : v <= 3 ? 'warning' : 'bad',
  },
  {
    key: 'time_to_cta',
    label: 'CTA 등장 시간',
    unit: '초',
    description: '영상 시작 후 CTA가 등장하는 시간',
    format: (v) => v.toFixed(1),
    evaluate: (v) => v <= 20 ? 'good' : v <= 25 ? 'warning' : 'bad',
  },
  {
    key: 'info_density',
    label: '정보 밀도',
    unit: '소구/초',
    description: '초당 소구 포인트 수',
    format: (v) => v.toFixed(2),
    evaluate: (v) => v >= 0.3 ? 'good' : v >= 0.15 ? 'warning' : 'bad',
  },
  {
    key: 'appeal_count',
    label: '소구 포인트 수',
    unit: '개',
    description: '영상에 포함된 총 소구 포인트 수',
    format: (v) => v.toFixed(0),
    evaluate: (v) => v >= 8 ? 'good' : v >= 4 ? 'warning' : 'bad',
  },
  {
    key: 'appeal_diversity',
    label: '소구 다양성',
    unit: '종',
    description: '사용된 소구 타입의 종류 수',
    format: (v) => v.toFixed(0),
    evaluate: (v) => v >= 5 ? 'good' : v >= 3 ? 'warning' : 'bad',
  },
  {
    key: 'cut_density',
    label: '컷 밀도',
    unit: '컷/초',
    description: '초당 컷 수',
    format: (v) => v.toFixed(3),
    evaluate: (v) => v >= 0.3 && v <= 1.5 ? 'good' : v >= 0.15 ? 'warning' : 'bad',
  },
  {
    key: 'attention_avg',
    label: '평균 집중도',
    unit: '점',
    description: '씬 전체의 평균 집중도 점수',
    format: (v) => v.toFixed(0),
    evaluate: (v) => v >= 65 ? 'good' : v >= 45 ? 'warning' : 'bad',
  },
  {
    key: 'attention_valley_count',
    label: '집중도 저하 횟수',
    unit: '회',
    description: '집중도가 급락한 구간의 수',
    format: (v) => v.toFixed(0),
    evaluate: (v) => v <= 1 ? 'good' : v <= 3 ? 'warning' : 'bad',
  },
];

const statusStyle = {
  good:    { dot: 'bg-green-400',  text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  label: '양호' },
  warning: { dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: '주의' },
  bad:     { dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    label: '개선' },
};

interface Props {
  metrics: PerformanceMetrics;
}

export default function Metrics({ metrics }: Props) {
  const counts = { good: 0, warning: 0, bad: 0 };
  METRICS.forEach((m) => {
    const val = metrics[m.key] as number;
    counts[m.evaluate(val)]++;
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-blue-400">⚡</span> 퍼포먼스 메트릭
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">양호 {counts.good}</span>
          <span className="text-yellow-400">주의 {counts.warning}</span>
          <span className="text-red-400">개선 {counts.bad}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {METRICS.map((m) => {
          const val = metrics[m.key] as number;
          const status = m.evaluate(val);
          const s = statusStyle[status];
          return (
            <div
              key={m.key}
              className={`p-4 bg-gray-900 border rounded-xl ${s.border} hover:border-opacity-50 transition-colors`}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-gray-500 leading-tight flex-1 pr-2">{m.label}</p>
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${s.bg} flex-shrink-0`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${s.text}`}>{m.format(val)}</span>
                <span className="text-xs text-gray-500">{m.unit}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{m.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
