import { useState, useRef } from 'react';
import type { ScriptAnalysis, ScriptAlpha, ScriptUtterance } from '../../types';

/* ── Korean labels ─────────────────────────── */

const ELEMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  authority:           { bg: 'bg-purple-100', text: 'text-purple-700', label: '①권위' },
  hook:                { bg: 'bg-red-100',    text: 'text-red-700',    label: '②훅' },
  sensory_description: { bg: 'bg-orange-100', text: 'text-orange-700', label: '③묘사' },
  simplicity:          { bg: 'bg-green-100',  text: 'text-green-700',  label: '④간편' },
  process:             { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '⑤과정' },
  social_proof:        { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '⑥증거' },
  cta:                 { bg: 'bg-pink-100',   text: 'text-pink-700',   label: '⑦CTA' },
};

const EMOTION_KO: Record<string, string> = {
  empathy: '공감', fomo: 'FOMO', anticipation: '기대감', relief: '안심',
  curiosity: '궁금증', pride: '자부심', nostalgia: '향수', frustration: '불만',
};

const STRUCTURE_KO: Record<string, string> = {
  reversal: '반전', contrast: '대조', repetition: '반복', info_density: '정보압축',
  escalation: '에스컬레이션', before_after: '비포→애프터', problem_solution: '문제→해결', story_arc: '스토리',
};

const CONNECTION_KO: Record<string, string> = {
  bridge_sentence: '브릿지', rhythm_shift: '리듬전환', callback: '콜백',
  question_answer: 'Q&A', pause_emphasis: '멈춤강조',
};

/* ── Timeline bar (B) ──────────────────────── */

function TimelineBar({
  utterances,
  duration,
  onClickUtterance,
}: {
  utterances: ScriptUtterance[];
  duration: number;
  onClickUtterance: (index: number) => void;
}) {
  if (!duration || duration <= 0) return null;

  // Build element segments (merge consecutive same-element)
  type Segment = { element: string; start: number; end: number; indices: number[] };
  const segments: Segment[] = [];
  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    const el = u.element || 'none';
    const start = u.time_range[0];
    const end = u.time_range[1];
    const last = segments[segments.length - 1];
    if (last && last.element === el && Math.abs(start - last.end) < 1) {
      last.end = end;
      last.indices.push(i);
    } else {
      segments.push({ element: el, start, end, indices: [i] });
    }
  }

  return (
    <div className="space-y-2">
      {/* Element layer */}
      <div className="relative h-7 bg-gray-50 rounded-lg overflow-hidden">
        {segments.filter(s => s.element !== 'none').map((seg, i) => {
          const colors = ELEMENT_COLORS[seg.element] || { bg: 'bg-gray-200', text: 'text-gray-600', label: seg.element };
          const left = (seg.start / duration) * 100;
          const width = Math.max(((seg.end - seg.start) / duration) * 100, 3);
          return (
            <button
              key={i}
              onClick={() => onClickUtterance(seg.indices[0])}
              className={`absolute top-0 h-full ${colors.bg} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border-r border-white/50`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={colors.label}
            >
              <span className={`text-[9px] font-bold ${colors.text} truncate px-0.5`}>{colors.label}</span>
            </button>
          );
        })}
      </div>

      {/* Alpha layers: emotion + structure + connection */}
      <AlphaLayerBar
        utterances={utterances}
        duration={duration}
        layerKey="emotion_layer"
        labelMap={EMOTION_KO}
        color="text-rose-500"
        bgColor="bg-rose-50"
        icon="💭"
      />
      <AlphaLayerBar
        utterances={utterances}
        duration={duration}
        layerKey="structure_layer"
        labelMap={STRUCTURE_KO}
        color="text-indigo-500"
        bgColor="bg-indigo-50"
        icon="🔀"
      />
      <AlphaLayerBar
        utterances={utterances}
        duration={duration}
        layerKey="connection_layer"
        labelMap={CONNECTION_KO}
        color="text-teal-500"
        bgColor="bg-teal-50"
        icon="🔗"
      />
    </div>
  );
}

