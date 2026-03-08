import { useTranslation } from 'react-i18next';
import type { AppealPoint, Prescription } from '../../types';

/* ── Helpers ──────────────────────────────────────────── */

const strengthConfig: Record<string, { label: string; bg: string; text: string }> = {
  strong: { label: '강', bg: 'bg-green-100', text: 'text-green-700' },
  moderate: { label: '중', bg: 'bg-amber-100', text: 'text-amber-700' },
  weak: { label: '약', bg: 'bg-red-100', text: 'text-red-700' },
};

const severityIcon: Record<string, string> = {
  danger: '🔴',
  warning: '⚠️',
  info: '💡',
};

/* ── Sub-sections ─────────────────────────────────────── */

function AppealRow({ appeal }: { appeal: AppealPoint }) {
  const { t } = useTranslation();
  const str = strengthConfig[appeal.strength];
  const sourceIcon = appeal.source === 'script' ? '🎤' : appeal.source === 'visual' ? '🎬' : '🔗';

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-sm shrink-0">{sourceIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-gray-900">
            {t(`appealType.${appeal.type}`, { defaultValue: appeal.type })}
          </span>
          {str && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${str.bg} ${str.text}`}>
              {t(`strength.${appeal.strength}`, { defaultValue: str?.label })}
            </span>
          )}
          {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
            <span className="text-[10px] text-gray-400">
              ({appeal.visual_proof.technique})
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-0.5">{appeal.claim}</p>
      </div>
    </div>
  );
}

function RxCard({ rx, onSeek }: { rx: Prescription; onSeek: (t: number) => void }) {
  const icon = severityIcon[rx.severity] || '💡';
  const borderColor =
    rx.severity === 'danger' ? 'border-red-200 bg-red-50/50'
    : rx.severity === 'warning' ? 'border-amber-200 bg-amber-50/50'
    : 'border-blue-200 bg-blue-50/50';

  const handleTimeClick = () => {
    if (!rx.time_range) return;
    const match = rx.time_range.match(/([\d.]+)/);
    if (match) onSeek(parseFloat(match[1]));
  };

  return (
    <div className={`rounded-lg border p-3 ${borderColor}`}>
      <div className="flex items-start gap-2">
        <span className="text-sm">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800">{rx.symptom}</p>
          <p className="text-xs text-gray-600 mt-1">&rarr; {rx.recommendation}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
            {rx.impact && <span>{rx.impact}</span>}
            {rx.time_range && (
              <button
                onClick={(e) => { e.stopPropagation(); handleTimeClick(); }}
                className="text-blue-600 hover:underline"
              >
                ⏱ {rx.time_range}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────── */

interface Props {
  cutId: number;
  timeRange: [number, number];
  script: string;
  appeals: AppealPoint[];
  prescriptions: Prescription[];
  persuasionIntent?: string;
  onSeek: (time: number) => void;
  onClose: () => void;
}

export default function CutDetail({
  cutId, timeRange, script, appeals, prescriptions, persuasionIntent,
  onSeek, onClose,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5 mt-2 animate-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header + close */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900">
          {t('cut.detail_title', { id: cutId })}
          <span className="text-gray-400 font-normal ml-2 font-mono text-xs">
            {timeRange[0].toFixed(1)}&ndash;{timeRange[1].toFixed(1)}s
          </span>
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none px-1"
        >
          ✕
        </button>
      </div>

      {/* Script */}
      {script && (
        <section>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('cut.script')}</h5>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 leading-relaxed">
            🎤 {script}
          </div>
        </section>
      )}

      {/* Persuasion Intent */}
      {persuasionIntent && (
        <section>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('cut.persuasion_intent')}</h5>
          <p className="text-sm text-gray-700">{persuasionIntent}</p>
        </section>
      )}

      {/* Appeals – grouped by source */}
      {appeals.length > 0 && (() => {
        const visualAppeals = appeals.filter(a => a.source === 'visual');
        const voiceAppeals = appeals.filter(a => a.source === 'script' || a.source === 'both');
        return (
          <section>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('cut.appeal_points', { count: appeals.length })}
            </h5>
            {visualAppeals.length > 0 && (
              <div className="mb-3">
                <h6 className="text-[11px] font-medium text-gray-400 mb-1">{'🎬 '}{t('cut.visual_appeal')}</h6>
                <div className="divide-y divide-gray-100">
                  {visualAppeals.map((appeal, i) => (
                    <AppealRow key={`v-${i}`} appeal={appeal} />
                  ))}
                </div>
              </div>
            )}
            {voiceAppeals.length > 0 && (
              <div>
                <h6 className="text-[11px] font-medium text-gray-400 mb-1">{'🎤 '}{t('cut.voice_appeal')}</h6>
                <div className="divide-y divide-gray-100">
                  {voiceAppeals.map((appeal, i) => (
                    <AppealRow key={`s-${i}`} appeal={appeal} />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* Prescriptions for this cut */}
      {prescriptions.length > 0 && (
        <section>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t('cut.prescriptions', { count: prescriptions.length })}
          </h5>
          <div className="space-y-2">
            {prescriptions.map((rx, i) => (
              <RxCard key={i} rx={rx} onSeek={onSeek} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
