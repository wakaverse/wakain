import type { DropoffAnalysis, VideoRecipe } from '../../types';

interface Props {
  dropoffAnalysis: DropoffAnalysis;
  effectiveness: VideoRecipe['video_recipe']['effectiveness_assessment'];
}

export default function Suggestions({ dropoffAnalysis, effectiveness }: Props) {
  const improvements = dropoffAnalysis.improvement_priority ?? [];

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-4">개선 제안</h2>

      {/* Numbered priority list */}
      {improvements.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="space-y-3">
            {improvements.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk zones + weak points */}
      {(dropoffAnalysis.risk_zones?.length > 0 || effectiveness.weak_points?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {dropoffAnalysis.risk_zones?.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-widest mb-3">이탈 위험 구간</p>
              <ul className="space-y-3">
                {dropoffAnalysis.risk_zones.map((zone, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs text-red-500 font-semibold">
                      {zone.time_range[0]}s – {zone.time_range[1]}s
                    </span>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{zone.suggestion}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {effectiveness.weak_points?.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">아쉬운 점</p>
              <ul className="space-y-2">
                {effectiveness.weak_points.map((el, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-gray-300 flex-shrink-0 font-bold">×</span>
                    {el}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
