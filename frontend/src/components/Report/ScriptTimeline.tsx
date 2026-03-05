import { useState } from 'react';
import type { ScriptAnalysis, ScriptAlpha, ScriptUtterance } from '../../types';

/* ── Korean labels ─────────────────────────── */

const ELEMENT_META: Record<string, { num: string; name: string; color: string }> = {
  authority:           { num: '①', name: '권위',   color: 'bg-purple-50 text-purple-700' },
  hook:                { num: '②', name: '훅',     color: 'bg-red-50 text-red-700' },
  sensory_description: { num: '③', name: '묘사',   color: 'bg-orange-50 text-orange-700' },
  simplicity:          { num: '④', name: '간편',   color: 'bg-green-50 text-green-700' },
  process:             { num: '⑤', name: '과정',   color: 'bg-blue-50 text-blue-700' },
  social_proof:        { num: '⑥', name: '증거',   color: 'bg-yellow-50 text-yellow-700' },
  cta:                 { num: '⑦', name: 'CTA',   color: 'bg-pink-50 text-pink-700' },
};

const EMOTION_KO: Record<string, string> = {
  empathy: '공감', fomo: 'FOMO', anticipation: '기대감', relief: '안심',
  curiosity: '궁금증', pride: '자부심', nostalgia: '향수', frustration: '불만',
};

const STRUCTURE_KO: Record<string, string> = {
  reversal: '반전', contrast: '대조', repetition: '반복', info_density: '정보압축',
  escalation: '고조', before_after: '비포→애프터', problem_solution: '문제→해결', story_arc: '스토리',
};

const CONNECTION_KO: Record<string, string> = {
  bridge_sentence: '브릿지', rhythm_shift: '리듬전환', callback: '콜백',
  question_answer: 'Q&A', pause_emphasis: '멈춤강조',
};

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── 7요소 표 ─────────────────────────────── */

function ElementTable({
  utterances,
  seekTo,
}: {
  utterances: ScriptUtterance[];
  seekTo: (s: number) => void;
}) {
  // Group utterances by element, keep first occurrence time
  const elementRows: { element: string; meta: typeof ELEMENT_META[string]; texts: { text: string; time: number }[] }[] = [];
  const seen = new Map<string, number>();

  for (const u of utterances) {
    const el = u.element;
    if (!el || !ELEMENT_META[el]) continue;
    if (!seen.has(el)) {
      seen.set(el, elementRows.length);
      elementRows.push({ element: el, meta: ELEMENT_META[el], texts: [] });
    }
    elementRows[seen.get(el)!].texts.push({ text: u.text, time: u.time_range[0] });
  }

  if (elementRows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {elementRows.map((row) => (
        <div key={row.element} className="flex items-start gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
          <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded font-semibold ${row.meta.color}`}>
            {row.meta.num} {row.meta.name}
          </span>
          <div className="flex-1 min-w-0">
            {row.texts.map((t, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>
            ))}
          </div>
          <button
            onClick={() => seekTo(row.texts[0].time)}
            className="shrink-0 text-[11px] font-mono text-gray-400 hover:text-gray-600"
          >
            {fmtTime(row.texts[0].time)} ▶
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── α 기법 표 ────────────────────────────── */

function AlphaTable({
  scriptAlpha,
  seekTo,
}: {
  scriptAlpha: ScriptAlpha;
  seekTo: (s: number) => void;
}) {
  type AlphaRow = { icon: string; category: string; label: string; text: string; time: number };
  const rows: AlphaRow[] = [];

  for (const t of scriptAlpha.emotion_techniques || []) {
    rows.push({
      icon: '💭',
      category: '감정',
      label: EMOTION_KO[t.type] || t.type,
      text: t.trigger_text || t.text || '',
      time: t.time_range[0],
    });
  }
  for (const t of scriptAlpha.structure_techniques || []) {
    rows.push({
      icon: '🔀',
      category: '구조',
      label: STRUCTURE_KO[t.type] || t.type,
      text: t.description || t.text || '',
      time: t.time_range[0],
    });
  }
  for (const t of scriptAlpha.connection_techniques || []) {
    rows.push({
      icon: '🔗',
      category: '연결',
      label: CONNECTION_KO[t.type] || t.type,
      text: t.text || t.trigger_text || '',
      time: t.time_range[0],
    });
  }

  // Sort by time
  rows.sort((a, b) => a.time - b.time);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
          <span className="shrink-0 text-[11px]">{row.icon}</span>
          <span className="shrink-0 text-[11px] font-medium text-gray-500 w-14">{row.label}</span>
          <p className="flex-1 text-sm text-gray-600 leading-relaxed truncate">{row.text}</p>
          <button
            onClick={() => seekTo(row.time)}
            className="shrink-0 text-[11px] font-mono text-gray-400 hover:text-gray-600"
          >
            {fmtTime(row.time)} ▶
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────── */

export default function ScriptTimeline({
  scriptAnalysis,
  scriptAlpha,
  seekTo,
}: {
  scriptAnalysis?: ScriptAnalysis;
  scriptAlpha?: ScriptAlpha;
  seekTo: (s: number) => void;
}) {
  const [alphaExpanded, setAlphaExpanded] = useState(false);

  // Build utterances: prefer script_alpha, fallback to script_analysis appeals
  const utterances: ScriptUtterance[] = scriptAlpha?.utterances
    ?? scriptAnalysis?.appeals?.filter(a => a.used).map(a => ({
      text: a.text,
      time_range: a.time_range,
      element: a.element,
    }))
    ?? [];

  if (utterances.length === 0) return null;

  // Alpha counts
  const emotionCount = scriptAlpha?.emotion_techniques?.length ?? 0;
  const structureCount = scriptAlpha?.structure_techniques?.length ?? 0;
  const connectionCount = scriptAlpha?.connection_techniques?.length ?? 0;
  const alphaTotal = emotionCount + structureCount + connectionCount;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-semibold text-gray-900">📝 대본 해부</p>
        {scriptAnalysis && (
          <span className="text-xs text-gray-400">
            {scriptAnalysis.elements_used}/{scriptAnalysis.elements_total} 요소
          </span>
        )}
      </div>

      {/* 7요소 표 */}
      <ElementTable utterances={utterances} seekTo={seekTo} />

      {/* α 기법 — 접기/펼치기 */}
      {alphaTotal > 0 && scriptAlpha && (
        <>
          <button
            onClick={() => setAlphaExpanded(!alphaExpanded)}
            className="mt-4 w-full flex items-center gap-2 py-2 border-t border-gray-100"
          >
            <span className="text-sm font-semibold text-gray-900">✦ 대본 기법</span>
            <span className="text-xs text-gray-400">
              💭{emotionCount} 🔀{structureCount} 🔗{connectionCount}
            </span>
            <span className="ml-auto text-xs text-gray-300">{alphaExpanded ? '▾' : '▸'}</span>
          </button>
          {alphaExpanded && (
            <AlphaTable scriptAlpha={scriptAlpha} seekTo={seekTo} />
          )}
        </>
      )}
    </div>
  );
}
