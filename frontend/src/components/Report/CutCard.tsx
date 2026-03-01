import type { AppealPoint } from '../../types';

const APPEAL_TYPE_KO: Record<string, string> = {
  myth_bust: '오해반박', ingredient: '원재료', manufacturing: '제조공정',
  track_record: '실적', price: '가격혜택', comparison: '비교우위',
  guarantee: '보장', origin: '원산지', feature_demo: '기능시연',
  spec_data: '스펙수치', design_aesthetic: '디자인', authenticity: '리얼',
  social_proof: '사회적증거', urgency: '긴급한정', lifestyle: '라이프스타일',
  nostalgia: '향수', authority: '권위', emotional: '감정호소',
};

const ROLE_KO: Record<string, string> = {
  hook: '훅', problem: '문제제기', solution: '해결책', demo: '시연',
  proof: '증거', brand_intro: '브랜드', recap: '정리', cta: 'CTA',
  transition: '전환', body: '본문',
};

interface Props {
  cutKey: string;
  cutId: number;
  timeRange: [number, number];
  appeals: AppealPoint[];
  script: string;
  groupColor: string;
  role: string;
  isActive: boolean;
  isExpanded: boolean;
  thumbnailUrl?: string;
  onClick: () => void;
}

export default function CutCard({
  cutId, timeRange, appeals, script, groupColor, role,
  isActive, isExpanded, thumbnailUrl, onClick,
}: Props) {
  return (
    <div
      className={`group/card rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md ${
        isExpanded
          ? 'ring-2 ring-gray-900 shadow-lg'
          : isActive
            ? 'ring-2 ring-blue-400/60 shadow-sm'
            : 'border-gray-100 hover:border-gray-200'
      } bg-white`}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div
        className="h-44 relative overflow-hidden"
        style={{ backgroundColor: `${groupColor}0a` }}
      >
        {/* Top color accent */}
        <div className="absolute top-0 inset-x-0 h-0.5 z-10" style={{ backgroundColor: groupColor }} />

        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={`컷 ${cutId}`} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <div
              className="text-5xl font-bold opacity-[0.06]"
              style={{ color: groupColor, fontFamily: 'var(--font-display), sans-serif' }}
            >
              {cutId}
            </div>
          </div>
        )}

        {/* Time badge */}
        <div className="absolute bottom-2 right-2 z-10">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
            {timeRange[0].toFixed(1)}&ndash;{timeRange[1].toFixed(1)}s
          </span>
        </div>

        {/* Role badge */}
        {role && (
          <div className="absolute top-2.5 right-2">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/70 text-white backdrop-blur-sm">
              {ROLE_KO[role] || role}
            </span>
          </div>
        )}

        {/* Playing indicator */}
        {isActive && !isExpanded && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/90 text-white backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              재생 중
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        {/* Appeal tags */}
        {appeals.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {appeals.slice(0, 3).map((appeal, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
              >
                {APPEAL_TYPE_KO[appeal.type] || appeal.type}
              </span>
            ))}
            {appeals.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400">
                +{appeals.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Key text */}
        {script && (
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {script}
          </p>
        )}
      </div>
    </div>
  );
}
