import type { RecipeJSON } from '../../types/recipe';

interface Props {
  data: RecipeJSON;
}

export default function PositioningCard({ data }: Props) {
  const positioning = data.evaluation?.positioning;
  if (!positioning) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">콘텐츠 포지셔닝</p>

      <div className="space-y-3">
        <InfoRow label="차별 각도" value={positioning.unique_angle} />
        <InfoRow label="스토리텔링 포맷" value={positioning.storytelling_format} />
        <InfoRow label="왜 통하는가" value={positioning.why_it_works} />

        {/* Contrast structure */}
        {positioning.contrast && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500">대비 구조</p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 shrink-0 mt-0.5 w-16">일반 인식</span>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {positioning.contrast.common_belief}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-blue-500 shrink-0 mt-0.5 w-16">역발상</span>
                <p className="text-sm text-gray-800 leading-relaxed font-medium">
                  {positioning.contrast.contrarian_reality}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-base text-gray-700 leading-loose">{value}</p>
    </div>
  );
}
