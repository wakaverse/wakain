import { useTranslation } from 'react-i18next';
import type { AppealPoint } from '../../types';

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
  const { t } = useTranslation();
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
          <img src={thumbnailUrl} alt={t('cut.detail_title', { id: cutId })} className="absolute inset-0 w-full h-full object-cover" />
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
              {t(`role.${role}`, { defaultValue: role })}
            </span>
          </div>
        )}

        {/* Playing indicator */}
        {isActive && !isExpanded && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/90 text-white backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {t('report.playing')}
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
                {t(`appealType.${appeal.type}`, { defaultValue: appeal.type })}
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
