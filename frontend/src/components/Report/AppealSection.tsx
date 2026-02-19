import type { AppealPoint } from '../../types';

const APPEAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  myth_bust:    { label: '신화파괴',   color: 'text-purple-400',  bg: 'bg-purple-500/15' },
  sensory:      { label: '감각적',     color: 'text-red-400',     bg: 'bg-red-500/15' },
  specification:{ label: '스펙',       color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  price:        { label: '가격',       color: 'text-green-400',   bg: 'bg-green-500/15' },
  process:      { label: '제조공정',   color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  origin:       { label: '원산지',     color: 'text-amber-700',   bg: 'bg-amber-700/15' },
  authority:    { label: '권위',       color: 'text-indigo-400',  bg: 'bg-indigo-500/15' },
  social_proof: { label: '사회적증거', color: 'text-pink-400',    bg: 'bg-pink-500/15' },
  guarantee:    { label: '보증',       color: 'text-teal-400',    bg: 'bg-teal-500/15' },
  comparison:   { label: '비교',       color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  urgency:      { label: '긴급',       color: 'text-red-400',     bg: 'bg-red-500/15' },
  lifestyle:    { label: '라이프스타일', color: 'text-sky-400',   bg: 'bg-sky-500/15' },
  emotional:    { label: '감성',       color: 'text-purple-400',  bg: 'bg-purple-500/15' },
  achievement:  { label: '성과',       color: 'text-green-400',   bg: 'bg-green-500/15' },
};

function getAppealConfig(type: string) {
  return APPEAL_CONFIG[type] ?? { label: type, color: 'text-gray-400', bg: 'bg-gray-500/15' };
}

const strengthLabel: Record<string, { text: string; color: string }> = {
  strong:   { text: '강함', color: 'text-green-400' },
  moderate: { text: '보통', color: 'text-yellow-400' },
  weak:     { text: '약함', color: 'text-red-400' },
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

interface Props {
  appealPoints: AppealPoint[];
  primaryAppeal: string;
  appealLayering: string;
  persuasionSummary: string;
}

export default function AppealSection({ appealPoints, primaryAppeal, appealLayering, persuasionSummary }: Props) {
  const primary = getAppealConfig(primaryAppeal);

  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="text-blue-400">🎯</span> 소구 분석
      </h2>

      {/* Summary */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-2">핵심 소구 전략</p>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${primary.bg} ${primary.color} mb-3`}>
            {primary.label}
          </span>
          <p className="text-sm text-gray-300 leading-relaxed">{persuasionSummary}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-2">소구 레이어링 전략</p>
          <p className="text-sm text-gray-300 leading-relaxed">{appealLayering}</p>
        </div>
      </div>

      {/* Appeal points list */}
      <div className="space-y-3">
        {appealPoints.map((ap, i) => {
          const cfg = getAppealConfig(ap.type);
          const str = strengthLabel[ap.strength] ?? { text: ap.strength, color: 'text-gray-400' };
          return (
            <div key={i} className="flex gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
              {/* Timeline marker */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                <div className="text-xs font-mono text-gray-500 w-10 text-center">
                  {formatTime(ap.visual_proof.timestamp)}
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${cfg.bg} border border-current ${cfg.color}`} />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className={`text-xs ${str.color}`}>{str.text}</span>
                </div>
                <p className="text-white text-sm font-medium mb-1">"{ap.claim}"</p>
                <p className="text-gray-400 text-xs leading-relaxed">{ap.visual_proof.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