function AlphaLayerBar({
  utterances, duration, layerKey, labelMap, color, bgColor, icon,
}: {
  utterances: ScriptUtterance[];
  duration: number;
  layerKey: 'emotion_layer' | 'structure_layer' | 'connection_layer';
  labelMap: Record<string, string>;
  color: string;
  bgColor: string;
  icon: string;
}) {
  const items = utterances
    .map((u, i) => ({ value: u[layerKey], time_range: u.time_range, index: i }))
    .filter(x => x.value);

  if (items.length === 0) return null;

  return (
    <div className="relative h-5 bg-gray-50/50 rounded overflow-hidden">
      {items.map((item, i) => {
        const left = (item.time_range[0] / duration) * 100;
        const width = Math.max(((item.time_range[1] - item.time_range[0]) / duration) * 100, 4);
        const label = labelMap[item.value!] || item.value;
        return (
          <div
            key={i}
            className={`absolute top-0 h-full ${bgColor} flex items-center px-0.5`}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={`${icon} ${label}`}
          >
            <span className={`text-[8px] font-medium ${color} truncate`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Utterance list (A — expandable) ────── */

function UtteranceList({
  utterances,
  seekTo,
  highlightIndex,
  listRef,
}: {
  utterances: ScriptUtterance[];
  seekTo: (s: number) => void;
  highlightIndex: number | null;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={listRef} className="space-y-1 max-h-[400px] overflow-y-auto">
      {utterances.map((u, i) => {
        const elColors = ELEMENT_COLORS[u.element || ''];
        const isHighlighted = highlightIndex === i;
        const emotionLabel = u.emotion_layer ? EMOTION_KO[u.emotion_layer] || u.emotion_layer : null;
        const structLabel = u.structure_layer ? STRUCTURE_KO[u.structure_layer] || u.structure_layer : null;
        const connLabel = u.connection_layer ? CONNECTION_KO[u.connection_layer] || u.connection_layer : null;
        return (
          <div
            key={i}
            data-utt-index={i}
            className={`py-2 px-3 rounded-lg transition-colors ${isHighlighted ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-start gap-2">
              <button
                onClick={() => seekTo(u.time_range[0])}
                className="shrink-0 text-[10px] font-mono text-gray-400 hover:text-gray-600 mt-0.5"
              >
                {fmtTime(u.time_range[0])}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-relaxed">&ldquo;{u.text}&rdquo;</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {elColors && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${elColors.bg} ${elColors.text} font-medium`}>
                      {elColors.label}
                    </span>
                  )}
                  {emotionLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 font-medium">
                      💭 {emotionLabel}
                    </span>
                  )}
                  {structLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 font-medium">
                      🔀 {structLabel}
                    </span>
                  )}
                  {connLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-500 font-medium">
                      🔗 {connLabel}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => seekTo(u.time_range[0])}
                className="shrink-0 text-[10px] text-gray-300 hover:text-gray-500"
              >
                ▶
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Main component ────────────────────── */

export default function ScriptTimeline({
  scriptAnalysis,
  scriptAlpha,
  duration,
  seekTo,
}: {
  scriptAnalysis?: ScriptAnalysis;
  scriptAlpha?: ScriptAlpha;
  duration: number;
  seekTo: (s: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build utterances: prefer script_alpha, fallback to script_analysis appeals
  const utterances: ScriptUtterance[] = scriptAlpha?.utterances
    ?? scriptAnalysis?.appeals?.filter(a => a.used).map(a => ({
      text: a.text,
      time_range: a.time_range,
      element: a.element,
    }))
    ?? [];

  if (utterances.length === 0) return null;

  const effectiveDuration = duration || Math.max(...utterances.map(u => u.time_range[1]), 30);

  // Alpha technique summaries
  const emotionCount = scriptAlpha?.emotion_techniques?.length ?? 0;
  const structureCount = scriptAlpha?.structure_techniques?.length ?? 0;
  const connectionCount = scriptAlpha?.connection_techniques?.length ?? 0;
  const alphaTotal = emotionCount + structureCount + connectionCount;

  const handleClickUtterance = (index: number) => {
    setExpanded(true);
    setHighlightIndex(index);
    // Scroll to utterance
    setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-utt-index="${index}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    // Seek video
    if (utterances[index]) {
      seekTo(utterances[index].time_range[0]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-semibold text-gray-900">📝 대본 해부</p>
        {scriptAnalysis && (
          <span className="text-xs text-gray-400">
            {scriptAnalysis.elements_used}/{scriptAnalysis.elements_total} 요소
          </span>
        )}
        {alphaTotal > 0 && (
          <span className="text-xs text-gray-400 ml-auto">
            +{alphaTotal} 기법
          </span>
        )}
      </div>

      {/* Timeline bar (B) — always visible */}
      <TimelineBar
        utterances={utterances}
        duration={effectiveDuration}
        onClickUtterance={handleClickUtterance}
      />

      {/* Alpha summary chips */}
      {alphaTotal > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {scriptAlpha?.emotion_techniques?.map((t, i) => (
            <span key={`e${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-500">
              💭 {EMOTION_KO[t.type] || t.type}
            </span>
          ))}
          {scriptAlpha?.structure_techniques?.map((t, i) => (
            <span key={`s${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500">
              🔀 {STRUCTURE_KO[t.type] || t.type}
            </span>
          ))}
          {scriptAlpha?.connection_techniques?.map((t, i) => (
            <span key={`c${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-500">
              🔗 {CONNECTION_KO[t.type] || t.type}
            </span>
          ))}
        </div>
      )}

      {/* Expandable utterance list (A) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {expanded ? '▾ 대본 접기' : '▸ 대본 상세 보기'}
      </button>

      {expanded && (
        <UtteranceList
          utterances={utterances}
          seekTo={seekTo}
          highlightIndex={highlightIndex}
          listRef={listRef}
        />
      )}
    </div>
  );
}
