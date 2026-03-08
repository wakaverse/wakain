import { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import type { RecipeJSON } from '../../types/recipe';
import {
  BLOCK_LABELS,
  BLOCK_BORDER_COLORS,
  ALPHA_COLORS,
  formatTimeRange,
} from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
}

export default function ScriptSection({ data, seekTo }: Props) {
  const [expanded, setExpanded] = useState(false);
  const blocks = data.script.blocks;
  const alphaSummary = data.script.alpha_summary;

  if (!blocks?.length) return null;

  const emotionTotal = Object.values(alphaSummary?.emotion || {}).reduce((a, b) => a + b, 0);
  const structureTotal = Object.values(alphaSummary?.structure || {}).reduce((a, b) => a + b, 0);
  const connectionTotal = Object.values(alphaSummary?.connection || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          <p className="text-sm font-semibold text-gray-900">대본 축</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          {expanded ? '접기' : '펼치기'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Alpha summary */}
      {alphaSummary && (emotionTotal > 0 || structureTotal > 0 || connectionTotal > 0) && (
        <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-3 text-xs mb-2">
            <span className="font-semibold text-gray-600">화법</span>
            <span>{ALPHA_COLORS.emotion.icon}{emotionTotal}</span>
            <span>{ALPHA_COLORS.structure.icon}{structureTotal}</span>
            <span>{ALPHA_COLORS.connection.icon}{connectionTotal}</span>
          </div>
          <div className="text-xs space-y-0.5 text-gray-500">
            {emotionTotal > 0 && (
              <div>
                <span className="text-gray-400">감정:</span>{' '}
                {Object.entries(alphaSummary.emotion).map(([k, v]) => `${k}(${v})`).join(', ')}
              </div>
            )}
            {structureTotal > 0 && (
              <div>
                <span className="text-gray-400">구조:</span>{' '}
                {Object.entries(alphaSummary.structure).map(([k, v]) => `${k}(${v})`).join(', ')}
              </div>
            )}
            {connectionTotal > 0 && (
              <div>
                <span className="text-gray-400">연결:</span>{' '}
                {Object.entries(alphaSummary.connection).map(([k, v]) => `${k}(${v})`).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block list */}
      {expanded ? (
        <div className="space-y-0">
          {blocks.map((b, i) => {
            const borderColor = BLOCK_BORDER_COLORS[b.block] || '#71717A';
            return (
              <div
                key={i}
                className="py-3 border-b border-gray-100 last:border-0"
                style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: '12px' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    <BlockTag block={b.block} sub={b.benefit_sub} />
                    {b.alpha.emotion && <AlphaTag type="emotion" label={b.alpha.emotion} />}
                    {b.alpha.structure && <AlphaTag type="structure" label={b.alpha.structure} />}
                    {b.alpha.connection && <AlphaTag type="connection" label={b.alpha.connection} />}
                  </div>
                  <button
                    onClick={() => seekTo(b.time_range[0])}
                    className="text-[11px] text-gray-400 font-mono shrink-0 ml-2 hover:text-gray-600"
                  >
                    {formatTimeRange(b.time_range)} ▶
                  </button>
                </div>
                <div className="text-sm text-gray-600 leading-relaxed">
                  &ldquo;{b.text}&rdquo;
                </div>
                {b.product_claim_ref && (
                  <div className="mt-1">
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {b.product_claim_ref}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {blocks.map((b, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-xs">
              <BlockTag block={b.block} sub={b.benefit_sub} />
              <span className="text-gray-600 flex-1 truncate">
                &ldquo;{b.text.length > 50 ? b.text.slice(0, 50) + '...' : b.text}&rdquo;
              </span>
              <button
                onClick={() => seekTo(b.time_range[0])}
                className="text-gray-400 font-mono text-[11px] shrink-0 hover:text-gray-600"
              >
                {formatTimeRange(b.time_range).split('-')[0]} ▶
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockTag({ block, sub }: { block: string; sub?: string }) {
  const hex = BLOCK_BORDER_COLORS[block] || '#71717A';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${hex}18`, color: hex }}
    >
      {BLOCK_LABELS[block] || block}
      {sub && <span className="ml-0.5 opacity-70">·{sub}</span>}
    </span>
  );
}

function AlphaTag({ type, label }: { type: 'emotion' | 'structure' | 'connection'; label: string }) {
  const c = ALPHA_COLORS[type];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.icon}{label}
    </span>
  );
}
