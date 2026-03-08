import { useState } from 'react';
import { Package, ChevronDown } from 'lucide-react';
import type { RecipeJSON } from '../../types/recipe';
import { CLAIM_TYPE_INFO, formatTimeRange } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
}

export default function ProductSection({ data, seekTo }: Props) {
  const [expanded, setExpanded] = useState(false);
  const claims = data.product.claims;

  if (!claims?.length) return null;

  const grouped = claims.reduce<Record<string, typeof claims>>((acc, claim) => {
    if (!acc[claim.type]) acc[claim.type] = [];
    acc[claim.type].push(claim);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-semibold text-gray-900">제품 축</p>
          <span className="text-xs text-gray-400">({claims.length}개)</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          {expanded ? '접기' : '상세'}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Summary list */}
      <div className="space-y-1">
        {Object.entries(grouped).map(([type, items]) => {
          const info = CLAIM_TYPE_INFO[type] || { label: type, icon: '📌' };
          return (
            <div key={type} className="flex items-center gap-2 py-1 text-xs">
              <span className="w-5 text-center">{info.icon}</span>
              <span className="text-gray-500 w-20 shrink-0">{info.label}</span>
              <span className="font-bold text-blue-500 w-5">{items.length}</span>
              <span className="text-gray-400 truncate">
                {items.map((c) => c.claim).join(', ')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
          {Object.entries(grouped).map(([type, items]) => {
            const info = CLAIM_TYPE_INFO[type] || { label: type, icon: '📌' };
            return (
              <div key={type}>
                <div className="text-[11px] font-semibold text-blue-500 mb-2">
                  {info.icon} {info.label}
                </div>
                {items.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 pl-5 text-xs border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">
                        {c.layer}
                      </span>
                      <span className="text-gray-800">{c.claim}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 shrink-0 ml-2">
                      <span>{c.source}</span>
                      <button
                        onClick={() => seekTo(c.time_range[0])}
                        className="font-mono text-[10px] hover:text-gray-600"
                      >
                        {formatTimeRange(c.time_range)} ▶
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
