import type { VideoRecipe, PerformanceMetrics } from '../../types';

const ratingToScore: Record<string, number> = {
  strong: 90,
  moderate: 60,
  weak: 30,
};

function calcScore(
  effectiveness: VideoRecipe['video_recipe']['effectiveness_assessment'],
  metrics: PerformanceMetrics,
  retentionScore: number,
): number {
  // retention 30%
  const retentionComponent = retentionScore * 0.3;

  // appeal diversity + count combined 20%
  const diversityScore = Math.min((metrics.appeal_diversity / 7) * 100, 100);
  const countScore = Math.min((metrics.appeal_count / 10) * 100, 100);
  const appealComponent = ((diversityScore + countScore) / 2) * 0.2;

  // effectiveness ratings 30%
  const ratings = [
    effectiveness.hook_rating,
    effectiveness.flow_rating,
    effectiveness.message_clarity,
    effectiveness.cta_strength,
    effectiveness.replay_factor,
  ];
  const effectivenessAvg =
    ratings.reduce((sum, r) => sum + (ratingToScore[r] ?? 50), 0) / ratings.length;
  const effectivenessComponent = effectivenessAvg * 0.3;

  // attention_avg 20%
  const attentionComponent = metrics.attention_avg * 0.2;

  return Math.round(retentionComponent + appealComponent + effectivenessComponent + attentionComponent);
}

function getGrade(score: number) {
  if (score >= 90) return { grade: 'S', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', summary: '최상위 퍼포먼스 영상입니다. 소구 구조와 집중도 모두 탁월합니다.' };
  if (score >= 75) return { grade: 'A', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', summary: '소구 구조가 탄탄하고 시청 유지율이 높은 잘 만든 영상입니다.' };
  if (score >= 60) return { grade: 'B', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', summary: '기본기는 갖췄으나 몇 가지 개선이 필요합니다.' };
  if (score >= 45) return { grade: 'C', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', summary: '주요 소구 요소가 부족하고 집중도 유지가 어렵습니다.' };
  return { grade: 'D', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', summary: '전반적인 구조 개선이 필요합니다.' };
}

function buildStrengths(
  effectiveness: VideoRecipe['video_recipe']['effectiveness_assessment'],
  metrics: PerformanceMetrics,
  retentionScore: number,
  firstAppealTime: number,
): string[] {
  const s: string[] = [];
  if (firstAppealTime <= 1) s.push(`훅 즉시 진입 (${firstAppealTime}초)`);
  if (metrics.appeal_diversity >= 6) s.push(`소구 ${metrics.appeal_diversity}종 다양`);
  if (retentionScore >= 85) s.push(`시청유지율 ${retentionScore}%`);
  if (effectiveness.hook_rating === 'strong') s.push('훅 강도 강함');
  if (effectiveness.flow_rating === 'strong') s.push('영상 흐름 자연스러움');
  if (effectiveness.message_clarity === 'strong') s.push('메시지 명확성 높음');
  (effectiveness.standout_elements ?? []).forEach((el) => { if (s.length < 4) s.push(el); });
  return s.slice(0, 3);
}

function buildWeaknesses(
  effectiveness: VideoRecipe['video_recipe']['effectiveness_assessment'],
  metrics: PerformanceMetrics,
  retentionScore: number,
): string[] {
  const w: string[] = [];
  if (effectiveness.cta_strength === 'weak') w.push('CTA 강도 약함');
  if (retentionScore < 70) w.push('후반 집중도 하락');
  if (effectiveness.hook_rating === 'weak') w.push('훅 강도 부족');
  if (metrics.appeal_diversity < 4) w.push('소구 다양성 부족');
  (effectiveness.weak_points ?? []).forEach((el) => { if (w.length < 4) w.push(el); });
  return w.slice(0, 3);
}

interface Props {
  effectiveness: VideoRecipe['video_recipe']['effectiveness_assessment'];
  metrics: PerformanceMetrics;
  retentionScore: number;
  firstAppealTime: number;
}

export default function OverallDiagnosis({ effectiveness, metrics, retentionScore, firstAppealTime }: Props) {
  const score = calcScore(effectiveness, metrics, retentionScore);
  const { grade, color, bg, border, summary } = getGrade(score);
  const strengths = buildStrengths(effectiveness, metrics, retentionScore, firstAppealTime);
  const weaknesses = buildWeaknesses(effectiveness, metrics, retentionScore);

  return (
    <section className="mb-10">
      <div className={`bg-white border ${border} rounded-2xl p-6 sm:p-8`}>
        {/* Score row */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-2">종합 진단</p>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-bold text-gray-900 leading-none">{score}</span>
              <span className="text-xl text-gray-300 leading-none">/100</span>
              <span className={`px-3 py-1 rounded-lg text-lg font-bold ${bg} ${color} border ${border}`}>
                {grade}등급
              </span>
            </div>
          </div>
        </div>

        {/* One-line summary */}
        <p className="text-gray-600 text-sm leading-relaxed mb-6 pb-6 border-b border-gray-100">
          {summary}
        </p>

        {/* Strengths + Weaknesses */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-3">강점</p>
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5 flex-shrink-0 font-bold">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-3">개선 필요</p>
            <ul className="space-y-2">
              {weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">△</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
