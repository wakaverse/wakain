import type { ScriptAnalysis, ScriptAnalysisAppeal, ScriptElement, AppealPoint } from '../../types';

/* ── Element metadata ───────────────────────── */

const ELEMENT_META: Record<ScriptElement, { num: string; name: string }> = {
  authority:           { num: '①', name: '권위' },
  hook:                { num: '②', name: '훅' },
  sensory_description: { num: '③', name: '상황 묘사' },
  simplicity:          { num: '④', name: '간편함' },
  process:             { num: '⑤', name: '과정' },
  social_proof:        { num: '⑥', name: '사회적 증거' },
  cta:                 { num: '⑦', name: 'CTA' },
};

const ALL_ELEMENTS: ScriptElement[] = [
  'authority', 'hook', 'sensory_description', 'simplicity', 'process', 'social_proof', 'cta',
];

/* ── Pill ────────────────────────────────────── */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[11px] px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
      {children}
    </span>
  );
}

/* ── Appeal row ──────────────────────────────── */

function AppealRow({ appeal, seekTo }: { appeal: ScriptAnalysisAppeal; seekTo: (s: number) => void }) {
  const meta = ELEMENT_META[appeal.element];
  if (!meta || !appeal.used) return null;

  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono text-gray-300">{meta.num}</span>
        <span className="text-sm font-semibold text-gray-900">{meta.name}</span>
        <span className="text-xs text-gray-400">✓</span>
        {appeal.subtype && <Pill>{appeal.subtype}</Pill>}
        {appeal.time_range && (
          <button
            onClick={() => seekTo(appeal.time_range[0])}
            className="ml-auto text-[10px] font-mono text-gray-300 hover:text-gray-500 transition-colors"
          >
            {formatTime(appeal.time_range[0])}–{formatTime(appeal.time_range[1])} ▶
          </button>
        )}
      </div>
      {appeal.text && (
        <p className="text-sm text-gray-600 pl-6 leading-relaxed">
          &ldquo;{appeal.text}&rdquo;
        </p>
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Fallback from legacy appeal_points ─────── */

function buildFallbackAppeals(appealPoints: AppealPoint[]): ScriptAnalysisAppeal[] {
  const mapping: Record<string, ScriptElement> = {
    authority: 'authority',
    social_proof: 'social_proof',
    feature_demo: 'sensory_description',
    track_record: 'social_proof',
    guarantee: 'cta',
    price: 'simplicity',
    manufacturing: 'process',
  };

  const seen = new Set<ScriptElement>();
  const result: ScriptAnalysisAppeal[] = [];

  for (const ap of appealPoints) {
    const el = mapping[ap.type];
    if (!el || seen.has(el)) continue;
    seen.add(el);
    result.push({
      element: el,
      used: true,
      subtype: ap.type,
      text: ap.claim,
      time_range: [ap.visual_proof?.timestamp ?? 0, ap.visual_proof?.timestamp ?? 0],
    });
  }
  return result;
}

/* ── Main component ──────────────────────────── */

interface Props {
  scriptAnalysis?: ScriptAnalysis;
  appealPoints?: AppealPoint[];
  hookLine?: string;
  seekTo: (s: number) => void;
}

export default function ScriptBreakdown({ scriptAnalysis, appealPoints, hookLine, seekTo }: Props) {
  if (!scriptAnalysis && (!appealPoints?.length)) return null;

  // Build ordered appeals list
  let orderedAppeals: ScriptAnalysisAppeal[] = [];

  if (scriptAnalysis) {
    // Order by flow_order, then remaining
    const appealsByElement = new Map(
      scriptAnalysis.appeals.filter(a => a.used).map(a => [a.element, a])
    );
    const ordered: ScriptAnalysisAppeal[] = [];
    for (const el of scriptAnalysis.flow_order) {
      const appeal = appealsByElement.get(el as ScriptElement);
      if (appeal) ordered.push(appeal);
    }
    // Add any used elements not in flow_order
    for (const el of ALL_ELEMENTS) {
      if (!scriptAnalysis.flow_order.includes(el)) {
        const appeal = appealsByElement.get(el);
        if (appeal) ordered.push(appeal);
      }
    }
    orderedAppeals = ordered;
  } else if (appealPoints) {
    orderedAppeals = buildFallbackAppeals(appealPoints);
  }

  const usedCount = scriptAnalysis?.elements_used ?? orderedAppeals.filter(a => a.used).length;
  const totalCount = scriptAnalysis?.elements_total ?? 7;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-semibold text-gray-900">📝 대본 해부</p>
        <span className="text-xs text-gray-400 ml-auto">
          {usedCount}/{totalCount} 요소 사용
        </span>
      </div>

      {/* Hook summary from script_analysis */}
      {scriptAnalysis?.hook && (
        <div className="mb-3 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-300">②</span>
            <span className="text-sm font-semibold text-gray-900">훅</span>
            <span className="text-xs text-gray-400">✓</span>
            <Pill>{scriptAnalysis.hook.pattern}</Pill>
            {scriptAnalysis.hook.direct_experience && (
              <Pill>직접경험</Pill>
            )}
            {scriptAnalysis.hook.time_range && (
              <button
                onClick={() => seekTo(scriptAnalysis.hook.time_range[0])}
                className="ml-auto text-[10px] font-mono text-gray-300 hover:text-gray-500 transition-colors"
              >
                {formatTime(scriptAnalysis.hook.time_range[0])}–{formatTime(scriptAnalysis.hook.time_range[1])} ▶
              </button>
            )}
          </div>
          {scriptAnalysis.hook.text && (
            <p className="text-sm text-gray-600 pl-6 leading-relaxed">
              &ldquo;{scriptAnalysis.hook.text}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Fallback hook line when no script_analysis */}
      {!scriptAnalysis && hookLine && (
        <div className="mb-3 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-300">②</span>
            <span className="text-sm font-semibold text-gray-900">훅</span>
            <span className="text-xs text-gray-400">✓</span>
          </div>
          <p className="text-sm text-gray-600 pl-6 leading-relaxed">&ldquo;{hookLine}&rdquo;</p>
        </div>
      )}

      {/* Appeals (excluding hook which is shown separately above) */}
      <div>
        {orderedAppeals
          .filter(a => a.element !== 'hook' && a.element !== 'cta')
          .map((appeal) => (
            <AppealRow key={appeal.element} appeal={appeal} seekTo={seekTo} />
          ))}
      </div>

      {/* CTA — always last */}
      {scriptAnalysis?.cta ? (
        <div className="py-3 border-t border-gray-50 mt-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-300">⑦</span>
            <span className="text-sm font-semibold text-gray-900">CTA</span>
            <span className="text-xs text-gray-400">✓</span>
            {scriptAnalysis.cta.type && <Pill>{scriptAnalysis.cta.type}</Pill>}
            {scriptAnalysis.cta.keyword && <Pill>{scriptAnalysis.cta.keyword}</Pill>}
            {scriptAnalysis.cta.time_range && (
              <button
                onClick={() => seekTo(scriptAnalysis.cta.time_range[0])}
                className="ml-auto text-[10px] font-mono text-gray-300 hover:text-gray-500 transition-colors"
              >
                {formatTime(scriptAnalysis.cta.time_range[0])}–{formatTime(scriptAnalysis.cta.time_range[1])} ▶
              </button>
            )}
          </div>
          {scriptAnalysis.cta.text && (
            <p className="text-sm text-gray-600 pl-6 leading-relaxed">
              &ldquo;{scriptAnalysis.cta.text}&rdquo;
            </p>
          )}
        </div>
      ) : (
        // Fallback CTA from appeals
        orderedAppeals
          .filter(a => a.element === 'cta')
          .map((appeal) => (
            <AppealRow key="cta" appeal={appeal} seekTo={seekTo} />
          ))
      )}

      {/* Advanced techniques */}
      {scriptAnalysis?.advanced_techniques && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-1.5">
          {scriptAnalysis.advanced_techniques.reversal_structure && (
            <Pill>반전 구조</Pill>
          )}
          {scriptAnalysis.advanced_techniques.connecting_endings && (
            <Pill>연결어미 흐름</Pill>
          )}
          {scriptAnalysis.advanced_techniques.info_overload && (
            <Pill>정보 과밀 주의</Pill>
          )}
          {scriptAnalysis.advanced_techniques.target_consistency && (
            <Pill>타깃 일관성</Pill>
          )}
        </div>
      )}

      {!scriptAnalysis && (
        <p className="text-[11px] text-gray-400 mt-3">
          * 이전 버전으로 분석된 결과입니다. 재분석 시 7요소 상세 정보가 표시됩니다.
        </p>
      )}
    </div>
  );
}
