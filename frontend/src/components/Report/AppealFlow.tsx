import { useState } from 'react';
import type { AppealPoint } from '../../types';

const APPEAL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  myth_bust:     { label: '신화파괴',     color: 'text-purple-700',  bg: 'bg-purple-100',   border: 'border-purple-200' },
  sensory:       { label: '감각',         color: 'text-red-700',     bg: 'bg-red-100',      border: 'border-red-200'   },
  specification: { label: '스펙',         color: 'text-blue-700',    bg: 'bg-blue-100',     border: 'border-blue-200'  },
  price:         { label: '가격',         color: 'text-green-700',   bg: 'bg-green-100',    border: 'border-green-200' },
  process:       { label: '제조공정',     color: 'text-orange-700',  bg: 'bg-orange-100',   border: 'border-orange-200'},
  origin:        { label: '원산지',       color: 'text-amber-700',   bg: 'bg-amber-100',    border: 'border-amber-200' },
  authority:     { label: '권위',         color: 'text-indigo-700',  bg: 'bg-indigo-100',   border: 'border-indigo-200'},
  social_proof:  { label: '사회적증거',   color: 'text-pink-700',    bg: 'bg-pink-100',     border: 'border-pink-200'  },
  guarantee:     { label: '보증',         color: 'text-teal-700',    bg: 'bg-teal-100',     border: 'border-teal-200'  },
  comparison:    { label: '비교',         color: 'text-yellow-700',  bg: 'bg-yellow-100',   border: 'border-yellow-200'},
  urgency:       { label: '긴급',         color: 'text-red-700',     bg: 'bg-red-100',      border: 'border-red-200'   },
  lifestyle:     { label: '라이프스타일', color: 'text-sky-700',     bg: 'bg-sky-100',      border: 'border-sky-200'   },
  emotional:     { label: '감성',         color: 'text-purple-700',  bg: 'bg-purple-100',   border: 'border-purple-200'},
  achievement:   { label: '성과',         color: 'text-emerald-700', bg: 'bg-emerald-100',  border: 'border-emerald-200'},
};

function getAppealConfig(type: string) {
  return APPEAL_CONFIG[type] ?? { label: type, color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' };
}

const strengthConfig: Record<string, { label: string; color: string }> = {
  strong:   { label: '강함', color: 'text-green-600' },
  moderate: { label: '보통', color: 'text-amber-600' },
  weak:     { label: '약함', color: 'text-red-500' },
};

interface Props {
  appealPoints: AppealPoint[];
  primaryAppeal: string;
  appealLayering: string;
  persuasionSummary: string;
}

export default function AppealFlow({ appealPoints, primaryAppeal, appealLayering, persuasionSummary }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const primary = getAppealConfig(primaryAppeal);

  // Sort by timestamp
  const sorted = [...appealPoints].sort((a, b) => a.visual_proof.timestamp - b.visual_proof.timestamp);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base font-semibold text-gray-900">소구 흐름</h2>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${primary.bg} ${primary.color} ${primary.border} border`}>
          주 소구: {primary.label}
        </span>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
        {/* Horizontal scrollable appeal pills */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start gap-4 min-w-max">
            {sorted.map((ap, i) => {
              const cfg = getAppealConfig(ap.type);
              const isOpen = expanded === i;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-mono tabular-nums">{ap.visual_proof.timestamp}s</span>
                  <button
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${cfg.bg} ${cfg.color} ${cfg.border} ${
                      isOpen ? 'ring-2 ring-blue-400 ring-offset-1' : 'hover:opacity-75'
                    }`}
                  >
                    {cfg.label}
                  </button>
                  {/* Strength dot */}
                  <span className={`text-xs ${(strengthConfig[ap.strength] ?? { color: 'text-gray-400' }).color}`}>
                    {(strengthConfig[ap.strength] ?? { label: ap.strength }).label}
                  </span>
                </div>
              );
            })}

            {/* CTA cap */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs text-gray-400 font-mono tabular-nums">끝</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white border border-gray-700">
                CTA
              </span>
              <span className="text-xs text-gray-400">—</span>
            </div>
          </div>
        </div>

        {/* Track line */}
        <div className="mt-3 h-px bg-gray-100" />

        {/* Expanded detail */}
        {expanded !== null && sorted[expanded] && (() => {
          const ap = sorted[expanded];
          const cfg = getAppealConfig(ap.type);
          const str = strengthConfig[ap.strength] ?? { label: ap.strength, color: 'text-gray-500' };
          return (
            <div className={`mt-4 p-4 rounded-xl border ${cfg.border} ${cfg.bg}`}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-gray-300 text-xs">·</span>
                <span className={`text-xs font-medium ${str.color}`}>{str.label}</span>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-500 font-mono">{ap.visual_proof.timestamp}초</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1.5">"{ap.claim}"</p>
              <p className="text-xs text-gray-600 leading-relaxed">{ap.visual_proof.description}</p>
            </div>
          );
        })()}
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">레이어링 전략</p>
          <p className="text-sm text-gray-700 leading-relaxed">{appealLayering}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">설득 요약</p>
          <p className="text-sm text-gray-700 leading-relaxed">{persuasionSummary}</p>
        </div>
      </div>
    </section>
  );
}
