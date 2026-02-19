import { Lightbulb, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { DropoffAnalysis, VideoRecipe } from '../../types';

interface Props {
  dropoffAnalysis: DropoffAnalysis;
  effectiveness: VideoRecipe['video_recipe']['effectiveness_assessment'];
}

export default function Suggestions({ dropoffAnalysis, effectiveness }: Props) {
  const improvements = dropoffAnalysis.improvement_priority ?? [];

  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="text-blue-400">💡</span> 개선 제안
      </h2>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Improvement priority */}
        {improvements.length > 0 && (
          <div className="bg-gray-900 border border-yellow-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h3 className="font-semibold text-white text-sm">개선 우선순위</h3>
            </div>
            <ul className="space-y-2">
              {improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risk zone suggestions */}
        {dropoffAnalysis.risk_zones?.length > 0 && (
          <div className="bg-gray-900 border border-red-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-red-400" />
              <h3 className="font-semibold text-white text-sm">이탈 위험 구간 대책</h3>
            </div>
            <ul className="space-y-3">
              {dropoffAnalysis.risk_zones.map((zone, i) => (
                <li key={i} className="text-sm">
                  <span className="text-red-400 font-mono text-xs">
                    {zone.time_range[0]}s – {zone.time_range[1]}s
                  </span>
                  <p className="text-gray-300 mt-0.5">{zone.suggestion}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Standout elements */}
        {effectiveness.standout_elements?.length > 0 && (
          <div className="bg-gray-900 border border-green-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <h3 className="font-semibold text-white text-sm">잘 된 점</h3>
            </div>
            <ul className="space-y-2">
              {effectiveness.standout_elements.map((el, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-sm text-gray-300">{el}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weak points */}
        {effectiveness.weak_points?.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-white text-sm">아쉬운 점</h3>
            </div>
            <ul className="space-y-2">
              {effectiveness.weak_points.map((el, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gray-500 mt-0.5 flex-shrink-0">×</span>
                  <span className="text-sm text-gray-400">{el}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
