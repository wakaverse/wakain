interface Dimension {
  name_ko: string;
  value: number;
  evidence: string;
}

interface Props {
  dimensions: Dimension[];
  engagementScore: number;
}

const dimIcons: Record<string, string> = {
  '시각적 자극도': '👁',
  '설득 밀도': '💬',
  '정보 밀도': '📝',
  '편집 리듬': '✂️',
  '청각 자극도': '🔊',
};

const getBarColor = (value: number) => {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-blue-500';
  if (value >= 40) return 'bg-amber-500';
  return 'bg-red-500';
};

export default function DimensionChart({ dimensions, engagementScore }: Props) {
  return (
    <div className="bg-white rounded-xl border p-6">
      {/* 종합 점수 */}
      <div className="text-center mb-6">
        <div className="text-5xl font-bold text-gray-900">{Math.round(engagementScore)}</div>
        <div className="text-sm text-gray-500 mt-1">종합 점수</div>
      </div>

      {/* 5차원 바 차트 */}
      <div className="space-y-3">
        {dimensions.map((d) => (
          <div key={d.name_ko} className="group">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">
                {dimIcons[d.name_ko] || '📊'} {d.name_ko}
              </span>
              <span className="font-bold text-gray-900">{Math.round(d.value)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${getBarColor(d.value)}`}
                style={{ width: `${Math.min(100, d.value)}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {d.evidence}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
